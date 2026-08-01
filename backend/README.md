# Co-Cher 2 — the school backend

One **Drive folder per school**, served read-only by a small Apps Script Web App.
No database, no write API, no accounts to manage.

```
Co-Cher Schools/          ← the Drive folder (mirror of backend/schools/)
  pvps/
    school.json           config — name, domains, calendar, levels, frameworks
    staff.json            roster + each teacher's timetable entries
    sources/              the ORIGINALS you uploaded (TT files, framework docs)
  sajc/
  bty/
  _template/              copy this to start a new school
```

## Why folders

**Drive sharing is the permission system.** Share `pvps/` with the Park View
admin's Google account and they can publish for their school and nothing else.
No auth code, no user table, no invitations to manage.

Everything else follows from that: a folder is human-inspectable, adding a field
needs no migration, and removing a school is deleting a folder. At tens of
schools this beats a database comfortably.

## The two files

**`school.json`** — configuration. Non-personal, safe to serve openly.
Name, email domains, week cycle and calendar, slot length, levels, streams,
subjects, departments, CCAs, and the school's own frameworks.

`levels` does more work than it looks. Co-Cher infers the school's STAGE from
those names — primary, secondary or junior college — and that decides every
level picker, every sample lesson, and what the AI assumes about the age of the
learners. List them the way the school says them ("Primary 5", "Sec 3", "JC1").

`sampleClasses` is optional and worth setting: three `{ name, level, subject }`
entries used for the demo classes a teacher sees on first run. Real class codes
from the school's own timetable make Co-Cher look like the school on day one.
No pupils are named — this is configuration, not a roster.

**`staff.json`** — the roster.

```json
{ "schoolId": "pvps",
  "teachers": [
    { "name": "Aisyah Rahman", "email": "demo.teacher@pvps.moe.edu.sg",
      "entries": [ { "cycle": null, "day": "Mon", "start": "08:00", "end": "09:00",
                     "title": "MATH", "class": "5R1", "room": "A1-02", "kind": "lesson" } ] } ] }
```

`entries` are canonical: **real clock times, not period numbers.** That is what
lets one format cover a primary school on 30-minute slots with no week cycle, a
secondary on 35-minute slots with Odd/Even, and a JC running to 18:00. `kind` is
`lesson` | `duty` | `pd` | `school` — non-teaching blocks are kept, because they
occupy the day just as much as lessons do.

## Uploading frameworks (and timetables) as documents

You do **not** hand-write JSON. Drop the originals into `sources/` — a PDF of
your learner framework, the staff timetable as .xlsx or .pdf, whatever the school
actually issued. The in-app **School Setup** page reads them, converts them, shows
you a preview to correct, and produces `school.json` / `staff.json`.

`sources/` is never served by the backend. It exists so the next person can see
where the compiled files came from, and so a re-import is possible when the
timetable changes next semester.

## Privacy — the one hard rule

`staff.json` carries teacher names and schedules.

- It is served **only** with the school's `joinCode` (set that field in
  `school.json`). A barrier, not real security.
- **Real staff rosters never go in the GitHub repo** — the repo is public. The
  `pvps/` and `sajc/` rosters committed here are fictional demo accounts, and
  `bty/` deliberately ships config only. Real rosters live in Drive alone.
- **Do not put student data here.** Minors' names deserve a stronger design than
  a join code; that is a separate decision.

## Setting up

1. Create a Drive folder, e.g. `Co-Cher Schools`. Copy `backend/schools/*` into it.
2. Open Apps Script (script.google.com), paste `backend/apps-script/Code.gs`.
3. Set `ROOT_FOLDER_ID` to the Drive folder's ID — it's in the folder's URL,
   after `/folders/`.
4. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone*.
   "Anyone" is required for a browser to fetch it; the join code gates the
   sensitive part.
5. Copy the `/exec` URL into `cocher2/js/utils/backend.js`.

After any edit to `Code.gs`, deploy a **new version** — otherwise the old code
keeps serving.

## Adding a school

1. Copy `_template/` in Drive, rename it to the school's short id (`xinmin`).
2. Fill `school.json` — at minimum `id`, `name`, `domains`. Set a `joinCode`.
3. Share that folder with the school's admin.
4. They drop their timetable into `sources/` and run School Setup to produce
   `staff.json`.

Every teacher on that email domain is then onboarded automatically. There is no
per-teacher list to maintain and nothing to update when staff join or leave.

## Endpoints

| Request | Returns | Access |
|---|---|---|
| `?part=index` | `{schools:[{id,name,domains}]}` | open |
| `?school=<id>&part=config` | that school's `school.json` | open |
| `?school=<id>&part=staff&code=<joinCode>` | that school's `staff.json` | join code |

Responses are cached for 5 minutes, so a freshly dropped file can take that long
to appear.
