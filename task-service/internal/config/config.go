package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	Port, DatabaseURL, AuthURL, ProjectURL, NotificationURL, InternalKey string
}

func Load() (Config, error) {
	c := Config{Port: os.Getenv("PORT"), DatabaseURL: os.Getenv("DATABASE_URL"), AuthURL: os.Getenv("AUTH_SERVICE_URL"), ProjectURL: os.Getenv("PROJECT_SERVICE_URL"), NotificationURL: os.Getenv("NOTIFICATION_SERVICE_URL"), InternalKey: os.Getenv("INTERNAL_API_KEY")}
	if c.Port == "" {
		c.Port = "8081"
	}
	if c.DatabaseURL == "" || c.InternalKey == "" {
		return c, fmt.Errorf("DATABASE_URL and INTERNAL_API_KEY are required")
	}
	for name, value := range map[string]string{"AUTH_SERVICE_URL": c.AuthURL, "PROJECT_SERVICE_URL": c.ProjectURL, "NOTIFICATION_SERVICE_URL": c.NotificationURL} {
		u, err := url.Parse(value)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return c, fmt.Errorf("%s must be an HTTP service URL", name)
		}
	}
	c.AuthURL = strings.TrimRight(c.AuthURL, "/")
	c.ProjectURL = strings.TrimRight(c.ProjectURL, "/")
	c.NotificationURL = strings.TrimRight(c.NotificationURL, "/")
	return c, nil
}
