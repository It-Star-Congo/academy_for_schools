const express = require('express');
const router = express.Router();
const { Course,  User, Exercise, Submission } = require('../models'); // Importation du modèle Course

// Middleware pour vérifier si l'utilisateur est authentifié
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login'); // Redirige vers la page de connexion si non connecté
}

// Route du tableau de bord
router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Cours simulés
        const simulatedCourses = [
        ];

        // Récupération des cours en base de données
        const dbCourses = await Course.findAll({ attributes: ['id', 'name', 'description', 'teacher', 'image'] });

        // Fusionner les cours simulés avec ceux de la DB
        const allCourses = [...simulatedCourses, ...dbCourses.map(course => course.toJSON())];

        res.render('dashboard', { user: req.session.user, courses: allCourses });
    } catch (error) {
        console.error("Erreur lors de la récupération des cours :", error);
        res.status(500).send("Erreur interne du serveur");
    }
});

router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        // Vérifie que req.session.user existe
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }

        // Simuler des cours avec progression (dans une vraie app, récupère depuis la BD)
        const userCourses = [
            { id: 1, name: 'Python', progress: 70, image: '/images/python.jpg' },
            { id: 2, name: 'Java', progress: 50, image: '/uploads/files/1741206020433.pdf' },
            { id: 3, name: 'C++', progress: 100, image: '/pictures/AcademyLogoTransparent-removebg-preview.png' },
            { id: 4, name: 'Arduino', progress: 45, image: '/images/javascript.jpg' },
            { id: 5, name: 'JavaScript', progress: 45, image: '/images/javascript.jpg' }
        ];

        // Assure-toi que req.session.user contient courses
        req.session.user.courses = userCourses;

        // Récupérer le solde de crédits de l'utilisateur
        const userCredits = req.session.user.credits || 0;

        res.render('profile', { 
            user: req.session.user, 
            credits: userCredits
        });
    } catch (error) {
        console.error("Erreur lors de l'affichage du profil :", error);
        res.status(500).send("Erreur interne du serveur");
    }
});

router.get('/profile/:studentId/show', isAuthenticated, async (req, res) => {
    try {
        // Vérifie que req.session.user existe
        if (!req.session.user || req.session.user.role === 'student') {
            return res.redirect('/teacher/login');
        }
        studentId = req.params.studentId;
        //const user = await User.findByPk(studentId);

        const user = await User.findByPk(studentId, {
      attributes: ['id', 'username', 'contact', 'firstname', 'name', 'birthdate', 'country', 'level', 'profile', 'cv', 'bio', 'abonnement', 'offers'],
      include: [{
        model: Course,
        as: 'enrolledCourses',
        attributes: ['id', 'name', 'description', 'teacher', 'image'],
        through: { attributes: [] },
        include: [{
          model: Exercise,
          as: 'exercises',
          attributes: ['id'],
          include: [{
            model: Submission,
            as: 'Submissions',
            where: { UserId : studentId },
            attributes: ['score'],
            required: false
          }]
        }]
      }]
    });

    // Calcule le pourcentage de progression pour chaque cours
    const coursesWithProgress = user.enrolledCourses.map(course => {
      const scores = [];
      try{
      course.Exercises.forEach(ex => {
        ex.Submissions.forEach(s => scores.push(s.score));
      });
      const total = scores.reduce((acc, v) => acc + v, 0);
      const count = scores.length;
      const progress = count ? Math.round(total / count) : 0;
      return { ...course.toJSON(), progress };
    } catch(e){
      return { ...course.toJSON(), e};
    }
    });

        /* Simuler des cours avec progression (dans une vraie app, récupère depuis la BD)
        const userCourses = [
            { id: 1, name: 'Python', progress: 70, image: '/images/python.jpg' },
            { id: 2, name: 'Java', progress: 50, image: '/uploads/files/1741206020433.pdf' },
            { id: 3, name: 'C++', progress: 100, image: '/pictures/AcademyLogoTransparent-removebg-preview.png' },
            { id: 4, name: 'Arduino', progress: 45, image: '/images/javascript.jpg' },
            { id: 5, name: 'JavaScript', progress: 45, image: '/images/javascript.jpg' }
        ];*/

        // Assure-toi que req.session.user contient courses
        //req.session.user.courses = coursesWithProgress; //userCourses;
        userCourses = coursesWithProgress;

        // Récupérer le solde de crédits de l'utilisateur
        const userCredits = req.session.user.credits || 0;

        res.render('profile2', { 
            sessionUser : req.session.user,
            user,
            userCourses, 
            credits: userCredits
        });
    } catch (error) {
        console.error("Erreur lors de l'affichage du profil :", error);
        res.status(500).send("Erreur interne du serveur");
    }
});


router.get('/profile3', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    // Récupère l'utilisateur et ses cours inscrits, les exercices et les submissions
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'contact', 'firstname', 'name', 'birthdate', 'country', 'level', 'profile', 'cv', 'bio', 'abonnement', 'offers'],
      include: [{
        model: Course,
        as: 'enrolledCourses',
        attributes: ['id', 'name', 'description', 'teacher', 'image'],
        through: { attributes: [] },
        include: [{
          model: Exercise,
          as: 'exercises',
          attributes: ['id'],
          include: [{
            model: Submission,
            where: { userId },
            attributes: ['score'],
            required: false
          }]
        }]
      }]
    });

    // Calcule le pourcentage de progression pour chaque cours
    const coursesWithProgress = (user.enrolledCourses || []).map(course => {
    // on prend la représentation "JSON" pour simplifier
    const data = course.toJSON();
    const exercises = data.exercises || [];      // <-- alias 'exercises'
    let total = 0, count = 0;

    exercises.forEach(ex => {
      // selon votre association, ce sera peut-être 'submissions' ou 'Submissions'
      const subs = ex.submissions || ex.Submissions || [];
      subs.forEach(s => {
        if (typeof s.score === 'number') {
          total += s.score;
          count++;
        }
      });
    });

    const progress = count > 0 ? Math.round(total / count) : 0;
    return { ...data, progress };
    });

    // Met à jour la session et rend la vue
    req.session.user.enrolledCourses = coursesWithProgress;
    res.render('profile', {
      user: { ...user.toJSON(), courses: coursesWithProgress },
      credits: req.session.user.credits || 0
    });
  } catch (error) {
    console.error('Erreur affichage profil :', error);
    res.status(500).send('Erreur interne');
  }
});

// Désinscription d'un cours
router.post('/profile/courses/:courseId/unsubscribe', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const courseId = req.params.courseId;
    const user = await User.findByPk(userId);
    await user.removeEnrolledCourses(courseId);
    res.redirect('/profile');
  } catch (err) {
    console.error('Désinscription échouée :', err);
    res.status(500).send('Erreur interne');
  }
});

// Formulaire de modification de profil
router.get('/edit-profile/:userId/student', isAuthenticated, async (req, res) => {
  const userId = req.params.userId;
  const user = await User.findByPk(userId, {
    include: [{ model: Course, as: 'enrolledCourses', through: { attributes: [] } }]
  });
  res.render('edit-profile', { user, courses: user.enrolledCourses });
});

// Prise en compte des modifications de profil et de cours
router.post('/edit-profile', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { firstname, name, contact, birthdate, country, level, bio, abonnement } = req.body;
    const user = await User.findByPk(userId);

    // Mise à jour des champs
    await user.update({ firstname, name, contact, birthdate, country, level, bio, abonnement });

    // Gestion des cours conservés (checkboxes)
    const keepCourseIds = Array.isArray(req.body.courses)
      ? req.body.courses.map(id => parseInt(id))
      : [];
    await user.setEnrolledCourses(keepCourseIds);

    res.redirect('/dash/profile');
  } catch (error) {
    console.error('Échec mise à jour profil :', error);
    res.status(500).send('Erreur interne');
  }
});

// Formulaire de modification de profil
router.get('/privacy', (req, res) => {
  res.render('privacy', {lastUpdated : '24/06/2025', siteName : 'IT Star Africa', contactEmail: 'it-star-congo@gmail.com'});
});


// Route de déconnexion
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/auth/login'); // Redirige vers la page de connexion après déconnexion
    });
});

module.exports = router;
