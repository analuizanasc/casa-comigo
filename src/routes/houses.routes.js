const express = require('express');
const router = express.Router();
const housesController = require('../controllers/houses.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireHouseMember, requireAdmin } = require('../middleware/roles.middleware');

router.use(authenticate);

router.post('/', housesController.createHouse);
router.get('/me', housesController.getMyHouses);
router.post('/join', housesController.joinHouse);
router.get('/:houseId', requireHouseMember, housesController.getHouse);
router.patch('/:houseId/tolerance', requireHouseMember, requireAdmin, housesController.updateTolerance);

module.exports = router;
