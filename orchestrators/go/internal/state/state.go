package state

type TrainingRequest struct {
	RequestID     string         `json:"request_id"`
	ExecGoEndpoint string        `json:"execgo_endpoint"`
	Poll          PollPolicy     `json:"poll"`
	Tasks         []TaskSpec     `json:"tasks"`
}

type PollPolicy struct {
	IntervalMS int `json:"interval_ms"`
	MaxAttempts int `json:"max_attempts"`
}

type TaskSpec struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	ToolName string                 `json:"tool_name,omitempty"`
	Params   map[string]any         `json:"params"`
	DependsOn []string              `json:"depends_on,omitempty"`
	Retry    int                    `json:"retry,omitempty"`
	Timeout  int                    `json:"timeout,omitempty"`
}

type TaskStatus struct {
	ID            string `json:"id"`
	Status        string `json:"status"`
	FailureReason string `json:"failure_reason,omitempty"`
	OutputPreview string `json:"output_preview,omitempty"`
}

type TrainingState struct {
	Request     TrainingRequest   `json:"request"`
	TaskGraph   map[string]any    `json:"taskGraph"`
	Submission  map[string]any    `json:"submission"`
	TaskStates  []TaskStatus      `json:"taskStates"`
	Diagnostics []string          `json:"diagnostics"`
	FinalReport map[string]any    `json:"finalReport"`
}
