/*
 * Co-Cher 2 — per-school tint
 * ===========================
 * Co-Cher 1 was painted in one school's colours, which is exactly wrong for a
 * product meant to serve many. Co-Cher 2's own identity is deliberately neutral
 * (graphite-teal, see design-system.css), and each school tints the ACCENT from
 * its own pack.
 *
 * So a Park View teacher's Co-Cher looks like Park View, a St Andrew's teacher's
 * looks like St Andrew's, and the product itself belongs to neither.
 *
 * Only --accent and its derivatives move. Structure, contrast and the semantic
 * colours (marker = now/active, redpen = critique, growth = progress) stay put,
 * so no school can tint itself into an unreadable or misleading interface.
 */

import { loadPack } from './school.js';
import { getCurrentUser } from '../components/login.js';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** #rrggbb → "r,g,b", or null. */
function rgbOf(hex) {
  if (!HEX.test(hex || '')) return null;
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
/** Mix a hex toward white (amount 0..1) — used for the light/wash variants. */
function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
function darken(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c * (1 - amount));
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Apply the signed-in teacher's school tint. Safe to call repeatedly and safe
 * when there is no school, no pack, or no colour in the pack — it simply leaves
 * Co-Cher 2's neutral accent in place.
 */
export async function applySchoolTheme() {
  const user = getCurrentUser();
  const root = document.documentElement;
  root.style.removeProperty('--accent');
  root.style.removeProperty('--accent-dark');
  root.style.removeProperty('--accent-light');
  root.style.removeProperty('--accent-rgb');
  if (!user?.schoolId) return null;

  const pack = await loadPack(user.schoolId);
  const colour = pack?.theme?.accent;
  if (!HEX.test(colour || '')) return pack || null;

  root.style.setProperty('--accent', colour);
  root.style.setProperty('--accent-dark', darken(colour, 0.22));
  root.style.setProperty('--accent-light', lighten(colour, 0.86));
  const rgb = rgbOf(colour);
  if (rgb) root.style.setProperty('--accent-rgb', rgb);
  return pack;
}

/**
 * Put the school's name under the Co-Cher 2 wordmark, so a teacher can see at a
 * glance whose configuration they're running — which matters most when someone
 * signs in and quietly gets the wrong school.
 */
export async function paintSchoolLabel() {
  const el = document.getElementById('sidebar-school');
  if (!el) return;
  const user = getCurrentUser();
  if (!user?.schoolId) { el.textContent = 'Your Co-Teaching Assistant'; return; }
  const pack = await loadPack(user.schoolId);
  el.textContent = pack?.shortName || pack?.name || user.schoolName || 'Your Co-Teaching Assistant';
}
