const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

function getMembers(houseId) {
  return db.prepare(`
    SELECT hm.id, hm.user_id, u.name, u.email, hm.role,
           hm.weight_percentage, hm.weekly_availability_hours, hm.created_at
    FROM house_members hm
    JOIN users u ON hm.user_id = u.id
    WHERE hm.house_id = ?
    ORDER BY hm.created_at ASC
  `).all(houseId);
}

function inviteMember({ houseId, email, invitedBy }) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    const err = new Error('Usuário com este e-mail não encontrado. Peça para ele se cadastrar primeiro.');
    err.status = 404;
    throw err;
  }

  const existing = db.prepare(
    'SELECT id FROM house_members WHERE house_id = ? AND user_id = ?'
  ).get(houseId, user.id);

  if (existing) {
    const err = new Error('Usuário já é membro desta casa.');
    err.status = 409;
    throw err;
  }

  db.prepare(
    'INSERT INTO house_members (id, house_id, user_id, role) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), houseId, user.id, 'resident');

  return { user_id: user.id, name: user.name, email: user.email, role: 'resident' };
}

function updateRole({ houseId, targetUserId, role, requesterId }) {
  if (targetUserId === requesterId) {
    const err = new Error('Você não pode alterar seu próprio papel.');
    err.status = 400;
    throw err;
  }

  const validRoles = ['admin', 'catalog_manager', 'resident'];
  if (!validRoles.includes(role)) {
    const err = new Error(`Papel inválido. Valores aceitos: ${validRoles.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const member = db.prepare(
    'SELECT id FROM house_members WHERE house_id = ? AND user_id = ?'
  ).get(houseId, targetUserId);

  if (!member) {
    const err = new Error('Membro não encontrado nesta casa.');
    err.status = 404;
    throw err;
  }

  db.prepare(
    'UPDATE house_members SET role = ? WHERE house_id = ? AND user_id = ?'
  ).run(role, houseId, targetUserId);
}

function updateWeight({ houseId, targetUserId, weightPercentage }) {
  if (weightPercentage < 0 || weightPercentage > 100) {
    const err = new Error('Peso deve ser entre 0 e 100.');
    err.status = 400;
    throw err;
  }

  const member = db.prepare(
    'SELECT id FROM house_members WHERE house_id = ? AND user_id = ?'
  ).get(houseId, targetUserId);

  if (!member) {
    const err = new Error('Membro não encontrado nesta casa.');
    err.status = 404;
    throw err;
  }

  db.prepare(
    'UPDATE house_members SET weight_percentage = ? WHERE house_id = ? AND user_id = ?'
  ).run(weightPercentage, houseId, targetUserId);

  // RN02: validate total weights
  const totalWeight = db.prepare(
    'SELECT SUM(weight_percentage) as total FROM house_members WHERE house_id = ? AND weight_percentage IS NOT NULL'
  ).get(houseId).total || 0;

  return { total_weight: totalWeight, warning: totalWeight !== 100 ? `Pesos somam ${totalWeight}%. Ajuste os demais membros para totalizar 100%.` : null };
}

function updateAvailability({ houseId, targetUserId, weeklyAvailabilityHours }) {
  if (weeklyAvailabilityHours < 0) {
    const err = new Error('Disponibilidade não pode ser negativa.');
    err.status = 400;
    throw err;
  }

  db.prepare(
    'UPDATE house_members SET weekly_availability_hours = ? WHERE house_id = ? AND user_id = ?'
  ).run(weeklyAvailabilityHours, houseId, targetUserId);
}

function removeMember({ houseId, targetUserId, requesterId }) {
  if (targetUserId === requesterId) {
    const err = new Error('Você não pode remover a si mesmo. Use a opção de sair da casa.');
    err.status = 400;
    throw err;
  }

  const member = db.prepare(
    'SELECT * FROM house_members WHERE house_id = ? AND user_id = ?'
  ).get(houseId, targetUserId);

  if (!member) {
    const err = new Error('Membro não encontrado nesta casa.');
    err.status = 404;
    throw err;
  }

  if (member.role === 'admin') {
    const adminCount = db.prepare(
      "SELECT COUNT(*) as count FROM house_members WHERE house_id = ? AND role = 'admin'"
    ).get(houseId).count;
    if (adminCount <= 1) {
      const err = new Error('Não é possível remover o único administrador da casa.');
      err.status = 400;
      throw err;
    }
  }

  db.prepare('DELETE FROM house_members WHERE house_id = ? AND user_id = ?').run(houseId, targetUserId);
}

function getWeightsSummary(houseId) {
  const members = db.prepare(`
    SELECT hm.user_id, u.name, hm.weight_percentage, hm.role
    FROM house_members hm
    JOIN users u ON hm.user_id = u.id
    WHERE hm.house_id = ?
  `).all(houseId);

  const membersWithWeights = members.filter(m => m.weight_percentage !== null);
  const totalWeight = membersWithWeights.reduce((sum, m) => sum + m.weight_percentage, 0);
  const isValid = membersWithWeights.length === 0 || Math.abs(totalWeight - 100) < 0.01;

  return {
    members: members.map(m => ({
      ...m,
      effective_weight: m.weight_percentage !== null
        ? m.weight_percentage
        : (100 / members.length),
    })),
    total_defined_weight: totalWeight,
    using_equal_distribution: membersWithWeights.length === 0,
    is_valid: isValid,
  };
}

module.exports = {
  getMembers,
  inviteMember,
  updateRole,
  updateWeight,
  updateAvailability,
  removeMember,
  getWeightsSummary,
};
