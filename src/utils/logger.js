import { config } from '../config/env.js';

const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const threshold = levels[config.logLevel] ?? levels.info;

const format = (level, message, meta) => {
  const stamp = new Date().toISOString();
  const detail = meta ? ` ${meta instanceof Error ? meta.stack : JSON.stringify(meta)}` : '';
  return `${stamp} [${level.toUpperCase()}] ${message}${detail}`;
};

const emit = (level) => (message, meta) => {
  if (levels[level] < threshold) return;
  const line = format(level, message, meta);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

export const logger = {
  debug: emit('debug'),
  info: emit('info'),
  warn: emit('warn'),
  error: emit('error'),
};
