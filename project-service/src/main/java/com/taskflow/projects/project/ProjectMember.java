package com.taskflow.projects.project;

import java.util.UUID;

public record ProjectMember(UUID userId, String name, String email, String role) {}
