/*
 * Co-Cher Admin Module
 * ====================
 * Event planning, RAMS, bus booking, parent/teacher notifications, AOR, and more.
 * Designed for Singapore school operations — select what you need, deselect what you don't.
 */

import { Store, generateId } from '../state.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modals.js';
import { sendChat } from '../api.js';
import { getCurrentUser } from '../components/login.js';
import { createStudentUploadZone } from '../components/student-upload.js';
import { openStaffPicker, loadStaffDirectory, renderRecipientChips, ALL_STAFF_EMAIL } from '../components/staff-picker.js';
import { openRamsEditor } from '../components/rams-editor.js';
import { renderAdminWorkflow, bindAdminWorkflowClicks } from '../components/admin-workflow.js';

/**
 * FormSG Pre-fill Configuration
 * ==============================
 * FormSG uses MongoDB ObjectID field IDs as query parameter keys.
 * Format: https://form.gov.sg/<formId>?<fieldId1>=<value1>&<fieldId2>=<value2>
 *
 * To configure pre-fill for your forms:
 * 1. Open FormSG form builder > click each field > copy the field ID
 * 2. Map each field ID to a data source below
 *
 * Field IDs below need to be replaced with your actual FormSG field IDs.
 * Set a field ID to empty string '' to skip pre-filling that field.
 */
const FORMSG_FIELD_MAP = {
  // Bus Booking Form (https://form.gov.sg/697319e97621e837dda7c331)
  bus_booking: {
    formId: '697319e97621e837dda7c331',
    fields: {
      '684fd791b4b55d8d30aaab55': { source: 'user.name' },
      '685b8a996a8a89b5c8189cdb': { source: 'task.data.teacher_ic' },
      '685ba4469fbd086f7acc6abb': { source: 'task.data.departure_time' },
      '685b9c52596a83029205e6d1': { source: 'task.data.destination' },
      '685bbb660bebdec17bf56ffc': { source: 'task.data.return_time' },
      '685b877390b1e26e036b6b5e': { source: 'task.data.return_to' },
      '685b8722f370bac1792b4e67': { source: 'task.data.num_passengers' },
    }
  },
  // AOR Form (https://form.gov.sg/6957392872041c1d962c3ab1)
  aor: {
    formId: '6957392872041c1d962c3ab1',
    fields: {
      '67c700d3bd735f3be14e6301': { source: 'user.name' },
      '67c6f91d8a5feac346c31879': { source: 'event.title' },
      '67c792455dd4738afd7f1a2d': { source: 'task.data.cost_breakdown' },
    }
  }
};

/**
 * Build a FormSG URL with pre-populated query parameters using field ID mapping.
 * Falls back to opening the form without pre-fill if no field IDs are configured.
 */
function buildFormURL(baseUrl, event, task) {
  try {
    const url = new URL(baseUrl);
    const user = getCurrentUser();

    // Determine which form config to use based on URL
    let formConfig = null;
    for (const [, config] of Object.entries(FORMSG_FIELD_MAP)) {
      if (baseUrl.includes(config.formId)) {
        formConfig = config;
        break;
      }
    }

    if (!formConfig || !formConfig.fields || Object.keys(formConfig.fields).length === 0) {
      // No field IDs configured — return base URL as-is
      return baseUrl;
    }

    // Resolve data sources to values
    const dataContext = {
      'user.name': user?.name || '',
      'user.email': user?.email || '',
      'event.title': event?.name || event?.title || '',
      'event.date': event?.date || '',
      'task.data.venue': task?.data?.venue || task?.data?.venue_name || '',
      'task.data.destination': task?.data?.destination || '',
      'task.data.pickup_point': task?.data?.pickup_point || '',
      'task.data.departure_time': task?.data?.departure_time || '',
      'task.data.return_time': task?.data?.return_time || '',
      'task.data.return_to': task?.data?.return_to || 'School',
      'task.data.teacher_ic': task?.data?.teacher_ic || user?.name || '',
      'task.data.num_students': task?.data?.num_students || task?.data?.total_students || '',
      'task.data.num_passengers': task?.data?.num_passengers || task?.data?.total_students || '',
      'task.data.num_buses': task?.data?.num_buses || '',
      'task.data.budget_code': task?.data?.budget_code || '',
      'task.data.estimated_cost': task?.data?.estimated_cost || '',
      'task.data.cost_breakdown': task?.data?.cost_breakdown || '',
    };

    for (const [fieldId, config] of Object.entries(formConfig.fields)) {
      const value = dataContext[config.source] || '';
      if (value && fieldId) {
        url.searchParams.set(fieldId, value);
      }
    }

    return url.toString();
  } catch {
    return baseUrl;
  }
}

/* ── Admin task templates (checked by default) ── */
const EVENT_TASKS = [
  {
    key: 'rams',
    label: 'Risk Assessment (RAMS)',
    desc: 'Complete risk assessment and management strategy for the activity.',
    icon: '🛡️',
    fields: [
      { id: 'activity_desc', label: 'Activity Description', type: 'textarea', placeholder: 'Describe the out-of-school activity...' },
      { id: 'venue', label: 'Venue', type: 'text', placeholder: 'e.g. National University of Singapore' },
      { id: 'hazards', label: 'Identified Hazards', type: 'textarea', placeholder: 'List potential hazards (travel, venue, activity-specific)...' },
      { id: 'mitigations', label: 'Control Measures', type: 'textarea', placeholder: 'Mitigation steps for each hazard...' },
      { id: 'emergency_plan', label: 'Emergency Plan', type: 'textarea', placeholder: 'Emergency contacts, nearest hospital, evacuation plan...' },
      { id: 'risk_level', label: 'Overall Risk Level', type: 'select', options: ['Low', 'Medium', 'High'] }
    ]
  },
  {
    key: 'bus_booking',
    label: 'Bus Booking',
    desc: 'Arrange transport for students to and from the venue.',
    icon: '🚌',
    externalLink: { url: 'https://form.gov.sg/697319e97621e837dda7c331', label: 'Open Bus Booking Form' },
    fields: [
      { id: 'teacher_ic', label: 'Teacher-in-Charge', type: 'text', placeholder: 'e.g. Ms Tan Wei Ling' },
      { id: 'pickup_point', label: 'Pick-up Point', type: 'text', placeholder: 'e.g. School Main Gate' },
      { id: 'destination', label: 'Destination', type: 'text', placeholder: 'e.g. Singapore Science Centre' },
      { id: 'departure_time', label: 'Departure Time', type: 'text', placeholder: 'e.g. 8:00 AM' },
      { id: 'return_time', label: 'Expected Return', type: 'text', placeholder: 'e.g. 1:00 PM' },
      { id: 'return_to', label: 'Return To', type: 'text', placeholder: 'e.g. School' },
      { id: 'num_passengers', label: 'Number of Passengers (incl. teachers)', type: 'text', placeholder: 'e.g. 37' },
      { id: 'num_buses', label: 'Number of Buses', type: 'text', placeholder: 'e.g. 2' },
      { id: 'bus_company', label: 'Bus Company', type: 'text', placeholder: 'e.g. SBS Transit Charter' },
      { id: 'special_needs', label: 'Special Requirements', type: 'textarea', placeholder: 'Wheelchair access, extra luggage space, etc.' }
    ]
  },
  {
    key: 'student_list',
    label: 'Student Attendance List',
    desc: 'Prepare the list of participating students with emergency contacts.',
    icon: '📋',
    fields: [
      { id: 'participating_classes', label: 'Participating Classes', type: 'text', placeholder: 'e.g. 4A, 4B' },
      { id: 'total_students', label: 'Total Students', type: 'text', placeholder: 'e.g. 35' },
      { id: 'teacher_ic', label: 'Teacher-in-Charge', type: 'text', placeholder: 'e.g. Ms Tan Wei Ling' },
      { id: 'accompanying_teachers', label: 'Accompanying Teachers', type: 'textarea', placeholder: 'List all accompanying teachers...' }
    ]
  },
  {
    key: 'parent_notification',
    label: 'Parent Notification',
    desc: 'Notify parents via Parents Gateway about the activity.',
    icon: '👨‍👩‍👧',
    fields: [
      { id: 'pg_subject', label: 'PG Subject Line', type: 'text', placeholder: 'e.g. Math Olympiad — 15 Mar 2026' },
      { id: 'pg_message', label: 'Message to Parents', type: 'textarea', placeholder: 'Draft the Parents Gateway notification...' },
      { id: 'consent_required', label: 'Consent Required?', type: 'select', options: ['Yes', 'No'] },
      { id: 'consent_deadline', label: 'Consent Deadline', type: 'text', placeholder: 'e.g. 10 Mar 2026' },
      { id: 'cost_involved', label: 'Cost to Parents', type: 'text', placeholder: 'e.g. $5.00 per student, or Nil' }
    ]
  },
  {
    key: 'teacher_notification',
    label: 'Teacher Notification',
    desc: 'Notify affected teachers about students leaving lessons early.',
    icon: '👩‍🏫',
    fields: [
      { id: 'affected_periods', label: 'Affected Periods', type: 'text', placeholder: 'e.g. Periods 3–6' },
      { id: 'teacher_message', label: 'Message to Teachers', type: 'textarea', placeholder: 'Draft notification to affected subject teachers...' },
      { id: 'classes_affected', label: 'Classes Affected', type: 'text', placeholder: 'e.g. 4A, 4B Pure Chemistry' },
      { id: 'notification_channel', label: 'Channel', type: 'select', options: ['MS Teams', 'Email', 'Staff Portal', 'WhatsApp Group', 'Hardcopy'] }
    ]
  },
  {
    key: 'aor',
    label: 'Approval of Request (AOR)',
    desc: 'Submit finance-related approval for activity costs.',
    icon: '💰',
    externalLink: { url: 'https://form.gov.sg/6957392872041c1d962c3ab1', label: 'Open AOR Form' },
    fields: [
      { id: 'budget_code', label: 'Budget Code', type: 'text', placeholder: 'e.g. SC-MATH-2026' },
      { id: 'estimated_cost', label: 'Estimated Total Cost', type: 'text', placeholder: 'e.g. $850.00' },
      { id: 'cost_breakdown', label: 'Cost Breakdown', type: 'textarea', placeholder: 'Bus: $500\nVenue: $200\nMaterials: $150' },
      { id: 'funding_source', label: 'Funding Source', type: 'select', options: ['School Budget', 'Department Budget', 'MOE Grant', 'Student Fee', 'External Sponsor'] },
      { id: 'approver', label: 'Approving Officer', type: 'text', placeholder: 'e.g. HOD Mathematics' }
    ]
  },
  {
    key: 'venue_booking',
    label: 'Venue Booking',
    desc: 'Confirm venue reservation and any on-site arrangements.',
    icon: '🏛️',
    fields: [
      { id: 'venue_name', label: 'Venue', type: 'text', placeholder: 'e.g. NUS Mathematics Dept' },
      { id: 'venue_contact', label: 'Venue Contact', type: 'text', placeholder: 'Name and number of venue coordinator' },
      { id: 'venue_address', label: 'Address', type: 'text', placeholder: 'Full address for bus driver' },
      { id: 'venue_time', label: 'Booked Time Slot', type: 'text', placeholder: 'e.g. 9:00 AM – 12:30 PM' },
      { id: 'facilities_needed', label: 'Facilities Needed', type: 'textarea', placeholder: 'e.g. Lecture theatre, breakout rooms, AV equipment' }
    ]
  },
  {
    key: 'post_event',
    label: 'Post-Event Report',
    desc: 'Document outcomes, incidents, and reflections after the event.',
    icon: '📝',
    fields: [
      { id: 'outcomes', label: 'Event Outcomes', type: 'textarea', placeholder: 'What were the key outcomes/results?' },
      { id: 'incidents', label: 'Incidents / Issues', type: 'textarea', placeholder: 'Were there any incidents? How were they handled?' },
      { id: 'student_feedback', label: 'Student Feedback', type: 'textarea', placeholder: 'Summary of student feedback...' },
      { id: 'follow_up', label: 'Follow-up Actions', type: 'textarea', placeholder: 'Any follow-up required?' }
    ]
  }
];

/* ── Standalone admin tools ── */
const ADMIN_TOOLS = [
  { key: 'aor_form', label: 'AOR Form', desc: 'Open the official Approval of Request form. Remember to attach quotations separately.', icon: '💰', href: 'https://form.gov.sg/6957392872041c1d962c3ab1' },
  { key: 'bus_form', label: 'Bus Booking', desc: 'Open the official bus booking form.', icon: '🚌', href: 'https://form.gov.sg/697319e97621e837dda7c331' },
  { key: 'relief_timetable', label: 'Relief Timetable', desc: 'Plan teacher relief assignments when staff are away.', icon: '🔄', href: 'btyrelief/relief.html' },
  { key: 'org_chart', label: 'Org Chart', desc: 'View and edit the school organisational chart.', icon: '🏢', href: 'btyrelief/orgstruc.html' },
  { key: 'framework', label: 'Framework Builder', desc: 'Create cycle-arrow diagrams for frameworks and processes.', icon: '🔃', href: 'btyrelief/framework.html' },
  { key: 'inventory', label: 'Resource Inventory', desc: 'Track department resources, equipment, and consumables.', icon: '📦' },
  { key: 'calendar', label: 'Department Calendar', desc: 'View and plan department events, deadlines, and milestones.', icon: '📅' }
];

/* ── In-app iframe overlay for admin tools ── */
function openAdminOverlay(title, href) {
  // External links (form.gov.sg etc.) open in new tab since they block iframing
  if (href.startsWith('http')) {
    window.open(href, '_blank');
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);animation:simFadeIn 0.2s ease;';

  const win = document.createElement('div');
  win.style.cssText = 'position:absolute;top:2%;left:3%;right:3%;bottom:2%;display:flex;flex-direction:column;overflow:hidden;background:var(--bg-card);border-radius:12px;box-shadow:0 25px 60px rgba(0,0,0,0.4);';

  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--bg-card);border-bottom:1px solid var(--border);flex-shrink:0;';
  topBar.innerHTML = `
    <span style="font-weight:600;font-size:0.9375rem;color:var(--ink);flex:1;">${title}</span>
    <button style="background:none;border:none;cursor:pointer;padding:4px 10px;font-size:1.25rem;color:var(--ink-muted);border-radius:6px;transition:background 0.15s;" onmouseover="this.style.background='var(--surface-hover)'" onmouseout="this.style.background='none'" id="admin-overlay-close">&times;</button>
  `;

  const iframe = document.createElement('iframe');
  iframe.src = href;
  iframe.style.cssText = 'flex:1;border:none;width:100%;background:var(--bg-card);';

  win.appendChild(topBar);
  win.appendChild(iframe);
  overlay.appendChild(win);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s';
    setTimeout(() => overlay.remove(), 200);
  };

  topBar.querySelector('#admin-overlay-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

/* ══════════ Main render ══════════ */
export function render(container) {
  const events = Store.get('adminEvents') || [];

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header">
          <div>
            <h1 class="page-title">Admin</h1>
            <p class="page-subtitle">Event planning, approvals, and school operations.</p>
          </div>
          <button class="btn btn-primary" id="new-event-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Event
          </button>
        </div>

        <!-- Quick Tools Row -->
        <div style="margin-bottom:var(--sp-8);">
          <div class="section-header">
            <span class="section-title">Quick Tools</span>
          </div>
          <div class="grid-3 stagger" id="admin-tools"></div>
        </div>

        <!-- MOE Circulars & Directives (Placeholder) -->
        <div style="margin-bottom:var(--sp-8);">
          <div class="section-header">
            <span class="section-title">MOE Circulars & Directives</span>
            <span class="badge badge-gray">Requires Setup</span>
          </div>
          <div class="card" style="border:1px dashed var(--border);background:transparent;padding:var(--sp-6);text-align:center;opacity:0.7;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" style="margin:0 auto var(--sp-2);display:block;">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <p style="font-size:0.875rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-1);">MOE Circulars & Directives</p>
            <p style="font-size:0.75rem;color:var(--ink-faint);line-height:1.5;max-width:440px;margin:0 auto;">Access MOE circulars, admin directives, report templates, and operational protocols. Connect to your school's administrative portal to surface official documents here. Requires school administrator setup.</p>
          </div>
        </div>

        <!-- Active Events -->
        <div style="margin-bottom:var(--sp-8);">
          <div class="section-header">
            <span class="section-title">Events & Activities</span>
            <span class="badge badge-blue badge-dot">${events.length} event${events.length !== 1 ? 's' : ''}</span>
          </div>
          <div id="events-list"></div>
        </div>
      </div>
    </div>
  `;

  renderQuickTools(container.querySelector('#admin-tools'));
  renderEventsList(container.querySelector('#events-list'), events);

  container.querySelector('#new-event-btn').addEventListener('click', () => showNewEventModal(container));
}

/* ── Quick tools cards ── */
function renderQuickTools(el) {
  el.innerHTML = ADMIN_TOOLS.map(tool => `
    <div class="action-card" data-tool="${tool.key}">
      <div class="action-card-icon" style="background:var(--accent-light);color:var(--accent);font-size:1.5rem;">${tool.icon}</div>
      <div class="action-card-title">${tool.label}</div>
      <div class="action-card-desc">${tool.desc}</div>
    </div>
  `).join('');

  el.addEventListener('click', e => {
    const card = e.target.closest('[data-tool]');
    if (!card) return;
    const tool = ADMIN_TOOLS.find(t => t.key === card.dataset.tool);
    if (tool?.href) {
      openAdminOverlay(tool.label, tool.href);
    } else {
      showToast(`${card.querySelector('.action-card-title').textContent} — coming in the next update!`, 'success');
    }
  });
}

/* ── Events list ── */
function renderEventsList(el, events) {
  if (events.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <h3 class="empty-state-title">No events yet</h3>
        <p class="empty-state-text">Create your first event to get started with planning, RAMS, bus booking, and notifications.</p>
      </div>`;
    return;
  }

  el.innerHTML = events.map(ev => {
    const enabledTasks = ev.tasks.filter(t => t.enabled);
    const completedTasks = enabledTasks.filter(t => t.status === 'completed');
    const progress = enabledTasks.length > 0 ? Math.round((completedTasks.length / enabledTasks.length) * 100) : 0;

    const statusColor = ev.status === 'completed' ? 'var(--success)' :
                         ev.status === 'in_progress' ? 'var(--accent)' : 'var(--ink-faint)';
    const statusLabel = ev.status === 'completed' ? 'Completed' :
                        ev.status === 'in_progress' ? 'In Progress' : 'Planning';

    return `
      <div class="card card-hover" style="margin-bottom:var(--sp-3);cursor:pointer;" data-event="${ev.id}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-1);">
              <h3 style="font-size:1rem;font-weight:600;color:var(--ink);">${esc(ev.name)}</h3>
              <span class="badge" style="background:${statusColor}20;color:${statusColor};">${statusLabel}</span>
            </div>
            <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">
              ${ev.date ? ev.date + ' · ' : ''}${ev.eventType || 'Activity'} · ${enabledTasks.length} task${enabledTasks.length !== 1 ? 's' : ''}
            </p>
            <div style="display:flex;align-items:center;gap:var(--sp-3);">
              <div style="flex:1;max-width:200px;height:6px;background:var(--bg-subtle);border-radius:var(--radius-full);overflow:hidden;">
                <div style="width:${progress}%;height:100%;background:${progress === 100 ? 'var(--success)' : 'var(--accent)'};border-radius:var(--radius-full);transition:width 0.3s;"></div>
              </div>
              <span style="font-size:0.75rem;color:var(--ink-muted);">${completedTasks.length}/${enabledTasks.length} done</span>
            </div>
          </div>
          <div style="display:flex;gap:var(--sp-1);">
            ${enabledTasks.slice(0, 4).map(t => {
              const tmpl = EVENT_TASKS.find(et => et.key === t.key);
              return `<span title="${tmpl?.label || t.key}" style="font-size:1.1rem;">${tmpl?.icon || '📌'}</span>`;
            }).join('')}
            ${enabledTasks.length > 4 ? `<span style="font-size:0.75rem;color:var(--ink-muted);align-self:center;">+${enabledTasks.length - 4}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  el.addEventListener('click', e => {
    const card = e.target.closest('[data-event]');
    if (!card) return;
    const ev = events.find(ev => ev.id === card.dataset.event);
    if (ev) showEventDetail(el.closest('.page-container'), ev);
  });
}

/* ══════════ New Event Modal — Single-Point Entry with AI ══════════ */
function showNewEventModal(container) {
  const savedTemplates = Store.get('adminTemplates') || [];

  const { backdrop, close } = openModal({
    title: 'New Event / Activity',
    body: `
      ${savedTemplates.length > 0 ? `
        <div class="input-group">
          <label class="input-label">From Template (optional)</label>
          <select class="input" id="event-template">
            <option value="">— Start from scratch —</option>
            ${savedTemplates.map(t => `<option value="${t.id}">${esc(t.name)} (${t.eventType || 'Activity'})</option>`).join('')}
          </select>
        </div>
      ` : ''}
      <div class="input-group">
        <label class="input-label">Event Name</label>
        <input class="input" id="event-name" placeholder="e.g. Math Olympiad 2026" />
      </div>
      <div class="input-group">
        <label class="input-label">Date</label>
        <input class="input" id="event-date" type="date" />
      </div>
      <div class="input-group">
        <label class="input-label">Event Type</label>
        <select class="input" id="event-type">
          <option value="Competition">Competition</option>
          <option value="Learning Journey">Learning Journey</option>
          <option value="Workshop">Workshop</option>
          <option value="Camp">Camp</option>
          <option value="CCA Activity">CCA Activity</option>
          <option value="Community Service">Community Service</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Describe the Event</label>
        <textarea class="input" id="event-description" rows="5" placeholder="Tell us the key details and Co-Cher will draft all event documents for you.

E.g. 'Taking 4A and 4B Pure Chemistry students (32 students) to NUS Science Faculty for a lab tour on 20 Mar 2026. Departing school at 8am, returning by 1pm. 2 teachers accompanying. Budget of $500 for bus. Need parent consent by 15 Mar.'"></textarea>
        <div style="font-size:0.6875rem;color:var(--ink-faint);margin-top:4px;">The more detail you provide, the better the AI drafts will be. Include dates, venues, student numbers, costs, and any special needs.</div>
      </div>
      <div class="input-group">
        <label class="input-label">Which documents do you need?</label>
        <p style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-2);">Select the tasks you need. The AI will draft content for each.</p>
        <div style="display:flex;flex-direction:column;gap:var(--sp-2);" id="task-checklist">
          ${EVENT_TASKS.map(t => `
            <label style="display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-2) var(--sp-3);background:var(--bg-subtle);border-radius:var(--radius-md);cursor:pointer;transition:background 0.15s;">
              <input type="checkbox" value="${t.key}" checked class="event-task-check" />
              <span style="font-size:1.1rem;">${t.icon}</span>
              <div>
                <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);">${t.label}</div>
                <div style="font-size:0.6875rem;color:var(--ink-muted);">${t.desc}</div>
              </div>
            </label>
          `).join('')}
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-secondary" data-action="create-blank">Create Blank</button>
      <button class="btn btn-primary" data-action="create-ai">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        Generate with AI
      </button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);

  // Create blank (no AI)
  backdrop.querySelector('[data-action="create-blank"]').addEventListener('click', () => {
    const name = backdrop.querySelector('#event-name').value.trim();
    if (!name) { showToast('Please enter an event name.', 'danger'); return; }
    createEventFromModal(backdrop, container, close, null);
  });

  // Create with AI
  backdrop.querySelector('[data-action="create-ai"]').addEventListener('click', async () => {
    const name = backdrop.querySelector('#event-name').value.trim();
    if (!name) { showToast('Please enter an event name.', 'danger'); return; }

    const description = backdrop.querySelector('#event-description').value.trim();
    if (!description) { showToast('Please describe the event so the AI can draft the documents.', 'danger'); return; }

    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

    const date = backdrop.querySelector('#event-date').value;
    const eventType = backdrop.querySelector('#event-type').value;
    const checks = [...backdrop.querySelectorAll('.event-task-check')];
    const enabledKeys = checks.filter(c => c.checked).map(c => c.value);
    const enabledTasks = EVENT_TASKS.filter(t => enabledKeys.includes(t.key));

    // Disable buttons, show loading
    const aiBtn = backdrop.querySelector('[data-action="create-ai"]');
    aiBtn.disabled = true;
    aiBtn.innerHTML = '<span class="chat-typing" style="font-size:0.8125rem;">AI is drafting all documents...</span>';

    try {
      const aiData = await generateEventContent(name, date, eventType, description, enabledTasks);
      close();
      createEventFromModal(backdrop, container, () => {}, aiData, name, date, eventType, enabledKeys);
    } catch (err) {
      aiBtn.disabled = false;
      aiBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate with AI`;
      showToast(`AI generation failed: ${err.message}`, 'danger');
    }
  });

  // Template selection handler
  const tmplSelect = backdrop.querySelector('#event-template');
  if (tmplSelect) {
    tmplSelect.addEventListener('change', () => {
      const tmpl = savedTemplates.find(t => t.id === tmplSelect.value);
      if (!tmpl) return;
      const nameInput = backdrop.querySelector('#event-name');
      const typeSelect = backdrop.querySelector('#event-type');
      if (nameInput && !nameInput.value) nameInput.value = tmpl.name;
      if (typeSelect) typeSelect.value = tmpl.eventType || 'Other';
      // Pre-check tasks from template
      const checks = [...backdrop.querySelectorAll('.event-task-check')];
      checks.forEach(c => {
        const tc = tmpl.taskConfig?.find(tc => tc.key === c.value);
        c.checked = tc ? tc.enabled : false;
      });
      showToast(`Template "${tmpl.name}" applied`);
    });
  }

  setTimeout(() => backdrop.querySelector('#event-name')?.focus(), 100);
}

/* ── Create event from modal data ── */
function createEventFromModal(backdrop, container, close, aiData, nameOverride, dateOverride, typeOverride, enabledKeysOverride) {
  const name = nameOverride || backdrop?.querySelector('#event-name')?.value?.trim();
  const date = dateOverride || backdrop?.querySelector('#event-date')?.value || '';
  const eventType = typeOverride || backdrop?.querySelector('#event-type')?.value || 'Other';

  let enabledKeys;
  if (enabledKeysOverride) {
    enabledKeys = enabledKeysOverride;
  } else {
    const checks = [...(backdrop?.querySelectorAll('.event-task-check') || [])];
    enabledKeys = checks.filter(c => c.checked).map(c => c.value);
  }

  const currentUser = getCurrentUser();
  const tasks = EVENT_TASKS.map(t => {
    const enabled = enabledKeys.includes(t.key);
    const data = {};
    // Pre-fill teacher-in-charge from current user
    if (currentUser?.name && (t.key === 'student_list' || t.key === 'bus_booking')) {
      data.teacher_ic = currentUser.name;
    }
    // Pre-fill from AI data if available
    if (aiData && enabled && aiData[t.key]) {
      const aiTaskData = aiData[t.key];
      t.fields.forEach(f => {
        if (aiTaskData[f.id]) data[f.id] = aiTaskData[f.id];
      });
    }
    return { key: t.key, enabled, status: 'pending', approvalStatus: 'not_started', data };
  });

  const event = {
    id: generateId(),
    name,
    date,
    eventType,
    status: aiData ? 'in_progress' : 'planning',
    tasks,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const events = [...(Store.get('adminEvents') || []), event];
  Store.set('adminEvents', events);

  if (aiData) {
    showToast(`Event "${name}" created with AI-drafted content! Review each task to confirm.`, 'success');
  } else {
    showToast(`Event "${name}" created!`, 'success');
  }
  close();
  render(container);

  // After AI generation, jump straight into the event detail with panels expanded
  if (aiData) {
    const pageContainer = container.querySelector('.page-container');
    if (pageContainer) showEventDetail(pageContainer, event, { autoExpand: true });
  }
}

/* ── AI: Generate all event task content from description ── */
async function generateEventContent(name, date, eventType, description, enabledTasks) {
  // Build a field schema for the AI to fill
  const taskSchema = enabledTasks.map(t => ({
    key: t.key,
    label: t.label,
    fields: t.fields.map(f => ({ id: f.id, label: f.label, type: f.type, options: f.options || null }))
  }));

  const messages = [{
    role: 'user',
    content: `Generate content for all event planning documents based on this event description.

Event Name: ${name}
Date: ${date || 'Not specified'}
Type: ${eventType}
Description: ${description}

Please fill in all fields for each of the following task categories:

${taskSchema.map(t => `
### ${t.label} (key: ${t.key})
Fields to fill:
${t.fields.map(f => `- ${f.label} (id: ${f.id})${f.type === 'select' ? ` [options: ${f.options.join(', ')}]` : ''}`).join('\n')}`).join('\n')}

IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation. The JSON structure must be:
{
  "${enabledTasks[0]?.key || 'rams'}": {
    "field_id": "field value",
    ...
  },
  ...
}

For select fields, use one of the provided options exactly. For text/textarea fields, provide practical, realistic content based on the event description. If information is missing from the description, make reasonable assumptions for a Singapore school context and use [PLACEHOLDER] markers where the teacher needs to fill in specific details.`
  }];

  const response = await sendChat(messages, {
    systemPrompt: `You are Co-Cher's event planning assistant for Singapore schools. Generate complete, practical event planning documents based on teacher descriptions. Respond with valid JSON only. Be specific, professional, and follow Singapore MOE conventions for school communications.`,
    jsonMode: true,
    maxTokens: 8192
  });

  // With jsonMode the API returns raw JSON, but add fallback parsing just in case
  let jsonStr = response.trim();
  // Strip markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Try to extract the outermost JSON object from response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        // Last resort: try to fix common JSON issues (trailing commas)
        const cleaned = jsonMatch[0]
          .replace(/,\s*([}\]])/g, '$1')  // remove trailing commas
          .replace(/[\x00-\x1f]/g, ' ');  // remove control characters
        return JSON.parse(cleaned);
      }
    }
    throw new Error('Failed to parse AI response as JSON. Please try again.');
  }
}

/* ── Approval Status Config ── */
const APPROVAL_STATES = [
  { key: 'not_started', label: 'Not Started', color: 'var(--ink-faint)', bg: 'var(--bg-subtle)' },
  { key: 'draft', label: 'Draft', color: 'var(--accent)', bg: 'var(--accent-light)' },
  { key: 'submitted', label: 'Submitted', color: 'var(--warning)', bg: 'var(--warning-light)' },
  { key: 'approved', label: 'Approved', color: 'var(--success)', bg: 'var(--success-light)' },
  { key: 'completed', label: 'Completed', color: 'var(--success)', bg: 'var(--success-light)' },
];

function nextApprovalState(current) {
  const idx = APPROVAL_STATES.findIndex(s => s.key === current);
  return APPROVAL_STATES[(idx + 1) % APPROVAL_STATES.length].key;
}

function getApprovalStyle(status) {
  return APPROVAL_STATES.find(s => s.key === status) || APPROVAL_STATES[0];
}

/* ══════════ Event Detail View ══════════ */
function showEventDetail(pageContainer, ev, opts = {}) {
  const events = Store.get('adminEvents') || [];
  const enabledTasks = ev.tasks.filter(t => t.enabled);

  pageContainer.innerHTML = `
    <div style="margin-bottom:var(--sp-6);">
      <button class="btn btn-ghost btn-sm" id="back-to-admin">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Admin
      </button>
    </div>

    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--sp-4);">
      <div>
        <h1 class="page-title">${esc(ev.name)}</h1>
        <p class="page-subtitle">${ev.date ? ev.date + ' · ' : ''}${ev.eventType || 'Activity'}</p>
      </div>
      <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" id="save-template-btn" title="Save as reusable template">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Save Template
        </button>
        <button class="btn btn-secondary btn-sm" id="delete-event-btn">Delete</button>
      </div>
    </div>

    <!-- Workflow Breadcrumb -->
    <div id="admin-workflow-bar">${renderAdminWorkflow(ev)}</div>

    <!-- Status Board -->
    <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-6);flex-wrap:wrap;overflow-x:auto;" id="status-board">
      ${enabledTasks.map(task => {
        const tmpl = EVENT_TASKS.find(et => et.key === task.key);
        if (!tmpl) return '';
        const approval = getApprovalStyle(task.approvalStatus || 'not_started');
        return `
          <div class="approval-badge" data-task-key="${task.key}" style="
            display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--radius-full);
            background:${approval.bg};border:1px solid ${approval.color}30;cursor:pointer;transition:all 0.15s;
            font-size:0.6875rem;white-space:nowrap;
          " title="Click to cycle status">
            <span style="font-size:0.875rem;">${tmpl.icon}</span>
            <span style="font-weight:600;color:var(--ink);">${tmpl.label}</span>
            <span style="color:${approval.color};font-weight:500;">${approval.label}</span>
          </div>`;
      }).join('')}
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--sp-4);" id="task-panels">
      ${enabledTasks.map(task => {
        const tmpl = EVENT_TASKS.find(et => et.key === task.key);
        if (!tmpl) return '';
        const isComplete = task.status === 'completed';
        const approval = getApprovalStyle(task.approvalStatus || 'not_started');

        return `
          <div class="card" style="border-left:4px solid ${isComplete ? 'var(--success)' : 'var(--border)'};transition:border-color 0.2s;" data-task-key="${task.key}">
            <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;" class="task-header">
              <div style="display:flex;align-items:center;gap:var(--sp-3);">
                <span style="font-size:1.5rem;">${tmpl.icon}</span>
                <div>
                  <div style="font-size:0.9375rem;font-weight:600;color:var(--ink);">${tmpl.label}</div>
                  <div style="font-size:0.75rem;color:var(--ink-muted);">${tmpl.desc}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:var(--sp-2);">
                <span class="badge" style="background:${approval.bg};color:${approval.color};font-size:0.6875rem;">${approval.label}</span>
                <span class="badge ${isComplete ? 'badge-green' : 'badge-gray'} badge-dot">${isComplete ? 'Done' : 'Pending'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" class="task-chevron" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div class="task-body" style="display:none;margin-top:var(--sp-4);padding-top:var(--sp-4);border-top:1px solid var(--border-light);">
              ${task.key === 'student_list' ? '<div id="student-upload-zone" style="margin-bottom:var(--sp-4);"></div>' : ''}
              <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
                ${tmpl.fields.map(f => `
                  <div class="input-group">
                    <label class="input-label">${f.label}</label>
                    ${f.type === 'textarea'
                      ? `<textarea class="input" data-field="${f.id}" placeholder="${f.placeholder || ''}" rows="3">${esc(task.data[f.id] || '')}</textarea>`
                      : f.type === 'select'
                        ? `<select class="input" data-field="${f.id}">
                            ${f.options.map(o => `<option value="${o}" ${task.data[f.id] === o ? 'selected' : ''}>${o}</option>`).join('')}
                           </select>`
                        : `<input class="input" data-field="${f.id}" value="${escAttr(task.data[f.id] || '')}" placeholder="${f.placeholder || ''}" />`
                    }
                  </div>
                `).join('')}
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);margin-top:var(--sp-4);">
                <button class="btn btn-primary btn-sm save-task-btn">Save</button>
                <button class="btn ${isComplete ? 'btn-secondary' : 'btn-accent'} btn-sm toggle-complete-btn">
                  ${isComplete ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
                ${task.key === 'rams' ? `
                  <button class="btn btn-sm open-rams-editor-btn" style="background:var(--info);color:#fff;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Open RAMS Editor
                  </button>
                ` : ''}
                ${task.key === 'student_list' ? `
                  <button class="btn btn-sm btn-secondary print-students-btn">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print List
                  </button>
                ` : ''}
                ${tmpl.externalLink ? `
                  <a href="${buildFormURL(tmpl.externalLink.url, ev, task)}" target="_blank" rel="noopener" class="btn btn-sm" style="background:var(--info);color:#fff;text-decoration:none;margin-left:auto;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    ${tmpl.externalLink.label}
                  </a>
                ` : ''}
                ${(task.key === 'parent_notification' || task.key === 'teacher_notification')
                  ? `<button class="btn btn-sm notify-teams-btn" style="background:var(--info);color:#fff;${tmpl.externalLink ? '' : 'margin-left:auto;'}" data-task-key="${task.key}">
                      Teams
                    </button>
                    <button class="btn btn-sm btn-secondary notify-email-btn" data-task-key="${task.key}">
                      Email
                    </button>`
                  : ''}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>
  `;

  // Back button
  pageContainer.querySelector('#back-to-admin').addEventListener('click', () => {
    render(pageContainer.closest('#main-view') || pageContainer.closest('main'));
  });

  // Delete button
  pageContainer.querySelector('#delete-event-btn').addEventListener('click', () => {
    const updated = events.filter(e => e.id !== ev.id);
    Store.set('adminEvents', updated);
    showToast('Event deleted.', 'success');
    render(pageContainer.closest('#main-view') || pageContainer.closest('main'));
  });

  // Accordion toggle
  pageContainer.querySelectorAll('.task-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = header.nextElementSibling;
      const chevron = header.querySelector('.task-chevron');
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
    });
  });

  // Auto-expand all panels when arriving from AI generation
  if (opts.autoExpand) {
    pageContainer.querySelectorAll('.task-header').forEach(header => {
      const body = header.nextElementSibling;
      const chevron = header.querySelector('.task-chevron');
      body.style.display = 'block';
      chevron.style.transform = 'rotate(180deg)';
    });
  }

  // Save task data
  pageContainer.querySelectorAll('.save-task-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('[data-task-key]');
      const key = panel.dataset.taskKey;
      const fields = panel.querySelectorAll('[data-field]');
      const data = {};
      fields.forEach(f => { data[f.dataset.field] = f.value; });

      const task = ev.tasks.find(t => t.key === key);
      if (task) task.data = data;
      ev.updatedAt = Date.now();
      Store.set('adminEvents', [...events]);
      showToast('Task saved!', 'success');
    });
  });

  // Toggle complete
  pageContainer.querySelectorAll('.toggle-complete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.closest('[data-task-key]');
      const key = panel.dataset.taskKey;
      const task = ev.tasks.find(t => t.key === key);
      if (task) {
        task.status = task.status === 'completed' ? 'pending' : 'completed';
        // Update overall event status
        const enabled = ev.tasks.filter(t => t.enabled);
        const allDone = enabled.every(t => t.status === 'completed');
        const anyStarted = enabled.some(t => t.status === 'completed' || Object.keys(t.data).length > 0);
        ev.status = allDone ? 'completed' : anyStarted ? 'in_progress' : 'planning';
        ev.updatedAt = Date.now();
        Store.set('adminEvents', [...events]);
        showEventDetail(pageContainer, ev);
      }
    });
  });

  // Teams notify buttons
  pageContainer.querySelectorAll('.notify-teams-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.taskKey;
      const recipientType = key === 'parent_notification' ? 'parent' : 'teacher';
      const tmpl = EVENT_TASKS.find(et => et.key === key);
      showNotifyModal(ev.name, tmpl?.label || key, recipientType, ev);
    });
  });

  // Email notify buttons
  pageContainer.querySelectorAll('.notify-email-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.taskKey;
      const recipientType = key === 'parent_notification' ? 'parent' : 'teacher';
      const tmpl = EVENT_TASKS.find(et => et.key === key);
      showNotifyModal(ev.name, tmpl?.label || key, recipientType, ev);
    });
  });

  // Workflow breadcrumb clicks
  bindAdminWorkflowClicks(pageContainer);

  // Approval status badge cycling
  pageContainer.querySelectorAll('.approval-badge').forEach(badge => {
    badge.addEventListener('click', () => {
      const key = badge.dataset.taskKey;
      const task = ev.tasks.find(t => t.key === key);
      if (task) {
        task.approvalStatus = nextApprovalState(task.approvalStatus || 'not_started');
        ev.updatedAt = Date.now();
        Store.set('adminEvents', [...events]);
        showEventDetail(pageContainer, ev);
      }
    });
  });

  // RAMS Editor button
  const ramsBtn = pageContainer.querySelector('.open-rams-editor-btn');
  if (ramsBtn) {
    ramsBtn.addEventListener('click', () => {
      const ramsTask = ev.tasks.find(t => t.key === 'rams');
      openRamsEditor(ev, ramsTask, (updatedData) => {
        if (ramsTask) {
          ramsTask.data._ramsEditorData = updatedData;
          ev.updatedAt = Date.now();
          Store.set('adminEvents', [...events]);
        }
      });
    });
  }

  // Student upload zone
  const uploadContainer = pageContainer.querySelector('#student-upload-zone');
  if (uploadContainer) {
    const uploader = createStudentUploadZone({
      onParsed: (students) => {
        const studentTask = ev.tasks.find(t => t.key === 'student_list');
        if (studentTask) {
          studentTask.data._uploadedStudents = students;
          studentTask.data.total_students = String(students.length);
          const classes = [...new Set(students.map(s => s.class).filter(Boolean))].sort();
          studentTask.data.participating_classes = classes.join(', ');
          ev.updatedAt = Date.now();
          Store.set('adminEvents', [...events]);
          // Update displayed fields
          const panel = pageContainer.querySelector('[data-task-key="student_list"]');
          if (panel) {
            const totalField = panel.querySelector('[data-field="total_students"]');
            const classField = panel.querySelector('[data-field="participating_classes"]');
            if (totalField) totalField.value = studentTask.data.total_students;
            if (classField) classField.value = studentTask.data.participating_classes;
          }
          // Also update bus booking passenger count if exists
          const busTask = ev.tasks.find(t => t.key === 'bus_booking' && t.enabled);
          if (busTask) {
            const accompTeachers = parseInt(ev.tasks.find(t => t.key === 'student_list')?.data?.accompanying_teachers?.split(',').length) || 2;
            busTask.data.num_passengers = String(students.length + accompTeachers);
            const busPanel = pageContainer.querySelector('[data-task-key="bus_booking"]');
            if (busPanel) {
              const passField = busPanel.querySelector('[data-field="num_passengers"]');
              if (passField) passField.value = busTask.data.num_passengers;
            }
          }
          showToast(`${students.length} students loaded!`, 'success');
        }
      }
    });
    uploadContainer.appendChild(uploader.el);
  }

  // Print student list
  const printStudentsBtn = pageContainer.querySelector('.print-students-btn');
  if (printStudentsBtn) {
    printStudentsBtn.addEventListener('click', () => {
      const studentTask = ev.tasks.find(t => t.key === 'student_list');
      const students = studentTask?.data?._uploadedStudents || [];
      printStudentList(ev, studentTask, students);
    });
  }

  // Save as Template
  pageContainer.querySelector('#save-template-btn')?.addEventListener('click', () => {
    const templates = Store.get('adminTemplates') || [];
    const tmpl = {
      id: generateId(),
      name: ev.name,
      eventType: ev.eventType,
      taskConfig: ev.tasks.map(t => ({
        key: t.key,
        enabled: t.enabled,
        defaultData: { ...t.data },
      })),
      createdAt: Date.now(),
    };
    // Remove uploaded students from template data (too large)
    tmpl.taskConfig.forEach(tc => {
      delete tc.defaultData._uploadedStudents;
      delete tc.defaultData._ramsEditorData;
    });
    templates.push(tmpl);
    Store.set('adminTemplates', templates);
    showToast(`Template "${ev.name}" saved!`, 'success');
  });
}

/* ── Print Student Attendance List ── */
function printStudentList(event, task, students) {
  const rows = students.length > 0
    ? students.map((s, i) => `<tr><td style="border:1px solid #999;padding:4px 8px;text-align:center;">${i + 1}</td><td style="border:1px solid #999;padding:4px 8px;">${esc(s.name)}</td><td style="border:1px solid #999;padding:4px 8px;">${esc(s.class)}</td><td style="border:1px solid #999;padding:4px 8px;">${esc(s.emergencyContact || s.contact || '')}</td></tr>`).join('')
    : '<tr><td colspan="4" style="border:1px solid #999;padding:20px;text-align:center;color:#64748b;">No students uploaded. Upload a CSV/Excel file to populate this list.</td></tr>';

  const html = `<html><head><meta charset="utf-8"><title>Student Attendance List — ${esc(event.name)}</title>
<style>body{font-family:Calibri,sans-serif;font-size:10pt;margin:20px;}table{border-collapse:collapse;width:100%;}
h1{font-size:14pt;margin-bottom:4px;}p{font-size:9pt;color:#64748b;margin:2px 0 12px;}
th{background:#f1f5f9;font-size:9pt;}
.sig{margin-top:24px;display:flex;gap:40px;font-size:9pt;}
.sig-line{border-top:1px solid #999;padding-top:4px;width:200px;margin-top:30px;}</style></head>
<body>
<h1>Student Attendance List</h1>
<p>${esc(event.name)} &middot; ${event.date || ''} &middot; ${event.eventType || 'Activity'}</p>
<table>
  <thead><tr>
    <th style="border:1px solid #999;padding:4px 8px;width:5%;">S/N</th>
    <th style="border:1px solid #999;padding:4px 8px;width:35%;">Name</th>
    <th style="border:1px solid #999;padding:4px 8px;width:15%;">Class</th>
    <th style="border:1px solid #999;padding:4px 8px;width:25%;">Emergency Contact</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<p style="margin-top:12px;">Total Students: <strong>${students.length}</strong> &nbsp;&nbsp;|&nbsp;&nbsp; Classes: ${task?.data?.participating_classes || '—'}</p>
<p>Teacher-in-Charge: ${esc(task?.data?.teacher_ic || '—')} &nbsp;&nbsp;|&nbsp;&nbsp; Accompanying Teachers: ${esc(task?.data?.accompanying_teachers || '—')}</p>
<div class="sig">
  <div><div class="sig-line">Teacher-in-Charge Signature</div></div>
  <div><div class="sig-line">Date</div></div>
</div>
</body></html>`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Attendance_${(event.name || 'Event').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Attendance list exported!', 'success');
}

/* Quick AOR removed — use AOR Form (FormSG) directly */

/* ══════════ MS Teams & Email Notification Helpers ══════════ */

/**
 * Build a Microsoft Teams deep-link URL that opens a chat with the given email(s)
 * and pre-fills a message.
 * @param {string|string[]} emails - one email or an array
 * @param {string} message - pre-filled message text
 * @returns {string} teams deep link
 */
function buildTeamsLink(emails, message) {
  const users = Array.isArray(emails) ? emails.join(',') : emails;
  const encoded = encodeURIComponent(message || '');
  return `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(users)}&message=${encoded}`;
}

/**
 * Build a mailto: link with optional BCC, subject, and body.
 * @param {string|string[]} to
 * @param {string} subject
 * @param {string} body
 * @param {string} [bcc]
 * @returns {string}
 */
function buildMailtoLink(to, subject, body, bcc) {
  const addr = Array.isArray(to) ? to.join(',') : to;
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  if (bcc) params.set('bcc', bcc);
  const qs = params.toString();
  return `mailto:${addr}${qs ? '?' + qs : ''}`;
}

/* ── Notification Templates ── */
const NOTIFICATION_TEMPLATES = {
  parent: [
    {
      label: 'Learning Journey',
      subject: (ev) => `Learning Journey: ${ev}`,
      body: (ev) => `Dear Parents/Guardians,

Your child has been selected to participate in a Learning Journey: ${ev}.

Details:
- Date: [DATE]
- Time: [TIME]
- Venue: [VENUE]
- Attire: School uniform / PE attire
- Things to bring: Water bottle, writing materials

Students will depart from school and return by [TIME]. Lunch will be provided / Students should bring their own lunch.

Please provide your consent via Parents Gateway by [DEADLINE].

Thank you for your support.

Warm regards,
[YOUR NAME]
[DESIGNATION]`
    },
    {
      label: 'Competition',
      subject: (ev) => `Competition: ${ev}`,
      body: (ev) => `Dear Parents/Guardians,

Your child has been selected to represent the school in: ${ev}.

Details:
- Date: [DATE]
- Venue: [VENUE]
- Reporting time: [TIME]
- Expected return: [TIME]

Students will need: [ITEMS]

Please confirm your child's participation and provide consent via Parents Gateway by [DEADLINE].

Should you have any queries, please contact the undersigned.

Thank you.

Warm regards,
[YOUR NAME]
[DESIGNATION]`
    },
    {
      label: 'Camp',
      subject: (ev) => `Camp: ${ev}`,
      body: (ev) => `Dear Parents/Guardians,

Your child will be participating in: ${ev}.

Camp Details:
- Date: [START DATE] to [END DATE]
- Venue: [VENUE]
- Reporting time (Day 1): [TIME]
- Dismissal time (Last Day): [TIME]

Packing List:
- Clothes for [X] days
- Toiletries
- Water bottle
- Medications (if any — please inform teachers)
- Sleeping bag / mat (if applicable)

Emergency Contact: [NAME] — [NUMBER]

Please submit the medical declaration form and consent via Parents Gateway by [DEADLINE].

Thank you.

Warm regards,
[YOUR NAME]
[DESIGNATION]`
    },
    {
      label: 'Workshop',
      subject: (ev) => `Workshop: ${ev}`,
      body: (ev) => `Dear Parents/Guardians,

Your child will be attending a workshop: ${ev}.

Details:
- Date: [DATE]
- Time: [TIME]
- Venue: [VENUE / Online]

No special items are required unless stated otherwise.

Please acknowledge via Parents Gateway.

Thank you.

Warm regards,
[YOUR NAME]
[DESIGNATION]`
    }
  ],
  teacher: [
    {
      label: 'Lesson Coverage',
      subject: (ev) => `Lesson Coverage Required — ${ev}`,
      body: (ev) => `Dear Colleague,

The following students will be away from your lessons due to: ${ev}.

Affected:
- Date: [DATE]
- Periods: [PERIODS]
- Classes: [CLASSES]
- Number of students: [COUNT]

Please set independent work or adjust your lesson plan accordingly. The student attendance list has been attached / shared separately.

Apologies for any inconvenience. Thank you for your understanding.

Regards,
[YOUR NAME]`
    },
    {
      label: 'Duty Assignment',
      subject: (ev) => `Duty Assignment — ${ev}`,
      body: (ev) => `Dear Colleague,

You have been assigned to accompany students for: ${ev}.

Details:
- Date: [DATE]
- Reporting time: [TIME]
- Venue: [VENUE]
- Role: [ROLE]

Please confirm your availability with the undersigned. A briefing will be held on [DATE/TIME].

Thank you for your support.

Regards,
[YOUR NAME]`
    },
    {
      label: 'Event Update',
      subject: (ev) => `Update — ${ev}`,
      body: (ev) => `Dear Colleagues,

Please note the following update regarding: ${ev}.

[UPDATE DETAILS]

Thank you for your attention.

Regards,
[YOUR NAME]`
    }
  ]
};

/**
 * Show a Notify modal with staff picker integration.
 */
function showNotifyModal(eventName, taskLabel, recipientType, event) {
  const templates = NOTIFICATION_TEMPLATES[recipientType] || [];
  const user = getCurrentUser();
  let selectedEmails = recipientType === 'teacher' ? [ALL_STAFF_EMAIL] : [];

  const { backdrop, close } = openModal({
    title: `Notify — ${taskLabel}`,
    width: 560,
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);">
        Send a notification about <strong>${esc(eventName)}</strong> via MS Teams or Email.
      </p>

      ${templates.length > 0 ? `
        <div style="margin-bottom:var(--sp-4);">
          <label class="input-label" style="margin-bottom:var(--sp-2);display:block;">Quick Templates</label>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            ${templates.map((t, i) => `
              <button class="btn btn-ghost btn-sm tmpl-btn" data-tmpl="${i}" style="font-size:0.75rem;border:1px solid var(--border);">${t.label}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="input-group">
        <label class="input-label">Recipients</label>
        <div style="display:flex;gap:var(--sp-2);align-items:center;margin-bottom:var(--sp-2);">
          <button class="btn btn-secondary btn-sm" id="open-staff-picker" style="font-size:0.75rem;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Choose Recipients
          </button>
          <button class="btn btn-ghost btn-sm" id="all-staff-quick" style="font-size:0.75rem;">All Staff</button>
        </div>
        <div id="recipient-chips" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:var(--sp-2);"></div>
        <input class="input" id="notify-emails" placeholder="Or type emails manually (comma-separated)" style="font-size:0.8125rem;" />
      </div>
      <div class="input-group">
        <label class="input-label">Subject</label>
        <input class="input" id="notify-subject" value="${escAttr(eventName + ' — ' + taskLabel)}" />
      </div>
      <div class="input-group">
        <label class="input-label">Message</label>
        <textarea class="input" id="notify-body" rows="8" placeholder="Type your message here...">${recipientType === 'parent' ? `Dear Parents/Guardians,\n\nPlease be informed about the upcoming event: ${eventName}.\n\nDetails will be shared via Parents Gateway.\n\nThank you.\n\nWarm regards,\n${user?.name || '[YOUR NAME]'}` : `Dear Colleague,\n\nPlease be informed about the upcoming event: ${eventName}.\n\nKindly note the affected periods and make the necessary arrangements.\n\nThank you.\n\nRegards,\n${user?.name || '[YOUR NAME]'}`}</textarea>
      </div>
      <div class="input-group">
        <label class="input-label">BCC (optional)</label>
        <input class="input" id="notify-bcc" value="${escAttr(user?.email || '')}" placeholder="e.g. admin@school.edu.sg" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="teams" style="background:var(--info);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.24 4.76A7.42 7.42 0 0 0 14 2.5c-2.03 0-3.93.8-5.36 2.26A7.51 7.51 0 0 0 6.5 10c0 2.03.78 3.93 2.14 5.36l5.36 5.36 5.24-5.24A7.58 7.58 0 0 0 21.5 10c0-2.03-.8-3.93-2.26-5.24z"/></svg>
        Send via Teams
      </button>
      <button class="btn btn-primary" data-action="email">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Send via Email
      </button>
    `
  });

  // Render recipient chips
  function updateChips() {
    const container = backdrop.querySelector('#recipient-chips');
    if (container) {
      loadStaffDirectory().then(staff => {
        container.innerHTML = renderRecipientChips(selectedEmails, staff);
        // Wire remove buttons
        container.querySelectorAll('.chip-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const email = btn.dataset.email;
            selectedEmails = selectedEmails.filter(e => e !== email);
            updateChips();
          });
        });
      });
    }
    // Also update hidden email field
    const emailInput = backdrop.querySelector('#notify-emails');
    if (emailInput && selectedEmails.length > 0) {
      emailInput.value = selectedEmails.join(', ');
    }
  }
  updateChips();

  // Staff picker button
  backdrop.querySelector('#open-staff-picker').addEventListener('click', () => {
    openStaffPicker({
      preSelected: selectedEmails,
      showAllStaff: recipientType === 'teacher',
      onSelect: (emails) => {
        selectedEmails = emails;
        updateChips();
      }
    });
  });

  // All Staff quick button
  backdrop.querySelector('#all-staff-quick').addEventListener('click', () => {
    selectedEmails = [ALL_STAFF_EMAIL];
    updateChips();
    showToast('All staff selected');
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);

  // Template buttons
  backdrop.querySelectorAll('.tmpl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.tmpl);
      const tmpl = templates[idx];
      if (!tmpl) return;
      backdrop.querySelector('#notify-subject').value = tmpl.subject(eventName);
      let body = tmpl.body(eventName);
      if (user?.name) body = body.replace(/\[YOUR NAME\]/g, user.name);
      backdrop.querySelector('#notify-body').value = body;
      backdrop.querySelectorAll('.tmpl-btn').forEach(b => {
        b.style.borderColor = 'var(--border)';
        b.style.background = '';
      });
      btn.style.borderColor = 'var(--accent)';
      btn.style.background = 'var(--accent-light)';
      showToast(`Applied "${tmpl.label}" template`);
    });
  });

  backdrop.querySelector('[data-action="teams"]').addEventListener('click', () => {
    const emails = backdrop.querySelector('#notify-emails').value.trim();
    const body = backdrop.querySelector('#notify-body').value.trim();
    if (!emails) { showToast('Please enter at least one email.', 'danger'); return; }
    const link = buildTeamsLink(emails, body);
    window.open(link, '_blank');
    showToast('Opening MS Teams...', 'success');
  });

  backdrop.querySelector('[data-action="email"]').addEventListener('click', () => {
    const emails = backdrop.querySelector('#notify-emails').value.trim();
    const subject = backdrop.querySelector('#notify-subject').value.trim();
    const body = backdrop.querySelector('#notify-body').value.trim();
    const bcc = backdrop.querySelector('#notify-bcc').value.trim();
    if (!emails) { showToast('Please enter at least one email.', 'danger'); return; }
    const link = buildMailtoLink(emails, subject, body, bcc);
    window.open(link, '_self');
    showToast('Opening email client...', 'success');
  });
}

/* ── Utilities ── */
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return (s || '').replace(/"/g, '&quot;'); }
