import  Database  from 'better-sqlite3';

const db = new Database('ze-benchmarks.db');
const query = `

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)


`;

db.exec(query);
