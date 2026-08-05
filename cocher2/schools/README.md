# School Packs

A **School Pack** is the small bundle of configuration that makes Co-Cher feel like
*your* school: its calendar, its bell schedule, its subjects and levels, its CCAs,
its own learner frameworks.

One JSON file per school, plus a registry that says which email domains map to
which school. Both live here, in the repo, and are safe to publish.

```
schools/
  registry.json      which schools exist, and which email domains route to them
  bty.json           a filled-in worked example (Beatty Secondary School)
  pvps.json          Park View Primary — a primary school, built from its own timetable
  oeps.json          Opera Estate Primary — the second primary school
  <id>/staff.json    that school's roster (see "colleague list" below)
  demo-timetables/   invented weeks for the demo accounts, clearly labelled
  _template.json     blank — copy this to start a new school
  README.md          this file
```

---

## Two kinds of file, two different rules

A **pack** (`<id>.json`) is configuration, not people. A **roster**
(`<id>/staff.json`) is people, by definition. They are separate files because
they carry different risk, and only the pack is unconditionally safe to publish.

| Goes in a pack ✅ | Never goes in a pack ❌ |
|---|---|
| School name, values, levels, subjects, departments | Teacher names |
| Bell times, term calendar, week cycle | Teacher email addresses |
| CCA list, school frameworks | Student names, class registers |
| A group distribution address (`…_all_staff@…`) | Individual staff or parent contacts |

A roster is the exception, and it is a deliberate one. Park View's and Opera
Estate's real staff timetables ship in this repo so their teachers get a working
colleague list on first sign-in with nothing to do. **This repo is public**, so
committing a roster publishes staff names and their weekly movements — and a
weekly pattern identifies a person even without a name attached. Do it only for
a school that has agreed to it, and only with staff data: student names and
class registers never belong here under any circumstance.

If a school has not agreed, it still works — a teacher loads the file on their
own device (source 2 below) and nothing is committed.

---

## Adding a school

1. Copy `_template.json` to `<id>.json` (lowercase short code, e.g. `xinmin.json`).
2. Fill it in (fields below — most are optional; start with the top four).
3. Add one line to `registry.json`:

```json
{ "id": "xinmin", "name": "Xinmin Secondary School",
  "domains": ["xinmin.edu.sg"], "pack": "xinmin.json" }
```

That's it — every teacher on that domain is onboarded. You never list individual
teachers, so there's no roster to maintain and nothing to update when staff move.

> **On access:** domain matching *routes* a teacher to the right school. It is not
> a security boundary — this is a static site with no server, so anyone can read
> these files and type any email. Treat the registry as "which school is this
> person from", not "who is allowed in". Real access control needs a backend.

---

## Fields

Only `id`, `name` and `domains` are required. Everything else improves the fit;
leave out what you don't have yet and the app falls back to sensible defaults.

### Identity
| Field | What it does |
|---|---|
| `id` | Short lowercase code. Must match the filename and the registry entry. |
| `name` | Full school name — appears in the UI and in AI prompts. |
| `shortName` | Optional friendly form used in tight spaces. |
| `domains` | Email domains that route to this school. Several are fine. |
| `values` | School values as a plain phrase. Fed to the AI so plans can reflect them. |
| `contacts.allStaff` | Group distribution address for "email all staff", if one exists. |

### `calendar` — how weeks work
```json
"calendar": { "cycle": "oddEven", "weeks": [ { "start": "2026-01-05", "cycle": "Odd" } ] }
```
- `cycle: "none"` — every week is the same. **Use this if in doubt**; it's the common case.
- `cycle: "oddEven"` — alternating weeks (Beatty). List each week's Monday and its type.
  A week with `"cycle": null` is a holiday/break week.
- `weeks` is ignored when `cycle` is `"none"`.

### `bell` — periods and times
```json
"bell": {
  "dayStart": "07:30",
  "periodMinutes": 35,
  "periods": [ { "id": 1, "start": "07:55", "end": "08:30" } ],
  "grid": { "Odd": { "Mon": [1,2,3], "Wed": [4,5] }, "Even": { … } }
}
```
- `periods` — every teaching period, in order. Period ids need not be contiguous:
  Beatty has no P12, and its P13/P14 run only on Wednesday and Thursday afternoons.
- `grid` — which periods actually run on each day. This is how late starts and
  short Fridays are expressed without special-casing them in code.
  Use `"*"` as the key when there's no week cycle:
  `"grid": { "*": { "Mon": [1,2,3,4], … } }`

### Vocabulary
| Field | Example | Notes |
|---|---|---|
| `levels` | `["Secondary 1", … ]` | How your school names year levels. A JC or primary school writes its own. |
| `streams` | `["G1","G2","G3"]` | Or `["Express","NA","NT"]`, or `["IP"]`, or `[]`. |
| `departments` | `["Science", …]` | Used for grouping colleagues. |
| `subjects` | `["Chemistry", …]` | Offered subjects — narrows AI suggestions and pickers. |
| `cca` | `[{ "name": "…", "category": "sports" }]` | Categories: `sports`, `performing`, `uniformed`, `clubs`. Seeds My CCA with your school's own list. |
| `sampleClasses` | `[{ "name": "5R1 Mathematics", "level": "Primary 5", "subject": "Mathematics" }]` | Real class codes for first-run samples and placeholder text. |
| `identity` | `{ "vision": "…", "mission": "…", "motto": "…" }` | Shown in Settings so a teacher can see what Co-Cher knows about their school. |

## Who may sign in

`registry.json` carries `access`, and each school may carry `closed` + `allowEmails`.

| | Effect |
|---|---|
| `access: "open"` (default) | Anyone signs in. An unrecognised domain picks a school, or continues without one. |
| A school with `closed: true` | Only its own domain, and only addresses on its `allowEmails` list. It is **hidden from the picker**, so nobody can select their way in. |
| `allowEmails: []` | Empty means the whole domain is welcome. Populated means only those addresses. |

Park View and Opera Estate are both `closed` for their betas: sign-in handles are
`name@pvps` and `name@oeps` — short, and deliberately not MOE addresses so they
cannot collide with real ones. The handle is derived from the school's own
timetable, one per sheet, so the list needs no invention and no guessing. Each
school's admin controls its beta by trimming `allowEmails`; there is no separate
account system.

Be plain about what this is. The check runs in the browser on a public page, so
it is a front door, not a lock — it stops a stray visitor wandering into a
school's Co-Cher; it does not protect anything served at a public URL. An
unreadable registry falls back to open rather than locking anybody out, because
Co-Cher 1's one real outage was a failed fetch that locked out every teacher.

## Where a school's colleague list comes from

Everything below is chosen by **who signs in**. The email domain resolves to a
school id, and every source is scoped to that id — nothing crosses.

| Order | Source | Who has to do what |
|---|---|---|
| 1 | **Live** — the school's Drive folder via Apps Script | an admin drops a file in Drive; needs `BACKEND_URL` set once |
| 2 | **This device** — a file a teacher loaded themselves | one teacher, one laptop |
| 3 | **Bundled** — `schools/<id>/staff.json`, shipped with the app | **nobody. It just works.** |
| 4 | **Pack names** — `staff` in `<id>.json`, names only | nobody |
| 5 | Nothing — an honest empty state and the way to fill it | — |

**Source 3 is the default answer for a new school.** Drop the roster into
`schools/<id>/staff.json`, and every teacher at that school signs in and finds
their colleagues already there. No upload, no instruction, no admin, and it
works offline because the service worker caches it.

A school that later stands up a live Drive feed overrides it without a code
change; a teacher testing a newer roster on their own machine overrides it too.
Ranking, not replacement.

```
cocher2/schools/
  registry.json      ← domain → school id
  pvps.json          ← the pack: levels, subjects, CCAs, values, frameworks
  pvps/staff.json    ← the roster: who works here and when they teach
```

A bundled roster also answers a second question: **which row is me?** If the
signed-in address matches a roster `email` exactly, that teacher's own week is
loaded on first sign-in — no import, no picker, nothing anyone has to be told to
do. Only an exact match counts; anything less would put a teacher in a
colleague's week, so a near-miss falls through to the "which of these is you?"
picker or to importing their own file.

### Converting a school's staff timetable

Every school's export is shaped differently and none of them are canonical, so
each needs a small one-off converter. Two that have been written:

| | Park View | Opera Estate |
|---|---|---|
| Layout | periods down the rows, days across | **days down the rows, periods across** |
| Doubles | the same value repeated in consecutive blocks | **a merged cell range** |
| Names | first names only | full names in row 2, sheet tag in brackets |
| Duties | in the grid, with times | in the grid **and** in untimed margin cells |

Two traps worth knowing before writing the third:

* **Expand merged ranges first.** A spreadsheet reader returns a merge's value
  only in its top-left cell, so every double period silently becomes a single.
* **Do not invent times for untimed things.** Opera Estate writes duty posts in
  the margin, off the period grid. They are kept as day-level facts
  (`dayDuties: [{ day, post }]`) rather than given a slot the school never
  assigned — putting a teacher somewhere at a time nobody said is worse than
  not showing it.

Both converters produce the same canonical entry, which is the only thing the
app knows about:

```json
{ "cycle": null, "day": "Wed", "start": "09:00", "end": "10:00",
  "title": "MA", "class": "5D", "room": null, "kind": "lesson" }
```

`kind` is `lesson` · `duty` · `pd` · `school`. Only `lesson` entries feed the
teaching-area derivation, which is what keeps duty posts and committees from
turning into departments.

### `staff` — who works here, without timetables

Optional. Names off your school's own staff page, nothing more:

```json
{ "name": "Lim Hui Shan", "department": "Mathematics" }
```

Find a Teacher lists them, so a colleague can be looked up by name and
department. It does **not** pretend to know their week: without `entries` they
appear greyed out and cannot be selected, labelled "timetable not uploaded".
That is deliberate — a name with no timetable must never be rendered as "free",
because someone would knock on a door in the middle of a lesson.

`email` is optional and is never guessed. Leave it out unless the school
publishes it; an address Co-Cher invented would send real mail to a stranger.
A published `staff.json` with real `entries` always wins over this list.

### `adminTools` — your school's own forms and links
Optional. Each entry becomes a card in Admin One-Stop.

```json
{ "label": "Bus Booking", "desc": "Open the school bus booking form.",
  "icon": "🚌", "href": "https://form.gov.sg/…" }
```

Only your school's teachers see them. Co-Cher never shows another school's forms
to you — an approval request submitted to the wrong school's inbox is worse than
no link at all — so a pack that lists none simply shows the universal tools.

### `frameworks` — your school's own learner routines
Optional, and the reason a pack is more than settings. If your school has its own
reflection or feedback routine, put it here and it appears alongside the national
frameworks (Singapore Teaching Practice, E21CC, CCE) rather than being replaced by
someone else's.

```json
{ "id": "fw_xyz_…", "name": "GROW by Reflecting", "purpose": "metacognition",
  "guidance": "one paragraph on what this routine is for",
  "stages": [ { "key": "G", "label": "…", "prompt": "teacher-facing",
                "studentPrompt": "student-facing question" } ] }
```

`purpose` is `metacognition` or `feedback`. `bty.json` is a complete example.

---

## Worked example

`bty.json` is Beatty's, and every value in it was taken from the live app rather
than invented — the 43-week Odd/Even calendar, the 13 teaching periods with real
start times, the exact period grid (Odd Wednesday starts at P4; Friday stops at
P10), the 8 departments and 24 subjects from the staff timetable, the CCA list,
and the GROW / ACT frameworks that are currently hardcoded as undeletable
"builtins" in `state.js`.

It's the template for what "good" looks like, and it doubles as the proof that
Beatty is now just *the first school*, not a special case.

`pvps.json` and `oeps.json` are the two primary schools, and between them they
show what a pack looks like when the website and the timetable disagree about
how much is knowable. Everything read from a school's own timetable — the period
grid, class codes, subject codes, duty posts — is first-hand and exact.
Everything about identity, values and programmes is only as good as the source
it came from, and `needsConfirmation` says which is which. Opera Estate's is the
longer list: its website refuses fetches from the build environment, so its
vision, values and CCAs were assembled from search results and are flagged for
the school to confirm rather than quoted as settled.

Its learning routines are not in yet, so it deliberately carries no
`learningPractice` and no `frameworks`. That is not a gap to be filled with a
plausible guess — a pack with neither falls back to the national Assessment FOR
/ AS Learning frame, which is genuinely everyone's, and the school's own
routines drop in later without a code change.
