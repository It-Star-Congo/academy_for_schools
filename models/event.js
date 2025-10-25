// models/Event.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Event = sequelize.define('Event', {
    title: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    description: { 
      type: DataTypes.TEXT
    },
    startDate: { 
      type: DataTypes.DATE, 
      allowNull: false 
    },
    endDate: { 
      type: DataTypes.DATE 
    },
    importance: { 
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'), 
      defaultValue: 'low'
    },
    location: { 
      type: DataTypes.STRING 
    },
    notify: { 
      type: DataTypes.BOOLEAN, defaultValue: false },
    type: { 
      type: DataTypes.ENUM('cours', 'examen', 'devoir', 'evenement'),
      allowNull: false
    },
    // <- ICI: DataTypes.JSONB (pas "JSONB" nu)
    classes: { type: DataTypes.JSONB, defaultValue: [] } // array d'IDs de classes
  });

  Event.associate = (models) => {
    Event.belongsTo(models.User, { as: 'createdBy', foreignKey: { name: 'createdById', allowNull: false }});
    // Ici on veut un FK "schoolId" (pas un alias as: 'schoolId')
    Event.belongsTo(models.School, { foreignKey: { name: 'schoolId', allowNull: false }});
  };

  return Event;
};
