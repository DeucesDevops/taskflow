package com.taskflow.projects.project;

import java.time.Instant;
import java.util.UUID;

public record Project(UUID id, String name, String description, UUID ownerId, Instant createdAt, String role) {}
