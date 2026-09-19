package com.taskflow.projects.project;

import java.util.List;

public record ProjectPage(List<Project> items, int limit, int offset, boolean hasMore) {}
