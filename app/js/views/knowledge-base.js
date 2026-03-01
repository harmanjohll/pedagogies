/*
 * Co-Cher Knowledge Base (Stub)
 * ==============================
 * Searchable framework reference — coming in Phase 5.
 */

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container">
        <div class="page-header">
          <div>
            <h1 class="page-title">Knowledge Base</h1>
            <p class="page-subtitle">Explore Singapore MOE frameworks and pedagogical references.</p>
          </div>
        </div>

        <div class="grid-3 stagger">
          <!-- E21CC -->
          <div class="card" style="border-top: 3px solid var(--e21cc-cait);">
            <div style="
              width: 44px; height: 44px; margin-bottom: var(--sp-4);
              background: var(--e21cc-cait-light); border-radius: var(--radius-lg);
              display: flex; align-items: center; justify-content: center;
              color: var(--e21cc-cait); font-weight: 700; font-size: 0.8rem;
            ">E21</div>
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-2);">E21CC Framework</h3>
            <p style="font-size: 0.8125rem; color: var(--ink-muted); line-height: 1.6; margin-bottom: var(--sp-4);">
              21st Century Competencies — CAIT, CCI, CGC domains, Core Values, and SEL outcomes for holistic student development.
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: var(--sp-1);">
              <span class="badge badge-blue">CAIT</span>
              <span class="badge badge-blue">CCI</span>
              <span class="badge badge-blue">CGC</span>
              <span class="badge badge-blue">Core Values</span>
              <span class="badge badge-blue">SEL</span>
            </div>
          </div>

          <!-- STP -->
          <div class="card" style="border-top: 3px solid var(--e21cc-cci);">
            <div style="
              width: 44px; height: 44px; margin-bottom: var(--sp-4);
              background: var(--e21cc-cci-light); border-radius: var(--radius-lg);
              display: flex; align-items: center; justify-content: center;
              color: var(--e21cc-cci); font-weight: 700; font-size: 0.8rem;
            ">STP</div>
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-2);">Singapore Teaching Practice</h3>
            <p style="font-size: 0.8125rem; color: var(--ink-muted); line-height: 1.6; margin-bottom: var(--sp-4);">
              Four key processes — Lesson Preparation, Enactment, Monitoring & Providing Feedback, and Professional Mastery.
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: var(--sp-1);">
              <span class="badge badge-green">Preparation</span>
              <span class="badge badge-green">Enactment</span>
              <span class="badge badge-green">Feedback</span>
              <span class="badge badge-green">Mastery</span>
            </div>
          </div>

          <!-- EdTech -->
          <div class="card" style="border-top: 3px solid var(--e21cc-cgc);">
            <div style="
              width: 44px; height: 44px; margin-bottom: var(--sp-4);
              background: var(--e21cc-cgc-light); border-radius: var(--radius-lg);
              display: flex; align-items: center; justify-content: center;
              color: var(--e21cc-cgc); font-weight: 700; font-size: 0.8rem;
            ">EdT</div>
            <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: var(--sp-2);">EdTech Masterplan 2030</h3>
            <p style="font-size: 0.8125rem; color: var(--ink-muted); line-height: 1.6; margin-bottom: var(--sp-4);">
              Nine digital competencies across three thrusts for meaningful technology-enhanced learning experiences.
            </p>
            <div style="display: flex; flex-wrap: wrap; gap: var(--sp-1);">
              <span class="badge badge-amber">Digital Literacy</span>
              <span class="badge badge-amber">Digital Creation</span>
              <span class="badge badge-amber">Digital Citizenship</span>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: var(--sp-10); padding: var(--sp-8);">
          <p style="color: var(--ink-muted); font-size: 0.875rem; line-height: 1.6; max-width: 480px; margin: 0 auto;">
            Detailed, searchable framework content with practical classroom examples is being prepared. In the meantime, ask Co-Cher about any framework in the Lesson Planner chat.
          </p>
          <span class="badge badge-green badge-dot" style="margin-top: var(--sp-4); display: inline-flex;">Expanding soon</span>
        </div>
      </div>
    </div>
  `;
}
