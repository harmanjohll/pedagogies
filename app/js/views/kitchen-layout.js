/*
 * Kitchen Layout — View
 * =====================
 * Dedicated page for the Kitchen Layout Planner teaching tool.
 * Launches the MasterChef-style kitchen designer in a fullscreen overlay.
 */

import { openOverlay } from '../components/overlay.js';

export function render(container) {
  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:800px;">
        <div class="page-header">
          <div>
            <h1 class="page-title" style="display:flex;align-items:center;gap:10px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#009432" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              Kitchen Layout Planner
            </h1>
            <p class="page-subtitle">MasterChef-style kitchen workstation designer for NFS & FCE practical lessons.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);">
          <div style="display:flex;gap:var(--sp-5);align-items:flex-start;">
            <div style="flex:1;">
              <h3 style="font-size:1rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Kitchen Floor Plan Designer</h3>
              <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;margin-bottom:var(--sp-3);">
                Design kitchen layouts for practical lessons. Drag equipment onto the floor plan, place student markers,
                and visualise safety zones and workflow paths.
              </p>
              <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:20px;margin-bottom:var(--sp-4);">
                <li>Drag-and-drop equipment: hobs, ovens, sinks, prep counters, storage</li>
                <li>MasterChef template with 4 cooking stations and shared area</li>
                <li>Student position markers — adjustable from 4 to 16 students</li>
                <li>Safety zones: hot areas (red) near ovens, wet areas (blue) near sinks</li>
                <li>Workflow arrows: prep → cook → plate pathway visualisation</li>
                <li>5 templates: MasterChef, U-Shape Lab, Island Central, Paired Stations, Blank</li>
              </ul>
              <button class="btn btn-primary" id="launch-kitchen" style="gap:8px;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Launch Kitchen Planner
              </button>
            </div>
            <div style="width:200px;height:160px;border-radius:12px;background:linear-gradient(135deg,#009432 0%,#006266 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">MasterChef Pedagogy</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Set up timed station rotations where each team handles a different task — chopping, cooking, plating.
              Builds teamwork, time management, and kitchen discipline.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Food Safety Zones</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Visualise hot and wet zones to teach kitchen safety. Students learn to plan efficient workflows
              that minimise cross-contamination and movement hazards.
            </p>
          </div>
        </div>

        <!-- Kitchen Skills & Organisation -->
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--ink);margin-bottom:var(--sp-3);">Kitchen Basics &amp; Skills</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🔪 Knife Skills</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              <strong style="color:var(--ink);">Julienne</strong> — thin matchstick strips (3mm × 3mm × 5cm)<br>
              <strong style="color:var(--ink);">Brunoise</strong> — fine dice from julienne strips (3mm cubes)<br>
              <strong style="color:var(--ink);">Chiffonade</strong> — ribbon-cut leafy herbs and greens<br>
              <strong style="color:var(--ink);">Dice</strong> — uniform cubes (small 6mm, medium 12mm, large 20mm)<br>
              <strong style="color:var(--ink);">Mince</strong> — very finely chopped (garlic, ginger, herbs)
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">📋 Mise en Place</h4>
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
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">👨‍🍳 Kitchen Brigade System</h4>
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
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🧹 Equipment Care</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              <strong style="color:var(--ink);">Clean As You Go (CAYG)</strong> — wash, wipe, and put away between steps.<br>
              <strong style="color:var(--ink);">Knife care</strong> — hand-wash only, dry immediately, store in block or magnetic strip.<br>
              <strong style="color:var(--ink);">Chopping boards</strong> — sanitise between proteins, use colour-coded boards.<br>
              <strong style="color:var(--ink);">Hot equipment</strong> — always use dry cloths/mitts, announce "hot!" when carrying.
            </p>
          </div>
        </div>

        <!-- Organisation Strategies -->
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--ink);margin-bottom:var(--sp-3);">Organisation Strategies</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🔄 FIFO — First In, First Out</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Stock rotation principle used in every professional kitchen. Oldest items go to the front, new stock goes behind.
              Prevents food waste and ensures freshness. Label everything with dates.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🟥🟦🟩 Colour-Coded Boards</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              <strong style="color:var(--ink);">Red</strong> — raw meat &nbsp;
              <strong style="color:var(--ink);">Blue</strong> — raw fish &nbsp;
              <strong style="color:var(--ink);">Green</strong> — salad &amp; veg<br>
              <strong style="color:var(--ink);">White</strong> — dairy &amp; bakery &nbsp;
              <strong style="color:var(--ink);">Yellow</strong> — cooked meat &nbsp;
              <strong style="color:var(--ink);">Brown</strong> — root veg
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">📐 The Work Triangle</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              The three most-used areas — <strong style="color:var(--ink);">sink</strong>, <strong style="color:var(--ink);">stove</strong>, and <strong style="color:var(--ink);">fridge</strong> — should form a triangle.
              Each side ideally 1.2–2.7m. Minimises unnecessary walking and keeps the workflow efficient.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">⏱️ Time Management</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Work backwards from serving time. Identify the longest task (e.g. roasting) and start there.
              Use waiting time (baking, simmering) for prep, cleaning, or plating setup. Set timers for every step.
            </p>
          </div>
        </div>

        <!-- Simple Recipes -->
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--ink);margin-bottom:var(--sp-3);">Simple Starter Recipes</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-1);">🍝 Pasta Aglio e Olio</h4>
            <p style="font-size:0.6875rem;color:var(--ink-muted);margin-bottom:var(--sp-2);">Difficulty: Easy · 20 min · Technique: sautéing, emulsification</p>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              Cook spaghetti until al dente, reserving 1 cup pasta water. Sauté thinly sliced garlic in olive oil over low heat until golden (not brown).
              Add chilli flakes, toss pasta in the pan with splashes of pasta water until a silky sauce forms. Finish with parsley and parmesan.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-1);">🥘 Vegetable Stir-Fry</h4>
            <p style="font-size:0.6875rem;color:var(--ink-muted);margin-bottom:var(--sp-2);">Difficulty: Easy · 15 min · Technique: high-heat wok cooking</p>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              Heat wok until smoking. Add oil, then aromatics (garlic, ginger). Add hard vegetables first (carrots, broccoli), then soft ones (capsicum, beansprouts).
              Sauce: 1 tbsp soy sauce, 1 tsp sesame oil, 1 tsp cornstarch in 2 tbsp water. Toss until glazed. Serve over rice.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-1);">🥞 Classic Pancakes</h4>
            <p style="font-size:0.6875rem;color:var(--ink-muted);margin-bottom:var(--sp-2);">Difficulty: Easy · 25 min · Technique: measuring, mixing, temperature control</p>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              Whisk 150g flour, 1 tsp baking powder, pinch of salt. Make a well; add 1 egg, 200ml milk, 2 tbsp melted butter. Mix until just combined (lumps are OK).
              Medium heat, lightly oiled pan. Pour 60ml batter, cook until bubbles appear and edges set, then flip. 1–2 min per side.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-1);">🥗 Garden Salad with Vinaigrette</h4>
            <p style="font-size:0.6875rem;color:var(--ink-muted);margin-bottom:var(--sp-2);">Difficulty: Beginner · 10 min · Technique: dressing ratios, plating</p>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              Wash and dry mixed greens. Prepare toppings: cherry tomatoes (halved), cucumber (sliced), red onion (thinly sliced).
              Classic vinaigrette ratio — 3 parts oil : 1 part vinegar + 1 tsp mustard, salt, pepper. Whisk or shake in a jar. Dress just before serving.
            </p>
          </div>
        </div>

        <!-- Nutrition Science -->
        <h2 style="font-size:1.125rem;font-weight:700;color:var(--ink);margin-bottom:var(--sp-3);">Nutrition Science</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-5);">
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">⚡ Macronutrients</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              <strong style="color:var(--ink);">Carbohydrates</strong> — primary energy source (4 kcal/g). Found in rice, bread, pasta, fruits. Choose whole grains for sustained energy.<br>
              <strong style="color:var(--ink);">Proteins</strong> — growth and repair (4 kcal/g). Found in meat, fish, eggs, tofu, legumes. Essential for muscle and immune function.<br>
              <strong style="color:var(--ink);">Fats</strong> — concentrated energy (9 kcal/g). Found in oils, nuts, avocado, dairy. Choose unsaturated fats; limit saturated and trans fats.
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">💊 Key Micronutrients</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              <strong style="color:var(--ink);">Vitamin A</strong> — vision, skin (carrots, sweet potato, spinach)<br>
              <strong style="color:var(--ink);">Vitamin B complex</strong> — energy metabolism (whole grains, meat, eggs)<br>
              <strong style="color:var(--ink);">Vitamin C</strong> — immune function, collagen (citrus, capsicum, guava)<br>
              <strong style="color:var(--ink);">Vitamin D</strong> — bone health, calcium absorption (sunlight, fortified milk, fish)<br>
              <strong style="color:var(--ink);">Iron</strong> — oxygen transport (red meat, spinach, lentils)<br>
              <strong style="color:var(--ink);">Calcium</strong> — bones and teeth (dairy, tofu, ikan bilis)
            </p>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🍽️ My Healthy Plate (HPB Singapore)</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              The Health Promotion Board's recommended meal proportions:
            </p>
            <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:18px;margin-top:var(--sp-1);">
              <li><strong style="color:var(--ink);">½ plate</strong> — Fruit &amp; Vegetables (variety of colours)</li>
              <li><strong style="color:var(--ink);">¼ plate</strong> — Whole Grains (brown rice, wholemeal bread)</li>
              <li><strong style="color:var(--ink);">¼ plate</strong> — Protein (lean meat, fish, tofu, legumes)</li>
              <li>Use healthier oils, choose water over sugary drinks</li>
            </ul>
          </div>
          <div class="card" style="padding:var(--sp-4);">
            <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">🌡️ Food Safety Temperatures</h4>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;">
              <strong style="color:var(--ink);">Danger Zone: 5°C – 60°C</strong> — bacteria multiply rapidly. Never leave food out for more than 2 hours.<br><br>
              <strong style="color:var(--ink);">Safe cooking temperatures:</strong><br>
              Poultry — 74°C &nbsp;|&nbsp; Minced meat — 71°C<br>
              Whole cuts (beef/lamb) — 63°C &nbsp;|&nbsp; Fish — 63°C<br>
              Reheated leftovers — 74°C &nbsp;|&nbsp; Cold storage — below 5°C
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#launch-kitchen').addEventListener('click', () => {
    openOverlay('Kitchen Layout Planner', {
      src: 'simulations/interactives/kitchen-layout/index.html'
    });
  });
}
