package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"taskflow/task-service/internal/api"
	"taskflow/task-service/internal/broker"
	"taskflow/task-service/internal/config"
	"taskflow/task-service/internal/outbox"
	"taskflow/task-service/internal/store"
	"taskflow/task-service/internal/upstream"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		healthcheck()
		return
	}
	if err := run(logger); err != nil {
		logger.Error("task service stopped", "error", err.Error())
		os.Exit(1)
	}
}
func healthcheck() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	client := http.Client{Timeout: 3 * time.Second}
	res, err := client.Get("http://127.0.0.1:" + port + "/ready")
	if err != nil {
		os.Exit(1)
	}
	res.Body.Close()
	if res.StatusCode != 200 {
		os.Exit(1)
	}
}
func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	startup, cancel := context.WithTimeout(ctx, 20*time.Second)
	db, err := store.Open(startup, cfg.DatabaseURL)
	cancel()
	if err != nil {
		return errors.New("database initialization failed; check database configuration and readiness")
	}
	defer db.Close()
	dependencies := upstream.New(cfg.AuthURL, cfg.ProjectURL)
	publisher := broker.NewPublisher(cfg.RabbitMQURL, cfg.RabbitMQQueue)
	defer publisher.Close()
	workerCtx, workerCancel := context.WithCancel(ctx)
	workerDone := make(chan struct{})
	go func() { defer close(workerDone); outbox.Run(workerCtx, db, publisher, logger) }()
	defer func() { workerCancel(); <-workerDone }()
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: api.New(db, dependencies, logger), ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 12 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16384}
	result := make(chan error, 1)
	go func() { logger.Info("task service listening", "port", cfg.Port); result <- srv.ListenAndServe() }()
	select {
	case err := <-result:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdown); err != nil {
			return err
		}
		logger.Info("task service stopped gracefully")
		return nil
	}
}
