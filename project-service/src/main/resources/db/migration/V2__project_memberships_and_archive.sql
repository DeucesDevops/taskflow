-- Keep all existing projects and owner IDs intact. Ownership remains authoritative
-- on projects, so an owner never depends on a removable membership row.
ALTER TABLE projects.projects ADD COLUMN archived_at TIMESTAMPTZ;

CREATE TABLE projects.memberships (
    project_id UUID NOT NULL REFERENCES projects.projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX memberships_user_project_idx ON projects.memberships (user_id, project_id);
CREATE INDEX projects_active_created_idx ON projects.projects (created_at DESC, id)
    WHERE archived_at IS NULL;
