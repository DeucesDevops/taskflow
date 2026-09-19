CREATE TABLE IF NOT EXISTS tasks.tasks (
 id uuid PRIMARY KEY,
 project_id uuid NOT NULL,
 title varchar(200) NOT NULL CHECK (length(trim(title)) > 0),
 status varchar(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tasks_project_created_idx ON tasks.tasks (project_id, created_at DESC);
