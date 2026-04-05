const express = require('express');
const router = express.Router();
const db = require('../../db/database');

// GET /api/customers — list with search + pagination
router.get('/', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 25);
  const offset = (page - 1) * limit;
  const search = req.query.search || '';
  const source = req.query.source || '';
  const priority = req.query.priority || '';

  let where = '1=1';
  const params = [];

  if (search) {
    where += " AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (source) {
    where += ' AND c.source = ?';
    params.push(source);
  }
  if (priority) {
    where += ' AND cc.priority = ?';
    params.push(priority);
  }

  const total = db.prepare(`
    SELECT COUNT(*) as c FROM customers c
    LEFT JOIN customer_classifications cc ON cc.customer_id = c.id
    WHERE ${where}
  `).get(...params).c;

  const customers = db.prepare(`
    SELECT c.*,
      cc.segments, cc.priority, cc.reasoning, cc.estimated_equipment_age,
      cc.last_service_category, cc.upsell_opportunity,
      (SELECT COUNT(*) FROM jobs WHERE customer_id = c.id) as job_count,
      (SELECT MAX(completed_at) FROM jobs WHERE customer_id = c.id AND status = 'complete') as last_service_date,
      (SELECT COUNT(*) FROM campaign_enrollments WHERE customer_id = c.id AND status = 'active') as active_campaigns,
      (SELECT COUNT(*) FROM messages WHERE customer_id = c.id) as total_messages
    FROM customers c
    LEFT JOIN customer_classifications cc ON cc.customer_id = c.id
    WHERE ${where}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ customers, total, page, limit, pages: Math.ceil(total / limit) });
});

// GET /api/customers/:id — single customer with full history
router.get('/:id', (req, res) => {
  const customer = db.prepare(`
    SELECT c.*,
      cc.segments, cc.priority, cc.reasoning, cc.estimated_equipment_age,
      cc.last_service_category, cc.upsell_opportunity
    FROM customers c
    LEFT JOIN customer_classifications cc ON cc.customer_id = c.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const jobs = db.prepare('SELECT * FROM jobs WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);
  const estimates = db.prepare('SELECT * FROM estimates WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);
  const messages = db.prepare('SELECT * FROM messages WHERE customer_id = ? ORDER BY sent_at DESC LIMIT 50').all(customer.id);
  const enrollments = db.prepare(`
    SELECT ce.*, cam.name as campaign_name
    FROM campaign_enrollments ce
    JOIN campaigns cam ON ce.campaign_id = cam.id
    WHERE ce.customer_id = ?
    ORDER BY ce.enrolled_at DESC
  `).all(customer.id);

  res.json({ ...customer, jobs, estimates, messages, enrollments });
});

// GET /api/customers/export/csv — export customers as CSV
router.get('/export/csv', (req, res) => {
  const segmentFilter = req.query.segment || '';
  const sourceFilter = req.query.source || '';

  let where = '1=1';
  const params = [];
  if (segmentFilter) {
    where += " AND cc.segments LIKE ?";
    params.push(`%${segmentFilter}%`);
  }
  if (sourceFilter) {
    where += ' AND c.source = ?';
    params.push(sourceFilter);
  }

  const customers = db.prepare(`
    SELECT c.first_name, c.last_name, c.email, c.phone,
      c.address_street, c.address_city, c.address_state, c.address_zip,
      c.source, cc.segments, cc.priority, cc.last_service_category
    FROM customers c
    LEFT JOIN customer_classifications cc ON cc.customer_id = c.id
    WHERE ${where}
    ORDER BY cc.priority DESC, c.last_name ASC
  `).all(...params);

  const headers = 'First Name,Last Name,Email,Phone,Street,City,State,Zip,Source,Segments,Priority,Last Service\n';
  const rows = customers.map(c =>
    [c.first_name, c.last_name, c.email, c.phone, c.address_street, c.address_city, c.address_state, c.address_zip, c.source, c.segments, c.priority, c.last_service_category]
      .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=minuteman-contacts-${new Date().toISOString().split('T')[0]}.csv`);
  res.send(headers + rows);
});

module.exports = router;
