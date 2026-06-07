const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

// Notifications
router.get('/notifications', notificationsController.getNotifications);
router.patch('/notifications/read-all', notificationsController.markAllAsRead);
router.patch('/notifications/:id/read', notificationsController.markAsRead);

// Invitations
router.get('/invitations', notificationsController.getMyInvitations);
router.post('/invitations/:id/accept', notificationsController.acceptInvitation);
router.post('/invitations/:id/reject', notificationsController.rejectInvitation);

// Onboarding
router.get('/me/onboarding', notificationsController.getOnboarding);
router.patch('/me/onboarding', notificationsController.advanceOnboarding);

module.exports = router;
