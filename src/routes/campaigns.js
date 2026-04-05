const express = require('express');
const router = express.Router();
const db = require('../../db/database');

// GET /api/campaigns — list all campaigns
router.get('/', (req, res) => {
  const campaigns = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM campaign_enrollments WHERE campaign_id = c.id AND status = 'active') as active_enrollments,
      (SELECT COUNT(*) FROM campaign_enrollments WHERE campaign_id = c.id AND status = 'completed') as completed_enrollments,
      (SELECT COUNT(*) FROM campaign_enrollments WHERE campaign_id = c.id) as total_enrollments,
      (SELECT COUNT(*) FROM messages WHERE campaign_id = c.id) as total_messages
    FROM campaigns c
    ORDER BY c.updated_at DESC
  `).all();
  res.json(campaigns);
});

// GET /api/campaigns/:id — single campaign with sequences and enrollments
router.get('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const sequences = db.prepare(
    'SELECT * FROM campaign_sequences WHERE campaign_id = ? ORDER BY step_number ASC'
  ).all(campaign.id);

  const enrollments = db.prepare(`
    SELECT ce.*, c.first_name, c.last_name, c.email, c.phone
    FROM campaign_enrollments ce
    JOIN customers c ON ce.customer_id = c.id
    WHERE ce.campaign_id = ?
    ORDER BY ce.enrolled_at DESC
  `).all(campaign.id);

  res.json({ ...campaign, sequences, enrollments });
});

// POST /api/campaigns — create a campaign
router.post('/', (req, res) => {
  const { name, type, description, target_segments, daily_sms_cap, daily_email_cap, start_date, end_date } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });

  const result = db.prepare(`
    INSERT INTO campaigns (name, type, description, target_segments, status, daily_sms_cap, daily_email_cap, start_date, end_date)
    VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?)
  `).run(
    name, type, description || '',
    JSON.stringify(target_segments || []),
    daily_sms_cap || 50, daily_email_cap || 100,
    start_date || null, end_date || null
  );

  res.status(201).json({ id: result.lastInsertRowid, message: 'Campaign created' });
});

// PUT /api/campaigns/:id — update a campaign
router.put('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { name, description, target_segments, daily_sms_cap, daily_email_cap, start_date, end_date } = req.body;

  db.prepare(`
    UPDATE campaigns SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      target_segments = COALESCE(?, target_segments),
      daily_sms_cap = COALESCE(?, daily_sms_cap),
      daily_email_cap = COALESCE(?, daily_email_cap),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name || null, description || null,
    target_segments ? JSON.stringify(target_segments) : null,
    daily_sms_cap || null, daily_email_cap || null,
    start_date || null, end_date || null,
    req.params.id
  );

  res.json({ message: 'Campaign updated' });
});

// POST /api/campaigns/:id/activate — start a campaign + auto-enroll matching customers
router.post('/:id/activate', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  db.prepare("UPDATE campaigns SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(req.params.id);

  // Auto-enroll customers matching target_segments
  let enrolled = 0;
  const segments = JSON.parse(campaign.target_segments || '[]');

  if (segments.length > 0) {
    // Find customers whose classification segments overlap with campaign target_segments
    const allClassified = db.prepare(`
      SELECT cc.customer_id, cc.segments, c.first_name, c.last_name
      FROM customer_classifications cc
      JOIN customers c ON cc.customer_id = c.id
    `).all();

    const insert = db.prepare(`
      INSERT OR IGNORE INTO campaign_enrollments (campaign_id, customer_id, status, current_step, enrolled_at)
      VALUES (?, ?, 'active', 0, datetime('now'))
    `);

    const enrollTransaction = db.transaction(() => {
      for (const row of allClassified) {
        const customerSegments = JSON.parse(row.segments || '[]');
        const matches = segments.some(s => customerSegments.includes(s));
        if (matches) {
          const result = insert.run(campaign.id, row.customer_id);
          if (result.changes > 0) {
            enrolled++;
            db.prepare(`
              INSERT INTO activity_log (type, description, metadata)
              VALUES ('enrollment', ?, ?)
            `).run(
              `Auto-enrolled ${row.first_name} ${row.last_name} in "${campaign.name}" (matched segments)`,
              JSON.stringify({ customer_id: row.customer_id, campaign_id: campaign.id, segments: customerSegments })
            );
          }
        }
      }
    });
    enrollTransaction();
  }

  db.prepare(`
    INSERT INTO activity_log (type, description, metadata)
    VALUES ('campaign_sent', ?, ?)
  `).run(
    `Campaign "${campaign.name}" activated — ${enrolled} customers auto-enrolled`,
    JSON.stringify({ campaign_id: campaign.id, enrolled })
  );

  res.json({ message: 'Campaign activated', enrolled });
});

// POST /api/campaigns/:id/pause
router.post('/:id/pause', (req, res) => {
  db.prepare("UPDATE campaigns SET status = 'paused', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ message: 'Campaign paused' });
});

// POST /api/campaigns/:id/resume
router.post('/:id/resume', (req, res) => {
  db.prepare("UPDATE campaigns SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ message: 'Campaign resumed' });
});

// GET /api/campaigns/:id/export — export enrolled contacts as CSV
router.get('/:id/export', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const rows = db.prepare(`
    SELECT c.first_name, c.last_name, c.email, c.phone,
      c.address_street, c.address_city, c.address_state, c.address_zip,
      c.source, cc.segments, cc.priority, cc.last_service_category,
      ce.status as enrollment_status, ce.current_step, ce.enrolled_at
    FROM campaign_enrollments ce
    JOIN customers c ON ce.customer_id = c.id
    LEFT JOIN customer_classifications cc ON cc.customer_id = c.id
    WHERE ce.campaign_id = ?
    ORDER BY ce.enrolled_at DESC
  `).all(req.params.id);

  const headers = 'First Name,Last Name,Email,Phone,Street,City,State,Zip,Source,Segments,Priority,Last Service,Enrollment Status,Current Step,Enrolled At\n';
  const csvRows = rows.map(r =>
    [r.first_name, r.last_name, r.email, r.phone, r.address_street, r.address_city, r.address_state, r.address_zip, r.source, r.segments, r.priority, r.last_service_category, r.enrollment_status, r.current_step, r.enrolled_at]
      .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');

  const safeName = campaign.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${safeName}-contacts-${new Date().toISOString().split('T')[0]}.csv`);
  res.send(headers + csvRows);
});

// DELETE /api/campaigns/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ message: 'Campaign deleted' });
});

module.exports = router;
