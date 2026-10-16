const db = require('../db');

const STMT = {
  all: db.prepare('SELECT id, name, description, duration, price, format, status, createdAt FROM courses'),
  byId: db.prepare('SELECT id, name, description, duration, price, format, status, createdAt FROM courses WHERE id = ?'),
  byName: db.prepare('SELECT id, name, description, duration, price, format, status, createdAt FROM courses WHERE name = ?'),
  insert: db.prepare('INSERT INTO courses (id, name, description, duration, price, format, status, createdAt) VALUES (@id, @name, @description, @duration, @price, @format, @status, @createdAt)'),
  update: db.prepare('UPDATE courses SET name = @name, description = @description, duration = @duration, price = @price, format = @format, status = @status WHERE id = @id'),
  remove: db.prepare('DELETE FROM courses WHERE id = ?')
};

function listCourses() {
  return STMT.all.all();
}

function getCourseById(id) {
  return STMT.byId.get(id) || null;
}

function getCourseByName(name) {
  return STMT.byName.get(name) || null;
}

function createCourse({ id, name, description, duration, price, format, status, createdAt }) {
  STMT.insert.run({
    id,
    name,
    description: description || null,
    duration: duration ? Number(duration) : null,
    price: price !== '' && price != null ? Number(price) : null,
    format: format || 'group',
    status: status || 'active',
    createdAt
  });
}

function updateCourse({ id, name, description, duration, price, format, status }) {
  STMT.update.run({
    id,
    name,
    description: description || null,
    duration: duration ? Number(duration) : null,
    price: price !== '' && price != null ? Number(price) : null,
    format: format || 'group',
    status: status || 'active'
  });
}

function deleteCourse(id) {
  STMT.remove.run(id);
}

module.exports = { listCourses, getCourseById, getCourseByName, createCourse, updateCourse, deleteCourse };