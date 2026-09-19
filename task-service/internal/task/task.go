package task

import (
	"encoding/json"
	"fmt"
	"time"
)

type Task struct {
	ID           string    `json:"id"`
	ProjectID    string    `json:"projectId"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	Status       string    `json:"status"`
	AssigneeID   *string   `json:"assigneeId"`
	AssigneeName *string   `json:"assigneeName"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

func ValidStatus(status string) bool {
	return status == "todo" || status == "in_progress" || status == "done"
}

type CreateInput struct {
	ProjectID    string  `json:"projectId"`
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	AssigneeID   *string `json:"assigneeId"`
	AssigneeName *string `json:"-"`
}

// OptionalString distinguishes an omitted property from explicit null, which clears assignment.
type OptionalString struct {
	Set   bool
	Value *string
}

func (s *OptionalString) UnmarshalJSON(data []byte) error {
	s.Set = true
	if string(data) == "null" {
		s.Value = nil
		return nil
	}
	var value string
	if err := json.Unmarshal(data, &value); err != nil {
		return fmt.Errorf("expected string or null")
	}
	s.Value = &value
	return nil
}

type Patch struct {
	Title        OptionalString `json:"title"`
	Description  OptionalString `json:"description"`
	Status       OptionalString `json:"status"`
	AssigneeID   OptionalString `json:"assigneeId"`
	AssigneeName *string        `json:"-"`
}
type Comment struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"taskId"`
	UserID    string    `json:"userId"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
}
type Member struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
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
type Delivery struct {
	Event      Event
	LeaseToken string
	Attempts   int
}
