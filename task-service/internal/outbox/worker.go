package outbox

import (
	"context"
	"log/slog"
	"taskflow/task-service/internal/task"
	"time"
)

type Store interface {
	Claim(context.Context) (*task.Delivery, error)
	Delivered(context.Context, task.Delivery) error
	Retry(context.Context, task.Delivery, time.Duration) error
}
type Sender interface {
	Notify(context.Context, task.Event) error
}

func Backoff(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	if attempt > 10 {
		attempt = 10
	}
	delay := time.Second * time.Duration(1<<uint(attempt-1))
	if delay > 5*time.Minute {
		return 5 * time.Minute
	}
	return delay
}

// DeliverOne handles at most one due record. Failed acknowledgements leave the lease
// recoverable; the receiver deduplicates replay using the unchanged event ID.
func DeliverOne(ctx context.Context, store Store, sender Sender, logger *slog.Logger) (bool, error) {
	operation, cancel := context.WithTimeout(ctx, 3*time.Second)
	delivery, err := store.Claim(operation)
	cancel()
	if err != nil || delivery == nil {
		return false, err
	}
	attempt, cancel := context.WithTimeout(ctx, 3*time.Second)
	err = sender.Notify(attempt, delivery.Event)
	cancel()
	operation, cancel = context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err != nil {
		logger.Warn("outbox delivery failed; retry scheduled", "eventId", delivery.Event.ID, "attempt", delivery.Attempts)
		return true, store.Retry(operation, *delivery, Backoff(delivery.Attempts))
	}
	return true, store.Delivered(operation, *delivery)
}
func Run(ctx context.Context, store Store, sender Sender, logger *slog.Logger) {
	for ctx.Err() == nil {
		worked, err := DeliverOne(ctx, store, sender, logger)
		if err != nil && ctx.Err() == nil {
			logger.Warn("outbox operation failed; lease will recover", "error", err.Error())
		}
		if worked && err == nil {
			continue
		}
		timer := time.NewTimer(time.Second)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
}
