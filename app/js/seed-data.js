/*
 * Co-Cher Seed Data
 * =================
 * Pre-populates 3 GCE O Level / G3 classes with 32 students each.
 * Students have Singapore-representative names (Chinese, Malay, Indian, Eurasian).
 */

import { Store, generateId } from './state.js';

const SEED_KEY = 'cocher_seeded';
const ASSESSMENT_SEED_KEY = 'cocher_assessment_seeded';

/* ── Built-in Metacognitive Routines ── */
const BUILT_IN_ROUTINES = [
  {
    name: 'GROW',
    description: 'A metacognitive routine for students to reflect on their learning journey — Gift, Rise, Own, Watch.',
    isBuiltIn: true,
    steps: [
      { key: 'G', label: 'Gift yourself success', colour: '#22c55e',
        description: 'Recognise and celebrate what you have achieved so far.',
        questions: ['What is one thing you did well in this lesson/task?', 'What strength did you use to help you learn today?'] },
      { key: 'R', label: 'Rise above one challenge', colour: '#f59e0b',
        description: 'Identify a challenge you faced and how you overcame or plan to overcome it.',
        questions: ['What was the hardest part for you?', 'What strategy did you use (or could you use) to get through it?'] },
      { key: 'O', label: 'Own your knowledge', colour: '#3b82f6',
        description: 'Take ownership of what you now know or can do.',
        questions: ['What is the most important thing you learned today?', 'How would you explain it to a friend who was absent?'] },
      { key: 'W', label: 'Watch what comes next', colour: '#8b5cf6',
        description: 'Look ahead — set a goal or identify what you want to learn next.',
        questions: ['What will you focus on improving next time?', 'What question do you still have?'] },
    ]
  },
  {
    name: 'See-Think-Wonder',
    description: 'Harvard Project Zero routine — separates observation from interpretation and questioning.',
    isBuiltIn: true,
    steps: [
      { key: 'S', label: 'See', colour: '#3b82f6',
        description: 'What do you observe? Stick to facts — no interpretation yet.',
        questions: ['What do you notice?', 'What stands out to you?'] },
      { key: 'T', label: 'Think', colour: '#f59e0b',
        description: 'What do you think is going on? Interpret what you see.',
        questions: ['What do you think about what you see?', 'What does it make you think of?'] },
      { key: 'W', label: 'Wonder', colour: '#8b5cf6',
        description: 'What questions does it raise?',
        questions: ['What does it make you wonder?', 'What would you like to find out?'] },
    ]
  },
  {
    name: 'Connect-Extend-Challenge',
    description: 'Link new learning to prior knowledge, extend thinking, and identify challenges.',
    isBuiltIn: true,
    steps: [
      { key: 'C', label: 'Connect', colour: '#3b82f6',
        description: 'How do the ideas connect to what you already know?',
        questions: ['What connections can you make to things you already knew?', 'How does this link to previous lessons?'] },
      { key: 'E', label: 'Extend', colour: '#10b981',
        description: 'What new ideas pushed your thinking further?',
        questions: ['What new ideas extended your thinking in new directions?', 'What surprised you?'] },
      { key: 'Ch', label: 'Challenge', colour: '#ef4444',
        description: 'What is still challenging or confusing?',
        questions: ['What is still challenging or confusing for you?', 'What questions do you still have?'] },
    ]
  },
  {
    name: '3-2-1',
    description: 'Quick reflection: 3 things learned, 2 questions, 1 insight.',
    isBuiltIn: true,
    steps: [
      { key: '3', label: '3 Things I Learned', colour: '#3b82f6',
        description: 'List three things you learned or found interesting.',
        questions: ['What are three things you learned today?', 'Which facts or ideas stood out?'] },
      { key: '2', label: '2 Questions I Have', colour: '#f59e0b',
        description: 'What two questions do you still have?',
        questions: ['What are two things you are still curious about?', 'What would you like explained further?'] },
      { key: '1', label: '1 Key Takeaway', colour: '#22c55e',
        description: 'What is the single most important thing from today?',
        questions: ['What is the one thing you will remember most?', 'If you could tell someone one thing about today\u2019s lesson, what would it be?'] },
    ]
  },
  {
    name: 'I Used to Think\u2026 Now I Think',
    description: 'Captures conceptual change — powerful for revealing shifts in understanding.',
    isBuiltIn: true,
    steps: [
      { key: 'B', label: 'I Used to Think', colour: '#6366f1',
        description: 'What did you believe or think before this lesson?',
        questions: ['Before this lesson, what did you think about this topic?', 'What was your initial understanding?'] },
      { key: 'A', label: 'Now I Think', colour: '#10b981',
        description: 'How has your thinking changed? What do you now understand?',
        questions: ['How has your thinking changed after this lesson?', 'What new understanding do you have now?'] },
    ]
  },
];

/* ── Built-in Observation Checklists ── */
const BUILT_IN_CHECKLISTS = [
  {
    name: 'GPAI \u2014 Game Performance',
    type: 'observation',
    subject: 'PE',
    isBuiltIn: true,
    criteria: [
      { text: 'Decision Making \u2014 Makes appropriate choices about what to do with the ball', scale: '1-5' },
      { text: 'Skill Execution \u2014 Efficient execution of selected skills (passing, shooting, etc.)', scale: '1-5' },
      { text: 'Support \u2014 Off-the-ball movement to receive a pass', scale: '1-5' },
      { text: 'Guard/Mark \u2014 Positioning between opponent and goal/target', scale: '1-5' },
      { text: 'Cover \u2014 Defensive help and backing up teammates', scale: '1-5' },
      { text: 'Adjust \u2014 Movement to flow of the game (repositioning)', scale: '1-5' },
      { text: 'Base \u2014 Returns to home/recovery position between plays', scale: '1-5' },
    ]
  },
  {
    name: 'Lab Skills Observation',
    type: 'observation',
    subject: 'Science',
    isBuiltIn: true,
    criteria: [
      { text: 'Safety \u2014 Follows lab safety procedures (goggles, gloves, awareness)', scale: 'rag' },
      { text: 'Apparatus Handling \u2014 Sets up and uses equipment correctly', scale: 'rag' },
      { text: 'Measurement \u2014 Takes accurate readings and records data', scale: 'rag' },
      { text: 'Procedure \u2014 Follows steps methodically and independently', scale: 'rag' },
      { text: 'Teamwork \u2014 Collaborates effectively with lab partner(s)', scale: 'rag' },
      { text: 'Clean-up \u2014 Returns equipment and cleans workstation', scale: 'rag' },
    ]
  },
  {
    name: 'Oral Presentation',
    type: 'observation',
    subject: 'General',
    isBuiltIn: true,
    criteria: [
      { text: 'Content \u2014 Accuracy, depth, and relevance of information', scale: '1-5' },
      { text: 'Organisation \u2014 Clear structure (intro, body, conclusion)', scale: '1-5' },
      { text: 'Delivery \u2014 Eye contact, voice projection, pacing', scale: '1-5' },
      { text: 'Engagement \u2014 Holds audience attention, uses visuals effectively', scale: '1-5' },
      { text: 'Response to Questions \u2014 Answers audience questions confidently', scale: '1-5' },
    ]
  },
];

/* ── Student name pools ── */
const NAMES = [
  // Class 1: Pure Chemistry
  'Tan Wei Lin', 'Muhammad Irfan', 'Priya Nair', 'Lim Jia Xuan',
  'Nur Aisyah', 'Raj Kumar', 'Chua Kai Wen', 'Siti Nurhaliza',
  'Arun Pillai', 'Ng Mei Ting', 'Ahmad Farhan', 'Kavitha Devi',
  'Ong Zhi Hao', 'Nurul Huda', 'Deepak Rajan', 'Chong Shu Min',
  'Iskandar Shah', 'Lakshmi Menon', 'Lee Jing Yi', 'Faizal Rahman',
  'Ananya Sharma', 'Wong Jia Hao', 'Hakim Abdullah', 'Revathi Suresh',
  'Koh Wen Xin', 'Zulkifli Omar', 'Meera Krishnan', 'Teo Yong Sheng',
  'Aina Batrisyia', 'Vikram Singh', 'Chan Hui Wen', 'Rashid Ismail',

  // Class 2: Combined Science
  'Lim Jun Wei', 'Nur Farhana', 'Arjun Reddy', 'Tan Xin Yi',
  'Muhammad Haziq', 'Divya Lakshmi', 'Goh Kai Ming', 'Siti Aminah',
  'Suresh Kumar', 'Ng Pei Shan', 'Amirul Hakim', 'Preethi Ravi',
  'Ong Jia Ying', 'Firdaus Malik', 'Rani Devi', 'Chua Wen Hao',
  'Nurul Izzah', 'Karthik Nair', 'Lee Hui Min', 'Zainab Bee',
  'Ravi Shankar', 'Wong Zi Xuan', 'Hafiz Azman', 'Amrita Kaur',
  'Koh Jia Wen', 'Shahirah Yusof', 'Dinesh Pillai', 'Teo Li Ting',
  'Aishah Zainal', 'Ganesh Babu', 'Chan Yee Heng', 'Nur Syafiqah',

  // Class 3: Mathematics
  'Lim Zhi Yong', 'Nur Athirah', 'Pranav Iyer', 'Tan Jia Qi',
  'Muhammad Aiman', 'Gayathri Devi', 'Goh Wen Jun', 'Siti Mariam',
  'Aravind Kumar', 'Ng Xin Hui', 'Amin Razak', 'Sangeetha Rao',
  'Ong Yi Xuan', 'Farid Hamzah', 'Pooja Nair', 'Chua Jun Jie',
  'Nurul Aini', 'Harish Menon', 'Lee Sze Ying', 'Zubaidah Hassan',
  'Srinivas Reddy', 'Wong Jia Wen', 'Imran Yusof', 'Nithya Balan',
  'Koh Zhi Xin', 'Syahirah Othman', 'Vijay Anand', 'Teo Xiu Ling',
  'Ain Nadhirah', 'Mohan Das', 'Chan Mei Xuan', 'Khairul Anwar'
];

function randomE21CC() {
  const levels = ['developing', 'applying', 'extending', 'leading'];
  const pick = () => levels[Math.floor(Math.random() * levels.length)];
  return {
    criticalThinking: pick(),
    creativeThinking: pick(),
    communication: pick(),
    collaboration: pick(),
    socialConnectedness: pick(),
    selfRegulation: pick(),
  };
}

export function seedIfNeeded() {
  if (localStorage.getItem(SEED_KEY)) return;
  if (Store.getClasses().length > 0) {
    localStorage.setItem(SEED_KEY, '1');
    return;
  }

  const classes = [
    { name: '4A Pure Chemistry', level: 'GCE O Level / G3', subject: 'Pure Chemistry' },
    { name: '4B Combined Science', level: 'GCE O Level / G3', subject: 'Combined Science' },
    { name: '4C Mathematics', level: 'GCE O Level / G3', subject: 'Mathematics' },
  ];

  classes.forEach((cls, ci) => {
    const created = Store.addClass(cls);
    const start = ci * 32;
    for (let i = 0; i < 32; i++) {
      Store.addStudent(created.id, {
        name: NAMES[start + i],
        e21cc: randomE21CC()
      });
    }
  });

  localStorage.setItem(SEED_KEY, '1');
}

/* ══════════ PD Starter Packs ══════════ */

const PD_SEED_KEY = 'cocher_pd_seeded';

const PD_FOLDERS = [
  {
    name: 'Inquiry-Based Learning',
    category: 'pedagogy',
    description: 'Approaches and strategies for student-driven inquiry across subjects. From structured to open inquiry, with practical classroom techniques.',
    tags: ['inquiry', 'student-centred', 'questioning', 'investigation', 'active learning'],
    materials: [
      {
        title: 'Understanding IBL — Core Principles',
        type: 'note',
        content: `INQUIRY-BASED LEARNING (IBL) — CORE PRINCIPLES
================================================

What is IBL?
Inquiry-Based Learning is a student-centred approach where learners construct understanding through questioning, investigating, and reflecting. Instead of the teacher transmitting knowledge, students actively explore problems and build meaning from evidence.

Key Idea: The teacher shifts from "sage on the stage" to "guide on the side" — but this does NOT mean hands-off. Good IBL requires careful scaffolding.

The Inquiry Cycle
-----------------
1. ENGAGE — Spark curiosity. Pose a driving question or present a puzzling phenomenon.
2. EXPLORE — Students investigate, gather data, test ideas. Hands-on, minds-on.
3. EXPLAIN — Students construct explanations based on evidence. Teacher clarifies misconceptions.
4. ELABORATE — Apply understanding to new contexts. Extend and deepen.
5. EVALUATE — Reflect on learning. Assess understanding (formative + summative).

This mirrors the 5E Model (Bybee) widely used in Singapore science education.

Levels of Inquiry
-----------------
Not all inquiry is the same. Match the level to your students' readiness:

Level 1 — Confirmation: Students verify a known outcome. Teacher provides question, method, and expected result. Good for building lab skills.

Level 2 — Structured: Teacher provides the question and method. Students determine the result. Most common in Singapore secondary science.

Level 3 — Guided: Teacher provides the question only. Students design the method AND determine the result. Requires more scaffolding.

Level 4 — Open: Students generate their own questions, design investigations, and draw conclusions. The gold standard, but needs careful preparation.

Practical tip: Start with Level 2, then gradually release responsibility. Most Secondary 3-4 students can handle Level 3 with support.

Why IBL Matters
---------------
- Develops critical thinking (students evaluate evidence, not just memorise)
- Builds scientific literacy and process skills
- Increases engagement and intrinsic motivation
- Prepares students for real-world problem-solving
- Aligns with MOE's emphasis on 21CC and self-directed learning

Common Misconceptions about IBL
--------------------------------
- "IBL means no direct instruction" — FALSE. Effective IBL blends direct teaching with inquiry phases.
- "IBL is only for science" — FALSE. It works in humanities, mathematics, and languages.
- "Students will discover everything on their own" — FALSE. Teacher guidance is essential.
- "IBL takes too much time" — Partially true. Budget time carefully. Not every lesson needs full inquiry.`
      },
      {
        title: 'IBL Strategies & Classroom Activities',
        type: 'note',
        content: `IBL STRATEGIES & CLASSROOM ACTIVITIES
======================================

Questioning Strategies
---------------------
The quality of your driving question determines the quality of the inquiry.

Good driving questions are:
- Open-ended (not yes/no)
- Authentically puzzling
- Connected to the syllabus
- Accessible to all students but with depth for extension

Examples:
- Chemistry: "Why do some metals corrode faster than others?"
- Math: "Is there a pattern to predict which numbers are prime?"
- English: "How does the author's background shape the story's perspective?"
- History: "Was the fall of Singapore inevitable?"

Bloom's Questioning Ladder:
- Recall: What happened? What are the facts?
- Understand: Why does this happen? Can you explain?
- Apply: How would you use this in a different context?
- Analyse: What patterns do you see? What's the evidence?
- Evaluate: Which solution is best? How do you know?
- Create: Can you design a new approach? What if...?

Practical Activity Formats
--------------------------

1. MYSTERY BOX
   Give students a sealed container with unknown objects/chemicals.
   They must determine the contents using only indirect evidence.
   Works for: Science (properties of matter), Math (deductive reasoning)

2. DATA DETECTIVE
   Present a real-world dataset (e.g., Singapore weather data, population stats).
   Students generate questions, identify patterns, and present findings.
   Works for: Math, Geography, Social Studies

3. PREDICT-OBSERVE-EXPLAIN (POE)
   Show a demonstration setup. Students predict the outcome and explain their reasoning.
   Run the demonstration. Students observe and reconcile with predictions.
   Works for: Science, Math

4. JIGSAW INQUIRY
   Different groups investigate different aspects of a larger question.
   Groups share findings and synthesise a collective understanding.
   Works for: All subjects. Great for managing complex topics.

5. THINK-PAIR-INVESTIGATE
   Individual thinking time → pair discussion → collaborative investigation.
   Ensures all students engage before group work begins.

6. CLAIM-EVIDENCE-REASONING (CER)
   Students make a claim, support with evidence, and explain reasoning.
   Provides a structured framework for scientific argumentation.
   Template: "I claim that [claim] because [evidence] which shows [reasoning]."

Assessment in IBL
-----------------
- Process portfolios: document the inquiry journey, not just the answer
- Peer assessment rubrics for group investigations
- Reflection journals: "What did I learn? What surprised me? What questions remain?"
- Exit tickets: quick checks for understanding after each inquiry phase
- Practical performance tasks: design and carry out an investigation`
      },
      {
        title: 'Implementing IBL — Tips & E21CC Alignment',
        type: 'note',
        content: `IMPLEMENTING IBL — PRACTICAL TIPS & E21CC ALIGNMENT
====================================================

Getting Started — First Steps
-----------------------------
1. Pick ONE unit or topic to try IBL with. Don't overhaul everything at once.
2. Start with structured inquiry (Level 2). Students need to learn inquiry skills.
3. Model the inquiry process explicitly. Think aloud as you demonstrate.
4. Build a "question wall" — display student questions prominently in class.
5. Establish norms: "It's okay to be wrong. It's not okay to not try."

Classroom Management Tips
-------------------------
- Clear transitions: use a timer and visual/audio signals between phases
- Role cards for group work: Questioner, Recorder, Materials Manager, Reporter
- Anchor charts showing the inquiry cycle — students can self-locate
- "Stuck? Try this" cards at each table: prompts to unstick thinking
- Noise-o-meter: productive noise is fine; chaotic noise isn't

Time Management
---------------
A common concern: "I don't have time for inquiry."
- Mini-inquiries (20 min): POE activities, quick data analysis
- Half-period inquiries (30 min): structured investigation with pre-prepared materials
- Full inquiry projects (3-5 periods): guided/open inquiry with presentation
- Tip: Use flipped learning — move content delivery to pre-class videos/readings, free up class time for inquiry.

E21CC Alignment
---------------
IBL is naturally strong on E21CC competencies:

CAIT (Critical, Adaptive & Inventive Thinking)
- Sound Reasoning: Students evaluate evidence and draw conclusions
- Creative Problem-Solving: Designing investigations requires inventive thinking
- Managing Complexity: Real-world inquiry problems are messy and complex
- Metacognition: Reflection phases explicitly develop metacognitive skills

CCI (Communication, Collaboration & Information)
- Communicative Competence: Presenting findings, writing CER arguments
- Collaborative Skills: Group investigations require teamwork
- Information Literacy: Finding, evaluating, and using information ethically

CGC (Civic, Global & Cross-cultural Literacy)
- Active Citizenship: Inquiry into community/environmental issues
- Global Awareness: Investigating real-world problems with global dimensions

STP (Singapore Teaching Practice) Alignment
-------------------------------------------
- Lesson Preparation: Designing inquiry tasks requires deep content knowledge
- Positive Classroom Culture: IBL builds a culture of curiosity and risk-taking
- Lesson Enactment: Teacher circulates, questions, and scaffolds during investigation
- Monitoring & Feedback: Formative assessment is embedded in the inquiry process

Resources for Further Reading
------------------------------
- MOE Academy courses on Inquiry-Based Learning
- "Teaching Science Through Inquiry-Based Instruction" — Llewellyn
- AST resource packages on IBL in Singapore context
- NIE research on inquiry in Singapore classrooms`
      }
    ]
  },
  {
    name: 'Metacognition Practices',
    category: 'pedagogy',
    description: 'Helping students think about their thinking. Strategies for developing metacognitive awareness, self-regulation, and reflective learning habits.',
    tags: ['metacognition', 'thinking', 'reflection', 'self-regulation', 'learning-to-learn'],
    materials: [
      {
        title: 'What is Metacognition? — Foundations',
        type: 'note',
        content: `METACOGNITION — FOUNDATIONS
===========================

What is Metacognition?
Metacognition means "thinking about thinking." It is the awareness and control of one's own cognitive processes — knowing what you know, what you don't know, and how to bridge the gap.

John Flavell (1979) defined two components:
1. Metacognitive Knowledge — understanding of yourself as a learner, task demands, and available strategies
2. Metacognitive Regulation — the ability to plan, monitor, and evaluate your own learning

Why it matters: Research consistently shows that metacognition is one of the strongest predictors of academic achievement. The Education Endowment Foundation (EEF) rates metacognitive strategies as having HIGH impact for LOW cost — approximately +7 months of additional progress.

In Singapore's E21CC framework, metacognition sits explicitly within CAIT (Critical, Adaptive & Inventive Thinking) as a core sub-competency.

Three Pillars of Metacognitive Regulation
------------------------------------------

1. PLANNING — Before the task
   "What am I trying to achieve?"
   "What strategies might work?"
   "What do I already know about this?"
   "How much time do I need?"
   "What resources will help?"

2. MONITORING — During the task
   "Is my approach working?"
   "Am I making progress?"
   "Do I understand what I'm reading/doing?"
   "Should I try a different strategy?"
   "Where am I getting stuck?"

3. EVALUATING — After the task
   "How well did I do?"
   "What worked and what didn't?"
   "What would I do differently next time?"
   "What did I learn about myself as a learner?"
   "Can I apply this strategy to other tasks?"

The Metacognitive Learner vs The Non-Metacognitive Learner
-----------------------------------------------------------
Non-metacognitive: reads a chapter, feels done, moves on. Doesn't know what they don't know.
Metacognitive: reads a chapter, pauses to check understanding, re-reads confusing parts, creates connections to prior knowledge, asks "Can I explain this in my own words?"

Key insight: Struggling students often lack metacognitive skills, not intelligence. They don't know WHAT to do when they don't understand. Teaching metacognition explicitly can be transformative for these learners.

Research Evidence
-----------------
- EEF Toolkit: +7 months progress from metacognitive and self-regulation strategies
- Hattie's Visible Learning: metacognitive strategies have effect size of 0.69 (well above the 0.40 "hinge point")
- Singapore's own PISA results show strong performance partly attributed to emphasis on thinking skills
- Zohar & Barzilai (2013): explicit metacognitive instruction improves both knowledge and transfer

Common Misconceptions
----------------------
- "Metacognition is just reflection" — No, it includes planning and monitoring too
- "Smart students are already metacognitive" — Not necessarily. Even high-achievers benefit from explicit instruction
- "Metacognition is too abstract for younger students" — Age-appropriate metacognitive strategies work from primary school onwards
- "It takes too much class time" — Embedding metacognitive prompts takes 2-3 minutes per activity`
      },
      {
        title: 'Metacognitive Strategies for the Classroom',
        type: 'note',
        content: `METACOGNITIVE STRATEGIES FOR THE CLASSROOM
============================================

Planning Strategies (Before Learning)
--------------------------------------

1. KWL CHART (Know - Want to Know - Learned)
   Students activate prior knowledge and set learning goals.
   Variation: KWHL (add H = How will I find out?)
   Time: 5-8 minutes at the start of a topic

2. PREDICTION TASKS
   "Based on the title/diagram/first paragraph, what do you think this will be about?"
   Forces students to activate prior knowledge and set expectations.
   Time: 2-3 minutes

3. GOAL SETTING
   Students write a specific, measurable learning goal for the lesson.
   "By the end of today, I want to be able to..."
   Revisit at the end: "Did I achieve my goal?"
   Time: 2 minutes

4. STRATEGY SELECTION
   "Which approach will you use to solve this problem? Why?"
   Give students a strategy menu to choose from (especially in math).
   Time: 3 minutes

Monitoring Strategies (During Learning)
----------------------------------------

5. TRAFFIC LIGHT SELF-ASSESSMENT
   Students show green (I understand), amber (partly), or red (I'm lost).
   Use cards, cups, or digital tools. Teacher adjusts in real time.
   Time: 30 seconds per check

6. THINK-ALOUD MODELLING
   Teacher verbalises their own thinking process while solving a problem.
   "I'm reading this question and I notice... so I think I should try..."
   Powerful because it makes expert thinking visible to novices.
   Time: 5-10 minutes per demonstration

7. ANNOTATION / MARGINAL NOTES
   Students annotate texts with: ? (confused), ! (surprising), * (important), → (connects to...)
   Trains students to monitor comprehension in real time.
   Time: built into reading activities

8. PAUSE-AND-REFLECT CHECKPOINTS
   Insert deliberate pauses during instruction: "What have we covered so far? What's the main idea?"
   Students write a 1-sentence summary or tell their partner.
   Time: 2 minutes per checkpoint

9. MUDDIEST POINT
   "What is the MOST confusing thing from today's lesson?"
   Quick formative assessment that builds metacognitive awareness.
   Time: 2 minutes at any point

Evaluating Strategies (After Learning)
---------------------------------------

10. EXIT TICKETS WITH METACOGNITIVE PROMPTS
    Instead of just content questions, add:
    "Rate your confidence: 1-5"
    "What strategy helped you most today?"
    "What would you do differently if you had to do this again?"
    Time: 3-5 minutes

11. LEARNING LOGS / REFLECTION JOURNALS
    Weekly entries: "What I learned, how I learned it, what I'll do next"
    Sentence starters help reluctant writers:
    "I used to think... Now I think..."
    "The hardest part was... because..."
    "Next time I would..."
    Time: 10 minutes per week

12. WRAPPER TECHNIQUE
    Before a test: "How did you prepare? How confident are you?"
    After a test: "How accurate was your confidence? What will you change?"
    Builds calibration — students learn to judge their own understanding accurately.
    Time: 5 minutes before + 5 minutes after

13. TWO STARS AND A WISH
    Self/peer assessment: identify 2 strengths and 1 area for improvement.
    Structured, positive, and actionable.
    Time: 5 minutes

Quick-Win Metacognitive Questions
----------------------------------
Post these on the wall or embed in worksheets:
- "What am I trying to achieve?"
- "What do I already know about this?"
- "Is my strategy working? Should I try something else?"
- "Can I explain this in my own words?"
- "What was the most useful thing I did today?"
- "What's still unclear?"
- "How is this similar to something I've learned before?"`
      },
      {
        title: 'Building a Metacognitive Culture & E21CC Links',
        type: 'note',
        content: `BUILDING A METACOGNITIVE CULTURE & E21CC LINKS
================================================

Creating a Metacognitive Classroom
-----------------------------------
Metacognition isn't a one-off lesson — it's a culture. Here's how to build it:

1. NORMALISE STRUGGLE
   - Use language like "productive struggle" and "not yet" (growth mindset)
   - Share your own learning challenges: "When I was learning this, I found X tricky because..."
   - Celebrate strategy use, not just correct answers: "I love how you tried a different approach when the first one didn't work"

2. MAKE THINKING VISIBLE
   - Display student thinking processes, not just final answers
   - Use thinking routines (Harvard's Project Zero):
     * See-Think-Wonder (observation → inference → curiosity)
     * Think-Puzzle-Explore (prior knowledge → questions → plan)
     * Connect-Extend-Challenge (connections → new ideas → difficulties)
   - Physical "thinking walls" where students post their reasoning

3. EXPLICIT STRATEGY INSTRUCTION
   - Name strategies explicitly: "This is called 'chunking' — we break the problem into smaller parts"
   - Model when and why to use each strategy
   - Give students a strategy toolkit they can reference

4. REGULAR METACOGNITIVE CONVERSATIONS
   - "How did you figure that out?"
   - "What strategy did you use?"
   - "What would you tell a friend who's stuck on this?"
   - "Did anyone use a different approach?"

5. FEEDBACK THAT DEVELOPS METACOGNITION
   - Instead of just "Good job" or marking right/wrong:
   - "Your strategy worked well here because..."
   - "I notice you didn't check your answer — what could you do?"
   - "Compare your approach with the model answer — what's similar? What's different?"

Common Pitfalls to Avoid
-------------------------
- Treating metacognition as a bolt-on activity rather than embedded practice
- Only using reflection (evaluating) without planning and monitoring
- Asking metacognitive questions without teaching students HOW to answer them
- Expecting instant results — metacognitive skills develop over months
- Making it feel like extra work rather than a natural part of learning

Age-Appropriate Adaptations (Secondary)
-----------------------------------------
Secondary 1-2:
- More scaffolded prompts and sentence starters
- Visual tools (traffic lights, emoji scales, graphic organisers)
- Shorter reflection tasks (1-2 sentences)
- Pair sharing before individual reflection

Secondary 3-4:
- More open-ended reflection
- Self-directed strategy selection
- Peer coaching and metacognitive dialogue
- Portfolio-based evidence of growth
- Exam preparation: study skills explicitly linked to metacognition

E21CC Framework Alignment
--------------------------
Metacognition is CENTRAL to E21CC, especially CAIT:

CAIT — Critical, Adaptive & Inventive Thinking
✓ Metacognition (sub-competency): explicitly listed — monitoring and regulating one's own thinking
✓ Sound Reasoning: metacognitive monitoring improves reasoning quality
✓ Managing Complexity: planning and monitoring help navigate complex problems

CCI — Communication, Collaboration & Information
✓ Metacognitive awareness improves how students communicate their thinking
✓ Group metacognition: teams that reflect on their process work more effectively
✓ Information literacy: knowing what you know/don't know guides research

CGC — Civic, Global & Cross-cultural Literacy
✓ Self-awareness (knowing your biases, perspectives) is metacognitive
✓ Reflective citizenship: thinking critically about one's own position

STP Alignment
--------------
- Positive Classroom Culture: metacognitive classrooms value thinking and growth
- Lesson Enactment: metacognitive prompts embedded in instruction
- Monitoring & Feedback: metacognitive check-ins ARE formative assessment
- Assessment Literacy: student self-assessment is metacognitive by nature

Key Takeaway
------------
Teaching metacognition is not about adding more content — it's about changing HOW students engage with content. The most powerful shift is from "What's the answer?" to "How did you work that out?" and "How do you know you understand?"`
      }
    ]
  },
  {
    name: 'Team-Based Learning (TBL)',
    category: 'course',
    description: 'Larry Michaelsen\'s Team-Based Learning model — structured collaborative learning with individual accountability, permanent teams, and application activities.',
    tags: ['TBL', 'collaboration', 'teamwork', 'group work', 'peer learning', 'active learning'],
    materials: [
      {
        title: 'Team-Based Learning — The Model',
        type: 'note',
        content: `TEAM-BASED LEARNING (TBL) — THE MODEL
=======================================

What is TBL?
Team-Based Learning (developed by Larry Michaelsen) is a structured form of collaborative learning that goes far beyond generic "group work." It uses a specific sequence of individual preparation, readiness assurance, and application activities to ensure deep learning with accountability.

Key difference from group work: In typical group work, one student often does most of the work. TBL is designed to prevent this through individual accountability mechanisms built into every phase.

The Four Essential Elements of TBL
-----------------------------------
1. PERMANENT, DIVERSE TEAMS
   - Teams of 5-7 students stay together for the entire term/semester
   - Teacher forms teams (NOT student self-selection) to ensure diversity
   - Diversity criteria: academic ability, gender, background, personality
   - Why permanent? Trust builds over time. Teams get better at working together.

2. INDIVIDUAL ACCOUNTABILITY
   - Students must come prepared (individual pre-reading/prep)
   - Individual Readiness Assurance Test (iRAT) ensures everyone has done the prep
   - Peer evaluation at the end holds free-riders accountable

3. FREQUENT, IMMEDIATE FEEDBACK
   - Teams receive immediate feedback on their answers (scratch cards or digital tools)
   - This creates a natural cycle of discussion → test → correct → discuss again

4. APPLICATION ACTIVITIES
   - The majority of class time is spent on challenging application problems
   - Teams apply concepts to realistic scenarios, not just recall facts

The TBL Sequence (per module/unit)
-----------------------------------

PHASE 1: PREPARATION (Before Class)
- Students complete assigned pre-reading, video, or homework
- Content is foundational — enough to participate meaningfully in class
- Tip: Keep pre-class material focused. 15-20 pages or a 10-min video, not an entire textbook chapter.

PHASE 2: READINESS ASSURANCE PROCESS (RAP) — In Class, ~30-40 min
Step 1 — iRAT (Individual Readiness Assurance Test)
  - 10-20 MCQ covering the pre-reading
  - Students answer individually (no discussion)
  - Purpose: ensures everyone has prepared

Step 2 — tRAT (Team Readiness Assurance Test)
  - SAME questions, now discussed and answered as a team
  - Use IF-AT scratch cards (immediate feedback) or digital polling
  - Teams must reach consensus — no majority voting
  - This is where the magic happens: students teach each other

Step 3 — Appeals
  - Teams can appeal any question they got wrong
  - Must provide a written argument citing the pre-reading
  - Teaches critical reading and argumentation

Step 4 — Mini-Lecture (Clarification)
  - Teacher addresses only the concepts that teams struggled with
  - Short, targeted, responsive — NOT a full lecture
  - Typically 5-10 minutes maximum

PHASE 3: APPLICATION ACTIVITIES — In Class, majority of time
- Teams work on significant, challenging problems (see next material for the 4S Framework)
- All teams work on the SAME problem
- Teams report simultaneously (to prevent anchoring bias)
- Inter-team discussion and debate follows

Why TBL Works
--------------
- Individual accountability eliminates social loafing
- Peer teaching during tRAT deepens understanding
- Immediate feedback creates productive cognitive conflict
- Application activities require higher-order thinking
- Permanent teams develop trust and collaborative skills
- Students are MORE prepared because they know they'll be tested`
      },
      {
        title: 'Designing TBL Activities & Assessments',
        type: 'note',
        content: `DESIGNING TBL ACTIVITIES & ASSESSMENTS
========================================

The 4S Framework for Application Activities
---------------------------------------------
The 4S Framework (Michaelsen) ensures application activities produce meaningful team discussion and learning:

S1 — SIGNIFICANT PROBLEM
  The problem must be relevant and engaging. Use real-world scenarios.
  - Chemistry: "A factory is leaking chemical X into a river. Which treatment method should the town use?"
  - Math: "Your school has a budget of $5,000 for a community event. Design an optimal allocation."
  - English: "You're an editor. Which version of this paragraph is most effective for the target audience?"
  - History: "As advisors to Stamford Raffles, recommend a policy for the new settlement."

S2 — SAME PROBLEM
  ALL teams work on the SAME problem. This is crucial — it enables inter-team comparison and debate.
  Common mistake: giving different problems to different teams. This prevents meaningful whole-class discussion.

S3 — SPECIFIC CHOICE
  Teams must make a specific, defensible choice (not an open-ended essay).
  - "Which option — A, B, C, or D — is the best approach?"
  - "Rank these 4 solutions from most to least effective."
  - "What is the most likely cause?"
  Specific choices force commitment and enable comparison between teams.

S4 — SIMULTANEOUS REPORT
  All teams reveal their answer at the SAME time (show of cards, digital poll, gallery post).
  Why? If Team 1 reports first and their answer sounds good, other teams may change their answer.
  Simultaneous reporting preserves independent thinking and creates genuine debate.
  Methods: lettered cards held up, coloured cups, digital polling tools.

Designing Good iRAT/tRAT Questions
------------------------------------
- Focus on UNDERSTANDING, not trivial recall
- Use application-level MCQs where possible
- Each question should have one clearly best answer but plausible distractors
- Distractors should represent common misconceptions
- 10-20 questions is typical; 15 is a good sweet spot
- Avoid "all of the above" or "none of the above"

Assessment in TBL
------------------
TBL uses a distinctive assessment model:

1. Individual Component (iRAT scores): 15-20% of final grade
   Ensures individual accountability for preparation

2. Team Component (tRAT scores + application activities): 20-30%
   Rewards effective collaboration

3. Peer Evaluation: 10-20%
   Students rate their teammates on contribution, preparation, and collaboration
   Use a structured rubric:
   - Was this person prepared for class?
   - Did they contribute to team discussions?
   - Did they help other team members learn?
   - Did they complete their fair share?

   Point allocation method: Give each student 100 points per teammate to distribute.
   Equal distribution = everyone contributed equally. Unequal = differentiated contribution.

4. Individual Exams/Projects: remaining percentage
   Traditional assessment of individual mastery

The Weight-Setting Exercise
----------------------------
Powerful TBL technique: let TEAMS decide the weighting of each component within given ranges.
Example: iRAT (10-20%), tRAT (10-20%), Peer Eval (10-20%), Final (40-60%)
Teams negotiate and commit to weights. This builds ownership and metacognition.

IF-AT Scratch Cards
--------------------
Immediate Feedback Assessment Technique cards work like lottery scratch cards:
- Students scratch their first choice. If a star appears → correct!
- If no star, they discuss again and try their second choice.
- Partial credit: 4 points for 1st try, 2 for 2nd, 1 for 3rd, 0 for 4th
- Creates excitement, immediate feedback, and deeper discussion
- Digital alternatives: Kahoot, Mentimeter, Google Forms with instant scoring`
      },
      {
        title: 'TBL in Singapore Classrooms — E21CC & Practical Tips',
        type: 'note',
        content: `TBL IN SINGAPORE CLASSROOMS — E21CC & PRACTICAL TIPS
======================================================

Forming Teams in Singapore Context
------------------------------------
Singapore classrooms are diverse. Use this to your advantage when forming teams:

Diversity factors to balance:
- Academic ability (mix high, mid, low performers based on recent assessments)
- Gender balance where possible
- Ethnic/cultural background (leverage Singapore's multiculturalism)
- Personality types (avoid all-quiet or all-dominant teams)
- Friendship groups (break up existing cliques — this helps students develop CCI)

Team size: 5-7 students. Smaller teams (5) work well for Secondary classes.

Important: Do NOT let students choose their own teams. Teacher-formed teams based on data are essential for TBL to work. Explain WHY to students: "In the workplace, you don't choose your colleagues."

Practical Implementation Tips
-------------------------------
Start small:
- Try TBL for ONE topic first, not the whole year
- Run 2-3 RAP cycles so students learn the rhythm
- Use the first application activity as a low-stakes practice round

Classroom setup:
- Teams need to sit together permanently. Rearrange furniture.
- Each team needs a whiteboard or large paper for collaborative work
- Consider a team nameplate/flag for identity building

Managing common challenges:
- "Students didn't do the pre-reading": iRAT scores will be low → tRAT discussion reveals this → peer pressure increases preparation next time. The system is self-correcting.
- "One student dominates": Peer evaluation addresses this. Also, require ALL members to explain during application activities.
- "Students want to choose their own teams": Explain the research. Promise they'll come to appreciate diverse teams.
- "Parents ask why my child is 'teaching' others": Teaching is the deepest form of learning. The student who explains learns MORE, not less.

Adapting for Singapore Secondary
---------------------------------
- Curriculum alignment: Map TBL modules to existing scheme of work. Not every topic suits TBL.
- Time constraints: A full RAP (iRAT + tRAT + clarification) can fit in 30-40 minutes.
- Application activities can be done in the second period of a double.
- Exam prep: Use TBL application activities to practise exam-style questions as a team.
- CCA/competition alignment: Students experienced with TBL make better CCA team members.

E21CC Framework Alignment
--------------------------
TBL is exceptionally strong on CCI and CAIT:

CCI — Communication, Collaboration & Information
✓ Collaborative Skills: permanent teams develop deep collaboration competencies
✓ Communicative Competence: defending answers, persuading teammates, presenting rationale
✓ Information Literacy: pre-reading, appeals process, evidence-based argumentation
This is TBL's strongest E21CC domain.

CAIT — Critical, Adaptive & Inventive Thinking
✓ Sound Reasoning: RAP process forces students to reason through MCQs and defend choices
✓ Creative Problem-Solving: 4S application activities require creative solutions
✓ Metacognition: peer evaluation requires self-awareness; weight-setting builds ownership

CGC — Civic, Global & Cross-cultural Literacy
✓ Cross-cultural Sensitivity: diverse teams learn to work across backgrounds
✓ Active Citizenship: application activities can address community issues
✓ Responsible Decision-Making: team consensus-building develops civic skills

STP (Singapore Teaching Practice) Alignment
--------------------------------------------
- Lesson Preparation: designing RAP questions and 4S activities requires deep content mastery
- Positive Classroom Culture: TBL builds a collaborative, accountable culture
- Lesson Enactment: teacher role shifts to facilitator during application activities
- Monitoring & Feedback: iRAT/tRAT provides immediate formative data; teacher adjusts mini-lecture
- Assessment: TBL's multi-component assessment aligns with holistic assessment principles

Recommended Starting Point
----------------------------
1. Choose a topic with clear foundational content and an engaging application
2. Write 15 iRAT/tRAT MCQs covering the pre-reading
3. Design ONE 4S application activity
4. Form teams using student data
5. Run it. Debrief with students. Refine.
6. Build from there — add more TBL modules gradually.

Resources
----------
- "Team-Based Learning: A Transformative Use of Small Groups" — Michaelsen, Knight, Fink
- Team-Based Learning Collaborative website (teambasedlearning.org)
- NIE Singapore resources on cooperative learning
- AST Networked Learning Communities — seek out TBL practitioners`
      }
    ]
  },

  /* ── Folder 4: Differentiated Instruction ── */
  {
    name: 'Differentiated Instruction (DI)',
    category: 'course',
    description: 'Tomlinson\'s differentiation framework — adapting content, process, and product to meet diverse learner needs.',
    tags: ['differentiation', 'scaffolding', 'student-centred', 'mixed ability', 'UDL'],
    materials: [
      {
        title: 'Understanding DI — Principles & Models',
        type: 'note',
        content: `Understanding Differentiated Instruction — Principles & Models
================================================================

What Is Differentiated Instruction?
-----------------------------------
Carol Ann Tomlinson defines Differentiated Instruction (DI) as a teaching philosophy that proactively plans for students' differences so that all learners can access the curriculum. It is NOT about creating 30 different lesson plans — it is about designing flexible pathways within a single lesson.

The Three Elements of Differentiation
---------------------------------------
1. **Content** — WHAT students learn
   - Vary the complexity of material (e.g., tiered readings at different Lexile levels)
   - Offer choice in topics within a theme
   - Use multiple representations: text, video, diagram, manipulatives

2. **Process** — HOW students learn
   - Vary the activities: structured worksheets for some, open-ended investigations for others
   - Adjust pacing: extension tasks for fast finishers, guided practice for those who need more time
   - Offer different modes: independent, paired, group work

3. **Product** — HOW students demonstrate learning
   - Allow choice: essay, presentation, infographic, video, model
   - Vary complexity: some students explain, others evaluate or create
   - Use rubrics that account for different product types

Three Student Characteristics That Drive DI
--------------------------------------------
- **Readiness** — Current knowledge and skill level. Not the same as "ability" — readiness changes with each topic.
- **Interest** — What motivates and engages the student. Tapping into interests increases effort and retention.
- **Learning Profile** — How a student learns best: visual/auditory/kinesthetic, working alone vs. in groups, cultural background, language proficiency.

Connection to Universal Design for Learning (UDL)
---------------------------------------------------
UDL (CAST framework) aligns closely with DI through its three principles:
- Multiple means of **Engagement** (the "why" of learning)
- Multiple means of **Representation** (the "what")
- Multiple means of **Action & Expression** (the "how")

In Singapore's mixed-ability classrooms — especially with Subject-Based Banding (SBB) — DI is essential. A single class may include students across G1, G2, and G3 levels.

Why DI Matters
--------------
- Hattie's meta-analysis: Differentiation strategies contribute to effect sizes of 0.46–0.71 depending on implementation
- Students who feel the work is "just right" (Vygotsky's Zone of Proximal Development) are more engaged and learn faster
- DI reduces behavioural issues — bored students and overwhelmed students both act out
- Aligns with STP Area 3 (Differentiated Support) and MOE's emphasis on student-centred learning`
      },
      {
        title: 'DI Strategies for the Classroom',
        type: 'note',
        content: `DI Strategies for the Classroom
=================================

Practical Strategies for Differentiated Instruction
----------------------------------------------------

### 1. Tiered Tasks (3 Levels)
Design the same core task at three complexity levels:
- **Foundation** — Guided steps, sentence starters, fewer variables
- **Standard** — The "grade-level" task most students attempt
- **Extension** — Open-ended, requires synthesis or evaluation

Example (Sec 2 Science — Forces): All students investigate friction, but Foundation students use a structured data table and guided questions, Standard students design their own investigation with partial scaffolding, Extension students must predict outcomes using Newton's laws before testing.

### 2. Choice Boards (Tic-Tac-Toe / Menu)
A 3×3 grid of activities. Students choose 3 in a row (or a set number). Each square targets the same learning objective but via different modalities or complexities.

### 3. Flexible Grouping
Rotate grouping strategies across lessons:
- **Readiness groups** — Homogeneous, for targeted instruction
- **Interest groups** — Heterogeneous, students choose based on topic preference
- **Random groups** — For routine collaborative tasks
- **Mixed-ability groups** — Stronger students support peers (Vygotsky's MKO)

### 4. Anchor Activities
Pre-planned, meaningful tasks for students who finish early:
- Extension problems, reading corners, journal prompts, peer tutoring
- Must be curriculum-aligned, not just "busy work"

### 5. Learning Menus / Playlists
A structured set of must-do and may-do tasks:
- **Appetiser** (warm-up, all students)
- **Main Course** (core learning, tiered)
- **Dessert** (extension/enrichment, choice)

### 6. Exit Ticket Sorting
Use exit tickets at the end of Lesson 1 to sort students for Lesson 2:
- "Got it" → Extension group
- "Almost" → Standard group
- "Not yet" → Re-teach group

### 7. RAFT Activities
**R**ole — **A**udience — **F**ormat — **T**opic
Students take on different roles and produce different products, all addressing the same content.

### 8. Cubing
A physical or digital cube with different tasks on each face (describe, compare, associate, analyse, apply, argue for/against). Roll to get your task. Different cubes for different readiness levels.

### 9. Think-Dots
Six tasks on cards, each aligned to a dot on a die. Students roll and complete the corresponding task. Like cubing but card-based.

### 10. Scaffolded Note-Taking
Provide different levels of note scaffolding:
- Full guided notes (fill-in-the-blank) for Foundation
- Partial notes (key headings + some blanks) for Standard
- Cornell notes template (independent) for Extension

Quick Implementation Tip
-------------------------
Start with ONE strategy. Master it before adding another. Tiered tasks and exit ticket sorting are the easiest entry points for most Singapore teachers.`
      },
      {
        title: 'DI in Singapore — STP & E21CC Alignment',
        type: 'note',
        content: `DI in Singapore — STP & E21CC Alignment
==========================================

STP Alignment
--------------
Differentiated Instruction maps directly to the Singapore Teaching Practice:

**Area 1 — Lesson Preparation**
- Understanding learners: DI starts with knowing your students' readiness, interests, and profiles
- Clear objectives: Same learning goal for all, different pathways to get there

**Area 3 — Monitoring & Feedback**
- Formative assessment: Exit tickets, observations, and conversations inform differentiation decisions
- Differentiated support: The heart of DI — providing the right level of challenge and scaffold
- Effective feedback: Tailored to each student's current position relative to the goal

**Area 4 — Positive Learning Culture**
- Student agency: Choice boards and learning menus give students ownership
- Safe environment: DI normalises different paces and approaches — "different, not less"

Managing Mixed-Ability Classes in Singapore
--------------------------------------------
With Subject-Based Banding (SBB) and Full Subject-Based Banding (FSBB), classes are increasingly diverse:

1. **Know your spread** — Use diagnostic assessments early to understand the range
2. **Start with 2 tiers, not 3** — Foundation and Standard. Add Extension when comfortable
3. **Use existing data** — SLS analytics, class tests, teacher observations
4. **Leverage peer support** — Singapore students respond well to structured peer learning
5. **Communicate with parents** — Explain that differentiation means personalised support, not lower standards

E21CC Alignment
----------------
- **Critical Thinking (CAIT)** — Tiered tasks at Extension level require analysis and evaluation
- **Creative Thinking (CAIT)** — Choice boards encourage creative expression
- **Communication (CCI)** — RAFT activities develop communication through varied formats
- **Collaboration (CCI)** — Flexible grouping builds collaborative skills across different configurations
- **Social Connectedness (CGC)** — Mixed-ability groups foster empathy and peer support
- **Self-Regulation** — Learning menus develop self-management and goal-setting skills

Common Pitfalls
----------------
- Differentiating quantity instead of quality (more of the same ≠ differentiation)
- Labelling students permanently ("the weak group") — readiness changes!
- Over-differentiating — trying to personalise everything at once leads to burnout
- Neglecting the middle — focusing only on the extremes

Getting Started — 5 Steps
---------------------------
1. Choose ONE upcoming lesson
2. Identify the learning objective
3. Design a tiered task (Foundation + Standard)
4. Use an exit ticket to inform next steps
5. Reflect: What worked? What would you adjust?

Resources
----------
- Tomlinson, C.A. — "How to Differentiate Instruction in Academically Diverse Classrooms"
- NIE Singapore — Professional development courses on differentiation
- STP Guide — Area 3: Differentiated Support
- AST resources on inclusive pedagogy`
      }
    ]
  },

  /* ── Folder 5: Formative Assessment Practices ── */
  {
    name: 'Formative Assessment Practices',
    category: 'pedagogy',
    description: 'Evidence-informed Assessment for Learning (AfL) strategies — checking for understanding, providing feedback, and adjusting instruction in real time.',
    tags: ['formative assessment', 'AfL', 'feedback', 'Hattie', 'checking for understanding'],
    materials: [
      {
        title: 'What is Formative Assessment? — Foundations',
        type: 'note',
        content: `What is Formative Assessment? — Foundations
=============================================

Defining Formative Assessment
------------------------------
Formative assessment is any assessment activity that provides information to be used as feedback to modify teaching and learning. It is assessment FOR learning, not assessment OF learning.

The landmark research of **Black & Wiliam (1998)** — *Inside the Black Box* — showed that formative assessment produces significant learning gains, particularly for lower-achieving students. Their review of 250+ studies found effect sizes of 0.4 to 0.7.

**Hattie's Visible Learning** effect sizes:
- Feedback: **d = 0.70** (well above the 0.40 "hinge point")
- Formative evaluation: **d = 0.48**
- Teacher clarity (linked to formative assessment): **d = 0.75**
- Metacognitive strategies (enabled by formative assessment): **d = 0.60**

The Five Key Strategies (Wiliam & Leahy)
------------------------------------------
Dylan Wiliam identified five core strategies that underpin effective formative assessment:

1. **Clarifying, sharing, and understanding learning intentions and success criteria**
   - Students need to know WHERE they are going
   - Use WALT (We Are Learning To...) and WILF (What I'm Looking For...)
   - Share exemplars and rubrics BEFORE the task

2. **Engineering effective discussions, tasks, and activities that elicit evidence of learning**
   - Design questions and tasks that reveal understanding (not just recall)
   - Use hinge questions at critical decision points in the lesson
   - "All-student response" techniques (mini-whiteboards, polls)

3. **Providing feedback that moves learners forward**
   - Feedback should be specific, actionable, and timely
   - Focus on the task and process, not the person
   - The best feedback tells students what to DO next, not just what went wrong

4. **Activating students as learning resources for one another**
   - Peer assessment and feedback
   - Structured peer teaching
   - Collaborative error analysis

5. **Activating students as owners of their own learning**
   - Self-assessment against success criteria
   - Goal-setting and reflection
   - Metacognitive prompts (connects to Beatty's GROW framework)

Formative vs. Summative Assessment
------------------------------------
| Aspect | Formative | Summative |
|--------|-----------|-----------|
| Purpose | Improve learning | Measure learning |
| Timing | During instruction | After instruction |
| Stakes | Low/no stakes | High stakes |
| Feedback | Immediate, actionable | Delayed, evaluative |
| Who uses it | Teacher AND student | Teacher, school, system |

Common Misconceptions
-----------------------
- "Formative assessment = mini tests" — NO. It is any activity that provides feedback, including observations, discussions, and questioning.
- "It takes too long" — Many techniques take 1-2 minutes (exit tickets, thumbs up/down)
- "It's only for weak students" — Formative assessment benefits ALL learners by making thinking visible
- "Marking = feedback" — Written marks/grades often shut down learning. Comments without grades are more effective (Butler, 1988).`
      },
      {
        title: 'Formative Assessment Techniques',
        type: 'note',
        content: `Formative Assessment Techniques
==================================

Practical Techniques for Checking Understanding
-------------------------------------------------

### Before the Lesson (Activating Prior Knowledge)
1. **KWL Chart** — What I Know / Want to know / Learned. Quick pre-assessment of starting points.
2. **Prediction Tasks** — "Before we start, predict what will happen when..." Reveals prior conceptions.

### During the Lesson (Monitoring Understanding)
3. **Mini-Whiteboards** — All students write answers simultaneously. Instant whole-class visibility. The single most powerful low-tech formative tool.

4. **Think-Pair-Share** — Individual thinking → pair discussion → whole-class sharing. Gives ALL students processing time, not just the fast hand-raisers.

5. **Traffic Light Cards** — Green (I understand), Amber (I'm unsure), Red (I'm lost). Students display during teaching. Instant gauge of the room.

6. **Hinge Questions** — A carefully designed multiple-choice question at a critical point in the lesson. Each wrong answer reveals a specific misconception. If >80% get it right, move on. If not, re-teach.

7. **Cold Calling / No-Hands-Up** — Call on students randomly (use lollipop sticks or a random name generator). Keeps everyone accountable. Combine with think time (3-5 seconds).

8. **Thumbs Up/Down/Sideways** — Quick check: "Show me how confident you are." Fast but surface-level.

9. **Muddiest Point** — "What is the ONE thing you are most confused about right now?" Quick written response mid-lesson.

10. **Pause-and-Reflect** — Every 10-15 minutes, pause: "Turn to your partner and summarise what we have covered so far." Identifies gaps in real time.

### After the Lesson (Evaluating Understanding)
11. **Exit Tickets** — 1-2 questions on a slip of paper (or digital: Google Forms, SLS). Done in the last 3 minutes. Sort into 3 piles for next lesson planning.

12. **3-2-1 Summariser** — 3 things I learned / 2 things I found interesting / 1 question I still have.

13. **Two Stars and a Wish** — Peer assessment: identify 2 strengths and 1 area for improvement.

14. **Gallery Walk + Sticky Notes** — Students display work around the room. Peers rotate and leave feedback on sticky notes.

15. **Self-Assessment Checklists** — Students rate themselves against success criteria before submission. Develops metacognition.

### Digital Tools for Formative Assessment
- **Padlet** — Collaborative wall for responses, visible to whole class
- **Mentimeter** — Live polls, word clouds, quizzes
- **Google Forms** — Auto-graded quizzes with instant feedback
- **SLS (Student Learning Space)** — Built-in formative assessment tools
- **Kahoot / Quizizz** — Gamified quizzes (use sparingly — engagement ≠ learning)

Quick Decision Guide
---------------------
- Need a quick pulse check? → Thumbs / Traffic lights
- Need to see specific answers? → Mini-whiteboards / Hinge questions
- Need to inform tomorrow's lesson? → Exit tickets
- Need students to reflect? → 3-2-1 / Self-assessment
- Need peer input? → Two Stars and a Wish / Gallery Walk`
      },
      {
        title: 'Building an AfL Culture — E21CC & STP Links',
        type: 'note',
        content: `Building an AfL Culture — E21CC & STP Links
==============================================

STP Alignment
--------------
Formative assessment is deeply embedded in the Singapore Teaching Practice:

**Area 2 — Lesson Enactment**
- Interaction patterns: Questioning techniques (cold calling, hinge questions) create productive classroom discourse
- Classroom discourse: Think-Pair-Share and structured discussions make thinking visible

**Area 3 — Monitoring & Feedback**
- Formative assessment: The entire framework maps here — exit tickets, mini-whiteboards, observations
- Effective feedback: Specific, timely, and forward-looking (Wiliam's Strategy 3)
- Differentiated support: Formative data enables responsive differentiation (exit ticket sorting → tiered groups)

**Area 4 — Positive Learning Culture**
- Safe environment: Low-stakes assessment reduces anxiety and encourages risk-taking
- Student agency: Self-assessment and peer feedback develop learner autonomy

Building Student Self-Assessment Habits
-----------------------------------------
1. **Model it first** — Show students how YOU would assess a piece of work against success criteria
2. **Use exemplars** — "Here is a strong example and a weaker example. What makes them different?"
3. **Start with peer assessment** — It is easier to assess someone else's work before your own
4. **Gradually release** — Move from teacher-led → peer → self over a term
5. **Make it routine** — Build self-assessment into every lesson or weekly cycle

Peer Feedback Protocols
-------------------------
- **TAG Feedback** — Tell something good / Ask a question / Give a suggestion
- **Warm & Cool Feedback** — Warm: what works well / Cool: what could be improved
- **Critical Friends** — Structured protocol: Present → Clarify → Feedback → Reflect
- **Gallery Walk Feedback** — Written, anonymous feedback on sticky notes during gallery walks

E21CC Alignment
----------------
- **Critical Thinking** — Self-assessment requires evaluative thinking against criteria
- **Creative Thinking** — Open-ended formative tasks (muddiest point, predictions) encourage creative responses
- **Communication** — Think-Pair-Share, peer feedback, and class discussions develop communication skills
- **Collaboration** — Peer assessment and collaborative error analysis build teamwork
- **Social Connectedness** — A low-stakes, feedback-rich culture builds trust and belonging
- **Self-Regulation** — Self-assessment checklists and goal-setting develop metacognitive self-regulation (connects directly to Beatty's GROW framework and Schraw & Dennison's MAI)

Practical Tips for Implementation
-----------------------------------
1. Start with exit tickets — easiest entry point, highest impact
2. Use no-hands-up from Day 1 of the term — set the expectation early
3. Invest in a class set of mini-whiteboards (or laminated A4 sheets)
4. Give comments WITHOUT grades initially — grades shut down learning (Butler, 1988)
5. Build 5 minutes of reflection into every lesson — it is not wasted time
6. Share your formative data with students — make the learning visible

Common Mistakes to Avoid
--------------------------
- Using formative assessment data for grading (defeats the purpose)
- Asking "Does everyone understand?" (useless — students say yes reflexively)
- Over-relying on digital tools (low-tech often works better)
- Collecting data but not acting on it — formative assessment is only formative if it changes what happens next

Resources
----------
- Black, P. & Wiliam, D. (1998) — "Inside the Black Box"
- Wiliam, D. & Leahy, S. (2015) — "Embedding Formative Assessment"
- Hattie, J. (2009) — "Visible Learning"
- EEF Guidance Report — "Teacher Feedback to Improve Pupil Learning"
- NIE Singapore — Assessment Literacy professional development programmes
- STP Guide — Area 3: Monitoring & Feedback`
      }
    ]
  }
];

export function seedPdIfNeeded() {
  if (localStorage.getItem(PD_SEED_KEY)) return;
  const existing = Store.get('pdFolders') || [];
  if (existing.length > 0) {
    localStorage.setItem(PD_SEED_KEY, '1');
    return;
  }

  const now = Date.now();
  const folders = PD_FOLDERS.map((f, fi) => ({
    id: generateId(),
    name: f.name,
    category: f.category,
    description: f.description,
    tags: f.tags,
    materials: f.materials.map((m, mi) => ({
      id: generateId(),
      title: m.title,
      type: m.type,
      content: m.content,
      createdAt: now - (fi * 86400000) - (mi * 3600000) // stagger dates
    })),
    createdAt: now - (fi * 86400000),
    updatedAt: now - (fi * 86400000)
  }));

  Store.set('pdFolders', folders);
  localStorage.setItem(PD_SEED_KEY, '1');
}

export function seedCCAIfNeeded() {
  const CCA_SEED_KEY = 'cocher_cca_seeded_v3';
  if (localStorage.getItem(CCA_SEED_KEY)) return;
  const existing = JSON.parse(localStorage.getItem('cocher_cca_list') || '[]');
  if (existing.length >= 12) {
    localStorage.setItem(CCA_SEED_KEY, '1');
    return;
  }

  const sampleCCAs = [
    // Physical Sports
    { id: generateId(), name: 'Basketball', category: 'sports', createdAt: Date.now() - 86400000 * 30 },
    { id: generateId(), name: 'Track & Field', category: 'sports', createdAt: Date.now() - 86400000 * 29 },
    { id: generateId(), name: 'Badminton', category: 'sports', createdAt: Date.now() - 86400000 * 28 },
    // Visual & Performing Arts
    { id: generateId(), name: 'Concert Band', category: 'performing', createdAt: Date.now() - 86400000 * 27 },
    { id: generateId(), name: 'Chinese Dance', category: 'performing', createdAt: Date.now() - 86400000 * 26 },
    { id: generateId(), name: 'Drama Club', category: 'performing', createdAt: Date.now() - 86400000 * 25 },
    // Uniformed Groups
    { id: generateId(), name: 'National Cadet Corps (NCC)', category: 'uniformed', createdAt: Date.now() - 86400000 * 24 },
    { id: generateId(), name: 'Girl Guides', category: 'uniformed', createdAt: Date.now() - 86400000 * 23 },
    { id: generateId(), name: 'St John Brigade', category: 'uniformed', createdAt: Date.now() - 86400000 * 22 },
    // Clubs & Societies
    { id: generateId(), name: 'Robotics Club', category: 'clubs', createdAt: Date.now() - 86400000 * 21 },
    { id: generateId(), name: 'Debate Society', category: 'clubs', createdAt: Date.now() - 86400000 * 20 },
    { id: generateId(), name: 'Environmental Club', category: 'clubs', createdAt: Date.now() - 86400000 * 19 },
  ];

  localStorage.setItem('cocher_cca_list', JSON.stringify(sampleCCAs));
  localStorage.setItem(CCA_SEED_KEY, '1');
}

/* ══════════ Exemplar Lesson Plans ══════════ */

const LESSON_SEED_KEY = 'cocher_lessons_seeded';

const EXEMPLAR_LESSONS = [
  {
    title: 'Chemical Bonding — Ionic & Covalent',
    classKey: 0, // links to 4A Pure Chemistry
    status: 'ready',
    e21ccFocus: ['criticalThinking', 'communication'],
    objectives: 'Students will explain ionic and covalent bonding using electron transfer/sharing models, draw dot-and-cross diagrams, and relate bonding type to physical properties.',
    chatHistory: [
      { role: 'user', content: 'Plan a lesson on chemical bonding for Sec 4 Pure Chemistry. Cover ionic and covalent bonding, dot-and-cross diagrams, and the properties of ionic vs covalent compounds. I want to use a POE (Predict-Observe-Explain) approach for the demo and include group work.' },
      { role: 'assistant', content: `## Chemical Bonding — Ionic & Covalent (Sec 4 Pure Chemistry)

### Learning Objectives
By the end of this lesson, students will be able to:
1. Describe ionic bonding as the transfer of electrons and covalent bonding as the sharing of electrons
2. Draw dot-and-cross diagrams for simple ionic (NaCl, MgO) and covalent (H₂O, CO₂, CH₄) compounds
3. Explain the relationship between bonding type and physical properties (melting point, electrical conductivity, solubility)

### Lesson Flow (70 min double period)

**Phase 1 — Hook & Predict (10 min)**
- Demo setup: Show NaCl crystals and paraffin wax side-by-side
- POE: Students predict which dissolves in water, which conducts electricity when dissolved, which has a higher melting point
- Students write predictions in their notebooks with reasoning

**Phase 2 — Observe & Discuss (15 min)**
- Conduct the demo: dissolve both in water, test conductivity
- Melt paraffin wax on a hot plate (or show video for safety)
- Students observe and record results
- Brief class discussion: "Were your predictions correct? What might explain the differences?"

**Phase 3 — Explain — Direct Instruction (15 min)**
- Teach ionic bonding: electron transfer, using Na + Cl as the example
- Draw dot-and-cross diagram for NaCl on the board, explaining each step
- Teach covalent bonding: electron sharing, using H₂O as the example
- Draw dot-and-cross diagram for H₂O
- Link back to demo: ionic compounds form crystal lattices (high MP, conduct when dissolved), covalent compounds form simple molecules (low MP, don't conduct)

**Phase 4 — Apply — Group Practice (20 min)**
- Groups of 4 work on a set of compounds: MgO, CO₂, CH₄, CaCl₂
- Each group draws dot-and-cross diagrams on A3 paper
- Groups predict the properties of each compound based on bonding type
- Gallery walk: groups circulate and peer-assess diagrams using a checklist

**Phase 5 — Consolidate & Exit Ticket (10 min)**
- Quick recap: "Ionic = transfer, Covalent = sharing"
- Exit ticket: Draw the dot-and-cross diagram for NH₃ and predict its melting point (high/low) with reasoning
- Metacognitive prompt: "What was the trickiest part of today's lesson? What strategy helped you understand it?"

### Resources Needed
- NaCl crystals, paraffin wax, beakers, water, conductivity tester
- Hot plate (teacher demo only) or video of melting points
- A3 paper and markers for group work
- Printed checklist for gallery walk peer assessment

### Differentiation
- **Support**: Provide a step-by-step scaffold for drawing dot-and-cross diagrams (electron configuration → identify transfer/sharing → draw diagram)
- **Extension**: Include dative (coordinate) covalent bonding for NH₄⁺ ion; challenge students to explain why diamond (covalent) has a high melting point

### E21CC Focus
- **CAIT**: POE approach develops critical thinking; predicting properties from bonding type requires reasoning
- **CCI**: Gallery walk and group diagram work develop collaborative and communication skills` }
    ],
    plan: '',
    components: {
      timeline: {
        content: `| Phase | Time | Activity | Layout |
|-------|------|----------|--------|
| Hook & Predict | 0–10 min | POE demo setup — students predict properties of NaCl vs paraffin wax | Direct Instruction (rows facing front) |
| Observe & Discuss | 10–25 min | Teacher demo: dissolve, test conductivity, melt. Students record observations | Direct Instruction |
| Explain | 25–40 min | Ionic & covalent bonding — dot-and-cross diagrams on board | Direct Instruction |
| Group Practice | 40–60 min | Groups draw diagrams for MgO, CO₂, CH₄, CaCl₂ on A3 → gallery walk | Collaborative Pods |
| Consolidate | 60–70 min | Recap + Exit ticket (NH₃ diagram + property prediction) | Quiet Work |`,
        meta: 'Auto-generated exemplar',
        updatedAt: Date.now()
      },
      rubric: {
        content: `### Dot-and-Cross Diagram Rubric

| Criterion | Excellent (4) | Good (3) | Developing (2) | Beginning (1) |
|-----------|--------------|----------|-----------------|----------------|
| Electron configuration | Correct electron arrangement for all atoms | Minor error in one atom | Multiple errors in configuration | Incorrect or missing |
| Bonding representation | Clear transfer (ionic) or sharing (covalent) shown | Mostly clear, minor ambiguity | Bonding type unclear | Bonding not shown |
| Diagram conventions | Correct use of dots/crosses, brackets, charges | One convention error | Multiple convention errors | Does not follow conventions |
| Property prediction | Accurate prediction with clear reasoning linked to bonding | Correct prediction, limited reasoning | Prediction partially correct | Incorrect or missing |`,
        meta: 'Assessment rubric for Chemical Bonding',
        updatedAt: Date.now()
      }
    }
  },
  {
    title: 'Kinematics — Speed, Velocity & Graphs',
    classKey: 1, // links to 4B Combined Science
    status: 'ready',
    e21ccFocus: ['criticalThinking', 'collaboration'],
    objectives: 'Students will distinguish between speed and velocity, interpret and sketch distance-time and velocity-time graphs, and calculate acceleration from graphs and equations.',
    chatHistory: [
      { role: 'user', content: 'Plan a lesson on kinematics for Sec 4 Combined Science. Cover speed vs velocity, d-t and v-t graphs, and calculating acceleration. I want hands-on data collection and graph interpretation.' },
      { role: 'assistant', content: `## Kinematics — Speed, Velocity & Graphs (Sec 4 Combined Science)

### Learning Objectives
By the end of this lesson, students will be able to:
1. Define and distinguish between speed, velocity, and acceleration
2. Interpret distance-time (d-t) and velocity-time (v-t) graphs, including calculating gradient
3. Calculate acceleration using a = (v − u) / t
4. Describe the motion represented by different graph shapes (constant speed, acceleration, deceleration, stationary)

### Lesson Flow (70 min double period)

**Phase 1 — Engage: The Human Graph (10 min)**
- Students stand along a line in the classroom/corridor
- Teacher calls out motion instructions: "Walk at constant speed", "Speed up", "Stop", "Walk backwards"
- One student sketches the d-t graph on the whiteboard in real-time
- Debrief: "What does a steep line mean? A flat line? A curve?"

**Phase 2 — Concept Build: Speed, Velocity, Acceleration (15 min)**
- Direct instruction with worked examples:
  - Speed = distance / time (scalar — magnitude only)
  - Velocity = displacement / time (vector — magnitude + direction)
  - Acceleration = change in velocity / time, a = (v − u) / t
- Key distinction: speed vs velocity using the running track example (one lap = distance 400m but displacement 0m)
- Worked example: A car accelerates from 10 m/s to 30 m/s in 5 s. Calculate acceleration.

**Phase 3 — Data Collection: Ticker Tape / Motion Sensor (20 min)**
- Stations activity (groups of 4):
  - **Station A**: Pull a ticker tape through a timer at constant speed → measure dot spacing
  - **Station B**: Pull a ticker tape with increasing speed → measure dot spacing
  - **Station C** (if motion sensors available): Record a student walking at constant speed, then accelerating
- Each group creates a d-t graph from their data on graph paper
- Discuss: "How does your graph shape match the type of motion?"

**Phase 4 — Graph Interpretation Challenge (15 min)**
- Pairs work through a set of 6 graphs (mix of d-t and v-t)
- For each graph: describe the motion in words, calculate speed/acceleration from the gradient
- Key teaching point: gradient of d-t graph = speed; gradient of v-t graph = acceleration; area under v-t graph = distance
- Scaffolded worksheet with increasing difficulty

**Phase 5 — Consolidate & Exit Ticket (10 min)**
- Quick-fire graph matching: teacher shows a motion description, students sketch the graph on mini-whiteboards
- Exit ticket: Given a v-t graph showing acceleration then constant velocity, calculate (a) the acceleration, (b) the total distance travelled
- Metacognitive prompt: "Which type of graph do you find easier to read — d-t or v-t? Why?"

### Resources Needed
- Ticker tape timers + tape (or motion sensors + data loggers)
- Graph paper, rulers, mini-whiteboards
- Printed graph interpretation worksheet (6 graphs)
- Stopwatch for Human Graph activity

### Differentiation
- **Support**: Provide a graph-reading scaffold — "Step 1: Read the axes. Step 2: Identify the shape. Step 3: Calculate the gradient."
- **Extension**: Include v-t graphs with negative acceleration (deceleration); challenge students to calculate distance from area under a v-t graph with changing velocity

### E21CC Focus
- **CAIT**: Graph interpretation requires analytical reasoning; data collection develops investigative thinking
- **CCI**: Station rotation and pair work develop collaboration; presenting graph findings builds communication` }
    ],
    plan: '',
    components: {
      timeline: {
        content: `| Phase | Time | Activity | Layout |
|-------|------|----------|--------|
| Human Graph | 0–10 min | Students act out motion, peer sketches d-t graph live | U-Shape / open space |
| Concept Build | 10–25 min | Speed vs velocity vs acceleration — worked examples | Direct Instruction |
| Data Collection | 25–45 min | Ticker tape / motion sensor stations — groups collect data and plot graphs | Stations |
| Graph Challenge | 45–60 min | Pairs interpret 6 graphs — describe motion, calculate gradient | Collaborative Pods |
| Consolidate | 60–70 min | Quick-fire graph sketching on mini-whiteboards + exit ticket | Quiet Work |`,
        meta: 'Auto-generated exemplar',
        updatedAt: Date.now()
      },
      rubric: {
        content: `### Kinematics Graph Interpretation Rubric

| Criterion | Excellent (4) | Good (3) | Developing (2) | Beginning (1) |
|-----------|--------------|----------|-----------------|----------------|
| Graph reading | Correctly identifies all motion types from graph shape | Minor errors in one graph | Identifies some motion types, misreads others | Cannot interpret graph shapes |
| Gradient calculation | Accurate gradient calculation with correct units | Correct method, minor arithmetic error | Attempts gradient but incorrect method | Does not attempt or incorrect approach |
| Motion description | Precise description using correct physics terminology | Mostly correct description, some informal language | Partial description, missing key details | Vague or incorrect description |
| d-t vs v-t distinction | Clearly explains what gradient and area represent for each graph type | Mostly correct, minor confusion | Confuses d-t and v-t interpretation | Cannot distinguish between graph types |`,
        meta: 'Assessment rubric for Kinematics',
        updatedAt: Date.now()
      }
    }
  },
  {
    title: 'Integration \u2014 Area Under a Curve',
    classKey: 2, // links to 4C Mathematics
    status: 'ready',
    e21ccFocus: ['criticalThinking'],
    objectives: 'Students will understand integration as the reverse of differentiation, evaluate definite integrals of polynomial functions, and interpret the definite integral as the area under a curve.',
    chatHistory: [
      { role: 'user', content: 'Plan a Sec 4 A-Math lesson on integration. Focus on definite integrals and area under a curve. I want students to build intuition through graphing before moving to algebraic methods. Include LaTeX-formatted worked examples.' },
      { role: 'assistant', content: `## Integration \u2014 Area Under a Curve (Sec 4 Additional Mathematics)

### Learning Objectives
By the end of this lesson, students will be able to:
1. State that integration is the reverse process of differentiation
2. Integrate expressions of the form $ax^n$ where $n \\neq -1$
3. Evaluate definite integrals such as $\\displaystyle\\int_1^3 (2x + 1)\\,dx$
4. Interpret the definite integral as the area bounded by a curve, the $x$-axis, and the lines $x = a$ and $x = b$

### Lesson Flow (70 min double period)

**Phase 1 \u2014 Hook: The Rectangle Problem (10 min)**
- Display the graph of $y = x^2$ on the board (or projector)
- Ask: *"How would you find the area between this curve and the $x$-axis, from $x = 0$ to $x = 2$?"*
- Students suggest ideas \u2014 likely: count grid squares, draw rectangles
- Show a diagram with 4 rectangles under the curve, then 8 rectangles, then 16
- Key insight: as rectangles get thinner, the approximation improves
- Introduce the idea: *"Integration gives us the exact answer."*

**Phase 2 \u2014 Concept Build: Integration as Anti-differentiation (15 min)**
- Recall differentiation rules:

$$\\frac{d}{dx}(x^3) = 3x^2 \\qquad \\frac{d}{dx}(x^4) = 4x^3$$

- Pose the reverse question: *"If $\\frac{dy}{dx} = 2x$, what is $y$?"*
- Introduce the integral notation and the power rule for integration:

$$\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C \\qquad (n \\neq -1)$$

- Worked Example 1 \u2014 Indefinite integral:

$$\\int (3x^2 + 4x - 5)\\,dx = \\frac{3x^3}{3} + \\frac{4x^2}{2} - 5x + C = x^3 + 2x^2 - 5x + C$$

- Emphasise the constant of integration $C$ for indefinite integrals

**Phase 3 \u2014 Definite Integrals: From Algebra to Area (20 min)**
- Introduce the definite integral with limits:

$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$

- Worked Example 2 \u2014 Evaluate step by step:

$$\\int_1^3 (2x + 1)\\,dx = \\Big[x^2 + x\\Big]_1^3 = (9 + 3) - (1 + 1) = 12 - 2 = 10$$

- Graphing connection: sketch $y = 2x + 1$ from $x = 1$ to $x = 3$ \u2014 it is a trapezium!
- Verify using the trapezium formula: $\\frac{1}{2}(3 + 7)(2) = 10$ \u2709

- Worked Example 3 \u2014 Area under a curve:

$$\\text{Find the area under } y = x^2 + 1 \\text{ from } x = 0 \\text{ to } x = 3$$

$$A = \\int_0^3 (x^2 + 1)\\,dx = \\left[\\frac{x^3}{3} + x\\right]_0^3 = \\left(\\frac{27}{3} + 3\\right) - (0) = 9 + 3 = 12 \\text{ units}^2$$

- Draw the curve, shade the region, label the bounds \u2014 connect algebra to geometry

**Phase 4 \u2014 Guided Practice: Graphing & Computing (20 min)**
- Students work in pairs on a set of 5 problems. For each:
  1. Sketch the graph of $y = f(x)$
  2. Shade the required region
  3. Evaluate the definite integral
  4. Verify the answer makes sense (e.g. positive area, reasonable magnitude)

Practice Set:
- (a) $\\displaystyle\\int_0^2 3x^2\\,dx$
- (b) $\\displaystyle\\int_1^4 (x + 2)\\,dx$
- (c) $\\displaystyle\\int_0^1 (4 - x^2)\\,dx$
- (d) $\\displaystyle\\int_2^5 (2x - 3)\\,dx$
- (e) $\\displaystyle\\int_{-1}^{2} (x^2 + x + 1)\\,dx$

Key discussion point for (e): the limits include a negative $x$-value \u2014 does the area still work? (Yes, the curve is above the $x$-axis throughout.)

**Phase 5 \u2014 Consolidate & Exit Ticket (5 min)**
- Summary on board:
  - $\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C$
  - $\\int_a^b f(x)\\,dx = F(b) - F(a) = $ area under curve (when $f(x) \\geq 0$)

- Exit Ticket: *Evaluate $\\displaystyle\\int_1^4 (3x^2 - 2x + 1)\\,dx$ and sketch the region whose area it represents.*

- Metacognitive prompt: *"In your own words, how are differentiation and integration related? Give one example."*

### Resources Needed
- Graphing calculator or Desmos on student devices (for curve sketching)
- Printed practice worksheet with graph paper grids
- Mini-whiteboards for quick checks
- Projector for displaying graphs and worked examples

### Differentiation
- **Support**: Provide a step-by-step scaffold card: "Step 1: Integrate each term. Step 2: Write with square brackets and limits. Step 3: Substitute upper limit. Step 4: Subtract lower limit."
- **Extension**: Introduce regions below the $x$-axis where $\\int_a^b f(x)\\,dx < 0$ and the need to take $\\left|\\int_a^b f(x)\\,dx\\right|$ for area. Challenge: find the area enclosed between $y = x^2$ and $y = 4$.

### E21CC Focus
- **CAIT**: Algebraic reasoning, connecting graphical and algebraic representations, verifying answers using multiple methods` }
    ],
    plan: '',
    components: {
      timeline: {
        content: `| Phase | Time | Activity | Layout |
|-------|------|----------|--------|
| Rectangle Problem | 0\u201310 min | Hook: estimating area under $y = x^2$ using rectangles | Direct Instruction |
| Anti-differentiation | 10\u201325 min | Integration rules, power rule, indefinite integrals with $C$ | Direct Instruction |
| Definite Integrals | 25\u201345 min | Worked examples: $\\int_1^3 (2x+1)\\,dx$, area under $y = x^2 + 1$ | Direct Instruction |
| Guided Practice | 45\u201365 min | Pairs: sketch, shade, compute 5 definite integrals | Collaborative Pods |
| Consolidate | 65\u201370 min | Exit ticket: evaluate and sketch $\\int_1^4 (3x^2 - 2x + 1)\\,dx$ | Quiet Work |`,
        meta: 'Auto-generated exemplar',
        updatedAt: Date.now()
      },
      rubric: {
        content: `### Integration \u2014 Area Under a Curve Rubric

| Criterion | Excellent (4) | Good (3) | Developing (2) | Beginning (1) |
|-----------|--------------|----------|-----------------|----------------|
| Integration technique | Correctly integrates all terms using $\\frac{x^{n+1}}{n+1}$ | Minor arithmetic error in one term | Applies rule inconsistently or forgets $+C$ in indefinite | Cannot apply the integration rule |
| Definite integral evaluation | Accurate substitution of limits and correct $F(b) - F(a)$ | Correct method, minor calculation slip | Confuses upper/lower limits or subtraction order | Does not attempt limit substitution |
| Graphical interpretation | Accurately sketches curve, shades correct region, labels bounds | Sketch mostly correct, minor labelling gaps | Sketch attempted but region incorrectly identified | No graph or incorrect graph |
| Verification | Cross-checks answer using alternative method (e.g. trapezium) | Checks answer is reasonable (sign, magnitude) | Limited verification | No checking |`,
        meta: 'Assessment rubric for Integration',
        updatedAt: Date.now()
      }
    }
  }
];

export function seedLessonsIfNeeded() {
  if (localStorage.getItem(LESSON_SEED_KEY)) return;
  const existing = Store.get('lessons') || [];
  if (existing.length > 0) {
    localStorage.setItem(LESSON_SEED_KEY, '1');
    return;
  }

  const classes = Store.getClasses();
  if (classes.length === 0) return; // classes must be seeded first

  EXEMPLAR_LESSONS.forEach(ex => {
    const cls = classes[ex.classKey] || classes[0];
    // Set the plan from the last assistant message
    const lastAssistantMsg = [...ex.chatHistory].reverse().find(m => m.role === 'assistant');
    Store.addLesson({
      title: ex.title,
      classId: cls.id,
      chatHistory: ex.chatHistory,
      plan: lastAssistantMsg?.content || '',
      objectives: ex.objectives,
      e21ccFocus: ex.e21ccFocus
    });
    // Update status and components
    const lessons = Store.get('lessons') || [];
    const created = lessons[lessons.length - 1];
    if (created) {
      Store.updateLesson(created.id, {
        status: ex.status,
        components: ex.components
      });
    }
  });

  localStorage.setItem(LESSON_SEED_KEY, '1');
}

/* ══════════════════════════════════════════════════════
   Assessment Seeding — Routines & Checklists
   ══════════════════════════════════════════════════════ */

export function seedAssessmentIfNeeded() {
  if (localStorage.getItem(ASSESSMENT_SEED_KEY)) return;
  const existing = Store.getRoutines();
  if (existing.length > 0) {
    localStorage.setItem(ASSESSMENT_SEED_KEY, '1');
    return;
  }

  // Seed built-in metacognitive routines
  BUILT_IN_ROUTINES.forEach(r => {
    Store.addRoutine({
      name: r.name,
      description: r.description,
      isBuiltIn: true,
      steps: r.steps.map(s => ({
        key: s.key,
        label: s.label,
        colour: s.colour,
        description: s.description,
        questions: s.questions
      }))
    });
  });

  // Seed built-in observation checklists
  BUILT_IN_CHECKLISTS.forEach(c => {
    Store.addChecklist({
      name: c.name,
      type: c.type,
      subject: c.subject,
      isBuiltIn: true,
      criteria: c.criteria.map(cr => ({
        id: generateId(),
        text: cr.text,
        scale: cr.scale
      }))
    });
  });

  localStorage.setItem(ASSESSMENT_SEED_KEY, '1');
}

/* ══════════════════════════════════════════════════════
   Full-Lifecycle Exemplar Lessons — 9 subjects
   ══════════════════════════════════════════════════════ */

const EXEMPLAR_SEED_KEY = 'cocher_exemplars_seeded_v1';
const DAY = 86400000;

const LIFECYCLE_EXEMPLARS = [
  /* ── 1. English — completed, with reflection ── */
  {
    title: 'Argumentative Writing — Social Media on Trial',
    classMatch: ['English'],
    status: 'completed',
    createdDaysAgo: 21,
    updatedDaysAgo: 19,
    e21ccFocus: ['criticalThinking', 'communication'],
    objectives: 'Students will construct PEEL paragraphs for an argumentative essay, anticipate and rebut counter-arguments, and evaluate the credibility of evidence used to support a claim.',
    lessonHook: 'Last month a fake "MRT stabbing" video hit 2 million views before it was debunked. Who profits when outrage spreads faster than facts — and does social media do more harm than good?',
    chat: {
      user: 'Plan a Sec 4 English lesson on argumentative writing for O-Level Paper 1. Topic: "Social media does more harm than good." I want students to practise PEEL paragraphs and rebutting counter-arguments, with a hook about fake news.',
      assistant: `## Argumentative Writing — Social Media on Trial (Sec 4 English)

### Learning Objectives
By the end of this lesson, students will be able to:
1. Construct a PEEL paragraph (Point, Evidence, Explanation, Link) supporting a clear stance
2. Anticipate a counter-argument and write an effective rebuttal
3. Evaluate whether a piece of evidence is credible, relevant, and sufficient

### Lesson Flow (70 min)

**Hook — The Viral Lie (10 min)**
Show the (debunked) "MRT stabbing" video headline and its 2-million-view count next to the SPH fact-check. Ask: who gained from the spread? Students discuss in pairs, then vote on the motion: *social media does more harm than good*.

**Deconstruct — What Makes an Argument Land? (15 min)**
Display two sample paragraphs on the motion — one assertive but unsupported, one full PEEL. Students annotate: where is the evidence, where is the explanation, what links back to the stance? Draw out the PEEL frame on the board.

**Build — PEEL Workshop (20 min)**
In groups of 4, students draft one PEEL paragraph on an assigned angle (mental health, scams and misinformation, activism, small business reach). Evidence bank provided: IMDA digital literacy statistics, a Straits Times scam report, a case of crowdfunded charity. Groups must reject at least one weak piece of evidence and justify why.

**Clash — Rebuttal Round (15 min)**
Groups swap paragraphs and write the strongest possible counter-argument to the paragraph they receive, then return it. Original group drafts a two-sentence rebuttal using concession language ("While it is true that… the evidence suggests…").

**Consolidate & Exit Ticket (10 min)**
Class reconstructs the full essay skeleton: stance, 3 PEEL points, counter-argument + rebuttal, conclusion. Exit ticket: write one PEEL paragraph on a fresh motion under timed conditions (8 min).

### Differentiation
- **Support**: PEEL sentence starters and a pre-sorted evidence bank
- **Extension**: require a hedged thesis that concedes scope ("in the hands of teenagers…")

### E21CC Focus
- **Critical thinking**: evaluating evidence credibility, constructing rebuttals
- **Communication**: precise persuasive language, concession phrasing`
    },
    components: {
      lisc: `**Learning Intentions**
- We are learning to build persuasive arguments using the PEEL structure
- We are learning to anticipate and rebut counter-arguments fairly

**Success Criteria**
- I can write a PEEL paragraph with credible, relevant evidence
- I can express a counter-argument accurately before rebutting it
- I can use concession language ("while it is true that…") in a rebuttal
- I can explain why a piece of evidence is weak or unreliable

**E21CC Alignment**: Critical Thinking (evaluating evidence), Communication (persuasive register)`,
      timeline: `| Phase | Time | Activity | Layout |
|-------|------|----------|--------|
| Hook: The Viral Lie | 0–10 min | Debunked video headline vs fact-check; pair talk + class vote | Direct Instruction |
| Deconstruct | 10–25 min | Annotate strong vs weak sample paragraphs; derive PEEL frame | Direct Instruction |
| PEEL Workshop | 25–45 min | Groups draft PEEL paragraph from evidence bank; reject one weak source | Collaborative Pods |
| Rebuttal Round | 45–60 min | Swap paragraphs, write counter-arguments, draft rebuttals | Collaborative Pods |
| Consolidate + Exit Ticket | 60–70 min | Essay skeleton on board; timed solo PEEL paragraph | Quiet Work |`,
      exitTicket: `### Exit Ticket — Argumentative Writing

1. Write ONE full PEEL paragraph on the motion: *"Homework should be replaced by project work."* (8 minutes, on your own)
2. Underline your evidence and label it E. In one sentence, say why a sceptical reader should trust it.
3. Confidence check: rate 1–5 how ready you feel to write a full argumentative essay, and name the ONE part of PEEL you most need to practise.`
    },
    reflection: {
      whatWorked: 'The fake-news hook sparked genuine debate — students were still arguing about the MRT video at recess. The PEEL annotation task gave the middle band a concrete frame, and the rebuttal swap produced some of the best concession sentences I have seen from this class.',
      whatToAdjust: 'The rebuttal round overran by 10 minutes because groups negotiated stances too long — pre-assign angles next time. Three weakest writers needed sentence starters earlier, not after they stalled.',
      engagement: 4,
      e21ccObservations: 'Strong critical thinking when evaluating the evidence bank; two groups rejected the crowdfunding anecdote as unrepresentative without prompting. Communication was uneven — dominant speakers crowded out quieter members during the clash round.',
      freeform: 'Keep the same hook next run but pair it with the IMDA media literacy infographic. Timed exit paragraph was the right level of pressure — collect and use as the diagnostic for the next essay cycle.'
    }
  },

  /* ── 2. Mathematics — ready + rehearsed ── */
  {
    title: 'Quadratic Functions — Modelling Projectile Motion',
    classMatch: ['Mathematics'],
    status: 'ready',
    createdDaysAgo: 16,
    updatedDaysAgo: 3,
    rehearsedDaysAgo: 2,
    e21ccFocus: ['criticalThinking', 'collaboration'],
    objectives: 'Students will sketch quadratic graphs identifying the vertex, axis of symmetry and intercepts, model a real projectile path with a quadratic function, and interpret the maximum point in context.',
    lessonHook: 'A free throw leaves the shooter’s hands at 2.1 m and drops through the hoop at 3.05 m. From just three tracked points of the ball’s flight, can we predict the entire path — and whether it was ever going to miss?',
    chat: {
      user: 'Plan a Sec 4 E-Math lesson on graphs of quadratic functions. I want a real-world modelling angle — basketball projectile motion — leading to sketching, completing the square for the vertex, and interpreting maximum points in context.',
      assistant: `## Quadratic Functions — Modelling Projectile Motion (Sec 4 Mathematics)

### Learning Objectives
By the end of this lesson, students will be able to:
1. Sketch the graph of y = ax² + bx + c, identifying intercepts, vertex and axis of symmetry
2. Express a quadratic in the form y = a(x − h)² + k and read off the maximum/minimum point
3. Interpret the vertex and intercepts of a quadratic model in a real-world context

### Lesson Flow (70 min)

**Hook — The Free Throw (10 min)**
Play a 20-second clip of a free throw, freeze-framed at three points with coordinates displayed (release, peak, hoop). Ask: is three points enough to know the whole flight? Students conjecture, then reveal that exactly one quadratic passes through three (non-collinear) points.

**Concept Build — Anatomy of a Parabola (15 min)**
Using y = −x² + 4x + 1 on the board: find y-intercept, use the formula x = −b/2a for the axis of symmetry, complete the square to confirm the vertex. Emphasise the link: same information, two routes.

**Guided Practice — Fit the Flight (20 min)**
Pairs receive the three tracked points of the free throw. Using a scaffolded sheet, they solve for a, b, c, then answer in context: What was the greatest height? Was the ball still rising at the hoop? Where would it have landed if it missed everything?

**Gallery Compare (10 min)**
Pairs post their sketches. Compare with a second data set (a "brick" that hits the front rim) — what changed in the model: a, the vertex, or both?

**Consolidate & Exit Ticket (15 min)**
Summarise: vertex form vs general form, and when each is fastest. Exit ticket: sketch y = 2(x − 3)² − 5, labelling vertex, axis of symmetry and y-intercept, and state one real quantity the vertex could represent in a projectile model.

### Differentiation
- **Support**: completing-the-square steps pre-structured; axis-of-symmetry formula card
- **Extension**: derive the release angle question — what does the gradient at x = 0 tell you?

### E21CC Focus
- **Critical thinking**: linking algebraic features to physical meaning
- **Collaboration**: paired modelling with shared accountability for the sketch`
    },
    components: {
      lisc: `**Learning Intentions**
- We are learning to sketch quadratic graphs and identify their key features
- We are learning to use a quadratic function as a model of real motion

**Success Criteria**
- I can find the vertex by completing the square AND by x = −b/2a
- I can sketch a parabola with labelled vertex, axis of symmetry and intercepts
- I can interpret the maximum point of a model in context (greatest height)
- I can explain what the coefficient a does to the shape of the path

**E21CC Alignment**: Critical Thinking (representation-linking), Collaboration (paired modelling)`,
      timeline: `| Phase | Time | Activity | Layout |
|-------|------|----------|--------|
| Hook: The Free Throw | 0–10 min | Freeze-frame clip, three tracked points, conjecture | Direct Instruction |
| Anatomy of a Parabola | 10–25 min | Worked example: intercepts, axis, completing the square | Direct Instruction |
| Fit the Flight | 25–45 min | Pairs fit a quadratic through 3 points; answer in context | Collaborative Pods |
| Gallery Compare | 45–55 min | Compare successful shot vs "brick" data set | Gallery Walk |
| Consolidate + Exit Ticket | 55–70 min | Vertex form vs general form; solo sketch task | Quiet Work |`,
      exitTicket: `### Exit Ticket — Quadratic Graphs

1. Sketch y = 2(x − 3)² − 5. Label the vertex, the axis of symmetry, and the y-intercept.
2. Is the vertex a maximum or a minimum? How do you know from the equation alone?
3. In the free-throw model, what real quantity did the vertex represent? One sentence.
4. Traffic light: green / amber / red on completing the square.`
    }
  },

  /* ── 3. Physics — ready ── */
  {
    title: 'Series & Parallel Circuits — Why Chargers Overheat',
    classMatch: ['Physics', 'Combined Science'],
    status: 'ready',
    createdDaysAgo: 14,
    updatedDaysAgo: 12,
    e21ccFocus: ['criticalThinking', 'collaboration'],
    objectives: 'Students will state the current and potential difference rules for series and parallel circuits, calculate effective resistance, and apply P = IV to explain overheating in a household context.',
    lessonHook: 'A $2 third-party phone charger melted overnight and scorched a bedside table in a Yishun flat. The physics of current, resistance and power can tell us exactly why the cheap one failed — and why the original did not.',
    chat: {
      user: 'Plan a Sec 4 Combined Science (Physics) lesson on series and parallel circuits. Include hands-on circuit building, current/voltage rules, effective resistance, and connect it to why cheap chargers overheat.',
      assistant: `## Series & Parallel Circuits — Why Chargers Overheat (Sec 4 Combined Science, Physics)

### Learning Objectives
By the end of this lesson, students will be able to:
1. State that current is the same at every point in a series circuit and splits across branches in parallel
2. State that p.d. is shared across components in series and equal across branches in parallel
3. Calculate the effective resistance of resistors in series and in parallel (two resistors)
4. Use P = IV to explain heating effects in a real household scenario

### Lesson Flow (70 min)

**Hook — The Melted Charger (8 min)**
Photo of the scorched bedside table (news report). Ask: the wall socket supplies the same 230 V to every charger — so what could possibly differ inside a $2 charger? Collect hypotheses on the board; return to them at the end.

**Predict-Build-Measure Stations (25 min)**
Groups of 4 rotate through two station types with ammeters and voltmeters:
- **Station S**: two lamps in series — predict, then measure current at three points and p.d. across each lamp
- **Station P**: two lamps in parallel — predict, then measure branch currents and p.d. across each branch
Record on a shared results grid. Rule: every member must take at least one reading.

**Pattern Harvest (12 min)**
Class compiles station data. Draw out the four rules (current/series, current/parallel, p.d./series, p.d./parallel). Brief direct instruction: effective resistance formulas, with one worked example each.

**Apply — The Charger Autopsy (15 min)**
Pairs work a structured problem: a charging cable with worn insulation drops its resistance; using P = IV and V = IR, calculate the new current and power dissipated, and explain where the heat goes. Link back to the hook hypotheses.

**Consolidate & Exit Ticket (10 min)**
Misconception check with mini-whiteboards ("current gets used up" — true or false, and prove it with today’s data). Exit ticket: two-resistor parallel calculation plus one sentence on why parallel wiring is used in homes.

### Differentiation
- **Support**: circuit diagrams pre-drawn on station cards; results grid part-filled
- **Extension**: three-resistor mixed circuit; qualitative fuse-rating question

### E21CC Focus
- **Critical thinking**: reasoning from measured data to general rules
- **Collaboration**: rotation roles — builder, reader, recorder, checker`
    },
    components: {
      lisc: `**Learning Intentions**
- We are learning how current and potential difference behave in series and parallel circuits
- We are learning to use P = IV to explain electrical heating in daily life

**Success Criteria**
- I can predict and verify current at different points in a series circuit
- I can show that p.d. across parallel branches is equal
- I can calculate effective resistance for two resistors in series or parallel
- I can explain, using P = IV, why a low-resistance fault causes overheating

**E21CC Alignment**: Critical Thinking (data to rules), Collaboration (station roles)`,
      timeline: `| Phase | Time | Activity | Layout |
|-------|------|----------|--------|
| Hook: Melted Charger | 0–8 min | Scorched-table photo; hypotheses on board | Direct Instruction |
| Predict-Build-Measure | 8–33 min | Series and parallel stations with meters | Stations |
| Pattern Harvest | 33–45 min | Compile data, derive 4 rules, effective resistance | Direct Instruction |
| Charger Autopsy | 45–60 min | Pairs: worn-cable calculation with P = IV | Collaborative Pods |
| Consolidate + Exit Ticket | 60–70 min | Misconception check; solo calculation | Quiet Work |`,
      exitTicket: `### Exit Ticket — Series & Parallel Circuits

1. Two 4 Ω resistors are connected in parallel to a 12 V supply. Find the effective resistance and the total current drawn.
2. True or false, with one line of evidence from today’s stations: "Current is used up as it passes through each lamp."
3. In one sentence: why are the lights in your home wired in parallel, not series?`
    }
  },

  /* ── 4. Chemistry — completed, with reflection ── */
  {
    title: 'Rate of Reaction — The Disappearing Cross',
    classMatch: ['Pure Chemistry', 'Chemistry'],
    status: 'completed',
    createdDaysAgo: 18,
    updatedDaysAgo: 15,
    e21ccFocus: ['criticalThinking', 'selfRegulation'],
    objectives: 'Students will describe the effect of concentration on reaction rate using collision theory, carry out the sodium thiosulfate and acid investigation safely, and interpret rate graphs from experimental data.',
    lessonHook: 'Glow sticks last hours longer in the freezer — same chemicals, different speed. What actually controls how fast a reaction goes, and can we measure it with nothing but a paper cross and a stopwatch?',
    chat: {
      user: 'Plan a Sec 4 Pure Chemistry practical lesson on rate of reaction using the sodium thiosulfate disappearing cross investigation. Focus on the effect of concentration, collision theory explanations, and graphing rate data.',
      assistant: `## Rate of Reaction — The Disappearing Cross (Sec 4 Pure Chemistry)

### Learning Objectives
By the end of this lesson, students will be able to:
1. Describe how concentration affects rate of reaction in terms of collision frequency
2. Carry out the Na₂S₂O₃ + HCl investigation safely and record timing data accurately
3. Plot 1/time against concentration and interpret the graph as a rate proxy

### Lesson Flow (70 min double, lab)

**Hook — Glow Sticks in the Freezer (8 min)**
Two glow sticks snapped at the start of class: one into iced water, one into warm water. Park them visibly. Ask: same chemicals — what will differ by the end of the lesson, and why? Introduce today’s question: what controls reaction speed?

**Briefing & Safety (10 min)**
Demonstrate the disappearing cross setup: flask on printed cross, add HCl to thiosulfate, time until the cross vanishes. Safety points: SO₂ produced in small amounts — lab ventilation on, flasks stoppered for disposal, goggles throughout. Show how to read the measuring cylinder at eye level.

**Investigation — Concentration Series (30 min)**
Groups of 3 run five dilutions of thiosulfate (40, 32, 24, 16, 8 cm³ topped up to 50 cm³ with water), constant acid volume. Each member rotates roles: measurer, timer, recorder. Groups tabulate time and compute 1/time.

**Graph & Explain (15 min)**
Groups plot 1/time vs concentration on provided grids. Discussion: why is 1/time a fair stand-in for rate? Collision theory paragraph built collectively on the board: more particles per cm³ → more frequent effective collisions → greater rate.

**Consolidate & Exit Ticket (7 min)**
Return to the glow sticks — students explain the difference using collision theory (energy of collisions this time). Exit ticket: sketch the expected graph for doubling temperature and justify in two sentences.

### Differentiation
- **Support**: pre-drawn results table and graph axes; dilution volumes given
- **Extension**: predict and defend the effect of halving acid concentration instead

### E21CC Focus
- **Critical thinking**: justifying 1/time as a rate proxy
- **Self-regulation**: role rotation and lab checklist self-monitoring`
    },
    components: {
      lisc: `**Learning Intentions**
- We are learning how concentration affects the rate of a reaction
- We are learning to collect and represent rate data from a timed investigation

**Success Criteria**
- I can carry out the disappearing cross procedure safely and consistently
- I can compute 1/time and explain why it stands in for rate
- I can plot and interpret a rate–concentration graph
- I can explain the trend using collision theory (frequency of effective collisions)

**E21CC Alignment**: Critical Thinking (proxy reasoning), Self-Regulation (lab checklist, role rotation)`,
      timeline: `| Phase | Time | Activity | Layout |
|-------|------|----------|--------|
| Hook: Glow Sticks | 0–8 min | Iced vs warm glow sticks parked; framing question | Direct Instruction |
| Briefing & Safety | 8–18 min | Demo setup, SO₂ precautions, meniscus reading | Direct Instruction |
| Concentration Series | 18–48 min | Groups run 5 dilutions, rotate roles, tabulate | Stations (lab benches) |
| Graph & Explain | 48–63 min | Plot 1/time vs concentration; collision theory build | Collaborative Pods |
| Consolidate + Exit Ticket | 63–70 min | Glow stick explanation; temperature prediction | Quiet Work |`,
      exitTicket: `### Exit Ticket — Rate of Reaction

1. Sketch the 1/time vs concentration graph your group obtained. Label the axes with units.
2. In two sentences, use collision theory to explain the shape of your graph.
3. Prediction: the same experiment is run 10 °C warmer. Sketch the new line on the same axes and justify it in one sentence.`
    },
    reflection: {
      whatWorked: 'The disappearing cross ran cleanly — timings were tight across groups (28–90 s), which made the 1/time vs concentration graph genuinely convincing. Pre-measured thiosulfate volumes saved a good 10 minutes, and the glow stick bookend gave the lesson a satisfying full-circle close.',
      whatToAdjust: 'Two groups misread the measuring cylinder — add a 2-minute meniscus demo before release next time. Extension groups finished early; have the temperature variation prepared as a ready-to-go second station rather than a verbal prompt.',
      engagement: 5,
      e21ccObservations: 'Self-regulation clearly improving: four of six groups used the lab checklist unprompted and rotated roles without reminders. Strong reasoning when predicting the effect of halving concentration before testing — several students framed it in collisions per second without prompting.',
      freeform: 'SO₂ smell noticeable by period end despite small volumes — book Lab 2 with the newer fume extraction next run. The 1/time discussion is worth a full 5 minutes; do not rush it.'
    }
  },

  /* ── 5. Biology — draft ── */
  {
    title: 'Enzymes — Why Pineapple Ruins Jelly',
    classMatch: ['Biology', 'Combined Science'],
    status: 'draft',
    createdDaysAgo: 6,
    updatedDaysAgo: 5,
    e21ccFocus: ['criticalThinking'],
    objectives: 'Students will describe the lock-and-key model of enzyme action, explain the effect of temperature and pH on enzyme activity, and design a fair test using fresh vs canned pineapple on gelatine.',
    lessonHook: 'Add fresh pineapple to jelly and it never sets — but canned pineapple works fine. One enzyme, bromelain, is quietly eating the gelatine. Why does the canned version lose its power, and what does that tell us about every enzyme in your body?',
    chat: {
      user: 'Plan a Sec 4 Biology lesson introducing enzymes for Combined Science. Cover the lock-and-key model and the effect of temperature and pH. I want a fresh-vs-canned pineapple jelly investigation as the anchor, and I want students designing the fair test themselves.',
      assistant: `## Enzymes — Why Pineapple Ruins Jelly (Sec 4 Biology)

### Learning Objectives
1. Describe enzymes as biological catalysts using the lock-and-key model
2. Explain the effect of temperature and pH on enzyme activity (including denaturation)
3. Design a fair test with clearly identified variables

### Lesson Flow (70 min)
**Hook — The Jelly That Won't Set (10 min)** — Show two jelly cups: one with fresh pineapple (liquid), one with canned (set). Students propose explanations in pairs.

**Model Building (15 min)** — Introduce bromelain as an enzyme; build the lock-and-key model with a physical cut-out substrate. Draw the labelled diagram together.

**Design the Test (20 min)** — Groups design a fair test: fresh vs canned vs boiled-fresh pineapple on gelatine. They identify independent, dependent, and controlled variables. (This is the E21CC critical-thinking core — do not hand them the method.)

**Predict & Explain (15 min)** — Why does boiling the fresh pineapple make the jelly set again? Link to denaturation. Extend to pH with a stomach-enzyme example.

**Exit Ticket (10 min)** — Label a denaturation diagram; predict one more variable.

*Note: this is still a draft — the fair-test scaffold needs a worksheet, and I want to add a temperature-gradient extension before teaching it.*`
    },
    components: {
      lisc: `**Learning Intentions**
- We are learning how enzymes speed up reactions using the lock-and-key model
- We are learning how temperature and pH change enzyme activity

**Success Criteria**
- I can explain why fresh pineapple stops jelly setting but boiled pineapple does not
- I can identify the independent, dependent and controlled variables in our test
- I can use the word "denatured" correctly to describe a heated enzyme`
    }
  },
];

/* Turn a compact exemplar spec into the Store lesson shape. */
function buildExemplarLesson(ex, classes, now) {
  const cls = classes.find(c => (ex.classMatch || []).some(m =>
    (c.subject || '').toLowerCase().includes(m.toLowerCase()))) || null;
  const chatHistory = ex.chat ? [
    { role: 'user', content: ex.chat.user },
    { role: 'assistant', content: ex.chat.assistant }
  ] : [];
  // Component entries follow the planner shape { content, meta, updatedAt }
  const components = {};
  Object.entries(ex.components || {}).forEach(([k, content]) => {
    components[k] = { content, meta: '', updatedAt: now - (ex.updatedDaysAgo || 1) * DAY };
  });
  return {
    title: ex.title,
    classId: cls ? cls.id : null,
    status: ex.status || 'draft',
    chatHistory,
    plan: ex.chat ? ex.chat.assistant : '',
    objectives: ex.objectives || '',
    lessonHook: ex.lessonHook || '',
    e21ccFocus: ex.e21ccFocus || [],
    components,
    reflection: ex.reflection || '',
    rehearsedAt: ex.rehearsedAt ? now - ex.rehearsedAt * DAY : undefined,
    isExemplar: true,
    createdAt: now - (ex.createdDaysAgo || 7) * DAY,
    updatedAt: now - (ex.updatedDaysAgo || 5) * DAY
  };
}

const EXEMPLAR_REHEARSED = new Set([
  'Quadratic Functions — Modelling Projectile Motion',
  'Series & Parallel Circuits — Why Chargers Overheat'
]);

export function seedExemplarsIfNeeded() {
  if (localStorage.getItem(EXEMPLAR_SEED_KEY)) return;
  const classes = Store.getClasses();
  if (classes.length === 0) return; // classes must exist first
  const now = Date.now();
  const existing = Store.get('lessons') || [];
  LIFECYCLE_EXEMPLARS.forEach(ex => {
    if (existing.some(l => l.title === ex.title)) return;
    const spec = { ...ex };
    if (EXEMPLAR_REHEARSED.has(ex.title)) spec.rehearsedAt = 4;
    const created = Store.addLesson(buildExemplarLesson(spec, classes, now));
    // addLesson forces status 'draft' and reflection '' — apply the rest
    Store.updateLesson(created.id, {
      status: spec.status || 'draft',
      components: created.components,
      reflection: spec.reflection || '',
      rehearsedAt: spec.rehearsedAt ? now - spec.rehearsedAt * DAY : undefined,
      isExemplar: true,
      lessonHook: spec.lessonHook || '',
      createdAt: now - (spec.createdDaysAgo || 7) * DAY,
      updatedAt: now - (spec.updatedDaysAgo || 5) * DAY
    });
  });
  localStorage.setItem(EXEMPLAR_SEED_KEY, '1');
}

/* ══════════════════════════════════════════════════════
   Portal Demo Seeds — KB, PD, Stimulus, Sources, CCE,
   Admin, Spatial layouts (for demo/testing)
   ══════════════════════════════════════════════════════ */

const PORTAL_SEED_KEY = 'cocher_portal_demos_seeded_v1';

export function seedPortalDemosIfNeeded() {
  if (localStorage.getItem(PORTAL_SEED_KEY)) return;
  const now = Date.now();
  const classes = Store.getClasses();
  const firstClassId = classes[0]?.id || null;

  /* ── Knowledge Base uploads (content → IndexedDB via Store.set) ── */
  if ((Store.get('knowledgeUploads') || []).length === 0) {
    const uploads = [
      {
        id: generateId(), title: 'Sec 4 Chemistry — Scheme of Work (Term 3)',
        category: 'Scheme of Work', subject: 'Pure Chemistry', classId: firstClassId,
        content: `SCHEME OF WORK — SEC 4 PURE CHEMISTRY (TERM 3)\n\nUnit: Chemical Bonding & the Mole\nDuration: 6 weeks\n\nWeek 1-2 — Ionic & Covalent Bonding: electron transfer/sharing, dot-and-cross diagrams, giant vs simple structures. E21CC: Critical Thinking (structure-property reasoning).\nWeek 3 — Metallic bonding & properties; comparison table across bonding types.\nWeek 4-5 — The Mole Concept: Avogadro constant, molar mass, mole calculations, reacting masses. Common misconception: confusing moles with mass.\nWeek 6 — Consolidation, practical (titration link), Topical Test.\n\nAssessment: 1 formative exit-quiz per week, 1 practical write-up (titration), Topical Test (Bonding + Mole).\nDifferentiation: worked-example scaffolds for weaker students; extension on lattice energy trends for stronger.`,
        notes: 'Sample SoW — auto-attaches as planner context.', isSample: true, createdAt: now - 20 * DAY
      },
      {
        id: generateId(), title: 'School Assessment Policy 2026 (Extract)',
        category: 'Exam Paper / Assessment', subject: '', classId: null,
        content: `ASSESSMENT POLICY 2026 (EXTRACT)\n\n1. Balance of Assessment: Every subject maintains a mix of Assessment for/as/of Learning. AfL (formative) should occur every lesson; AoL (summative) at most twice per term.\n2. Feedback: Written feedback on major tasks within 2 weeks; feedback must be actionable ("next step" comment), not just a grade.\n3. Weighting: Continual Assessment 40%, Semestral Assessment 60% for G3/O-Level streams.\n4. Late/Absent: MC-covered absences → medical exemption, weighted from remaining components.\n5. E21CC Reporting: Each report cycle includes a holistic comment referencing at least two E21CC domains observed.`,
        notes: 'Sample policy document.', isSample: true, createdAt: now - 18 * DAY
      },
      {
        id: generateId(), title: 'Pedagogy Note — Productive Failure (Kapur)',
        category: 'Curriculum / Syllabus', subject: '', classId: null,
        content: `PRODUCTIVE FAILURE — QUICK REFERENCE\n\nCore idea (Manu Kapur, NIE): let students grapple with a complex problem BEFORE instruction. The struggle activates prior knowledge and primes them to understand the expert solution more deeply.\n\nDesign pattern:\n1. Generation & Exploration — students invent multiple solutions to a hard problem (no teaching yet). Expect failure; that is the point.\n2. Consolidation — teacher contrasts student attempts with the canonical method, naming why the expert solution works.\n\nWhen it works best: concept-rich topics (gradient, density, mole, rate). Avoid for pure procedural fluency.\nE21CC: strong Critical & Inventive Thinking; builds Self-Regulation through struggle.`,
        notes: 'Sample pedagogy reference.', isSample: true, createdAt: now - 15 * DAY
      }
    ];
    Store.set('knowledgeUploads', uploads);
  }

  /* ── PD folder (My Learning) ── */
  const pdFolders = Store.get('pdFolders') || [];
  if (!pdFolders.some(f => f.name && f.name.includes('Assessment Literacy'))) {
    pdFolders.push({
      id: generateId(), name: 'Assessment Literacy Workshop 2026', category: 'workshop',
      description: 'MOE-run workshop on designing quality formative assessment and feedback.',
      tags: ['assessment', 'AfL', 'feedback'], isSample: true,
      materials: [
        { id: generateId(), title: 'Workshop Handout — Feedback that Moves Learning', type: 'note',
          content: 'Key takeaway: the best feedback answers three questions for the student — Where am I going? How am I going? Where to next? (Hattie & Timperley). Comment-only marking outperforms grades+comments because grades short-circuit the "where to next".', createdAt: now - 12 * DAY },
        { id: generateId(), title: 'My Action Plan', type: 'reflection',
          content: 'Trialling comment-only marking on the next two Chemistry practicals for 4A. Will compare re-submission quality against the graded baseline from Term 2.', createdAt: now - 11 * DAY }
      ],
      createdAt: now - 12 * DAY, updatedAt: now - 11 * DAY
    });
    Store.set('pdFolders', pdFolders);
  }

  /* ── Stimulus library ── */
  if ((Store.get('stimulusLibrary') || []).length === 0) {
    Store.set('stimulusLibrary', [
      { id: generateId(), title: 'The Last Kampong', subject: 'English', level: 'Sec 3', type: 'comprehension',
        content: 'Comprehension passage (adapted): a first-person recollection of Kampong Lorong Buangkok, Singapore’s last surviving village, contrasting communal kampong life with the anonymity of HDB living. Themes: belonging, modernity, loss.',
        questions: '1. Identify two details that convey the sense of community.\n2. Explain the writer’s attitude toward modern housing (quote + explain).\n3. Vocabulary in context: "anonymity".', teacherNotes: 'Pairs well with a National Education discussion.', wordCount: 42, createdAt: now - 14 * DAY, source: 'sample', isSample: true },
      { id: generateId(), title: 'Should Cash Be Abolished?', subject: 'General Paper', level: 'JC 1', type: 'scenario',
        content: 'Scenario stimulus: Singapore’s rapid shift to PayNow/cashless payments. Consider the elderly hawker who cannot use QR codes, the privacy trade-offs of digital trails, and financial inclusion.',
        questions: '1. Whose interests are served by going cashless?\n2. What is lost when cash disappears?', teacherNotes: 'Four-corners debate works well here.', wordCount: 38, createdAt: now - 10 * DAY, source: 'sample', isSample: true },
      { id: generateId(), title: 'The Bukit Timah Landslide (Case Study)', subject: 'Geography', level: 'Sec 4', type: 'case study',
        content: 'Case study stimulus: a hypothetical slope failure after intense monsoon rainfall near Bukit Timah. Includes rainfall data, slope angle, vegetation cover, and drainage notes for students to analyse causes and mitigation.',
        questions: '1. Identify the physical and human factors contributing to the landslide.\n2. Suggest two mitigation strategies and evaluate one.', teacherNotes: 'Links to the water cycle and urban planning units.', wordCount: 45, createdAt: now - 7 * DAY, source: 'sample', isSample: true }
    ]);
  }

  /* ── Source Analysis library ── */
  if ((Store.get('sourceLibrary') || []).length === 0) {
    Store.set('sourceLibrary', [
      { id: generateId(), title: 'Singapore’s Separation from Malaysia, 1965', subject: 'History', topic: 'Road to Independence', level: 'Sec 4', framework: 'sbq', source: 'sample', isSample: true,
        sources: [
          { title: 'Excerpt from a 1965 newspaper editorial', type: 'Written', provenance: 'The Straits Times, 10 August 1965', content: 'An editorial expressing shock and uncertainty at the announcement of separation, urging calm and unity among all races.' },
          { title: 'Photograph of Lee Kuan Yew’s press conference', type: 'Visual', provenance: 'Press photo, 9 August 1965', content: 'A widely circulated image of an emotional press conference announcing separation.' }
        ],
        questions: [
          { question: 'What can you infer from Source A about public sentiment in August 1965?', type: 'Inference', marks: 5, skill: 'Inference', e21cc: 'CGC' },
          { question: 'How far do Sources A and B agree about the mood of the nation? Explain.', type: 'Comparison', marks: 6, skill: 'Comparison', e21cc: 'CAIT' }
        ], createdAt: new Date(now - 16 * DAY).toISOString() },
      { id: generateId(), title: 'Climate Change & Small States', subject: 'Social Studies', topic: 'Living in a Globalised World', level: 'Sec 3', framework: 'seq', source: 'sample', isSample: true,
        sources: [
          { title: 'Statement by a Pacific island leader at COP', type: 'Written', provenance: 'UN Climate Summit address', content: 'A plea from a low-lying island state on the existential threat of sea-level rise, calling for shared responsibility.' },
          { title: 'Line graph of global mean sea level 1990–2025', type: 'Data', provenance: 'Satellite altimetry dataset', content: 'A rising trend line showing accelerating sea-level rise over three decades.' }
        ],
        questions: [
          { question: 'Assess the reliability of Source A as evidence of the impact of climate change.', type: 'Reliability', marks: 6, skill: 'Reliability', e21cc: 'CAIT' },
          { question: 'To what extent should developed nations bear greater responsibility? Justify.', type: 'Assertion', marks: 8, skill: 'Evaluation', e21cc: 'CGC' }
        ], createdAt: new Date(now - 9 * DAY).toISOString() }
    ]);
  }

  /* ── CCE saved discussions ── */
  try {
    const cceKey = 'cocher_cce_discussions';
    const existingCce = JSON.parse(localStorage.getItem(cceKey) || '[]');
    if (existingCce.length === 0) {
      localStorage.setItem(cceKey, JSON.stringify([
        { id: generateId(), title: 'Handling Online Rumours Responsibly', contentArea: 'CW', bigIdea: 'Choices', values: 'Responsibility, Integrity', level: 'Sec 2', format: 'circle', isSample: true,
          content: '## Cyber Wellness Discussion — Online Rumours\n\n**Hook:** A classmate’s edited photo is spreading in a class chat.\n\n**Circle questions:**\n1. What would you feel if it were you?\n2. What is the difference between forwarding and creating?\n3. What is one responsible action you can take in the next 5 minutes?\n\n**Close:** Draft a class agreement on sharing.', createdAt: now - 13 * DAY },
        { id: generateId(), title: 'Respecting Difference — Race & Religion', contentArea: 'NE', bigIdea: 'Relationships', values: 'Respect, Harmony', level: 'Sec 3', format: 'four corners', isSample: true,
          content: '## National Education — Living with Difference\n\n**Provocation:** Should void-deck spaces be used for religious events?\n\n**Four corners:** Strongly agree / Agree / Disagree / Strongly disagree — students justify and may move as they hear others.\n\n**Debrief:** name one perspective that shifted your thinking. Connect to Singapore’s multiracial compact.', createdAt: now - 6 * DAY }
      ]));
    }
  } catch { /* ignore */ }

  /* ── Admin events ── */
  if ((Store.get('adminEvents') || []).length === 0) {
    const mkTask = (key, status, data) => ({ key, enabled: true, status, approvalStatus: status === 'completed' ? 'approved' : 'not_started', data: data || {} });
    Store.set('adminEvents', [
      {
        id: generateId(), name: 'Sec 3 Geography Fieldwork — Sungei Buloh', date: new Date(now - 4 * DAY).toISOString().slice(0, 10),
        eventType: 'Learning Journey', status: 'completed', isSample: true,
        tasks: [
          mkTask('rams', 'completed', { activity_desc: 'Guided wetland fieldwork collecting abiotic data and observing mangrove adaptations.', venue: 'Sungei Buloh Wetland Reserve', hazards: 'Uneven boardwalk, heat, insect bites, water edges', mitigations: 'Buddy system, hydration breaks every 30 min, first-aid kit, staff:student 1:15', emergency_plan: 'Nearest hospital: Khoo Teck Puat. Assembly point at visitor centre. Teacher-IC carries emergency contacts.', risk_level: 'Medium' }),
          mkTask('bus_booking', 'completed', { teacher_ic: 'Mr Tan', pickup: '7:30am school gate', return: '1:00pm', pax: '80' }),
          mkTask('student_list', 'completed', { teacher_ic: 'Mr Tan' }),
          mkTask('parent_notification', 'completed', {}),
          mkTask('aor', 'completed', { amount: '$640 (bus + entry)' })
        ], createdAt: now - 25 * DAY, updatedAt: now - 4 * DAY
      },
      {
        id: generateId(), name: 'Sec 2 Cohort Camp 2026', date: new Date(now + 30 * DAY).toISOString().slice(0, 10),
        eventType: 'Camp', status: 'in_progress', isSample: true,
        tasks: [
          mkTask('rams', 'completed', { activity_desc: '3-day residential team-building camp.', venue: 'Outward Bound Singapore, Pulau Ubin', hazards: 'Water activities, high elements, weather', mitigations: 'OBS-certified instructors, PFDs, weather monitoring', emergency_plan: 'OBS on-site medic + evacuation protocol.', risk_level: 'High' }),
          mkTask('venue_booking', 'completed', {}),
          mkTask('bus_booking', 'pending', {}),
          mkTask('parent_notification', 'pending', {}),
          mkTask('aor', 'pending', {})
        ], createdAt: now - 8 * DAY, updatedAt: now - 2 * DAY
      }
    ]);
  }

  /* ── Spatial saved layouts ── */
  if ((Store.getSavedLayouts() || []).length === 0) {
    Store.saveLayout({ name: 'Discussion Pods (32)', preset: 'pods', studentCount: 32, wallState: 'closed', isSample: true,
      items: [
        { id: 'teacher_desk', x: 340, y: 30, r: 0 },
        { id: 'group_table', x: 120, y: 160, r: 0 }, { id: 'group_table', x: 360, y: 160, r: 0 }, { id: 'group_table', x: 600, y: 160, r: 0 },
        { id: 'group_table', x: 120, y: 340, r: 0 }, { id: 'group_table', x: 360, y: 340, r: 0 }, { id: 'group_table', x: 600, y: 340, r: 0 }
      ] });
    Store.saveLayout({ name: 'Exam Rows (single)', preset: 'exam', studentCount: 30, wallState: 'closed', isSample: true,
      items: Array.from({ length: 30 }, (_, i) => ({ id: 'desk_rect', x: 80 + (i % 6) * 110, y: 120 + Math.floor(i / 6) * 90, r: 0 })) });
  }

  localStorage.setItem(PORTAL_SEED_KEY, '1');
}
