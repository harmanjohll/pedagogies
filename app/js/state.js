/*
 * Co-Cher State Management
 * ========================
 * Simple reactive store with localStorage persistence.
 */

import { trackEvent } from './utils/analytics.js';

const STORAGE_KEY = 'cocher_app_data';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Co-Cher: Failed to save to localStorage', e);
  }
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

// Migrate old E21CC format (cait/cci/cgc) to new 6-dimension format
(function migrateE21CCScores() {
  const classes = _state.classes || [];
  let migrated = false;
  classes.forEach(cls => {
    (cls.students || []).forEach(s => {
      if (s.e21cc && ('cait' in s.e21cc) && !('criticalThinking' in s.e21cc)) {
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
      knowledgeUploads: _state.knowledgeUploads || [],
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
      e21cc: { criticalThinking: 50, creativeThinking: 50, communication: 50, collaboration: 50, socialConnectedness: 50, selfRegulation: 50, ...(data.e21cc || {}) },
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
      // Record E21CC history when scores change
      if (data.e21cc) {
        const history = [...(s.e21ccHistory || [])];
        history.push({ ts: Date.now(), ...data.e21cc });
        if (history.length > 20) history.splice(0, history.length - 20);
        updated.e21ccHistory = history;
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
      : (() => { try { return JSON.parse(localStorage.getItem('cocher_stimulus_library') || '[]'); } catch { return []; } })();
    const srcLib = _state.sourceLibrary?.length ? _state.sourceLibrary
      : (() => { try { return JSON.parse(localStorage.getItem('cocher_source_library') || '[]'); } catch { return []; } })();

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

  importData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (data.classes) _state.classes = data.classes;
      if (data.lessons) _state.lessons = data.lessons;
      if (data.savedLayouts) _state.savedLayouts = data.savedLayouts;
      if (data.adminEvents) _state.adminEvents = data.adminEvents;
      if (data.knowledgeUploads) _state.knowledgeUploads = data.knowledgeUploads;
      if (data.pdFolders) _state.pdFolders = data.pdFolders;
      if (data.assessmentRoutines) _state.assessmentRoutines = data.assessmentRoutines;
      if (data.savedTOS) _state.savedTOS = data.savedTOS;
      if (data.assessmentChecklists) _state.assessmentChecklists = data.assessmentChecklists;
      if (data.stimulusLibrary) _state.stimulusLibrary = data.stimulusLibrary;
      if (data.sourceLibrary) _state.sourceLibrary = data.sourceLibrary;
      if (data.departmentSchemes) _state.departmentSchemes = data.departmentSchemes;
      if (data.assessmentBlueprints) _state.assessmentBlueprints = data.assessmentBlueprints;
      if (data.recentActivity) _state.recentActivity = data.recentActivity;
      // Also sync to legacy localStorage keys for backwards compat
      if (data.stimulusLibrary) localStorage.setItem('cocher_stimulus_library', JSON.stringify(data.stimulusLibrary));
      if (data.sourceLibrary) localStorage.setItem('cocher_source_library', JSON.stringify(data.sourceLibrary));
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
    localStorage.removeItem('cocher_stimulus_library');
    localStorage.removeItem('cocher_source_library');
    this._persist();
    this._notify();
  }
};

// Apply dark mode and colour palette on load
if (_state.darkMode) {
  document.documentElement.classList.add('dark');
}
if (_state.palette) {
  document.documentElement.classList.add(`palette-${_state.palette}`);
}

export { generateId };
