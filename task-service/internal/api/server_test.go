package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"taskflow/task-service/internal/task"
	"taskflow/task-service/internal/upstream"
	"testing"
	"time"
)

const projectID = "22222222-2222-4222-8222-222222222222"
const taskID = "33333333-3333-4333-8333-333333333333"
const userID = "11111111-1111-4111-8111-111111111111"
const assigneeID = "44444444-4444-4444-8444-444444444444"

type fakeStore struct {
	mutations, reads, commentReads, limit, offset int
	input                                         task.CreateInput
	patch                                         task.Patch
	actor                                         string
	items                                         []task.Task
	comments                                      []task.Comment
}

func (s *fakeStore) Ping(context.Context) error { return nil }
func (s *fakeStore) List(_ context.Context, _ string, limit, offset int) ([]task.Task, error) {
	s.reads++
	s.limit = limit
	s.offset = offset
	if s.items == nil {
		return []task.Task{}, nil
	}
	return s.items, nil
}
func (s *fakeStore) Get(context.Context, string) (task.Task, error) {
	s.reads++
	return task.Task{ID: taskID, ProjectID: projectID, Title: "Ship release", Status: "todo"}, nil
}
func (s *fakeStore) Create(_ context.Context, input task.CreateInput, actor string) (task.Task, error) {
	s.mutations++
	s.input = input
	s.actor = actor
	return task.Task{ID: taskID, ProjectID: input.ProjectID, Title: input.Title, Description: input.Description, AssigneeID: input.AssigneeID, AssigneeName: input.AssigneeName, Status: "todo", CreatedAt: time.Now(), UpdatedAt: time.Now()}, nil
}
func (s *fakeStore) Update(_ context.Context, id string, patch task.Patch, actor string) (task.Task, error) {
	s.mutations++
	s.patch = patch
	s.actor = actor
	return task.Task{ID: id, ProjectID: projectID, Title: "Ship release", Status: "todo"}, nil
}
func (s *fakeStore) Delete(_ context.Context, id, actor string) error {
	s.mutations++
	s.actor = actor
	return nil
}
func (s *fakeStore) ListComments(_ context.Context, _ string, limit, offset int) ([]task.Comment, error) {
	s.commentReads++
	s.limit = limit
	s.offset = offset
	if s.comments == nil {
		return []task.Comment{}, nil
	}
	return s.comments, nil
}
func (s *fakeStore) CreateComment(_ context.Context, id, body, actor string) (task.Comment, error) {
	s.mutations++
	s.actor = actor
	return task.Comment{ID: taskID, TaskID: id, UserID: actor, Body: body, CreatedAt: time.Now()}, nil
}

type fakeDependencies struct {
	authError, projectError, memberError error
	projectChecks, memberChecks          int
}

func (d *fakeDependencies) Authenticate(context.Context, string) (string, error) {
	return userID, d.authError
}
func (d *fakeDependencies) CheckProject(context.Context, string, string) error {
	d.projectChecks++
	return d.projectError
}
func (d *fakeDependencies) GetMember(_ context.Context, _ string, id, token string) (task.Member, error) {
	d.memberChecks++
	return task.Member{UserID: id, Name: "Colleague"}, d.memberError
}
func (d *fakeDependencies) Ready(context.Context) error { return nil }
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

var routes = []struct{ method, path, body string }{
	{"GET", "/tasks?projectId=" + projectID, ""},
	{"GET", "/tasks/" + taskID, ""},
	{"POST", "/tasks", `{"projectId":"` + projectID + `","title":"Ship release"}`},
	{"PATCH", "/tasks/" + taskID, `{"status":"done"}`},
	{"DELETE", "/tasks/" + taskID, ""},
	{"GET", "/tasks/" + taskID + "/comments", ""},
	{"POST", "/tasks/" + taskID + "/comments", `{"body":"Hello"}`},
}

func TestEveryTaskRouteRequiresAuthentication(t *testing.T) {
	for _, tc := range routes {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			s, d := &fakeStore{}, &fakeDependencies{}
			rr := request(handler(s, d), tc.method, tc.path, tc.body, "")
			if rr.Code != 401 || s.reads != 0 || s.mutations != 0 || d.projectChecks != 0 {
				t.Fatalf("unauthorized status=%d store=%+v", rr.Code, s)
			}
		})
	}
}
func TestEveryTaskRouteRejectsForeignProject(t *testing.T) {
	for _, tc := range routes {
		t.Run(tc.method+tc.path, func(t *testing.T) {
			s, d := &fakeStore{}, &fakeDependencies{projectError: &upstream.Error{Status: 404, Message: "Project not found"}}
			rr := request(handler(s, d), tc.method, tc.path, tc.body, "Bearer test")
			if rr.Code != 404 || s.mutations != 0 || s.commentReads != 0 || d.projectChecks != 1 {
				t.Fatalf("foreign project status=%d store=%+v", rr.Code, s)
			}
			if strings.HasPrefix(tc.path, "/tasks?") && s.reads != 0 {
				t.Fatal("listed foreign tasks")
			}
			if strings.Contains(rr.Body.String(), "Ship release") {
				t.Fatal("leaked task details")
			}
		})
	}
}
func TestPatchValidation(t *testing.T) {
	for _, body := range []string{`{}`, `null`, `{"status":"archived"}`, `{"title":null}`, `{"title":"   "}`, `{"description":null}`, `{"assigneeId":"invalid"}`, `{"ownerId":"x"}`, `{"status":"done"} {}`, `{"description":"` + strings.Repeat("a", 10001) + `"}`} {
		s, d := &fakeStore{}, &fakeDependencies{}
		rr := request(handler(s, d), "PATCH", "/tasks/"+taskID, body, "Bearer test")
		if rr.Code != 400 || s.mutations != 0 || s.reads != 0 {
			t.Fatalf("accepted invalid patch %.80s: status=%d", body, rr.Code)
		}
	}
}
func TestAssignmentOmittedAndNullRemainDistinct(t *testing.T) {
	for _, tc := range []struct {
		body string
		set  bool
	}{{`{"title":"New"}`, false}, {`{"assigneeId":null}`, true}} {
		s, d := &fakeStore{}, &fakeDependencies{}
		rr := request(handler(s, d), "PATCH", "/tasks/"+taskID, tc.body, "Bearer test")
		if rr.Code != 200 || s.patch.AssigneeID.Set != tc.set || s.patch.AssigneeID.Value != nil || d.memberChecks != 0 {
			t.Fatalf("wrong nullable assignment: status=%d patch=%+v", rr.Code, s.patch)
		}
	}
}
func TestAssignmentRequiresMembershipAndStoresSnapshot(t *testing.T) {
	for _, method := range []string{"POST", "PATCH"} {
		for _, allowed := range []bool{true, false} {
			s, d := &fakeStore{}, &fakeDependencies{}
			if !allowed {
				d.memberError = &upstream.Error{Status: 400, Message: "Assignee must be a project member"}
			}
			path, body := "/tasks", `{"projectId":"`+projectID+`","title":"  Ship release  ","description":"Plan","assigneeId":"`+assigneeID+`"}`
			if method == "PATCH" {
				path = "/tasks/" + taskID
				body = `{"assigneeId":"` + assigneeID + `"}`
			}
			rr := request(handler(s, d), method, path, body, "Bearer test")
			if !allowed {
				if rr.Code != 400 || s.mutations != 0 {
					t.Fatalf("accepted nonmember: %d", rr.Code)
				}
				continue
			}
			if s.mutations != 1 || d.memberChecks != 1 || s.actor != userID {
				t.Fatalf("missing membership or actor: status=%d", rr.Code)
			}
			name := s.input.AssigneeName
			if method == "PATCH" {
				name = s.patch.AssigneeName
			}
			if name == nil || *name != "Colleague" {
				t.Fatal("missing assignment snapshot")
			}
		}
	}
}
func TestPagination(t *testing.T) {
	for _, path := range []string{"/tasks?projectId=" + projectID, "/tasks/" + taskID + "/comments"} {
		s, d := &fakeStore{items: make([]task.Task, 3), comments: make([]task.Comment, 3)}, &fakeDependencies{}
		sep := "?"
		if strings.Contains(path, "?") {
			sep = "&"
		}
		rr := request(handler(s, d), "GET", path+sep+"limit=2&offset=3", "", "Bearer test")
		var body struct {
			Items   []json.RawMessage `json:"items"`
			Limit   int               `json:"limit"`
			Offset  int               `json:"offset"`
			HasMore bool              `json:"hasMore"`
		}
		if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if rr.Code != 200 || len(body.Items) != 2 || !body.HasMore || body.Limit != 2 || body.Offset != 3 || s.limit != 3 || s.offset != 3 {
			t.Fatalf("bad page: %s", rr.Body)
		}
	}
}
func TestPaginationDefaultsAndInvalidInput(t *testing.T) {
	s, d := &fakeStore{}, &fakeDependencies{}
	rr := request(handler(s, d), "GET", "/tasks?projectId="+projectID, "", "Bearer test")
	if rr.Code != 200 || s.limit != 51 || s.offset != 0 {
		t.Fatalf("incorrect defaults: %d", rr.Code)
	}
	for _, query := range []string{"limit=0", "limit=101", "offset=-1", "offset=no", "limit=1&limit=2", "offset=999999999999999999"} {
		s, d := &fakeStore{}, &fakeDependencies{}
		rr := request(handler(s, d), "GET", "/tasks?projectId="+projectID+"&"+query, "", "Bearer test")
		if rr.Code != 400 || s.reads != 0 {
			t.Fatalf("accepted %s", query)
		}
	}
}
func TestCommentValidationAndAuthor(t *testing.T) {
	for _, body := range []string{`{"body":" "}`, `{"body":null}`, `{"body":"` + strings.Repeat("a", 5001) + `"}`, `{"body":"Hi","userId":"` + assigneeID + `"}`} {
		s, d := &fakeStore{}, &fakeDependencies{}
		rr := request(handler(s, d), "POST", "/tasks/"+taskID+"/comments", body, "Bearer test")
		if rr.Code != 400 || s.mutations != 0 {
			t.Fatalf("invalid comment accepted %d", rr.Code)
		}
	}
	s, d := &fakeStore{}, &fakeDependencies{}
	rr := request(handler(s, d), "POST", "/tasks/"+taskID+"/comments", `{"body":" Hello "}`, "Bearer test")
	var comment task.Comment
	json.Unmarshal(rr.Body.Bytes(), &comment)
	if rr.Code != 201 || comment.UserID != userID || comment.Body != "Hello" {
		t.Fatalf("wrong comment: %s", rr.Body)
	}
}
func TestExpiredSessionDoesNotReadTasks(t *testing.T) {
	s, d := &fakeStore{}, &fakeDependencies{authError: &upstream.Error{Status: 401, Message: "Please sign in"}}
	rr := request(handler(s, d), "GET", "/tasks/"+taskID, "", "Bearer expired")
	if rr.Code != 401 || s.reads != 0 {
		t.Fatal("expired session reached store")
	}
}
