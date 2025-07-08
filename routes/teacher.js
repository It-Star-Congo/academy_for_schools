const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

//const bcrypt = require('bcrypt');


const multer = require('multer');
const { User, Course, Submission, Exercise } = require('../models'); // Assure-toi d'importer tes modèles correctement

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

  

router.get('/', async (req, res) => {

  try{
    console.log(req.session.user);

    if(req.session.user.role ===  'teacher'){
      res.redirect('/teacher/dash')
    }else{
      res.redirect('/login')
    }

  }catch{
    res.status(500).json({ error: 'Erreur lors de la récupération des données professeur: ' + error });
  }


});

// GET - Tableau de bord professeur
router.get('/dash', async (req, res) => {
  try {

    console.log(req.session.user)
    if (!req.session.user){res.render('loginTeacher');}

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
    let ok = await bcrypt.compare(password + process.env.PEPPER, user.password);
    if (!ok) {
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
    
    logger.log({
      level:   'info',
      message: `Connexion réussie pour User ${user.id}`,
      meta: {
        category: 'auth',
        ip:       req.ip,
        method:   req.method,
        url:      req.originalUrl
      }
    });
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
      const hashedPassword = await bcrypt.hash(password + process.env.PEPPER, 12);
      const user = await User.create({
        name,
        firstname,
        username,
        contact: email,
        password: hashedPassword,
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

router.get('/courses/:courseId/submissions2', async (req, res) => {
  try {
    const { courseId } = req.params;
    // Récupère les infos du cours
    const course = await Course.findByPk(courseId, { attributes: ['id', 'name'] });
    // Récupère tous les exercices du cours
    const exercises = await Exercise.findAll({
      where: { CourseId: courseId },
      attributes: ['id', 'title']
    });
    // Récupère toutes les soumissions de ces exercices
    const submissions = await Submission.findAll({
      include: [
        {
          model: Exercise,
          where: { CourseId: courseId },  
          attributes: ['id','title'],
          required: true            // ← force l'INNER JOIN
        },
        {
          model: User,
          attributes: ['id','username','contact']
        }
      ],
      order: [['createdAt','DESC']]
    });


    // Organise les données : pour chaque exercice, regroupe par élève
    const data = exercises.map(ex => {
      const subsForEx = submissions.filter(s => s.ExerciseId === ex.id);
      const byStudent = {};
      subsForEx.forEach(s => {
        const uid = s.User.id;
        if (!byStudent[uid]) byStudent[uid] = { user: s.User, subs: [] };
        byStudent[uid].subs.push(s);
      });
      const studentEntries = Object.values(byStudent).map(({ user, subs }) => {
        const count = subs.length;
        const best = subs.reduce((a, b) => a.score >= b.score ? a : b);
        const avg = Math.round(subs.reduce((sum, x) => sum + x.score, 0) / count);
        const last = subs[0].createdAt;
        console.log(count, avg)
        console.log(studentEntries)
        return { user, count, best, avg, last };
      });
      return { exercise: ex, studentEntries };
    });

    res.render('submissions', { course, data });
  } catch (err) {
    console.error('Erreur affichage soumissions :', err);
    res.status(500).send('Erreur interne');
  }
});



 
router.get('/courses/:courseId/submissions', async (req, res) => {
  try {
    const { courseId } = req.params;

    // Récupère le cours
    const course = await Course.findByPk(courseId, {
      attributes: ['id', 'name']
    });
    if (!course) {
      return res.status(404).send('Cours introuvable');
    }

    const subs = await Submission.findAll({
      include: [{ model: Exercise }]  // sans where, sans required
    });
    console.log('🔍 Submissions + include Exercise (no filter) :', subs.length);
    console.log(subs[0].Exercise); 

    // Récupère toutes les soumissions des exercices liés à ce cours
    const submissions = await Submission.findAll({
      include: [
        {
          model: Exercise,
          where: { CourseId: courseId },
          attributes: ['id', 'title'],
          required: true      // force l’INNER JOIN pour ne renvoyer que les bonnes
        },
        {
          model: User,
          attributes: ['id', 'username', 'contact'],
          required: true
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    console.log(submissions);

    console.log('🎯 Submissions trouvées pour le cours', courseId, ':', submissions.length);

    // Regroupe par exercice puis par étudiant
    const byExercise = {};
    submissions.forEach(sub => {
      const ex = sub.Exercise;
      // initialisation du bloc exercice
      if (!byExercise[ex.id]) {
        byExercise[ex.id] = { exercise: ex, students: {} };
      }
      const bucket = byExercise[ex.id].students;

      const userId = sub.User.id;
      // initialisation du bucket étudiant
      if (!bucket[userId]) {
        bucket[userId] = { user: sub.User, subs: [] };
      }
      bucket[userId].subs.push(sub);
    });

    // Transforme en tableau pour la vue
    const data2 = Object.values(byExercise).map(({ exercise, students }) => ({
      exercise,
      studentEntries: Object.values(students).map(({ user, subs }) => {
        const count = subs.length;
        const best  = subs.reduce((a,b) => (a.score >= b.score ? a : b));
        const avg   = Math.round(subs.reduce((sum,x) => sum + x.score, 0) / count);
        const last  = subs[0].createdAt;
        return { user, count, best, avg, last };
      })
    }));

    res.render('submissions', { course, data2 });
  } catch (err) {
    console.error('Erreur affichage soumissions :', err);
    res.status(500).send('Erreur interne');
  }
});


  

module.exports = router;
