const fs = require('fs');
const path = require('path');
const db = require('../db');

const ACCOUNTS_FILE = path.join(__dirname, '..', 'data', 'accounts.json');
const CLIENTS_FILE = path.join(__dirname, '..', 'data', 'clients.json');

function readJson(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

const migrateAccounts = db.prepare('INSERT OR IGNORE INTO accounts (id, login, password, role, createdAt) VALUES (@id, @login, @password, @role, @createdAt)');
const migrateClients = db.prepare('INSERT OR IGNORE INTO clients (id, name, email, phone, course, status, createdAt) VALUES (@id, @name, @email, @phone, @course, @status, @createdAt)');

const run = db.transaction(() => {
  let accounts = 0;
  for (const a of readJson(ACCOUNTS_FILE)) {
    const role = String(a.role || 'curator').split(',').map((r) => (r === 'user' ? 'curator' : r)).join(',');
    migrateAccounts.run({ id: String(a.id), login: a.login, password: a.password, role, createdAt: a.createdAt || new Date().toISOString() });
    accounts++;
  }
  let clients = 0;
  for (const c of readJson(CLIENTS_FILE)) {
    migrateClients.run({ id: String(c.id), name: c.name, email: c.email, phone: c.phone, course: c.course, status: c.status || 'active', createdAt: c.createdAt || new Date().toISOString() });
    clients++;
  }
  console.log(`Migrated ${accounts} accounts and ${clients} clients from JSON.`);
  console.log('(Rows whose id or unique login/email already existed were skipped.)');
});

run();