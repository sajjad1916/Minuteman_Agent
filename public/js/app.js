/* ── Minuteman Marketing Agent — Frontend ── */

const API = '';
let currentPage = 'dashboard';
let customerPage = 1;
let logsOffset = 0;
let logsAutoRefresh = null;
let authToken = localStorage.getItem('mm_token') || '';
let currentUser = null;

// ── Authenticated fetch wrapper ──
function apiFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }
  return fetch(url, options).then(res => {
    if (res.status === 401) {
      // Token expired or invalid — force logout
      doLogout();
      throw new Error('Session expired');
    }
    return res;
  });
}

// ── Auth ──
async function doLogin() {
  const username = document.getElementById('login-user').value;
  const password = document.getElementById('login-pass').value;
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (data.success && data.token) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('mm_token', authToken);
      enterApp();
    } else {
      errorEl.textContent = data.error || 'Invalid credentials';
      errorEl.classList.remove('hidden');
    }
  } catch (e) {
    errorEl.textContent = 'Connection error';
    errorEl.classList.remove('hidden');
  }
}

function doLogout() {
  if (authToken) {
    fetch(`${API}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
    }).catch(() => {});
  }
  authToken = '';
  currentUser = null;
  localStorage.removeItem('mm_token');
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-error').classList.add('hidden');
}

function enterApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  const userEl = document.getElementById('sidebar-user');
  if (userEl && currentUser) {
    userEl.textContent = `${currentUser.username} (${currentUser.role})`;
  }
  loadDashboard();
  loadSettings();
}

// Auto-restore session on page load
(async function restoreSession() {
  if (!authToken) return;
  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      enterApp();
    } else {
      localStorage.removeItem('mm_token');
      authToken = '';
    }
  } catch {
    localStorage.removeItem('mm_token');
    authToken = '';
  }
})();

// ── Navigation ──
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const page = item.dataset.page;
    showPage(page);
  });
});

function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.remove('hidden');

  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  if (page === 'dashboard') loadDashboard();
  else if (page === 'campaigns') loadCampaigns();
  else if (page === 'templates') loadTemplates();
  else if (page === 'customers') loadCustomers();
  else if (page === 'activity') loadActivity();
  else if (page === 'logs') loadLogs();
  else if (page === 'settings') loadSettings();
}

// ── Dashboard ──
async function loadDashboard() {
  try {
    const [stats, activity] = await Promise.all([
      apiFetch(`${API}/api/dashboard`).then(r => r.json()),
      apiFetch(`${API}/api/dashboard/activity?limit=10`).then(r => r.json()),
    ]);

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Total Customers</div>
        <div class="stat-value">${stats.customers.total}</div>
        <div class="stat-sub">${stats.customers.minuteman} Minuteman &middot; ${stats.customers.rizzo} Rizzo</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Campaigns</div>
        <div class="stat-value">${stats.campaigns.active}</div>
        <div class="stat-sub">${stats.campaigns.paused} paused &middot; ${stats.campaigns.draft} drafts</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Enrollments</div>
        <div class="stat-value">${stats.enrollments.active}</div>
        <div class="stat-sub">${stats.enrollments.completed} completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Open Estimates</div>
        <div class="stat-value">$${Number(stats.estimates.openValue).toLocaleString()}</div>
        <div class="stat-sub">${stats.estimates.open} pending quotes</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Messages Today</div>
        <div class="stat-value">${stats.todaySends.sms_count + stats.todaySends.email_count}</div>
        <div class="stat-sub">${stats.todaySends.sms_count} SMS &middot; ${stats.todaySends.email_count} email</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Reviews Sent</div>
        <div class="stat-value">${stats.reviews.sent}</div>
        <div class="stat-sub">${stats.reviews.reviewed} reviews received</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">High Priority</div>
        <div class="stat-value">${stats.classifications.high}</div>
        <div class="stat-sub">${stats.classifications.medium} medium &middot; ${stats.classifications.low} low</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Messages This Week</div>
        <div class="stat-value">${stats.messagesThisWeek.sms + stats.messagesThisWeek.email}</div>
        <div class="stat-sub">${stats.messagesThisWeek.sms} SMS &middot; ${stats.messagesThisWeek.email} email</div>
      </div>
    `;

    document.getElementById('dashboard-activity').innerHTML = activity.length
      ? activity.map(a => `
        <div class="activity-item">
          <div class="activity-dot ${a.type}"></div>
          <div>
            <div>${escapeHtml(a.description)}</div>
            <div class="activity-time">${timeAgo(a.created_at)}</div>
          </div>
        </div>
      `).join('')
      : '<p style="color:var(--gray-500);font-size:13px;padding:8px 0;">No recent activity</p>';

    // Load open estimates for dashboard
    const customersRes = await apiFetch(`${API}/api/customers?limit=100`);
    const customersData = await customersRes.json();
    // We'll show estimates from the dashboard stats instead
    document.getElementById('dashboard-estimates').innerHTML = `
      <p style="color:var(--gray-600);font-size:13px;padding:4px 0;">
        <strong>${stats.estimates.open}</strong> open estimates worth <strong>$${Number(stats.estimates.openValue).toLocaleString()}</strong>
      </p>
      <p style="color:var(--gray-500);font-size:12px;margin-top:8px;">
        Estimates without follow-up are automatically enrolled in the follow-up sequence after ${stats.estimates.open > 0 ? '48' : '—'} hours.
      </p>
    `;
    startAutomationTimers();
  } catch (e) {
    console.error('Dashboard load failed:', e);
  }
}

// ── Automation Countdown Timers ──
let _autoTimerInterval = null;
let _autoSchedules = null;
let _serverTimeDelta = 0; // ms difference: serverTime - clientTime

function getNextCronRun(cron, now) {
  const parts = cron.split(' ');
  const [minField, hourField, , , dowField] = parts;

  // */30 * * * * → next :00 or :30
  if (minField === '*/30') {
    const next = new Date(now);
    next.setSeconds(0, 0);
    const m = next.getMinutes();
    if (m < 30) {
      next.setMinutes(30);
    } else {
      next.setMinutes(0);
      next.setHours(next.getHours() + 1);
    }
    if (next <= now) { next.setMinutes(next.getMinutes() + 30); }
    return next;
  }

  // 15 * * * * → next :15 of any hour
  if (/^\d+$/.test(minField) && hourField === '*' && dowField === '*') {
    const targetMin = parseInt(minField);
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(targetMin);
    if (next <= now) {
      next.setHours(next.getHours() + 1);
    }
    return next;
  }

  // 0 6 * * 1 → next Monday at 06:00
  if (/^\d+$/.test(minField) && /^\d+$/.test(hourField) && /^\d+$/.test(dowField)) {
    const targetMin = parseInt(minField);
    const targetHour = parseInt(hourField);
    const targetDow = parseInt(dowField); // 0=Sun, 1=Mon
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(targetMin);
    next.setHours(targetHour);
    // Find next occurrence of target day-of-week
    const currentDow = next.getDay();
    let daysUntil = (targetDow - currentDow + 7) % 7;
    if (daysUntil === 0 && next <= now) daysUntil = 7;
    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  return null;
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Running now...';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (days > 0) return `Next run in: ${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `Next run in: ${hours}h ${mins}m ${secs}s`;
  return `Next run in: ${mins}m ${secs.toString().padStart(2, '0')}s`;
}

async function startAutomationTimers() {
  // Stop any existing interval
  if (_autoTimerInterval) clearInterval(_autoTimerInterval);

  try {
    const data = await fetch(`${API}/api/health/schedules`).then(r => r.json());
    _autoSchedules = data.schedules;
    _serverTimeDelta = new Date(data.serverTime).getTime() - Date.now();
  } catch {
    return; // silently fail — timers just won't show
  }

  // Populate schedule labels and last run info from API
  for (const s of _autoSchedules) {
    const scheduleEl = document.getElementById(`auto-schedule-${s.name}`);
    if (scheduleEl) scheduleEl.textContent = s.label;
    const sublabelEl = document.getElementById(`auto-sublabel-${s.name}`);
    if (sublabelEl && s.sublabel) sublabelEl.textContent = s.sublabel;
    const lastEl = document.getElementById(`auto-last-${s.name}`);
    if (lastEl && s.lastRun) {
      lastEl.textContent = `Last run: ${timeAgo(s.lastRun)} — ${s.lastResult}`;
      lastEl.classList.remove('hidden');
    }
  }

  function tick() {
    const now = new Date(Date.now() + _serverTimeDelta);
    for (const s of _autoSchedules) {
      const el = document.getElementById(`auto-timer-${s.name}`);
      if (!el) continue;
      const nextRun = getNextCronRun(s.cron, now);
      if (nextRun) {
        el.textContent = formatCountdown(nextRun.getTime() - now.getTime());
      }
    }
  }

  tick(); // run immediately
  _autoTimerInterval = setInterval(tick, 1000);
}

// ── Campaigns ──
async function loadCampaigns() {
  try {
    const campaigns = await apiFetch(`${API}/api/campaigns`).then(r => r.json());
    document.getElementById('campaigns-list').innerHTML = campaigns.map(c => `
      <div class="card" style="cursor:pointer;" onclick="loadCampaignDetail(${c.id})">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <h3 style="font-size:16px;font-weight:600;margin-bottom:4px;">${escapeHtml(c.name)}</h3>
            <p style="font-size:13px;color:var(--gray-600);margin-bottom:8px;">${escapeHtml(c.description || '')}</p>
            <div style="display:flex;gap:8px;align-items:center;">
              <span class="badge badge-${c.status}">${c.status}</span>
              <span style="font-size:12px;color:var(--gray-500);">${c.type.replace(/_/g, ' ')}</span>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:700;color:var(--navy);">${c.active_enrollments || 0}</div>
            <div style="font-size:11px;color:var(--gray-500);">active</div>
            <div style="font-size:12px;color:var(--gray-500);margin-top:4px;">${c.total_messages || 0} messages sent</div>
          </div>
        </div>
        <div style="display:flex;gap:16px;margin-top:12px;font-size:12px;color:var(--gray-500);">
          <span>SMS cap: ${c.daily_sms_cap}/day</span>
          <span>Email cap: ${c.daily_email_cap}/day</span>
          ${c.start_date ? `<span>Start: ${c.start_date}</span>` : ''}
          ${c.end_date ? `<span>End: ${c.end_date}</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Campaigns load failed:', e);
  }
}

async function loadCampaignDetail(id) {
  try {
    const data = await apiFetch(`${API}/api/campaigns/${id}`).then(r => r.json());
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-campaign-detail').classList.remove('hidden');

    document.getElementById('campaign-detail-title').textContent = data.name;
    document.getElementById('campaign-detail-actions').innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="exportCampaignContacts(${id})">Export Contacts</button>
      ${data.status === 'draft' ? `<button class="btn btn-success btn-sm" onclick="campaignAction(${id},'activate')">Activate</button>` : ''}
      ${data.status === 'active' ? `<button class="btn btn-warning btn-sm" onclick="campaignAction(${id},'pause')">Pause</button>` : ''}
      ${data.status === 'paused' ? `<button class="btn btn-success btn-sm" onclick="campaignAction(${id},'resume')">Resume</button>` : ''}
    `;

    // Tab handling
    let activeTab = 'overview';
    document.querySelectorAll('#campaign-tabs .tab').forEach(t => {
      t.classList.remove('active');
      if (t.dataset.tab === 'overview') t.classList.add('active');
      t.onclick = () => {
        activeTab = t.dataset.tab;
        document.querySelectorAll('#campaign-tabs .tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        renderCampaignTab(data, activeTab);
      };
    });

    renderCampaignTab(data, activeTab);
  } catch (e) {
    console.error('Campaign detail failed:', e);
  }
}

function renderCampaignTab(data, tab) {
  const el = document.getElementById('campaign-detail-content');
  if (tab === 'overview') {
    const segments = JSON.parse(data.target_segments || '[]');
    el.innerHTML = `
      <div class="card">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div>
            <div class="form-group"><label>Type</label><div>${data.type.replace(/_/g, ' ')}</div></div>
            <div class="form-group"><label>Status</label><div><span class="badge badge-${data.status}">${data.status}</span></div></div>
            <div class="form-group"><label>Description</label><div style="font-size:13px;">${escapeHtml(data.description || 'No description')}</div></div>
          </div>
          <div>
            <div class="form-group"><label>Daily SMS Cap</label><div>${data.daily_sms_cap}</div></div>
            <div class="form-group"><label>Daily Email Cap</label><div>${data.daily_email_cap}</div></div>
            <div class="form-group"><label>Target Segments</label><div>${segments.length ? segments.map(s => `<span class="badge badge-draft" style="margin-right:4px;">${s}</span>`).join('') : 'All'}</div></div>
            <div class="form-group"><label>Date Range</label><div>${data.start_date || '—'} to ${data.end_date || 'ongoing'}</div></div>
          </div>
        </div>
      </div>
    `;
  } else if (tab === 'sequences') {
    const steps = data.sequences || [];
    const nextStep = steps.length ? Math.max(...steps.map(s => s.step_number)) + 1 : 1;
    // Store steps in a global so onclick handlers can reference them safely
    window._seqSteps = steps;
    window._seqCampaignId = data.id;
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Message Sequence (${steps.length} steps)</h3>
          <button class="btn btn-primary btn-sm" onclick="showStepModal(${data.id}, null, ${nextStep})">+ Add Step</button>
        </div>
        ${steps.length ? steps.map((s, i) => `
          <div class="seq-step-card">
            <div class="seq-step-header">
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="seq-step-num">Step ${s.step_number}</span>
                <span class="badge badge-${s.channel}">${s.channel.toUpperCase()}</span>
                ${s.channel === 'email' ? `<span class="badge badge-draft">${(s.content_format || 'text').toUpperCase()}</span>` : ''}
                <span style="font-size:12px;color:var(--gray-500);">${s.delay_days === 0 ? 'Immediate' : `Day ${s.delay_days}`}</span>
              </div>
              <div style="display:flex;gap:4px;">
                <button class="btn btn-secondary btn-sm" onclick="previewStepByIndex(${i})">Preview</button>
                <button class="btn btn-secondary btn-sm" onclick="editStepByIndex(${i})">Edit</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="deleteStep(${s.id}, ${data.id})">Delete</button>
              </div>
            </div>
            ${s.channel === 'email' && s.subject ? `<div style="font-size:13px;color:var(--gray-700);margin-bottom:4px;"><strong>Subject:</strong> ${escapeHtml(s.subject)}</div>` : ''}
            <div class="seq-step-body">${escapeHtml(s.body_template.substring(0, 200))}${s.body_template.length > 200 ? '...' : ''}</div>
          </div>
        `).join('') : '<p style="padding:20px;color:var(--gray-500);">No sequence steps yet. Click "+ Add Step" to create one.</p>'}
      </div>
    `;
  } else if (tab === 'enrollments') {
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Enrolled Customers (${(data.enrollments || []).length})</h3>
        </div>
        <table>
          <thead><tr><th>Customer</th><th>Phone</th><th>Status</th><th>Step</th><th>Enrolled</th><th>Actions</th></tr></thead>
          <tbody>
            ${(data.enrollments || []).map(e => `
              <tr>
                <td><strong>${escapeHtml(e.first_name)} ${escapeHtml(e.last_name)}</strong></td>
                <td>${escapeHtml(e.phone || '—')}</td>
                <td><span class="badge badge-${e.status}">${e.status}</span></td>
                <td>${e.current_step} / ${(data.sequences || []).length}</td>
                <td>${formatDate(e.enrolled_at)}</td>
                <td>${e.status === 'active' ? `<button class="btn btn-secondary btn-sm" onclick="stopEnrollment(${e.id},${data.id})">Stop</button>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

async function campaignAction(id, action) {
  const res = await apiFetch(`${API}/api/campaigns/${id}/${action}`, { method: 'POST' });
  const data = await res.json();
  if (action === 'activate' && data.enrolled > 0) {
    alert(`Campaign activated! ${data.enrolled} customers auto-enrolled based on matching segments.`);
  }
  loadCampaignDetail(id);
}

function exportCampaignContacts(campaignId) {
  window.open(`${API}/api/campaigns/${campaignId}/export`, '_blank');
}

async function stopEnrollment(enrollmentId, campaignId) {
  await apiFetch(`${API}/api/sequences/enrollment/${enrollmentId}/stop`, { method: 'POST' });
  loadCampaignDetail(campaignId);
}

function showNewCampaignModal() {
  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()">
        <h3>New Campaign</h3>
        <div class="form-group">
          <label>Campaign Name</label>
          <input type="text" class="form-input" id="new-camp-name" placeholder="e.g., Spring AC Tune-Up">
        </div>
        <div class="form-group">
          <label>Type</label>
          <select class="form-select" id="new-camp-type">
            <option value="seasonal_outbound">Seasonal Outbound</option>
            <option value="estimate_followup">Estimate Follow-Up</option>
            <option value="review_request">Review Request</option>
          </select>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea class="form-textarea" id="new-camp-desc" placeholder="What does this campaign do?"></textarea>
        </div>
        <div class="form-group">
          <label>Target Segments <span style="font-weight:400;color:var(--gray-500);font-size:11px;">(customers matching ANY selected segment will be auto-enrolled on activation)</span></label>
          <div id="new-camp-segments" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
            <label class="seg-chip"><input type="checkbox" value="ac_tuneup"> AC Tune-Up</label>
            <label class="seg-chip"><input type="checkbox" value="boiler_replacement"> Boiler Replacement</label>
            <label class="seg-chip"><input type="checkbox" value="general_maintenance"> General Maintenance</label>
            <label class="seg-chip"><input type="checkbox" value="rizzo_reengagement"> Rizzo Re-Engagement</label>
            <label class="seg-chip"><input type="checkbox" value="plumbing_checkup"> Plumbing Checkup</label>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div class="form-group">
            <label>Daily SMS Cap</label>
            <input type="number" class="form-input" id="new-camp-sms" value="30">
          </div>
          <div class="form-group">
            <label>Daily Email Cap</label>
            <input type="number" class="form-input" id="new-camp-email" value="30">
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="createCampaign()">Create Campaign</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').classList.remove('hidden');
}

async function createCampaign() {
  const segments = [...document.querySelectorAll('#new-camp-segments input:checked')].map(cb => cb.value);
  const body = {
    name: document.getElementById('new-camp-name').value,
    type: document.getElementById('new-camp-type').value,
    description: document.getElementById('new-camp-desc').value,
    target_segments: segments,
    daily_sms_cap: parseInt(document.getElementById('new-camp-sms').value) || 30,
    daily_email_cap: parseInt(document.getElementById('new-camp-email').value) || 30,
  };
  if (!body.name) return alert('Campaign name is required');
  await apiFetch(`${API}/api/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  closeModal();
  loadCampaigns();
}

function closeModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('modal-container').classList.add('hidden');
  document.getElementById('modal-container').innerHTML = '';
}

// ── Sequence Editor ──
function previewStepByIndex(i) {
  const s = window._seqSteps[i];
  if (s) previewStep(s.body_template, s.content_format || 'text', s.channel);
}

function editStepByIndex(i) {
  const s = window._seqSteps[i];
  if (s) showStepModal(window._seqCampaignId, s);
}
function showStepModal(campaignId, step, nextStepNum) {
  const isEdit = step && step.id;
  const s = step || {};
  const channel = s.channel || 'sms';
  const format = s.content_format || 'text';
  const isEmail = channel === 'email';

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()" style="max-width:640px;">
        <h3>${isEdit ? `Edit Step ${s.step_number}` : 'Add Sequence Step'}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <div class="form-group">
            <label>Step Number</label>
            <input type="number" class="form-input" id="step-number" value="${s.step_number || nextStepNum || 1}" min="1">
          </div>
          <div class="form-group">
            <label>Delay (days)</label>
            <input type="number" class="form-input" id="step-delay" value="${s.delay_days ?? 0}" min="0">
          </div>
          <div class="form-group">
            <label>Channel</label>
            <select class="form-select" id="step-channel" onchange="toggleStepEmailFields()">
              <option value="sms" ${channel === 'sms' ? 'selected' : ''}>SMS</option>
              <option value="email" ${channel === 'email' ? 'selected' : ''}>Email</option>
            </select>
          </div>
        </div>
        <div id="step-email-fields" class="${isEmail ? '' : 'hidden'}">
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;">
            <div class="form-group">
              <label>Email Subject</label>
              <input type="text" class="form-input" id="step-subject" value="${escapeHtml(s.subject || '')}" placeholder="e.g., Your {{serviceType}} estimate from Minuteman">
            </div>
            <div class="form-group">
              <label>Format</label>
              <select class="form-select" id="step-format" onchange="toggleStepFormatHint()">
                <option value="text" ${format === 'text' ? 'selected' : ''}>Plain Text</option>
                <option value="html" ${format === 'html' ? 'selected' : ''}>HTML</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Message Body</label>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <select class="form-select" id="step-template" style="flex:1;" onchange="applyTemplate(document.getElementById('step-channel').value)">
              <option value="-1">Load from template...</option>
            </select>
          </div>
          <div class="var-bar">
            <span style="font-size:11px;color:var(--gray-500);margin-right:4px;">Insert:</span>
            <span class="var-tag" onclick="insertVar('step-body','firstName')">firstName</span>
            <span class="var-tag" onclick="insertVar('step-body','lastName')">lastName</span>
            <span class="var-tag" onclick="insertVar('step-body','serviceType')">serviceType</span>
            <span class="var-tag" onclick="insertVar('step-body','estimateAmount')">estimateAmount</span>
            <span class="var-tag" onclick="insertVar('step-body','techName')">techName</span>
            <span class="var-tag" onclick="insertVar('step-body','reviewLink')">reviewLink</span>
          </div>
          <textarea class="form-textarea" id="step-body" rows="10" style="${format === 'html' ? "font-family:'SF Mono',Monaco,Consolas,monospace;font-size:12px;" : ''}" placeholder="Write your message here...">${escapeHtml(s.body_template || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-secondary" onclick="previewStepFromModal()">Preview</button>
          <button class="btn btn-primary" onclick="saveStep(${campaignId}, ${isEdit ? s.id : 'null'})">${isEdit ? 'Save Changes' : 'Add Step'}</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').classList.remove('hidden');
  // Populate template dropdown from API
  populateStepTemplateDropdown(channel);
}

function toggleStepEmailFields() {
  const channel = document.getElementById('step-channel').value;
  const emailFields = document.getElementById('step-email-fields');
  if (channel === 'email') {
    emailFields.classList.remove('hidden');
  } else {
    emailFields.classList.add('hidden');
  }
  // Update template dropdown from API
  populateStepTemplateDropdown(channel);
}

async function populateStepTemplateDropdown(channel) {
  const tplSelect = document.getElementById('step-template');
  if (!tplSelect) return;
  const cache = await ensureTemplatesLoaded();
  const templates = cache[channel] || [];
  tplSelect.innerHTML = '<option value="-1">Load from template...</option>' +
    templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
}

function toggleStepFormatHint() {
  const format = document.getElementById('step-format')?.value || 'text';
  const textarea = document.getElementById('step-body');
  if (format === 'html') {
    textarea.style.fontFamily = "'SF Mono',Monaco,Consolas,monospace";
    textarea.style.fontSize = '12px';
  } else {
    textarea.style.fontFamily = '';
    textarea.style.fontSize = '';
  }
}

// insertVariable kept as alias for backward compat
function insertVariable(varName) { insertVar('step-body', varName); }

async function saveStep(campaignId, stepId) {
  const channel = document.getElementById('step-channel').value;
  const body = {
    step_number: parseInt(document.getElementById('step-number').value) || 1,
    delay_days: parseInt(document.getElementById('step-delay').value) || 0,
    channel,
    subject: channel === 'email' ? document.getElementById('step-subject').value : null,
    body_template: document.getElementById('step-body').value,
    content_format: channel === 'email' ? (document.getElementById('step-format')?.value || 'text') : 'text',
  };

  if (!body.body_template) return alert('Message body is required');

  try {
    if (stepId) {
      await apiFetch(`${API}/api/sequences/step/${stepId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await apiFetch(`${API}/api/sequences/${campaignId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    closeModal();
    loadCampaignDetail(campaignId);
  } catch (e) {
    alert('Failed to save step: ' + e.message);
  }
}

async function deleteStep(stepId, campaignId) {
  if (!confirm('Delete this sequence step? This cannot be undone.')) return;
  try {
    await apiFetch(`${API}/api/sequences/step/${stepId}`, { method: 'DELETE' });
    loadCampaignDetail(campaignId);
  } catch (e) {
    alert('Failed to delete step: ' + e.message);
  }
}

// ── Message Templates (API-driven) ──
let _templateCache = { sms: [], email: [], all: [], loaded: false };
let _templateFilter = '';

async function fetchTemplates(channel) {
  const url = channel ? `${API}/api/templates?channel=${channel}` : `${API}/api/templates`;
  const data = await apiFetch(url).then(r => r.json());
  return data;
}

async function ensureTemplatesLoaded() {
  if (_templateCache.loaded) return _templateCache;
  const all = await fetchTemplates();
  _templateCache.all = all;
  _templateCache.sms = all.filter(t => t.channel === 'sms');
  _templateCache.email = all.filter(t => t.channel === 'email');
  _templateCache.loaded = true;
  return _templateCache;
}

function invalidateTemplateCache() { _templateCache.loaded = false; }

// ── Templates Page ──
async function loadTemplates() {
  invalidateTemplateCache();
  const cache = await ensureTemplatesLoaded();
  const filtered = _templateFilter ? cache[_templateFilter] || [] : cache.all;
  renderTemplateGrid(filtered);
}

function filterTemplates(channel) {
  _templateFilter = channel;
  document.querySelectorAll('.template-filter').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.template-filter[data-channel="${channel}"]`);
  if (btn) btn.classList.add('active');
  loadTemplates();
}

function renderTemplateGrid(templates) {
  const grid = document.getElementById('templates-grid');
  if (!grid) return;

  if (templates.length === 0) {
    grid.innerHTML = '<div style="padding:40px;text-align:center;color:var(--gray-500);">No templates found. Click "+ New Template" to create one.</div>';
    return;
  }

  grid.innerHTML = templates.map(t => `
    <div class="template-card">
      <div class="template-card-header">
        <div>
          <span class="template-card-name">${escapeHtml(t.name)}</span>
          ${t.is_default ? '<span class="badge-default">DEFAULT</span>' : ''}
        </div>
        <span class="badge badge-${t.channel}">${t.channel.toUpperCase()}</span>
      </div>
      ${t.channel === 'email' && t.subject ? `<div style="font-size:11px;color:var(--gray-500);margin-bottom:6px;">Subject: ${escapeHtml(t.subject)}</div>` : ''}
      <div class="template-card-body">${escapeHtml(t.body)}</div>
      <div class="template-card-actions">
        <button class="btn btn-secondary btn-sm" onclick="previewTemplateCard(${t.id})">Preview</button>
        <button class="btn btn-secondary btn-sm" onclick="showTemplateModal(${t.id})">Edit</button>
        <button class="btn btn-secondary btn-sm" onclick="duplicateTemplate(${t.id})">Duplicate</button>
        ${!t.is_default ? `<button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="deleteTemplate(${t.id})">Delete</button>` : ''}
      </div>
    </div>
  `).join('');
}

async function previewTemplateCard(id) {
  const cache = await ensureTemplatesLoaded();
  const t = cache.all.find(x => x.id === id);
  if (!t) return;
  previewStep(t.body, t.content_format || 'text', t.channel);
}

async function showTemplateModal(id) {
  let t = {};
  if (id) {
    const cache = await ensureTemplatesLoaded();
    t = cache.all.find(x => x.id === id) || {};
  }
  const isEdit = !!t.id;
  const channel = t.channel || 'sms';
  const format = t.content_format || 'text';
  const isEmail = channel === 'email';

  document.getElementById('modal-container').innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal" onclick="event.stopPropagation()" style="max-width:640px;">
        <h3>${isEdit ? 'Edit Template' : 'New Template'}</h3>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;">
          <div class="form-group">
            <label>Template Name</label>
            <input type="text" class="form-input" id="tpl-name" value="${escapeHtml(t.name || '')}" placeholder="e.g., Spring AC Promo">
          </div>
          <div class="form-group">
            <label>Channel</label>
            <select class="form-select" id="tpl-channel" onchange="toggleTplEmailFields()">
              <option value="sms" ${channel === 'sms' ? 'selected' : ''}>SMS</option>
              <option value="email" ${channel === 'email' ? 'selected' : ''}>Email</option>
            </select>
          </div>
        </div>
        <div id="tpl-email-fields" class="${isEmail ? '' : 'hidden'}">
          <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;">
            <div class="form-group">
              <label>Email Subject</label>
              <input type="text" class="form-input" id="tpl-subject" value="${escapeHtml(t.subject || '')}" placeholder="e.g., Your {{serviceType}} estimate">
            </div>
            <div class="form-group">
              <label>Format</label>
              <select class="form-select" id="tpl-format">
                <option value="text" ${format === 'text' ? 'selected' : ''}>Plain Text</option>
                <option value="html" ${format === 'html' ? 'selected' : ''}>HTML</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label>Message Body</label>
          <div class="var-bar">
            <span style="font-size:11px;color:var(--gray-500);margin-right:4px;">Insert:</span>
            <span class="var-tag" onclick="insertVar('tpl-body','firstName')">firstName</span>
            <span class="var-tag" onclick="insertVar('tpl-body','lastName')">lastName</span>
            <span class="var-tag" onclick="insertVar('tpl-body','serviceType')">serviceType</span>
            <span class="var-tag" onclick="insertVar('tpl-body','estimateAmount')">estimateAmount</span>
            <span class="var-tag" onclick="insertVar('tpl-body','techName')">techName</span>
            <span class="var-tag" onclick="insertVar('tpl-body','reviewLink')">reviewLink</span>
          </div>
          <textarea class="form-textarea" id="tpl-body" rows="10" placeholder="Write your message here...">${escapeHtml(t.body || '')}</textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-secondary" onclick="previewTplFromModal()">Preview</button>
          <button class="btn btn-primary" onclick="saveTemplate(${t.id || 'null'})">${isEdit ? 'Save Changes' : 'Create Template'}</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modal-container').classList.remove('hidden');
}

function toggleTplEmailFields() {
  const ch = document.getElementById('tpl-channel').value;
  document.getElementById('tpl-email-fields').classList.toggle('hidden', ch !== 'email');
}

function insertVar(textareaId, varName) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const insert = `{{${varName}}}`;
  textarea.value = text.substring(0, start) + insert + text.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + insert.length;
  textarea.focus();
}

function previewTplFromModal() {
  const body = document.getElementById('tpl-body').value;
  const channel = document.getElementById('tpl-channel').value;
  const format = channel === 'email' ? (document.getElementById('tpl-format')?.value || 'text') : 'text';
  const subject = channel === 'email' ? document.getElementById('tpl-subject')?.value : '';
  showPreviewModal(fillSampleVars(body), format, channel, fillSampleVars(subject || ''));
}

async function saveTemplate(id) {
  const channel = document.getElementById('tpl-channel').value;
  const payload = {
    name: document.getElementById('tpl-name').value,
    channel,
    subject: channel === 'email' ? document.getElementById('tpl-subject').value : null,
    body: document.getElementById('tpl-body').value,
    content_format: channel === 'email' ? (document.getElementById('tpl-format')?.value || 'text') : 'text',
  };

  if (!payload.name) return alert('Template name is required');
  if (!payload.body) return alert('Message body is required');

  try {
    const url = id ? `${API}/api/templates/${id}` : `${API}/api/templates`;
    const method = id ? 'PUT' : 'POST';
    await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    closeModal();
    invalidateTemplateCache();
    loadTemplates();
  } catch (e) {
    alert('Failed to save template: ' + e.message);
  }
}

async function duplicateTemplate(id) {
  try {
    await apiFetch(`${API}/api/templates/${id}/duplicate`, { method: 'POST' });
    invalidateTemplateCache();
    loadTemplates();
  } catch (e) {
    alert('Failed to duplicate: ' + e.message);
  }
}

async function deleteTemplate(id) {
  if (!confirm('Delete this template? This cannot be undone.')) return;
  try {
    const res = await apiFetch(`${API}/api/templates/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) return alert(data.error);
    invalidateTemplateCache();
    loadTemplates();
  } catch (e) {
    alert('Failed to delete: ' + e.message);
  }
}

// ── Apply template in step modal (API-driven) ──
async function applyTemplate(channel) {
  const select = document.getElementById('step-template');
  if (!select) return;
  const id = parseInt(select.value);
  if (isNaN(id) || id < 0) return;

  const cache = await ensureTemplatesLoaded();
  const tpl = cache.all.find(t => t.id === id);
  if (!tpl) return;

  document.getElementById('step-body').value = tpl.body;
  if (channel === 'email' && tpl.subject) {
    document.getElementById('step-subject').value = tpl.subject;
  }
  select.value = '-1';
}

const SAMPLE_VARS = {
  firstName: 'James',
  lastName: 'Moriarty',
  serviceType: 'heating',
  estimateAmount: ' ($14,800)',
  techName: 'Derek Sullivan',
  reviewLink: 'https://g.page/r/minuteman-plumbing/review',
};

function fillSampleVars(text) {
  let result = text;
  for (const [key, val] of Object.entries(SAMPLE_VARS)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val);
  }
  return result;
}

function previewStep(bodyTemplate, format, channel) {
  const filled = fillSampleVars(bodyTemplate);
  showPreviewModal(filled, format, channel);
}

function previewStepFromModal() {
  const body = document.getElementById('step-body').value;
  const channel = document.getElementById('step-channel').value;
  const format = channel === 'email' ? (document.getElementById('step-format')?.value || 'text') : 'text';
  const subject = channel === 'email' ? document.getElementById('step-subject')?.value : '';
  const filled = fillSampleVars(body);
  const filledSubject = fillSampleVars(subject || '');
  showPreviewModal(filled, format, channel, filledSubject);
}

function showPreviewModal(body, format, channel, subject) {
  const previewEl = document.createElement('div');
  previewEl.id = 'preview-overlay';
  previewEl.className = 'modal-overlay';
  previewEl.style.zIndex = '250';
  previewEl.onclick = (e) => { if (e.target === previewEl) previewEl.remove(); };

  let content;
  if (channel === 'sms') {
    content = `
      <div style="background:#DCF8C6;border-radius:12px;padding:14px 16px;max-width:320px;font-size:14px;line-height:1.5;white-space:pre-wrap;margin:0 auto;">${escapeHtml(body)}</div>
    `;
  } else if (format === 'html') {
    content = `
      <iframe id="preview-iframe" style="width:100%;height:400px;border:1px solid var(--gray-200);border-radius:var(--radius);background:white;" sandbox="allow-same-origin"></iframe>
    `;
  } else {
    content = `
      <div style="background:white;border:1px solid var(--gray-200);border-radius:var(--radius);padding:20px;white-space:pre-wrap;font-size:14px;line-height:1.6;max-height:400px;overflow-y:auto;">${escapeHtml(body)}</div>
    `;
  }

  previewEl.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()" style="max-width:560px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;">Preview — ${channel.toUpperCase()}${format === 'html' ? ' (HTML)' : ''}</h3>
        <button class="btn btn-secondary btn-sm" onclick="this.closest('#preview-overlay').remove()">Close</button>
      </div>
      ${subject ? `<div style="margin-bottom:12px;font-size:13px;"><strong>Subject:</strong> ${escapeHtml(subject)}</div>` : ''}
      <div style="font-size:11px;color:var(--gray-500);margin-bottom:8px;">Sample data: James Moriarty, heating estimate, $14,800</div>
      ${content}
    </div>
  `;

  document.body.appendChild(previewEl);

  if (channel === 'email' && format === 'html') {
    const iframe = document.getElementById('preview-iframe');
    if (iframe) {
      iframe.srcdoc = body;
    }
  }
}

// ── Customers ──
async function loadCustomers() {
  const search = document.getElementById('customer-search')?.value || '';
  const source = document.getElementById('customer-source-filter')?.value || '';
  const priority = document.getElementById('customer-priority-filter')?.value || '';

  try {
    const params = new URLSearchParams({ page: customerPage, limit: 25, search, source, priority });
    const data = await apiFetch(`${API}/api/customers?${params}`).then(r => r.json());

    document.getElementById('customers-tbody').innerHTML = data.customers.map(c => {
      const segments = c.segments ? JSON.parse(c.segments) : [];
      return `
        <tr style="cursor:pointer;" onclick="loadCustomerDetail(${c.id})">
          <td><strong>${escapeHtml(c.first_name)} ${escapeHtml(c.last_name)}</strong><br><span style="font-size:11px;color:var(--gray-500);">${escapeHtml(c.email || '')}</span></td>
          <td>${escapeHtml(c.phone || '—')}</td>
          <td><span class="badge badge-${c.source}">${c.source}</span></td>
          <td>${c.priority ? `<span class="badge badge-${c.priority}">${c.priority}</span>` : '—'}</td>
          <td>${segments.map(s => `<span class="badge badge-draft" style="margin:1px;font-size:10px;">${s.replace(/_/g, ' ')}</span>`).join('') || '—'}</td>
          <td>${c.job_count || 0}</td>
          <td>${c.last_service_date ? formatDate(c.last_service_date) : '—'}</td>
          <td>${c.active_campaigns || 0} active</td>
        </tr>
      `;
    }).join('');

    document.getElementById('customers-pagination').innerHTML = `
      <span>Showing ${(data.page - 1) * data.limit + 1}–${Math.min(data.page * data.limit, data.total)} of ${data.total}</span>
      <div style="display:flex;gap:4px;">
        <button class="btn btn-secondary btn-sm" ${data.page <= 1 ? 'disabled' : ''} onclick="customerPage=${data.page - 1};loadCustomers()">Prev</button>
        <button class="btn btn-secondary btn-sm" ${data.page >= data.pages ? 'disabled' : ''} onclick="customerPage=${data.page + 1};loadCustomers()">Next</button>
      </div>
    `;
  } catch (e) {
    console.error('Customers load failed:', e);
  }
}

async function loadCustomerDetail(id) {
  try {
    const data = await apiFetch(`${API}/api/customers/${id}`).then(r => r.json());
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById('page-customer-detail').classList.remove('hidden');

    const segments = data.segments ? JSON.parse(data.segments) : [];
    document.getElementById('customer-detail-content').innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <h2 style="font-size:20px;font-weight:700;">${escapeHtml(data.first_name)} ${escapeHtml(data.last_name)}</h2>
            <p style="color:var(--gray-600);font-size:13px;margin-top:2px;">
              ${escapeHtml(data.phone || '')} &middot; ${escapeHtml(data.email || '')}
            </p>
            <p style="color:var(--gray-500);font-size:13px;margin-top:2px;">
              ${escapeHtml(data.address_street || '')} ${escapeHtml(data.address_city || '')}, ${escapeHtml(data.address_state || '')} ${escapeHtml(data.address_zip || '')}
            </p>
          </div>
          <div style="text-align:right;">
            <span class="badge badge-${data.source}" style="margin-bottom:8px;">${data.source}</span>
            ${data.priority ? `<br><span class="badge badge-${data.priority}">${data.priority} priority</span>` : ''}
          </div>
        </div>
        ${data.reasoning ? `<div style="margin-top:12px;padding:10px;background:var(--gray-50);border-radius:var(--radius);font-size:13px;color:var(--gray-700);">
          <strong>Classification:</strong> ${escapeHtml(data.reasoning)}
          ${data.upsell_opportunity ? `<br><strong>Upsell:</strong> ${escapeHtml(data.upsell_opportunity)}` : ''}
          ${data.estimated_equipment_age ? `<br><strong>Est. Equipment Age:</strong> ${data.estimated_equipment_age} years` : ''}
        </div>` : ''}
        <div style="margin-top:8px;">${segments.map(s => `<span class="badge badge-draft" style="margin-right:4px;">${s.replace(/_/g, ' ')}</span>`).join('')}</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-header"><h3>Jobs (${data.jobs.length})</h3></div>
          ${data.jobs.length ? `<table><thead><tr><th>Service</th><th>Tech</th><th>Status</th><th>Date</th></tr></thead><tbody>
            ${data.jobs.map(j => `
              <tr>
                <td><strong>${escapeHtml(j.service_type || '')}</strong><br><span style="font-size:11px;color:var(--gray-500);">${escapeHtml((j.service_description || '').substring(0, 80))}</span></td>
                <td>${escapeHtml(j.tech_name || '—')}</td>
                <td><span class="badge badge-${j.status === 'complete' ? 'completed' : j.status === 'scheduled' ? 'active' : 'draft'}">${j.status}</span></td>
                <td>${formatDate(j.completed_at || j.created_at)}</td>
              </tr>
            `).join('')}
          </tbody></table>` : '<p style="font-size:13px;color:var(--gray-500);">No jobs</p>'}
        </div>

        <div class="card">
          <div class="card-header"><h3>Estimates (${data.estimates.length})</h3></div>
          ${data.estimates.length ? `<table><thead><tr><th>Service</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>
            ${data.estimates.map(e => `
              <tr>
                <td>${escapeHtml(e.service_type || '')}</td>
                <td><strong>$${Number(e.amount).toLocaleString()}</strong></td>
                <td><span class="badge badge-${e.status === 'open' ? 'paused' : e.status === 'accepted' ? 'active' : 'stopped'}">${e.status}</span></td>
                <td>${formatDate(e.presented_at)}</td>
              </tr>
            `).join('')}
          </tbody></table>` : '<p style="font-size:13px;color:var(--gray-500);">No estimates</p>'}
        </div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-header"><h3>Message History (${data.messages.length})</h3></div>
        ${data.messages.length ? data.messages.map(m => `
          <div class="activity-item">
            <div>
              <span class="badge badge-${m.channel}">${m.channel.toUpperCase()}</span>
              <span class="badge badge-${m.direction === 'inbound' ? 'active' : 'draft'}">${m.direction}</span>
              ${m.subject ? `<strong style="margin-left:8px;font-size:13px;">${escapeHtml(m.subject)}</strong>` : ''}
            </div>
            <div style="font-size:13px;color:var(--gray-700);margin-top:4px;">${escapeHtml((m.body || '').substring(0, 200))}</div>
            <div class="activity-time">${formatDate(m.sent_at)} &middot; ${m.status}</div>
          </div>
        `).join('') : '<p style="font-size:13px;color:var(--gray-500);">No messages</p>'}
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-header"><h3>Campaign Enrollments (${data.enrollments.length})</h3></div>
        ${data.enrollments.length ? `<table><thead><tr><th>Campaign</th><th>Status</th><th>Step</th><th>Enrolled</th></tr></thead><tbody>
          ${data.enrollments.map(e => `
            <tr>
              <td>${escapeHtml(e.campaign_name)}</td>
              <td><span class="badge badge-${e.status}">${e.status}</span></td>
              <td>${e.current_step}</td>
              <td>${formatDate(e.enrolled_at)}</td>
            </tr>
          `).join('')}
        </tbody></table>` : '<p style="font-size:13px;color:var(--gray-500);">Not enrolled in any campaigns</p>'}
      </div>
    `;
  } catch (e) {
    console.error('Customer detail failed:', e);
  }
}

function exportCustomers() {
  const source = document.getElementById('customer-source-filter')?.value || '';
  const params = new URLSearchParams();
  if (source) params.set('source', source);
  window.open(`${API}/api/customers/export/csv?${params}`, '_blank');
}

// ── Activity ──
async function loadActivity() {
  try {
    const data = await apiFetch(`${API}/api/dashboard/activity?limit=100`).then(r => r.json());
    document.getElementById('activity-list').innerHTML = data.length
      ? data.map(a => `
        <div class="activity-item">
          <div class="activity-dot ${a.type}"></div>
          <div style="flex:1;">
            <div>${escapeHtml(a.description)}</div>
            <div class="activity-time">${formatDate(a.created_at)} &middot; ${a.type.replace(/_/g, ' ')}</div>
          </div>
        </div>
      `).join('')
      : '<p style="padding:20px;color:var(--gray-500);">No activity yet</p>';
  } catch (e) {
    console.error('Activity load failed:', e);
  }
}

// ── Logs ──
async function loadLogs() {
  const level = document.getElementById('logs-level-filter')?.value || '';
  const source = document.getElementById('logs-source-filter')?.value || '';
  const search = document.getElementById('logs-search')?.value || '';

  try {
    const params = new URLSearchParams({ limit: 200, offset: logsOffset });
    if (level) params.set('level', level);
    if (source) params.set('source', source);
    if (search) params.set('search', search);

    const data = await apiFetch(`${API}/api/dashboard/logs?${params}`).then(r => r.json());

    document.getElementById('logs-list').innerHTML = data.entries.length
      ? data.entries.map(entry => {
          const levelClass = entry.level === 'ERROR' ? 'log-error'
            : entry.level === 'WARN' ? 'log-warn' : '';
          const sourceTag = entry.source
            ? `<span class="log-source">[${escapeHtml(entry.source)}]</span> `
            : '';
          return `<div class="log-entry ${levelClass}">` +
            `<span class="log-time">${escapeHtml(entry.timestamp)}</span>` +
            `<span class="log-level log-level-${entry.level.toLowerCase()}">${entry.level}</span>` +
            `${sourceTag}` +
            `<span class="log-msg">${escapeHtml(entry.message)}</span>` +
            `</div>`;
        }).join('')
      : '<p style="padding:20px;color:var(--gray-500);">No log entries found</p>';

    document.getElementById('logs-pagination').innerHTML = `
      <span>Showing ${data.entries.length ? logsOffset + 1 : 0}\u2013${logsOffset + data.entries.length} of ${data.total}</span>
      <div style="display:flex;gap:4px;">
        <button class="btn btn-secondary btn-sm" ${logsOffset <= 0 ? 'disabled' : ''} onclick="logsOffset=Math.max(0,logsOffset-200);loadLogs()">Newer</button>
        <button class="btn btn-secondary btn-sm" ${!data.hasMore ? 'disabled' : ''} onclick="logsOffset+=200;loadLogs()">Older</button>
      </div>
    `;
  } catch (e) {
    console.error('Logs load failed:', e);
    document.getElementById('logs-list').innerHTML = '<p style="padding:20px;color:var(--red);">Failed to load logs</p>';
  }
}

function toggleLogsAutoRefresh() {
  const btn = document.getElementById('logs-auto-btn');
  const status = document.getElementById('logs-auto-status');
  if (logsAutoRefresh) {
    clearInterval(logsAutoRefresh);
    logsAutoRefresh = null;
    btn.textContent = 'Auto: Off';
    status.textContent = '';
  } else {
    logsAutoRefresh = setInterval(() => {
      if (currentPage === 'logs' && logsOffset === 0) loadLogs();
    }, 10000);
    btn.textContent = 'Auto: On';
    status.textContent = 'Refreshing every 10s';
  }
}

// ── Settings ──
async function loadSettings() {
  try {
    const data = await apiFetch(`${API}/api/settings`).then(r => r.json());
    const modeEl = document.getElementById('mode-badge');
    modeEl.textContent = data.appMode.toUpperCase();
    modeEl.style.background = data.appMode === 'demo' ? 'var(--yellow)' : 'var(--green)';

    if (currentPage === 'settings') {
      // Load users list if admin
      let usersHtml = '';
      if (currentUser && currentUser.role === 'admin') {
        try {
          const users = await apiFetch(`${API}/api/auth/users`).then(r => r.json());
          const userRows = users.map(u => `
            <tr>
              <td>${escapeHtml(u.username)}</td>
              <td><span class="badge badge-${u.role === 'admin' ? 'high' : 'completed'}">${u.role}</span></td>
              <td>${formatDate(u.created_at)}</td>
              <td>${u.username !== currentUser.username ? `<button class="btn btn-secondary btn-sm" onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')" style="font-size:11px;padding:2px 8px;">Remove</button>` : '<span style="font-size:12px;color:var(--gray-500);">You</span>'}</td>
            </tr>
          `).join('');

          usersHtml = `
            <div class="card">
              <div class="card-header">
                <h3>User Management</h3>
                <button class="btn btn-primary btn-sm" onclick="showAddUserModal()">+ Add User</button>
              </div>
              <table>
                <thead><tr><th>Username</th><th>Role</th><th>Created</th><th></th></tr></thead>
                <tbody>${userRows}</tbody>
              </table>
            </div>
          `;
        } catch (e) {
          console.error('Failed to load users:', e);
        }
      }

      document.getElementById('settings-content').innerHTML = `
        ${usersHtml}
        <div class="card">
          <div class="card-header"><h3>Agent Mode</h3></div>
          <p style="font-size:14px;">
            Current mode: <strong>${data.appMode.toUpperCase()}</strong>
            ${data.appMode === 'demo' ? '— Using mock data. No real messages are sent.' : '— Connected to live APIs. Messages are real.'}
          </p>
        </div>
        <div class="card">
          <div class="card-header"><h3>Guardrails</h3></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group">
              <label>Daily SMS Cap</label>
              <div style="font-size:20px;font-weight:700;color:var(--navy);">${data.guardrails.dailySmsCap}</div>
              <div style="font-size:12px;color:var(--gray-500);">Maximum text messages per day across all campaigns</div>
            </div>
            <div class="form-group">
              <label>Daily Email Cap</label>
              <div style="font-size:20px;font-weight:700;color:var(--navy);">${data.guardrails.dailyEmailCap}</div>
              <div style="font-size:12px;color:var(--gray-500);">Maximum emails per day across all campaigns</div>
            </div>
            <div class="form-group">
              <label>Review Request Delay</label>
              <div style="font-size:20px;font-weight:700;color:var(--navy);">${data.guardrails.reviewRequestDelayHours}h</div>
              <div style="font-size:12px;color:var(--gray-500);">Hours after job completion before sending review request</div>
            </div>
            <div class="form-group">
              <label>Estimate Follow-Up Delay</label>
              <div style="font-size:20px;font-weight:700;color:var(--navy);">${data.guardrails.estimateFollowupDelayHours}h</div>
              <div style="font-size:12px;color:var(--gray-500);">Hours after estimate before enrolling in follow-up</div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Google Review Link</h3></div>
          <p style="font-size:13px;color:var(--gray-700);word-break:break-all;">${escapeHtml(data.googleReviewLink)}</p>
        </div>
        <div class="card">
          <div class="card-header"><h3>Cron Schedule</h3></div>
          <table>
            <thead><tr><th>Job</th><th>Schedule</th><th>Description</th></tr></thead>
            <tbody>
              <tr><td>Review Requests</td><td>*/30 * * * *</td><td>Every 30 minutes — checks for completed jobs and sends review requests</td></tr>
              <tr><td>Sequence Processing</td><td>15 * * * *</td><td>Hourly at :15 — enrolls new estimates and processes next sequence steps</td></tr>
              <tr><td>Customer Classification</td><td>0 6 * * 1</td><td>Mondays at 6 AM — classifies customers for campaign targeting</td></tr>
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (e) {
    console.error('Settings load failed:', e);
  }
}

// ── User Management Functions ──
function showAddUserModal() {
  const modal = document.getElementById('modal-container');
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <h3>Add New User</h3>
        <div class="form-group">
          <label>Username</label>
          <input type="text" class="form-input" id="new-user-username" placeholder="Username">
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" class="form-input" id="new-user-password" placeholder="Password">
        </div>
        <div class="form-group">
          <label>Role</label>
          <select class="form-select" id="new-user-role">
            <option value="viewer">Viewer — can view dashboards and data</option>
            <option value="admin">Admin — full access including user management</option>
          </select>
        </div>
        <div id="add-user-error" class="hidden" style="color:var(--red);font-size:13px;margin-top:8px;"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="addUser()">Add User</button>
        </div>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
}

async function addUser() {
  const username = document.getElementById('new-user-username').value.trim();
  const password = document.getElementById('new-user-password').value;
  const role = document.getElementById('new-user-role').value;
  const errorEl = document.getElementById('add-user-error');

  if (!username || !password) {
    errorEl.textContent = 'Username and password are required';
    errorEl.classList.remove('hidden');
    return;
  }

  try {
    const res = await apiFetch(`${API}/api/auth/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    const data = await res.json();
    if (res.ok) {
      closeModal();
      loadSettings();
    } else {
      errorEl.textContent = data.error || 'Failed to add user';
      errorEl.classList.remove('hidden');
    }
  } catch (e) {
    errorEl.textContent = 'Connection error';
    errorEl.classList.remove('hidden');
  }
}

async function deleteUser(id, username) {
  if (!confirm(`Remove user "${username}"? They will no longer be able to log in.`)) return;
  try {
    const res = await apiFetch(`${API}/api/auth/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadSettings();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to remove user');
    }
  } catch (e) {
    alert('Connection error');
  }
}


// ── Actions ──
async function runAction(action) {
  try {
    const res = await apiFetch(`${API}/api/actions/${action}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(`Action completed: ${JSON.stringify(data)}`);
      loadDashboard();
    } else {
      alert(`Action failed: ${data.error || 'Unknown error'}`);
    }
  } catch (e) {
    alert(`Action failed: ${e.message}`);
  }
}

// ── Helpers ──
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('T') ? dateStr : dateStr + 'Z';
  const d = new Date(normalized);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(dateStr) {
  const now = new Date();
  // SQLite stores UTC but without Z suffix — append it if missing
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('T') ? dateStr : dateStr + 'Z';
  const then = new Date(normalized);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

let debounceTimer;
function debounce(fn, delay) {
  return function (...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };
}

// Enter key on login
document.getElementById('login-pass').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});
