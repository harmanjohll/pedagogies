/*
 * Co-Cher Print / Export Worksheets
 * =================================
 * Generate print-ready HTML for SA sets and Stimulus Materials.
 * Student version omits mark schemes; teacher version includes all.
 */

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

/**
 * Generate print-ready HTML for a Source Analysis set.
 * @param {object} item - The source analysis item
 * @param {'student'|'teacher'} mode - Student (no answers) or teacher (with mark scheme)
 */
export function printSourceAnalysis(item, mode = 'student') {
  const isTeacher = mode === 'teacher';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(item.title)} — ${isTeacher ? 'Teacher' : 'Student'} Copy</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; font-size:11pt; line-height:1.6; color:#1a1a2e; padding:24px 32px; max-width:800px; margin:0 auto; }
    h1 { font-size:16pt; margin-bottom:4px; }
    .meta { font-size:9pt; color:#666; margin-bottom:16px; }
    .source-block { border:1px solid #ddd; border-radius:6px; padding:14px 16px; margin-bottom:14px; page-break-inside:avoid; }
    .source-title { font-weight:700; font-size:10pt; margin-bottom:2px; }
    .source-prov { font-size:9pt; color:#666; font-style:italic; margin-bottom:6px; }
    .source-content { font-size:10.5pt; line-height:1.7; white-space:pre-wrap; }
    .question-block { padding:10px 0; border-bottom:1px solid #eee; page-break-inside:avoid; }
    .question-block:last-child { border-bottom:none; }
    .question-text { font-size:10.5pt; margin-bottom:4px; }
    .question-meta { font-size:8.5pt; color:#888; }
    .mark-scheme { background:#f8f9fa; border:1px solid #e2e5ea; border-radius:6px; padding:14px 16px; margin-top:16px; font-size:10pt; white-space:pre-wrap; line-height:1.6; page-break-inside:avoid; }
    .mark-scheme-title { font-weight:700; font-size:11pt; margin-bottom:8px; color:#4361ee; }
    .notes { background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:12px 16px; margin-top:12px; font-size:9.5pt; color:#92400e; white-space:pre-wrap; }
    .section-title { font-size:12pt; font-weight:700; margin:18px 0 10px; padding-bottom:4px; border-bottom:2px solid #4361ee; }
    .badge { display:inline-block; font-size:8pt; font-weight:600; padding:1px 8px; border-radius:10px; background:#f0f0f4; color:#555; margin-right:4px; }
    ${isTeacher ? '.teacher-label { color:#e11d48; font-size:8pt; font-weight:700; text-transform:uppercase; float:right; }' : ''}
    .answer-space { border:1px solid #ddd; border-radius:4px; min-height:120px; margin:8px 0; }
    @media print { body { padding:16px; } .source-block { break-inside:avoid; } }
  </style>
</head>
<body>
  ${isTeacher ? '<div class="teacher-label">TEACHER COPY — CONFIDENTIAL</div>' : ''}
  <h1>${esc(item.title)}</h1>
  <div class="meta">
    ${esc(item.subject || '')} · ${esc(item.level || '')} · ${esc(item.topic || '')}
    ${item.sourceRef ? ` · Source: ${esc(item.sourceRef.filename)}${item.sourceRef.pageRange ? ` pp ${item.sourceRef.pageRange.from}–${item.sourceRef.pageRange.to}` : ''}` : ''}
  </div>

  <div class="section-title">Sources</div>
  ${(item.sources || []).map((src, i) => `
    <div class="source-block">
      <div class="source-title">Source ${String.fromCharCode(65 + i)}: ${esc(src.title)}</div>
      ${src.provenance ? `<div class="source-prov">${esc(src.provenance)}</div>` : ''}
      <div class="source-content">${esc(src.content)}</div>
    </div>
  `).join('')}

  <div class="section-title">Questions</div>
  ${(item.questions || []).map((q, i) => `
    <div class="question-block">
      <div class="question-text"><strong>${i + 1}.</strong> ${esc(q.question)}</div>
      <div class="question-meta">
        <span class="badge">${esc(q.type)}</span>
        ${q.marks ? `[${q.marks} marks]` : ''}
        ${q.skill ? ` · ${esc(q.skill)}` : ''}
      </div>
      ${!isTeacher ? '<div class="answer-space"></div>' : ''}
    </div>
  `).join('')}

  ${isTeacher && item.markScheme ? `
    <div class="section-title">Mark Scheme</div>
    <div class="mark-scheme">${esc(item.markScheme)}</div>
  ` : ''}

  ${isTeacher && item.teacherNotes ? `
    <div class="section-title">Teacher Notes</div>
    <div class="notes">${esc(item.teacherNotes)}</div>
  ` : ''}
</body>
</html>`;

  openPrintWindow(html);
}

/**
 * Generate print-ready HTML for a Stimulus Material item.
 * @param {object} item - The stimulus material item
 * @param {'student'|'teacher'} mode
 */
export function printStimulusMaterial(item, mode = 'student') {
  const isTeacher = mode === 'teacher';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(item.title)} — ${isTeacher ? 'Teacher' : 'Student'} Copy</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; font-size:11pt; line-height:1.7; color:#1a1a2e; padding:24px 32px; max-width:800px; margin:0 auto; }
    h1 { font-size:16pt; margin-bottom:4px; }
    .meta { font-size:9pt; color:#666; margin-bottom:16px; }
    .content { font-size:11pt; line-height:1.8; white-space:pre-wrap; border:1px solid #ddd; border-radius:6px; padding:16px; margin-bottom:16px; }
    .questions { margin-top:16px; }
    .question { padding:8px 0; border-bottom:1px solid #eee; }
    .question:last-child { border-bottom:none; }
    .answer-space { border:1px solid #ddd; border-radius:4px; min-height:100px; margin:6px 0; }
    .notes { background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:12px 16px; margin-top:12px; font-size:9.5pt; color:#92400e; white-space:pre-wrap; }
    .section-title { font-size:12pt; font-weight:700; margin:18px 0 10px; padding-bottom:4px; border-bottom:2px solid #8b5cf6; }
    ${isTeacher ? '.teacher-label { color:#e11d48; font-size:8pt; font-weight:700; text-transform:uppercase; float:right; }' : ''}
    .source-ref { font-size:8.5pt; color:#4361ee; margin-bottom:12px; }
    @media print { body { padding:16px; } }
  </style>
</head>
<body>
  ${isTeacher ? '<div class="teacher-label">TEACHER COPY</div>' : ''}
  <h1>${esc(item.title)}</h1>
  <div class="meta">
    ${esc(item.subject || '')} · ${esc(item.level || '')} · ${esc(item.type || '')}
    ${item.wordCount ? ` · ${item.wordCount} words` : ''}
  </div>
  ${item.sourceRef ? `<div class="source-ref">Source: ${esc(item.sourceRef.filename)}${item.sourceRef.pageRange ? ` pp ${item.sourceRef.pageRange.from}–${item.sourceRef.pageRange.to}` : ''}</div>` : ''}

  <div class="section-title">Text</div>
  <div class="content">${esc(item.content)}</div>

  ${item.questions ? `
    <div class="section-title">Questions</div>
    <div class="questions">${esc(item.questions).split('\\n').filter(Boolean).map((q, i) =>
      `<div class="question"><strong>${i+1}.</strong> ${q.trim()}${!isTeacher ? '<div class="answer-space"></div>' : ''}</div>`
    ).join('')}</div>
  ` : ''}

  ${isTeacher && item.teacherNotes ? `
    <div class="section-title">Teacher Notes</div>
    <div class="notes">${esc(item.teacherNotes)}</div>
  ` : ''}
</body>
</html>`;

  openPrintWindow(html);
}

function openPrintWindow(html) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to print worksheets.');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
