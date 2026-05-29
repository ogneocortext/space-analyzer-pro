-- Initial schema for file monitor database
-- This migration creates the core tables for event storage, file state tracking,
-- scan snapshots, and data retention management.

-- ============================================================================
-- Table 1: file_events (append-only audit log with TTL-based pruning)
-- Stores every raw file system event for audit/history purposes.
-- Old events are periodically pruned based on retention_days config.
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id    TEXT NOT NULL,
    timestamp   TEXT NOT NULL,       -- ISO 8601 datetime
    event_type  TEXT NOT NULL,       -- 'created', 'modified', 'deleted', 'renamed', 'permission_changed'
    path        TEXT NOT NULL,       -- Full file path
    size        INTEGER,            -- File size in bytes (NULL for deletes/renames)
    old_path    TEXT,                -- Previous path (for rename events)
    metadata    TEXT,                -- Full JSON serialization of FileSystemEvent
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for fast lookup by path and timestamp range queries
CREATE INDEX IF NOT EXISTS idx_file_events_path ON file_events(path);
CREATE INDEX IF NOT EXISTS idx_file_events_timestamp ON file_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_file_events_type ON file_events(event_type);
CREATE INDEX IF NOT EXISTS idx_file_events_created_at ON file_events(created_at);

-- ============================================================================
-- Table 2: file_state (authoritative current file state, UPSERT-based)
-- This is the DEDUPLICATED table. Only ONE row per file path.
-- Updated on every event via INSERT OR REPLACE.
-- Deleted event removes the row entirely.
-- Renamed event deletes old path, inserts new path (in a transaction).
-- ============================================================================
CREATE TABLE IF NOT EXISTS file_state (
    path            TEXT PRIMARY KEY NOT NULL,
    size            INTEGER NOT NULL DEFAULT 0,
    modified        TEXT,             -- ISO 8601 last modification time
    file_hash       TEXT,             -- Content hash (if available)
    event_type      TEXT NOT NULL,    -- Current state: 'created' | 'modified' | 'renamed'
    last_event_id   INTEGER,         -- FK to file_events.id
    last_updated    TEXT NOT NULL DEFAULT (datetime('now')),
    metadata        TEXT,             -- JSON blob with extra attributes
    FOREIGN KEY (last_event_id) REFERENCES file_events(id) ON DELETE SET NULL
);

-- ============================================================================
-- Table 3: scan_snapshots (for scanner reconciliation)
-- Stores metadata from full scans so we can detect what changed between scans.
-- ============================================================================
CREATE TABLE IF NOT EXISTS scan_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id         TEXT NOT NULL UNIQUE,  -- UUID for this scan
    started_at      TEXT NOT NULL,
    completed_at    TEXT NOT NULL,
    total_files     INTEGER NOT NULL,
    total_size      INTEGER NOT NULL,
    directory_path  TEXT NOT NULL,         -- What directory was scanned
    file_hashes     TEXT,                  -- JSON map of path -> hash for quick diff
    config          TEXT,                  -- JSON of scan config used
    status          TEXT NOT NULL DEFAULT 'completed',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scan_snapshots_path ON scan_snapshots(directory_path);
CREATE INDEX IF NOT EXISTS idx_scan_snapshots_completed ON scan_snapshots(completed_at);

-- ============================================================================
-- Table 4: data_retention_config (configurable retention policies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_retention_config (
    key     TEXT PRIMARY KEY NOT NULL,
    value   TEXT NOT NULL
);

-- Default retention settings (can be overridden at runtime)
INSERT OR IGNORE INTO data_retention_config (key, value) VALUES ('event_retention_days', '30');
INSERT OR IGNORE INTO data_retention_config (key, value) VALUES ('scan_snapshot_retention_days', '90');
INSERT OR IGNORE INTO data_retention_config (key, value) VALUES ('max_events_per_path', '1000');
INSERT OR IGNORE INTO data_retention_config (key, value) VALUES ('cleanup_batch_size', '500');