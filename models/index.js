const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  //storage: './database.sqlite3',
  storage: './productiontest.sqlite3',
  logging: false
});

// Importation des modèles
const User = require('./user')(sequelize);
const Course = require('./course')(sequelize);
const Exercise = require('./exercise')(sequelize);
const Submission = require('./submission')(sequelize);
const ForumPost = require('./forumPost')(sequelize);

/*/ Appel des méthodes associate() définies dans les modèles
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});*/

// Définition des associations
User.hasMany(Submission, { onDelete: 'CASCADE' });
Submission.belongsTo(User);

Course.hasMany(Exercise, { onDelete: 'CASCADE' });
Exercise.belongsTo(Course);

Exercise.hasMany(Submission, { onDelete: 'CASCADE' });
Submission.belongsTo(Exercise);

Course.hasMany(ForumPost, { foreignKey: 'courseId' });
ForumPost.belongsTo(Course, { foreignKey: 'courseId' });

// Relation Many-to-Many entre User et Course (étudiants inscrits)
User.belongsToMany(Course, { through: 'CourseStudents', as: 'enrolledCourses' });
Course.belongsToMany(User, { through: 'CourseStudents', as: 'students' });

// === Ajout manuel des associations ForumPost ===
Course.hasMany(ForumPost, { foreignKey: 'courseId', onDelete: 'CASCADE' });
ForumPost.belongsTo(Course, { foreignKey: 'courseId', as: 'course', onDelete: 'CASCADE' });

// Auto-références : réponses et parent
ForumPost.hasMany(ForumPost, { as: 'replies', foreignKey: 'parentId' });
ForumPost.belongsTo(ForumPost, { as: 'parent', foreignKey: 'parentId' });


const syncDB = async () => {
  try {
    await sequelize.sync({ force: false });
    console.log('Base de données synchronisée.');
  } catch (error) {
    console.error('Erreur de synchronisation avec la base de données :', error);
  }
};

module.exports = { sequelize, syncDB, User, Course, Exercise, Submission, ForumPost };
