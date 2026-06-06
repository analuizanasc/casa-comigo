const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

function getSchedule({ houseId, userId, role, dateFrom, dateTo, assignedTo }) {
  let query = `
    SELECT
      ta.id, ta.task_id, t.name as task_name, t.frequency, t.duration_minutes,
      t.effort_level, t.room, ta.assigned_to, u.name as assigned_to_name,
      ta.scheduled_date, ta.status, ta.completed_at, ta.completion_notes,
      ta.group_id, ta.sequence_order
    FROM task_assignments ta
    JOIN task_catalog t ON ta.task_id = t.id
    JOIN users u ON ta.assigned_to = u.id
    WHERE ta.house_id = ?
  `;
  const params = [houseId];

  if (role === 'resident') {
    query += ' AND ta.assigned_to = ?';
    params.push(userId);
  } else if (assignedTo) {
    query += ' AND ta.assigned_to = ?';
    params.push(assignedTo);
  }

  if (dateFrom) { query += ' AND ta.scheduled_date >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND ta.scheduled_date <= ?'; params.push(dateTo); }

  query += ' ORDER BY ta.scheduled_date, ta.sequence_order';

  return db.prepare(query).all(...params);
}

function getAssignment(assignmentId, houseId) {
  const a = db.prepare(`
    SELECT ta.*, t.name as task_name, u.name as assigned_to_name
    FROM task_assignments ta
    JOIN task_catalog t ON ta.task_id = t.id
    JOIN users u ON ta.assigned_to = u.id
    WHERE ta.id = ? AND ta.house_id = ?
  `).get(assignmentId, houseId);

  if (!a) {
    const err = new Error('Atribuição não encontrada.'); err.status = 404; throw err;
  }
  return a;
}

function reassignTask({ assignmentId, houseId, newUserId }) {
  const assignment = getAssignment(assignmentId, houseId);

  if (assignment.status === 'completed') {
    const err = new Error('Tarefa já concluída não pode ser reatribuída.'); err.status = 400; throw err;
  }

  const member = db.prepare('SELECT id FROM house_members WHERE house_id = ? AND user_id = ?').get(houseId, newUserId);
  if (!member) {
    const err = new Error('Usuário não é membro desta casa.'); err.status = 400; throw err;
  }

  // RN03: check physical limitation for the new member
  const pref = db.prepare(
    'SELECT has_physical_limitation FROM member_preferences WHERE house_id = ? AND user_id = ? AND task_id = ?'
  ).get(houseId, newUserId, assignment.task_id);

  if (pref && pref.has_physical_limitation) {
    const err = new Error('Este membro possui limitação física para esta tarefa (RN03).'); err.status = 400; throw err;
  }

  db.prepare(`
    UPDATE task_assignments SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?
  `).run(newUserId, assignmentId);

  return getAssignment(assignmentId, houseId);
}

function completeTask({ assignmentId, houseId, userId, completionNotes }) {
  const assignment = getAssignment(assignmentId, houseId);

  if (assignment.status === 'completed') {
    const err = new Error('Tarefa já está concluída.'); err.status = 400; throw err;
  }

  if (assignment.assigned_to !== userId) {
    const err = new Error('Você só pode concluir tarefas atribuídas a você.'); err.status = 403; throw err;
  }

  db.prepare(`
    UPDATE task_assignments
    SET status = 'completed', completed_at = datetime('now'), completion_notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(completionNotes || null, assignmentId);

  return getAssignment(assignmentId, houseId);
}

function reportImpediment({ assignmentId, houseId, userId }) {
  const assignment = getAssignment(assignmentId, houseId);

  if (assignment.assigned_to !== userId) {
    const err = new Error('Você só pode reportar impedimento em tarefas atribuídas a você.'); err.status = 403; throw err;
  }

  if (assignment.status === 'completed') {
    const err = new Error('Tarefa já concluída.'); err.status = 400; throw err;
  }

  // Mark current assignment as redistributed
  db.prepare(`
    UPDATE task_assignments SET status = 'redistributed', updated_at = datetime('now') WHERE id = ?
  `).run(assignmentId);

  // RN04 + RN05: Find best available member (excluding current) who has capacity
  const members = db.prepare(`
    SELECT hm.user_id, hm.weight_percentage, hm.role
    FROM house_members hm
    WHERE hm.house_id = ? AND hm.user_id != ?
  `).all(houseId, userId);

  // Calculate current effort for remaining members in the same period
  const periodLabel = assignment.distribution_period;
  const eligibleMembers = members.filter(m => {
    const limitation = db.prepare(
      'SELECT has_physical_limitation FROM member_preferences WHERE house_id = ? AND user_id = ? AND task_id = ?'
    ).get(houseId, m.user_id, assignment.task_id);
    return !limitation || !limitation.has_physical_limitation;
  });

  if (eligibleMembers.length === 0) {
    const err = new Error('Nenhum membro elegível disponível para redistribuição.'); err.status = 400; throw err;
  }

  // Find member with lowest current load (simple heuristic — RN04 check)
  const house = db.prepare('SELECT tolerance_percentage FROM houses WHERE id = ?').get(houseId);
  let bestMember = eligibleMembers[0];
  let bestLoad = Infinity;

  eligibleMembers.forEach(m => {
    const load = db.prepare(`
      SELECT COUNT(*) as cnt FROM task_assignments WHERE house_id = ? AND assigned_to = ? AND distribution_period = ? AND status != 'redistributed'
    `).get(houseId, m.user_id, periodLabel).cnt;

    if (load < bestLoad) { bestLoad = load; bestMember = m; }
  });

  const newId = uuidv4();
  db.prepare(`
    INSERT INTO task_assignments (id, house_id, task_id, assigned_to, scheduled_date, status, group_id, sequence_order, distribution_period)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(newId, houseId, assignment.task_id, bestMember.user_id, assignment.scheduled_date, assignment.group_id, assignment.sequence_order, periodLabel);

  return getAssignment(newId, houseId);
}

module.exports = { getSchedule, getAssignment, reassignTask, completeTask, reportImpediment };
