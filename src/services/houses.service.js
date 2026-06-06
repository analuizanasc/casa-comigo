const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createHouse({ name, userId }) {
  let inviteCode;
  do {
    inviteCode = generateInviteCode();
  } while (db.prepare('SELECT id FROM houses WHERE invite_code = ?').get(inviteCode));

  const houseId = uuidv4();
  const memberId = uuidv4();

  const createHouseAndAdmin = db.transaction(() => {
    db.prepare(
      'INSERT INTO houses (id, name, invite_code, created_by) VALUES (?, ?, ?, ?)'
    ).run(houseId, name, inviteCode, userId);

    db.prepare(
      'INSERT INTO house_members (id, house_id, user_id, role) VALUES (?, ?, ?, ?)'
    ).run(memberId, houseId, userId, 'admin');
  });

  createHouseAndAdmin();

  return getHouseById(houseId, userId);
}

function getHouseById(houseId, userId) {
  const house = db.prepare('SELECT * FROM houses WHERE id = ?').get(houseId);
  if (!house) return null;

  const member = db.prepare(
    'SELECT role FROM house_members WHERE house_id = ? AND user_id = ?'
  ).get(houseId, userId);

  return {
    id: house.id,
    name: house.name,
    invite_code: member?.role === 'admin' ? house.invite_code : undefined,
    tolerance_percentage: house.tolerance_percentage,
    created_at: house.created_at,
  };
}

function getMyHouses(userId) {
  return db.prepare(`
    SELECT h.id, h.name, h.created_at, hm.role
    FROM houses h
    JOIN house_members hm ON h.id = hm.house_id
    WHERE hm.user_id = ?
    ORDER BY h.created_at DESC
  `).all(userId);
}

function joinByInviteCode({ inviteCode, userId }) {
  const house = db.prepare('SELECT * FROM houses WHERE invite_code = ?').get(inviteCode);
  if (!house) {
    const err = new Error('Código de convite inválido.');
    err.status = 404;
    throw err;
  }

  const existing = db.prepare(
    'SELECT id FROM house_members WHERE house_id = ? AND user_id = ?'
  ).get(house.id, userId);

  if (existing) {
    const err = new Error('Você já é membro desta casa.');
    err.status = 409;
    throw err;
  }

  db.prepare(
    'INSERT INTO house_members (id, house_id, user_id, role) VALUES (?, ?, ?, ?)'
  ).run(uuidv4(), house.id, userId, 'resident');

  return getHouseById(house.id, userId);
}

function updateTolerance(houseId, tolerancePercentage) {
  if (tolerancePercentage < 1 || tolerancePercentage > 50) {
    const err = new Error('Tolerância deve ser entre 1 e 50 pontos percentuais.');
    err.status = 400;
    throw err;
  }
  db.prepare('UPDATE houses SET tolerance_percentage = ? WHERE id = ?')
    .run(tolerancePercentage, houseId);
}

module.exports = { createHouse, getHouseById, getMyHouses, joinByInviteCode, updateTolerance };
