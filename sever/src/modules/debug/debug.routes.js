const express = require('express');

const {
  debugTransactionCommit,
  debugTransactionRollback,
  debugFindRole,
} = require('./debug.controller');

const router = express.Router();

router.post('/debug/transaction/commit', debugTransactionCommit);
router.post('/debug/transaction/rollback', debugTransactionRollback);
router.get('/debug/roles/:roleCode', debugFindRole);

module.exports = { debugRoutes: router };