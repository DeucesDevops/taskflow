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

func TestAssigneeLookupForwardsSessionAndRejectsNonmembers(t *testing.T) {
	const project = "22222222-2222-4222-8222-222222222222"
	const user = "11111111-1111-4111-8111-111111111111"
	for _, status := range []int{200, 404, 401, 503} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/projects/"+project+"/members/"+user || r.Header.Get("Authorization") != "Bearer session" {
				t.Error("member lookup did not forward session")
			}
			w.WriteHeader(status)
			if status == 200 {
				w.Write([]byte(`{"userId":"` + user + `","name":"Colleague","email":"c@example.com","role":"member"}`))
			}
		}))
		client := New(server.URL, server.URL, server.URL, "internal")
		member, err := client.GetMember(context.Background(), project, user, "Bearer session")
		server.Close()
		if status == 200 {
			if err != nil || member.UserID != user {
				t.Fatalf("member lookup failed: %v", err)
			}
			continue
		}
		expected := status
		if status == 404 {
			expected = 400
		}
		var failure *Error
		if !errors.As(err, &failure) || failure.Status != expected {
			t.Fatalf("status %d mapped to %v", status, err)
		}
	}
}
func TestMemberLookupFailsClosedForWrongUser(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"userId":"44444444-4444-4444-8444-444444444444","name":"Wrong user"}`))
	}))
	defer server.Close()
	client := New(server.URL, server.URL, server.URL, "internal")
	if _, err := client.GetMember(context.Background(), "22222222-2222-4222-8222-222222222222", "11111111-1111-4111-8111-111111111111", "Bearer session"); err == nil {
		t.Fatal("wrong member accepted")
	}
}
