const { DataTypes } = require('sequelize');  // Assure-toi que cela est bien présent

module.exports = (sequelize) => {
  const ForumPost = sequelize.define('ForumPost', {
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    author: {
      type: DataTypes.STRING,
      allowNull: false
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  });

  ForumPost.associate = (models) => {
    // Un post appartient à un cours
    ForumPost.belongsTo(models.Course, {
      foreignKey: 'courseId',
      as: 'course',
      onDelete: 'CASCADE'
    });

    // Un post peut avoir des réponses (réponses = ForumPost aussi)
    ForumPost.hasMany(models.ForumPost, {
      as: 'replies',
      foreignKey: 'parentId'
    });

    // Et appartient éventuellement à un post parent
    ForumPost.belongsTo(models.ForumPost, {
      as: 'parent',
      foreignKey: 'parentId'
    });
  };

  return ForumPost;
};
