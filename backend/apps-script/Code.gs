/**
 * Co-Cher 2 — school backend (Google Apps Script Web App)
 * =======================================================
 * A thin READ-ONLY proxy over a Google Drive folder. There is deliberately no
 * write path: an admin publishes by dropping a file into their school's Drive
 * folder, so Drive's own sharing model is the permission system and there is no
 * write API to secure.
 *
 * Drive layout (one folder per school, mirroring backend/schools/ in the repo):
 *
 *   Co-Cher Schools/            ← set ROOT_FOLDER_ID to this folder
 *     pvps/
 *       school.json             config: name, domains, calendar, levels, frameworks
 *       staff.json              roster + each teacher's timetable entries
 *       sources/                original TT / framework documents (never served)
 *     sajc/
 *     bty/
 *
 * Endpoints (GET only):
 *   ?part=index                        → [{ id, name, domains }]  (public)
 *   ?school=pvps&part=config           → school.json              (public)
 *   ?school=pvps&part=staff&code=XYZ   → staff.json               (join code required)
 *
 * `config` is non-personal and open. `staff` carries teacher names and
 * schedules, so it requires the school's joinCode (set in that school's
 * school.json). That is a real barrier, not real security — treat it as an
 * internal staff directory, and do NOT put student data here.
 *
 * ── Deploy ──
 * 1. Create the Drive folder, copy backend/schools/* into it.
 * 2. Extensions → Apps Script (or script.google.com), paste this file.
 * 3. Set ROOT_FOLDER_ID below to the Drive folder's ID (from its URL).
 * 4. Deploy → New deployment → Web app
 *      Execute as:  Me
 *      Who has access:  Anyone
 *    ("Anyone" is required for the app to fetch it from the browser; the
 *     join code is what gates the sensitive part.)
 * 5. Copy the /exec URL into cocher2/js/utils/backend.js (BACKEND_URL).
 *
 * Re-deploy as a NEW VERSION after any edit, or the old code keeps serving.
 */

var ROOT_FOLDER_ID = 'PASTE_DRIVE_FOLDER_ID_HERE';
var CACHE_SECONDS = 300;   // Drive reads are slow; cache the parsed text briefly

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var part = String(p.part || 'index');

    if (part === 'index') return json_(buildIndex_());

    var schoolId = String(p.school || '').replace(/[^a-z0-9_-]/gi, '');
    if (!schoolId) return err_(400, 'Missing ?school');

    if (part === 'config') return json_(readJson_(schoolId, 'school.json'));

    if (part === 'staff') {
      var cfg = readJson_(schoolId, 'school.json');
      var required = String((cfg && cfg.joinCode) || '');
      if (required && String(p.code || '') !== required) return err_(403, 'Join code required');
      return json_(readJson_(schoolId, 'staff.json'));
    }
    return err_(400, 'Unknown ?part (index | config | staff)');
  } catch (ex) {
    return err_(500, String(ex && ex.message || ex));
  }
}

/** Every school folder that has a school.json, reduced to routing fields. */
function buildIndex_() {
  var cached = CacheService.getScriptCache().get('index');
  if (cached) return JSON.parse(cached);
  var out = [];
  var folders = DriveApp.getFolderById(ROOT_FOLDER_ID).getFolders();
  while (folders.hasNext()) {
    var f = folders.next();
    var name = f.getName();
    if (name.charAt(0) === '_') continue;              // _template and friends
    try {
      var cfg = readFolderJson_(f, 'school.json');
      out.push({ id: cfg.id || name, name: cfg.name || name, domains: cfg.domains || [] });
    } catch (ignore) { /* folder without a valid config is simply not listed */ }
  }
  var payload = { schools: out };
  CacheService.getScriptCache().put('index', JSON.stringify(payload), CACHE_SECONDS);
  return payload;
}

function readJson_(schoolId, filename) {
  var key = schoolId + '/' + filename;
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var folders = DriveApp.getFolderById(ROOT_FOLDER_ID).getFoldersByName(schoolId);
  if (!folders.hasNext()) throw new Error('No such school: ' + schoolId);
  var doc = readFolderJson_(folders.next(), filename);
  try { cache.put(key, JSON.stringify(doc), CACHE_SECONDS); } catch (ignore) { /* >100KB — skip cache */ }
  return doc;
}

function readFolderJson_(folder, filename) {
  var files = folder.getFilesByName(filename);
  if (!files.hasNext()) throw new Error('Missing ' + filename);
  return JSON.parse(files.next().getBlob().getDataAsString('UTF-8'));
}

/* ContentService sets Access-Control-Allow-Origin: * on JSON responses, which
 * is why a plain GET from the browser works with no CORS preflight. */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function err_(code, message) {
  return ContentService.createTextOutput(JSON.stringify({ error: message, status: code }))
    .setMimeType(ContentService.MimeType.JSON);
}
