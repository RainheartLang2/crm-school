const db = require('../db');

// Связка «курс — преподаватели»: многие-ко-многим.
// Назначить можно только аккаунты с ролью teacher (проверяется в app.js).

const STMT = {
  idsForCourse: db.prepare('SELECT account_id FROM course_teachers WHERE course_id = ?'),
  clearCourse: db.prepare('DELETE FROM course_teachers WHERE course_id = ?'),
  add: db.prepare('INSERT OR IGNORE INTO course_teachers (course_id, account_id) VALUES (?, ?)'),
  coursesForTeacher: db.prepare(
    'SELECT c.id, c.name, c.description, c.duration, c.price, c.format, c.status, c.createdAt ' +
    'FROM courses c JOIN course_teachers ct ON ct.course_id = c.id ' +
    'WHERE ct.account_id = ? ORDER BY c.name'
  ),
  allWithLogins: db.prepare(
    'SELECT ct.course_id AS courseId, a.id AS accountId, a.login AS login ' +
    'FROM course_teachers ct JOIN accounts a ON a.id = ct.account_id ORDER BY a.login'
  ),
  clearTeacher: db.prepare('DELETE FROM course_teachers WHERE account_id = ?')
};

function getTeacherIdsForCourse(courseId) {
  return STMT.idsForCourse.all(courseId).map((row) => row.account_id);
}

const setCourseTeachersTx = db.transaction((courseId, accountIds) => {
  STMT.clearCourse.run(courseId);
  for (const accountId of accountIds) STMT.add.run(courseId, accountId);
});

function setCourseTeachers(courseId, accountIds) {
  const unique = [...new Set((accountIds || []).map((id) => String(id)))];
  setCourseTeachersTx(courseId, unique);
}

function listCoursesForTeacher(accountId) {
  return STMT.coursesForTeacher.all(accountId);
}

function getTeachersMap() {
  const map = {};
  for (const row of STMT.allWithLogins.all()) {
    if (!map[row.courseId]) map[row.courseId] = [];
    map[row.courseId].push({ id: row.accountId, login: row.login });
  }
  return map;
}

function removeTeacher(accountId) {
  STMT.clearTeacher.run(accountId);
}

function removeCourse(courseId) {
  STMT.clearCourse.run(courseId);
}

module.exports = { getTeacherIdsForCourse, setCourseTeachers, listCoursesForTeacher, getTeachersMap, removeTeacher, removeCourse };
