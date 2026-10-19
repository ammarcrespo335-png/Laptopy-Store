const stamp = () => new Date().toISOString();

/** Minimal structured console logger (swap for pino/winston if you need more). */
export const logger = {
  info: (...a) => console.log(stamp(), 'INFO ', ...a),
  warn: (...a) => console.warn(stamp(), 'WARN ', ...a),
  error: (...a) => console.error(stamp(), 'ERROR', ...a),
};
