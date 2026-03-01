/*
 * Co-Cher Dashboard
 * =================
 * Context-aware landing page — "What would you like to do?"
 * Surfaces smart suggestions, admin tasks, and recent lessons.
 */

import { Store } from '../state.js';
import { navigate } from '../router.js';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── Build smart suggestions based on app state ── */
function buildSuggestions(classes, lessons, events) {
  const suggestions = [];

  // Draft lessons to finish
  const drafts = lessons.filter(l => l.status === 'draft');
  if (drafts.length > 0) {
    const latest = drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      color: 'var(--accent)',
      bg: 'var(--accent-light)',
      title: `Continue "${latest.title || 'Untitled'}"`,
      desc: `Draft lesson — ${latest.chatHistory?.length || 0} exchanges so far`,
      action: () => navigate(`/lesson-planner/${latest.id}`)
    });
  }

  // Classes without lessons
  const classesWithoutLessons = classes.filter(cls =>
    !lessons.some(l => l.classId === cls.id)
  );
  if (classesWithoutLessons.length > 0) {
    const cls = classesWithoutLessons[0];
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
      color: 'var(--warning)',
      bg: 'var(--warning-light)',
      title: `Plan a lesson for ${cls.name}`,
      desc: `${cls.students?.length || 0} students — no lessons linked yet`,
      action: () => navigate('/lesson-planner')
    });
  }

  // Upcoming/incomplete admin events
  const pendingEvents = events.filter(e => e.status !== 'completed');
  if (pendingEvents.length > 0) {
    const ev = pendingEvents[0];
    const enabled = ev.tasks.filter(t => t.enabled);
    const done = enabled.filter(t => t.status === 'completed').length;
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      color: 'var(--info)',
      bg: 'var(--info-light)',
      title: `${ev.name} — ${done}/${enabled.length} tasks done`,
      desc: `${ev.eventType || 'Event'}${ev.date ? ' · ' + ev.date : ''}`,
      action: () => navigate('/admin')
    });
  }

  // E21CC weak area to focus on
  if (classes.length > 0) {
    let totals = { cait: 0, cci: 0, cgc: 0 }, count = 0;
    classes.forEach(cls => (cls.students || []).forEach(s => {
      if (s.e21cc) {
        totals.cait += s.e21cc.cait || 0;
        totals.cci += s.e21cc.cci || 0;
        totals.cgc += s.e21cc.cgc || 0;
        count++;
      }
    }));
    if (count > 0) {
      const avgs = { cait: totals.cait / count, cci: totals.cci / count, cgc: totals.cgc / count };
      const weakest = Object.entries(avgs).sort((a, b) => a[1] - b[1])[0];
      const names = { cait: 'CAIT (Critical & Inventive Thinking)', cci: 'CCI (Communication & Collaboration)', cgc: 'CGC (Civic & Global Citizenship)' };
      if (weakest[1] < 60) {
        suggestions.push({
          icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>`,
          color: 'var(--success)',
          bg: 'var(--success-light)',
          title: `Boost ${weakest[0].toUpperCase()} across your classes`,
          desc: `${names[weakest[0]]} avg: ${Math.round(weakest[1])}/100`,
          action: () => navigate('/lesson-planner')
        });
      }
    }
  }

  // No classes yet
  if (classes.length === 0) {
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      color: 'var(--warning)',
      bg: 'var(--warning-light)',
      title: 'Create your first class',
      desc: 'Add a class with students to unlock E21CC tracking',
      action: () => navigate('/classes')
    });
  }

  // No lessons at all
  if (lessons.length === 0 && classes.length > 0) {
    suggestions.push({
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
      color: 'var(--accent)',
      bg: 'var(--accent-light)',
      title: 'Design your first lesson',
      desc: 'Chat with Co-Cher to create an E21CC-aligned lesson plan',
      action: () => navigate('/lesson-planner')
    });
  }

  return suggestions.slice(0, 4);
}

function renderInsights(classes, lessons) {
  let totalCait = 0, totalCci = 0, totalCgc = 0, count = 0;
  classes.forEach(cls => {
    (cls.students || []).forEach(s => {
      if (s.e21cc) {
        totalCait += s.e21cc.cait || 0;
        totalCci += s.e21cc.cci || 0;
        totalCgc += s.e21cc.cgc || 0;
        count++;
      }
    });
  });

  const avgCait = count > 0 ? Math.round(totalCait / count) : 0;
  const avgCci = count > 0 ? Math.round(totalCci / count) : 0;
  const avgCgc = count > 0 ? Math.round(totalCgc / count) : 0;

  const barColor = (val) => val >= 65 ? 'var(--success)' : val >= 45 ? 'var(--warning)' : 'var(--danger)';

  const focusCounts = { cait: 0, cci: 0, cgc: 0 };
  lessons.forEach(l => {
    (l.e21ccFocus || []).forEach(f => { if (focusCounts[f] !== undefined) focusCounts[f]++; });
  });
  const totalFocus = focusCounts.cait + focusCounts.cci + focusCounts.cgc;

  let strongest = null, weakest = null, maxAvg = -1, minAvg = 101;
  classes.forEach(cls => {
    const students = cls.students || [];
    if (students.length === 0) return;
    const avg = students.reduce((s, st) => {
      const e = st.e21cc || {};
      return s + ((e.cait || 0) + (e.cci || 0) + (e.cgc || 0)) / 3;
    }, 0) / students.length;
    if (avg > maxAvg) { maxAvg = avg; strongest = cls; }
    if (avg < minAvg) { minAvg = avg; weakest = cls; }
  });

  return `
    <div style="margin-bottom:var(--sp-8);">
      <div class="section-header">
        <h2 class="section-title" style="font-size:1.125rem;">Teaching Insights</h2>
      </div>
      <div class="grid-2 stagger">
        <!-- E21CC Overview -->
        <div class="card" style="padding:var(--sp-5) var(--sp-6);">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-4);">E21CC Averages (All Students)</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px;">
                <span style="font-weight:600;color:var(--ink);">CAIT</span>
                <span style="color:var(--ink-muted);">${avgCait}/100</span>
              </div>
              <div style="height:8px;background:var(--bg-subtle);border-radius:var(--radius-full);overflow:hidden;">
                <div style="width:${avgCait}%;height:100%;background:${barColor(avgCait)};border-radius:var(--radius-full);transition:width 0.6s;"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px;">
                <span style="font-weight:600;color:var(--ink);">CCI</span>
                <span style="color:var(--ink-muted);">${avgCci}/100</span>
              </div>
              <div style="height:8px;background:var(--bg-subtle);border-radius:var(--radius-full);overflow:hidden;">
                <div style="width:${avgCci}%;height:100%;background:${barColor(avgCci)};border-radius:var(--radius-full);transition:width 0.6s;"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:4px;">
                <span style="font-weight:600;color:var(--ink);">CGC</span>
                <span style="color:var(--ink-muted);">${avgCgc}/100</span>
              </div>
              <div style="height:8px;background:var(--bg-subtle);border-radius:var(--radius-full);overflow:hidden;">
                <div style="width:${avgCgc}%;height:100%;background:${barColor(avgCgc)};border-radius:var(--radius-full);transition:width 0.6s;"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Quick Insights -->
        <div class="card" style="padding:var(--sp-5) var(--sp-6);">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--ink-muted);margin-bottom:var(--sp-4);">Quick Insights</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-3);font-size:0.8125rem;">
            ${strongest ? `<div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--success);font-size:1rem;">&#9650;</span>
              <span style="color:var(--ink-secondary);"><strong>${strongest.name}</strong> has the highest overall E21CC average (${Math.round(maxAvg)})</span>
            </div>` : ''}
            ${weakest && weakest !== strongest ? `<div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--warning);font-size:1rem;">&#9660;</span>
              <span style="color:var(--ink-secondary);"><strong>${weakest.name}</strong> could benefit from more E21CC focus (avg: ${Math.round(minAvg)})</span>
            </div>` : ''}
            ${totalFocus > 0 ? `<div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--accent);font-size:1rem;">&#9679;</span>
              <span style="color:var(--ink-secondary);">Lesson focus: CAIT (${focusCounts.cait}), CCI (${focusCounts.cci}), CGC (${focusCounts.cgc})</span>
            </div>` : ''}
            <div style="display:flex;align-items:center;gap:var(--sp-2);">
              <span style="color:var(--ink-faint);font-size:1rem;">&#9679;</span>
              <span style="color:var(--ink-secondary);">${count} students across ${classes.length} class${classes.length !== 1 ? 'es' : ''}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

export function render(container) {
  const classes = Store.getClasses();
  const lessons = Store.getLessons();
  const activity = Store.getRecentActivity();
  const events = Store.get('adminEvents') || [];
  const totalStudents = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0);

  const suggestions = buildSuggestions(classes, lessons, events);

  // Recent lessons (last 3 updated)
  const recentLessons = [...lessons]
    .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))
    .slice(0, 3);

  // Admin events summary
  const pendingEvents = events.filter(e => e.status !== 'completed');

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">

        <!-- Greeting -->
        <div class="greeting-card animate-fade-in-up">
          <div class="greeting-title">${getGreeting()}, Cher!</div>
          <div class="greeting-subtitle">What would you like to do today?</div>
        </div>

        <!-- Smart Suggestions -->
        ${suggestions.length > 0 ? `
          <div style="margin-bottom:var(--sp-8);">
            <div class="section-header">
              <h2 class="section-title" style="font-size:1.125rem;">Suggested for You</h2>
            </div>
            <div class="stagger" style="display:flex;flex-direction:column;gap:var(--sp-3);">
              ${suggestions.map(s => `
                <div class="card card-hover card-interactive suggestion-card" style="padding:var(--sp-4) var(--sp-5);">
                  <div style="display:flex;align-items:center;gap:var(--sp-4);">
                    <div style="width:40px;height:40px;border-radius:var(--radius-lg);background:${s.bg};color:${s.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                      ${s.icon}
                    </div>
                    <div style="flex:1;min-width:0;">
                      <div style="font-weight:600;color:var(--ink);font-size:0.9375rem;">${s.title}</div>
                      <div style="font-size:0.8125rem;color:var(--ink-muted);margin-top:2px;">${s.desc}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="2" style="flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Quick Actions -->
        <div class="section-header">
          <h2 class="section-title" style="font-size:1.125rem;">Quick Actions</h2>
        </div>
        <div class="grid-4 stagger" style="margin-bottom: var(--sp-8);">
          <div class="action-card" data-action="lesson-planner">
            <div class="action-card-icon" style="background: var(--accent-light); color: var(--accent);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </div>
            <div class="action-card-title">Lesson Planner</div>
            <div class="action-card-desc">Chat with Co-Cher to design engaging lessons</div>
          </div>

          <div class="action-card" data-action="spatial">
            <div class="action-card-icon" style="background: var(--success-light); color: var(--success);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
            <div class="action-card-title">Spatial Designer</div>
            <div class="action-card-desc">Arrange your classroom for optimal learning</div>
          </div>

          <div class="action-card" data-action="classes">
            <div class="action-card-icon" style="background: var(--warning-light); color: var(--warning);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="action-card-title">Manage Classes</div>
            <div class="action-card-desc">Add classes, students, and track E21CC growth</div>
          </div>

          <div class="action-card" data-action="admin">
            <div class="action-card-icon" style="background: var(--info-light); color: var(--info);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="action-card-title">Admin</div>
            <div class="action-card-desc">Events, RAMS, approvals & school operations</div>
          </div>
        </div>

        <!-- Stats Row -->
        <div class="grid-4 stagger" style="margin-bottom: var(--sp-8);">
          <div class="stat-card">
            <div class="stat-label">Classes</div>
            <div class="stat-value">${classes.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Students</div>
            <div class="stat-value">${totalStudents}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Lessons</div>
            <div class="stat-value">${lessons.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Events</div>
            <div class="stat-value">${events.length}</div>
          </div>
        </div>

        <!-- Teaching Insights -->
        ${totalStudents > 0 ? renderInsights(classes, lessons) : ''}

        <!-- Three Column: Recent Lessons + Admin Events + Activity -->
        <div class="grid-3" style="margin-bottom: var(--sp-8);">

          <!-- Recent Lessons -->
          <div>
            <div class="section-header">
              <h2 class="section-title" style="font-size:1.125rem;">Recent Lessons</h2>
              ${lessons.length > 0 ? `<button class="btn btn-ghost btn-sm" data-action="lessons">View all</button>` : ''}
            </div>
            ${recentLessons.length === 0 ? `
              <div class="card" style="text-align:center;padding:var(--sp-6);">
                <div style="opacity:0.3;margin-bottom:var(--sp-3);">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <p style="color:var(--ink-muted);font-size:0.8125rem;margin-bottom:var(--sp-3);">No lessons yet.</p>
                <button class="btn btn-primary btn-sm" data-action="lesson-planner">Start Planning</button>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
                ${recentLessons.map(l => {
                  const statusBadge = l.status === 'completed' ? 'badge-green' :
                                      l.status === 'ready' ? 'badge-blue' : 'badge-gray';
                  const statusLabel = l.status === 'completed' ? 'Done' :
                                      l.status === 'ready' ? 'Ready' : 'Draft';
                  const linkedClass = l.classId ? classes.find(c => c.id === l.classId) : null;
                  return `
                    <div class="card card-hover card-interactive" data-lesson-id="${l.id}" style="padding:var(--sp-4) var(--sp-5);">
                      <div style="display:flex;align-items:center;justify-content:space-between;">
                        <div style="min-width:0;flex:1;">
                          <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l.title || 'Untitled'}</div>
                          <div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;">
                            ${linkedClass ? linkedClass.name + ' · ' : ''}${timeAgo(l.updatedAt || l.createdAt)}
                          </div>
                        </div>
                        <span class="badge ${statusBadge} badge-dot" style="flex-shrink:0;margin-left:var(--sp-2);">${statusLabel}</span>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Admin Events -->
          <div>
            <div class="section-header">
              <h2 class="section-title" style="font-size:1.125rem;">Events</h2>
              <button class="btn btn-ghost btn-sm" data-action="admin">Admin</button>
            </div>
            ${pendingEvents.length === 0 ? `
              <div class="card" style="text-align:center;padding:var(--sp-6);">
                <div style="opacity:0.3;margin-bottom:var(--sp-3);">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <p style="color:var(--ink-muted);font-size:0.8125rem;margin-bottom:var(--sp-3);">No upcoming events.</p>
                <button class="btn btn-primary btn-sm" data-action="admin">Plan an Event</button>
              </div>
            ` : `
              <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
                ${pendingEvents.slice(0, 3).map(ev => {
                  const enabled = ev.tasks.filter(t => t.enabled);
                  const done = enabled.filter(t => t.status === 'completed').length;
                  const progress = enabled.length > 0 ? Math.round((done / enabled.length) * 100) : 0;
                  return `
                    <div class="card card-hover card-interactive" data-action="admin" style="padding:var(--sp-4) var(--sp-5);">
                      <div style="font-weight:600;color:var(--ink);font-size:0.875rem;margin-bottom:var(--sp-1);">${ev.name}</div>
                      <div style="font-size:0.75rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">${ev.eventType || 'Event'}${ev.date ? ' · ' + ev.date : ''}</div>
                      <div style="display:flex;align-items:center;gap:var(--sp-2);">
                        <div style="flex:1;height:5px;background:var(--bg-subtle);border-radius:var(--radius-full);overflow:hidden;">
                          <div style="width:${progress}%;height:100%;background:${progress === 100 ? 'var(--success)' : 'var(--accent)'};border-radius:var(--radius-full);transition:width 0.3s;"></div>
                        </div>
                        <span style="font-size:0.6875rem;color:var(--ink-muted);white-space:nowrap;">${done}/${enabled.length}</span>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            `}
          </div>

          <!-- Recent Activity -->
          <div>
            <div class="section-header">
              <h2 class="section-title" style="font-size:1.125rem;">Activity</h2>
            </div>
            ${activity.length === 0 ? `
              <div class="card" style="text-align:center;padding:var(--sp-6);">
                <div style="opacity:0.3;margin-bottom:var(--sp-3);">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <p style="color:var(--ink-muted);font-size:0.8125rem;">Activity will appear here as you use Co-Cher.</p>
              </div>
            ` : `
              <div class="card" style="padding:0;">
                <div style="display:flex;flex-direction:column;">
                  ${activity.slice(0, 6).map(a => `
                    <div style="padding:var(--sp-3) var(--sp-4);border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
                      <span style="font-size:0.8125rem;color:var(--ink-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${a.description}</span>
                      <span style="font-size:0.6875rem;color:var(--ink-faint);white-space:nowrap;margin-left:var(--sp-2);">${timeAgo(a.timestamp)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `}
          </div>
        </div>

        <!-- Classes Overview -->
        <div style="margin-bottom:var(--sp-8);">
          <div class="section-header">
            <h2 class="section-title" style="font-size:1.125rem;">Your Classes</h2>
            ${classes.length > 0 ? `<button class="btn btn-ghost btn-sm" data-action="classes">View all</button>` : ''}
          </div>
          ${classes.length === 0 ? `
            <div class="card" style="text-align:center;padding:var(--sp-8) var(--sp-6);">
              <div style="opacity:0.3;margin-bottom:var(--sp-3);">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <p style="color:var(--ink-muted);font-size:0.875rem;margin-bottom:var(--sp-4);">No classes yet. Create your first class to get started.</p>
              <button class="btn btn-primary btn-sm" data-action="add-class">Create a Class</button>
            </div>
          ` : `
            <div class="grid-3 stagger">
              ${classes.slice(0, 6).map(cls => `
                <div class="card card-hover card-interactive" data-class-id="${cls.id}" style="padding:var(--sp-4) var(--sp-5);">
                  <div style="display:flex;align-items:center;justify-content:space-between;">
                    <div>
                      <div style="font-weight:600;color:var(--ink);">${cls.name}</div>
                      <div style="font-size:0.8125rem;color:var(--ink-muted);margin-top:2px;">
                        ${[cls.level, cls.subject].filter(Boolean).join(' · ') || 'No details'}
                      </div>
                    </div>
                    <span class="badge badge-blue">${cls.students?.length || 0} students</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>
    </div>
  `;

  // Quick action and navigation handlers
  const actions = {
    'lesson-planner': () => navigate('/lesson-planner'),
    'spatial': () => navigate('/spatial'),
    'classes': () => navigate('/classes'),
    'knowledge': () => navigate('/knowledge'),
    'admin': () => navigate('/admin'),
    'lessons': () => navigate('/lessons'),
    'add-class': () => navigate('/classes')
  };

  container.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      if (actions[action]) actions[action]();
    });
  });

  // Class card clicks
  container.querySelectorAll('[data-class-id]').forEach(el => {
    el.addEventListener('click', () => navigate(`/classes/${el.dataset.classId}`));
  });

  // Lesson card clicks
  container.querySelectorAll('[data-lesson-id]').forEach(el => {
    el.addEventListener('click', () => navigate(`/lesson-planner/${el.dataset.lessonId}`));
  });

  // Smart suggestion clicks
  container.querySelectorAll('.suggestion-card').forEach((el, i) => {
    el.addEventListener('click', () => {
      if (suggestions[i]?.action) suggestions[i].action();
    });
  });
}
