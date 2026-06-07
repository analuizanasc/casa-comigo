const notificationsService = require('../services/notifications.service');

function getNotifications(req, res) {
  try {
    const items = notificationsService.getNotifications(req.user.id);
    return res.status(200).json(items);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function markAsRead(req, res) {
  try {
    notificationsService.markAsRead(req.params.id, req.user.id);
    return res.status(200).json({ message: 'Notificação marcada como lida.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function markAllAsRead(req, res) {
  try {
    notificationsService.markAllAsRead(req.user.id);
    return res.status(200).json({ message: 'Todas as notificações marcadas como lidas.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getMyInvitations(req, res) {
  try {
    const invitations = notificationsService.getMyInvitations(req.user.id);
    return res.status(200).json(invitations);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function acceptInvitation(req, res) {
  try {
    const result = notificationsService.acceptInvitation({ invitationId: req.params.id, userId: req.user.id });
    return res.status(200).json({ message: 'Convite aceito. Você entrou na casa.', ...result });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function rejectInvitation(req, res) {
  try {
    notificationsService.rejectInvitation({ invitationId: req.params.id, userId: req.user.id });
    return res.status(200).json({ message: 'Convite recusado.' });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function getOnboarding(req, res) {
  try {
    const result = notificationsService.getOnboarding(req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

function advanceOnboarding(req, res) {
  try {
    const result = notificationsService.advanceOnboarding(req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getMyInvitations,
  acceptInvitation,
  rejectInvitation,
  getOnboarding,
  advanceOnboarding,
};
