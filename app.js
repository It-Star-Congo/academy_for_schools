const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');  // Importation du module
const session = require('express-session');
const bodyParser = require('body-parser');
const { syncDB } = require('./models');
const flash = require('connect-flash');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
app.use(express.static(path.join(__dirname, 'public')));
// Utilise express-ejs-layouts pour gérer les mises en page
app.use(expressLayouts);

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'ton_secret_deF0uMa_ladeeee2006',
    resave: false,
    saveUninitialized: true
}));

// Middleware pour ajouter l'utilisateur à la vue
app.use((req, res, next) => {
    res.locals.user = req.session.user || null; // Ajoute l'utilisateur à res.locals pour qu'il soit disponible dans toutes les vues
    next();
});

app.use('/uploads', express.static('public/uploads'));



// Import des routes
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const courseRoutes = require('./routes/course');
const exerciseRoutes = require('./routes/exercice');
const submissionRoutes = require('./routes/submission');
const teacherRoutes = require('./routes/teacher');

// Après l'initialisation de express-session
app.use(flash());  // Ajoute cette ligne pour activer flash


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

// Synchronisation de la base de données
syncDB();

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});
