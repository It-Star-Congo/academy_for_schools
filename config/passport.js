const LocalStrategy = require('passport-local').Strategy;
const bcrypt        = require('bcrypt');
const { User }      = require('../models');

module.exports = function configurePassport(passport) {

  passport.use(new LocalStrategy(
    async (username, password, done) => {
      try {
        const user = await User.findOne({ where: { username }});
        if (!user) return done(null, false, { message: 'Utilisateur inconnu' });

        const ok = await bcrypt.compare(password + process.env.PEPPER, user.password);
        if (!ok)  return done(null, false, { message: 'Mot de passe incorrect' });

        return done(null, user);
      } catch (err) { done(err); }
    }
  ));

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id, done) => {
    try { 
      const user = await User.findByPk(id);
      done(null, user);
    } catch (err) { done(err); }
  });
};
