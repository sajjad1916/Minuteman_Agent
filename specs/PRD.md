# Minuteman Marketing Agent — PRD v1.0

**Client**: Nat Sabatt — Minuteman Plumbing, Heating & Cooling | **Date**: 2026-03-31 | **Build Type**: New

---

## One-Line Summary

A marketing automation agent that triggers review requests, follows up on unsold estimates, and runs seasonal outbound campaigns from Service Titan data — so Minuteman stops leaving money on the table between service calls.

---

## Build Spec

_Share this section with the customer for approval before starting the build._

- Automatically text customers for a Google review when a job is marked complete — no more relying on techs to remember to ask
- Follow up on unsold estimates with a sequence of texts and emails so quotes don't go cold
- Run seasonal outbound campaigns to your customer list when the dispatch board is light — fill empty slots before they cost you money
- A simple UI to create, edit, and control your campaigns — you own the sequences, the copy, and the guardrails
- Export contact lists anytime so your team can make targeted phone calls to the same people the agent is already texting

---

## Company Context

_Researched from the customer's website._

Minuteman Plumbing, Heating & Cooling is a veteran-owned, woman-owned plumbing and HVAC company serving Greater Boston and the South Shore of Massachusetts. They handle plumbing repairs, water heater service, boiler and furnace installation/repair, AC systems, and ductless mini splits for residential customers. They offer 24/7 emergency service with a one-hour business response time and a lifetime workmanship guarantee.

The company recently made a tuck-in acquisition of Rizzo Plumbing and Heating, bringing in 8,000+ legacy customer contacts. They run about 100 service calls per week with a team of plumbers and HVAC technicians. Currently on Service Titan (though exploring Housecall Pro) and recently started using Hatch (acquired by Yelp) for SMS campaigns. They're in a growth phase, looking to increase conversion rates, reduce seasonal downtime, and farm their large customer base more effectively.

---

## Developer Brief

_Quick context for the engineer._

- **Review requests**: Minuteman pays techs $20 per 5-star Google review, but one guy gets 80% of reviews while the rest never ask. The agent removes the human bottleneck — when a job hits "complete" in Service Titan, it automatically sends a review request via text. This is high-value and low-effort.
- **Unsold estimate follow-up**: Conversion rate is around 30-40%. Many estimates are presented in-home or sent via email, then crickets. Automated follow-up (day 1, day 3, day 7, etc.) via text and email keeps Minuteman top-of-mind without manual effort. The trigger is an estimate being generated in Service Titan with no subsequent conversion.
- **Seasonal/outbound campaigns**: HVAC has "shoulder seasons" where demand drops — heating season ends, AC hasn't started. The dispatch board empties out. The agent can proactively reach out to past customers (especially the 8,000+ Rizzo list) based on: recency of last visit, type of equipment, age of equipment, number of past visits. This fills empty slots and creates sales opportunities.
- **Intelligence layer outside Hatch**: Nat tried turning on Hatch campaigns directly and had to shut them off in 6 hours — fire hose of confused customers. The agent sits between Service Titan (data) and Hatch (messaging), applying classification logic, guardrails (message caps, timing), and business rules before anything goes out.
- **Campaign UI**: Nat needs to be able to see and edit what's happening — what sequences are active, what copy is being sent, how many messages per day, which customers are enrolled. This isn't a black box.

---

## Stack Suggestions

_Recommended tools and services. The engineer may diverge if the project calls for it._

| Layer | Tool | Rationale |
|-------|------|-----------|
| Hosting | Railway | Agent backend, campaign logic, cron jobs for scheduled sequences. |
| Backend | Node.js or Python | Service Titan API integration, Hatch API integration, campaign sequencing logic. |
| Database | SQLite or Postgres on Railway | Customer classification, campaign enrollment, sequence state (who got what, when), message history. |
| Integrations | n8n | Service Titan webhooks (job complete, estimate generated), Hatch API for outbound messaging. |
| AI | Gemini Flash 3 (Lightweight) | Customer classification (equipment type, recency, potential value). Campaign copy generation if needed. |
| Frontend | HTML + CSS + JS | Campaign management UI — create/edit sequences, view enrolled contacts, set guardrails (daily caps), export lists. |

**Environment Variables**: `SERVICE_TITAN_API_KEY`, `SERVICE_TITAN_TENANT_ID`, `HATCH_API_KEY`, `GOOGLE_REVIEW_LINK`, `EMAIL_SMTP_HOST`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`, `OPENROUTER_API_KEY`

---

## Screen Share Timestamps

_No screen sharing in this call. Audio-only discussion._

---

## Key Definitions

_Domain terms the engineer needs to understand._

| Term | Meaning | Examples |
|------|---------|----------|
| Service Titan | Field service management software Minuteman uses for dispatching, invoicing, estimates, and customer records | Jobs, estimates, customer history all live here |
| Hatch | SMS/text marketing platform (recently acquired by Yelp) with AI conversation agents | Currently used for speed-to-lead and one experimental campaign |
| Shoulder Season | Period between heating and cooling seasons when demand drops and the dispatch board empties | Late March through May in Boston — too warm for heating emergencies, too cold for AC |
| Dispatch Board | Daily/weekly schedule of technician appointments | "The board is only 50% full tomorrow — we need to book 10 more calls" |
| Unsold Estimate | A quote presented to a customer that hasn't been accepted or declined | Tech visits a home, presents options, customer says "let me think about it" — then nothing |
| Rizzo Customers | 8,000+ legacy contacts from the tuck-in acquisition of Rizzo Plumbing and Heating | Many haven't been contacted since the acquisition — potential goldmine for outbound |
| CSR | Customer Service Representative — books appointments, handles inbound calls | Several on the team, most hired through Sagan |
| LSA | Local Services Ads (Google) — a lead source that feeds into Hatch's speed-to-lead flow | Inbound leads that need fast response |

---

## Engineering Stories

_These are suggestions. The assigned engineer will review the transcript independently and make their own implementation decisions._

### User Story 1: Automatically request reviews when a job is complete

#### 1a: Service Titan Job Complete Trigger

- **Description**: When a job is marked "complete" in Service Titan, trigger a review request sequence. Send the customer a text message (and optionally email) with a link to leave a Google review.
- **Acceptance Criteria**:
  - [ ] Detects job completion via Service Titan API (webhook or polling)
  - [ ] Sends review request within a configurable time window after completion (e.g., 2 hours)
  - [ ] Includes a direct Google review link
  - [ ] Sends via Hatch API (text) and/or email
  - [ ] Doesn't send to the same customer more than once per visit
  - [ ] Tracks whether a review was left (if detectable)
- **Data Sources**: Service Titan (job complete event), Hatch API (outbound text)
- **AI/Models**: None — template-based messaging
- **Notes**: Nat said one tech gets 80% of reviews while others never ask. The agent makes review requests automatic regardless of which tech did the job.

### User Story 2: Follow up on unsold estimates

#### 2a: Estimate Follow-Up Sequence

- **Description**: When an estimate is generated in Service Titan but no job is booked within a configurable window (e.g., 48 hours), enroll the customer in an automated follow-up sequence. Sequence includes multiple touchpoints (text, email) spaced over days/weeks.
- **Acceptance Criteria**:
  - [ ] Detects estimates in Service Titan that haven't converted to booked jobs
  - [ ] Enrolls customer in a configurable follow-up sequence (e.g., Day 1 text, Day 3 email, Day 7 text, Day 14 email)
  - [ ] Sequence copy is editable via the campaign UI
  - [ ] If customer books or explicitly declines during the sequence, stop follow-up
  - [ ] Daily message cap is configurable (e.g., max 20 messages/day to prevent fire-hosing)
- **Data Sources**: Service Titan (estimate events, booking events), Hatch API or direct email
- **AI/Models**: None for v1 — template sequences with variable insertion (customer name, service type, estimate amount)
- **Notes**: Nat described a 30-40% conversion rate. The unsold 60-70% currently get no follow-up. This is low-hanging revenue. Nat's Hatch fire-hose incident means guardrails are critical — the UI must expose daily caps and allow pausing campaigns.

### User Story 3: Run seasonal outbound campaigns

#### 3a: Customer Classification

- **Description**: Classify the customer base (including Rizzo's 8,000+ contacts) based on factors that determine outbound priority: recency of last service, type of service performed, equipment type/age, number of past visits, and estimated potential value.
- **Acceptance Criteria**:
  - [ ] Ingests customer and job history from Service Titan
  - [ ] Classifies each customer by: last service date, service categories (plumbing, heating, AC), visit frequency, equipment indicators
  - [ ] Produces a prioritized outbound list (e.g., "had boiler repair 2 years ago, hasn't been seen since — high priority for replacement outreach")
  - [ ] Classification runs on demand or on a weekly schedule
- **Data Sources**: Service Titan (customer records, job history)
- **AI/Models**: Lightweight tier — Gemini Flash 3 for interpreting service descriptions and estimating equipment relevance. Rule-based logic for recency/frequency scoring.
- **Notes**: Nat said at [16:21]: "If someone had a 25-year-old boiler that was repaired two years ago, there's a decent chance that it will need to be replaced." Equipment age and service type are key signals.

#### 3b: Campaign Enrollment and Messaging

- **Description**: Based on classification, enroll customers in seasonal campaigns. The team can trigger campaigns from the UI when the dispatch board is light. Messages go out via text and email with configurable daily caps and content.
- **Acceptance Criteria**:
  - [ ] Campaign UI shows available campaigns (e.g., "Spring AC Tune-Up," "Boiler Replacement Outreach," "Rizzo Re-engagement")
  - [ ] Each campaign has configurable: target audience criteria, message sequence, daily send cap, active dates
  - [ ] Enrolled contacts are exportable as a list (CSV) for phone outbound by the team
  - [ ] Campaigns can be paused, resumed, or stopped at any time
  - [ ] Prevents duplicate outreach (customer won't get the same campaign twice)
- **Data Sources**: Classified customer list from Story 3a, Hatch API or direct email for messaging
- **AI/Models**: None for campaign execution — classification from 3a feeds the targeting
- **Notes**: Nat described needing to communicate with 300-400 contacts per week during shoulder season. The export feature is critical — when the board is light, the team can call the same people who are already in the text/email sequence for better response rates. Zaki positioned AI phone calling as v2.

---

## Data Sources

_All external systems the build connects to._

| Source | Type | Direction | Integration Method | Notes |
|--------|------|-----------|-------------------|-------|
| Service Titan | Field Service Mgmt | In | Service Titan API — job events, estimates, customer records | Primary data source. Triggers for review requests and estimate follow-ups. Customer history for classification. May switch to Housecall Pro later — agent is platform-independent. |
| Hatch | SMS Platform | Out | Hatch API — send text messages | Primary outbound text channel. Recently acquired by Yelp. Has API but verify volume limits. If Hatch doesn't scale or gets shut down, can swap for Twilio. |
| Email (Gmail/Microsoft) | Email | Out | SMTP or Microsoft Graph API | Outbound email for follow-ups and campaigns. May use info@minutemanplumbing.com or spin up a dedicated sender. |
| Google Business Profile | Review Platform | _Reference only_ | Direct link in messages | Review request link embedded in messages. No API integration needed. |
| n8n | Integration | Both | Webhook + HTTP nodes | Service Titan event listener, Hatch API calls, email dispatch. |

---

## Discussed But Not Confirmed

_These items came up in the transcript but were not explicitly committed to. Verify with the customer before including in the build._

- **AI phone outbound / SDR calling**: Zaki mentioned automating phone calls as a v2 if text/email campaigns create enough qualified leads to call. Not in v1 — team calls manually using exported lists for now.
- **Hatch vs. standalone messaging**: Zaki flagged that he needs to verify Hatch's API can handle campaign volume (300-400/week). May need to build standalone messaging via Twilio if Hatch doesn't scale or gets degraded post-Yelp acquisition.

---

## Out of Scope (Future Phases)

_These were discussed but deferred. Preserved here so nothing is lost._

- **Recruiting agent**: Nat listed recruiting as a major pain — finding plumbers and HVAC techs who aren't on LinkedIn. Zaki said "I'll save that for later — could be a really good v2."
- **CSR booking rate optimization**: Mentioned but not scoped. Could involve call coaching or script optimization.
- **Price book creation/curation**: Listed on intake form as a pain. Building and maintaining a menu of services with pricing. Not addressed in this call.
- **Technician consistency / checklists**: Nat described how 5 HVAC techs would do a furnace maintenance 5 different ways. Standardization problem — potentially solvable with mobile checklists. Not scoped.
- **Sell options / in-home estimate presentation**: Improving how techs present options in the customer's home. Related to price book. Not scoped.
- **Suggested by Sagan — not discussed on call**: "Anytime installation" pricing model — Jon's idea for matching supply/demand by offering discounted flexible scheduling. Nat was intrigued but it's a business model change, not a tech build.

---

## Confidence Score

_How well-scoped is this build? Scored across three dimensions, each out of 5. Overall = the lowest score._

| Dimension | Score | Notes |
|-----------|-------|-------|
| Scope Definition | 4/5 | Three clear sequences (reviews, estimate follow-up, seasonal outbound) plus campaign UI. The Hatch integration path needs verification (API volume, capabilities). |
| Technical Feasibility | 4/5 | Service Titan has a well-documented API. Hatch API exists (built on Twilio). Campaign sequencing is a solved problem. Main risk: Hatch API limitations or post-Yelp-acquisition degradation. Fallback to Twilio is straightforward. |
| Customer Impact | 5/5 | Directly addresses revenue leakage: 60-70% of estimates go unresponsive, review collection is broken, 8,000+ legacy customers are unfarmed, shoulder season empties the board. Every sequence touches real revenue. |
| **Overall** | **4/5** | **= lowest of the three (Scope Definition / Technical Feasibility)** |

High-impact build with clear revenue implications. The Hatch integration is the main uncertainty — verify API capabilities early and have Twilio as fallback.

---

## Audit Notes

All engineering stories traced to transcript. Review request automation was Nat's explicit pain at [00:48]: "We pay each technician $20 for a five-star Google review... we have one guy who asks every single time and gets 80% of reviews." Unsold estimate follow-up was described at length: "We either present it in the house or send them an estimate afterward via email, and then it's sort of just like crickets" — conversion rate ~30-40%. Seasonal outbound was Nat's detailed description at [07:36] of shoulder season capacity gaps.

Zaki proposed the marketing agent architecture at [09:16] and Nat confirmed: "Perfect. Perfect. Perfect." The intelligence-layer-outside-Hatch approach was Zaki's explicit response to Nat's fire-hose incident at [26:10]. Campaign UI was committed to by Zaki at [13:34]. Recruiting agent moved to Out of Scope — Zaki deferred at [24:22]. No red flags found.
