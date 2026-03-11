/*
 * Math Sandbox — LaTeX Rendering Showcase
 * =========================================
 * A test module that demonstrates LaTeX rendering in lesson content.
 * Teachers can design a math lesson and see beautifully typeset output.
 */

import { sendChat } from '../api.js';
import { showToast } from '../components/toast.js';
import { renderMd, processLatex } from '../utils/latex.js';

/* ── Pre-built example: Intro to Differentiation ── */
const EXAMPLE_LESSON = `## Introduction to Differentiation

### Learning Intentions
Students will understand the concept of a **derivative** as the rate of change of a function, and apply the **power rule** to differentiate polynomial functions.

### Key Concepts

The derivative of a function $f(x)$ is defined as:

$$f'(x) = \\lim_{h \\to 0} \\frac{f(x + h) - f(x)}{h}$$

This gives us the **instantaneous rate of change** at any point on the curve.

### The Power Rule

For any function of the form $f(x) = x^n$, the derivative is:

$$\\frac{d}{dx}(x^n) = nx^{n-1}$$

#### Worked Examples

1. If $f(x) = x^3$, then $f'(x) = 3x^2$

2. If $g(x) = 5x^4 - 2x^2 + 7x - 3$, then:

$$g'(x) = 20x^3 - 4x + 7$$

3. Find the gradient of the curve $y = x^2 - 4x + 1$ at the point where $x = 3$:

$$\\frac{dy}{dx} = 2x - 4$$

At $x = 3$: $\\frac{dy}{dx} = 2(3) - 4 = 2$

### Practice Questions

1. Differentiate $f(x) = 3x^5 - 2x^3 + x - 8$

2. Find $\\frac{dy}{dx}$ when $y = \\frac{1}{x^2}$ (hint: rewrite as $y = x^{-2}$)

3. The displacement of an object is given by $s(t) = 4t^3 - 6t^2 + 2t$ metres. Find:
   - The velocity function $v(t) = s'(t)$
   - The velocity at $t = 2$ seconds
   - The acceleration function $a(t) = v'(t)$

### Extension: Chain Rule Preview

For composite functions like $y = (3x + 1)^5$, we need the **chain rule**:

$$\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}$$

Let $u = 3x + 1$, then $y = u^5$:

$$\\frac{dy}{dx} = 5u^4 \\cdot 3 = 15(3x + 1)^4$$

### Success Criteria
- I can explain what a derivative represents geometrically
- I can apply the power rule to differentiate $x^n$
- I can differentiate polynomial functions term by term
- I can find the gradient of a curve at a specific point`;


export function render(container) {
  let outputText = '';
  let isGenerating = false;

  function renderView() {
    container.innerHTML = `
      <style>
        .ms-scroll { overflow-y: auto; height: 100%; }
        .ms-container { max-width: 860px; margin: 0 auto; padding: 24px 16px 48px; }
        .ms-header h1 { font-size: 1.5rem; font-weight: 800; margin: 0 0 4px; color: var(--ink); letter-spacing: -0.02em; }
        .ms-header p { font-size: 0.8125rem; color: var(--ink-muted); margin: 0 0 20px; }
        .ms-form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        @media (max-width: 600px) { .ms-form { grid-template-columns: 1fr; } }
        .ms-form .full { grid-column: 1 / -1; }
        .ms-form label { display: block; font-size: 0.6875rem; font-weight: 600; color: var(--ink-secondary); margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.03em; }
        .ms-actions { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
        .ms-output-card {
          border: 1px solid var(--border); border-radius: 12px; background: var(--bg-card);
          padding: 24px 28px; margin-bottom: 20px; color: var(--ink);
          font-size: 0.9375rem; line-height: 1.8;
        }
        .ms-output-card h1, .ms-output-card h2, .ms-output-card h3, .ms-output-card h4 { color: var(--ink); }
        .ms-output-card h2 { font-size: 1.125rem; margin-top: 1.2em; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
        .ms-output-card h3 { font-size: 0.9375rem; margin-top: 1em; }
        .ms-output-card h4 { font-size: 0.875rem; }
        .ms-output-card strong { color: var(--ink); }
        .ms-output-card ul, .ms-output-card ol { padding-left: 1.5em; }
        .ms-output-card li { margin-bottom: 4px; }
        .ms-output-card code { background: var(--surface-hover); padding: 1px 5px; border-radius: 3px; font-size: 0.875em; }
        .ms-output-card .katex-display { margin: 16px 0; overflow-x: auto; }
        .ms-output-card .katex { font-size: 1.1em; }
        .ms-empty { text-align: center; padding: 40px 20px; color: var(--ink-muted); border: 2px dashed var(--border); border-radius: 12px; }
        .ms-empty p { margin: 8px 0 0; font-size: 0.875rem; }
        .ms-spinner { width: 18px; height: 18px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: msSpin 0.6s linear infinite; display: inline-block; vertical-align: -3px; margin-right: 8px; }
        @keyframes msSpin { to { transform: rotate(360deg); } }
        .ms-latex-hint { font-size: 0.75rem; color: var(--ink-faint); margin-top: 4px; line-height: 1.4; }
        .ms-latex-hint code { background: var(--surface-hover); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 0.8125em; }
      </style>

      <div class="ms-scroll">
        <div class="ms-container">
          <div class="ms-header">
            <h1>Math Sandbox</h1>
            <p>Design a math lesson with beautifully typeset equations. LaTeX renders automatically.</p>
          </div>

          <div class="ms-form">
            <div>
              <label for="ms-topic">Topic</label>
              <input id="ms-topic" class="input" type="text" value="Introduction to Differentiation" placeholder="e.g. Quadratic equations, Trigonometric identities..." style="width:100%;box-sizing:border-box;">
            </div>
            <div>
              <label for="ms-level">Level</label>
              <select id="ms-level" class="input" style="width:100%;box-sizing:border-box;">
                <option>Sec 3</option><option>Sec 4</option><option>JC 1</option><option selected>JC 2</option>
              </select>
            </div>
            <div class="full">
              <label for="ms-focus">Focus / Additional Instructions (optional)</label>
              <input id="ms-focus" class="input" type="text" placeholder="e.g. Include worked examples, focus on the power rule, real-world applications..." style="width:100%;box-sizing:border-box;">
            </div>
          </div>

          <div class="ms-latex-hint">
            <strong>LaTeX tips:</strong> Use <code>$...$</code> for inline math like <code>$f(x) = x^2$</code> and <code>$$...$$</code> for display equations.
            Works in Lesson Planner, CCE, Co-Cher+, and here.
          </div>

          <div class="ms-actions" style="margin-top: 12px;">
            <button id="ms-generate-btn" class="btn btn-primary" ${isGenerating ? 'disabled' : ''}>
              ${isGenerating ? '<span class="ms-spinner"></span>Generating...' : 'Generate Math Lesson'}
            </button>
            <button id="ms-example-btn" class="btn btn-ghost">Load Example (Differentiation)</button>
          </div>

          <!-- Math Scanner -->
          <div style="margin-bottom:20px;padding:16px;border:1px solid var(--border);border-radius:12px;background:var(--bg-card);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="3"/></svg>
              <span style="font-weight:700;font-size:0.9375rem;color:var(--ink);">Math Scanner</span>
              <span style="font-size:0.6875rem;color:var(--ink-faint);background:var(--surface-hover);padding:1px 8px;border-radius:999px;">beta</span>
            </div>
            <p style="font-size:0.8125rem;color:var(--ink-muted);margin-bottom:12px;line-height:1.5;">
              Upload a photo of handwritten or printed equations. AI will extract them as editable LaTeX.
            </p>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Image
                <input type="file" id="ms-scanner-file" accept="image/*" style="display:none;" />
              </label>
              <span id="ms-scanner-filename" style="font-size:0.75rem;color:var(--ink-faint);"></span>
            </div>
            <div id="ms-scanner-preview" style="display:none;margin-top:12px;">
              <img id="ms-scanner-img" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid var(--border);" />
              <button class="btn btn-primary btn-sm" id="ms-scanner-extract" style="margin-top:8px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Extract LaTeX
              </button>
            </div>
            <div id="ms-scanner-output" style="margin-top:12px;"></div>
          </div>

          <div id="ms-output">
            ${outputText ? `
              <div class="ms-output-card" id="ms-rendered">
                ${renderMd(outputText)}
              </div>
            ` : `
              <div class="ms-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                <p>Generate a math lesson or load the example to see LaTeX in action.</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    // Process LaTeX in rendered output
    const rendered = container.querySelector('#ms-rendered');
    if (rendered) processLatex(rendered);

    // Wire events
    container.querySelector('#ms-generate-btn').addEventListener('click', generateLesson);
    container.querySelector('#ms-example-btn').addEventListener('click', () => {
      outputText = EXAMPLE_LESSON;
      renderView();
    });

    // Math Scanner events
    const scannerFile = container.querySelector('#ms-scanner-file');
    const scannerPreview = container.querySelector('#ms-scanner-preview');
    const scannerImg = container.querySelector('#ms-scanner-img');
    const scannerFilename = container.querySelector('#ms-scanner-filename');
    let scannerBase64 = null;

    scannerFile?.addEventListener('change', () => {
      const file = scannerFile.files[0];
      if (!file) return;
      scannerFilename.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        scannerBase64 = e.target.result;
        scannerImg.src = scannerBase64;
        scannerPreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });

    container.querySelector('#ms-scanner-extract')?.addEventListener('click', async () => {
      if (!scannerBase64) return;
      const btn = container.querySelector('#ms-scanner-extract');
      const output = container.querySelector('#ms-scanner-output');
      btn.disabled = true;
      btn.innerHTML = '<span class="ms-spinner"></span>Extracting...';

      try {
        const text = await sendChat([{
          role: 'user',
          content: [
            { type: 'text', text: 'Extract ALL mathematical equations and expressions from this image. Return each equation as LaTeX, using $...$ for inline and $$...$$ for display. If there is handwritten working, reproduce each step. Format the output as clean LaTeX that can be rendered.' },
            { type: 'image', source: { type: 'base64', media_type: scannerBase64.match(/data:(.*?);/)?.[1] || 'image/png', data: scannerBase64.split(',')[1] } }
          ]
        }], {
          systemPrompt: 'You are a math OCR specialist. Extract equations from images and return them as clean LaTeX. Use $...$ for inline and $$...$$ for display math. Reproduce all steps and working shown.',
          temperature: 0.2, maxTokens: 2048
        });

        output.innerHTML = `
          <div class="ms-output-card" style="margin-top:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-weight:600;font-size:0.875rem;color:var(--ink);">Extracted LaTeX</span>
              <button class="btn btn-ghost btn-sm" id="ms-scanner-copy" style="font-size:0.75rem;">Copy Raw</button>
            </div>
            <div id="ms-scanner-rendered">${renderMd(text)}</div>
            <details style="margin-top:12px;">
              <summary style="font-size:0.75rem;color:var(--ink-muted);cursor:pointer;">Show raw LaTeX source</summary>
              <pre style="font-size:0.75rem;background:var(--surface-hover);padding:12px;border-radius:8px;overflow-x:auto;margin-top:8px;white-space:pre-wrap;">${text.replace(/</g, '&lt;')}</pre>
            </details>
          </div>
        `;
        processLatex(output.querySelector('#ms-scanner-rendered'));

        output.querySelector('#ms-scanner-copy')?.addEventListener('click', () => {
          navigator.clipboard.writeText(text).then(() => showToast('Copied raw LaTeX!', 'success'));
        });
      } catch (err) {
        output.innerHTML = `<p style="color:var(--danger);font-size:0.8125rem;">Error: ${err.message}</p>`;
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Extract LaTeX';
      }
    });
  }

  async function generateLesson() {
    const topic = container.querySelector('#ms-topic').value.trim();
    const level = container.querySelector('#ms-level').value;
    const focus = container.querySelector('#ms-focus').value.trim();

    if (!topic) {
      showToast('Please enter a topic.', 'warning');
      return;
    }

    isGenerating = true;
    renderView();

    try {
      const text = await sendChat(
        [{ role: 'user', content: `Create a math lesson on "${topic}" for ${level} students.${focus ? ` Focus: ${focus}` : ''}\n\nInclude worked examples with step-by-step solutions. Use LaTeX notation: $...$ for inline math and $$...$$ for display equations.` }],
        {
          systemPrompt: `You are Co-Cher's mathematics specialist for Singapore schools (O-Level / A-Level curriculum).

Generate a well-structured math lesson with:

## [Lesson Title]

### Learning Intentions
(What students will understand)

### Key Concepts
Define core concepts using proper LaTeX notation:
- Use $...$ for inline expressions like $f(x) = x^2$
- Use $$...$$ for display equations like $$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$
- Use \\frac{}{} for fractions, \\sqrt{} for roots, \\sum, \\int, \\lim etc.

### Worked Examples
Show 2-3 detailed worked examples with step-by-step LaTeX derivations.
Each step should be on its own display line.

### Practice Questions
3-5 practice questions of increasing difficulty.
For questions involving calculus, use proper notation like $\\frac{dy}{dx}$.

### Success Criteria
Measurable outcomes using "I can..." statements.

IMPORTANT: Use extensive LaTeX throughout. Every equation, expression, and mathematical symbol should use LaTeX delimiters. Do NOT use plain text for math — always use $ or $$ delimiters. Use \\\\  for line breaks within multi-step solutions.`,
          temperature: 0.6,
          maxTokens: 3072
        }
      );

      outputText = text;
    } catch (err) {
      console.error('Math lesson generation error:', err);
      showToast(`Generation failed: ${err.message}`, 'danger');
    } finally {
      isGenerating = false;
      renderView();
    }
  }

  renderView();
}
