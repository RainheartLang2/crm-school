const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const ACCOUNTS_FILE = path.join(__dirname, 'data', 'accounts.json');
const CLIENTS_FILE = path.join(__dirname, 'data', 'clients.json');

function readAccounts() {
  try {
    if (!fs.existsSync(ACCOUNTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeAccounts(accounts) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf8');
}

function ensureDefaultAdmin() {
  const accounts = readAccounts();
  if (accounts.length === 0) {
    accounts.push({
      id: String(Date.now()),
      login: 'Admin',
      password: bcrypt.hashSync('Test', 10),
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    writeAccounts(accounts);
  }
}

function readClients() {
  try {
    if (!fs.existsSync(CLIENTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(CLIENTS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeClients(clients) {
  fs.writeFileSync(CLIENTS_FILE, JSON.stringify(clients, null, 2), 'utf8');
}

function ensureDefaultClients() {
  const clients = readClients();
  if (clients.length === 0) {
    const now = new Date().toISOString();
    clients.push(
      { id: String(Date.now()), name: 'Иван Иванов', email: 'ivan@example.com', phone: '+7 900 000-00-01', course: 'Веб-разработка', status: 'active', createdAt: now },
      { id: String(Date.now() + 1), name: 'Мария Петрова', email: 'maria@example.com', phone: '+7 900 000-00-02', course: 'Дизайн интерфейсов', status: 'completed', createdAt: now },
      { id: String(Date.now() + 2), name: 'Алексей Сидоров', email: 'alexey@example.com', phone: '+7 900 000-00-03', course: 'Маркетинг', status: 'paused', createdAt: now }
    );
    writeClients(clients);
  }
}

ensureDefaultAdmin();
ensureDefaultClients();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(session({ secret: 'crm-school-secret-key', resave: false, saveUninitialized: false, cookie: { maxAge: 1000 * 60 * 60 * 24 } }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.requestPath = req.path;
  res.locals.error = null;
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/clients');
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/clients');
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { login, password } = req.body;
  const user = readAccounts().find(u => u.login === login);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { error: 'Неверный логин или пароль' });
  }
  req.session.user = { id: user.id, login: user.login, role: user.role };
  res.redirect('/clients');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/clients', requireAuth, (req, res) => res.render('clients/index', { clients: readClients(), pageTitle: 'Клиенты' }));

app.get('/clients/new', requireAuth, (req, res) => res.render('clients/new', { error: null }));

app.post('/clients', requireAuth, (req, res) => {
  const { name, email, phone, course, status } = req.body;
  const clients = readClients();
  if (clients.some(c => c.email === email)) return res.render('clients/new', { error: 'Клиент с таким email уже существует' });
  clients.push({ id: String(Date.now()), name, email, phone, course, status: status || 'active', createdAt: new Date().toISOString() });
  writeClients(clients);
  res.redirect('/clients');
});

app.get('/clients/:id/edit', requireAuth, (req, res) => {
  const client = readClients().find(c => c.id === req.params.id);
  if (!client) return res.redirect('/clients');
  res.render('clients/edit', { client, error: null });
});

app.post('/clients/:id', requireAuth, (req, res) => {
  const { name, email, phone, course, status } = req.body;
  const clients = readClients();
  const index = clients.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.redirect('/clients');
  if (clients.some(c => c.email === email && c.id !== req.params.id)) return res.render('clients/edit', { client: clients[index], error: 'Клиент с таким email уже существует' });
  clients[index] = { ...clients[index], name, email, phone, course, status: status || 'active' };
  writeClients(clients);
  res.redirect('/clients');
});

app.post('/clients/:id/delete', requireAuth, (req, res) => {
  writeClients(readClients().filter(c => c.id !== req.params.id));
  res.redirect('/clients');
});

app.get('/accounts', requireAuth, (req, res) => res.render('accounts/index', { accounts: readAccounts(), pageTitle: 'Аккаунты' }));

app.get('/accounts/new', requireAuth, (req, res) => res.render('accounts/new', { error: null }));

app.post('/accounts', requireAuth, (req, res) => {
  const { login, password, role } = req.body;
  const accounts = readAccounts();
  if (accounts.some(u => u.login === login)) return res.render('accounts/new', { error: 'Аккаунт с таким логином уже существует' });
  accounts.push({ id: String(Date.now()), login, password: bcrypt.hashSync(password, 10), role: role || 'user', createdAt: new Date().toISOString() });
  writeAccounts(accounts);
  res.redirect('/accounts');
});

app.get('/accounts/:id/edit', requireAuth, (req, res) => {
  const account = readAccounts().find(u => u.id === req.params.id);
  if (!account) return res.redirect('/accounts');
  res.render('accounts/edit', { account, error: null });
});

app.post('/accounts/:id', requireAuth, (req, res) => {
  const { login, password, role } = req.body;
  const accounts = readAccounts();
  const index = accounts.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.redirect('/accounts');
  if (accounts.some(u => u.login === login && u.id !== req.params.id)) return res.render('accounts/edit', { account: accounts[index], error: 'Аккаунт с таким логином уже существует' });
  accounts[index] = { ...accounts[index], login, role: role || 'user' };
  if (password) accounts[index].password = bcrypt.hashSync(password, 10);
  writeAccounts(accounts);
  res.redirect('/accounts');
});

app.post('/accounts/:id/delete', requireAuth, (req, res) => {
  writeAccounts(readAccounts().filter(u => u.id !== req.params.id));
  res.redirect('/accounts');
});

app.listen(PORT, () => console.log(`CRM сервер запущен: http://localhost:${PORT}`));
