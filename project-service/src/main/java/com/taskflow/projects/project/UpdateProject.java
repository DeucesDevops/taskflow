package com.taskflow.projects.project;

import jakarta.validation.constraints.Size;

public record UpdateProject(
    @Size(min = 1, max = 120) String name,
    @Size(max = 2000) String description
) {}
