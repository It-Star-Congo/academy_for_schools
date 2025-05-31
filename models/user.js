const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    username: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      unique: true 
    },
    contact: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      unique: true 
    },
    password: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    role: { // Ajout d’un rôle (étudiant ou professeur)
      type: DataTypes.ENUM('student', 'teacher'),
      allowNull: false,
      defaultValue: 'student'
    },
    firstname: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    name: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    birthdate: { 
      type: DataTypes.DATEONLY,  // Stocke uniquement la date (YYYY-MM-DD)
      allowNull: false 
    },
    country: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    level: { 
      type: DataTypes.STRING, 
      allowNull: true
    },
    profile: { 
      type: DataTypes.STRING, // Stocke l'URL ou le chemin vers la photo
      allowNull: true 
    },
    cv: { 
      type: DataTypes.STRING, // Stocke l'URL ou le chemin vers le CV
      allowNull: true 
    },
    offers: { 
      type: DataTypes.BOOLEAN, 
      allowNull: false, 
      defaultValue: false 
    },
    abonnement:{
      type: DataTypes.STRING,
      defaultValue: 'academic', 
      allowNull: false,
    },
    bio: { 
      type: DataTypes.TEXT, 
      allowNull: true 
    },
  });



  // Association avec les cours (un utilisateur peut être inscrit à plusieurs cours)
  User.associate = (models) => {
    User.belongsToMany(models.Course, { 
      through: 'UserCourses', 
      foreignKey: 'userId',
      otherKey: 'courseId',
      as: 'courses' 
    });
  };

  return User;
};
