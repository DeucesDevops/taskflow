package com.taskflow.projects.project;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddProjectMember(@NotBlank @Email @Size(max = 254) String email) {}
