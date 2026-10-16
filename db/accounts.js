const db = require('../db');

const STMT = {
  all: db.prepare('SELECT id, login, password, role, createdAt FROM accounts'),
  byId: db.prepare('SELECT id, login, password, role, createdAt FROM accounts WHERE id = ?'),
  byLogin: db.prepare('SELECT id, login, password, role, createdAt FROM accounts WHERE login = ?'),
  insert: db.prepare('INSERT INTO accounts (id, login, password, role, createdAt) VALUES (@id, @login, @password, @role, @createdAt)'),
  update: db.prepare('UPDATE accounts SET login = @login, role = @role, password = @password WHERE id = @id'),
  remove: db.prepare('DELETE FROM accounts WHERE id = ?')
};

function listAccounts() {
  return STMT.all.all();
}

function getAccountById(id) {
  return STMT.byId.get(id) || null;
}

function getAccountByLogin(login) {
  return STMT.byLogin.get(login) || null;
}

function createAccount({ id, login, password, role, createdAt }) {
  STMT.insert.run({ id, login, password, role: role || 'user', createdAt });
}

function updateAccount({ id, login, role, password }) {
  STMT.update.run({ id, login, role: role || 'user', password });
}

function deleteAccount(id) {
  STMT.remove.run(id);
}

module.exports = { listAccounts, getAccountById, getAccountByLogin, createAccount, updateAccount, deleteAccount };