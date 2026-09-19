package com.taskflow.projects.project;

import com.taskflow.projects.api.ApiException;
import com.taskflow.projects.auth.AuthClient;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    public ProjectPage list(@RequestParam(defaultValue = "50") int limit, @RequestParam(defaultValue = "0") int offset,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        UUID user = auth.authenticate(token);
        if (limit < 1 || limit > 100 || offset < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Limit must be 1–100 and offset must be non-negative.");
        }
        List<Project> rows = projects.findAccessible(user, limit + 1, offset);
        boolean hasMore = rows.size() > limit;
        return new ProjectPage(List.copyOf(rows.subList(0, Math.min(limit, rows.size()))), limit, offset, hasMore);
    }

    @GetMapping("/{id}")
    public Project get(@PathVariable UUID id, @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        return accessible(id, auth.authenticate(token));
    }

    @PostMapping
    public ResponseEntity<Project> create(@Valid @RequestBody CreateProject request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        Project project = projects.create(auth.authenticate(token), request);
        return ResponseEntity.created(URI.create("/projects/" + project.id())).body(project);
    }

    @PatchMapping("/{id}")
    public Project update(@PathVariable UUID id, @Valid @RequestBody UpdateProject request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        UUID user = auth.authenticate(token);
        requireOwner(id, user);
        if ((request.name() == null && request.description() == null)
                || (request.name() != null && request.name().isBlank())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Provide a non-empty name or a description to update.");
        }
        return projects.update(id, user, request).orElseThrow(this::notFound);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> archive(@PathVariable UUID id,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        UUID user = auth.authenticate(token);
        requireOwner(id, user);
        if (!projects.archive(id, user)) {
            throw notFound();
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/members")
    public Map<String, List<ProjectMember>> members(@PathVariable UUID id,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        Project project = accessible(id, auth.authenticate(token));
        List<ProjectMember> members = new ArrayList<>();
        members.add(ownerMember(project, token));
        members.addAll(projects.findMembers(id));
        return Map.of("items", List.copyOf(members));
    }

    @GetMapping("/{id}/members/{userId}")
    public ProjectMember member(@PathVariable UUID id, @PathVariable UUID userId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        Project project = accessible(id, auth.authenticate(token));
        if (project.ownerId().equals(userId)) {
            return ownerMember(project, token);
        }
        return projects.findMember(id, userId).orElseThrow(this::memberNotFound);
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<ProjectMember> addMember(@PathVariable UUID id, @Valid @RequestBody AddProjectMember request,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        UUID user = auth.authenticate(token);
        Project project = requireOwner(id, user);
        AuthClient.User member = auth.findUserByEmail(request.email().strip().toLowerCase(Locale.ROOT), token);
        if (member.id().equals(project.ownerId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The project owner is already on the team.");
        }
        ProjectMember added = projects.addMember(id, user, member).orElseThrow(this::notFound);
        return ResponseEntity.created(URI.create("/projects/" + id + "/members/" + added.userId())).body(added);
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable UUID id, @PathVariable UUID userId,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String token) {
        UUID user = auth.authenticate(token);
        Project project = requireOwner(id, user);
        if (project.ownerId().equals(userId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The project owner cannot be removed.");
        }
        if (!projects.removeMember(id, user, userId)) {
            throw memberNotFound();
        }
        return ResponseEntity.noContent().build();
    }

    private Project accessible(UUID id, UUID user) {
        return projects.findAccessible(id, user).orElseThrow(this::notFound);
    }

    private Project requireOwner(UUID id, UUID user) {
        Project project = accessible(id, user);
        if (!project.ownerId().equals(user)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only the project owner can manage this project.");
        }
        return project;
    }

    private ProjectMember ownerMember(Project project, String token) {
        AuthClient.User owner = auth.findUserById(project.ownerId(), token);
        return new ProjectMember(owner.id(), owner.name(), owner.email(), "owner");
    }

    private ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Project not found.");
    }

    private ApiException memberNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "Project member not found.");
    }
}
