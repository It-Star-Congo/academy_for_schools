// middleware/isAdmin.js
module.exports = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', { message: 'Accès réservé aux administrateurs' });
  }
  next();
};
