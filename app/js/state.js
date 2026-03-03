/*
 * Co-Cher State Management
 * ========================
 * Simple reactive store with localStorage persistence.
 */

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
  classes: [],
  lessons: [],
  chatHistory: [],
  recentActivity: [],
  assessmentRoutines: [],
  savedTOS: [],
  assessmentChecklists: []
};

const _state = Object.assign({}, DEFAULT_STATE, loadFromStorage());
const _listeners = new Set();

// Migrate old API key storage
if (!_state.apiKey && localStorage.getItem('cocher_api_key')) {
  _state.apiKey = localStorage.getItem('cocher_api_key');
}

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
      classes: _state.classes,
      lessons: _state.lessons,
      savedLayouts: _state.savedLayouts || [],
      adminEvents: _state.adminEvents || [],
      knowledgeUploads: _state.knowledgeUploads || [],
      pdFolders: _state.pdFolders || [],
      assessmentRoutines: _state.assessmentRoutines || [],
      savedTOS: _state.savedTOS || [],
      assessmentChecklists: _state.assessmentChecklists || [],
      recentActivity: _state.recentActivity
    });
    // Also keep legacy keys in sync
    localStorage.setItem('cocher_api_key', _state.apiKey || '');
    localStorage.setItem('cocher_model', _state.model || 'gemini-2.5-flash');
    localStorage.setItem('cocher_dark_mode', _state.darkMode ? 'true' : 'false');
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
      e21cc: { cait: 50, cci: 50, cgc: 50, ...(data.e21cc || {}) },
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
        history.push({ ts: Date.now(), cait: data.e21cc.cait, cci: data.e21cc.cci, cgc: data.e21cc.cgc });
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
      e21ccFocus: data.e21ccFocus || [],
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

  /* ══════════ Activity Feed ══════════ */

  _addActivity(type, description) {
    const activity = { id: generateId(), type, description, timestamp: Date.now() };
    _state.recentActivity = [activity, ...(_state.recentActivity || [])].slice(0, 20);
  },

  getRecentActivity() {
    return _state.recentActivity || [];
  },

  /* ══════════ Data Export/Import ══════════ */

  exportData() {
    return JSON.stringify({
      version: 1,
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
      if (data.recentActivity) _state.recentActivity = data.recentActivity;
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
    _state.recentActivity = [];
    _state.chatHistory = [];
    this._persist();
    this._notify();
  }
};

// Apply dark mode on load
if (_state.darkMode) {
  document.documentElement.classList.add('dark');
}

export { generateId };
