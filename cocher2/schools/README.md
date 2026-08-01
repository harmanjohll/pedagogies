# School Packs

A **School Pack** is the small bundle of configuration that makes Co-Cher feel like
*your* school: its calendar, its bell schedule, its subjects and levels, its CCAs,
its own learner frameworks.

One JSON file per school, plus a registry that says which email domains map to
which school. Both live here, in the repo, and are safe to publish.

```
schools/
  registry.json     which schools exist, and which email domains route to them
  bty.json          a filled-in worked example (Beatty Secondary School)
  _template.json    blank — copy this to start a new school
  README.md         this file
```

---

## The one rule: no personal data in here

School Packs are **configuration, not people**. The repo is public, so:

| Goes in a pack ✅ | Never goes in a pack ❌ |
|---|---|
| School name, values, levels, subjects, departments | Teacher names |
| Bell times, term calendar, week cycle | Teacher email addresses |
| CCA list, school frameworks | Student names, class registers |
| A group distribution address (`…_all_staff@…`) | Individual staff or parent contacts |

Timetables and class lists are **loaded by each teacher on their own device**, not
committed here. That keeps names and schedules off a public URL, and it means a
teacher can get going without waiting for anyone to add their school.

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
