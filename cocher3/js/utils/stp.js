/*
 * Singapore Teaching Practice (STP) — Teaching Areas & Teaching Actions
 * ====================================================================
 * One centralised, student/teacher-split vocabulary shared by the Lesson
 * Planner (segment authoring), Present mode (student-facing framing), and the
 * AI stager. Modelled on the CCE modality picker (views/cce.js
 * DISCUSSION_FORMATS): a fixed, grouped list with an "Other -> free text"
 * escape hatch, each option carrying BOTH a teacher hint and a student-facing
 * framing — the same teacher/student split the framework model uses
 * (stage.prompt vs stage.studentPrompt) and that Present relies on.
 *
 * Teaching Areas are drawn from STP's Lesson Enactment process — the arc a
 * lesson moves through. Teaching Actions are enactable moves a teacher selects
 * and adapts; nothing here is prescriptive or auto-applied. The teacher leads.
 */

/* STP Lesson-Enactment Teaching Areas (the lesson arc), each with a signpost
 * icon reused by the cockpit + Present renders. */
export const TEACHING_AREAS = [
  { key: 'activate_prior',   label: 'Activating Prior Knowledge',        icon: '\u{1F511}' }, // key
  { key: 'arouse_interest',  label: 'Arousing Interest',                 icon: '\u{2728}'  }, // sparkles
  { key: 'encourage_engage', label: 'Encouraging Learner Engagement',    icon: '\u{1F91D}' }, // handshake
  { key: 'deepen_questions', label: 'Using Questions to Deepen Learning', icon: '\u{1F4AC}' }, // speech
  { key: 'collaborative',    label: 'Facilitating Collaborative Learning', icon: '\u{1F465}' }, // people
  { key: 'conclude',         label: 'Concluding the Lesson',             icon: '\u{1F3C1}' }, // flag
];

export const TEACHING_AREA_LABELS = Object.fromEntries(TEACHING_AREAS.map(a => [a.key, a.label]));
export const TEACHING_AREA_ICONS = Object.fromEntries(TEACHING_AREAS.map(a => [a.key, a.icon]));

/* Teaching Actions per area. Each: { id, label, teacherHint, studentFraming }.
 * studentFraming is the student-facing phrasing surfaced in Present. */
export const TEACHING_ACTIONS = {
  activate_prior: [
    { id: 'stw', label: 'See-Think-Wonder',
      teacherHint: 'Show a stimulus; students note what they See, Think, Wonder. Their Wonder can seed the question.',
      studentFraming: 'Look closely. What do you SEE? What do you THINK is happening? What do you WONDER?' },
    { id: 'entry_poll', label: 'Entry poll / recall',
      teacherHint: 'A quick question to surface what students already remember.',
      studentFraming: 'Quick check-in: what do you already know about this?' },
    { id: 'kwl', label: 'K-W-L',
      teacherHint: 'Know / Want to know / Learned — start the first two columns.',
      studentFraming: 'What do you KNOW? What do you WANT to find out?' },
    { id: 'analogy', label: 'Analogy bridge',
      teacherHint: 'Anchor the new idea to a familiar one.',
      studentFraming: "Here's something familiar — how might it be like today's idea?" },
  ],
  arouse_interest: [
    { id: 'real_world', label: 'Real-world hook',
      teacherHint: 'Open with a local, relevant phenomenon that begs explaining.',
      studentFraming: "Here's something real — why does it happen?" },
    { id: 'discrepant', label: 'Discrepant event / demo',
      teacherHint: 'Show something that violates expectations.',
      studentFraming: 'Watch this. Did it do what you expected?' },
    { id: 'provocation', label: 'Provocation question',
      teacherHint: 'Pose a bold or counter-intuitive claim to react to.',
      studentFraming: 'Do you agree or disagree — and why?' },
    { id: 'story', label: 'Story / anecdote',
      teacherHint: 'A 30-second story that frames the stakes.',
      studentFraming: "Listen to this — what's going on here?" },
  ],
  encourage_engage: [
    { id: 'poe', label: 'Predict-Observe-Explain',
      teacherHint: 'Students predict, then test, then reconcile the difference.',
      studentFraming: 'Predict first. Then observe. Then explain the gap.' },
    { id: 'tps', label: 'Think-Pair-Share',
      teacherHint: 'Individual think, pair to compare, share out.',
      studentFraming: 'Think on your own -> compare with a partner -> share.' },
    { id: 'stations', label: 'Station rotation',
      teacherHint: 'Small groups rotate through set tasks.',
      studentFraming: 'Work through each station with your group.' },
    { id: 'hands_on', label: 'Hands-on task',
      teacherHint: 'Students manipulate materials to build the idea.',
      studentFraming: 'Get hands-on — build it and see.' },
  ],
  deepen_questions: [
    { id: 'funnel', label: 'Funnelling questions',
      teacherHint: 'Sequence questions from open to focused; hold wait-time.',
      studentFraming: 'Think it through — be ready to explain your reasoning.' },
    { id: 'socratic', label: 'Socratic dialogue',
      teacherHint: 'Probe assumptions and evidence through dialogue.',
      studentFraming: 'What makes you say that? What is your evidence?' },
    { id: 'hot_seat', label: 'Hot Seat',
      teacherHint: 'A student answers sustained questions on a claim or in role.',
      studentFraming: 'In the hot seat: defend your thinking.' },
    { id: 'sac', label: 'Structured Academic Controversy',
      teacherHint: 'Groups argue both sides, then seek consensus.',
      studentFraming: 'Argue both sides — then find where you agree.' },
  ],
  collaborative: [
    { id: 'jigsaw', label: 'Jigsaw',
      teacherHint: 'Experts learn a part, then teach their home group.',
      studentFraming: 'Become the expert on your part, then teach your group.' },
    { id: 'group_investigation', label: 'Group investigation',
      teacherHint: 'Groups pursue a shared question and report back.',
      studentFraming: 'Investigate together — plan, divide, report.' },
    { id: 'peer_teaching', label: 'Peer teaching',
      teacherHint: 'Students explain to one another.',
      studentFraming: 'Teach it to a classmate — can they follow?' },
    { id: 'four_corners', label: 'Four Corners',
      teacherHint: 'Students move to a corner for a stance, then debate.',
      studentFraming: 'Pick your corner — then defend your choice.' },
  ],
  conclude: [
    { id: 'exit_ticket', label: 'Exit ticket',
      teacherHint: 'A short prompt captures the key takeaway.',
      studentFraming: 'Before you go: answer this to show what you have got.' },
    { id: 'grow_selfcheck', label: 'GROW self-check',
      teacherHint: 'Students reflect with the GROW routine.',
      studentFraming: 'One thing you understand · one gap · a real-life example.' },
    { id: 'three_two_one', label: '3-2-1',
      teacherHint: '3 things learned, 2 questions, 1 connection.',
      studentFraming: '3 things you learned · 2 questions · 1 connection.' },
    { id: 'one_sentence', label: 'One-sentence summary',
      teacherHint: 'Distil the lesson to a single sentence.',
      studentFraming: 'Sum up today in one sentence.' },
    { id: 'muddiest', label: 'Muddiest point',
      teacherHint: 'Students name what is still unclear.',
      studentFraming: 'What is still the muddiest point for you?' },
  ],
};

/* "Other" escape hatch id — reveals a free-text field, like CCE's "Others". */
export const TEACHING_ACTION_OTHER = 'other';

export function actionsForArea(areaKey) {
  return TEACHING_ACTIONS[areaKey] || [];
}

/* Resolve a segment's chosen Teaching Action to a display object
 * { id, label, teacherHint, studentFraming }, or null if none chosen.
 * Handles the "other -> free text" case (teacher's own action name). */
export function resolveTeachingAction(seg) {
  if (!seg || !seg.teachingAction) return null;
  if (seg.teachingAction === TEACHING_ACTION_OTHER) {
    const custom = String(seg.teachingActionOther || '').trim();
    return custom ? { id: 'other', label: custom, teacherHint: '', studentFraming: custom } : null;
  }
  return actionsForArea(seg.teachingArea).find(a => a.id === seg.teachingAction) || null;
}


/* ══════════ The whole of the STP's Pedagogical Practices ══════════
 * ONE source for the four Teaching Processes and their 24 Teaching Areas, by
 * their own names. Everything in Co-Cher that speaks of the STP reads from
 * here: the trail across the top of the lesson screens, the planner's next
 * step, what the AI is told, and the reference page in the Knowledge Base.
 * (Before this, three places described the STP in three different wordings,
 * none of them the Teaching Areas' real names.)
 *
 * The processes are not a ladder. Positive Classroom Culture runs through all
 * the others, and a teacher moves back and forth between them. The TRAIL below
 * is only the order a single lesson is usually worked on, with Reflect added
 * as the teacher's own reflective practice that turns one lesson into the next.
 *
 * Source: MOE, The Singapore Teaching Practice. Written from memory of the
 * published model; the owner should check the wording against the STP.
 */
export const TEACHING_PROCESSES = [
  { key: 'culture', label: 'Positive Classroom Culture', short: 'Culture', areas: [
    'Establishing Interaction and Rapport', 'Maintaining Positive Discipline', 'Setting Expectations and Routines', 'Building Trust', 'Empowering Learners'] },
  { key: 'preparation', label: 'Lesson Preparation', short: 'Prepare', areas: [
    'Determining Lesson Objectives', 'Considering Learners\u2019 Profiles', 'Selecting and Sequencing Content', 'Planning Key Questions', 'Sequencing Learning',
    'Deciding on Instructional Strategies', 'Deciding on Teaching Aids and Learning Resources'] },
  { key: 'enactment', label: 'Lesson Enactment', short: 'Enact', areas: [
    'Activating Prior Knowledge', 'Arousing Interest', 'Encouraging Learner Engagement', 'Exercising Flexibility', 'Providing Clear Explanation',
    'Pacing and Maintaining Momentum', 'Facilitating Collaborative Learning', 'Using Questions to Deepen Learning', 'Concluding the Lesson'] },
  { key: 'assessment', label: 'Assessment and Feedback', short: 'Assess', areas: [
    'Checking for Understanding and Providing Feedback', 'Supporting Self-directed Learning', 'Setting Meaningful Assignments'] },
];
export const processByKey = (key) => TEACHING_PROCESSES.find(p => p.key === key) || null;

/* The trail a lesson follows through the app. Each step is a Teaching Process
 * (or Reflect), with the place in Co-Cher where that work is done. */
export const STP_TRAIL = [
  { key: 'preparation', label: 'Lesson Preparation', route: '/plan', hint: 'Objectives, learners, content, questions, strategies, resources' },
  { key: 'enactment', label: 'Lesson Enactment', route: '/lessons', hint: 'Teach it: interest, engagement, explanation, questions, pace' },
  { key: 'assessment', label: 'Assessment and Feedback', route: '/assessment/afl', hint: 'Check for understanding, feed back, set meaningful work' },
  { key: 'reflect', label: 'Reflect', route: '/now', hint: 'What worked, what to change: it shapes the next lesson' },
];

/** The STP in plain text, for the AI: the processes, their Teaching Areas, and how to use them in a plan. */
export function stpPromptText() {
  return TEACHING_PROCESSES.map(p => `${p.label}: ${p.areas.join('; ')}.`).join('\n');
}
