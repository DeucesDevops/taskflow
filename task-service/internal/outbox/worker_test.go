package outbox

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"taskflow/task-service/internal/task"
	"testing"
	"time"
)

type fakeStore struct {
	pending          *task.Delivery
	retry, delivered int
	delay            time.Duration
}

func (s *fakeStore) Claim(context.Context) (*task.Delivery, error) { return s.pending, nil }
func (s *fakeStore) Delivered(_ context.Context, d task.Delivery) error {
	s.delivered++
	s.pending = nil
	return nil
}
func (s *fakeStore) Retry(_ context.Context, d task.Delivery, delay time.Duration) error {
	s.retry++
	s.delay = delay
	return nil
}

type fakeSender struct {
	err     error
	ids     []string
	bounded bool
}

func (s *fakeSender) Notify(ctx context.Context, event task.Event) error {
	s.ids = append(s.ids, event.ID)
	deadline, ok := ctx.Deadline()
	s.bounded = ok && time.Until(deadline) <= 3*time.Second
	return s.err
}
func TestFailureRetriesStableEventThenAcknowledges(t *testing.T) {
	s := &fakeStore{pending: &task.Delivery{Event: task.Event{ID: "stable-event"}, Attempts: 3}}
	sender := &fakeSender{err: errors.New("offline")}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	worked, err := DeliverOne(context.Background(), s, sender, logger)
	if err != nil || !worked || s.retry != 1 || s.delivered != 0 || s.delay != 4*time.Second || !sender.bounded {
		t.Fatalf("failure not retried: %+v %v", s, err)
	}
	sender.err = nil
	_, err = DeliverOne(context.Background(), s, sender, logger)
	if err != nil || s.delivered != 1 || sender.ids[0] != sender.ids[1] {
		t.Fatal("event ID changed or delivery not acknowledged")
	}
}
func TestBackoffBounded(t *testing.T) {
	previous := time.Duration(0)
	for i := 1; i < 100; i++ {
		delay := Backoff(i)
		if delay < previous || delay > 5*time.Minute || delay < time.Second {
			t.Fatalf("bad backoff for %d: %v", i, delay)
		}
		previous = delay
	}
}
func TestNoPendingEventsDoesNotNotify(t *testing.T) {
	s, sender := &fakeStore{}, &fakeSender{}
	worked, err := DeliverOne(context.Background(), s, sender, slog.Default())
	if err != nil || worked || len(sender.ids) != 0 {
		t.Fatal("empty outbox attempted delivery")
	}
}
