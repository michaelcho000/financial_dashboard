import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const payload = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}] ${message}${payload}`;
});

const transports = [
  new DailyRotateFile({
    dirname: 'logs',
    filename: 'server-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxFiles: '14d',
    level: 'info',
  }),
  new winston.transports.Console({
    level: 'info',
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }),
];

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), logFormat),
  transports,
});
