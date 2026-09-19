package store

import (
	"context"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"sync"
	"taskflow/task-service/internal/task"
	"testing"
	"time"
)

// This opt-in test requires an EMPTY DISPOSABLE database: it resets the tasks schema.
func TestPostgresMigrationTransactionsAndLeases(t *testing.T) {
	url := os.Getenv("TASK_SERVICE_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TASK_SERVICE_TEST_DATABASE_URL to a disposable PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	mustExec := func(sql string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	// Recreate the exact Milestone 1 baseline, retaining one existing task.
	mustExec(`DROP SCHEMA IF EXISTS tasks CASCADE; CREATE SCHEMA tasks`)
	baseline, err := migrations.ReadFile("migrations/001_initial.sql")
	if err != nil {
		t.Fatal(err)
	}
	mustExec(string(baseline))
	project, actor, assignee, legacyID := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	mustExec(`INSERT INTO tasks.tasks (id,project_id,title,status) VALUES ($1,$2,'Legacy task','in_progress')`, legacyID, project)
	s, err := Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	legacy, err := s.Get(ctx, legacyID)
	if err != nil || legacy.Title != "Legacy task" || legacy.Status != "in_progress" || legacy.Description != "" || legacy.AssigneeID != nil {
		t.Fatalf("legacy task not preserved: %+v %v", legacy, err)
	}
	if err = migrate(ctx, pool); err != nil {
		t.Fatalf("migration not idempotent: %v", err)
	}
	var versionCount int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM tasks.schema_migrations`).Scan(&versionCount); err != nil || versionCount != 2 {
		t.Fatalf("migration ledger: %d %v", versionCount, err)
	}
	name := "Colleague"
	created, err := s.Create(ctx, task.CreateInput{ProjectID: project, Title: "Assigned task", Description: "Details", AssigneeID: &assignee, AssigneeName: &name}, actor)
	if err != nil {
		t.Fatal(err)
	}
	if created.AssigneeID == nil || *created.AssigneeID != assignee || created.AssigneeName == nil || *created.AssigneeName != name {
		t.Fatal("assignment not persisted")
	}
	var count int
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM tasks.outbox WHERE payload->>'taskId'=$1`, created.ID).Scan(&count); err != nil || count != 4 {
		t.Fatalf("expected actor and assignee create/assignment events: %d %v", count, err)
	}
	comment, err := s.CreateComment(ctx, created.ID, "First comment", actor)
	if err != nil || comment.UserID != actor {
		t.Fatalf("comment failed: %+v %v", comment, err)
	}
	comments, err := s.ListComments(ctx, created.ID, 2, 0)
	if err != nil || len(comments) != 1 || comments[0].Body != "First comment" {
		t.Fatal("comment read failed")
	}
	updated, err := s.Update(ctx, created.ID, task.Patch{AssigneeID: task.OptionalString{Set: true}}, actor)
	if err != nil || updated.AssigneeID != nil || updated.AssigneeName != nil || updated.Description != "Details" {
		t.Fatalf("assignment clear lost fields: %+v %v", updated, err)
	}
	// Force event persistence to fail and verify every write rolls back with it.
	mustExec(`CREATE FUNCTION tasks.reject_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected outbox failure'; END $$; CREATE TRIGGER reject_event BEFORE INSERT ON tasks.outbox FOR EACH ROW EXECUTE FUNCTION tasks.reject_event()`)
	if _, err = s.Create(ctx, task.CreateInput{ProjectID: project, Title: "Must rollback"}, actor); err == nil {
		t.Fatal("create succeeded despite outbox failure")
	}
	title := "Must rollback"
	if _, err = s.Update(ctx, created.ID, task.Patch{Title: task.OptionalString{Set: true, Value: &title}}, actor); err == nil {
		t.Fatal("update succeeded despite outbox failure")
	}
	if _, err = s.CreateComment(ctx, created.ID, "Must rollback", actor); err == nil {
		t.Fatal("comment succeeded despite outbox failure")
	}
	if err = s.Delete(ctx, created.ID, actor); err == nil {
		t.Fatal("delete succeeded despite outbox failure")
	}
	read, err := s.Get(ctx, created.ID)
	if err != nil || read.Title != "Assigned task" {
		t.Fatal("failed outbox changed task")
	}
	if err = pool.QueryRow(ctx, `SELECT count(*) FROM tasks.tasks WHERE title='Must rollback'`).Scan(&count); err != nil || count != 0 {
		t.Fatal("failed create remained")
	}
	comments, err = s.ListComments(ctx, created.ID, 100, 0)
	if err != nil || len(comments) != 1 {
		t.Fatal("failed comment remained")
	}
	mustExec(`DROP TRIGGER reject_event ON tasks.outbox; DROP FUNCTION tasks.reject_event()`)
	// Concurrent workers must lease different records.
	var wg sync.WaitGroup
	deliveries := make(chan *task.Delivery, 2)
	errors := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); d, err := s.Claim(ctx); deliveries <- d; errors <- err }()
	}
	wg.Wait()
	close(deliveries)
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	seen := map[string]bool{}
	var first *task.Delivery
	for d := range deliveries {
		if d == nil || seen[d.Event.ID] {
			t.Fatal("concurrent workers claimed same event")
		}
		seen[d.Event.ID] = true
		if first == nil {
			first = d
		} else {
			if err = s.Delivered(ctx, *d); err != nil {
				t.Fatal(err)
			}
		}
	}
	// A process crash leaves a lease; expiry makes the same stable ID claimable.
	mustExec(`UPDATE tasks.outbox SET available_at=now()+interval '1 hour' WHERE id<>$1 AND delivered_at IS NULL`, first.Event.ID)
	if d, err := s.Claim(ctx); err != nil || d != nil {
		t.Fatal("unexpired lease was claimed")
	}
	mustExec(`UPDATE tasks.outbox SET locked_until=now()-interval '1 second' WHERE id=$1`, first.Event.ID)
	resumed, err := s.Claim(ctx)
	if err != nil || resumed == nil || resumed.Event.ID != first.Event.ID || resumed.LeaseToken == first.LeaseToken || resumed.Attempts != 2 {
		t.Fatalf("lease recovery failed: %+v %v", resumed, err)
	}
	if err = s.Delivered(ctx, *first); err != nil {
		t.Fatal(err)
	}
	var acknowledged bool
	if err = pool.QueryRow(ctx, `SELECT delivered_at IS NOT NULL FROM tasks.outbox WHERE id=$1`, first.Event.ID).Scan(&acknowledged); err != nil || acknowledged {
		t.Fatal("stale lease acknowledged newer claim")
	}
	if err = s.Retry(ctx, *resumed, time.Minute); err != nil {
		t.Fatal(err)
	}
	if d, err := s.Claim(ctx); err != nil || d != nil {
		t.Fatal("backoff ignored")
	}
	if err = s.Delete(ctx, created.ID, actor); err != nil {
		t.Fatal(err)
	}
	comments, err = s.ListComments(ctx, created.ID, 100, 0)
	if err != nil || len(comments) != 0 {
		t.Fatal("deleted task comments were not cascaded")
	}
}
