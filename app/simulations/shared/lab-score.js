/* LabSim shared scoring / mark scheme system */
var LabScore = (function () {

  /**
   * Create a score tracker for a practical.
   * @param {Object} config
   * @param {string} config.practical  – e.g. 'titration', 'qa'
   * @param {Array}  config.criteria   – [{ id, description, marks, category }]
   * @param {number} config.totalMarks – sum of all marks
   * @returns {Object} scorer instance
   */
  function create(config) {
    var awarded = {};   // id → marks awarded
    var notes = {};     // id → note text

    function award(id, marks, note) {
      if (awarded[id] !== undefined) return; // already scored
      awarded[id] = Math.min(marks, maxForId(id));
      if (note) notes[id] = note;
    }

    function maxForId(id) {
      for (var i = 0; i < config.criteria.length; i++) {
        if (config.criteria[i].id === id) return config.criteria[i].marks;
      }
      return 0;
    }

    function totalAwarded() {
      var sum = 0;
      for (var k in awarded) sum += awarded[k];
      return sum;
    }

    function percentage() {
      return config.totalMarks > 0 ? (totalAwarded() / config.totalMarks * 100) : 0;
    }

    function grade() {
      var p = percentage();
      if (p >= 90) return 'A*';
      if (p >= 80) return 'A';
      if (p >= 70) return 'B';
      if (p >= 60) return 'C';
      if (p >= 50) return 'D';
      return 'U';
    }

    /** Build an HTML summary element */
    function buildSummary() {
      var container = document.createElement('div');
      container.className = 'score-summary';

      var header = document.createElement('div');
      header.className = 'score-header';
      header.innerHTML = '<span class="score-title">Mark Scheme</span>'
        + '<span class="score-total">' + totalAwarded() + ' / ' + config.totalMarks
        + ' (' + grade() + ')</span>';
      container.appendChild(header);

      var bar = document.createElement('div');
      bar.className = 'score-bar';
      var fill = document.createElement('div');
      fill.className = 'score-bar-fill';
      fill.style.width = percentage() + '%';
      bar.appendChild(fill);
      container.appendChild(bar);

      // group by category
      var cats = {};
      config.criteria.forEach(function (c) {
        var cat = c.category || 'General';
        if (!cats[cat]) cats[cat] = [];
        cats[cat].push(c);
      });

      Object.keys(cats).forEach(function (cat) {
        var section = document.createElement('div');
        section.className = 'score-section';
        var heading = document.createElement('div');
        heading.className = 'score-section-title';
        heading.textContent = cat;
        section.appendChild(heading);

        cats[cat].forEach(function (c) {
          var row = document.createElement('div');
          row.className = 'score-row';
          var got = awarded[c.id] !== undefined ? awarded[c.id] : '-';
          var cls = got === c.marks ? 'full' : (got === '-' ? 'none' : 'partial');
          row.innerHTML = '<span class="score-desc">' + c.description + '</span>'
            + '<span class="score-marks score-' + cls + '">'
            + got + ' / ' + c.marks + '</span>';
          if (notes[c.id]) {
            var n = document.createElement('div');
            n.className = 'score-note';
            n.textContent = notes[c.id];
            row.appendChild(n);
          }
          section.appendChild(row);
        });
        container.appendChild(section);
      });

      return container;
    }

    function reset() {
      awarded = {};
      notes = {};
    }

    return {
      award: award,
      totalAwarded: totalAwarded,
      percentage: percentage,
      grade: grade,
      buildSummary: buildSummary,
      reset: reset,
      config: config
    };
  }

  return { create: create };
})();
