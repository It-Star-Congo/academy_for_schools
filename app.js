const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');  // Importation du module
const session = require('express-session');
const bodyParser = require('body-parser');
const { syncDB } = require('./models');
const flash = require('connect-flash');
const app = express();
const PORT = process.env.PORT || 3000;

require('dotenv').config();
const helmet            = require('helmet');
//const csrf              = require('csurf');
//const passport          = require('passport');
//const configurePassport = require('./config/passport');

const logger         = require('./config/logger');
const requestLogger  = require('./middlewares/requestLogger');


// Middleware
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
app.use(express.static(path.join(__dirname, 'public')));
// Utilise express-ejs-layouts pour gérer les mises en page
app.use(expressLayouts);


/*app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // autorise ton propre domaine et le CDN
        "script-src": [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "'unsafe-inline'"    // <–– permet tous les inlines
        ],
        // idem pour les éléments <script src=…>
        "script-src-elem": [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "'unsafe-inline'"
        ],
        // si tu charges du CSS inline ou via CDN
        "style-src": [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "'unsafe-inline'"
        ]
      }
    }
  }));*/
app.use(bodyParser.urlencoded({ extended: true }));



// CSRF après les sessions


app.use(session({
    secret: 'ton_secret_deF0uMa_ladeeee2006',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure   : process.env.NODE_ENV === 'production', // HTTPS obligatoire en prod
      httpOnly : true,
      sameSite : 'lax',
      maxAge   : 24 * 60 * 60 * 1000                    // 1 jour
    }
}));

// Après l'initialisation de express-session
app.use(flash());  // Ajoute cette ligne pour activer flash

// Middleware pour ajouter l'utilisateur à la vue
app.use((req, res, next) => {
    res.locals.user = req.session.user; // Ajoute l'utilisateur à res.locals pour qu'il soit disponible dans toutes les vues
    res.locals.messages  = req.flash('messages');
    next();
});

app.use('/uploads', express.static('public/uploads'));


app.use(requestLogger); 

/* Sessions + Passport
configurePassport(passport);
app.use(passport.initialize());
app.use(passport.session());




/*const csrfProtection = csrf();   // pas { cookie:true } ici
// CSRF et tokens
//app.use(csrf());
app.use((req, res, next) => {
  res.locals.user      = req.user || null;  // user accessible dans les vues
  
  next();
});*/



// Import des routes
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const courseRoutes = require('./routes/course');
const exerciseRoutes = require('./routes/exercice');
const submissionRoutes = require('./routes/submission');
const teacherRoutes = require('./routes/teacher');
const adminRoutes = require('./routes/admin');




app.get('/', (req, res) => {
    res.render('index');
  });

  
app.use('/users', userRoutes);
app.use('/auth', authRoutes);
app.use('/dash', dashboardRoutes);
app.use('/courses', courseRoutes);
app.use('/exercise', exerciseRoutes);
app.use('/submissions', submissionRoutes);
app.use('/teacher', teacherRoutes);
app.use('/admin', adminRoutes)

// Synchronisation de la base de données
syncDB();


app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn('CSRF invalide', { ip: req.ip, url: req.originalUrl });
    req.flash('messages', ['Session expirée ou formulaire invalide. Veuillez réessayer.']);
    return res.redirect('back');          // ou res.status(403).render('csrf-error');
  }
  next(err);
});

// Logger sur les erreurs :
app.use((err, req, res, next) => {          // catch-all erreurs
  logger.error(err.message, { stack: err.stack, ip: req.ip });
  res.status(500).send('Erreur interne');
});


// Lancer le serveur
app.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});
