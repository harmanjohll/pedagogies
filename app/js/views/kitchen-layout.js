/*
 * Kitchen Layout — View
 * =====================
 * Comprehensive kitchen mode for NFS & FCE practical lessons.
 * Features:
 *   - Launch floor plan designer (interactive overlay)
 *   - AI-powered recipe adaptation & nutrition analysis
 *   - Station rotation timer for MasterChef-style lessons
 *   - Shopping list generator
 *   - Lesson integration (connects to saved lessons)
 */

import { openOverlay } from '../components/overlay.js';
import { sendChat } from '../api.js';
import { showToast } from '../components/toast.js';
import { Store } from '../state.js';
import { renderMd, processLatex } from '../utils/latex.js';

/* ── Helpers ── */
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── Timer state ── */
let timerInterval = null;
let timerSeconds = 0;
let timerTarget = 0;
let currentStation = 1;
let totalStations = 4;
let rotationMinutes = 10;

export function render(container) {
  // Get lessons for integration
  const lessons = Store.getLessons().filter(l => {
    const subj = (l.subject || '').toLowerCase();
    return subj.includes('nfs') || subj.includes('fce') || subj.includes('food') || subj.includes('nutrition') || subj.includes('cooking') || subj.includes('home econ');
  });

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:900px;">
        <div class="page-header">
          <div>
            <h1 class="page-title" style="display:flex;align-items:center;gap:10px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#009432" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              Kitchen Layout Planner
            </h1>
            <p class="page-subtitle">MasterChef-style kitchen workstation designer for NFS & FCE practical lessons.</p>
          </div>
        </div>

        <!-- Launch Planner -->
        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <div style="display:flex;gap:var(--sp-5);align-items:flex-start;">
            <div style="flex:1;">
              <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Kitchen Floor Plan Designer</h3>
              <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-bottom:var(--sp-3);">
                Design kitchen layouts for practical lessons. Drag equipment onto the floor plan, place student markers,
                and visualise safety zones and workflow paths. Layouts can be saved and printed.
              </p>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="btn btn-primary" id="launch-kitchen" style="gap:8px;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Launch Kitchen Planner
                </button>
              </div>
            </div>
            <div style="width:160px;height:120px;border-radius:12px;background:linear-gradient(135deg,#009432 0%,#006266 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
          </div>
        </div>

        <!-- Station Rotation Timer -->
        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);display:flex;align-items:center;gap:8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#009432" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Station Rotation Timer
          </h3>
          <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-3);">
            Run timed station rotations for MasterChef-style lessons. Set how many stations and how long each rotation lasts.
          </p>
          <div style="display:flex;gap:16px;align-items:center;margin-bottom:var(--sp-3);flex-wrap:wrap;">
            <div>
              <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Stations</label>
              <select class="input" id="timer-stations" style="width:80px;">
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4" selected>4</option>
                <option value="5">5</option>
                <option value="6">6</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Minutes per station</label>
              <select class="input" id="timer-minutes" style="width:80px;">
                <option value="5">5 min</option>
                <option value="8">8 min</option>
                <option value="10" selected>10 min</option>
                <option value="12">12 min</option>
                <option value="15">15 min</option>
                <option value="20">20 min</option>
              </select>
            </div>
            <div style="display:flex;gap:8px;align-self:flex-end;">
              <button class="btn btn-primary btn-sm" id="timer-start">Start</button>
              <button class="btn btn-ghost btn-sm" id="timer-pause" disabled>Pause</button>
              <button class="btn btn-ghost btn-sm" id="timer-reset">Reset</button>
            </div>
          </div>
          <div id="timer-display" style="text-align:center;padding:var(--sp-4);background:var(--bg-subtle,#f8f9fa);border-radius:10px;">
            <div style="font-size:0.75rem;font-weight:600;color:var(--ink-secondary);margin-bottom:4px;">STATION <span id="timer-station-num">1</span> of <span id="timer-station-total">4</span></div>
            <div id="timer-clock" style="font-size:2.5rem;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:0.02em;">10:00</div>
            <div id="timer-progress" style="margin-top:8px;height:6px;background:var(--border,#e2e5ea);border-radius:3px;overflow:hidden;">
              <div id="timer-bar" style="height:100%;background:#009432;width:0%;border-radius:3px;transition:width 1s linear;"></div>
            </div>
          </div>
        </div>

        <!-- AI Recipe Adaptation -->
        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);display:flex;align-items:center;gap:8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#009432" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            AI Recipe Assistant
          </h3>
          <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-3);">
            Adapt recipes for your class size, generate shopping lists, get nutrition breakdowns, and receive safety reminders.
          </p>
          <div style="display:flex;gap:12px;margin-bottom:var(--sp-3);flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Recipe / Dish</label>
              <input class="input" id="recipe-input" placeholder="e.g. Pasta Aglio e Olio, Chicken Rice, Pancakes..." style="width:100%;">
            </div>
            <div>
              <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Servings</label>
              <input class="input" id="recipe-servings" type="number" value="8" min="1" max="40" style="width:80px;">
            </div>
            <div>
              <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Dietary needs</label>
              <select class="input" id="recipe-dietary">
                <option value="">None</option>
                <option value="halal">Halal</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="gluten-free">Gluten-free</option>
                <option value="dairy-free">Dairy-free</option>
                <option value="nut-free">Nut-free</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:var(--sp-3);">
            <button class="btn btn-primary btn-sm" id="recipe-adapt-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Adapt Recipe
            </button>
            <button class="btn btn-ghost btn-sm" id="recipe-shopping-btn">Shopping List</button>
            <button class="btn btn-ghost btn-sm" id="recipe-nutrition-btn">Nutrition Breakdown</button>
            <button class="btn btn-ghost btn-sm" id="recipe-safety-btn">Safety Reminders</button>
          </div>
          <div id="recipe-output"></div>
        </div>

        <!-- AI Kitchen Lesson Setup -->
        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);display:flex;align-items:center;gap:8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#009432" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            Lesson Setup Guide
          </h3>
          <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-3);">
            Get AI-generated task assignments, team roles, and station setup instructions tailored to your lesson.
          </p>
          <div style="display:flex;gap:12px;margin-bottom:var(--sp-3);flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
              <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Lesson topic</label>
              <input class="input" id="setup-topic" placeholder="e.g. Making stir-fry, Baking bread, Dessert challenge..." style="width:100%;">
            </div>
            <div>
              <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Students</label>
              <input class="input" id="setup-students" type="number" value="16" min="4" max="40" style="width:80px;">
            </div>
            <div>
              <label style="font-size:0.6875rem;font-weight:600;color:var(--ink-secondary);display:block;margin-bottom:2px;">Duration</label>
              <select class="input" id="setup-duration">
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60" selected>60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="setup-generate-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Generate Lesson Setup
          </button>
          <div id="setup-output" style="margin-top:12px;"></div>
        </div>

        ${lessons.length > 0 ? `
        <!-- Lesson Integration -->
        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-3);display:flex;align-items:center;gap:8px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#009432" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            Linked Lessons
          </h3>
          <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-3);">
            NFS/FCE lessons from your planner. Click to auto-populate the setup guide.
          </p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${lessons.slice(0, 5).map(l => `
              <button class="btn btn-ghost btn-sm lesson-link-btn" data-title="${escHtml(l.title || '')}" data-objectives="${escHtml(l.objectives || '')}" style="text-align:left;justify-content:flex-start;gap:8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${escHtml(l.title || 'Untitled Lesson')}
              </button>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Kitchen Skills & Organisation -->
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--ink);margin-bottom:var(--sp-3);">Kitchen Basics &amp; Skills</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Knife Skills</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              <strong style="color:var(--ink);">Julienne</strong> — thin matchstick strips (3mm x 3mm x 5cm)<br>
              <strong style="color:var(--ink);">Brunoise</strong> — fine dice from julienne strips (3mm cubes)<br>
              <strong style="color:var(--ink);">Chiffonade</strong> — ribbon-cut leafy herbs and greens<br>
              <strong style="color:var(--ink);">Dice</strong> — uniform cubes (small 6mm, medium 12mm, large 20mm)<br>
              <strong style="color:var(--ink);">Mince</strong> — very finely chopped (garlic, ginger, herbs)
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Mise en Place</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              French for <em>"everything in its place"</em>. The most important kitchen habit:
            </p>
            <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:18px;margin-top:var(--sp-1);">
              <li>Read the recipe fully before starting</li>
              <li>Measure and prepare all ingredients first</li>
              <li>Arrange tools and equipment within reach</li>
              <li>Pre-heat ovens and boil water as needed</li>
              <li>Clear workspace and set up waste bowl</li>
            </ul>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Kitchen Brigade System</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              Professional kitchen roles adapted for classroom stations:
            </p>
            <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:18px;margin-top:var(--sp-1);">
              <li><strong style="color:var(--ink);">Head Chef</strong> — leads the team, coordinates timing</li>
              <li><strong style="color:var(--ink);">Prep Cook</strong> — washes, peels, chops ingredients</li>
              <li><strong style="color:var(--ink);">Line Cook</strong> — handles stove and oven cooking</li>
              <li><strong style="color:var(--ink);">Plating</strong> — arranges dishes, garnishes, serves</li>
            </ul>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Food Safety Temperatures</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              <strong style="color:var(--ink);">Danger Zone: 5 - 60 deg C</strong> — bacteria multiply rapidly. Never leave food out for more than 2 hours.<br><br>
              <strong style="color:var(--ink);">Safe cooking temperatures:</strong><br>
              Poultry — 74 deg C &nbsp;|&nbsp; Minced meat — 71 deg C<br>
              Whole cuts (beef/lamb) — 63 deg C &nbsp;|&nbsp; Fish — 63 deg C<br>
              Reheated leftovers — 74 deg C &nbsp;|&nbsp; Cold storage — below 5 deg C
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── Launch Kitchen Planner ──
  container.querySelector('#launch-kitchen').addEventListener('click', () => {
    openOverlay('Kitchen Layout Planner', {
      src: 'simulations/interactives/kitchen-layout/index.html'
    });
  });

  // ── Station Rotation Timer ──
  const clockEl = container.querySelector('#timer-clock');
  const stationNumEl = container.querySelector('#timer-station-num');
  const stationTotalEl = container.querySelector('#timer-station-total');
  const barEl = container.querySelector('#timer-bar');
  const startBtn = container.querySelector('#timer-start');
  const pauseBtn = container.querySelector('#timer-pause');
  const resetBtn = container.querySelector('#timer-reset');

  function updateTimerDisplay() {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    clockEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    stationNumEl.textContent = currentStation;
    stationTotalEl.textContent = totalStations;
    const progress = timerTarget > 0 ? ((timerTarget - timerSeconds) / timerTarget) * 100 : 0;
    barEl.style.width = `${progress}%`;
    // Color changes as time runs low
    if (timerSeconds <= 30 && timerSeconds > 10) {
      barEl.style.background = '#f59e0b';
    } else if (timerSeconds <= 10) {
      barEl.style.background = '#ef4444';
    } else {
      barEl.style.background = '#009432';
    }
  }

  function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    totalStations = parseInt(container.querySelector('#timer-stations').value) || 4;
    rotationMinutes = parseInt(container.querySelector('#timer-minutes').value) || 10;
    timerTarget = rotationMinutes * 60;
    timerSeconds = timerTarget;
    currentStation = 1;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    startBtn.textContent = 'Start';
    updateTimerDisplay();
  }

  function tickTimer() {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimerDisplay();
      // Audio cue at 30s, 10s, and 0s
      if (timerSeconds === 30 || timerSeconds === 10) {
        try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGczHjmIxN/szWxCMlOW0ODVlFI/T4/E1s2CZUU+dK7Nx6BqT0NxoMK8h2FPRH6rx8CYakxBb6O/u4tnUEhyn7m1gWdTR3SjuLWDZ1NHeKW6t4VoUkd3pLi1g2dTR3iku7eGaVJId6S4tYNoUkh4pLq3hmlSSHekuLWDaFJIeaW7uIZpUkh4pLm1g2hSSHmlu7iGaFJIeKS5tYNoUkh5pbu4hmhSSHikubWDaFJIeaW7uIZoUkh4pLm1g2g=').play(); } catch {}
      }
      if (timerSeconds === 0) {
        // Station complete
        if (currentStation < totalStations) {
          currentStation++;
          timerSeconds = timerTarget;
          showToast(`Station ${currentStation} — Go!`, 'success');
          updateTimerDisplay();
        } else {
          // All stations done
          clearInterval(timerInterval);
          timerInterval = null;
          startBtn.disabled = false;
          pauseBtn.disabled = true;
          startBtn.textContent = 'Start';
          clockEl.textContent = 'DONE';
          barEl.style.width = '100%';
          barEl.style.background = '#009432';
          showToast('All stations complete!', 'success');
        }
      }
    }
  }

  startBtn.addEventListener('click', () => {
    if (timerInterval) return;
    if (timerSeconds === 0) resetTimer();
    timerInterval = setInterval(tickTimer, 1000);
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    startBtn.textContent = 'Running...';
  });

  pauseBtn.addEventListener('click', () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      startBtn.textContent = 'Resume';
    }
  });

  resetBtn.addEventListener('click', resetTimer);
  resetTimer();

  // ── AI Recipe Assistant ──
  async function aiRecipeCall(mode) {
    const recipe = container.querySelector('#recipe-input').value.trim();
    const servings = container.querySelector('#recipe-servings').value;
    const dietary = container.querySelector('#recipe-dietary').value;
    const output = container.querySelector('#recipe-output');

    if (!recipe) {
      showToast('Please enter a recipe or dish name.', 'warning');
      return;
    }

    const prompts = {
      adapt: `Adapt this recipe for a school cooking class:

Recipe/Dish: ${recipe}
Servings needed: ${servings}
${dietary ? `Dietary requirement: ${dietary}` : ''}

Provide:
1. Complete adapted recipe with scaled ingredients
2. Step-by-step method suitable for secondary school students
3. Equipment needed
4. Estimated time per step
5. Common mistakes to avoid
6. Simplification tips for less experienced students`,

      shopping: `Generate a shopping list for this school cooking class:

Recipe/Dish: ${recipe}
Servings: ${servings}
${dietary ? `Dietary requirement: ${dietary}` : ''}

Provide a categorised shopping list:
- Fresh produce (fruits, vegetables)
- Proteins (meat, fish, tofu)
- Pantry staples (oils, sauces, spices)
- Dairy & refrigerated items
- Other

Include exact quantities. Group by where they would be found in a supermarket. Flag any common allergens.`,

      nutrition: `Provide a nutrition breakdown for this dish:

Recipe/Dish: ${recipe}
Serving size: 1 portion (of ${servings} total)
${dietary ? `Dietary variant: ${dietary}` : ''}

Include:
- Calories per serving
- Macronutrients (carbs, protein, fat) in grams
- Key micronutrients
- HPB My Healthy Plate assessment — does this meal balance well?
- Suggestions to make it healthier if needed
- Allergen information`,

      safety: `List all food safety reminders for this dish in a school kitchen setting:

Recipe/Dish: ${recipe}
${dietary ? `Dietary requirement: ${dietary}` : ''}

Cover:
1. Raw ingredient handling (cross-contamination risks)
2. Cooking temperatures required
3. Allergen warnings (nuts, dairy, gluten, shellfish, etc.)
4. Equipment safety (knives, hot surfaces, boiling liquids)
5. Hygiene checklist (handwashing, aprons, hair tied back)
6. Storage and leftover handling

Format as a clear checklist suitable for displaying in the kitchen.`,
    };

    const btnMap = { adapt: '#recipe-adapt-btn', shopping: '#recipe-shopping-btn', nutrition: '#recipe-nutrition-btn', safety: '#recipe-safety-btn' };
    const btn = container.querySelector(btnMap[mode]);
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Generating...';
    output.innerHTML = '<p style="color:var(--ink-muted);font-size:0.8125rem;">Generating...</p>';

    try {
      const text = await sendChat([{ role: 'user', content: prompts[mode] }], {
        systemPrompt: 'You are a culinary educator for Singapore secondary school NFS (Nutrition & Food Science) and FCE (Food & Consumer Education) classes. Provide practical, safety-conscious, curriculum-aligned responses. Use metric measurements. Consider Singapore food context (local ingredients, halal options, HPB guidelines).',
        temperature: 0.5,
        maxTokens: 4096,
      });
      output.innerHTML = `<div class="ai-output-box">${renderMd(text)}</div>`;
      processLatex(output);
    } catch (err) {
      output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${escHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }

  container.querySelector('#recipe-adapt-btn').addEventListener('click', () => aiRecipeCall('adapt'));
  container.querySelector('#recipe-shopping-btn').addEventListener('click', () => aiRecipeCall('shopping'));
  container.querySelector('#recipe-nutrition-btn').addEventListener('click', () => aiRecipeCall('nutrition'));
  container.querySelector('#recipe-safety-btn').addEventListener('click', () => aiRecipeCall('safety'));

  // ── AI Lesson Setup Guide ──
  container.querySelector('#setup-generate-btn').addEventListener('click', async () => {
    const topic = container.querySelector('#setup-topic').value.trim();
    const students = container.querySelector('#setup-students').value;
    const duration = container.querySelector('#setup-duration').value;
    const output = container.querySelector('#setup-output');
    const btn = container.querySelector('#setup-generate-btn');

    if (!topic) {
      showToast('Please enter a lesson topic.', 'warning');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Generating...';
    output.innerHTML = '<p style="color:var(--ink-muted);font-size:0.8125rem;">Generating lesson setup...</p>';

    try {
      const text = await sendChat([{ role: 'user', content: `Generate a complete practical lesson setup for a school kitchen class:

Lesson topic: ${topic}
Number of students: ${students}
Duration: ${duration} minutes

Provide:
1. **Team assignments** — divide students into teams with named roles (Head Chef, Prep Cook, Line Cook, Plater). Specify how many teams and students per team.
2. **Station setup** — what equipment and ingredients should be at each station before students arrive
3. **Lesson timeline** — minute-by-minute breakdown (teacher demo, student work, clean-up, plating)
4. **Task cards** — brief task instructions for each station/role that could be printed and placed at stations
5. **Assessment criteria** — simple rubric for scoring the practical (teamwork, hygiene, technique, presentation)
6. **Safety briefing** — key safety points to cover before students start
7. **Clean-up protocol** — systematic clean-up procedure

Make it practical and classroom-ready for Singapore secondary school NFS/FCE.` }], {
        systemPrompt: 'You are an experienced NFS/FCE teacher in a Singapore secondary school. Generate detailed, classroom-ready practical lesson setups that are well-organised, safety-conscious, and pedagogically sound.',
        temperature: 0.5,
        maxTokens: 4096,
      });
      output.innerHTML = `<div class="ai-output-box">${renderMd(text)}</div>`;
      processLatex(output);
    } catch (err) {
      output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${escHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Generate Lesson Setup';
    }
  });

  // ── Lesson integration links ──
  container.querySelectorAll('.lesson-link-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const title = btn.dataset.title || '';
      const objectives = btn.dataset.objectives || '';
      const setupTopic = container.querySelector('#setup-topic');
      if (setupTopic) {
        setupTopic.value = title + (objectives ? ` — ${objectives}` : '');
        setupTopic.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast(`Loaded: ${title}`, 'success');
      }
    });
  });
}
