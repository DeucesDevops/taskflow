package com.taskflow.projects.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateProject(
    @NotBlank @Size(max = 120) String name,
    @Size(max = 2000) String description
) {}
