const express = require('express');
const router = express.Router();
const settings = require('../../config/settings');

// POST /api/auth/login — simple admin login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === settings.admin.username && password === settings.admin.password) {
    res.json({ success: true, user: { username, role: 'admin' } });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
  }
});

module.exports = router;
