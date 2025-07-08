const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Submission = sequelize.define('Submission', { 
    code: { type: DataTypes.TEXT, allowNull: true},  
    data: { type: DataTypes.JSON, allowNull: true},
    result: { type: DataTypes.STRING }, 
    score: { type: DataTypes.FLOAT } 
  });

  return Submission;
};
