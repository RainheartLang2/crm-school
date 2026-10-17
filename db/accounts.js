const db = require('../db');

const STMT = {
  all: db.prepare('SELECT id, login, password, role, createdAt FROM accounts'),
  byId: db.prepare('SELECT id, login, password, role, createdAt FROM accounts WHERE id = ?'),
  byLogin: db.prepare('SELECT id, login, password, role, createdAt FROM accounts WHERE login = ?'),
  insert: db.prepare('INSERT INTO accounts (id, login, password, role, createdAt) VALUES (@id, @login, @password, @role, @createdAt)'),
  update: db.prepare('UPDATE accounts SET login = @login, role = @role, password = @password WHERE id = @id'),
  remove: db.prepare('DELETE FROM accounts WHERE id = ?')
};

// Роли хранятся в колонке role через запятую (например, "admin,teacher").
// Строки с одной ролью ("admin") из старых данных разбираются так же корректно.
function parseRoles(value) {
  return String(value || '').split(',').map((role) => role.trim()).filter(Boolean);
}

function toRolesValue(roles) {
  const list = Array.isArray(roles) ? roles : roles ? [roles] : [];
  const unique = [...new Set(list.map((role) => String(role).trim()).filter(Boolean))];
  return unique.length ? unique.join(',') : 'user';
}

function toAccount(row) {
  return row ? { ...row, roles: parseRoles(row.role) } : null;
}

function listAccounts() {
  return STMT.all.all().map(toAccount);
}

function getAccountById(id) {
  return toAccount(STMT.byId.get(id));
}

function getAccountByLogin(login) {
  return toAccount(STMT.byLogin.get(login));
}

function createAccount({ id, login, password, roles, createdAt }) {
  STMT.insert.run({ id, login, password, role: toRolesValue(roles), createdAt });
}

function updateAccount({ id, login, roles, password }) {
  STMT.update.run({ id, login, role: toRolesValue(roles), password });
}

function deleteAccount(id) {
  STMT.remove.run(id);
}

module.exports = { listAccounts, getAccountById, getAccountByLogin, createAccount, updateAccount, deleteAccount };