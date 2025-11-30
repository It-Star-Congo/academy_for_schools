// models/school.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const School = sequelize.define('School', {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    primaryColor: {
      type: DataTypes.STRING,
      allowNull: true
    },
    secondaryColor: {
      type: DataTypes.STRING,
      allowNull: true
    },
    logo: {
      type: DataTypes.STRING, // URL ou chemin du logo
      allowNull: true
    },
    contactEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    contactPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    contactAddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fontFamily: {
      type: DataTypes.STRING,
      allowNull: true
    },
    abonnement: {
      type: DataTypes.ENUM('free', 'pro', 'school', 'unlimited'),
      allowNull: false
    },
    admin: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    domain: {
      type: DataTypes.STRING,
      allowNull: true
    },
    limitmembers: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Ajoute ici tout autre paramètre de personnalisation
    
    apps: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    paid: {
      type: DataTypes.BOOLEAN,
      defaultValue : 'true'
    },
    paiementHistory: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  });

  School.associate = (models) => {
    School.hasMany(models.User,       { foreignKey: 'schoolId',  as: 'users' });
    School.hasMany(models.Course,     { foreignKey: 'schoolId',  as: 'courses' });
    School.hasMany(models.Exercise,   { foreignKey: 'schoolId',  as: 'exercises' });
    School.hasMany(models.Submission, { foreignKey: 'schoolId',  as: 'submissions' });
    // si tu as d’autres modèles : idem
  };

  return School;
};
