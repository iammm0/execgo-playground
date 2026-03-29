package graph

import (
	"context"
	"fmt"
	"time"

	"execgo-playground/orchestrators/go/internal/execgo"
	"execgo-playground/orchestrators/go/internal/state"
)

func BuildPlan(st *state.TrainingState) {
	st.TaskGraph = map[string]any{
		"tasks": st.Request.Tasks,
	}
}

func ValidatePlan(st *state.TrainingState) error {
	if len(st.Request.Tasks) == 0 {
		return fmt.Errorf("tasks is empty")
	}
	return nil
}

func SubmitToExecgo(ctx context.Context, st *state.TrainingState, cli *execgo.Client) error {
	resp, err := cli.SubmitTasks(ctx, st.Request.Tasks)
	if err != nil {
		return err
	}
	st.Submission = resp
	return nil
}

func PollUntilDone(ctx context.Context, st *state.TrainingState, cli *execgo.Client) error {
	interval := st.Request.Poll.IntervalMS
	maxAttempts := st.Request.Poll.MaxAttempts
	if interval <= 0 {
		interval = 1000
	}
	if maxAttempts <= 0 {
		maxAttempts = 120
	}

	for i := 0; i < maxAttempts; i++ {
		all, err := cli.ListTasks(ctx)
		if err != nil {
			st.Diagnostics = append(st.Diagnostics, "list tasks failed: "+err.Error())
			time.Sleep(time.Duration(interval) * time.Millisecond)
			continue
		}

		st.TaskStates = collectTaskStates(st.Request.Tasks, all)
		if isTerminal(st.TaskStates) {
			return nil
		}
		time.Sleep(time.Duration(interval) * time.Millisecond)
	}
	return fmt.Errorf("poll timeout")
}

func AnalyzeFailure(st *state.TrainingState) {
	for i := range st.TaskStates {
		ts := &st.TaskStates[i]
		if ts.Status == "failed" && ts.FailureReason == "" {
			ts.FailureReason = "execgo_task_failed"
		}
		if ts.Status == "skipped" && ts.FailureReason == "" {
			ts.FailureReason = "blocked_by_dependency"
		}
	}
}

func FinalizeReport(st *state.TrainingState) {
	count := map[string]int{
		"pending": 0,
		"running": 0,
		"success": 0,
		"failed":  0,
		"skipped": 0,
	}
	for _, t := range st.TaskStates {
		if _, ok := count[t.Status]; ok {
			count[t.Status]++
		}
	}

	finalStatus := "success"
	if count["failed"] > 0 {
		finalStatus = "failed"
	} else if count["running"] > 0 || count["pending"] > 0 {
		finalStatus = "partial_failure"
	}

	st.FinalReport = map[string]any{
		"result_version": "v1",
		"request_id":     st.Request.RequestID,
		"summary": map[string]any{
			"final_status": finalStatus,
			"status_count": count,
		},
		"tasks":       st.TaskStates,
		"diagnostics": st.Diagnostics,
		"repro": map[string]any{
			"execgo_endpoint": st.Request.ExecGoEndpoint,
			"request_hash":    st.Request.RequestID,
		},
	}
}

func collectTaskStates(expect []state.TaskSpec, actual []map[string]any) []state.TaskStatus {
	actualByID := map[string]map[string]any{}
	for _, item := range actual {
		id, _ := item["id"].(string)
		if id != "" {
			actualByID[id] = item
		}
	}

	out := make([]state.TaskStatus, 0, len(expect))
	for _, e := range expect {
		a := actualByID[e.ID]
		s, _ := a["status"].(string)
		if s == "" {
			s = "pending"
		}
		out = append(out, state.TaskStatus{
			ID:            e.ID,
			Status:        s,
			FailureReason: toString(a["error"]),
			OutputPreview: toString(a["result"]),
		})
	}
	return out
}

func isTerminal(tasks []state.TaskStatus) bool {
	if len(tasks) == 0 {
		return false
	}
	for _, t := range tasks {
		if t.Status == "pending" || t.Status == "running" {
			return false
		}
	}
	return true
}

func toString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprintf("%v", v)
}
