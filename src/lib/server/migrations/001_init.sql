CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text NOT NULL,
    display_name text NOT NULL,
    avatar_url text,
    bio text NOT NULL DEFAULT '',
    timezone text NOT NULL DEFAULT 'UTC',
    region text,
    onboarded boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_key ON users (lower(username));

CREATE TABLE identities (
    provider text NOT NULL,
    provider_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    login text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, provider_id)
);
CREATE INDEX identities_user ON identities (user_id);

CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE api_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    name text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    prefix text NOT NULL,
    can_write boolean NOT NULL DEFAULT true,
    last_used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    default_branch text NOT NULL DEFAULT 'main',
    ignore_rules text NOT NULL DEFAULT '',
    forked_from uuid REFERENCES projects ON DELETE SET NULL,
    proposal_seq int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX projects_owner_name ON projects (owner_id, lower(name));
CREATE INDEX projects_explore ON projects (visibility, updated_at DESC);

CREATE TABLE collaborators (
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('read', 'write', 'admin')),
    invited_by uuid REFERENCES users ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);
CREATE INDEX collaborators_user ON collaborators (user_id);

-- Snapshot ids are content hashes, so identical history is identical across projects and servers.
CREATE TABLE snapshots (
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    id text NOT NULL,
    parents text[] NOT NULL DEFAULT '{}',
    tree jsonb NOT NULL,
    author_id uuid REFERENCES users ON DELETE SET NULL,
    author_name text NOT NULL,
    message text NOT NULL,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (project_id, id)
);
CREATE INDEX snapshots_time ON snapshots (project_id, created_at DESC);

CREATE TABLE branches (
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    name text NOT NULL,
    head text,
    tracking text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, name)
);

CREATE TABLE tags (
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    name text NOT NULL,
    snapshot_id text NOT NULL,
    message text NOT NULL DEFAULT '',
    notes text NOT NULL DEFAULT '',
    author_id uuid REFERENCES users ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, name)
);

CREATE TABLE blobs (
    hash text PRIMARY KEY,
    size bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE project_blobs (
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    hash text NOT NULL,
    PRIMARY KEY (project_id, hash)
);
CREATE INDEX project_blobs_hash ON project_blobs (hash);

CREATE TABLE draft_changes (
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users ON DELETE CASCADE,
    branch text NOT NULL,
    path text NOT NULL,
    op text NOT NULL CHECK (op IN ('put', 'delete')),
    hash text,
    size bigint,
    base_hash text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id, branch, path)
);

CREATE TABLE proposals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    number int NOT NULL,
    title text NOT NULL,
    body text NOT NULL DEFAULT '',
    author_id uuid REFERENCES users ON DELETE SET NULL,
    source_project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    source_branch text NOT NULL,
    target_branch text NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'merged', 'closed')),
    merged_snapshot text,
    closed_by uuid REFERENCES users ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    UNIQUE (project_id, number)
);
CREATE INDEX proposals_source ON proposals (source_project_id, source_branch) WHERE status = 'open';

CREATE TABLE proposal_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id uuid NOT NULL REFERENCES proposals ON DELETE CASCADE,
    author_id uuid REFERENCES users ON DELETE SET NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proposal_comments_p ON proposal_comments (proposal_id, created_at);

CREATE TABLE remotes (
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    name text NOT NULL,
    url text NOT NULL,
    token_enc text,
    last_fetched_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, name)
);

CREATE TABLE activity (
    id bigserial PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects ON DELETE CASCADE,
    actor_id uuid REFERENCES users ON DELETE SET NULL,
    type text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_project ON activity (project_id, id DESC);
CREATE INDEX activity_actor ON activity (actor_id, id DESC);
