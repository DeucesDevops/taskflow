package upstream

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"taskflow/task-service/internal/task"
)

type Error struct {
	Status  int
	Message string
}

func (e *Error) Error() string { return e.Message }

type Client struct {
	HTTP                                              *http.Client
	AuthURL, ProjectURL, NotificationURL, InternalKey string
}

func New(authURL, projectURL, notificationURL, internalKey string) *Client {
	return &Client{HTTP: &http.Client{Timeout: 2 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}, AuthURL: authURL, ProjectURL: projectURL, NotificationURL: notificationURL, InternalKey: internalKey}
}
func (c *Client) request(ctx context.Context, method, url, token string, body []byte) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Internal-Key", c.InternalKey)
	}
	return c.HTTP.Do(req)
}
func (c *Client) Authenticate(ctx context.Context, token string) (string, error) {
	res, err := c.request(ctx, http.MethodGet, c.AuthURL+"/auth/me", token, nil)
	if err != nil {
		return "", &Error{503, "Authentication service unavailable"}
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusUnauthorized {
		return "", &Error{401, "Please sign in"}
	}
	if res.StatusCode != 200 {
		return "", &Error{503, "Authentication service unavailable"}
	}
	var result struct {
		User struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, 32768)).Decode(&result); err != nil {
		return "", &Error{503, "Authentication service unavailable"}
	}
	id, err := uuid.Parse(result.User.ID)
	if err != nil {
		return "", &Error{503, "Authentication service unavailable"}
	}
	return id.String(), nil
}
func (c *Client) CheckProject(ctx context.Context, projectID, token string) error {
	res, err := c.request(ctx, http.MethodGet, c.ProjectURL+"/projects/"+projectID, token, nil)
	if err != nil {
		return &Error{503, "Project service unavailable"}
	}
	defer res.Body.Close()
	switch res.StatusCode {
	case 200:
		return nil
	case 404:
		return &Error{404, "Project not found"}
	case 401:
		return &Error{401, "Please sign in"}
	default:
		return &Error{503, "Project service unavailable"}
	}
}
func (c *Client) Ready(ctx context.Context) error {
	for _, url := range []string{c.AuthURL + "/ready", c.ProjectURL + "/ready"} {
		res, err := c.request(ctx, http.MethodGet, url, "", nil)
		if err != nil {
			return fmt.Errorf("dependency unavailable")
		}
		res.Body.Close()
		if res.StatusCode != 200 {
			return fmt.Errorf("dependency not ready")
		}
	}
	return nil
}
func (c *Client) Notify(ctx context.Context, event task.Event) error {
	body, err := json.Marshal(event)
	if err != nil {
		return err
	}
	res, err := c.request(ctx, http.MethodPost, c.NotificationURL+"/events", "", body)
	if err != nil {
		return fmt.Errorf("notification delivery unavailable")
	}
	defer res.Body.Close()
	if res.StatusCode != 202 {
		return fmt.Errorf("notification rejected with status %d", res.StatusCode)
	}
	return nil
}

// GetMember validates assignment against the project service using the caller's session.
func (c *Client) GetMember(ctx context.Context, projectID, userID, token string) (task.Member, error) {
	var member task.Member
	res, err := c.request(ctx, http.MethodGet, c.ProjectURL+"/projects/"+projectID+"/members/"+userID, token, nil)
	if err != nil {
		return member, &Error{503, "Project service unavailable"}
	}
	defer res.Body.Close()
	switch res.StatusCode {
	case 200:
	case 404:
		return member, &Error{400, "Assignee must be a project member"}
	case 401:
		return member, &Error{401, "Please sign in"}
	case 403:
		return member, &Error{404, "Project not found"}
	default:
		return member, &Error{503, "Project service unavailable"}
	}
	if err = json.NewDecoder(io.LimitReader(res.Body, 32768)).Decode(&member); err != nil || member.UserID != userID || member.Name == "" {
		return member, &Error{503, "Project service unavailable"}
	}
	return member, nil
}
