#!/usr/bin/env python3
"""Beatty staff timetable CSV -> ../bty/staff.json (the Co-Cher 2 roster).

    python3 bty-build.py ../../btyrelief/BTYTT_2026Sem2_v1.csv > ../bty/staff.json

Beatty's export is already one row per teacher, so there is no convert step:
  * columns {Odd|Even}{Mon..Fri}P{nn}; P12 is not taught and never appears;
  * a cell reads "<class code> / <room> ( <form class> )", e.g.
    "3SP2B2 / B4-02 ( 3-5 )"; an empty cell or "0" is free;
  * the same cell in adjacent periods is one double lesson, so it becomes ONE
    entry (never merged across the P11 to P13 gap).

Clock times follow the Semester 2 bell schedule (views/dashboard.js,
PERIOD_START_MIN): every teaching period is 35 minutes.

The CSV is already published in this repo (btyrelief/), so this roster adds no
new exposure: it is the same names, emails and weekly movements, in the shape
the rest of Co-Cher 2 reads (My Timetable, the timetable claim at sign in).
"""
import csv, json, re, sys

START = {1: 475, 2: 510, 3: 545, 4: 580, 5: 615, 6: 650, 7: 685,
         8: 720, 9: 755, 10: 790, 11: 825, 13: 895, 14: 930}
LEN = 35
DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
HONORIFICS = {'MR', 'MRS', 'MS', 'MDM', 'MISS', 'DR'}


def clock(m):
    return f'{m // 60:02d}:{m % 60:02d}'


def nice_name(raw):
    words = raw.split()
    out = []
    for i, w in enumerate(words):
        if i == 0 and w.upper() in HONORIFICS:
            out.append(w.capitalize())
        else:
            out.append('-'.join(p.capitalize() for p in w.split('-')))
    return ' '.join(out)


def parse_cell(v):
    v = (v or '').strip()
    if not v or v == '0':
        return None
    code, _, rest = v.partition(' / ')
    m = re.match(r'^(.*?)\s*\(\s*([^)]+?)\s*\)\s*$', rest)
    room, form = (m.group(1).strip(), m.group(2).strip()) if m else (rest.strip(), '')
    return {'code': code.strip(), 'room': room or None, 'form': form or None, 'raw': v}


def entries_for(row):
    out = []
    for cycle in ('Odd', 'Even'):
        for day in DAYS:
            run = None
            for p in sorted(START):
                col = f'{cycle}{day}P{p:02d}'
                if col not in row:
                    continue
                cell = parse_cell(row[col])
                adjacent = run and run['last'] + 1 == p
                if run and cell and adjacent and cell['raw'] == run['cell']['raw']:
                    run['last'] = p
                    continue
                if run:
                    out.append(close(run, cycle, day))
                    run = None
                if cell:
                    run = {'cell': cell, 'first': p, 'last': p}
            if run:
                out.append(close(run, cycle, day))
    return out


def close(run, cycle, day):
    c = run['cell']
    return {
        'cycle': cycle, 'day': day,
        'start': clock(START[run['first']]), 'end': clock(START[run['last']] + LEN),
        'title': c['code'], 'class': c['code'], 'room': c['room'],
        'form': c['form'], 'kind': 'lesson',
    }


def main(path):
    rows = list(csv.DictReader(open(path, encoding='utf-8-sig')))
    teachers, seen = [], set()
    for r in rows:
        name = (r.get('NAME') or '').strip()
        if not name:
            continue
        email = (r.get("Teacher's Email") or '').strip().lower()
        if email == '0':
            email = ''
        key = email or name
        if key in seen:
            continue
        seen.add(key)
        teachers.append({
            'name': nice_name(name),
            'email': email,
            'department': (r.get('DEPARTMENT') or '').strip(),
            'entries': entries_for(r),
        })
    teachers.sort(key=lambda t: t['name'])
    doc = {
        'schoolId': 'bty',
        'note': (f'Beatty Secondary, staff timetable {path.split("/")[-1]}, converted by '
                 'schools/tools/bty-build.py. Same data as the CSV already in btyrelief/. '
                 'Times follow the Semester 2 bell schedule; a double period is one entry. '
                 'A live Drive/Apps Script feed overrides this file when one is configured.'),
        'teachers': teachers,
    }
    json.dump(doc, sys.stdout, ensure_ascii=False, separators=(',', ':'))
    sys.stdout.write('\n')


if __name__ == '__main__':
    main(sys.argv[1])
