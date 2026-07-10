/*
 * LaTeX + Markdown Rendering Utility
 * ====================================
 * Shared across all views. Renders:
 *   - LaTeX (via KaTeX): $$...$$ for display, $...$ for inline
 *   - Markdown: headings, bold, italic, lists, tables, code blocks
 *
 * Usage:
 *   import { renderMd } from '../utils/latex.js';
 *   el.innerHTML = renderMd(text);
 *   // Then call processLatex(el) to activate KaTeX on the element
 */

/**
 * Render LaTeX in a DOM element using KaTeX.
 * Call this AFTER innerHTML is set, so KaTeX can find the delimiters.
 * Safe to call if KaTeX hasn't loaded yet (silently skips).
 */
export function processLatex(element) {
  if (!element) return;
  if (typeof window.renderMathInElement === 'function') {
    window.renderMathInElement(element, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false,
      trust: true
    });
  } else {
    // KaTeX not loaded yet — wait and retry once
    setTimeout(() => {
      if (typeof window.renderMathInElement === 'function') {
        window.renderMathInElement(element, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false,
          trust: true
        });
      }
    }, 500);
  }
}

/**
 * Process all elements with a given selector for LaTeX rendering.
 * Useful for batch-processing after a view render.
 */
export function processLatexAll(container, selector) {
  if (!container) return;
  const targets = selector ? container.querySelectorAll(selector) : [container];
  targets.forEach(el => processLatex(el));
}

/**
 * Full markdown renderer with LaTeX awareness.
 * LaTeX delimiters are preserved (not escaped) so KaTeX can process them
 * after the HTML is inserted into the DOM.
 */
export function renderMd(text) {
  if (!text) return '';

  // Protect LaTeX blocks from HTML escaping
  const latexBlocks = [];
  let processed = text;

  // Protect display math $$...$$ and \[...\]
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => {
    const idx = latexBlocks.length;
    latexBlocks.push(`<div class="katex-display-placeholder" data-latex-display="${idx}">$$${inner}$$</div>`);
    return `\x00LATEX${idx}\x00`;
  });
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => {
    const idx = latexBlocks.length;
    latexBlocks.push(`<div class="katex-display-placeholder" data-latex-display="${idx}">\\[${inner}\\]</div>`);
    return `\x00LATEX${idx}\x00`;
  });

  // Protect inline math $...$ and \(...\) — but not currency like $10
  processed = processed.replace(/\$([^\s$](?:[^$]*?[^\s$])?)\$/g, (match, inner) => {
    // Skip if it looks like currency (digits only)
    if (/^\d+([.,]\d+)?$/.test(inner.trim())) return match;
    const idx = latexBlocks.length;
    latexBlocks.push(`<span data-latex-inline="${idx}">$${inner}$</span>`);
    return `\x00LATEX${idx}\x00`;
  });
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => {
    const idx = latexBlocks.length;
    latexBlocks.push(`<span data-latex-inline="${idx}">\\(${inner}\\)</span>`);
    return `\x00LATEX${idx}\x00`;
  });

  // Now escape HTML
  let html = processed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (```...```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre style="background:var(--surface-hover,#f1f5f9);padding:10px 14px;border-radius:8px;overflow-x:auto;font-size:0.8125rem;line-height:1.5;"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--surface-hover,#f1f5f9);padding:1px 5px;border-radius:3px;font-size:0.875em;">$1</code>');

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:0.8125rem;font-weight:700;margin:10px 0 4px;color:var(--ink);">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:0.875rem;font-weight:700;margin:12px 0 4px;color:var(--ink);">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:1rem;font-weight:700;margin:14px 0 6px;color:var(--ink);">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:1.125rem;font-weight:800;margin:16px 0 8px;color:var(--ink);">$1</h1>');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '<em>$1</em>');

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul style="padding-left:1.5em;margin:4px 0;">$1</ul>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Tables
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.split('|').filter(c => c.trim() !== '');
    if (cells.every(c => /^[\s\-:]+$/.test(c))) return '';
    return '<tr>' + cells.map(c =>
      `<td style="padding:6px 10px;border:1px solid var(--border,#e2e8f0);">${c.trim()}</td>`
    ).join('') + '</tr>';
  });
  html = html.replace(/((?:<tr>.*<\/tr>\n?)+)/g,
    '<table style="width:100%;border-collapse:collapse;margin:8px 0;font-size:0.8125rem;">$1</table>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';

  // Clean up empty/wrapping artifacts
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[1-4]>)/g, '$1');
  html = html.replace(/(<\/h[1-4]>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<ul)/g, '$1');
  html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<table)/g, '$1');
  html = html.replace(/(<\/table>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<pre)/g, '$1');
  html = html.replace(/(<\/pre>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>\s*(<div)/g, '$1');
  html = html.replace(/(<\/div>)\s*<\/p>/g, '$1');

  // Restore LaTeX blocks
  html = html.replace(/\x00LATEX(\d+)\x00/g, (_, idx) => latexBlocks[parseInt(idx)]);

  return html;
}
