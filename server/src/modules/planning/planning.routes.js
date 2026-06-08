const express = require('express');

const { authMiddleware } = require('../../middlewares/auth.middleware');
const { requireAnyPermission, requirePermission } = require('../../middlewares/rbac.middleware');
const controller = require('./planning.controller');

const router = express.Router();
const viewAccess = [authMiddleware, requireAnyPermission(['PlanningView', 'SearchReport'])];
const manageAccess = [authMiddleware, requirePermission('PlanningManage')];

router.get('/planning/plans', viewAccess, controller.getDashboard);
router.get('/planning/plans/:id', viewAccess, controller.getPlan);
router.post('/planning/plans', manageAccess, controller.postPlan);
router.put('/planning/plans/:id', manageAccess, controller.putPlan);
router.delete('/planning/plans/:id', manageAccess, controller.deletePlan);
router.post('/planning/plans/:id/tasks', manageAccess, controller.postTask);
router.put('/planning/tasks/:taskId', manageAccess, controller.putTask);
router.delete('/planning/tasks/:taskId', manageAccess, controller.deleteTask);

module.exports = {
  planningRoutes: router,
};
