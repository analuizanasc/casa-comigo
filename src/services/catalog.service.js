const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const VALID_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'];
const VALID_EFFORTS = ['light', 'medium', 'heavy'];

function validateTaskFields({ name, frequency, duration_minutes, effort_level }) {
  if (!name || name.trim() === '') {
    const err = new Error('Nome da tarefa é obrigatório.'); err.status = 400; throw err;
  }
  if (!VALID_FREQUENCIES.includes(frequency)) {
    const err = new Error(`Frequência inválida. Valores: ${VALID_FREQUENCIES.join(', ')}`); err.status = 400; throw err;
  }
  if (!VALID_EFFORTS.includes(effort_level)) {
    const err = new Error(`Nível de esforço inválido. Valores: ${VALID_EFFORTS.join(', ')}`); err.status = 400; throw err;
  }
  if (duration_minutes <= 0) {
    const err = new Error('Duração deve ser maior que zero.'); err.status = 400; throw err;
  }
}

function listTasks(houseId) {
  return db.prepare(`
    SELECT t.*, u.name as created_by_name
    FROM task_catalog t
    JOIN users u ON t.created_by = u.id
    WHERE t.house_id = ? AND t.is_active = 1
    ORDER BY t.room, t.name
  `).all(houseId);
}

function getTask(taskId, houseId) {
  const task = db.prepare(
    'SELECT * FROM task_catalog WHERE id = ? AND house_id = ? AND is_active = 1'
  ).get(taskId, houseId);

  if (!task) {
    const err = new Error('Tarefa não encontrada.'); err.status = 404; throw err;
  }

  const dependencies = db.prepare(`
    SELECT td.depends_on_task_id, t.name as depends_on_name
    FROM task_dependencies td
    JOIN task_catalog t ON td.depends_on_task_id = t.id
    WHERE td.task_id = ?
  `).all(taskId);

  const dependents = db.prepare(`
    SELECT td.task_id, t.name as task_name
    FROM task_dependencies td
    JOIN task_catalog t ON td.task_id = t.id
    WHERE td.depends_on_task_id = ?
  `).all(taskId);

  return { ...task, dependencies, dependents };
}

function createTask({ houseId, userId, body }) {
  const { name, description, frequency, duration_minutes, effort_level, room } = body;
  validateTaskFields({ name, frequency, duration_minutes: duration_minutes || 30, effort_level });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO task_catalog (id, house_id, name, description, frequency, duration_minutes, effort_level, room, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, houseId, name.trim(), description || null, frequency, duration_minutes || 30, effort_level, room || null, userId);

  return getTask(id, houseId);
}

function updateTask({ taskId, houseId, body }) {
  const existing = db.prepare('SELECT id FROM task_catalog WHERE id = ? AND house_id = ? AND is_active = 1').get(taskId, houseId);
  if (!existing) {
    const err = new Error('Tarefa não encontrada.'); err.status = 404; throw err;
  }

  const { name, description, frequency, duration_minutes, effort_level, room } = body;
  validateTaskFields({ name, frequency, duration_minutes: duration_minutes || 30, effort_level });

  db.prepare(`
    UPDATE task_catalog
    SET name = ?, description = ?, frequency = ?, duration_minutes = ?, effort_level = ?, room = ?, updated_at = datetime('now')
    WHERE id = ? AND house_id = ?
  `).run(name.trim(), description || null, frequency, duration_minutes || 30, effort_level, room || null, taskId, houseId);

  return getTask(taskId, houseId);
}

function deleteTask(taskId, houseId) {
  const existing = db.prepare('SELECT id FROM task_catalog WHERE id = ? AND house_id = ? AND is_active = 1').get(taskId, houseId);
  if (!existing) {
    const err = new Error('Tarefa não encontrada.'); err.status = 404; throw err;
  }
  // Soft delete
  db.prepare("UPDATE task_catalog SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(taskId);
}

function addDependency({ taskId, dependsOnTaskId, houseId }) {
  if (taskId === dependsOnTaskId) {
    const err = new Error('Uma tarefa não pode depender de si mesma.'); err.status = 400; throw err;
  }

  const task = db.prepare('SELECT id FROM task_catalog WHERE id = ? AND house_id = ? AND is_active = 1').get(taskId, houseId);
  const dep = db.prepare('SELECT id FROM task_catalog WHERE id = ? AND house_id = ? AND is_active = 1').get(dependsOnTaskId, houseId);

  if (!task || !dep) {
    const err = new Error('Tarefa não encontrada.'); err.status = 404; throw err;
  }

  // Check for circular dependency
  if (hasCircularDependency(taskId, dependsOnTaskId)) {
    const err = new Error('Dependência circular detectada.'); err.status = 400; throw err;
  }

  const existing = db.prepare('SELECT id FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?').get(taskId, dependsOnTaskId);
  if (existing) {
    const err = new Error('Esta dependência já existe.'); err.status = 409; throw err;
  }

  db.prepare('INSERT INTO task_dependencies (id, task_id, depends_on_task_id) VALUES (?, ?, ?)').run(uuidv4(), taskId, dependsOnTaskId);
}

function hasCircularDependency(taskId, dependsOnTaskId) {
  const visited = new Set();
  const queue = [dependsOnTaskId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const deps = db.prepare('SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?').all(current);
    deps.forEach(d => queue.push(d.depends_on_task_id));
  }
  return false;
}

function removeDependency({ taskId, dependsOnTaskId }) {
  const result = db.prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?').run(taskId, dependsOnTaskId);
  if (result.changes === 0) {
    const err = new Error('Dependência não encontrada.'); err.status = 404; throw err;
  }
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask, addDependency, removeDependency };
