const express = require('express');
const router = express.Router({ mergeParams: true });
const reportsController = require('../controllers/reports.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireHouseMember, requireAdmin } = require('../middleware/roles.middleware');

router.use(authenticate, requireHouseMember);

router.get('/performance', requireAdmin, reportsController.getPerformanceReport);
router.get('/balance', requireAdmin, reportsController.getBalancePanel);

module.exports = router;
