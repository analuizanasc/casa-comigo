const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

function createNotification({ userId, type, title, body, data }) {
  const id = uuidv4();
  db.prepare(
    'INSERT INTO notifications (id, user_id, type, title, body, data) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, userId, type, title, body, data ? JSON.stringify(data) : null);
  return id;
}

function getNotifications(userId) {
  const rows = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
  ).all(userId);
  return rows.map(r => ({ ...r, data: r.data ? JSON.parse(r.data) : null, is_read: !!r.is_read }));
}

function markAsRead(notificationId, userId) {
  const result = db.prepare(
    "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?"
  ).run(notificationId, userId);
  if (result.changes === 0) {
    const err = new Error('Notificação não encontrada.'); err.status = 404; throw err;
  }
}

function markAllAsRead(userId) {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(userId);
}

// ── Invitations ──────────────────────────────────────────────────────────────

function getMyInvitations(userId) {
  return db.prepare(`
    SELECT i.id, i.house_id, h.name as house_name, u.name as invited_by_name, i.status, i.created_at
    FROM invitations i
    JOIN houses h ON i.house_id = h.id
    JOIN users u ON i.invited_by = u.id
    WHERE i.invited_user_id = ? AND i.status = 'pending'
    ORDER BY i.created_at DESC
  `).all(userId);
}

function acceptInvitation({ invitationId, userId }) {
  const inv = db.prepare(
    "SELECT * FROM invitations WHERE id = ? AND invited_user_id = ? AND status = 'pending'"
  ).get(invitationId, userId);

  if (!inv) {
    const err = new Error('Convite não encontrado ou já processado.'); err.status = 404; throw err;
  }

  const existing = db.prepare(
    'SELECT id FROM house_members WHERE house_id = ? AND user_id = ?'
  ).get(inv.house_id, userId);

  if (existing) {
    db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(invitationId);
    const err = new Error('Você já é membro desta casa.'); err.status = 409; throw err;
  }

  const acceptTx = db.transaction(() => {
    db.prepare(
      'INSERT INTO house_members (id, house_id, user_id, role) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), inv.house_id, userId, 'resident');
    db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(invitationId);
  });
  acceptTx();

  const house = db.prepare('SELECT name FROM houses WHERE id = ?').get(inv.house_id);
  return { house_id: inv.house_id, house_name: house.name, role: 'resident' };
}

function rejectInvitation({ invitationId, userId }) {
  const result = db.prepare(
    "UPDATE invitations SET status = 'rejected' WHERE id = ? AND invited_user_id = ? AND status = 'pending'"
  ).run(invitationId, userId);

  if (result.changes === 0) {
    const err = new Error('Convite não encontrado ou já processado.'); err.status = 404; throw err;
  }
}

// ── Onboarding ───────────────────────────────────────────────────────────────

const ONBOARDING_TOTAL_STEPS = 4;

function getOnboarding(userId) {
  const user = db.prepare('SELECT onboarding_step FROM users WHERE id = ?').get(userId);
  return {
    current_step: user.onboarding_step,
    total_steps: ONBOARDING_TOTAL_STEPS,
    completed: user.onboarding_step >= ONBOARDING_TOTAL_STEPS,
  };
}

function advanceOnboarding(userId) {
  const user = db.prepare('SELECT onboarding_step FROM users WHERE id = ?').get(userId);
  if (user.onboarding_step >= ONBOARDING_TOTAL_STEPS) {
    return { current_step: user.onboarding_step, total_steps: ONBOARDING_TOTAL_STEPS, completed: true };
  }
  const next = user.onboarding_step + 1;
  db.prepare('UPDATE users SET onboarding_step = ? WHERE id = ?').run(next, userId);
  return { current_step: next, total_steps: ONBOARDING_TOTAL_STEPS, completed: next >= ONBOARDING_TOTAL_STEPS };
}

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getMyInvitations,
  acceptInvitation,
  rejectInvitation,
  getOnboarding,
  advanceOnboarding,
};
