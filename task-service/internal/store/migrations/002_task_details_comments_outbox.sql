ALTER TABLE tasks.tasks ADD COLUMN description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 10000);
ALTER TABLE tasks.tasks ADD COLUMN assignee_id uuid;
ALTER TABLE tasks.tasks ADD COLUMN assignee_name varchar(200);
ALTER TABLE tasks.tasks ADD CONSTRAINT tasks_assignment_snapshot CHECK (assignee_id IS NOT NULL OR assignee_name IS NULL);
CREATE TABLE tasks.comments (
 id uuid PRIMARY KEY,
 task_id uuid NOT NULL REFERENCES tasks.tasks(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 5000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comments_task_created_idx ON tasks.comments (task_id, created_at, id);
CREATE INDEX tasks_project_order_idx ON tasks.tasks (project_id, created_at DESC, id);
CREATE TABLE tasks.outbox (
 id uuid PRIMARY KEY,
 payload jsonb NOT NULL,
 attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(),
 locked_until timestamptz,
 lease_token uuid,
 delivered_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbox_pending_idx ON tasks.outbox (available_at, created_at) WHERE delivered_at IS NULL;
