// middleware/requestLogger.js
const morgan = require('morgan');
const logger = require('../config/logger');
const getSchoolLogger = require('../config/schoolLogger');

// 1) Token IP
morgan.token('client-ip', req => req.ip);

// 2) Format JSON enrichi
const jsonFormat = (tokens, req, res) => JSON.stringify({
  timestamp: tokens.date(req, res, 'iso'),
  ip:        tokens['client-ip'](req, res),
  method:    tokens.method(req, res),
  url:       tokens.url(req, res),
  status:    tokens.status(req, res),
  duration:  tokens['response-time'](req, res) + ' ms',
  schoolId: req.session?.user?.schoolId || 'public'
});

// 3) Export du middleware Morgan
module.exports = morgan(jsonFormat, {
  stream: {
    write: message => {
      let entry;

      // 4) Parse sécurisé du JSON
      try {
        entry = JSON.parse(message);
      } catch (err) {
        return logger.stream.write(message);
      }

      // ✅ 5) Création DYNAMIQUE du logger par école
      const schoolLogger = getSchoolLogger(entry.schoolId);

      // ✅ 6) Log dans le bon dossier d’école
      schoolLogger.log({
        level: 'http',
        message: `${entry.method} ${entry.url} → ${entry.status}`,
        meta: {
          category: 'general',
          schoolId: entry.schoolId,
          ip: entry.ip,
          method: entry.method,
          url: entry.url,
          status: entry.status,
          duration: entry.duration,
          timestamp: entry.timestamp
        }
      });
    }
  }
});
