module.exports = (sequelize) => {
  const ClassCourse = sequelize.define('ClassCourse', {}, { timestamps: false });
  return ClassCourse;
};
