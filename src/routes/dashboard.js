const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../../db/database');

// GET /api/dashboard — overview stats
router.get('/', (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const stats = {
    customers: {
      total: db.prepare('SELECT COUNT(*) as c FROM customers').get().c,
      minuteman: db.prepare("SELECT COUNT(*) as c FROM customers WHERE source = 'minuteman'").get().c,
      rizzo: db.prepare("SELECT COUNT(*) as c FROM customers WHERE source = 'rizzo'").get().c,
    },
    campaigns: {
      active: db.prepare("SELECT COUNT(*) as c FROM campaigns WHERE status = 'active'").get().c,
      paused: db.prepare("SELECT COUNT(*) as c FROM campaigns WHERE status = 'paused'").get().c,
      draft: db.prepare("SELECT COUNT(*) as c FROM campaigns WHERE status = 'draft'").get().c,
    },
    enrollments: {
      active: db.prepare("SELECT COUNT(*) as c FROM campaign_enrollments WHERE status = 'active'").get().c,
      completed: db.prepare("SELECT COUNT(*) as c FROM campaign_enrollments WHERE status = 'completed'").get().c,
    },
    estimates: {
      open: db.prepare("SELECT COUNT(*) as c FROM estimates WHERE status = 'open'").get().c,
      openValue: db.prepare("SELECT COALESCE(SUM(amount), 0) as v FROM estimates WHERE status = 'open'").get().v,
    },
    reviews: {
      sent: db.prepare('SELECT COUNT(*) as c FROM review_requests').get().c,
      reviewed: db.prepare("SELECT COUNT(*) as c FROM review_requests WHERE status = 'reviewed'").get().c,
    },
    todaySends: db.prepare('SELECT sms_count, email_count FROM daily_counters WHERE date = ?').get(today) || { sms_count: 0, email_count: 0 },
    messagesToday: {
      sms: db.prepare("SELECT COUNT(*) as c FROM messages WHERE channel = 'sms' AND date(sent_at) = ?").get(today).c,
      email: db.prepare("SELECT COUNT(*) as c FROM messages WHERE channel = 'email' AND date(sent_at) = ?").get(today).c,
    },
    messagesThisWeek: {
      sms: db.prepare("SELECT COUNT(*) as c FROM messages WHERE channel = 'sms' AND sent_at >= datetime('now', '-7 days')").get().c,
      email: db.prepare("SELECT COUNT(*) as c FROM messages WHERE channel = 'email' AND sent_at >= datetime('now', '-7 days')").get().c,
    },
    classifications: {
      high: db.prepare("SELECT COUNT(*) as c FROM customer_classifications WHERE priority = 'high'").get().c,
      medium: db.prepare("SELECT COUNT(*) as c FROM customer_classifications WHERE priority = 'medium'").get().c,
      low: db.prepare("SELECT COUNT(*) as c FROM customer_classifications WHERE priority = 'low'").get().c,
    },
  };

  res.json(stats);
});

// GET /api/dashboard/activity — recent activity log
router.get('/activity', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const activities = db.prepare(
    'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?'
  ).all(limit);
  res.json(activities);
});

// GET /api/dashboard/sends-chart — daily send counts for last 14 days
router.get('/sends-chart', (req, res) => {
  const rows = db.prepare(`
    SELECT date, sms_count, email_count
    FROM daily_counters
    WHERE date >= date('now', '-14 days')
    ORDER BY date ASC
  `).all();
  res.json(rows);
});

// GET /api/logs — server log viewer
const LOG_LINE_REGEX = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+): (?:\[([^\]]+)\] )?(.*)$/;

router.get('/logs', (req, res) => {
  const logFile = path.join(__dirname, '..', '..', 'logs', 'agent.log');

  let raw = '';
  try {
    raw = fs.readFileSync(logFile, 'utf8');
  } catch (err) {
    return res.json({ entries: [], total: 0, hasMore: false });
  }

  const lines = raw.split('\n').filter(Boolean).reverse(); // newest first

  // Parse all lines
  const parsed = lines.map((line) => {
    const match = line.match(LOG_LINE_REGEX);
    if (match) {
      return {
        timestamp: match[1],
        level: match[2].toUpperCase(),
        source: match[3] || null,
        message: match[4],
        raw: line,
      };
    }
    return { timestamp: '', level: 'UNKNOWN', source: null, message: line, raw: line };
  });

  // Apply filters
  const levelFilter = (req.query.level || '').toUpperCase();
  const sourceFilter = req.query.source || '';
  const searchFilter = (req.query.search || '').toLowerCase();

  const filtered = parsed.filter((entry) => {
    if (levelFilter && entry.level !== levelFilter) return false;
    if (sourceFilter && !(entry.source || '').startsWith(sourceFilter)) return false;
    if (searchFilter && !entry.message.toLowerCase().includes(searchFilter)) return false;
    return true;
  });

  const limit = Math.min(parseInt(req.query.limit) || 200, 500);
  const offset = parseInt(req.query.offset) || 0;
  const sliced = filtered.slice(offset, offset + limit);

  res.json({
    entries: sliced,
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
  });
});

module.exports = router;
