const { Sequelize } = require('sequelize');

const isProd = process.env.NODE_ENV === 'production';

let sequelize;

if (isProd) {
  // ✅ PROD : PostgreSQL (Railway, Render, etc.)
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: false,
    dialectOptions: {
      // Sur Railway / hébergeur cloud, souvent SSL est activé
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
} else {
  // ✅ DEV : SQLite local
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './productiontest8.sqlite3',  // ou ./dev.sqlite3 si tu préfères
    logging: false
  });
}

// ──────────────────────────────────────────────────────
// Importation des modèles
// ──────────────────────────────────────────────────────
const User       = require('./user')(sequelize);
const Course     = require('./course')(sequelize);
const Exercise   = require('./exercise')(sequelize);
const Submission = require('./submission')(sequelize);
const ForumPost  = require('./forumPost')(sequelize);
const Class      = require('./class')(sequelize);
const ClassCourse= require('./classCourse')(sequelize);
const School     = require('./school')(sequelize);
const Event      = require('./event')(sequelize);

// ──────────────────────────────────────────────────────
// Associations (comme tu avais déjà)
// ──────────────────────────────────────────────────────

User.hasMany(Submission, { onDelete: 'CASCADE' });
Submission.belongsTo(User);

Exercise.hasMany(Submission, { onDelete: 'CASCADE' });
Submission.belongsTo(Exercise);

Course.hasMany(ForumPost, { foreignKey: 'courseId' });
ForumPost.belongsTo(Course, { foreignKey: 'courseId' });

// Relation Many-to-Many entre User et Course (étudiants inscrits)
User.belongsToMany(Course, { 
  through: 'UserCourses', 
  as: 'enrolledCourses',
  foreignKey: 'userId',
  otherKey: 'courseId'
});

// ForumPost (duplicat, mais je garde ce que tu avais)
Course.hasMany(ForumPost, { foreignKey: 'courseId', onDelete: 'CASCADE' });
ForumPost.belongsTo(Course, { foreignKey: 'courseId', as: 'course', onDelete: 'CASCADE' });

// Auto-références ForumPost
ForumPost.hasMany(ForumPost, { as: 'replies', foreignKey: 'parentId' });
ForumPost.belongsTo(ForumPost, { as: 'parent', foreignKey: 'parentId' });

User.associate({ Course, Class, School });
Course.associate({ User, Exercise, Class, School });
Class.associate({ User, Course, School });
Event.associate({ User, School });

Class.belongsToMany(Course, { through: ClassCourse, foreignKey: 'classId', otherKey: 'courseId' });
Course.belongsToMany(Class, { through: ClassCourse, foreignKey: 'courseId', otherKey: 'classId' });

// ──────────────────────────────────────────────────────
// Sync DB
// ──────────────────────────────────────────────────────
const syncDB = async () => {
  try {
    if (isProd) {
      // ⚠️ En prod, évite force:true.
      await sequelize.sync({ alter: false });
    } else {
      // En dev tu peux jouer avec alter:true si tu modifies les modèles
      await sequelize.sync({ alter: true });
    }
    console.log('Base de données synchronisée.');
  } catch (error) {
    console.error('Erreur de synchronisation avec la base de données :', error);
  }
};

module.exports = { 
  sequelize, 
  syncDB, 
  User, 
  Course, 
  Exercise, 
  Submission, 
  ForumPost, 
  Class, 
  ClassCourse, 
  School, 
  Event 
};
