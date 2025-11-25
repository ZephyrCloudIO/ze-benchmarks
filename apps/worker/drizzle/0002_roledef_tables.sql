-- Create role_defs table
CREATE TABLE IF NOT EXISTS role_defs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  version TEXT NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '0.0.1',
  license TEXT DEFAULT 'MIT',
  availability TEXT DEFAULT 'public',
  maintainers TEXT NOT NULL,
  persona TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  dependencies TEXT NOT NULL,
  documentation TEXT NOT NULL,
  preferred_models TEXT NOT NULL,
  prompts TEXT NOT NULL,
  spawnable_sub_agents TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Use IF NOT EXISTS to avoid re-creating indexes already defined in prior migrations
CREATE INDEX IF NOT EXISTS idx_roledefs_name ON role_defs(name);
CREATE INDEX IF NOT EXISTS idx_roledefs_created_at ON role_defs(created_at);

-- Create evaluation_criteria table
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_def_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  score INTEGER NOT NULL,
  category TEXT,
  is_custom INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (role_def_id) REFERENCES role_defs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_criteria_roledef_id ON evaluation_criteria(role_def_id);
