/*
 * Co-Cher State Management
 * ========================
 * Simple reactive store with localStorage persistence.
 */

import { trackEvent } from './utils/analytics.js';
import { idbSetContent, idbDeleteContent, idbGetAllContent, idbClearContent, idbGetAllFrom, idbRemove } from './utils/storage.js';
import { getSchemaForClass, getFieldValue } from './utils/tracking.js';
import { applyIdentity } from './utils/identity.js';

const STORAGE_KEY = 'cocher_app_data';

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ── Storage-failure banner ──
 * A failed save means the teacher's changes exist only in memory; that must
 * never be silent. Self-contained DOM (no component imports → no cycles). */
let _storageWarningShown = false;

function showStorageWarning() {
  if (_storageWarningShown || typeof document === 'undefined' || !document.body) return;
  _storageWarningShown = true;
  const el = document.createElement('div');
  el.id = 'storage-warning-banner';
  el.setAttribute('role', 'alert');
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b91c1c;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:0.8125rem;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
  el.innerHTML = `
    <span>&#9888;&#65039; Your changes are NOT being saved &mdash; browser storage is full. Export your data now (Settings &rarr; Data), then delete old uploads or clear sample data.</span>
    <a href="#/settings" style="color:#fff;text-decoration:underline;white-space:nowrap;">Open Settings</a>`;
  document.body.appendChild(el);
}

function clearStorageWarning() {
  if (!_storageWarningShown) return;
  _storageWarningShown = false;
  document.getElementById('storage-warning-banner')?.remove();
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    clearStorageWarning();
  } catch (e) {
    console.warn('Co-Cher: Failed to save to localStorage', e);
    showStorageWarning();
  }
}

/** Rough origin-wide localStorage usage vs the typical ~5MB budget. */
export function getStorageEstimate() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; // UTF-16
    }
  } catch { /* ignore */ }
  const limit = 5 * 1024 * 1024;
  return { bytes, limit, percent: Math.min(100, Math.round((bytes / limit) * 100)) };
}

/* ── Knowledge Base content lives in IndexedDB ──
 * Upload text is the main quota consumer; only metadata is persisted in the
 * localStorage snapshot. In-memory _state keeps `content` for sync reads.
 * An upload's content is stripped from the snapshot ONLY once IndexedDB has
 * confirmed the write — if IDB is unavailable, content stays in localStorage
 * exactly as before (no loss, just no quota relief). */
const _kbContentInIdb = new Set();

function syncKbContentToIdb(oldList, newList) {
  try {
    const newIds = new Set(newList.map(u => u.id));
    oldList.forEach(u => {
      if (u.id && !newIds.has(u.id)) {
        _kbContentInIdb.delete(u.id);
        idbDeleteContent(u.id).catch(() => {});
      }
    });
    newList.forEach(u => {
      if (u.id && typeof u.content === 'string' && u.content) {
        idbSetContent(u.id, u.content)
          .then(ok => { if (ok) { _kbContentInIdb.add(u.id); Store._persist(); } })
          .catch(() => {});
      }
    });
  } catch { /* non-fatal — content stays in memory this session */ }
}

/* ── References content lives in IndexedDB too ──
 * Same discipline as Knowledge Base uploads: the extracted `content` (which can
 * be large) is offloaded to IndexedDB and stripped from the localStorage
 * snapshot once the write is confirmed; only metadata + `summary` are persisted.
 * Reuses the shared kb_content store via idbSetContent/idbDeleteContent. */
const _refContentInIdb = new Set();

function syncRefContentToIdb(oldList, newList) {
  try {
    const newIds = new Set(newList.map(r => r.id));
    oldList.forEach(r => {
      if (r.id && !newIds.has(r.id)) {
        _refContentInIdb.delete(r.id);
        idbDeleteContent(r.id).catch(() => {});
      }
    });
    newList.forEach(r => {
      if (r.id && typeof r.content === 'string' && r.content) {
        idbSetContent(r.id, r.content)
          .then(ok => { if (ok) { _refContentInIdb.add(r.id); Store._persist(); } })
          .catch(() => {});
      }
    });
  } catch { /* non-fatal — content stays in memory this session */ }
}

/* ── Built-in pedagogy frameworks (WS-D) ──
 * Stage structure + wording lifted faithfully from the previously hardcoded
 * AaL cards in views/assessment.js (GROW by Reflecting / ACT on Feedback).
 * Fixed ids make boot seeding idempotent and let shared lessons reference
 * builtins across installs. Purposes: feedback | metacognition | questioning | custom. */
export const FRAMEWORK_PURPOSES = ['feedback', 'metacognition', 'questioning', 'custom'];

const BUILTIN_FRAMEWORKS = [
  {
    id: 'fw_builtin_grow',
    name: 'GROW by Reflecting',
    purpose: 'metacognition',
    builtin: true,
    guidance: 'The GROW by Reflecting routine empowers students to become proactive, self-reflective learners. Each stage guides personal reflection: celebrating success, planning improvement, owning knowledge, and looking ahead.',
    stages: [
      { key: 'G', label: 'Gift yourself success',
        prompt: 'Celebrate what you DO understand. "What is one thing I understand? How would I teach this to a friend?"',
        studentPrompt: 'What is one thing I understand?' },
      { key: 'R', label: 'Rise above with small steps',
        prompt: 'Identify gaps and plan improvement. "What do I not yet understand? What will I do to improve?"',
        studentPrompt: 'What do I not yet understand?' },
      { key: 'O', label: 'Own your knowledge',
        prompt: 'Connect learning to real life and share it. "What is one real-life example? How have I shared this?"',
        studentPrompt: 'What is one real-life example?' },
      { key: 'W', label: 'Watch for what comes next',
        prompt: 'Look ahead and prepare. "What do I already know about the next topic? What is coming up?"',
        studentPrompt: 'What do I already know about the next topic?' }
    ]
  },
  {
    id: 'fw_builtin_act',
    name: 'ACT on Feedback',
    purpose: 'feedback',
    builtin: true,
    guidance: 'A learner-centred framework for acting on feedback received. ACT teaches students to treat feedback as a growth tool rather than a judgement, moving from passive receipt to active response.',
    stages: [
      { key: 'A', label: 'Acknowledge',
        prompt: '"How do I feel about this feedback? How might it help me learn better?"',
        studentPrompt: 'How do I feel about this feedback?' },
      { key: 'C', label: 'Connect',
        prompt: '"How does this connect with success criteria/my goals? How does this connect with previous feedback?"',
        studentPrompt: 'How does this connect with the success criteria or my goals?' },
      { key: 'T', label: 'Test',
        prompt: '"What habit do I need to adjust? How will I know I am improving?"',
        studentPrompt: 'What habit do I need to adjust?' }
    ]
  }
];

/** Fresh copies of the builtin frameworks (seed + clearAllData reseed). */
function builtinFrameworkSeeds() {
  return BUILTIN_FRAMEWORKS.map(b => ({
    ...b,
    stages: b.stages.map(s => ({ ...s })),
    createdAt: Date.now()
  }));
}

const DEFAULT_STATE = {
  apiKey: localStorage.getItem('cocher_api_key') || '',
  model: localStorage.getItem('cocher_model') || 'gemini-2.5-flash',
  darkMode: localStorage.getItem('cocher_dark_mode') === 'true',
  palette: localStorage.getItem('cocher_palette') || '',
  schoolProfile: { name: '', values: '' },
  classes: [],
  lessons: [],
  chatHistory: [],
  recentActivity: [],
  assessmentRoutines: [],
  savedTOS: [],
  assessmentChecklists: [],
  knowledgeUploads: [],
  pdFolders: [],
  stimulusLibrary: [],
  sourceLibrary: [],
  departmentSchemes: [],
  assessmentBlueprints: [],
  assessmentArtifacts: [],
  practiceLog: [],
  practiceGoal: null,
  trackingSchemas: [],
  frameworks: [],
  references: [],
  onboardingComplete: false
};

const _state = Object.assign({}, DEFAULT_STATE, loadFromStorage());
const _listeners = new Set();

// Migrate old API key storage
if (!_state.apiKey && localStorage.getItem('cocher_api_key')) {
  _state.apiKey = localStorage.getItem('cocher_api_key');
}

// Migrate legacy localStorage libraries into Store on first load
(function migrateLegacyLibraries() {
  let dirty = false;
  if (!_state.stimulusLibrary?.length) {
    try {
      const raw = localStorage.getItem('cocher_stimulus_library');
      if (raw) { _state.stimulusLibrary = JSON.parse(raw); dirty = true; }
    } catch {}
  }
  if (!_state.sourceLibrary?.length) {
    try {
      const raw = localStorage.getItem('cocher_source_library');
      if (raw) { _state.sourceLibrary = JSON.parse(raw); dirty = true; }
    } catch {}
  }
  if (dirty) saveToStorage({ ..._state });
})();

// Migrate old E21CC format — handles both legacy cait/cci/cgc keys AND numeric 0-100 scores → rubric levels
(function migrateE21CCScores() {
  const classes = _state.classes || [];
  let migrated = false;
  const numToLevel = (v) => {
    if (typeof v === 'string') return v; // already migrated
    if (v <= 25) return 'developing';
    if (v <= 50) return 'applying';
    if (v <= 75) return 'extending';
    return 'leading';
  };
  const DIMS = ['criticalThinking','creativeThinking','communication','collaboration','socialConnectedness','selfRegulation'];
  classes.forEach(cls => {
    (cls.students || []).forEach(s => {
      if (!s.e21cc) return;
      // Step 1: migrate legacy cait/cci/cgc keys to 6-dimension format
      if (('cait' in s.e21cc) && !('criticalThinking' in s.e21cc)) {
        const old = s.e21cc;
        s.e21cc = {
          criticalThinking: old.cait || 50,
          creativeThinking: old.cait || 50,
          communication: old.cci || 50,
          collaboration: old.cci || 50,
          socialConnectedness: old.cgc || 50,
          selfRegulation: 50
        };
        migrated = true;
      }
      // Step 2: migrate numeric scores to rubric levels
      const needsLevelMigration = DIMS.some(k => typeof s.e21cc[k] === 'number');
      if (needsLevelMigration) {
        DIMS.forEach(k => { s.e21cc[k] = numToLevel(s.e21cc[k] ?? 50); });
        migrated = true;
      }
      // Step 3: migrate numeric e21ccHistory entries to levels
      if (s.e21ccHistory) {
        s.e21ccHistory = s.e21ccHistory.map(h => {
          const entry = { ...h };
          DIMS.forEach(k => { if (typeof entry[k] === 'number') entry[k] = numToLevel(entry[k]); });
          return entry;
        });
      }
    });
  });
  if (migrated) {
    saveToStorage({ ..._state });
  }
})();

/* ── E21CC dimensions & rubric levels (string values) ──
 * Shared by the Class Portrait synthesis below; keep in sync with the
 * migration IIFE above and the dim metadata in views/classes.js. */
const E21CC_DIM_LABELS = {
  criticalThinking: 'Critical Thinking',
  creativeThinking: 'Creative Thinking',
  communication: 'Communication',
  collaboration: 'Collaboration',
  socialConnectedness: 'Social Connectedness',
  selfRegulation: 'Self-Regulation'
};
const E21CC_DIM_KEYS = Object.keys(E21CC_DIM_LABELS);
const E21CC_LEVEL_KEYS = ['developing', 'applying', 'extending', 'leading'];

export const Store = {
  /* ── Read ── */
  get(key) {
    return _state[key];
  },

  getAll() {
    return { ..._state };
  },

  /* ── Write ── */
  set(key, value) {
    if (key === 'knowledgeUploads') {
      syncKbContentToIdb(_state.knowledgeUploads || [], value || []);
    }
    _state[key] = value;
    this._persist();
    this._notify();
  },

  /* ── Subscribe ── */
  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  _notify() {
    _listeners.forEach(fn => fn({ ..._state }));
  },

  _persist() {
    saveToStorage({
      apiKey: _state.apiKey,
      model: _state.model,
      darkMode: _state.darkMode,
      palette: _state.palette || '',
      classes: _state.classes,
      lessons: _state.lessons,
      savedLayouts: _state.savedLayouts || [],
      adminEvents: _state.adminEvents || [],
      // Upload content lives in IndexedDB — persist metadata only for
      // uploads whose content is confirmed written there
      knowledgeUploads: (_state.knowledgeUploads || []).map(u => {
        if (!_kbContentInIdb.has(u.id)) return u;
        const { content, ...meta } = u;
        return meta;
      }),
      pdFolders: _state.pdFolders || [],
      assessmentRoutines: _state.assessmentRoutines || [],
      savedTOS: _state.savedTOS || [],
      assessmentChecklists: _state.assessmentChecklists || [],
      stimulusLibrary: _state.stimulusLibrary || [],
      sourceLibrary: _state.sourceLibrary || [],
      departmentSchemes: _state.departmentSchemes || [],
      assessmentBlueprints: _state.assessmentBlueprints || [],
      assessmentArtifacts: _state.assessmentArtifacts || [],
      practiceLog: _state.practiceLog || [],
      practiceGoal: _state.practiceGoal || null,
      trackingSchemas: _state.trackingSchemas || [],
      frameworks: _state.frameworks || [],
      // Reference content lives in IndexedDB — persist metadata + summary only
      // once the content write is confirmed there.
      references: (_state.references || []).map(r => {
        if (!_refContentInIdb.has(r.id)) return r;
        const { content, ...meta } = r;
        return meta;
      }),
      schoolProfile: _state.schoolProfile || { name: '', values: '' },
      onboardingComplete: _state.onboardingComplete || false,
      apiKeyDeferred: _state.apiKeyDeferred || false,
      recentActivity: _state.recentActivity
    });
    // Also keep legacy keys in sync
    localStorage.setItem('cocher_api_key', _state.apiKey || '');
    localStorage.setItem('cocher_model', _state.model || 'gemini-2.5-flash');
    localStorage.setItem('cocher_dark_mode', _state.darkMode ? 'true' : 'false');
    localStorage.setItem('cocher_palette', _state.palette || '');
  },

  /* ══════════ School Profile ══════════ */

  getSchoolProfile() {
    return _state.schoolProfile || { name: '', values: '' };
  },

  setSchoolProfile(profile) {
    _state.schoolProfile = profile;
    this._persist();
    this._notify();
  },

  /* ══════════ Classes CRUD ══════════ */

  getClasses() {
    return _state.classes || [];
  },

  getClass(id) {
    return (_state.classes || []).find(c => c.id === id) || null;
  },

  addClass(data) {
    const cls = {
      id: generateId(),
      name: data.name || 'Untitled Class',
      level: data.level || '',
      subject: data.subject || '',
      students: [],
      notes: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    _state.classes = [...(_state.classes || []), cls];
    this._addActivity('class_created', `Created class "${cls.name}"`);
    this._persist();
    this._notify();
    return cls;
  },

  updateClass(id, data) {
    _state.classes = (_state.classes || []).map(c =>
      c.id === id ? { ...c, ...data, updatedAt: Date.now() } : c
    );
    this._persist();
    this._notify();
  },

  deleteClass(id) {
    const cls = this.getClass(id);
    _state.classes = (_state.classes || []).filter(c => c.id !== id);
    if (cls) this._addActivity('class_deleted', `Deleted class "${cls.name}"`);
    this._persist();
    this._notify();
  },

  /* ══════════ Students ══════════ */

  addStudent(classId, data) {
    const student = {
      id: generateId(),
      name: data.name || 'Student',
      e21cc: {
        criticalThinking: 'developing',
        creativeThinking: 'developing',
        communication: 'developing',
        collaboration: 'developing',
        socialConnectedness: 'developing',
        selfRegulation: 'developing',
        ...(data.e21cc || {})
      },
      observations: data.observations || [],
      createdAt: Date.now()
    };
    this.updateClass(classId, {
      students: [...(this.getClass(classId)?.students || []), student]
    });
    this._addActivity('student_added', `Added "${student.name}" to class`);
    return student;
  },

  updateStudent(classId, studentId, data) {
    const cls = this.getClass(classId);
    if (!cls) return;
    const students = cls.students.map(s => {
      if (s.id !== studentId) return s;
      const updated = { ...s, ...data };
      // Record E21CC history when levels change
      if (data.e21cc) {
        const history = [...(s.e21ccHistory || [])];
        history.push({ ts: Date.now(), ...data.e21cc });
        if (history.length > 20) history.splice(0, history.length - 20);
        updated.e21ccHistory = history;
      }
      // Append observations if provided
      if (data.observations) {
        updated.observations = [...(s.observations || []), ...data.observations];
      }
      return updated;
    });
    this.updateClass(classId, { students });
  },

  removeStudent(classId, studentId) {
    const cls = this.getClass(classId);
    if (!cls) return;
    this.updateClass(classId, {
      students: cls.students.filter(s => s.id !== studentId)
    });
  },

  /* ══════════ Class Notes ══════════ */

  addNote(classId, text) {
    const note = {
      id: generateId(),
      text,
      summary: null,
      createdAt: Date.now()
    };
    const cls = this.getClass(classId);
    if (!cls) return null;
    this.updateClass(classId, {
      notes: [note, ...(cls.notes || [])]
    });
    return note;
  },

  updateNote(classId, noteId, data) {
    const cls = this.getClass(classId);
    if (!cls) return;
    const notes = (cls.notes || []).map(n =>
      n.id === noteId ? { ...n, ...data } : n
    );
    this.updateClass(classId, { notes });
  },

  deleteNote(classId, noteId) {
    const cls = this.getClass(classId);
    if (!cls) return;
    this.updateClass(classId, {
      notes: (cls.notes || []).filter(n => n.id !== noteId)
    });
  },

  /* ══════════ Class Portrait ══════════ */

  /**
   * Synthesize a learner-centric portrait of a class: E21CC level
   * distribution, weakest/strongest dimensions, recent observations,
   * recent lesson reflections and the engagement trend. Returns null
   * when the class doesn't exist.
   */
  getClassPortrait(classId) {
    const cls = this.getClass(classId);
    if (!cls) return null;
    const students = cls.students || [];

    // Resolve the class's tracking schema (unset ⇒ e21cc, the default).
    const schema = getSchemaForClass(cls, this.getTrackingSchemas());
    const isE21cc = schema.id === 'e21cc';

    // Per-field counts of each level across students. For E21CC this reproduces
    // the exact original computation (regression-safe); other schemas use the
    // shared tracking accessors.
    const distribution = {};
    schema.fields.forEach(field => {
      const counts = {};
      (field.levels || []).forEach(lv => { counts[lv.key] = 0; });
      students.forEach(s => {
        const lv = isE21cc
          ? (E21CC_LEVEL_KEYS.includes(s.e21cc?.[field.key]) ? s.e21cc[field.key] : (field.levels?.[0]?.key))
          : getFieldValue(s, schema, field);
        if (counts[lv] === undefined) counts[lv] = 0;
        counts[lv]++;
      });
      distribution[field.key] = counts;
    });

    let weakestFields, strongestFields;
    if (isE21cc) {
      // Original E21CC ranking: weakest by 'developing' count, strongest by leading+extending.
      weakestFields = [...E21CC_DIM_KEYS]
        .sort((a, b) => distribution[b].developing - distribution[a].developing)
        .slice(0, 2);
      strongestFields = [...E21CC_DIM_KEYS]
        .sort((a, b) =>
          (distribution[b].leading + distribution[b].extending) -
          (distribution[a].leading + distribution[a].extending))
        .slice(0, 2);
    } else {
      // Generic ranking by mean level value across the class.
      const meanVal = (field) => {
        const counts = distribution[field.key]; let sum = 0, n = 0;
        (field.levels || []).forEach(lv => { const c = counts[lv.key] || 0; sum += lv.value * c; n += c; });
        return n ? sum / n : 0;
      };
      const byMeanAsc = [...schema.fields].sort((a, b) => meanVal(a) - meanVal(b));
      weakestFields = byMeanAsc.slice(0, 2).map(f => f.key);
      strongestFields = [...byMeanAsc].reverse().slice(0, 2).map(f => f.key);
    }
    // Back-compat aliases for not-yet-schema-aware readers (all classes are e21cc today).
    const e21ccDistribution = isE21cc ? distribution : {};
    const weakestDims = isE21cc ? weakestFields : [];
    const strongestDims = isE21cc ? strongestFields : [];

    // Last 5 observation texts across students, newest first
    // (observation shape: { id, text, tags, ts })
    const recentObservations = students
      .flatMap(s => (s.observations || []).map(o => ({ ts: o.ts || 0, text: o.text || '' })))
      .filter(o => o.text)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5)
      .map(o => o.text);

    // Lesson reflections for this class, newest first. Legacy string
    // reflections are normalized into the freeform field.
    const reflected = this.getLessonsForClass(classId)
      .map((l, idx) => {
        const raw = l.reflection;
        if (!raw) return null;
        const ref = typeof raw === 'string'
          ? { whatWorked: '', whatToAdjust: '', engagement: 0, e21ccObservations: '', freeform: raw }
          : raw;
        const hasContent = ['whatWorked', 'whatToAdjust', 'e21ccObservations', 'freeform']
          .some(k => String(ref[k] || '').trim()) || (ref.engagement || 0) > 0;
        return hasContent ? { lesson: l, ref, idx } : null;
      })
      .filter(Boolean)
      // Newest first; break same-millisecond ties by insertion order
      .sort((a, b) => ((b.lesson.updatedAt || 0) - (a.lesson.updatedAt || 0)) || (b.idx - a.idx));

    const recentReflections = reflected.slice(0, 3).map(({ lesson, ref }) => ({
      lessonTitle: lesson.title || 'Untitled Lesson',
      whatWorked: ref.whatWorked || '',
      whatToAdjust: ref.whatToAdjust || '',
      engagement: ref.engagement || 0
    }));

    // Engagement trend: avg of the last 3 rated reflections vs the previous 3
    const rated = reflected.filter(x => (x.ref.engagement || 0) > 0);
    let engagementTrend = null;
    const previous = rated.slice(3, 6);
    if (previous.length > 0) {
      const avg = arr => arr.reduce((sum, x) => sum + x.ref.engagement, 0) / arr.length;
      const diff = avg(rated.slice(0, 3)) - avg(previous);
      engagementTrend = diff >= 0.5 ? 'rising' : diff <= -0.5 ? 'dipping' : 'steady';
    }

    return {
      className: cls.name || '',
      subject: cls.subject || '',
      level: cls.level || '',
      studentCount: students.length,
      // Schema-aware fields (new readers use these)
      schemaId: schema.id,
      schema,
      distribution,
      weakestFields,
      strongestFields,
      // Back-compat aliases (populated only for e21cc — the default)
      e21ccDistribution,
      weakestDims,
      strongestDims,
      recentObservations,
      recentReflections,
      engagementTrend
    };
  },

  /**
   * Render the class portrait as a compact plain-text block (<= ~180 words)
   * for injection into an AI system prompt. Returns '' when classId is
   * missing or the class doesn't exist.
   */
  getPortraitPromptText(classId) {
    if (!classId) return '';
    const p = this.getClassPortrait(classId);
    if (!p) return '';
    const short = t => {
      const s = String(t).replace(/\s+/g, ' ').trim();
      return s.length > 70 ? s.slice(0, 70) + '…' : s;
    };
    const lines = [];
    const detail = [p.level, p.subject].filter(Boolean).join(', ');
    lines.push(`CLASS PORTRAIT — ${p.className}${detail ? ` (${detail})` : ''}, ${p.studentCount} student${p.studentCount === 1 ? '' : 's'}.`);
    if (p.studentCount > 0) {
      if (p.schemaId === 'e21cc') {
        lines.push('E21CC levels (Co-Cher\'s six tracked dimensions; developing/applying/extending/leading): ' +
          E21CC_DIM_KEYS.map(k => {
            const c = p.e21ccDistribution[k];
            return `${E21CC_DIM_LABELS[k]} ${c.developing}/${c.applying}/${c.extending}/${c.leading}`;
          }).join('; ') + '.');
        lines.push(`Weakest: ${p.weakestDims.map(k => E21CC_DIM_LABELS[k]).join(', ')}. Strongest: ${p.strongestDims.map(k => E21CC_DIM_LABELS[k]).join(', ')}.`);
      } else {
        // Generic schema-labelled distribution (e.g. "Tracked (RAG): Understanding red/amber/green counts").
        const fieldLabel = (key) => (p.schema.fields.find(f => f.key === key) || {}).label || key;
        const levels = p.schema.fields[0]?.levels || [];
        const levelOrder = levels.map(l => l.key);
        const levelHdr = levels.map(l => l.label).join('/');
        lines.push(`Tracked — ${p.schema.name}${levelHdr ? ` (${levelHdr})` : ''}: ` +
          p.schema.fields.map(f => {
            const c = p.distribution[f.key] || {};
            const fLevels = (f.levels || []).map(l => l.key);
            const order = fLevels.length ? fLevels : levelOrder;
            return `${f.label} ${order.map(k => c[k] || 0).join('/')}`;
          }).join('; ') + '.');
        lines.push(`Weakest: ${p.weakestFields.map(fieldLabel).join(', ')}. Strongest: ${p.strongestFields.map(fieldLabel).join(', ')}.`);
      }
    }
    if (p.engagementTrend) lines.push(`Engagement trend across recent lessons: ${p.engagementTrend}.`);
    if (p.recentObservations.length) {
      lines.push('Recent observations: ' + p.recentObservations.map(short).join(' | '));
    }
    if (p.recentReflections.length) {
      lines.push('Recent lesson reflections: ' + p.recentReflections.map(r => {
        const bits = [];
        if (r.whatWorked) bits.push(`worked: ${short(r.whatWorked)}`);
        if (r.whatToAdjust) bits.push(`adjust: ${short(r.whatToAdjust)}`);
        if (r.engagement) bits.push(`engagement ${r.engagement}/5`);
        return `"${short(r.lessonTitle)}"${bits.length ? ` (${bits.join('; ')})` : ''}`;
      }).join(' | '));
    }
    return lines.join('\n');
  },

  /* ══════════ Lessons CRUD ══════════ */

  getLessons() {
    return _state.lessons || [];
  },

  getLesson(id) {
    return (_state.lessons || []).find(l => l.id === id) || null;
  },

  getLessonsForClass(classId) {
    return (_state.lessons || []).filter(l => l.classId === classId);
  },

  addLesson(data) {
    const lesson = {
      id: generateId(),
      title: data.title || 'Untitled Lesson',
      classId: data.classId || null,
      status: 'draft',
      chatHistory: data.chatHistory || [],
      plan: data.plan || '',
      spatialLayout: data.spatialLayout || null,
      objectives: data.objectives || '',
      lessonHook: data.lessonHook || '',
      e21ccFocus: data.e21ccFocus || [],
      attachedResources: data.attachedResources || [],
      components: data.components || {},
      runOfShow: data.runOfShow || null,
      reflection: data.reflection || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    _state.lessons = [...(_state.lessons || []), lesson];
    this._addActivity('lesson_created', `Created lesson "${lesson.title}"`);
    this._persist();
    this._notify();
    return lesson;
  },

  updateLesson(id, data) {
    _state.lessons = (_state.lessons || []).map(l =>
      l.id === id ? { ...l, ...data, updatedAt: Date.now() } : l
    );
    // A saved reflection also feeds the teacher's practice log
    if (data.reflection && typeof data.reflection === 'object' && !Array.isArray(data.reflection)) {
      const r = data.reflection;
      const hasText = ['whatWorked', 'whatToAdjust', 'e21ccObservations', 'freeform']
        .some(k => String(r[k] || '').trim());
      if (hasText) {
        const lesson = (_state.lessons || []).find(l => l.id === id);
        const lessonTitle = lesson?.title || 'Untitled Lesson';
        // Dedupe: skip if the last entry is the same lesson's reflection
        // saved within the past 5 minutes (e.g. repeated "Save Reflection")
        const log = _state.practiceLog || [];
        const last = log[log.length - 1];
        const isRecentDupe = last && last.source === 'reflection' &&
          last.lessonTitle === lessonTitle && (Date.now() - last.createdAt) < 5 * 60 * 1000;
        if (!isRecentDupe) {
          const parts = [];
          if (String(r.whatWorked || '').trim()) parts.push(`Worked: ${String(r.whatWorked).trim()}`);
          if (String(r.whatToAdjust || '').trim()) parts.push(`Adjust: ${String(r.whatToAdjust).trim()}`);
          const text = parts.join(' — ') || String(r.freeform || r.e21ccObservations || '').trim();
          this.addPracticeEntry({ source: 'reflection', lessonTitle, classId: lesson?.classId || null, text });
        }
      }
    }
    this._persist();
    this._notify();
  },

  deleteLesson(id) {
    const lesson = this.getLesson(id);
    _state.lessons = (_state.lessons || []).filter(l => l.id !== id);
    if (lesson) this._addActivity('lesson_deleted', `Deleted lesson "${lesson.title}"`);
    this._persist();
    this._notify();
  },

  /** Re-insert a previously deleted lesson (undo). Keeps its original id. */
  restoreLesson(lesson) {
    if (!lesson || !lesson.id) return;
    if ((_state.lessons || []).some(l => l.id === lesson.id)) return;
    _state.lessons = [...(_state.lessons || []), lesson];
    this._persist();
    this._notify();
  },

  /* ══════════ Spatial Layouts ══════════ */

  getSavedLayouts() {
    return _state.savedLayouts || [];
  },

  saveLayout(data) {
    const layout = {
      id: generateId(),
      name: data.name || 'Untitled Layout',
      items: data.items || [],
      preset: data.preset || null,
      venue: data.venue || 'classroom',
      wallState: data.wallState || 'closed',
      studentCount: data.studentCount || 30,
      scenes: data.scenes || [],
      createdAt: Date.now()
    };
    _state.savedLayouts = [...(_state.savedLayouts || []), layout];
    this._addActivity('layout_saved', `Saved layout "${layout.name}"`);
    this._persist();
    this._notify();
    return layout;
  },

  deleteLayout(id) {
    _state.savedLayouts = (_state.savedLayouts || []).filter(l => l.id !== id);
    this._persist();
    this._notify();
  },

  /* ══════════ Assessment Routines CRUD ══════════ */

  getRoutines() {
    return _state.assessmentRoutines || [];
  },

  getRoutine(id) {
    return (_state.assessmentRoutines || []).find(r => r.id === id) || null;
  },

  addRoutine(data) {
    const routine = {
      id: generateId(),
      name: data.name || 'Untitled Routine',
      description: data.description || '',
      isBuiltIn: data.isBuiltIn || false,
      steps: data.steps || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    _state.assessmentRoutines = [...(_state.assessmentRoutines || []), routine];
    this._addActivity('routine_created', `Created routine "${routine.name}"`);
    this._persist();
    this._notify();
    return routine;
  },

  updateRoutine(id, data) {
    _state.assessmentRoutines = (_state.assessmentRoutines || []).map(r =>
      r.id === id ? { ...r, ...data, updatedAt: Date.now() } : r
    );
    this._persist();
    this._notify();
  },

  deleteRoutine(id) {
    _state.assessmentRoutines = (_state.assessmentRoutines || []).filter(r => r.id !== id);
    this._persist();
    this._notify();
  },

  /* ══════════ Saved TOS CRUD ══════════ */

  getSavedTOS() {
    return _state.savedTOS || [];
  },

  addSavedTOS(data) {
    const tos = {
      id: generateId(),
      name: data.name || 'Untitled TOS',
      mode: data.mode || '1d',
      objectives: data.objectives || [],
      totalMarks: data.totalMarks || 50,
      cells: data.cells || {},
      createdAt: Date.now()
    };
    _state.savedTOS = [...(_state.savedTOS || []), tos];
    this._addActivity('tos_saved', `Saved TOS "${tos.name}"`);
    this._persist();
    this._notify();
    return tos;
  },

  deleteSavedTOS(id) {
    _state.savedTOS = (_state.savedTOS || []).filter(t => t.id !== id);
    this._persist();
    this._notify();
  },

  /* ══════════ Assessment Checklists CRUD ══════════ */

  getChecklists() {
    return _state.assessmentChecklists || [];
  },

  addChecklist(data) {
    const cl = {
      id: generateId(),
      name: data.name || 'Untitled Checklist',
      type: data.type || 'observation',
      subject: data.subject || '',
      criteria: data.criteria || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    _state.assessmentChecklists = [...(_state.assessmentChecklists || []), cl];
    this._addActivity('checklist_created', `Created checklist "${cl.name}"`);
    this._persist();
    this._notify();
    return cl;
  },

  updateChecklist(id, data) {
    _state.assessmentChecklists = (_state.assessmentChecklists || []).map(c =>
      c.id === id ? { ...c, ...data, updatedAt: Date.now() } : c
    );
    this._persist();
    this._notify();
  },

  deleteChecklist(id) {
    _state.assessmentChecklists = (_state.assessmentChecklists || []).filter(c => c.id !== id);
    this._persist();
    this._notify();
  },

  /* ══════════ Stimulus Library ══════════ */

  getStimulusLibrary() {
    return _state.stimulusLibrary || [];
  },

  addStimulusMaterial(data) {
    _state.stimulusLibrary = [data, ...(_state.stimulusLibrary || [])];
    // Sync to legacy key for backwards compat
    localStorage.setItem('cocher_stimulus_library', JSON.stringify(_state.stimulusLibrary));
    this._addActivity('stimulus_created', `Added stimulus material "${data.title}"`);
    this._persist();
    this._notify();
  },

  updateStimulusMaterial(id, data) {
    _state.stimulusLibrary = (_state.stimulusLibrary || []).map(s =>
      s.id === id ? { ...s, ...data, updatedAt: Date.now() } : s
    );
    localStorage.setItem('cocher_stimulus_library', JSON.stringify(_state.stimulusLibrary));
    this._persist();
    this._notify();
  },

  deleteStimulusMaterial(id) {
    _state.stimulusLibrary = (_state.stimulusLibrary || []).filter(s => s.id !== id);
    localStorage.setItem('cocher_stimulus_library', JSON.stringify(_state.stimulusLibrary));
    this._persist();
    this._notify();
  },

  /* ══════════ Source Analysis Library ══════════ */

  getSourceLibrary() {
    return _state.sourceLibrary || [];
  },

  addSourceAnalysis(data) {
    _state.sourceLibrary = [data, ...(_state.sourceLibrary || [])];
    localStorage.setItem('cocher_source_library', JSON.stringify(_state.sourceLibrary));
    this._addActivity('source_created', `Added source analysis "${data.title}"`);
    this._persist();
    this._notify();
  },

  updateSourceAnalysis(id, data) {
    _state.sourceLibrary = (_state.sourceLibrary || []).map(s =>
      s.id === id ? { ...s, ...data } : s
    );
    localStorage.setItem('cocher_source_library', JSON.stringify(_state.sourceLibrary));
    this._persist();
    this._notify();
  },

  deleteSourceAnalysis(id) {
    _state.sourceLibrary = (_state.sourceLibrary || []).filter(s => s.id !== id);
    localStorage.setItem('cocher_source_library', JSON.stringify(_state.sourceLibrary));
    this._persist();
    this._notify();
  },

  /* ══════════ Department Schemes ══════════ */

  getDepartmentSchemes() {
    return _state.departmentSchemes || [];
  },

  addDepartmentScheme(data) {
    const scheme = {
      id: generateId(),
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    _state.departmentSchemes = [...(_state.departmentSchemes || []), scheme];
    this._addActivity('scheme_created', `Created scheme "${scheme.name}"`);
    this._persist();
    this._notify();
    return scheme;
  },

  updateDepartmentScheme(id, data) {
    _state.departmentSchemes = (_state.departmentSchemes || []).map(s =>
      s.id === id ? { ...s, ...data, updatedAt: Date.now() } : s
    );
    this._persist();
    this._notify();
  },

  deleteDepartmentScheme(id) {
    _state.departmentSchemes = (_state.departmentSchemes || []).filter(s => s.id !== id);
    this._persist();
    this._notify();
  },

  /* ══════════ Assessment Blueprints ══════════ */

  getAssessmentBlueprints() {
    return _state.assessmentBlueprints || [];
  },

  addAssessmentBlueprint(data) {
    const bp = {
      id: generateId(),
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    _state.assessmentBlueprints = [...(_state.assessmentBlueprints || []), bp];
    this._addActivity('blueprint_created', `Created assessment blueprint "${bp.title}"`);
    this._persist();
    this._notify();
    return bp;
  },

  updateAssessmentBlueprint(id, data) {
    _state.assessmentBlueprints = (_state.assessmentBlueprints || []).map(b =>
      b.id === id ? { ...b, ...data, updatedAt: Date.now() } : b
    );
    this._persist();
    this._notify();
  },

  deleteAssessmentBlueprint(id) {
    _state.assessmentBlueprints = (_state.assessmentBlueprints || []).filter(b => b.id !== id);
    this._persist();
    this._notify();
  },

  /* ══════════ Practice Log (Teacher Growth Engine) ══════════ */

  addPracticeEntry(data) {
    const entry = {
      id: generateId(),
      source: data.source || 'capture',
      lessonTitle: data.lessonTitle || '',
      classId: data.classId || null,
      text: data.text || '',
      createdAt: Date.now()
    };
    _state.practiceLog = [...(_state.practiceLog || []), entry];
    this._persist();
    this._notify();
    return entry;
  },

  getPracticeLog() {
    return _state.practiceLog || [];
  },

  /* ── Active practice goal — { text, focus, createdAt } | null ── */

  getPracticeGoal() {
    return _state.practiceGoal || null;
  },

  setPracticeGoal(goal) {
    _state.practiceGoal = goal || null;
    this._persist();
    this._notify();
  },

  /* ══════════ Tracking schemas (custom, teacher-level) ══════════ */

  getTrackingSchemas() {
    return _state.trackingSchemas || [];
  },

  addTrackingSchema(schema) {
    const entry = { id: generateId(), name: schema.name || 'Custom', fields: schema.fields || [], createdAt: Date.now() };
    _state.trackingSchemas = [...(_state.trackingSchemas || []), entry];
    this._persist();
    this._notify();
    return entry;
  },

  updateTrackingSchema(id, patch) {
    _state.trackingSchemas = (_state.trackingSchemas || []).map(s => s.id === id ? { ...s, ...patch } : s);
    this._persist();
    this._notify();
  },

  deleteTrackingSchema(id) {
    _state.trackingSchemas = (_state.trackingSchemas || []).filter(s => s.id !== id);
    this._persist();
    this._notify();
  },

  /* ══════════ Pedagogy Frameworks (registry, teacher-level) ══════════ */

  getFrameworks() {
    return _state.frameworks || [];
  },

  getFramework(id) {
    return (_state.frameworks || []).find(f => f.id === id) || null;
  },

  addFramework(data) {
    const fw = {
      id: data.id || generateId(),
      name: data.name || 'Untitled Framework',
      purpose: FRAMEWORK_PURPOSES.includes(data.purpose) ? data.purpose : 'custom',
      stages: Array.isArray(data.stages) ? data.stages : [],
      guidance: data.guidance || '',
      ...(data.builtin ? { builtin: true } : {}),
      createdAt: Date.now()
    };
    _state.frameworks = [...(_state.frameworks || []), fw];
    this._persist();
    this._notify();
    return fw;
  },

  updateFramework(id, patch) {
    _state.frameworks = (_state.frameworks || []).map(f => f.id === id ? { ...f, ...patch } : f);
    this._persist();
    this._notify();
  },

  /** Builtins cannot be deleted — returns false and leaves state untouched. */
  deleteFramework(id) {
    const fw = (_state.frameworks || []).find(f => f.id === id);
    if (!fw || fw.builtin) return false;
    _state.frameworks = (_state.frameworks || []).filter(f => f.id !== id);
    this._persist();
    this._notify();
    return true;
  },

  /* ══════════ Assessment Artifacts (saved AaL framework outputs) ══════════ */

  getAssessmentArtifacts() {
    return _state.assessmentArtifacts || [];
  },

  addAssessmentArtifact(data) {
    const art = {
      id: generateId(),
      frameworkId: data.frameworkId || null,
      title: data.title || 'Untitled Output',
      content: data.content || '',
      createdAt: Date.now()
    };
    _state.assessmentArtifacts = [...(_state.assessmentArtifacts || []), art];
    this._persist();
    this._notify();
    return art;
  },

  updateAssessmentArtifact(id, patch) {
    _state.assessmentArtifacts = (_state.assessmentArtifacts || []).map(a =>
      a.id === id ? { ...a, ...patch } : a
    );
    this._persist();
    this._notify();
  },

  deleteAssessmentArtifact(id) {
    _state.assessmentArtifacts = (_state.assessmentArtifacts || []).filter(a => a.id !== id);
    this._persist();
    this._notify();
  },

  /* ══════════ References (teacher's reusable AI reference docs) ══════════ */

  getReferences() {
    return _state.references || [];
  },

  addReference(ref) {
    const entry = {
      id: generateId(),
      name: ref.name || 'Reference',
      source: ref.source || {},
      summary: ref.summary || '',
      content: ref.content || '',
      contentLength: (ref.content || '').length,
      createdAt: Date.now()
    };
    const old = _state.references || [];
    _state.references = [...old, entry];
    syncRefContentToIdb(old, _state.references);
    this._persist();
    this._notify();
    return entry;
  },

  updateReference(id, patch) {
    const old = _state.references || [];
    _state.references = old.map(r => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
      if (typeof patch.content === 'string') next.contentLength = patch.content.length;
      return next;
    });
    syncRefContentToIdb(old, _state.references);
    this._persist();
    this._notify();
  },

  deleteReference(id) {
    const old = _state.references || [];
    _state.references = old.filter(r => r.id !== id);
    syncRefContentToIdb(old, _state.references);
    this._persist();
    this._notify();
  },

  /* ══════════ Activity Feed ══════════ */

  _addActivity(type, description) {
    const activity = { id: generateId(), type, description, timestamp: Date.now() };
    _state.recentActivity = [activity, ...(_state.recentActivity || [])].slice(0, 20);
    trackEvent('content', type, description);
  },

  getRecentActivity() {
    return _state.recentActivity || [];
  },

  /* ══════════ Data Export/Import ══════════ */

  async exportData() {
    // Migrate any legacy localStorage-only libraries into export
    const stimLib = _state.stimulusLibrary?.length ? _state.stimulusLibrary
      : (() => { try { return JSON.parse(localStorage.getItem('cocher_stimulus_library') || '[]'); } catch { return []; } })();
    const srcLib = _state.sourceLibrary?.length ? _state.sourceLibrary
      : (() => { try { return JSON.parse(localStorage.getItem('cocher_source_library') || '[]'); } catch { return []; } })();

    // Custom simulations: metadata lives in its own localStorage key and the
    // heavy HTML in IndexedDB — inline the HTML so a backup is self-contained
    // (version history is intentionally not exported, only the current HTML).
    let customSims = [];
    try {
      customSims = JSON.parse(localStorage.getItem('cocher_custom_sims') || '[]');
      const htmlById = await idbGetAllFrom('custom_sims');
      customSims = customSims.map(s => {
        const rec = htmlById.get(s.id);
        const html = (rec && typeof rec.html === 'string') ? rec.html : (s.html || '');
        return { ...s, html };
      });
    } catch { customSims = []; }

    return JSON.stringify({
      version: 2,
      exportedAt: Date.now(),
      classes: _state.classes,
      lessons: _state.lessons,
      savedLayouts: _state.savedLayouts || [],
      adminEvents: _state.adminEvents || [],
      knowledgeUploads: _state.knowledgeUploads || [],
      pdFolders: _state.pdFolders || [],
      assessmentRoutines: _state.assessmentRoutines || [],
      savedTOS: _state.savedTOS || [],
      assessmentChecklists: _state.assessmentChecklists || [],
      stimulusLibrary: stimLib,
      sourceLibrary: srcLib,
      departmentSchemes: _state.departmentSchemes || [],
      assessmentBlueprints: _state.assessmentBlueprints || [],
      assessmentArtifacts: _state.assessmentArtifacts || [],
      practiceLog: _state.practiceLog || [],
      practiceGoal: _state.practiceGoal || null,
      trackingSchemas: _state.trackingSchemas || [],
      frameworks: _state.frameworks || [],
      references: _state.references || [],
      customSimulations: customSims,
      recentActivity: _state.recentActivity
    }, null, 2);
  },

  /**
   * Validate an export file without touching state. Returns
   * { ok, counts?, version?, error? } so callers can confirm with the user
   * (counts per data type) before overwriting anything.
   */
  previewImportData(jsonStr) {
    const ARRAY_KEYS = ['classes', 'lessons', 'savedLayouts', 'adminEvents', 'knowledgeUploads',
      'pdFolders', 'assessmentRoutines', 'savedTOS', 'assessmentChecklists', 'stimulusLibrary',
      'sourceLibrary', 'departmentSchemes', 'assessmentBlueprints', 'assessmentArtifacts',
      'practiceLog', 'trackingSchemas', 'frameworks', 'references', 'customSimulations',
      'recentActivity'];
    let data;
    try { data = JSON.parse(jsonStr); } catch { return { ok: false, error: 'This file is not valid JSON.' }; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'This file is not a Co-Cher export.' };
    }
    const malformed = ARRAY_KEYS.filter(k => data[k] !== undefined && !Array.isArray(data[k]));
    if (malformed.length) {
      return { ok: false, error: `Malformed fields in export: ${malformed.join(', ')}.` };
    }
    const counts = {};
    ARRAY_KEYS.forEach(k => { if (Array.isArray(data[k])) counts[k] = data[k].length; });
    if (Object.keys(counts).length === 0) {
      return { ok: false, error: 'No Co-Cher data found in this file.' };
    }
    return { ok: true, counts, version: data.version };
  },

  importData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data || typeof data !== 'object') return false;
      // Only accept well-formed arrays — a malformed field must not
      // partially overwrite existing state
      if (Array.isArray(data.classes)) _state.classes = data.classes;
      if (Array.isArray(data.lessons)) _state.lessons = data.lessons;
      if (Array.isArray(data.savedLayouts)) _state.savedLayouts = data.savedLayouts;
      if (Array.isArray(data.adminEvents)) _state.adminEvents = data.adminEvents;
      if (Array.isArray(data.knowledgeUploads)) {
        _state.knowledgeUploads = data.knowledgeUploads;
        // Imported backups may carry upload content — put it in IndexedDB
        syncKbContentToIdb([], data.knowledgeUploads);
      }
      if (Array.isArray(data.pdFolders)) _state.pdFolders = data.pdFolders;
      if (Array.isArray(data.assessmentRoutines)) _state.assessmentRoutines = data.assessmentRoutines;
      if (Array.isArray(data.savedTOS)) _state.savedTOS = data.savedTOS;
      if (Array.isArray(data.assessmentChecklists)) _state.assessmentChecklists = data.assessmentChecklists;
      if (Array.isArray(data.stimulusLibrary)) _state.stimulusLibrary = data.stimulusLibrary;
      if (Array.isArray(data.sourceLibrary)) _state.sourceLibrary = data.sourceLibrary;
      if (Array.isArray(data.departmentSchemes)) _state.departmentSchemes = data.departmentSchemes;
      if (Array.isArray(data.assessmentBlueprints)) _state.assessmentBlueprints = data.assessmentBlueprints;
      if (Array.isArray(data.assessmentArtifacts)) _state.assessmentArtifacts = data.assessmentArtifacts;
      if (Array.isArray(data.practiceLog)) _state.practiceLog = data.practiceLog;
      if (data.practiceGoal && typeof data.practiceGoal === 'object' && !Array.isArray(data.practiceGoal)) _state.practiceGoal = data.practiceGoal;
      if (Array.isArray(data.trackingSchemas)) _state.trackingSchemas = data.trackingSchemas;
      if (Array.isArray(data.frameworks)) {
        // Merge, don't blind-replace: imported non-builtin frameworks replace
        // by id; builtins are never duplicated (the local seeds win).
        const current = _state.frameworks || [];
        const builtinIds = new Set(current.filter(f => f.builtin).map(f => f.id));
        const merged = [...current];
        data.frameworks.forEach(raw => {
          if (!raw || typeof raw !== 'object' || !raw.id) return;
          if (raw.builtin || builtinIds.has(raw.id)) return;
          const idx = merged.findIndex(f => f.id === raw.id);
          if (idx >= 0) merged[idx] = raw; else merged.push(raw);
        });
        _state.frameworks = merged;
      }
      if (Array.isArray(data.references)) {
        _state.references = data.references;
        // Imported backups may carry reference content — put it in IndexedDB
        syncRefContentToIdb([], data.references);
      }
      if (Array.isArray(data.customSimulations)) {
        // Written with HTML inline; the simulations portal offloads inline
        // HTML to IndexedDB on its next render (migrateLegacySimHtml), so
        // this also works where IndexedDB is unavailable.
        try {
          localStorage.setItem('cocher_custom_sims', JSON.stringify(data.customSimulations));
        } catch { /* quota — sims skipped rather than failing the whole import */ }
      }
      if (Array.isArray(data.recentActivity)) _state.recentActivity = data.recentActivity;
      // Also sync to legacy localStorage keys for backwards compat
      if (Array.isArray(data.stimulusLibrary)) localStorage.setItem('cocher_stimulus_library', JSON.stringify(data.stimulusLibrary));
      if (Array.isArray(data.sourceLibrary)) localStorage.setItem('cocher_source_library', JSON.stringify(data.sourceLibrary));
      this._persist();
      this._notify();
      return true;
    } catch {
      return false;
    }
  },

  clearAllData() {
    _state.classes = [];
    _state.lessons = [];
    _state.savedLayouts = [];
    _state.adminEvents = [];
    _state.knowledgeUploads = [];
    _state.pdFolders = [];
    _state.assessmentRoutines = [];
    _state.savedTOS = [];
    _state.assessmentChecklists = [];
    _state.stimulusLibrary = [];
    _state.sourceLibrary = [];
    _state.departmentSchemes = [];
    _state.assessmentBlueprints = [];
    _state.assessmentArtifacts = [];
    _state.practiceLog = [];
    _state.practiceGoal = null;
    _state.trackingSchemas = [];
    // Builtin pedagogy frameworks reseed immediately — they are app content,
    // not teacher data, and other views assume GROW/ACT always exist.
    _state.frameworks = builtinFrameworkSeeds();
    _state.references = [];
    _refContentInIdb.clear();
    _state.recentActivity = [];
    _state.chatHistory = [];
    // Clear legacy keys too
    localStorage.removeItem('cocher_stimulus_library');
    localStorage.removeItem('cocher_source_library');
    // Custom simulations (metadata + IndexedDB HTML) go with everything else
    localStorage.removeItem('cocher_custom_sims');
    idbGetAllFrom('custom_sims')
      .then(map => { for (const id of map.keys()) idbRemove('custom_sims', id).catch(() => {}); })
      .catch(() => {});
    idbClearContent().catch(() => {});
    this._persist();
    this._notify();
  }
};

/* ── Seed builtin pedagogy frameworks (idempotent) ──
 * Keyed by fixed id, not a localStorage flag: a reload, an import, or an old
 * snapshot without `frameworks` all converge on exactly one GROW and one ACT.
 * Custom frameworks are left untouched. */
(function seedBuiltinFrameworks() {
  const existing = _state.frameworks || [];
  const missing = builtinFrameworkSeeds().filter(b => !existing.some(f => f.id === b.id));
  if (!missing.length) return;
  _state.frameworks = [...existing, ...missing];
  Store._persist();
})();

/* ── One-time migration + hydration of Knowledge Base content ──
 * Older snapshots stored upload content inside cocher_app_data; move it to
 * IndexedDB, then hydrate in-memory uploads so views keep synchronous reads. */
(async function migrateAndHydrateKbContent() {
  try {
    const uploads = _state.knowledgeUploads || [];
    if (!uploads.length) return;
    const withContent = uploads.filter(u => u.id && typeof u.content === 'string' && u.content);
    for (const u of withContent) {
      const ok = await idbSetContent(u.id, u.content);
      if (ok) _kbContentInIdb.add(u.id);
    }
    const map = await idbGetAllContent();
    let hydrated = false;
    uploads.forEach(u => {
      if (u.content == null && map.has(u.id)) {
        u.content = map.get(u.id);
        _kbContentInIdb.add(u.id);
        hydrated = true;
      }
    });
    // Re-persist so confirmed-migrated content leaves the localStorage snapshot
    if (withContent.some(u => _kbContentInIdb.has(u.id))) Store._persist();
    if (hydrated) Store._notify();
  } catch (e) {
    console.warn('Co-Cher: Knowledge Base content hydration failed', e);
  }
})();

/* ── Hydrate References content from IndexedDB (mirrors the KB pattern) ── */
(async function migrateAndHydrateRefContent() {
  try {
    const refs = _state.references || [];
    if (!refs.length) return;
    const withContent = refs.filter(r => r.id && typeof r.content === 'string' && r.content);
    for (const r of withContent) {
      const ok = await idbSetContent(r.id, r.content);
      if (ok) _refContentInIdb.add(r.id);
    }
    const map = await idbGetAllContent();
    let hydrated = false;
    refs.forEach(r => {
      if (r.content == null && map.has(r.id)) {
        r.content = map.get(r.id);
        _refContentInIdb.add(r.id);
        hydrated = true;
      }
    });
    if (withContent.some(r => _refContentInIdb.has(r.id))) Store._persist();
    if (hydrated) Store._notify();
  } catch (e) {
    console.warn('Co-Cher: Reference content hydration failed', e);
  }
})();

// Apply dark mode and colour palette on load
if (_state.darkMode) {
  document.documentElement.classList.add('dark');
}
if (_state.palette) {
  document.documentElement.classList.add(`palette-${_state.palette}`);
}
// Apply the teacher's personal visual identity (accent) — overrides the palette
// when a personal accent is set; safe no-op otherwise.
try { applyIdentity(); } catch { /* ignore */ }
