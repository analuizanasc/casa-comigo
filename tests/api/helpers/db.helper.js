require('./setup');
const db = require('../../../src/config/database');

function limparBancoDados() {
  db.exec('DELETE FROM task_assignments');
  db.exec('DELETE FROM task_dependencies');
  db.exec('DELETE FROM member_preferences');
  db.exec('DELETE FROM task_catalog');
  db.exec('DELETE FROM notifications');
  db.exec('DELETE FROM invitations');
  db.exec('DELETE FROM house_members');
  db.exec('DELETE FROM houses');
  db.exec('DELETE FROM users');
}

function obterIdUsuario(email) {
  const row = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  return row ? row.id : null;
}

module.exports = { limparBancoDados, obterIdUsuario };
