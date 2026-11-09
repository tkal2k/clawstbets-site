CREATE TABLE IF NOT EXISTS funnel (
  id   INTEGER PRIMARY KEY,
  t    TEXT NOT NULL,          -- ISO-8601 UTC timestamp
  ev   TEXT NOT NULL,          -- view | click
  slot TEXT NOT NULL,
  v    TEXT NOT NULL,          -- a | b | -
  ref  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS funnel_t ON funnel (t);
