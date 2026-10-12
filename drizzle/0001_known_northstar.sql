CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created TEXT NOT NULL,
  CONSTRAINT users_role CHECK(role IN ('admin','user')),
  CONSTRAINT users_active CHECK(active IN (0,1))
);
CREATE UNIQUE INDEX users_email_unique ON users(email);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE auth_attempts (
  key TEXT PRIMARY KEY NOT NULL,
  window INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
CREATE TABLE credit_grants (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  amount_micros INTEGER NOT NULL,
  note TEXT NOT NULL,
  created TEXT NOT NULL,
  CONSTRAINT grants_positive CHECK(amount_micros > 0)
);
CREATE INDEX grants_user ON credit_grants(user_id);
ALTER TABLE runs ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE outcomes ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE ledger ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE ledger ADD COLUMN cost_micros INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ledger ADD COLUMN status TEXT NOT NULL DEFAULT 'legacy' CONSTRAINT ledger_status CHECK(status IN ('legacy','reserved','settled'));
UPDATE ledger SET cost_micros = CAST(ROUND(cost * 1000000) AS INTEGER);
CREATE INDEX runs_user ON runs(user_id,created);
CREATE INDEX outcomes_user ON outcomes(user_id,created);
CREATE INDEX ledger_user ON ledger(user_id,status);
