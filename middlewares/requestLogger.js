// middleware/requestLogger.js
const morgan = require('morgan');
const logger = require('../config/logger');

// 1) On déclare un token pour l’IP si nécessaire
morgan.token('client-ip', req => req.ip);

// 2) Format JSON avec tout ce qu’il nous faut
const jsonFormat = (tokens, req, res) => JSON.stringify({
  timestamp: tokens.date(req, res, 'iso'),
  ip:        tokens['client-ip'](req, res),
  method:    tokens.method(req, res),
  url:       tokens.url(req, res),
  status:    tokens.status(req, res),
  duration:  tokens['response-time'](req, res) + ' ms'
});

// 3) On exporte Morgan configuré pour produire du JSON
module.exports = morgan(jsonFormat, {
  stream: {
    write: message => {
      // 4) On parse le JSON produit par Morgan
      let entry;
      try {
        entry = JSON.parse(message);
      } catch (err) {
        // si ça casse, on retombe sur ton flux standard
        return logger.stream.write(message);
      }
      // 5) On logge avec Winston en injectant tous les champs dans meta
      logger.log({
        level: 'http',
        message: `${entry.method} ${entry.url} → ${entry.status}`,
        meta: {
          category: 'general',
          ip:        entry.ip,
          method:    entry.method,
          url:       entry.url,
          status:    entry.status,
          duration:  entry.duration,
          timestamp: entry.timestamp
        }
      });
    }
  }
});
