/*
 * Co-Cher Lessons List (Stub)
 * ============================
 * Persistent lesson records — coming in Phase 3.
 */

import { navigate } from '../router.js';

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width: 640px;">
        <div style="text-align: center; padding: var(--sp-16) 0;">

          <div style="
            width: 72px; height: 72px; margin: 0 auto var(--sp-6);
            background: var(--info-light); border-radius: var(--radius-xl);
            display: flex; align-items: center; justify-content: center;
            color: var(--info);
            animation: float 3s ease-in-out infinite;
          ">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>

          <h1 class="text-h1" style="margin-bottom: var(--sp-2);">Lesson Library</h1>
          <p style="font-size: 1rem; color: var(--ink-muted); line-height: 1.7; max-width: 420px; margin: 0 auto var(--sp-6);">
            Soon you'll be able to save, organise, and revisit your lesson plans here. Link them to classes, track completion, and add post-lesson reflections.
          </p>

          <div style="display: flex; gap: var(--sp-3); justify-content: center; flex-wrap: wrap; margin-bottom: var(--sp-6);">
            <span class="badge badge-blue badge-dot">Save plans</span>
            <span class="badge badge-green badge-dot">Link to classes</span>
            <span class="badge badge-amber badge-dot">Track status</span>
            <span class="badge badge-violet badge-dot">Reflect & improve</span>
          </div>

          <button class="btn btn-primary" id="go-planner">Start Planning a Lesson</button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#go-planner')?.addEventListener('click', () => navigate('/lesson-planner'));
}
