package com.taskflow.projects.project;

import com.taskflow.projects.api.ApiException;
import com.taskflow.projects.auth.AuthClient;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProjectControllerTest {
    private final ProjectRepository projects = mock(ProjectRepository.class);
    private final AuthClient auth = mock(AuthClient.class);
    private final ProjectController controller = new ProjectController(projects, auth);
    private final UUID owner = UUID.fromString("11111111-1111-4111-8111-111111111111");
    private final UUID memberId = UUID.randomUUID();
    private final UUID projectId = UUID.randomUUID();
    private final Project project = new Project(projectId, "Platform", "", owner, Instant.now(), "owner");
    private final ProjectMember member = new ProjectMember(memberId, "Teammate", "member@example.test", "member");
    private final String token = "Bearer token";

    @BeforeEach
    void setUp() {
        when(auth.authenticate(token)).thenReturn(owner);
        when(projects.findAccessible(projectId, owner)).thenReturn(Optional.of(project));
    }

    @Test
    void filtersCollectionUsingAuthenticatedIdentityAndPaginates() {
        when(projects.findAccessible(owner, 3, 4)).thenReturn(List.of(project, project, project));
        ProjectPage page = controller.list(2, 4, token);
        assertEquals(List.of(project, project), page.items());
        assertEquals(2, page.limit());
        assertEquals(4, page.offset());
        assertTrue(page.hasMore());
        verify(projects).findAccessible(owner, 3, 4);
    }

    @Test
    void marksLastPageAndRejectsInvalidPaginationWithoutStorage() {
        when(projects.findAccessible(owner, 51, 0)).thenReturn(List.of());
        assertFalse(controller.list(50, 0, token).hasMore());
        clearInvocations(projects);
        assertStatus(HttpStatus.BAD_REQUEST, () -> controller.list(0, 0, token));
        assertStatus(HttpStatus.BAD_REQUEST, () -> controller.list(101, 0, token));
        assertStatus(HttpStatus.BAD_REQUEST, () -> controller.list(1, -1, token));
        verifyNoInteractions(projects);
    }

    @Test
    void hidesAbsentAndInaccessibleProjects() {
        UUID missing = UUID.randomUUID();
        when(projects.findAccessible(missing, owner)).thenReturn(Optional.empty());
        assertStatus(HttpStatus.NOT_FOUND, () -> controller.get(missing, token));
        verify(projects).findAccessible(missing, owner);
    }

    @Test
    void permitsMembersToReadProjectAndTeam() {
        when(auth.authenticate(token)).thenReturn(memberId);
        Project shared = new Project(projectId, "Platform", "", owner, Instant.now(), "member");
        when(projects.findAccessible(projectId, memberId)).thenReturn(Optional.of(shared));
        when(auth.findUserById(owner, token)).thenReturn(new AuthClient.User(owner, "Owner", "owner@example.test"));
        when(projects.findMembers(projectId)).thenReturn(List.of(member));
        assertEquals("member", controller.get(projectId, token).role());
        var members = controller.members(projectId, token).get("items");
        assertEquals(2, members.size());
        assertEquals(owner, members.getFirst().userId());
        assertEquals("owner", members.getFirst().role());
        assertEquals(member, members.get(1));
    }

    @Test
    void persistsNewProjectForAuthenticatedUserAndReturnsLocation() {
        CreateProject request = new CreateProject("Platform", null);
        when(projects.create(owner, request)).thenReturn(project);
        var response = controller.create(request, token);
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(project, response.getBody());
        assertEquals("/projects/" + project.id(), response.getHeaders().getLocation().toString());
    }

    @Test
    void updatesOnlyProvidedProjectFieldsAsOwner() {
        UpdateProject request = new UpdateProject(null, "New description");
        when(projects.update(projectId, owner, request)).thenReturn(Optional.of(project));
        assertEquals(project, controller.update(projectId, request, token));
        verify(projects).update(projectId, owner, request);
    }

    @Test
    void rejectsEmptyAndBlankNameUpdates() {
        assertStatus(HttpStatus.BAD_REQUEST, () -> controller.update(projectId, new UpdateProject(null, null), token));
        assertStatus(HttpStatus.BAD_REQUEST, () -> controller.update(projectId, new UpdateProject("   ", null), token));
        verify(projects, never()).update(any(), any(), any());
    }

    @Test
    void membersCannotManageProjectsOrMemberships() {
        when(auth.authenticate(token)).thenReturn(memberId);
        when(projects.findAccessible(projectId, memberId)).thenReturn(Optional.of(project));
        assertStatus(HttpStatus.FORBIDDEN, () -> controller.update(projectId, new UpdateProject("New", null), token));
        assertStatus(HttpStatus.FORBIDDEN, () -> controller.archive(projectId, token));
        assertStatus(HttpStatus.FORBIDDEN, () -> controller.addMember(projectId, new AddProjectMember("new@example.test"), token));
        assertStatus(HttpStatus.FORBIDDEN, () -> controller.removeMember(projectId, memberId, token));
        verify(projects, never()).update(any(), any(), any());
        verify(projects, never()).archive(any(), any());
        verify(projects, never()).addMember(any(), any(), any());
        verify(projects, never()).removeMember(any(), any(), any());
        verify(auth, never()).findUserByEmail(any(), any());
    }

    @Test
    void archivesProjectAndReturnsNoContent() {
        when(projects.archive(projectId, owner)).thenReturn(true);
        assertEquals(HttpStatus.NO_CONTENT, controller.archive(projectId, token).getStatusCode());
        verify(projects).archive(projectId, owner);
    }

    @Test
    void treatsConcurrentArchiveAsNotFound() {
        when(projects.update(eq(projectId), eq(owner), any())).thenReturn(Optional.empty());
        assertStatus(HttpStatus.NOT_FOUND, () -> controller.update(projectId, new UpdateProject("New", null), token));
        assertStatus(HttpStatus.NOT_FOUND, () -> controller.archive(projectId, token));
    }

    @Test
    void resolvesMemberByNormalizedEmailAndPersistsAuthIdentity() {
        AuthClient.User user = new AuthClient.User(memberId, member.name(), member.email());
        when(auth.findUserByEmail("member@example.test", token)).thenReturn(user);
        when(projects.addMember(projectId, owner, user)).thenReturn(Optional.of(member));
        var response = controller.addMember(projectId, new AddProjectMember("MEMBER@example.test"), token);
        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(member, response.getBody());
        verify(projects).addMember(projectId, owner, user);
    }

    @Test
    void missingUserDoesNotCreateMembership() {
        when(auth.findUserByEmail("missing@example.test", token))
            .thenThrow(new ApiException(HttpStatus.NOT_FOUND, "User not found."));
        assertStatus(HttpStatus.NOT_FOUND, () -> controller.addMember(projectId, new AddProjectMember("missing@example.test"), token));
        verify(projects, never()).addMember(any(), any(), any());
    }

    @Test
    void ownerMembershipCannotBeAddedOrRemoved() {
        when(auth.findUserByEmail("owner@example.test", token)).thenReturn(new AuthClient.User(owner, "Owner", "owner@example.test"));
        assertStatus(HttpStatus.BAD_REQUEST, () -> controller.addMember(projectId, new AddProjectMember("owner@example.test"), token));
        assertStatus(HttpStatus.BAD_REQUEST, () -> controller.removeMember(projectId, owner, token));
        verify(projects, never()).addMember(any(), any(), any());
        verify(projects, never()).removeMember(any(), any(), any());
    }

    @Test
    void removesMemberAndReportsMissingMembership() {
        when(projects.removeMember(projectId, owner, memberId)).thenReturn(true, false);
        assertEquals(HttpStatus.NO_CONTENT, controller.removeMember(projectId, memberId, token).getStatusCode());
        assertStatus(HttpStatus.NOT_FOUND, () -> controller.removeMember(projectId, memberId, token));
    }

    @Test
    void membershipCheckIncludesOwnerWithoutMembershipRowAndHidesAbsentMembers() {
        when(auth.findUserById(owner, token)).thenReturn(new AuthClient.User(owner, "Owner", "owner@example.test"));
        assertEquals("owner", controller.member(projectId, owner, token).role());
        verify(projects, never()).findMember(projectId, owner);
        when(projects.findMember(projectId, memberId)).thenReturn(Optional.of(member), Optional.empty());
        assertEquals(member, controller.member(projectId, memberId, token));
        assertStatus(HttpStatus.NOT_FOUND, () -> controller.member(projectId, memberId, token));
    }

    @Test
    void outsidersCannotInspectMembership() {
        when(projects.findAccessible(projectId, owner)).thenReturn(Optional.empty());
        assertStatus(HttpStatus.NOT_FOUND, () -> controller.member(projectId, memberId, token));
        assertStatus(HttpStatus.NOT_FOUND, () -> controller.members(projectId, token));
        verify(projects, never()).findMember(any(), any());
        verify(projects, never()).findMembers(any());
        verify(auth, never()).findUserById(any(), any());
    }

    @Test
    void doesNotQueryStorageIfAuthFails() {
        when(auth.authenticate(null)).thenThrow(new ApiException(HttpStatus.UNAUTHORIZED, "Sign in"));
        assertStatus(HttpStatus.UNAUTHORIZED, () -> controller.list(50, 0, null));
        verifyNoInteractions(projects);
    }

    private void assertStatus(HttpStatus status, Runnable call) {
        assertEquals(status, assertThrows(ApiException.class, call::run).status());
    }
}
