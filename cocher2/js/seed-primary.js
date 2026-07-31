/*
 * Co-Cher 2 — Primary school sample content
 * =========================================
 * Every sample lesson Co-Cher shipped was secondary: Sec 4 Pure Chemistry,
 * O-Level argumentative writing, A-Math integration. A Park View Primary
 * teacher signing in for the first time met someone else's school — three
 * secondary classes she does not teach, and nine exemplars pitched five years
 * above her pupils. Sample content is the first impression; getting it wrong
 * says "this app is not for you" before anything else gets a chance.
 *
 * These are the primary equivalents, written against the MOE primary syllabuses
 * they claim: bar models for ratio, the celery investigation for plant
 * transport, personal recount for upper-primary English, FTGP for cyber wellness.
 * Levels follow the 2021 Primary Mathematics syllabus (Average and Ratio at P6,
 * Speed gone from primary) and the 2020 Social Studies syllabus. They
 * carry the same shapes as the secondary sets in seed-data.js, so the seeders
 * choose between them by school stage and nothing downstream has to change.
 *
 * Exported as FUNCTIONS, not constants: level names come from the school's own
 * pack ("Primary 5", not a name we invented), which is only known after the
 * vocabulary is primed at boot.
 */

import { levelFromTop, levels } from './utils/vocabulary.js';

/* Level names, resolved from the school's pack, with primary defaults so this
 * file is still meaningful for a primary school whose pack lists nothing. */
const P = (n) => {
  const all = levels();
  const hit = all.find(l => new RegExp(`(^|\\b)(?:P|Primary\\s*)${n}\\b`, 'i').test(l));
  return hit || `Primary ${n}`;
};
const SENIOR = () => levelFromTop(1) || P(5);

/* ══════════════════════════════════════════════════════
   1. Chat exemplars — one per seeded class (classKey 0-2)
   ══════════════════════════════════════════════════════ */

export function primaryChatExemplars() {
  return [
    {
      classMatch: ['Mathematics', 'Math'],
      level: P(6),
      title: 'Average — What the Middle Really Means',
      status: 'ready',
      objectives: 'Pupils will find the average of a set of numbers, work backwards from an average to a total, and explain what an average does and does not tell you.',
      e21ccFocus: ['criticalThinking', 'communication'],
      chatHistory: [
        { role: 'user', content: `Plan a ${P(6)} Mathematics lesson on average. I want pupils to understand average as "total ÷ number of items", to work backwards from an average, and to see why an average can be misleading. Use the CPA approach and bar models.` },
        { role: 'assistant', content: `## Average — What the Middle Really Means (${P(6)} Mathematics)

### Learning Objectives
By the end of this lesson, pupils will be able to:
1. Find the average of a set of numbers using *total ÷ number of items*
2. Find the total when given the average and the number of items
3. Explain one situation where the average does not tell the whole story

### CPA Sequence (60 min)

**Concrete — Levelling the towers (10 min)**
Give each group 4 towers of linking cubes: 3, 5, 8 and 4 cubes. Ask them to make all four towers the SAME height without adding or removing any cubes. They will move cubes across until every tower has 5.

Draw the idea out: *"You did not change the total. You shared it equally."* That IS the average. Write it up: **total ÷ number of items = average**.

**Pictorial — The bar model (15 min)**
Model 3 + 5 + 8 + 4 = 20 as one long bar, then cut it into 4 equal units of 5.

Now reverse it. *"Siti's average score over 4 spelling tests is 7. What is her total?"* Draw 4 equal units of 7 → total 28. Pupils see that working backwards is the same bar, read the other way.

**Abstract — Practice ladder (15 min)**
- Level 1: find the average of 12, 15, 9
- Level 2: the average of 5 numbers is 8. What is their total?
- Level 3: the average of 4 numbers is 10. Three of them are 8, 9 and 12. Find the fourth.

Level 3 is the stretch — pupils must find the total (40) before subtracting.

**Deepen — When the average lies (12 min)**
Two classes both average 60 marks. Class A scored 58, 59, 61, 62. Class B scored 20, 40, 80, 100.

*"Same average. Are they the same class?"*

Turn-and-talk, then whole class. This is the idea worth keeping: an average hides the spread.

**Conclude — Exit ticket (8 min)**
1. Find the average of 6, 9, 11, 14
2. The average of 3 numbers is 12. What is their total?
3. Finish the sentence: an average does not tell you ______.

### Differentiation
- **Support:** keep the cubes on the table for the whole lesson; pupils who are stuck rebuild and re-level.
- **Stretch:** "Add one more number so the average stays exactly 10." Pupils reason that the new number must equal the average.

### Common Misconceptions to Watch For
- Dividing by the wrong number (counting the values instead of the items, or vice versa)
- Assuming the average must be one of the numbers in the set
- Forgetting to find the total first when working backwards` },
      ],
      components: {
        lisc: `**Learning Intentions**\n- We are learning to find the average of a set of numbers.\n- We are learning to work backwards from an average to a total.\n- We are learning to explain what an average hides.\n\n**Success Criteria**\n- I can use total ÷ number of items to find an average.\n- I can find the total when I am given the average.\n- I can give one example where two sets have the same average but are very different.`,
        exitTicket: `### Exit Ticket — Average\n1. Find the average of 6, 9, 11 and 14.\n2. The average of 3 numbers is 12. What is their total?\n3. Two classes both averaged 60 marks. Write one sentence explaining why they might still be very different.`,
      },
    },
    {
      classMatch: ['Science'],
      level: P(5),
      title: 'The Water Cycle — Where Does the Puddle Go?',
      status: 'ready',
      objectives: 'Pupils will explain evaporation, condensation and precipitation as one continuous cycle, and use the cycle to account for an everyday observation.',
      e21ccFocus: ['criticalThinking', 'collaboration'],
      chatHistory: [
        { role: 'user', content: `Plan a ${P(5)} Science lesson on the water cycle for the Cycles theme. I want a strong local hook, a hands-on model, and pupils explaining rather than just labelling a diagram.` },
        { role: 'assistant', content: `## The Water Cycle — Where Does the Puddle Go? (${P(5)} Science, Cycles)

### Learning Objectives
By the end of this lesson, pupils will be able to:
1. Describe evaporation, condensation and precipitation
2. Explain how the three processes form a cycle with no beginning and no end
3. Use the water cycle to explain an everyday observation

### Lesson Flow (60 min)

**Hook — The disappearing puddle (8 min)**
Photograph of a puddle in the school car park after a Singapore afternoon downpour, and the same spot an hour later, dry.

*"Nobody swept it. Nobody drank it. Where did the water go?"*

Take every answer without correcting. Write the class's theories on the board — you will come back to them at the end.

**Explore — The bag model (18 min)**
Each group tapes a sealed ziplock bag, quarter-filled with warm water and a drop of blue colouring, to a sunny window. While it works, they draw what they predict will happen inside — including what COLOUR the droplets will be.

By the end of the lesson droplets have collected on the upper inside surface and run back down. They are **clear, not blue** — and that surprise is the best evidence in the lesson: only the water evaporated. The colouring stayed behind.

**Explain — Naming what they saw (14 min)**
Build the vocabulary onto what they have already observed, in this order:
- **Evaporation** — liquid water gains heat and becomes water vapour (a gas). Invisible. This is why the puddle "disappeared".
- **Condensation** — water vapour loses heat and becomes liquid again. The droplets on the bag. Also the outside of a cold Milo tin.
- **Precipitation** — droplets join, grow heavy, and fall as rain.

Emphasise: water is never created or destroyed. It changes state and moves.

**Deepen — Explain it, don't label it (12 min)**
Give each group ONE scenario to explain using the cycle:
- Why the bathroom mirror fogs up after a hot shower
- Why clothes dry faster on a sunny day than a cloudy one
- Why a cold drink "sweats" on the outside
- Why a hot, humid Singapore morning so often ends in a downpour by four o'clock

Groups present in 30 seconds each. The rest of the class listens for the three words.

**Conclude — Back to the puddle (8 min)**
Return to the theories on the board. Which ones survived? Pupils write the answer in one sentence using all three words.

### Differentiation
- **Support:** a cut-and-paste cycle diagram with the three labels supplied; pupils place the arrows.
- **Stretch:** "The water in your water bottle may once have been rained on by a dinosaur. Is that possible? Explain."

### Safety
Warm — not hot — tap water. Bags stay sealed and taped; nothing is opened until the debrief.` },
      ],
      components: {
        lisc: `**Learning Intentions**\n- We are learning to describe evaporation, condensation and precipitation.\n- We are learning to explain how they form one cycle.\n\n**Success Criteria**\n- I can name the process that turns liquid water into water vapour.\n- I can explain why droplets form on a cold surface, and why they are clear.\n- I can use all three words to explain where a puddle went.`,
        exitTicket: `### Exit Ticket — The Water Cycle\n1. Name the process happening when a puddle dries up.\n2. Why does the outside of a cold drink get wet?\n3. The water in the bag was blue. Why were the droplets clear?\n4. Explain in one sentence where the water in the car park puddle went. Use all three words.`,
      },
    },
    {
      classMatch: ['English'],
      level: P(5),
      title: 'Personal Recount — Show Me, Don’t Tell Me',
      status: 'draft',
      objectives: 'Pupils will plan a personal recount using the Beginning–Build-up–Problem–Ending scaffold, and replace flat "telling" sentences with sensory detail and stronger verbs.',
      e21ccFocus: ['communication', 'creativeThinking'],
      chatHistory: [
        { role: 'user', content: `Plan a ${P(5)} English lesson on personal recount writing. The pupils' recounts are accurate but flat — "I was scared", "It was fun". I want them to show rather than tell, and I want a planning scaffold they can reuse in the exam.` },
        { role: 'assistant', content: `## Personal Recount — Show Me, Don't Tell Me (${P(5)} English)

### The Problem This Lesson Solves
Pupils' recounts read like a list of events. Everything is *told*: "I was scared." "It was fun." "I felt happy." The reader is informed but never there. This lesson swaps telling for showing.

### Learning Objectives
By the end of this lesson, pupils will be able to:
1. Plan a recount using the Beginning–Build-up–Problem–Ending scaffold
2. Rewrite a "telling" sentence as a "showing" sentence using body, senses and action
3. Choose a stronger verb in place of a weak verb + adverb

### Lesson Flow (60 min)

**Hook — Two versions (8 min)**
Display both, without saying which is better:

> **A.** I was very scared when the lights went out.

> **B.** The lights died. My hands found the wall and stayed there. Somewhere behind me a chair scraped, and I stopped breathing.

*"Which one puts you IN the room? What exactly did the writer do differently?"*

Pull out the move: **B never uses the word scared.**

**Model — The Show-Don't-Tell swap (12 min)**
Think aloud as you convert "I was excited" on the visualiser. Say the questions out loud so pupils can borrow them:
- What did my body do? (hands, stomach, feet, breathing)
- What did I see or hear at that exact moment?
- What did I *do* — not feel?

Land on a class version. Keep it on the wall.

**Guided practice — Sentence surgery (12 min)**
Pairs rewrite three flat sentences:
1. I was very happy when I won.
2. The food was delicious.
3. I was tired after the race.

Rule: the feeling word is banned in the rewrite.

Second pass, one minute each: hunt down every *verb + adverb* pair and replace it with ONE stronger verb. *walked slowly* → **trudged**. *said loudly* → **yelled**. *ate quickly* → **wolfed**. Say the rule out loud: if you need an adverb to prop up a verb, you have probably got the wrong verb.

**Plan — The four-box scaffold (15 min)**
Prompt: *"Write about a time something did not go the way you expected."*

| Box | What goes here |
| --- | --- |
| Beginning | Where, when, who — two sentences only |
| Build-up | What you expected to happen |
| Problem | The moment it went wrong — this box gets your best showing sentence |
| Ending | What you did, and what you think about it now |

Pupils fill the four boxes in note form. No full sentences yet — the planning is the lesson.

**Conclude — One golden sentence (13 min)**
Everyone writes ONE sentence: the Problem-box moment, shown not told. Three pupils read theirs aloud. The class names the move each writer used.

### Differentiation
- **Support:** a word bank of body-and-sense verbs (froze, gripped, scraped, thudded, blurred) plus two sentence frames.
- **Stretch:** "Show the feeling using only what you could HEAR." Removing the visual forces harder choices.

### Assessment for Learning
Collect the golden sentences as exit slips. Sort into three piles — still telling / partly showing / showing — and open the next lesson with two anonymous examples from the middle pile.` },
      ],
      components: {
        lisc: `**Learning Intentions**\n- We are learning to plan a recount with a beginning, build-up, problem and ending.\n- We are learning to show a feeling instead of naming it.\n\n**Success Criteria**\n- I can fill all four planning boxes in note form.\n- I can rewrite a sentence about a feeling without using the feeling word.\n- I can replace a weak verb and adverb with one stronger verb.`,
        exitTicket: `### Exit Ticket — Show Me, Don't Tell Me\n1. Rewrite "I was nervous" without using the word nervous.\n2. Which of your four planning boxes deserves your best showing sentence, and why?`,
      },
    },
  ];
}

/* ══════════════════════════════════════════════════════
   2. Full-lifecycle exemplars — the demo lesson history
   ══════════════════════════════════════════════════════ */

export function primaryLifecycleExemplars() {
  return [
    /* ── 1. English — completed, with a real reflection ── */
    {
      title: 'Persuasive Writing — Should Recess Be Longer?',
      classMatch: ['English'],
      level: P(5),
      status: 'completed',
      createdDaysAgo: 18,
      updatedDaysAgo: 15,
      e21ccFocus: ['communication', 'criticalThinking'],
      objectives: 'Pupils will state a clear stand, support it with a reason and an example, and answer one objection from the other side.',
      lessonHook: 'The principal has agreed to read the best letter the class writes. Recess is 30 minutes. Should it be 45?',
      chat: {
        user: `Plan a ${P(5)} English lesson on persuasive writing. Pupils give opinions but never support them. I want a real audience and a simple structure they can hold in their heads.`,
        assistant: `## Persuasive Writing — Should Recess Be Longer? (${P(5)} English)

### Learning Objectives
1. State a clear stand in one sentence
2. Support the stand with a reason AND a real example
3. Answer one objection from the other side

### Lesson Flow (60 min)

**Hook — A real audience (7 min)**
Tell them the truth: the best letter goes to the principal, and the principal has agreed to read it. Recess is 30 minutes. Should it be 45?

Straw poll by standing on one side of the room. Note the numbers — you will re-poll at the end.

**Build — The three-part sentence (13 min)**
> **I think** recess should be longer **because** pupils come back to class unable to focus, **for example** last Tuesday half of 5R1 was still queueing at the drink stall when the bell rang.

Three moves: *stand → reason → example*. Model it once, then have pupils say their own aloud to a partner before writing anything.

**Practise — Reason hunt (12 min)**
Groups list every reason they can for their side. Then the hard part: cross out any reason with no example behind it. Most groups lose half their list. That is the lesson.

**Deepen — Steal the other side's best argument (15 min)**
Each group writes the STRONGEST argument against their own stand, then answers it:
> Some people say a longer recess means less curriculum time. But the lesson after recess is currently wasted settling everyone down.

This is the move that separates a persuasive letter from a complaint.

**Conclude — Re-poll and write (13 min)**
Re-poll the room. Did anyone move? Ask two movers what changed their mind — it will be an example, not an opinion.

Pupils write their opening paragraph: stand, reason, example.

### Differentiation
- **Support:** the three-part sentence printed as a frame with blanks.
- **Stretch:** "Write the version you would send to a parent instead of the principal. What changes?"`,
      },
      components: {
        lisc: `**Learning Intentions**\n- We are learning to state a stand and support it.\n- We are learning to answer the other side.\n\n**Success Criteria**\n- I can write my stand in one sentence.\n- I can give a reason AND a real example.\n- I can write one sentence answering someone who disagrees.`,
        exitTicket: `### Exit Ticket — Persuasive Writing\n1. Write your stand in one sentence.\n2. Give one reason with a real example.\n3. What is the strongest argument AGAINST you?`,
      },
      reflection: `The "cross out any reason with no example" step did more work than anything else I have tried on persuasive writing. Two groups were left with a single reason and were genuinely annoyed about it — which is exactly when they started looking for evidence instead of more opinions.\n\nThe real audience mattered. Three pupils who normally write four lines wrote a full page.\n\nWhat I would change: the re-poll needed more time. I asked two movers what changed their minds and the answers were the best assessment data of the lesson, but the bell went. Next time I cut the reason hunt to 8 minutes and give the re-poll a proper 10.`,
    },

    /* ── 2. Mathematics — ready to teach ── */
    {
      title: 'Fractions — Equal Parts, Equal Shares',
      classMatch: ['Mathematics', 'Math'],
      level: P(4),
      status: 'ready',
      createdDaysAgo: 9,
      updatedDaysAgo: 6,
      e21ccFocus: ['criticalThinking', 'collaboration'],
      objectives: 'Pupils will compare fractions with unlike denominators using equivalent fractions, and justify a comparison with a drawing.',
      lessonHook: 'Two identical prata are cut differently — one into 3 pieces, one into 4. Aisyah takes 2 pieces from the first. Ravi takes 3 from the second. Who ate more?',
      chat: {
        user: `Plan a ${P(4)} Mathematics lesson on comparing fractions with unlike denominators. Use CPA and bar models. My pupils keep saying 3/4 is smaller than 2/3 because 3 is smaller than 4.`,
        assistant: `## Fractions — Equal Parts, Equal Shares (${P(4)} Mathematics)

### Where This Sits
Comparing and ordering unlike fractions is a ${P(3)} outcome. It comes back here because ${P(4)} adds and subtracts unlike fractions, and a pupil who cannot see which fraction is larger cannot tell whether their answer is sensible.

### The Misconception This Lesson Targets
Pupils compare fractions by comparing the numbers, not the amounts: "2/3 must be bigger than 3/4 because 2 and 3 are smaller." The fix is not a rule — it is making them SEE two IDENTICAL wholes cut into different numbers of parts.

### Learning Objectives
1. Compare two fractions with unlike denominators
2. Use equivalent fractions to make the comparison exact
3. Justify a comparison with a drawing, not just an answer

### CPA Sequence (60 min)

**Concrete — The prata problem (12 min)**
Two identical paper circles. Cut one into 3 equal pieces, one into 4. Aisyah takes 2 from the first; Ravi takes 3 from the second.

*"Who ate more? Do not calculate. Look."*

Let them argue. Then overlay the pieces physically. Most classes are genuinely surprised.

**Pictorial — Same bar, different cuts (18 min)**
Two bars of exactly the same length, one in thirds, one in quarters. Shade 2/3 and 3/4.

The key question: *"Why must the bars be the same length for this to be a fair comparison?"* Everything rests on that.

Then re-cut both into twelfths: 2/3 = 8/12, 3/4 = 9/12. Now the comparison is countable.

**Abstract — Making the parts match (15 min)**
- Compare 2/5 and 1/2 → twelfths won't work; find a denominator that will
- Compare 5/6 and 7/12
- Order 1/2, 5/8, 3/4 from smallest to largest

**Deepen — Spot the error (10 min)**
> "3/8 is bigger than 1/2 because 8 is bigger than 2."

Pupils write a reply to this pupil, with a drawing. Explaining someone else's mistake is harder — and more diagnostic — than getting it right.

**Conclude — Exit ticket (5 min)**
Compare 3/4 and 5/8. Show your working with a drawing.

### Differentiation
- **Support:** pre-cut fraction strips stay on the table; pupils lay them side by side before writing.
- **Stretch:** "Find a fraction between 2/3 and 3/4. Prove it is between."`,
      },
      components: {
        lisc: `**Learning Intentions**\n- We are learning to compare fractions with different denominators.\n- We are learning to explain a comparison with a drawing.\n\n**Success Criteria**\n- I can rewrite two fractions so they have the same denominator.\n- I can say which is larger and show why with a bar model.\n- I can explain why the two wholes must be the same size.`,
        differentiation: `**Support**\n- Fraction strips remain on the desk all lesson — comparison before calculation.\n- Sentence frame: "___ is larger than ___ because when I cut both into ___ parts, ___ has more parts shaded."\n\n**Stretch**\n- Find a fraction between 2/3 and 3/4 and prove it.\n- "Is 1/2 of a small pizza always less than 1/3 of a large one?" Forces attention back to the whole.`,
        exitTicket: `### Exit Ticket — Comparing Fractions\n1. Which is larger: 3/4 or 5/8? Show a drawing.\n2. Explain in one sentence why the two bars must be the same length.`,
      },
    },

    /* ── 3. Science — draft, mid-planning ── */
    {
      title: 'Light and Shadows — The Shadow Puppet Problem',
      classMatch: ['Science'],
      level: P(4),
      status: 'draft',
      createdDaysAgo: 4,
      updatedDaysAgo: 2,
      e21ccFocus: ['criticalThinking', 'creativeThinking'],
      objectives: 'Pupils will explain how a shadow forms, and predict how a shadow changes when the light source, object or screen is moved.',
      lessonHook: 'Each group must make their puppet’s shadow exactly as tall as the screen — without touching the puppet.',
      chat: {
        user: `Plan a ${P(4)} Science lesson on light and shadows. I want a design challenge rather than a worksheet, and I want pupils to control variables properly.`,
        assistant: `## Light and Shadows — The Shadow Puppet Problem (${P(4)} Science, Energy)

### Learning Objectives
1. Explain that a shadow forms when an opaque object blocks light
2. Predict how a shadow changes when the light, object or screen moves
3. Change ONE thing at a time when testing

### Lesson Flow (60 min)

**Hook — The impossible instruction (8 min)**
Each group gets a torch, a card puppet and a screen. The brief:

> Make your puppet's shadow exactly as tall as the screen. You may not touch the puppet.

Two minutes of noisy trial and error. Nobody gets a rule yet — that is fine.

**Explore — One thing at a time (20 min)**
Now the discipline. Groups run four tests, changing ONE thing each time and keeping everything else still:

| Test | We changed | We kept the same | What happened to the shadow |
| --- | --- | --- | --- |
| 1 | torch closer / further | puppet, screen | |
| 2 | puppet closer to screen | torch, screen | |
| 3 | torch high / low | puppet, screen | |
| 4 | screen further back | torch, puppet | |

Circulate with one question only: *"What else changed when you did that?"* That question is the whole lesson on fair testing.

**Explain — Why there is a shadow at all (12 min)**
Light travels in straight lines. The puppet is **opaque** — it blocks light. The shadow is the region the light could not reach.

Sort materials as opaque / translucent / transparent using the same torch and screen. Ask about the tricky ones: greaseproof paper, a plastic ruler, a hand.

**Deepen — Predict, then check (12 min)**
Before touching anything: *"I move the torch twice as far away. The shadow will get ______ because ______."*

Every pupil writes a prediction, then groups test it. Wrong predictions get discussed, not corrected.

**Conclude — Back to the brief (8 min)**
Groups now solve the original challenge deliberately and explain the rule they used.

### Safety
Torches point at the screen, never at faces. Blackout is partial — pupils stay seated while the lights are low.

### Still to Do
- [ ] Decide whether to add the sundial extension or hold it for the next lesson
- [ ] Print the three-column test recording sheet
- [ ] Check there are enough torches for 8 groups`,
      },
      components: {
        lisc: `**Learning Intentions**\n- We are learning how a shadow is formed.\n- We are learning to change only one thing when we test.\n\n**Success Criteria**\n- I can explain why an opaque object makes a shadow.\n- I can predict what happens to a shadow when the torch moves.\n- I can name the one thing I changed and the things I kept the same.\n- I can predict what happens when the torch, the puppet OR the screen moves.`,
      },
    },

    /* ── 4. Social Studies — ready ── */
    {
      title: 'Singapore’s Water Story — From Well to NEWater',
      classMatch: ['Social Studies'],
      level: P(3),
      status: 'ready',
      createdDaysAgo: 12,
      updatedDaysAgo: 8,
      e21ccFocus: ['criticalThinking', 'socialConnectedness'],
      objectives: 'Pupils will describe how Singapore gets its water today, and explain one reason water security matters to the country.',
      lessonHook: 'Turn on a tap for ten seconds. That is roughly one litre. Where was it an hour ago?',
      chat: {
        user: `Plan a ${P(3)} Social Studies lesson on Singapore's water. I want pupils to connect it to their own daily use rather than memorising the four taps.`,
        assistant: `## Singapore's Water Story — From Well to NEWater (${P(3)} Social Studies)

### Learning Objectives
1. Name where Singapore's water comes from today
2. Explain why a small country with no natural water supply of its own has to plan carefully
3. Identify one thing they personally can change

### Lesson Flow (60 min)

**Hook — Ten seconds of tap (8 min)**
Run a tap into a measuring jug for ten seconds. About a litre.

*"Where was this water an hour ago? Yesterday? Last year?"*

Collect guesses. Nobody usually says "the sea" or "someone's shower" — both are correct today.

**Then and now (15 min)**
Two photographs: a kampong well in the 1950s, and a modern water treatment plant.

Ask what changed and what did NOT. (What did not change: everyone still needs the same amount of water every day.)

Introduce the four sources plainly — local catchment, imported water, NEWater, desalinated water — as four answers to one problem, not four facts to memorise.

**Explore — Four stations (18 min)**
Groups rotate through four short card sets, one per source, answering the same three questions each time:
- Where does this water start?
- What has to happen before we can drink it?
- What could go wrong with relying only on this one?

The third question is the one that makes the lesson about security rather than plumbing.

**Deepen — One basket (12 min)**
*"What if the only place our water came from was rain — and it did not rain for a month?"*

No blame, no politics — the point is simply that depending on one source is fragile, which is why Singapore built four.

**Conclude — My litre (7 min)**
Every pupil writes one habit they will change this week, with a number attached: "I will turn off the tap while brushing — that is about 6 litres a day."

### Differentiation
- **Support:** station cards with pictures and 3 key words each.
- **Stretch:** "Rank the four sources from most to least reliable. Defend your top choice."`,
      },
      components: {
        lisc: `**Learning Intentions**\n- We are learning where Singapore's water comes from.\n- We are learning why we must use water wisely.\n\n**Success Criteria**\n- I can name Singapore's four water sources.\n- I can explain one risk of relying on only one source.\n- I can state one habit I will change, with a number.`,
        exitTicket: `### Exit Ticket — Singapore's Water Story\n1. Name two of Singapore's four water sources.\n2. Why is depending on only one source risky?\n3. What is your litre? One habit, with a number.`,
      },
    },

    /* ── 5. CCE / FTGP — completed, with reflection ── */
    {
      title: 'Cyber Wellness — When the Chat Group Turns Unkind',
      classMatch: ['Character', 'CCE', 'English'],
      level: P(5),
      status: 'completed',
      createdDaysAgo: 25,
      updatedDaysAgo: 22,
      e21ccFocus: ['socialConnectedness', 'selfRegulation'],
      objectives: 'Pupils will identify what makes an online message hurtful, and rehearse two responses they could actually use as a bystander.',
      lessonHook: 'A screenshot of a class chat group. Nobody in it is being cruel on purpose. It still ends badly.',
      chat: {
        user: `Plan a ${P(5)} FTGP cyber wellness lesson on unkindness in chat groups. I do not want a lecture. I want pupils rehearsing what they would actually say.`,
        assistant: `## Cyber Wellness — When the Chat Group Turns Unkind (${P(5)} Form Teacher Guidance Period)

### Why This Lesson Is Not a Lecture
Pupils already know that cyberbullying is wrong. What they do not have is a sentence ready in the moment. This lesson is rehearsal, not information.

### Learning Objectives
1. Identify what turns a joke into something hurtful
2. Name the bystander's choices in a group chat
3. Rehearse two responses out loud

### Lesson Flow (45 min)

**Open — The screenshot (8 min)**
A teacher-made screenshot of a fictional class chat. Nobody is being cruel on purpose: one joke, three laughing replies, one "😂 so true", and then silence from the person it was about.

*"Where exactly does this go wrong? Point at the line."*

Classes usually point at different lines. That disagreement is the lesson.

**Discuss — Four Corners (12 min)**
Label the corners: *It's just a joke · It went too far · The person should speak up · Someone else should say something*.

Pupils stand in a corner and explain. Then the important move: *"You may move if someone changes your mind."* Movement is the assessment.

**Rehearse — Two sentences (15 min)**
In threes, pupils practise saying two things ALOUD:
1. Something you could send in the group: *"Eh, that's not funny lah."*
2. Something you could send privately to the person: *"You okay?"*

Everyone says both, twice. It feels awkward — say so. Awkward now is the point; awkward later is why nobody speaks up.

**Close — The quiet option (10 min)**
Name the third choice honestly: leaving the group, screenshotting, telling an adult. Not every situation can be fixed by a message, and knowing when to hand it on is not weakness.

Each pupil writes one private line: *the person I would tell is ______.*

### Note for the Form Teacher
Watch the room during Four Corners. If a real situation surfaces, do not process it in front of the class — follow it up privately afterwards.`,
      },
      components: {
        lisc: `**Learning Intentions**\n- We are learning what turns a joke into something hurtful.\n- We are learning what a bystander can do.\n\n**Success Criteria**\n- I can point to the moment a chat goes wrong and say why.\n- I can say one thing I could send in the group.\n- I can name one adult I would tell.`,
        discussionPrompts: `1. What is the difference between a joke and a joke at someone's expense?\n2. Why is it harder to speak up in a group of twenty than in a group of three?\n3. If you say nothing, have you done nothing?\n4. When is leaving the group the right answer rather than the easy one?\n5. What makes it easier to be the first person to say "that's not funny"?`,
      },
      reflection: `Four Corners was the right structure — six pupils moved corners, and two said out loud that they had never thought about the silence from the person being joked about.\n\nThe rehearsal was harder than I expected. The first round was all giggling. It only worked when I made everyone say the line twice, and when I said plainly that it feels awkward on purpose.\n\nOne pupil stayed behind afterwards. That was the actual outcome of this lesson, and it would not have happened if I had lectured for 45 minutes.\n\nNext time: fewer scenarios, more repetitions of the two sentences.`,
    },

    /* ── 6. Mathematics (upper) — draft ── */
    {
      title: 'Percentage — What the Sale Sign Isn’t Telling You',
      classMatch: ['Mathematics', 'Math'],
      level: P(6),
      status: 'draft',
      createdDaysAgo: 3,
      updatedDaysAgo: 1,
      e21ccFocus: ['criticalThinking', 'communication'],
      objectives: 'Pupils will find a percentage of a quantity, find the whole given a part and a percentage, and explain why two successive percentage changes do not simply add.',
      lessonHook: 'A $200 jacket, 20% off, then another 10% off at the till. The sign says 30% off. Is it?',
      chat: {
        user: `Plan a ${P(6)} Mathematics lesson on percentage. My pupils can find 20% of a number but fall apart when the percentage is applied twice, or when they are given the discounted price and asked for the original.`,
        assistant: `## Percentage — What the Sale Sign Isn't Telling You (${P(6)} Mathematics)

### The Error This Lesson Targets
Given "20% off, then a further 10% off", pupils answer 30% off. It comes from adding percentages of *different wholes* — the second 10% is taken off the already-reduced price, not the original.

### Learning Objectives
1. Find a percentage of a quantity, and a percentage increase or decrease
2. Find the ORIGINAL amount when given the part and the percentage
3. Explain why two successive percentage changes do not add

### Lesson Flow (60 min)

**Hook — The two-sticker jacket (8 min)**
A $200 jacket. One sticker says 20% off. At the till, a second 10% comes off.

*"The sign outside says 30% off. Do you agree? Do not calculate yet — vote."*

Most classes vote yes. Note the split on the board.

**Consolidate — Percentage as parts per hundred (12 min)**
Back to the bar model: 100 units is the whole, and a percentage is how many of those units you take. 20% of $200 → 20 units of $2 → $40.

Insist on naming the whole out loud every time: *20% of WHAT?* That question is the entire lesson.

**The trap — Walk into it deliberately (15 min)**
Work it properly on the board:
- 20% off $200 → $160
- Then 10% off **$160** → $16 off → **$144**
- A single 30% off $200 would be $60 off → $140

$144, not $140. The shop's "30%" is worth $4 less than it sounds.

*"Why is the second discount smaller than you expected?"* Pupils reason that the second percentage is taken off a smaller whole.

**Practise — Working backwards (17 min)**
This is where marks are lost. Three problems, increasing in difficulty:
1. A bag costs $60 after a 25% discount. What was the original price? (75% = $60 → 100% = $80)
2. A number increased by 20% is 96. Find the number.
3. After GST of 9%, a meal costs $54.50. What was the price before GST?

Model-drawing for each: the bar is always the ORIGINAL, and the given figure is a part of it.

**Conclude — Exit ticket (8 min)**
A phone is $500. It drops 10%, then drops another 10%. A friend says that is $400. Write the correct price and one sentence explaining your friend's mistake.

### Still to Do
- [ ] Check the current GST rate before Monday — do not teach a stale number
- [ ] Decide whether to include the GST problem or hold it for the next lesson`,
      },
      components: {
        lisc: `**Learning Intentions**\n- We are learning to find a percentage of a quantity.\n- We are learning to find the original amount from a part.\n- We are learning why two percentage changes do not add.\n\n**Success Criteria**\n- I can find a percentage of an amount using a bar model.\n- I can work backwards from a discounted price to the original.\n- I can say what whole each percentage is taken from.`,
      },
    },
  ];
}

/* Primary exemplars that show a "rehearsed" badge on the dashboard. */
export const PRIMARY_REHEARSED = new Set([
  'Fractions — Equal Parts, Equal Shares',
  'Persuasive Writing — Should Recess Be Longer?',
]);

/* ══════════════════════════════════════════════════════
   3. Showcase lessons — the full pipeline, primary edition
   ══════════════════════════════════════════════════════ */

export function primaryShowcaseLessons() {
  return [
    {
      title: 'Plant Transport — The Celery Experiment',
      subjectIncludes: 'Science',
      classDef: { name: '5R1 Science', level: SENIOR(), subject: 'Science' },
      status: 'ready',
      e21ccFocus: ['criticalThinking', 'collaboration'],
      objectives: 'Pupils identify the parts of a plant’s transport system, explain how water travels from root to leaf, and relate transport to the plant making its own food.',
      lessonHook: 'A stick of celery left overnight in red water. Cut it across the middle and the red dots are already there — how did the water climb?',
      chat: {
        user: `Plan a ${P(5)} Science lesson on the plant transport system with a hands-on investigation and a strong hook.`,
        assistant: `## Plant Transport — The Celery Experiment (${P(5)} Science, Systems)

**Big idea:** a plant is a system. Water enters at the roots, travels up tubes in the stem, and reaches the leaves, where the plant uses it to make food.

**Arc:**
1. *Arouse interest* — celery that has been standing in red water overnight.
2. *Activate prior knowledge* — See-Think-Wonder on the cut cross-section.
3. *Encourage engagement* — groups set up their own stalks and predict.
4. *Deepen with questions* — from "the water moved" to "why does the plant need it up there?"
5. *Conclude* — one-sentence explanation, root to leaf.`,
      },
      components: {
        lisc: `**Learning Intentions**\n- We are learning to name the parts of a plant's transport system.\n- We are learning to explain how water travels from the roots to the leaves.\n- We are learning why the plant needs the water up there.\n\n**Success Criteria**\n- I can point to the tubes in a cut stem and say what they carry.\n- I can explain the path water takes through the plant.\n- I can link water arriving at the leaf to the plant making food.`,
        exitTicket: `### Exit Ticket — Plant Transport\n1. Which part of the plant takes in water?\n2. What did the red dots in the celery show you?\n3. Why does the water need to reach the leaves?`,
      },
      segments: [
        { name: 'The red celery', duration: 7, teachingArea: 'arouse_interest', teachingAction: 'real_world', mode: 'whole-class', e21ccFocus: 'criticalThinking',
          activity: 'Reveal a celery stalk that has stood overnight in red-coloured water; cut it across the middle in front of the class.', studentInstructions: 'Look closely at the cut end. Write down one thing you notice and one thing you cannot explain yet.' },
        { name: 'See-Think-Wonder: the cut stem', duration: 10, teachingArea: 'activate_prior', teachingAction: 'stw', mode: 'pairs',
          activity: 'Pairs examine the cross-section and a hand lens image on the visualiser.', studentInstructions: 'With your partner: what do you SEE? What do you THINK is happening inside? What do you WONDER?' },
        { name: 'Set up your own stalk', duration: 15, teachingArea: 'encourage_engage', teachingAction: 'poe', grouped: true, e21ccFocus: 'collaboration',
          activity: 'Groups set up their own celery in coloured water, predict how far the colour will climb by tomorrow, and mark the prediction on the stalk with tape.', studentInstructions: 'Predict FIRST. Mark where you think the colour will reach. Write one reason for your prediction.' },
        { name: 'Why does the leaf need water?', duration: 13, teachingArea: 'deepen_questions', teachingAction: 'funnel', mode: 'whole-class', e21ccFocus: 'criticalThinking',
          simId: 'photosynthesis', simTitle: 'Photosynthesis',
          activity: 'Funnel from "the water moved up" to "the leaf uses it". Run the Photosynthesis simulation on screen: water and carbon dioxide in, food and oxygen out.', studentInstructions: 'Watch what the leaf takes in and what it gives out. Be ready to say where the water in the simulation came from.' },
        { name: 'Root to leaf, in one sentence', duration: 10, teachingArea: 'conclude', teachingAction: 'grow_selfcheck', mode: 'individual', frameworkId: 'fw_builtin_grow',
          activity: 'Close with a GROW self-check and one written explanation of the whole path.', studentInstructions: 'Write the journey of one drop of water from the soil to the leaf. Gift: one thing you now understand. Rise: one thing you still wonder. Own: where you have seen this outside school.' },
      ],
      sims: [{ id: 'photosynthesis', title: 'Photosynthesis' }],
      deck: {
        title: 'Plant Transport', wallPrompt: 'One thing you now understand about how water moves through a plant?', slides: [
          { layout: 'title', title: 'Plant Transport', subtitle: 'The Celery Experiment', bullets: ['Roots take in water', 'Tubes carry it up the stem', 'Leaves put it to work'], icon: 'experiment' },
          { layout: 'statement', statement: 'A plant is a system. Every part has a job, and the jobs connect.', icon: 'idea' },
          { layout: 'bullets', title: 'The journey of one drop', icon: 'target', bullets: ['Soil → taken in by the ROOTS', 'Up through tubes in the STEM', 'Out along the LEAF', 'Used to make the plant’s food'] },
          { layout: 'visual', title: 'How far did it climb?', chart: { type: 'bar', title: 'Height of colour after 24 hours (cm)', data: [{ label: 'Group 1', value: 9 }, { label: 'Group 2', value: 11 }, { label: 'Group 3', value: 8 }, { label: 'Group 4', value: 12 }] },
            interaction: { type: 'quiz', label: 'Reading the class results', q: 'Every group’s colour climbed. What does that tell us?', options: ['Water travels up the stem in all the stalks', 'Only thick stalks carry water', 'The colouring was too strong'], answer: 0, why: 'Every stalk showed the same thing, so it is the plant doing it — not one lucky stalk.' } },
          { layout: 'columns', title: 'Two jobs, two answers', icon: 'target', columns: [{ heading: 'Roots', items: ['Take in water', 'Take in mineral salts', 'Hold the plant in the soil'] }, { heading: 'Leaves', items: ['Take in carbon dioxide', 'Take in light', 'Make the plant’s food'] }] },
          { layout: 'quote', quote: 'The water climbed. But why does the plant bother?', attribution: "Today's driving question",
            interaction: { type: 'quiz', label: 'Why water reaches the leaf', q: 'The leaf needs water in order to…', options: ['Make food for the plant', 'Stay cool in the sun', 'Grow more roots'], answer: 0, why: 'Leaves use water, carbon dioxide and light to make the plant’s food.' } },
          { layout: 'exit', title: 'Exit ticket', icon: 'check', bullets: ['Which part takes in the water?', 'What did the red dots show you?', 'Why must the water reach the leaves?'] },
        ],
      },
    },

    {
      title: 'Ratio & Bar Models — Sharing the Prize Money',
      subjectIncludes: 'Mathematics',
      classDef: { name: '6A Mathematics', level: P(6), subject: 'Mathematics' },
      status: 'ready',
      e21ccFocus: ['criticalThinking', 'communication'],
      objectives: 'Pupils represent a ratio with a bar model, find the value of one unit, and solve word problems where the difference — not the total — is given.',
      lessonHook: 'Three friends win $960. They agree to share it in the ratio 3 : 4 : 5. One of them says that is not fair. Is it?',
      chat: {
        user: `Plan a ${P(6)} Mathematics lesson on ratio using bar models. Pupils can do ratio when the total is given but freeze when only the difference is given.`,
        assistant: `## Ratio & Bar Models — Sharing the Prize Money (${P(6)} Mathematics)

**Big idea:** a ratio is a picture of equal units. Once you know what ONE unit is worth, every question is answerable.

**Arc:**
1. *Arouse interest* — $960 shared 3 : 4 : 5. Is that fair?
2. *Activate prior knowledge* — draw the ratio before touching a number.
3. *Encourage engagement* — find the value of one unit; groups compare methods.
4. *Deepen with questions* — the difference problem, where there is no total to divide.
5. *Conclude* — write the one question that unlocks every ratio problem.`,
      },
      components: {
        lisc: `**Learning Intentions**\n- We are learning to draw a ratio as a bar model.\n- We are learning to find the value of one unit.\n- We are learning to solve ratio problems when only the difference is given.\n\n**Success Criteria**\n- I can draw the correct number of equal units for a ratio.\n- I can find what one unit is worth and label my model.\n- I can solve a problem where I am given the difference instead of the total.`,
        exitTicket: `### Exit Ticket — Ratio\n1. Draw the bar model for 2 : 5.\n2. Two people share $840 in the ratio 3 : 4. How much does each get?\n3. Ali has 12 more stickers than Bala. Their sticker counts are in the ratio 5 : 3. How many does Ali have?`,
      },
      segments: [
        { name: 'Is 3 : 4 : 5 fair?', duration: 8, teachingArea: 'arouse_interest', teachingAction: 'real_world', mode: 'whole-class', e21ccFocus: 'criticalThinking',
          activity: 'Three friends win $960 and agree to share it 3 : 4 : 5. One says it is unfair.', studentInstructions: 'Before any calculating: do you think this is fair? Write yes or no and one reason.' },
        { name: 'Draw it before you solve it', duration: 12, teachingArea: 'activate_prior', teachingAction: 'analogy', mode: 'pairs',
          activity: 'Pairs draw 3, 4 and 5 equal units stacked, with a brace showing $960 across all twelve.', studentInstructions: 'Draw the three bars with EQUAL units. Do not write any numbers inside them yet.' },
        { name: 'What is one unit worth?', duration: 15, teachingArea: 'collaborative', teachingAction: 'group_investigation', grouped: true, e21ccFocus: 'collaboration',
          activity: 'Groups work out 12 units = $960 → 1 unit = $80, then label all three shares. Compare methods on the board.', studentInstructions: 'Find what ONE unit is worth first. Then label every bar. Be ready to explain your first step.' },
        { name: 'No total, only a difference', duration: 15, teachingArea: 'deepen_questions', teachingAction: 'funnel', mode: 'whole-class', e21ccFocus: 'criticalThinking',
          activity: 'Ali has 12 more stickers than Bala; their counts are in the ratio 5 : 3. Funnel to the realisation that the DIFFERENCE is 2 units, so 1 unit = 6.', studentInstructions: 'Draw the two bars. Circle the part of the picture that shows the 12. How many units is it?' },
        { name: 'The one question that unlocks it', duration: 10, teachingArea: 'conclude', teachingAction: 'grow_selfcheck', mode: 'individual', frameworkId: 'fw_builtin_grow',
          activity: 'Pupils write the single question they should always ask on a ratio problem, and check it against today’s three problems.', studentInstructions: 'Write the one question that starts every ratio problem. Gift: one thing you can now do. Rise: one thing you still find hard. Own: a time you have shared something in a ratio.' },
      ],
      deck: {
        title: 'Ratio & Bar Models', wallPrompt: 'What is the one question you ask first on every ratio problem?', slides: [
          { layout: 'title', title: 'Ratio & Bar Models', subtitle: 'Sharing the Prize Money', bullets: ['Draw the units', 'Find one unit', 'Answer anything'], icon: 'target' },
          { layout: 'statement', statement: 'A ratio is a picture of EQUAL units. Find one unit and the rest follows.', icon: 'idea' },
          { layout: 'visual', title: 'The prize money', chart: { type: 'bar', title: '$960 shared in the ratio 3 : 4 : 5', data: [{ label: 'Aisyah (3u)', value: 240 }, { label: 'Bala (4u)', value: 320 }, { label: 'Chen (5u)', value: 400 }] },
            interaction: { type: 'quiz', label: 'Finding one unit', q: '12 units are worth $960. One unit is worth…', options: ['$80', '$96', '$120'], answer: 0, why: '$960 ÷ 12 units = $80 per unit. Every share is then just a multiple of $80.' } },
          { layout: 'bullets', title: 'The method, every time', icon: 'check', bullets: ['1. Draw the units — equal size, no numbers yet', '2. Find what the given amount covers', '3. Work out ONE unit', '4. Label every bar'] },
          { layout: 'columns', title: 'Two kinds of question', icon: 'target', columns: [{ heading: 'Given the TOTAL', items: ['All units together = total', '3 : 4 : 5 → 12 units', 'Divide the total by 12'] }, { heading: 'Given the DIFFERENCE', items: ['Only the gap is known', '5 : 3 → the gap is 2 units', 'Divide the difference by 2'] }] },
          { layout: 'quote', quote: 'Ali has 12 more stickers than Bala, in the ratio 5 : 3. How many units is the 12?', attribution: 'The problem that catches everyone',
            interaction: { type: 'quiz', label: 'The difference problem', q: 'In the ratio 5 : 3, the difference of 12 stickers represents…', options: ['2 units', '8 units', '12 units'], answer: 0, why: '5 units − 3 units = 2 units, so 2 units = 12 and one unit = 6. Ali has 5 × 6 = 30.' } },
          { layout: 'exit', title: 'Exit ticket', icon: 'check', bullets: ['Draw the bar model for 2 : 5', 'Share $840 in the ratio 3 : 4', 'Ali has 12 more than Bala, ratio 5 : 3 — how many has Ali?'] },
        ],
      },
    },
  ];
}
