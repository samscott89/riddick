CREATE TABLE IF NOT EXISTS crates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    agent_summary TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, version)
);

CREATE INDEX IF NOT EXISTS idx_crates_name ON crates(name);
CREATE INDEX IF NOT EXISTS idx_crates_status ON crates(status);
CREATE INDEX IF NOT EXISTS idx_crates_created_at ON crates(created_at);