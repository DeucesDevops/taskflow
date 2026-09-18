CREATE TABLE projects.projects (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
    description VARCHAR(2000) NOT NULL DEFAULT '',
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX projects_owner_created_idx ON projects.projects (owner_id, created_at DESC);

-- A cross-service identifier, intentionally without a foreign key into auth's schema.
INSERT INTO projects.projects (id, name, description, owner_id)
VALUES (
    '22222222-2222-4222-8222-222222222222',
    'Platform launch',
    'Build the foundations of TaskFlow.',
    '11111111-1111-4111-8111-111111111111'
);
