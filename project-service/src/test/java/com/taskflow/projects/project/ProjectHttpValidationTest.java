package com.taskflow.projects.project;

import com.taskflow.projects.api.ApiErrorHandler;
import com.taskflow.projects.auth.AuthClient;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ProjectHttpValidationTest {
    private final ProjectRepository projects = mock(ProjectRepository.class);
    private final AuthClient auth = mock(AuthClient.class);
    private final UUID owner = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private MockMvc http;

    @BeforeEach
    void setUp() {
        when(auth.authenticate("Bearer token")).thenReturn(owner);
        when(projects.findAccessible(projectId, owner)).thenReturn(Optional.of(
            new Project(projectId, "Project", "", owner, Instant.now(), "owner")));
        http = MockMvcBuilders.standaloneSetup(new ProjectController(projects, auth))
            .setControllerAdvice(new ApiErrorHandler()).build();
    }

    @Test
    void appliesDefaultPaginationAtHttpBoundary() throws Exception {
        when(projects.findAccessible(owner, 51, 0)).thenReturn(List.of());
        http.perform(get("/projects").header("Authorization", "Bearer token"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.items").isArray())
            .andExpect(jsonPath("$.limit").value(50)).andExpect(jsonPath("$.offset").value(0))
            .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void rejectsMalformedPaginationAndIdentifiers() throws Exception {
        http.perform(get("/projects?limit=invalid").header("Authorization", "Bearer token"))
            .andExpect(status().isBadRequest());
        http.perform(get("/projects/not-a-uuid").header("Authorization", "Bearer token"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(projects);
    }

    @Test
    void validatesPartialUpdateStorageBoundsAndBlankName() throws Exception {
        for (String body : List.of("{\"name\":\"   \"}", "{}", "{\"name\":\"" + "x".repeat(121) + "\"}",
                "{\"description\":\"" + "x".repeat(2001) + "\"}")) {
            http.perform(patch("/projects/" + projectId).header("Authorization", "Bearer token")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        verify(projects, never()).update(any(), any(), any());
    }

    @Test
    void validatesMembershipEmailBeforeLookingUpUser() throws Exception {
        for (String body : List.of("{}", "{\"email\":\"\"}", "{\"email\":\"not-email\"}")) {
            http.perform(post("/projects/" + projectId + "/members").header("Authorization", "Bearer token")
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
        }
        verify(auth, never()).findUserByEmail(any(), any());
        verify(projects, never()).addMember(any(), any(), any());
    }
}
