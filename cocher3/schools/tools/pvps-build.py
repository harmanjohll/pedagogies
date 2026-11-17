"""raw.json → (a) the roster, (b) the institutional facts for the public pack.

The split is the whole point. (a) is 92 named people's weeks and stays out of
git; (b) is bell times, class codes, subject names and room names — facts about
the institution, no person attached — and belongs in the pack.
"""
import json, re, collections, pathlib

d = json.load(open('raw.json'))
E = [e for t in d['teachers'] for e in t['entries']]
SUBJ, ROOM = d['legendSubjects'], d['legendRooms']

# The file spells the same duty post three ways. Left alone, Find a Teacher
# would show a teacher at three different places that are one place.
def tidy(title):
    t = re.sub(r'\s+', ' ', title.strip())
    t = re.sub(r'^DUTY\s*@\s*', 'DUTY@', t, flags=re.I)
    t = t.replace('ECO-GARDEN', 'ECO GARDEN').replace('ECOGARDEN', 'ECO GARDEN')
    t = re.sub(r'PARADE\s*SQ(UARE)?', 'PARADE SQUARE', t, flags=re.I)
    return t

# ── (a) the roster ────────────────────────────────────────────────────────────
teachers = []
for t in d['teachers']:
    ents = [{**e, 'title': tidy(e['title'])} for e in t['entries']]
    teachers.append({'name': t['name'], 'email': '', 'department': '', 'entries': ents})
teachers.sort(key=lambda t: t['name'])
roster = {
    'schoolId': 'pvps',
    'note': ('Park View Primary, staff timetable 2026 Term 3 (source tag %s). '
             'Real staff timetable — hold outside the public repo.' % d['tag']),
    'teachers': teachers,
}
pathlib.Path('pvps-staff.json').write_text(json.dumps(roster, indent=2) + '\n')

# ── (b) institutional facts ───────────────────────────────────────────────────
starts = sorted({e['start'] for e in E})
periods = [{'id': i + 1, 'start': s, 'end': f'{int(s[:2]) + (int(s[3:]) + 30) // 60:02d}:{(int(s[3:]) + 30) % 60:02d}'}
           for i, s in enumerate(starts)]

codes = collections.Counter()
for e in E:
    for c in re.split(r'[,/]', e['class'] or ''):
        c = c.strip()
        if re.fullmatch(r'[1-6][A-Z]\d?', c): codes[c] += 1
by_level = collections.defaultdict(list)
for c in sorted(codes): by_level[f'Primary {c[0]}'].append(c)

taught = collections.Counter(e['title'] for e in E if e['kind'] == 'lesson')
subjects, seen = [], set()
for code, _ in taught.most_common():
    for part in re.split(r'[,/]', code):
        part = part.strip()
        full = SUBJ.get(part, part).title().replace('Mt-', 'MT ').replace('El-', 'English ')
        if part and full not in seen and not re.fullmatch(r'[1-6][A-Z]\d?', part):
            seen.add(full); subjects.append({'code': part, 'name': full})

rooms = sorted({r.strip() for e in E for r in re.split(r'[,]', e['room'] or '') if r.strip()
                and not re.fullmatch(r'[1-6][A-Z]\d?', r.strip())})

facts = {
    'slotMinutes': 30,
    'bell': {'dayStart': starts[0], 'periodMinutes': 30, 'periods': periods},
    'classCodes': dict(by_level),
    'subjectCodes': subjects,
    'rooms': [{'code': r, 'name': ROOM.get(r, r)} for r in rooms],
    'dutyPosts': sorted({tidy(e['title']) for e in E if e['kind'] == 'duty'}),
}
pathlib.Path('pvps-facts.json').write_text(json.dumps(facts, indent=2) + '\n')

print('roster :', len(teachers), 'teachers,', sum(len(t['entries']) for t in teachers), 'entries')
print('periods:', len(periods), f"({periods[0]['start']}–{periods[-1]['end']})")
print('classes:', sum(len(v) for v in by_level.values()), 'across', len(by_level), 'levels')
print('subjects:', ', '.join(s['name'] for s in subjects[:14]))
print('duty posts:', len(facts['dutyPosts']), '→', ', '.join(facts['dutyPosts']))
