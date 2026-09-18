package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"taskflow/task-service/internal/task"
	"taskflow/task-service/internal/upstream"
)

const projectID = "22222222-2222-4222-8222-222222222222"
const taskID = "33333333-3333-4333-8333-333333333333"
const userID = "11111111-1111-4111-8111-111111111111"

type fakeStore struct{ mutations, reads int }

func (s *fakeStore) Ping(context.Context) error { return nil }
func (s *fakeStore) List(context.Context, string) ([]task.Task, error) {
	s.reads++
	return []task.Task{}, nil
}
func (s *fakeStore) Get(context.Context, string) (task.Task, error) {
	s.reads++
	return task.Task{ID: taskID, ProjectID: projectID, Title: "Ship release", Status: "todo"}, nil
}
func (s *fakeStore) Create(_ context.Context, id, title string) (task.Task, error) {
	s.mutations++
	return task.Task{ID: taskID, ProjectID: id, Title: title, Status: "todo", CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
}
func (s *fakeStore) Update(_ context.Context, id, status string) (task.Task, error) {
	s.mutations++
	return task.Task{ID: id, ProjectID: projectID, Title: "Ship release", Status: status}, nil
}

type fakeDependencies struct {
	authError, projectError, notifyError error
	projectChecks, notifications         int
}

func (d *fakeDependencies) Authenticate(context.Context, string) (string, error) {
	return userID, d.authError
}
func (d *fakeDependencies) CheckProject(context.Context, string, string) error {
	d.projectChecks++
	return d.projectError
}
func (d *fakeDependencies) Ready(context.Context) error { return nil }
func (d *fakeDependencies) Notify(context.Context, task.Event) error {
	d.notifications++
	return d.notifyError
}
func handler(s *fakeStore, d *fakeDependencies) http.Handler {
	return New(s, d, slog.New(slog.NewTextHandler(io.Discard, nil)))
}
func request(h http.Handler, method, path, body, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}
func TestTasksRequireAuthentication(t *testing.T) {
	s, d := &fakeStore{}, &fakeDependencies{}
	rr := request(handler(s, d), http.MethodGet, "/tasks?projectId="+projectID, "", "")
	if rr.Code != 401 || s.reads != 0 || d.projectChecks != 0 {
		t.Fatalf("unauthorized request touched dependencies: status=%d, store=%+v, upstream=%+v", rr.Code, s, d)
	}
}
func TestForeignProjectCannotBeReadOrMutated(t *testing.T) {
	cases := []struct{ method, path, body string }{
		{"GET", "/tasks?projectId=" + projectID, ""},
		{"POST", "/tasks", `{"projectId":"` + projectID + `","title":"Try another project"}`},
		{"PATCH", "/tasks/" + taskID, `{"status":"done"}`},
	}
	for _, tc := range cases {
		t.Run(tc.method, func(t *testing.T) {
			s, d := &fakeStore{}, &fakeDependencies{projectError: &upstream.Error{Status: 404, Message: "Project not found"}}
			rr := request(handler(s, d), tc.method, tc.path, tc.body, "Bearer test")
			if rr.Code != 404 || s.mutations != 0 || d.notifications != 0 {
				t.Fatalf("foreign project access status=%d, store=%+v, upstream=%+v", rr.Code, s, d)
			}
			if tc.method == "GET" && s.reads != 0 {
				t.Fatal("listed foreign project tasks")
			}
		})
	}
}
func TestInvalidStatusDoesNotReadOrMutate(t *testing.T) {
	s, d := &fakeStore{}, &fakeDependencies{}
	rr := request(handler(s, d), "PATCH", "/tasks/"+taskID, `{"status":"archived"}`, "Bearer test")
	if rr.Code != 400 || s.mutations != 0 || s.reads != 0 {
		t.Fatalf("invalid status reached database: %d", rr.Code)
	}
}
func TestCommittedTaskSurvivesNotificationFailure(t *testing.T) {
	s, d := &fakeStore{}, &fakeDependencies{notifyError: errors.New("connection refused")}
	rr := request(handler(s, d), "POST", "/tasks", `{"projectId":"`+projectID+`","title":"  Ship release  "}`, "Bearer test")
	if rr.Code != 201 || s.mutations != 1 || d.projectChecks != 1 || d.notifications != 1 {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body)
	}
	var result task.Task
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Title != "Ship release" || result.Status != "todo" {
		t.Fatalf("unexpected task: %+v", result)
	}
}
func TestRejectsExtraFieldsAndTrailingJSON(t *testing.T) {
	for _, body := range []string{`{"projectId":"` + projectID + `","title":"Test","ownerId":"someone"}`, `{"projectId":"` + projectID + `","title":"Test"} {}`} {
		s, d := &fakeStore{}, &fakeDependencies{}
		rr := request(handler(s, d), "POST", "/tasks", body, "Bearer test")
		if rr.Code != 400 || s.mutations != 0 {
			t.Fatalf("accepted invalid body: %d", rr.Code)
		}
	}
}
