// Co-Cher 2 demo snippets. Run: node snippets.cjs [name ...]   (no names = all)
const { take } = require('./rec.cjs');
const OUT = process.env.OUT_DIR || require('path').join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const BTY = { email: 'alex.lim@btyss.moe.edu.sg', name: 'Alex Lim', preferredName: 'Alex', schoolId: 'bty', schoolName: 'Beatty Secondary School' };
const SAJC = { email: 'demo.math@sajc.moe.edu.sg', name: 'Daniel Foo', preferredName: 'Daniel', schoolId: 'sajc', schoolName: 'St Andrew’s Junior College' };

const firstClassId = page => page.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('cocher2_app_data')); return JSON.parse(localStorage.getItem(k)).classes[0].id; });
const lessonId = (page, start) => page.evaluate(s => { const k = Object.keys(localStorage).find(k => k.startsWith('cocher2_app_data')); return JSON.parse(localStorage.getItem(k)).lessons.find(l => l.title.startsWith(s)).id; }, start);
const frame = page => page.frameLocator('.ae-frame');
// A made up Paths share link: Sec 3, six subjects, goal Nurse via Polytechnic. No name, as Paths links never carry one.
const PATHS_LINK = 'https://harmanjohll.github.io/genapp/pathways/?s=shared&for=teacher&d=' + Buffer.from(JSON.stringify({ v: 1, y: 'sec3', p: 'el3~em3~am3~phy3~chem3~geo2', g: { sector: 'health', role: 'Nurse', dest: 'poly', family: null } })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const S = {
  '01-your-day': [BTY, '#/', async (page, d) => {
    await d.card('Dashboard', 'Your day, at a glance', 'What is up next, what it needs, and the body of work you are building.');
    await d.cap('Up next, and the next step', 'Co-Cher reads your lessons and points to what to do now: here, rehearse.');
    await d.ringAround('div', 'UP NEXT', '.card');
    await d.move('text=Rehearse this lesson');
    await d.wait(2200); await d.unring();
    await d.cap('This week’s lessons', 'Each one tagged with its class and where it is in the cycle.');
    await d.move('text=Volcanoes & Earthquakes'); await d.wait(900);
    await d.move('text=Integration'); await d.wait(1400);
    await d.cap('Workflow modes reshape the app', 'Planning, Teaching Day, Assessment, Reflection: one tap changes the dashboard and the menu.');
    await d.click('.sidebar >> text=Teaching Day'); await d.wait(2600);
    await d.click('.sidebar >> text=Reflection'); await d.wait(2400);
    await d.click('.sidebar >> text=Planning'); await d.wait(2000);
    await d.endCard('Your day, at a glance', 'Dashboard and workflow modes.');
  }],

  '02-my-classes': [BTY, '#/classes', async (page, d) => {
    await d.card('My Classes', 'Every student, every competency', 'Classes with live E21CC profiles, ready for planning.');
    await d.cap('Your classes at a glance', 'Each card carries the class profile across the six E21CC areas.');
    await d.move('text=4B Combined Science'); await d.wait(900);
    await d.move('text=4A Pure Chemistry'); await d.wait(800);
    await d.click('text=4A Pure Chemistry');
    await d.wait(1200);
    await d.cap('The Class Portrait', 'Where the class is now, so every lesson starts from the learners.');
    await d.ringAround('h2, h3, div', 'Class Portrait', '.card'); await d.wait(2600); await d.unring();
    await d.cap('Each student’s E21CC levels', 'Update one student, or the whole class at once with Batch Update.');
    await d.scroll(null, 560, 22, 1100); await d.wait(900);
    await d.click(page.locator('button:has-text("Edit E21CC")').first()); await d.wait(2600);
    await page.keyboard.press('Escape'); await d.wait(700);
    await d.cap('Growth over time', 'Every update is kept, so trends show who is moving and who needs a nudge.');
    await d.click('button.tab[data-tab=trends]'); await d.wait(600);
    await d.scroll(null, 520, 22, 1100); await d.wait(2400);
    await d.endCard('Every student, every competency', 'My Classes, the Class Portrait and E21CC tracking.');
  }],

  '03-student-finder': [BTY, '#/admin', async (page, d) => {
    await d.card('Admin', 'Student Finder', 'Who teaches whom, from your school’s timetable. The file stays on this device.');
    await d.scroll(null, 650, 20, 900); await d.wait(500);
    await d.cap('Load the timetable, or try the demo', 'Only the columns Co-Cher needs are kept. Remarks and the like are left out.');
    await d.ringAround('#student-finder .card', '', ''); await d.wait(2200); await d.unring();
    await d.click('#student-finder [data-act="demo"]'); await d.wait(900);
    await d.click('.sf-tab[data-tab="students"]'); await d.wait(400);
    await d.cap('Find any student', 'Who teaches them each subject, where they are now, and which of your classes they are in.');
    await d.click('#sf-q');
    await page.locator('#sf-q').pressSequentially('Priya', { delay: 90 }); await d.wait(700);
    await d.click(page.locator('[data-student]').first()); await d.wait(800);
    await d.scroll(null, 330, 18, 900); await d.wait(2600);
    await d.cap('Or start from a teacher', 'Every group a teacher teaches, with its lesson times and students.');
    await d.scroll(null, -330, 14, 700);
    await d.click('.sf-tab[data-tab="teachers"]'); await d.wait(500);
    await d.move('#sf-teacher'); await page.selectOption('#sf-teacher', 'Ms Lee'); await d.wait(800);
    await d.click(page.locator('[data-toggle]').first()); await d.wait(2600);
    await d.endCard('Student Finder', 'In Admin. Student data stays on the device.');
  }],

  '04-commit-class': [BTY, '#/admin', async (page, d) => {
    await d.card('Student Finder', 'Commit class', 'Turn a teaching group or a form class into a class, in one tap.');
    await d.cap('Your teaching groups, from the timetable', 'Pick your name once. Your groups appear with their lesson times.');
    await d.ringAround('.sf-panel', '', ''); await d.wait(2600); await d.unring();
    const commit = page.locator('.sf-panel .sf-group').filter({ hasText: 'Additional Mathematics' }).locator('[data-commit]');
    await d.click(commit); await d.wait(1500);
    await d.cap('Committed: an ordinary class', 'Seating, E21CC tracking, lessons and assessment use it straight away.');
    await d.ringAround('.sf-linked', 'Additional', '.sf-group'); await d.wait(2600); await d.unring();
    await d.click(page.locator('.sf-linked a').filter({ hasText: 'Additional' })); await d.wait(1600);
    await d.cap('Commit again any time', 'It updates the same class. Nobody is doubled, and what you hold on a student is kept.');
    await d.wait(1200);
    await d.scroll(null, 520, 22, 1100); await d.wait(3000);
    await d.endCard('Commit class', 'From timetable to My Classes, without retyping a name.');
  }, async (page, d) => {
    await d.scroll(null, 650, 2, 50);
    await page.click('#student-finder [data-act="demo"]'); await page.waitForTimeout(800);
    await page.locator('.sf-panel').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    await d.scroll(null, -120, 2, 50);
  }],

  '05-plan-to-present': [BTY, '#/lessons', async (page, d) => {
    await d.card('Lessons', 'From plan to Present', 'A lesson carries its focus, staging, resources and slides into the room.');
    await d.cap('Your lessons, each with its E21CC focus', 'Ready, draft or done, with the class it is for.');
    await d.move('text=Volcanoes & Earthquakes'); await d.wait(900);
    await d.click('text=Acids, Bases & Salts'); await d.wait(1400);
    await d.cap('Design, prepare, rehearse, teach, reflect', 'Each lesson shows where it is in the cycle, and the next step.');
    await d.ringAround('div', 'Rehearse this lesson', '.card'); await d.wait(2600); await d.unring();
    await d.cap('Simulations and slides, attached', 'The run of show links the titration simulation and the lesson deck.');
    await d.move('#present-lesson-btn'); await d.wait(300);
    await d.scroll(null, 900, 26, 1400); await d.wait(800);
    await d.ringAround('.seg-sim-btn', '', ''); await d.wait(1500); await d.unring();
    await d.scroll(null, -900, 20, 900);
    await d.cap('Present, with one tap', 'The lesson goes full screen, segment by segment.');
    await d.click('#present-lesson-btn'); await d.wait(2400);
    await page.keyboard.press('ArrowRight'); await d.wait(1800);
    await page.keyboard.press('ArrowRight'); await d.wait(1800);
    await d.endCard('From plan to Present', 'Lessons, the lesson cycle and Present mode.');
  }],

  '06-spatial-designer': [BTY, '#/spatial', async (page, d) => {
    await d.card('Spatial Designer', 'Design the room for the learning', 'Lay out the space, and see how well it supports the lesson.');
    await d.cap('Start from a saved layout', 'Discussion pods, exam rows, or your own, for any class.');
    await d.click(page.locator('text=Discussion Pods (32)').first()); await d.wait(2200);
    await d.cap('Spatial effectiveness, scored as you arrange', 'Sightlines, mobility, flexibility, density, modality and environment.');
    await d.ringAround('div', 'Spatial Effectiveness', '.card, aside, section'); await d.wait(2800); await d.unring();
    await d.cap('Swap the layout, see the trade offs', 'Exam rows score differently from pods: the radar shows why.');
    await d.click(page.locator('text=Exam Rows (single)').first()); await d.wait(2800);
    await d.click(page.locator('text=Chemistry').filter({ hasText: 'Discussion Pods' }).first()); await d.wait(2400);
    await d.endCard('Spatial Designer', 'Rooms designed around the learning.');
  }],

  '07-cce-and-paths': [BTY, '#/cce', async (page, d) => {
    await d.card('CCE2021', 'CCE2021, with Paths in ECG', 'Six content areas, a discussion generator, and the live Pathways app.');
    await d.cap('Six content areas', 'NE, SEd, MH, ECG, CW and FE, each with its framework and discussion formats.');
    await d.click('.cce-tab[data-tab="MH"]'); await d.wait(1200);
    await d.click('.cce-tab[data-tab="CW"]'); await d.wait(1200);
    await d.click('.cce-tab[data-tab="ECG"]'); await d.wait(900);
    await d.cap('Paths answers “How do I get there?”', 'ECG’s third question, answered by the live Pathways app.');
    await d.click('.cce-sub[data-ecg="paths"]');
    await page.waitForSelector('.ae-frame.ready', { timeout: 15000 }); await d.wait(1600);
    await d.cap('Always the latest Paths', 'Every update to Pathways shows here, with nothing to copy. Open to every school.');
    const f = frame(page);
    await d.click(f.locator('text=Goal').first()); await d.wait(2600);
    await d.click(f.locator('text=Explore').first()); await d.wait(2600);
    await d.endCard('CCE2021 and Paths', 'Open to every school.');
  }],

  '08-learning-log': [BTY, '#/learning-log', async (page, d) => {
    await d.card('Culture \u00b7 Beatty', 'The E21CC Learning Log', 'Students\u2019 own evidence for the competencies you track, beside your classes.');
    await page.waitForSelector('.ae-frame.ready', { timeout: 15000 });
    await d.cap('What students use', 'One log from Sec 1 to graduation: reflections, goals and evidence, in their own words.');
    await d.wait(2600);
    await d.cap('Your teacher console', 'Entries your students send you, and your replies, sealed by your PIN.');
    await d.click('.ll-btn[data-view="teacher"]'); await page.waitForSelector('.ae-frame.ready', { timeout: 15000 }); await d.wait(2400);
    await d.click('.ll-btn[data-view="demo"]'); await page.waitForSelector('.ae-frame.ready', { timeout: 15000 });
    await d.cap('Inside a student\u2019s log', 'The demo: made up students, nothing saved. Each competency, its level, and the next step.');
    await d.click('.ll-part[data-part="student"]'); await page.waitForSelector('.ae-frame.ready', { timeout: 15000 }); await d.wait(1200);
    const f = frame(page);
    for (const t of ['Explore on my own', 'Skip the tour', 'Not now']) { const b = f.locator(`text=${t}`).first(); if (await b.isVisible().catch(() => false)) { await d.click(b); break; } }
    await d.wait(3400);
    await d.cap('What the teacher sees', 'The class at a glance: who has shared, and where each student is.');
    await d.click('.ll-part[data-part="teacher"]'); await page.waitForSelector('.ae-frame.ready', { timeout: 15000 }); await d.wait(1200);
    await d.click(f.locator('text=Explore on my own').first()).catch(() => {}); await d.wait(600);
    await d.click(f.locator('text=Class grid').first()).catch(() => {}); await d.wait(3000);
    await d.endCard('The E21CC Learning Log', 'For Beatty, under My Classes.');
  }],

  '09-assessment': [BTY, '#/assessment/aal', async (page, d) => {
    await d.card('Assessment', 'AaL, AfL and AoL', 'Metacognition, formative strategies and summative design, in one place.');
    await d.cap('Assessment as Learning', 'Metacognition frameworks that help students steer their own learning.');
    await d.scroll(null, 520, 24, 1400); await d.wait(2400);
    await d.go('#/assessment/afl');
    await d.cap('Assessment for Learning', 'Formative strategies, from learning intentions and success criteria onwards.');
    await d.scroll(null, 520, 24, 1400); await d.wait(2400);
    await d.go('#/assessment/aol');
    await d.cap('Assessment of Learning', 'Build a Table of Specifications: objectives, cognitive levels and marks.');
    await d.ringAround('div', 'Setup', '.card'); await d.wait(1800); await d.unring();
    await d.scroll(null, 480, 24, 1400); await d.wait(2200);
    await d.endCard('AaL, AfL and AoL', 'The assessment stages, side by side.');
  }],

  '10-simulations-tools': [BTY, '#/simulations', async (page, d) => {
    await d.card('Enactment', 'Simulations and subject tools', 'Interactive practicals, and tools for Music, Art, D&T and NFS.');
    await d.cap('Interactive practicals', 'Biology, Chemistry and Physics, filtered in a tap and attachable to any lesson.');
    await d.click('.sim-filter-tab[data-filter="Chemistry"]'); await d.wait(1200);
    await d.click('.sim-filter-tab[data-filter="Physics"]'); await d.wait(1200);
    await d.click('.sim-filter-tab[data-filter="All"]'); await d.wait(600);
    await d.click('.sim-launch-btn[data-sim-id="diffusion"]'); await d.wait(3800);
    await page.keyboard.press('Escape'); await d.wait(600);
    await d.go('#/subject-tools');
    await d.cap('Subject tools', 'A beat grid, stave notation, art critique, design process and kitchen layout.');
    await d.move('text=Rhythm & Percussion'); await d.wait(800);
    await d.move('text=Stave Notation'); await d.wait(1000);
    await d.click(page.locator('text=Open').first()); await d.wait(1200);
    await d.click(page.locator('text=Launch Rhythm Tool').first()).catch(() => {}); await d.wait(3200);
    await d.endCard('Simulations and subject tools', 'For every subject, ready in the lesson.');
  }],

  '11-resources-library': [BTY, '#/stimulus-material', async (page, d) => {
    await d.card('Resources', 'Materials that stay with you', 'Stimulus passages, source sets, decks and audio, saved and reusable.');
    await d.cap('Stimulus materials', 'Comprehension passages, scenarios and texts, curated and adapted.');
    await d.scroll(null, 420, 22, 1200); await d.wait(1600);
    await d.go('#/source-analysis');
    await d.cap('Source analysis', 'Source based question sets for Humanities and GP.');
    await d.scroll(null, 420, 22, 1200); await d.wait(1600);
    await d.go('#/library');
    await d.cap('The Library', 'Everything you have saved, ready to attach to a lesson or reopen where it was made.');
    await d.wait(1200);
    await d.cap('Reopen anything', 'A saved deck opens straight into the slide viewer.');
    await d.click(page.locator('text=Open deck').nth(1)); await d.wait(2400);
    await page.keyboard.press('ArrowRight'); await d.wait(1600);
    await page.keyboard.press('ArrowRight'); await d.wait(1600);
    await d.endCard('Materials that stay with you', 'Stimulus, sources and the Library.');
  }],

  '12-find-anything': [BTY, '#/', async (page, d) => {
    await d.card('Search', 'Find anything, fast', 'One search across lessons, classes, materials and tools.');
    await d.cap('Press Ctrl K anywhere', 'Search opens over whatever you are doing.');
    await d.wait(800);
    await page.keyboard.press('Control+k'); await d.wait(900);
    const input = page.locator('#unified-search-overlay input').first();
    await input.pressSequentially('acid', { delay: 140 }); await d.wait(2800);
    await d.cap('Students and classes too', 'Type a student\u2019s name to find their class.');
    await input.fill(''); await input.pressSequentially('Priya', { delay: 130 }); await d.wait(2400);
    await d.cap('Lessons, classes, materials, tools', 'Pick a result and you are there.');
    await input.fill(''); await input.pressSequentially('volcano', { delay: 120 }); await d.wait(2000);
    await page.keyboard.press('Enter'); await d.wait(1600);
    await page.keyboard.press('ArrowRight'); await d.wait(1800);
    await d.endCard('Find anything, fast', 'Ctrl K, from anywhere in Co-Cher.');
  }],

  '13-every-school': [SAJC, '#/my-timetable', async (page, d) => {
    await d.card('Every school, its own space', 'Your week, already loaded', 'Each school gets its own space, colours, levels and timetable.');
    await d.cap('Your timetable, without retyping', 'Here, a demo teacher at SAJC: the week is in place from the first sign in.');
    await d.ringAround('div', 'Mon', '.card'); await d.wait(2400); await d.unring();
    await d.cap('Odd and even weeks', 'The cycle your school runs on, with lessons, duty, PD and school events.');
    await d.click(page.locator('text=Even week').first()); await d.wait(2200);
    await d.click(page.locator('text=Odd week').first()); await d.wait(1600);
    await d.go('#/classes');
    await d.cap('Your school\u2019s own words', 'Levels, subjects and class codes follow the school: JC here, Primary at Park View.');
    await d.move('text=25S03 H2 Chemistry'); await d.wait(1400);
    await d.move('text=25S03 General Paper'); await d.wait(1600);
    await d.endCard('Every school, its own space', 'Beatty, Park View, Opera Estate and SAJC.');
  }],
  '14-observe-in-present': [BTY, '#/lessons', async (page, d) => {
    await d.card('Present', 'Observe, while you teach', 'Note who showed a competency, in two taps, without leaving the lesson.');
    await d.cap('Press O in Present', 'The Observe panel opens beside the lesson. The competency this part grows is already chosen.');
    await d.click('#present-observe'); await d.wait(1600);
    await d.cap('Pick the students you saw', 'Tap names, add a few words if you like.');
    await d.click(page.locator('.obs-kid').nth(0)); await d.click(page.locator('.obs-kid').nth(2)); await d.click(page.locator('.obs-kid').nth(7));
    await d.click('#obs-note'); await page.locator('#obs-note').pressSequentially('Explained why toothpaste is a base', { delay: 45 });
    await d.wait(400);
    await d.click('[data-verdict="showed"]'); await d.wait(1500);
    await d.cap('Projector on? Show initials', 'And switch competency in a tap: here, working towards Collaboration.');
    await d.click('[data-act="names"]'); await d.wait(900);
    await d.click(page.locator('.obs-kid').nth(4)); await d.click('[data-comp="collaboration"]');
    await d.click('[data-verdict="towards"]'); await d.wait(1600);
    await d.cap('Saved to each student, linked to this lesson', 'It shows on their profile, the lesson page and in report comments.');
    await d.click('[data-act="names"]'); await d.wait(1800);
    await d.endCard('Observe, while you teach', 'Present mode, then O.');
  }, async (page) => {
    const id = await lessonId(page, 'Acids');
    await page.evaluate(i => { location.hash = '#/present/' + i; }, id); await page.waitForTimeout(1400);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(800);
    try { localStorage.setItem('cocher2_observe_names', 'names'); } catch {}
  }],

  '15-student-profile': [BTY, '#/lessons', async (page, d) => {
    await d.card('Every student, as one person', 'A profile for every student', 'Competencies across your classes, the evidence, and the pathway they are aiming for.');
    await d.cap('Evidence from this lesson', 'What you observed in Present, grouped by competency. Add it to your reflection in a tap.');
    await d.ringAround('#lesson-evidence', '', ''); await d.wait(1800); await d.unring();
    await d.click('#evidence-to-reflection'); await d.wait(1800);
    await d.scroll(null, -700, 16, 700);
    await d.cap('Tap a name: their profile', 'E21CC in each of your classes, the trend, and the evidence behind it.');
    await d.click(page.locator('.evidence-student').first()); await d.wait(2600);
    await d.cap('Add the pathway they are aiming for', 'Paste the link the student shares from Paths. It carries their year, subjects and goal, never their name.');
    await d.click('#sp-paths');
    await page.locator('#sp-paths').fill(PATHS_LINK); await d.wait(900);
    await d.click('[data-act="paths-save"]'); await d.wait(1200);
    await d.ringAround('.sp-path', '', '.sp-sec'); await d.wait(2600); await d.unring();
    await d.endCard('A profile for every student', 'From My Classes, search, or a lesson.');
  }, async (page) => {
    const id = await lessonId(page, 'Acids');
    await page.evaluate(i => { location.hash = '#/present/' + i; }, id); await page.waitForTimeout(1400);
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
    await page.keyboard.press('o'); await page.waitForTimeout(500);
    await page.locator('.obs-kid').nth(0).click(); await page.locator('.obs-kid').nth(2).click(); await page.locator('.obs-kid').nth(7).click();
    await page.fill('#obs-note', 'Explained why toothpaste is a base');
    await page.locator('[data-verdict="showed"]').click();
    await page.locator('.obs-kid').nth(4).click(); await page.locator('[data-comp="collaboration"]').click(); await page.locator('[data-verdict="towards"]').click();
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await page.evaluate(i => { location.hash = '#/lessons/' + i; }, id); await page.waitForTimeout(1500);
    await page.locator('#lesson-evidence').scrollIntoViewIfNeeded(); await page.evaluate(() => { const m = document.querySelector('.main-scroll'); if (m) m.scrollTop -= 140; });
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
