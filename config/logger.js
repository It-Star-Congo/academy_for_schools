// config/logger.js
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const level = process.env.LOG_LEVEL || 'info';

// Helper pour filtrer par catégorie
const categoryFilter = (cat) => format((info) => {
  return info.meta && info.meta.category === cat ? info : false;
})();

// Format commun timestamp + json
const ts = format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });
const jsonFmt = format.json();

// Création du logger principal
const logger = createLogger({ level, exitOnError: false });

// Transport “authentification”
logger.add(new DailyRotateFile({
  dirname: 'logs/auth',
  filename: 'auth-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  format: format.combine(
    categoryFilter('auth'),
    ts,
    format.errors({ stack: true }),
    jsonFmt
  )
}));

// Transport “soumissions & création”
logger.add(new DailyRotateFile({
  dirname: 'logs/interaction',
  filename: 'interaction-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  format: format.combine(
    categoryFilter('interaction'),
    ts,
    format.errors({ stack: true }),
    jsonFmt
  )
}));

// Transport “profil”
logger.add(new DailyRotateFile({
  dirname: 'logs/profile',
  filename: 'profile-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  format: format.combine(
    categoryFilter('profile'),
    ts,
    format.errors({ stack: true }),
    jsonFmt
  )
}));

// Transport “général” (tout ce qui n’a pas de catégorie)
logger.add(new DailyRotateFile({
  dirname: 'logs/general',
  filename: 'general-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d',
  format: format.combine(
    // on ne garde que les logs sans meta.category
    format((info) => info.meta && info.meta.category ? false : info)(),
    ts,
    format.errors({ stack: true }),
    jsonFmt
  )
}));

// Console en dev (toutes catégories)
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(
      format.colorize(),
      format.printf(({ timestamp, level, message, meta }) =>
        `${timestamp} [${level}]${meta && meta.category ? ' ['+meta.category+']' : ''} ${message}`
      )
    )
  }));
}

// Helper pour logguer avec catégorie
logger.logWithCategory = (category, level, message) => {
  logger.log({ level, message, meta: { category } });
};

// Morgan HTTP → catégorie “general”
logger.stream = {
  write: (msg) => logger.logWithCategory('general', 'http', msg.trim())
};

module.exports = logger;
