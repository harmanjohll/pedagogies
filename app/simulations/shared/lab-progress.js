/* ============================================================
   LabSim Progress Tracker
   Tracks practical completion, scores, and milestones
   ============================================================ */
var LabProgress = (function () {
  'use strict';

  var STORAGE_KEY = 'labsim_progress';
  var data = {};

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) { data = {}; }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  /* Record that a practical was visited */
  function markVisited(practicalId) {
    if (!data[practicalId]) data[practicalId] = {};
    data[practicalId].visited = true;
    if (!data[practicalId].firstVisit) data[practicalId].firstVisit = Date.now();
    data[practicalId].lastVisit = Date.now();
    save();
  }

  /* Record a practical step completion */
  function markStep(practicalId, stepId) {
    if (!data[practicalId]) data[practicalId] = {};
    if (!data[practicalId].steps) data[practicalId].steps = {};
    data[practicalId].steps[stepId] = Date.now();
    save();
  }

  /* Record completion with optional score */
  function markComplete(practicalId, score) {
    if (!data[practicalId]) data[practicalId] = {};
    data[practicalId].completed = true;
    data[practicalId].completedAt = Date.now();
    if (score !== undefined) {
      data[practicalId].score = score;
      /* Track best score */
      if (!data[practicalId].bestScore || score > data[practicalId].bestScore) {
        data[practicalId].bestScore = score;
      }
    }
    data[practicalId].attempts = (data[practicalId].attempts || 0) + 1;
    save();
  }

  /* Get progress for a specific practical */
  function get(practicalId) {
    return data[practicalId] || null;
  }

  /* Get all progress data */
  function getAll() {
    return data;
  }

  /* Get summary stats */
  function getSummary(practicalIds) {
    var total = practicalIds.length;
    var visited = 0;
    var completed = 0;
    var totalScore = 0;
    var scored = 0;

    for (var i = 0; i < practicalIds.length; i++) {
      var p = data[practicalIds[i]];
      if (p) {
        if (p.visited) visited++;
        if (p.completed) {
          completed++;
          if (p.bestScore !== undefined) {
            totalScore += p.bestScore;
            scored++;
          }
        }
      }
    }

    return {
      total: total,
      visited: visited,
      completed: completed,
      averageScore: scored > 0 ? Math.round(totalScore / scored) : 0,
      percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  /* Reset all progress */
  function reset() {
    data = {};
    save();
  }

  load();

  return {
    markVisited: markVisited,
    markStep: markStep,
    markComplete: markComplete,
    get: get,
    getAll: getAll,
    getSummary: getSummary,
    reset: reset
  };
})();
