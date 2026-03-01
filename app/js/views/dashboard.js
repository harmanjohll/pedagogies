/*
 * Co-Cher Dashboard
 * =================
 * Home view with greeting, quick actions, and overview.
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

export function render(container) {
  const classes = Store.getClasses();
  const lessons = Store.getLessons();
  const activity = Store.getRecentActivity();

  const totalStudents = classes.reduce((sum, c) => sum + (c.students?.length || 0), 0);

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">

        <!-- Greeting -->
        <div class="greeting-card animate-fade-in-up">
          <div class="greeting-title">${getGreeting()}, Cher!</div>
          <div class="greeting-subtitle">
            What would you like to create today? Design a lesson, explore spatial arrangements, or manage your classes.
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="section-header">
          <h2 class="section-title" style="font-size: 1.125rem;">Quick Actions</h2>
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

          <div class="action-card" data-action="knowledge">
            <div class="action-card-icon" style="background: var(--info-light); color: var(--info);">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>
            </div>
            <div class="action-card-title">Knowledge Base</div>
            <div class="action-card-desc">Explore E21CC, STP, and EdTech frameworks</div>
          </div>
        </div>

        <!-- Stats -->
        <div class="grid-3 stagger" style="margin-bottom: var(--sp-8);">
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
        </div>

        <!-- Two Column: Classes + Activity -->
        <div class="grid-2" style="margin-bottom: var(--sp-8);">

          <!-- Classes Overview -->
          <div>
            <div class="section-header">
              <h2 class="section-title" style="font-size: 1.125rem;">Your Classes</h2>
              ${classes.length > 0 ? `<button class="btn btn-ghost btn-sm" data-action="classes">View all</button>` : ''}
            </div>
            ${classes.length === 0 ? `
              <div class="card" style="text-align: center; padding: var(--sp-8) var(--sp-6);">
                <div style="font-size: 2rem; margin-bottom: var(--sp-3); opacity: 0.3;">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                </div>
                <p style="color: var(--ink-muted); font-size: 0.875rem; margin-bottom: var(--sp-4);">
                  No classes yet. Create your first class to get started.
                </p>
                <button class="btn btn-primary btn-sm" data-action="add-class">Create a Class</button>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: var(--sp-3);">
                ${classes.slice(0, 4).map(cls => `
                  <div class="card card-hover card-interactive" data-class-id="${cls.id}" style="padding: var(--sp-4) var(--sp-5);">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                      <div>
                        <div style="font-weight: 600; color: var(--ink);">${cls.name}</div>
                        <div style="font-size: 0.8125rem; color: var(--ink-muted); margin-top: 2px;">
                          ${[cls.level, cls.subject].filter(Boolean).join(' · ') || 'No details'}
                        </div>
                      </div>
                      <div style="display: flex; gap: var(--sp-2);">
                        <span class="badge badge-blue">${cls.students?.length || 0} students</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Recent Activity -->
          <div>
            <div class="section-header">
              <h2 class="section-title" style="font-size: 1.125rem;">Recent Activity</h2>
            </div>
            ${activity.length === 0 ? `
              <div class="card" style="text-align: center; padding: var(--sp-8) var(--sp-6);">
                <div style="font-size: 2rem; margin-bottom: var(--sp-3); opacity: 0.3;">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:inline;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <p style="color: var(--ink-muted); font-size: 0.875rem;">
                  Your activity will appear here as you use Co-Cher.
                </p>
              </div>
            ` : `
              <div class="card" style="padding: 0;">
                <div style="display: flex; flex-direction: column;">
                  ${activity.slice(0, 6).map(a => `
                    <div style="padding: var(--sp-3) var(--sp-5); border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between;">
                      <span style="font-size: 0.8125rem; color: var(--ink-secondary);">${a.description}</span>
                      <span style="font-size: 0.75rem; color: var(--ink-faint); white-space: nowrap; margin-left: var(--sp-3);">${timeAgo(a.timestamp)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `}
          </div>
        </div>

      </div>
    </div>
  `;

  // Quick action handlers
  const actions = {
    'lesson-planner': () => navigate('/lesson-planner'),
    'spatial': () => navigate('/spatial'),
    'classes': () => navigate('/classes'),
    'knowledge': () => navigate('/knowledge'),
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
}
