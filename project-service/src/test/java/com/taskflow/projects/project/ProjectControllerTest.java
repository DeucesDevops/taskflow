package com.taskflow.projects.project;

import com.taskflow.projects.api.ApiException;
import com.taskflow.projects.auth.AuthClient;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProjectControllerTest {
    private final ProjectRepository projects = mock(ProjectRepository.class);
    private final AuthClient auth = mock(AuthClient.class);
    private final ProjectController controller = new ProjectController(projects, auth);
    private final UUID owner = UUID.fromString("11111111-1111-4111-8111-111111111111");

    @Test
    void filtersCollectionUsingAuthenticatedIdentity() {
        when(auth.authenticate("Bearer token")).thenReturn(owner);
        when(projects.findOwned(owner)).thenReturn(List.of());
        assertEquals(List.of(), controller.list("Bearer token").get("items"));
        verify(projects).findOwned(owner);
    }

    @Test
    void hidesAbsentAndUnownedProjects() {
        UUID id = UUID.randomUUID();
        when(auth.authenticate("Bearer token")).thenReturn(owner);
        when(projects.findOwned(id, owner)).thenReturn(Optional.empty());
        ApiException error = assertThrows(ApiException.class, () -> controller.get(id, "Bearer token"));
        assertEquals(HttpStatus.NOT_FOUND, error.status());
        verify(projects).findOwned(id, owner);
    }

    @Test
    void persistsNewProjectForAuthenticatedUserAndReturnsLocation() {
        CreateProject request = new CreateProject("Platform", null);
        Project project = new Project(UUID.randomUUID(), "Platform", "", owner, Instant.now());
        when(auth.authenticate("Bearer token")).thenReturn(owner);
        when(projects.create(owner, request)).thenReturn(project);
        var response = controller.create(request, "Bearer token");
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(project, response.getBody());
        assertEquals("/projects/" + project.id(), response.getHeaders().getLocation().toString());
    }

    @Test
    void doesNotQueryStorageIfAuthFails() {
        when(auth.authenticate(null)).thenThrow(new ApiException(HttpStatus.UNAUTHORIZED, "Sign in"));
        assertThrows(ApiException.class, () -> controller.list(null));
        verifyNoInteractions(projects);
    }
}
