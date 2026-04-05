-- Minuteman Marketing Agent — Database Schema

-- ── Customers ──
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_titan_id TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT DEFAULT 'MA',
  address_zip TEXT,
  source TEXT DEFAULT 'minuteman', -- 'minuteman' | 'rizzo'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── Jobs (from Service Titan) ──
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_titan_id TEXT UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  tech_name TEXT,
  service_type TEXT, -- 'plumbing', 'heating', 'cooling', 'general'
  service_description TEXT,
  status TEXT DEFAULT 'scheduled', -- 'scheduled' | 'in_progress' | 'complete' | 'cancelled'
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Estimates ──
CREATE TABLE IF NOT EXISTS estimates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_titan_id TEXT UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  service_type TEXT,
  description TEXT,
  amount REAL,
  status TEXT DEFAULT 'open', -- 'open' | 'accepted' | 'declined' | 'expired'
  presented_at TEXT DEFAULT (datetime('now')),
  converted_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Customer Classifications ──
CREATE TABLE IF NOT EXISTS customer_classifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  segments TEXT, -- JSON array of segment tags
  priority TEXT DEFAULT 'medium', -- 'high' | 'medium' | 'low'
  reasoning TEXT,
  estimated_equipment_age INTEGER,
  last_service_category TEXT,
  upsell_opportunity TEXT,
  classified_at TEXT DEFAULT (datetime('now')),
  UNIQUE(customer_id)
);

-- ── Campaigns ──
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'review_request' | 'estimate_followup' | 'seasonal_outbound'
  description TEXT,
  target_segments TEXT, -- JSON array of segment tags to target
  status TEXT DEFAULT 'draft', -- 'draft' | 'active' | 'paused' | 'completed'
  daily_sms_cap INTEGER DEFAULT 50,
  daily_email_cap INTEGER DEFAULT 100,
  start_date TEXT,
  end_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ── Campaign Sequences (steps in a campaign) ──
CREATE TABLE IF NOT EXISTS campaign_sequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0, -- days after enrollment to send
  channel TEXT NOT NULL, -- 'sms' | 'email'
  subject TEXT, -- email subject (null for SMS)
  body_template TEXT NOT NULL, -- message template with {{variables}}
  content_format TEXT NOT NULL DEFAULT 'text', -- 'text' | 'html'
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Campaign Enrollments (customer <-> campaign) ──
CREATE TABLE IF NOT EXISTS campaign_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT DEFAULT 'active', -- 'active' | 'completed' | 'stopped' | 'opted_out'
  current_step INTEGER DEFAULT 0,
  enrolled_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  UNIQUE(campaign_id, customer_id)
);

-- ── Message Log ──
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER REFERENCES campaigns(id),
  enrollment_id INTEGER REFERENCES campaign_enrollments(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  channel TEXT NOT NULL, -- 'sms' | 'email'
  direction TEXT DEFAULT 'outbound', -- 'outbound' | 'inbound'
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'sent', -- 'queued' | 'sent' | 'delivered' | 'failed' | 'replied'
  external_id TEXT, -- Hatch message ID or email message ID
  sent_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Review Tracking ──
CREATE TABLE IF NOT EXISTS review_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  message_id INTEGER REFERENCES messages(id),
  status TEXT DEFAULT 'sent', -- 'sent' | 'clicked' | 'reviewed' | 'no_response'
  sent_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  UNIQUE(job_id)
);

-- ── Daily Send Counters ──
CREATE TABLE IF NOT EXISTS daily_counters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL, -- 'YYYY-MM-DD'
  sms_count INTEGER DEFAULT 0,
  email_count INTEGER DEFAULT 0,
  UNIQUE(date)
);

-- ── Activity Log ──
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- 'review_sent', 'followup_sent', 'campaign_sent', 'enrollment', 'classification', 'error'
  description TEXT NOT NULL,
  metadata TEXT, -- JSON blob for extra context
  created_at TEXT DEFAULT (datetime('now'))
);

-- ── Reusable Message Templates ──
CREATE TABLE IF NOT EXISTS message_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,              -- 'sms' | 'email'
  subject TEXT,                       -- email subject (null for SMS)
  body TEXT NOT NULL,                 -- message body with {{variables}}
  content_format TEXT NOT NULL DEFAULT 'text', -- 'text' | 'html'
  is_default INTEGER NOT NULL DEFAULT 0, -- 1 = shipped with the app
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_estimates_customer ON estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_campaign ON campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_customer ON campaign_enrollments(customer_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON campaign_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent ON messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(type);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
