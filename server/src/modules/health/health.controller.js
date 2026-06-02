const { checkHealth } = require('./health.service');
const { successResponse } = require('../../shared/response');

async function getHealth(req, res, next) {
  const requestId = req.requestId;

  try {
    console.info('[HEALTH][CHECK][START]', {
      requestId,
    });

    const health = await checkHealth();

    console.info('[HEALTH][CHECK][SUCCESS]', {
      requestId,
      db: health.db,
      responseTimeMs: health.response_time_ms,
    });

    return successResponse(res, {
      message: 'Service is healthy',
      data: health,
    });
  } catch (error) {
    console.error('[HEALTH][CHECK][ERROR]', {
      requestId,
      message: error.message,
    });

    return next(error);
  }
}

module.exports = { getHealth };