const express = require('express');
const router = express.Router();
const db = require('../../db/database');

// List all templates (optional ?channel=sms|email filter)
router.get('/', (req, res) => {
  const { channel } = req.query;
  let sql = 'SELECT * FROM message_templates';
  const params = [];

  if (channel && (channel === 'sms' || channel === 'email')) {
    sql += ' WHERE channel = ?';
    params.push(channel);
  }

  sql += ' ORDER BY channel ASC, name ASC';

  try {
    const templates = db.prepare(sql).all(...params);
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single template
router.get('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create template
router.post('/', (req, res) => {
  const { name, channel, subject, body, content_format } = req.body;

  if (!name || !channel || !body) {
    return res.status(400).json({ error: 'name, channel, and body are required' });
  }
  if (channel !== 'sms' && channel !== 'email') {
    return res.status(400).json({ error: 'channel must be sms or email' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO message_templates (name, channel, subject, body, content_format, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `).run(name, channel, subject || null, body, content_format || 'text');

    const template = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update template
router.put('/:id', (req, res) => {
  const { name, channel, subject, body, content_format } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    db.prepare(`
      UPDATE message_templates
      SET name = ?, channel = ?, subject = ?, body = ?, content_format = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || existing.name,
      channel || existing.channel,
      subject !== undefined ? subject : existing.subject,
      body || existing.body,
      content_format || existing.content_format,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Duplicate template
router.post('/:id/duplicate', (req, res) => {
  try {
    const original = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id);
    if (!original) return res.status(404).json({ error: 'Template not found' });

    const result = db.prepare(`
      INSERT INTO message_templates (name, channel, subject, body, content_format, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `).run(
      original.name + ' (Copy)',
      original.channel,
      original.subject,
      original.body,
      original.content_format
    );

    const copy = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(copy);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete template (block defaults)
router.delete('/:id', (req, res) => {
  try {
    const template = db.prepare('SELECT * FROM message_templates WHERE id = ?').get(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.is_default) {
      return res.status(403).json({ error: 'Default templates cannot be deleted. Duplicate it first to create an editable copy.' });
    }

    db.prepare('DELETE FROM message_templates WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
