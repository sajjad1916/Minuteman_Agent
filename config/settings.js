require('dotenv').config();

module.exports = {
  appMode: process.env.APP_MODE || 'demo',
  port: parseInt(process.env.PORT, 10) || 3000,

  serviceTitan: {
    clientId: process.env.SERVICE_TITAN_CLIENT_ID || '',
    clientSecret: process.env.SERVICE_TITAN_CLIENT_SECRET || '',
    tenantId: process.env.SERVICE_TITAN_TENANT_ID || '',
    appKey: process.env.SERVICE_TITAN_APP_KEY || '',
    baseUrl: 'https://api.servicetitan.io',
  },

  hatch: {
    apiKey: process.env.HATCH_API_KEY || '',
    companyId: process.env.HATCH_COMPANY_ID || '',
    baseUrl: 'https://api.usehatchapp.com/v1',
  },

  email: {
    host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_SMTP_PORT, 10) || 587,
    user: process.env.EMAIL_SMTP_USER || '',
    pass: process.env.EMAIL_SMTP_PASS || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Minuteman Plumbing',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'info@minutemanplumbing.com',
  },

  googleReviewLink: process.env.GOOGLE_REVIEW_LINK || 'https://g.page/r/minuteman-plumbing/review',

  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-preview',
    baseUrl: 'https://openrouter.ai/api/v1',
  },

  guardrails: {
    dailySmsCap: parseInt(process.env.DAILY_SMS_CAP, 10) || 50,
    dailyEmailCap: parseInt(process.env.DAILY_EMAIL_CAP, 10) || 100,
    reviewRequestDelayHours: parseInt(process.env.REVIEW_REQUEST_DELAY_HOURS, 10) || 2,
    estimateFollowupDelayHours: parseInt(process.env.ESTIMATE_FOLLOWUP_DELAY_HOURS, 10) || 48,
  },

  admin: {
    username: process.env.ADMIN_USERNAME || 'nat',
    password: process.env.ADMIN_PASSWORD || 'minuteman2026',
  },
};
