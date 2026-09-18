package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
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
	List(context.Context, string) ([]task.Task, error)
	Get(context.Context, string) (task.Task, error)
	Create(context.Context, string, string) (task.Task, error)
	Update(context.Context, string, string) (task.Task, error)
}
type Dependencies interface {
	Authenticate(context.Context, string) (string, error)
	CheckProject(context.Context, string, string) error
	Ready(context.Context) error
	Notify(context.Context, task.Event) error
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
	mux.HandleFunc("PATCH /tasks/{id}", s.update)
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
	r.Body = http.MaxBytesReader(w, r.Body, 16384)
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
func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.authenticate(w, r); !ok {
		return
	}
	id := r.URL.Query().Get("projectId")
	if !validID(id) {
		respondError(w, 400, "A valid projectId is required")
		return
	}
	if err := s.dependencies.CheckProject(r.Context(), id, r.Header.Get("Authorization")); err != nil {
		s.fail(w, err)
		return
	}
	items, err := s.store.List(r.Context(), id)
	if err != nil {
		s.fail(w, err)
		return
	}
	respond(w, 200, map[string]any{"items": items})
}
func (s *Server) create(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.authenticate(w, r)
	if !ok {
		return
	}
	var body struct {
		ProjectID string `json:"projectId"`
		Title     string `json:"title"`
	}
	if !decode(w, r, &body) {
		return
	}
	body.Title = strings.TrimSpace(body.Title)
	if !validID(body.ProjectID) || body.Title == "" || utf8.RuneCountInString(body.Title) > 200 {
		respondError(w, 400, "A valid projectId and a title of 1–200 characters are required")
		return
	}
	if err := s.dependencies.CheckProject(r.Context(), body.ProjectID, r.Header.Get("Authorization")); err != nil {
		s.fail(w, err)
		return
	}
	created, err := s.store.Create(r.Context(), body.ProjectID, body.Title)
	if err != nil {
		s.fail(w, err)
		return
	}
	s.notify(r.Context(), userID, "task.created", "Created task: "+created.Title, created)
	respond(w, 201, created)
}
func (s *Server) update(w http.ResponseWriter, r *http.Request) {
	userID, ok := s.authenticate(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if !validID(id) {
		respondError(w, 400, "A valid task ID is required")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if !decode(w, r, &body) {
		return
	}
	if !task.ValidStatus(body.Status) {
		respondError(w, 400, "Status must be todo, in_progress, or done")
		return
	}
	existing, err := s.store.Get(r.Context(), id)
	if err != nil {
		s.fail(w, err)
		return
	}
	if err := s.dependencies.CheckProject(r.Context(), existing.ProjectID, r.Header.Get("Authorization")); err != nil {
		s.fail(w, err)
		return
	}
	updated, err := s.store.Update(r.Context(), id, body.Status)
	if err != nil {
		s.fail(w, err)
		return
	}
	s.notify(r.Context(), userID, "task.updated", "Moved task to "+updated.Status+": "+updated.Title, updated)
	respond(w, 200, updated)
}
func (s *Server) notify(ctx context.Context, userID, eventType, message string, t task.Task) {
	// A failed delivery must never roll back the committed task. An outbox belongs in a later milestone.
	event := task.Event{ID: uuid.NewString(), UserID: userID, Type: eventType, Message: message, TaskID: t.ID, ProjectID: t.ProjectID, CreatedAt: time.Now().UTC()}
	if err := s.dependencies.Notify(ctx, event); err != nil {
		s.logger.Warn("notification delivery failed; task is committed", "eventId", event.ID, "taskId", t.ID, "error", err.Error())
	}
}
