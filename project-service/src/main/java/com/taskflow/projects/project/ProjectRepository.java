package com.taskflow.projects.project;

import com.taskflow.projects.auth.AuthClient.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

@Repository
public class ProjectRepository {
    private static final RowMapper<Project> MAPPER = (row, index) -> new Project(
        row.getObject("id", UUID.class), row.getString("name"), row.getString("description"),
        row.getObject("owner_id", UUID.class), row.getTimestamp("created_at").toInstant(), row.getString("role")
    );
    private static final RowMapper<ProjectMember> MEMBER_MAPPER = (row, index) -> new ProjectMember(
        row.getObject("user_id", UUID.class), row.getString("name"), row.getString("email"), "member"
    );
    private final JdbcTemplate jdbc;

    public ProjectRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Project> findAccessible(UUID user, int limit, int offset) {
        return jdbc.query("""
            SELECT p.*, CASE WHEN p.owner_id = ? THEN 'owner' ELSE 'member' END AS role
            FROM projects.projects p
            WHERE p.archived_at IS NULL AND (p.owner_id = ? OR EXISTS (
                SELECT 1 FROM projects.memberships m WHERE m.project_id = p.id AND m.user_id = ?
            )) ORDER BY p.created_at DESC, p.id LIMIT ? OFFSET ?
            """, MAPPER, user, user, user, limit, offset);
    }

    public Optional<Project> findAccessible(UUID id, UUID user) {
        return jdbc.query("""
            SELECT p.*, CASE WHEN p.owner_id = ? THEN 'owner' ELSE 'member' END AS role
            FROM projects.projects p
            WHERE p.id = ? AND p.archived_at IS NULL AND (p.owner_id = ? OR EXISTS (
                SELECT 1 FROM projects.memberships m WHERE m.project_id = p.id AND m.user_id = ?
            ))
            """, MAPPER, user, id, user, user).stream().findFirst();
    }

    public Project create(UUID owner, CreateProject request) {
        return jdbc.queryForObject("""
            INSERT INTO projects.projects (id, name, description, owner_id)
            VALUES (?, ?, ?, ?) RETURNING *, 'owner' AS role
            """, MAPPER, UUID.randomUUID(), request.name().strip(),
            request.description() == null ? "" : request.description().strip(), owner);
    }

    public Optional<Project> update(UUID id, UUID owner, UpdateProject request) {
        return jdbc.query("""
            UPDATE projects.projects SET name = COALESCE(?, name), description = COALESCE(?, description)
            WHERE id = ? AND owner_id = ? AND archived_at IS NULL RETURNING *, 'owner' AS role
            """, MAPPER, request.name() == null ? null : request.name().strip(),
            request.description() == null ? null : request.description().strip(), id, owner).stream().findFirst();
    }

    public boolean archive(UUID id, UUID owner) {
        return jdbc.update("""
            UPDATE projects.projects SET archived_at = CURRENT_TIMESTAMP
            WHERE id = ? AND owner_id = ? AND archived_at IS NULL
            """, id, owner) == 1;
    }

    public List<ProjectMember> findMembers(UUID projectId) {
        return jdbc.query("""
            SELECT m.* FROM projects.memberships m
            JOIN projects.projects p ON p.id = m.project_id
            WHERE m.project_id = ? AND p.archived_at IS NULL AND m.user_id <> p.owner_id
            ORDER BY lower(m.name), m.user_id
            """, MEMBER_MAPPER, projectId);
    }

    public Optional<ProjectMember> findMember(UUID projectId, UUID userId) {
        return jdbc.query("""
            SELECT m.* FROM projects.memberships m
            JOIN projects.projects p ON p.id = m.project_id
            WHERE m.project_id = ? AND m.user_id = ? AND p.archived_at IS NULL
            """, MEMBER_MAPPER, projectId, userId).stream().findFirst();
    }

    public Optional<ProjectMember> addMember(UUID projectId, UUID ownerId, User user) {
        return jdbc.query("""
            INSERT INTO projects.memberships (project_id, user_id, name, email)
            SELECT p.id, ?, ?, ? FROM projects.projects p
            WHERE p.id = ? AND p.owner_id = ? AND p.archived_at IS NULL
            ON CONFLICT (project_id, user_id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
            RETURNING *
            """, MEMBER_MAPPER, user.id(), user.name(), user.email(), projectId, ownerId).stream().findFirst();
    }

    public boolean removeMember(UUID projectId, UUID ownerId, UUID userId) {
        return jdbc.update("""
            DELETE FROM projects.memberships m USING projects.projects p
            WHERE m.project_id = p.id AND p.id = ? AND p.owner_id = ?
              AND p.archived_at IS NULL AND m.user_id = ? AND m.user_id <> p.owner_id
            """, projectId, ownerId, userId) == 1;
    }
}
