const express = require('express');
const passport = require('passport');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');  // Assurez-vous d'importer User comme objet destructuré
const { Sequelize } = require('sequelize');  // Ajoute cette ligne en haut de ton fichier
const logger = require('../config/logger');
const limiter = require('../middlewares/rateLimiter'); // 5 req/min
const router = express.Router();
//const csrf = require('csurf');




// Configuration de Multer pour le stockage des images et fichiers
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === "image") {
            cb(null, './public/rv/images/');  // Dossier pour les images
        } else {
            cb(null, './public/rv/files/');  // Dossier pour les fichiers du user
        }
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Nom unique du fichier
    }
});

const upload = multer({ storage: storage });


/*const csrfProtection = csrf();   // middleware route-level
const addCsrf = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  return next();
};*/


// Page de connexion
router.get('/login', (req, res) => {
    if (req.session.user == null){
        res.render('login');
    }else{
        res.redirect('/dash');
    }
    
});

// Page d'inscription
router.get('/register', (req, res) => {
    if (req.session.user == null){
        res.render('register');
    }else{
        res.redirect('/dash');
    }
    
});

router.get('/abonnement', (req, res) => {
    res.render('chooseAbonnement');
});

router.post('/submit-abonnement', async (req, res) => {
    try {
        const abonnementChoisi = req.body.abonnement;
        const username = req.session.username;

        console.log(abonnementChoisi)
        // Vérifier si l'utilisateur existe
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(404).json({ error: "Utilisateur non trouvé" });
        }

        // Mettre à jour l'abonnement
        await user.update({ abonnement: abonnementChoisi });

        req.session.user.abonnement = abonnementChoisi;

        console.log(`L'utilisateur ${username} a souscrit à l'abonnement : ${abonnementChoisi}`);
        res.redirect('/dash');

    } catch (error) {
        console.error("Erreur lors de la mise à jour de l'abonnement :", error);
        res.status(500).json({ error: "Erreur serveur lors de la mise à jour de l'abonnement" });
    }
});



// Traitement de la connexion
router.post('/login',limiter, 
  [
    body('username').notEmpty().withMessage('Username requis'),
    body('password').notEmpty().withMessage('Mot de passe requis')
  ],
   async (req, res, next) => {
    try {
      // Récupération des données du formulaire
      const { username, password } = req.body;
      
      // Chercher l'utilisateur dans la base de données par username
      const user = await User.findOne({ where: { username } });
      
      // Si l'utilisateur n'existe pas
      if (!user) {
        return res.status(400).json({ error: 'Utilisateur non trouvé' });
      }
      
      // Comparer le mot de passe envoyé avec celui dans la base de données (en texte clair)
      let ok = await bcrypt.compare(password + process.env.PEPPER, user.password);
      if (!ok) {
        return res.status(400).json({ error: 'Mot de passe incorrect' });
      }
      
      // Si le mot de passe est correct, on crée une session pour l'utilisateur
      req.session.user = { id: user.id, username: user.username, classId: user.classId, profile: user.profile || '/pictures/AcademyLogoTransparent-removebg-preview.png', email: user.contact, subscriptionType : "Free", credits: user.credits, role: user.role, schoolId: user.schoolId };
      
      // Redirection vers le dashboard ou autre page
      // après un login réussi
      if(req.session.user.role === 'admin'){
        logger.log({
          level:   'info',
          message: `Connexion réussie pour admin #${user.id}: ${user.username}`,
          meta: {
            category: 'auth',
            ip:       req.ip,
            method:   req.method,
            url:      req.originalUrl
          }
        });
        res.redirect('/admin')

      } else if (req.session.user.role === 'teacher'){
        logger.log({
          level:   'info',
          message: `Connexion réussie pour teacher #${user.id}: ${user.username}`,
          meta: {
            category: 'auth',
            ip:       req.ip,
            method:   req.method,
            url:      req.originalUrl
          }
        });
        res.redirect('/teacher/dash')
      }else{
        logger.log({
        level:   'info',
        message: `Connexion réussie pour user #${user.id}: ${user.username}`,
        meta: {
          category: 'auth',
          ip:       req.ip,
          method:   req.method,
          url:      req.originalUrl
        }
      });
      res.redirect('/dash');
      }
    } catch (error) {
     logger.warn('Login échoué', { username: req.body.username, ip: req.ip });
      console.error('Erreur lors du login:', error);
      res.status(500).json({ error: 'Erreur lors de la tentative de connexion' });
    }

    /*  const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log(errors.array().map(e => e.msg))
      req.flash('messages', errors.array().map(e => e.msg));
      return res.redirect('/auth/login');
    }

    passport.authenticate('local', (err, user, info) => {
      if (err) {
        logger.error(err.message);
        return next(err);
      }
      if (!user) {
        req.flash('messages', [info?.message || 'Échec de connexion']);
        logger.warn('Login échoué', { username: req.body.username, ip: req.ip });
        return res.redirect('/auth/login');
      }
      req.logIn(user, err => {
        if (err) return next(err);
        logger.info('Login réussi', { id: user.id, username: user.username, ip: req.ip });
        res.redirect('/dash');
      });
    })(req, res, next);*/

  });
  

// Traitement de l'inscription
router.post('/register', upload.fields([
    { name: 'image', maxCount: 1 }, 
    { name: 'documents', maxCount: 10 } // Autorise jusqu'à 10 fichiers
]), limiter ,[
    body('username').trim().isLength({ min: 3 }).withMessage('Username trop court'),
    body('contact').isEmail().withMessage('Contact invalide'),
    /*body('password')
      .isStrongPassword()
      .withMessage('Mot de passe trop faible'),*/
    body('birthdate').isDate().withMessage('Date de naissance invalide')
  ], async (req, res) => {


    // Vérifier si un utilisateur avec le même username ou contact existe déjà
    try {
        console.log(req.files); // Vérifier si l'image est bien reçue
        const { username, contact, password, country, birthdate, firstname, name, offers, level, classId } = req.body;

        const existingUser = await User.findOne({ 
            where: { 
                [Sequelize.Op.or]: [{ username }, { contact }] 
            } 
        });

        if (existingUser) {
            // Si un utilisateur existe déjà avec ces identifiants
            req.flash('messages', ['Cet utilisateur existe déjà.']);
            return res.redirect('/auth/login');  // Rediriger l'utilisateur vers la page d'inscription
        }

        // Sécuriser le mot de passe avec bcrypt
        const hashedPassword = await bcrypt.hash(password + process.env.PEPPER, 12); 
        
        // await bcrypt.hash(password, 10);

        const imagePath = req.files.image ? `/rv/images/${req.files.image[0].filename}` : null;

        // Créer un nouvel utilisateur
        const user = await User.create({
            username,
            contact,
            password: hashedPassword,
            country, 
            profile: imagePath, 
            birthdate, 
            firstname, 
            name, 
            offers, 
            level,
            abonnement : "academic",
            classId
        });

        logger.log({
        level:   'info',
        message: `Enregistrement réussie pour user #${user.id}: ${user.username}`,
        meta: {
          category: 'auth',
          ip:       req.ip,
          method:   req.method,
          url:      req.originalUrl
        }
      });

        req.flash('messages', ['Inscription réussie ! Vous pouvez vous connecter maintenant.']);
        req.session.user = { id: user.id, username: user.username, classId, profile: imagePath, email: user.contact, credits: user.credits, abonnement : "Basic", role: user.role };
        console.log("ok1")

        /*req.login(user, err =>
        err ? next(err) : res.redirect('/dash')
      );*/
      res.redirect('/dash')
        //res.redirect('/auth/abonnement');  // Rediriger vers la page de choix d'abonnement

    } catch (err) {
        console.error(err);
        req.flash('messages', ['Erreur lors de l\'inscription.']);
        res.redirect('/auth/register');
    }
});

// Déconnexion
router.get('/logout', (req, res, next) =>
  req.session = null
);

module.exports = router;
