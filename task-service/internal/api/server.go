package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"taskflow/task-service/internal/store"
	"taskflow/task-service/internal/task"
	"taskflow/task-service/internal/upstream"
)

type Store interface {
	Ping(context.Context) error
	List(context.Context, string, int, int) ([]task.Task, error)
	Get(context.Context, string) (task.Task, error)
	Create(context.Context, task.CreateInput, string) (task.Task, error)
	Update(context.Context, string, task.Patch, string) (task.Task, error)
	Delete(context.Context, string, string) error
	ListComments(context.Context, string, int, int) ([]task.Comment, error)
	CreateComment(context.Context, string, string, string) (task.Comment, error)
}
type Dependencies interface {
	Authenticate(context.Context, string) (string, error)
	CheckProject(context.Context, string, string) error
	GetMember(context.Context, string, string, string) (task.Member, error)
	Ready(context.Context) error
}
type Server struct {
	store        Store
	dependencies Dependencies
	logger       *slog.Logger
}

func New(store Store, dependencies Dependencies, logger *slog.Logger) http.Handler {
	s := &Server{store: store, dependencies: dependencies, logger: logger}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		respond(w, 200, map[string]string{"status": "ok", "service": "task-service"})
	})
	mux.HandleFunc("GET /ready", s.ready)
	mux.HandleFunc("GET /tasks", s.list)
	mux.HandleFunc("POST /tasks", s.create)
	mux.HandleFunc("GET /tasks/{id}", s.get)
	mux.HandleFunc("PATCH /tasks/{id}", s.update)
	mux.HandleFunc("DELETE /tasks/{id}", s.delete)
	mux.HandleFunc("GET /tasks/{id}/comments", s.listComments)
	mux.HandleFunc("POST /tasks/{id}/comments", s.createComment)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { respondError(w, 404, "Route not found") })
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()
		defer func() {
			if recovered := recover(); recovered != nil {
				logger.Error("request panic")
				respondError(w, 500, "Unexpected server error")
			}
		}()
		mux.ServeHTTP(w, r.WithContext(ctx))
	})
}
func respond(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
func respondError(w http.ResponseWriter, status int, message string) {
	respond(w, status, map[string]string{"error": message})
}
func (s *Server) fail(w http.ResponseWriter, err error) {
	var upstreamError *upstream.Error
	if errors.As(err, &upstreamError) {
		respondError(w, upstreamError.Status, upstreamError.Message)
		return
	}
	if errors.Is(err, store.ErrNotFound) {
		respondError(w, 404, "Task not found")
		return
	}
	s.logger.Error("task operation failed", "error", err.Error())
	respondError(w, 503, "Task service temporarily unavailable")
}
func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	if err := s.store.Ping(r.Context()); err != nil {
		respondError(w, 503, "Database unavailable")
		return
	}
	if err := s.dependencies.Ready(r.Context()); err != nil {
		respondError(w, 503, "Required service unavailable")
		return
	}
	respond(w, 200, map[string]string{"status": "ready", "service": "task-service"})
}
func (s *Server) authenticate(w http.ResponseWriter, r *http.Request) (string, bool) {
	token := r.Header.Get("Authorization")
	if !strings.HasPrefix(token, "Bearer ") || len(strings.TrimSpace(strings.TrimPrefix(token, "Bearer "))) == 0 {
		respondError(w, 401, "Please sign in")
		return "", false
	}
	userID, err := s.dependencies.Authenticate(r.Context(), token)
	if err != nil {
		s.fail(w, err)
		return "", false
	}
	return userID, true
}
func validID(id string) bool { _, err := uuid.Parse(id); return len(id) == 36 && err == nil }
func decode(w http.ResponseWriter, r *http.Request, dest any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 65536)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dest); err != nil {
		respondError(w, 400, "Invalid JSON request")
		return false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		respondError(w, 400, "Invalid JSON request")
		return false
	}
	return true
}
func pagination(w http.ResponseWriter, r *http.Request) (int, int, bool) {
	limit, offset := 50, 0
	for name, dest := range map[string]*int{"limit": &limit, "offset": &offset} {
		values, exists := r.URL.Query()[name]
		if !exists {
			continue
		}
		if len(values) != 1 {
			respondError(w, 400, "Invalid pagination")
			return 0, 0, false
		}
		value, err := strconv.Atoi(values[0])
		if err != nil || value < 0 || value > 2147483647 || (name == "limit" && (value < 1 || value > 100)) {
			respondError(w, 400, "limit must be 1–100 and offset must be nonnegative")
			return 0, 0, false
		}
		*dest = value
	}
	return limit, offset, true
}
func page[T any](w http.ResponseWriter, items []T, limit, offset int) {
	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}
	respond(w, 200, map[string]any{"items": items, "limit": limit, "offset": offset, "hasMore": hasMore})
}
func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.authenticate(w, r); !ok {
		return
	}
	id := r.URL.Query().Get("projectId")
	if !validID(id) {
		respondError(w, 400, "A valid projectId is required")
		return
	}
	limit, offset, ok := pagination(w, r)
	if !ok {
		return
	}
	if err := s.dependencies.CheckProject(r.Context(), id, r.Header.Get("Authorization")); err != nil {
		s.fail(w, err)
		return
	}
	items, err := s.store.List(r.Context(), id, limit+1, offset)
	if err != nil {
		s.fail(w, err)
		return
	}
	page(w, items, limit, offset)
}
func (s *Server) authorizedTask(w http.ResponseWriter, r *http.Request) (task.Task, bool) {
	id := r.PathValue("id")
	if !validID(id) {
		respondError(w, 400, "A valid task ID is required")
		return task.Task{}, false
	}
	t, err := s.store.Get(r.Context(), id)
	if err != nil {
		s.fail(w, err)
		return t, false
	}
	if err = s.dependencies.CheckProject(r.Context(), t.ProjectID, r.Header.Get("Authorization")); err != nil {
		s.fail(w, err)
		return t, false
	}
	return t, true
}
func (s *Server) get(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.authenticate(w, r); !ok {
		return
	}
	t, ok := s.authorizedTask(w, r)
	if ok {
		respond(w, 200, t)
	}
}
func (s *Server) assignee(w http.ResponseWriter, r *http.Request, projectID string, id *string) (*string, bool) {
	if id == nil {
		return nil, true
	}
	if !validID(*id) {
		respondError(w, 400, "assigneeId must be a valid member ID or null")
		return nil, false
	}
	member, err := s.dependencies.GetMember(r.Context(), projectID, *id, r.Header.Get("Authorization"))
	if err != nil {
		s.fail(w, err)
		return nil, false
	}
	return &member.Name, true
}
func (s *Server) create(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.authenticate(w, r)
	if !ok {
		return
	}
	var input task.CreateInput
	if !decode(w, r, &input) {
		return
	}
	input.Title = strings.TrimSpace(input.Title)
	if !validID(input.ProjectID) || input.Title == "" || utf8.RuneCountInString(input.Title) > 200 {
		respondError(w, 400, "A valid projectId and a title of 1–200 characters are required")
		return
	}
	if utf8.RuneCountInString(input.Description) > 10000 {
		respondError(w, 400, "Description must be at most 10000 characters")
		return
	}
	if err := s.dependencies.CheckProject(r.Context(), input.ProjectID, r.Header.Get("Authorization")); err != nil {
		s.fail(w, err)
		return
	}
	input.AssigneeName, ok = s.assignee(w, r, input.ProjectID, input.AssigneeID)
	if !ok {
		return
	}
	created, err := s.store.Create(r.Context(), input, actor)
	if err != nil {
		s.fail(w, err)
		return
	}
	respond(w, 201, created)
}
func validPatch(w http.ResponseWriter, p *task.Patch) bool {
	if !p.Title.Set && !p.Description.Set && !p.Status.Set && !p.AssigneeID.Set {
		respondError(w, 400, "At least one task field is required")
		return false
	}
	if p.Title.Set {
		if p.Title.Value == nil {
			respondError(w, 400, "Title cannot be null")
			return false
		}
		*p.Title.Value = strings.TrimSpace(*p.Title.Value)
		if *p.Title.Value == "" || utf8.RuneCountInString(*p.Title.Value) > 200 {
			respondError(w, 400, "Title must be 1–200 characters")
			return false
		}
	}
	if p.Description.Set && (p.Description.Value == nil || utf8.RuneCountInString(*p.Description.Value) > 10000) {
		respondError(w, 400, "Description must be a string of at most 10000 characters")
		return false
	}
	if p.Status.Set && (p.Status.Value == nil || !task.ValidStatus(*p.Status.Value)) {
		respondError(w, 400, "Status must be todo, in_progress, or done")
		return false
	}
	if p.AssigneeID.Set && p.AssigneeID.Value != nil && !validID(*p.AssigneeID.Value) {
		respondError(w, 400, "assigneeId must be a valid member ID or null")
		return false
	}
	return true
}
func (s *Server) update(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.authenticate(w, r)
	if !ok {
		return
	}
	var patch task.Patch
	if !decode(w, r, &patch) || !validPatch(w, &patch) {
		return
	}
	existing, ok := s.authorizedTask(w, r)
	if !ok {
		return
	}
	if patch.AssigneeID.Set {
		patch.AssigneeName, ok = s.assignee(w, r, existing.ProjectID, patch.AssigneeID.Value)
		if !ok {
			return
		}
	}
	updated, err := s.store.Update(r.Context(), existing.ID, patch, actor)
	if err != nil {
		s.fail(w, err)
		return
	}
	respond(w, 200, updated)
}
func (s *Server) delete(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.authenticate(w, r)
	if !ok {
		return
	}
	existing, ok := s.authorizedTask(w, r)
	if !ok {
		return
	}
	if err := s.store.Delete(r.Context(), existing.ID, actor); err != nil {
		s.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
func (s *Server) listComments(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.authenticate(w, r); !ok {
		return
	}
	limit, offset, ok := pagination(w, r)
	if !ok {
		return
	}
	existing, ok := s.authorizedTask(w, r)
	if !ok {
		return
	}
	items, err := s.store.ListComments(r.Context(), existing.ID, limit+1, offset)
	if err != nil {
		s.fail(w, err)
		return
	}
	page(w, items, limit, offset)
}
func (s *Server) createComment(w http.ResponseWriter, r *http.Request) {
	actor, ok := s.authenticate(w, r)
	if !ok {
		return
	}
	var body struct {
		Body string `json:"body"`
	}
	if !decode(w, r, &body) {
		return
	}
	body.Body = strings.TrimSpace(body.Body)
	if body.Body == "" || utf8.RuneCountInString(body.Body) > 5000 {
		respondError(w, 400, "Comment must be 1–5000 characters")
		return
	}
	existing, ok := s.authorizedTask(w, r)
	if !ok {
		return
	}
	created, err := s.store.CreateComment(r.Context(), existing.ID, body.Body, actor)
	if err != nil {
		s.fail(w, err)
		return
	}
	respond(w, 201, created)
}
