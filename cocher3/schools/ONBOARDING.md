# Joining Co-Cher: what we need from your school

For the school's coordinator to fill in. Send it back by email. One person on
the Co-Cher side turns it into your school's settings; nothing here needs any
technical skill.

Only Part A is needed to start. Each later part makes Co-Cher fit your school
better, and can follow when you have it.

**Do not send student names, class lists or registers.** Co-Cher's settings are
published openly, so they hold facts about the school, never about children.

---

## Part A. The school (needed)

| | Your answer |
|---|---|
| Full school name | |
| Short name (for tight spaces) | |
| Staff email domain (what follows the @) | |
| Coordinator's name and email (for questions; not published) | |

## Part B. Who you are

| | Your answer |
|---|---|
| Vision | |
| Mission | |
| Motto | |
| Values, as a short phrase | |
| Two school colours (main, second). Hex codes if you have them, else describe them | |

Co-Cher softens the colours to suit each look, so exact matches are not needed.

## Part C. How your week runs

| | Your answer |
|---|---|
| Is every week the same, or do you run Odd and Even weeks? | |
| If Odd and Even: the date of the first Monday of the year, and which it is | |
| Term dates and holiday weeks for the year | |
| Time school starts each day | |
| Length of one period, in minutes | |

Attach your period timings (period number, start, end), and say which days end
early or start late.

## Part D. What you teach

| | Your answer |
|---|---|
| Levels, as you name them (Primary 1 to 6, Secondary 1 to 5, JC1 and JC2) | |
| Streams or subject levels (G1, G2, G3; or none) | |
| Departments | |
| Subjects offered | |
| CCAs, each marked sports, performing arts, uniformed group or club | |
| Three or four typical class names, as written on your timetable | |

## Part E. Your own routines (optional)

Any learning routines or frameworks your school uses, such as a reflection
routine. For each: its name, what it is for, and its steps with the question
asked at each step.

## Part F. Staff timetables (optional, and a choice)

With staff timetables, teachers see their day on first sign in, can find a
colleague, and can find common free time.

Choose one:

- [ ] **Publish them.** Staff names and weekly timetables become part of
      Co-Cher's open settings. Choose this only if your staff have agreed.
- [ ] **Keep them on each device.** Each teacher loads the timetable file
      themselves. Nothing is published.
- [ ] **Not now.**

If publishing: attach the timetable export (Excel or CSV), staff only.

## Part G. Who may sign in

- [ ] Any address on our domain
- [ ] Only the addresses on the attached list (for a pilot)

---

## For the person adding the school

1. Copy `_template.json` to `<id>.json`; fill it from Parts A to E. Colours go
   in `"theme": { "accent": "#...", "secondary": "#..." }`.
2. Add the school to `registry.json` (`id`, `name`, `domains`, `pack`; add
   `closed` and `allowEmails` for a pilot, from Part G).
3. Part F, publish chosen: build `<id>/staff.json` (see `tools/`). Staff only.
4. Sign in with an address on the domain. Check: school name on My School,
   colours, the week type, a class name in the samples, and the timetable if
   one was published.
5. Field by field detail is in `README.md` in this folder.
