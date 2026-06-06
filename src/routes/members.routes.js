const express = require('express');
const router = express.Router({ mergeParams: true });
const membersController = require('../controllers/members.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireHouseMember, requireAdmin } = require('../middleware/roles.middleware');

router.use(authenticate, requireHouseMember);

router.get('/', membersController.getMembers);
router.post('/invite', requireAdmin, membersController.inviteMember);
router.get('/weights', requireAdmin, membersController.getWeightsSummary);
router.put('/:userId/role', requireAdmin, membersController.updateRole);
router.put('/:userId/weight', requireAdmin, membersController.updateWeight);
router.put('/:userId/availability', membersController.updateAvailability);
router.delete('/:userId', requireAdmin, membersController.removeMember);

module.exports = router;
