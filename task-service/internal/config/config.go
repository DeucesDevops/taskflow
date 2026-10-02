package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	Port, DatabaseURL, AuthURL, ProjectURL, RabbitMQURL, RabbitMQQueue string
}

func Load() (Config, error) {
	c := Config{Port: os.Getenv("PORT"), DatabaseURL: os.Getenv("DATABASE_URL"), AuthURL: os.Getenv("AUTH_SERVICE_URL"), ProjectURL: os.Getenv("PROJECT_SERVICE_URL"), RabbitMQURL: os.Getenv("RABBITMQ_URL"), RabbitMQQueue: os.Getenv("RABBITMQ_QUEUE")}
	if c.Port == "" {
		c.Port = "8081"
	}
	if c.DatabaseURL == "" || c.RabbitMQURL == "" {
		return c, fmt.Errorf("DATABASE_URL and RABBITMQ_URL are required")
	}
	for name, value := range map[string]string{"AUTH_SERVICE_URL": c.AuthURL, "PROJECT_SERVICE_URL": c.ProjectURL} {
		u, err := url.Parse(value)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return c, fmt.Errorf("%s must be an HTTP service URL", name)
		}
	}
	c.AuthURL = strings.TrimRight(c.AuthURL, "/")
	c.ProjectURL = strings.TrimRight(c.ProjectURL, "/")
	rabbit, err := url.Parse(c.RabbitMQURL)
	if err != nil || rabbit.Host == "" || (rabbit.Scheme != "amqp" && rabbit.Scheme != "amqps") || rabbit.RawQuery != "" || rabbit.Fragment != "" {
		return c, fmt.Errorf("RABBITMQ_URL must be an AMQP service URL")
	}
	if c.RabbitMQQueue == "" {
		c.RabbitMQQueue = "taskflow.notifications"
	}
	return c, nil
}
