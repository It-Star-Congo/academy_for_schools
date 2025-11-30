// config/schoolLogger.js
const { createLogger, format } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const loggers = {}; // cache par schoolId

function getSchoolLogger(schoolId = 'public') {
  if (loggers[schoolId]) return loggers[schoolId];

  const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.json()
    ),
    transports: [
      new DailyRotateFile({
        dirname: `logs/school-${schoolId}`,
        filename: 'general-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d'
      }),
      new DailyRotateFile({
        dirname: `logs/school-${schoolId}`,
        filename: 'auth-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d'
      }),
      new DailyRotateFile({
        dirname: `logs/school-${schoolId}`,
        filename: 'profile-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d'
      }),
      new DailyRotateFile({
        dirname: `logs/school-${schoolId}`,
        filename: 'interaction-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d'
      })
    ]
  });

  loggers[schoolId] = logger;
  return logger;
}

module.exports = getSchoolLogger;
