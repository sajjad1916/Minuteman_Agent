/**
 * Campaign sequencer — processes enrollments and sends messages
 * based on campaign sequence steps and delay timings.
 */
const logger = require('../middleware/logger');
const db = require('../../db/database');
const settings = require('../../config/settings');
const { sendSms } = require('./hatch');
const { sendEmail } = require('./email');
const serviceTitan = require('./serviceTitan');
const { REVIEW_REQUEST_SMS, REVIEW_REQUEST_EMAIL_SUBJECT, REVIEW_REQUEST_EMAIL_BODY } = require('../prompts');

/**
 * Process review requests for recently completed jobs.
 * Runs on a cron schedule (e.g., every 30 minutes).
 */
async function processReviewRequests() {
  logger.info('[Sequencer] Processing review requests...');

  const delayMs = settings.guardrails.reviewRequestDelayHours * 60 * 60 * 1000;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // last 24h
  const jobs = await serviceTitan.getCompletedJobs({ since });

  let sent = 0;
  for (const job of jobs) {
    const completedTime = new Date(job.completed_at).getTime();
    if (Date.now() - completedTime < delayMs) continue; // too soon

    // Check if already sent
    const existing = db.prepare('SELECT id FROM review_requests WHERE job_id = ?').get(job.id);
    if (existing) continue;

    const campaignId = db.prepare("SELECT id FROM campaigns WHERE type = 'review_request' LIMIT 1").get()?.id;
    const techName = job.tech_name || 'our team';

    // Send SMS
    const smsBody = REVIEW_REQUEST_SMS({ firstName: job.first_name, techName, reviewLink: settings.googleReviewLink });
    const smsResult = await sendSms({
      to: job.phone,
      body: smsBody,
      customerId: job.customer_id,
      campaignId,
    });

    // Send email if customer has one
    let emailResult = { success: false };
    if (job.email) {
      emailResult = await sendEmail({
        to: job.email,
        subject: REVIEW_REQUEST_EMAIL_SUBJECT,
        body: REVIEW_REQUEST_EMAIL_BODY({ firstName: job.first_name, techName, serviceType: job.service_type || 'plumbing', reviewLink: settings.googleReviewLink }),
        customerId: job.customer_id,
        campaignId,
      });
    }

    if (smsResult.success || emailResult.success) {
      const messageExtId = smsResult.messageId || emailResult.messageId;
      db.prepare(`
        INSERT INTO review_requests (job_id, customer_id, message_id, status, sent_at)
        VALUES (?, ?, (SELECT id FROM messages WHERE external_id = ?), 'sent', datetime('now'))
      `).run(job.id, job.customer_id, messageExtId);

      const channels = [smsResult.success && 'SMS', emailResult.success && 'email'].filter(Boolean).join(' + ');
      db.prepare(`
        INSERT INTO activity_log (type, description, metadata)
        VALUES ('review_sent', ?, ?)
      `).run(
        `Review request (${channels}) sent to ${job.first_name} ${job.last_name} for ${job.service_type} job`,
        JSON.stringify({ customer_id: job.customer_id, job_id: job.id, channels })
      );
      sent++;
    }
  }

  logger.info(`[Sequencer] Review requests: ${sent} sent out of ${jobs.length} eligible jobs`);
  return sent;
}

/**
 * Enroll new unsold estimates into the follow-up campaign.
 */
async function enrollUnsoldEstimates() {
  logger.info('[Sequencer] Checking for unsold estimates to enroll...');

  const campaign = db.prepare("SELECT * FROM campaigns WHERE type = 'estimate_followup' AND status = 'active' LIMIT 1").get();
  if (!campaign) {
    logger.info('[Sequencer] No active estimate follow-up campaign found');
    return 0;
  }

  const estimates = await serviceTitan.getUnsoldEstimates({
    olderThanHours: settings.guardrails.estimateFollowupDelayHours,
  });

  let enrolled = 0;
  for (const estimate of estimates) {
    // Check if already enrolled
    const existing = db.prepare(
      'SELECT id FROM campaign_enrollments WHERE campaign_id = ? AND customer_id = ?'
    ).get(campaign.id, estimate.customer_id);
    if (existing) continue;

    db.prepare(`
      INSERT INTO campaign_enrollments (campaign_id, customer_id, status, current_step, enrolled_at)
      VALUES (?, ?, 'active', 0, datetime('now'))
    `).run(campaign.id, estimate.customer_id);

    db.prepare(`
      INSERT INTO activity_log (type, description, metadata)
      VALUES ('enrollment', ?, ?)
    `).run(
      `Enrolled ${estimate.first_name} ${estimate.last_name} in estimate follow-up for ${estimate.service_type}`,
      JSON.stringify({ customer_id: estimate.customer_id, estimate_id: estimate.id, campaign_id: campaign.id })
    );
    enrolled++;
  }

  logger.info(`[Sequencer] Enrolled ${enrolled} new customers in estimate follow-up`);
  return enrolled;
}

/**
 * Auto-stop estimate follow-up enrollments when the estimate has been
 * accepted (booked) or explicitly declined — prevents messaging customers
 * who already converted or said no.
 */
function stopConvertedEstimateEnrollments() {
  const stopped = db.prepare(`
    UPDATE campaign_enrollments SET status = 'stopped', completed_at = datetime('now')
    WHERE status = 'active'
      AND campaign_id IN (SELECT id FROM campaigns WHERE type = 'estimate_followup')
      AND customer_id IN (
        SELECT customer_id FROM estimates WHERE status IN ('accepted', 'declined')
      )
  `).run();

  if (stopped.changes > 0) {
    logger.info(`[Sequencer] Auto-stopped ${stopped.changes} estimate follow-up enrollments (customer booked or declined)`);
    db.prepare(`
      INSERT INTO activity_log (type, description, metadata)
      VALUES ('enrollment', ?, ?)
    `).run(
      `Auto-stopped ${stopped.changes} follow-up enrollments — estimates converted or declined`,
      JSON.stringify({ stopped: stopped.changes })
    );
  }

  return stopped.changes;
}

/**
 * Process all active campaign enrollments — send the next message
 * in each sequence when the delay has elapsed.
 */
async function processSequences() {
  logger.info('[Sequencer] Processing campaign sequences...');

  // Auto-stop enrollments for customers whose estimates converted
  stopConvertedEstimateEnrollments();

  const activeCampaigns = db.prepare("SELECT * FROM campaigns WHERE status = 'active'").all();
  let totalSent = 0;

  for (const campaign of activeCampaigns) {
    const enrollments = db.prepare(`
      SELECT ce.*, c.first_name, c.last_name, c.email, c.phone,
        e.service_type as estimate_service_type, e.amount as estimate_amount
      FROM campaign_enrollments ce
      JOIN customers c ON ce.customer_id = c.id
      LEFT JOIN estimates e ON e.customer_id = c.id AND e.status = 'open'
      WHERE ce.campaign_id = ? AND ce.status = 'active'
    `).all(campaign.id);

    const steps = db.prepare(
      'SELECT * FROM campaign_sequences WHERE campaign_id = ? ORDER BY step_number ASC'
    ).all(campaign.id);

    for (const enrollment of enrollments) {
      const nextStepNum = enrollment.current_step + 1;
      const nextStep = steps.find((s) => s.step_number === nextStepNum);

      if (!nextStep) {
        // All steps complete
        db.prepare("UPDATE campaign_enrollments SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(enrollment.id);
        continue;
      }

      // Check if delay has elapsed
      const enrolledAt = new Date(enrollment.enrolled_at).getTime();
      const delayMs = nextStep.delay_days * 24 * 60 * 60 * 1000;
      if (Date.now() - enrolledAt < delayMs) continue;

      // Build message from template
      const messageBody = nextStep.body_template
        .replace(/\{\{firstName\}\}/g, enrollment.first_name)
        .replace(/\{\{lastName\}\}/g, enrollment.last_name)
        .replace(/\{\{serviceType\}\}/g, enrollment.estimate_service_type || campaign.name)
        .replace(/\{\{estimateAmount\}\}/g, enrollment.estimate_amount ? ` ($${Number(enrollment.estimate_amount).toLocaleString()})` : '')
        .replace(/\{\{techName\}\}/g, '')
        .replace(/\{\{reviewLink\}\}/g, settings.googleReviewLink);

      let result;
      if (nextStep.channel === 'sms') {
        result = await sendSms({
          to: enrollment.phone,
          body: messageBody,
          customerId: enrollment.customer_id,
          campaignId: campaign.id,
          enrollmentId: enrollment.id,
        });
      } else {
        const subject = (nextStep.subject || '')
          .replace(/\{\{serviceType\}\}/g, enrollment.estimate_service_type || campaign.name)
          .replace(/\{\{firstName\}\}/g, enrollment.first_name);

        result = await sendEmail({
          to: enrollment.email,
          subject,
          body: messageBody,
          customerId: enrollment.customer_id,
          campaignId: campaign.id,
          enrollmentId: enrollment.id,
          contentFormat: nextStep.content_format || 'text',
        });
      }

      if (result.success) {
        db.prepare('UPDATE campaign_enrollments SET current_step = ? WHERE id = ?').run(nextStepNum, enrollment.id);

        db.prepare(`
          INSERT INTO activity_log (type, description, metadata)
          VALUES (?, ?, ?)
        `).run(
          campaign.type === 'estimate_followup' ? 'followup_sent' : 'campaign_sent',
          `${campaign.name} (Step ${nextStepNum} ${nextStep.channel.toUpperCase()}) sent to ${enrollment.first_name} ${enrollment.last_name}`,
          JSON.stringify({ customer_id: enrollment.customer_id, campaign_id: campaign.id, step: nextStepNum })
        );
        totalSent++;
      }
    }
  }

  logger.info(`[Sequencer] Sequences processed: ${totalSent} messages sent`);
  return totalSent;
}

module.exports = {
  processReviewRequests,
  enrollUnsoldEstimates,
  processSequences,
  stopConvertedEstimateEnrollments,
};
