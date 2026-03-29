package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"

	"execgo-playground/orchestrators/go/internal/execgo"
	"execgo-playground/orchestrators/go/internal/graph"
	"execgo-playground/orchestrators/go/internal/state"
)

func main() {
	var requestPath string
	flag.StringVar(&requestPath, "request", "", "path to training request json")
	flag.Parse()

	if requestPath == "" {
		fmt.Fprintln(os.Stderr, "missing -request")
		os.Exit(1)
	}

	raw, err := os.ReadFile(requestPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	var req state.TrainingRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	st := &state.TrainingState{Request: req}
	cli := execgo.NewClient(req.ExecGoEndpoint)
	ctx := context.Background()

	graph.BuildPlan(st)
	if err := graph.ValidatePlan(st); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := graph.SubmitToExecgo(ctx, st, cli); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if err := graph.PollUntilDone(ctx, st, cli); err != nil {
		st.Diagnostics = append(st.Diagnostics, err.Error())
	}
	graph.AnalyzeFailure(st)
	graph.FinalizeReport(st)

	out, _ := json.MarshalIndent(st.FinalReport, "", "  ")
	fmt.Println(string(out))
}
