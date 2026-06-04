type LogPayload = Record<string, unknown>;

function sanitize(payload?: LogPayload) {
  if (!payload) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !/password|token|cookie|secret|api[_-]?key/i.test(key))
  );
}

export const logger = {
  info(scope: string, payload?: LogPayload) {
    console.info(scope, sanitize(payload));
  },
  warn(scope: string, payload?: LogPayload) {
    console.warn(scope, sanitize(payload));
  },
  error(scope: string, payload?: LogPayload) {
    console.error(scope, sanitize(payload));
  },
};
