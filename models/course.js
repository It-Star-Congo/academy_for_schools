const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Course = sequelize.define('Course', { 
    name: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    description: { 
      type: DataTypes.STRING,
      allowNull: true 
    },
    teacher: {
      type: DataTypes.STRING,
      allowNull: false
    },
    image: { 
      type: DataTypes.STRING,
      allowNull: true 
    },
    documents: {  // ➕ Ajout du champ pour les fichiers PDF, MP3, MP4, etc.
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
    },
    schoolId: {type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Schools', key: 'id' }
    }
    //,
     //students: {  // ➕ Ajout du champ pour la liste des etudiants inscrits
      //type: DataTypes.JSONB,
     // allowNull: true,
     // defaultValue: []
    //}
  });

  Course.associate = (models) => {
    Course.hasMany(models.Exercise, {
      foreignKey: 'courseId',
      as: 'exercises'
    });

    // Un cours peut avoir plusieurs étudiants inscrits
    Course.belongsToMany(models.User, { 
        through: 'UserCourses', 
        foreignKey: 'courseId',
        otherKey: 'userId',
        as: 'students'
    });

    Course.belongsToMany(models.Class, { 
      through: 'ClassCourses', 
      foreignKey: 'courseId', 
      otherKey: 'classId' 
    });
    Course.belongsTo(models.School, {
      foreignKey: 'schoolId', 
      as: 'school' });

  };

  return Course;
};
