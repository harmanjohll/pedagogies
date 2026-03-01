/*
 * Co-Cher Admin Module
 * ====================
 * Event planning, RAMS, bus booking, parent/teacher notifications, AOR, and more.
 * Designed for Singapore school operations — select what you need, deselect what you don't.
 */

import { Store, generateId } from '../state.js';
import { showToast } from '../components/toast.js';
import { openModal } from '../components/modals.js';

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
    externalLink: { url: 'https://go.gov.sg/btybus', label: 'Open Bus Booking Form' },
    fields: [
      { id: 'pickup_point', label: 'Pick-up Point', type: 'text', placeholder: 'e.g. School Main Gate' },
      { id: 'destination', label: 'Destination', type: 'text', placeholder: 'e.g. Singapore Science Centre' },
      { id: 'departure_time', label: 'Departure Time', type: 'text', placeholder: 'e.g. 8:00 AM' },
      { id: 'return_time', label: 'Expected Return', type: 'text', placeholder: 'e.g. 1:00 PM' },
      { id: 'num_buses', label: 'Number of Buses', type: 'text', placeholder: 'e.g. 2' },
      { id: 'bus_company', label: 'Bus Company', type: 'text', placeholder: 'e.g. SBS Transit Charter' },
      { id: 'special_needs', label: 'Special Requirements', type: 'textarea', placeholder: 'Wheelchair access, extra luggage space, etc.' }
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
    key: 'aor',
    label: 'Approval of Request (AOR)',
    desc: 'Submit finance-related approval for activity costs.',
    icon: '💰',
    externalLink: { url: 'https://go.gov.sg/btyaor', label: 'Open AOR Form' },
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
  { key: 'quick_aor', label: 'Quick AOR', desc: 'Submit a standalone Approval of Request for purchases or services.', icon: '📄' },
  { key: 'relief_timetable', label: 'Relief Timetable', desc: 'Plan teacher relief assignments when staff are away.', icon: '🔄', href: 'btyrelief/relief.html' },
  { key: 'org_chart', label: 'Org Chart', desc: 'View and edit the school organisational chart.', icon: '🏢', href: 'btyrelief/orgstruc.html' },
  { key: 'framework', label: 'Framework Builder', desc: 'Create cycle-arrow diagrams for frameworks and processes.', icon: '🔃', href: 'btyrelief/framework.html' },
  { key: 'inventory', label: 'Resource Inventory', desc: 'Track department resources, equipment, and consumables.', icon: '📦' },
  { key: 'calendar', label: 'Department Calendar', desc: 'View and plan department events, deadlines, and milestones.', icon: '📅' }
];

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
      window.open(tool.href, '_blank');
    } else if (tool?.key === 'quick_aor') {
      showQuickAOR();
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

/* ══════════ New Event Modal ══════════ */
function showNewEventModal(container) {
  const { backdrop, close } = openModal({
    title: 'New Event / Activity',
    body: `
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
        <label class="input-label">Required Tasks</label>
        <p style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-2);">All tasks are selected by default. Deselect what you don't need.</p>
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
      <button class="btn btn-primary" data-action="create">Create Event</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="create"]').addEventListener('click', () => {
    const name = backdrop.querySelector('#event-name').value.trim();
    if (!name) { showToast('Please enter an event name.', 'danger'); return; }

    const date = backdrop.querySelector('#event-date').value;
    const eventType = backdrop.querySelector('#event-type').value;
    const checks = [...backdrop.querySelectorAll('.event-task-check')];
    const tasks = EVENT_TASKS.map(t => ({
      key: t.key,
      enabled: checks.find(c => c.value === t.key)?.checked || false,
      status: 'pending',
      data: {}
    }));

    const event = {
      id: generateId(),
      name,
      date,
      eventType,
      status: 'planning',
      tasks,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const events = [...(Store.get('adminEvents') || []), event];
    Store.set('adminEvents', events);
    showToast(`Event "${name}" created!`, 'success');
    close();
    render(container);
  });

  setTimeout(() => backdrop.querySelector('#event-name')?.focus(), 100);
}

/* ══════════ Event Detail View ══════════ */
function showEventDetail(pageContainer, ev) {
  const events = Store.get('adminEvents') || [];
  const enabledTasks = ev.tasks.filter(t => t.enabled);

  pageContainer.innerHTML = `
    <div style="margin-bottom:var(--sp-6);">
      <button class="btn btn-ghost btn-sm" id="back-to-admin">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        Back to Admin
      </button>
    </div>

    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:var(--sp-6);">
      <div>
        <h1 class="page-title">${esc(ev.name)}</h1>
        <p class="page-subtitle">${ev.date ? ev.date + ' · ' : ''}${ev.eventType || 'Activity'}</p>
      </div>
      <div style="display:flex;gap:var(--sp-2);">
        <button class="btn btn-secondary btn-sm" id="delete-event-btn">Delete</button>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:var(--sp-4);" id="task-panels">
      ${enabledTasks.map(task => {
        const tmpl = EVENT_TASKS.find(et => et.key === task.key);
        if (!tmpl) return '';
        const isComplete = task.status === 'completed';

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
                <span class="badge ${isComplete ? 'badge-green' : 'badge-gray'} badge-dot">${isComplete ? 'Done' : 'Pending'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" class="task-chevron" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div class="task-body" style="display:none;margin-top:var(--sp-4);padding-top:var(--sp-4);border-top:1px solid var(--border-light);">
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
                ${tmpl.externalLink ? `
                  <a href="${tmpl.externalLink.url}" target="_blank" rel="noopener" class="btn btn-sm" style="background:var(--info);color:#fff;text-decoration:none;margin-left:auto;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    ${tmpl.externalLink.label}
                  </a>
                ` : ''}
                ${(task.key === 'parent_notification' || task.key === 'teacher_notification')
                  ? `<button class="btn btn-sm notify-teams-btn" style="background:#6264A7;color:#fff;${tmpl.externalLink ? '' : 'margin-left:auto;'}" data-task-key="${task.key}">
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
      showNotifyModal(ev.name, tmpl?.label || key, recipientType);
    });
  });

  // Email notify buttons
  pageContainer.querySelectorAll('.notify-email-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.taskKey;
      const recipientType = key === 'parent_notification' ? 'parent' : 'teacher';
      const tmpl = EVENT_TASKS.find(et => et.key === key);
      showNotifyModal(ev.name, tmpl?.label || key, recipientType);
    });
  });
}

/* ══════════ Quick AOR (standalone) ══════════ */
function showQuickAOR() {
  const { backdrop, close } = openModal({
    title: 'Quick Approval of Request (AOR)',
    body: `
      <div class="input-group">
        <label class="input-label">Description</label>
        <input class="input" id="aor-desc" placeholder="e.g. Purchase of calculators for Math Dept" />
      </div>
      <div class="input-group">
        <label class="input-label">Budget Code</label>
        <input class="input" id="aor-code" placeholder="e.g. SC-MATH-2026" />
      </div>
      <div class="input-group">
        <label class="input-label">Estimated Cost ($)</label>
        <input class="input" id="aor-cost" placeholder="e.g. 350.00" />
      </div>
      <div class="input-group">
        <label class="input-label">Funding Source</label>
        <select class="input" id="aor-source">
          <option value="School Budget">School Budget</option>
          <option value="Department Budget">Department Budget</option>
          <option value="MOE Grant">MOE Grant</option>
          <option value="Student Fee">Student Fee</option>
          <option value="External Sponsor">External Sponsor</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Approving Officer</label>
        <input class="input" id="aor-approver" placeholder="e.g. HOD Mathematics" />
      </div>
      <div class="input-group">
        <label class="input-label">Justification</label>
        <textarea class="input" id="aor-justification" rows="3" placeholder="Why is this purchase needed?"></textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="submit">Submit AOR</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="submit"]').addEventListener('click', () => {
    const desc = backdrop.querySelector('#aor-desc').value.trim();
    if (!desc) { showToast('Please enter a description.', 'danger'); return; }
    const cost = backdrop.querySelector('#aor-cost').value.trim();
    const code = backdrop.querySelector('#aor-code').value.trim();
    const source = backdrop.querySelector('#aor-source').value;
    const approver = backdrop.querySelector('#aor-approver').value.trim();
    const justification = backdrop.querySelector('#aor-justification').value.trim();

    // Save to state
    const aors = Store.get('adminAORs') || [];
    aors.push({
      id: generateId(),
      desc, cost, code, source, approver, justification,
      status: 'pending',
      createdAt: Date.now()
    });
    Store.set('adminAORs', aors);

    showToast('AOR submitted successfully!', 'success');
    close();
  });
}

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

/**
 * Show a Notify modal for an event task, letting the user send via Teams or Email.
 */
function showNotifyModal(eventName, taskLabel, recipientType) {
  const { backdrop, close } = openModal({
    title: `Notify — ${taskLabel}`,
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);">
        Send a notification about <strong>${esc(eventName)}</strong> via MS Teams or Email.
      </p>
      <div class="input-group">
        <label class="input-label">Recipient Email(s)</label>
        <input class="input" id="notify-emails" placeholder="e.g. teacher@school.edu.sg, teacher2@school.edu.sg" />
        <span style="font-size:0.6875rem;color:var(--ink-faint);">Comma-separated for multiple recipients</span>
      </div>
      <div class="input-group">
        <label class="input-label">Subject</label>
        <input class="input" id="notify-subject" value="${escAttr(eventName + ' — ' + taskLabel)}" />
      </div>
      <div class="input-group">
        <label class="input-label">Message</label>
        <textarea class="input" id="notify-body" rows="5" placeholder="Type your message here...">${recipientType === 'parent' ? `Dear Parents/Guardians,\n\nPlease be informed about the upcoming event: ${eventName}.\n\nDetails will be shared via Parents Gateway.\n\nThank you.` : `Dear Colleague,\n\nPlease be informed about the upcoming event: ${eventName}.\n\nKindly note the affected periods and make the necessary arrangements.\n\nThank you.`}</textarea>
      </div>
      <div class="input-group">
        <label class="input-label">BCC (optional)</label>
        <input class="input" id="notify-bcc" placeholder="e.g. admin@school.edu.sg" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="teams" style="background:#6264A7;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.24 4.76A7.42 7.42 0 0 0 14 2.5c-2.03 0-3.93.8-5.36 2.26A7.51 7.51 0 0 0 6.5 10c0 2.03.78 3.93 2.14 5.36l5.36 5.36 5.24-5.24A7.58 7.58 0 0 0 21.5 10c0-2.03-.8-3.93-2.26-5.24z"/></svg>
        Send via Teams
      </button>
      <button class="btn btn-primary" data-action="email">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Send via Email
      </button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);

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
