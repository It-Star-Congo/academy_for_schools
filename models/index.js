const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  //storage: './database.sqlite3',
  storage: './productiontest5.sqlite3',
  logging: false
});

// Importation des modèles
const User = require('./user')(sequelize);
const Course = require('./course')(sequelize);
const Exercise = require('./exercise')(sequelize);
const Submission = require('./submission')(sequelize);
const ForumPost = require('./forumPost')(sequelize);
const Class = require('./class')(sequelize);
const ClassCourse = require('./classCourse')(sequelize);
const School     = require('./school')(sequelize);



/*/ Appel des méthodes associate() définies dans les modèles
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});*/

// Définition des associations
User.hasMany(Submission, { onDelete: 'CASCADE' });
Submission.belongsTo(User);



Exercise.hasMany(Submission, { onDelete: 'CASCADE' });
Submission.belongsTo(Exercise, {
  foreignKey: 'exerciseId'
  // pas de `as:` ici → Sequelize utilisera le nom du modèle, c.-à-d. "Exercise"
});


Course.hasMany(ForumPost, { foreignKey: 'courseId' });
ForumPost.belongsTo(Course, { foreignKey: 'courseId' });

// Relation Many-to-Many entre User et Course (étudiants inscrits)
User.belongsToMany(Course, { through: 'UserCourses', as: 'enrolledCourses' });

// === Ajout manuel des associations ForumPost ===
Course.hasMany(ForumPost, { foreignKey: 'courseId', onDelete: 'CASCADE' });
ForumPost.belongsTo(Course, { foreignKey: 'courseId', as: 'course', onDelete: 'CASCADE' });

// Auto-références : réponses et parent
ForumPost.hasMany(ForumPost, { as: 'replies', foreignKey: 'parentId' });
ForumPost.belongsTo(ForumPost, { as: 'parent', foreignKey: 'parentId' });

User.associate({ Course, Class, School });
Course.associate({ User, Exercise, Class, School });
Class.associate({ User, Course, School });

Class.belongsToMany(Course, { through: ClassCourse, foreignKey: 'classId', otherKey: 'courseId' });
Course.belongsToMany(Class, { through: ClassCourse, foreignKey: 'courseId', otherKey: 'classId' });


// ─── Associations School <-> Autres ──────────────────────────────────────────
// 1 School a plusieurs Users, Courses, Exercises, Submissions, ForumPosts
//School.hasMany(User,       { foreignKey: 'schoolId', as: 'users',       onDelete: 'CASCADE' });
//School.hasMany(Course,     { foreignKey: 'schoolId', as: 'courses',     onDelete: 'CASCADE' });
//School.hasMany(Exercise,   { foreignKey: 'schoolId', as: 'exercises',   onDelete: 'CASCADE' });
//School.hasMany(Submission, { foreignKey: 'schoolId', as: 'submissions', onDelete: 'CASCADE' });

// Chaque entité appartient à une seule School
//User.belongsTo(School,       { foreignKey: 'schoolId', as: 'school' });
//Course.belongsTo(School,     { foreignKey: 'schoolId', as: 'school' });
//Exercise.belongsTo(School,   { foreignKey: 'schoolId', as: 'school' });
//Submission.belongsTo(School, { foreignKey: 'schoolId', as: 'school' });

const syncDB = async () => {
  try {
    await sequelize.sync({ force: false });
    console.log('Base de données synchronisée.');
  } catch (error) {
    console.error('Erreur de synchronisation avec la base de données :', error);
  }
};

module.exports = { sequelize, syncDB, User, Course, Exercise, Submission, ForumPost, Class, ClassCourse, School };
