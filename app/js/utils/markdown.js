/*
 * Co-Cher Markdown Renderer (shared)
 * ==================================
 * The single markdown-to-HTML pipeline for AI output across all views.
 * Supports tables, links (with YouTube embeds/tiles and simulation launch
 * buttons), LaTeX placeholders (KaTeX), blockquotes, flashcards, and
 * framework badges.
 *
 * Security: all text is HTML-escaped before markup is applied; link labels
 * are escaped and URLs sanitized before being placed in href attributes —
 * AI output can be steered by uploaded documents, so treat it as untrusted.
 */

/** Escape text for safe insertion into HTML (covers attribute contexts too). */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip active content from an AI-generated SVG so it can be inlined safely. */
export function sanitizeSvg(svg) {
  return String(svg ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/(xlink:href|href)\s*=\s*"(?!#)[^"]*"/gi, '')
    .replace(/(xlink:href|href)\s*=\s*'(?!#)[^']*'/gi, '');
}

/** Allow http(s), same-site relative paths, and fragments; neutralize the rest. */
export function sanitizeUrl(url) {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return '#';
  // Explicitly dangerous or unknown schemes → inert
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) return '#';
  return trimmed
    .replace(/"/g, '%22')
    .replace(/'/g, '%27')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E')
    .replace(/ /g, '%20');
}

export function md(text) {
  // Normalize: collapse line breaks inside markdown link syntax [label](url)
  // The AI often wraps long links across lines, breaking the regex
  text = String(text ?? '');
  text = text.replace(/\]\s*\n\s*\(/g, '](');  // fix ]\n(
  text = text.replace(/\[([^\]]*)\n([^\]]*)\]/g, '[$1 $2]');  // fix newline inside [label]

  // Protect LaTeX delimiters from HTML escaping
  const latexPlaceholders = [];
  // Display math $$...$$ and \[...\]
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => {
    const idx = latexPlaceholders.length;
    latexPlaceholders.push(`<div class="katex-display-wrap">$$${inner}$$</div>`);
    return `%%LATEX_${idx}%%`;
  });
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => {
    const idx = latexPlaceholders.length;
    latexPlaceholders.push(`<div class="katex-display-wrap">\\[${inner}\\]</div>`);
    return `%%LATEX_${idx}%%`;
  });
  // Inline math $...$ and \(...\) — skip currency like $10
  text = text.replace(/\$([^\s$](?:[^$]*?[^\s$])?)\$/g, (match, inner) => {
    if (/^\d+([.,]\d+)?$/.test(inner.trim())) return match;
    const idx = latexPlaceholders.length;
    latexPlaceholders.push(`<span class="katex-inline-wrap">$${inner}$</span>`);
    return `%%LATEX_${idx}%%`;
  });
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => {
    const idx = latexPlaceholders.length;
    latexPlaceholders.push(`<span class="katex-inline-wrap">\\(${inner}\\)</span>`);
    return `%%LATEX_${idx}%%`;
  });

  // Preserve markdown links before HTML-escaping by extracting them first
  // Matches both http(s) URLs and local paths like simulations/...
  const linkPlaceholders = [];
  text = text.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (m, label, url) => {
    const idx = linkPlaceholders.length;
    linkPlaceholders.push({ label: label.trim(), url: url.trim() });
    return `%%MDLINK_${idx}%%`;
  });

  // Preserve bare URLs before escaping
  const bareUrlPlaceholders = [];
  text = text.replace(/(?<!["\(=\[])(https?:\/\/[^\s<)"]+)/g, (url) => {
    const idx = bareUrlPlaceholders.length;
    bareUrlPlaceholders.push(url);
    return `%%BAREURL_${idx}%%`;
  });

  let result = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg-subtle,rgba(0,0,0,0.06));padding:8px 12px;border-radius:8px;font-size:0.8rem;overflow-x:auto;margin:6px 0;font-family:var(--font-mono);"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold, italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^#### (.+)$/gm, '<h5 style="font-size:0.85rem;font-weight:600;margin:6px 0 3px;">$1</h5>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:0.9rem;font-weight:600;margin:8px 0 4px;">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:1rem;font-weight:600;margin:10px 0 4px;">$1</h3>')
    .replace(/^# (.+)$/gm, '<h3 style="font-size:1.05rem;font-weight:700;margin:12px 0 4px;">$1</h3>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border-light);margin:12px 0;">')
    // Tables
    .replace(/^(\|.+\|)\n(\|[-:| ]+\|)\n((?:\|.+\|\n?)+)/gm, (match, headerRow, sepRow, bodyRows) => {
      const headers = headerRow.split('|').filter(c => c.trim());
      const alignments = sepRow.split('|').filter(c => c.trim()).map(c => {
        c = c.trim();
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });
      const rows = bodyRows.trim().split('\n').map(r => r.split('|').filter(c => c.trim()));
      return `<div style="overflow-x:auto;margin:8px 0;"><table style="width:100%;border-collapse:collapse;font-size:0.8125rem;color:var(--ink-secondary);">
        <thead><tr>${headers.map((h, i) => `<th style="text-align:${alignments[i] || 'left'};padding:6px 10px;border-bottom:2px solid var(--border);font-weight:600;color:var(--ink);background:var(--bg-subtle);">${h.trim()}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(row => `<tr>${row.map((cell, i) => `<td style="text-align:${alignments[i] || 'left'};padding:5px 10px;border-bottom:1px solid var(--border-light);">${cell.trim()}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    })
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => {
      if (m.match(/^\d+\./m)) return m;
      return `<ul style="padding-left:1.25rem;margin:4px 0;">${m}</ul>`;
    })
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:2px 0;">$1</li>')
    .replace(/(<li style="margin:2px 0;">[^<]*<\/li>\n?){2,}/g, m => {
      if (m.includes('<ul') || m.includes('<ol')) return m;
      return `<ol style="padding-left:1.25rem;margin:4px 0;">${m}</ol>`;
    })
    // Blockquotes (for "copy this prompt" sections)
    .replace(/&gt; (.+)/g, '<blockquote style="border-left:3px solid var(--accent);padding:8px 12px;margin:6px 0;background:var(--accent-light,rgba(67,97,238,0.06));border-radius:0 6px 6px 0;font-size:0.8125rem;color:var(--ink-secondary);">$1</blockquote>')
    // Paragraphs
    .replace(/\n{2,}/g, '</p><p style="margin:4px 0;">')
    .replace(/\n/g, '<br>');

  // Restore markdown links with rich rendering.
  // Labels are escaped and URLs sanitized here — the AI (and shared-lesson
  // imports) must not be able to smuggle markup through link syntax.
  result = result.replace(/%%MDLINK_(\d+)%%/g, (_, idx) => {
    const { label: rawLabel, url: rawUrl } = linkPlaceholders[parseInt(idx)];
    const label = escapeHtml(rawLabel);
    const url = sanitizeUrl(rawUrl);
    // YouTube video URL → inline embed preview
    const ytWatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (ytWatch) {
      return `<div style="margin:8px 0;">
        <a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);font-weight:500;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#ff0000" stroke="none"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12c0 2 .2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8z"/><polygon points="9.75 15 15.5 12 9.75 9" fill="white"/></svg>
          ${label}
        </a>
        <div style="margin-top:6px;border-radius:8px;overflow:hidden;max-width:480px;aspect-ratio:16/9;background:#000;">
          <iframe src="https://www.youtube-nocookie.com/embed/${ytWatch[1]}" style="width:100%;height:100%;border:none;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>
      </div>`;
    }
    // YouTube search URL → thumbnail preview tile
    if (url.includes('youtube.com/results?search_query=')) {
      return `<a href="${url}" target="_blank" rel="noopener" class="yt-tile" style="display:inline-flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-subtle,#fafafa);border:1px solid var(--border-light,#e5e5e5);border-radius:10px;text-decoration:none;margin:4px 0;max-width:400px;transition:box-shadow 0.15s,border-color 0.15s;" onmouseenter="this.style.boxShadow='0 2px 12px rgba(0,0,0,0.15)';this.style.borderColor='#ff0000';" onmouseleave="this.style.boxShadow='none';this.style.borderColor='';">
        <div style="width:80px;height:45px;flex-shrink:0;background:var(--surface,#1a1a1a);border-radius:6px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#ff0000" stroke="none"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12c0 2 .2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8z"/><polygon points="9.75 15 15.5 12 9.75 9" fill="white"/></svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.8125rem;font-weight:600;color:var(--ink,#1a1a1a);line-height:1.3;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${label}</div>
          <div style="font-size:0.6875rem;color:#ff0000;font-weight:500;margin-top:2px;">Search on YouTube →</div>
        </div>
      </a>`;
    }
    // Simulation platform links → styled accent button
    if (/phet\.colorado\.edu|geogebra\.org|desmos\.com|falstad\.com|labxchange\.org|chemcollective\.org/.test(url)) {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:var(--accent,#4361ee);color:var(--bg,#fff);border-radius:6px;font-size:0.75rem;font-weight:500;text-decoration:none;margin:2px 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        ${label}
      </a>`;
    }
    // Co-Cher built-in simulation launch link
    if (url.startsWith('simulations/') && url.endsWith('.html')) {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border-radius:8px;font-size:0.8125rem;font-weight:600;text-decoration:none;margin:4px 0;box-shadow:0 2px 8px rgba(139,92,246,0.3);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        ${label}
      </a>`;
    }
    // General link
    return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">${label}</a>`;
  });

  // Restore bare URLs
  result = result.replace(/%%BAREURL_(\d+)%%/g, (_, idx) => {
    const url = sanitizeUrl(bareUrlPlaceholders[parseInt(idx)]);
    if (url.includes('youtube.com/results?search_query=')) {
      const q = decodeURIComponent(url.split('search_query=')[1] || '').replace(/\+/g, ' ');
      return `<a href="${url}" target="_blank" rel="noopener" class="yt-tile" style="display:inline-flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-subtle,#fafafa);border:1px solid var(--border-light,#e5e5e5);border-radius:10px;text-decoration:none;margin:4px 0;max-width:400px;" onmouseenter="this.style.boxShadow='0 2px 12px rgba(0,0,0,0.15)';this.style.borderColor='#ff0000';" onmouseleave="this.style.boxShadow='none';this.style.borderColor='';">
        <div style="width:60px;height:34px;flex-shrink:0;background:var(--surface,#1a1a1a);border-radius:5px;display:flex;align-items:center;justify-content:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff0000" stroke="none"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12c0 2 .2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.8.5-5.8s-.2-3.9-.5-5.8z"/><polygon points="9.75 15 15.5 12 9.75 9" fill="white"/></svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.75rem;font-weight:600;color:var(--ink,#1a1a1a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(q.slice(0, 50))}</div>
          <div style="font-size:0.625rem;color:#ff0000;font-weight:500;">Search on YouTube →</div>
        </div>
      </a>`;
    }
    if (/phet\.colorado\.edu|geogebra\.org|desmos\.com|falstad\.com/.test(url)) {
      return `<a href="${url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:var(--accent,#4361ee);color:#fff;border-radius:6px;font-size:0.75rem;font-weight:500;text-decoration:none;margin:2px 0;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Open: ${escapeHtml(url.split('/').pop() || url)}
      </a>`;
    }
    return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:underline;">${escapeHtml(url)}</a>`;
  });

  // Restore LaTeX placeholders (must be last, after all other placeholder restoration)
  result = result.replace(/%%LATEX_(\d+)%%/g, (_, idx) => latexPlaceholders[parseInt(idx)]);

  // Flashcard rendering: detect CARD:/BACK: patterns
  result = result.replace(/(?:CARD:\s*(.+?)(?:<br>|\n)BACK:\s*(.+?)(?:<br>|\n)---)/g, (match, term, back) => {
    const parts = back.split('|').map(p => p.trim());
    const def = parts[0] || '';
    const example = parts[1] || '';
    const wordClass = parts[2] || '';
    return `<div class="flashcard" onclick="this.classList.toggle('flipped')" style="perspective:600px;cursor:pointer;min-height:110px;display:inline-block;width:calc(33% - 8px);vertical-align:top;margin:4px;">
      <div style="position:relative;width:100%;min-height:110px;transition:transform 0.5s;transform-style:preserve-3d;">
        <div style="position:absolute;inset:0;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--bg-card);font-weight:700;font-size:0.9375rem;color:var(--ink);">${term}</div>
        <div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10px;border-radius:10px;border:1px solid var(--accent);background:var(--accent-light);font-size:0.75rem;color:var(--ink);line-height:1.4;">
          <div style="font-weight:600;margin-bottom:4px;">${def}</div>
          ${example ? `<div style="font-style:italic;color:var(--ink-muted);">${example}</div>` : ''}
          ${wordClass ? `<div style="margin-top:4px;font-size:0.625rem;color:var(--ink-faint);">${wordClass}</div>` : ''}
        </div>
      </div>
    </div>`;
  });

  // Wrap consecutive flashcards in a container
  result = result.replace(/((?:<div class="flashcard"[^]*?<\/div>\s*<\/div>\s*<\/div>\s*)+)/g,
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;">$1</div>');

  // Flashcard flip CSS (injected inline)
  if (result.includes('class="flashcard"')) {
    result = '<style>.flashcard.flipped > div { transform: rotateY(180deg); }</style>' + result;
  }

  // Only badge framework terms that are NOT inside HTML tags
  const badgeFramework = (pattern, bg, color) => {
    result = result.replace(new RegExp(`(?<!["\\/\\w-])(${pattern})(?!["\\/\\w-])`, 'g'),
      `<span style="display:inline;padding:1px 6px;border-radius:4px;font-size:0.6875rem;font-weight:600;background:${bg};color:${color};">$1</span>`);
  };
  badgeFramework('E21CC', 'rgba(99,102,241,0.12)', '#6366f1');
  badgeFramework('CAIT|CCI|CGC', 'rgba(99,102,241,0.1)', '#6366f1');
  badgeFramework('EdTech|SLS', 'rgba(6,182,212,0.12)', '#06b6d4');
  badgeFramework('STP', 'rgba(16,185,129,0.12)', '#10b981');
  badgeFramework('CCE|R3ICH', 'rgba(236,72,153,0.12)', '#ec4899');
  badgeFramework('SEL', 'rgba(245,158,11,0.12)', '#f59e0b');

  return result;
}
