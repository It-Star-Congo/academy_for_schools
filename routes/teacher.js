const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
//const bcrypt = require('bcrypt');


const multer = require('multer');
const { User, Course } = require('../models'); // Assure-toi d'importer tes modèles correctement

const createFolderIfNotExists = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

createFolderIfNotExists(path.join(__dirname, '..', 'public', 'pr', 'profiles'));
createFolderIfNotExists(path.join(__dirname, '..', 'public', 'pr', 'cvs'));



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest;
    if (file.fieldname === 'profile') {
      dest = path.join(__dirname, '..', 'public', 'pr', 'profiles');
    } else if (file.fieldname === 'cv') {
      dest = path.join(__dirname, '..', 'public', 'pr', 'cvs');
    } else {
      return cb(new Error('Champ de fichier inattendu'), null);
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

  



// GET - Tableau de bord professeur
router.get('/dash', async (req, res) => {
  try {

    const username = req.session.user.username;

    console.log(username);

    const teacher = await User.findOne({ where: { username } });

    console.log(teacher.role);
    if (teacher && teacher.role === "teacher") {
      const courses = await Course.findAll({ where: { teacher: username },
                                             include: { model: User, as: 'students' }  });

      const lastWithdrawal = teacher.withdrawals?.[0] || { amount: 0, date: "N/A" };
      const revenue = teacher.revenue || [];

      const revenueLabels = [];
      const revenueData = [];

      for (let i = 0; i < revenue.length; i++) {
        revenueLabels.push(revenue[i].date);
        revenueData.push(revenue[i].amount);
      }

      res.render('teacherDash', {
        courses,
        lastWithdrawalAmount: lastWithdrawal.amount,
        lastWithdrawalDate: lastWithdrawal.date,
        revenueLabels,
        revenueData
      });
    } else {
      res.status(403).send("Accès refusé");
    }
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des données du professeur: ' + error });
  }
});

router.get('/login',(req, res) => {
        res.render('loginTeacher');
});

router.get('/register',(req, res) => {
    res.render('registerTeacher');
});

// Connexion du professeur
router.post('/login', async (req, res) => { 
  try {
    // Récupération des données du formulaire
    const { username, password } = req.body;

    // Chercher l'utilisateur dans la base de données par email
    const user = await User.findOne({ where: { username } });

    // Si l'utilisateur n'existe pas
    if (!user) {
      return res.status(400).json({ error: 'Professeur non trouvé' });
    }

    if (user.role !== "teacher"){
      return res.status(400).json({error: 'Pas un professeur'})
    }

    // Comparer le mot de passe envoyé avec celui dans la base de données (en texte clair)
    if (user.password !== password) {
      return res.status(400).json({ error: 'Mot de passe incorrect' });
    }

    // Si le mot de passe est correct, on crée une session pour l'utilisateur
    req.session.user = { 
      id: user.id, 
      username: user.username, 
      profile: user.profile || null, 
      email: user.contact, 
      role: user.role, 
    };

    // Redirection vers le dashboard ou autre page
    res.redirect('/teacher/dash');
  } catch (error) {
    console.error('Erreur lors du login:', error);
    res.status(500).json({ error: 'Erreur lors de la tentative de connexion' });
  }
});

router.post('/register',
  upload.fields([
    { name: 'profile', maxCount: 1 },
    { name: 'cv', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { name, email, password, bio, username, contact, country, birthdate, firstname, offers, level } = req.body;

      console.log(req.body);

      // Vérifier si un utilisateur avec l'email existe déjà
      const existingUser = await User.findOne({ where: { contact: email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
      }

      console.log("1");

      // Fichiers
      const profilePath = req.files.profile ? `/pr/profiles/${req.files.profile[0].filename}` : null;
      const cvPath = req.files.cv ? `/pr/cvs/${req.files.cv[0].filename}` : null;

      console.log("2");
      console.log(profilePath);
      const user = await User.create({
        name,
        firstname,
        username,
        contact: email,
        password,
        bio,
        role: "teacher",
        profile: profilePath,
        cv: cvPath,
        country,
        birthdate,
        offers,
        level,
        abonnement: "Basic"
      });

      req.session.user = {
        id: user.id,
        username: user.username,
        profile: user.profile,
        contact: user.email,
        role: user.role
      };

      res.redirect('/teacher/dash');
    } catch (err) {
      console.error('Erreur lors de l\'inscription du professeur:', err);
      res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
  }
);

router.get('/courses/:courseId/students', async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findByPk(courseId, {
      include: [{
        model: User,
        as: 'students',
        attributes: ['id', 'username', 'name', 'firstname', 'contact', 'profile']
      }]
    });

    if (!course) {
      return res.status(404).send("Cours non trouvé.");
    }

    res.render('teacher/courseStudents', {
      course,
      students: course.students
    });

  } catch (err) {
    console.error("Erreur lors de la récupération des étudiants :", err);
    res.status(500).send("Erreur serveur.");
  }
});

  

module.exports = router;
