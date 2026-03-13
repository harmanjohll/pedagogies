/*
 * RAMS Editor Component
 * =====================
 * In-app Risk Assessment & Management Strategy editor.
 * Matches MOE RAMS form template with editable fields.
 * Features: AI hazard generation, Severity × Likelihood auto-calc, .docx export, print.
 */

import { showToast } from './toast.js';
import { sendChat } from '../api.js';
import { getCurrentUser } from './login.js';
import { Store } from '../state.js';

/* ── Default SWP References ── */
const SWP_REFERENCES = [
  'SWP "Preventing Slip, Trip, and Fall"',
  'SWP "Safe Storage Practices"',
  'SWP "Manual Handling"',
  'SWP "Use of Step Stools and Step Ladders"',
  'SWP "Working Outdoors (Heat, Storms, Haze)"',
];

/* ── Risk Level Calculation ── */
function riskLevel(severity, likelihood) {
  const s = parseInt(severity) || 0;
  const l = parseInt(likelihood) || 0;
  const level = s * l;
  if (level === 0) return { level: '', color: '', label: '' };
  if (level <= 4) return { level, color: '#22c55e', label: 'Low' };
  if (level <= 9) return { level, color: '#f59e0b', label: 'Medium' };
  return { level, color: '#ef4444', label: 'High' };
}

/* ── Default RAMS Data ── */
function createDefaultRamsData(event) {
  const user = getCurrentUser();
  return {
    schoolName: 'Bukit Timah Secondary School',
    location: event?.tasks?.find(t => t.key === 'venue_booking')?.data?.venue_name || 'School premises',
    activityProcess: event?.name || 'General Activities',
    teamLeader: user?.name || '',
    members: event?.tasks?.find(t => t.key === 'student_list')?.data?.accompanying_teachers || '',
    lastReviewDate: new Date().toLocaleDateString('en-SG'),
    nextReviewDate: event?.date || '',
    vettedBy: '',
    vettedDesignation: '',
    vettedDate: '',
    approvedBy: '',
    approvedDesignation: '',
    approvedDate: '',
    hazards: [
      {
        no: 1,
        description: 'Moving around the school',
        hazard: 'Slip, trip and fall',
        accident: 'Bruises and fracture',
        severity: '',
        likelihood: '',
        controls: 'Good housekeeping\nKeep walkways clear of obstruction\nAll areas well lit, including stairs\nWear non-slip shoes',
        actionOfficer: '',
        remarks: '',
      },
    ],
  };
}

/**
 * Open the RAMS editor as a full-page overlay.
 * @param {Object} event - the admin event object
 * @param {Object} ramsTask - the RAMS task from event.tasks[]
 * @param {Function} onSave - callback(updatedRamsData)
 */
export function openRamsEditor(event, ramsTask, onSave) {
  let data = ramsTask?.data?._ramsEditorData
    ? JSON.parse(JSON.stringify(ramsTask.data._ramsEditorData))
    : createDefaultRamsData(event);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);animation:simFadeIn 0.2s ease;overflow-y:auto;';

  function render() {
    overlay.innerHTML = `
      <div style="max-width:1000px;margin:20px auto;background:var(--bg-card);border-radius:12px;box-shadow:0 25px 60px rgba(0,0,0,0.4);overflow:hidden;">
        <!-- Top Bar -->
        <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;background:var(--bg-card);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10;">
          <span style="font-weight:700;font-size:1rem;color:var(--ink);flex:1;">RAMS Editor — ${esc(event?.name || 'Event')}</span>
          <button class="btn btn-ghost btn-sm rams-ai-btn" style="font-size:0.75rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Generate Hazards
          </button>
          <button class="btn btn-secondary btn-sm rams-print-btn">Print</button>
          <button class="btn btn-primary btn-sm rams-export-btn">Export .docx</button>
          <button class="btn btn-ghost btn-sm rams-save-btn" style="font-weight:600;">Save</button>
          <button class="btn btn-ghost btn-sm rams-close-btn" style="font-size:1.1rem;padding:2px 8px;">&times;</button>
        </div>

        <div style="padding:24px;">
          <!-- Header Table -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:0.8125rem;" class="rams-header-table">
            <tr>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;width:15%;">School Name:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;width:20%;"><input class="rams-input" data-field="schoolName" value="${esc(data.schoolName)}" /></td>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;width:15%;" rowspan="2">RAMS Team Leader:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;width:15%;" rowspan="2"><input class="rams-input" data-field="teamLeader" value="${esc(data.teamLeader)}" /></td>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;width:10%;">Vetted by:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;width:10%;"><input class="rams-input" data-field="vettedBy" value="${esc(data.vettedBy)}" /></td>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;width:10%;">Approved by:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"><input class="rams-input" data-field="approvedBy" value="${esc(data.approvedBy)}" /></td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;">Location:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"><input class="rams-input" data-field="location" value="${esc(data.location)}" /></td>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;">Designation:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"><input class="rams-input" data-field="vettedDesignation" value="${esc(data.vettedDesignation)}" /></td>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;">Designation:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"><input class="rams-input" data-field="approvedDesignation" value="${esc(data.approvedDesignation)}" /></td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;">Activity/Process:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"><input class="rams-input" data-field="activityProcess" value="${esc(data.activityProcess)}" /></td>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;" rowspan="2">Member(s):</td>
              <td style="border:1px solid var(--border);padding:6px 10px;" rowspan="2"><textarea class="rams-input" data-field="members" rows="2" style="resize:vertical;">${esc(data.members)}</textarea></td>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;">Date:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"><input class="rams-input" data-field="vettedDate" value="${esc(data.vettedDate)}" /></td>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;">Date:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"><input class="rams-input" data-field="approvedDate" value="${esc(data.approvedDate)}" /></td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;">Last Review Date:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"><input class="rams-input" data-field="lastReviewDate" value="${esc(data.lastReviewDate)}" /></td>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;">Signature:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"></td>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;">Signature:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"></td>
            </tr>
            <tr>
              <td style="border:1px solid var(--border);padding:6px 10px;font-weight:600;">Next Review Date:</td>
              <td style="border:1px solid var(--border);padding:6px 10px;"><input class="rams-input" data-field="nextReviewDate" value="${esc(data.nextReviewDate)}" /></td>
              <td colspan="6" style="border:1px solid var(--border);"></td>
            </tr>
          </table>

          <!-- SWP References -->
          <div style="margin-bottom:16px;font-size:0.8125rem;color:var(--ink);">
            <p style="font-weight:600;margin-bottom:4px;">Refer to the relevant Safe Work Procedures:</p>
            <ol style="margin:0;padding-left:20px;color:var(--ink-muted);">
              ${SWP_REFERENCES.map(s => `<li>${esc(s)}</li>`).join('')}
            </ol>
          </div>

          <!-- Risk Assessment Table -->
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.75rem;" class="rams-risk-table">
              <thead>
                <tr>
                  <th colspan="4" style="border:1px solid var(--border);padding:6px;text-align:center;background:var(--bg-subtle);font-weight:700;">Hazard Identification</th>
                  <th colspan="3" style="border:1px solid var(--border);padding:6px;text-align:center;background:var(--bg-subtle);font-weight:700;">Risk Evaluation</th>
                  <th colspan="3" style="border:1px solid var(--border);padding:6px;text-align:center;background:var(--bg-subtle);font-weight:700;">Implementation</th>
                </tr>
                <tr style="background:var(--bg-subtle);">
                  <th style="border:1px solid var(--border);padding:6px;width:3%;text-align:center;">No.</th>
                  <th style="border:1px solid var(--border);padding:6px;width:14%;">Description of Activities/Work Processes</th>
                  <th style="border:1px solid var(--border);padding:6px;width:12%;">Hazard</th>
                  <th style="border:1px solid var(--border);padding:6px;width:10%;">Possible Accident /Ill-health</th>
                  <th style="border:1px solid var(--border);padding:6px;width:5%;text-align:center;" title="1=Negligible, 2=Minor, 3=Moderate, 4=Major, 5=Catastrophic">Sev.</th>
                  <th style="border:1px solid var(--border);padding:6px;width:5%;text-align:center;" title="1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain">Like.</th>
                  <th style="border:1px solid var(--border);padding:6px;width:5%;text-align:center;">Risk Level</th>
                  <th style="border:1px solid var(--border);padding:6px;width:20%;">Risk Control</th>
                  <th style="border:1px solid var(--border);padding:6px;width:12%;">Action Officer, Designation (Follow-up date)</th>
                  <th style="border:1px solid var(--border);padding:6px;width:8%;">Remarks</th>
                  <th style="border:1px solid var(--border);padding:6px;width:3%;text-align:center;background:var(--bg-subtle);"></th>
                </tr>
              </thead>
              <tbody>
                ${data.hazards.map((h, i) => {
                  const rl = riskLevel(h.severity, h.likelihood);
                  return `
                    <tr data-hazard-idx="${i}">
                      <td style="border:1px solid var(--border);padding:4px;text-align:center;vertical-align:top;">${i + 1}</td>
                      <td style="border:1px solid var(--border);padding:4px;vertical-align:top;"><textarea class="rams-cell" data-hazard="${i}" data-hfield="description" rows="3">${esc(h.description)}</textarea></td>
                      <td style="border:1px solid var(--border);padding:4px;vertical-align:top;"><textarea class="rams-cell" data-hazard="${i}" data-hfield="hazard" rows="3">${esc(h.hazard)}</textarea></td>
                      <td style="border:1px solid var(--border);padding:4px;vertical-align:top;"><textarea class="rams-cell" data-hazard="${i}" data-hfield="accident" rows="3">${esc(h.accident)}</textarea></td>
                      <td style="border:1px solid var(--border);padding:4px;text-align:center;vertical-align:top;">
                        <select class="rams-select" data-hazard="${i}" data-hfield="severity" style="width:100%;font-size:0.75rem;">
                          <option value="">-</option>
                          ${[1,2,3,4,5].map(v => `<option value="${v}" ${h.severity == v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                      </td>
                      <td style="border:1px solid var(--border);padding:4px;text-align:center;vertical-align:top;">
                        <select class="rams-select" data-hazard="${i}" data-hfield="likelihood" style="width:100%;font-size:0.75rem;">
                          <option value="">-</option>
                          ${[1,2,3,4,5].map(v => `<option value="${v}" ${h.likelihood == v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                      </td>
                      <td style="border:1px solid var(--border);padding:4px;text-align:center;vertical-align:top;font-weight:700;${rl.color ? 'color:#fff;background:' + rl.color : ''}">
                        ${rl.level ? rl.level + '<br/><span style="font-size:0.625rem;font-weight:400;">' + rl.label + '</span>' : '—'}
                      </td>
                      <td style="border:1px solid var(--border);padding:4px;vertical-align:top;"><textarea class="rams-cell" data-hazard="${i}" data-hfield="controls" rows="3">${esc(h.controls)}</textarea></td>
                      <td style="border:1px solid var(--border);padding:4px;vertical-align:top;"><textarea class="rams-cell" data-hazard="${i}" data-hfield="actionOfficer" rows="2">${esc(h.actionOfficer)}</textarea></td>
                      <td style="border:1px solid var(--border);padding:4px;vertical-align:top;"><textarea class="rams-cell" data-hazard="${i}" data-hfield="remarks" rows="2">${esc(h.remarks)}</textarea></td>
                      <td style="border:1px solid var(--border);padding:4px;text-align:center;vertical-align:top;">
                        <button class="btn btn-ghost btn-sm rams-remove-row" data-idx="${i}" style="color:var(--danger);font-size:0.875rem;padding:0 4px;" title="Remove row">&times;</button>
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-top:12px;display:flex;gap:var(--sp-2);">
            <button class="btn btn-ghost btn-sm rams-add-row" style="font-size:0.75rem;">+ Add Hazard Row</button>
          </div>

          <p style="margin-top:24px;text-align:center;font-size:0.6875rem;color:var(--ink-faint);font-style:italic;">
            Restricted for School Use Only &nbsp;&nbsp;&nbsp; Updated: ${new Date().toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    `;

    // Style inputs inside RAMS tables
    overlay.querySelectorAll('.rams-input').forEach(inp => {
      inp.style.cssText = 'width:100%;border:none;background:transparent;font-size:0.8125rem;padding:2px;font-family:inherit;color:var(--ink);';
    });
    overlay.querySelectorAll('.rams-cell').forEach(ta => {
      ta.style.cssText = 'width:100%;border:none;background:transparent;font-size:0.75rem;padding:2px;font-family:inherit;resize:vertical;color:var(--ink);';
    });
    overlay.querySelectorAll('.rams-select').forEach(sel => {
      sel.style.cssText += 'border:none;background:transparent;cursor:pointer;';
    });

    wireEvents();
  }

  function collectData() {
    // Collect header fields
    overlay.querySelectorAll('.rams-input').forEach(inp => {
      const field = inp.dataset.field;
      if (field) data[field] = inp.value;
    });

    // Collect hazard rows
    data.hazards.forEach((h, i) => {
      overlay.querySelectorAll(`[data-hazard="${i}"]`).forEach(el => {
        const field = el.dataset.hfield;
        if (field) h[field] = el.value;
      });
    });
  }

  function wireEvents() {
    // Close
    overlay.querySelector('.rams-close-btn').addEventListener('click', closeEditor);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeEditor(); });

    // Save
    overlay.querySelector('.rams-save-btn').addEventListener('click', () => {
      collectData();
      if (onSave) onSave(data);
      showToast('RAMS saved!', 'success');
    });

    // Add row
    overlay.querySelector('.rams-add-row').addEventListener('click', () => {
      collectData();
      data.hazards.push({
        no: data.hazards.length + 1,
        description: '', hazard: '', accident: '',
        severity: '', likelihood: '',
        controls: '', actionOfficer: '', remarks: '',
      });
      render();
    });

    // Remove row
    overlay.querySelectorAll('.rams-remove-row').forEach(btn => {
      btn.addEventListener('click', () => {
        collectData();
        const idx = parseInt(btn.dataset.idx);
        if (data.hazards.length > 1) {
          data.hazards.splice(idx, 1);
          render();
        } else {
          showToast('At least one hazard row is required.', 'danger');
        }
      });
    });

    // Auto-recalc risk level on severity/likelihood change
    overlay.querySelectorAll('.rams-select').forEach(sel => {
      sel.addEventListener('change', () => {
        collectData();
        render();
      });
    });

    // Export .docx
    overlay.querySelector('.rams-export-btn').addEventListener('click', () => {
      collectData();
      exportToDocx(data, event);
    });

    // Print
    overlay.querySelector('.rams-print-btn').addEventListener('click', () => {
      collectData();
      printRams(data, event);
    });

    // AI generate hazards
    overlay.querySelector('.rams-ai-btn').addEventListener('click', async () => {
      const btn = overlay.querySelector('.rams-ai-btn');
      btn.disabled = true;
      btn.textContent = 'Generating...';

      try {
        collectData();
        const newHazards = await generateHazards(event, data);
        if (newHazards.length > 0) {
          data.hazards = [...data.hazards, ...newHazards];
          render();
          showToast(`${newHazards.length} hazard(s) generated!`, 'success');
        } else {
          showToast('No additional hazards generated.', 'danger');
        }
      } catch (err) {
        showToast(`AI error: ${err.message}`, 'danger');
      }

      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Generate Hazards`;
    });

    // Escape key
    function onKey(e) {
      if (e.key === 'Escape') { closeEditor(); document.removeEventListener('keydown', onKey); }
    }
    document.addEventListener('keydown', onKey);
  }

  function closeEditor() {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s';
    setTimeout(() => overlay.remove(), 200);
  }

  document.body.appendChild(overlay);
  render();
}

/* ── AI Hazard Generation ── */
async function generateHazards(event, ramsData) {
  if (!Store.get('apiKey')) throw new Error('Please set your API key in Settings first.');

  const existingHazards = ramsData.hazards.map(h => h.hazard).filter(Boolean).join(', ');

  const messages = [{
    role: 'user',
    content: `Generate additional risk assessment hazards for this school activity.

Event: ${event?.name || 'School Activity'}
Type: ${event?.eventType || 'Activity'}
Location: ${ramsData.location || 'School premises'}
Activity: ${ramsData.activityProcess || 'General Activities'}

Already identified hazards: ${existingHazards || 'None'}

Generate 3-5 NEW hazards (not duplicating existing ones) relevant to this specific activity.
For each hazard, provide realistic risk controls appropriate for a Singapore secondary school context.

Respond ONLY with valid JSON array:
[
  {
    "description": "activity/work process description",
    "hazard": "specific hazard",
    "accident": "possible accident or ill-health",
    "severity": 2,
    "likelihood": 2,
    "controls": "bullet-pointed risk controls (use \\n for line breaks)",
    "actionOfficer": "",
    "remarks": ""
  }
]`
  }];

  const response = await sendChat(messages, {
    systemPrompt: 'You are a risk assessment specialist for Singapore schools. Generate realistic, specific hazards and controls. Respond with valid JSON only.',
    jsonMode: true,
    maxTokens: 2048
  });

  let jsonStr = response.trim();
  if (jsonStr.startsWith('```')) jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');

  try {
    const arr = JSON.parse(jsonStr);
    return Array.isArray(arr) ? arr.map((h, i) => ({
      no: ramsData.hazards.length + i + 1,
      description: h.description || '',
      hazard: h.hazard || '',
      accident: h.accident || '',
      severity: h.severity || '',
      likelihood: h.likelihood || '',
      controls: h.controls || '',
      actionOfficer: h.actionOfficer || '',
      remarks: h.remarks || '',
    })) : [];
  } catch {
    // Try to extract array from response
    const match = jsonStr.match(/\[[\s\S]*\]/);
    if (match) {
      const arr = JSON.parse(match[0]);
      return Array.isArray(arr) ? arr.map((h, i) => ({
        no: ramsData.hazards.length + i + 1,
        description: h.description || '',
        hazard: h.hazard || '',
        accident: h.accident || '',
        severity: h.severity || '',
        likelihood: h.likelihood || '',
        controls: h.controls || '',
        actionOfficer: h.actionOfficer || '',
        remarks: h.remarks || '',
      })) : [];
    }
    throw new Error('Failed to parse AI response.');
  }
}

/* ── Export as .docx (HTML→Word pattern) ── */
function exportToDocx(data, event) {
  const title = `RAMS — ${event?.name || 'Activity'}`;
  const filename = `RAMS_${(event?.name || 'Activity').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}_${event?.date || new Date().toISOString().slice(0, 10)}.doc`;

  const hazardRows = data.hazards.map((h, i) => {
    const rl = riskLevel(h.severity, h.likelihood);
    return `<tr>
      <td style="border:1px solid #999;padding:4px 6px;text-align:center;vertical-align:top;">${i + 1}</td>
      <td style="border:1px solid #999;padding:4px 6px;vertical-align:top;">${esc(h.description)}</td>
      <td style="border:1px solid #999;padding:4px 6px;vertical-align:top;">${esc(h.hazard)}</td>
      <td style="border:1px solid #999;padding:4px 6px;vertical-align:top;">${esc(h.accident)}</td>
      <td style="border:1px solid #999;padding:4px 6px;text-align:center;vertical-align:top;">${h.severity || ''}</td>
      <td style="border:1px solid #999;padding:4px 6px;text-align:center;vertical-align:top;">${h.likelihood || ''}</td>
      <td style="border:1px solid #999;padding:4px 6px;text-align:center;vertical-align:top;font-weight:bold;${rl.color ? 'background:' + rl.color + ';color:#fff;' : ''}">${rl.level || ''}</td>
      <td style="border:1px solid #999;padding:4px 6px;vertical-align:top;"><ul style="margin:0;padding-left:16px;">${(h.controls || '').split('\n').filter(Boolean).map(c => `<li>${esc(c.replace(/^[•\-]\s*/, ''))}</li>`).join('')}</ul></td>
      <td style="border:1px solid #999;padding:4px 6px;vertical-align:top;">${esc(h.actionOfficer)}</td>
      <td style="border:1px solid #999;padding:4px 6px;vertical-align:top;">${esc(h.remarks)}</td>
    </tr>`;
  }).join('');

  const htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#1e293b;margin:20px;}
table{border-collapse:collapse;width:100%;}
th,td{font-size:9pt;}
h1{font-size:14pt;text-align:center;margin-bottom:8px;}
.meta{font-size:8pt;color:#64748b;text-align:center;}
ol{font-size:9pt;margin:4px 0;padding-left:20px;}
</style></head>
<body>
<h1>RAMS FORM</h1>
<table style="margin-bottom:12px;">
  <tr>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;width:12%;">School Name:</td>
    <td style="border:1px solid #999;padding:4px 8px;width:18%;">${esc(data.schoolName)}</td>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;width:14%;" rowspan="2">RAMS Team Leader:</td>
    <td style="border:1px solid #999;padding:4px 8px;width:14%;" rowspan="2">${esc(data.teamLeader)}</td>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;width:10%;">Vetted by:</td>
    <td style="border:1px solid #999;padding:4px 8px;">${esc(data.vettedBy)}</td>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;width:10%;">Approved by:</td>
    <td style="border:1px solid #999;padding:4px 8px;">${esc(data.approvedBy)}</td>
  </tr>
  <tr>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;">Location:</td>
    <td style="border:1px solid #999;padding:4px 8px;">${esc(data.location)}</td>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;">Designation:</td>
    <td style="border:1px solid #999;padding:4px 8px;">${esc(data.vettedDesignation)}</td>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;">Designation:</td>
    <td style="border:1px solid #999;padding:4px 8px;">${esc(data.approvedDesignation)}</td>
  </tr>
  <tr>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;">Activity/Process:</td>
    <td style="border:1px solid #999;padding:4px 8px;">${esc(data.activityProcess)}</td>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;" rowspan="2">Member(s):</td>
    <td style="border:1px solid #999;padding:4px 8px;" rowspan="2">${esc(data.members).replace(/\n/g, '<br/>')}</td>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;">Date:</td>
    <td style="border:1px solid #999;padding:4px 8px;">${esc(data.vettedDate)}</td>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;">Date:</td>
    <td style="border:1px solid #999;padding:4px 8px;">${esc(data.approvedDate)}</td>
  </tr>
  <tr>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;">Last Review Date:</td>
    <td style="border:1px solid #999;padding:4px 8px;">${esc(data.lastReviewDate)}</td>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;">Signature:</td>
    <td style="border:1px solid #999;padding:4px 8px;"></td>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;">Signature:</td>
    <td style="border:1px solid #999;padding:4px 8px;"></td>
  </tr>
  <tr>
    <td style="border:1px solid #999;padding:4px 8px;font-weight:bold;">Next Review Date:</td>
    <td style="border:1px solid #999;padding:4px 8px;">${esc(data.nextReviewDate)}</td>
    <td colspan="6" style="border:1px solid #999;"></td>
  </tr>
</table>

<p style="font-size:9pt;margin-bottom:8px;">Refer to the relevant Safe Work Procedures:</p>
<ol style="font-size:9pt;margin:0 0 12px;">
  ${SWP_REFERENCES.map(s => `<li>${esc(s)}</li>`).join('')}
</ol>

<table>
  <thead>
    <tr>
      <th colspan="4" style="border:1px solid #999;padding:4px 6px;text-align:center;background:#e2e8f0;font-size:9pt;">Hazard Identification</th>
      <th colspan="3" style="border:1px solid #999;padding:4px 6px;text-align:center;background:#e2e8f0;font-size:9pt;">Risk Evaluation</th>
      <th colspan="3" style="border:1px solid #999;padding:4px 6px;text-align:center;background:#e2e8f0;font-size:9pt;">Implementation</th>
    </tr>
    <tr style="background:#f1f5f9;">
      <th style="border:1px solid #999;padding:4px 6px;font-size:8pt;">No.</th>
      <th style="border:1px solid #999;padding:4px 6px;font-size:8pt;">Description of Activities/Work Processes</th>
      <th style="border:1px solid #999;padding:4px 6px;font-size:8pt;">Hazard</th>
      <th style="border:1px solid #999;padding:4px 6px;font-size:8pt;">Possible Accident /Ill-health</th>
      <th style="border:1px solid #999;padding:4px 6px;font-size:8pt;">Severity</th>
      <th style="border:1px solid #999;padding:4px 6px;font-size:8pt;">Likelihood</th>
      <th style="border:1px solid #999;padding:4px 6px;font-size:8pt;">Risk Level</th>
      <th style="border:1px solid #999;padding:4px 6px;font-size:8pt;">Risk Control</th>
      <th style="border:1px solid #999;padding:4px 6px;font-size:8pt;">Action Officer, Designation (Follow-up date)</th>
      <th style="border:1px solid #999;padding:4px 6px;font-size:8pt;">Remarks</th>
    </tr>
  </thead>
  <tbody>${hazardRows}</tbody>
</table>

<p style="text-align:center;font-size:8pt;color:#64748b;font-style:italic;margin-top:16px;">
  Restricted for School Use Only &nbsp;&nbsp;&nbsp; Updated: ${new Date().toLocaleDateString('en-SG', { month: 'short', year: 'numeric' })}
</p>
</body></html>`;

  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('RAMS exported as Word document!', 'success');
}

/* ── Print RAMS ── */
function printRams(data, event) {
  // Reuse the same HTML as export but open in print window
  const title = `RAMS — ${event?.name || 'Activity'}`;
  exportToDocx(data, event); // For now, export triggers download; also offer print
  // TODO: Could open in new window with window.print() if preferred
}

/* ── Utility ── */
function esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }
