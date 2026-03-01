/*
 * Co-Cher Spatial Designer (Enhanced)
 * ====================================
 * Full drag-and-drop SVG classroom layout designer with:
 * - Operable walls (A & B tracks, close/stack states)
 * - Spider-web radar chart (Chart.js) with definitions & tooltips
 * - Pedagogical insights with E21CC/STP ties per preset
 * - 8 presets: Direct, Pods, Stations, U-Shape, Quiet, Gallery, Fishbowl, Makerspace
 * - Triangular desks, VR Station, coloured station desks
 * - Proper sightline calculation with desk facing angle
 * - Duplicate (Ctrl+D), Undo (Ctrl+Z)
 */

import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { sendChat } from '../api.js';
import { navigate } from '../router.js';

/* ═══════════ Constants ═══════════ */
const SVG_NS = 'http://www.w3.org/2000/svg';
const VB_W = 1440, VB_H = 720;
const UNIT = 60;
const GRID_SNAP = UNIT;
const WALL_A_X = 720, WALL_B_X = 1080;
const PANEL_COUNT = 8, PANEL_THICKNESS = 10;
const TRI_S = UNIT * 0.98;
const TRI_H = Math.sin(Math.PI / 3) * TRI_S;

/* ═══════════ Palette ═══════════ */
const PALETTE = [
  // Furniture
  { cat: 'Furniture', id: 'desk_rect', label: 'Desk (rect)', w: UNIT, h: UNIT * 0.7, color: '#e5e7eb', snap: 'edge90' },
  { cat: 'Furniture', id: 'desk_round', label: 'Table (round)', w: UNIT * 1.1, h: UNIT * 1.1, color: '#d1fae5', round: true },
  { cat: 'Furniture', id: 'desk_trap', label: 'Desk (trapezoid)', w: UNIT, h: UNIT * 0.7, color: '#fee2e2', trap: true, snap: 'edge60' },
  { cat: 'Furniture', id: 'desk_tri', label: 'Desk (triangle)', w: TRI_S, h: TRI_H, color: '#e0f2fe', tri: true, snap: 'tri60' },
  { cat: 'Furniture', id: 'chair', label: 'Chair', w: UNIT * 0.55, h: UNIT * 0.55, color: '#e5e7eb' },
  { cat: 'Furniture', id: 'stand_table', label: 'Standing table', w: UNIT * 2.4, h: UNIT * 0.6, color: '#fde68a', snap: 'edge90' },
  { cat: 'Furniture', id: 'teacher_desk', label: 'Teacher desk', w: UNIT * 1.6, h: UNIT * 0.8, color: '#bfdbfe', snap: 'edge90' },
  // Tech
  { cat: 'Tech', id: 'writable_tv', label: 'Writable TV', w: UNIT * 1.6, h: UNIT * 0.9, color: '#e5e7eb', snap: 'edge90' },
  { cat: 'Tech', id: 'vr_station', label: 'VR Station', w: UNIT, h: UNIT, color: '#dbeafe', round: true },
  { cat: 'Tech', id: 'tablet_cart', label: 'Tablet Cart', w: UNIT * 0.9, h: UNIT * 0.7, color: '#e0e7ff' },
  { cat: 'Tech', id: 'printer_3d', label: '3D Printer', w: UNIT * 0.8, h: UNIT * 0.8, color: '#d1d5db' },
  // Cognitive
  { cat: 'Cognitive', id: 'whiteboard', label: 'Mobile whiteboard', w: UNIT * 1.1, h: UNIT * 1.6, color: '#93c5fd', snap: 'edge90' },
  { cat: 'Cognitive', id: 'tool_cabinet', label: 'Tool cabinet', w: UNIT * 1.5, h: UNIT * 0.6, color: '#e5e7eb', snap: 'edge90' },
  // Social
  { cat: 'Social', id: 'group_table', label: 'Group table (6)', w: UNIT * 1.6, h: UNIT * 1.6, color: '#a7f3d0', round: true },
  { cat: 'Social', id: 'partition', label: 'Mobile partition', w: UNIT * 0.3, h: UNIT * 1.8, color: '#34d399', snap: 'edge90' },
  // Emotional
  { cat: 'Emotional', id: 'couch', label: 'Couch', w: UNIT * 1.8, h: UNIT * 0.8, color: '#fdba74', snap: 'edge90' },
  { cat: 'Emotional', id: 'beanbag', label: 'Beanbag', w: UNIT * 1.1, h: UNIT * 1.1, color: '#fde68a', round: true },
  { cat: 'Emotional', id: 'plant', label: 'Plant', w: UNIT * 0.9, h: UNIT * 0.9, color: '#bbf7d0', round: true },
  // Stations
  { cat: 'Stations', id: 'desk_blue', label: 'Desk (Blue)', w: UNIT, h: UNIT * 0.7, color: '#bfdbfe', snap: 'edge90' },
  { cat: 'Stations', id: 'desk_green', label: 'Desk (Green)', w: UNIT, h: UNIT * 0.7, color: '#bbf7d0', snap: 'edge90' },
  { cat: 'Stations', id: 'desk_orange', label: 'Desk (Orange)', w: UNIT, h: UNIT * 0.7, color: '#fed7aa', snap: 'edge90' },
  // Zones
  { cat: 'Zones', id: 'zone_cog', label: 'Zone: Cognitive', w: UNIT * 3, h: UNIT * 2, color: 'rgba(147,197,253,0.16)', zone: true, border: '#93c5fd' },
  { cat: 'Zones', id: 'zone_soc', label: 'Zone: Social', w: UNIT * 3, h: UNIT * 2, color: 'rgba(167,243,208,0.16)', zone: true, border: '#a7f3d0' },
  { cat: 'Zones', id: 'zone_emo', label: 'Zone: Emotional', w: UNIT * 3, h: UNIT * 2, color: 'rgba(253,230,138,0.16)', zone: true, border: '#fde68a' },
  { cat: 'Zones', id: 'text_label', label: 'Text label', w: UNIT * 2, h: UNIT * 0.8, color: 'transparent', text: true },
];

/* ═══════════ Presets ═══════════ */
const PRESETS = [
  { id: 'direct', label: 'Direct Instruction', desc: 'Rows facing front', icon: '📣' },
  { id: 'pods', label: 'Collaborative Pods', desc: 'Triangular clusters', icon: '🤝' },
  { id: 'stations', label: 'Stations', desc: 'Activity rotation', icon: '🔄' },
  { id: 'ushape', label: 'U-Shape / Circle', desc: 'Discussion-friendly', icon: '🗣️' },
  { id: 'quiet', label: 'Quiet Work', desc: 'Individual focus', icon: '📝' },
  { id: 'gallery', label: 'Gallery Walk', desc: 'Exhibition displays', icon: '🖼️' },
  { id: 'fishbowl', label: 'Fishbowl / Socratic', desc: 'Inner + outer circle', icon: '🐟' },
  { id: 'maker', label: 'Makerspace', desc: 'Hands-on creation', icon: '🛠️' },
];

/* ═══════════ Preset Insights (E21CC + STP ties) ═══════════ */
const PRESET_INSIGHTS = {
  direct: [
    { title: '📣 Clear Communication', affordance: 'Rows facing a clear focal point ensures all students have a direct line of sight for instruction.', moves: ['Use direct instruction for introducing new concepts.', 'Employ call-and-response to maintain engagement.'], e21cc: 'CAIT — focused attention supports individual critical thinking.' },
    { title: '🧑‍🏫 Teacher Mobility', affordance: 'Aisles allow the teacher to circulate, monitor progress, and provide individual support.', moves: ['Walk the room during independent work to check understanding.', 'Use proximity to manage off-task behavior non-verbally.'], e21cc: 'CCI — teacher circulation enables timely communication support.' },
    { title: '👀 Focused Attention', affordance: 'Structured layout minimises distractions, encouraging individual focus.', moves: ['Set clear time limits for tasks.', 'Use think-pair-share for brief structured peer interaction.'], e21cc: 'CAIT — minimised distraction supports deep analytical thinking.' }
  ],
  pods: [
    { title: '🤝 Enhanced Collaboration', affordance: 'Clustered seating creates natural pods for group work, peer teaching, and co-construction of knowledge.', moves: ['Use jigsaw activities where each pod becomes an expert on one topic.', 'Assign group roles to ensure equitable participation.'], e21cc: 'CCI — collaborative pods are the foundation for communication and teamwork.' },
    { title: '💬 Peer-to-Peer Learning', affordance: 'Proximity within pods encourages spontaneous discussion and problem-solving.', moves: ['Provide complex problems requiring multiple perspectives.', 'Encourage groups to present findings to the class.'], e21cc: 'CAIT — peer discourse deepens critical and inventive thinking.' },
    { title: '💡 Shared Cognitive Load', affordance: 'Students can easily share resources, breaking down complex tasks into manageable parts.', moves: ['Use large paper or mini-whiteboards for group brainstorming.', 'Facilitate group goal-setting at start of activity.'], e21cc: 'CCI — shared resources build information literacy skills.' }
  ],
  stations: [
    { title: '🔄 Differentiated Instruction', affordance: 'Multiple stations allow variety catering to different learning styles, paces, and levels.', moves: ['Design tasks at each station targeting specific skills.', 'Allow students to self-select stations based on learning goals.'], e21cc: 'CAIT — stations enable adaptive, self-directed learning paths.' },
    { title: '🏃‍♀️ Active Learning', affordance: 'Physical movement between stations keeps students engaged and breaks sedentary periods.', moves: ['Use a timer for structured rotations.', 'Provide clear instructions and materials at each station.'], e21cc: 'CGC — movement and variety support holistic student wellbeing.' },
    { title: '🧑‍🏫 Targeted Support', affordance: 'Teacher can work intensively with a small group while others work independently.', moves: ['Create a teacher-led station for re-teaching or enrichment.', 'Circulate among independent stations for targeted feedback.'], e21cc: 'CCI — small-group instruction supports differentiated communication.' }
  ],
  ushape: [
    { title: '💬 Democratic Dialogue', affordance: 'Circle/U-shape puts all participants on equal footing with clear sightlines to everyone.', moves: ['Facilitate Socratic seminars or philosophical chairs debates.', 'Establish norms for respectful listening and turn-taking.'], e21cc: 'CGC — equal footing fosters civic literacy and cross-cultural respect.' },
    { title: '👁️ Full Class Visibility', affordance: 'Every student is visible to teacher and peers, encouraging active participation.', moves: ['Use non-verbal cues to gauge understanding across the group.', 'Pose open-ended questions inviting multiple viewpoints.'], e21cc: 'CCI — full visibility supports accountable talk and active listening.' },
    { title: '🤝 Community Building', affordance: 'No "front" breaks traditional hierarchies, promoting collaborative shared learning.', moves: ['Start class with a community-building check-in circle.', 'Use format for storytelling or shared reading experiences.'], e21cc: 'CGC — community circles build global and cross-cultural awareness.' }
  ],
  quiet: [
    { title: '🧠 Deep Focus', affordance: 'Individual desks minimise distractions, providing each student with personal workspace.', moves: ['Use for summative assessments or timed writing.', 'Play quiet background music for concentration.'], e21cc: 'CAIT — uninterrupted focus enables deep critical analysis.' },
    { title: '🧘‍♀️ Self-Paced Learning', affordance: 'Ideal for tasks requiring sustained, independent concentration and self-pacing.', moves: ['Provide playlists of online resources to work through.', 'Offer extension activities for early finishers.'], e21cc: 'CAIT — self-pacing develops adaptive, inventive problem-solving.' },
    { title: '📝 Individual Accountability', affordance: 'Separated workspaces ensure each student is responsible for their own work.', moves: ['Circulate for one-on-one feedback and support.', 'Use mini-whiteboards for quick checks for understanding.'], e21cc: 'CCI — individual work builds personal information management skills.' }
  ],
  gallery: [
    { title: '🚶‍♀️ Peer Feedback & Review', affordance: 'Spreading work around the room enables structured peer-to-peer feedback.', moves: ['Provide sticky notes for students to leave comments at each station.', 'Use protocols like "I like, I wonder, What if" to guide feedback.'], e21cc: 'CCI — peer feedback develops constructive communication skills.' },
    { title: '🎨 Showcasing Process', affordance: 'Perfect for displaying multiple stages of a project, showing thinking processes.', moves: ['Have students display drafts and final versions side-by-side.', 'Ask students to present their "exhibit" to small groups.'], e21cc: 'CAIT — showcasing process makes thinking visible and inventive.' },
    { title: '🔄 Synthesising Information', affordance: 'Each station presents different information, requiring students to synthesise.', moves: ['Use for analysing different documents, data sets, or interpretations.', 'Provide a graphic organiser for students to complete as they visit each station.'], e21cc: 'CAIT — synthesis across sources builds critical information literacy.' }
  ],
  fishbowl: [
    { title: '🗣️ Focused Dialogue', affordance: 'Inner circle creates a stage for active speakers; outer circle for active listeners.', moves: ['Use for structured debates, Socratic seminars, or role-playing.', 'Provide the outer circle with observation tasks or note-taking guides.'], e21cc: 'CGC — fishbowl develops civic discourse and respectful argumentation.' },
    { title: '👂 Active Listening', affordance: 'Distinct speaker/listener roles make active listening explicit and purposeful.', moves: ['Have outer circle provide feedback on discussion quality.', 'Rotate students between inner and outer circles.'], e21cc: 'CCI — explicit listening roles strengthen communication competencies.' },
    { title: '🏛️ Structured Participation', affordance: 'Clear structure manages full-class discussion, keeping conversation focused.', moves: ['Use a "hot seat" model for one student answering group questions.', 'Establish clear norms for entering and exiting the inner circle.'], e21cc: 'CGC — structured dialogue models democratic civic participation.' }
  ],
  maker: [
    { title: '🛠️ Hands-On Creation', affordance: 'Large work surfaces and diverse tools empower hands-on design and prototyping.', moves: ['Pose design challenges requiring physical solutions.', 'Set up a tinkering station for open-ended exploration.'], e21cc: 'CAIT — making develops inventive thinking through tangible creation.' },
    { title: '🏃‍♂️ Flexible Movement', affordance: 'Open-plan design allows easy movement between ideation and fabrication zones.', moves: ['Encourage design thinking: empathise, define, ideate, prototype, test.', 'Use mobile whiteboards for teams to share design processes.'], e21cc: 'CAIT — iterative design cycles develop adaptive problem-solving.' },
    { title: '💡 Interdisciplinary Thinking', affordance: 'Space blends art, design, engineering, and technology across subjects.', moves: ['Partner with other subject teachers for cross-curricular projects.', 'Invite community experts to mentor student projects.'], e21cc: 'CGC — cross-disciplinary work builds global and cross-cultural literacy.' }
  ]
};

/* ═══════════ Chart Metric Definitions ═══════════ */
const CHART_DEFINITIONS = {
  Sightlines: { definition: 'Measures how clearly students can see instructional focal points (e.g., whiteboards, teacher).', reading: 'Higher scores mean better visibility and focus. Lower scores suggest potential obstructions.' },
  Mobility: { definition: 'Assesses the ease with which teachers and students can move around the classroom.', reading: 'Higher scores indicate more open space for circulation. Lower scores suggest a cramped layout.' },
  Flexibility: { definition: 'Evaluates furniture variety and the ease of reconfiguring the space for different activities.', reading: 'Higher scores mean the space is highly adaptable. Lower scores indicate a static setup.' },
  Density: { definition: 'Gauges the amount of personal and group space available to each student.', reading: 'Higher scores mean more space per student. Lower scores suggest overcrowding.' },
  Modality: { definition: 'Rates the space\'s ability to support various learning modes (group, individual, presentation).', reading: 'Higher scores indicate a multi-functional space. Lower scores mean optimised for one activity.' },
  Environment: { definition: 'Considers natural light and biophilic elements (plants) that contribute to wellbeing.', reading: 'Higher scores suggest a calming atmosphere. Lower scores indicate a less stimulating environment.' }
};

const METRIC_LABELS = ['Sightlines', 'Mobility', 'Flexibility', 'Density', 'Modality', 'Environment'];

/* ═══════════ Helper ═══════════ */
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
const normAngle = a => ((a % 360) + 360) % 360;

/* ═══════════ Render ═══════════ */
export function render(container) {
  container.innerHTML = `
    <div class="three-col" style="height:100%;">
      <!-- Left: Palette -->
      <div class="panel" style="overflow-y:auto;padding:var(--sp-4);gap:0;">
        <!-- Design Brief -->
        <details id="design-brief" open style="margin-bottom:var(--sp-4);">
          <summary style="cursor:pointer;font-size:0.9375rem;font-weight:600;color:var(--ink);display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Design Brief
          </summary>
          <div style="display:flex;flex-direction:column;gap:var(--sp-2);font-size:0.8125rem;">
            <div class="input-group" style="margin-bottom:0;">
              <label class="input-label" style="font-size:0.75rem;">Class</label>
              <select class="input" id="brief-class" style="font-size:0.8125rem;padding:var(--sp-1) var(--sp-2);">
                <option value="">Select class...</option>
                ${Store.getClasses().map(c => `<option value="${c.id}">${c.name}${c.subject ? ' · ' + c.subject : ''}</option>`).join('')}
              </select>
            </div>
            <div class="input-group" style="margin-bottom:0;">
              <label class="input-label" style="font-size:0.75rem;">Topic / Activity</label>
              <input class="input" id="brief-topic" style="font-size:0.8125rem;padding:var(--sp-1) var(--sp-2);" placeholder="e.g. Group investigation on acids" />
            </div>
            <div class="input-group" style="margin-bottom:0;">
              <label class="input-label" style="font-size:0.75rem;">Lesson Intention (E21CC Focus)</label>
              <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
                <label style="display:flex;gap:3px;align-items:center;font-size:0.75rem;cursor:pointer;">
                  <input type="checkbox" value="cait" class="brief-e21cc" /> CAIT
                </label>
                <label style="display:flex;gap:3px;align-items:center;font-size:0.75rem;cursor:pointer;">
                  <input type="checkbox" value="cci" class="brief-e21cc" checked /> CCI
                </label>
                <label style="display:flex;gap:3px;align-items:center;font-size:0.75rem;cursor:pointer;">
                  <input type="checkbox" value="cgc" class="brief-e21cc" /> CGC
                </label>
              </div>
            </div>
            <div class="input-group" style="margin-bottom:0;">
              <label class="input-label" style="font-size:0.75rem;">Special Considerations</label>
              <textarea class="input" id="brief-considerations" rows="2" style="font-size:0.8125rem;padding:var(--sp-1) var(--sp-2);" placeholder="e.g. 2 wheelchair users, visual impairment, mixed ability"></textarea>
            </div>
            <button class="btn btn-primary btn-sm" id="ai-suggest-layout" style="margin-top:var(--sp-1);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Suggest Layout
            </button>
          </div>
        </details>

        <hr class="divider" />

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
          <h3 class="panel-title" style="font-size:0.9375rem;">Item Library</h3>
          <span class="text-caption" style="color:var(--ink-faint);">Click to add</span>
        </div>
        <div id="palette"></div>

        <hr class="divider" />

        <h3 class="panel-title" style="font-size:0.9375rem;margin-bottom:var(--sp-3);">Presets</h3>
        <div id="presets" style="display:flex;flex-direction:column;gap:var(--sp-2);"></div>

        <hr class="divider" />

        <h3 class="panel-title" style="font-size:0.9375rem;margin-bottom:var(--sp-3);">Controls</h3>
        <div style="display:flex;flex-direction:column;gap:var(--sp-2);font-size:0.8125rem;">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <label class="input-label" style="min-width:70px;">Students:</label>
            <input type="number" id="student-count" class="input" style="width:70px;padding:var(--sp-1) var(--sp-2);font-size:0.8125rem;" value="32" min="1" max="60" />
          </div>
          <label class="toggle" style="font-size:0.8125rem;">
            <input type="checkbox" class="toggle-input" id="snap-toggle" checked />
            <span class="toggle-track"></span>
            <span class="toggle-label">Snap to grid</span>
          </label>
          <label class="toggle" style="font-size:0.8125rem;">
            <input type="checkbox" class="toggle-input" id="wall-toggle" checked />
            <span class="toggle-track"></span>
            <span class="toggle-label">Operable walls</span>
          </label>
          <div style="margin-top:var(--sp-2);">
            <div style="font-size:0.75rem;font-weight:600;color:var(--ink-faint);margin-bottom:var(--sp-1);">Wall A (x=720)</div>
            <div style="display:flex;gap:var(--sp-1);margin-bottom:var(--sp-2);">
              <button class="btn btn-ghost btn-sm" id="close-wall-a">Close A</button>
              <button class="btn btn-ghost btn-sm" id="stack-wall-a">Stack A</button>
            </div>
            <div style="font-size:0.75rem;font-weight:600;color:var(--ink-faint);margin-bottom:var(--sp-1);">Wall B (x=1080)</div>
            <div style="display:flex;gap:var(--sp-1);">
              <button class="btn btn-ghost btn-sm" id="close-wall-b">Close B</button>
              <button class="btn btn-ghost btn-sm" id="stack-wall-b">Stack B</button>
            </div>
          </div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" id="clear-canvas">Clear All</button>
            <button class="btn btn-ghost btn-sm" id="save-layout">Save Layout</button>
          </div>
          <p class="text-caption" style="color:var(--ink-faint);line-height:1.5;margin-top:var(--sp-1);">
            <strong>R</strong> rotate &middot; <strong>Del</strong> delete &middot; <strong>Ctrl+D</strong> duplicate &middot; <strong>Ctrl+Z</strong> undo<br/>
            <strong>Arrows</strong> nudge &middot; <strong>Shift</strong> multi-select
          </p>
        </div>
      </div>

      <!-- Resize Handle: Left → Center -->
      <div class="resize-handle" id="spatial-resize-left"></div>

      <!-- Center: Canvas -->
      <div id="spatial-canvas-col" style="display:flex;flex-direction:column;overflow:hidden;border-radius:var(--radius-xl);background:var(--surface);box-shadow:var(--shadow-card);">
        <svg id="spatial-svg" viewBox="0 0 ${VB_W} ${VB_H}" style="flex:1;cursor:crosshair;display:block;background:#fff;border-radius:var(--radius-xl);" xmlns="${SVG_NS}">
          <defs>
            <pattern id="grid" width="${UNIT}" height="${UNIT}" patternUnits="userSpaceOnUse">
              <rect width="${UNIT}" height="${UNIT}" fill="none"/>
              <path d="M ${UNIT} 0 V ${UNIT} H 0" fill="none" stroke="#e5e7eb" stroke-width="1"/>
            </pattern>
            <filter id="dshadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.2"/></filter>
            <linearGradient id="deskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>
              <stop offset="100%" stop-color="#000000" stop-opacity="0.05"/>
            </linearGradient>
          </defs>
          <!-- Room sections -->
          <rect id="roomA" x="0" y="0" width="720" height="720" fill="url(#grid)"/>
          <line id="trackA" x1="${WALL_A_X}" y1="0" x2="${WALL_A_X}" y2="720" stroke="#9ca3af" stroke-width="2" stroke-dasharray="6 6" opacity="0.35"/>
          <line id="trackB" x1="${WALL_B_X}" y1="0" x2="${WALL_B_X}" y2="720" stroke="#9ca3af" stroke-width="2" stroke-dasharray="6 6" opacity="0.35"/>
          <rect id="roomB" x="720" y="0" width="720" height="720" fill="url(#grid)" opacity="0.08"/>
          <!-- Room shell -->
          <rect x="0" y="0" width="${VB_W}" height="${VB_H}" fill="none" stroke="#94a3b8" stroke-width="4" rx="2"/>
          <text x="50" y="22" font-size="13" fill="#64748b" font-family="var(--font-sans)" font-weight="600">FRONT</text>
          <!-- Doors -->
          <rect x="300" y="-1" width="60" height="8" fill="#b45309" rx="2"/>
          <rect x="1000" y="-1" width="60" height="8" fill="#b45309" rx="2"/>
          <!-- Windows -->
          <rect x="130" y="-1" width="160" height="6" fill="#60a5fa" opacity="0.5" rx="1"/>
          <rect x="780" y="-1" width="160" height="6" fill="#60a5fa" opacity="0.5" rx="1"/>
          <rect x="130" y="${VB_H - 5}" width="160" height="6" fill="#60a5fa" opacity="0.5" rx="1"/>
          <rect x="780" y="${VB_H - 5}" width="160" height="6" fill="#60a5fa" opacity="0.5" rx="1"/>
          <!-- Operable walls -->
          <g id="operable-walls"></g>
          <!-- Layout items -->
          <g id="layout-root"></g>
          <g id="selection-box" style="pointer-events:none;"></g>
        </svg>
      </div>

      <!-- Resize Handle: Center → Right -->
      <div class="resize-handle" id="spatial-resize-right"></div>

      <!-- Right: Analysis -->
      <div class="panel" id="spatial-right-panel" style="overflow-y:auto;padding:var(--sp-4);gap:0;position:relative;">
        <h3 class="panel-title" style="font-size:0.9375rem;margin-bottom:var(--sp-4);">Spatial Effectiveness</h3>
        <div style="position:relative;width:100%;max-width:240px;margin:0 auto var(--sp-4);">
          <canvas id="radar-chart" width="240" height="240"></canvas>
        </div>

        <div id="score-summary" style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.5;margin-bottom:var(--sp-3);"></div>

        <div id="recommendations" style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-3);"></div>

        <hr class="divider" />

        <h3 class="panel-title" style="font-size:0.9375rem;margin-bottom:var(--sp-3);">Pedagogical Insights</h3>
        <div id="insights" style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.6;display:flex;flex-direction:column;gap:var(--sp-4);"></div>

        <hr class="divider" />

        <h3 class="panel-title" style="font-size:0.9375rem;margin-bottom:var(--sp-3);">Saved Layouts</h3>
        <div id="saved-layouts"></div>
      </div>
    </div>
  `;

  const svg = container.querySelector('#spatial-svg');
  const layoutRoot = svg.querySelector('#layout-root');
  const selBox = svg.querySelector('#selection-box');
  const owLayer = svg.querySelector('#operable-walls');
  const snapToggle = container.querySelector('#snap-toggle');
  const wallToggle = container.querySelector('#wall-toggle');
  const studentCountInput = container.querySelector('#student-count');

  let selected = new Set();
  let marquee = null;
  let currentPreset = null;
  let radarChart = null;
  let undoStack = [];
  let panelState = { A: [], B: [] };

  /* ══════ Operable Walls ══════ */
  function buildWalls() {
    owLayer.innerHTML = '';
    panelState = { A: [], B: [] };
    [{ x: WALL_A_X, id: 'A' }, { x: WALL_B_X, id: 'B' }].forEach(({ x, id }) => {
      for (let i = 0; i < PANEL_COUNT; i++) {
        const panel = document.createElementNS(SVG_NS, 'g');
        panel.setAttribute('data-wall', id);
        panel.style.cursor = 'grab';
        const r = document.createElementNS(SVG_NS, 'rect');
        r.setAttribute('rx', 2);
        r.setAttribute('fill', '#dbeafe');
        r.setAttribute('stroke', '#334155');
        r.setAttribute('stroke-width', '1');
        r.setAttribute('filter', 'url(#dshadow)');
        panel.appendChild(r);
        owLayer.appendChild(panel);
        panelState[id].push({ node: panel });
      }
    });
    closeWall('A');
    closeWall('B');
  }

  function closeWall(which) {
    const arr = panelState[which];
    const x = which === 'A' ? WALL_A_X : WALL_B_X;
    const segH = (VB_H - (PANEL_COUNT - 1) * 2) / PANEL_COUNT;
    arr.forEach((st, i) => {
      const y = (segH / 2) + (i * (segH + 2));
      st.node.setAttribute('transform', `translate(${x},${y}) rotate(0)`);
      const rect = st.node.querySelector('rect');
      rect.setAttribute('width', PANEL_THICKNESS);
      rect.setAttribute('height', segH);
      rect.setAttribute('x', -PANEL_THICKNESS / 2);
      rect.setAttribute('y', -segH / 2);
    });
  }

  function stackWall(which) {
    const arr = panelState[which];
    const x = which === 'A' ? WALL_A_X : WALL_B_X;
    const segH = (VB_H - (PANEL_COUNT - 1) * 2) / PANEL_COUNT;
    const topX = x - segH;
    arr.forEach((st, i) => {
      const rect = st.node.querySelector('rect');
      rect.setAttribute('width', segH);
      rect.setAttribute('height', PANEL_THICKNESS);
      rect.setAttribute('x', 0);
      rect.setAttribute('y', 0);
      if (i < 4) {
        st.node.setAttribute('transform', `translate(${topX},${10 + i * (PANEL_THICKNESS + 2)}) rotate(0)`);
      } else {
        st.node.setAttribute('transform', `translate(${x},${VB_H - 10 - (PANEL_COUNT - i) * (PANEL_THICKNESS + 2)}) rotate(0)`);
      }
    });
  }

  buildWalls();

  /* ══════ Wall panel drag & rotate ══════ */
  function makeWallPanelDraggable(panel) {
    let offset = { x: 0, y: 0 }, isDragging = false, startPos = null;
    panel.addEventListener('pointerdown', e => {
      e.stopPropagation();
      isDragging = true;
      panel.setPointerCapture(e.pointerId);
      panel.style.cursor = 'grabbing';
      if (!e.shiftKey && !selected.has(panel)) { clearSelection(); selected.add(panel); drawSelectionBox(); }
      const p = getMouseSVG(e);
      startPos = getTranslate(panel);
      offset = { x: p.x - startPos[0], y: p.y - startPos[1] };
    });
    panel.addEventListener('pointermove', e => {
      if (!isDragging) return;
      const p = getMouseSVG(e);
      let nx = p.x - offset.x, ny = p.y - offset.y;
      const rect = panel.querySelector('rect');
      const h = +rect.getAttribute('height');
      ny = clamp(ny, h / 2, VB_H - h / 2);
      nx = clamp(nx, 0, VB_W);
      panel.setAttribute('transform', `translate(${nx},${ny}) rotate(${getRotate(panel)})`);
      drawSelectionBox();
    });
    panel.addEventListener('pointerup', () => {
      isDragging = false;
      panel.style.cursor = 'grab';
      updateMetrics();
    });
  }

  // Attach drag handlers to all wall panels
  [...panelState.A, ...panelState.B].forEach(st => makeWallPanelDraggable(st.node));

  wallToggle.addEventListener('change', () => {
    const show = wallToggle.checked;
    owLayer.setAttribute('opacity', show ? '1' : '0');
    svg.querySelector('#trackA').setAttribute('opacity', show ? '0.35' : '0');
    svg.querySelector('#trackB').setAttribute('opacity', show ? '0.35' : '0');
  });
  container.querySelector('#close-wall-a').addEventListener('click', () => {
    closeWall('A'); showToast('Wall A closed'); updateMetrics();
  });
  container.querySelector('#stack-wall-a').addEventListener('click', () => {
    stackWall('A'); showToast('Wall A stacked open'); updateMetrics();
  });
  container.querySelector('#close-wall-b').addEventListener('click', () => {
    closeWall('B'); showToast('Wall B closed'); updateMetrics();
  });
  container.querySelector('#stack-wall-b').addEventListener('click', () => {
    stackWall('B'); showToast('Wall B stacked open'); updateMetrics();
  });

  /* ══════ Palette ══════ */
  const paletteEl = container.querySelector('#palette');
  let currentCat = null;
  PALETTE.forEach(item => {
    if (item.cat !== currentCat) {
      currentCat = item.cat;
      paletteEl.insertAdjacentHTML('beforeend', `<div class="sidebar-section-label" style="padding:var(--sp-2) 0 var(--sp-1);">${item.cat}</div>`);
    }
    const btn = document.createElement('button');
    btn.className = 'sidebar-item';
    btn.style.cssText = 'padding:var(--sp-1) var(--sp-2);font-size:0.8125rem;gap:var(--sp-2);';
    const swatchColor = item.zone ? item.border : item.color;
    btn.innerHTML = `
      <span style="width:18px;height:14px;border-radius:${item.round ? '50%' : '3px'};background:${swatchColor};border:1px solid rgba(0,0,0,0.1);flex-shrink:0;"></span>
      ${item.label}
    `;
    btn.addEventListener('click', () => {
      pushUndo();
      const g = createItem(item, VB_W / 4 - item.w / 2, VB_H / 2 - (item.h || item.w) / 2);
      layoutRoot.appendChild(g);
      clearSelection();
      selectItem(g);
      updateMetrics();
    });
    paletteEl.appendChild(btn);
  });

  /* ══════ Presets ══════ */
  const presetsEl = container.querySelector('#presets');
  PRESETS.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'card card-hover card-interactive';
    btn.style.cssText = 'padding:var(--sp-2) var(--sp-3);text-align:left;';
    btn.innerHTML = `<div style="display:flex;align-items:center;gap:var(--sp-2);"><span style="font-size:1.1rem;">${p.icon}</span><div><div style="font-weight:600;font-size:0.8125rem;color:var(--ink);">${p.label}</div><div style="font-size:0.6875rem;color:var(--ink-muted);">${p.desc}</div></div></div>`;
    btn.addEventListener('click', () => applyPreset(p.id));
    presetsEl.appendChild(btn);
  });

  /* ══════ Design Brief — AI Suggest Layout ══════ */
  const briefClassSelect = container.querySelector('#brief-class');
  const briefTopic = container.querySelector('#brief-topic');
  const briefConsiderations = container.querySelector('#brief-considerations');
  const aiSuggestBtn = container.querySelector('#ai-suggest-layout');

  // Sync class → student count
  briefClassSelect?.addEventListener('change', () => {
    const cls = Store.getClass(briefClassSelect.value);
    if (cls?.students?.length) {
      studentCountInput.value = cls.students.length;
    }
  });

  aiSuggestBtn?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) {
      showToast('Please set your Gemini API key in Settings first.', 'danger');
      return;
    }

    const cls = briefClassSelect.value ? Store.getClass(briefClassSelect.value) : null;
    const topic = briefTopic.value.trim();
    const considerations = briefConsiderations.value.trim();
    const e21ccFocus = [...container.querySelectorAll('.brief-e21cc:checked')].map(cb => cb.value);
    const count = parseInt(studentCountInput.value) || 32;

    const E21CC_MAP = {
      cait: 'Critical, Adaptive & Inventive Thinking (CAIT)',
      cci: 'Communication, Collaboration & Information (CCI)',
      cgc: 'Civic, Global & Cross-cultural Literacy (CGC)'
    };

    // Build the prompt
    let briefPrompt = `Suggest the best classroom spatial layout for this lesson:\n`;
    briefPrompt += `- Students: ${count}\n`;
    if (cls) briefPrompt += `- Class: ${cls.name} (${cls.level || ''} ${cls.subject || ''})\n`;
    if (topic) briefPrompt += `- Topic/Activity: ${topic}\n`;
    if (e21ccFocus.length > 0) briefPrompt += `- E21CC Focus: ${e21ccFocus.map(f => E21CC_MAP[f]).join(', ')}\n`;
    if (considerations) briefPrompt += `- Special considerations: ${considerations}\n`;
    if (cls?.students?.length) {
      const avgCait = Math.round(cls.students.reduce((s, st) => s + (st.e21cc?.cait || 50), 0) / cls.students.length);
      const avgCci = Math.round(cls.students.reduce((s, st) => s + (st.e21cc?.cci || 50), 0) / cls.students.length);
      const avgCgc = Math.round(cls.students.reduce((s, st) => s + (st.e21cc?.cgc || 50), 0) / cls.students.length);
      briefPrompt += `- Class E21CC profile: CAIT avg ${avgCait}, CCI avg ${avgCci}, CGC avg ${avgCgc}\n`;
    }
    briefPrompt += `\nRespond with ONLY a JSON object with these keys:\n- "preset": one of "direct", "pods", "stations", "ushape", "quiet", "gallery", "fishbowl", "maker"\n- "wall_A": "close" or "stack"\n- "wall_B": "close" or "stack"\n- "rationale": 2-3 sentences explaining why this layout suits the brief\n- "tips": array of 2-3 short spatial tips for this specific lesson`;

    aiSuggestBtn.disabled = true;
    aiSuggestBtn.textContent = 'Thinking...';

    try {
      const response = await sendChat([{ role: 'user', content: briefPrompt }], {
        systemPrompt: 'You are a spatial pedagogy expert for Singapore schools. Given a lesson brief, recommend the optimal classroom layout preset. Respond ONLY with valid JSON, no markdown.',
        temperature: 0.4,
        maxTokens: 512
      });

      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse layout suggestion.');
      const suggestion = JSON.parse(jsonMatch[0]);

      // Apply preset
      if (suggestion.preset) {
        applyPreset(suggestion.preset);
      }
      if (suggestion.wall_A === 'stack') stackWall('A'); else closeWall('A');
      if (suggestion.wall_B === 'stack') stackWall('B'); else closeWall('B');

      // Show rationale in insights panel
      const insightsEl = container.querySelector('#insights');
      if (insightsEl && suggestion.rationale) {
        const tipsHtml = (suggestion.tips || []).map(t =>
          `<li style="margin-bottom:var(--sp-1);">${t}</li>`
        ).join('');
        insightsEl.innerHTML = `
          <div style="background:var(--accent-light);padding:var(--sp-3) var(--sp-4);border-radius:var(--radius-md);border-left:3px solid var(--accent);margin-bottom:var(--sp-3);">
            <div style="font-weight:600;font-size:0.8125rem;color:var(--accent-dark);margin-bottom:var(--sp-1);">AI Suggestion</div>
            <div style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.6;">${suggestion.rationale}</div>
            ${tipsHtml ? `<ul style="margin:var(--sp-2) 0 0;padding-left:var(--sp-4);font-size:0.8125rem;color:var(--ink-secondary);">${tipsHtml}</ul>` : ''}
          </div>
        ` + insightsEl.innerHTML;
      }

      showToast(`Applied "${suggestion.preset}" layout based on your brief`, 'success');

      // Collapse the brief after successful suggestion
      container.querySelector('#design-brief')?.removeAttribute('open');

    } catch (err) {
      showToast(`Layout suggestion failed: ${err.message}`, 'danger');
    } finally {
      aiSuggestBtn.disabled = false;
      aiSuggestBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Suggest Layout`;
    }
  });

  /* ══════ Saved layouts ══════ */
  renderSavedLayouts();

  /* ══════ Resizable panels ══════ */
  initSpatialResize(container);

  /* ══════ SVG item creation ══════ */
  function createItem(def, x, y, rot = 0) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${x},${y}) rotate(${rot})`);
    g.setAttribute('data-id', def.id);
    g.setAttribute('data-cat', def.cat);
    if (def.snap) g.setAttribute('data-snap', def.snap);
    g.style.cursor = 'grab';
    g.setAttribute('filter', 'url(#dshadow)');

    const w = def.w, h = def.h || def.w;

    if (def.zone) {
      const r = document.createElementNS(SVG_NS, 'rect');
      setAttrs(r, { x: -w / 2, y: -h / 2, width: w, height: h, fill: def.color, stroke: def.border, 'stroke-width': 1.5, 'stroke-dasharray': '6,3', rx: 8 });
      g.appendChild(r);
      const t = svgText(0, 4, def.label.replace('Zone: ', ''), 11, def.border);
      t.setAttribute('font-weight', '600');
      g.appendChild(t);
    } else if (def.text) {
      const r = document.createElementNS(SVG_NS, 'rect');
      setAttrs(r, { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'rgba(0,0,0,0.03)', stroke: '#cbd5e1', 'stroke-width': 0.5, 'stroke-dasharray': '3,3', rx: 4 });
      g.appendChild(r);
      const t = svgText(0, 4, 'Label', 12, '#64748b');
      g.appendChild(t);
      g.addEventListener('dblclick', () => {
        const newText = prompt('Enter label text:', t.textContent);
        if (newText !== null) t.textContent = newText;
      });
    } else if (def.tri) {
      const s = TRI_S, th = TRI_H;
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', `M${-s / 2},${th / 2} L0,${-th / 2} L${s / 2},${th / 2} Z`);
      setAttrs(p, { fill: def.color, stroke: '#0f172a', 'stroke-width': 1 });
      g.appendChild(p);
      // Front edge
      svgLine(-s * 0.4, th / 2 - 0.1, s * 0.4, th / 2 - 0.1, '#0f172a', 3, g);
    } else if (def.round) {
      const rx = w / 2, ry = h / 2;
      const c = document.createElementNS(SVG_NS, 'ellipse');
      setAttrs(c, { cx: 0, cy: 0, rx, ry, fill: def.color, stroke: '#0f172a', 'stroke-width': 1 });
      g.appendChild(c);
      if (def.id === 'plant') g.appendChild(svgText(0, 5, '🌿', 16));
      if (def.id === 'vr_station') g.appendChild(svgText(0, 4, 'VR', 12, '#334155'));
    } else if (def.trap) {
      const poly = document.createElementNS(SVG_NS, 'path');
      const inset = w * 0.2;
      poly.setAttribute('d', `M${-w / 2},${-h / 2} L${w / 2},${-h / 2} L${w / 2 - inset},${h / 2} L${-w / 2 + inset},${h / 2} Z`);
      setAttrs(poly, { fill: def.color, stroke: '#0f172a', 'stroke-width': 1 });
      g.appendChild(poly);
      svgLine(-w / 2 + 2, -h / 2 + 2, w / 2 - 2, -h / 2 + 2, '#0f172a', 3, g);
    } else {
      // Rectangle desk/furniture
      const r = document.createElementNS(SVG_NS, 'rect');
      setAttrs(r, { x: -w / 2, y: -h / 2, width: w, height: h, fill: def.color, stroke: '#0f172a', 'stroke-width': 1, rx: 3 });
      g.appendChild(r);
      // Gloss overlay
      const gloss = document.createElementNS(SVG_NS, 'rect');
      setAttrs(gloss, { x: -w / 2, y: -h / 2, width: w, height: h, fill: 'url(#deskGrad)', 'fill-opacity': 0.4, 'pointer-events': 'none', rx: 3 });
      g.appendChild(gloss);
      // Front edge for desks
      if (def.id.startsWith('desk') || def.id === 'teacher_desk' || def.id === 'stand_table') {
        svgLine(-w / 2 + 2, -h / 2 + 2, w / 2 - 2, -h / 2 + 2, '#0f172a', 3, g);
      }
      // Labels for special items
      if (def.id === 'writable_tv') g.appendChild(svgText(0, 4, 'wTV', 10, '#64748b'));
      if (def.id === 'tablet_cart') g.appendChild(svgText(0, 4, 'iPads', 9, '#64748b'));
      if (def.id === 'printer_3d') g.appendChild(svgText(0, 4, '3D', 10, '#64748b'));
      if (def.id === 'teacher_desk') g.appendChild(svgText(0, 4, 'TDesk', 9, '#64748b'));
    }

    makeDraggable(g);
    return g;
  }

  function setAttrs(el, attrs) {
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  }

  function svgText(x, y, str, size = 12, fill = '#64748b') {
    const el = document.createElementNS(SVG_NS, 'text');
    setAttrs(el, { x, y, 'text-anchor': 'middle', 'font-size': size, fill, 'font-family': 'var(--font-sans)' });
    el.textContent = str;
    return el;
  }

  function svgLine(x1, y1, x2, y2, color, sw, parent) {
    const el = document.createElementNS(SVG_NS, 'line');
    setAttrs(el, { x1, y1, x2, y2, stroke: color, 'stroke-width': sw });
    if (parent) parent.appendChild(el);
    return el;
  }

  /* ══════ Undo ══════ */
  function pushUndo() {
    undoStack.push(layoutRoot.innerHTML);
    if (undoStack.length > 30) undoStack.shift();
  }

  function popUndo() {
    if (undoStack.length === 0) return;
    const html = undoStack.pop();
    layoutRoot.innerHTML = html;
    [...layoutRoot.querySelectorAll('g[data-id]')].forEach(g => {
      makeDraggable(g);
      if (g.getAttribute('data-id') === 'text_label') {
        g.addEventListener('dblclick', () => {
          const t = g.querySelector('text');
          if (t) { const v = prompt('Edit label:', t.textContent); if (v !== null) t.textContent = v; }
        });
      }
    });
    clearSelection();
    updateMetrics();
    showToast('Undo');
  }

  /* ══════ Drag & drop ══════ */
  function getMouseSVG(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function getTranslate(g) {
    const t = g.getAttribute('transform') || '';
    const m = t.match(/translate\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
    return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
  }

  function getRotate(g) {
    const t = g.getAttribute('transform') || '';
    const m = t.match(/rotate\(\s*([\d.-]+)\s*\)/);
    return m ? parseFloat(m[1]) : 0;
  }

  function snap(v) { return snapToggle.checked ? Math.round(v / GRID_SNAP) * GRID_SNAP : v; }
  function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }

  function makeDraggable(g) {
    let offset = { x: 0, y: 0 }, isDragging = false, groupStart = null;

    g.addEventListener('pointerdown', e => {
      e.stopPropagation();
      isDragging = true;
      g.style.cursor = 'grabbing';
      g.setPointerCapture(e.pointerId);

      if (!e.shiftKey && !selected.has(g)) { clearSelection(); selectItem(g); }
      else if (e.shiftKey) { toggleSelect(g); }

      pushUndo();
      const p = getMouseSVG(e);
      groupStart = [...selected].map(n => ({ n, t: getTranslate(n) }));
      const me = groupStart.find(s => s.n === g)?.t || getTranslate(g);
      offset = { x: p.x - me[0], y: p.y - me[1] };
    });

    g.addEventListener('pointermove', e => {
      if (!isDragging) return;
      const p = getMouseSVG(e);
      const bypass = e.altKey || !snapToggle.checked;
      let nx = bypass ? p.x - offset.x : snap(p.x - offset.x);
      let ny = bypass ? p.y - offset.y : snap(p.y - offset.y);
      nx = clamp(nx, 0, VB_W - UNIT * 0.5);
      ny = clamp(ny, 0, VB_H - UNIT * 0.5);

      const me = groupStart.find(s => s.n === g)?.t || [0, 0];
      const dx = nx - me[0], dy = ny - me[1];
      groupStart.forEach(s => {
        const px = clamp(s.t[0] + dx, 0, VB_W - UNIT * 0.5);
        const py = clamp(s.t[1] + dy, 0, VB_H - UNIT * 0.5);
        s.n.setAttribute('transform', `translate(${px},${py}) rotate(${getRotate(s.n)})`);
      });
      drawSelectionBox();
    });

    g.addEventListener('pointerup', () => {
      isDragging = false;
      g.style.cursor = 'grab';
      groupStart = null;
      updateMetrics();
    });
  }

  /* ── Selection ── */
  function selectItem(g) { selected.add(g); drawSelectionBox(); }
  function toggleSelect(g) {
    if (selected.has(g)) selected.delete(g); else selected.add(g);
    drawSelectionBox();
  }
  function clearSelection() { selected.clear(); selBox.innerHTML = ''; }

  function drawSelectionBox() {
    selBox.innerHTML = '';
    selected.forEach(g => {
      const bb = g.getBBox();
      const [tx, ty] = getTranslate(g);
      const r = document.createElementNS(SVG_NS, 'rect');
      setAttrs(r, { x: tx + bb.x - 4, y: ty + bb.y - 4, width: bb.width + 8, height: bb.height + 8, fill: 'none', stroke: '#3b82f6', 'stroke-width': 1.5, 'stroke-dasharray': '4,3', rx: 4 });
      selBox.appendChild(r);
    });
  }

  /* ── Marquee select ── */
  svg.addEventListener('pointerdown', e => {
    if (e.target !== svg && !['rect', 'line', 'path'].includes(e.target.tagName)) return;
    // Check if clicked on an item
    const items = layoutRoot.querySelectorAll('g[data-id]');
    let hit = false;
    items.forEach(g => { if (g.contains(e.target)) hit = true; });
    if (hit) return;

    clearSelection();
    const p = getMouseSVG(e);
    marquee = { x: p.x, y: p.y, el: null };
    const r = document.createElementNS(SVG_NS, 'rect');
    setAttrs(r, { x: p.x, y: p.y, width: 0, height: 0, fill: 'rgba(59,130,246,0.08)', stroke: '#3b82f6', 'stroke-width': 0.8, rx: 2 });
    selBox.appendChild(r);
    marquee.el = r;

    function onMove(ev) {
      if (!marquee) return;
      const c = getMouseSVG(ev);
      const mx = Math.min(marquee.x, c.x), my = Math.min(marquee.y, c.y);
      const mw = Math.abs(c.x - marquee.x), mh = Math.abs(c.y - marquee.y);
      setAttrs(marquee.el, { x: mx, y: my, width: mw, height: mh });
    }

    function onUp(ev) {
      if (!marquee) return;
      const c = getMouseSVG(ev);
      const mx = Math.min(marquee.x, c.x), my = Math.min(marquee.y, c.y);
      const mw = Math.abs(c.x - marquee.x), mh = Math.abs(c.y - marquee.y);
      items.forEach(g => {
        const [tx, ty] = getTranslate(g);
        if (tx >= mx && ty >= my && tx <= mx + mw && ty <= my + mh) selectItem(g);
      });
      marquee.el.remove();
      marquee = null;
      svg.removeEventListener('pointermove', onMove);
      svg.removeEventListener('pointerup', onUp);
    }

    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onUp);
  });

  /* ── Keyboard ── */
  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Ctrl+Z undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      popUndo();
      return;
    }

    // Ctrl+D duplicate
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selected.size > 0) {
      e.preventDefault();
      pushUndo();
      const newSel = [];
      selected.forEach(g => {
        const clone = g.cloneNode(true);
        const [tx, ty] = getTranslate(g);
        clone.setAttribute('transform', `translate(${tx + UNIT * 0.5},${ty + UNIT * 0.5}) rotate(${getRotate(g)})`);
        layoutRoot.appendChild(clone);
        makeDraggable(clone);
        newSel.push(clone);
      });
      clearSelection();
      newSel.forEach(n => selectItem(n));
      updateMetrics();
      showToast('Duplicated');
      return;
    }

    if (selected.size === 0) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      pushUndo();
      selected.forEach(g => g.remove());
      clearSelection();
      updateMetrics();
      e.preventDefault();
    }
    if (e.key === 'r' || e.key === 'R') {
      const step = e.altKey ? 1 : (e.shiftKey ? 15 : 45);
      selected.forEach(g => {
        const [tx, ty] = getTranslate(g);

        // Wall panel rotation: toggle between 0° and 90° and swap rect dimensions
        if (g.getAttribute('data-wall')) {
          const currentRot = getRotate(g);
          const nextRot = currentRot === 0 ? 90 : 0;
          g.setAttribute('transform', `translate(${tx},${ty}) rotate(${nextRot})`);
          const rect = g.querySelector('rect');
          const rw = +rect.getAttribute('width');
          const rh = +rect.getAttribute('height');
          rect.setAttribute('width', rh);
          rect.setAttribute('height', rw);
          rect.setAttribute('x', -rh / 2);
          rect.setAttribute('y', -rw / 2);
        } else {
          let nextRot = getRotate(g) + step;
          // Snap rotation for desks
          if (!e.altKey && snapToggle.checked) {
            const mode = g.getAttribute('data-snap');
            if (mode === 'tri60' || mode === 'edge60') {
              nextRot = Math.round(nextRot / 60) * 60;
            } else if (mode === 'edge90') {
              const n = Math.round(nextRot / 90) * 90;
              if (Math.abs(n - nextRot) <= 12) nextRot = n;
            }
          }
          g.setAttribute('transform', `translate(${tx},${ty}) rotate(${normAngle(nextRot)})`);
        }
      });
      drawSelectionBox();
      updateMetrics();
    }
    if (e.key.startsWith('Arrow')) {
      const step = e.shiftKey ? GRID_SNAP : (e.altKey ? 5 : 15);
      const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
      const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
      selected.forEach(g => {
        const [tx, ty] = getTranslate(g);
        const nx = clamp(tx + dx, 0, VB_W - UNIT * 0.5);
        const ny = clamp(ty + dy, 0, VB_H - UNIT * 0.5);
        g.setAttribute('transform', `translate(${nx},${ny}) rotate(${getRotate(g)})`);
      });
      drawSelectionBox();
      updateMetrics();
      e.preventDefault();
    }
  }
  document.addEventListener('keydown', onKey);

  /* ══════ Presets ══════ */
  function applyPreset(name) {
    pushUndo();
    layoutRoot.innerHTML = '';
    clearSelection();
    currentPreset = name;
    const count = parseInt(studentCountInput.value) || 32;

    // Wall states: direct/quiet keep walls closed; others stack them open
    if (name === 'direct' || name === 'quiet') {
      closeWall('A'); closeWall('B');
    } else {
      stackWall('A'); stackWall('B');
    }

    function place(def, x, y, rot = 0) {
      layoutRoot.appendChild(createItem(def, x, y, rot));
    }
    const find = id => PALETTE.find(p => p.id === id);

    if (name === 'direct') {
      place(find('teacher_desk'), UNIT * 1.2, UNIT * 3, 90);
      place(find('writable_tv'), UNIT * 2.8, UNIT * 2.8, 90);
      const cols = 5, rows = Math.ceil(count / cols);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols && r * cols + c < count; c++) {
          const cx = c + (c >= 3 ? 0.4 : 0);
          place(find('desk_rect'), UNIT * (6 + cx * 1.3), UNIT * (2 + r * 1.2), 90);
        }
      }
    } else if (name === 'pods') {
      const pods = Math.ceil(count / 6);
      const centers = [[UNIT * 5, UNIT * 3], [UNIT * 9, UNIT * 3], [UNIT * 13, UNIT * 3],
                       [UNIT * 5, UNIT * 7.5], [UNIT * 9, UNIT * 7.5], [UNIT * 13, UNIT * 7.5]];
      for (let i = 0; i < pods && i < centers.length; i++) {
        const [cx, cy] = centers[i];
        const radius = TRI_H * 0.6;
        for (let j = 0; j < 6 && i * 6 + j < count; j++) {
          const angle = j * 60;
          const x = cx + radius * Math.cos(rad(angle));
          const y = cy + radius * Math.sin(rad(angle));
          place(find('desk_tri'), x, y, angle - 90);
        }
      }
      place(find('whiteboard'), UNIT * 1.2, UNIT * 1.2, 90);
    } else if (name === 'stations') {
      place(find('teacher_desk'), UNIT * 11.5, UNIT * 10, 180);
      place(find('writable_tv'), UNIT * 3, UNIT * 1.5, 0);
      place(find('group_table'), UNIT * 3, UNIT * 4);
      place(find('chair'), UNIT * 2, UNIT * 3.5);
      place(find('chair'), UNIT * 4, UNIT * 3.5);
      place(find('chair'), UNIT * 3, UNIT * 5);
      place(find('couch'), UNIT * 21, UNIT * 2, 0);
      place(find('beanbag'), UNIT * 22.5, UNIT * 3.5);
      place(find('beanbag'), UNIT * 19.5, UNIT * 3.5);
      place(find('plant'), UNIT * 21, UNIT * 4);
      place(find('stand_table'), UNIT * 20, UNIT * 9, 90);
      place(find('printer_3d'), UNIT * 22, UNIT * 8);
      place(find('tool_cabinet'), UNIT * 22, UNIT * 10, 180);
      place(find('desk_trap'), UNIT * 10, UNIT * 8, 0);
      place(find('desk_trap'), UNIT * 11.5, UNIT * 8, 0);
      place(find('desk_trap'), UNIT * 13, UNIT * 8, 0);
    } else if (name === 'ushape') {
      const cx = UNIT * 12, cy = UNIT * 6;
      const radius = Math.min(UNIT * 5, (count / 18) * UNIT * 5);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI;
        place(find('desk_rect'), cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, deg(angle) + 90);
      }
      place(find('whiteboard'), UNIT * 1.2, UNIT * 2, 90);
    } else if (name === 'quiet') {
      place(find('teacher_desk'), UNIT * 1.2, UNIT * 3, 90);
      const cols = 5, rows = Math.ceil(count / cols);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols && r * cols + c < count; c++) {
          place(find('desk_rect'), UNIT * (4 + c * 1.4), UNIT * (1.8 + r * 1.2), 90);
        }
      }
    } else if (name === 'gallery') {
      const stations = Math.min(count, 10);
      for (let i = 0; i < stations; i++) {
        if (i < 5) place(find('whiteboard'), UNIT * 1.5 + i * UNIT * 2.5, UNIT * 1.5, 0);
        else place(find('whiteboard'), UNIT * 1.5 + (i - 5) * UNIT * 2.5, VB_H - UNIT * 1.5, 180);
      }
      // Central chairs
      for (let i = 0; i < Math.min(count, 20); i++) {
        const angle = (i / Math.min(count, 20)) * Math.PI * 2;
        place(find('chair'), VB_W / 3 + Math.cos(angle) * UNIT * 3.5, VB_H / 2 + Math.sin(angle) * UNIT * 2.5);
      }
    } else if (name === 'fishbowl') {
      const innerCount = Math.min(8, Math.floor(count / 3));
      const outerCount = count - innerCount;
      const cx = UNIT * 12, cy = UNIT * 6;
      for (let i = 0; i < innerCount; i++) {
        const angle = (i / innerCount) * 2 * Math.PI;
        place(find('desk_rect'), cx + Math.cos(angle) * UNIT * 2.5, cy + Math.sin(angle) * UNIT * 2.5, deg(angle) + 90);
      }
      for (let i = 0; i < outerCount; i++) {
        const angle = (i / outerCount) * 2 * Math.PI;
        place(find('desk_rect'), cx + Math.cos(angle) * UNIT * 4.5, cy + Math.sin(angle) * UNIT * 4.5, deg(angle) + 90);
      }
    } else if (name === 'maker') {
      place(find('whiteboard'), UNIT * 1.5, UNIT * 2, 90);
      place(find('group_table'), UNIT * 4, UNIT * 3);
      place(find('stand_table'), UNIT * 10, UNIT * 3.5, 0);
      place(find('stand_table'), UNIT * 10, UNIT * 6.5, 0);
      place(find('printer_3d'), UNIT * 13.5, UNIT * 2.5);
      place(find('tool_cabinet'), UNIT * 13.5, UNIT * 8.5, 180);
      place(find('writable_tv'), UNIT * 22, UNIT * 5, -90);
      place(find('desk_rect'), UNIT * 19, UNIT * 2);
      place(find('desk_rect'), UNIT * 19, UNIT * 4);
      place(find('desk_rect'), UNIT * 19, UNIT * 6);
      place(find('tablet_cart'), UNIT * 1.5, UNIT * 9);
      place(find('vr_station'), UNIT * 18, UNIT * 9);
    }

    updateMetrics();
    renderInsights(null, PRESET_INSIGHTS[name] || []);
    showToast(`Applied "${PRESETS.find(p => p.id === name)?.label}" preset`);
  }

  /* ══════ Radar Chart ══════ */
  // Create a body-level tooltip so it isn't clipped by overflow:auto panels
  let tooltipEl = document.getElementById('cocher-chart-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'cocher-chart-tooltip';
    tooltipEl.style.cssText = 'position:fixed;display:none;background:rgba(0,12,83,0.94);color:#fff;border-radius:8px;padding:12px 14px;font-size:0.75rem;pointer-events:none;z-index:9999;width:220px;box-shadow:0 8px 24px rgba(0,0,0,0.25);line-height:1.5;font-family:var(--font-sans);';
    document.body.appendChild(tooltipEl);
  }

  function initChart() {
    const canvas = container.querySelector('#radar-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(107,114,128,0.5)' : 'rgba(209,213,219,1)';
    const labelColor = isDark ? '#9ca3af' : '#4b5563';
    const datasetBG = isDark ? 'rgba(255,226,0,0.3)' : 'rgba(0,12,83,0.2)';
    const datasetBorder = isDark ? '#FFE200' : '#000C53';

    const externalTooltip = (context) => {
      const { chart, tooltip } = context;
      if (tooltip.opacity === 0) { tooltipEl.style.display = 'none'; return; }
      const point = tooltip.dataPoints?.[0];
      if (!point) return;
      const label = point.label;
      const score = point.raw;
      const def = CHART_DEFINITIONS[label];
      if (!def) return;

      const rating = score >= 75 ? '🟢 Strong' : score >= 50 ? '🟡 Moderate' : '🔴 Needs attention';
      tooltipEl.innerHTML = `
        <div style="font-weight:700;font-size:0.875rem;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:6px;">${label}: ${score}/100 ${rating}</div>
        <div style="margin-bottom:6px;">${def.definition}</div>
        <div style="font-style:italic;opacity:0.85;border-top:1px solid rgba(255,255,255,0.15);padding-top:6px;">▶ ${def.reading}</div>`;

      // Position relative to viewport using chart canvas bounding rect
      const chartRect = chart.canvas.getBoundingClientRect();
      let left = chartRect.left + tooltip.caretX + 12;
      let top = chartRect.top + tooltip.caretY - 10;
      // Prevent overflow off right edge
      if (left + 230 > window.innerWidth) left = chartRect.left + tooltip.caretX - 235;
      // Prevent overflow off bottom
      if (top + 180 > window.innerHeight) top = window.innerHeight - 190;
      if (top < 10) top = 10;
      tooltipEl.style.left = `${left}px`;
      tooltipEl.style.top = `${top}px`;
      tooltipEl.style.display = 'block';
    };

    radarChart = new Chart(canvas, {
      type: 'radar',
      data: {
        labels: METRIC_LABELS,
        datasets: [{
          label: 'Effectiveness', data: [50, 50, 50, 50, 50, 50],
          fill: true, backgroundColor: datasetBG, borderColor: datasetBorder,
          pointBackgroundColor: datasetBorder, pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff', pointHoverBorderColor: datasetBorder,
          pointRadius: 5, pointHoverRadius: 7,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            angleLines: { color: gridColor }, grid: { color: gridColor },
            suggestedMin: 0, suggestedMax: 100,
            ticks: { display: false, stepSize: 25 },
            pointLabels: { font: { size: 10, weight: '600' }, color: labelColor }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false, position: 'nearest', external: externalTooltip }
        },
        animation: { duration: 400 }
      }
    });
  }

  initChart();

  /* ══════ Metrics calculation ══════ */
  function updateMetrics() {
    const items = [...layoutRoot.querySelectorAll('g[data-id]')];
    const desks = items.filter(g => {
      const id = g.getAttribute('data-id');
      return /desk_/.test(id) || id === 'chair';
    });

    // Calculate room area based on wall state
    const isWallAOpen = panelState.A.some(p => getTranslate(p.node)[0] !== WALL_A_X);
    const isWallBOpen = panelState.B.some(p => getTranslate(p.node)[0] !== WALL_B_X);
    let totalWidth = 720;
    if (isWallAOpen) totalWidth += 360;
    if (isWallBOpen) totalWidth += 360;
    const roomArea = totalWidth * VB_H;

    const itemIds = new Set(items.map(n => n.getAttribute('data-id')));
    const countOf = id => items.filter(i => i.getAttribute('data-id') === id).length;

    // 1. Sightlines (with desk facing angle)
    let sightlineScore = 20;
    const teachPoints = items
      .filter(i => ['teacher_desk', 'writable_tv', 'whiteboard'].includes(i.getAttribute('data-id')))
      .map(g => getTranslate(g));
    if (teachPoints.length === 0) teachPoints.push([720, 10]);

    if (desks.length > 0) {
      let good = 0;
      desks.forEach(desk => {
        const [dx, dy] = getTranslate(desk);
        const deskAngle = rad(getRotate(desk) + 90);
        const facingVec = { x: Math.cos(deskAngle), y: Math.sin(deskAngle) };
        const bestTP = teachPoints.reduce((best, tp) =>
          Math.hypot(tp[0] - dx, tp[1] - dy) < Math.hypot(best[0] - dx, best[1] - dy) ? tp : best
        );
        const toTP = { x: bestTP[0] - dx, y: bestTP[1] - dy };
        const mag = Math.hypot(toTP.x, toTP.y);
        if (mag === 0) return;
        const dot = facingVec.x * toTP.x + facingVec.y * toTP.y;
        const angleDiff = Math.acos(clamp(dot / mag, -1, 1));
        if (deg(angleDiff) < 45) good++;
      });
      sightlineScore = 20 + Math.round((good / desks.length) * 80);
    }

    // 2. Mobility
    let occupiedArea = items.reduce((acc, g) => {
      try { const b = g.getBBox(); return acc + b.width * b.height; } catch { return acc; }
    }, 0);
    const mobilityScore = Math.max(0, Math.min(100, (1 - occupiedArea / roomArea) * 150 - 10));

    // 3. Flexibility
    const mobileItems = ['whiteboard', 'partition', 'chair', 'beanbag', 'tablet_cart'];
    const mobileCount = mobileItems.reduce((sum, id) => sum + countOf(id), 0);
    let flexScore = 20 + (itemIds.size * 5) + (items.length > 0 ? (mobileCount / items.length) * 50 : 0);
    if (items.some(i => i.getAttribute('data-id').startsWith('zone_'))) flexScore += 10;
    flexScore = Math.min(100, flexScore);

    // 4. Density
    let densityScore = 50;
    if (desks.length > 0) {
      const areaPerStudent = roomArea / desks.length;
      const clamped = clamp(areaPerStudent, 12000, 45000);
      densityScore = 10 + ((clamped - 12000) / 33000) * 90;
    }

    // 5. Modality
    let inCluster = 0;
    desks.forEach((d, i) => {
      const [dx, dy] = getTranslate(d);
      for (let j = i + 1; j < desks.length; j++) {
        const [ox, oy] = getTranslate(desks[j]);
        if (Math.hypot(dx - ox, dy - oy) <= UNIT * 1.5) { inCluster++; break; }
      }
    });
    let modalityScore = 10;
    if (desks.length > 0 && inCluster / desks.length > 0.5) modalityScore += 30;
    if (itemIds.has('writable_tv') || itemIds.has('whiteboard')) modalityScore += 25;
    if (itemIds.has('group_table')) modalityScore += 15;
    if (itemIds.has('stand_table')) modalityScore += 15;
    if (itemIds.has('couch') || itemIds.has('beanbag')) modalityScore += 10;
    modalityScore = Math.min(100, modalityScore);

    // 6. Environment
    const plantCount = countOf('plant');
    let lightScore = 0;
    if (desks.length > 0) {
      const nearWindow = desks.filter(d => {
        const pos = getTranslate(d);
        return pos[1] < UNIT * 2 || pos[1] > VB_H - UNIT * 2;
      }).length;
      lightScore = (nearWindow / desks.length) * 50;
    }
    const envScore = Math.min(100, 20 + plantCount * 15 + lightScore);

    const scores = [sightlineScore, mobilityScore, flexScore, densityScore, modalityScore, envScore].map(s => Math.round(clamp(s, 0, 100)));

    // Update radar chart
    if (radarChart) {
      radarChart.data.datasets[0].data = scores;
      radarChart.update();
    }

    // Score summary
    const summaryEl = container.querySelector('#score-summary');
    if (summaryEl) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const rating = avg >= 75 ? '🟢 Excellent' : avg >= 55 ? '🟡 Good' : avg >= 35 ? '🟠 Fair' : '🔴 Needs work';
      summaryEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-2);">
          <span style="font-weight:600;color:var(--ink);">Overall: ${avg}/100</span>
          <span>${rating}</span>
        </div>
        ${METRIC_LABELS.map((label, i) => {
          const s = scores[i];
          const color = s >= 70 ? 'var(--success)' : s >= 45 ? 'var(--warning)' : 'var(--danger)';
          return `<div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:3px;">
            <span style="width:70px;font-size:0.6875rem;color:var(--ink-muted);text-align:right;flex-shrink:0;">${label}</span>
            <div style="flex:1;height:6px;background:var(--bg-subtle);border-radius:3px;overflow:hidden;">
              <div style="width:${s}%;height:100%;background:${color};border-radius:3px;transition:width 0.4s;"></div>
            </div>
            <span style="width:24px;font-size:0.6875rem;color:var(--ink-faint);text-align:right;">${s}</span>
          </div>`;
        }).join('')}
      `;
    }

    // Recommendations
    const recsEl = container.querySelector('#recommendations');
    if (recsEl) {
      const recs = [];
      if (scores[0] < 50) recs.push({ icon: '👀', text: 'Add a whiteboard or TV and orient desks towards it for better sightlines.' });
      if (scores[1] < 40) recs.push({ icon: '🚶', text: 'Layout feels dense — remove items or open walls for better mobility.' });
      if (scores[2] < 40) recs.push({ icon: '🔄', text: 'Add mobile items (whiteboards, partitions, chairs) for more flexibility.' });
      if (scores[3] < 40) recs.push({ icon: '📏', text: 'Too many desks for the space — open walls or reduce desk count.' });
      if (scores[4] < 40) recs.push({ icon: '🎯', text: 'Cluster desks or add group tables to support multiple learning modes.' });
      if (scores[5] < 40) recs.push({ icon: '🌿', text: 'Add plants and position desks near windows for a better environment.' });
      if (scores[0] >= 70 && scores[1] >= 70 && scores[4] >= 70) recs.push({ icon: '✨', text: 'Great balance of sightlines, mobility, and modality!' });

      recsEl.innerHTML = recs.length > 0
        ? `<div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-faint);margin-bottom:var(--sp-1);">Recommendations</div>
           ${recs.map(r => `<div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-1);align-items:flex-start;"><span>${r.icon}</span><span>${r.text}</span></div>`).join('')}`
        : '';
    }

    // Render insights if no preset-specific ones
    if (!currentPreset || !PRESET_INSIGHTS[currentPreset]) {
      renderInsights(items, null, scores);
    }
  }

  /* ══════ Insights rendering ══════ */
  function renderInsights(items, presetInsights, scores) {
    const el = container.querySelector('#insights');

    if (presetInsights && presetInsights.length > 0) {
      el.innerHTML = presetInsights.map(ins => `
        <div style="border-left:3px solid var(--accent);padding-left:var(--sp-3);transition:border-color 0.3s;">
          <div style="font-weight:600;font-size:0.875rem;color:var(--ink);margin-bottom:var(--sp-1);">${ins.title}</div>
          <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-faint);margin-bottom:var(--sp-1);">Affordances</div>
          <p style="margin:0 0 var(--sp-2);">${ins.affordance}</p>
          <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--ink-faint);margin-bottom:var(--sp-1);">Suggested Teacher Moves (STP)</div>
          <ul style="padding-left:1rem;margin:0 0 var(--sp-2);list-style:none;">
            ${ins.moves.map(m => `<li style="position:relative;padding-left:1.2rem;margin-bottom:var(--sp-1);"><span style="position:absolute;left:0;color:var(--success);font-weight:600;">✓</span>${m}</li>`).join('')}
          </ul>
          ${ins.e21cc ? `<div style="font-size:0.75rem;color:var(--accent);font-style:italic;">E21CC: ${ins.e21cc}</div>` : ''}
        </div>
      `).join('');
      return;
    }

    // Generic insights based on scores
    const tips = [];
    if (scores) {
      if (scores[0] < 50) tips.push('Add a teaching point (TV / whiteboard) and orient desks towards it for better sightlines.');
      if (scores[1] < 40) tips.push('Room feels crowded. Remove items or use a wider layout for better mobility.');
      if (scores[2] < 40) tips.push('Add mobile items (whiteboards, partitions) for more flexibility.');
      if (scores[4] < 40) tips.push('Cluster desks for collaborative work, or add group tables for better modality.');
      if (scores[5] < 40) tips.push('Add plants and position desks near windows for a better environment.');
    }
    if (!items || items.length === 0) tips.push('Start by selecting a preset or clicking items from the palette.');

    el.innerHTML = tips.length > 0
      ? `<ul style="padding-left:1rem;margin:0;display:flex;flex-direction:column;gap:var(--sp-2);">${tips.map(t => `<li>${t}</li>`).join('')}</ul>`
      : `<p style="color:var(--success);font-weight:500;">Looking great! Your layout scores well across all metrics.</p>`;
  }

  /* ══════ Save / Load layouts ══════ */
  container.querySelector('#save-layout').addEventListener('click', () => {
    const items = serializeLayout();
    if (items.length === 0) { showToast('Nothing to save — add items first.', 'danger'); return; }

    const { backdrop, close } = openModal({
      title: 'Save Layout',
      body: `<div class="input-group"><label class="input-label">Layout Name</label><input class="input" id="layout-name" placeholder="e.g. Pods for Science" /></div>`,
      footer: `<button class="btn btn-secondary" data-action="cancel">Cancel</button><button class="btn btn-primary" data-action="save">Save</button>`
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
    backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
      const name = backdrop.querySelector('#layout-name').value.trim() || 'Untitled Layout';
      Store.saveLayout({
        name, items,
        preset: currentPreset || null,
        wallState: panelState.A.some(p => getTranslate(p.node)[0] !== WALL_A_X) ? 'stacked' : 'closed',
        studentCount: parseInt(studentCountInput.value) || 32
      });
      showToast('Layout saved!', 'success');
      close();
      renderSavedLayouts();
    });
    setTimeout(() => backdrop.querySelector('#layout-name')?.focus(), 100);
  });

  container.querySelector('#clear-canvas').addEventListener('click', async () => {
    if (layoutRoot.children.length === 0) return;
    const ok = await confirmDialog({ title: 'Clear Canvas', message: 'Remove all items from the canvas?' });
    if (ok) {
      pushUndo();
      layoutRoot.innerHTML = '';
      clearSelection();
      currentPreset = null;
      closeWall('A'); closeWall('B');
      updateMetrics();
      renderInsights(null, null, [0, 0, 0, 0, 0, 0]);
    }
  });

  function serializeLayout() {
    return [...layoutRoot.querySelectorAll('g[data-id]')].map(g => ({
      id: g.getAttribute('data-id'),
      x: getTranslate(g)[0],
      y: getTranslate(g)[1],
      r: getRotate(g)
    }));
  }

  function loadLayout(items, wallState) {
    layoutRoot.innerHTML = '';
    clearSelection();
    items.forEach(item => {
      const def = PALETTE.find(p => p.id === item.id);
      if (def) layoutRoot.appendChild(createItem(def, item.x, item.y, item.r || 0));
    });
    if (wallState === 'stacked') { stackWall('A'); stackWall('B'); }
    else { closeWall('A'); closeWall('B'); }
    updateMetrics();
  }

  function renderSavedLayouts() {
    const el = container.querySelector('#saved-layouts');
    const layouts = Store.getSavedLayouts();
    if (layouts.length === 0) {
      el.innerHTML = `<p style="font-size:0.8125rem;color:var(--ink-faint);">No saved layouts yet.</p>`;
      return;
    }
    el.innerHTML = layouts.map(l => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-2) 0;border-bottom:1px solid var(--border-light);">
        <button class="btn btn-ghost btn-sm load-layout" data-idx="${l.id}" style="font-weight:500;font-size:0.8125rem;">${l.name}</button>
        <button class="btn btn-ghost btn-sm del-layout" data-idx="${l.id}" style="color:var(--danger);font-size:0.6875rem;">Del</button>
      </div>
    `).join('');

    el.querySelectorAll('.load-layout').forEach(btn => {
      btn.addEventListener('click', () => {
        const layout = layouts.find(l => l.id === btn.dataset.idx);
        if (layout) {
          loadLayout(layout.items, layout.wallState);
          if (layout.studentCount) studentCountInput.value = layout.studentCount;
          showToast(`Loaded "${layout.name}"`);
        }
      });
    });
    el.querySelectorAll('.del-layout').forEach(btn => {
      btn.addEventListener('click', () => {
        Store.deleteLayout(btn.dataset.idx);
        showToast('Layout deleted');
        renderSavedLayouts();
      });
    });
  }

  // Initial metrics
  updateMetrics();
  renderInsights(null, null, [50, 50, 50, 50, 50, 50]);

  // Cleanup on route change
  return () => {
    document.removeEventListener('keydown', onKey);
    if (radarChart) { radarChart.destroy(); radarChart = null; }
    if (tooltipEl) tooltipEl.style.display = 'none';
  };
}

/* ══════════ Spatial Resize Handles ══════════ */
function initSpatialResize(container) {
  const threeCol = container.querySelector('.three-col');
  if (!threeCol) return;

  const leftPanel = threeCol.querySelector('.panel:first-child');
  const canvasCol = threeCol.querySelector('#spatial-canvas-col');
  const rightPanel = threeCol.querySelector('#spatial-right-panel');
  const leftHandle = threeCol.querySelector('#spatial-resize-left');
  const rightHandle = threeCol.querySelector('#spatial-resize-right');

  function setupHandle(handle, beforePanel, afterPanel) {
    if (!handle || !beforePanel || !afterPanel) return;
    let isResizing = false, startX = 0, startBeforeW = 0, startAfterW = 0;

    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      isResizing = true;
      startX = e.clientX;
      startBeforeW = beforePanel.getBoundingClientRect().width;
      startAfterW = afterPanel.getBoundingClientRect().width;
      handle.classList.add('active');
      document.body.classList.add('resizing-panels');
      handle.setPointerCapture(e.pointerId);
    });

    handle.addEventListener('pointermove', (e) => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const newBefore = startBeforeW + dx;
      const newAfter = startAfterW - dx;
      const minW = 160;
      if (newBefore >= minW && newAfter >= minW) {
        beforePanel.style.flex = `0 0 ${newBefore}px`;
        afterPanel.style.flex = `0 0 ${newAfter}px`;
      }
    });

    handle.addEventListener('pointerup', () => {
      isResizing = false;
      handle.classList.remove('active');
      document.body.classList.remove('resizing-panels');
    });

    handle.addEventListener('lostpointercapture', () => {
      isResizing = false;
      handle.classList.remove('active');
      document.body.classList.remove('resizing-panels');
    });

    handle.addEventListener('dblclick', () => {
      beforePanel.style.flex = '';
      afterPanel.style.flex = '';
    });
  }

  setupHandle(leftHandle, leftPanel, canvasCol);
  setupHandle(rightHandle, canvasCol, rightPanel);
}
