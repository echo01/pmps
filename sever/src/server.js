const { app } = require('./app');
const { env } = require('./config/env');

const server = app.listen(env.port, () => {
  console.info('[APP][START]', {
    port: env.port,
    env: env.nodeEnv,
  });
});

process.on('SIGINT', () => {
  console.info('[APP][SHUTDOWN]', {
    signal: 'SIGINT',
  });

  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.info('[APP][SHUTDOWN]', {
    signal: 'SIGTERM',
  });

  server.close(() => {
    process.exit(0);
  });
});