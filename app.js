const express = require('express');
const session = require('express-session');
const methodOverride = require('method-override');
const bcrypt = require('bcryptjs');
const path = require('path');
const accountsDb = require('./db/accounts');
const clientsDb = require('./db/clients');
const coursesDb = require('./db/courses');
const courseTeachersDb = require('./db/course_teachers');

const app = express();
const PORT = process.env.PORT || 3000;

const VALID_ROLES = ['admin', 'teacher', 'curator', 'methodist'];
const ALL_ROLES = [...VALID_ROLES].sort();

function normalizeRoles(input) {
  const list = Array.isArray(input) ? input : input ? [input] : [];
  const roles = [...new Set(list.map((role) => String(role).trim()).filter((role) => VALID_ROLES.includes(role)))].sort();
  return roles.length ? roles : ['curator'];
}

function validatePasswordStrength(password) {
  const problems = [];
  if (password.length < 8) problems.push('не менее 8 символов');
  if (!/[a-zа-яё]/.test(password)) problems.push('хотя бы одну строчную букву');
  if (!/[A-ZА-ЯЁ]/.test(password)) problems.push('хотя бы одну заглавную букву');
  if (!/\d/.test(password)) problems.push('хотя бы одну цифру');
  return problems;
}

function normalizeTeacherIds(input) {
  const list = Array.isArray(input) ? input : input ? [input] : [];
  return [...new Set(list.map((id) => String(id)))];
}

// Преподавать могут аккаунты с ролью teacher; методист обладает всеми правами преподавателя
function canTeach(account) {
  return account.roles.includes('teacher') || account.roles.includes('methodist');
}

function filterTeacherIds(ids) {
  const teacherIds = new Set(accountsDb.listAccounts().filter(canTeach).map((acc) => acc.id));
  return normalizeTeacherIds(ids).filter((id) => teacherIds.has(id));
}

function listTeacherAccounts() {
  return accountsDb.listAccounts().filter(canTeach);
}

function ensureDefaultAdmin() {
  const existing = accountsDb.getAccountByLogin('Admin');
  if (existing) {
    // Учётная запись по умолчанию должна иметь все роли
    if (!ALL_ROLES.every((role) => existing.roles.includes(role))) {
      accountsDb.updateAccount({ id: existing.id, login: existing.login, roles: ALL_ROLES, password: existing.password });
    }
    return;
  }
  accountsDb.createAccount({
    id: String(Date.now()),
    login: 'Admin',
    password: bcrypt.hashSync('Test', 10),
    roles: ALL_ROLES,
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

function ensureDefaultCourses() {
  if (coursesDb.listCourses().length > 0) return;
  const now = new Date().toISOString();
  coursesDb.createCourse({ id: String(Date.now()), name: 'Веб-разработка', description: 'Основы фронтенд- и бэкенд-разработки: HTML, CSS, JavaScript, Node.js.', duration: 24, price: 45000, format: 'group', status: 'active', createdAt: now });
  coursesDb.createCourse({ id: String(Date.now() + 1), name: 'Дизайн интерфейсов', description: 'UX/UI-дизайн: Figma, прототипирование, дизайн-системы.', duration: 16, price: 38000, format: 'group', status: 'active', createdAt: now });
  coursesDb.createCourse({ id: String(Date.now() + 2), name: 'Маркетинг', description: 'Digital-маркетинг: SMM, трафик, аналитика рекламных кампаний.', duration: 12, price: 30000, format: 'webinar', status: 'active', createdAt: now });
}

accountsDb.migrateLegacyUserRoles();
ensureDefaultAdmin();
ensureDefaultClients();
ensureDefaultCourses();

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

function homePath(user) {
  if (user.roles.includes('curator')) return '/clients';
  if (user.roles.includes('methodist')) return '/courses';
  if (user.roles.includes('teacher')) return '/my-courses';
  if (user.roles.includes('admin')) return '/accounts';
  return '/no-access';
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!req.session.user.roles.includes('admin')) return res.redirect(homePath(req.session.user));
  next();
}

function requireCurator(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!req.session.user.roles.includes('curator')) return res.redirect(homePath(req.session.user));
  next();
}

function requireCourses(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!req.session.user.roles.includes('curator') && !req.session.user.roles.includes('methodist')) return res.redirect(homePath(req.session.user));
  next();
}

function requireTeaching(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!req.session.user.roles.includes('teacher') && !req.session.user.roles.includes('methodist')) return res.redirect(homePath(req.session.user));
  next();
}

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect(homePath(req.session.user));
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect(homePath(req.session.user));
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { login, password } = req.body;
  const user = accountsDb.getAccountByLogin(login);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { error: 'Неверный логин или пароль' });
  }
  req.session.user = { id: user.id, login: user.login, roles: user.roles };
  res.redirect(homePath(req.session.user));
});

app.get('/no-access', requireAuth, (req, res) => res.render('no-access'));

// Профиль доступен при любых ролях
app.get('/profile', requireAuth, (req, res) => {
  const account = accountsDb.getAccountById(req.session.user.id);
  if (!account) return req.session.destroy(() => res.redirect('/login'));
  res.render('profile', { account, error: null, message: null });
});

app.post('/profile/password', requireAuth, (req, res) => {
  const account = accountsDb.getAccountById(req.session.user.id);
  if (!account) return req.session.destroy(() => res.redirect('/login'));
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const render = (error, message) => res.render('profile', { account, error, message });
  if (!bcrypt.compareSync(currentPassword || '', account.password)) return render('Текущий пароль указан неверно', null);
  if (!newPassword) return render('Введите новый пароль', null);
  if (newPassword !== confirmPassword) return render('Новые пароли не совпадают', null);
  const problems = validatePasswordStrength(newPassword);
  if (problems.length) return render(`Пароль слишком простой — нужны ${problems.join(', ')}`, null);
  if (newPassword === currentPassword) return render('Новый пароль не должен совпадать с текущим', null);
  accountsDb.updateAccountPassword(account.id, bcrypt.hashSync(newPassword, 10));
  res.render('profile', { account, error: null, message: 'Пароль успешно обновлён' });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/clients', requireCurator, (req, res) => res.render('clients/index', { clients: clientsDb.listClients(), pageTitle: 'Клиенты' }));

app.get('/clients/new', requireCurator, (req, res) => res.render('clients/new', { error: null }));

app.post('/clients', requireCurator, (req, res) => {
  const { name, email, phone, course, status } = req.body;
  if (clientsDb.getClientByEmail(email)) return res.render('clients/new', { error: 'Клиент с таким email уже существует' });
  clientsDb.createClient({ id: String(Date.now()), name, email, phone, course, status, createdAt: new Date().toISOString() });
  res.redirect('/clients');
});

app.get('/clients/:id/edit', requireCurator, (req, res) => {
  const client = clientsDb.getClientById(req.params.id);
  if (!client) return res.redirect('/clients');
  res.render('clients/edit', { client, error: null });
});

app.post('/clients/:id', requireCurator, (req, res) => {
  const { name, email, phone, course, status } = req.body;
  const existing = clientsDb.getClientById(req.params.id);
  if (!existing) return res.redirect('/clients');
  const duplicate = clientsDb.getClientByEmail(email);
  if (duplicate && duplicate.id !== req.params.id) return res.render('clients/edit', { client: existing, error: 'Клиент с таким email уже существует' });
  clientsDb.updateClient({ id: req.params.id, name, email, phone, course, status });
  res.redirect('/clients');
});

app.post('/clients/:id/delete', requireCurator, (req, res) => {
  clientsDb.deleteClient(req.params.id);
  res.redirect('/clients');
});

app.get('/courses', requireCourses, (req, res) => {
  const courses = coursesDb.listCourses();
  res.render('courses/index', { courses, pageTitle: 'Курсы' });
});

app.get('/courses/new', requireCourses, (req, res) => res.render('courses/new', { error: null, course: null, teachers: listTeacherAccounts(), assignedTeacherIds: [] }));

app.post('/courses', requireCourses, (req, res) => {
  const { name, description, duration, price, format, status } = req.body;
  const assignedTeacherIds = filterTeacherIds(req.body.teacherIds);
  if (coursesDb.getCourseByName(name)) return res.render('courses/new', { error: 'Курс с таким названием уже существует', course: { name, description, duration, price, format, status }, teachers: listTeacherAccounts(), assignedTeacherIds });
  const id = String(Date.now());
  coursesDb.createCourse({ id, name, description, duration, price, format, status, createdAt: new Date().toISOString() });
  courseTeachersDb.setCourseTeachers(id, assignedTeacherIds);
  res.redirect('/courses');
});

app.get('/courses/:id/edit', requireCourses, (req, res) => {
  const course = coursesDb.getCourseById(req.params.id);
  if (!course) return res.redirect('/courses');
  res.render('courses/edit', { course, error: null, teachers: listTeacherAccounts(), assignedTeacherIds: courseTeachersDb.getTeacherIdsForCourse(course.id) });
});

app.post('/courses/:id', requireCourses, (req, res) => {
  const { name, description, duration, price, format, status } = req.body;
  const existing = coursesDb.getCourseById(req.params.id);
  if (!existing) return res.redirect('/courses');
  const assignedTeacherIds = filterTeacherIds(req.body.teacherIds);
  const duplicate = coursesDb.getCourseByName(name);
  if (duplicate && duplicate.id !== req.params.id) return res.render('courses/edit', { course: { ...existing, name, description, duration, price, format, status }, error: 'Курс с таким названием уже существует', teachers: listTeacherAccounts(), assignedTeacherIds });
  coursesDb.updateCourse({ id: req.params.id, name, description, duration, price, format, status });
  courseTeachersDb.setCourseTeachers(req.params.id, assignedTeacherIds);
  res.redirect('/courses');
});

app.post('/courses/:id/delete', requireCourses, (req, res) => {
  courseTeachersDb.removeCourse(req.params.id);
  coursesDb.deleteCourse(req.params.id);
  res.redirect('/courses');
});

app.get('/my-courses', requireTeaching, (req, res) => {
  const courses = courseTeachersDb.listCoursesForTeacher(req.session.user.id);
  res.render('my-courses', { courses, pageTitle: 'Мои курсы' });
});

app.get('/accounts', requireAdmin, (req, res) => res.render('accounts/index', { accounts: accountsDb.listAccounts(), pageTitle: 'Аккаунты' }));

app.get('/accounts/new', requireAdmin, (req, res) => res.render('accounts/new', { error: null }));

app.post('/accounts', requireAdmin, (req, res) => {
  const { login, password } = req.body;
  const roles = normalizeRoles(req.body.roles);
  if (accountsDb.getAccountByLogin(login)) return res.render('accounts/new', { error: 'Аккаунт с таким логином уже существует' });
  accountsDb.createAccount({ id: String(Date.now()), login, password: bcrypt.hashSync(password, 10), roles, createdAt: new Date().toISOString() });
  res.redirect('/accounts');
});

app.get('/accounts/:id/edit', requireAdmin, (req, res) => {
  const account = accountsDb.getAccountById(req.params.id);
  if (!account) return res.redirect('/accounts');
  res.render('accounts/edit', { account, error: null });
});

app.post('/accounts/:id', requireAdmin, (req, res) => {
  const { login, password } = req.body;
  const existing = accountsDb.getAccountById(req.params.id);
  if (!existing) return res.redirect('/accounts');
  const roles = normalizeRoles(req.body.roles);
  const duplicate = accountsDb.getAccountByLogin(login);
  if (duplicate && duplicate.id !== req.params.id) return res.render('accounts/edit', { account: existing, error: 'Аккаунт с таким логином уже существует' });
  accountsDb.updateAccount({
    id: req.params.id,
    login,
    roles,
    password: password ? bcrypt.hashSync(password, 10) : existing.password
  });
  res.redirect('/accounts');
});

app.post('/accounts/:id/delete', requireAdmin, (req, res) => {
  courseTeachersDb.removeTeacher(req.params.id);
  accountsDb.deleteAccount(req.params.id);
  res.redirect('/accounts');
});

app.listen(PORT, () => console.log(`CRM сервер запущен: http://localhost:${PORT}`));
