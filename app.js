const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const bcrypt = require('bcryptjs');
const path = require('path');
const accountsDb = require('./db/accounts');
const clientsDb = require('./db/clients');

const app = express();
const PORT = process.env.PORT || 3000;

function ensureDefaultAdmin() {
  if (accountsDb.getAccountByLogin('Admin')) return;
  accountsDb.createAccount({
    id: String(Date.now()),
    login: 'Admin',
    password: bcrypt.hashSync('Test', 10),
    role: 'admin',
    createdAt: new Date().toISOString()
  });
}

function ensureDefaultClients() {
  if (clientsDb.listClients().length > 0) return;
  const now = new Date().toISOString();
  clientsDb.createClient({ id: String(Date.now()), name: 'Иван Иванов', email: 'ivan@example.com', phone: '+7 900 000-00-01', course: 'Веб-разработка', status: 'active', createdAt: now });
  clientsDb.createClient({ id: String(Date.now() + 1), name: 'Мария Петрова', email: 'maria@example.com', phone: '+7 900 000-00-02', course: 'Дизайн интерфейсов', status: 'completed', createdAt: now });
  clientsDb.createClient({ id: String(Date.now() + 2), name: 'Алексей Сидоров', email: 'alexey@example.com', phone: '+7 900 000-00-03', course: 'Маркетинг', status: 'paused', createdAt: now });
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
  const user = accountsDb.getAccountByLogin(login);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { error: 'Неверный логин или пароль' });
  }
  req.session.user = { id: user.id, login: user.login, role: user.role };
  res.redirect('/clients');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/clients', requireAuth, (req, res) => res.render('clients/index', { clients: clientsDb.listClients(), pageTitle: 'Клиенты' }));

app.get('/clients/new', requireAuth, (req, res) => res.render('clients/new', { error: null }));

app.post('/clients', requireAuth, (req, res) => {
  const { name, email, phone, course, status } = req.body;
  if (clientsDb.getClientByEmail(email)) return res.render('clients/new', { error: 'Клиент с таким email уже существует' });
  clientsDb.createClient({ id: String(Date.now()), name, email, phone, course, status, createdAt: new Date().toISOString() });
  res.redirect('/clients');
});

app.get('/clients/:id/edit', requireAuth, (req, res) => {
  const client = clientsDb.getClientById(req.params.id);
  if (!client) return res.redirect('/clients');
  res.render('clients/edit', { client, error: null });
});

app.post('/clients/:id', requireAuth, (req, res) => {
  const { name, email, phone, course, status } = req.body;
  const existing = clientsDb.getClientById(req.params.id);
  if (!existing) return res.redirect('/clients');
  const duplicate = clientsDb.getClientByEmail(email);
  if (duplicate && duplicate.id !== req.params.id) return res.render('clients/edit', { client: existing, error: 'Клиент с таким email уже существует' });
  clientsDb.updateClient({ id: req.params.id, name, email, phone, course, status });
  res.redirect('/clients');
});

app.post('/clients/:id/delete', requireAuth, (req, res) => {
  clientsDb.deleteClient(req.params.id);
  res.redirect('/clients');
});

app.get('/accounts', requireAuth, (req, res) => res.render('accounts/index', { accounts: accountsDb.listAccounts(), pageTitle: 'Аккаунты' }));

app.get('/accounts/new', requireAuth, (req, res) => res.render('accounts/new', { error: null }));

app.post('/accounts', requireAuth, (req, res) => {
  const { login, password, role } = req.body;
  if (accountsDb.getAccountByLogin(login)) return res.render('accounts/new', { error: 'Аккаунт с таким логином уже существует' });
  accountsDb.createAccount({ id: String(Date.now()), login, password: bcrypt.hashSync(password, 10), role, createdAt: new Date().toISOString() });
  res.redirect('/accounts');
});

app.get('/accounts/:id/edit', requireAuth, (req, res) => {
  const account = accountsDb.getAccountById(req.params.id);
  if (!account) return res.redirect('/accounts');
  res.render('accounts/edit', { account, error: null });
});

app.post('/accounts/:id', requireAuth, (req, res) => {
  const { login, password, role } = req.body;
  const existing = accountsDb.getAccountById(req.params.id);
  if (!existing) return res.redirect('/accounts');
  const duplicate = accountsDb.getAccountByLogin(login);
  if (duplicate && duplicate.id !== req.params.id) return res.render('accounts/edit', { account: existing, error: 'Аккаунт с таким логином уже существует' });
  accountsDb.updateAccount({
    id: req.params.id,
    login,
    role,
    password: password ? bcrypt.hashSync(password, 10) : existing.password
  });
  res.redirect('/accounts');
});

app.post('/accounts/:id/delete', requireAuth, (req, res) => {
  accountsDb.deleteAccount(req.params.id);
  res.redirect('/accounts');
});

app.listen(PORT, () => console.log(`CRM сервер запущен: http://localhost:${PORT}`));
