const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

function getMyPreferences(houseId, userId) {
  const tasks = db.prepare(
    'SELECT id, name, room, effort_level FROM task_catalog WHERE house_id = ? AND is_active = 1'
  ).all(houseId);

  const prefs = db.prepare(
    'SELECT task_id, preference_level, has_physical_limitation FROM member_preferences WHERE house_id = ? AND user_id = ?'
  ).all(houseId, userId);

  const prefMap = {};
  prefs.forEach(p => { prefMap[p.task_id] = p; });

  return tasks.map(task => ({
    task_id: task.id,
    task_name: task.name,
    room: task.room,
    effort_level: task.effort_level,
    preference_level: prefMap[task.id]?.preference_level || 'neutral',
    has_physical_limitation: prefMap[task.id]?.has_physical_limitation === 1 || false,
  }));
}

function getMemberPreferences(houseId, userId) {
  return db.prepare(
    'SELECT task_id, preference_level, has_physical_limitation FROM member_preferences WHERE house_id = ? AND user_id = ?'
  ).all(houseId, userId);
}

function upsertPreference({ houseId, userId, taskId, preferenceLevel, hasPhysicalLimitation }) {
  const VALID_LEVELS = ['hate', 'neutral', 'like'];
  if (!VALID_LEVELS.includes(preferenceLevel)) {
    const err = new Error(`Preferência inválida. Valores: ${VALID_LEVELS.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const task = db.prepare('SELECT id FROM task_catalog WHERE id = ? AND house_id = ? AND is_active = 1').get(taskId, houseId);
  if (!task) {
    const err = new Error('Tarefa não encontrada.'); err.status = 404; throw err;
  }

  const existing = db.prepare(
    'SELECT id FROM member_preferences WHERE house_id = ? AND user_id = ? AND task_id = ?'
  ).get(houseId, userId, taskId);

  if (existing) {
    db.prepare(`
      UPDATE member_preferences
      SET preference_level = ?, has_physical_limitation = ?, updated_at = datetime('now')
      WHERE house_id = ? AND user_id = ? AND task_id = ?
    `).run(preferenceLevel, hasPhysicalLimitation ? 1 : 0, houseId, userId, taskId);
  } else {
    db.prepare(`
      INSERT INTO member_preferences (id, house_id, user_id, task_id, preference_level, has_physical_limitation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), houseId, userId, taskId, preferenceLevel, hasPhysicalLimitation ? 1 : 0);
  }

  return { task_id: taskId, preference_level: preferenceLevel, has_physical_limitation: !!hasPhysicalLimitation };
}

module.exports = { getMyPreferences, getMemberPreferences, upsertPreference };
