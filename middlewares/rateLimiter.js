const rateLimit = require('express-rate-limit');
module.exports = rateLimit({
  windowMs: 60 * 1000,
  max     : 5,
  message : 'Trop de tentatives, réessayez plus tard.'
});
