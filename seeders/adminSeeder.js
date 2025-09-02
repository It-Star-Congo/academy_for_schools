// seeders/20250713-adminSeeder.js
const bcrypt = require('bcrypt');

module.exports = {
  up: async (queryInterface) => {
    const hash = await bcrypt.hash('admin' + process.env.PEPPER, 12);
    await queryInterface.bulkInsert('Users', [{
      username:    'admin',
      password:    hash,
      contact: 'eeee',
      name: 'Direction École',
      firstname:'TEST',
      birthdate: '2001-01-11',
      role:        'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Users', { username: 'admin' });
  }
};
