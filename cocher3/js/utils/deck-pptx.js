/*
 * Co-Cher 3: a deck as a PowerPoint file
 * ======================================
 * Builds a real, editable .pptx from a deck's slide model: text stays text,
 * charts stay charts, teacher notes go to the notes pane. Diagrams (SVG) are
 * turned into pictures first, because PowerPoint on older machines does not
 * draw SVG. The deck's own look comes along (utils/deck.js `deckPalette`).
 *
 * PowerPoint cannot use web fonts unless they are installed, so headings are
 * set in Georgia and body text in Calibri: the nearest faces every school
 * computer has.
 *
 * The library (PptxGenJS, MIT) is loaded only when a teacher asks for the
 * file, so it costs nothing until then.
 */
import { deckPalette, slugify } from './deck.js';

const LIB = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
let loading = null;
function loadLib() {
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
  if (!loading) loading = new Promise((ok, no) => {
    const el = document.createElement('script'); el.src = LIB; el.async = true;
    el.onload = () => window.PptxGenJS ? ok(window.PptxGenJS) : no(new Error('The PowerPoint maker did not load.'));
    el.onerror = () => { loading = null; no(new Error('Could not load the PowerPoint maker. Check your connection and try again.')); };
    document.head.appendChild(el);
  });
  return loading;
}

/** An SVG string as a PNG data URL, so any PowerPoint can show it. */
function svgToPng(svg, width = 1600) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const src = /xmlns=/.test(svg) ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      img.onload = () => {
        const ratio = (img.naturalHeight || 9) / (img.naturalWidth || 16);
        const c = document.createElement('canvas'); c.width = width; c.height = Math.round(width * ratio);
        const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        resolve({ data: c.toDataURL('image/png'), ratio });
      };
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    } catch { resolve(null); }
  });
}
function imageRatio(dataUrl) {
  return new Promise((resolve) => { const i = new Image(); i.onload = () => resolve((i.naturalHeight || 9) / (i.naturalWidth || 16)); i.onerror = () => resolve(0.5625); i.src = dataUrl; });
}

const hex = (c) => String(c || '').replace('#', '').toUpperCase();
const LAYOUTS = new Set(['title', 'section', 'bullets', 'columns', 'statement', 'quote', 'visual', 'exit']);

export async function downloadDeckPptx(deck) {
  if (!deck || !Array.isArray(deck.slides) || !deck.slides.length) throw new Error('This deck has no slides to export.');
  const Pptx = await loadLib();
  const pal = deckPalette(deck);
  const H = pal.id === 'classic' ? 'Calibri' : 'Georgia', B = 'Calibri';
  const pptx = new Pptx();
  pptx.layout = 'LAYOUT_WIDE';                      // 13.33 x 7.5 in, 16:9
  pptx.title = String(deck.title || 'Slide deck');
  const W = 13.33, Ht = 7.5, M = 0.8;
  const bulletOpts = (size) => ({ fontFace: B, fontSize: size, color: hex(pal.ink), bullet: { code: '25CF', color: hex(pal.accent2) }, paraSpaceAfter: 10, valign: 'top' });

  for (let i = 0; i < deck.slides.length; i++) {
    const s = deck.slides[i] || {};
    const layout = LAYOUTS.has(s.layout) ? s.layout : (i === 0 ? 'title' : 'bullets');
    const sl = pptx.addSlide();
    sl.background = { color: hex(pal.bg) };
    const heading = String(s.title || (i === 0 ? deck.title : `Slide ${i + 1}`) || '');
    const bullets = (Array.isArray(s.bullets) ? s.bullets : []).filter(Boolean).map(String);
    if (s.notes) sl.addNotes(String(s.notes));

    // the visual, if any: a picture, a diagram made into a picture, or a chart
    let pic = null;
    if (typeof s.image === 'string' && s.image.startsWith('data:image/')) pic = { data: s.image, ratio: await imageRatio(s.image) };
    else if (typeof s.svg === 'string' && s.svg.includes('<svg')) pic = await svgToPng(s.svg);
    const chart = !pic && s.chart && Array.isArray(s.chart.data) && s.chart.data.length >= 2 ? s.chart : null;
    const placeVisual = (x, y, w, h) => {
      if (pic) { let pw = w, ph = w * pic.ratio; if (ph > h) { ph = h; pw = h / pic.ratio; }
        sl.addImage({ data: pic.data, x: x + (w - pw) / 2, y: y + (h - ph) / 2, w: pw, h: ph }); }
      else if (chart) { const type = chart.type === 'line' ? pptx.charts.LINE : chart.type === 'donut' ? pptx.charts.DOUGHNUT : pptx.charts.BAR;
        sl.addChart(type, [{ name: chart.title || heading, labels: chart.data.map(d => String(d.label)), values: chart.data.map(d => Number(d.value) || 0) }],
          { x, y, w, h, chartColors: [hex(pal.accent), hex(pal.accent2)], showTitle: !!chart.title, title: chart.title || '', titleColor: hex(pal.muted), titleFontSize: 14,
            catAxisLabelColor: hex(pal.muted), valAxisLabelColor: hex(pal.muted), showLegend: chart.type === 'donut', legendPos: 'r', legendColor: hex(pal.ink) }); }
    };
    const hasVisual = !!(pic || chart);

    if (layout === 'title') {
      const kick = String(s.kicker || '').trim();
      if (kick && kick.toLowerCase() !== heading.toLowerCase()) sl.addText(kick, { x: M, y: 1.5, w: W - 2 * M, h: 0.5, fontFace: B, fontSize: 18, bold: true, color: hex(pal.accent) });
      sl.addText(heading, { x: M, y: 2.0, w: W - 2 * M, h: 1.6, fontFace: H, fontSize: 48, bold: true, color: hex(pal.ink), valign: 'top', fit: 'shrink' });
      if (s.subtitle) sl.addText(String(s.subtitle), { x: M, y: 3.6, w: W - 2 * M, h: 0.6, fontFace: B, fontSize: 22, color: hex(pal.muted) });
      if (bullets.length) sl.addText(bullets.map(t => ({ text: t, options: bulletOpts(20) })), { x: M, y: 4.3, w: W - 2 * M, h: 2.4, valign: 'top' });
    } else if (layout === 'section') {
      sl.addText(String(i + 1).padStart(2, '0'), { x: M, y: 2.4, w: 2.2, h: 2, fontFace: H, fontSize: 80, bold: true, color: hex(pal.accent) });
      sl.addText(heading, { x: M + 2.4, y: 2.4, w: W - 2 * M - 2.4, h: 1.4, fontFace: H, fontSize: 40, bold: true, color: hex(pal.ink), valign: 'middle', fit: 'shrink' });
      if (s.subtitle) sl.addText(String(s.subtitle), { x: M + 2.4, y: 3.8, w: W - 2 * M - 2.4, h: 0.7, fontFace: B, fontSize: 20, color: hex(pal.muted) });
    } else if (layout === 'statement' || layout === 'quote') {
      const body = layout === 'quote' ? `“${String(s.quote || s.title || '')}”` : String(s.statement || s.title || '');
      sl.addText(body, { x: M + 0.4, y: 1.6, w: W - 2 * M - 0.8, h: 3.6, fontFace: H, fontSize: 40, bold: true, color: hex(pal.ink), align: 'center', valign: 'middle', fit: 'shrink' });
      const under = layout === 'quote' ? (s.attribution ? `— ${s.attribution}` : '') : (s.subtitle || '');
      if (under) sl.addText(String(under), { x: M, y: 5.3, w: W - 2 * M, h: 0.6, fontFace: B, fontSize: 20, color: hex(pal.muted), align: 'center' });
    } else if (layout === 'columns') {
      sl.addText(heading, { x: M, y: 0.6, w: W - 2 * M, h: 1.0, fontFace: H, fontSize: 34, bold: true, color: hex(pal.ink), fit: 'shrink' });
      const cols = (Array.isArray(s.columns) ? s.columns : []).slice(0, 3); const n = Math.max(1, cols.length); const gap = 0.4; const cw = (W - 2 * M - gap * (n - 1)) / n;
      cols.forEach((c, k) => { const x = M + k * (cw + gap);
        sl.addShape(pptx.shapes.RECTANGLE, { x, y: 1.9, w: cw, h: 4.7, fill: { color: hex(pal.surface) }, line: { color: hex(pal.line), width: 0.75 } });
        sl.addText(String(c?.heading || ''), { x: x + 0.25, y: 2.05, w: cw - 0.5, h: 0.6, fontFace: B, fontSize: 20, bold: true, color: hex(pal.accent) });
        const items = (Array.isArray(c?.items) ? c.items : []).filter(Boolean).map(String);
        if (items.length) sl.addText(items.map(t => ({ text: t, options: bulletOpts(17) })), { x: x + 0.25, y: 2.7, w: cw - 0.5, h: 3.7, valign: 'top' }); });
    } else {
      if (layout === 'exit') sl.addText(String(s.kicker || 'Exit ticket'), { x: M, y: 0.45, w: W - 2 * M, h: 0.4, fontFace: B, fontSize: 16, bold: true, color: hex(pal.accent) });
      sl.addText(heading, { x: M, y: 0.8, w: W - 2 * M, h: 1.0, fontFace: H, fontSize: 34, bold: true, color: hex(pal.ink), fit: 'shrink' });
      if (s.subtitle) sl.addText(String(s.subtitle), { x: M, y: 1.75, w: W - 2 * M, h: 0.5, fontFace: B, fontSize: 18, color: hex(pal.muted) });
      const top = s.subtitle ? 2.4 : 2.0, h = Ht - top - 0.7;
      if (hasVisual && (layout === 'visual' || !bullets.length)) placeVisual(M, top, W - 2 * M, h);
      else if (hasVisual) { const tw = (W - 2 * M) * 0.5;
        sl.addText(bullets.map(t => ({ text: t, options: bulletOpts(20) })), { x: M, y: top, w: tw, h, valign: 'top' });
        placeVisual(M + tw + 0.4, top, W - 2 * M - tw - 0.4, h); }
      else if (bullets.length) sl.addText(bullets.map(t => ({ text: t, options: bulletOpts(22) })), { x: M, y: top, w: W - 2 * M, h, valign: 'top' });
    }
    sl.addText(`${i + 1} / ${deck.slides.length}`, { x: W - M - 1.5, y: Ht - 0.5, w: 1.5, h: 0.3, fontFace: B, fontSize: 10, color: hex(pal.muted), align: 'right' });
  }
  await pptx.writeFile({ fileName: `${slugify(deck.title || 'slide-deck')}.pptx` });
}
