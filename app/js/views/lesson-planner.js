/*
 * Co-Cher Lesson Planner
 * ======================
 * AI chat + plan canvas with save / link-to-class / export.
 * Phase 3: Subject-aware prompts, status badge, undo, mobile toggle, improved markdown.
 */

import { Store } from '../state.js';
import { sendChat, reviewLesson, generateRubric, suggestGrouping, groupingToMarkdown, generateExitTicket, suggestDifferentiation, generateTimeline, suggestSeatAssignment, seatPlanToMarkdown, generateRunOfShow, mapSegmentsToSTP, suggestYouTubeVideos, suggestSimulations, generateWorksheet, generateDiscussionPrompts, suggestExternalResources, generateLISC, generateStimulusMaterial, generateVocabulary, generateModelResponse, generateSourceAnalysis, expandSection, generateDeck, generatePodcastScript, generateSpeech, generateSVGDiagram, generateImage } from '../api.js';
import { cceContextBlock } from './cce.js';
import { compileDeckHTML, deckFilename, slugify, saveDeckMaterial, saveAudioMaterial, listDeckMeta, listAudioMeta, getMediaContent, openDeckById, downloadBlob } from '../utils/deck.js';
import { showToast } from '../components/toast.js';
import { openModal, confirmDialog } from '../components/modals.js';
import { navigate } from '../router.js';
import { renderWorkflowBreadcrumb, bindWorkflowClicks } from '../components/workflow-breadcrumb.js';
import { getCurrentUser } from '../components/login.js';
import { loadTT, findTeacherRow, ensureCalendar } from './dashboard.js';
import { getWeekType } from '../utils/calendar.js';
import { processLatex } from '../utils/latex.js';
import { md, escapeHtml, mountExpansion, stripExpandMarkers } from '../utils/markdown.js';
import { critiquePlan } from '../api.js';
import { toggleFocusMode } from '../components/keyboard-shortcuts.js';
import { SCHEMA_PRESETS } from '../utils/tracking.js';
import { TEACHING_AREAS, TEACHING_AREA_ICONS, TEACHING_AREA_LABELS, actionsForArea, resolveTeachingAction, TEACHING_ACTION_OTHER } from '../utils/stp.js';
import { layoutToSVG } from './spatial-designer.js';
import { isVoiceInputSupported, createDictation } from '../utils/voice.js';
import { ATTACH_ACCEPT, isAcceptedAttachment, buildAttachment, toMultimodalMessage, attachmentContextNote, stripAttachmentData } from '../utils/attachments.js';
import { priorityLabel, getPriorities } from '../utils/priorities.js';

// Shared escape (covers quotes, so it is attribute-safe too)
const esc = escapeHtml;

// md() for static print/export surfaces (popup windows, .doc download) —
// no click handler lives there, so [EXPAND:] chips are stripped rather than
// rendered as dead buttons. In-app surfaces keep md() so chips stay live.
const mdStatic = (t) => md(stripExpandMarkers(t));

let chatMessages = [];
let isGenerating = false;
let currentLessonId = null;  // if editing a saved lesson
let planClassContext = null;  // class context from "Plan from Class"
let vigilanceNudged = false;  // at most one nudge per conversation
let vigilanceState = null;    // { prompt } while the nudge card is showing
let attachedKBContext = [];   // attached knowledge base resources
let pendingAttachments = [];  // images / PDFs staged in the composer for the next message
let lessonDateTime = null;    // { date, period, room, classCode } from timetable or manual
let selectedIdeology = '';    // optional curriculum ideology lens
let selectedFrameworkIds = []; // optional pedagogy framework lenses (multi-select chips)
let cceContext = null;        // WS-5: { contentArea, topic, pendingInput } when arriving via "Plan a CCE lesson"

/* ── Reference library picker ──
 * Teacher-curated documents (My References, in My Learning) that can be toggled
 * ON to inject as context — like a skill. Selection persists for the session. */
const PLANNER_REF_KEY = 'cocher_planner_reference_ids';
function loadSelectedReferenceIds() {
  try { const r = sessionStorage.getItem(PLANNER_REF_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveSelectedReferenceIds() {
  try { sessionStorage.setItem(PLANNER_REF_KEY, JSON.stringify(selectedReferenceIds)); } catch {}
}
let selectedReferenceIds = loadSelectedReferenceIds();

/* ── Consume a spatial layout linked before a lesson existed ──
 * render() stashes cocher_pending_spatial_layout when a layout arrives from the
 * Spatial Designer with no lesson to attach it to. Once a lesson exists we link
 * it and clear the key; if the layout no longer exists we still clear the key so
 * the handoff never lingers orphaned. */
function consumePendingSpatialLayout() {
  const pendingId = sessionStorage.getItem('cocher_pending_spatial_layout');
  if (!pendingId || !currentLessonId) return;
  sessionStorage.removeItem('cocher_pending_spatial_layout');
  const exists = (Store.getSavedLayouts() || []).some(l => l.id === pendingId);
  if (exists) {
    Store.updateLesson(currentLessonId, { spatialLayout: pendingId });
  }
}

/* ── Lesson Components: persistent AI tool results integrated into the plan ── */
let lessonComponents = {};    // { review, rubric, grouping, timeline, exitTicket, differentiation, seatPlan }

/* ── Toolbar display preference ── */
const LP_PREFS_KEY = 'cocher_lp_prefs';
function getLPPrefs() {
  try { const r = localStorage.getItem(LP_PREFS_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function saveLPPrefs(p) {
  try { localStorage.setItem(LP_PREFS_KEY, JSON.stringify(p)); } catch {}
}

/* ── Cognitive vigilance: nudge low-context generation prompts ──
 * Pure heuristics, zero API cost. The teacher stays the designer —
 * when a first prompt asks for a lesson with no idea who it's for,
 * Co-Cher playfully asks before generating. Fires at most once per
 * conversation; never when class context is attached; skippable. */

export function isVigilanceEnabled() {
  return getLPPrefs().vigilance !== false;
}
export function setVigilanceEnabled(on) {
  const p = getLPPrefs();
  p.vigilance = !!on;
  saveLPPrefs(p);
}

const VIGILANCE_OPENERS = [
  "Erm&hellip; I don't quite know your class yet, Cher! &#128517;",
  "Wait wait &mdash; who am I designing this for, Cher? &#129300;",
  "Aiyo Cher, I'd just be guessing who your students are! &#128584;",
];

function vigilanceCheck(text) {
  if (vigilanceNudged || !isVigilanceEnabled()) return false;
  if (planClassContext || chatMessages.length > 0) return false;
  // Only generation-intent prompts qualify
  if (!/\b(give|make|create|generate|plan|design|prepare|build|write)\b[\s\S]{0,80}\b(lesson|activity|activities|worksheet|plan|unit)\b/i.test(text)) return false;
  // A class named in the prompt counts as knowing the audience
  const lower = text.toLowerCase();
  const classNames = Store.getClasses().map(c => (c.name || '').toLowerCase()).filter(n => n.length > 1);
  if (classNames.some(n => lower.includes(n))) return false;
  // Count context signals; fewer than 2 → nudge
  let signals = 0;
  if (/\b(sec(ondary)?\s?[1-5]|primary\s?[1-6]|jc\s?[12]|year\s?[1-6]|express|normal|na\b|nt\b|ip\b|pre-u|o[- ]level|n[- ]level|a[- ]level)\b/i.test(text)) signals++;
  if (/\b(english|math|physic|chem|biolog|science|histor|geograph|literature|music|art|pe\b|cce|design|food|nutrition|malay|chinese|tamil|social studies)\w*/i.test(text)) signals++;
  if (/\b(enjoy|love|like|struggle|weak|strong|mixed[- ]ability|prior|already (know|learnt|learned)|profile|restless|quiet|talkative|kinaesthetic|visual learner)/i.test(text)) signals++;
  if (text.split(/\s+/).length >= 18) signals++;
  return signals < 2;
}

function buildVigilanceNudgeHTML() {
  const opener = VIGILANCE_OPENERS[Math.floor(Math.random() * VIGILANCE_OPENERS.length)];
  const classes = Store.getClasses().slice(0, 4);
  return `
    <div id="vigilance-nudge" style="padding:var(--sp-6) var(--sp-4);">
      <div style="max-width:480px;margin:0 auto;">
        <div class="chat-msg ai" style="max-width:100%;">
          <p style="margin:0 0 6px;font-weight:600;">${opener}</p>
          <p style="margin:0;font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
            A lesson designed for <em>your</em> students beats a generic one every time.
            Tell me who this is for &mdash; or pick a class:
          </p>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--sp-3);">
          ${classes.map(c => `
            <button class="chat-option vigilance-class" data-class-id="${esc(c.id)}">
              ${esc(c.name)}${c.level ? ` &middot; ${esc(c.level)}` : ''}${c.subject ? ` ${esc(c.subject)}` : ''}
            </button>`).join('')}
          <button class="chat-option" id="vigilance-describe">&#9997;&#65039; Let me describe them</button>
          <button class="chat-option" id="vigilance-skip" style="opacity:0.75;">Just generate lah &#128518;</button>
        </div>
      </div>
    </div>`;
}

/* ── EEE: Enactment Enhancements for Engagement ── */
const EEE_KEY = 'cocher_eee_selections';
const EEE_SIDEBAR_KEY = 'cocher_eee_sidebar';

/* ── Pedagogical Approaches ── */
export const PEDAGOGY_APPROACHES = [
  { id: 'differentiation', label: 'Differentiation', icon: '&#9879;' },
  { id: 'inquiry',         label: 'Inquiry-Based Learning', icon: '?' },
  { id: 'collaborative',   label: 'Collaborative Learning', icon: '&#9733;' },
  { id: 'direct',          label: 'Direct Instruction', icon: '&#9654;' },
  { id: 'assessment',      label: 'Assessment for Learning', icon: '&#9733;' },
  { id: 'e21cc',           label: 'E21CC Development', icon: '&#9883;' },
  { id: 'sel',             label: 'SEL & Well-being', icon: '&#9786;' },
  { id: 'edtech',          label: 'EdTech Integration', icon: '&#9000;' },
  { id: 'engagement',      label: 'Student Engagement', icon: '&#9829;' },
  { id: 'cce',             label: 'CCE & Values', icon: '&#9825;' },
];

// All available EEEs: core tools (always visible) and optional enhancements
// type: 'tool' = interactive Teaching Tool, 'resource' = Lesson Resource (display/distribute)
export const EEE_REGISTRY = {
  // === CORE (always enabled, not toggleable) ===
  lisc:           { label: 'LI / SC',           cat: 'core', type: 'resource', desc: 'Learning Intentions & Success Criteria with E21CC alignment', pedagogy: ['assessment', 'e21cc'] },
  review:         { label: 'Lesson Review',      cat: 'core', type: 'tool', desc: 'AI analysis of your lesson plan against STP & E21CC', pedagogy: ['assessment'] },
  timeline:       { label: 'Timeline',           cat: 'core', type: 'resource', desc: 'Lesson pacing with phase-by-phase suggestions', pedagogy: ['direct', 'engagement'] },
  grouping:       { label: 'Student Groups',     cat: 'core', type: 'tool', desc: 'Group formation using class roster & E21CC profiles', pedagogy: ['collaborative', 'differentiation', 'e21cc'] },
  differentiation:{ label: 'Differentiation',    cat: 'core', type: 'resource', desc: 'Scaffolding & extension strategies for diverse learners', pedagogy: ['differentiation'] },
  exitTicket:     { label: 'Exit Ticket',        cat: 'core', type: 'resource', desc: 'Formative check questions for lesson closure', pedagogy: ['assessment', 'engagement'] },
  discussionPrompts:{ label: 'Discussion Prompts', cat: 'core', type: 'tool', desc: 'Structured questions for classroom discourse', pedagogy: ['inquiry', 'collaborative', 'engagement'] },
  rubric:         { label: 'Rubric',             cat: 'core', type: 'resource', desc: 'Assessment rubrics with criteria & levels', pedagogy: ['assessment'] },
  crossSubject:   { label: 'Cross-Subject Links', cat: 'core', type: 'tool', desc: 'Find connections to other subjects and suggest integration points', pedagogy: ['inquiry', 'e21cc', 'collaborative'] },
  // WS-4 Materials (core: always available — they attach to the saved lesson)
  slideDeck:      { label: 'Slide Deck',          cat: 'core', type: 'resource', desc: 'Self-contained HTML slide deck compiled from the plan (present or print to PDF)', subjects: ['all'], pedagogy: ['direct', 'edtech'] },
  audioClip:      { label: 'Audio Clip',          cat: 'core', type: 'resource', desc: 'Short AI-voiced audio clip (voice only — no music or sound effects)', subjects: ['all'], pedagogy: ['engagement', 'edtech'] },
  resourceRec:    { label: 'Resource Recommender', cat: 'core', type: 'tool', desc: 'Auto-suggest Knowledge Base items, simulations, and resources for the lesson', pedagogy: ['edtech', 'inquiry', 'engagement'] },
  // === ENACTMENT ENHANCEMENTS (teacher chooses) ===
  // type: 'tool' = Teaching Tool (interactive, run in class)
  // type: 'resource' = Lesson Resource (display/distribute in class)
  youtubeVideos:  { label: 'YouTube Curation',   cat: 'core', type: 'resource', desc: 'Curated video recommendations with preview tiles', subjects: ['all'], pedagogy: ['engagement', 'edtech', 'direct'] },
  simulations:    { label: 'Simulations & Models', cat: 'enactment', type: 'tool', desc: 'Interactive sims: PhET, GeoGebra, built-in practicals', subjects: ['Science', 'Chemistry', 'Physics', 'Biology', 'Mathematics', 'Geography'], pedagogy: ['inquiry', 'edtech', 'engagement'] },
  worksheet:      { label: 'Worksheet / Handout', cat: 'enactment', type: 'resource', desc: 'Print-ready student worksheets with mixed question types', subjects: ['all'], pedagogy: ['differentiation', 'assessment', 'direct'] },
  stimulus:       { label: 'Stimulus Material',  cat: 'enactment', type: 'resource', desc: 'Comprehension passages, source texts, scenario briefs', subjects: ['English', 'Chinese', 'Malay', 'Tamil', 'History', 'Social Studies', 'Geography', 'General Paper'], pedagogy: ['inquiry', 'direct', 'engagement'] },
  vocabulary:     { label: 'Vocabulary Builder', cat: 'enactment', type: 'resource', desc: 'Word walls, sentence frames, cloze passages, academic language', subjects: ['English', 'Chinese', 'Malay', 'Tamil', 'all'], pedagogy: ['differentiation', 'direct'] },
  modelResponse:  { label: 'Model Response',     cat: 'enactment', type: 'resource', desc: 'Annotated model answers showing structure & techniques', subjects: ['English', 'Chinese', 'Malay', 'Tamil', 'History', 'Social Studies', 'General Paper', 'Geography'], pedagogy: ['direct', 'assessment'] },
  sourceAnalysis: { label: 'Source Analysis',     cat: 'enactment', type: 'tool', desc: 'Structured SBQ/SEQ-style source-based questions', subjects: ['History', 'Social Studies', 'General Paper', 'Geography'], pedagogy: ['inquiry', 'assessment', 'e21cc'] },
  seatPlan:       { label: 'Seating Plan',        cat: 'enactment', type: 'tool', desc: 'AI seat assignments with visual classroom map', subjects: ['all'], pedagogy: ['collaborative', 'differentiation', 'sel'] },
  // === NEW TOOLS — Arts, Music, NFS, D&T ===
  staveNotation:  { label: 'Stave Notation',      cat: 'enactment', type: 'tool', desc: 'Staff notation snippets for music theory — treble/bass clef, time signatures, note values', subjects: ['Music'], pedagogy: ['direct', 'engagement'] },
  rhythmTool:     { label: 'Rhythm & Percussion',  cat: 'enactment', type: 'tool', desc: 'Interactive rhythm patterns, drum notation, and body percussion guides', subjects: ['Music'], pedagogy: ['engagement', 'collaborative'] },
  artCritique:    { label: 'Art Critique Guide',   cat: 'enactment', type: 'tool', desc: 'Structured observation prompts using Feldman model: describe, analyse, interpret, judge', subjects: ['Art'], pedagogy: ['inquiry', 'e21cc'] },
  designProcess:  { label: 'Design Process',       cat: 'enactment', type: 'tool', desc: 'D&T design thinking framework: identify, explore, develop, realise, test', subjects: ['D&T', 'Design & Technology'], pedagogy: ['inquiry', 'e21cc', 'collaborative'] },
  recipeBuilder:  { label: 'Recipe & Nutrition',   cat: 'enactment', type: 'resource', desc: 'Recipe card builder with nutritional analysis and food safety notes', subjects: ['NFS', 'Food & Nutrition', 'FCE'], pedagogy: ['direct', 'inquiry'] },
  kitchenLayout:  { label: 'Kitchen Layout',       cat: 'enactment', type: 'tool', desc: 'Plan kitchen workstation layout — spatial planner opens with kitchen preset', subjects: ['NFS', 'Food & Nutrition', 'FCE'], pedagogy: ['collaborative', 'engagement'] },
};

const DEFAULT_PLANNER = ['youtubeVideos', 'worksheet', 'seatPlan', 'simulations', 'stimulus', 'vocabulary', 'modelResponse', 'sourceAnalysis'];
const DEFAULT_SIDEBAR = ['simulations'];

export function getEEESelections() {
  try {
    const stored = localStorage.getItem(EEE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Backward compat: old format was a flat array
      if (Array.isArray(parsed)) return parsed;
      return parsed;
    }
  } catch {}
  return [...DEFAULT_PLANNER];
}

export function getEEESidebarSelections() {
  try {
    const stored = localStorage.getItem(EEE_SIDEBAR_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [...DEFAULT_SIDEBAR];
}

export function saveEEESelections(selections) {
  try { localStorage.setItem(EEE_KEY, JSON.stringify(selections)); } catch {}
}

export function saveEEESidebarSelections(selections) {
  try { localStorage.setItem(EEE_SIDEBAR_KEY, JSON.stringify(selections)); } catch {}
}

/* ── Custom Links: teacher-added URLs in the marketplace ── */
const CUSTOM_LINKS_KEY = 'cocher_custom_links';

export function getCustomLinks() {
  try {
    const raw = localStorage.getItem(CUSTOM_LINKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCustomLinks(links) {
  try { localStorage.setItem(CUSTOM_LINKS_KEY, JSON.stringify(links)); } catch {}
}

function isEEEEnabled(toolKey) {
  const entry = EEE_REGISTRY[toolKey];
  if (!entry) return false;
  if (entry.cat === 'core') return true;
  return getEEESelections().includes(toolKey);
}

/* ── Active component tab ── */
let activeComponentTab = null;  // null = show all (auto-select first)

const COMPONENT_META = {
  lisc:            { label: 'LI / SC',                 color: 'var(--brand-navy, #000c53)', icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>', order: 0 },
  timeline:        { label: 'Timeline / Pacing',       color: 'var(--accent)',      icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', order: 1 },
  grouping:        { label: 'Student Groups',          color: 'var(--e21cc-cci)',   icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', order: 2 },
  seatPlan:        { label: 'Seating Plan',            color: 'var(--e21cc-cgc)',   icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>', order: 3 },
  differentiation: { label: 'Differentiation',         color: 'var(--e21cc-cait)',  icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>', order: 4 },
  rubric:          { label: 'Assessment Rubric',       color: 'var(--success)',     icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>', order: 5 },
  exitTicket:      { label: 'Exit Ticket',             color: 'var(--e21cc-cait)',  icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', order: 6 },
  review:          { label: 'Lesson Review',           color: 'var(--accent)',      icon: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="M8 11l2 2 4-4"/>', order: 7 },
  youtubeVideos:   { label: 'YouTube Videos',          color: '#ff0000',            icon: '<polygon points="5 3 19 12 5 21 5 3"/>', order: 8 },
  simulations:     { label: 'Simulation Models',        color: '#8b5cf6',            icon: '<path d="M9 3h6v3H9z"/><path d="M7 6h10l2 4-4 3 4 3-2 5H7l-2-5 4-3-4-3z"/>', order: 9 },
  worksheet:       { label: 'Worksheet / Handout',      color: 'var(--info, #3b82f6)',icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/><path d="M7 13h0.01"/>', order: 10 },
  discussionPrompts: { label: 'Discussion Prompts',     color: 'var(--warning, #f59e0b)', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>', order: 11 },
  stimulus:        { label: 'Stimulus Material',        color: '#0ea5e9',              icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>', order: 13 },
  vocabulary:      { label: 'Vocabulary Builder',        color: '#06b6d4',              icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>', order: 14 },
  modelResponse:   { label: 'Model Response',            color: '#d946ef',              icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>', order: 15 },
  sourceAnalysis:  { label: 'Source Analysis',           color: '#f97316',              icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>', order: 16 },
  staveNotation:   { label: 'Stave Notation',            color: '#7c3aed',              icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', order: 18 },
  rhythmTool:      { label: 'Rhythm & Percussion',       color: '#a855f7',              icon: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/>', order: 19 },
  artCritique:     { label: 'Art Critique Guide',         color: '#ec4899',              icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>', order: 20 },
  designProcess:   { label: 'Design Process',             color: '#14b8a6',              icon: '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/>', order: 21 },
  recipeBuilder:   { label: 'Recipe & Nutrition',         color: '#f97316',              icon: '<path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10H5a7 7 0 0 0 14 0z"/><line x1="12" y1="17" x2="12" y2="22"/>', order: 22 },
  kitchenLayout:   { label: 'Kitchen Layout',             color: '#0d9488',              icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>', order: 23 },
};

function setComponent(key, content, meta = '') {
  lessonComponents[key] = { content, meta, updatedAt: Date.now() };
  autoSaveComponents();
}

function removeComponent(key) {
  delete lessonComponents[key];
  autoSaveComponents();
}

function autoSaveComponents() {
  scheduleAutosave();
}

/* ── Autosave ──────────────────────────────────────────────────────────────
 * Keeps work safe as the teacher goes. A brand-new draft used to persist
 * NOTHING until an explicit Save; now, once there's real content (an AI reply
 * or a generated component), autosave creates the lesson and thereafter keeps
 * it up to date — debounced, with a quiet "Saved" indicator. The explicit Save
 * dialog still exists for naming, class and status. */
let autosaveTimer = null;

/** A clean title for an autosaved draft (teacher's words, minus context tags). */
function deriveLessonTitle() {
  if (currentLessonId) { const l = Store.getLesson(currentLessonId); if (l?.title) return l.title; }
  const firstUser = chatMessages.find(m => m.role === 'user');
  let t = firstUser ? String(firstUser.content || '') : '';
  t = t.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();          // drop bracketed context/attachment notes
  if (!t && planClassContext) t = `${planClassContext.subject || 'Lesson'} — ${planClassContext.name || ''}`.trim();
  t = t.slice(0, 60).trim();
  return t || 'Untitled lesson';
}

function markAutosave(state) {
  const el = document.getElementById('lp-autosave');
  if (!el) return;
  clearTimeout(el._t);
  if (state === 'saving') { el.textContent = 'Saving…'; el.style.opacity = '0.75'; return; }
  el.innerHTML = '&#10003; Saved';
  el.style.opacity = '1';
  el._t = setTimeout(() => { el.textContent = 'Saved'; el.style.opacity = '0.5'; }, 1800);
}

function scheduleAutosave() {
  // Nothing worth saving yet → don't create empty drafts.
  const hasContent = chatMessages.some(m => m.role === 'assistant') || Object.keys(lessonComponents).length > 0;
  if (!hasContent) return;
  markAutosave('saving');
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { autosaveTimer = null; autosaveNow(); }, 800);
}

function autosaveNow() {
  const hasContent = chatMessages.some(m => m.role === 'assistant') || Object.keys(lessonComponents).length > 0;
  if (!hasContent) return;
  const data = {
    components: { ...lessonComponents },
    chatHistory: stripAttachmentData(chatMessages),
    plan: chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n---\n\n')
  };
  if (currentLessonId) {
    Store.updateLesson(currentLessonId, data);
  } else {
    const title = deriveLessonTitle();
    const created = Store.addLesson({ title, classId: planClassContext?.id || null, status: 'draft', ...data });
    if (!created) return;
    currentLessonId = created.id;
    // Point the URL at the new draft WITHOUT a re-render (replaceState doesn't
    // fire hashchange), so a reload reopens it.
    try { history.replaceState(null, '', '#/lesson-planner/' + created.id); } catch { /* ignore */ }
    const sub = document.getElementById('lp-canvas-subtitle');
    if (sub) sub.textContent = `Editing: ${title}`;
  }
  markAutosave('saved');
}

/* ── WS-C: on-demand [EXPAND:] expansion chips ──
 * Plans/components are concise scaffolds; each chip generates one section
 * expansion on demand. Results cache on the lesson as
 * lesson.expansions = { "<slug>::<verb>": markdown } — one flat map for plan
 * AND component chips (generator prompts namespace their own slugs). */

/* Heading of the section a chip belongs to: nearest preceding h1-h5 inside
 * the chip's rendered block. Falls back to the slug with dashes → spaces. */
function expandChipHeading(chip) {
  const scope = chip.closest('.doc-canvas, .chat-msg, #lesson-components') || chip.parentElement;
  let best = null;
  if (scope) {
    scope.querySelectorAll('h1,h2,h3,h4,h5').forEach(h => {
      if (h.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING) best = h;
    });
  }
  const headingText = best?.textContent?.trim();
  return headingText || (chip.dataset.expandSlug || '').replace(/-/g, ' ');
}

/* Auto-mount every cached expansion whose chip is present under rootEl.
 * mountExpansion no-ops for keys with no matching chip on screen. */
function mountCachedExpansions(rootEl) {
  if (!rootEl || !currentLessonId) return;
  const expansions = Store.getLesson(currentLessonId)?.expansions;
  if (!expansions || typeof expansions !== 'object') return;
  Object.entries(expansions).forEach(([key, body]) => {
    const sep = key.indexOf('::');
    if (sep < 1 || typeof body !== 'string' || !body) return;
    mountExpansion(rootEl, key.slice(0, sep), key.slice(sep + 2), body)
      .forEach(block => processLatex(block));
  });
}

function renderComponents(container) {
  const el = container.querySelector('#lesson-components');
  if (!el) return;

  // Components done-state feeds the journey bar — keep it in step (WS-A)
  renderJourneyBar(container);

  const keys = Object.keys(lessonComponents)
    .filter(k => lessonComponents[k]?.content)
    .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));

  if (keys.length === 0) {
    el.innerHTML = '';
    activeComponentTab = null;
    return;
  }

  // Auto-select first tab if none active or current tab removed
  if (!activeComponentTab || !keys.includes(activeComponentTab)) {
    activeComponentTab = keys[0];
  }

  const activeComp = lessonComponents[activeComponentTab];
  const activeMeta = COMPONENT_META[activeComponentTab] || { label: activeComponentTab, color: 'var(--ink-muted)', icon: '', order: 99 };
  // meta is a plain string on legacy components, or { label, structured } on
  // components saved with structured AI results (A4) — display only the label.
  const activeMetaLabel = typeof activeComp.meta === 'string' ? activeComp.meta : (activeComp.meta?.label || '');

  el.innerHTML = `
    <div style="margin-top:var(--sp-5);">
      <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
        <span class="text-overline" style="color:var(--ink-faint);">Lesson Components</span>
        <span class="badge badge-blue" style="font-size:0.6875rem;">${keys.length}</span>
      </div>

      <!-- Component Tabs -->
      <div style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:var(--sp-3);border-bottom:2px solid var(--border-light);padding-bottom:0;">
        ${keys.map(key => {
          const m = COMPONENT_META[key] || { label: key, color: 'var(--ink-muted)', icon: '' };
          const isActive = key === activeComponentTab;
          return `<button class="component-tab" data-tab="${key}" style="
            display:inline-flex;align-items:center;gap:4px;padding:6px 10px;font-size:0.75rem;font-weight:${isActive ? '600' : '400'};
            color:${isActive ? 'var(--accent)' : 'var(--ink-muted)'};background:${isActive ? 'var(--accent-light)' : 'transparent'};
            border:none;border-bottom:2px solid ${isActive ? 'var(--accent)' : 'transparent'};margin-bottom:-2px;
            border-radius:var(--radius-md) var(--radius-md) 0 0;cursor:pointer;transition:all 0.15s;white-space:nowrap;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${isActive ? m.color : 'currentColor'}" stroke-width="2">${m.icon}</svg>
            ${m.label}
          </button>`;
        }).join('')}
      </div>

      <!-- Active Component Content -->
      <div class="card" style="border-top:3px solid ${activeMeta.color};overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${activeMeta.color}" stroke-width="2">${activeMeta.icon}</svg>
            <span style="font-size:0.875rem;font-weight:600;color:var(--ink);">${activeMeta.label}</span>
            ${activeMetaLabel ? `<span style="font-size:0.6875rem;color:var(--ink-faint);">${esc(activeMetaLabel)}</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp-1);">
            ${['worksheet','stimulus','vocabulary','modelResponse','sourceAnalysis','exitTicket','cceDiscussion'].includes(activeComponentTab) ? `
            <button class="btn btn-ghost btn-sm component-preview" data-key="${activeComponentTab}" title="Student Preview — see how students will see this" style="padding:2px 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>` : ''}
            <button class="btn btn-ghost btn-sm component-refresh" data-key="${activeComponentTab}" title="Regenerate" style="padding:2px 4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm component-remove" data-key="${activeComponentTab}" title="Remove" style="padding:2px 4px;color:var(--danger);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        ${activeComponentTab === 'seatPlan' ? buildSeatPlanVisual(activeComp) : ''}
        <div style="padding:var(--sp-4);font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);max-height:600px;overflow-y:auto;">
          ${md(activeComp.content)}
        </div>
      </div>
    </div>`;

  // Wire remove buttons
  el.querySelectorAll('.component-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.dataset.key;
      removeComponent(key);
      renderComponents(container);
    });
  });

  // Wire refresh buttons
  el.querySelectorAll('.component-refresh').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.dataset.key;
      // Trigger the corresponding tool
      const toolBtnMap = {
        lisc: '#ai-lisc-btn',
        review: '#ai-review-btn',
        rubric: '#ai-rubric-btn',
        grouping: '#ai-group-btn',
        timeline: '#ai-timeline-btn',
        exitTicket: '#ai-exit-ticket-btn',
        differentiation: '#ai-differentiation-btn',
        youtubeVideos: '#ai-youtube-btn',
        simulations: '#ai-simulations-btn',
        worksheet: '#ai-worksheet-btn',
        discussionPrompts: '#ai-discussion-btn',
        stimulus: '#ai-stimulus-btn',
        vocabulary: '#ai-vocabulary-btn',
        modelResponse: '#ai-model-response-btn',
        sourceAnalysis: '#ai-source-analysis-btn',
        seatPlan: '#spatial-layout-btn',
      };
      if (toolBtnMap[key]) container.querySelector(toolBtnMap[key])?.click();
    });
  });

  // Wire tab clicks
  el.querySelectorAll('.component-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeComponentTab = tab.dataset.tab;
      renderComponents(container);
    });
  });

  // Student preview — opens a clean print-friendly window showing what students would see
  el.querySelectorAll('.component-preview').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const comp = lessonComponents[key];
      if (!comp?.content) return;
      const meta = COMPONENT_META[key] || { label: key };
      // Strip teacher notes, mark schemes, teacher-only annotations
      let studentContent = stripExpandMarkers(comp.content)
        .replace(/###?\s*Teacher Notes[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/###?\s*Mark Scheme[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/###?\s*Facilitation[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/###?\s*How to Use[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/###?\s*Differentiation[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/###?\s*Common Pitfalls[\s\S]*?(?=###?\s|$)/gi, '')
        .replace(/\*E21CC:.*?\*/g, '')
        .replace(/— \*[^*]+\*/g, '')
        .trim();
      const previewWin = window.open('', '_blank');
      if (!previewWin) { showToast('Allow pop-ups for this site to open the preview.', 'danger'); return; }
      previewWin.document.write(`<!DOCTYPE html><html><head><title>${esc(meta.label)} — Student View</title>
        <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.8;font-size:15px}
        h1{font-size:18px;border-bottom:2px solid #4361ee;padding-bottom:8px;color:#4361ee}
        h2,h3,h4{margin:16px 0 8px}strong{font-weight:600}ul,ol{padding-left:20px}
        table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:8px 12px;border:1px solid #e2e8f0}th{font-weight:600;background:#f1f5f9}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:12px;border-bottom:1px solid #e2e8f0}
        .name-line{display:flex;gap:24px;font-size:13px;color:#64748b;margin-bottom:16px}
        .name-line span{border-bottom:1px solid #94a3b8;min-width:120px;display:inline-block}
        @media print{body{margin:0;padding:16px}}</style></head>
        <body>
          <div class="header"><h1>${esc(meta.label)}</h1><span style="font-size:12px;color:#94a3b8;">Co-Cher</span></div>
          <div class="name-line">Name: <span>&nbsp;</span> Class: <span>&nbsp;</span> Date: <span>&nbsp;</span></div>
          ${md(studentContent)}
        </body></html>`);
      previewWin.document.close();
    });
  });

  // Cached expansions re-mount under their chips on every components re-render
  mountCachedExpansions(el);
}

/* ── Visual Seating Plan: render an SVG classroom view ──
 * Accepts the full seatPlan component ({ content, meta }) or a bare markdown
 * string. When the component carries a structured result (meta.structured,
 * A4) the SVG is built directly from it; otherwise the legacy regex parse of
 * the markdown keeps older saved components rendering exactly as before. */
function buildSeatPlanVisual(comp) {
  const text = typeof comp === 'string' ? comp : (comp?.content || '');
  const structured = (comp && typeof comp === 'object' && comp.meta && typeof comp.meta === 'object')
    ? comp.meta.structured : null;

  const groups = [];

  // Structured path: positions honoured exactly as the regex path captured them
  if (structured && Array.isArray(structured.groups)) {
    structured.groups.forEach((g, i) => {
      const members = (g.members || []).map(n => String(n).trim()).filter(Boolean);
      if (members.length === 0) return;
      const numMatch = String(g.name || '').match(/(\d+)/);
      groups.push({
        num: numMatch ? parseInt(numMatch[1]) : i + 1,
        position: g.position || '',
        members
      });
    });
  }

  // Legacy path: parse groups and positions from the AI seating plan text
  if (groups.length === 0) {
    const groupRegex = /###?\s*Group\s*(\d+)[^]*?(?:\*\*Position:\*\*|Position:)\s*([^\n]+)[^]*?(?:\*\*Members?:\*\*|Members?:)\s*([^\n]+)/gi;
    let m;
    while ((m = groupRegex.exec(text)) !== null) {
      const num = parseInt(m[1]);
      const position = m[2].trim();
      const members = m[3].replace(/\*\*/g, '').split(/,\s*/).map(n => n.trim()).filter(Boolean);
      if (members.length > 0) groups.push({ num, position, members });
    }
  }

  // Fallback: try simpler patterns if structured parsing didn't work
  if (groups.length === 0) {
    const simpleGroups = [];
    const lines = text.split('\n');
    let currentGroup = null;
    for (const line of lines) {
      const gm = line.match(/Group\s*(\d+)/i);
      if (gm) {
        if (currentGroup && currentGroup.members.length > 0) simpleGroups.push(currentGroup);
        currentGroup = { num: parseInt(gm[1]), position: '', members: [] };
      }
      if (currentGroup) {
        const posMatch = line.match(/Position:\s*(.+)/i);
        if (posMatch) currentGroup.position = posMatch[1].replace(/\*\*/g, '').trim();
        const memMatch = line.match(/Members?:\s*(.+)/i);
        if (memMatch) {
          currentGroup.members = memMatch[1].replace(/\*\*/g, '').split(/,\s*/).map(n => n.trim()).filter(Boolean);
        }
      }
    }
    if (currentGroup && currentGroup.members.length > 0) simpleGroups.push(currentGroup);
    groups.push(...simpleGroups);
  }

  if (groups.length === 0) return '';

  // Layout configuration — dynamic sizing based on group count
  const totalGroups = groups.length;
  const cols = Math.min(totalGroups, 4);
  const rows = Math.ceil(totalGroups / cols);
  const DESK_W = 110, DESK_H = 64;
  const CELL_PAD_X = 16, CELL_PAD_Y = 20;
  const cellW = DESK_W + CELL_PAD_X * 2;
  const cellH = DESK_H + CELL_PAD_Y * 2 + 14; // 14 for group label above
  const W = cellW * cols + 24;  // 24 for outer padding
  const H = 44 + cellH * rows;  // 44 for teacher area
  const colors = ['#4361ee', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

  let desks = '';
  groups.forEach((g, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = 12 + cellW * col + cellW / 2;
    const cy = 44 + cellH * row + CELL_PAD_Y + 14 + DESK_H / 2;
    const color = colors[idx % colors.length];

    // Draw desk rectangle with softer fill and border
    desks += `<rect x="${cx - DESK_W / 2}" y="${cy - DESK_H / 2}" width="${DESK_W}" height="${DESK_H}" rx="8" fill="${color}10" stroke="${color}" stroke-width="1" opacity="0.85"/>`;

    // Group label above desk
    desks += `<text x="${cx}" y="${cy - DESK_H / 2 - 6}" text-anchor="middle" font-size="9" font-weight="700" fill="${color}" opacity="0.9">Group ${g.num}</text>`;

    // Student names inside the desk with proper padding
    const maxShow = Math.min(g.members.length, 4);
    const lineH = 13;
    const nameStart = cy - ((maxShow - 1) * lineH) / 2;
    for (let i = 0; i < maxShow; i++) {
      const name = g.members[i].length > 16 ? g.members[i].slice(0, 14) + '..' : g.members[i];
      desks += `<text x="${cx}" y="${nameStart + i * lineH}" text-anchor="middle" font-size="9" fill="var(--ink,#334155)">${esc(name)}</text>`;
    }
    if (g.members.length > maxShow) {
      desks += `<text x="${cx}" y="${nameStart + maxShow * lineH}" text-anchor="middle" font-size="8" fill="var(--ink-faint,#94a3b8)">+${g.members.length - maxShow} more</text>`;
    }
  });

  // Teacher position at top
  const teacherArea = `
    <rect x="${W / 2 - 44}" y="6" width="88" height="24" rx="6" fill="var(--accent,#4361ee)" opacity="0.1" stroke="var(--accent,#4361ee)" stroke-width="1" stroke-opacity="0.4"/>
    <text x="${W / 2}" y="22" text-anchor="middle" font-size="9" font-weight="600" fill="var(--accent,#4361ee)">Teacher</text>
  `;

  return `
    <div style="padding:var(--sp-4);background:var(--bg-subtle);border-bottom:1px solid var(--border-light);">
      <div style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);margin-bottom:var(--sp-3);">Classroom View</div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;background:var(--bg,#fff);border-radius:10px;border:1px solid var(--border-light);overflow:hidden;">
        ${teacherArea}
        ${desks}
      </svg>
    </div>`;
}


/* ── Build follow-up prompts based on conversation context ── */
function buildFollowUpPrompts(messages) {
  const lastAI = messages[messages.length - 1]?.content?.toLowerCase() || '';
  const subj = planClassContext?.subject || '';
  const followUps = [];
  const eeeSelections = getEEESelections();
  const componentKeys = Object.keys(lessonComponents);

  // Context-aware follow-ups based on what AI just discussed
  if (lastAI.includes('lesson') && !componentKeys.includes('lisc')) {
    followUps.push({ label: 'Generate LI & SC for this', prompt: 'Based on the lesson plan above, generate the Learning Intentions and Success Criteria.' });
  }
  if (lastAI.includes('activit') || lastAI.includes('group')) {
    followUps.push({ label: 'How should I group students?', prompt: 'What grouping strategies would work best for the activities described above?' });
  }
  if (lastAI.includes('lesson') && !componentKeys.includes('timeline')) {
    followUps.push({ label: 'Create a timeline', prompt: 'Create a pacing timeline for this lesson. I have [40/60] minutes.' });
  }
  if ((lastAI.includes('differentiat') || lastAI.includes('scaffold')) && !componentKeys.includes('differentiation')) {
    followUps.push({ label: 'Differentiation strategies', prompt: 'Suggest differentiation strategies for this lesson — both scaffolding for weaker students and extension for stronger learners.' });
  }
  if (lastAI.includes('assess') || lastAI.includes('check for understanding')) {
    followUps.push({ label: 'Design an exit ticket', prompt: 'Design 3 exit ticket questions for this lesson that check for understanding at different levels.' });
  }

  // EEE-aware follow-ups
  if (eeeSelections.includes('youtubeVideos') && !componentKeys.includes('youtubeVideos') && (lastAI.includes('video') || lastAI.includes('visual') || followUps.length < 2)) {
    followUps.push({ label: 'Find YouTube videos', prompt: 'Find relevant YouTube videos I could use as a hook or to reinforce key concepts in this lesson.' });
  }
  if (eeeSelections.includes('stimulus') && !componentKeys.includes('stimulus') && (lastAI.includes('text') || lastAI.includes('passage') || lastAI.includes('source'))) {
    followUps.push({ label: 'Create stimulus material', prompt: `Create a stimulus passage or source text for this lesson, suitable for ${subj || 'the subject'} students.` });
  }
  if (eeeSelections.includes('worksheet') && !componentKeys.includes('worksheet') && followUps.length < 3) {
    followUps.push({ label: 'Generate a worksheet', prompt: 'Generate a student worksheet for this lesson with mixed question types and clear instructions.' });
  }
  if (eeeSelections.includes('vocabulary') && !componentKeys.includes('vocabulary') && (lastAI.includes('vocab') || lastAI.includes('key term') || lastAI.includes('word'))) {
    followUps.push({ label: 'Build vocabulary list', prompt: 'Create a vocabulary word wall with key terms, definitions, and sentence frames for this lesson.' });
  }

  // General follow-ups if we have few
  if (followUps.length < 2) {
    followUps.push({ label: 'How can I make this more engaging?', prompt: 'How can I make this lesson more engaging and student-centred? Suggest concrete improvements.' });
  }
  if (followUps.length < 3) {
    followUps.push({ label: 'Add an E21CC focus', prompt: 'Which E21CC domain (CAIT, CCI, or CGC) could I intentionally develop in this lesson, and how?' });
  }

  return followUps.slice(0, 3);
}

/* ── Build quick prompts based on classes/subjects ── */
function buildQuickPrompts(classes) {
  const prompts = [];

  // Use planClassContext first if available
  const subjects = planClassContext?.subject
    ? [planClassContext.subject]
    : [...new Set(classes.map(c => c.subject).filter(Boolean))];
  const levels = planClassContext?.level
    ? [planClassContext.level]
    : [...new Set(classes.map(c => c.level).filter(Boolean))];

  const subj = subjects[0] || '[subject]';
  const level = levels[0] || '[level e.g. Sec 3]';
  const hasSub = subjects.length > 0;

  // Subject-specific prompts — each with label, desc (card hint), and prompt (full editable text)
  const subjectBank = {
    'Mathematics': [
      { label: 'Plan a Maths lesson', desc: 'Hands-on activities, real-world applications, collaborative problem-solving', prompt: `Plan a ${level} Mathematics lesson on [topic e.g. Quadratic Equations]. Include hands-on activities, real-world applications, and opportunities for collaborative problem-solving. The lesson is [40/60] minutes.` },
      { label: 'Maths with E21CC focus', desc: 'Intentional CAIT development with formative checks', prompt: `Design a ${level} Mathematics lesson on [topic] that intentionally develops CAIT through [open-ended problem solving / pattern recognition]. Include a formative check and an EdTech-enhanced activity.` },
    ],
    'Science': [
      { label: 'Plan a Science lesson', desc: 'Inquiry-based learning with investigation and real-world links', prompt: `Plan a ${level} Science lesson on [topic e.g. Chemical Bonding]. Use inquiry-based learning with a hands-on investigation and a clear link to real-world phenomena. The lesson is [40/60] minutes.` },
      { label: 'Design a practical lesson', desc: 'Pre-lab discussion, guided investigation, POE framework', prompt: `Design a ${level} Science practical lesson on [topic]. Include pre-lab discussion, safety briefing, guided investigation with prediction-observation-explanation, and a debrief.` },
    ],
    'Chemistry': [
      { label: 'Plan a Chemistry lesson', desc: 'Concept-to-application with molecular visualisation', prompt: `Plan a ${level} Chemistry lesson on [topic e.g. Organic Chemistry]. Connect concepts to real-world applications and include opportunities for molecular visualisation. The lesson is [40/60] minutes.` },
      { label: 'Chemistry with simulations', desc: 'PhET/virtual labs with scaffolded inquiry', prompt: `Design a ${level} Chemistry lesson on [topic] incorporating interactive simulations (PhET/virtual labs). Include scaffolded inquiry questions and an E21CC focus on CAIT.` },
    ],
    'Physics': [
      { label: 'Plan a Physics lesson', desc: 'Demonstrations, problem-solving, and data analysis', prompt: `Plan a ${level} Physics lesson on [topic e.g. Forces & Motion]. Include demonstrations, collaborative problem-solving, and data analysis activities. The lesson is [40/60] minutes.` },
    ],
    'Biology': [
      { label: 'Plan a Biology lesson', desc: 'Visual models, investigation, real-world health/ecology links', prompt: `Plan a ${level} Biology lesson on [topic e.g. Cell Division]. Include visual models, collaborative investigation, and real-world applications in health or ecology. The lesson is [40/60] minutes.` },
    ],
    'English': [
      { label: 'Plan an English lesson', desc: 'Model texts, peer feedback, differentiated scaffolding', prompt: `Plan a ${level} English Language lesson on [topic e.g. Persuasive Writing / Comprehension]. Include model texts, collaborative peer feedback, and differentiated scaffolding. The lesson is [40/60] minutes.` },
      { label: 'English with structured discussion', desc: 'Socratic seminar, think-pair-share, sentence frames', prompt: `Design a ${level} English lesson on [text/theme] that develops CCI through structured academic discussion (e.g. Socratic seminar, think-pair-share). Include sentence frames for different ability levels.` },
    ],
    'History': [
      { label: 'Plan a History lesson', desc: 'Source-based inquiry, multiple perspectives, SBQ practice', prompt: `Plan a ${level} History lesson on [topic e.g. Fall of Singapore]. Use source-based inquiry, structured discussion, and multiple perspectives. Include an SBQ-style activity. The lesson is [40/60] minutes.` },
    ],
    'Geography': [
      { label: 'Plan a Geography lesson', desc: 'Data analysis, fieldwork skills, sustainability links', prompt: `Plan a ${level} Geography lesson on [topic e.g. Plate Tectonics / Tourism]. Include data analysis, fieldwork skills, and connections to sustainability (CGC). The lesson is [40/60] minutes.` },
    ],
    'Social Studies': [
      { label: 'Plan a Social Studies lesson', desc: 'Structured inquiry, source analysis, perspective-taking', prompt: `Plan a ${level} Social Studies lesson on [issue e.g. Governance / Diversity]. Use structured inquiry, source analysis, and develop CGC through perspective-taking activities. The lesson is [40/60] minutes.` },
    ],
    'Chinese': [
      { label: 'Plan a Chinese lesson', desc: 'Vocabulary building, model texts, peer interaction', prompt: `Plan a ${level} Chinese Language lesson on [topic e.g. 口语交际 / 阅读理解]. Include vocabulary building, model texts, and peer interaction activities. The lesson is [40/60] minutes.` },
    ],
    'Malay': [
      { label: 'Plan a Malay lesson', desc: 'Vocabulary enrichment, collaborative writing, cultural links', prompt: `Plan a ${level} Malay Language lesson on [topic e.g. Karangan / Kefahaman]. Include vocabulary enrichment, collaborative writing, and cultural connections. The lesson is [40/60] minutes.` },
    ],
    'Tamil': [
      { label: 'Plan a Tamil lesson', desc: 'Vocabulary strategies, model responses, peer review', prompt: `Plan a ${level} Tamil Language lesson on [topic e.g. கட்டுரை / படிப்புணர்வு]. Include vocabulary strategies, model responses, and peer review activities. The lesson is [40/60] minutes.` },
    ],
    'CCE': [
      { label: 'Plan a CCE lesson', desc: 'Values discussion, contemporary issues, SEL, CCE2021 Big Ideas', prompt: `Plan a ${level} CCE lesson on [topic e.g. Cyber Wellness / Responsible Decision-Making / National Identity]. Use the CCE2021 framework (Big Ideas: Identity, Relationships, Choices). Include a values-based discussion with facilitation strategies and an SEL component. The lesson is [40/60] minutes.` },
      { label: 'CCE contemporary issues discussion', desc: 'Structured discussion on a real-world issue with multiple perspectives', prompt: `Design a ${level} CCE discussion on [contemporary issue e.g. AI & Ethics / Social Media & Mental Health / Climate Change]. Use Structured Academic Controversy or Four Corners. Connect to R3ICH values and NE dispositions. Include a scenario set in Singapore.` },
      { label: 'CCE with NE focus', desc: 'National Education — Sense of Belonging, Hope, Reality, Will to Act', prompt: `Plan a ${level} CCE lesson with a National Education focus for [NE Commemorative Day e.g. Total Defence Day / Racial Harmony Day / International Friendship Day / National Day]. Develop NE dispositions: Sense of Belonging, Sense of Hope, Sense of Reality, and The Will to Act. The lesson is [40/60] minutes.` },
      { label: 'CCE Cyber Wellness lesson', desc: 'Digital citizenship, online safety, responsible tech use', prompt: `Plan a ${level} CCE Cyber Wellness lesson on [topic e.g. Digital Footprint / Cyberbullying / Screen Time Management / Online Scams]. Address the Sense, Think and Act processes and the Cyber Wellness principles (Respect for Self and Others; Safe and Responsible Use). Include a realistic scenario involving social media or online interactions in a Singapore school context. Connect to R3ICH values (Responsibility, Respect) and E21CC (CGC). The lesson is [40/60] minutes.` },
      { label: 'CCE Mental Health & SEL', desc: 'Resilience, peer support, help-seeking, emotional regulation', prompt: `Plan a ${level} CCE Mental Health lesson on [topic e.g. Managing Exam Stress / Peer Support / Help-Seeking / Building Resilience]. Develop SEL competencies: Self-Awareness and Self-Management. Include a mindfulness or reflective activity, a scenario-based discussion, and strategies students can apply. Connect to R3ICH value of Resilience. The lesson is [40/60] minutes.` },
      { label: 'CCE Education & Career Guidance', desc: 'Self-discovery, career exploration, MySkillsFuture', prompt: `Plan a ${level} CCE ECG lesson on [topic e.g. Discovering My Strengths / Exploring Career Pathways / Work Values / Post-Secondary Options]. Help students develop self-awareness of interests, abilities, and values. Include a reflective activity (e.g. strengths inventory or values card sort) and connect to MySkillsFuture portal. The lesson is [40/60] minutes.` },
    ],
  };

  // Match subject-specific prompts
  if (hasSub) {
    for (const [key, bank] of Object.entries(subjectBank)) {
      if (subj.toLowerCase().includes(key.toLowerCase())) {
        prompts.push(...bank);
        break;
      }
    }
  }

  // Default subject prompt if no match
  if (prompts.length === 0) {
    prompts.push({ label: 'Plan a lesson', desc: 'Engaging activities, clear outcomes, E21CC development', prompt: `Plan a ${level} ${subj} lesson on [topic]. Include engaging activities, clear learning outcomes, and opportunities for student collaboration and E21CC development. The lesson is [40/60] minutes.` });
  }

  // Universal prompts (always available)
  prompts.push({ label: 'Develop CAIT in my lesson', desc: 'Critical & Inventive Thinking with concrete activities', prompt: `How can I intentionally develop Critical, Adaptive & Inventive Thinking (CAIT) in a ${level} ${subj} lesson on [topic]? Suggest 2-3 concrete activities with EdTech integration.` });
  prompts.push({ label: 'Differentiate for my class', desc: 'Scaffolding for weaker + extension for stronger learners', prompt: `Suggest differentiation strategies for a ${level} ${subj} lesson on [topic]. I have students who [need more scaffolding / are advanced / have specific learning needs]. Include both support and extension options.` });
  prompts.push({ label: 'E21CC across all domains', desc: 'Activities that build CAIT, CCI, and CGC together', prompt: `Suggest classroom activities for ${level} ${subj} that build all three E21CC domains: CAIT, CCI, and CGC. The topic is [topic]. Make activities practical for a [40/60]-minute lesson.` });
  prompts.push({ label: 'Lesson starter hooks', desc: 'Real-world "What if..." openers that spark curiosity', prompt: `Suggest 3 lesson starter hooks for ${level} ${subj} on [topic]. Each hook must be rooted in a real-world context or application. Use provocative framing like "What if I told you...", "Did you ever wonder...", or "Why do you think...". Make them vivid and relevant to students' lives. Include at least one EdTech-enhanced option.` });

  // EEE-aware prompts
  const eeeSelections = getEEESelections();
  if (eeeSelections.includes('stimulus')) {
    prompts.push({ label: 'Create stimulus material', desc: 'Comprehension passage or source with guided questions', prompt: `Create a comprehension passage or source text for ${level} ${subj} on [topic]. The passage should be [200-400] words, suitable for [ability level], and include 3-4 guided questions.` });
  }
  if (eeeSelections.includes('vocabulary')) {
    prompts.push({ label: 'Build a word wall', desc: 'Key terms, definitions, sentence frames, cloze passage', prompt: `Create a vocabulary word wall for ${level} ${subj} on [topic]. Include key terms with definitions, sentence frames, and one cloze passage for practice.` });
  }
  if (eeeSelections.includes('cceDiscussion')) {
    prompts.push({ label: 'CCE values discussion', desc: 'Structured CCE discussion with R3ICH values and scenario', prompt: `Create a CCE values discussion for ${level} students on [topic/issue]. Include a Singapore-context scenario, guiding questions linked to R3ICH values, and a facilitation strategy (Four Corners / Hot Seat / Circle Structure).` });
  }

  return prompts.slice(0, 6);
}

/* ══════════ Load existing lesson ══════════ */
export function renderForLesson(container, { id }) {
  const lesson = Store.getLesson(id);
  if (!lesson) { navigate('/lessons'); return; }
  currentLessonId = id;
  chatMessages = [...(lesson.chatHistory || [])];
  vigilanceNudged = false;
  vigilanceState = null;
  cceContext = null;  // kind already lives on the saved lesson
  render(container);
}

/* Route entry for /lesson-planner (no id): if a saved lesson was being
 * edited, start fresh — otherwise new chat turns silently auto-save into
 * the previously opened lesson. An unsaved draft (no id) is preserved.
 * Internal re-renders call render() directly and keep all state. */
export function renderNew(container) {
  if (currentLessonId) {
    currentLessonId = null;
    chatMessages = [];
    lessonComponents = {};
    planClassContext = null;
    cceContext = null;
  }
  vigilanceNudged = false;
  vigilanceState = null;
  render(container);
}

/* ── AI Tool definitions for compact toolbar ── */
const AI_TOOLS = [
  // Core tools (always visible)
  { id: 'ai-lisc-btn', label: 'LI / SC', icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>', color: 'var(--brand-navy, #000c53)', cat: 'planning', eee: 'lisc' },
  { id: 'ai-review-btn', label: 'Review', icon: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="M8 11l2 2 4-4"/>', color: '', cat: 'planning', eee: 'review' },
  { id: 'ai-rubric-btn', label: 'Rubric', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>', color: '', cat: 'assess', eee: 'rubric' },
  { id: 'ai-group-btn', label: 'Grouping', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', color: '', cat: 'planning', eee: 'grouping' },
  { id: 'ai-timeline-btn', label: 'Timeline', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>', color: '', cat: 'planning', eee: 'timeline' },
  { id: 'ai-exit-ticket-btn', label: 'Exit Ticket', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>', color: '', cat: 'assess', eee: 'exitTicket' },
  { id: 'ai-differentiation-btn', label: 'Differentiate', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>', color: '', cat: 'planning', eee: 'differentiation' },
  { id: 'ai-discussion-btn', label: 'Discussion', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="12" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>', color: '', cat: 'planning', eee: 'discussionPrompts' },
  // Enactment Enhancements (filtered by EEE selection)
  { id: 'ai-youtube-btn', label: 'YouTube', icon: '<polygon points="5 3 19 12 5 21 5 3"/>', color: '#ff0000', cat: 'core', eee: 'youtubeVideos' },
  { id: 'ai-simulations-btn', label: 'Simulations', icon: '<path d="M9 3h6v3H9z"/><path d="M7 6h10l2 4-4 3 4 3-2 5H7l-2-5 4-3-4-3z"/>', color: '#8b5cf6', cat: 'enactment', eee: 'simulations' },
  { id: 'build-sim-btn', label: 'Build a sim for this lesson', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>', color: '#8b5cf6', cat: 'enactment', eee: 'simulations' },
  { id: 'ai-worksheet-btn', label: 'Worksheet', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>', color: '', cat: 'enactment', eee: 'worksheet' },
  { id: 'ai-stimulus-btn', label: 'Stimulus', icon: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>', color: '#0ea5e9', cat: 'enactment', eee: 'stimulus' },
  { id: 'ai-vocabulary-btn', label: 'Vocabulary', icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>', color: '#06b6d4', cat: 'enactment', eee: 'vocabulary' },
  { id: 'ai-model-response-btn', label: 'Model Resp.', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15l2 2 4-4"/>', color: '#d946ef', cat: 'enactment', eee: 'modelResponse' },
  { id: 'ai-source-analysis-btn', label: 'Source Analysis', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>', color: '#f97316', cat: 'enactment', eee: 'sourceAnalysis' },
  { id: 'ai-stave-btn', label: 'Stave Notation', icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', color: '#7c3aed', cat: 'enactment', eee: 'staveNotation' },
  { id: 'ai-rhythm-btn', label: 'Rhythm', icon: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 2"/>', color: '#a855f7', cat: 'enactment', eee: 'rhythmTool' },
  { id: 'ai-art-critique-btn', label: 'Art Critique', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>', color: '#ec4899', cat: 'enactment', eee: 'artCritique' },
  { id: 'ai-design-process-btn', label: 'Design Process', icon: '<polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>', color: '#14b8a6', cat: 'enactment', eee: 'designProcess' },
  { id: 'ai-recipe-btn', label: 'Recipe & Nutrition', icon: '<path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10H5a7 7 0 0 0 14 0z"/>', color: '#f97316', cat: 'enactment', eee: 'recipeBuilder' },
  { id: 'ai-kitchen-btn', label: 'Kitchen Layout', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>', color: '#0d9488', cat: 'enactment', eee: 'kitchenLayout' },
  { id: 'spatial-layout-btn', label: 'Spatial Layout', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>', color: '', cat: 'planning', eee: 'seatPlan' },
  { id: 'ai-cross-subject-btn', label: 'Cross-Subject', icon: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>', color: '#0891b2', cat: 'core', eee: 'crossSubject' },
  { id: 'ai-resource-rec-btn', label: 'Recommend', icon: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>', color: '#059669', cat: 'core', eee: 'resourceRec' },
  // WS-4 Materials
  { id: 'ai-deck-btn', label: 'Slide Deck', icon: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><path d="M7 8h10"/><path d="M7 12h6"/>', color: '#b45309', cat: 'enactment', eee: 'slideDeck' },
  { id: 'ai-audio-btn', label: 'Audio Clip', icon: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>', color: '#be123c', cat: 'enactment', eee: 'audioClip' },
];

function buildToolbarHTML(mode) {
  // Filter tools based on EEE selections
  let visibleTools = AI_TOOLS.filter(t => isEEEEnabled(t.eee));

  // Smart subject-based floating: tools matching the current class subject go first
  const currentSubject = planClassContext?.subject || '';
  if (currentSubject) {
    const subjectNorm = currentSubject.toLowerCase();
    visibleTools = [...visibleTools].sort((a, b) => {
      const aEntry = EEE_REGISTRY[a.eee];
      const bEntry = EEE_REGISTRY[b.eee];
      const aMatch = aEntry?.subjects?.some(s => s === 'all' || s.toLowerCase() === subjectNorm) ? 1 : 0;
      const bMatch = bEntry?.subjects?.some(s => s === 'all' || s.toLowerCase() === subjectNorm) ? 1 : 0;
      return bMatch - aMatch; // subject-relevant tools first
    });
  }

  if (mode === 'dropdown') {
    const cats = { planning: 'Planning', assess: 'Assessment', enactment: 'Enactment' };
    return Object.entries(cats).map(([cat, label]) => {
      const tools = visibleTools.filter(t => t.cat === cat);
      if (tools.length === 0) return '';
      return `<div style="margin-bottom:var(--sp-2);">
        <div style="font-size:0.625rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);margin-bottom:2px;">${label}</div>
        ${tools.map(t => `<button class="btn btn-ghost btn-sm" id="${t.id}" title="${t.label}" style="width:100%;text-align:left;justify-content:flex-start;gap:var(--sp-2);${t.color ? 'color:' + t.color + ';' : ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${t.icon}</svg>
          <span style="font-size:0.8125rem;">${t.label}</span>
        </button>`).join('')}
      </div>`;
    }).join('');
  }
  // Two presentations share the same id / title / aria-label, so every click
  // handler and the touch-focus label CSS keep working unchanged:
  //   mode === 'icons'  → compact icon-only squares (the power-user toggle target)
  //   otherwise (default) → labelled chips: icon + visible text that wraps, so a
  //                         first-time teacher can read what each tool does.
  const compact = mode === 'icons';
  const renderTool = (t) => compact
    ? `<button class="btn btn-ghost btn-sm lp-tool-icon" id="${t.id}" title="${t.label}" aria-label="${esc(t.label)}" style="padding:6px;${t.color ? 'color:' + t.color + ';' : ''}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${t.icon}</svg>
      </button>`
    : `<button class="btn btn-ghost btn-sm lp-tool-chip" id="${t.id}" title="${t.label}" aria-label="${esc(t.label)}" style="padding:5px 9px;gap:6px;justify-content:flex-start;${t.color ? 'color:' + t.color + ';' : ''}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">${t.icon}</svg>
        <span style="font-size:0.75rem;font-weight:600;white-space:nowrap;">${esc(t.label)}</span>
      </button>`;

  // Grouped by subject relevance (recommended tools first) — applies to both
  // the labelled and compact presentations.
  if (currentSubject) {
    const subjectNorm = currentSubject.toLowerCase();
    const recommended = visibleTools.filter(t => {
      const entry = EEE_REGISTRY[t.eee];
      return entry?.subjects?.some(s => s === 'all' || s.toLowerCase() === subjectNorm);
    });
    const others = visibleTools.filter(t => !recommended.includes(t));

    let html = '';
    if (recommended.length > 0) {
      html += `<div style="display:flex;align-items:center;gap:4px;width:100%;margin-bottom:2px;">
        <span style="font-size:0.5625rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--accent);white-space:nowrap;">For ${currentSubject.replace(/</g,'&lt;')}</span>
        <div style="flex:1;height:1px;background:var(--border-light);"></div>
      </div>`;
      html += recommended.map(renderTool).join('');
      if (others.length > 0) {
        html += `<div style="display:flex;align-items:center;gap:4px;width:100%;margin-top:4px;margin-bottom:2px;">
          <span style="font-size:0.5625rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);white-space:nowrap;">Other Tools</span>
          <div style="flex:1;height:1px;background:var(--border-light);"></div>
        </div>`;
        html += others.map(renderTool).join('');
      }
      return html;
    }
  }
  // No subject context — flat list
  return visibleTools.map(renderTool).join('');
}

/* ══════════ Voice dictation mic (WS-V) ══════════
 * Press-to-talk mic that FILLS a text field — it never sends or saves. The
 * teacher leads: dictation only drops recognised text at the cursor, and the
 * existing Send control is still the only thing that submits. The mic is
 * rendered ONLY when the browser supports speech input; unsupported browsers
 * get no mic at all and the composer behaves exactly as before. */
function micButtonHTML({ id, statusId, label = 'Dictate', title = 'Dictate — fills the box; you still press Send yourself' }) {
  if (!isVoiceInputSupported()) return '';
  return `<button type="button" class="cocher-mic-btn btn btn-ghost btn-sm" id="${esc(id)}" aria-pressed="false" aria-label="${esc(label)}" title="${esc(title)}" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;">
      <svg class="cocher-mic-glyph" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      <span class="cocher-mic-word" style="font-size:0.6875rem;font-weight:600;">${esc(label)}</span>
    </button>
    <span id="${esc(statusId)}" class="cocher-mic-status" role="status" aria-live="polite" style="display:none;font-size:0.6875rem;color:var(--ink-muted);align-self:center;"></span>`;
}

/* Insert recognised text at the caret (or the end) of a text field, adding a
 * separating space when joining onto existing words, then fire an 'input' event
 * so auto-resize / counters react to the programmatic change. */
function insertTextAtCursor(field, text) {
  const chunk = (text || '').trim();
  if (!field || !chunk) return;
  const hasSel = typeof field.selectionStart === 'number' && typeof field.selectionEnd === 'number';
  const start = hasSel ? field.selectionStart : field.value.length;
  const end = hasSel ? field.selectionEnd : field.value.length;
  const before = field.value.slice(0, start);
  const after = field.value.slice(end);
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  const piece = (needsSpace ? ' ' : '') + chunk;
  field.value = before + piece + after;
  const caret = start + piece.length;
  try { field.selectionStart = field.selectionEnd = caret; } catch (_) { /* input types without selection */ }
  field.focus();
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

/* Wire a mic button (built by micButtonHTML) to a target field. No-op when
 * speech is unsupported or the elements are missing. Toggles listening state
 * (aria-pressed + a visible "Listening…" label) and only ever FILLS the field. */
function wireMic(root, { buttonId, statusId, fieldId, lang = 'en-SG' }) {
  if (!isVoiceInputSupported() || !root) return;
  const button = root.querySelector('#' + buttonId);
  const field = root.querySelector('#' + fieldId);
  const statusEl = statusId ? root.querySelector('#' + statusId) : null;
  if (!button || !field) return;

  const idleLabel = button.getAttribute('aria-label') || 'Dictate';
  const wordEl = button.querySelector('.cocher-mic-word');
  let listening = false;

  const setState = (on) => {
    listening = on;
    button.setAttribute('aria-pressed', String(on));
    button.classList.toggle('is-listening', on);
    button.setAttribute('aria-label', on ? 'Stop dictation' : idleLabel);
    button.style.color = on ? 'var(--danger, #dc2626)' : '';
    if (wordEl) wordEl.textContent = on ? 'Listening…' : idleLabel;
    if (statusEl) {
      statusEl.textContent = on ? 'Listening…' : '';
      statusEl.style.display = on ? '' : 'none';
    }
  };

  const dictation = createDictation({
    lang,
    onInterim(interim) {
      if (statusEl && interim) { statusEl.textContent = interim; statusEl.style.display = ''; }
    },
    onResult(finalText) {
      // FILL only — never submit. The teacher still presses Send.
      insertTextAtCursor(field, finalText);
    },
    onError() { setState(false); },
    onEnd() { setState(false); },
  });

  button.addEventListener('click', () => {
    if (listening) { dictation.stop(); return; }
    if (dictation.start()) setState(true);
  });
}

/* ══════════ Main render ══════════ */
export function render(container) {
  const classes = Store.getClasses();
  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;

  // Pick up "Plan from Class" context from sessionStorage
  const planClassId = sessionStorage.getItem('cocher_plan_class_id');
  if (planClassId && !currentLessonId && chatMessages.length === 0) {
    planClassContext = {
      id: planClassId,
      name: sessionStorage.getItem('cocher_plan_class_name') || '',
      subject: sessionStorage.getItem('cocher_plan_class_subject') || '',
      level: sessionStorage.getItem('cocher_plan_class_level') || ''
    };
    sessionStorage.removeItem('cocher_plan_class_id');
    sessionStorage.removeItem('cocher_plan_class_name');
    sessionStorage.removeItem('cocher_plan_class_subject');
    sessionStorage.removeItem('cocher_plan_class_level');
  }

  // WS-5: CCE planner prefill — topic + content-area framing handed over by
  // the CCE view's "Plan a CCE lesson". Removed once consumed (same handoff
  // semantics as cocher_plan_class_* above); an unsaved draft keeps priority
  // and the prefill applies on the next fresh conversation instead.
  const plannerPrefillRaw = sessionStorage.getItem('cocher_planner_prefill');
  if (plannerPrefillRaw && !currentLessonId && chatMessages.length === 0) {
    sessionStorage.removeItem('cocher_planner_prefill');
    try {
      const prefill = JSON.parse(plannerPrefillRaw);
      if (prefill?.kind === 'cce') {
        cceContext = { contentArea: prefill.contentArea || '', topic: prefill.topic || '', pendingInput: true };
        // GROW is the natural coaching frame for CCE conversations — pre-select
        // its chip when the builtin exists (the teacher can still toggle it off).
        if ((Store.getFrameworks?.() || []).some(f => f.id === 'fw_builtin_grow') && !selectedFrameworkIds.includes('fw_builtin_grow')) {
          selectedFrameworkIds = [...selectedFrameworkIds, 'fw_builtin_grow'];
        }
      }
    } catch { /* malformed prefill — ignore */ }
  }

  // Pick up reflection insights from previous lesson
  const reflectionInsightsRaw = sessionStorage.getItem('cocher_reflection_insights');
  let reflectionInsights = null;
  if (reflectionInsightsRaw && !currentLessonId && chatMessages.length === 0) {
    try {
      reflectionInsights = JSON.parse(reflectionInsightsRaw);
      sessionStorage.removeItem('cocher_reflection_insights');
    } catch {}
  } else {
    sessionStorage.removeItem('cocher_reflection_insights');
  }

  // Pick up spatial layout link from Spatial Designer
  const incomingSpatialId = sessionStorage.getItem('cocher_link_spatial_layout');
  if (incomingSpatialId) {
    sessionStorage.removeItem('cocher_link_spatial_layout');
    // If we have an existing lesson, link it; otherwise store for linking on save
    if (currentLessonId) {
      Store.updateLesson(currentLessonId, { spatialLayout: incomingSpatialId });
    }
    // Store so the spatial section renders the link
    if (!currentLessonId) {
      sessionStorage.setItem('cocher_pending_spatial_layout', incomingSpatialId);
    }
  }

  // If a spatial layout was deferred earlier (no lesson yet) and we now have a
  // lesson to attach it to, apply it and clear the handoff key.
  consumePendingSpatialLayout();

  // Status badge for current lesson
  const statusBadgeHTML = currentLesson ? (() => {
    const colors = { draft: 'badge-gray', ready: 'badge-blue', completed: 'badge-green' };
    const labels = { draft: 'Draft', ready: 'Ready', completed: 'Done' };
    return `<span class="badge ${colors[currentLesson.status] || 'badge-gray'} badge-dot">${labels[currentLesson.status] || 'Draft'}</span>`;
  })() : '';

  container.innerHTML = `
    <div style="padding:var(--sp-2) var(--sp-3) 0;">
      ${renderWorkflowBreadcrumb('plan')}
    </div>
    <div class="lp-layout" id="lp-layout" style="height:calc(100% - 44px);overflow:hidden;">
      <!-- Chat Column -->
      <div class="lp-chat-col" style="display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;">
        <div class="chat-header" style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <div>
              <div class="chat-header-title">Co-Cher Assistant</div>
              <div class="chat-header-subtitle">Lesson experience, design & planning</div>
            </div>
            ${statusBadgeHTML}
          </div>
          <div style="display:flex;gap:var(--sp-2);align-items:center;">
            <button class="lp-panel-toggle" id="show-plan-btn" title="View plan canvas">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Canvas
            </button>
            ${chatMessages.length >= 2 ? `
              <button class="btn btn-ghost btn-sm" id="undo-btn" title="Undo last exchange">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              </button>
            ` : ''}
            <button class="btn btn-ghost btn-sm" id="new-chat-btn" title="New conversation">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New
            </button>
          </div>
        </div>

        ${planClassContext ? `
          <div class="chat-context-banner" id="class-context-banner" style="flex-shrink:0;padding:var(--sp-2) var(--sp-4);background:var(--accent-light);border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:0.8125rem;color:var(--accent-dark);">
              <strong>Planning for:</strong> ${planClassContext.name}${planClassContext.subject ? ' · ' + planClassContext.subject : ''}${planClassContext.level ? ' · ' + planClassContext.level : ''}
            </span>
            <button class="btn btn-ghost btn-sm" id="clear-class-context" style="padding:2px 6px;font-size:0.75rem;">Clear</button>
          </div>
        ` : ''}

        ${reflectionInsights ? `
          <div id="reflection-insights-banner" style="flex-shrink:0;padding:var(--sp-2) var(--sp-4);background:linear-gradient(90deg, rgba(99,102,241,0.08), rgba(236,72,153,0.06));border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.4;">
              <strong style="color:var(--accent);">Reflection insights loaded</strong> from "${esc(reflectionInsights.fromLesson)}" — Co-Cher will use these to inform your next lesson.
            </span>
            <button class="btn btn-ghost btn-sm" id="clear-reflection-insights" style="padding:2px 6px;font-size:0.75rem;">Dismiss</button>
          </div>
        ` : ''}

        <!-- KB Context Attachments -->
        <div id="kb-context-bar" style="flex-shrink:0;${attachedKBContext.length > 0 ? '' : 'display:none;'}padding:var(--sp-2) var(--sp-4);background:var(--bg-subtle);border-bottom:1px solid var(--border-light);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;">
            <span style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);">Context:</span>
            <div id="kb-chips" style="display:flex;gap:var(--sp-1);flex-wrap:wrap;"></div>
          </div>
        </div>

        <!-- My References picker (toggle reusable context sources) -->
        <div id="ref-picker-bar" style="flex-shrink:0;display:none;padding:var(--sp-2) var(--sp-4);background:var(--bg-subtle);border-bottom:1px solid var(--border-light);"></div>

        <div class="chat-messages" id="chat-messages" style="flex:1;min-height:0;overflow-y:auto;"></div>

        <div class="chat-input-row" style="flex-shrink:0;">
          <div class="chat-composer">
            <div class="chat-composer-toolbar">
              <button class="btn btn-ghost btn-sm" id="attach-kb-btn" title="Attach Knowledge Base resource as context">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                Attach Context
              </button>
              <button class="btn btn-ghost btn-sm" id="attach-file-btn" title="Attach an image or PDF for Co-Cher to read (worksheet, diagram, textbook page, student work…)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Add file
              </button>
              <input type="file" id="attach-file-input" accept="${ATTACH_ACCEPT}" multiple style="display:none;" />
              ${micButtonHTML({ id: 'composer-mic-btn', statusId: 'composer-mic-status', label: 'Dictate' })}
              <select id="ideology-lens" class="input" title="Optional: frame lesson through a curriculum ideology" style="width:auto;padding:2px 8px;font-size:0.6875rem;color:var(--ink-muted);border:1px solid var(--border-light);border-radius:var(--radius);background:var(--bg-card);height:28px;">
                <option value="">Ideology lens (optional)</option>
                <option value="learner-centred" ${selectedIdeology === 'learner-centred' ? 'selected' : ''}>Learner-Centred</option>
                <option value="scholar-academic" ${selectedIdeology === 'scholar-academic' ? 'selected' : ''}>Scholar-Academic</option>
                <option value="social-efficiency" ${selectedIdeology === 'social-efficiency' ? 'selected' : ''}>Social Efficiency</option>
                <option value="social-reconstructivist" ${selectedIdeology === 'social-reconstructivist' ? 'selected' : ''}>Social Reconstructivist</option>
              </select>
              <div id="framework-chips" style="display:inline-flex;gap:4px;flex-wrap:wrap;align-items:center;" title="Pedagogy frameworks to weave into this plan (toggle any)">
                ${(Store.getFrameworks?.() || []).map(f => {
                  const on = selectedFrameworkIds.includes(f.id);
                  return `<button type="button" class="fw-chip" data-fw="${esc(f.id)}" aria-pressed="${on}" style="padding:2px 10px;height:28px;font-size:0.6875rem;font-weight:600;border-radius:999px;cursor:pointer;border:1px solid ${on ? 'var(--accent)' : 'var(--border-light)'};color:${on ? 'var(--accent)' : 'var(--ink-muted)'};background:${on ? 'var(--accent-light, rgba(67,97,238,0.08))' : 'var(--bg-card)'};">${esc(f.name)}</button>`;
                }).join('')}
              </div>
            </div>
            <div id="composer-attachments" style="display:none;flex-wrap:wrap;gap:var(--sp-2);padding:var(--sp-2) 0;"></div>
            <textarea class="chat-input" id="chat-input" placeholder="${planClassContext ? `Plan a lesson for ${planClassContext.name}...` : 'Describe your lesson idea, ask about spatial design, or explore frameworks...'}" rows="3"></textarea>
            <div class="chat-composer-footer">
              <span style="font-size:0.6875rem;color:var(--ink-faint);">Shift+Enter for new line</span>
              <button class="chat-send" id="chat-send" ${isGenerating ? 'disabled' : ''}>Send</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Resize Handle -->
      <div class="resize-handle" id="lp-resize-handle"></div>

      <!-- Plan Column -->
      <div class="lp-plan-col" style="background:var(--bg);">
        <div style="flex:1;overflow-y:auto;padding:var(--sp-6);">
          <div style="max-width:100%;margin:0 auto;width:100%;box-sizing:border-box;">
            <!-- Header -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-6);flex-wrap:wrap;gap:var(--sp-2);">
              <div style="display:flex;align-items:center;gap:var(--sp-2);">
                <button class="lp-panel-toggle" id="show-chat-btn" title="Back to chat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                  Chat
                </button>
                <div>
                  <div style="display:flex;align-items:center;gap:var(--sp-2);">
                    <h2 style="font-size:1.125rem;font-weight:600;color:var(--ink);">Lesson Canvas</h2>
                    <span id="lp-autosave" title="Your work is saved automatically" style="font-size:0.6875rem;font-weight:600;color:var(--growth,#2c7a4b);opacity:0;transition:opacity .3s;"></span>
                  </div>
                  <p id="lp-canvas-subtitle" style="font-size:0.8125rem;color:var(--ink-muted);">
                    ${currentLessonId ? `Editing: ${currentLesson?.title || 'Lesson'}` : 'New lesson — autosaves as you go'}
                  </p>
                </div>
              </div>
              <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" id="save-lesson-btn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save
                </button>
                <button class="btn btn-primary btn-sm" id="auto-stage-btn" title="Stage, group and seat this lesson in one go">
                  <span aria-hidden="true">&#9889;</span>
                  Auto-stage
                </button>
                <button class="btn btn-secondary btn-sm" id="stage-lesson-btn" title="Break this plan into a runnable sequence of segments">
                  <span aria-hidden="true">&#127916;</span>
                  Stage lesson
                </button>
                <button class="btn btn-ghost btn-sm" id="export-pdf-btn" title="Export as printable page">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Print
                </button>
                <button class="btn btn-ghost btn-sm" id="export-word-btn" title="Export as Word document (.doc)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  Word
                </button>
                <button class="btn btn-ghost btn-sm" id="snapshot-btn" title="Lesson snapshot — compact printable summary card">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="8" y1="8" x2="8" y2="21"/></svg>
                  Snapshot
                </button>
                <button class="btn btn-ghost btn-sm" id="share-lesson-btn" title="Share lesson with a colleague (export/import JSON)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share
                </button>
                <div style="position:relative;display:inline-block;">
                  <button class="btn btn-ghost btn-sm" id="templates-btn" title="Start from a lesson template">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    Templates
                  </button>
                </div>
              </div>
            </div>

            <!-- Journey bar: Plan → Components → Stage → Place → Present (WS-A) -->
            <div id="lp-journey"></div>

            <!-- Lesson Date/Time -->
            <div id="lesson-datetime-bar" style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-4);padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-lg);flex-wrap:wrap;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <input type="date" id="lesson-date" class="input" style="width:auto;padding:4px 8px;font-size:0.8125rem;" />
              <select id="lesson-period" class="input" style="width:auto;padding:4px 8px;font-size:0.8125rem;">
                <option value="">Period</option>
                <option value="1">P1 (7:30)</option><option value="2">P2 (8:10)</option>
                <option value="3">P3 (8:50)</option><option value="4">P4 (9:30)</option>
                <option value="5">P5 (10:20)</option><option value="6">P6 (11:00)</option>
                <option value="7">P7 (11:40)</option><option value="8">P8 (12:20)</option>
                <option value="9">P9 (1:10)</option><option value="10">P10 (1:50)</option>
                <option value="11">P11 (2:30)</option>
              </select>
              <div id="lesson-tt-hint" style="font-size:0.75rem;color:var(--ink-muted);flex:1;min-width:120px;"></div>
            </div>

            <!-- AI Tools Bar (labelled chips by default; toggle to compact icons) -->
            <div id="ai-tools-bar" style="margin-bottom:var(--sp-4);">
              <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-2);">
                <span style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);">AI Tools</span>
                <button class="btn btn-ghost btn-sm" id="toggle-toolbar-mode" title="Switch between labelled tools and compact icons" style="padding:2px 6px;font-size:0.625rem;color:var(--ink-faint);">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>
              <div id="ai-tools-icons" style="display:flex;flex-wrap:wrap;gap:4px;">
                ${buildToolbarHTML(getLPPrefs().toolbarMode || 'labels')}
              </div>
            </div>

            <!-- Spatial Context Bar (when layout linked) -->
            <div id="spatial-context-bar" style="display:none;margin-bottom:var(--sp-4);"></div>

            <!-- Persistent Run of Show panel (WS-A Cockpit) -->
            <div id="run-of-show"></div>

            <!-- Plan Content -->
            <div id="plan-content"></div>

            <!-- Integrated Lesson Components (persistent AI tool results) -->
            <div id="lesson-components"></div>

            <!-- Spatial Layout Section -->
            <div id="spatial-section" style="margin-top:var(--sp-4);"></div>

            <!-- Linked Resources Section -->
            <div id="linked-resources-section" style="margin-top:var(--sp-4);"></div>

            <!-- Temporary loading/status area -->
            <div id="ai-result" style="margin-top:var(--sp-4);"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const messagesEl = container.querySelector('#chat-messages');
  const chatInput = container.querySelector('#chat-input');
  const chatSend = container.querySelector('#chat-send');

  // WS-5: prefill the composer with the CCE topic — ready to edit or send.
  // One-shot: internal re-renders must not resurrect the prefill text.
  if (cceContext?.pendingInput) {
    cceContext.pendingInput = false;
    if (cceContext.topic && !chatInput.value) {
      chatInput.value = `Plan a CCE lesson on: ${cceContext.topic}`;
    }
    chatInput.focus();
  }

  // Teacher's-call choice blocks ([CHOICE: A | B]) — one delegated listener
  // on the persistent container; elements are re-created on every render.
  if (!container._choiceWired) {
    container._choiceWired = true;
    container.addEventListener('click', (e) => {
      const opt = e.target.closest('.md-choice-opt');
      if (!opt) return;
      opt.closest('.md-choice')?.querySelectorAll('.md-choice-opt').forEach(b => b.classList.remove('chosen'));
      opt.classList.add('chosen');
      const input = document.getElementById('chat-input');
      const send = document.getElementById('chat-send');
      if (input && send) {
        input.value = `Let's go with: ${opt.dataset.choice}`;
        send.click();
      }
    });
  }

  // [EXPAND:] chips (WS-C) — click → generate (or restore from cache) → mount
  // + persist. Same delegated-listener pattern as choices; covers the chat
  // pane, the plan panel and #lesson-components, since all render via md().
  if (!container._expandWired) {
    container._expandWired = true;
    container.addEventListener('click', async (e) => {
      const chip = e.target.closest('.expand-chip');
      if (!chip || chip.dataset.loading === '1' || chip.dataset.mounted === '1') return;
      const slug = chip.dataset.expandSlug || '';
      const verb = chip.dataset.expandVerb || 'Details';
      if (!slug) return;
      if (!currentLessonId) {
        showToast('Save the lesson first so expansions can be kept.', 'danger');
        return;
      }
      const key = `${slug}::${verb}`;
      const lesson = Store.getLesson(currentLessonId);
      const cached = lesson?.expansions?.[key];
      if (typeof cached === 'string' && cached) {
        mountExpansion(container, slug, verb, cached).forEach(b => processLatex(b));
        return;
      }
      if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

      const originalHtml = chip.innerHTML;
      chip.dataset.loading = '1';
      chip.disabled = true;
      chip.innerHTML = '&#8230;';
      try {
        const heading = expandChipHeading(chip);
        let planContext = chatMessages
          .filter(m => m.role === 'assistant' && typeof m.content === 'string')
          .map(m => m.content).join('\n\n---\n\n') || lesson?.plan || '';
        // A chip inside a component expands that component — lead with its
        // content so generator slugs (e.g. exit-q-2) resolve to real text.
        if (chip.closest('#lesson-components') && activeComponentTab && lessonComponents[activeComponentTab]?.content) {
          planContext = `${lessonComponents[activeComponentTab].content}\n\n---\n\nFull lesson plan:\n${planContext}`;
        }
        const classId = planClassContext?.id || lesson?.classId || null;
        const classContext = classId ? (Store.getPortraitPromptText?.(classId) || '') : '';
        const body = await expandSection({ planContext, sectionHeading: heading, verb, classContext });
        const fresh = Store.getLesson(currentLessonId);
        Store.updateLesson(currentLessonId, { expansions: { ...(fresh?.expansions || {}), [key]: body } });
        chip.innerHTML = originalHtml;
        chip.disabled = false;
        delete chip.dataset.loading;
        mountExpansion(container, slug, verb, body).forEach(b => processLatex(b));
      } catch (err) {
        chip.innerHTML = originalHtml;
        chip.disabled = false;
        delete chip.dataset.loading;
        showToast(err.message, 'danger');
      }
    });
  }
  const layoutEl = container.querySelector('#lp-layout');

  // Load components from existing lesson — always reset, otherwise a lesson
  // without components inherits (and then auto-saves) the previous lesson's
  if (currentLessonId) {
    const existingLesson = Store.getLesson(currentLessonId);
    lessonComponents = existingLesson?.components ? { ...existingLesson.components } : {};
  }

  // Render initial messages
  renderMessages(messagesEl, classes);
  renderPlanContent(container.querySelector('#plan-content'));
  renderComponents(container);

  // Mobile panel toggle
  const showPlanBtn = container.querySelector('#show-plan-btn');
  const showChatBtn = container.querySelector('#show-chat-btn');
  if (showPlanBtn) {
    showPlanBtn.addEventListener('click', () => layoutEl.classList.add('show-plan'));
  }
  if (showChatBtn) {
    showChatBtn.addEventListener('click', () => layoutEl.classList.remove('show-plan'));
  }

  // Resizable panels
  initResizeHandle(
    container.querySelector('#lp-resize-handle'),
    container.querySelector('.lp-chat-col'),
    container.querySelector('.lp-plan-col'),
    layoutEl
  );

  // Workflow breadcrumb clicks
  bindWorkflowClicks(container);

  // New chat
  container.querySelector('#new-chat-btn').addEventListener('click', () => {
    chatMessages = [];
    currentLessonId = null;
    isGenerating = false;
    lessonComponents = {};
    vigilanceNudged = false;
    vigilanceState = null;
    cceContext = null;
    render(container);
  });

  // Undo last exchange
  const undoBtn = container.querySelector('#undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Undo Last Exchange',
        message: 'Remove the last user message and AI response?',
        confirmLabel: 'Undo',
        cancelLabel: 'Cancel'
      });
      if (!confirmed) return;

      // Remove last AI message and last user message
      if (chatMessages.length >= 2) {
        const lastAi = chatMessages.length - 1;
        const lastUser = chatMessages.length - 2;
        if (chatMessages[lastAi]?.role === 'assistant' && chatMessages[lastUser]?.role === 'user') {
          chatMessages.splice(lastUser, 2);
        } else {
          chatMessages.pop();
        }
      } else if (chatMessages.length === 1) {
        chatMessages.pop();
      }
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { chatHistory: stripAttachmentData(chatMessages) });
      }
      render(container);
      showToast('Last exchange removed.', 'success');
    });
  }

  // Reset the composer's staged attachments — reassigned once the attach UI is
  // wired below (declared here so the hoisted sendMessage can call it).
  let clearComposerAttachments = () => { pendingAttachments = []; };

  // Send message
  async function sendMessage() {
    const text = chatInput.value.trim();
    // Attachments alone (no text) are still worth sending — the model reads them.
    if ((!text && pendingAttachments.length === 0) || isGenerating) return;
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

    // Cognitive vigilance: one playful checkpoint for context-free prompts.
    // Skipped when files are attached — the attachment IS the context.
    if (!pendingAttachments.length && vigilanceCheck(text)) {
      vigilanceNudged = true;
      vigilanceState = { prompt: text };
      renderMessages(messagesEl, classes);
      return;
    }
    vigilanceState = null;

    // Build context-enriched message
    let contextParts = [];
    if (planClassContext && chatMessages.length === 0) {
      contextParts.push(`[Class Context: ${planClassContext.name}, ${planClassContext.level} ${planClassContext.subject}]`);
      // Learner-centric core: the AI designs for the class the teacher
      // actually has — full portrait (E21CC spread, observations, trends)
      const portrait = Store.getPortraitPromptText?.(planClassContext.id);
      if (portrait) {
        contextParts.push(`[Class Portrait — design FOR these learners; differentiate by default for the dimensions most students are still developing]:\n${portrait}`);
      }
    }
    // WS-5: CCE lesson framing — first message only, mirrors the other lenses.
    // cceContextBlock returns the bracketed [CCE Lesson — <area>] block.
    if (cceContext && chatMessages.length === 0) {
      contextParts.push(cceContextBlock(cceContext.contentArea));
    }
    // Teacher's active practice goal: support it quietly, never lecture about it
    if (chatMessages.length === 0) {
      const goal = Store.getPracticeGoal?.();
      if (goal?.text) {
        contextParts.push(`[The teacher is personally working on: "${goal.text}". Where natural, shape suggestions to give them practice at this — do not mention the goal explicitly.]`);
      }
    }
    // Inject spatial layout context if linked
    if (chatMessages.length === 0) {
      const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
      const linkedLayoutId = currentLesson?.spatialLayout;
      if (linkedLayoutId) {
        const layout = (Store.getSavedLayouts() || []).find(l => l.id === linkedLayoutId);
        if (layout) {
          const presetLabel = PRESET_NAMES[layout.preset] || 'Custom';
          contextParts.push(`[Spatial Layout: ${presetLabel} arrangement, ${layout.studentCount || '?'} students, ${layout.items?.length || 0} furniture items]`);
        }
      }
    }
    // KB context — attach on every message where KB is attached
    if (attachedKBContext.length > 0) {
      contextParts.push(...attachedKBContext.map(kb =>
        `[Reference — ${kb.title}]:\n${(kb.content || '').slice(0, 2000)}`
      ));
    }
    // My References — teacher-curated library toggled on for this session.
    // Token-bounded: inject the summary by default; inject raw content only when
    // it is short (< ~2000 chars), falling back to a slice when no summary exists.
    if (selectedReferenceIds.length > 0) {
      const refs = Store.getReferences();
      selectedReferenceIds.forEach(id => {
        const r = refs.find(x => x.id === id);
        if (!r) return;
        const content = r.content || '';
        let body;
        if (content.length > 0 && content.length < 2000) body = content;
        else if (r.summary) body = r.summary;
        else body = content.slice(0, 2000);
        if (!body) return;
        contextParts.push(`[Reference — ${r.name}]:\n${body}`);
      });
    }
    // Auto-attach SoW if available and first message (background context)
    if (chatMessages.length === 0) {
      const sowUploads = (Store.get('knowledgeUploads') || []).filter(u => u.category === 'Scheme of Work');
      sowUploads.forEach(sow => {
        if (!attachedKBContext.some(kb => kb.id === sow.id)) {
          contextParts.push(`[Scheme of Work — ${sow.title}]:\n${(sow.content || '').slice(0, 3000)}`);
        }
      });
      // Inject reflection insights from previous lesson
      if (reflectionInsights) {
        contextParts.push(`[Post-Lesson Reflection from "${reflectionInsights.fromLesson}"]:\n${reflectionInsights.insights}\n\nPlease use these insights to inform the lesson plan — build on what worked and address what needs adjustment.`);
      }
      // Inject the teacher's focus areas — and ask the model to actively build
      // the teacher's capability in them, not just acknowledge them.
      const pedPriorities = getPriorities(Store);
      if (pedPriorities.length > 0) {
        const labels = pedPriorities.map(priorityLabel).join(', ');
        contextParts.push(`[Teacher's professional focus areas this year: ${labels}. Where it genuinely fits this lesson, deliberately design for and model strong practice in these areas, and name the move you're making so the teacher builds capability in them over time. Never force a focus area where it doesn't belong.]`);
      }
    }
    // Ideology lens
    if (selectedIdeology) {
      const ideologyLabels = {
        'learner-centred': 'Learner-Centred (student needs, interests, and agency at the centre)',
        'scholar-academic': 'Scholar-Academic (disciplinary knowledge, rigour, and intellectual traditions)',
        'social-efficiency': 'Social Efficiency (skills for workforce readiness and societal function)',
        'social-reconstructivist': 'Social Reconstructivist (critical consciousness, social justice, and transformative action)',
      };
      contextParts.push(`[Curriculum Ideology Lens: ${ideologyLabels[selectedIdeology] || selectedIdeology}. Frame the lesson design, activity choices, and assessment approach through this orientation where it naturally fits.]`);
    }
    // Pedagogy framework lenses — injected on the first message only, where
    // they frame the whole plan (mirrors the ideology lens injection).
    if (chatMessages.length === 0 && selectedFrameworkIds.length > 0) {
      selectedFrameworkIds.forEach(id => {
        const fw = (Store.getFrameworks?.() || []).find(f => f.id === id);
        if (!fw) return;
        const stageBits = (fw.stages || []).map(s => {
          const line = String(s.prompt || s.studentPrompt || '').replace(/\s+/g, ' ').trim();
          return `${s.label}${line ? `: ${line}` : ''}`;
        }).join('; ');
        contextParts.push(`[Pedagogy Framework — ${fw.name}: ${fw.guidance || ''} Stages: ${stageBits}]`);
      });
    }

    // Attached images/PDFs: name them in the text (survives persistence; base64
    // does not) and carry the bytes on the message for the API layer to expand.
    const attachments = pendingAttachments.slice();
    const attachNote = attachmentContextNote(attachments);
    const bodyText = attachNote ? (text ? `${attachNote}\n\n${text}` : attachNote) : text;

    const enrichedContent = contextParts.length > 0
      ? `${contextParts.join('\n\n')}\n\n${bodyText}`
      : bodyText;

    const userMsg = { role: 'user', content: enrichedContent };
    if (attachments.length) userMsg.attachments = attachments;
    chatMessages.push(userMsg);
    clearComposerAttachments();
    chatInput.value = '';
    chatInput.style.height = 'auto';
    isGenerating = true;
    renderMessages(messagesEl, classes);

    // Capture the conversation identity — if "New" is clicked or another
    // lesson opened while the reply is in flight, the arrays are replaced
    // and the stale response must be discarded (not appended/auto-saved).
    const sessionMessages = chatMessages;
    try {
      // Expand any attachment-bearing messages into Gemini's multimodal shape;
      // text-only messages pass through unchanged.
      const apiMessages = sessionMessages.map(toMultimodalMessage);
      const response = await sendChat(apiMessages, { trackLabel: 'lessonChat', trackDetail: [planClassContext?.subject, planClassContext?.level].filter(Boolean).join(' ') || '' });
      if (chatMessages !== sessionMessages) return;
      chatMessages.push({ role: 'assistant', content: response });
    } catch (err) {
      if (chatMessages !== sessionMessages) return;
      chatMessages.push({ role: 'assistant', content: `I encountered an error: ${err.message}` });
      showToast(err.message, 'danger');
    } finally {
      if (chatMessages === sessionMessages) {
        isGenerating = false;
        renderMessages(messagesEl, classes);
        renderPlanContent(container.querySelector('#plan-content'));
        // Autosave: creates the draft on first real content, then keeps it up to
        // date (base64 attachments are stripped before persistence).
        scheduleAutosave();
      }
    }
  }

  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
  });

  // Class context banner
  container.querySelector('#clear-class-context')?.addEventListener('click', () => {
    planClassContext = null;
    container.querySelector('#class-context-banner')?.remove();
    chatInput.placeholder = 'Describe your lesson idea, ask about spatial design, or explore frameworks...';
  });

  // Dismiss reflection insights
  container.querySelector('#clear-reflection-insights')?.addEventListener('click', () => {
    reflectionInsights = null;
    container.querySelector('#reflection-insights-banner')?.remove();
  });

  // Ideology lens
  container.querySelector('#ideology-lens')?.addEventListener('change', (e) => {
    selectedIdeology = e.target.value;
  });

  // Pedagogy framework chips — toggleable multi-select
  container.querySelectorAll('#framework-chips .fw-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.fw;
      const on = !selectedFrameworkIds.includes(id);
      selectedFrameworkIds = on
        ? [...selectedFrameworkIds, id]
        : selectedFrameworkIds.filter(x => x !== id);
      btn.setAttribute('aria-pressed', String(on));
      btn.style.borderColor = on ? 'var(--accent)' : 'var(--border-light)';
      btn.style.color = on ? 'var(--accent)' : 'var(--ink-muted)';
      btn.style.background = on ? 'var(--accent-light, rgba(67,97,238,0.08))' : 'var(--bg-card)';
    });
  });

  // KB context chips
  renderKBChips(container);

  // My References picker chips
  renderReferenceChips(container);

  // Attach KB context
  container.querySelector('#attach-kb-btn')?.addEventListener('click', () => {
    showAttachKBModal(container);
  });

  // ── Attach images / PDFs (multimodal) ──────────────────────────────────
  // Teachers drop a worksheet, diagram, textbook page, marking rubric or a
  // photo of student work; Gemini reads it directly. Staged in the composer,
  // consumed by sendMessage(), then cleared.
  const fileInput = container.querySelector('#attach-file-input');
  const attachBar = container.querySelector('#composer-attachments');

  function renderPendingAttachments() {
    if (!attachBar) return;
    if (!pendingAttachments.length) {
      attachBar.style.display = 'none';
      attachBar.innerHTML = '';
      return;
    }
    attachBar.style.display = 'flex';
    attachBar.innerHTML = pendingAttachments.map((a, i) => {
      const thumb = a.kind === 'image' && a.previewUrl
        ? `<img src="${a.previewUrl}" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:4px;flex-shrink:0;" />`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      const note = a.kind === 'pdf-text' ? ' <span style="color:var(--ink-faint);">(text only)</span>' : '';
      return `<span class="composer-attach-chip" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:var(--bg-subtle);border:1px solid var(--border-light);border-radius:var(--radius);font-size:0.75rem;max-width:220px;">
        ${thumb}
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(a.name)}${note}</span>
        <button class="attach-remove" data-idx="${i}" title="Remove" aria-label="Remove ${esc(a.name)}" style="border:none;background:none;cursor:pointer;color:var(--ink-faint);padding:0;line-height:1;font-size:1rem;flex-shrink:0;">&times;</button>
      </span>`;
    }).join('');
    attachBar.querySelectorAll('.attach-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingAttachments.splice(parseInt(btn.dataset.idx), 1);
        renderPendingAttachments();
      });
    });
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const accepted = files.filter(isAcceptedAttachment);
    const rejected = files.length - accepted.length;
    if (rejected > 0) showToast(`${rejected} file(s) skipped — only images and PDFs can be attached.`, 'danger');
    for (const file of accepted) {
      if (pendingAttachments.length >= 6) { showToast('Up to 6 files per message.', 'danger'); break; }
      try {
        const att = await buildAttachment(file);
        pendingAttachments.push(att);
        renderPendingAttachments();
      } catch (err) {
        console.error('Attachment error:', err);
        showToast(err.message || `Could not attach ${file.name}.`, 'danger');
      }
    }
  }

  container.querySelector('#attach-file-btn')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

  // Drag-and-drop straight onto the chat column.
  const chatCol = container.querySelector('.chat-messages')?.closest('.lp-chat-col') || container.querySelector('.chat-messages');
  if (chatCol) {
    const dragOn = () => { chatCol.style.outline = '2px dashed var(--accent)'; chatCol.style.outlineOffset = '-6px'; };
    const dragOff = () => { chatCol.style.outline = ''; chatCol.style.outlineOffset = ''; };
    chatCol.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); dragOn(); } });
    chatCol.addEventListener('dragleave', e => { if (e.target === chatCol) dragOff(); });
    chatCol.addEventListener('drop', e => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      dragOff();
      addFiles(e.dataTransfer.files);
    });
  }

  // Re-render any attachments carried over from a re-render of the composer.
  renderPendingAttachments();
  // Expose so sendMessage() (defined above in the same scope) can clear the bar.
  clearComposerAttachments = () => { pendingAttachments = []; renderPendingAttachments(); };

  // WS-V: composer dictation mic — FILLS #chat-input at the cursor; it never
  // calls sendMessage(). The teacher still presses Send to submit.
  wireMic(container, { buttonId: 'composer-mic-btn', statusId: 'composer-mic-status', fieldId: 'chat-input' });

  // Quick prompts
  messagesEl.addEventListener('click', e => {
    const btn = e.target.closest('.quick-prompt');
    if (btn) {
      chatInput.value = btn.dataset.prompt;
      chatInput.focus();
      // Select the first [placeholder] for easy editing
      const match = btn.dataset.prompt.match(/\[([^\]]+)\]/);
      if (match) {
        const idx = btn.dataset.prompt.indexOf(match[0]);
        chatInput.setSelectionRange(idx, idx + match[0].length);
      }
    }
  });

  // Save lesson
  container.querySelector('#save-lesson-btn').addEventListener('click', () => showSaveModal(container, classes));

  // Stage lesson — break the plan into a runnable Run of Show (A1)
  container.querySelector('#stage-lesson-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const lesson = currentLessonId ? Store.getLesson(currentLessonId) : null;

    // Already staged: re-open the editor pre-filled, no AI call
    if (lesson?.runOfShow?.segments?.length) {
      showRunOfShowEditor(container, lesson.runOfShow);
      return;
    }

    if (!currentLessonId) {
      showToast('Save the lesson first — staging attaches the run of show to a saved lesson.', 'danger');
      return;
    }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) {
      showToast('Chat with Co-Cher first to create a plan, then stage it.', 'danger');
      return;
    }
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span aria-hidden="true">&#127916;</span> Staging&hellip;';
    try {
      const runOfShow = await generateRunOfShow(buildRunOfShowRequest(lesson));
      showRunOfShowEditor(container, runOfShow);
    } catch (err) {
      showToast(`Staging failed: ${err.message}`, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  });

  // Auto-stage (WS-3) — stage, group, room-link and seat in one pre-flight
  // pipeline. The manual Stage button above stays untouched.
  container.querySelector('#auto-stage-btn')?.addEventListener('click', () => {
    showAutoStageModal(container);
  });

  // Print / Export (includes all components)
  container.querySelector('#export-pdf-btn').addEventListener('click', () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0 && Object.keys(lessonComponents).length === 0) {
      showToast('No lesson content to print yet.', 'danger'); return;
    }
    const printWin = window.open('', '_blank');
    if (!printWin) { showToast('Allow pop-ups for this site to print/export.', 'danger'); return; }
    const planHtml = aiMsgs.map(m => mdStatic(m.content)).join('<hr style="margin:24px 0;">');

    // Build components HTML for print
    const compKeys = Object.keys(lessonComponents)
      .filter(k => lessonComponents[k]?.content)
      .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));
    const componentsHtml = compKeys.length > 0
      ? `<hr style="margin:32px 0;border-top:2px solid #000c53;"><h2>Lesson Components</h2>` +
        compKeys.map(key => {
          const m = COMPONENT_META[key] || { label: key };
          return `<h3>${m.label}</h3>${mdStatic(lessonComponents[key].content)}`;
        }).join('<hr style="margin:24px 0;">')
      : '';

    printWin.document.write(`<!DOCTYPE html><html><head><title>Lesson Plan — Co-Cher</title>
      <style>body{font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 24px;color:#1e293b;line-height:1.7;font-size:14px}
      h1{font-size:18px;border-bottom:2px solid #000c53;padding-bottom:8px;color:#000c53}
      h2,h3,h4{margin:16px 0 8px}strong{font-weight:600}ul,ol{padding-left:20px}
      hr{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
      table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #e2e8f0}th{font-weight:600;background:#f1f5f9}
      pre{background:#f1f5f9;padding:12px;border-radius:6px;font-size:12px;overflow-x:auto}
      @media print{body{margin:0;padding:16px}}</style></head>
      <body><h1>Lesson Plan</h1><p style="color:#64748b;font-size:12px;">Exported from Co-Cher · ${new Date().toLocaleDateString('en-SG')}</p>${planHtml}${componentsHtml}</body></html>`);
    printWin.document.close();
    printWin.print();
  });

  // Lesson Snapshot — compact printable summary card
  container.querySelector('#snapshot-btn')?.addEventListener('click', () => {
    const compKeys = Object.keys(lessonComponents)
      .filter(k => lessonComponents[k]?.content)
      .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));

    if (compKeys.length === 0 && chatMessages.filter(m => m.role === 'assistant').length === 0) {
      showToast('No lesson content to snapshot yet.', 'danger'); return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) { showToast('Allow pop-ups for this site to print/export.', 'danger'); return; }
    const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
    const title = currentLesson?.title || 'Lesson Plan';
    const dateStr = new Date().toLocaleDateString('en-SG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    const cls = planClassContext || {};
    const contextLine = [cls.name, cls.subject, cls.level].filter(Boolean).join(' · ') || '';

    // Build compact sections from components
    const sections = [];

    // LI/SC first (most important)
    if (lessonComponents.lisc?.content) {
      sections.push(`<div class="snap-section snap-lisc"><h3>Learning Intentions & Success Criteria</h3>${mdStatic(lessonComponents.lisc.content)}</div>`);
    }

    // Timeline
    if (lessonComponents.timeline?.content) {
      sections.push(`<div class="snap-section"><h3>Timeline / Pacing</h3>${mdStatic(lessonComponents.timeline.content)}</div>`);
    }

    // Groups
    if (lessonComponents.grouping?.content) {
      sections.push(`<div class="snap-section"><h3>Student Groups</h3>${mdStatic(lessonComponents.grouping.content)}</div>`);
    }

    // Seat Plan
    if (lessonComponents.seatPlan?.content) {
      sections.push(`<div class="snap-section"><h3>Seating Plan</h3>${mdStatic(lessonComponents.seatPlan.content)}</div>`);
    }

    // Exit Ticket
    if (lessonComponents.exitTicket?.content) {
      sections.push(`<div class="snap-section"><h3>Exit Ticket</h3>${mdStatic(lessonComponents.exitTicket.content)}</div>`);
    }

    // Resources (YouTube + Simulations + External — compact)
    const resourceKeys = ['youtubeVideos', 'simulations', 'externalLinks'].filter(k => lessonComponents[k]?.content);
    if (resourceKeys.length > 0) {
      sections.push(`<div class="snap-section"><h3>Resources</h3>${resourceKeys.map(k => mdStatic(lessonComponents[k].content)).join('<br>')}</div>`);
    }

    // Differentiation
    if (lessonComponents.differentiation?.content) {
      sections.push(`<div class="snap-section"><h3>Differentiation</h3>${mdStatic(lessonComponents.differentiation.content)}</div>`);
    }

    // Key points from chat (first assistant message only, as overview)
    const firstAiMsg = chatMessages.find(m => m.role === 'assistant');
    if (firstAiMsg && !lessonComponents.lisc?.content && !lessonComponents.timeline?.content) {
      const preview = firstAiMsg.content.length > 800 ? firstAiMsg.content.slice(0, 800) + '...' : firstAiMsg.content;
      sections.push(`<div class="snap-section"><h3>Lesson Overview</h3>${mdStatic(preview)}</div>`);
    }

    printWin.document.write(`<!DOCTYPE html><html><head><title>Lesson Snapshot — ${esc(title)}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:system-ui,-apple-system,sans-serif;max-width:750px;margin:0 auto;padding:20px 24px;color:#1e293b;line-height:1.6;font-size:13px}
        .snap-header{border-bottom:3px solid #000c53;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end}
        .snap-header h1{font-size:17px;color:#000c53;margin:0}
        .snap-header .meta{font-size:11px;color:#64748b;text-align:right}
        .snap-section{margin-bottom:14px;padding:10px 14px;border:1px solid #e2e8f0;border-radius:6px;break-inside:avoid}
        .snap-section h3{font-size:12px;text-transform:uppercase;letter-spacing:0.03em;color:#000c53;margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
        .snap-lisc{background:#f0f4ff;border-color:#000c53}
        table{width:100%;border-collapse:collapse;margin:6px 0;font-size:12px}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid #e2e8f0}th{font-weight:600;background:#f8fafc}
        strong{font-weight:600}ul,ol{padding-left:18px;margin:4px 0}li{margin:2px 0}
        a{color:#4361ee;text-decoration:none}
        blockquote{border-left:3px solid #4361ee;padding:6px 10px;margin:6px 0;background:#f0f4ff;font-size:12px}
        pre{background:#f1f5f9;padding:8px;border-radius:4px;font-size:11px;overflow-x:auto}
        .snap-footer{margin-top:16px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}
        @media print{body{margin:0;padding:12px}.snap-section{page-break-inside:avoid}}
      </style></head>
      <body>
        <div class="snap-header">
          <div><h1>${esc(title)}</h1>${contextLine ? `<div style="font-size:12px;color:#475569;margin-top:2px;">${esc(contextLine)}</div>` : ''}</div>
          <div class="meta">${dateStr}<br>Co-Cher Snapshot</div>
        </div>
        ${sections.join('')}
        <div class="snap-footer">Generated by Co-Cher · Teacher-reviewed and approved</div>
      </body></html>`);
    printWin.document.close();
    printWin.print();
  });

  // LI / SC Generator
  container.querySelector('#ai-lisc-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating Learning Intentions & Success Criteria...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const result = await generateLISC(planText, cls.subject, cls.level);
      setComponent('lisc', result, cls.subject || 'LI/SC');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Learning Intentions & Success Criteria generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // AI Review
  container.querySelector('#ai-review-btn')?.addEventListener('click', async () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Reviewing your lesson plan...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = aiMsgs.map(m => m.content).join('\n\n');
      const review = await reviewLesson(planText);
      setComponent('review', review);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Lesson review added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Review failed: ${err.message}</div>`;
    }
  });

  // AI Rubric
  container.querySelector('#ai-rubric-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const topic = chatMessages.find(m => m.role === 'user')?.content || 'General lesson';
    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Generating rubric...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const rubric = await generateRubric(topic);
      setComponent('rubric', rubric);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Rubric added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Rubric generation failed: ${err.message}</div>`;
    }
  });

  // AI Grouping
  container.querySelector('#ai-group-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const allClasses = Store.getClasses();
    if (allClasses.length === 0 || allClasses.every(c => !c.students?.length)) {
      showToast('No students found. Add students to a class first.', 'danger');
      return;
    }
    showGroupingModal(container, allClasses);
  });

  // AI Timeline
  container.querySelector('#ai-timeline-btn')?.addEventListener('click', () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    showTimelineModal(container);
  });

  // AI Exit Ticket
  container.querySelector('#ai-exit-ticket-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Generating exit ticket questions...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = aiMsgs.map(m => m.content).join('\n\n');
      const subject = planClassContext?.subject || '';
      const level = planClassContext?.level || '';
      const ticket = await generateExitTicket(planText, subject, level);
      setComponent('exitTicket', ticket);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Exit ticket added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Exit ticket generation failed: ${err.message}</div>`;
    }
  });

  // AI Differentiation
  container.querySelector('#ai-differentiation-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    // Need a class with students for differentiation
    const allClasses = Store.getClasses().filter(c => c.students?.length > 0);
    if (allClasses.length === 0) { showToast('No students found. Add students to a class first.', 'danger'); return; }

    showDifferentiationModal(container, allClasses);
  });

  // YouTube recommendations
  container.querySelector('#ai-youtube-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Finding YouTube recommendations...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const result = await suggestYouTubeVideos(planText, cls.subject, cls.level);
      setComponent('youtubeVideos', result, cls.subject || 'Videos');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('YouTube recommendations added!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // Simulation Models
  container.querySelector('#ai-simulations-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }

    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Finding simulation models...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const result = await suggestSimulations(planText, cls.subject, cls.level);
      setComponent('simulations', result, cls.subject || 'Simulations');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Simulation suggestions added!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // C10 — Build a sim for this lesson: prefill the Simulation Builder from
  // lesson context; simulations.js auto-attaches the built sim back to this
  // lesson via the lessonId in 'cocher_sim_builder_prefill'.
  container.querySelector('#build-sim-btn')?.addEventListener('click', () => {
    if (!currentLessonId) {
      showToast('Save the lesson first — the built simulation attaches to a saved lesson.', 'danger');
      return;
    }
    const lesson = Store.getLesson(currentLessonId);
    const cls = planClassContext
      || (lesson?.classId ? Store.getClass(lesson.classId) : null)
      || {};
    const prefill = {
      subject: cls.subject || '',
      level: cls.level || '',
      topic: lesson?.title || '',
      lessonId: currentLessonId
    };
    if (typeof lesson?.objectives === 'string' && lesson.objectives.trim()) {
      prefill.objective = lesson.objectives.trim();
    }
    try {
      sessionStorage.setItem('cocher_sim_builder_prefill', JSON.stringify(prefill));
    } catch {
      showToast('Could not hand the lesson context to the Simulation Builder.', 'danger');
      return;
    }
    navigate('/simulations');
  });

  // Worksheet Generator
  container.querySelector('#ai-worksheet-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating worksheet...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateWorksheet(planText, cls.subject, cls.level);
      setComponent('worksheet', result, cls.subject || 'Worksheet');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Worksheet generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // Discussion Prompts
  container.querySelector('#ai-discussion-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating discussion prompts...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateDiscussionPrompts(planText, cls.subject, cls.level);
      setComponent('discussionPrompts', result, cls.subject || 'Discussion');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Discussion prompts generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });


  // EEE: Stimulus Material
  container.querySelector('#ai-stimulus-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating stimulus material...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateStimulusMaterial(planText, cls.subject, cls.level);
      setComponent('stimulus', result, cls.subject || 'Stimulus');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Stimulus material generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // EEE: Vocabulary Builder (structured form modal)
  container.querySelector('#ai-vocabulary-btn')?.addEventListener('click', () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const cls = planClassContext || {};
    const { backdrop, close } = openModal({
      title: 'Vocabulary Builder',
      body: `
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">Configure your vocabulary materials. Fill in the fields, then generate.</p>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Topic / Theme</label>
          <input class="input" id="vocab-topic" placeholder="e.g. Persuasive Writing Techniques, Chemical Bonding, Globalisation" value="" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-3);">
          <div class="input-group">
            <label class="input-label">Subject</label>
            <select class="input" id="vocab-subject">
              <option value="${cls.subject || ''}">${cls.subject || 'General'}</option>
              ${['English','Chinese','Malay','Tamil','History','Social Studies','Geography','Science','Mathematics','CCE','General Paper'].filter(s => s !== cls.subject).map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">Level</label>
            <select class="input" id="vocab-level">
              <option value="${cls.level || 'Secondary'}">${cls.level || 'Secondary'}</option>
              ${['Sec 1','Sec 2','Sec 3','Sec 4','Sec 5','JC 1','JC 2'].filter(l => l !== cls.level).map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Vocabulary Tier Focus</label>
          <select class="input" id="vocab-tier">
            <option value="mixed">Mixed (Tier 2 Academic + Tier 3 Technical)</option>
            <option value="tier2">Tier 2 — General Academic Vocabulary</option>
            <option value="tier3">Tier 3 — Subject-Specific Technical Terms</option>
          </select>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Number of Terms</label>
          <select class="input" id="vocab-count">
            <option value="8-10">8-10 terms</option>
            <option value="10-15" selected>10-15 terms</option>
            <option value="15-20">15-20 terms</option>
          </select>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Include (optional)</label>
          <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);">
            <label style="font-size:0.8125rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" class="vocab-include" value="sentence-frames" checked /> Sentence Frames</label>
            <label style="font-size:0.8125rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" class="vocab-include" value="cloze" checked /> Cloze Passage</label>
            <label style="font-size:0.8125rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" class="vocab-include" value="word-relationships" /> Word Relationships</label>
            <label style="font-size:0.8125rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" class="vocab-include" value="frayer-model" /> Frayer Models</label>
            <label style="font-size:0.8125rem;display:flex;align-items:center;gap:4px;"><input type="checkbox" class="vocab-include" value="flashcards" /> Interactive Flashcards</label>
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">Additional Notes (optional)</label>
          <textarea class="input" id="vocab-notes" rows="2" placeholder="e.g. Focus on words students confuse, include L1 hints for ELL students..."></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="generate">Generate Vocabulary</button>
      `
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
    backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
      const topic = backdrop.querySelector('#vocab-topic').value.trim();
      if (!topic) { showToast('Please enter a topic.', 'danger'); return; }
      const subject = backdrop.querySelector('#vocab-subject').value;
      const level = backdrop.querySelector('#vocab-level').value;
      const tier = backdrop.querySelector('#vocab-tier').value;
      const count = backdrop.querySelector('#vocab-count').value;
      const includes = [...backdrop.querySelectorAll('.vocab-include:checked')].map(c => c.value);
      const notes = backdrop.querySelector('#vocab-notes').value.trim();
      const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
      const planContext = aiMsgs.length > 0 ? `\n\nLesson context:\n${aiMsgs[aiMsgs.length - 1].content.slice(0, 2000)}` : '';
      close();
      const resultEl = container.querySelector('#ai-result');
      resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Building vocabulary materials...</div>';
      resultEl.scrollIntoView({ behavior: 'smooth' });
      try {
        const prompt = `Generate vocabulary materials for: ${topic}\nSubject: ${subject}\nLevel: ${level}\nTier focus: ${tier}\nNumber of terms: ${count}\nInclude: ${includes.join(', ') || 'word wall only'}\n${notes ? `Teacher notes: ${notes}` : ''}${planContext}`;
        const result = await generateVocabulary(prompt, subject, level);
        setComponent('vocabulary', result, subject || 'Vocabulary');
        resultEl.innerHTML = '';
        renderComponents(container);
        showToast('Vocabulary materials generated!', 'success');
      } catch (err) {
        resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
      }
    });
  });

  // EEE: Model Response (structured form modal)
  container.querySelector('#ai-model-response-btn')?.addEventListener('click', () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const cls = planClassContext || {};
    const { backdrop, close } = openModal({
      title: 'Model Response Generator',
      body: `
        <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">Specify the question and criteria to generate an annotated model answer.</p>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Question / Task</label>
          <textarea class="input" id="mr-question" rows="3" placeholder="e.g. 'Explain how the author uses imagery to convey...' or 'Describe the effects of urbanisation on...'"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-3);">
          <div class="input-group">
            <label class="input-label">Subject</label>
            <select class="input" id="mr-subject">
              <option value="${cls.subject || ''}">${cls.subject || 'General'}</option>
              ${['English','Chinese','Malay','Tamil','History','Social Studies','Geography','Science','Mathematics','CCE','General Paper'].filter(s => s !== cls.subject).map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">Level</label>
            <select class="input" id="mr-level">
              <option value="${cls.level || 'Secondary'}">${cls.level || 'Secondary'}</option>
              ${['Sec 1','Sec 2','Sec 3','Sec 4','Sec 5','JC 1','JC 2'].filter(l => l !== cls.level).map(l => `<option value="${l}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Response Type</label>
          <select class="input" id="mr-type">
            <option value="essay">Essay / Structured Response</option>
            <option value="short-answer">Short Answer (1-2 paragraphs)</option>
            <option value="worked-solution">Worked Solution (Maths/Science)</option>
            <option value="source-based">Source-Based Response (SBQ/SEQ)</option>
          </select>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Band / Grade Target</label>
          <select class="input" id="mr-band">
            <option value="top-band">Top Band / A grade</option>
            <option value="mid-band">Mid Band / B-C grade</option>
            <option value="both">Show both (with comparison)</option>
          </select>
        </div>
        <div class="input-group" style="margin-bottom:var(--sp-3);">
          <label class="input-label">Rubric / Mark Scheme (optional)</label>
          <textarea class="input" id="mr-rubric" rows="2" placeholder="Paste band descriptors or success criteria here..."></textarea>
        </div>
        <div class="input-group">
          <label class="input-label">Additional Instructions (optional)</label>
          <textarea class="input" id="mr-notes" rows="2" placeholder="e.g. Focus on PEEL structure, include counter-argument..."></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="generate">Generate Model Response</button>
      `
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
    backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
      const question = backdrop.querySelector('#mr-question').value.trim();
      if (!question) { showToast('Please enter a question or task.', 'danger'); return; }
      const subject = backdrop.querySelector('#mr-subject').value;
      const level = backdrop.querySelector('#mr-level').value;
      const type = backdrop.querySelector('#mr-type').value;
      const band = backdrop.querySelector('#mr-band').value;
      const rubric = backdrop.querySelector('#mr-rubric').value.trim();
      const notes = backdrop.querySelector('#mr-notes').value.trim();
      const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
      const planContext = aiMsgs.length > 0 ? `\n\nLesson context:\n${aiMsgs[aiMsgs.length - 1].content.slice(0, 2000)}` : '';
      close();
      const resultEl = container.querySelector('#ai-result');
      resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Creating model response...</div>';
      resultEl.scrollIntoView({ behavior: 'smooth' });
      try {
        const prompt = `Generate a model response for:\nQuestion: ${question}\nSubject: ${subject}\nLevel: ${level}\nResponse type: ${type}\nTarget band: ${band}\n${rubric ? `Rubric/Mark scheme:\n${rubric}` : ''}\n${notes ? `Additional: ${notes}` : ''}${planContext}`;
        const result = await generateModelResponse(prompt, subject, level);
        setComponent('modelResponse', result, subject || 'Model Response');
        resultEl.innerHTML = '';
        renderComponents(container);
        showToast('Model response generated!', 'success');
      } catch (err) {
        resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
      }
    });
  });

  // EEE: Source Analysis
  container.querySelector('#ai-source-analysis-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating source-based questions...</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
    try {
      const result = await generateSourceAnalysis(planText, cls.subject, cls.level);
      setComponent('sourceAnalysis', result, cls.subject || 'Source Analysis');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Source analysis generated!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  // WS-4 Materials: Slide Deck — generate from the current plan, preview, attach
  container.querySelector('#ai-deck-btn')?.addEventListener('click', () => generateDeckFlow(container));

  // WS-4 Materials: Audio Clip — script → AI voices (voice only) → attach
  container.querySelector('#ai-audio-btn')?.addEventListener('click', () => {
    if (!currentLessonId) { showToast('Save the lesson first — materials attach to a saved lesson.', 'danger'); return; }
    showAudioClipModal(container);
  });


  // Share Lesson (export/import JSON)
  // Word export
  container.querySelector('#export-word-btn')?.addEventListener('click', exportToWord);

  container.querySelector('#share-lesson-btn')?.addEventListener('click', () => {
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0 && Object.keys(lessonComponents).length === 0) {
      showToast('No lesson content to share yet.', 'danger'); return;
    }
    showShareModal(container);
  });

  // Lesson Templates
  container.querySelector('#templates-btn')?.addEventListener('click', () => {
    showTemplateModal(container);
  });

  // Spatial Layout
  renderSpatialSection(container);
  renderSpatialContextBar(container);

  // Cockpit (WS-A): persistent Run of Show panel + journey bar
  renderRunOfShow(container);
  renderJourneyBar(container);

  // Linked Resources
  renderLinkedResourcesSection(container);
  // === NEW TOOLS: Arts, Music, NFS, D&T ===
  const newToolHandler = async (btnId, toolKey, label, systemPrompt) => {
    container.querySelector(btnId)?.addEventListener('click', async () => {
      if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
      const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
      if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
      const planText = aiMsgs.map(m => m.content).join('\n\n');
      const cls = planClassContext || {};
      const resultEl = container.querySelector('#ai-result');
      resultEl.innerHTML = `<div class="chat-typing" style="padding:var(--sp-4);">Generating ${label}...</div>`;
      resultEl.scrollIntoView({ behavior: 'smooth' });
      try {
        const result = await sendChat([{ role: 'user', content: `Based on this lesson plan:\n\n${planText}\n\nGenerate ${label} content for ${cls.subject || 'the lesson'} (${cls.level || 'Secondary'}).` }], {
          trackLabel: 'eeeToolGenerate', systemPrompt, temperature: 0.6, maxTokens: 2048
        });
        setComponent(toolKey, result, cls.subject || label);
        resultEl.innerHTML = '';
        renderComponents(container);
        showToast(`${label} added!`, 'success');
      } catch (err) {
        resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
      }
    });
  };

  newToolHandler('#ai-stave-btn', 'staveNotation', 'Stave Notation',
    'You are a music theory specialist for Singapore secondary schools. Generate staff notation exercises with treble clef, time signatures, and note values. Use text-based notation representation that is clear and educational.');
  newToolHandler('#ai-rhythm-btn', 'rhythmTool', 'Rhythm & Percussion',
    'You are a music education specialist for Singapore schools. Generate rhythm patterns, body percussion sequences, and drum notation guides. Include counting patterns and call-and-response exercises.');
  newToolHandler('#ai-art-critique-btn', 'artCritique', 'Art Critique Guide',
    'You are an art education specialist for Singapore schools. Generate structured art critique guides using the Feldman model: describe, analyse, interpret, judge. Include guiding questions for each stage.');
  newToolHandler('#ai-design-process-btn', 'designProcess', 'Design Process',
    'You are a Design & Technology specialist for Singapore secondary schools. Generate a structured design process guide: identify needs, explore ideas, develop solutions, realise prototype, test and evaluate. Include specific prompts for each stage.');
  newToolHandler('#ai-recipe-btn', 'recipeBuilder', 'Recipe & Nutrition',
    'You are a Food & Nutrition Science specialist for Singapore secondary schools. Generate recipe cards with ingredients, step-by-step instructions, nutritional information, and food safety notes. Align with NFS syllabus outcomes.');

  // Cross-Subject Connector
  newToolHandler('#ai-cross-subject-btn', 'crossSubject', 'Cross-Subject Links',
    `You are a Singapore MOE curriculum specialist with deep knowledge of all subject syllabi from Primary to Pre-University.
Given a lesson plan, identify 3-5 meaningful cross-curricular connections to OTHER subjects.
For each connection:
1. Name the connected subject and specific topic
2. Explain the conceptual link (not just surface similarity)
3. Suggest a concrete integration activity the teacher could try
4. Note the relevant MOE syllabus outcome if applicable

Format as clear sections with headers. Focus on connections that genuinely enrich learning, not forced links.
Examples: Math↔Science (graphs, measurement), English↔History (source analysis), Music↔Physics (waves, frequency).`);

  // Resource Recommender
  container.querySelector('#ai-resource-rec-btn')?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
    if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const planText = aiMsgs.map(m => m.content).join('\n\n');
    const cls = planClassContext || {};
    const resultEl = container.querySelector('#ai-result');
    resultEl.innerHTML = `<div class="chat-typing" style="padding:var(--sp-4);">Finding recommended resources...</div>`;
    resultEl.scrollIntoView({ behavior: 'smooth' });

    // Gather local resources for the prompt
    const knowledgeUploads = Store.getKnowledgeUploads?.() || [];
    const stimulusLib = Store.getStimulusLibrary?.() || [];
    const kbTitles = knowledgeUploads.map(k => k.title || k.name || 'Untitled').slice(0, 20).join(', ');
    const stimTitles = stimulusLib.map(s => s.title || s.name || 'Untitled').slice(0, 20).join(', ');

    // List of available simulations
    const simCategories = 'Physics: pendulum, waves, specific-heat, electromagnets, lenses, density; Chemistry: titration, qualitative-analysis, electrolysis, rates-of-reaction, gas-tests, salts, chromatography; Biology: photosynthesis, diffusion, osmosis, enzyme-activity, microscopy, food-tests; Interactive: molecular-viewer, molecular-builder, particle-dynamics, design-process, kitchen-layout, stave-notation, rhythm-tool';

    try {
      const result = await sendChat([{ role: 'user', content: `Based on this lesson plan:
${planText}

Subject: ${cls.subject || 'General'}, Level: ${cls.level || 'Secondary'}

AVAILABLE RESOURCES (ONLY recommend from these):
${kbTitles ? '- Knowledge Base: ' + kbTitles : '- Knowledge Base: None uploaded'}
${stimTitles ? '- Stimulus Library: ' + stimTitles : '- Stimulus Library: None saved'}
- Built-in Simulations (use exact IDs): ${simCategories}

Recommend the top 3-5 that genuinely fit. Use exact resource names/IDs from above. Do NOT invent resources that aren't in the lists.` }], {
        trackLabel: 'resourceRecommender',
        systemPrompt: `You are a practical Singapore teaching resource curator. CRITICAL RULES:
1. ONLY recommend resources that ACTUALLY EXIST in the lists provided below. Do NOT invent resources.
2. For built-in simulations, ONLY suggest ones from the exact list given — use the exact simulation ID.
3. For each recommendation, format as:

**[Resource Name]** — [Type: Simulation / KB Item / External Tool]
- **When**: [Exact moment in the lesson to use it]
- **Setup**: [1 sentence — what to prepare or click]
- **Why**: [1 sentence — how it serves the learning objective]

Maximum 3-5 recommendations. If nothing genuinely fits, say so — don't pad with irrelevant items.`,
        temperature: 0.5, maxTokens: 2048
      });
      setComponent('resourceRec', result, cls.subject || 'Resources');
      resultEl.innerHTML = '';
      renderComponents(container);
      showToast('Resource recommendations added!', 'success');
    } catch (err) {
      resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${err.message}</div>`;
    }
  });

  container.querySelector('#ai-kitchen-btn')?.addEventListener('click', () => {
    // Open spatial designer with a kitchen preset hint
    sessionStorage.setItem('cocher_spatial_preset', 'stations'); // stations preset works for kitchen layout
    import('../router.js').then(m => m.navigate('/spatial'));
    showToast('Opening Spatial Designer for kitchen layout...', 'success');
  });

  container.querySelector('#spatial-layout-btn')?.addEventListener('click', () => {
    const spatialSection = container.querySelector('#spatial-section');
    spatialSection.scrollIntoView({ behavior: 'smooth' });
    renderSpatialSection(container, true);
  });

  // Toolbar mode toggle (labelled chips ↔ compact icons) — full re-render to re-wire handlers
  container.querySelector('#toggle-toolbar-mode')?.addEventListener('click', () => {
    const prefs = getLPPrefs();
    // Default view is labelled chips; the toggle flips power users to the
    // compact icon-only bar and back. The choice persists via saveLPPrefs.
    const newMode = (prefs.toolbarMode || 'labels') === 'icons' ? 'labels' : 'icons';
    prefs.toolbarMode = newMode;
    saveLPPrefs(prefs);
    render(container);
  });

  // Date/time setup — populate with today and show timetable hints
  const dateInput = container.querySelector('#lesson-date');
  const periodSelect = container.querySelector('#lesson-period');
  if (dateInput) {
    const today = new Date();
    dateInput.value = lessonDateTime?.date || today.toISOString().split('T')[0];
    if (lessonDateTime?.period) periodSelect.value = lessonDateTime.period;
  }
  setupTimetableHints(container);
}

/* ── Messages render ── */
// Small chips showing the images/PDFs a teacher attached to a message. In-session
// image attachments carry a previewUrl (thumbnail); after reload only light
// metadata survives, so we fall back to a type icon.
function renderMsgAttachments(m) {
  const atts = Array.isArray(m.attachments) ? m.attachments : [];
  if (!atts.length) return '';
  const chips = atts.map(a => {
    const thumb = a.kind === 'image' && a.previewUrl
      ? `<img src="${a.previewUrl}" alt="" style="width:22px;height:22px;object-fit:cover;border-radius:3px;flex-shrink:0;" />`
      : a.kind === 'image'
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 7px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);border-radius:6px;font-size:0.6875rem;max-width:180px;">
      ${thumb}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(a.name)}</span>
    </span>`;
  }).join('');
  return `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${chips}</div>`;
}

function renderMessages(el, classes) {
  if (!el) return;

  // Vigilance nudge card replaces the starter gallery until resolved
  if (vigilanceState && chatMessages.length === 0) {
    el.innerHTML = buildVigilanceNudgeHTML();
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const resend = () => {
      if (!input || !sendBtn || !vigilanceState) return;
      input.value = vigilanceState.prompt;
      vigilanceState = null;
      sendBtn.click();
    };
    el.querySelectorAll('.vigilance-class').forEach(btn => {
      btn.addEventListener('click', () => {
        const cls = Store.getClasses().find(c => c.id === btn.dataset.classId);
        if (cls) {
          planClassContext = { id: cls.id, name: cls.name, subject: cls.subject || '', level: cls.level || '' };
        }
        resend();
      });
    });
    el.querySelector('#vigilance-skip')?.addEventListener('click', resend);
    el.querySelector('#vigilance-describe')?.addEventListener('click', () => {
      if (!input || !vigilanceState) return;
      input.value = `${vigilanceState.prompt} — for my [class/level], who [what they enjoy / where they struggle]; they already know [prior knowledge].`;
      vigilanceState = null;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
      input.focus();
      const start = input.value.indexOf('[');
      const end = input.value.indexOf(']', start);
      if (start >= 0 && end > start) input.setSelectionRange(start, end + 1);
    });
    return;
  }

  if (chatMessages.length === 0) {
    const prompts = buildQuickPrompts(classes || Store.getClasses());
    el.innerHTML = `
      <div style="padding:var(--sp-6) var(--sp-4);">
        <div style="max-width:520px;margin:0 auto;">
          <div style="text-align:center;margin-bottom:var(--sp-5);">
            <div style="width:48px;height:48px;margin:0 auto var(--sp-3);background:var(--accent-light);border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;color:var(--accent);">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 style="font-size:1.0625rem;font-weight:600;margin-bottom:var(--sp-1);color:var(--ink);">What would you like to plan?</h3>
            <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">
              Click a starter below to load it — edit the <span style="background:var(--accent-light);color:var(--accent);padding:0 4px;border-radius:3px;font-size:0.75rem;font-weight:500;">[placeholders]</span> before sending.
            </p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-2);">
            ${prompts.map((p, i) => {
              const desc = p.desc || (p.prompt.length > 70 ? p.prompt.slice(0, 68).replace(/\s\S*$/, '') + '...' : p.prompt);
              const icons = ['<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
                '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/>',
                '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
                '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
                '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
                '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 3v18"/>'];
              return `<button class="quick-prompt" data-prompt="${esc(p.prompt)}" style="
                display:flex;flex-direction:column;align-items:flex-start;gap:4px;
                padding:var(--sp-3);border:1px solid var(--border-light);border-radius:var(--radius);
                background:var(--bg-card);cursor:pointer;text-align:left;transition:all 0.15s;
                min-height:60px;"
                onmouseenter="this.style.borderColor='var(--accent)';this.style.background='var(--accent-light)'"
                onmouseleave="this.style.borderColor='var(--border-light)';this.style.background='var(--bg-card)'">
                <div style="display:flex;align-items:center;gap:6px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" style="flex-shrink:0;">${icons[i % icons.length]}</svg>
                  <span style="font-size:0.8125rem;font-weight:600;color:var(--ink);">${p.label}</span>
                </div>
                <span style="font-size:0.6875rem;color:var(--ink-muted);line-height:1.4;">${desc}</span>
              </button>`;
            }).join('')}
          </div>
        </div>
      </div>`;
  } else {
    el.innerHTML = chatMessages.map(m => `
      <div class="chat-msg ${m.role === 'user' ? 'user' : 'ai'}">
        ${m.role === 'user' ? esc(m.content) : md(m.content)}
        ${m.role === 'user' ? renderMsgAttachments(m) : ''}
      </div>
    `).join('');

    // Follow-up prompts after last AI response (only if not currently generating)
    if (!isGenerating && chatMessages.length >= 2 && chatMessages[chatMessages.length - 1].role === 'assistant') {
      // Pedagogical nudges — subtle coaching indicators
      const lastAI = chatMessages[chatMessages.length - 1].content.toLowerCase();
      const nudges = [];

      // Check for teacher-talk heavy plans (3+ consecutive "teacher explains/presents/tells")
      const teacherTalkCount = (lastAI.match(/teacher (explains|presents|tells|lectures|demonstrates|shows)/gi) || []).length;
      const studentActivityCount = (lastAI.match(/students? (discuss|explore|investigate|create|collaborate|present|practise)/gi) || []).length;
      if (teacherTalkCount >= 3 && studentActivityCount < 2) {
        nudges.push({ icon: '&#9729;', text: 'This plan has several teacher-led segments in a row. Consider adding a student activity to increase engagement.', color: '#f59e0b' });
      }

      // Check for no assessment checkpoint
      const hasAssessment = /exit ticket|formative|check for understanding|quiz|assessment|checkpoint/i.test(lastAI);
      const componentKeys = Object.keys(lessonComponents);
      if (!hasAssessment && !componentKeys.includes('exitTicket') && chatMessages.length >= 4) {
        nudges.push({ icon: '&#9998;', text: 'No assessment checkpoint detected. Consider adding a formative check to monitor understanding.', color: '#3b82f6' });
      }

      // Check for estimated time (if plan mentions minutes). Still a heuristic,
      // but no double counting: a stated total ("55-minute lesson", "Total: 55
      // min") wins outright; otherwise only durations on list items / section
      // headings are summed — never every "N min" token in the prose.
      const planTextRaw = chatMessages[chatMessages.length - 1].content;
      const allTimeTokens = lastAI.match(/(\d+)\s*min/gi) || [];
      if (allTimeTokens.length >= 2) {
        const planLines = planTextRaw.split('\n');
        const isHeadingLine = (line) => /^\s*#{1,6}\s/.test(line) || /^\s*\*\*[^*]+\*\*:?\s*$/.test(line);
        let totalMin = 0;
        // 1) Stated total: "NN-minute lesson" in the first line or a heading,
        //    or an explicit "Total/Duration: NN min" anywhere in the plan.
        const firstLineIdx = planLines.findIndex(l => l.trim() !== '');
        for (let i = 0; i < planLines.length; i++) {
          if (i !== firstLineIdx && !isHeadingLine(planLines[i])) continue;
          const m = planLines[i].match(/(\d+)\s*[-‑– ]\s*min(?:ute)?s?\s+(?:lesson|period|class|session|plan)/i);
          if (m) { totalMin = parseInt(m[1], 10); break; }
        }
        if (!totalMin) {
          const m = planTextRaw.match(/\b(?:total|duration)\b[^0-9\n]{0,20}(\d+)\s*min/i);
          if (m) totalMin = parseInt(m[1], 10);
        }
        // 2) No stated total → sum segment durations from list items / headings.
        if (!totalMin) {
          planLines.forEach(line => {
            if (!/^\s*(?:[-*+]|\d+[.)])\s/.test(line) && !isHeadingLine(line)) return;
            (line.match(/(\d+)\s*min/gi) || []).forEach(t => { totalMin += parseInt(t, 10); });
          });
        }
        if (totalMin > 0) {
          nudges.push({ icon: '&#9200;', text: `Estimated lesson time: ~${totalMin} minutes`, color: '#8b5cf6' });
        }
      }

      if (nudges.length > 0) {
        el.insertAdjacentHTML('beforeend', `
          <div style="padding:var(--sp-1) var(--sp-4) var(--sp-2);">
            ${nudges.map(n => `<div style="display:flex;align-items:flex-start;gap:6px;padding:4px 10px;font-size:0.6875rem;color:${n.color};line-height:1.4;border-left:2px solid ${n.color};margin-bottom:4px;">
              <span style="flex-shrink:0;">${n.icon}</span> ${n.text}
            </div>`).join('')}
          </div>`);
      }

      const followUps = buildFollowUpPrompts(chatMessages);
      if (followUps.length > 0) {
        el.insertAdjacentHTML('beforeend', `
          <div style="padding:var(--sp-2) var(--sp-4) var(--sp-3);display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-start;">
            ${followUps.map(f => `<button class="quick-prompt" data-prompt="${esc(f.prompt)}" style="
              font-size:0.75rem;padding:5px 12px;border-radius:16px;border:1px solid var(--border-light);
              background:var(--bg-card);color:var(--ink-secondary);cursor:pointer;transition:all 0.15s;
              white-space:nowrap;line-height:1.3;">${f.label}</button>`).join('')}
          </div>`);
      }
    }
  }
  if (isGenerating) el.insertAdjacentHTML('beforeend', `<div class="chat-typing">Co-Cher is thinking...</div>`);
  // Render LaTeX in all message content
  processLatex(el);
  el.scrollTop = el.scrollHeight;
}

/* ── Plan content (right panel) ── */
function renderPlanContent(el) {
  if (!el) return;
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');

  if (aiMsgs.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="padding:var(--sp-10);">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <h3 class="empty-state-title">Your lesson plan</h3>
        <p class="empty-state-text">Start chatting with Co-Cher to collaboratively design your lesson.</p>
      </div>`;
    return;
  }

  // Show the latest AI response as the working plan (document voice)
  const latest = aiMsgs[aiMsgs.length - 1].content;
  el.innerHTML = `
    <div class="card doc-canvas" style="padding:var(--sp-6);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-4);gap:8px;flex-wrap:wrap;">
        <span class="text-overline" style="color:var(--ink-faint);">Latest from Co-Cher</span>
        <span style="display:flex;align-items:center;gap:6px;">
          <button class="btn btn-ghost btn-sm" id="critical-friend-btn" title="A trusted colleague reads your plan with a red pen">&#128395;&#65039; Critical friend</button>
          <button class="btn btn-ghost btn-sm" id="focus-mode-btn" title="Hide the sidebar while planning (Ctrl+.)">&#9974; Focus</button>
          <span class="badge badge-blue badge-dot">${aiMsgs.length} exchange${aiMsgs.length > 1 ? 's' : ''}</span>
        </span>
      </div>
      <div style="font-size:0.875rem;line-height:1.7;color:var(--ink-secondary);">${md(latest)}</div>
      <div id="critique-panel"></div>
    </div>
    ${aiMsgs.length > 1 ? `
      <details style="margin-top:var(--sp-4);">
        <summary style="cursor:pointer;font-size:0.8125rem;font-weight:500;color:var(--ink-muted);padding:var(--sp-2) 0;">
          View earlier responses (${aiMsgs.length - 1})
        </summary>
        <div style="display:flex;flex-direction:column;gap:var(--sp-3);margin-top:var(--sp-3);">
          ${aiMsgs.slice(0, -1).reverse().map((m, i) => `
            <div class="card" style="padding:var(--sp-4);opacity:${0.9 - i * 0.1};">
              <div style="font-size:0.8125rem;line-height:1.6;color:var(--ink-muted);">${md(m.content)}</div>
            </div>
          `).join('')}
        </div>
      </details>
    ` : ''}
  `;

  // Focus mode toggle
  el.querySelector('#focus-mode-btn')?.addEventListener('click', () => toggleFocusMode());

  // Critical friend: a colleague reads the plan with a red pen
  el.querySelector('#critical-friend-btn')?.addEventListener('click', async () => {
    const panel = el.querySelector('#critique-panel');
    const btn = el.querySelector('#critical-friend-btn');
    if (!panel || !btn) return;
    let espoused = '';
    try { espoused = localStorage.getItem('cocher_espoused_ideology') || ''; } catch { /* ignore */ }
    const lens = selectedIdeology || espoused || '';
    btn.disabled = true;
    panel.innerHTML = '<div class="chat-typing" style="padding:var(--sp-3) 0;">Reading your plan with a red pen…</div>';
    try {
      const critique = await critiquePlan(latest, lens);
      panel.innerHTML = `
        <div style="margin-top:var(--sp-5);padding:var(--sp-4);border:1px solid var(--redpen-light,#f3d6d6);border-left:3px solid var(--redpen,#C94F4F);border-radius:10px;background:color-mix(in srgb, var(--redpen-light,#f8e8e8) 40%, transparent);">
          <div style="font-size:0.6875rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--redpen,#C94F4F);margin-bottom:6px;">
            Critical friend${lens ? ` · ${lens.replace(/-/g, ' ')}` : ''}
          </div>
          <div style="font-size:0.8125rem;line-height:1.65;color:var(--ink-secondary);">${md(critique)}</div>
          <button class="btn btn-ghost btn-sm" id="critique-dismiss" style="margin-top:8px;color:var(--ink-muted);">Dismiss</button>
        </div>`;
      panel.querySelector('#critique-dismiss')?.addEventListener('click', () => { panel.innerHTML = ''; });
    } catch (err) {
      panel.innerHTML = `<p class="redpen-note" style="margin-top:var(--sp-3);">${escapeHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
    }
  });

  // Cached expansions re-mount under their chips on every plan re-render
  mountCachedExpansions(el);

  // Render LaTeX in plan content
  processLatex(el);
}

/* ── Save lesson modal ── */
function showSaveModal(container, classes) {
  if (chatMessages.length === 0) {
    showToast('Chat with Co-Cher first before saving.', 'danger');
    return;
  }

  const existing = currentLessonId ? Store.getLesson(currentLessonId) : null;

  // Auto-suggest class linkage if there's context
  const suggestedClassId = existing?.classId || planClassContext?.id || '';

  const { backdrop, close } = openModal({
    title: existing ? 'Update Lesson' : 'Save Lesson',
    body: `
      <div class="input-group">
        <label class="input-label">Lesson Title</label>
        <input class="input" id="save-title" value="${escAttr(existing?.title || suggestTitle())}" placeholder="e.g. Exploring Fractions — P4 Maths" />
      </div>
      <div class="input-group">
        <label class="input-label">Link to Class (optional)</label>
        <select class="input" id="save-class">
          <option value="">No class</option>
          ${classes.map(c => `<option value="${c.id}" ${suggestedClassId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Status</label>
        <select class="input" id="save-status">
          <option value="draft" ${(!existing || existing.status === 'draft') ? 'selected' : ''}>Draft</option>
          <option value="ready" ${existing?.status === 'ready' ? 'selected' : ''}>Ready to Teach</option>
          <option value="completed" ${existing?.status === 'completed' ? 'selected' : ''}>Completed</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">E21CC Focus</label>
        <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
          <label style="display:flex;gap:4px;align-items:center;font-size:0.8125rem;cursor:pointer;">
            <input type="checkbox" value="cait" class="e21cc-check" ${existing?.e21ccFocus?.includes('cait') ? 'checked' : ''} /> CAIT
          </label>
          <label style="display:flex;gap:4px;align-items:center;font-size:0.8125rem;cursor:pointer;">
            <input type="checkbox" value="cci" class="e21cc-check" ${existing?.e21ccFocus?.includes('cci') ? 'checked' : ''} /> CCI
          </label>
          <label style="display:flex;gap:4px;align-items:center;font-size:0.8125rem;cursor:pointer;">
            <input type="checkbox" value="cgc" class="e21cc-check" ${existing?.e21ccFocus?.includes('cgc') ? 'checked' : ''} /> CGC
          </label>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">${existing ? 'Update' : 'Save Lesson'}</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    const title = backdrop.querySelector('#save-title').value.trim() || 'Untitled Lesson';
    const classId = backdrop.querySelector('#save-class').value || null;
    const status = backdrop.querySelector('#save-status').value;
    const e21ccFocus = [...backdrop.querySelectorAll('.e21cc-check:checked')].map(cb => cb.value);

    const data = {
      title,
      classId,
      status,
      e21ccFocus,
      components: { ...lessonComponents },
      chatHistory: stripAttachmentData(chatMessages),
      plan: chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n---\n\n')
    };
    // WS-5: a lesson planned via "Plan a CCE lesson" is tagged on first save;
    // updates never touch kind, so existing lessons keep whatever they have.
    if (!existing && cceContext) data.kind = 'cce';

    if (existing) {
      Store.updateLesson(currentLessonId, data);
      showToast('Lesson updated!', 'success');
      close();
      // Refresh the cockpit in place — title, run of show, journey, spatial bar
      const subtitleEl = container.querySelector('#lp-canvas-subtitle');
      if (subtitleEl) subtitleEl.textContent = `Editing: ${title}`;
      renderRunOfShow(container);
      renderJourneyBar(container);
      renderSpatialContextBar(container);
    } else {
      const lesson = Store.addLesson(data);
      currentLessonId = lesson.id;
      // A spatial layout linked before the lesson was saved can now be attached.
      consumePendingSpatialLayout();
      showToast('Lesson saved!', 'success');
      close();
      // P3/P4: land on the lesson's canonical URL. renderForLesson rehydrates
      // the whole cockpit (stage CTA, journey bar, status badge) and an F5 now
      // reloads this lesson instead of silently detaching into a fresh draft.
      navigate(`/lesson-planner/${lesson.id}`);
    }
  });

  setTimeout(() => backdrop.querySelector('#save-title')?.focus(), 100);
}

function suggestTitle() {
  const firstUser = chatMessages.find(m => m.role === 'user');
  if (!firstUser) return '';
  return firstUser.content.slice(0, 60) + (firstUser.content.length > 60 ? '...' : '');
}

function escAttr(s) { return (s || '').replace(/"/g, '&quot;'); }

/* ══════════ Run of Show (A1) ══════════ */

const ROS_MODE_OPTIONS = [
  { value: '', label: 'No grouping' },
  { value: 'individual', label: 'Individual' },
  { value: 'pairs', label: 'Pairs' },
  { value: 'groups', label: 'Groups' },
  { value: 'whole-class', label: 'Whole class' }
];

// The six E21CC tracking dimensions a segment can develop (key → label),
// sourced from the tracking schema registry so wording stays centralised.
const E21CC_SEGMENT_FIELDS = SCHEMA_PRESETS.e21cc.fields;
const E21CC_SEGMENT_KEYS = E21CC_SEGMENT_FIELDS.map(f => f.key);
const E21CC_SEGMENT_LABELS = Object.fromEntries(E21CC_SEGMENT_FIELDS.map(f => [f.key, f.label]));

function rosBlankSegment(n) {
  return {
    id: `seg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Segment ${n}`,
    duration: 5,
    activity: '',
    studentInstructions: '',
    layoutSceneId: null,
    grouping: null,
    resources: [],
    e21ccFocus: null,
    frameworkId: null,
    teachingArea: null,
    teachingAction: null,
    teachingActionOther: ''
  };
}

/* Assemble the generateRunOfShow() payload from the live conversation:
 * latest plan text, class portrait (planClassContext wins, then the saved
 * lesson's class), and a duration hint scraped from the teacher's prompts. */
function buildRunOfShowRequest(lesson) {
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
  const plan = aiMsgs.map(m => m.content).join('\n\n---\n\n') || lesson?.plan || '';
  const classId = planClassContext?.id || lesson?.classId || null;
  const portraitText = classId ? (Store.getPortraitPromptText?.(classId) || '') : '';
  const className = planClassContext?.name || (classId ? (Store.getClass?.(classId)?.name || '') : '');

  let durationHint = null;
  const userTexts = chatMessages
    .filter(m => m.role === 'user' && typeof m.content === 'string')
    .map(m => m.content).join('\n');
  const dm = userTexts.match(/(\d{2,3})\s*[- ]?min(?:ute)?s?\b/i);
  if (dm) {
    const n = parseInt(dm[1], 10);
    if (n >= 20 && n <= 180) durationHint = n;
  }

  return { plan, className, portraitText, durationHint };
}

/* Editor modal: list of segment rows (name, duration, activity, student
 * instructions, grouping mode) with reorder/remove/add and Save/Cancel.
 * Saving writes lesson.runOfShow via Store.updateLesson. */
function showRunOfShowEditor(container, runOfShow) {
  let segs = (runOfShow?.segments || []).map((s, i) => ({
    id: s.id || rosBlankSegment(i + 1).id,
    name: String(s.name ?? '').trim() || `Segment ${i + 1}`,
    duration: Math.min(240, Math.max(1, Math.round(Number(s.duration)) || 5)),
    activity: String(s.activity ?? '').trim(),
    studentInstructions: String(s.studentInstructions ?? '').trim(),
    layoutSceneId: (typeof s.layoutSceneId === 'string' && s.layoutSceneId) ? s.layoutSceneId : null,
    grouping: (s.grouping && s.grouping.mode)
      ? { mode: s.grouping.mode, groups: Array.isArray(s.grouping.groups) ? s.grouping.groups : [] }
      : null,
    resources: Array.isArray(s.resources) ? s.resources : [],
    e21ccFocus: E21CC_SEGMENT_KEYS.includes(s.e21ccFocus) ? s.e21ccFocus : null,
    frameworkId: (typeof s.frameworkId === 'string' && s.frameworkId) ? s.frameworkId : null,
    teachingArea: TEACHING_AREAS.some(a => a.key === s.teachingArea) ? s.teachingArea : null,
    teachingAction: (typeof s.teachingAction === 'string' && s.teachingAction) ? s.teachingAction : null,
    teachingActionOther: String(s.teachingActionOther ?? '').trim()
  }));
  if (segs.length === 0) segs = [rosBlankSegment(1)];

  // Scene picker source (A5): the linked layout's scenes, if the current
  // lesson has one. No linked layout or no scenes → no picker, no clutter.
  const editorLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const linkedLayout = editorLesson?.spatialLayout
    ? (Store.getSavedLayouts() || []).find(l => l.id === editorLesson.spatialLayout)
    : null;
  const layoutScenes = Array.isArray(linkedLayout?.scenes)
    ? linkedLayout.scenes.filter(sc => sc && sc.id)
    : [];

  const { backdrop, close } = openModal({
    title: 'Run of Show',
    width: 640,
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">
        The runnable sequence of segments for this lesson. Edit, reorder, then save.
        <span id="ros-total" style="font-weight:600;color:var(--ink);"></span>
      </p>
      <div id="ros-rows" style="display:flex;flex-direction:column;gap:var(--sp-3);max-height:52vh;overflow-y:auto;padding-right:4px;"></div>
      <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-3);align-items:center;">
        <button class="btn btn-ghost btn-sm" id="ros-add">+ Add segment</button>
        <button class="btn btn-ghost btn-sm" id="ros-map-stp" title="Suggest a Singapore Teaching Practice area + action for each segment — non-destructive; you review before saving">&#129517; Map to STP</button>
        <button class="btn btn-ghost btn-sm" id="ros-regenerate" style="margin-left:auto;" title="Replace these segments with a fresh AI staging of the current plan">
          &#127916; Regenerate with AI
        </button>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="save">Save Run of Show</button>
    `
  });

  const rowsEl = backdrop.querySelector('#ros-rows');
  const totalEl = backdrop.querySelector('#ros-total');

  const updateTotal = () => {
    const total = segs.reduce((n, s) => n + (Number(s.duration) || 0), 0);
    totalEl.textContent = ` Total: ${total} min · ${segs.length} segment${segs.length === 1 ? '' : 's'}.`;
  };

  // Pull current input values back into segs (before reorder/remove/add/save)
  const syncFromDOM = () => {
    rowsEl.querySelectorAll('[data-seg-idx]').forEach(row => {
      const s = segs[parseInt(row.dataset.segIdx, 10)];
      if (!s) return;
      s.name = row.querySelector('.ros-name').value.trim();
      const d = parseInt(row.querySelector('.ros-duration').value, 10);
      s.duration = Number.isFinite(d) ? Math.min(240, Math.max(1, d)) : 5;
      s.activity = row.querySelector('.ros-activity').value.trim();
      s.studentInstructions = row.querySelector('.ros-instructions').value.trim();
      const areaSel = row.querySelector('.ros-area');
      if (areaSel) {
        s.teachingArea = areaSel.value || null;
        if (!s.teachingArea) { s.teachingAction = null; s.teachingActionOther = ''; }
      }
      const actionSel = row.querySelector('.ros-action');
      if (actionSel) s.teachingAction = actionSel.value || null;
      const actionOther = row.querySelector('.ros-action-other');
      if (actionOther) s.teachingActionOther = actionOther.value.trim();
      const mode = row.querySelector('.ros-mode').value;
      s.grouping = mode ? { mode, groups: s.grouping?.groups || [] } : null;
      // Scene select only exists when the lesson has a linked layout with
      // scenes; without it, any existing layoutSceneId is left untouched.
      const sceneSel = row.querySelector('.ros-scene');
      if (sceneSel) s.layoutSceneId = sceneSel.value || null;
      const focusSel = row.querySelector('.ros-e21cc');
      if (focusSel) s.e21ccFocus = focusSel.value || null;
      const fwSel = row.querySelector('.ros-framework');
      if (fwSel) s.frameworkId = fwSel.value || null;
    });
  };

  const renderRows = () => {
    rowsEl.innerHTML = segs.map((s, i) => `
      <div data-seg-idx="${i}" style="border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--sp-3);background:var(--bg-card);">
        <div style="display:flex;align-items:center;gap:var(--sp-1);margin-bottom:var(--sp-2);">
          <span style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:var(--accent-light);color:var(--accent);font-size:0.6875rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${i + 1}</span>
          <input class="input ros-name" value="${esc(s.name)}" placeholder="Segment name" style="flex:1;min-width:0;padding:4px 8px;font-size:0.8125rem;" />
          <input class="input ros-duration" type="number" min="1" max="240" value="${esc(String(s.duration))}" title="Duration (minutes)" style="width:60px;padding:4px 6px;font-size:0.8125rem;" />
          <span style="font-size:0.6875rem;color:var(--ink-faint);">min</span>
          <button class="btn btn-ghost btn-sm ros-up" data-idx="${i}" title="Move up" ${i === 0 ? 'disabled' : ''} style="padding:2px 6px;">&uarr;</button>
          <button class="btn btn-ghost btn-sm ros-down" data-idx="${i}" title="Move down" ${i === segs.length - 1 ? 'disabled' : ''} style="padding:2px 6px;">&darr;</button>
          <button class="btn btn-ghost btn-sm ros-remove" data-idx="${i}" title="Remove segment" style="padding:2px 6px;color:var(--danger);">&#10005;</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
          <input class="input ros-activity" value="${esc(s.activity)}" placeholder="Teacher summary — what happens in this segment" style="padding:4px 8px;font-size:0.8125rem;" />
          <textarea class="input ros-instructions" rows="2" placeholder="Student-facing instructions" style="font-size:0.8125rem;resize:vertical;">${esc(s.studentInstructions)}</textarea>
          <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;">
            <label style="display:inline-flex;align-items:center;gap:var(--sp-1);font-size:0.6875rem;color:var(--ink-faint);">STP &middot; Teaching Area
              <select class="input ros-area" title="Singapore Teaching Practice — the Lesson Enactment area this segment enacts" style="width:auto;padding:4px 8px;font-size:0.8125rem;">
                <option value="">(none)</option>
                ${TEACHING_AREAS.map(a => `<option value="${esc(a.key)}" ${s.teachingArea === a.key ? 'selected' : ''}>${a.icon} ${esc(a.label)}</option>`).join('')}
              </select>
            </label>
            ${s.teachingArea ? `
            <label style="display:inline-flex;align-items:center;gap:var(--sp-1);font-size:0.6875rem;color:var(--ink-faint);">Teaching Action
              <select class="input ros-action" title="The enactable teaching action — its student-facing framing shows in Present mode" style="width:auto;padding:4px 8px;font-size:0.8125rem;">
                <option value="">(choose)</option>
                ${actionsForArea(s.teachingArea).map(act => `<option value="${esc(act.id)}" ${s.teachingAction === act.id ? 'selected' : ''}>${esc(act.label)}</option>`).join('')}
                <option value="${TEACHING_ACTION_OTHER}" ${s.teachingAction === TEACHING_ACTION_OTHER ? 'selected' : ''}>Other&hellip;</option>
              </select>
            </label>` : ''}
            ${(s.teachingArea && s.teachingAction === TEACHING_ACTION_OTHER) ? `
            <input class="input ros-action-other" value="${esc(s.teachingActionOther || '')}" placeholder="Name your teaching action" style="flex:1;min-width:140px;padding:4px 8px;font-size:0.8125rem;" />` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;">
            <select class="input ros-mode" title="Grouping mode" style="width:auto;padding:4px 8px;font-size:0.8125rem;">
              ${ROS_MODE_OPTIONS.map(m => `<option value="${m.value}" ${(s.grouping?.mode || '') === m.value ? 'selected' : ''}>${m.label}</option>`).join('')}
            </select>
            <label style="display:inline-flex;align-items:center;gap:var(--sp-1);font-size:0.6875rem;color:var(--ink-faint);">E21CC focus
              <select class="input ros-e21cc" title="21st-century competency this segment develops (shown to students in Present mode)" style="width:auto;padding:4px 8px;font-size:0.8125rem;">
                <option value="">(none)</option>
                ${E21CC_SEGMENT_FIELDS.map(f => `<option value="${esc(f.key)}" ${s.e21ccFocus === f.key ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}
              </select>
            </label>
            <label style="display:inline-flex;align-items:center;gap:var(--sp-1);font-size:0.6875rem;color:var(--ink-faint);">Framework moment
              <select class="input ros-framework" title="Pedagogy framework enacted in this segment (its stages show to students in Present mode)" style="width:auto;padding:4px 8px;font-size:0.8125rem;">
                <option value="">(none)</option>
                ${(Store.getFrameworks?.() || []).map(f => `<option value="${esc(f.id)}" ${s.frameworkId === f.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
              </select>
            </label>
            ${layoutScenes.length > 0 ? `
            <label style="display:inline-flex;align-items:center;gap:var(--sp-1);font-size:0.6875rem;color:var(--ink-faint);">Room scene
              <select class="input ros-scene" title="Layout scene shown during this segment" style="width:auto;padding:4px 8px;font-size:0.8125rem;">
                <option value="">(none)</option>
                ${layoutScenes.map(sc => `<option value="${esc(sc.id)}" ${s.layoutSceneId === sc.id ? 'selected' : ''}>${esc(sc.name || 'Scene')}</option>`).join('')}
              </select>
            </label>` : ''}
            ${(s.grouping?.mode === 'groups' || s.grouping?.mode === 'pairs') ? `
            <button class="btn btn-ghost btn-sm ros-place" data-idx="${i}" title="Assign this segment's groups to furniture in the Spatial Designer" style="padding:4px 8px;font-size:0.75rem;color:var(--accent);">Place in room &rarr;</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');
    updateTotal();
  };

  // Structural actions are delegated so re-renders need no rewiring
  rowsEl.addEventListener('click', (e) => {
    const up = e.target.closest('.ros-up');
    const down = e.target.closest('.ros-down');
    const remove = e.target.closest('.ros-remove');
    const place = e.target.closest('.ros-place');
    if (!up && !down && !remove && !place) return;
    e.preventDefault();
    if (place) { handlePlaceInRoom(parseInt(place.dataset.idx, 10)); return; }
    syncFromDOM();
    if (up) {
      const i = parseInt(up.dataset.idx, 10);
      if (i > 0) [segs[i - 1], segs[i]] = [segs[i], segs[i - 1]];
    } else if (down) {
      const i = parseInt(down.dataset.idx, 10);
      if (i < segs.length - 1) [segs[i + 1], segs[i]] = [segs[i], segs[i + 1]];
    } else if (remove) {
      segs.splice(parseInt(remove.dataset.idx, 10), 1);
    }
    renderRows();
  });

  // Keep the running total live as durations are typed
  rowsEl.addEventListener('input', (e) => {
    if (e.target.classList?.contains('ros-duration')) {
      syncFromDOM();
      updateTotal();
    }
  });

  // Grouping-mode changes re-render the rows so "Place in room" appears or
  // disappears with the chosen mode (groups/pairs only).
  rowsEl.addEventListener('change', (e) => {
    const t = e.target;
    // ros-area repopulates the Action options; ros-action reveals/hides the
    // "Other" free-text; ros-mode toggles "Place in room". All re-render.
    if (t.classList?.contains('ros-mode') || t.classList?.contains('ros-area') || t.classList?.contains('ros-action')) {
      syncFromDOM();
      renderRows();
    }
  });

  backdrop.querySelector('#ros-add').addEventListener('click', () => {
    syncFromDOM();
    segs.push(rosBlankSegment(segs.length + 1));
    renderRows();
    rowsEl.scrollTop = rowsEl.scrollHeight;
  });

  const regenBtn = backdrop.querySelector('#ros-regenerate');
  regenBtn.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const lesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
    const req = buildRunOfShowRequest(lesson);
    if (!req.plan) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
    const originalHTML = regenBtn.innerHTML;
    regenBtn.disabled = true;
    regenBtn.textContent = 'Regenerating…';
    try {
      const fresh = await generateRunOfShow(req);
      segs = fresh.segments;
      renderRows();
      showToast('Segments regenerated — review and save.', 'success');
    } catch (err) {
      showToast(`Regenerate failed: ${err.message}`, 'danger');
    } finally {
      regenBtn.disabled = false;
      regenBtn.innerHTML = originalHTML;
    }
  });

  // "Map to STP" — non-destructive: AI suggests a Teaching Area + Action per
  // existing segment; we prefill the pickers and re-render for the teacher to
  // review and save. Only teachingArea/teachingAction/other are touched.
  const mapBtn = backdrop.querySelector('#ros-map-stp');
  mapBtn?.addEventListener('click', async () => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    syncFromDOM();
    const originalHTML = mapBtn.innerHTML;
    mapBtn.disabled = true;
    mapBtn.textContent = 'Mapping…';
    try {
      const byIndex = await mapSegmentsToSTP(segs);
      let n = 0;
      segs.forEach((s, i) => {
        const t = byIndex.get(i);
        if (t) { s.teachingArea = t.teachingArea; s.teachingAction = t.teachingAction; s.teachingActionOther = ''; n++; }
      });
      renderRows();
      showToast(n
        ? `Mapped ${n} segment${n === 1 ? '' : 's'} to STP — review and save.`
        : 'No confident STP matches — pick Teaching Areas manually.', n ? 'success' : 'info');
    } catch (err) {
      showToast(`Map to STP failed: ${err.message}`, 'danger');
    } finally {
      mapBtn.disabled = false;
      mapBtn.innerHTML = originalHTML;
    }
  });

  // Shared by Save and "Place in room" — pulls the DOM state, validates and
  // writes lesson.runOfShow. Returns the saved segments, or null on failure.
  const persistSegments = () => {
    if (!currentLessonId) {
      showToast('Save the lesson first — the run of show attaches to a saved lesson.', 'danger');
      return null;
    }
    syncFromDOM();
    const segments = segs.map((s, i) => ({
      ...s,
      name: s.name || `Segment ${i + 1}`,
      duration: Math.min(240, Math.max(1, Math.round(Number(s.duration)) || 5))
    }));
    if (segments.length === 0) { showToast('Add at least one segment.', 'danger'); return null; }
    Store.updateLesson(currentLessonId, { runOfShow: { generatedAt: Date.now(), segments } });
    // Keep the cockpit in sync with what was just persisted (WS-A)
    renderRunOfShow(container);
    renderJourneyBar(container);
    return segments;
  };

  // A6 — hand this segment's groups to the Spatial Designer for furniture
  // assignment. The editor state is persisted first (same path as Save) so
  // the designer writes itemIds back into the segment we just saved.
  const handlePlaceInRoom = (idx) => {
    const segments = persistSegments();
    if (!segments) return;
    const seg = segments[idx];
    if (!seg) return;
    const groups = buildPlacementGroups(seg);
    if (groups.length === 0) {
      showToast('Generate groups first (Grouping tool), then place them.', 'danger');
      return;
    }
    try {
      sessionStorage.setItem('cocher_place_groups', JSON.stringify({
        lessonId: currentLessonId,
        segmentId: seg.id,
        groups
      }));
    } catch {
      showToast('Could not hand the groups to the Spatial Designer.', 'danger');
      return;
    }
    close();
    navigate('/spatial');
  };

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="save"]').addEventListener('click', () => {
    if (!persistSegments()) return;
    showToast('Run of show saved!', 'success');
    close();
  });

  renderRows();
}

/* Build the { name, studentIds, studentNames } groups for the Spatial
 * Designer handoff ('cocher_place_groups'). Sources, in order: the segment's
 * own saved grouping, the in-memory lastGroupingResult (structured), then
 * the saved grouping component (meta.structured). Whichever side is missing
 * (names or ids) is completed from the lesson's class roster; unmatched
 * entries are skipped and groups without resolvable studentIds dropped. */
function buildPlacementGroups(seg) {
  const lesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const roster = lesson?.classId ? (Store.getClass(lesson.classId)?.students || []) : [];
  const idToName = new Map(roster.map(st => [st.id, st.name]));
  const nameToId = new Map(roster.map(st => [String(st.name).trim().toLowerCase(), st.id]));

  const normalize = (groups) => (Array.isArray(groups) ? groups : [])
    .map((g, i) => {
      const studentIds = (Array.isArray(g.studentIds) ? g.studentIds : []).filter(Boolean);
      let studentNames = (Array.isArray(g.studentNames) ? g.studentNames : [])
        .map(n => String(n).trim()).filter(Boolean);
      if (studentIds.length === 0 && studentNames.length > 0) {
        studentIds.push(...studentNames
          .map(n => nameToId.get(n.toLowerCase()))
          .filter(Boolean));
      }
      if (studentNames.length === 0 && studentIds.length > 0) {
        studentNames = studentIds.map(sid => idToName.get(sid)).filter(Boolean);
      }
      return { name: String(g.name || `Group ${i + 1}`), studentIds, studentNames };
    })
    .filter(g => g.studentIds.length > 0);

  let groups = normalize(seg.grouping?.groups);
  if (groups.length === 0 && lastGroupingResult) groups = normalize(lastGroupingResult.groups);
  if (groups.length === 0) {
    const structured = lessonComponents.grouping?.meta?.structured
      || lesson?.components?.grouping?.meta?.structured;
    if (structured) groups = normalize(structured.groups);
  }
  return groups;
}

/* ══════════ Auto-stage (WS-3): one-prompt staging pipeline ══════════ */

/* "Let Co-Cher choose" resolves to the teacher's most recent saved layout
 * (by createdAt; later entries win ties). Null when nothing is saved. */
function mostRecentLayout(layouts) {
  return (layouts || []).reduce((best, l) =>
    (!best || (l.createdAt || 0) >= (best.createdAt || 0)) ? l : best, null);
}

/* Deterministic auto-placement (no AI). Seatable furniture — items whose
 * catalog id starts with 'desk' or is 'stand_table', falling back to all
 * items — is ordered row-major (y bands with 60px tolerance, then x), split
 * into as many contiguous clusters as the segment has groups (balanced
 * sizes, first remainder clusters get one extra), and group i takes cluster
 * i. Writes EXACTLY the manual "Place groups" shape the Spatial Designer
 * produces: grouping.groups[i].itemIds (instance iids) + seatMap
 * { itemIid: [studentIds] } filled round-robin in member order; a group
 * with no items or no members carries no seatMap. Returns true when at
 * least one group received items. */
function autoPlaceSegment(seg, layout) {
  const items = Array.isArray(layout?.items) ? layout.items : [];
  let seatable = items.filter(it => String(it?.id || '').startsWith('desk') || it?.id === 'stand_table');
  if (seatable.length === 0) seatable = items.slice();

  const byY = [...seatable].sort((a, b) => ((a.y || 0) - (b.y || 0)) || ((a.x || 0) - (b.x || 0)));
  const rows = [];
  let row = null, rowY = -Infinity;
  byY.forEach(it => {
    const y = Number(it.y) || 0;
    if (!row || y - rowY > 60) { row = []; rows.push(row); rowY = y; }
    row.push(it);
  });
  const ordered = rows.flatMap(r => [...r].sort((a, b) => ((a.x || 0) - (b.x || 0)) || ((a.y || 0) - (b.y || 0))));

  const groups = Array.isArray(seg.grouping?.groups) ? seg.grouping.groups : [];
  if (groups.length === 0 || ordered.length === 0) return false;

  const base = Math.floor(ordered.length / groups.length);
  const extra = ordered.length % groups.length;
  let cursor = 0;

  seg.grouping = {
    mode: seg.grouping?.mode || 'groups',
    groups: groups.map((g, i) => {
      const size = base + (i < extra ? 1 : 0);
      const cluster = ordered.slice(cursor, cursor + size);
      cursor += size;
      const itemIds = cluster.map(it => String(it.iid ?? it.id));
      const studentIds = Array.isArray(g.studentIds) ? g.studentIds : [];
      const next = { ...g, name: g.name || `Group ${i + 1}`, studentIds, itemIds };
      if (itemIds.length > 0 && studentIds.length > 0) {
        const seatMap = {};
        itemIds.forEach(iid => { seatMap[iid] = []; });
        studentIds.forEach((sid, j) => { seatMap[itemIds[j % itemIds.length]].push(sid); });
        next.seatMap = seatMap;
      } else {
        delete next.seatMap;
      }
      return next;
    })
  };
  return true;
}

/* Pre-flight modal + sequential pipeline: Stage (one AI call) → Group (one
 * AI call, reused across every groups/pairs segment) → link Room → auto-seat
 * (deterministic). Every ingredient is confirmed by the teacher up front —
 * nothing is chosen for them unless they delegate it ("Let Co-Cher choose").
 * Each step persists its own COMPLETE result via Store.updateLesson before
 * the next begins, so a later failure never rolls back or half-writes an
 * earlier one; failed steps show a short reason and the run continues where
 * sensible. */
function showAutoStageModal(container) {
  const lesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  if (!lesson) {
    showToast('Save the lesson first — auto-staging attaches the run of show to a saved lesson.', 'danger');
    return;
  }
  if (!chatMessages.some(m => m.role === 'assistant')) {
    showToast('Chat with Co-Cher first to create a plan, then auto-stage it.', 'danger');
    return;
  }
  if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }

  const classes = Store.getClasses();
  const savedLayouts = Store.getSavedLayouts() || [];
  const recent = mostRecentLayout(savedLayouts);
  const preselectClassId = planClassContext?.id || lesson.classId || '';
  const defaultDuration = buildRunOfShowRequest(lesson).durationHint || 55;
  const defaultRoom = (lesson.spatialLayout && savedLayouts.some(l => l.id === lesson.spatialLayout))
    ? 'linked' : (recent ? 'auto' : 'skip');

  const AS_STEPS = [
    { key: 'staging', label: 'Staging' },
    { key: 'grouping', label: 'Grouping' },
    { key: 'room', label: 'Room' },
    { key: 'seating', label: 'Seating' },
    { key: 'done', label: 'Done' }
  ];
  const AS_PILL_BASE = 'display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:var(--radius-full);font-size:0.6875rem;font-weight:600;white-space:nowrap;border:1px solid var(--border-light);color:var(--ink-faint);background:transparent;';
  const radioLabelStyle = (disabled) =>
    `display:flex;align-items:center;gap:var(--sp-2);font-size:0.8125rem;color:var(--ink);${disabled ? 'opacity:0.55;' : 'cursor:pointer;'}`;

  const { backdrop, close } = openModal({
    title: '&#9889; Auto-stage',
    width: 560,
    body: `
      <style>
        .as-spin{display:inline-block;width:10px;height:10px;border:2px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:as-rotate .7s linear infinite;}
        @keyframes as-rotate{to{transform:rotate(360deg)}}
      </style>
      <div id="as-form">
        <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-4);">
          One pass: stage the plan into segments, form groups, link the room and seat everyone.
        </p>
        ${lesson.runOfShow?.segments?.length ? `
        <div style="font-size:0.75rem;color:var(--warning,#b45309);background:var(--bg-subtle);border-radius:var(--radius-md);padding:var(--sp-2) var(--sp-3);margin-bottom:var(--sp-3);">
          This lesson is already staged &mdash; auto-staging replaces the current segments.
        </div>` : ''}
        <div class="input-group">
          <label class="input-label">Class <span style="color:var(--danger);">*</span></label>
          <select class="input" id="as-class">
            <option value="">Choose a class&hellip;</option>
            ${classes.map(c => `<option value="${esc(c.id)}" ${c.id === preselectClassId ? 'selected' : ''}>${esc(c.name)} (${(c.students || []).length} students)</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Room source</label>
          <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
            <label style="${radioLabelStyle(savedLayouts.length === 0)}">
              <input type="radio" name="as-room" value="linked" ${defaultRoom === 'linked' ? 'checked' : ''} ${savedLayouts.length === 0 ? 'disabled' : ''} />
              <span style="flex-shrink:0;">Linked / saved layout</span>
              ${savedLayouts.length > 0 ? `
              <select class="input" id="as-layout" style="flex:1;min-width:0;padding:4px 8px;font-size:0.8125rem;">
                ${savedLayouts.map(l => `<option value="${esc(l.id)}" ${l.id === (lesson.spatialLayout || recent?.id) ? 'selected' : ''}>${esc(l.name)} (${l.studentCount || '?'} students)</option>`).join('')}
              </select>` : `<span style="font-size:0.6875rem;color:var(--ink-faint);">&mdash; no saved layouts yet</span>`}
            </label>
            <label style="${radioLabelStyle(!recent)}">
              <input type="radio" name="as-room" value="auto" ${defaultRoom === 'auto' ? 'checked' : ''} ${recent ? '' : 'disabled'} />
              <span>Let Co-Cher choose ${recent
                ? `<span style="color:var(--ink-muted);font-size:0.75rem;">(most recent: ${esc(recent.name)})</span>`
                : `<span style="color:var(--ink-faint);font-size:0.75rem;">&mdash; save a layout in the Spatial Designer first</span>`}</span>
            </label>
            <label style="${radioLabelStyle(false)}">
              <input type="radio" name="as-room" value="skip" ${defaultRoom === 'skip' ? 'checked' : ''} />
              <span>Skip room &amp; seating</span>
            </label>
          </div>
        </div>
        <div class="input-group">
          <label class="input-label">Duration (minutes)</label>
          <input type="number" class="input" id="as-duration" min="10" max="240" value="${esc(String(defaultDuration))}" style="width:110px;" />
        </div>
        <div class="input-group" style="display:flex;gap:var(--sp-5);flex-wrap:wrap;margin-bottom:0;">
          <label style="display:inline-flex;align-items:center;gap:var(--sp-2);font-size:0.8125rem;color:var(--ink);cursor:pointer;">
            <input type="checkbox" id="as-groups" checked /> Generate groups
          </label>
          <label style="display:inline-flex;align-items:center;gap:var(--sp-2);font-size:0.8125rem;color:var(--ink);cursor:pointer;">
            <input type="checkbox" id="as-seat" ${defaultRoom === 'skip' ? 'disabled' : 'checked'} /> Auto-seat groups
          </label>
        </div>
      </div>
      <div id="as-progress" style="display:none;">
        <div id="as-steps" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:var(--sp-2) 0;">
          ${AS_STEPS.map((st, i) => `
            ${i > 0 ? '<span style="color:var(--ink-faint);font-size:0.625rem;flex-shrink:0;">&rarr;</span>' : ''}
            <span class="as-step" data-step="${st.key}" style="${AS_PILL_BASE}"><span class="as-step-icon" style="display:inline-flex;align-items:center;"></span>${st.label}</span>`).join('')}
        </div>
        <div id="as-step-notes"></div>
        <div id="as-summary" style="margin-top:var(--sp-3);"></div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="confirm" title="Run the pipeline with these choices">Auto-stage</button>
    `
  });

  const classSel = backdrop.querySelector('#as-class');
  const layoutSel = backdrop.querySelector('#as-layout');
  const seatToggle = backdrop.querySelector('#as-seat');
  const cancelBtn = backdrop.querySelector('[data-action="cancel"]');
  const confirmBtn = backdrop.querySelector('[data-action="confirm"]');

  // Class is mandatory — Confirm stays disabled without one
  const syncConfirm = () => { confirmBtn.disabled = !classSel.value; };
  classSel.addEventListener('change', syncConfirm);
  syncConfirm();

  // "Skip room & seating" turns the seat toggle off; leaving skip restores it
  let seatWanted = seatToggle ? seatToggle.checked : false;
  seatToggle?.addEventListener('change', () => { seatWanted = seatToggle.checked; });
  const roomChoiceNow = () => backdrop.querySelector('input[name="as-room"]:checked')?.value || 'skip';
  backdrop.querySelectorAll('input[name="as-room"]').forEach(r => {
    r.addEventListener('change', () => {
      const skip = roomChoiceNow() === 'skip';
      if (seatToggle) {
        seatToggle.disabled = skip;
        seatToggle.checked = skip ? false : seatWanted;
      }
    });
  });
  // Picking from the layout select is an implicit "linked" choice
  layoutSel?.addEventListener('change', () => {
    const linked = backdrop.querySelector('input[name="as-room"][value="linked"]');
    if (linked && !linked.disabled && !linked.checked) {
      linked.checked = true;
      linked.dispatchEvent(new Event('change'));
    }
  });

  /* Progress strip state: pending | active (spinner) | done (✓) | skip (–) |
   * fail (✗). Skip/fail reasons collect beneath the strip. */
  const stepLabel = Object.fromEntries(AS_STEPS.map(st => [st.key, st.label]));
  const stepState = {};
  const setStep = (key, state, note) => {
    stepState[key] = state;
    const pill = backdrop.querySelector(`.as-step[data-step="${key}"]`);
    if (!pill) return;
    const styles = {
      pending: 'border:1px solid var(--border-light);color:var(--ink-faint);background:transparent;',
      active: 'border:1px solid var(--accent);color:var(--accent);background:var(--bg-card);',
      done: 'border:1px solid var(--growth,#2c7a4b);color:#fff;background:var(--growth,#2c7a4b);',
      skip: 'border:1px solid var(--border-light);color:var(--ink-faint);background:var(--bg-subtle);',
      fail: 'border:1px solid var(--danger);color:var(--danger);background:transparent;'
    };
    pill.style.cssText = AS_PILL_BASE + (styles[state] || styles.pending);
    const icon = pill.querySelector('.as-step-icon');
    if (icon) {
      icon.innerHTML = state === 'active' ? '<span class="as-spin"></span>'
        : state === 'done' ? '&#10003;'
        : state === 'fail' ? '&#10007;'
        : state === 'skip' ? '&ndash;' : '';
    }
    if (note && (state === 'fail' || state === 'skip')) {
      backdrop.querySelector('#as-step-notes')?.insertAdjacentHTML('beforeend',
        `<div style="font-size:0.6875rem;color:${state === 'fail' ? 'var(--danger)' : 'var(--ink-muted)'};margin-top:2px;">${state === 'fail' ? '&#10007;' : '&ndash;'} ${esc(stepLabel[key] || key)}: ${esc(String(note).slice(0, 120))}</div>`);
    }
  };

  const runPipeline = async ({ classId, roomChoice, layoutId, duration, wantGroups, wantSeats }) => {
    const lessonId = currentLessonId;
    const cls = Store.getClasses().find(c => c.id === classId) || null;
    const roster = cls?.students || [];
    const portraitText = classId ? (Store.getPortraitPromptText?.(classId) || '') : '';
    // Sync steps resolve instantly — a beat keeps the strip readable
    const beat = () => new Promise(r => setTimeout(r, 180));

    // Adopt the chosen class when the lesson has none — seat maps and Present
    // resolve student names through lesson.classId. An existing link is kept.
    if (cls && !Store.getLesson(lessonId)?.classId) Store.updateLesson(lessonId, { classId });

    let ros = null;
    let layout = null;
    let builtGroups = null;
    let seatedSegs = 0;

    // a. Staging — one AI call; the whole runOfShow persists before anything
    // else touches it (never a half-written segment).
    setStep('staging', 'active');
    try {
      const req = buildRunOfShowRequest(Store.getLesson(lessonId));
      ros = await generateRunOfShow({
        plan: req.plan,
        className: cls?.name || req.className,
        portraitText,
        durationHint: duration
      });
      Store.updateLesson(lessonId, { runOfShow: ros });
      setStep('staging', 'done');
    } catch (err) {
      setStep('staging', 'fail', err.message);
    }

    // b. Grouping — ONE suggestGrouping call keyed to the first groups/pairs
    // segment's activity; the result is copied into every such segment.
    const groupable = ros ? ros.segments.filter(s => s.grouping?.mode === 'groups' || s.grouping?.mode === 'pairs') : [];
    if (!ros) setStep('grouping', 'skip', 'staging failed');
    else if (!wantGroups) setStep('grouping', 'skip', 'turned off');
    else if (groupable.length === 0) setStep('grouping', 'skip', 'no group or pair segments');
    else if (roster.length === 0) setStep('grouping', 'skip', 'no students in this class');
    else {
      setStep('grouping', 'active');
      try {
        const activityType = groupable[0].activity || groupable[0].name || 'Collaborative group work';
        const result = await suggestGrouping(roster, activityType, { portraitText });
        // studentNames → studentIds against the roster, case-insensitive;
        // unmatched names are simply skipped (same policy as the manual tool)
        const nameToId = new Map(roster.map(st => [String(st.name).trim().toLowerCase(), st.id]));
        builtGroups = result.groups.map((g, i) => ({
          name: g.name || `Group ${i + 1}`,
          studentNames: [...(g.studentNames || [])],
          rationale: g.rationale || '',
          studentIds: (g.studentNames || [])
            .map(n => nameToId.get(String(n).trim().toLowerCase()))
            .filter(Boolean)
        }));
        // Each segment gets its own deep copy — placement mutates per segment
        groupable.forEach(s => {
          s.grouping.groups = builtGroups.map(g =>
            ({ ...g, studentNames: [...g.studentNames], studentIds: [...g.studentIds] }));
        });
        Store.updateLesson(lessonId, { runOfShow: ros });
        setStep('grouping', 'done');
      } catch (err) {
        builtGroups = null;
        setStep('grouping', 'fail', err.message);
      }
    }

    // c. Room — link the confirmed layout to the lesson
    if (roomChoice === 'skip') setStep('room', 'skip', 'room & seating skipped');
    else {
      setStep('room', 'active');
      await beat();
      layout = (Store.getSavedLayouts() || []).find(l => l.id === layoutId) || null;
      if (!layout) setStep('room', 'fail', 'layout no longer exists');
      else {
        Store.updateLesson(lessonId, { spatialLayout: layout.id });
        setStep('room', 'done');
      }
    }

    // d. Seating — deterministic auto-placement, no AI
    const seatTargets = ros ? ros.segments.filter(s =>
      (s.grouping?.mode === 'groups' || s.grouping?.mode === 'pairs') &&
      (s.grouping.groups || []).length > 0) : [];
    if (roomChoice === 'skip') setStep('seating', 'skip', 'room & seating skipped');
    else if (!wantSeats) setStep('seating', 'skip', 'turned off');
    else if (!ros) setStep('seating', 'skip', 'staging failed');
    else if (!layout) setStep('seating', 'skip', 'no layout linked');
    else if (seatTargets.length === 0) setStep('seating', 'skip', 'no groups to seat');
    else {
      setStep('seating', 'active');
      await beat();
      try {
        seatTargets.forEach(s => { if (autoPlaceSegment(s, layout)) seatedSegs++; });
        if (seatedSegs > 0) {
          Store.updateLesson(lessonId, { runOfShow: ros });
          setStep('seating', 'done');
        } else {
          setStep('seating', 'skip', 'no seatable furniture in the layout');
        }
      } catch (err) {
        setStep('seating', 'fail', err.message);
      }
    }

    // e. Refresh the cockpit with whatever the pipeline achieved
    renderRunOfShow(container);
    renderJourneyBar(container);
    renderSpatialContextBar(container);
    renderSpatialSection(container);

    // f. Done — summary + next actions
    setStep('done', 'done');
    const segs = Store.getLesson(lessonId)?.runOfShow?.segments || [];
    const bits = [];
    if (ros) bits.push(`${segs.length} segment${segs.length === 1 ? '' : 's'}`);
    if (builtGroups?.length) bits.push(`${builtGroups.length} group${builtGroups.length === 1 ? '' : 's'}${seatedSegs > 0 ? ' seated' : ''}`);
    if (layout && stepState.room === 'done') bits.push(`layout: ${layout.name}`);
    const headline = ros
      ? bits.map(esc).join(' &middot; ')
      : 'Staging failed &mdash; the lesson was left as it was.';
    const summaryEl = backdrop.querySelector('#as-summary');
    if (!summaryEl) return;
    summaryEl.innerHTML = `
      <div style="padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-md);">
        <div style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">${headline}</div>
        <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;align-items:center;">
          ${ros ? `
          <button class="btn btn-secondary btn-sm" id="as-review">Review segments</button>
          <button class="btn btn-primary btn-sm" id="as-present" title="Open the student-facing class screen">&#9654; Present now</button>` : ''}
          <button class="btn btn-ghost btn-sm" id="as-done-close" style="margin-left:auto;">Close</button>
        </div>
      </div>`;
    summaryEl.querySelector('#as-review')?.addEventListener('click', () => {
      close();
      const fresh = Store.getLesson(lessonId);
      if (fresh?.runOfShow) showRunOfShowEditor(container, fresh.runOfShow);
    });
    summaryEl.querySelector('#as-present')?.addEventListener('click', () => {
      close();
      navigate(`/present/${lessonId}`);
    });
    summaryEl.querySelector('#as-done-close')?.addEventListener('click', close);
  };

  cancelBtn.addEventListener('click', close);
  confirmBtn.addEventListener('click', async () => {
    if (!classSel.value) return;
    const roomChoice = roomChoiceNow();
    const d = parseInt(backdrop.querySelector('#as-duration')?.value, 10);
    const opts = {
      classId: classSel.value,
      roomChoice,
      layoutId: roomChoice === 'linked' ? (layoutSel?.value || null)
        : roomChoice === 'auto' ? (recent?.id || null) : null,
      duration: Number.isFinite(d) ? Math.min(240, Math.max(10, d)) : 55,
      wantGroups: backdrop.querySelector('#as-groups')?.checked ?? true,
      wantSeats: (seatToggle?.checked ?? false) && roomChoice !== 'skip'
    };
    // Flip the modal to the progress strip; closing early is safe because
    // every finished step has already persisted its complete result.
    backdrop.querySelector('#as-form').style.display = 'none';
    backdrop.querySelector('#as-progress').style.display = '';
    confirmBtn.style.display = 'none';
    cancelBtn.textContent = 'Close';
    await runPipeline(opts);
  });
}

/* ── Last grouping result for seat assignment ── */
let lastGroupingResult = null;
let lastGroupingMeta = null;

/* ── AI Grouping Modal ── */
function showGroupingModal(container, classes) {
  const classesWithStudents = classes.filter(c => c.students?.length > 0);

  // Auto-select class from context
  const contextClassId = planClassContext?.id || '';

  const { backdrop, close } = openModal({
    title: 'AI Student Grouping',
    body: `
      <div class="input-group">
        <label class="input-label">Select Class</label>
        <select class="input" id="group-class">
          ${classesWithStudents.map(c => `<option value="${c.id}" ${c.id === contextClassId ? 'selected' : ''}>${c.name} (${c.students.length} students)</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Activity Type</label>
        <select class="input" id="group-activity">
          <option value="Collaborative group work">Collaborative group work</option>
          <option value="Peer tutoring">Peer tutoring</option>
          <option value="Jigsaw activity">Jigsaw activity</option>
          <option value="Debate or discussion">Debate / discussion</option>
          <option value="Project-based learning">Project-based learning</option>
          <option value="Competition">Competition</option>
          <option value="Lab work">Lab / practical work</option>
          <option value="Circuit training">PE — Circuit training</option>
          <option value="Team game">PE — Team game</option>
          <option value="Warmup drill">PE — Warm-up / drill</option>
        </select>
      </div>
      <div class="input-group">
        <label class="input-label">Preferred Group Size</label>
        <div style="display:flex;align-items:center;gap:var(--sp-3);">
          <input type="range" id="group-size" min="2" max="6" value="4" style="flex:1;" />
          <span id="group-size-label" style="font-size:0.875rem;font-weight:600;color:var(--ink);min-width:80px;text-align:center;">4 students</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.6875rem;color:var(--ink-faint);margin-top:2px;">
          <span>Pairs</span><span>Trios</span><span>Quads</span><span>Fives</span><span>Sixes</span>
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Grouping Considerations <span style="font-weight:400;color:var(--ink-faint);">(optional)</span></label>
        <textarea class="input" id="group-considerations" rows="3" placeholder="E.g. 'Keep Ahmad and Wei Lin in separate groups', 'Priya needs a confident English speaker in her group', 'Balance genders where possible', 'Seat students with vision needs near the front'..." style="resize:vertical;font-size:0.8125rem;"></textarea>
        <div style="font-size:0.6875rem;color:var(--ink-faint);margin-top:4px;">Share any seating preferences, student dynamics, or special needs the AI should factor in.</div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="generate">Generate Groups</button>
    `
  });

  // Group size slider label
  const sizeSlider = backdrop.querySelector('#group-size');
  const sizeLabel = backdrop.querySelector('#group-size-label');
  sizeSlider.addEventListener('input', () => {
    sizeLabel.textContent = `${sizeSlider.value} students`;
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
    const classId = backdrop.querySelector('#group-class').value;
    const activityType = backdrop.querySelector('#group-activity').value;
    const groupSize = parseInt(sizeSlider.value);
    const considerations = backdrop.querySelector('#group-considerations').value.trim();
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    close();

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Analysing E21CC profiles and creating groups for ${cls.students.length} students...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const grouping = await suggestGrouping(cls.students, activityType, {
        groupSize,
        considerations,
        portraitText: Store.getPortraitPromptText?.(classId) || ''
      });

      // Map studentNames → studentIds here (api.js stays name-based; this
      // file has cls.students). Unmatched names are simply skipped.
      const nameToId = new Map((cls.students || []).map(s => [String(s.name).trim().toLowerCase(), s.id]));
      const structured = {
        groups: grouping.groups.map(g => ({
          ...g,
          studentIds: (g.studentNames || [])
            .map(n => nameToId.get(String(n).trim().toLowerCase()))
            .filter(Boolean)
        })),
        strategyNote: grouping.strategyNote || ''
      };

      // Store for seat assignment feature (structured object, not markdown)
      lastGroupingResult = structured;
      lastGroupingMeta = { classId, className: cls.name, activityType, groupSize, studentCount: cls.students.length };

      // Save as persistent component: markdown content for display/back-compat,
      // raw structured JSON alongside it in meta.structured
      setComponent('grouping', groupingToMarkdown(structured, { activityType }), {
        label: `${cls.name} · ${activityType} · groups of ${groupSize}`,
        structured
      });
      renderComponents(container);

      // Show action buttons in status area
      statusEl.innerHTML = `
        <div class="card" style="padding:var(--sp-4);background:var(--bg-subtle);border:1px dashed var(--border);">
          <div style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);">Groups saved to lesson components. Next steps:</div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="seat-assignment-btn" title="Get AI suggestions for where each group should sit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              Who Sits Where
            </button>
            <button class="btn btn-secondary btn-sm" id="arrange-classroom-btn" title="Open spatial designer with a layout suited for this activity">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
              Arrange Classroom
            </button>
            <button class="btn btn-ghost btn-sm" id="dismiss-actions" style="margin-left:auto;">Dismiss</button>
          </div>
        </div>`;

      statusEl.querySelector('#dismiss-actions')?.addEventListener('click', () => { statusEl.innerHTML = ''; });

      // Who Sits Where button
      statusEl.querySelector('#seat-assignment-btn')?.addEventListener('click', () => {
        showSeatAssignmentModal(container, lastGroupingResult, lastGroupingMeta);
      });

      // Arrange Classroom button — navigate to spatial with context
      statusEl.querySelector('#arrange-classroom-btn')?.addEventListener('click', () => {
        const presetMap = {
          'Collaborative group work': 'pods',
          'Peer tutoring': 'pods',
          'Jigsaw activity': 'stations',
          'Debate or discussion': 'fishbowl',
          'Project-based learning': 'pods',
          'Competition': 'pods',
          'Lab work': 'stations',
          'Circuit training': 'circuit',
          'Team game': 'team_game',
          'Warmup drill': 'warmup'
        };
        sessionStorage.setItem('cocher_spatial_preset', presetMap[activityType] || 'pods');
        sessionStorage.setItem('cocher_spatial_student_count', cls.students.length.toString());
        sessionStorage.setItem('cocher_spatial_activity', activityType);
        navigate('/spatial');
      });
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Grouping failed: ${err.message}</div>`;
    }
  });
}

/* ── Seat Assignment Modal ──
 * groupingResult is the structured suggestGrouping object
 * ({ groups: [{ name, studentNames, ... }] }); a legacy markdown string is
 * still accepted and regex-parsed for older call paths. */
function showSeatAssignmentModal(container, groupingResult, meta) {
  if (!groupingResult || !meta) {
    showToast('Generate groups first before assigning seats.', 'danger');
    return;
  }

  const savedLayouts = Store.getSavedLayouts() || [];
  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const linkedLayoutId = currentLesson?.spatialLayout;

  const { backdrop, close } = openModal({
    title: 'Who Sits Where',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-4);">
        Choose a classroom layout and the AI will suggest where each group should sit.
      </p>
      <div class="input-group">
        <label class="input-label">Classroom Layout</label>
        <select class="input" id="seat-layout">
          <option value="direct">Direct Instruction (Rows)</option>
          <option value="pods" selected>Collaborative Pods</option>
          <option value="stations">Stations</option>
          <option value="ushape">U-Shape / Circle</option>
          <option value="quiet">Quiet Work (Individual)</option>
          <option value="gallery">Gallery Walk</option>
          <option value="fishbowl">Fishbowl / Socratic</option>
          <option value="maker">Makerspace</option>
        </select>
      </div>
      ${savedLayouts.length > 0 ? `
        <div style="font-size:0.75rem;color:var(--ink-faint);margin-top:-8px;margin-bottom:var(--sp-3);">
          ${linkedLayoutId ? 'Using your linked layout\'s preset.' : 'Or choose based on your saved layouts.'}
        </div>
      ` : ''}
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="assign">Assign Seats</button>
    `
  });

  // Pre-select based on linked layout or activity type
  const layoutSelect = backdrop.querySelector('#seat-layout');
  if (linkedLayoutId) {
    const linkedLayout = savedLayouts.find(l => l.id === linkedLayoutId);
    if (linkedLayout?.preset) layoutSelect.value = linkedLayout.preset;
  } else {
    const presetMap = {
      'Collaborative group work': 'pods', 'Peer tutoring': 'pods',
      'Jigsaw activity': 'stations', 'Debate or discussion': 'fishbowl',
      'Project-based learning': 'pods', 'Competition': 'pods', 'Lab work': 'stations',
      'Circuit training': 'circuit', 'Team game': 'team_game', 'Warmup drill': 'warmup'
    };
    layoutSelect.value = presetMap[meta.activityType] || 'pods';
  }

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="assign"]').addEventListener('click', async () => {
    const layoutPreset = layoutSelect.value;
    close();

    // Structured grouping (new path) or regex parse of legacy markdown
    const groups = (groupingResult && typeof groupingResult === 'object' && Array.isArray(groupingResult.groups))
      ? groupingResult.groups
          .map((g, i) => ({
            name: g.name || `Group ${i + 1}`,
            members: [...(g.studentNames || g.members || [])]
          }))
          .filter(g => g.members.length > 0)
      : parseGroupsFromText(String(groupingResult));

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Assigning seats for ${groups.length} groups in ${PRESET_NAMES[layoutPreset] || layoutPreset} layout...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth', block: 'end' });

    try {
      const seatPlan = await suggestSeatAssignment(groups, layoutPreset, meta.studentCount);
      // Markdown content for display/back-compat; raw structured JSON in meta
      // so buildSeatPlanVisual can draw the SVG without re-parsing text.
      setComponent('seatPlan', seatPlanToMarkdown(seatPlan), {
        label: PRESET_NAMES[layoutPreset] || layoutPreset,
        structured: seatPlan
      });
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Seating plan added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Seat assignment failed: ${err.message}</div>`;
    }
  });
}

/* ── Parse groups from AI grouping text ── */
function parseGroupsFromText(text) {
  const groups = [];
  // Match "### Group N:" or "Group N:" patterns followed by members
  const groupPattern = /(?:###?\s*)?Group\s*\d+[^]*?(?:\*\*Members?:\*\*|Members?:)\s*([^\n]+)/gi;
  let match;
  while ((match = groupPattern.exec(text)) !== null) {
    const membersLine = match[1].trim();
    const members = membersLine.split(/,\s*/).map(n => n.replace(/\*\*/g, '').trim()).filter(Boolean);
    if (members.length > 0) {
      groups.push({ members });
    }
  }
  // Fallback: if parsing didn't find structured groups, try simpler patterns
  if (groups.length === 0) {
    const lines = text.split('\n');
    let currentMembers = [];
    for (const line of lines) {
      const groupMatch = line.match(/Group\s*\d+\s*:/i);
      if (groupMatch) {
        if (currentMembers.length > 0) groups.push({ members: currentMembers });
        currentMembers = [];
        // Try to extract names from the same line
        const namesAfterColon = line.split(':').slice(1).join(':').trim();
        if (namesAfterColon) {
          currentMembers = namesAfterColon.split(/,\s*/).map(n => n.replace(/\*\*/g, '').replace(/—.*$/, '').trim()).filter(Boolean);
        }
      }
    }
    if (currentMembers.length > 0) groups.push({ members: currentMembers });
  }
  return groups;
}

/* ══════════ Timeline Modal ══════════ */
function showTimelineModal(container) {
  const { backdrop, close } = openModal({
    title: 'Lesson Timeline / Pacing Guide',
    body: `
      <div class="input-group">
        <label class="input-label">Total Lesson Duration</label>
        <div style="display:flex;align-items:center;gap:var(--sp-3);">
          <input type="range" id="timeline-duration" min="15" max="120" value="45" step="5" style="flex:1;" />
          <span id="timeline-duration-label" style="font-size:0.875rem;font-weight:600;color:var(--ink);min-width:60px;text-align:center;">45 min</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.6875rem;color:var(--ink-faint);margin-top:2px;">
          <span>15 min</span><span>45 min</span><span>60 min</span><span>90 min</span><span>120 min</span>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="generate">Generate Timeline</button>
    `
  });

  const durationSlider = backdrop.querySelector('#timeline-duration');
  const durationLabel = backdrop.querySelector('#timeline-duration-label');
  durationSlider.addEventListener('input', () => {
    durationLabel.textContent = `${durationSlider.value} min`;
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="generate"]').addEventListener('click', async () => {
    const totalMinutes = parseInt(durationSlider.value);
    close();

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Creating ${totalMinutes}-minute lesson timeline...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
      const subject = planClassContext?.subject || '';
      const timeline = await generateTimeline(planText, totalMinutes, subject);
      setComponent('timeline', timeline, `${totalMinutes} minutes`);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Timeline added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Timeline generation failed: ${err.message}</div>`;
    }
  });
}

/* ══════════ Differentiation Modal ══════════ */
function showDifferentiationModal(container, classes) {
  const contextClassId = planClassContext?.id || '';

  const { backdrop, close } = openModal({
    title: 'Differentiation Suggestions',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-4);">
        Analyse student E21CC profiles against your lesson plan to identify who needs scaffolding and who is ready for extension.
      </p>
      <div class="input-group">
        <label class="input-label">Select Class</label>
        <select class="input" id="diff-class">
          ${classes.map(c => `<option value="${c.id}" ${c.id === contextClassId ? 'selected' : ''}>${c.name} (${c.students.length} students)</option>`).join('')}
        </select>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="analyse">Analyse & Suggest</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="analyse"]').addEventListener('click', async () => {
    const classId = backdrop.querySelector('#diff-class').value;
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;
    close();

    const statusEl = container.querySelector('#ai-result');
    statusEl.innerHTML = `<div class="card" style="padding:var(--sp-5);"><div class="chat-typing">Analysing ${cls.students.length} student profiles for differentiation opportunities...</div></div>`;
    statusEl.scrollIntoView({ behavior: 'smooth' });

    try {
      const planText = chatMessages.filter(m => m.role === 'assistant').map(m => m.content).join('\n\n');
      const diff = await suggestDifferentiation(cls.students, planText);
      setComponent('differentiation', diff, cls.name);
      statusEl.innerHTML = '';
      renderComponents(container);
      showToast('Differentiation suggestions added to components.', 'success');
    } catch (err) {
      statusEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Differentiation analysis failed: ${err.message}</div>`;
    }
  });
}

/* ══════════ Spatial Context Bar (coupling) ══════════ */

/* Resolve a stored studentId (or a raw name string, import/AI compat) to a
 * display name against the lesson's class roster. */
function seatDisplayName(idOrName, roster) {
  const byId = (roster || []).find(st => st.id === idOrName);
  return byId ? byId.name : String(idOrName);
}

/* Staged segments that have any seat placement — named seats (seatMap) or
 * legacy furniture assignment (itemIds). */
function segmentsWithSeats(segments) {
  return (segments || []).filter(s =>
    (s.grouping?.groups || []).some(g =>
      (g.seatMap && typeof g.seatMap === 'object' && Object.keys(g.seatMap).length > 0) ||
      (Array.isArray(g.itemIds) && g.itemIds.length > 0)));
}

/* Build layoutToSVG seatLabels from one segment: groups with a seatMap get an
 * array of student names per item (stacked lines); itemIds-only groups keep
 * the single group-name pill (back-compat). */
function segmentSeatLabels(seg, roster) {
  const labels = {};
  (seg?.grouping?.groups || []).forEach((g, i) => {
    const groupLabel = g.name || `Group ${i + 1}`;
    const sm = (g.seatMap && typeof g.seatMap === 'object') ? g.seatMap : null;
    if (sm && Object.keys(sm).length > 0) {
      Object.entries(sm).forEach(([iid, ids]) => {
        const names = (Array.isArray(ids) ? ids : [])
          .map(v => seatDisplayName(v, roster)).filter(Boolean);
        labels[iid] = names.length ? names : groupLabel;
      });
      // Items assigned to the group but missing from its seatMap keep the pill
      (Array.isArray(g.itemIds) ? g.itemIds : []).forEach(iid => {
        if (!(iid in labels)) labels[iid] = groupLabel;
      });
    } else {
      (Array.isArray(g.itemIds) ? g.itemIds : []).forEach(iid => { labels[iid] = groupLabel; });
    }
  });
  return labels;
}

function renderSpatialContextBar(container) {
  const barEl = container.querySelector('#spatial-context-bar');
  if (!barEl) return;

  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const linkedLayoutId = currentLesson?.spatialLayout;
  if (!linkedLayoutId) { barEl.style.display = 'none'; return; }

  const savedLayouts = Store.getSavedLayouts() || [];
  const layout = savedLayouts.find(l => l.id === linkedLayoutId);
  if (!layout) { barEl.style.display = 'none'; return; }

  const segments = currentLesson?.runOfShow?.segments || [];
  const seated = segmentsWithSeats(segments);
  const roster = currentLesson?.classId
    ? (Store.getClass(currentLesson.classId)?.students || []) : [];
  // Default shown seating: first segment with named seats, else first with any
  let selSegId = (seated.find(s => (s.grouping?.groups || []).some(g =>
    g.seatMap && typeof g.seatMap === 'object' && Object.keys(g.seatMap).length > 0))
    || seated[0])?.id || null;

  barEl.style.display = '';
  barEl.innerHTML = `
    <div style="padding:var(--sp-3) var(--sp-4);background:linear-gradient(135deg, rgba(0,12,83,0.04), rgba(167,243,208,0.08));border:1px solid var(--border-light);border-radius:var(--radius-lg);">
      <div style="display:flex;align-items:center;gap:var(--sp-3);">
        <div style="font-size:1.25rem;">${PRESET_ICONS[layout.preset] || '📐'}</div>
        <div style="flex:1;">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);">
            ${PRESET_NAMES[layout.preset] || 'Custom'} Layout Linked
          </div>
          <div style="font-size:0.6875rem;color:var(--ink-muted);">
            ${esc(layout.name)} · ${layout.studentCount || '?'} students · ${layout.items?.length || 0} items
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" id="spatial-context-open" style="font-size:0.75rem;">Open</button>
      </div>
      ${seated.length > 1 ? `
      <div id="spatial-map-chips" style="display:flex;align-items:center;gap:var(--sp-1);flex-wrap:wrap;margin-top:var(--sp-2);">
        <span style="font-size:0.625rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-muted);">Seating for</span>
        ${seated.map(s => `
          <button type="button" class="spatial-map-chip" data-seg-id="${esc(s.id)}" style="padding:2px 10px;border-radius:var(--radius-full);border:1px solid var(--border);background:var(--bg-card);color:var(--ink);font-size:0.6875rem;font-weight:600;cursor:pointer;">${esc(s.name || 'Segment')}</button>`).join('')}
      </div>` : ''}
      <div id="spatial-context-map" style="margin-top:var(--sp-2);overflow-x:auto;line-height:0;"></div>
    </div>`;

  const mapEl = barEl.querySelector('#spatial-context-map');
  const sceneOf = (s) => (s && s.layoutSceneId)
    ? ((layout.scenes || []).find(sc => sc && sc.id === s.layoutSceneId) || null) : null;

  const drawMap = () => {
    const seg = seated.find(s => s.id === selSegId) || null;
    // Items: the shown segment's scene, else the first staged segment's scene,
    // else the layout's base arrangement.
    const scene = sceneOf(seg) || sceneOf(segments.find(s => sceneOf(s))) || null;
    const items = (scene?.items?.length ? scene.items : layout.items) || [];
    const seatLabels = seg ? segmentSeatLabels(seg, roster) : {};
    let svg = '';
    try { svg = layoutToSVG(items, { width: 520, seatLabels, title: layout.name || 'Room layout' }); }
    catch { svg = ''; }
    mapEl.innerHTML = svg ? `<div style="border:1px solid var(--border-light);border-radius:var(--radius-md);overflow:hidden;background:#fff;display:inline-block;max-width:100%;">${svg}</div>` : '';
    barEl.querySelectorAll('.spatial-map-chip').forEach(chip => {
      const active = chip.dataset.segId === selSegId;
      chip.style.background = active ? 'var(--accent)' : 'var(--bg-card)';
      chip.style.color = active ? '#fff' : 'var(--ink)';
      chip.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
    });
  };

  barEl.querySelectorAll('.spatial-map-chip').forEach(chip => {
    chip.addEventListener('click', () => { selSegId = chip.dataset.segId; drawMap(); });
  });
  drawMap();

  barEl.querySelector('#spatial-context-open')?.addEventListener('click', () => {
    // Carry the linked layout + the shown segment's seating into the Spatial
    // Designer so "Open" continues the real arrangement (furniture + seated
    // students), not an empty canvas. The designer reads this one-shot key.
    try {
      sessionStorage.setItem('cocher_open_layout', JSON.stringify({
        layoutId: layout.id,
        lessonId: currentLesson?.id || currentLessonId || null,
        segmentId: selSegId,
      }));
    } catch { /* sessionStorage unavailable — designer still opens (empty) */ }
    navigate('/spatial');
  });
}

/* ══════════ Cockpit (WS-A): persistent Run of Show panel + journey bar ══════════ */

/* Always-visible Run of Show card in the plan column. Staged lesson → segment
 * strip (click = reopen the editor) + Present button. Saved-but-unstaged
 * lesson with a plan → slim stage CTA. Anything else → nothing. */
function renderRunOfShow(container) {
  const el = container.querySelector('#run-of-show');
  if (!el) return;

  const lesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const segments = lesson?.runOfShow?.segments || [];

  if (!lesson || segments.length === 0) {
    const hasPlan = chatMessages.some(m => m.role === 'assistant');
    if (lesson && hasPlan) {
      el.innerHTML = `
        <div class="card" style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);margin-bottom:var(--sp-4);border-style:dashed;">
          <span style="font-size:1.125rem;flex-shrink:0;" aria-hidden="true">&#127916;</span>
          <div style="flex:1;min-width:140px;font-size:0.8125rem;color:var(--ink-muted);">Stage this lesson &mdash; turn the plan into a runnable sequence of timed segments.</div>
          <button class="btn btn-secondary btn-sm" id="ros-panel-stage">Stage lesson</button>
        </div>`;
      el.querySelector('#ros-panel-stage')?.addEventListener('click', () =>
        container.querySelector('#stage-lesson-btn')?.click());
    } else {
      el.innerHTML = '';
    }
    return;
  }

  const total = segments.reduce((n, s) => n + (Number(s.duration) || 0), 0);
  const layout = lesson.spatialLayout
    ? (Store.getSavedLayouts() || []).find(l => l.id === lesson.spatialLayout) : null;
  const sceneName = (id) => {
    const sc = (layout?.scenes || []).find(s => s && s.id === id);
    return (sc?.name || 'Scene');
  };
  const modeLabel = (m) => ROS_MODE_OPTIONS.find(o => o.value === m)?.label || '';

  el.innerHTML = `
    <div class="card" style="margin-bottom:var(--sp-4);overflow:hidden;">
      <div style="display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);flex-wrap:wrap;">
        <span aria-hidden="true">&#127916;</span>
        <span style="font-size:0.875rem;font-weight:600;color:var(--ink);">Run of Show</span>
        <span class="badge badge-blue" style="font-size:0.6875rem;">${total} min &middot; ${segments.length} segment${segments.length === 1 ? '' : 's'}</span>
        <button class="btn btn-primary btn-sm" id="ros-panel-present" style="margin-left:auto;" title="Open the student-facing class screen">&#9654; Present</button>
      </div>
      <div style="padding:var(--sp-2) var(--sp-4) 0;font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--ink-faint);">&#127916; Lesson Enactment <span style="font-weight:600;">&middot; Singapore Teaching Practice</span></div>
      <div id="ros-panel-strip" role="button" tabindex="0" title="Edit run of show" style="display:flex;flex-direction:column;gap:var(--sp-2);padding:var(--sp-2) var(--sp-4) var(--sp-3);cursor:pointer;">
        ${segments.map((s, i) => {
          const act = resolveTeachingAction(s);
          const areaIcon = s.teachingArea ? (TEACHING_AREA_ICONS[s.teachingArea] || '') : '';
          const areaLabel = s.teachingArea ? (TEACHING_AREA_LABELS[s.teachingArea] || '') : '';
          const hasDetail = !!(areaLabel || act);
          return `
          <div class="ros-seg" style="display:flex;flex-direction:column;gap:2px;">
            <div style="display:flex;align-items:center;gap:var(--sp-2);font-size:0.8125rem;flex-wrap:wrap;line-height:1.5;">
              <span aria-hidden="true" title="${esc(areaLabel)}">${areaIcon || '&#8226;'}</span>
              <span style="color:var(--ink);font-weight:500;">${i + 1}. ${esc(s.name || `Segment ${i + 1}`)}</span>
              <span style="color:var(--ink-faint);">&middot; ${Number(s.duration) || 0}min</span>
              ${act ? `<span class="badge badge-blue" style="font-size:0.625rem;">${esc(act.label)}</span>` : ''}
              ${s.grouping?.mode ? `<span class="badge badge-gray" style="font-size:0.625rem;">${esc(modeLabel(s.grouping.mode))}</span>` : ''}
              ${s.layoutSceneId ? `<span class="badge badge-blue" style="font-size:0.625rem;">&#128208; ${esc(sceneName(s.layoutSceneId))}</span>` : ''}
              ${s.e21ccFocus && E21CC_SEGMENT_LABELS[s.e21ccFocus] ? `<span style="display:inline-block;padding:1px 8px;border-radius:var(--radius-full);background:var(--growth-light,#e2f2e8);color:var(--growth,#2c7a4b);font-size:0.625rem;font-weight:600;">${esc(E21CC_SEGMENT_LABELS[s.e21ccFocus])}</span>` : ''}
              ${hasDetail ? `<button type="button" class="btn btn-ghost btn-sm ros-details-btn" data-seg="${i}" style="margin-left:auto;padding:1px 8px;font-size:0.6875rem;">Details</button>` : ''}
            </div>
            ${hasDetail ? `
            <div class="ros-details" data-seg="${i}" style="display:none;margin-left:22px;padding:6px 10px;border-left:2px solid var(--border);font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">
              ${areaLabel ? `<div style="font-weight:700;color:var(--ink);">STP &middot; ${esc(areaLabel)}</div>` : ''}
              ${act ? `<div><b>Action:</b> ${esc(act.label)}${act.teacherHint ? ` &mdash; ${esc(act.teacherHint)}` : ''}</div>` : ''}
              ${act && act.studentFraming ? `<div style="margin-top:2px;color:var(--accent,#4361ee);">&#128065; Students see: &ldquo;${esc(act.studentFraming)}&rdquo;</div>` : ''}
            </div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;

  el.querySelector('#ros-panel-present')?.addEventListener('click', () =>
    navigate(`/present/${currentLessonId}`));
  const openEditor = () => {
    const fresh = currentLessonId ? Store.getLesson(currentLessonId) : null;
    if (fresh?.runOfShow) showRunOfShowEditor(container, fresh.runOfShow);
  };
  const strip = el.querySelector('#ros-panel-strip');
  strip?.addEventListener('click', openEditor);
  strip?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor(); }
  });
  // "Details" reveals the segment's STP action + teacher hint + student framing
  // without opening the editor (stop the click from bubbling to the strip).
  strip?.querySelectorAll('.ros-details-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = strip.querySelector(`.ros-details[data-seg="${btn.dataset.seg}"]`);
      if (!panel) return;
      const open = panel.style.display !== 'none';
      panel.style.display = open ? 'none' : 'block';
      btn.textContent = open ? 'Details' : 'Hide';
    });
  });
}

/* Compact one-line journey strip: Plan → Components → Stage → Place → Present.
 * Done steps fill growth-green; the next undone step on the runnable spine
 * (Plan → Stage → Place) pulses accent; Components never nags (it is optional
 * enrichment); Present renders as the action once the lesson is staged. */
function renderJourneyBar(container) {
  const el = container.querySelector('#lp-journey');
  if (!el) return;

  const lesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const segments = lesson?.runOfShow?.segments || [];
  const done = {
    plan: chatMessages.some(m => m.role === 'assistant'),
    components: Object.keys(lessonComponents).length > 0,
    stage: segments.length > 0,
    place: segments.some(s => (s.grouping?.groups || []).some(g => Array.isArray(g.itemIds) && g.itemIds.length > 0))
  };
  const nextKey = !done.plan ? 'plan' : (!done.stage ? 'stage' : (!done.place ? 'place' : null));

  const pillStyle = (key, isDone) => {
    const base = 'display:inline-flex;align-items:center;padding:2px 10px;border-radius:var(--radius-full);font-size:0.6875rem;font-weight:600;cursor:pointer;white-space:nowrap;';
    if (key === 'present') {
      return base + (done.stage
        ? 'background:var(--accent);color:#fff;border:1px solid var(--accent);'
        : 'background:transparent;color:var(--ink-faint);border:1px solid var(--border-light);cursor:default;');
    }
    if (isDone) return base + 'background:var(--growth,#2c7a4b);color:#fff;border:1px solid var(--growth,#2c7a4b);';
    if (key === nextKey) return base + 'background:var(--bg-card);color:var(--accent);border:1px solid var(--accent);animation:pulse-soft 2s ease-in-out infinite;';
    return base + 'background:transparent;color:var(--ink-faint);border:1px solid var(--border-light);';
  };

  const steps = [
    { key: 'plan', label: 'Plan', isDone: done.plan, title: 'Chat with Co-Cher to draft the plan' },
    { key: 'components', label: 'Components', isDone: done.components, title: 'Add AI components (rubric, grouping, exit ticket…)' },
    { key: 'stage', label: 'Stage', isDone: done.stage, title: 'Break the plan into runnable segments' },
    { key: 'place', label: 'Place', isDone: done.place, title: 'Assign groups to furniture in the room' },
    { key: 'present', label: '▶ Present', isDone: false, title: done.stage ? 'Open the student-facing class screen' : 'Stage the lesson first' }
  ];

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:4px;margin-bottom:var(--sp-3);overflow-x:auto;padding-bottom:2px;">
      ${steps.map((st, i) => `
        ${i > 0 ? '<span style="color:var(--ink-faint);font-size:0.625rem;flex-shrink:0;">&rarr;</span>' : ''}
        <button class="lp-journey-pill" data-step="${st.key}" title="${esc(st.title)}" style="${pillStyle(st.key, st.isDone)}">
          ${st.isDone ? '<span aria-hidden="true" style="margin-right:3px;">&#10003;</span>' : ''}${esc(st.label)}
        </button>`).join('')}
    </div>`;

  el.querySelectorAll('.lp-journey-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const step = btn.dataset.step;
      if (step === 'plan') {
        container.querySelector('#lp-layout')?.classList.remove('show-plan');
        container.querySelector('#chat-input')?.focus();
      } else if (step === 'components') {
        container.querySelector('#lesson-components')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (step === 'stage') {
        // Unstaged → the one-prompt auto-stage flow (WS-3); staged → the
        // manual button, which reopens the editor without an AI call.
        const fresh = currentLessonId ? Store.getLesson(currentLessonId) : null;
        if (fresh?.runOfShow?.segments?.length) container.querySelector('#stage-lesson-btn')?.click();
        else container.querySelector('#auto-stage-btn')?.click();
      } else if (step === 'place') {
        // Placement lives in the run-of-show editor ("Place in room" per segment)
        const fresh = currentLessonId ? Store.getLesson(currentLessonId) : null;
        if (fresh?.runOfShow?.segments?.length) showRunOfShowEditor(container, fresh.runOfShow);
        else container.querySelector('#stage-lesson-btn')?.click();
      } else if (step === 'present') {
        const fresh = currentLessonId ? Store.getLesson(currentLessonId) : null;
        if (fresh?.runOfShow?.segments?.length) navigate(`/present/${currentLessonId}`);
      }
    });
  });
}

/* ══════════ KB Context Attachment ══════════ */

const FRAMEWORK_SUMMARIES = [
  { id: 'e21cc', title: 'E21CC Framework', content: 'Emerging 21st Century Competencies (E21CC):\n\nCAIT — Critical, Adaptive & Inventive Thinking:\n- Sound Reasoning: Examine issues logically, draw well-reasoned conclusions\n- Creative Problem-Solving: Generate novel ideas, explore innovative solutions\n- Managing Complexity & Ambiguity: Navigate uncertain, complex problems\n- Metacognition: Monitor own thinking, self-regulate, transfer learning\n\nCCI — Communication, Collaboration & Information:\n- Communicative Competence: Express ideas clearly across modes and contexts\n- Collaborative Skills: Work effectively in teams, co-create meaning\n- Information Literacy: Find, evaluate, use information critically and ethically\n\nCGC — Civic, Global & Cross-cultural Literacy:\n- Active Citizenship: Contribute responsibly to community and nation\n- Global Awareness: Appreciate interconnectedness and global challenges\n- Cross-cultural Sensitivity: Respect diversity, bridge cultural divides' },
  { id: 'stp', title: 'Singapore Teaching Practice', content: 'Singapore Teaching Practice (STP) — four Teaching Processes (non-hierarchical):\n\nPositive Classroom Culture — Safe environment, routines, student agency\nLesson Preparation — Understanding learners, clear objectives, resource planning\nLesson Enactment — Teaching actions, interaction patterns, classroom discourse\nAssessment and Feedback — Formative assessment, effective feedback, differentiated support' },
  { id: 'edtech', title: 'EdTech Masterplan 2030', content: 'EdTech Masterplan 2030 — 3 Thrusts:\n\nThrust 1: Digital Literacy — Data literacy, information & media literacy, digital communication\nThrust 2: Digital Creation — Computational thinking, digital design, AI literacy\nThrust 3: Digital Citizenship — Online safety, digital ethics, digital wellbeing\n\nIntegration: TPACK model, blended learning (SLS), AI-enhanced pedagogy' }
];

function renderKBChips(container) {
  const chipsEl = container.querySelector('#kb-chips');
  const barEl = container.querySelector('#kb-context-bar');
  if (!chipsEl || !barEl) return;

  if (attachedKBContext.length === 0) {
    barEl.style.display = 'none';
    return;
  }

  barEl.style.display = '';
  chipsEl.innerHTML = attachedKBContext.map((kb, i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--accent-light);color:var(--accent-dark);border-radius:var(--radius-full);font-size:0.75rem;font-weight:500;">
      ${esc(kb.title.slice(0, 30))}
      <button class="kb-remove-chip" data-idx="${i}" style="background:none;border:none;cursor:pointer;color:var(--accent-dark);padding:0;font-size:0.875rem;line-height:1;">&times;</button>
    </span>
  `).join('');

  chipsEl.querySelectorAll('.kb-remove-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      attachedKBContext.splice(parseInt(btn.dataset.idx), 1);
      renderKBChips(container);
    });
  });
}

/* ── Reference library picker chip bar ──
 * Lists the teacher's My References; each chip toggles the reference into the
 * generation context. Selection persists for the session (sessionStorage). */
function renderReferenceChips(container) {
  const bar = container.querySelector('#ref-picker-bar');
  if (!bar) return;

  const refs = Store.getReferences();
  if (!refs.length) { bar.style.display = 'none'; bar.innerHTML = ''; return; }

  bar.style.display = '';
  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--sp-2);flex-wrap:wrap;">
      <span style="font-size:0.6875rem;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);">References:</span>
      <div style="display:flex;gap:var(--sp-1);flex-wrap:wrap;">
        ${refs.map(r => {
          const on = selectedReferenceIds.includes(r.id);
          const tip = r.summary ? r.summary.slice(0, 140) : (r.source?.filename || 'Reference');
          return `<button class="ref-chip" data-ref-id="${esc(r.id)}" aria-pressed="${on}" title="${esc(tip)}" style="display:inline-flex;align-items:center;gap:5px;padding:2px 10px;border-radius:var(--radius-full);font-size:0.75rem;font-weight:500;cursor:pointer;border:1px solid ${on ? 'var(--accent)' : 'var(--border)'};background:${on ? 'var(--accent-light)' : 'var(--bg-card)'};color:${on ? 'var(--accent-dark)' : 'var(--ink-muted)'};">
            <span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${on ? 'var(--accent)' : 'var(--border)'};"></span>
            ${esc(r.name.slice(0, 32))}
          </button>`;
        }).join('')}
      </div>
    </div>`;

  bar.querySelectorAll('.ref-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.refId;
      const i = selectedReferenceIds.indexOf(id);
      if (i >= 0) selectedReferenceIds.splice(i, 1);
      else selectedReferenceIds.push(id);
      saveSelectedReferenceIds();
      renderReferenceChips(container);
    });
  });
}

function showAttachKBModal(container) {
  const uploads = Store.get('knowledgeUploads') || [];
  const pdFolders = Store.get('pdFolders') || [];
  const allItems = [
    ...FRAMEWORK_SUMMARIES.map(f => ({ ...f, type: 'framework' })),
    ...uploads.map(u => ({ id: u.id, title: u.title, content: u.content || '', type: 'upload' })),
    ...pdFolders.map(f => ({
      id: 'pd_' + f.id,
      title: f.name + ' (PD Folder)',
      content: (f.materials || []).map(m => `## ${m.title}\n${m.content}`).join('\n\n---\n\n'),
      type: 'pd-folder'
    })).filter(f => f.content.length > 0)
  ];

  const alreadyAttached = new Set(attachedKBContext.map(k => k.id));

  const { backdrop, close } = openModal({
    title: 'Attach Knowledge Base Context',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
        Select resources to include as context in your conversation. Co-Cher will reference these when planning your lesson.
      </p>
      <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
        ${allItems.map(item => `
          <label style="display:flex;align-items:flex-start;gap:var(--sp-3);padding:var(--sp-3) var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-md);cursor:pointer;transition:background 0.15s;">
            <input type="checkbox" value="${item.id}" class="kb-attach-check" ${alreadyAttached.has(item.id) ? 'checked' : ''} style="margin-top:3px;" />
            <div>
              <div style="font-size:0.8125rem;font-weight:600;color:var(--ink);">${esc(item.title)}</div>
              <div style="font-size:0.6875rem;color:var(--ink-muted);">
                ${item.type === 'framework' ? 'Built-in Framework' : item.type === 'pd-folder' ? 'PD Portfolio Folder' : 'Uploaded Resource'} · ${(item.content?.length || 0) > 1000 ? Math.round(item.content.length / 1000) + 'K chars' : item.content?.length + ' chars'}
              </div>
            </div>
          </label>
        `).join('')}
      </div>
      ${allItems.length === 0 ? '<p style="text-align:center;color:var(--ink-muted);padding:var(--sp-6);font-size:0.875rem;">No resources available. Upload documents in the Knowledge Base.</p>' : ''}
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="attach">Attach Selected</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="attach"]').addEventListener('click', () => {
    const checked = [...backdrop.querySelectorAll('.kb-attach-check:checked')].map(cb => cb.value);
    attachedKBContext = allItems.filter(item => checked.includes(item.id));
    renderKBChips(container);
    close();
    if (attachedKBContext.length > 0) {
      showToast(`${attachedKBContext.length} resource${attachedKBContext.length > 1 ? 's' : ''} attached as context`, 'success');
    }
  });
}

/* ══════════ Spatial Layout Section ══════════ */

const PRESET_ICONS = {
  direct: '📣', pods: '🤝', stations: '🔄', ushape: '🗣️',
  quiet: '📝', gallery: '🖼️', fishbowl: '🐟', maker: '🛠️'
};
const PRESET_NAMES = {
  direct: 'Direct Instruction', pods: 'Collaborative Pods', stations: 'Stations',
  ushape: 'U-Shape / Circle', quiet: 'Quiet Work', gallery: 'Gallery Walk',
  fishbowl: 'Fishbowl / Socratic', maker: 'Makerspace'
};

function renderSpatialSection(container, forceShow = false) {
  const el = container.querySelector('#spatial-section');
  if (!el) return;

  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const linkedLayoutId = currentLesson?.spatialLayout;
  const linkedLayout = linkedLayoutId ? Store.getSavedLayouts()?.find(l => l.id === linkedLayoutId) : null;
  const savedLayouts = Store.getSavedLayouts() || [];

  // If no layout linked and not forced open, show nothing or minimal prompt
  if (!linkedLayout && !forceShow && savedLayouts.length === 0) {
    el.innerHTML = '';
    return;
  }

  if (linkedLayout) {
    // Show linked layout summary
    el.innerHTML = `
      <div class="card" style="padding:var(--sp-5);border-top:3px solid var(--e21cc-cci);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--e21cc-cci)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            <span style="font-weight:600;font-size:0.9375rem;color:var(--ink);">Spatial Layout</span>
          </div>
          <div style="display:flex;gap:var(--sp-2);">
            <button class="btn btn-ghost btn-sm" id="open-spatial-editor">Open in Designer</button>
            <button class="btn btn-ghost btn-sm" id="unlink-spatial" style="color:var(--danger);">Unlink</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3);background:var(--bg-subtle);border-radius:var(--radius-md);">
          <div style="font-size:2rem;">${PRESET_ICONS[linkedLayout.preset] || '📐'}</div>
          <div>
            <div style="font-weight:600;font-size:0.875rem;color:var(--ink);">${esc(linkedLayout.name)}</div>
            <div style="font-size:0.75rem;color:var(--ink-muted);">
              ${linkedLayout.studentCount || '?'} students · ${linkedLayout.items?.length || 0} items · ${PRESET_NAMES[linkedLayout.preset] || 'Custom'}
            </div>
          </div>
        </div>
      </div>`;

    el.querySelector('#open-spatial-editor')?.addEventListener('click', () => {
      navigate('/spatial');
    });
    el.querySelector('#unlink-spatial')?.addEventListener('click', () => {
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { spatialLayout: null });
        showToast('Spatial layout unlinked', 'success');
        renderSpatialSection(container);
      }
    });
  } else {
    // Show option to link an existing layout or go design one
    el.innerHTML = `
      <div class="card" style="padding:var(--sp-5);border:2px dashed var(--border);background:transparent;box-shadow:none;">
        <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          <span style="font-weight:600;font-size:0.9375rem;color:var(--ink);">Spatial Layout</span>
        </div>
        <p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-3);">
          Link a classroom layout to this lesson to plan how students will be arranged physically.
        </p>
        ${savedLayouts.length > 0 ? `
          <div style="margin-bottom:var(--sp-3);">
            <label class="input-label" style="font-size:0.75rem;">Link existing layout</label>
            <select class="input" id="link-layout-select" style="font-size:0.8125rem;">
              <option value="">Choose a saved layout...</option>
              ${savedLayouts.map(l => `<option value="${l.id}">${l.name} (${l.studentCount || '?'} students)</option>`).join('')}
            </select>
          </div>
        ` : ''}
        <div style="display:flex;gap:var(--sp-2);">
          ${savedLayouts.length > 0 ? `<button class="btn btn-primary btn-sm" id="link-layout-btn">Link Layout</button>` : ''}
          <button class="btn btn-secondary btn-sm" id="design-new-spatial">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Design New in Spatial Designer
          </button>
        </div>
      </div>`;

    el.querySelector('#link-layout-btn')?.addEventListener('click', () => {
      const layoutId = container.querySelector('#link-layout-select')?.value;
      if (!layoutId) { showToast('Select a layout to link.', 'danger'); return; }
      if (currentLessonId) {
        Store.updateLesson(currentLessonId, { spatialLayout: layoutId });
        showToast('Spatial layout linked!', 'success');
        renderSpatialSection(container);
      } else {
        showToast('Save the lesson first, then link a layout.', 'danger');
      }
    });
    el.querySelector('#design-new-spatial')?.addEventListener('click', () => {
      navigate('/spatial');
    });
  }
}

/* ══════════ Linked Resources Section ══════════ */

/* Badge + label per attachedResources type. Unknown/legacy types keep the
 * historical Source styling so old lessons render unchanged. */
const RESOURCE_META = {
  stimulus:   { badge: 'badge-blue',   label: 'Stimulus' },
  source:     { badge: 'badge-amber',  label: 'Source' },
  simulation: { badge: 'badge-green',  label: 'Simulation' },
  deck:       { badge: 'badge-violet', label: 'Deck' },
  audio:      { badge: 'badge-rose',   label: 'Audio' }
};
const resourceMeta = (type) => RESOURCE_META[type] || { badge: 'badge-amber', label: 'Source' };

function renderLinkedResourcesSection(container) {
  const el = container.querySelector('#linked-resources-section');
  if (!el) return;

  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const attachedResources = currentLesson?.attachedResources || [];
  const stimulusLib = Store.getStimulusLibrary();
  const sourceLib = Store.getSourceLibrary();
  const hasLibrary = stimulusLib.length > 0 || sourceLib.length > 0
    || listDeckMeta().length > 0 || listAudioMeta().length > 0;

  if (attachedResources.length === 0 && !hasLibrary) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `
    <div class="card" style="padding:var(--sp-5);border-top:3px solid #0ea5e9;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3);">
        <div style="display:flex;align-items:center;gap:var(--sp-2);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span style="font-weight:600;font-size:0.9375rem;color:var(--ink);">Linked Resources</span>
          ${attachedResources.length > 0 ? `<span class="badge badge-blue" style="font-size:0.6875rem;">${attachedResources.length}</span>` : ''}
        </div>
        ${currentLessonId && hasLibrary ? `<button class="btn btn-secondary btn-sm" id="link-resources-btn">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Link Resources
        </button>` : ''}
      </div>
      ${!currentLessonId ? `<p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;">Save the lesson first, then link Stimulus Material, Source Analysis sets, slide decks or audio clips.</p>` : ''}
      ${currentLessonId && attachedResources.length === 0 && hasLibrary ? `<p style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.5;margin-bottom:var(--sp-2);">Attach Stimulus Material, Source Analysis sets, slide decks or audio clips to this lesson.</p>` : ''}
      ${attachedResources.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2);">
          ${attachedResources.map((r, idx) => `
            <div style="display:flex;align-items:center;gap:var(--sp-1);padding:var(--sp-1) var(--sp-3);background:var(--bg-subtle);border-radius:var(--radius-lg);font-size:0.8125rem;border:1px solid var(--border-light);">
              <span class="badge ${resourceMeta(r.type).badge}" style="font-size:0.625rem;">${resourceMeta(r.type).label}</span>
              ${(r.type === 'deck' || r.type === 'audio') && r.id ? `
                <button class="btn btn-ghost btn-sm open-material-btn" data-type="${r.type}" data-id="${escAttr(r.id)}" data-title="${escAttr(r.title || '')}" title="${r.type === 'deck' ? 'Open deck in a new tab' : 'Play audio clip'}" style="padding:1px 4px;color:var(--ink);">
                  ${esc(r.title)} <span aria-hidden="true">${r.type === 'deck' ? '&#8599;' : '&#9654;'}</span>
                </button>`
              : `<span style="color:var(--ink);">${esc(r.title)}</span>`}
              <button class="btn btn-ghost btn-sm unlink-resource-btn" data-idx="${idx}" title="Remove" style="padding:1px 3px;color:var(--danger);margin-left:2px;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>`;

  // Wire link resources button
  el.querySelector('#link-resources-btn')?.addEventListener('click', () => {
    showLinkResourcesModal(container);
  });

  // Wire deck/audio open buttons (WS-4 materials)
  el.querySelectorAll('.open-material-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (btn.dataset.type === 'deck') {
        const ok = await openDeckById(btn.dataset.id);
        if (!ok) showToast('Deck content not found on this device.', 'danger');
      } else {
        showAudioPlaybackModal(btn.dataset.id, btn.dataset.title);
      }
    });
  });

  // Wire unlink buttons
  el.querySelectorAll('.unlink-resource-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const updated = [...attachedResources];
      updated.splice(idx, 1);
      Store.updateLesson(currentLessonId, { attachedResources: updated });
      showToast('Resource unlinked', 'success');
      renderLinkedResourcesSection(container);
    });
  });
}

function showLinkResourcesModal(container) {
  const currentLesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  if (!currentLesson) return;

  const attachedResources = currentLesson.attachedResources || [];
  const attachedIds = new Set(attachedResources.map(r => r.id));
  const stimulusLib = Store.getStimulusLibrary();
  const sourceLib = Store.getSourceLibrary();

  const allResources = [
    ...stimulusLib.map(s => ({ type: 'stimulus', id: s.id, title: s.title || s.topic || 'Untitled Stimulus' })),
    ...sourceLib.map(s => ({ type: 'source', id: s.id, title: s.title || s.topic || 'Untitled Source' })),
    ...listDeckMeta().map(d => ({ type: 'deck', id: d.id, title: d.title || 'Untitled Deck' })),
    ...listAudioMeta().map(a => ({ type: 'audio', id: a.id, title: a.title || 'Untitled Clip' }))
  ];

  const available = allResources.filter(r => !attachedIds.has(r.id));

  if (available.length === 0) {
    showToast('No additional resources available to link.', 'danger');
    return;
  }

  const { backdrop, close } = openModal({
    title: 'Link Resources to Lesson',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
        Select Stimulus Material or Source Analysis sets to attach to this lesson.
      </p>
      <div style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:var(--sp-2);">
        ${available.map(r => `
          <label style="display:flex;align-items:center;gap:var(--sp-2);padding:var(--sp-2) var(--sp-3);border:1px solid var(--border-light);border-radius:var(--radius-md);cursor:pointer;transition:background 0.15s;" class="resource-option">
            <input type="checkbox" class="resource-check" data-type="${r.type}" data-id="${r.id}" data-title="${escAttr(r.title)}" />
            <span class="badge ${resourceMeta(r.type).badge}" style="font-size:0.625rem;flex-shrink:0;">${resourceMeta(r.type).label}</span>
            <span style="font-size:0.8125rem;color:var(--ink);">${esc(r.title)}</span>
          </label>
        `).join('')}
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="link">Link Selected</button>
    `
  });

  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="link"]').addEventListener('click', () => {
    const checked = [...backdrop.querySelectorAll('.resource-check:checked')];
    if (checked.length === 0) {
      showToast('Select at least one resource.', 'danger');
      return;
    }
    const newResources = checked.map(cb => ({
      type: cb.dataset.type,
      id: cb.dataset.id,
      title: cb.dataset.title
    }));
    const updated = [...attachedResources, ...newResources];
    Store.updateLesson(currentLessonId, { attachedResources: updated });
    showToast(`Linked ${newResources.length} resource${newResources.length > 1 ? 's' : ''}!`, 'success');
    close();
    renderLinkedResourcesSection(container);
  });
}

/* ══════════ WS-4 Materials: Slide Deck + Audio Clip flows ══════════ */

// Honest-copy constant: the TTS pipeline produces voices only. Repeated in
// every audio modal so the teacher is never surprised by the output.
const AUDIO_HONESTY = 'AI voices only &mdash; no music or sound effects.';
const AUDIO_VOICES = { A: 'Kore', B: 'Puck' };  // fixed sensible defaults
const AUDIO_STYLES = [
  { id: 'murder mystery clip', label: 'Murder mystery clip', speakers: 2 },
  { id: 'news soundbite',      label: 'News soundbite',      speakers: 1 },
  { id: 'dialogue',            label: 'Two-voice dialogue',  speakers: 2 },
  { id: 'narration',           label: 'Narration',           speakers: 1 }
];

/** Append one {type,id,title} entry to the current lesson's attachedResources. */
function attachMaterialToLesson(entry) {
  if (!currentLessonId) return;
  const lesson = Store.getLesson(currentLessonId);
  Store.updateLesson(currentLessonId, {
    attachedResources: [...(lesson?.attachedResources || []), entry]
  });
}

/* ── Slide deck: generate from the current plan → preview modal ── */
async function generateDeckFlow(container) {
  if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
  if (!currentLessonId) { showToast('Save the lesson first — materials attach to a saved lesson.', 'danger'); return; }
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
  if (aiMsgs.length === 0) { showToast('Chat with Co-Cher first to create a plan.', 'danger'); return; }
  const lesson = Store.getLesson(currentLessonId);
  const args = {
    plan: aiMsgs.map(m => m.content).join('\n\n'),
    lessonTitle: lesson?.title || 'Lesson',
    className: planClassContext?.name || '',
    slideTarget: 8
  };
  const resultEl = container.querySelector('#ai-result');
  if (resultEl) {
    resultEl.innerHTML = '<div class="chat-typing" style="padding:var(--sp-4);">Generating slide deck&hellip;</div>';
    resultEl.scrollIntoView({ behavior: 'smooth' });
  }
  try {
    const deck = await generateDeck(args);
    await resolveDeckMedia(deck, resultEl); // fill svgPrompt/imagePrompt slides with real visuals
    if (resultEl) resultEl.innerHTML = '';
    showDeckPreviewModal(container, deck, args);
  } catch (err) {
    if (resultEl) resultEl.innerHTML = `<div class="card" style="padding:var(--sp-4);color:var(--danger);">Error: ${esc(err.message)}</div>`;
  }
}

/* Turn each slide's svgPrompt/imagePrompt into a real, self-contained visual:
 * svgPrompt -> an inline SVG concept diagram; imagePrompt -> an embedded data:
 * image. Runs after generation, capped for cost, and degrades gracefully — a
 * slide that fails to get its visual simply renders without one. */
async function resolveDeckMedia(deck, resultEl) {
  const slides = (deck && deck.slides) || [];
  const jobs = [];
  slides.forEach((s, i) => {
    if (jobs.length >= 8) return;                 // cap AI visuals per deck
    if (s.svgPrompt && !s.svg) jobs.push({ i, kind: 'svg', prompt: s.svgPrompt });
    else if (s.imagePrompt && !s.image) jobs.push({ i, kind: 'img', prompt: s.imagePrompt });
  });
  if (!jobs.length) return deck;
  let done = 0;
  const setMsg = () => { if (resultEl) resultEl.innerHTML = `<div class="chat-typing" style="padding:var(--sp-4);">Creating deck visuals&hellip; ${done}/${jobs.length}</div>`; };
  setMsg();
  const run = async (job) => {
    try {
      if (job.kind === 'svg') {
        const svg = await generateSVGDiagram(job.prompt);
        if (typeof svg === 'string' && svg.includes('<svg')) slides[job.i].svg = svg;
      } else {
        const img = await generateImage(job.prompt);
        if (typeof img === 'string' && img.startsWith('data:image/')) slides[job.i].image = img;
      }
    } catch { /* graceful — the slide renders without the visual */ }
    done++; setMsg();
  };
  const CONC = 3;
  for (let k = 0; k < jobs.length; k += CONC) {
    await Promise.all(jobs.slice(k, k + CONC).map(run));
  }
  return deck;
}

function showDeckPreviewModal(container, deck, args) {
  const { backdrop, close } = openModal({
    title: '&#128444;&#65039; Slide Deck Preview',
    width: 620,
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">
        <strong>${esc(deck.title)}</strong> &middot; ${deck.slides.length} slides &middot;
        one self-contained HTML file (works offline) &mdash; present in a browser tab, or print it to PDF.
      </p>
      <div style="max-height:380px;overflow-y:auto;display:flex;flex-direction:column;gap:var(--sp-2);">
        ${deck.slides.map((s, i) => {
          const vis = s.image ? '&#128444;&#65039; image' : s.svg ? '&#9998; diagram' : s.chart ? '&#128202; chart' : (s.columns ? '&#9868; columns' : '');
          return `
          <div style="border:1px solid var(--border-light);border-radius:var(--radius-md);padding:var(--sp-2) var(--sp-3);">
            <div style="display:flex;align-items:baseline;gap:var(--sp-2);flex-wrap:wrap;">
              <span style="flex-shrink:0;font-size:0.6875rem;font-weight:700;color:var(--accent);">${i + 1}</span>
              <span style="font-size:0.875rem;font-weight:600;color:var(--ink);">${esc(s.title || s.statement || s.quote || `Slide ${i + 1}`)}</span>
              ${s.layout ? `<span style="font-size:0.5625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-faint);border:1px solid var(--border-light);border-radius:var(--radius-full);padding:1px 6px;">${esc(s.layout)}</span>` : ''}
              ${vis ? `<span style="font-size:0.625rem;font-weight:600;color:var(--accent);">${vis}</span>` : ''}
            </div>
            ${(s.bullets && s.bullets.length) ? `<ul style="margin:4px 0 0 22px;padding:0;">${s.bullets.map(b => `<li style="font-size:0.8125rem;color:var(--ink-secondary);line-height:1.5;">${esc(b)}</li>`).join('')}</ul>` : ''}
            ${s.columns ? `<div style="margin:4px 0 0 22px;font-size:0.75rem;color:var(--ink-muted);">${s.columns.map(c => esc(c.heading)).filter(Boolean).join(' &middot; ')}</div>` : ''}
            ${s.notes ? `<div style="margin:4px 0 0 22px;font-size:0.75rem;color:var(--ink-muted);font-style:italic;">Note: ${esc(s.notes)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-ghost" data-action="regen">Regenerate</button>
      <button class="btn btn-ghost" data-action="download">Download .html</button>
      <button class="btn btn-primary" data-action="attach">Save &amp; attach</button>`
  });
  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="download"]').addEventListener('click', () => {
    downloadBlob(new Blob([compileDeckHTML(deck)], { type: 'text/html' }), deckFilename(deck.title));
  });
  backdrop.querySelector('[data-action="regen"]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Regenerating…';
    try {
      const fresh = await generateDeck(args);
      close();
      showDeckPreviewModal(container, fresh, args);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Regenerate';
      showToast(`Regenerate failed: ${err.message}`, 'danger');
    }
  });
  backdrop.querySelector('[data-action="attach"]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const meta = await saveDeckMaterial({
      lessonId: currentLessonId,
      title: deck.title,
      html: compileDeckHTML(deck),
      slideCount: deck.slides.length
    });
    if (!meta) {
      btn.disabled = false;
      showToast('Could not store the deck — browser storage unavailable.', 'danger');
      return;
    }
    attachMaterialToLesson({ type: 'deck', id: meta.id, title: meta.title });
    showToast('Slide deck attached to this lesson!', 'success');
    close();
    renderLinkedResourcesSection(container);
  });
}

/* ── Audio clip: form → script preview (editable) → voice → attach ── */
function showAudioClipModal(container) {
  const lesson = currentLessonId ? Store.getLesson(currentLessonId) : null;
  const { backdrop, close } = openModal({
    title: '&#127908; Audio Clip',
    width: 520,
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);line-height:1.5;">
        Generate a short scripted clip for this lesson, review the script, then voice it.<br>
        <em>${AUDIO_HONESTY}</em>
      </p>
      <div class="input-group" style="margin-bottom:var(--sp-3);">
        <label class="input-label">Topic</label>
        <input class="input" id="audio-topic" value="${escAttr(lesson?.title || '')}" placeholder="e.g. The fall of Singapore, 1942" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-bottom:var(--sp-3);">
        <div class="input-group">
          <label class="input-label">Style</label>
          <select class="input" id="audio-style">
            ${AUDIO_STYLES.map(s => `<option value="${escAttr(s.id)}">${esc(s.label)}</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label class="input-label">Length</label>
          <select class="input" id="audio-minutes">
            ${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${n === 3 ? ' selected' : ''}>${n} min</option>`).join('')}
          </select>
        </div>
      </div>
      <p style="font-size:0.75rem;color:var(--ink-muted);line-height:1.5;">Voices are fixed sensible defaults (${esc(AUDIO_VOICES.A)} &amp; ${esc(AUDIO_VOICES.B)}).</p>
      <div id="audio-form-status" style="margin-top:var(--sp-2);font-size:0.8125rem;color:var(--danger);"></div>`,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-primary" data-action="script">Generate script</button>`
  });
  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="script"]').addEventListener('click', async (e) => {
    if (!Store.get('apiKey')) { showToast('Please set your API key in Settings first.', 'danger'); return; }
    const topic = backdrop.querySelector('#audio-topic').value.trim();
    if (!topic) { showToast('Please enter a topic.', 'danger'); return; }
    const styleId = backdrop.querySelector('#audio-style').value;
    const minutes = Number(backdrop.querySelector('#audio-minutes').value) || 3;
    const speakers = (AUDIO_STYLES.find(s => s.id === styleId)?.speakers) || 2;
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Writing script…';
    try {
      const script = await generatePodcastScript({ topic, style: styleId, minutes, speakers });
      close();
      showAudioScriptModal(container, script, { topic, style: styleId, minutes, speakers });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Generate script';
      const status = backdrop.querySelector('#audio-form-status');
      if (status) status.textContent = `Error: ${err.message}`;
    }
  });
}

function showAudioScriptModal(container, script, opts) {
  const hasKey = !!Store.get('apiKey');
  const { backdrop, close } = openModal({
    title: '&#127908; Audio Clip &mdash; Script',
    width: 560,
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">
        <strong>${esc(script.title)}</strong> &middot; ${esc(opts.style)} &middot; ~${opts.minutes} min.
        Edit any turn below, then voice it. <em>${AUDIO_HONESTY}</em>
      </p>
      <div style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:var(--sp-2);">
        ${script.turns.map(t => `
          <div class="input-group">
            <label class="input-label" style="font-size:0.6875rem;">Speaker ${esc(t.speaker)} (${esc(t.speaker === 'B' ? AUDIO_VOICES.B : AUDIO_VOICES.A)})</label>
            <textarea class="input audio-turn" data-speaker="${escAttr(t.speaker)}" rows="2">${esc(t.text)}</textarea>
          </div>`).join('')}
      </div>
      <div id="audio-voice-status" style="margin-top:var(--sp-3);font-size:0.8125rem;color:var(--danger);line-height:1.5;"></div>`,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Cancel</button>
      <button class="btn btn-ghost" data-action="browser-voice" title="Reads the script with your browser's built-in voices — no API key needed">Play with browser voice &mdash; free, robotic</button>
      <button class="btn btn-primary" data-action="voice"${hasKey ? '' : ' disabled title="Add your Gemini API key in Settings to use AI voices"'}>&#127908; Voice it</button>`
  });
  const collectTurns = () => [...backdrop.querySelectorAll('.audio-turn')]
    .map(t => ({ speaker: t.dataset.speaker, text: t.value.trim() }))
    .filter(t => t.text);
  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="browser-voice"]').addEventListener('click', () => {
    playWithBrowserVoice(collectTurns());
  });
  backdrop.querySelector('[data-action="voice"]').addEventListener('click', async (e) => {
    const turns = collectTurns();
    if (turns.length === 0) { showToast('The script is empty.', 'danger'); return; }
    const btn = e.currentTarget;
    const status = backdrop.querySelector('#audio-voice-status');
    btn.disabled = true;
    btn.textContent = 'Voicing…';
    if (status) {
      status.style.color = 'var(--ink-muted)';
      status.textContent = 'Generating AI voices — this can take a little while…';
    }
    try {
      const result = await generateSpeech({ turns, voices: AUDIO_VOICES, style: opts.style });
      close();
      showAudioResultModal(container, result, { ...script, turns }, opts);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '&#127908; Voice it';
      if (status) {
        status.style.color = 'var(--danger)';
        status.textContent = `AI voicing failed: ${err.message} You can still use "Play with browser voice" — free, robotic.`;
      }
    }
  });
}

function showAudioResultModal(container, result, script, opts) {
  const url = URL.createObjectURL(result.blob);
  const { backdrop, close } = openModal({
    title: '&#127908; Audio Clip &mdash; Preview',
    width: 480,
    onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000),
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-3);line-height:1.5;">
        <strong>${esc(script.title)}</strong> &middot; ${esc(opts.style)}${result.durationHint ? ` &middot; ~${result.durationHint}s` : ''}<br>
        <em>${AUDIO_HONESTY}</em>
      </p>
      <audio controls src="${url}" style="width:100%;"></audio>`,
    footer: `
      <button class="btn btn-secondary" data-action="cancel">Discard</button>
      <button class="btn btn-ghost" data-action="download">Download .wav</button>
      <button class="btn btn-primary" data-action="attach">Save &amp; attach</button>`
  });
  backdrop.querySelector('[data-action="cancel"]').addEventListener('click', close);
  backdrop.querySelector('[data-action="download"]').addEventListener('click', () => {
    downloadBlob(result.blob, slugify(script.title) + '.wav');
  });
  backdrop.querySelector('[data-action="attach"]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const meta = await saveAudioMaterial({
      lessonId: currentLessonId,
      title: script.title,
      style: opts.style,
      blob: result.blob
    });
    if (!meta) {
      btn.disabled = false;
      showToast('Could not store the clip — browser storage unavailable.', 'danger');
      return;
    }
    attachMaterialToLesson({ type: 'audio', id: meta.id, title: meta.title });
    showToast('Audio clip attached to this lesson!', 'success');
    close();
    renderLinkedResourcesSection(container);
  });
}

/* Browser speechSynthesis fallback — free and robotic, but works with no
 * API key and when the TTS tier is unavailable. */
function playWithBrowserVoice(turns) {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
    showToast('This browser has no built-in voices.', 'danger');
    return;
  }
  if (!turns.length) { showToast('The script is empty.', 'danger'); return; }
  synth.cancel();
  const voices = synth.getVoices();
  turns.forEach(t => {
    const u = new SpeechSynthesisUtterance(t.text);
    // Two distinct browser voices when available, so A/B stay tellable-apart
    if (voices.length > 1 && t.speaker === 'B') u.voice = voices[1];
    else if (voices.length > 0) u.voice = voices[0];
    synth.speak(u);
  });
  showToast("Playing with your browser's built-in voice…", 'success');
}

/** Small playback modal for an attached audio clip (planner surface). */
async function showAudioPlaybackModal(id, title) {
  const blob = await getMediaContent(id);
  if (!(blob instanceof Blob)) {
    showToast('Audio content not found on this device.', 'danger');
    return;
  }
  const url = URL.createObjectURL(blob);
  const { backdrop, close } = openModal({
    title: `&#127911; ${esc(title || 'Audio clip')}`,
    width: 420,
    onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000),
    body: `
      <audio controls src="${url}" style="width:100%;"></audio>
      <p style="font-size:0.75rem;color:var(--ink-muted);margin-top:var(--sp-2);">${AUDIO_HONESTY}</p>`,
    footer: `<button class="btn btn-secondary" data-action="close">Close</button>`
  });
  backdrop.querySelector('[data-action="close"]').addEventListener('click', close);
}

/* ══════════ Resizable Panel Handle ══════════ */
function initResizeHandle(handle, leftPanel, rightPanel, parentContainer) {
  if (!handle || !leftPanel || !rightPanel || !parentContainer) return;

  let isResizing = false;
  let startX = 0;
  let startLeftWidth = 0;

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startLeftWidth = leftPanel.getBoundingClientRect().width;
    handle.classList.add('active');
    document.body.classList.add('resizing-panels');
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    const containerWidth = parentContainer.getBoundingClientRect().width;
    const handleWidth = 6;
    const newLeftWidth = startLeftWidth + dx;
    const minWidth = 320;
    const maxWidth = containerWidth - minWidth - handleWidth;

    if (newLeftWidth >= minWidth && newLeftWidth <= maxWidth) {
      const leftPct = (newLeftWidth / containerWidth) * 100;
      const rightPct = ((containerWidth - newLeftWidth - handleWidth) / containerWidth) * 100;
      leftPanel.style.flex = `0 0 ${leftPct}%`;
      rightPanel.style.flex = `0 0 ${rightPct}%`;
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

  // Double-click to reset to 50/50
  handle.addEventListener('dblclick', () => {
    leftPanel.style.flex = '1 1 50%';
    rightPanel.style.flex = '1 1 50%';
  });
}

/* ══════════ Share Modal (Export / Import lesson JSON) ══════════ */
/* ══════════ Timetable Hints for Date/Time ══════════ */
async function setupTimetableHints(container) {
  const dateInput = container.querySelector('#lesson-date');
  const periodSelect = container.querySelector('#lesson-period');
  const hintEl = container.querySelector('#lesson-tt-hint');
  if (!dateInput || !hintEl) return;

  try {
    const user = getCurrentUser();
    if (!user?.email) return;
    const [ttData, calData] = await Promise.all([loadTT(), ensureCalendar()]);
    const teacherRow = findTeacherRow(ttData, user.email);
    if (!teacherRow) return;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const periodTimes = ['7:30', '8:10', '8:50', '9:30', '10:20', '11:00', '11:40', '12:20', '1:10', '1:50', '2:30'];

    function updateHint() {
      const dateVal = dateInput.value;
      if (!dateVal) { hintEl.innerHTML = ''; return; }
      const d = new Date(dateVal + 'T00:00:00');
      const dayIdx = d.getDay();
      if (dayIdx === 0 || dayIdx === 6) { hintEl.innerHTML = '<em>Weekend</em>'; return; }
      const dayStr = dayNames[dayIdx];

      // Use CalendarReference for authoritative week type
      let weekType = calData ? getWeekType(calData, d) : null;
      if (weekType === 'N.A.') { hintEl.innerHTML = '<em>Non-teaching week</em>'; return; }
      // Fallback: math-based
      if (!weekType) {
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
        weekType = weekNum % 2 === 1 ? 'Odd' : 'Even';
      }

      // Gather the day's lessons
      const lessons = [];
      for (let p = 1; p <= 11; p++) {
        const col = `${weekType}${dayStr}${p}`;
        const val = teacherRow[col];
        if (val && val !== '0') {
          const parts = val.split(' / ');
          lessons.push({ p, code: parts[0]?.trim(), room: parts[1]?.trim() || '' });
        }
      }

      if (lessons.length === 0) {
        hintEl.innerHTML = `<em>${weekType} ${dayStr} — no lessons</em>`;
        return;
      }

      hintEl.innerHTML = `<strong>${weekType} ${dayStr}:</strong> ` +
        lessons.map(l => `<span style="display:inline-block;padding:1px 6px;background:var(--accent-light);border-radius:4px;margin:1px;cursor:pointer;font-size:0.6875rem;" class="tt-period-chip" data-period="${l.p}" data-code="${l.code}" data-room="${l.room}">P${l.p} ${l.code}</span>`).join(' ');

      // Wire period chips
      hintEl.querySelectorAll('.tt-period-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          periodSelect.value = chip.dataset.period;
          lessonDateTime = {
            date: dateVal,
            period: chip.dataset.period,
            classCode: chip.dataset.code,
            room: chip.dataset.room
          };
        });
      });
    }

    dateInput.addEventListener('change', updateHint);
    periodSelect.addEventListener('change', () => {
      lessonDateTime = {
        date: dateInput.value,
        period: periodSelect.value,
        classCode: '',
        room: ''
      };
    });
    updateHint();
  } catch { /* TT is optional */ }
}

/* ══════════ Word (.docx) Export ══════════ */
function exportToWord() {
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
  if (aiMsgs.length === 0 && Object.keys(lessonComponents).length === 0) {
    showToast('No lesson content to export yet.', 'danger');
    return;
  }

  const title = currentLessonId ? (Store.getLesson(currentLessonId)?.title || 'Lesson Plan') : 'Lesson Plan';
  const planText = aiMsgs.map(m => m.content).join('\n\n---\n\n');

  // Build components text
  const compKeys = Object.keys(lessonComponents)
    .filter(k => lessonComponents[k]?.content)
    .sort((a, b) => (COMPONENT_META[a]?.order || 99) - (COMPONENT_META[b]?.order || 99));

  let componentsText = '';
  if (compKeys.length > 0) {
    componentsText = '\n\n' + '='.repeat(60) + '\nLESSON COMPONENTS\n' + '='.repeat(60) + '\n\n';
    componentsText += compKeys.map(key => {
      const m = COMPONENT_META[key] || { label: key };
      return `--- ${m.label} ---\n\n${lessonComponents[key].content}`;
    }).join('\n\n');
  }

  // Date/time info
  let dateInfo = '';
  if (lessonDateTime?.date) {
    dateInfo = `Date: ${lessonDateTime.date}`;
    if (lessonDateTime.period) dateInfo += ` | Period ${lessonDateTime.period}`;
    if (lessonDateTime.classCode) dateInfo += ` | ${lessonDateTime.classCode}`;
    if (lessonDateTime.room) dateInfo += ` | Room: ${lessonDateTime.room}`;
    dateInfo += '\n';
  }

  // Build a .docx using the Office Open XML format (minimal)
  const fullText = `${title}\n${dateInfo}Exported from Co-Cher · ${new Date().toLocaleDateString('en-SG')}\n\n${planText}${componentsText}`;

  // Convert to simple Word-compatible HTML wrapped in .doc
  const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.6;color:#1e293b;max-width:700px;margin:0 auto;padding:24px}
h1{font-size:16pt;color:#000C53;border-bottom:2px solid #000C53;padding-bottom:6px}
h2{font-size:13pt;margin-top:18px}h3{font-size:11pt;margin-top:14px}
table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #ccc;padding:4px 8px;text-align:left;font-size:10pt}
th{background:#f1f5f9;font-weight:bold}
ul,ol{padding-left:20px}
hr{border:none;border-top:1px solid #e2e8f0;margin:16px 0}
.meta{font-size:9pt;color:#64748b}
.component-header{background:#f1f5f9;padding:8px 12px;margin:16px 0 8px;font-weight:bold;font-size:11pt;border-left:3px solid #4361ee}</style></head>
<body>
<h1>${esc(title)}</h1>
<p class="meta">${dateInfo ? esc(dateInfo) + '<br/>' : ''}Exported from Co-Cher &middot; ${new Date().toLocaleDateString('en-SG')}</p>
${mdStatic(planText)}
${compKeys.length > 0 ? '<hr/><h2>Lesson Components</h2>' + compKeys.map(key => {
    const m = COMPONENT_META[key] || { label: key };
    return `<div class="component-header">${m.label}</div>${mdStatic(lessonComponents[key].content)}`;
  }).join('') : ''}
</body></html>`;

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Word document downloaded!', 'success');
}

function showShareModal(container) {
  const aiMsgs = chatMessages.filter(m => m.role === 'assistant');
  const planText = aiMsgs.map(m => m.content).join('\n\n');
  const exportData = {
    _cocherExport: true,
    version: 1,
    exportedAt: new Date().toISOString(),
    title: currentLessonId ? (Store.getLesson(currentLessonId)?.title || 'Untitled') : 'Untitled Lesson',
    chatHistory: stripAttachmentData(chatMessages),
    components: { ...lessonComponents },
    classContext: planClassContext ? { name: planClassContext.name, subject: planClassContext.subject, level: planClassContext.level } : null
  };

  let modalRef = null;
  modalRef = openModal({
    title: 'Share Lesson',
    body: `
      <div style="display:flex;flex-direction:column;gap:var(--sp-4);">
        <!-- Export Section -->
        <div style="padding:var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-lg);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span style="font-weight:600;font-size:0.875rem;">Send to Colleague</span>
          </div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="copy-share-json">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy to Clipboard
            </button>
            <button class="btn btn-secondary btn-sm" id="download-share-json">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download .json
            </button>
          </div>
          <details style="margin-top:var(--sp-2);">
            <summary style="font-size:0.6875rem;color:var(--ink-faint);cursor:pointer;">View raw JSON</summary>
            <textarea id="share-export-json" readonly style="width:100%;height:80px;font-family:monospace;font-size:0.6875rem;resize:vertical;margin-top:4px;border-radius:var(--radius-md);">${JSON.stringify(exportData, null, 2)}</textarea>
          </details>
        </div>

        <!-- Import Section -->
        <div style="padding:var(--sp-4);background:var(--bg-subtle);border-radius:var(--radius-lg);">
          <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-3);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span style="font-weight:600;font-size:0.875rem;">Import from Colleague</span>
          </div>
          <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-2);">
            <label class="btn btn-primary btn-sm" style="cursor:pointer;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Upload .json File
              <input type="file" id="import-share-file" accept=".json" style="display:none;" />
            </label>
          </div>
          <details>
            <summary style="font-size:0.6875rem;color:var(--ink-faint);cursor:pointer;">Or paste JSON manually</summary>
            <textarea id="share-import-json" placeholder="Paste shared lesson JSON here..." style="width:100%;height:60px;font-family:monospace;font-size:0.6875rem;resize:vertical;margin-top:4px;border-radius:var(--radius-md);"></textarea>
            <button class="btn btn-secondary btn-sm" id="import-share-json" style="margin-top:4px;">Import</button>
          </details>
        </div>
      </div>
    `,
    onMount: (modal) => {
      modal.querySelector('#copy-share-json').addEventListener('click', () => {
        const ta = modal.querySelector('#share-export-json');
        ta.select();
        navigator.clipboard.writeText(ta.value).then(() => showToast('Copied to clipboard!', 'success'));
      });
      modal.querySelector('#download-share-json').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lesson_${exportData.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Downloaded!', 'success');
      });
      modal.querySelector('#import-share-json').addEventListener('click', () => {
        const raw = modal.querySelector('#share-import-json').value.trim();
        if (!raw) { showToast('Please paste lesson JSON first.', 'danger'); return; }
        importSharedLesson(raw, container, modalRef);
      });
      modal.querySelector('#import-share-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          importSharedLesson(reader.result, container, modalRef);
        };
        reader.readAsText(file);
      });
    }
  });
}

function importSharedLesson(jsonStr, container, modalRef) {
  try {
    const data = JSON.parse(jsonStr);
    if (!data._cocherExport) { showToast('Not a valid Co-Cher lesson export.', 'danger'); return; }
    chatMessages = data.chatHistory || [];
    lessonComponents = data.components || {};
    planClassContext = data.classContext || null;
    currentLessonId = null;
    if (modalRef?.close) modalRef.close();
    render(container);
    showToast(`Imported "${data.title}"! Save when ready.`, 'success');
  } catch (err) {
    showToast('Invalid JSON: ' + err.message, 'danger');
  }
}

/* ══════════ Lesson Templates Modal ══════════ */
const LESSON_TEMPLATES = [
  {
    id: '5e',
    name: '5E Inquiry Model',
    desc: 'Engage, Explore, Explain, Elaborate, Evaluate — ideal for science inquiry lessons.',
    prompt: 'Design a lesson using the 5E Inquiry Model (Engage, Explore, Explain, Elaborate, Evaluate). Include activities for each phase. Make the Engage phase spark curiosity with a discrepant event or provocative question. The Explore phase should be student-driven hands-on investigation. Include formative checks.'
  },
  {
    id: 'station-rotation',
    name: 'Station Rotation',
    desc: 'Students rotate through learning stations — great for differentiation and hands-on activities.',
    prompt: 'Design a station rotation lesson with 4 stations. Each station should be 10-12 minutes. Include a mix of: teacher-led station, collaborative station, individual practice station, and a tech/simulation station. Provide clear instructions for each station and transition signals.'
  },
  {
    id: 'flipped',
    name: 'Flipped Classroom',
    desc: 'Pre-class video/reading + in-class active learning and application.',
    prompt: 'Design a flipped classroom lesson. Include: (1) Pre-class assignment (video, reading, or interactive resource ~10 min), (2) In-class warm-up check for understanding, (3) Active learning activity (problem-solving, discussion, or project work), (4) Wrap-up with exit ticket. Suggest specific resources for the pre-class component.'
  },
  {
    id: 'tbl',
    name: 'Team-Based Learning (TBL)',
    desc: 'Individual readiness test, team discussion, application activity (4S framework).',
    prompt: 'Design a Team-Based Learning (TBL) lesson with: (1) Pre-class preparation (reading/video), (2) Individual Readiness Assurance Test (iRAT, 5-8 MCQs), (3) Team Readiness Assurance Test (tRAT, same questions solved as a team), (4) Application Activity following the 4S framework (Significant problem, Same problem, Specific choice, Simultaneous report).'
  },
  {
    id: 'thinking-routine',
    name: 'Thinking Routine (VT)',
    desc: 'Visible Thinking routine — See-Think-Wonder, Connect-Extend-Challenge, etc.',
    prompt: 'Design a lesson built around Visible Thinking routines. Use at least 2 of these: See-Think-Wonder, Think-Pair-Share, Connect-Extend-Challenge, or I Used to Think...Now I Think. Show how each routine deepens understanding and makes student thinking visible. Include documentation of thinking (e.g., on mini-whiteboards or shared doc).'
  },
  {
    id: 'pbl',
    name: 'Project-Based Learning',
    desc: 'Driving question, sustained inquiry, student voice & choice, public product.',
    prompt: 'Design a project-based learning lesson segment. Include: a driving question that is open-ended and authentic, clear learning goals aligned to curriculum, scaffolded inquiry process, student voice and choice in how they investigate and present, and a public product or presentation. This can be one session of a multi-session project.'
  },
  {
    id: 'direct',
    name: 'Direct Instruction (I Do, We Do, You Do)',
    desc: 'Explicit teaching with modelling, guided practice, and independent practice.',
    prompt: 'Design a direct instruction lesson using the I Do, We Do, You Do framework. Include: (1) Hook/motivation (2 min), (2) I Do — teacher models with think-aloud (10 min), (3) We Do — guided practice with checking for understanding (10 min), (4) You Do — independent practice with differentiation for struggling and advanced learners (15 min), (5) Plenary with exit ticket.'
  },
  {
    id: 'socratic',
    name: 'Socratic Seminar',
    desc: 'Student-led discussion using open-ended questions — builds critical thinking.',
    prompt: 'Design a Socratic Seminar lesson. Include: (1) Pre-seminar preparation (text, article, or artefact for students to read/analyse), (2) Opening question, (3) Core discussion questions (3-4 open-ended questions), (4) Closing question, (5) Post-seminar reflection. Include discussion norms, roles (inner/outer circle), and how to assess participation.'
  }
];

function showTemplateModal(container) {
  let templateModalRef = null;
  templateModalRef = openModal({
    title: 'Lesson Templates',
    body: `
      <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:var(--sp-4);">Choose a pedagogical structure. Co-Cher will use it as a starting prompt for your lesson.</p>
      <div style="display:flex;flex-direction:column;gap:var(--sp-3);">
        ${LESSON_TEMPLATES.map(t => `
          <div class="card card-hover card-interactive template-card" data-template="${t.id}" style="padding:var(--sp-3) var(--sp-4);cursor:pointer;">
            <div style="font-weight:600;color:var(--ink);font-size:0.875rem;">${t.name}</div>
            <div style="font-size:0.75rem;color:var(--ink-muted);margin-top:2px;">${t.desc}</div>
          </div>
        `).join('')}
      </div>
    `,
    onMount: (modal) => {
      modal.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
          const tId = card.dataset.template;
          const template = LESSON_TEMPLATES.find(t => t.id === tId);
          if (!template) return;
          if (templateModalRef?.close) templateModalRef.close();
          // Set the template prompt as the chat input
          const chatInput = container.querySelector('#chat-input');
          if (chatInput) {
            const cls = planClassContext;
            const classContext = cls ? ` This lesson is for ${cls.name} (${cls.subject || 'General'}, ${cls.level || 'Secondary'}).` : '';
            chatInput.value = template.prompt + classContext;
            chatInput.focus();
            showToast(`Template "${template.name}" loaded. Hit Send to start!`, 'success');
          }
        });
      });
    }
  });
}
