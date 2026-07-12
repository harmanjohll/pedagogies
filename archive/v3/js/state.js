/*
 * Co-Cher State Management
 * ========================
 * Simple reactive store with localStorage persistence.
 */

import { trackEvent } from './utils/analytics.js';
import { idbSetContent, idbDeleteContent, idbGetAllContent, idbClearContent } from './utils/storage.js';

const STORAGE_KEY = 'cocher_v3_app_data';

function generateId() {
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

const DEFAULT_STATE = {
  apiKey: localStorage.getItem('cocher_v3_api_key') || '',
  model: localStorage.getItem('cocher_v3_model') || 'gemini-2.5-flash',
  darkMode: localStorage.getItem('cocher_v3_dark_mode') === 'true',
  palette: localStorage.getItem('cocher_v3_palette') || '',
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
  onboardingComplete: false
};

const _state = Object.assign({}, DEFAULT_STATE, loadFromStorage());
const _listeners = new Set();

// Migrate old API key storage
if (!_state.apiKey && localStorage.getItem('cocher_v3_api_key')) {
  _state.apiKey = localStorage.getItem('cocher_v3_api_key');
}

// Migrate legacy localStorage libraries into Store on first load
(function migrateLegacyLibraries() {
  let dirty = false;
  if (!_state.stimulusLibrary?.length) {
    try {
      const raw = localStorage.getItem('cocher_v3_stimulus_library');
      if (raw) { _state.stimulusLibrary = JSON.parse(raw); dirty = true; }
    } catch {}
  }
  if (!_state.sourceLibrary?.length) {
    try {
      const raw = localStorage.getItem('cocher_v3_source_library');
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
      schoolProfile: _state.schoolProfile || { name: '', values: '' },
      onboardingComplete: _state.onboardingComplete || false,
      recentActivity: _state.recentActivity
    });
    // Also keep legacy keys in sync
    localStorage.setItem('cocher_v3_api_key', _state.apiKey || '');
    localStorage.setItem('cocher_v3_model', _state.model || 'gemini-2.5-flash');
    localStorage.setItem('cocher_v3_dark_mode', _state.darkMode ? 'true' : 'false');
    localStorage.setItem('cocher_v3_palette', _state.palette || '');
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
      reflection: '',
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
      wallState: data.wallState || 'closed',
      studentCount: data.studentCount || 30,
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
    localStorage.setItem('cocher_v3_stimulus_library', JSON.stringify(_state.stimulusLibrary));
    this._addActivity('stimulus_created', `Added stimulus material "${data.title}"`);
    this._persist();
    this._notify();
  },

  updateStimulusMaterial(id, data) {
    _state.stimulusLibrary = (_state.stimulusLibrary || []).map(s =>
      s.id === id ? { ...s, ...data, updatedAt: Date.now() } : s
    );
    localStorage.setItem('cocher_v3_stimulus_library', JSON.stringify(_state.stimulusLibrary));
    this._persist();
    this._notify();
  },

  deleteStimulusMaterial(id) {
    _state.stimulusLibrary = (_state.stimulusLibrary || []).filter(s => s.id !== id);
    localStorage.setItem('cocher_v3_stimulus_library', JSON.stringify(_state.stimulusLibrary));
    this._persist();
    this._notify();
  },

  /* ══════════ Source Analysis Library ══════════ */

  getSourceLibrary() {
    return _state.sourceLibrary || [];
  },

  addSourceAnalysis(data) {
    _state.sourceLibrary = [data, ...(_state.sourceLibrary || [])];
    localStorage.setItem('cocher_v3_source_library', JSON.stringify(_state.sourceLibrary));
    this._addActivity('source_created', `Added source analysis "${data.title}"`);
    this._persist();
    this._notify();
  },

  updateSourceAnalysis(id, data) {
    _state.sourceLibrary = (_state.sourceLibrary || []).map(s =>
      s.id === id ? { ...s, ...data } : s
    );
    localStorage.setItem('cocher_v3_source_library', JSON.stringify(_state.sourceLibrary));
    this._persist();
    this._notify();
  },

  deleteSourceAnalysis(id) {
    _state.sourceLibrary = (_state.sourceLibrary || []).filter(s => s.id !== id);
    localStorage.setItem('cocher_v3_source_library', JSON.stringify(_state.sourceLibrary));
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

  exportData() {
    // Migrate any legacy localStorage-only libraries into export
    const stimLib = _state.stimulusLibrary?.length ? _state.stimulusLibrary
      : (() => { try { return JSON.parse(localStorage.getItem('cocher_v3_stimulus_library') || '[]'); } catch { return []; } })();
    const srcLib = _state.sourceLibrary?.length ? _state.sourceLibrary
      : (() => { try { return JSON.parse(localStorage.getItem('cocher_v3_source_library') || '[]'); } catch { return []; } })();

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
      'sourceLibrary', 'departmentSchemes', 'assessmentBlueprints', 'recentActivity'];
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
      if (Array.isArray(data.recentActivity)) _state.recentActivity = data.recentActivity;
      // Also sync to legacy localStorage keys for backwards compat
      if (Array.isArray(data.stimulusLibrary)) localStorage.setItem('cocher_v3_stimulus_library', JSON.stringify(data.stimulusLibrary));
      if (Array.isArray(data.sourceLibrary)) localStorage.setItem('cocher_v3_source_library', JSON.stringify(data.sourceLibrary));
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
    _state.recentActivity = [];
    _state.chatHistory = [];
    // Clear legacy keys too
    localStorage.removeItem('cocher_v3_stimulus_library');
    localStorage.removeItem('cocher_v3_source_library');
    idbClearContent().catch(() => {});
    this._persist();
    this._notify();
  }
};

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

// Apply dark mode and colour palette on load
if (_state.darkMode) {
  document.documentElement.classList.add('dark');
}
if (_state.palette) {
  document.documentElement.classList.add(`palette-${_state.palette}`);
}

export { generateId };
