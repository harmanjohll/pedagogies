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
  recentActivity: []
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
    const students = cls.students.map(s =>
      s.id === studentId ? { ...s, ...data } : s
    );
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

  /* ══════════ Lessons CRUD (stub for Phase 3) ══════════ */

  getLessons() {
    return _state.lessons || [];
  },

  getLessonsForClass(classId) {
    return (_state.lessons || []).filter(l => l.classId === classId);
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
      recentActivity: _state.recentActivity
    }, null, 2);
  },

  importData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (data.classes) _state.classes = data.classes;
      if (data.lessons) _state.lessons = data.lessons;
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
