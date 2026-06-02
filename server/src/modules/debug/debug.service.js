const { withTransaction } = require('../../db/transaction');
const {
  insertDebugRole,
  deleteDebugRoleByCode,
  findRoleByCode,
} = require('./debug.repository');

async function testTransactionCommit(requestId) {
  return withTransaction(
    async (client) => {
      await deleteDebugRoleByCode(client, 'DEBUG_COMMIT_ROLE');

      const role = await insertDebugRole(
        client,
        'DEBUG_COMMIT_ROLE',
        'Debug Commit Role'
      );

      return role;
    },
    {
      requestId,
      name: 'debug_commit',
    }
  );
}

async function testTransactionRollback(requestId) {
  return withTransaction(
    async (client) => {
      await deleteDebugRoleByCode(client, 'DEBUG_ROLLBACK_ROLE');

      await insertDebugRole(
        client,
        'DEBUG_ROLLBACK_ROLE',
        'Debug Rollback Role'
      );

      // Force error after insert
      throw new Error('Force rollback test');
    },
    {
      requestId,
      name: 'debug_rollback',
    }
  );
}

async function getDebugRole(roleCode) {
  return withTransaction(
    async (client) => {
      return findRoleByCode(client, roleCode);
    },
    {
      name: 'debug_find_role',
    }
  );
}

module.exports = {
  testTransactionCommit,
  testTransactionRollback,
  getDebugRole,
};