/**
 * Customer classification service — uses AI to segment customers
 * for outbound campaigns based on their service history.
 */
const settings = require('../../config/settings');
const logger = require('../middleware/logger');
const db = require('../../db/database');
const { CUSTOMER_CLASSIFICATION_PROMPT } = require('../prompts');

/**
 * Classify a batch of customers using OpenRouter (Gemini Flash).
 * In demo mode, uses rule-based fallback.
 */
async function classifyCustomers(customers) {
  const results = [];

  for (const customer of customers) {
    try {
      let classification;

      if (settings.appMode === 'demo' || !settings.openRouter.apiKey) {
        classification = ruleBasedClassify(customer);
      } else {
        classification = await aiClassify(customer);
      }

      // Upsert classification
      db.prepare(`
        INSERT INTO customer_classifications (customer_id, segments, priority, reasoning, estimated_equipment_age, last_service_category, upsell_opportunity, classified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(customer_id) DO UPDATE SET
          segments = excluded.segments,
          priority = excluded.priority,
          reasoning = excluded.reasoning,
          estimated_equipment_age = excluded.estimated_equipment_age,
          last_service_category = excluded.last_service_category,
          upsell_opportunity = excluded.upsell_opportunity,
          classified_at = excluded.classified_at
      `).run(
        customer.id,
        JSON.stringify(classification.segments),
        classification.priority,
        classification.reasoning,
        classification.estimated_equipment_age,
        classification.last_service_category,
        classification.upsell_opportunity
      );

      results.push({ customerId: customer.id, ...classification });
    } catch (err) {
      logger.error(`[Classification] Failed for customer ${customer.id}: ${err.message}`);
    }
  }

  // Log activity
  if (results.length > 0) {
    db.prepare(`
      INSERT INTO activity_log (type, description, metadata) VALUES ('classification', ?, ?)
    `).run(
      `Classified ${results.length} customers for outbound targeting`,
      JSON.stringify({ count: results.length })
    );
  }

  return results;
}

/**
 * AI classification via OpenRouter.
 */
async function aiClassify(customer) {
  const historyPrompt = `
Customer: ${customer.first_name} ${customer.last_name}
Source: ${customer.source} (${customer.source === 'rizzo' ? 'acquired from Rizzo Plumbing' : 'Minuteman customer'})
Total jobs: ${customer.job_count || 0}
Last service date: ${customer.last_service_date || 'unknown'}
Last service type: ${customer.last_service_type || 'unknown'}
Last service description: ${customer.last_service_description || 'none'}
Customer since: ${customer.created_at}
`.trim();

  const res = await fetch(`${settings.openRouter.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.openRouter.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.openRouter.model,
      messages: [
        { role: 'system', content: CUSTOMER_CLASSIFICATION_PROMPT },
        { role: 'user', content: historyPrompt },
      ],
      temperature: 0.1,
      max_tokens: 500,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  return JSON.parse(content);
}

/**
 * Rule-based fallback classification (no AI needed).
 */
function ruleBasedClassify(customer) {
  const segments = [];
  let priority = 'medium';
  const reasons = [];

  const daysSinceService = customer.last_service_date
    ? Math.floor((Date.now() - new Date(customer.last_service_date).getTime()) / (1000 * 60 * 60 * 24))
    : 9999;

  // Rizzo re-engagement
  if (customer.source === 'rizzo' && daysSinceService > 365) {
    segments.push('rizzo_reengagement');
    priority = 'high';
    reasons.push('Rizzo customer with no recent service');
  }

  // Heating / boiler replacement
  if (customer.last_service_type === 'heating' && daysSinceService > 365) {
    segments.push('boiler_replacement');
    if (daysSinceService > 730) priority = 'high';
    reasons.push('Heating service 1+ year ago');
  }

  // AC tune-up (spring)
  const month = new Date().getMonth() + 1;
  if ((month >= 3 && month <= 5) && (customer.last_service_type === 'cooling' || customer.job_count > 0)) {
    segments.push('ac_tuneup');
    reasons.push('Spring AC tune-up candidate');
  }

  // General maintenance
  if (customer.job_count >= 3) {
    segments.push('general_maintenance');
    reasons.push(`Loyal customer with ${customer.job_count} visits`);
  }

  // At risk
  if (customer.job_count <= 1 && daysSinceService > 365) {
    priority = 'high';
    reasons.push('At risk of churn — single visit, no recent contact');
  }

  if (segments.length === 0) segments.push('general_maintenance');

  return {
    segments,
    priority,
    reasoning: reasons.join('. ') || 'Standard classification',
    estimated_equipment_age: null,
    last_service_category: customer.last_service_type || 'unknown',
    upsell_opportunity: null,
  };
}

module.exports = { classifyCustomers };
