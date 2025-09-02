const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Class = sequelize.define('Class', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    schoolId: {type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Schools', key: 'id' }
    }
  });

  Class.associate = (models) => {
    // Une classe a plusieurs élèves
    Class.hasMany(models.User, { foreignKey: 'classId', as: 'students' });

    // Une classe a plusieurs cours
    Class.belongsToMany(models.Course, { through: 'ClassCourses', foreignKey: 'classId', otherKey: 'courseId', as: 'courses' });

    Class.belongsTo(models.School, {
      foreignKey: 'schoolId', 
      as: 'school' });
  };

  return Class;
};
