const express = require('express');
const multer = require('multer');
const path = require('path');
const { Course, ForumPost, User, School, Class } = require('../models'); // Assure-toi que le chemin est correct
const router = express.Router();
const logger = require('../config/logger');

// Configuration de Multer pour le stockage des images et fichiers
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === "image") {
            cb(null, './public/uploads/images/');  // Dossier pour les images
        } else {
            cb(null, './public/uploads/files/');  // Dossier pour les fichiers du cours
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Nom unique du fichier
    }
});

const upload = multer({ storage: storage });

// Route pour afficher le formulaire
router.get('/add', async (req, res) => {

  const classes = await Class.findAll({where : {schoolId: req.session.user.schoolId}});
  const teachers = await User.findAll({where : {schoolId: req.session.user.schoolId, role: 'teacher'}});
  console.log(teachers[0]);
    res.render('new-course', {classes, teachers, selectedTeachers: []});
});

// Route pour recuperer tous les cours

router.get('/all', async (req, res) => {
  try {
      const courses = await Course.findAll();
      res.json(courses); // Retourne tous les cours sous forme de JSON
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erreur lors de la récupération des cours" });
  }
});

router.get('/myCourses', async (req, res) => {
  try {
    const user = req.session.user;

    if (!user) {
      return res.redirect('/auth/login'); // Rediriger si non connecté
    }

    // Récupérer l'utilisateur complet avec Sequelize pour accéder aux méthodes associatives
    const dbUser = await User.findByPk(user.id);

    if (!dbUser) {
      return res.status(404).send("Utilisateur non trouvé.");
    }

    // Récupérer les cours où l'utilisateur est inscrit
    const enrolledCourses = await dbUser.getEnrolledCourses({
      attributes: ['id', 'name', 'description', 'teacher', 'image']
    });

    res.render('myCourses', {
      user,
      exercises: enrolledCourses.map(course => course.toJSON())
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des cours :", error);
    res.status(500).send("Erreur interne du serveur");
  }
});


// Route pour recuperer tous les cours qu'on a créé soi meme
router.get('/my-courses-teacher', async (req, res) => {
  try {
      if (!req.session.user) {
          return res.status(401).json({ message: "Non autorisé" });
      }

      const teacherName = req.session.user.username; // Nom de l'enseignant connecté
      const courses = await Course.findAll({ where: { teacher: teacherName } });

      res.json(courses);
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erreur lors de la récupération des cours de l'enseignant" });
  }
});

/*router.get('/forum', async (req, res) => {
    try {
      const users = await User.findAll();
      res.render('forum', {
        course,
        forumPosts // tableau avec { author, message, date }
      });
      
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' + error });
    }
  });*/



router.get('/forum/:courseId/forum', async (req, res) => {
  try {
    const courseId = req.params.courseId;

    const course = await Course.findByPk(courseId);
    if (!course) return res.status(404).send("Cours introuvable");

    


    const forumPosts = await ForumPost.findAll({
      where: {
        courseId,
        parentId: null
      },
      include: [{
        model: ForumPost,
        as: 'replies',
        separate: true,
        order: [['createdAt', 'ASC']]
      }],
      order: [['createdAt', 'DESC']]
    });


    if(!forumPosts){
      res.render('forum', {
      course,
      forumPosts:[],
      user: req.session.user
    });
    }

    res.render('forum', {
      course,
      forumPosts,
      user: req.session.user
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération du forum: ' + error });
  }
});

// POST - Nouveau message sur le forum
router.post('/forum/:courseId/forum/new', async (req, res) => {
    try {
      const courseId = req.params.courseId;
      const { message } = req.body;
  
      const course = await Course.findByPk(courseId);
      if (!course) return res.status(404).send("Cours introuvable");
  
      await course.createForumPost({
        message,
        author: req.session.user.username
      });
  
      res.redirect(`/courses/forum/${courseId}/forum`);
    } catch (error) {
      res.status(500).json({ error: 'Erreur lors de la publication du message: ' + error });
    }
  });
  


  router.post('/forum/:courseId/forum/:postId/reply', async (req, res) => {
  try {
    const { postId, courseId } = req.params;
    const { message } = req.body;
    const user = req.session.user;

    if (!user) return res.status(401).send("Utilisateur non authentifié.");

    await ForumPost.create({
      message,
      author: user.username,
      courseId,
      parentId: postId // identifie le message parent
    });

    res.redirect(`/courses/forum/${courseId}/forum`);
  } catch (err) {
    res.status(500).send("Erreur lors de la réponse : " + err.message);
  }
});


router.post('/courses/:courseId/forum/:postId/delete', async (req, res) => {
  try {
    const { postId, courseId } = req.params;
    const user = req.session.user;

    if (!user) return res.status(401).send("Non autorisé.");

    const post = await ForumPost.findByPk(postId);

    if (!post) return res.status(404).send("Message non trouvé.");
    if (post.author !== user.username) return res.status(403).send("Suppression interdite.");

    // Supprimer aussi les réponses associées si c'est un post parent
    await ForumPost.destroy({ where: { parentId: postId } });

    // Supprimer le post lui-même
    await post.destroy();

    res.redirect(`/courses/forum/${courseId}/forum`);
  } catch (err) {
    res.status(500).send("Erreur lors de la suppression : " + err.message);
  }
});

  


router.get('/enrolled', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ message: "Non autorisé" });
        }

        const user = await User.findOne({
            where: { username: req.session.user.username },
            include: { model: Course, as: 'courses' } // Récupérer ses cours
        });

        if (!user) {
            return res.status(404).json({ message: "Utilisateur non trouvé" });
        }

        res.json(user.courses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de la récupération des cours inscrits" });
    }
});


async function linkCourseToClass(courseId, classId) {
  const classModel = await Class.findByPk(classId, {
    include: [{ model: User, as: 'students' }]
  });

  if (!classModel) throw new Error("Classe introuvable");

  // Lier le cours à la classe
  await ClassCourse.create({ classId, courseId });

  // Lier tous les élèves de cette classe au cours
  for (const student of classModel.students) {
    await student.addEnrolledCourse(courseId); // via relation M:N
  }
}




// Route pour ajouter un cours
router.post('/add', upload.fields([
    { name: 'image', maxCount: 1 }, 
    { name: 'documents', maxCount: 10 } // Autorise jusqu'à 10 fichiers
]), async (req, res) => {
    try {
        const { name, description, teacher, price, classId, filesnames, teachers } = req.body;
        const imagePath = req.files.image ? `/uploads/images/${req.files.image[0].filename}` : null;
        
        // Stocke les fichiers sous forme de tableau
        const documentObjects= req.files.documents ? req.files.documents.map((file, index) => {
          const originalName = Array.isArray(req.body.documentNames) ? req.body.documentNames[index] : req.body.documentNames;
          return {
            path: `/uploads/files/${file.filename}`,
            originalName: originalName || file.originalname
          };
        }) : [];



        const newCourse = await Course.create({
            name,
            description,
            teacher,
            //teachers,
            price,
            image: imagePath,
            documents: documentObjects,
            schoolId: req.session.user.schoolId
        });
        if (classId) {
          await linkCourseToClass(newCourse.id, classId);
        }

        res.redirect('/dash'); // Redirige après ajout
    } catch (error) {
        console.error(error);
        res.status(500).send('Erreur lors de l’ajout du cours');
    }
});

module.exports = router;
