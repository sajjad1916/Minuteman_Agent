/**
 * Email service via SMTP (nodemailer).
 * In demo mode, logs emails and records to DB without sending.
 */
const nodemailer = require('nodemailer');
const settings = require('../../config/settings');
const logger = require('../middleware/logger');
const db = require('../../db/database');

const isDemo = () => settings.appMode === 'demo';

let transporter = null;

function getTransporter() {
  if (!transporter && !isDemo()) {
    transporter = nodemailer.createTransport({
      host: settings.email.host,
      port: settings.email.port,
      secure: settings.email.port === 465,
      auth: { user: settings.email.user, pass: settings.email.pass },
    });
  }
  return transporter;
}

/**
 * Send an email.
 * Returns { success, messageId }.
 */
async function sendEmail({ to, subject, body, customerId, campaignId, enrollmentId, contentFormat }) {
  // Check daily cap
  const today = new Date().toISOString().split('T')[0];
  const counter = db.prepare('SELECT email_count FROM daily_counters WHERE date = ?').get(today);
  const currentCount = counter?.email_count || 0;

  if (currentCount >= settings.guardrails.dailyEmailCap) {
    logger.warn(`[Email] Daily email cap reached (${currentCount}/${settings.guardrails.dailyEmailCap}). Skipping.`);
    return { success: false, messageId: null, reason: 'daily_cap_reached' };
  }

  const format = contentFormat || 'text';

  if (isDemo()) {
    const fakeId = `EMAIL-DEMO-${Date.now()}`;
    logger.info(`[Email:demo] To: ${to} | Subject: "${subject}" | Format: ${format} (ID: ${fakeId})`);

    db.prepare(`
      INSERT INTO messages (campaign_id, enrollment_id, customer_id, channel, direction, subject, body, status, external_id, sent_at)
      VALUES (?, ?, ?, 'email', 'outbound', ?, ?, 'delivered', ?, datetime('now'))
    `).run(campaignId || null, enrollmentId || null, customerId, subject, body, fakeId);

    db.prepare(`
      INSERT INTO daily_counters (date, sms_count, email_count)
      VALUES (?, 0, 1)
      ON CONFLICT(date) DO UPDATE SET email_count = email_count + 1
    `).run(today);

    return { success: true, messageId: fakeId };
  }

  try {
    const transport = getTransporter();
    const mailOptions = {
      from: `"${settings.email.fromName}" <${settings.email.fromAddress}>`,
      to,
      subject,
    };

    if (format === 'html') {
      mailOptions.html = body;
      mailOptions.text = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    } else {
      mailOptions.text = body;
    }

    const info = await transport.sendMail(mailOptions);

    db.prepare(`
      INSERT INTO messages (campaign_id, enrollment_id, customer_id, channel, direction, subject, body, status, external_id, sent_at)
      VALUES (?, ?, ?, 'email', 'outbound', ?, ?, 'sent', ?, datetime('now'))
    `).run(campaignId || null, enrollmentId || null, customerId, subject, body, info.messageId);

    db.prepare(`
      INSERT INTO daily_counters (date, sms_count, email_count)
      VALUES (?, 0, 1)
      ON CONFLICT(date) DO UPDATE SET email_count = email_count + 1
    `).run(today);

    logger.info(`[Email:live] Sent to ${to} (ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`[Email] Failed to send to ${to}: ${err.message}`);
    return { success: false, messageId: null, reason: err.message };
  }
}

module.exports = { sendEmail };
