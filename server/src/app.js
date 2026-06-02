const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { requestIdMiddleware } = require('./middlewares/request-id.middleware');
const { errorMiddleware } = require('./middlewares/error.middleware');
const { healthRoutes } = require('./modules/health/health.routes');
const { errorResponse } = require('./shared/response');
const { debugRoutes } = require('./modules/debug/debug.routes');
const { rolesRoutes } = require('./modules/roles/roles.routes');
const { authRoutes } = require('./modules/auth/auth.routes');
const { usersRoutes } = require('./modules/users/users.routes');
const { productsRoutes } = require('./modules/products/products.routes');
const { equipmentRoutes } = require('./modules/equipment/equipment.routes');
const { modelRequiredEquipmentRoutes } = require('./modules/model-required-equipment/model-required-equipment.routes');
const { testTemplatesRoutes } = require('./modules/test-templates/test-templates.routes');
const { pool } = require('./db/pool');



const {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessable,
} = require('./shared/http-error');

const app = express();

app.use(helmet());
app.use(cors());
app.use(requestIdMiddleware);
app.use(express.json());


app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', usersRoutes);
app.use('/api', rolesRoutes);
app.use('/api', productsRoutes);
app.use('/api', equipmentRoutes);
app.use('/api', modelRequiredEquipmentRoutes);
app.use('/api', testTemplatesRoutes);


if (process.env.NODE_ENV === 'development') {
  app.post('/api/debug/json', (req, res) => {
    return res.json({
      success: true,
      body: req.body,
    });
  });
}

if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/db/duplicate-role', async (req, res, next) => {
    try {
      await pool.query(`
        INSERT INTO app_role (role_code, role_name)
        VALUES ('ADMIN', 'Duplicate Admin')
      `);

      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  });
}

if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/errors/bad-request', (req, res, next) => {
    return next(
      badRequest('Debug bad request', [
        {
          field: 'test_field',
          message: 'This is a test bad request error',
        },
      ])
    );
  });

  if (process.env.NODE_ENV === 'development') {
  app.post('/api/debug/log-body', (req, res) => {
    console.info('[DEBUG][BODY]', {
      requestId: req.requestId,
      body: require('./shared/sanitize-log').sanitizeObject(req.body),
    });

    return res.json({
      success: true,
      message: 'Debug log body',
      data: null,
      meta: {
        request_id: req.requestId,
      },
    });
  });
}
  app.get('/api/debug/errors/unauthorized', (req, res, next) => {
    return next(unauthorized('Debug unauthorized'));
  });

  app.get('/api/debug/errors/forbidden', (req, res, next) => {
    return next(forbidden('Debug forbidden'));
  });

  app.get('/api/debug/errors/not-found', (req, res, next) => {
    return next(notFound('Debug resource not found'));
  });

  app.get('/api/debug/errors/conflict', (req, res, next) => {
    return next(conflict('Debug conflict'));
  });

  app.get('/api/debug/errors/business', (req, res, next) => {
    return next(
      unprocessable('Debug business validation failed', [
        {
          field: 'status',
          message: 'Current status does not allow this action',
        },
      ])
    );
  });

  app.get('/api/debug/errors/unexpected', (req, res, next) => {
    throw new Error('Debug unexpected error');
  });
}



if (process.env.NODE_ENV === 'development') {
  app.use('/api', debugRoutes);
}

app.use((req, res) => {
  return errorResponse(res, {
    statusCode: 404,
    message: 'Route not found',
    errorCode: 'ROUTE_NOT_FOUND',
  });
});

app.use(errorMiddleware);

module.exports = { app };
