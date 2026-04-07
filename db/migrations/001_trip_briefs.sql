CREATE TABLE IF NOT EXISTS trip_briefs (
  brief_id UUID PRIMARY KEY,
  trip_id UUID NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  routes_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired')),
  decision_locked_at TIMESTAMPTZ,
  locked_by_token_hash TEXT,
  winning_route_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_trip_briefs_status_expires
  ON trip_briefs (status, expires_at);

CREATE TABLE IF NOT EXISTS trip_brief_votes (
  brief_id UUID NOT NULL REFERENCES trip_briefs(brief_id) ON DELETE CASCADE,
  voter_token_hash TEXT NOT NULL,
  route_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (brief_id, voter_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_trip_brief_votes_brief_route
  ON trip_brief_votes (brief_id, route_id);

CREATE TABLE IF NOT EXISTS trip_brief_vote_mutations (
  idempotency_key TEXT NOT NULL,
  brief_id UUID NOT NULL REFERENCES trip_briefs(brief_id) ON DELETE CASCADE,
  voter_token_hash TEXT NOT NULL,
  route_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (brief_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_trip_brief_vote_mutations_brief
  ON trip_brief_vote_mutations (brief_id, processed_at);
