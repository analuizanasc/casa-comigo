const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { createNotification } = require('./notifications.service');

function getSchedule({ houseId, userId, role, dateFrom, dateTo, assignedTo }) {
  let query = `
    SELECT
      ta.id, ta.task_id, t.name as task_name, t.frequency, t.duration_minutes,
      t.effort_level, t.room, ta.assigned_to, u.name as assigned_to_name,
      ta.scheduled_date, ta.status, ta.completed_at, ta.completion_notes,
      ta.group_id, ta.sequence_order, ta.completed_by
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

// Verifica se uma atribuição faz parte de um grupo com dependências
function getGroupSiblings(assignmentId, groupId, houseId) {
  if (!groupId) return [];
  return db.prepare(`
    SELECT id, task_id, assigned_to FROM task_assignments
    WHERE group_id = ? AND house_id = ? AND id != ? AND status = 'pending'
  `).all(groupId, houseId, assignmentId);
}

function reassignTask({ assignmentId, houseId, newUserId, force, moveGroup }) {
  const assignment = getAssignment(assignmentId, houseId);

  if (assignment.status === 'completed') {
    const err = new Error('Tarefa já concluída não pode ser reatribuída.'); err.status = 400; throw err;
  }

  const member = db.prepare('SELECT id FROM house_members WHERE house_id = ? AND user_id = ?').get(houseId, newUserId);
  if (!member) {
    const err = new Error('Usuário não é membro desta casa.'); err.status = 400; throw err;
  }

  // Verifica grupo com dependências — drag and drop single task
  const siblings = getGroupSiblings(assignmentId, assignment.group_id, houseId);
  if (siblings.length > 0 && !force) {
    return {
      requires_confirmation: true,
      warning: 'Esta tarefa faz parte de um grupo com dependências. Deseja mover apenas esta tarefa ou todo o grupo?',
      group_id: assignment.group_id,
      group_task_count: siblings.length + 1,
      options: { move_single: 'Mover apenas esta tarefa', move_group: 'Mover todo o grupo' },
    };
  }

  // RN03: verifica limitação física — avisa mas não bloqueia
  const pref = db.prepare(
    'SELECT has_physical_limitation FROM member_preferences WHERE house_id = ? AND user_id = ? AND task_id = ?'
  ).get(houseId, newUserId, assignment.task_id);

  const physicalLimitationWarning = pref && pref.has_physical_limitation
    ? 'Atenção: este membro possui limitação física registrada para esta tarefa. A reatribuição foi realizada mesmo assim.'
    : null;

  if (moveGroup && siblings.length > 0) {
    // Move todo o grupo para o novo responsável
    const groupIds = [assignmentId, ...siblings.map(s => s.id)];
    const updateGroup = db.transaction(() => {
      groupIds.forEach(id => {
        db.prepare(`UPDATE task_assignments SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?`).run(newUserId, id);
      });
    });
    updateGroup();
  } else {
    db.prepare(`
      UPDATE task_assignments SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newUserId, assignmentId);
  }

  const result = getAssignment(assignmentId, houseId);
  if (physicalLimitationWarning) result.warning = physicalLimitationWarning;
  return result;
}

// Qualquer membro da casa pode concluir uma tarefa (não só o atribuído)
function completeTask({ assignmentId, houseId, userId, completionNotes }) {
  const assignment = getAssignment(assignmentId, houseId);

  if (assignment.status === 'completed') {
    const err = new Error('Tarefa já está concluída.'); err.status = 400; throw err;
  }

  // Verifica se o userId é membro da casa
  const member = db.prepare('SELECT id FROM house_members WHERE house_id = ? AND user_id = ?').get(houseId, userId);
  if (!member) {
    const err = new Error('Usuário não é membro desta casa.'); err.status = 403; throw err;
  }

  db.prepare(`
    UPDATE task_assignments
    SET status = 'completed', completed_at = datetime('now'), completion_notes = ?,
        completed_by = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(completionNotes || null, userId, assignmentId);

  // Notifica o responsável original se foi outro membro que concluiu
  if (assignment.assigned_to !== userId) {
    createNotification({
      userId: assignment.assigned_to,
      type: 'task_completed_by_other',
      title: 'Tarefa concluída por outro morador',
      body: `A tarefa "${assignment.task_name}" foi concluída por outro morador em seu nome.`,
      data: { assignment_id: assignmentId, house_id: houseId },
    });
  }

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

  db.prepare(`
    UPDATE task_assignments SET status = 'redistributed', updated_at = datetime('now') WHERE id = ?
  `).run(assignmentId);

  const members = db.prepare(`
    SELECT hm.user_id, hm.weight_percentage, hm.role
    FROM house_members hm
    WHERE hm.house_id = ? AND hm.user_id != ?
  `).all(houseId, userId);

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

  // Calcula carga atual de cada membro elegível
  const totalTasks = db.prepare(`
    SELECT COUNT(*) as cnt FROM task_assignments
    WHERE house_id = ? AND distribution_period = ? AND status != 'redistributed'
  `).get(houseId, periodLabel).cnt;

  const allMembersOfHouse = db.prepare('SELECT user_id, weight_percentage FROM house_members WHERE house_id = ?').all(houseId);
  const usingEqual = !allMembersOfHouse.some(m => m.weight_percentage !== null);
  const equalShare = 100 / allMembersOfHouse.length;

  let bestMember = eligibleMembers[0];
  let bestLoad = Infinity;

  eligibleMembers.forEach(m => {
    const load = db.prepare(`
      SELECT COUNT(*) as cnt FROM task_assignments
      WHERE house_id = ? AND assigned_to = ? AND distribution_period = ? AND status != 'redistributed'
    `).get(houseId, m.user_id, periodLabel).cnt;

    if (load < bestLoad) { bestLoad = load; bestMember = m; }
  });

  // Verifica se todos estão no limite de carga
  const allAtLimit = eligibleMembers.every(m => {
    const load = db.prepare(`
      SELECT COUNT(*) as cnt FROM task_assignments
      WHERE house_id = ? AND assigned_to = ? AND distribution_period = ? AND status != 'redistributed'
    `).get(houseId, m.user_id, periodLabel).cnt;
    const memberShare = usingEqual ? equalShare : (m.weight_percentage || equalShare);
    const targetCount = totalTasks * (memberShare / 100);
    return load >= targetCount;
  });

  const newId = uuidv4();
  db.prepare(`
    INSERT INTO task_assignments (id, house_id, task_id, assigned_to, scheduled_date, status, group_id, sequence_order, distribution_period)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(newId, houseId, assignment.task_id, bestMember.user_id, assignment.scheduled_date, assignment.group_id, assignment.sequence_order, periodLabel);

  // RN: notifica o novo responsável e, se todos no limite, notifica admins
  createNotification({
    userId: bestMember.user_id,
    type: 'task_redistributed',
    title: 'Tarefa redistribuída para você',
    body: `A tarefa "${assignment.task_name}" foi redistribuída e agora está no seu quadro.`,
    data: { assignment_id: newId, house_id: houseId },
  });

  if (allAtLimit) {
    const admins = db.prepare(
      "SELECT user_id FROM house_members WHERE house_id = ? AND role = 'admin'"
    ).all(houseId);
    admins.forEach(({ user_id }) => {
      createNotification({
        userId: user_id,
        type: 'overload_warning',
        title: 'Atenção: todos os moradores no limite de carga',
        body: `A tarefa "${assignment.task_name}" foi redistribuída, mas todos os moradores estão no limite de carga. Considere revisar a distribuição do período.`,
        data: { house_id: houseId, period: periodLabel },
      });
    });
  }

  return getAssignment(newId, houseId);
}

module.exports = { getSchedule, getAssignment, reassignTask, completeTask, reportImpediment };
