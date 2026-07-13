/*
 * Co-Cher Teacher Identity
 * ========================
 * A teacher's *visual* identity — distinct from the account (preferred name,
 * school profile) which is text-only and feeds AI prompts. Stored under one
 * localStorage key so it survives independently of the app-data snapshot.
 *
 *   { avatar:   { color?: hex, initials?: string },  // monogram
 *     personalAccent?: hex,                          // propagating accent
 *     chosenMantra?:   string }                      // fixed dashboard line
 *
 * `applyIdentity()` is called once at boot (state.js, beside the palette
 * application) and whenever the teacher changes their accent. It sets CSS
 * custom properties on <html>; a chosen personal accent overrides whatever
 * the 8-preset palette would set, and — unlike a palette — it is derived so
 * ANY hex works. Dependency-free (no Store import).
 */

const IDENTITY_KEY = 'cocher_identity';

/** Read the stored identity object (always returns an object). */
export function getIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Merge a patch into the stored identity and persist. Returns the merged object. */
export function setIdentity(patch) {
  const next = { ...getIdentity(), ...(patch || {}) };
  // Merge avatar sub-object rather than replacing it wholesale.
  if (patch && patch.avatar) next.avatar = { ...(getIdentity().avatar || {}), ...patch.avatar };
  try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(next)); } catch { /* quota — ignore */ }
  return next;
}

/** Basic hex validation (#rgb or #rrggbb). */
function isHex(v) {
  return typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

/**
 * Apply the personal accent (if set) to <html> as CSS custom properties.
 * Derives the --accent-light/-dark/-hover family from the single chosen hex
 * via color-mix (already used elsewhere in the app), so any colour works and
 * the accent propagates everywhere the token is read. Safe no-op when unset —
 * the active palette / :root defaults then stand.
 */
export function applyIdentity() {
  const el = document.documentElement;
  if (!el) return;
  const id = getIdentity();
  const accent = id.personalAccent;
  // Always clear first so removing a personal accent falls back to the palette.
  ['--accent', '--accent-light', '--accent-dark', '--accent-hover', '--brand-gradient', '--shadow-glow']
    .forEach(p => el.style.removeProperty(p));
  if (!isHex(accent)) return;
  const a = accent.trim();
  el.style.setProperty('--accent', a);
  // Translucent light tint works over both light and dark surfaces.
  el.style.setProperty('--accent-light', `color-mix(in srgb, ${a} 16%, transparent)`);
  el.style.setProperty('--accent-dark', `color-mix(in srgb, ${a} 78%, #000)`);
  el.style.setProperty('--accent-hover', `color-mix(in srgb, ${a} 88%, #000)`);
  el.style.setProperty('--brand-gradient', `linear-gradient(135deg, color-mix(in srgb, ${a} 70%, #000) 0%, ${a} 55%, color-mix(in srgb, ${a} 55%, #fff) 100%)`);
  el.style.setProperty('--shadow-glow', `0 0 24px color-mix(in srgb, ${a} 22%, transparent)`);
}
