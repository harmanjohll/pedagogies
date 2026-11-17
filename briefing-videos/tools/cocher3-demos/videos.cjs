// Co-Cher 3 instructional videos. Run: node videos.cjs [name ...]   (no names = all)
// One task per clip, 20 to 40 seconds: a question card, three steps at most, ends on the result.
const { take } = require('./rec.cjs');
const path = require('path'), fs = require('fs');
const OUT = process.env.OUT_DIR || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const BTY = { email: 'alex.lim@btyss.moe.edu.sg', name: 'Alex Lim', preferredName: 'Alex', schoolId: 'bty', schoolName: 'Beatty Secondary School' };

const store = page => page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('cocher2_app_data')); return JSON.parse(localStorage.getItem(k)); });
const lessonId = async (page, start) => (await store(page)).lessons.find(l => l.title.startsWith(start)).id;
const frame = page => page.frameLocator('.ae-frame');
// A made up Paths share link: Sec 3, six subjects, goal Nurse via Polytechnic. Paths links never carry a name.
const PATHS_LINK = 'https://harmanjohll.github.io/genapp/pathways/?s=shared&for=teacher&d=' + Buffer.from(JSON.stringify({ v: 1, y: 'sec3', p: 'el3~em3~am3~phy3~chem3~geo2', g: { sector: 'health', role: 'Nurse', dest: 'poly', family: null } })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const seedObservations = async (page) => {
  const id = await lessonId(page, 'Acids');
  await page.evaluate(i => { location.hash = '#/present/' + i; }, id); await page.waitForTimeout(1400);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
  await page.keyboard.press('o'); await page.waitForTimeout(500);
  for (const n of [0, 2, 7]) await page.locator('.obs-kid').nth(n).click();
  await page.fill('#obs-note', 'Explained why toothpaste is a base');
  await page.locator('[data-verdict="showed"]').click();
  await page.locator('.obs-kid').nth(4).click(); await page.locator('[data-comp="collaboration"]').click(); await page.locator('[data-verdict="towards"]').click();
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  return id;
};

const S = {
  '01-my-school': [BTY, '#/', async (page, d) => {
    await d.card('Getting started', 'Where do I start?', 'My School: your day, and every part of Co-Cher, on one page.');
    await d.cap('Now is live', 'The lesson you are in, the rest of your day, and what still needs you.');
    await d.ring('.v3-home-tile.now'); await d.wait(3000); await d.unring();
    await d.cap('Each tile is a place', 'Week, Term, Classes, Lessons, Assess, Resources, Admin, Personal.');
    await d.move('.v3-home-tile[data-place="classes"]'); await d.wait(700);
    await d.move('.v3-home-tile[data-place="lessons"]'); await d.wait(900);
    await d.cap('Tap one: the tiles become your menu', 'The menu stays at the foot of every screen.');
    await d.click('.v3-home-tile[data-place="week"]'); await d.wait(2600);
    await d.ring('.v3-nav'); await d.wait(1800); await d.unring();
    await d.cap('School takes you back', 'And the menu opens out into the tiles again.');
    await d.click('.v3-nav [data-place="school"]'); await d.wait(2400);
    await d.endCard('My School', 'Your starting page, every day.');
  }],
  '02-entries-and-goals': [BTY, '#/now', async (page, d) => {
    await d.card('Now, Week, Term', 'How do I keep track of what needs doing?', 'Add your own entries, and set two or three goals for the term.');
    await d.cap('Add an entry', 'A lesson to develop, a paper to mark, an admin task: anything of yours.');
    await d.click(page.locator('[data-add-entry]').first()); await d.wait(500);
    await page.locator('#ag-title').pressSequentially('Mark 4A titration reports', { delay: 45 });
    await d.move('#ag-kind'); await page.selectOption('#ag-kind', 'assess'); await d.wait(400);
    await page.fill('#ag-date', '2026-10-22'); await d.wait(500);
    await d.click('.modal [data-act="save"]'); await d.wait(900);
    await d.cap('It sits on its day in Week', 'Beside your timetable, so the week shows all of your work.');
    await d.click('.v3-nav [data-place="week"]'); await d.wait(900);
    await d.ringAround('.v3-entry, [data-entry-act="edit"]', 'Mark 4A', ''); await d.wait(2400); await d.unring();
    await d.cap('Set a goal for the term', 'Link entries to it, and Term shows how far along you are.');
    await d.click('.v3-nav [data-place="term"]'); await d.wait(900);
    await d.click(page.locator('[data-add-goal]').first()); await d.wait(500);
    await page.locator('#gl-title').pressSequentially('Every 3E lesson ends with an exit ticket', { delay: 40 }); await d.wait(300);
    await d.click('.modal [data-act="save"]'); await d.wait(700);
    await d.ringAround('.v3-goal', '', ''); await d.wait(2400); await d.unring();
    await d.endCard('Entries and goals', 'On Now, Week and Term.');
  }],

  '03-plan-to-present': [BTY, '#/lessons', async (page, d) => {
    await d.card('Lessons', 'How do I take a lesson from plan to class?', 'Every lesson shows where it is, and its next step.');
    await d.cap('Your lessons, each at its stage', 'Design, prepare, rehearse, teach, reflect.');
    await d.move('text=Volcanoes & Earthquakes'); await d.wait(900);
    await d.click('text=Acids, Bases & Salts'); await d.wait(1400);
    await d.cap('The next step is always in view', 'Here: rehearse before you teach it.');
    await d.ringAround('div', 'Rehearse this lesson', '.card'); await d.wait(2600); await d.unring();
    await d.cap('Present, with one tap', 'The lesson goes full screen, part by part.');
    await d.click('#present-lesson-btn'); await d.wait(2400);
    await page.keyboard.press('ArrowRight'); await d.wait(1800);
    await page.keyboard.press('ArrowRight'); await d.wait(1800);
    await d.endCard('From plan to class', 'Lessons, then Present.');
  }],

  '04-commit-class': [BTY, '#/admin', async (page, d) => {
    await d.card('Admin', 'How do I get my class list in without typing?', 'Student Finder reads the school timetable. The file stays on this device.');
    await d.cap('Your teaching groups, from the timetable', 'This is the demo timetable: made up students.');
    await d.ringAround('.sf-panel', '', ''); await d.wait(2400); await d.unring();
    await d.cap('Commit class', 'One tap turns a group into a class of yours.');
    const commit = page.locator('.sf-panel .sf-group').filter({ hasText: 'Additional Mathematics' }).locator('[data-commit]');
    await d.click(commit); await d.wait(1500);
    await d.ringAround('.sf-linked', 'Additional', '.sf-group'); await d.wait(2000); await d.unring();
    await d.cap('It is an ordinary class now', 'Seating, E21CC tracking, lessons and assessment use it straight away.');
    await d.click(page.locator('.sf-linked a').filter({ hasText: 'Additional' })); await d.wait(1600);
    await d.scroll(null, 520, 22, 1100); await d.wait(2600);
    await d.endCard('Commit class', 'In Admin, under Student Finder.');
  }, async (page, d) => {
    await d.scroll(null, 650, 2, 50);
    await page.click('#student-finder [data-act="demo"]'); await page.waitForTimeout(800);
    await page.locator('.sf-panel').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    await d.scroll(null, -120, 2, 50);
  }],

  '05-observe': [BTY, '#/lessons', async (page, d) => {
    await d.card('Present', 'How do I note what a student showed, mid lesson?', 'Two taps, without leaving the lesson.');
    await d.cap('Press O while presenting', 'The competency this part of the lesson grows is already chosen.');
    await d.click('#present-observe'); await d.wait(1600);
    await d.cap('Tap the students you saw', 'Add a few words if you like, then say what you saw.');
    await d.click(page.locator('.obs-kid').nth(0)); await d.click(page.locator('.obs-kid').nth(2)); await d.click(page.locator('.obs-kid').nth(7));
    await d.click('#obs-note'); await page.locator('#obs-note').pressSequentially('Explained why toothpaste is a base', { delay: 40 });
    await d.wait(400);
    await d.click('[data-verdict="showed"]'); await d.wait(1500);
    await d.cap('Saved to each student', 'It shows on their profile, on the lesson, and in report comments.');
    await d.wait(2600);
    await d.endCard('Observe while you teach', 'Present, then O.');
  }, async (page) => {
    const id = await lessonId(page, 'Acids');
    await page.evaluate(i => { location.hash = '#/present/' + i; }, id); await page.waitForTimeout(1400);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(800);
    await page.evaluate(() => { try { localStorage.setItem('cocher2_observe_names', 'names'); } catch {} });
  }],

  '06-student-profile': [BTY, '#/lessons', async (page, d) => {
    await d.card('Classes', 'How do I see one student as a whole?', 'Their competencies across your classes, the evidence, and where they are heading.');
    await d.cap('Start from the evidence on a lesson', 'What you noted in Present, grouped by competency.');
    await d.ringAround('#lesson-evidence', '', ''); await d.wait(2200); await d.unring();
    await d.cap('Tap a name: their profile', 'E21CC in each of your classes, and the evidence behind it.');
    await d.click(page.locator('.evidence-student').first()); await d.wait(2600);
    await d.cap('Add the pathway they are aiming for', 'Paste the link the student shares from Paths. It never carries a name.');
    await d.click('#sp-paths');
    await page.locator('#sp-paths').fill(PATHS_LINK); await d.wait(900);
    await d.click('[data-act="paths-save"]'); await d.wait(1200);
    await d.ringAround('.sp-path', '', '.sp-sec'); await d.wait(2600); await d.unring();
    await d.endCard('One student, as a whole', 'From Classes, Search, or a lesson.');
  }, async (page) => {
    const id = await seedObservations(page);
    await page.evaluate(i => { location.hash = '#/lessons/' + i; }, id); await page.waitForTimeout(1500);
    await page.locator('#lesson-evidence').scrollIntoViewIfNeeded(); await page.evaluate(() => { const m = document.querySelector('.main-scroll'); if (m) m.scrollTop -= 140; });
  }],

  '07-paths': [BTY, '#/cce', async (page, d) => {
    await d.card('CCE2021', 'Where is Paths for ECG lessons?', 'In CCE2021, under ECG: the live Pathways app.');
    await d.cap('Open ECG', 'One of the six CCE content areas.');
    await d.click('.cce-tab[data-tab="ECG"]'); await d.wait(900);
    await d.cap('Paths answers “How do I get there?”', 'Always the latest Pathways, with nothing to copy.');
    await d.click('.cce-sub[data-ecg="paths"]');
    await page.waitForSelector('.ae-frame.ready', { timeout: 15000 }); await d.wait(1600);
    const f = frame(page);
    await d.cap('Use it with the class', 'Goals, routes and subject choices, on the class screen.');
    await d.click(f.locator('text=Goal').first()); await d.wait(2600);
    await d.click(f.locator('text=Explore').first()); await d.wait(2600);
    await d.endCard('Paths, inside ECG', 'Open to every school.');
  }],

  '08-learning-log': [BTY, '#/learning-log', async (page, d) => {
    await d.card('Classes · Beatty', 'What is the E21CC Learning Log?', 'Students’ own evidence for the competencies you track.');
    await page.waitForSelector('.ae-frame.ready', { timeout: 15000 });
    await d.cap('What students use', 'One log from Sec 1 to graduation, in their own words.');
    await d.wait(2600);
    await d.cap('Your teacher console', 'Entries your students send you, sealed by your PIN.');
    await d.click('.ll-btn[data-view="teacher"]'); await page.waitForSelector('.ae-frame.ready', { timeout: 15000 }); await d.wait(2400);
    await d.cap('Try the demo first', 'Made up students, nothing saved.');
    await d.click('.ll-btn[data-view="demo"]'); await page.waitForSelector('.ae-frame.ready', { timeout: 15000 });
    await d.click('.ll-part[data-part="student"]'); await page.waitForSelector('.ae-frame.ready', { timeout: 15000 }); await d.wait(1200);
    const f = frame(page);
    for (const t of ['Explore on my own', 'Skip the tour', 'Not now']) { const b = f.locator(`text=${t}`).first(); if (await b.isVisible().catch(() => false)) { await d.click(b); break; } }
    await d.wait(3200);
    await d.endCard('The E21CC Learning Log', 'In Classes, for Beatty.');
  }],

  '09-common-free-time': [BTY, '#/free-time', async (page, d) => {
    await d.card('Admin', 'When are my colleagues and I all free?', 'Common free time, read from the school timetable.');
    await d.cap('Pick your colleagues', 'Search by name or department.');
    await d.click(page.locator('.v3-person').nth(1)); await d.wait(500);
    await d.click(page.locator('.v3-person').nth(3)); await d.wait(900);
    await d.cap('Every slot when all of you are free', 'This week or next, day by day.');
    await d.ring(page.locator('.v3-slot').first().locator('xpath=ancestor::div[contains(@class,"v3-panel")][1]')); await d.wait(2600); await d.unring();
    await d.cap('Tap a slot to keep it', 'It becomes an entry on that day.');
    await d.click(page.locator('.v3-slot').first()); await d.wait(2400);
    await d.endCard('Common free time', 'In Admin.');
  }],

  '10-send-to-a-colleague': [BTY, '#/send', async (page, d) => {
    await d.card('Lessons', 'How do I pass my work to a colleague?', 'Tick what to send. One file goes out; it joins their work.');
    await d.cap('Tick what to send', 'Lessons, room layouts, entries, term goals: any mix.');
    await d.click(page.locator('input[data-g="lessons"]').nth(0)); await d.click(page.locator('input[data-g="lessons"]').nth(2)); await d.wait(500);
    await d.click(page.locator('.v3-pick summary').nth(1)); await d.wait(500);
    await d.click(page.locator('input[data-g="layouts"]').first()); await d.wait(900);
    await d.cap('Download one file', 'No student data goes in it. Pass it on by Teams or OneDrive.');
    await d.click('#sd-send'); await d.wait(2200);
    await d.scroll(null, -2000, 16, 700); await d.wait(300);
    await d.cap('Your colleague loads it here', 'Lessons arrive as drafts with your name. Anything they already hold is skipped.');
    await d.ring(page.locator('#sd-pick').locator('xpath=ancestor::div[contains(@class,"v3-panel")][1]')); await d.wait(3000); await d.unring();
    await d.endCard('Send to a colleague', 'In Lessons, under Send.');
  }],

  '11-make-it-yours': [BTY, '#/personal', async (page, d) => {
    await d.card('Personal', 'Can I change how Co-Cher looks?', 'Look, day or night, type, and where the menu sits.');
    await d.cap('Open Look and feel', 'In Personal. Changes apply at once.');
    await d.click('[data-act="look"]'); await d.wait(900);
    await d.cap('Pick a look', 'Your school’s colours come with every one, softened to suit.');
    await d.click('.v3-opt[data-key="look"][data-val="washi"]'); await d.wait(1500);
    await d.click('.v3-opt[data-key="look"][data-val="kiln"]'); await d.wait(1500);
    await d.cap('Day or night, and the menu', 'At the foot, at the side, or along the top.');
    await d.click('.v3-opt[data-key="night"][data-val="on"]'); await d.wait(1700);
    await d.click('.v3-opt[data-key="night"][data-val="off"]'); await d.wait(900);
    await d.click('.v3-opt[data-key="nav"][data-val="rail"]'); await d.wait(1800);
    await d.click('.v3-opt[data-key="nav"][data-val="dock"]'); await d.wait(600);
    await d.click('.v3-opt[data-key="look"][data-val="fjord"]'); await d.wait(1200);
    await d.endCard('Make it yours', 'Personal, then Look and feel.');
  }],
};

(async () => {
  const pick = process.argv.slice(2);
  for (const [name, [user, hash, script, pre]] of Object.entries(S)) {
    if (pick.length && !pick.some(p => name.startsWith(p))) continue;
    try { await take(name, user, hash, script, OUT, pre); }
    catch (e) { console.log(`${name} FAILED: ${e.message.split('\n')[0]}`); }
  }
})();
