const express = require('express');
const router = express.Router({ mergeParams: true });
const catalogController = require('../controllers/catalog.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireHouseMember, requireAdminOrCatalogManager } = require('../middleware/roles.middleware');

router.use(authenticate, requireHouseMember);

router.get('/', catalogController.listTasks);
router.get('/:taskId', catalogController.getTask);
router.post('/', requireAdminOrCatalogManager, catalogController.createTask);
router.put('/:taskId', requireAdminOrCatalogManager, catalogController.updateTask);
router.delete('/:taskId', requireAdminOrCatalogManager, catalogController.deleteTask);
router.post('/:taskId/dependencies', requireAdminOrCatalogManager, catalogController.addDependency);
router.delete('/:taskId/dependencies/:dependsOnId', requireAdminOrCatalogManager, catalogController.removeDependency);

module.exports = router;
