const db = require('./database');
const fs = require('fs');
const path = require('path');

console.log('[seed] Seeding database with demo data...');

// Run schema first
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Clear existing data and reset autoincrement counters
db.exec(`
  DELETE FROM activity_log;
  DELETE FROM daily_counters;
  DELETE FROM review_requests;
  DELETE FROM messages;
  DELETE FROM campaign_enrollments;
  DELETE FROM campaign_sequences;
  DELETE FROM campaigns;
  DELETE FROM customer_classifications;
  DELETE FROM estimates;
  DELETE FROM jobs;
  DELETE FROM customers;
  DELETE FROM sqlite_sequence;
`);

// ── Customers ──
const insertCustomer = db.prepare(`
  INSERT INTO customers (service_titan_id, first_name, last_name, email, phone, address_street, address_city, address_state, address_zip, source, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const customers = [
  ['ST-10001', 'Michael', 'Brennan', 'mbrennan@gmail.com', '617-555-0142', '47 Maple Ave', 'Quincy', 'MA', '02169', 'minuteman', '2024-03-15 09:00:00'],
  ['ST-10002', 'Patricia', 'Sullivan', 'psullivan82@comcast.net', '781-555-0198', '312 Atlantic St', 'Braintree', 'MA', '02184', 'minuteman', '2024-06-20 14:30:00'],
  ['ST-10003', 'James', 'Moriarty', 'jmoriarty@outlook.com', '617-555-0267', '88 Highland Rd', 'Milton', 'MA', '02186', 'minuteman', '2023-11-08 10:15:00'],
  ['ST-10004', 'Catherine', 'O\'Brien', 'cobrien.boston@gmail.com', '781-555-0334', '15 Elm Court', 'Weymouth', 'MA', '02188', 'minuteman', '2025-01-10 08:45:00'],
  ['ST-10005', 'Robert', 'Fitzgerald', 'rfitz@aol.com', '617-555-0421', '203 Beacon Hill Ln', 'Dorchester', 'MA', '02125', 'minuteman', '2024-09-05 11:00:00'],
  ['ST-10006', 'Maria', 'Gonzalez', 'maria.gonzalez77@gmail.com', '781-555-0508', '67 Harbor View Dr', 'Hull', 'MA', '02045', 'minuteman', '2025-02-18 16:20:00'],
  ['ST-10007', 'Thomas', 'McCarthy', 'tmccarthy@comcast.net', '617-555-0589', '441 Washington St', 'South Boston', 'MA', '02127', 'minuteman', '2024-01-22 09:30:00'],
  ['ST-10008', 'Linda', 'Nguyen', 'lnguyen.home@gmail.com', '781-555-0645', '29 Oak Knoll Rd', 'Hingham', 'MA', '02043', 'minuteman', '2024-07-14 13:00:00'],
  // Rizzo acquisition customers
  ['RZ-20001', 'Frank', 'DiMaggio', 'fdimaggio@verizon.net', '617-555-0712', '156 Columbus Ave', 'Somerville', 'MA', '02143', 'rizzo', '2022-04-10 10:00:00'],
  ['RZ-20002', 'Dorothy', 'Callahan', 'dcallahan55@gmail.com', '781-555-0789', '83 Pine Ridge Terr', 'Norwell', 'MA', '02061', 'rizzo', '2022-08-22 14:00:00'],
  ['RZ-20003', 'Anthony', 'Russo', 'arusso.plumbing@gmail.com', '617-555-0856', '510 Broadway', 'Revere', 'MA', '02151', 'rizzo', '2021-12-01 11:30:00'],
  ['RZ-20004', 'Helen', 'Kowalski', 'hkowalski@comcast.net', '781-555-0923', '22 Chestnut Hill Ave', 'Brookline', 'MA', '02445', 'rizzo', '2023-02-15 09:00:00'],
  ['RZ-20005', 'William', 'Santoro', 'wsantoro@outlook.com', '617-555-1001', '178 Tremont St', 'Roxbury', 'MA', '02119', 'rizzo', '2022-06-30 15:45:00'],
  ['RZ-20006', 'Jean', 'Murphy', 'jeanmurphy@aol.com', '781-555-1078', '45 Prospect St', 'Rockland', 'MA', '02370', 'rizzo', '2023-05-18 10:30:00'],
  ['RZ-20007', 'Steven', 'Petrov', 'spetrov.ma@gmail.com', '617-555-1145', '302 Cambridge St', 'Cambridge', 'MA', '02141', 'rizzo', '2022-01-09 08:00:00'],
  ['RZ-20008', 'Margaret', 'Walsh', 'mwalsh.home@gmail.com', '781-555-1212', '91 Sycamore Ln', 'Marshfield', 'MA', '02050', 'rizzo', '2023-09-25 12:00:00'],
];

const insertMany = db.transaction(() => {
  for (const c of customers) {
    insertCustomer.run(...c);
  }
});
insertMany();

// ── Jobs ──
const insertJob = db.prepare(`
  INSERT INTO jobs (service_titan_id, customer_id, tech_name, service_type, service_description, status, completed_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const jobs = [
  // Michael Brennan — recent complete job (review candidate)
  ['JOB-30001', 1, 'Derek Sullivan', 'plumbing', 'Kitchen faucet replacement — Moen Arbor pulldown. Replaced supply lines and shut-off valves.', 'complete', '2026-04-04 15:30:00', '2026-04-04 08:00:00'],
  // Patricia Sullivan — complete job from last week
  ['JOB-30002', 2, 'Marcus Thompson', 'heating', 'Annual boiler maintenance — Weil-McLain CGi Series 4, 18 years old. Cleaned heat exchanger, replaced expansion tank.', 'complete', '2026-03-28 14:00:00', '2026-03-28 09:00:00'],
  // James Moriarty — old boiler repair
  ['JOB-30003', 3, 'Derek Sullivan', 'heating', 'Boiler repair — Burnham PV82. Replaced circulator pump. Unit is 25 years old, recommended replacement.', 'complete', '2024-02-12 16:00:00', '2024-02-12 08:30:00'],
  // Catherine O'Brien — recent complete (review candidate)
  ['JOB-30004', 4, 'Kyle Rodriguez', 'cooling', 'AC system inspection and refrigerant top-off — Carrier Comfort 24ACC636. System is 8 years old, in good condition.', 'complete', '2026-04-03 17:00:00', '2026-04-03 10:00:00'],
  // Robert Fitzgerald — emergency plumbing
  ['JOB-30005', 5, 'Derek Sullivan', 'plumbing', 'Emergency: burst pipe in basement. Repaired 3/4" copper section, installed SharkBite coupling. Cleaned up water damage.', 'complete', '2025-12-18 20:00:00', '2025-12-18 14:00:00'],
  // Thomas McCarthy — scheduled this week
  ['JOB-30006', 7, 'Marcus Thompson', 'plumbing', 'Water heater replacement — Bradford White 50 gal. gas. Removing old 40 gal. unit.', 'scheduled', null, '2026-04-07 09:00:00'],
  // Frank DiMaggio (Rizzo) — old job
  ['JOB-30007', 9, 'Rizzo Tech', 'heating', 'Furnace repair — Lennox SL280V. Replaced ignitor and flame sensor. Unit is 20 years old.', 'complete', '2022-11-15 15:00:00', '2022-11-15 09:00:00'],
  // Dorothy Callahan (Rizzo) — old job
  ['JOB-30008', 10, 'Rizzo Tech', 'plumbing', 'Bathroom remodel rough-in — new shower valve, toilet flange, vanity supply lines.', 'complete', '2023-03-20 16:00:00', '2023-03-20 08:00:00'],
  // Helen Kowalski (Rizzo) — recent Minuteman job
  ['JOB-30009', 12, 'Kyle Rodriguez', 'cooling', 'Ductless mini split installation — Mitsubishi MSZ-FH12NA in master bedroom. Wall mount.', 'complete', '2025-08-10 17:30:00', '2025-08-10 08:00:00'],
  // Maria Gonzalez — complete (review candidate)
  ['JOB-30010', 6, 'Marcus Thompson', 'plumbing', 'Sump pump replacement — Zoeller M53. Installed check valve and battery backup.', 'complete', '2026-04-05 12:00:00', '2026-04-05 07:30:00'],
];

const insertJobsTransaction = db.transaction(() => {
  for (const j of jobs) {
    insertJob.run(...j);
  }
});
insertJobsTransaction();

// ── Estimates (some unsold) ──
const insertEstimate = db.prepare(`
  INSERT INTO estimates (service_titan_id, customer_id, service_type, description, amount, status, presented_at, converted_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const estimates = [
  // Unsold — James Moriarty boiler replacement (high value, open)
  ['EST-40001', 3, 'heating', 'Boiler replacement — Weil-McLain WM97+ high-efficiency. Includes removal of old Burnham unit, new piping, expansion tank, indirect water heater.', 14800.00, 'open', '2026-03-30 11:00:00', null, '2026-03-30 11:00:00'],
  // Unsold — Robert Fitzgerald bathroom remodel
  ['EST-40002', 5, 'plumbing', 'Full bathroom remodel — new shower valve, toilet, vanity, supply/drain lines. Does not include tile or fixtures.', 6200.00, 'open', '2026-04-01 14:00:00', null, '2026-04-01 14:00:00'],
  // Unsold — Linda Nguyen water heater
  ['EST-40003', 8, 'plumbing', 'Tankless water heater upgrade — Navien NPE-240A2. Gas line extension, new venting, recirculation pump.', 5500.00, 'open', '2026-04-02 10:00:00', null, '2026-04-02 10:00:00'],
  // Accepted — Catherine O'Brien (already converted)
  ['EST-40004', 4, 'cooling', 'AC system tune-up and refrigerant top-off.', 350.00, 'accepted', '2026-03-25 09:00:00', '2026-03-27 10:00:00', '2026-03-25 09:00:00'],
  // Unsold — Anthony Russo (Rizzo customer) furnace replacement
  ['EST-40005', 11, 'heating', 'Furnace replacement — Carrier Infinity 59MN7A. Includes removal, new ductwork modifications, smart thermostat.', 8900.00, 'open', '2026-03-15 13:00:00', null, '2026-03-15 13:00:00'],
  // Unsold — Steven Petrov AC install
  ['EST-40006', 15, 'cooling', 'Central AC installation — Carrier Comfort 24ACC636A003. New condenser, A-coil, line set, disconnect, pad.', 7200.00, 'open', '2026-03-20 11:00:00', null, '2026-03-20 11:00:00'],
  // Expired — old estimate
  ['EST-40007', 7, 'plumbing', 'Kitchen repipe — replace galvanized with PEX. 4 fixture run.', 3800.00, 'expired', '2025-10-05 10:00:00', null, '2025-10-05 10:00:00'],
];

const insertEstimatesTransaction = db.transaction(() => {
  for (const e of estimates) {
    insertEstimate.run(...e);
  }
});
insertEstimatesTransaction();

// ── Customer Classifications ──
const insertClassification = db.prepare(`
  INSERT INTO customer_classifications (customer_id, segments, priority, reasoning, estimated_equipment_age, last_service_category, upsell_opportunity, classified_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const classifications = [
  [3, '["boiler_replacement"]', 'high', 'Burnham boiler repaired 2+ years ago, estimated 25+ years old. Strong replacement candidate.', 25, 'heating', 'Boiler replacement with indirect water heater — $14-18k', '2026-04-01 06:00:00'],
  [5, '["plumbing_checkup","general_maintenance"]', 'medium', 'Emergency pipe repair in Dec 2025. Good candidate for preventive plumbing inspection.', null, 'plumbing', 'Whole-house repipe or water treatment system', '2026-04-01 06:00:00'],
  [9, '["rizzo_reengagement","boiler_replacement"]', 'high', 'Rizzo customer — Lennox furnace repaired Nov 2022, 20+ years old. No contact since acquisition.', 20, 'heating', 'Furnace replacement — $6-9k', '2026-04-01 06:00:00'],
  [10, '["rizzo_reengagement","general_maintenance"]', 'medium', 'Rizzo customer — bathroom remodel in 2023. No follow-up service.', null, 'plumbing', 'Annual plumbing inspection or water heater check', '2026-04-01 06:00:00'],
  [11, '["rizzo_reengagement","boiler_replacement"]', 'high', 'Rizzo customer — no service in 3+ years. Furnace estimate pending.', null, 'heating', 'Furnace replacement — estimate already presented', '2026-04-01 06:00:00'],
  [15, '["rizzo_reengagement","ac_tuneup"]', 'high', 'Rizzo customer — no service in 4+ years. AC estimate pending.', null, 'cooling', 'Central AC installation — estimate already presented', '2026-04-01 06:00:00'],
  [2, '["boiler_replacement","general_maintenance"]', 'medium', 'Weil-McLain boiler maintained annually, 18 years old. Approaching replacement age.', 18, 'heating', 'Proactive boiler replacement before failure — $12-16k', '2026-04-01 06:00:00'],
  [12, '["ac_tuneup"]', 'low', 'Recent mini split install (2025). Loyal customer, no immediate upsell.', 1, 'cooling', null, '2026-04-01 06:00:00'],
];

const insertClassificationsTransaction = db.transaction(() => {
  for (const c of classifications) {
    insertClassification.run(...c);
  }
});
insertClassificationsTransaction();

// ── Campaigns ──
const insertCampaign = db.prepare(`
  INSERT INTO campaigns (name, type, description, target_segments, status, daily_sms_cap, daily_email_cap, start_date, end_date, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const campaignsData = [
  ['Auto Review Requests', 'review_request', 'Automatically sends a Google review request when a job is marked complete. Text sent 2 hours after completion.', '[]', 'active', 50, 0, '2026-03-01', null, '2026-03-01 08:00:00', '2026-03-01 08:00:00'],
  ['Unsold Estimate Follow-Up', 'estimate_followup', 'Follow-up sequence for estimates that haven\'t converted: Day 1 SMS, Day 3 email, Day 7 SMS, Day 14 email.', '[]', 'active', 20, 20, '2026-03-01', null, '2026-03-01 08:00:00', '2026-03-01 08:00:00'],
  ['Spring AC Tune-Up 2026', 'seasonal_outbound', 'Reach out to past customers for spring AC tune-ups. Target: customers with AC service history or cooling equipment.', '["ac_tuneup"]', 'active', 30, 30, '2026-04-01', '2026-05-31', '2026-03-28 10:00:00', '2026-03-28 10:00:00'],
  ['Boiler Replacement Outreach', 'seasonal_outbound', 'Target customers with aging boilers (15+ years) for replacement conversations. High-value campaign.', '["boiler_replacement"]', 'draft', 15, 15, null, null, '2026-03-28 10:00:00', '2026-03-28 10:00:00'],
  ['Rizzo Customer Re-Engagement', 'seasonal_outbound', 'Welcome Rizzo customers to Minuteman. Re-introduce the brand, offer a tune-up special.', '["rizzo_reengagement"]', 'paused', 25, 25, '2026-04-01', '2026-06-30', '2026-03-28 10:00:00', '2026-03-28 10:00:00'],
];

const insertCampaignsTransaction = db.transaction(() => {
  for (const c of campaignsData) {
    insertCampaign.run(...c);
  }
});
insertCampaignsTransaction();

// ── Campaign Sequences ──
const insertSequence = db.prepare(`
  INSERT INTO campaign_sequences (campaign_id, step_number, delay_days, channel, subject, body_template, content_format, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const sequences = [
  // Review Request — single step
  [1, 1, 0, 'sms', null, 'Hi {{firstName}}! Thanks for choosing Minuteman Plumbing. We hope {{techName}} took great care of you today. If you have a moment, we\'d love a quick review: {{reviewLink}}', 'text', '2026-03-01 08:00:00'],
  // Estimate Follow-Up — 4 steps
  [2, 1, 1, 'sms', null, 'Hi {{firstName}}, this is Minuteman Plumbing following up on your {{serviceType}} estimate. Do you have any questions we can help with? Just reply to this text.', 'text', '2026-03-01 08:00:00'],
  [2, 2, 3, 'email', 'Your {{serviceType}} estimate from Minuteman', 'Hi {{firstName}},\n\nWe wanted to follow up on the {{serviceType}} estimate we provided{{estimateAmount}}. We know these decisions take time, and we\'re here to answer any questions.\n\nA few things to keep in mind:\n- We offer financing options for larger projects\n- Our lifetime workmanship guarantee covers all installations\n- We can often schedule within 24-48 hours when you\'re ready\n\nJust reply to this email or call us at (781) 915-0895.\n\n— The Minuteman Team', 'text', '2026-03-01 08:00:00'],
  [2, 3, 7, 'sms', null, 'Hi {{firstName}}, just checking in on your {{serviceType}} estimate from Minuteman. We\'d love to help get this taken care of for you. Any questions? Reply here or call (781) 915-0895.', 'text', '2026-03-01 08:00:00'],
  [2, 4, 14, 'email', 'Still thinking about your {{serviceType}} project?', 'Hi {{firstName}},\n\nWe know life gets busy! We\'re reaching out one last time about your {{serviceType}} estimate. If your needs have changed or you have new questions, we\'re always here.\n\nAs a reminder, Minuteman offers:\n- 24/7 emergency service with 1-hour response\n- Lifetime workmanship guarantee\n- Flexible financing options\n\nWe hope to hear from you, but no pressure — we\'ll be here whenever you\'re ready.\n\n— The Minuteman Team', 'text', '2026-03-01 08:00:00'],
  // Spring AC Tune-Up — 2 steps
  [3, 1, 0, 'sms', null, 'Hi {{firstName}}! Spring is here and summer is coming. Minuteman is booking AC tune-ups now — slots fill fast! Reply YES to schedule or call (781) 915-0895.', 'text', '2026-03-28 10:00:00'],
  [3, 2, 5, 'email', 'Time for your AC tune-up?', 'Hi {{firstName}},\n\nWith warmer weather right around the corner, now is the perfect time for an AC tune-up. A quick maintenance visit can prevent costly breakdowns when you need cool air the most.\n\nMinuteman offers:\n- Comprehensive AC inspections\n- Refrigerant top-offs\n- Filter replacement\n- Efficiency checks\n\nCall (781) 915-0895 or reply to schedule.\n\n— The Minuteman Team', 'text', '2026-03-28 10:00:00'],
  // Boiler Replacement — 2 steps
  [4, 1, 0, 'sms', null, 'Hi {{firstName}}, our records show we serviced your boiler previously. If it\'s been giving you trouble, we\'re running a special on high-efficiency replacements. Interested? Reply or call (781) 915-0895.', 'text', '2026-03-28 10:00:00'],
  [4, 2, 7, 'email', 'Is it time for a new boiler?', 'Hi {{firstName}},\n\nIf your boiler is 15+ years old, a high-efficiency replacement could save you hundreds per year on heating bills — and give you peace of mind through Boston winters.\n\nMinuteman offers:\n- Free replacement estimates\n- Financing options\n- Lifetime workmanship guarantee\n- Same-week installation available\n\nCall (781) 915-0895 or reply to learn more.\n\n— The Minuteman Team', 'text', '2026-03-28 10:00:00'],
  // Rizzo Re-Engagement — 2 steps
  [5, 1, 0, 'sms', null, 'Hi {{firstName}}! Minuteman Plumbing here — we\'ve partnered with Rizzo Plumbing and Heating and are proud to continue serving your home. Need plumbing, heating, or AC help? Reply or call (781) 915-0895.', 'text', '2026-03-28 10:00:00'],
  [5, 2, 5, 'email', 'Welcome to the Minuteman family', 'Hi {{firstName}},\n\nWe\'re excited to let you know that Minuteman Plumbing, Heating & Cooling has partnered with Rizzo Plumbing and Heating. All your service history is preserved, and our team is ready to help.\n\nAs a welcome, we\'re offering a complimentary system inspection for Rizzo customers. Just mention this email when you call.\n\nCall (781) 915-0895 or reply to schedule.\n\n— The Minuteman Team\nVeteran-Owned | Woman-Owned | Greater Boston & South Shore', 'text', '2026-03-28 10:00:00'],
];

const insertSequencesTransaction = db.transaction(() => {
  for (const s of sequences) {
    insertSequence.run(...s);
  }
});
insertSequencesTransaction();

// ── Campaign Enrollments ──
const insertEnrollment = db.prepare(`
  INSERT INTO campaign_enrollments (campaign_id, customer_id, status, current_step, enrolled_at, completed_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const enrollments = [
  // Estimate follow-up enrollments
  [2, 3, 'active', 1, '2026-03-31 12:00:00', null],   // James Moriarty — boiler estimate, step 1 sent
  [2, 5, 'active', 0, '2026-04-02 15:00:00', null],   // Robert Fitzgerald — bathroom estimate, just enrolled
  [2, 8, 'active', 0, '2026-04-03 11:00:00', null],   // Linda Nguyen — tankless estimate, just enrolled
  [2, 11, 'active', 2, '2026-03-16 14:00:00', null],  // Anthony Russo — furnace, step 2
  [2, 15, 'active', 1, '2026-03-21 12:00:00', null],  // Steven Petrov — AC install, step 1
  // Spring AC campaign enrollments
  [3, 4, 'completed', 2, '2026-04-01 08:00:00', '2026-04-03 10:00:00'], // Catherine — converted!
  [3, 12, 'active', 1, '2026-04-01 08:00:00', null],  // Helen Kowalski — step 1 sent
  // Rizzo re-engagement (paused)
  [5, 9, 'active', 0, '2026-04-01 08:00:00', null],
  [5, 10, 'active', 0, '2026-04-01 08:00:00', null],
  [5, 11, 'active', 0, '2026-04-01 08:00:00', null],
  [5, 13, 'active', 0, '2026-04-01 08:00:00', null],
  [5, 14, 'active', 0, '2026-04-01 08:00:00', null],
  [5, 15, 'active', 0, '2026-04-01 08:00:00', null],
  [5, 16, 'active', 0, '2026-04-01 08:00:00', null],
];

const insertEnrollmentsTransaction = db.transaction(() => {
  for (const e of enrollments) {
    insertEnrollment.run(...e);
  }
});
insertEnrollmentsTransaction();

// ── Messages ──
const insertMessage = db.prepare(`
  INSERT INTO messages (campaign_id, enrollment_id, customer_id, channel, direction, subject, body, status, external_id, sent_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const messagesData = [
  // Review requests sent
  [1, null, 2, 'sms', 'outbound', null, 'Hi Patricia! Thanks for choosing Minuteman Plumbing. We hope Marcus took great care of you today. If you have a moment, we\'d love a quick review: https://g.page/r/minuteman-plumbing/review', 'delivered', 'HATCH-MSG-001', '2026-03-28 16:00:00', '2026-03-28 16:00:00'],
  // Estimate follow-up messages
  [2, 1, 3, 'sms', 'outbound', null, 'Hi James, this is Minuteman Plumbing following up on your heating estimate. Do you have any questions we can help with? Just reply to this text.', 'delivered', 'HATCH-MSG-002', '2026-04-01 10:00:00', '2026-04-01 10:00:00'],
  [2, 4, 11, 'sms', 'outbound', null, 'Hi Anthony, this is Minuteman Plumbing following up on your heating estimate. Do you have any questions we can help with? Just reply to this text.', 'delivered', 'HATCH-MSG-003', '2026-03-17 10:00:00', '2026-03-17 10:00:00'],
  [2, 4, 11, 'email', 'outbound', 'Your heating estimate from Minuteman', 'Hi Anthony,\n\nWe wanted to follow up on the heating estimate we provided ($8,900.00). We know these decisions take time...', 'delivered', 'EMAIL-MSG-001', '2026-03-19 10:00:00', '2026-03-19 10:00:00'],
  [2, 5, 15, 'sms', 'outbound', null, 'Hi Steven, this is Minuteman Plumbing following up on your cooling estimate. Do you have any questions we can help with? Just reply to this text.', 'delivered', 'HATCH-MSG-004', '2026-03-22 10:00:00', '2026-03-22 10:00:00'],
  // Spring AC campaign
  [3, 6, 4, 'sms', 'outbound', null, 'Hi Catherine! Spring is here and summer is coming. Minuteman is booking AC tune-ups now — slots fill fast! Reply YES to schedule or call (781) 915-0895.', 'delivered', 'HATCH-MSG-005', '2026-04-01 09:00:00', '2026-04-01 09:00:00'],
  [3, 6, 4, 'email', 'outbound', 'Time for your AC tune-up?', 'Hi Catherine,\n\nWith warmer weather right around the corner...', 'delivered', 'EMAIL-MSG-002', '2026-04-03 09:00:00', '2026-04-03 09:00:00'],
  [3, 7, 12, 'sms', 'outbound', null, 'Hi Helen! Spring is here and summer is coming. Minuteman is booking AC tune-ups now — slots fill fast! Reply YES to schedule or call (781) 915-0895.', 'delivered', 'HATCH-MSG-006', '2026-04-01 09:15:00', '2026-04-01 09:15:00'],
  // Inbound reply
  [3, 6, 4, 'sms', 'inbound', null, 'YES please! Can you come this week?', 'replied', 'HATCH-MSG-007', '2026-04-01 11:30:00', '2026-04-01 11:30:00'],
];

const insertMessagesTransaction = db.transaction(() => {
  for (const m of messagesData) {
    insertMessage.run(...m);
  }
});
insertMessagesTransaction();

// ── Review Requests ──
const insertReview = db.prepare(`
  INSERT INTO review_requests (job_id, customer_id, message_id, status, sent_at, reviewed_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const reviews = [
  [2, 2, 1, 'sent', '2026-03-28 16:00:00', null], // Patricia — sent, no review yet
];

const insertReviewsTransaction = db.transaction(() => {
  for (const r of reviews) {
    insertReview.run(...r);
  }
});
insertReviewsTransaction();

// ── Daily Counters ──
const insertCounter = db.prepare(`
  INSERT INTO daily_counters (date, sms_count, email_count)
  VALUES (?, ?, ?)
`);

const counters = [
  ['2026-04-01', 8, 3],
  ['2026-04-02', 5, 2],
  ['2026-04-03', 6, 4],
  ['2026-04-04', 3, 1],
  ['2026-04-05', 2, 0],
];

const insertCountersTransaction = db.transaction(() => {
  for (const c of counters) {
    insertCounter.run(...c);
  }
});
insertCountersTransaction();

// ── Activity Log ──
const insertActivity = db.prepare(`
  INSERT INTO activity_log (type, description, metadata, created_at)
  VALUES (?, ?, ?, ?)
`);

const activities = [
  ['classification', 'Classified 8 customers for outbound targeting', '{"count": 8}', '2026-04-01 06:00:00'],
  ['review_sent', 'Review request sent to Patricia Sullivan for boiler maintenance job', '{"customer_id": 2, "job_id": 2}', '2026-03-28 16:00:00'],
  ['followup_sent', 'Estimate follow-up (Step 1 SMS) sent to James Moriarty', '{"customer_id": 3, "estimate_id": 1, "step": 1}', '2026-04-01 10:00:00'],
  ['followup_sent', 'Estimate follow-up (Step 1 SMS) sent to Anthony Russo', '{"customer_id": 11, "step": 1}', '2026-03-17 10:00:00'],
  ['followup_sent', 'Estimate follow-up (Step 2 Email) sent to Anthony Russo', '{"customer_id": 11, "step": 2}', '2026-03-19 10:00:00'],
  ['campaign_sent', 'Spring AC Tune-Up SMS sent to Catherine O\'Brien', '{"customer_id": 4, "campaign_id": 3}', '2026-04-01 09:00:00'],
  ['campaign_sent', 'Spring AC Tune-Up SMS sent to Helen Kowalski', '{"customer_id": 12, "campaign_id": 3}', '2026-04-01 09:15:00'],
  ['enrollment', 'Catherine O\'Brien replied YES to AC Tune-Up — converted to booking', '{"customer_id": 4, "campaign_id": 3}', '2026-04-01 11:30:00'],
  ['campaign_sent', 'Spring AC Tune-Up Email sent to Catherine O\'Brien', '{"customer_id": 4, "campaign_id": 3}', '2026-04-03 09:00:00'],
  ['review_sent', 'Review request sent to Michael Brennan for kitchen faucet replacement', '{"customer_id": 1, "job_id": 1}', '2026-04-04 17:30:00'],
  ['followup_sent', 'Estimate follow-up (Step 1 SMS) sent to Linda Nguyen', '{"customer_id": 8, "step": 1}', '2026-04-03 11:00:00'],
];

const insertActivitiesTransaction = db.transaction(() => {
  for (const a of activities) {
    insertActivity.run(...a);
  }
});
insertActivitiesTransaction();

// ── Message Templates ──
db.exec("DELETE FROM message_templates;");

const insertTemplate = db.prepare(`
  INSERT INTO message_templates (name, channel, subject, body, content_format, is_default, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
`);

const templatesData = [
  // SMS templates
  ['Review Request', 'sms', null, 'Hi {{firstName}}! Thanks for choosing Minuteman Plumbing. We hope {{techName}} took great care of you today. If you have a moment, we\'d love a quick review: {{reviewLink}}', 'text'],
  ['Estimate Follow-Up (Friendly)', 'sms', null, 'Hi {{firstName}}, this is Minuteman Plumbing following up on your {{serviceType}} estimate. Do you have any questions we can help with? Just reply to this text.', 'text'],
  ['Estimate Follow-Up (Check-In)', 'sms', null, 'Hi {{firstName}}, just checking in on your {{serviceType}} estimate from Minuteman. We\'d love to help get this taken care of for you. Any questions? Reply here or call (781) 915-0895.', 'text'],
  ['AC Tune-Up Promo', 'sms', null, 'Hi {{firstName}}! Spring is here and summer is coming. Minuteman is booking AC tune-ups now — slots fill fast! Reply YES to schedule or call (781) 915-0895.', 'text'],
  ['Heating Season Prep', 'sms', null, 'Hi {{firstName}}! Winter is coming and now is the perfect time for a heating tune-up. Don\'t wait for a cold night breakdown. Reply YES or call (781) 915-0895 to book.', 'text'],
  ['Boiler Replacement Outreach', 'sms', null, 'Hi {{firstName}}, our records show we serviced your boiler previously. If it\'s been giving you trouble, we\'re running a special on high-efficiency replacements. Interested? Reply or call (781) 915-0895.', 'text'],
  ['Rizzo Welcome', 'sms', null, 'Hi {{firstName}}! Minuteman Plumbing here — we\'ve partnered with Rizzo Plumbing and Heating and are proud to continue serving your home. Need plumbing, heating, or AC help? Reply or call (781) 915-0895.', 'text'],
  ['Service Reminder', 'sms', null, 'Hi {{firstName}}, it\'s been a while since your last {{serviceType}} service with Minuteman. Want to schedule a check-up? Reply here or call (781) 915-0895.', 'text'],
  ['Emergency Reminder', 'sms', null, 'Hi {{firstName}}, just a reminder — Minuteman offers 24/7 emergency plumbing and heating service with a 1-hour response. Save our number: (781) 915-0895. We\'re always here.', 'text'],
  ['Referral Ask', 'sms', null, 'Hi {{firstName}}! If you were happy with your recent {{serviceType}} service from Minuteman, we\'d love it if you told a friend. Referrals help us keep serving families like yours. Thank you!', 'text'],
  // Email templates
  ['Estimate Follow-Up (Day 3)', 'email', 'Your {{serviceType}} estimate from Minuteman', 'Hi {{firstName}},\n\nWe wanted to follow up on the {{serviceType}} estimate we provided{{estimateAmount}}. We know these decisions take time, and we\'re here to answer any questions.\n\nA few things to keep in mind:\n- We offer financing options for larger projects\n- Our lifetime workmanship guarantee covers all installations\n- We can often schedule within 24-48 hours when you\'re ready\n\nJust reply to this email or call us at (781) 915-0895.\n\n— The Minuteman Team', 'text'],
  ['Estimate Follow-Up (Last Touch)', 'email', 'Still thinking about your {{serviceType}} project?', 'Hi {{firstName}},\n\nWe know life gets busy! We\'re reaching out one last time about your {{serviceType}} estimate. If your needs have changed or you have new questions, we\'re always here.\n\nAs a reminder, Minuteman offers:\n- 24/7 emergency service with 1-hour response\n- Lifetime workmanship guarantee\n- Flexible financing options\n\nWe hope to hear from you, but no pressure — we\'ll be here whenever you\'re ready.\n\n— The Minuteman Team', 'text'],
  ['AC Tune-Up Campaign', 'email', 'Time for your AC tune-up?', 'Hi {{firstName}},\n\nWith warmer weather right around the corner, now is the perfect time for an AC tune-up. A quick maintenance visit can prevent costly breakdowns when you need cool air the most.\n\nMinuteman offers:\n- Comprehensive AC inspections\n- Refrigerant top-offs\n- Filter replacement\n- Efficiency checks\n\nCall (781) 915-0895 or reply to schedule.\n\n— The Minuteman Team', 'text'],
  ['Boiler Replacement', 'email', 'Is it time for a new boiler?', 'Hi {{firstName}},\n\nIf your boiler is 15+ years old, a high-efficiency replacement could save you hundreds per year on heating bills — and give you peace of mind through Boston winters.\n\nMinuteman offers:\n- Free replacement estimates\n- Financing options\n- Lifetime workmanship guarantee\n- Same-week installation available\n\nCall (781) 915-0895 or reply to learn more.\n\n— The Minuteman Team', 'text'],
  ['Rizzo Welcome Email', 'email', 'Welcome to the Minuteman family', 'Hi {{firstName}},\n\nWe\'re excited to let you know that Minuteman Plumbing, Heating & Cooling has partnered with Rizzo Plumbing and Heating. All your service history is preserved, and our team is ready to help.\n\nAs a welcome, we\'re offering a complimentary system inspection for Rizzo customers. Just mention this email when you call.\n\nCall (781) 915-0895 or reply to schedule.\n\n— The Minuteman Team\nVeteran-Owned | Woman-Owned | Greater Boston & South Shore', 'text'],
  ['Seasonal Plumbing Check', 'email', 'Protect your home this season — plumbing check-up', 'Hi {{firstName}},\n\nSeasonal changes can stress your plumbing. A quick inspection can catch small issues before they become expensive emergencies.\n\nOur plumbing check-up includes:\n- Water heater inspection\n- Pipe and valve check\n- Drain flow testing\n- Sump pump verification\n\nBook yours today — call (781) 915-0895 or reply to this email.\n\n— The Minuteman Team', 'text'],
  ['Water Heater Upgrade', 'email', 'Considering a tankless water heater?', 'Hi {{firstName}},\n\nTankless water heaters deliver endless hot water, take up less space, and can cut your energy bills by up to 30%.\n\nMinuteman installs top brands like Navien and Rinnai, with:\n- Free in-home estimates\n- Same-week installation\n- Lifetime workmanship guarantee\n- Financing available\n\nCurious? Call (781) 915-0895 or reply for a free quote.\n\n— The Minuteman Team', 'text'],
  ['Re-Engagement (Dormant Customer)', 'email', 'We miss you, {{firstName}}!', 'Hi {{firstName}},\n\nIt\'s been a while since we last helped with your home. We wanted to check in and make sure everything is running smoothly.\n\nWhether it\'s plumbing, heating, or AC — Minuteman is here for you:\n- 24/7 emergency service\n- 1-hour response time\n- Lifetime workmanship guarantee\n\nNeed anything? Just reply or call (781) 915-0895.\n\n— The Minuteman Team', 'text'],
];

const insertTemplatesTransaction = db.transaction(() => {
  for (const t of templatesData) {
    insertTemplate.run(...t);
  }
});
insertTemplatesTransaction();

console.log('[seed] Demo data seeded successfully:');
console.log('  - 16 customers (8 Minuteman, 8 Rizzo)');
console.log('  - 10 jobs');
console.log('  - 7 estimates (5 unsold)');
console.log('  - 8 customer classifications');
console.log('  - 5 campaigns');
console.log('  - 12 campaign sequences');
console.log('  - 14 enrollments');
console.log('  - 9 messages');
console.log('  - 1 review request');
console.log('  - 11 activity log entries');
console.log('  - 18 message templates (10 SMS, 8 email)');

process.exit(0);
