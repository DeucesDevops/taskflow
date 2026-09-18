package com.taskflow.projects.project;

import com.taskflow.projects.api.ApiException;
import com.taskflow.projects.auth.AuthClient;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/projects")
public class ProjectController {
    private final ProjectRepository projects;
    private final AuthClient auth;

    public ProjectController(ProjectRepository projects, AuthClient auth) {
        this.projects = projects;
        this.auth = auth;
    }

    @GetMapping
    public Map<String, List<Project>> list(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        return Map.of("items", projects.findOwned(auth.authenticate(token)));
    }

    @GetMapping("/{id}")
    public Project get(@PathVariable UUID id, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        return projects.findOwned(id, auth.authenticate(token))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Project not found."));
    }

    @PostMapping
    public ResponseEntity<Project> create(@Valid @RequestBody CreateProject request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        Project project = projects.create(auth.authenticate(token), request);
        return ResponseEntity.created(URI.create("/projects/" + project.id())).body(project);
    }
}
