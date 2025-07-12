CREATE TABLE IF NOT EXISTS modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    crate_id INTEGER NOT NULL,
    path TEXT NOT NULL,
    agent_summary TEXT,
    FOREIGN KEY (crate_id) REFERENCES crates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_modules_crate_id ON modules(crate_id);
CREATE INDEX IF NOT EXISTS idx_modules_path ON modules(path);