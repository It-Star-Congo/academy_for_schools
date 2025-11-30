// middleware/themeLoader.js
const { School } = require('../models');

async function themeLoader(req, res, next) {

  let school;

  if (req.session.user && req.session.user.schoolId) {
    // Utilisateur connecté
    school = await School.findByPk(req.session.user.schoolId);
    if (!school) {
      console.warn(`Aucune école trouvée pour cet ID : ${req.session.user.schoolId}`);
    }
  } else {
    // Utilisateur non-connecté : on détermine l’école via sous-domaine
    const sub = req.hostname.split('.')[0];
    //school = await School.findOne({ where: { slug: sub } });
  }

  // Préparation du thème (fallback si pas d’école)
  res.locals.theme = school
    ? {
        primaryColor:   school.primaryColor,
        secondaryColor: school.secondaryColor,
        fontFamily:     school.fontFamily,
        title:          school.name,
        logo:           school.logo,
        abonnement:     school.abonnement
      }
    : {
        primaryColor:   '#ff6600',
        secondaryColor: '#ffc600',
        fontFamily:     'sans-serif',
        title:          'Academy',
        logo:           '/pictures/AcademyLogoTransparent.png',
        abonnement:     'Academic'
      };

  if (!school || school.id === 1 ){
    res.locals.theme = {
        primaryColor:   '#ff6600',
        secondaryColor: '#ffc600',
        fontFamily:     'sans-serif',
        title:          'Academy',
        logo:           '/pictures/AcademyLogoTransparent.png',
        abonnement:     'Academic'
      };
  }



  next();
}

module.exports = themeLoader;
