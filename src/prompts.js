/**
 * All LLM prompts and message templates — never inline in business logic.
 */

// ── Review Request Templates ──

const REVIEW_REQUEST_SMS = ({ firstName, techName, reviewLink }) =>
  `Hi ${firstName}! Thanks for choosing Minuteman Plumbing. ` +
  `We hope ${techName} took great care of you today. ` +
  `If you have a moment, we'd love a quick review — it really helps our small team: ${reviewLink}`;

const REVIEW_REQUEST_EMAIL_SUBJECT = 'How did we do?';

const REVIEW_REQUEST_EMAIL_BODY = ({ firstName, techName, serviceType, reviewLink }) =>
  `Hi ${firstName},\n\n` +
  `Thank you for trusting Minuteman Plumbing, Heating & Cooling with your ${serviceType} service today. ` +
  `We hope ${techName} provided you with excellent service.\n\n` +
  `If you have a moment, we'd greatly appreciate a quick Google review. ` +
  `It helps other homeowners find reliable service:\n\n` +
  `${reviewLink}\n\n` +
  `Thank you for being a valued customer!\n\n` +
  `— The Minuteman Team\n` +
  `Veteran-Owned | Woman-Owned | Greater Boston & South Shore`;

// ── Estimate Follow-Up Templates ──

const ESTIMATE_FOLLOWUP_DAY1_SMS = ({ firstName, serviceType }) =>
  `Hi ${firstName}, this is Minuteman Plumbing following up on your ${serviceType} estimate. ` +
  `Do you have any questions we can help with? Just reply to this text.`;

const ESTIMATE_FOLLOWUP_DAY3_EMAIL_SUBJECT = ({ serviceType }) =>
  `Your ${serviceType} estimate from Minuteman`;

const ESTIMATE_FOLLOWUP_DAY3_EMAIL_BODY = ({ firstName, serviceType, estimateAmount }) =>
  `Hi ${firstName},\n\n` +
  `We wanted to follow up on the ${serviceType} estimate we provided${estimateAmount ? ` ($${estimateAmount})` : ''}. ` +
  `We know these decisions take time, and we're here to answer any questions.\n\n` +
  `A few things to keep in mind:\n` +
  `- We offer financing options for larger projects\n` +
  `- Our lifetime workmanship guarantee covers all installations\n` +
  `- We can often schedule within 24-48 hours when you're ready\n\n` +
  `Just reply to this email or call us at (781) 915-0895.\n\n` +
  `— The Minuteman Team`;

const ESTIMATE_FOLLOWUP_DAY7_SMS = ({ firstName, serviceType }) =>
  `Hi ${firstName}, just checking in on your ${serviceType} estimate from Minuteman. ` +
  `We'd love to help get this taken care of for you. Any questions? Reply here or call (781) 915-0895.`;

const ESTIMATE_FOLLOWUP_DAY14_EMAIL_SUBJECT = ({ serviceType }) =>
  `Still thinking about your ${serviceType} project?`;

const ESTIMATE_FOLLOWUP_DAY14_EMAIL_BODY = ({ firstName, serviceType }) =>
  `Hi ${firstName},\n\n` +
  `We know life gets busy! We're reaching out one last time about your ${serviceType} estimate. ` +
  `If your needs have changed or you have new questions, we're always here.\n\n` +
  `As a reminder, Minuteman offers:\n` +
  `- 24/7 emergency service with 1-hour response\n` +
  `- Lifetime workmanship guarantee\n` +
  `- Flexible financing options\n\n` +
  `We hope to hear from you, but no pressure — we'll be here whenever you're ready.\n\n` +
  `— The Minuteman Team`;

// ── Seasonal Campaign Templates ──

const CAMPAIGN_AC_TUNEUP_SMS = ({ firstName }) =>
  `Hi ${firstName}! Spring is here and summer is coming. ` +
  `Minuteman is booking AC tune-ups now — slots fill fast! ` +
  `Reply YES to schedule or call (781) 915-0895.`;

const CAMPAIGN_BOILER_REPLACEMENT_SMS = ({ firstName, yearsAgo }) =>
  `Hi ${firstName}, our records show we serviced your boiler${yearsAgo ? ` about ${yearsAgo} years ago` : ' previously'}. ` +
  `If it's been giving you trouble, we're running a special on replacements this season. ` +
  `Interested? Reply here or call (781) 915-0895.`;

const CAMPAIGN_RIZZO_REENGAGEMENT_SMS = ({ firstName }) =>
  `Hi ${firstName}! Minuteman Plumbing here — we've partnered with Rizzo Plumbing and Heating ` +
  `and are proud to continue serving your home. Need plumbing, heating, or AC help? ` +
  `We'd love to reconnect. Reply or call (781) 915-0895.`;

const CAMPAIGN_GENERAL_EMAIL_SUBJECT = ({ campaignName }) =>
  `A message from Minuteman Plumbing — ${campaignName}`;

const CAMPAIGN_GENERAL_EMAIL_BODY = ({ firstName, campaignName, bodyText }) =>
  `Hi ${firstName},\n\n${bodyText}\n\n` +
  `Call us at (781) 915-0895 or reply to this email.\n\n` +
  `— The Minuteman Team\n` +
  `Veteran-Owned | Woman-Owned | Greater Boston & South Shore`;

// ── AI Classification Prompt ──

const CUSTOMER_CLASSIFICATION_PROMPT = `You are a customer classification assistant for Minuteman Plumbing, Heating & Cooling, a residential service company in the Greater Boston area.

Given a customer's service history, classify them into outbound campaign segments. Return a JSON object with:

{
  "segments": ["ac_tuneup", "boiler_replacement", "plumbing_checkup", "rizzo_reengagement", "general_maintenance"],
  "priority": "high" | "medium" | "low",
  "reasoning": "brief explanation",
  "estimated_equipment_age": number | null,
  "last_service_category": "plumbing" | "heating" | "cooling" | "mixed",
  "upsell_opportunity": "brief description or null"
}

Classification rules:
- If last heating service was 2+ years ago AND equipment appears 15+ years old → "boiler_replacement" segment, HIGH priority
- If last AC service was 1+ year ago → "ac_tuneup" segment during spring (Mar-May)
- If customer is from Rizzo acquisition AND no service in 1+ year → "rizzo_reengagement", HIGH priority
- If 3+ visits in past 2 years → loyal customer, MEDIUM priority for maintenance campaigns
- If only 1 visit ever AND it was 1+ year ago → at risk of churn, HIGH priority

Return ONLY the JSON object, no explanation outside it.`;

module.exports = {
  REVIEW_REQUEST_SMS,
  REVIEW_REQUEST_EMAIL_SUBJECT,
  REVIEW_REQUEST_EMAIL_BODY,
  ESTIMATE_FOLLOWUP_DAY1_SMS,
  ESTIMATE_FOLLOWUP_DAY3_EMAIL_SUBJECT,
  ESTIMATE_FOLLOWUP_DAY3_EMAIL_BODY,
  ESTIMATE_FOLLOWUP_DAY7_SMS,
  ESTIMATE_FOLLOWUP_DAY14_EMAIL_SUBJECT,
  ESTIMATE_FOLLOWUP_DAY14_EMAIL_BODY,
  CAMPAIGN_AC_TUNEUP_SMS,
  CAMPAIGN_BOILER_REPLACEMENT_SMS,
  CAMPAIGN_RIZZO_REENGAGEMENT_SMS,
  CAMPAIGN_GENERAL_EMAIL_SUBJECT,
  CAMPAIGN_GENERAL_EMAIL_BODY,
  CUSTOMER_CLASSIFICATION_PROMPT,
};
