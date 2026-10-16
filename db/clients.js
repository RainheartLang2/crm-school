const db = require('../db');

const STMT = {
  all: db.prepare('SELECT id, name, email, phone, course, status, createdAt FROM clients'),
  byId: db.prepare('SELECT id, name, email, phone, course, status, createdAt FROM clients WHERE id = ?'),
  byEmail: db.prepare('SELECT id, name, email, phone, course, status, createdAt FROM clients WHERE email = ?'),
  insert: db.prepare('INSERT INTO clients (id, name, email, phone, course, status, createdAt) VALUES (@id, @name, @email, @phone, @course, @status, @createdAt)'),
  update: db.prepare('UPDATE clients SET name = @name, email = @email, phone = @phone, course = @course, status = @status WHERE id = @id'),
  remove: db.prepare('DELETE FROM clients WHERE id = ?')
};

function listClients() {
  return STMT.all.all();
}

function getClientById(id) {
  return STMT.byId.get(id) || null;
}

function getClientByEmail(email) {
  return STMT.byEmail.get(email) || null;
}

function createClient({ id, name, email, phone, course, status, createdAt }) {
  STMT.insert.run({ id, name, email, phone, course, status: status || 'active', createdAt });
}

function updateClient({ id, name, email, phone, course, status }) {
  STMT.update.run({ id, name, email, phone, course, status: status || 'active' });
}

function deleteClient(id) {
  STMT.remove.run(id);
}

module.exports = { listClients, getClientById, getClientByEmail, createClient, updateClient, deleteClient };