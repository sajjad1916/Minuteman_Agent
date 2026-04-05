const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../../db/database');

function hashPassword(password, salt) {
  if (!salt) salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash, combined: `${salt}:${hash}` };
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const result = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(result.hash, 'hex'), Buffer.from(hash, 'hex'));
}

// In-memory token store (maps token → { userId, username, role, expiresAt })
const sessions = new Map();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const token = generateToken();
  sessions.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });

  res.json({ success: true, token, user: { username: user.username, role: user.role } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  sessions.delete(token);
  res.json({ success: true });
});

// GET /api/auth/me — validate token and return user info
router.get('/me', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const session = sessions.get(token);

  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ success: false, error: 'Session expired' });
  }

  res.json({ success: true, user: { username: session.username, role: session.role } });
});

// Middleware — attach to routes that need auth
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const session = sessions.get(token);

  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = { id: session.userId, username: session.username, role: session.role };
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ── User Management (admin only) ──

// GET /api/auth/users
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC').all();
  res.json(users);
});

// POST /api/auth/users — create a new user
router.post('/users', requireAuth, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (role && role !== 'admin' && role !== 'viewer') {
    return res.status(400).json({ error: 'Role must be admin or viewer' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const hashed = hashPassword(password);
  const result = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run(
    username, hashed.combined, role || 'viewer'
  );

  res.status(201).json({ id: result.lastInsertRowid, username, role: role || 'viewer' });
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Prevent deleting yourself
  if (user.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
