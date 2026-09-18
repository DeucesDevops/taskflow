package com.taskflow.projects.project;

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
        row.getObject("owner_id", UUID.class), row.getTimestamp("created_at").toInstant()
    );
    private final JdbcTemplate jdbc;

    public ProjectRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Project> findOwned(UUID owner) {
        return jdbc.query("SELECT * FROM projects.projects WHERE owner_id = ? ORDER BY created_at DESC, id", MAPPER, owner);
    }

    public Optional<Project> findOwned(UUID id, UUID owner) {
        return jdbc.query("SELECT * FROM projects.projects WHERE id = ? AND owner_id = ?", MAPPER, id, owner)
            .stream().findFirst();
    }

    public Project create(UUID owner, CreateProject request) {
        return jdbc.queryForObject("""
            INSERT INTO projects.projects (id, name, description, owner_id)
            VALUES (?, ?, ?, ?) RETURNING *
            """, MAPPER, UUID.randomUUID(), request.name().strip(),
            request.description() == null ? "" : request.description().strip(), owner);
    }
}
