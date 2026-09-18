package task

import "time"

type Task struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	Title     string    `json:"title"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func ValidStatus(status string) bool {
	return status == "todo" || status == "in_progress" || status == "done"
}

type Event struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Type      string    `json:"type"`
	Message   string    `json:"message"`
	TaskID    string    `json:"taskId"`
	ProjectID string    `json:"projectId"`
	CreatedAt time.Time `json:"createdAt"`
}
