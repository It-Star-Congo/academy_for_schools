const express = require('express');
const fs      = require('fs');
const path    = require('path');
const router  = express.Router();
const { User, Course, Submission, Exercise, Class, School, ClassCourse, Event } = require('../models'); // Assure-toi d'importer tes modèles correctement
const logger = require('../config/logger');
const limiter = require('../middlewares/rateLimiter'); // 5 req/min
const bcrypt = require('bcrypt');
const {Op} = require('sequelize')

const multer = require('multer');

const createFolderIfNotExists = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

createFolderIfNotExists(path.join(__dirname, '..', 'public', 'pr', 'schoolData'));
createFolderIfNotExists(path.join(__dirname, '..', 'public', 'pr', 'schoolFiles'));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest;
    if (file.fieldname === 'profile') {
      dest = path.join(__dirname, '..', 'public', 'pr', 'schoolData');
    } else if (file.fieldname === 'cv') {
      dest = path.join(__dirname, '..', 'public', 'pr', 'schoolFiles');
    } else if (file.fieldname === 'logo') {
      dest = path.join(__dirname, '..', 'public', 'pr', 'schoolData');
    } else if (file.fieldname === 'image') {
      dest = path.join(__dirname, '..', 'public', 'rv', 'images');
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


// Les 4 catégories disponibles
const categories = ['auth', 'interaction', 'profile', 'general'];

router.get('/logs', (req, res) => {
  const category = req.query.category || 'general';
  const date     = req.query.date;   // format YYYY-MM-DD

  // 1) liste des fichiers
  const logDir = path.join(process.cwd(), 'logs', category);
  let files = [];
  if (fs.existsSync(logDir)) {
    files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
  }

  // 2) extrais les dates
  const dates = files.map(f => f.replace(`${category}-`, '').replace('.log',''));

  // 3) choisis le fichier
  let filename;
  if (date && dates.includes(date)) {
    filename = `${category}-${date}.log`;
  } else if (dates.length) {
    filename = `${category}-${dates.sort().reverse()[0]}.log`;
  }

  // 4) lit & parse
  let logs = [];
  if (filename) {
    const content = fs.readFileSync(path.join(logDir, filename), 'utf8');
    logs = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line); }
        catch { return { raw: line }; }
      });
  }

  // 5) **aplatit** meta dans le log
  logs = logs.map(log => {
    if (log.meta && typeof log.meta === 'object') {
      // extrait meta et replace tout au 1er niveau
      const { meta, ...rest } = log;
      return { ...rest, ...meta };
    }
    return log;
  });

  // 6) render
  res.render('admin/logs', {
    categories,
    category,
    dates,
    selectedDate: filename ? filename.replace(`${category}-`, '').replace('.log','') : null,
    logs
  });
});

/**
 * Export JSON de TOUS les logs d’une catégorie
 * URL : /admin/logs/export?category=auth
 */
router.get('/logs/export', (req, res) => {
  const category = req.query.category || 'general';
  const logDir   = path.join(process.cwd(), 'logs', category);
  let exportLogs = [];

  if (fs.existsSync(logDir)) {
    const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log'));
    files.forEach(file => {
      const content = fs.readFileSync(path.join(logDir, file), 'utf8');
      content
        .split('\n')
        .filter(line => line.trim())
        .forEach(line => {
          try {
            exportLogs.push(JSON.parse(line));
          } catch (_) { /* ignore */ }
        });
    });
  }

  const filename = `${category}-logs.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(exportLogs, null, 2));
});

const nosApps = [
            { id: 1, name: 'Jitsi', category: "Réunions/Conférences", image: '/pictures/jitsi.png', link: "https://meet.jit.si/"  },
            { id: 2, name: 'E-mailer', category: "Mailing", image: '/pictures/emailjs.png', link: "/admin/modif/emailer" },
            { id: 3, name: 'ITSA Student Analytics', category: "Analytics", image: '/pictures/AcademyLogoTransparent-removebg-preview.png', link: "/admin/modif/emailer" },
            { id: 4, name: 'ITSA IA', category: "AI", image: '/images/javascript.jpg', link:"/admin/modif/emailer" },
            { id: 4, name: 'Calendemy', category: "Calendrier", image: '/pictures/calendemy.png', link:"/admin/calendar" },
        ];


// Dashboard admin
router.get('/', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role != 'admin'){
      return res.redirect('/admin/register');
    }
    const [studentCount, teacherCount, courseCount, classCount] = await Promise.all([
      User.count({ where: { role: 'student', schoolId: req.session.user.schoolId } }),
      User.count({ where: { role: 'teacher', schoolId: req.session.user.schoolId  } }),
      Course.count({ where: { schoolId: req.session.user.schoolId  } }),
      Class.count({ where: { schoolId: req.session.user.schoolId  } })
    ]);
    res.render('admin/dashboard', {
      user: req.session.user,
      studentCount,
      teacherCount,
      courseCount,
      classCount, 
      apps: nosApps,
      username: req.session.user.username,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur interne');
  }
});

router.get('/register', async (req, res) => {
    res.render('admin/register');
});

router.get('/choose-abonnement', async (req, res) => {
  if (req.session && req.session.user?.abonnement){
    return res.redirect('/admin/changeAbonnement');
  }else{
    res.render('chooseAbonnement');
  }
});

router.get('/change-abonnement', async (req, res) => {
  if (!req.session){
    return res.redirect('/admin');
  }else{
    res.render('changeAbonnement');
  }
});

router.post('/register',
  upload.fields([
    { name: 'profile', maxCount: 1 },
    { name: 'cv', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      if (!req.session.abonnement){
          return res.redirect('/admin/choose-abonnement');
      }
      console.log(req.session.abonnement.abonnement);
      const { name, email, password, bio, username, contact, country, birthdate, firstname, offers, level } = req.body;

      console.log(req.body);

      // Vérifier si un utilisateur avec l'email existe déjà
      const existingUser = await User.findOne({ where: { contact: email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
      }

      console.log("1");

      // Fichiers
      const profilePath = req.files.profile ? `/pr/schoolData/${req.files.profile[0].filename}` : null;
      const cvPath = req.files.cv ? `/pr/schoolFiles/${req.files.cv[0].filename}` : null;

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
        role: "admin",
        profile: profilePath,
        cv: cvPath,
        country,
        birthdate,
        offers,
        level,
        abonnement: req.session.abonnement.abonnement
      });

      req.session.user = {
        id: user.id,
        username: user.username,
        profile: user.profile,
        contact: user.email,
        role: user.role,
        subscriptionType : user.abonnement, 
        role: user.role,
        abonnement:user.abonnement,
        schoolId: user.schoolId
      };

      // on redirige vers la config de l’école
      res.redirect('/admin/setup-school');
      //res.redirect('/admin');
    } catch (err) {
      console.error('Erreur lors de l\'inscription du admin:', err);
      res.status(500).json({ error: 'Erreur lors de l\'inscription' });
    }
  }
);

// Affiche le formulaire de config
router.get('/setup-school', async (req, res) => {
  // tu peux récupérer l’admin si besoin : req.session.user.id
  const isAdmin = (req.session.user && req.session.user.role == 'admin')
  res.render('admin/setup_school', {
    action: '/admin/setup-school',
    school: req.session.user?.schoolId || null,
    isAdmin
  });
});

// Reçoit les infos de l’école et crée la School
router.post(
  '/setup-school',
  upload.single('logo'),
  async (req, res) => {
    try {
      const { name, primaryColor, secondaryColor, contactEmail, contactPhone, contactAddress, fontFamily, slug } = req.body;
      const logoPath = req.file ? `/pr/schoolData/${req.file.filename}` : null;
      const sId = req.session.user?.schoolId || req.body.schoolId || null;
      let limitmembers;

      const abonnement = req.session.user?.abonnement || null;
      if (abonnement == 'School') {
        limitmembers = 1000;
      } else {
        limitmembers = 10000;
      }
      

      let school; // ✅ portée commune
      if (!sId) {
        // Création
        school = await School.create({
          name,
          primaryColor,
          secondaryColor,
          logo: logoPath || null,
          contactEmail,
          contactPhone,
          contactAddress,
          fontFamily,
          slug,
          admin : req.session.user.id,
          abonnement,
          limitmembers
        });

        // (optionnel) rattacher l’admin à la nouvelle école
        // await req.user.update({ schoolId: school.id });

        // 2) rattachement de l’admin à cette école
        await User.update(
          { schoolId: school.id },
          { where: { id: req.session.user.id } }
        );
      } else {
        // Mise à jour
        school = await School.findByPk(sId);
        if (!school) return res.status(404).json({ error: "École introuvable" });

        // Ne pas écraser le logo si pas de nouveau fichier
        const updates = {
          name,
          primaryColor,
          secondaryColor,
          contactEmail,
          contactPhone,
          contactAddress
        };
        if (logoPath) updates.logo = logoPath;

        school = await school.update(updates); // renvoie l’instance mise à jour
      }

      console.log(school.id, school.name);

      

      // 3) on peut stocker la school en session si besoin
      req.session.school = { id: school.id, name: school.name };
      req.session.schoolId = school.id;
      req.session.user.schoolId = school.id;

      // 4) redirection vers le dashboard
      return res.redirect('/admin');
    } catch (err) {
      console.error('Erreur setup school:', err);
      res.status(500).render('admin/setup_school', {
        error: 'Impossible de configurer l’école, réessayez.',
        action: '/admin/setup-school'
      });
    }
  }
);

router.post(
  '/editSchool',
  upload.single('logo'),
  async (req, res) => {
    try {
      if (!req.session.user){
        res.status(500).render('admin/editSchool', {
        error: 'Impossible de configurer l’école, réessayez.',
        action: '/admin/editSchool'
      });
      }
      const { name, primaryColor, secondaryColor, contactEmail, contactPhone, contactAddress, fontFamily, slug, domain } = req.body;
      const school = await School.findByPk(sId);
        if (!school) return res.status(404).json({ error: "École introuvable" });

        // Ne pas écraser le logo si pas de nouveau fichier
        const updates = {
          name,
          primaryColor,
          secondaryColor,
          contactEmail,
          contactPhone,
          contactAddress,
          fontFamily,
          slug,
          domain
        };
        if (logoPath) updates.logo = logoPath;

        school = await school.update(updates); // renvoie l’instance mise à jour
    } catch {
      res.status(500).render('admin/editSchool', {
        error: 'Impossible de configurer l’école, réessayez.',
        action: '/admin/editSchool'
      });
    }
  });

//
// Gestion des étudiants
//
router.get('/students', async (req, res) => {
  const students = await User.findAll({ where: { role: 'student' } });
  res.render('admin/students', { students });
});

router.get('/students/new', async (req, res) => {
  const classes = await Class.findAll({where: {schoolId: req.session.user.schoolId}})
  res.render('admin/student_form', { action: '/admin/students', user: {}, classes });
});

router.post(
  '/students',
  upload.single('image'),           // on prend un seul fichier “image”
  async (req, res) => {
    try {
      // 1) Chemin vers l’image si upload
      const imagePath = req.file
        ? `/rv/images/${req.file.filename}`
        : null;
      let password = req.body.password;

      const hashedPassword = await bcrypt.hash(password + process.env.PEPPER, 12);
      console.log('pepper: ', process.env.PEPPER);

      // 2) Créer l’utilisateur
      const usere = await User.create({
        name:      req.body.name,
        firstname: req.body.firstname,
        username:  req.body.username,
        birthdate: req.body.birthdate,
        contact:   req.body.contact,
        password:  hashedPassword,
        role:      'student',
        schoolId:  req.session.user.schoolId,
        classId:   req.body.classId,    // lien vers la classe
        profile:   imagePath            // on stocke dans la colonne profile
      });
      console.log(usere.name, usere.password);

      res.redirect('/admin/students');
    } catch (err) {
      console.error(err);
      res.status(500).send('Erreur création étudiant');
    }
  }
);

router.get('/students/:id/edit', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  res.render('admin/student_form', {
    action: `/admin/students/${req.params.id}`,
    user
  });
});

router.post(
  '/students/:id',
  upload.single('image'),          // idem : on gère l’upload
  async (req, res) => {
    try {
      const updates = {
        name:      req.body.name,
        firstname: req.body.firstname,
        username:  req.body.username,
        birthdate: req.body.birthdate,
        contact:   req.body.contact,
        role:      req.body.role,
        classId:   req.body.classId
      };
      // si un nouveau fichier est uploadé, on remplace
      if (req.file) {
        updates.profile = `/rv/images/${req.file.filename}`;
      }

      await User.update(
        updates,
        { where: { id: req.params.id } }
      );
      res.redirect('/admin/students');
    } catch (err) {
      console.error(err);
      res.status(500).send('Erreur mise à jour étudiant');
    }
  }
);


router.delete('/students/:id', async (req, res) => {
  try {
    await User.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

//
// Gestion des professeurs
//
router.get('/teachers', async (req, res) => {
  const teachers = await User.findAll({ where: { role: 'teacher', schoolId: req.session.user.schoolId } });
  res.render('admin/teachers', { teachers });
});

router.get('/teachers/new', (req, res) => {
  res.render('admin/teacher_form', { action: '/admin/teachers', user: {} });
});

router.post('/teacherse', async (req, res) => {
  try {
    await User.create({ ...req.body, role: 'teacher' });
    res.redirect('/admin/teachers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur création professeur');
  }
});

router.post(
  '/teachers',
  upload.single('image'),           // on prend un seul fichier “image”
  async (req, res) => {
    try {
      // 1) Chemin vers l’image si upload
      const imagePath = req.file
        ? `/rv/images/${req.file.filename}`
        : null;
      let password = req.body.password;

      const hashedPassword = await bcrypt.hash(password + process.env.PEPPER, 12);
      console.log('pepper: ', process.env.PEPPER);

      // 2) Créer l’utilisateur
      const usere = await User.create({
        name:      req.body.name,
        firstname: req.body.firstname,
        username:  req.body.username,
        birthdate: req.body.birthdate,
        contact:   req.body.contact,
        password:  hashedPassword,
        role:      'teacher',
        schoolId:  req.session.user.schoolId,
        classId:   req.body.classId,    // lien vers la classe
        profile:   imagePath,           // on stocke dans la colonne profile
        abonnement: req.session.user.abonnement
      });
      console.log(usere.name, usere.password);

      res.redirect('/admin/teachers');
    } catch (err) {
      console.error(err);
      res.status(500).send('Erreur création étudiant');
    }
  }
);

router.get('/teachers/:id/edit', async (req, res) => {
  const user = await User.findByPk(req.params.id);
  res.render('admin/teacher_form', {
    action: `/admin/teachers/${req.params.id}`,
    user
  });
});

router.post('/teachers/:id', async (req, res) => {
  try {
    await User.update(req.body, { where: { id: req.params.id } });
    res.redirect('/admin/teachers');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur mise à jour professeur');
  }
});

router.delete('/teachers/:id', async (req, res) => {
  try {
    await User.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

//
// Gestion des cours
//
router.get('/courses', async (req, res) => {
  const courses = await Course.findAll();
  res.render('admin/courses', { courses });
});

router.get('/courses/new', (req, res) => {
  res.render('admin/course_form', { action: '/admin/courses', course: {} });
});

router.post('/courses', async (req, res) => {
  try {
    await Course.create(req.body);
    res.redirect('/admin/courses');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur création cours');
  }
});

router.get('/courses/:id/edit', async (req, res) => {
  const course = await Course.findByPk(req.params.id);
  res.render('admin/course_form', {
    action: `/admin/courses/${req.params.id}`,
    course
  });
});

router.post('/courses/:id', async (req, res) => {
  try {
    await Course.update(req.body, { where: { id: req.params.id } });
    res.redirect('/admin/courses');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erreur mise à jour cours');
  }
});

router.delete('/courses/:id', async (req, res) => {
  try {
    await Course.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.json({ success: false });
  }
});

// routes/admin.js (assure-toi d'avoir isAuthenticated et isAdmin appliqués avant)
router.get('/classes', async (req, res) => {
  try {
    const classes = await Class.findAll({
      include: [
        {
          model: User,
          as: 'students',
          attributes: ['id', 'username', 'name', 'profile']
        },
        {
          model: Course,
          as: 'Courses',
          attributes: ['id', 'name']
        }
      ]
    });

    res.render('admin/classes', { classes });
  } catch (err) {
    console.error('Erreur chargement des classes :', err);
    res.status(500).render('error', { message: 'Impossible de récupérer les classes.' });
  }
});

// routes/admin.js (assure-toi d'avoir isAuthenticated et isAdmin appliqués avant)
router.get('/api/classes', async (req, res) => {
  try {
    const classes = await Class.findAll({
      include: [
        {
          model: User,
          as: 'students',
          attributes: ['id', 'username', 'name', 'profile']
        },
        {
          model: Course,
          as: 'Courses',
          attributes: ['id', 'name']
        }
      ]
    });

    res.json(classes);
  } catch (err) {
    console.error('Erreur chargement des classes :', err);
    res.status(500).render('error', { message: 'Impossible de récupérer les classes.' });
  }
});

router.get('/classes/new', async (req, res) => {
  try {

    res.render('admin/newClass');
  } catch (err) {
    console.error('Erreur chargement des classes :', err);
    res.status(500).render('error', { message: 'Impossible de récupérer les classes.' });
  }
});

// POST /classes — reçoit le form et crée la classe
router.post('/classes/create', async (req, res) => {
  const { name } = req.body;
  const schoolId  = req.session.user?.schoolId;

  if (!schoolId) {
    return res.status(403).send('Vous devez être connecté pour créer une classe.');
  }

  try {
    await Class.create({
      name,
      schoolId
      // ajoutez d’autres champs ici si votre modèle en a (ex : description)
    });
    // redirigez vers la liste des classes ou la page de la nouvelle classe
    res.redirect('/admin/classes');
  } catch (err) {
    console.error("Erreur création classe :", err);
    res.status(500).send("Impossible de créer la classe.");
  }
});

// GET /admin/classes/:id/students — afficher le form de gestion
router.get('/classes/:id/students', async (req, res) => {
  const classId = req.params.id;
  const cls     = await Class.findByPk(classId, {
    include: [{ model: User, as: 'students' }]
  });
  const allStudents = await User.findAll({
    where: { role: 'student', schoolId: req.session.user.schoolId }
  });
  res.render('admin/editClassStudents', { cls, allStudents, theme: res.locals.theme });
});

router.get('/classes/:id/courses2', async (req, res) => {
  try {
    const classId = req.params.id;

    // 🔍 Récupérer la classe avec ses cours associés
    const cls = await Class.findByPk(classId, {
      include: [{ model: Course, as: 'courses' }]
    });

    if (!cls) return res.status(404).send("Classe introuvable");

    // 🧮 Trouver les IDs des cours déjà associés à la classe
    const linkedCourses = await ClassCourse.findAll({
      where: { classId },
      attributes: ['courseId']
    });
    const linkedCourseIds = linkedCourses.map(c => c.courseId);

    // 📚 Trouver tous les cours de l’école non encore associés à cette classe
    const allCoursesWithoutClass = await Course.findAll({
      where: {
        id: { [Op.notIn]: linkedCourseIds },
        schoolId: req.session.user.schoolId
      }
    }); console.log(allCoursesWithoutClass),

    // 🖼️ Affichage dans la vue
    res.render('admin/editClassCourses', {
      cls,
      allCoursesWithoutClass,
      linkedCourses,
      theme: res.locals.theme
    });

  } catch (err) {
    console.error("Erreur route /classes/:id/courses :", err);
    res.status(500).send("Erreur serveur");
  }
});

router.get('/classes/:id/courses', async (req, res) => {
  try {
    const classId = req.params.id;

    const cls = await Class.findByPk(classId, {
      include: [{ model: Course, as: 'Courses', attributes: ['id', 'name'] }]
    });
    if (!cls) return res.status(404).send("Classe introuvable");

    const linkedCourseIds = cls.Courses.map(c => c.id);

    const allCoursesWithoutClass = await Course.findAll({
      where: {
        id: { [Op.notIn]: linkedCourseIds },
        schoolId: req.session.user.schoolId
      },
      attributes: ['id', 'name',]
    });

    res.render('admin/editClassCourses', {
      cls,
      allCoursesWithoutClass,
      theme: res.locals.theme
    });
  } catch (err) {
    console.error("Erreur route /classes/:id/courses :", err);
    res.status(500).send("Erreur serveur");
  }
});


// POST /admin/classes/:id/students — traiter le form
router.post('/classes/:id/students', async (req, res) => {
  const classId     = req.params.id;
  const selectedIds = Array.isArray(req.body.students)
    ? req.body.students.map(id => parseInt(id, 10))
    : req.body.students
      ? [parseInt(req.body.students, 10)]
      : [];

  const cls = await Class.findByPk(classId);
  // Remet à jour l’association M:N : supprime/ajoute au besoin
  await cls.setStudents(selectedIds);

  res.redirect('/admin/classes');
});

// POST /admin/classes/:id/delete — supprimer la classe
router.post('/classes/:id/delete', async (req, res) => {
  await Class.destroy({ where: { id: req.params.id } });
  res.redirect('/admin/classes');
});

 
router.get('/school', async (req, res) => {
  try {
    // On récupère l’ID de l’école en session
    const schoolId = req.session.user.schoolId ;
    if (!schoolId) return res.redirect('/admin/setup-school');
    
    const school = await School.findByPk(schoolId);
    if (!school) throw new Error('École introuvable');

    res.render('admin/editSchool', {
      school,
      theme: res.locals.theme
    });
  } catch (err) {
    console.error('Erreur GET /admin/school', err);
    res.status(500).render('error', { message: 'Impossible de charger le formulaire.' });
  }
});

/**
 * POST /admin/school
 * Traite le formulaire et met à jour l’école
 */
router.post('/school',
  upload.single('logo'),  // champ file name="logo"
  async (req, res) => {
    try {
      const schoolId = req.session.user.schoolId;
      if (!schoolId) return res.redirect('/admin/setup-school');
      
      // Prépare les champs à mettre à jour
      const updates = {
        name:           req.body.name,
        primaryColor:   req.body.primaryColor,
        secondaryColor: req.body.secondaryColor,
        contactEmail:   req.body.contactEmail,
        contactPhone:   req.body.contactPhone,
        contactAddress: req.body.contactAddress,
        fontFamily: req.body.fontFamily,
        slug: req.body.slug,
        domain: req.body.domain
      };
      // Si un nouveau logo a été uploadé
      if (req.file) {
        updates.logo = `/pr/schoolData/${req.file.filename}`;
      }

      // Applique la mise à jour
      await School.update(updates, { where: { id: schoolId } });

      // Met à jour la session (si vous l'utilisez ailleurs)
      req.session.user.schoolId =   schoolId,
      

      res.redirect('/admin/school');
    } catch (err) {
      console.error('Erreur POST /admin/school', err);
      res.status(500).render('admin/editSchool', {
        school:   { ...req.body, id: req.session.school?.id, logo: req.file && `/pr/schoolData/${req.file.filename}` },
        theme:    res.locals.theme,
        error:    'Impossible de sauvegarder les modifications.'
      });
    }
  }
);

router.post('/classes/:id/courses', async (req, res) => {
  const classId = req.params.id;
  console.log("=============================================================");
  console.log(req.body.courses);

  const selectedIds = Array.isArray(req.body.courses)
    ? req.body.courses.map(id => parseInt(id, 10))
    : req.body.courses
      ? [parseInt(req.body.courses, 10)]
      : [];

  if (!req.session.user?.schoolId) {
    return res.status(403).send('Non autorisé.');
  }

  try {
    // Classe + élèves
    const cls = await Class.findByPk(classId, {
      include: [{ model: User, as: 'students', where: { role: 'student' }, required: false }]
    });
    if (!cls) return res.status(404).send('Classe introuvable');

    const studentIds = (cls.students || []).map(s => s.id);

    // Cours actuellement liés (via helpers → plus de souci de noms de colonnes)
    const current = await cls.getCourses({ joinTableAttributes: [] });
    const currentIds = current.map(c => c.id);

    // Diffs pour l’inscription élèves
    const toAddIds    = selectedIds.filter(id => !currentIds.includes(id));
    const toRemoveIds = currentIds.filter(id => !selectedIds.includes(id));

    // Sync classe ⇄ cours (source of truth = selectedIds)
    await cls.setCourses(selectedIds);  // <-- évite la casse CourseId/classId

    // Helpers pour élèves ⇄ cours (alias 'students' côté Course⇄User)
    const addStudentsToCourse = async (courseId, ids) => {
      if (!ids.length) return;
      const course = await Course.findByPk(courseId);
      if (!course) return;
      await course.addStudents(ids, { ignoreDuplicates: true });
    };
    const removeStudentsFromCourse = async (courseId, ids) => {
      if (!ids.length) return;
      const course = await Course.findByPk(courseId);
      if (!course) return;
      await course.removeStudents(ids);
    };

    // Inscrire/désinscrire
    for (const courseId of toAddIds)    await addStudentsToCourse(courseId, studentIds);
    for (const courseId of toRemoveIds) await removeStudentsFromCourse(courseId, studentIds);

    // Revenir à la liste (si tu préfères rester sur la page: redirige vers `/admin/classes/${classId}/courses`)
    res.redirect('/admin/classes');

  } catch (err) {
    console.error('Erreur POST /admin/classes/:id/courses :', err);
    res.status(500).send('Erreur lors de la mise à jour des cours de la classe.');
  }
});

router.get('/api/classes', async (req, res) => {
  const schoolId = req.session.user?.schoolId || req.query.schoolId;
  if (!schoolId) return res.status(400).json({ error: 'schoolId requis' });

  const classes = await Class.findAll({
    where: { schoolId },
    attributes: ['id', 'name'] // adapte aux colonnes réelles
  });

  res.json(classes);
});


router.get('/calendar', (req, res) => {
  if (req.session.user.role === 'teacher' || req.session.user.role === 'admin'){
    res.render('calendar/calendar');
  } else {
    res.render('calendar/studentCalendar'); // va chercher views/calendar.ejs
  }
});

// routes/events.js
router.get('/calendar/events', async (req, res) => {
  const schoolId = req.session.user?.schoolId || null
  const { start, end } = req.query;
  if (!schoolId || !start || !end) return res.status(400).json({ error: 'schoolId, start et end requis' });

  

  const startDate = new Date(start);
  const endDate   = new Date(end);

  const events = await Event.findAll({
    where: {
      schoolId,
      [Op.and]: [
        { startDate: { [Op.lt]: endDate } },     // start < endWindow
        { [Op.or]: [
            { endDate: { [Op.gte]: startDate } },// end >= startWindow
            { endDate: null }                // ou sans fin
        ] }
      ]
    },
    order: [['startDate', 'ASC']]
  });
  res.json(events);
});

router.post('/calendar/events', async (req, res) => {
  // check role: prof/admin
  const ev = await Event.create({ ...req.body, schoolId: req.session.user.schoolId, createdById: req.session.user.id });
  //if (ev.notify) await notificationQueue.add('send', { eventId: ev.id }); // Bull/Redis
  res.status(201).json(ev);
});

router.put('/calendar/events/:id', async (req, res) => {
  const ev = await Event.findByPk(req.params.id);
  const before = ev.notify;
  await ev.update(req.body);
  //if (!before && ev.notify) await notificationQueue.add('send', { eventId: ev.id });
  res.json(ev);
});





module.exports = router;
