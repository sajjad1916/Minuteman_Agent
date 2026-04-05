/**
 * Service Titan API integration — fetches jobs, estimates, and customer data.
 * In demo mode, returns mock data from the database.
 */
const settings = require('../../config/settings');
const logger = require('../middleware/logger');
const db = require('../../db/database');

const isDemo = () => settings.appMode === 'demo';

/**
 * Get recently completed jobs (for review requests).
 * In live mode, polls Service Titan API. In demo mode, reads from DB.
 */
async function getCompletedJobs({ since }) {
  if (isDemo()) {
    const rows = db.prepare(`
      SELECT j.*, c.first_name, c.last_name, c.email, c.phone
      FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      WHERE j.status = 'complete'
        AND j.completed_at >= ?
        AND j.id NOT IN (SELECT job_id FROM review_requests)
      ORDER BY j.completed_at DESC
    `).all(since);
    logger.info(`[ServiceTitan:demo] Found ${rows.length} completed jobs since ${since}`);
    return rows;
  }

  // Live mode — Service Titan API
  try {
    const token = await getAccessToken();
    const url = `${settings.serviceTitan.baseUrl}/jpm/v2/tenant/${settings.serviceTitan.tenantId}/jobs?status=Completed&completedOnOrAfter=${since}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': settings.serviceTitan.appKey },
    });
    if (!res.ok) throw new Error(`Service Titan API error: ${res.status}`);
    const data = await res.json();
    logger.info(`[ServiceTitan:live] Found ${data.data?.length || 0} completed jobs`);
    return data.data || [];
  } catch (err) {
    logger.error(`[ServiceTitan] Failed to fetch jobs: ${err.message}`);
    return [];
  }
}

/**
 * Get open estimates that haven't converted (for follow-up).
 */
async function getUnsoldEstimates({ olderThanHours }) {
  if (isDemo()) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
    const rows = db.prepare(`
      SELECT e.*, c.first_name, c.last_name, c.email, c.phone
      FROM estimates e
      JOIN customers c ON e.customer_id = c.id
      WHERE e.status = 'open'
        AND e.presented_at <= ?
        AND e.customer_id NOT IN (
          SELECT customer_id FROM campaign_enrollments
          WHERE campaign_id = (SELECT id FROM campaigns WHERE type = 'estimate_followup' AND status = 'active' LIMIT 1)
        )
      ORDER BY e.presented_at ASC
    `).all(cutoff);
    logger.info(`[ServiceTitan:demo] Found ${rows.length} unsold estimates older than ${olderThanHours}h`);
    return rows;
  }

  try {
    const token = await getAccessToken();
    const url = `${settings.serviceTitan.baseUrl}/sales/v2/tenant/${settings.serviceTitan.tenantId}/estimates?status=Open`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': settings.serviceTitan.appKey },
    });
    if (!res.ok) throw new Error(`Service Titan API error: ${res.status}`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    logger.error(`[ServiceTitan] Failed to fetch estimates: ${err.message}`);
    return [];
  }
}

/**
 * Get all customers for classification.
 */
async function getCustomersForClassification() {
  if (isDemo()) {
    const rows = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM jobs WHERE customer_id = c.id) as job_count,
        (SELECT MAX(completed_at) FROM jobs WHERE customer_id = c.id AND status = 'complete') as last_service_date,
        (SELECT service_type FROM jobs WHERE customer_id = c.id AND status = 'complete' ORDER BY completed_at DESC LIMIT 1) as last_service_type,
        (SELECT service_description FROM jobs WHERE customer_id = c.id AND status = 'complete' ORDER BY completed_at DESC LIMIT 1) as last_service_description
      FROM customers c
      WHERE c.id NOT IN (SELECT customer_id FROM customer_classifications WHERE classified_at > datetime('now', '-7 days'))
    `).all();
    logger.info(`[ServiceTitan:demo] Found ${rows.length} customers needing classification`);
    return rows;
  }

  try {
    const token = await getAccessToken();
    const url = `${settings.serviceTitan.baseUrl}/crm/v2/tenant/${settings.serviceTitan.tenantId}/customers?pageSize=200`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': settings.serviceTitan.appKey },
    });
    if (!res.ok) throw new Error(`Service Titan API error: ${res.status}`);
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    logger.error(`[ServiceTitan] Failed to fetch customers: ${err.message}`);
    return [];
  }
}

/**
 * Get Service Titan access token (OAuth2 client credentials).
 */
async function getAccessToken() {
  const res = await fetch('https://auth.servicetitan.io/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: settings.serviceTitan.clientId,
      client_secret: settings.serviceTitan.clientSecret,
    }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

/**
 * Sync estimate statuses — detects estimates that have been accepted (booked)
 * or declined since last check, and updates the local DB.
 */
async function syncEstimateStatuses() {
  if (isDemo()) {
    // In demo mode, check if any open estimates have a corresponding booked job
    // (simulates Service Titan updating estimate status on booking)
    const converted = db.prepare(`
      UPDATE estimates SET status = 'accepted', converted_at = datetime('now')
      WHERE status = 'open'
        AND customer_id IN (
          SELECT customer_id FROM jobs
          WHERE status IN ('scheduled', 'in_progress', 'complete')
            AND created_at > estimates.presented_at
        )
    `).run();
    if (converted.changes > 0) {
      logger.info(`[ServiceTitan:demo] Synced ${converted.changes} estimates to accepted (matching jobs found)`);
    }
    return converted.changes;
  }

  // Live mode — poll Service Titan for estimate status changes
  try {
    const token = await getAccessToken();
    const openEstimates = db.prepare("SELECT service_titan_id FROM estimates WHERE status = 'open'").all();

    let updated = 0;
    for (const est of openEstimates) {
      if (!est.service_titan_id) continue;
      const url = `${settings.serviceTitan.baseUrl}/sales/v2/tenant/${settings.serviceTitan.tenantId}/estimates/${est.service_titan_id}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, 'ST-App-Key': settings.serviceTitan.appKey },
      });
      if (!res.ok) continue;
      const data = await res.json();

      if (data.status === 'Sold' || data.status === 'Approved') {
        db.prepare("UPDATE estimates SET status = 'accepted', converted_at = datetime('now') WHERE service_titan_id = ?").run(est.service_titan_id);
        updated++;
      } else if (data.status === 'Dismissed' || data.status === 'Rejected') {
        db.prepare("UPDATE estimates SET status = 'declined' WHERE service_titan_id = ?").run(est.service_titan_id);
        updated++;
      }
    }
    if (updated > 0) logger.info(`[ServiceTitan:live] Synced ${updated} estimate statuses`);
    return updated;
  } catch (err) {
    logger.error(`[ServiceTitan] Failed to sync estimate statuses: ${err.message}`);
    return 0;
  }
}

module.exports = {
  getCompletedJobs,
  getUnsoldEstimates,
  getCustomersForClassification,
  syncEstimateStatuses,
};
