package broker

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	amqp "github.com/rabbitmq/amqp091-go"
	"taskflow/task-service/internal/task"
)

// Publisher sends durable outbox events to RabbitMQ and reconnects on the next
// attempt after a broker or channel failure.
type Publisher struct {
	url, queue string
	mu         sync.Mutex
	connection *amqp.Connection
	channel    *amqp.Channel
}

func NewPublisher(url, queue string) *Publisher {
	return &Publisher{url: url, queue: queue}
}

func (p *Publisher) connect() error {
	if p.connection != nil && !p.connection.IsClosed() && p.channel != nil && !p.channel.IsClosed() {
		return nil
	}
	p.close()
	connection, err := amqp.Dial(p.url)
	if err != nil {
		return fmt.Errorf("connect to RabbitMQ: %w", err)
	}
	channel, err := connection.Channel()
	if err != nil {
		_ = connection.Close()
		return fmt.Errorf("open RabbitMQ channel: %w", err)
	}
	if _, err = channel.QueueDeclare(p.queue, true, false, false, false, nil); err != nil {
		_ = channel.Close()
		_ = connection.Close()
		return fmt.Errorf("declare RabbitMQ queue: %w", err)
	}
	if err = channel.Confirm(false); err != nil {
		_ = channel.Close()
		_ = connection.Close()
		return fmt.Errorf("enable RabbitMQ publisher confirms: %w", err)
	}
	p.connection, p.channel = connection, channel
	return nil
}

func (p *Publisher) close() {
	if p.channel != nil && !p.channel.IsClosed() {
		_ = p.channel.Close()
	}
	if p.connection != nil && !p.connection.IsClosed() {
		_ = p.connection.Close()
	}
	p.channel, p.connection = nil, nil
}

func (p *Publisher) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.close()
}

func (p *Publisher) Notify(ctx context.Context, event task.Event) error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if err := p.connect(); err != nil {
		return err
	}
	body, err := json.Marshal(event)
	if err != nil {
		return err
	}
	confirmation, err := p.channel.PublishWithDeferredConfirmWithContext(ctx, "", p.queue, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		MessageId:    event.ID,
		Body:         body,
	})
	if err != nil {
		p.close()
		return fmt.Errorf("publish RabbitMQ event: %w", err)
	}
	if confirmation == nil {
		p.close()
		return fmt.Errorf("RabbitMQ publisher confirmation unavailable")
	}
	acknowledged, err := confirmation.WaitContext(ctx)
	if err != nil || !acknowledged {
		p.close()
		if err != nil {
			return fmt.Errorf("wait for RabbitMQ confirmation: %w", err)
		}
		return fmt.Errorf("RabbitMQ rejected published event")
	}
	return nil
}
