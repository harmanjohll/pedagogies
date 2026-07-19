/* ============================================================
   LabSim Export Utility
   Export data tables and canvas graphs as PNG
   ============================================================ */
var LabExport = (function () {
  'use strict';

  /* Export a canvas element as PNG download */
  function canvasToPNG(canvas, filename) {
    if (!canvas || !canvas.toDataURL) return;
    var link = document.createElement('a');
    link.download = filename || 'labsim-graph.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /* Export an HTML table as CSV download */
  function tableToCSV(tableEl, filename) {
    if (!tableEl) return;
    var rows = tableEl.querySelectorAll('tr');
    var csv = [];

    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].querySelectorAll('th, td');
      var row = [];
      for (var j = 0; j < cells.length; j++) {
        var input = cells[j].querySelector('input');
        var text = input ? input.value : cells[j].textContent;
        /* Escape quotes */
        text = text.replace(/"/g, '""').trim();
        row.push('"' + text + '"');
      }
      csv.push(row.join(','));
    }

    var blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.download = filename || 'labsim-data.csv';
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* Export a DOM element as PNG using html2canvas-lite approach (canvas screenshot) */
  function elementToPNG(el, filename) {
    /* Try canvas if available, otherwise alert */
    if (!el) return;

    /* If it's a canvas, use directly */
    if (el.tagName === 'CANVAS') {
      canvasToPNG(el, filename);
      return;
    }

    /* For non-canvas elements, use print as fallback */
    window.print();
  }

  /* Add export buttons to a container */
  function addExportButtons(container, options) {
    if (!container) return;

    var wrap = document.createElement('div');
    wrap.className = 'export-buttons';
    wrap.style.cssText = 'display:flex;gap:8px;margin-top:8px;';

    if (options.canvas) {
      var btnPNG = document.createElement('button');
      btnPNG.className = 'btn btn-ghost btn-sm';
      btnPNG.textContent = '\uD83D\uDCF7 Export Graph';
      btnPNG.addEventListener('click', function () {
        canvasToPNG(options.canvas, options.filename || 'labsim-graph.png');
      });
      wrap.appendChild(btnPNG);
    }

    if (options.table) {
      var btnCSV = document.createElement('button');
      btnCSV.className = 'btn btn-ghost btn-sm';
      btnCSV.textContent = '\uD83D\uDCCB Export CSV';
      btnCSV.addEventListener('click', function () {
        tableToCSV(options.table, options.csvFilename || 'labsim-data.csv');
      });
      wrap.appendChild(btnCSV);
    }

    var btnPrint = document.createElement('button');
    btnPrint.className = 'btn btn-ghost btn-sm';
    btnPrint.textContent = '\uD83D\uDDA8\uFE0F Print';
    btnPrint.addEventListener('click', function () { window.print(); });
    wrap.appendChild(btnPrint);

    container.appendChild(wrap);
  }

  return {
    canvasToPNG: canvasToPNG,
    tableToCSV: tableToCSV,
    elementToPNG: elementToPNG,
    addExportButtons: addExportButtons
  };
})();
