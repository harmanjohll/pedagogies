# Timetable converters

One-off scripts that turn a school's staff timetable export into the two files
Co-Cher reads: `../<id>/staff.json` (the roster) and the timetable-derived half
of `../<id>.json` (the pack).

They live here rather than in someone's downloads folder because a roster is not
a one-time job — a school re-issues its timetable every term, and the next
person to do it should not have to re-derive which column means what.

```
python3 <id>-convert.py <the school's .xlsx>  > raw.json   # sheets → canonical entries
python3 <id>-build.py                                      # raw.json → roster + facts
```

`<id>-build.py` reads `raw.json` from the working directory and writes
`<id>-staff.json` and `<id>-facts.json` beside it. Copy the roster to
`../<id>/staff.json`; merge the facts into `../<id>.json` by hand, because the
rest of that pack is editorial and should not be machine-overwritten.

**Every school's export is shaped differently.** Do not try to generalise these
into one script — the two here disagree about which axis is time, how a double
period is written, and where duties live. Copy the closer one and adapt it. The
parent README lists the traps that cost the most time.

## What the output must satisfy

* Real clock times, never period numbers — `"start": "09:00"`, not `"start": 4`.
* A double period is ONE entry, not two adjacent ones.
* `kind` is `lesson` · `duty` · `pd` · `school`. Only `lesson` feeds the
  teaching-area derivation, so getting this wrong turns a duty post into a
  department.
* Nothing invented. A cell the school left blank stays blank; a duty with no
  time keeps no time.
