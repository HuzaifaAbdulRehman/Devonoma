CREATE TABLE IF NOT EXISTS github_activities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  relay_event_id uuid NOT NULL UNIQUE,
  event_type text NOT NULL CHECK (event_type = 'push'),
  repository_full_name text NOT NULL CHECK (repository_full_name <> ''),
  repository_url text NOT NULL CHECK (repository_url <> ''),
  branch text NOT NULL CHECK (branch <> ''),
  actor_login text NOT NULL CHECK (actor_login <> ''),
  actor_url text NOT NULL CHECK (actor_url <> ''),
  head_commit_sha text,
  head_commit_message text,
  head_commit_url text,
  event_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS github_activities_received_at_idx
  ON github_activities (received_at DESC, id DESC);
