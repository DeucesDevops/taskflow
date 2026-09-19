package store

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"taskflow/task-service/internal/task"
	"time"
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
	if err = pool.Ping(ctx); err == nil {
		err = migrate(ctx, pool)
	}
	if err != nil {
		pool.Close()
		return nil, err
	}
	return &Postgres{pool: pool}, nil
}
func (s *Postgres) Close()                         { s.pool.Close() }
func (s *Postgres) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }

const columns = "id::text, project_id::text, title, description, status, assignee_id::text, assignee_name, created_at, updated_at"

func scan(row pgx.Row) (task.Task, error) {
	var t task.Task
	err := row.Scan(&t.ID, &t.ProjectID, &t.Title, &t.Description, &t.Status, &t.AssigneeID, &t.AssigneeName, &t.CreatedAt, &t.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return t, err
}
func (s *Postgres) List(ctx context.Context, projectID string, limit, offset int) ([]task.Task, error) {
	rows, err := s.pool.Query(ctx, "SELECT "+columns+" FROM tasks.tasks WHERE project_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3", projectID, limit, offset)
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
func eventRecipients(actor string, t task.Task) []string {
	ids := []string{actor}
	if t.AssigneeID != nil && *t.AssigneeID != actor {
		ids = append(ids, *t.AssigneeID)
	}
	return ids
}
func enqueue(ctx context.Context, tx pgx.Tx, actor, eventType, message string, t task.Task) error {
	for _, recipient := range eventRecipients(actor, t) {
		event := task.Event{ID: uuid.NewString(), UserID: recipient, Type: eventType, Message: message, TaskID: t.ID, ProjectID: t.ProjectID, CreatedAt: time.Now().UTC()}
		payload, err := json.Marshal(event)
		if err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO tasks.outbox (id,payload) VALUES ($1,$2)`, event.ID, payload); err != nil {
			return err
		}
	}
	return nil
}
func (s *Postgres) Create(ctx context.Context, input task.CreateInput, actor string) (task.Task, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return task.Task{}, err
	}
	defer tx.Rollback(context.Background())
	created, err := scan(tx.QueryRow(ctx, "INSERT INTO tasks.tasks (id,project_id,title,description,assignee_id,assignee_name) VALUES ($1,$2,$3,$4,$5,$6) RETURNING "+columns, uuid.NewString(), input.ProjectID, input.Title, input.Description, input.AssigneeID, input.AssigneeName))
	if err != nil {
		return created, err
	}
	if err = enqueue(ctx, tx, actor, "task.created", "Created task: "+created.Title, created); err != nil {
		return created, err
	}
	if created.AssigneeID != nil {
		if err = enqueue(ctx, tx, actor, "task.assigned", "Assigned task: "+created.Title, created); err != nil {
			return created, err
		}
	}
	return created, tx.Commit(ctx)
}
func (s *Postgres) Update(ctx context.Context, id string, patch task.Patch, actor string) (task.Task, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return task.Task{}, err
	}
	defer tx.Rollback(context.Background())
	existing, err := scan(tx.QueryRow(ctx, "SELECT "+columns+" FROM tasks.tasks WHERE id=$1 FOR UPDATE", id))
	if err != nil {
		return existing, err
	}
	changedAssignment := patch.AssigneeID.Set && !sameString(existing.AssigneeID, patch.AssigneeID.Value)
	if patch.Title.Set {
		existing.Title = *patch.Title.Value
	}
	if patch.Description.Set {
		existing.Description = *patch.Description.Value
	}
	if patch.Status.Set {
		existing.Status = *patch.Status.Value
	}
	if patch.AssigneeID.Set {
		existing.AssigneeID = patch.AssigneeID.Value
		existing.AssigneeName = patch.AssigneeName
	}
	updated, err := scan(tx.QueryRow(ctx, "UPDATE tasks.tasks SET title=$2,description=$3,status=$4,assignee_id=$5,assignee_name=$6,updated_at=now() WHERE id=$1 RETURNING "+columns, id, existing.Title, existing.Description, existing.Status, existing.AssigneeID, existing.AssigneeName))
	if err != nil {
		return updated, err
	}
	if err = enqueue(ctx, tx, actor, "task.updated", "Updated task: "+updated.Title, updated); err != nil {
		return updated, err
	}
	if changedAssignment {
		message := "Assigned task: " + updated.Title
		if updated.AssigneeID == nil {
			message = "Cleared assignment: " + updated.Title
		}
		if err = enqueue(ctx, tx, actor, "task.assigned", message, updated); err != nil {
			return updated, err
		}
	}
	return updated, tx.Commit(ctx)
}
func sameString(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
func (s *Postgres) Delete(ctx context.Context, id, actor string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	deleted, err := scan(tx.QueryRow(ctx, "DELETE FROM tasks.tasks WHERE id=$1 RETURNING "+columns, id))
	if err != nil {
		return err
	}
	if err = enqueue(ctx, tx, actor, "task.deleted", "Deleted task: "+deleted.Title, deleted); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

const commentColumns = "id::text, task_id::text, user_id::text, body, created_at"

func scanComment(row pgx.Row) (task.Comment, error) {
	var c task.Comment
	err := row.Scan(&c.ID, &c.TaskID, &c.UserID, &c.Body, &c.CreatedAt)
	return c, err
}
func (s *Postgres) ListComments(ctx context.Context, id string, limit, offset int) ([]task.Comment, error) {
	rows, err := s.pool.Query(ctx, "SELECT "+commentColumns+" FROM tasks.comments WHERE task_id=$1 ORDER BY created_at,id LIMIT $2 OFFSET $3", id, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]task.Comment, 0)
	for rows.Next() {
		c, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, c)
	}
	return items, rows.Err()
}
func (s *Postgres) CreateComment(ctx context.Context, id, body, actor string) (task.Comment, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return task.Comment{}, err
	}
	defer tx.Rollback(context.Background())
	existing, err := scan(tx.QueryRow(ctx, "SELECT "+columns+" FROM tasks.tasks WHERE id=$1 FOR UPDATE", id))
	if err != nil {
		return task.Comment{}, err
	}
	created, err := scanComment(tx.QueryRow(ctx, "INSERT INTO tasks.comments (id,task_id,user_id,body) VALUES ($1,$2,$3,$4) RETURNING "+commentColumns, uuid.NewString(), id, actor, body))
	if err != nil {
		return created, err
	}
	if _, err = tx.Exec(ctx, `UPDATE tasks.tasks SET updated_at=now() WHERE id=$1`, id); err != nil {
		return created, err
	}
	if err = enqueue(ctx, tx, actor, "task.commented", "Commented on task: "+existing.Title, existing); err != nil {
		return created, err
	}
	return created, tx.Commit(ctx)
}

// Claim atomically leases one due event; SKIP LOCKED allows safe concurrent workers.
func (s *Postgres) Claim(ctx context.Context) (*task.Delivery, error) {
	token := uuid.NewString()
	var payload []byte
	var delivery task.Delivery
	err := s.pool.QueryRow(ctx, `WITH candidate AS (SELECT id FROM tasks.outbox WHERE delivered_at IS NULL AND available_at<=now() AND (locked_until IS NULL OR locked_until<=now()) ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE tasks.outbox o SET locked_until=now()+interval '30 seconds',lease_token=$1,attempts=o.attempts+1 FROM candidate c WHERE o.id=c.id RETURNING o.payload,o.attempts`, token).Scan(&payload, &delivery.Attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(payload, &delivery.Event); err != nil {
		return nil, err
	}
	delivery.LeaseToken = token
	return &delivery, nil
}
func (s *Postgres) Delivered(ctx context.Context, d task.Delivery) error {
	_, err := s.pool.Exec(ctx, `UPDATE tasks.outbox SET delivered_at=now(),locked_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2 AND delivered_at IS NULL`, d.Event.ID, d.LeaseToken)
	return err
}
func (s *Postgres) Retry(ctx context.Context, d task.Delivery, delay time.Duration) error {
	_, err := s.pool.Exec(ctx, `UPDATE tasks.outbox SET available_at=now()+($3 * interval '1 second'),locked_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2 AND delivered_at IS NULL`, d.Event.ID, d.LeaseToken, delay.Seconds())
	return err
}
