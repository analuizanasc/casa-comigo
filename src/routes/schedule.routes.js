const express = require('express');
const router = express.Router({ mergeParams: true });
const scheduleController = require('../controllers/schedule.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireHouseMember, requireAdmin } = require('../middleware/roles.middleware');

router.use(authenticate, requireHouseMember);

router.post('/distribute', requireAdmin, scheduleController.distribute);
router.get('/', scheduleController.getSchedule);
router.get('/:assignmentId', scheduleController.getAssignment);
router.put('/:assignmentId/reassign', requireAdmin, scheduleController.reassignTask);
router.patch('/:assignmentId/complete', scheduleController.completeTask);
router.patch('/:assignmentId/impediment', scheduleController.reportImpediment);

module.exports = router;
