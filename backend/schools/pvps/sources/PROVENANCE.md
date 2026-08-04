# Where Park View's pack came from

| Field | Source |
|---|---|
| name, vision, mission, motto, values, CCAs, programmes, teaching approaches | parkviewpri.moe.edu.sg |
| levels, class codes, subjects, room names, period grid, duty posts | the school's own staff timetable, 2026 Term 3 |
| staff roster and timetables | **not in this repo** — see below |

## The timetable itself

`2026_T3_130726Teachers.xlsx` — 92 teachers, one sheet each, 3-row blocks
(subject / class / room) against 30-minute periods from 07:00.

It is a real staff timetable, so it is **not committed here**. What was taken
from it and committed is only the institutional half: how the school names its
classes, what it teaches, what its rooms are called, when its periods run. None
of that is attached to a person.

The compiled roster (`staff.json` with real entries) belongs in the school's own
Drive folder, or is loaded per-device via Admin → Find a Teacher. To rebuild it,
re-run the converter against a fresh export — the format has been stable across
terms.

## Known gaps

`needsConfirmation` in the pack lists what is still unknown, including the
absence of a recess block in the timetable and the unexplained "2G" class.
