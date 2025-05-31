const express = require('express');
const router = express.Router();
const { Course } = require('../models'); // Importation du modèle Course

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
            { id: 1, name: 'python' },
            { id: 2, name: 'Course 2' }
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



// Route de déconnexion
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/auth/login'); // Redirige vers la page de connexion après déconnexion
    });
});

module.exports = router;
