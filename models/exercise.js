const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Exercise = sequelize.define('Exercise', { 
    title: { type: DataTypes.STRING, allowNull: false },
    author: { type: DataTypes.STRING, allowNull: false, defaultValue: 'IT-Star' },  
    course: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false }, // 'qcm', 'programmation', 'redaction'
    description: { type: DataTypes.TEXT, allowNull: false }, 

    // Champs pour QCM
    questions: {
      type: DataTypes.JSON, // Stocke un tableau de questions avec choix et réponses correctes
      allowNull: true
    },

    // Champs pour la programmation
    solution: { type: DataTypes.TEXT, allowNull: true },
    starterCode: { type: DataTypes.TEXT, allowNull: true },
    expectedOutput: { type: DataTypes.TEXT, allowNull: true },
    testCases: { type: DataTypes.JSON, allowNull: true },

    // Champs pour la rédaction
    evaluationCriteria: { 
      type: DataTypes.JSON, // Ex: { "clarté": 5, "argumentation": 5, "orthographe": 5 }
      allowNull: true 
    },
    // Champs pour « texte à trous »
    textWithBlanks: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    blanksAnswers: {
      type: DataTypes.JSON,
      allowNull: true
    },
    linktofile: { 
      type: DataTypes.STRING, // Stocke l'URL ou le chemin vers le devoir
      allowNull: true 
    },
    // Champ pour devoir de type fichier à rendre
    fileType: { 
      type: DataTypes.STRING, // Le type de fichiers
      allowNull: true 
    },
    fileSize: { 
      type: DataTypes.STRING, // Stocke l'URL ou le chemin vers le devoir
      allowNull: true 
    }
    
  });

  return Exercise;
};
