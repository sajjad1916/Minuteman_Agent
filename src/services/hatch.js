/**
 * Hatch SMS API integration.
 * In demo mode, logs messages and records to DB without hitting the API.
 */
const settings = require('../../config/settings');
const logger = require('../middleware/logger');
const db = require('../../db/database');

const isDemo = () => settings.appMode === 'demo';

/**
 * Send an SMS via Hatch.
 * Returns { success, messageId }.
 */
async function sendSms({ to, body, customerId, campaignId, enrollmentId }) {
  // Check daily cap
  const today = new Date().toISOString().split('T')[0];
  const counter = db.prepare('SELECT sms_count FROM daily_counters WHERE date = ?').get(today);
  const currentCount = counter?.sms_count || 0;

  if (currentCount >= settings.guardrails.dailySmsCap) {
    logger.warn(`[Hatch] Daily SMS cap reached (${currentCount}/${settings.guardrails.dailySmsCap}). Skipping.`);
    return { success: false, messageId: null, reason: 'daily_cap_reached' };
  }

  if (isDemo()) {
    const fakeId = `HATCH-DEMO-${Date.now()}`;
    logger.info(`[Hatch:demo] SMS to ${to}: "${body.substring(0, 60)}..." (ID: ${fakeId})`);

    // Record in DB
    db.prepare(`
      INSERT INTO messages (campaign_id, enrollment_id, customer_id, channel, direction, body, status, external_id, sent_at)
      VALUES (?, ?, ?, 'sms', 'outbound', ?, 'delivered', ?, datetime('now'))
    `).run(campaignId || null, enrollmentId || null, customerId, body, fakeId);

    // Update daily counter
    db.prepare(`
      INSERT INTO daily_counters (date, sms_count, email_count)
      VALUES (?, 1, 0)
      ON CONFLICT(date) DO UPDATE SET sms_count = sms_count + 1
    `).run(today);

    return { success: true, messageId: fakeId };
  }

  // Live mode — Hatch API
  try {
    const res = await fetch(`${settings.hatch.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.hatch.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        companyId: settings.hatch.companyId,
        to,
        body,
        channel: 'sms',
      }),
    });

    if (!res.ok) throw new Error(`Hatch API error: ${res.status}`);
    const data = await res.json();

    // Record in DB
    db.prepare(`
      INSERT INTO messages (campaign_id, enrollment_id, customer_id, channel, direction, body, status, external_id, sent_at)
      VALUES (?, ?, ?, 'sms', 'outbound', ?, 'sent', ?, datetime('now'))
    `).run(campaignId || null, enrollmentId || null, customerId, body, data.id);

    // Update daily counter
    db.prepare(`
      INSERT INTO daily_counters (date, sms_count, email_count)
      VALUES (?, 1, 0)
      ON CONFLICT(date) DO UPDATE SET sms_count = sms_count + 1
    `).run(today);

    logger.info(`[Hatch:live] SMS sent to ${to} (ID: ${data.id})`);
    return { success: true, messageId: data.id };
  } catch (err) {
    logger.error(`[Hatch] Failed to send SMS to ${to}: ${err.message}`);
    return { success: false, messageId: null, reason: err.message };
  }
}

module.exports = { sendSms };
