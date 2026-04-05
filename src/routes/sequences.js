const express = require('express');
const router = express.Router();
const db = require('../../db/database');

// GET /api/sequences/:campaignId — get all steps for a campaign
router.get('/:campaignId', (req, res) => {
  const steps = db.prepare(
    'SELECT * FROM campaign_sequences WHERE campaign_id = ? ORDER BY step_number ASC'
  ).all(req.params.campaignId);
  res.json(steps);
});

// POST /api/sequences/:campaignId — add a step
router.post('/:campaignId', (req, res) => {
  const { step_number, delay_days, channel, subject, body_template, content_format } = req.body;
  if (!channel || !body_template) {
    return res.status(400).json({ error: 'channel and body_template are required' });
  }

  const result = db.prepare(`
    INSERT INTO campaign_sequences (campaign_id, step_number, delay_days, channel, subject, body_template, content_format)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.campaignId, step_number || 1, delay_days || 0, channel, subject || null, body_template, content_format || 'text');

  res.status(201).json({ id: result.lastInsertRowid, message: 'Sequence step added' });
});

// PUT /api/sequences/step/:id — update a step
router.put('/step/:id', (req, res) => {
  const { delay_days, channel, subject, body_template, content_format } = req.body;

  db.prepare(`
    UPDATE campaign_sequences SET
      delay_days = COALESCE(?, delay_days),
      channel = COALESCE(?, channel),
      subject = COALESCE(?, subject),
      body_template = COALESCE(?, body_template),
      content_format = COALESCE(?, content_format)
    WHERE id = ?
  `).run(delay_days ?? null, channel || null, subject || null, body_template || null, content_format || null, req.params.id);

  res.json({ message: 'Step updated' });
});

// DELETE /api/sequences/step/:id — delete a step
router.delete('/step/:id', (req, res) => {
  db.prepare('DELETE FROM campaign_sequences WHERE id = ?').run(req.params.id);
  res.json({ message: 'Step deleted' });
});

// POST /api/sequences/:campaignId/enroll — manually enroll customers
router.post('/:campaignId/enroll', (req, res) => {
  const { customer_ids } = req.body;
  if (!Array.isArray(customer_ids) || customer_ids.length === 0) {
    return res.status(400).json({ error: 'customer_ids array is required' });
  }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO campaign_enrollments (campaign_id, customer_id, status, current_step, enrolled_at)
    VALUES (?, ?, 'active', 0, datetime('now'))
  `);

  let enrolled = 0;
  const enrollTransaction = db.transaction(() => {
    for (const cid of customer_ids) {
      const result = insert.run(req.params.campaignId, cid);
      if (result.changes > 0) enrolled++;
    }
  });
  enrollTransaction();

  res.json({ enrolled, message: `${enrolled} customers enrolled` });
});

// POST /api/sequences/enrollment/:id/stop — stop an enrollment
router.post('/enrollment/:id/stop', (req, res) => {
  db.prepare("UPDATE campaign_enrollments SET status = 'stopped' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Enrollment stopped' });
});

module.exports = router;
