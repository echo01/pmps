const {
  testTransactionCommit,
  testTransactionRollback,
  getDebugRole,
} = require('./debug.service');

const { successResponse } = require('../../shared/response');

async function debugTransactionCommit(req, res, next) {
  try {
    const role = await testTransactionCommit(req.requestId);

    return successResponse(res, {
      message: 'Transaction commit test completed',
      data: role,
    });
  } catch (error) {
    return next(error);
  }
}

async function debugTransactionRollback(req, res, next) {
  try {
    const result = await testTransactionRollback(req.requestId);

    return successResponse(res, {
      message: 'Transaction rollback test completed',
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function debugFindRole(req, res, next) {
  try {
    const roleCode = req.params.roleCode;

    const role = await getDebugRole(roleCode);

    return successResponse(res, {
      message: 'Role lookup completed',
      data: role,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  debugTransactionCommit,
  debugTransactionRollback,
  debugFindRole,
};