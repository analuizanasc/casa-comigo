require('./setup');
const db = require('../../../config/database');

function limparBancoDados() {
  db.exec('DELETE FROM task_assignments');
  db.exec('DELETE FROM task_dependencies');
  db.exec('DELETE FROM member_preferences');
  db.exec('DELETE FROM task_catalog');
  db.exec('DELETE FROM house_members');
  db.exec('DELETE FROM houses');
  db.exec('DELETE FROM users');
}

module.exports = { limparBancoDados };
