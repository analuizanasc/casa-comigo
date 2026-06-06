const express = require('express');
const router = express.Router({ mergeParams: true });
const preferencesController = require('../controllers/preferences.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireHouseMember, requireAdmin } = require('../middleware/roles.middleware');

router.use(authenticate, requireHouseMember);

router.get('/', preferencesController.getMyPreferences);
router.put('/:taskId', preferencesController.upsertPreference);

// Admin can see any member's preferences
router.get('/member/:userId', requireAdmin, preferencesController.getMemberPreferences);

module.exports = router;
