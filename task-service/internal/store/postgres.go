package store

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"taskflow/task-service/internal/task"
)

var ErrNotFound = errors.New("task not found")

type Postgres struct{ pool *pgxpool.Pool }

func Open(ctx context.Context, databaseURL string) (*Postgres, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 10
	cfg.MinConns = 1
	cfg.ConnConfig.ConnectTimeout = 3 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	s := &Postgres{pool: pool}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	// Milestone 1 bootstrap only. Replace with versioned migrations before schema evolution.
	_, err = pool.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS tasks;
 CREATE TABLE IF NOT EXISTS tasks.tasks (
 id uuid PRIMARY KEY,
 project_id uuid NOT NULL,
 title varchar(200) NOT NULL CHECK (length(trim(title)) > 0),
 status varchar(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
 );
 CREATE INDEX IF NOT EXISTS tasks_project_created_idx ON tasks.tasks (project_id, created_at DESC);`)
	if err != nil {
		pool.Close()
		return nil, err
	}
	return s, nil
}
func (s *Postgres) Close()                         { s.pool.Close() }
func (s *Postgres) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

const columns = "id::text, project_id::text, title, status, created_at, updated_at"

func scan(row pgx.Row) (task.Task, error) {
	var t task.Task
	err := row.Scan(&t.ID, &t.ProjectID, &t.Title, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return t, ErrNotFound
	}
	return t, err
}
func (s *Postgres) List(ctx context.Context, projectID string) ([]task.Task, error) {
	rows, err := s.pool.Query(ctx, "SELECT "+columns+" FROM tasks.tasks WHERE project_id=$1 ORDER BY created_at DESC, id LIMIT 500", projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]task.Task, 0)
	for rows.Next() {
		t, err := scan(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, t)
	}
	return items, rows.Err()
}
func (s *Postgres) Get(ctx context.Context, id string) (task.Task, error) {
	return scan(s.pool.QueryRow(ctx, "SELECT "+columns+" FROM tasks.tasks WHERE id=$1", id))
}
func (s *Postgres) Create(ctx context.Context, projectID, title string) (task.Task, error) {
	return scan(s.pool.QueryRow(ctx, "INSERT INTO tasks.tasks (id,project_id,title) VALUES ($1,$2,$3) RETURNING "+columns, uuid.NewString(), projectID, title))
}
func (s *Postgres) Update(ctx context.Context, id, status string) (task.Task, error) {
	return scan(s.pool.QueryRow(ctx, "UPDATE tasks.tasks SET status=$2,updated_at=now() WHERE id=$1 RETURNING "+columns, id, status))
}
