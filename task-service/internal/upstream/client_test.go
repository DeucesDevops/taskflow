package upstream

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAuthFailureIsNotTreatedAsInvalidCredentials(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) }))
	defer upstream.Close()
	c := New(upstream.URL, upstream.URL, upstream.URL, "internal")
	_, err := c.Authenticate(context.Background(), "Bearer token")
	var failure *Error
	if !errors.As(err, &failure) || failure.Status != 503 {
		t.Fatalf("wrong dependency error: %v", err)
	}
}
func TestBearerTokenNotForwardedAcrossRedirects(t *testing.T) {
	called := false
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called = true; w.WriteHeader(200) }))
	defer target.Close()
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, target.URL, 302) }))
	defer upstream.Close()
	c := New(upstream.URL, upstream.URL, upstream.URL, "internal")
	_, err := c.Authenticate(context.Background(), "Bearer secret")
	if err == nil || called {
		t.Fatal("redirect followed or succeeded")
	}
}
func TestDependencyRequestHasBoundedTimeout(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { time.Sleep(50 * time.Millisecond); w.WriteHeader(200) }))
	defer upstream.Close()
	c := New(upstream.URL, upstream.URL, upstream.URL, "internal")
	c.HTTP.Timeout = 5 * time.Millisecond
	started := time.Now()
	err := c.CheckProject(context.Background(), "22222222-2222-4222-8222-222222222222", "Bearer test")
	if err == nil || time.Since(started) > 40*time.Millisecond {
		t.Fatalf("timeout not respected: %v", err)
	}
}
