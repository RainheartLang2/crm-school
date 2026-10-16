const Database = require('better-sqlite3');
const path = require('path');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'crm.db');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    login TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    course TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    createdAt TEXT NOT NULL
  );
`);

module.exports = db;