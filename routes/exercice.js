const express = require('express');
const router = express.Router();
const { Exercise } = require('../models');
const { Course } = require('../models'); // Importation du modèle Course
const { User } = require('../models')
const { Submission } = require('../models');
const logger = require('../config/logger');

async function getCoursesByTeacher(username) {
  try {
      let courses;
      
      if (username === "test") {
          // Si l'utilisateur est "test", récupérer tous les cours
          courses = await Course.findAll({
              attributes: ['id', 'name', 'teacher', 'image']
          });
      } else {
          // Sinon, récupérer seulement les cours créés par cet utilisateur
          courses = await Course.findAll({
              where: { teacher: username },
              attributes: ['id', 'name', 'teacher', 'image']
          });
      }

      return courses.map(course => course.toJSON());
  } catch (error) {
      console.error("Erreur lors de la récupération des cours :", error);
      return [];
  }
}


// Récupérer tous les exercices
router.get('/', async (req, res) => {
  try {
    const exercises = await Exercise.findAll();
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des exercices' });
  }
});

async function getBestScoreForUserExercise(userId, exerciseId) {
  const best = await Submission.max('score', {
    where: { userId, exerciseId }
  });
  return best || 0;
}

router.get('/exe/:exerciseId', async (req, res) => {
  try {
      const exercise = await Exercise.findByPk(req.params.exerciseId);
      if (!exercise) {
          return res.status(404).json({ error: 'Exercice non trouvé' });
      }
      const userId = Number(req.session.user.id);
      const exerciseId = Number(req.params.exerciseId)
      const bestScore = await getBestScoreForUserExercise(Number(req.session.user.id), Number(req.params.exerciseId));
      const attempts = await Submission.count({
    where: { userId, exerciseId }
  });
      res.render('exercice', { exercise, username: req.session.user.username, bestScore, attempts });
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur' });
  }
});


// Récupérer une série d'exercices et de resoources pour un cours spécifique et les afficher dans la vue
router.get('/course/:courseName', async (req, res) => {
  try {
    const course = await Course.findOne({
      where: { name: req.params.courseName },
      include: [{ model: User, as: 'students' }]
    });

    if (!course) {
      return res.status(404).render('error', { message: 'Cours non trouvé' });
    }

    const isStudent = course.students.some(student => student.username === req.session.user.username);

    if (!isStudent) {
      return res.render('confirmEnrollment', {
        courseName: course.name
      });
    }

    const exercises = await Exercise.findAll({
      where: { course: req.params.courseName }
    });

    res.render('course', { exercises, course, courseName: course.name, courseId: course.id, ressources: course.documents });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { message: 'Erreur lors de la récupération du cours' });
  }
});


router.post('/course/:courseName/enroll', async (req, res) => {
  try {
    const course = await Course.findOne({ where: { name: req.params.courseName } });
    const user = await User.findOne({ where: { username: req.session.user.username } });

    if (!course || !user) {
      return res.status(404).render('error', { message: 'Utilisateur ou cours non trouvé' });
    }

    // Vérifie si l'utilisateur est déjà inscrit
    const isEnrolled = await course.hasStudent(user);

    if (!isEnrolled) {
      await course.addStudent(user);
      logger.logWithCategory('interaction', 'info',`CourseRegistration : User ${user.id}: ${user.name}  s'est inscrit au cours  ${course.id}`);

    }

    res.redirect(`/exercise/course/${req.params.courseName}`);
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { message: "Erreur lors de l'inscription au cours" });
  }
});



// Afficher le formulaire d'ajout
router.get('/add', async (req, res) => {  // Ajout de 'async'
  try {
    const courses = await getCoursesByTeacher(req.session.user.username);  // Utilisation correcte de 'await'
    const abonnement = req.session.user.abonnement;
    res.render('addExercice', { courses, abonnement });
  } catch (error) {
    console.error("Erreur lors de la récupération des cours :", error);
    res.status(500).send("Erreur interne du serveur");
  }
});


// Ajouter un exercice via formulaire
router.post('/add', async (req, res) => {
  console.log("ehla");
  try {
    const { title, course, author, type, description, price, deadline } = req.body;
    const lecours = await Course.findByPk(course);
    let exerciseData = { title, course: lecours.name, author, type, description, courseId: course };
    console.log(exerciseData);

    if (type === 'programmation') {
      const { solution, starterCode, expectedOutput, testCases } = req.body;
      exerciseData = { ...exerciseData, solution, starterCode, expectedOutput, testCases: testCases ? JSON.parse(testCases) : null };

      console.log("Solution attendue:", solution);
      console.log("Code de départ:", starterCode);
      console.log("Sortie attendue:", expectedOutput);
      console.log("Test cases:", testCases);

    } 
    else if (type === 'qcm') {
      const { questions } = req.body; // Contient les questions sous forme de JSON [{question, options, correctAnswer}]
      console.log(questions);
      if (questions && questions.length > 0) {
        questions.forEach((question, index) => {
          console.log(`Question ${index + 1}: ${question.question}`);
          console.log(`Options: ${question.options}`);
          console.log(`Correct Answer: ${question.correctAnswer}`);

          if (typeof question.options === 'string') {
            question.options = question.options.split(',').map(option => option.trim());
          }
        });
      } else {
        console.log('Aucune question trouvée');
      }
      

      // Si les questions ne sont pas encore sous forme d'objet, on les parse
      if (typeof questions === 'string') {
        questions = JSON.parse(questions);
      }
      exerciseData = { ...exerciseData, questions: questions };
    } 
    else if (type === 'redaction') {
      const { evaluationCriteria } = req.body; // Ex: {"clarté":5, "argumentation":5}
      exerciseData = { ...exerciseData, evaluationCriteria: JSON.parse(evaluationCriteria) };
      console.log("Critères d'évaluation:", evaluationCriteria);
    }
    else if (type === 'texte_trous') {
      const { textWithBlanks, blanksAnswers } = req.body;
      exerciseData = {
        ...exerciseData,
        textWithBlanks,
        blanksAnswers: blanksAnswers ? JSON.parse(blanksAnswers) : null
      };
      console.log("Texte à trous :", textWithBlanks);
      console.log("Réponses attendues :", blanksAnswers);
    }else if (type === 'file') {
      const {fileSize, fileType, allowedExtensions } = req.body;
      allowedExtensions2 = JSON.parse(allowedExtensions)
      exerciseData = { ...exerciseData, fileSize, fileType, allowedExtensions : allowedExtensions2}
    }
    console.log('ok2');

    let exoo = await Exercise.create(exerciseData);
    logger.log({
              level:   'info',
              message: `Teacher ${req.session.user.id}: ${req.session.user.name} a créé l'exercice ${exoo.id}`,
              meta: {
                category: 'interaction',
                ip:       req.ip,
                method:   req.method,
                url:      req.originalUrl
              }
            })
    console.log('ok3');
    res.redirect('/dash'); // Redirige vers la liste des exercices
  } catch (error) {
    console.error(error);
    console.log("mama na errreur");
    res.status(500).render('error', { message: "Erreur lors de l'ajout de l'exercice" });
  }
  console.log("ehla2");
});


// Route pour supprimer un exercice
router.delete('/delete/:id', async (req, res) => {
  const exerciseId = req.params.id;
  const userName = req.session.user.username;  // Assure-toi que le nom de l'utilisateur est stocké dans la session
  console.log(userName);

  try {
    // Trouver l'exercice dans la base de données avec Sequelize (findByPk pour la clé primaire)
    const exercise = await Exercise.findByPk(exerciseId);
    
    if (!exercise) {
      return res.status(404).json({ success: false, message: 'Exercice non trouvé' });
    }

    // Vérifier si l'auteur est l'utilisateur connecté ou si l'utilisateur est "admin" ou "test"
    if (exercise.author === userName || userName === 'test' || userName === 'admin') {
      // Supprimer l'exercice
      await exercise.destroy();  // Méthode pour supprimer un enregistrement avec Sequelize

      logger.log({
              level:   'info',
              message: `Teacher ${req.session.user.id}: : ${req.session.user.username} a supprimé l'exercice ${exerciseId}`,
              meta: {
                category: 'interaction',
                ip:       req.ip,
                method:   req.method,
                url:      req.originalUrl
              }
            });
      return res.status(200).json({ success: true, message: 'Exercice supprimé' });
    } else {
      logger.log({
              level:   'error',
              message: `Teacher ${req.session.user.id}: ${req.session.user.username} a voulu supprimé l'exercice ${exerciseId}`,
              meta: {
                category: 'interaction',
                ip:       req.ip,
                method:   req.method,
                url:      req.originalUrl
              }
            })
      return res.status(403).json({ success: false, message: 'Vous n\'êtes pas autorisé à supprimer cet exercice' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la suppression' });
  }
});




// Ajouter un nouvel exercice
router.post('/', async (req, res) => {
  try {
    const { title, description, solution } = req.body;
    const newExercise = await Exercise.create({ title, description, solution });
    res.status(201).json(newExercise);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la création de l’exercice' });
  }
});

module.exports = router;
