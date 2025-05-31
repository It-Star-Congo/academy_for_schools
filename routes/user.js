const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { User, Course } = require('../models');


// Récupérer tous les utilisateurs
router.get('/', async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' + error });
  }
});

// Ajouter un utilisateur
router.post('/', async (req, res) => {
  try {
    console.log("ok2");
    const { username, contact, password } = req.body;
    console.log("ok3");
    const hashedPassword = password;
    console.log("ok4");
    const newUser = await User.create({ username, contact, password: hashedPassword });
    console.log("ok5");
    req.session.user = { id: newUser.id, username: newUser.username };
    res.redirect('/dash');
  } catch (error) {
    console.error("Erreur :", error);
    res.status(500).json({ error: 'Erreur lors de la création de l’utilisateur' });
  }
});



// GET - Tableau de bord professeur
router.get('/teacher', async (req, res) => {
  try {
    const username = req.session.user.username;

    const teacher = await User.findOne({ where: { username } });

    if (teacher && teacher.role === "teacher") {
      const courses = await Course.findAll({ where: { teacher: username } });

      const lastWithdrawal = teacher.withdrawals?.[0] || { amount: 0, date: "N/A" };
      const revenue = teacher.revenue || [];

      const revenueLabels = [];
      const revenueData = [];

      for (let i = 0; i < revenue.length; i++) {
        revenueLabels.push(revenue[i].date);
        revenueData.push(revenue[i].amount);
      }

      res.render('teacherDash', {
        courses,
        lastWithdrawalAmount: lastWithdrawal.amount,
        lastWithdrawalDate: lastWithdrawal.date,
        revenueLabels,
        revenueData
      });
    } else {
      res.status(403).send("Accès refusé");
    }
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la récupération des données du professeur: ' + error });
  }
});





module.exports = router;
