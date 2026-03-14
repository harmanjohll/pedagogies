/*
 * Tool Stub — Placeholder pages for upcoming teaching tools
 * =========================================================
 * Renders a "Coming Soon" page with tool description.
 */

const TOOL_INFO = {
  'stave-notation': {
    title: 'Stave Notation',
    color: '#7c3aed',
    icon: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    desc: 'Staff notation editor for music theory — treble/bass clef, time signatures, note values, and basic composition.',
    features: [
      'Treble and bass clef staves',
      'Drag-and-drop note placement (whole, half, quarter, eighth, sixteenth)',
      'Key and time signature selection',
      'Playback of composed notation',
      'Export as image for worksheets',
    ],
  },
  'kitchen-layout': {
    title: 'Kitchen Layout',
    color: '#0d9488',
    icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
    desc: 'Plan kitchen workstation layouts for NFS/FCE practical lessons — drag equipment onto a spatial grid.',
    features: [
      'Grid-based kitchen floor plan editor',
      'Drag-and-drop workstation equipment',
      'Student position markers',
      'Safety zone highlighting',
      'Template presets for common kitchen layouts',
    ],
  },
};

export function renderStaveNotation(container) { renderStub(container, 'stave-notation'); }
export function renderKitchenLayout(container) { renderStub(container, 'kitchen-layout'); }

function renderStub(container, toolId) {
  const tool = TOOL_INFO[toolId];
  if (!tool) { container.innerHTML = '<p>Tool not found.</p>'; return; }

  container.innerHTML = `
    <div class="main-scroll">
      <div class="page-container" style="max-width:700px;">
        <div class="page-header">
          <div>
            <h1 class="page-title" style="display:flex;align-items:center;gap:10px;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${tool.color}" stroke-width="2">${tool.icon}</svg>
              ${tool.title}
            </h1>
            <p class="page-subtitle">${tool.desc}</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:var(--sp-5);padding:var(--sp-5);text-align:center;">
          <div style="width:80px;height:80px;border-radius:20px;background:linear-gradient(135deg,${tool.color},${tool.color}99);display:inline-flex;align-items:center;justify-content:center;margin-bottom:var(--sp-3);">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5">${tool.icon}</svg>
          </div>
          <h3 style="font-size:1.125rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Coming Soon</h3>
          <p style="font-size:0.875rem;color:var(--ink-muted);line-height:1.6;max-width:400px;margin:0 auto var(--sp-4);">
            This interactive is currently being built. It will launch in a fullscreen overlay just like Simulations and Rhythm & Percussion.
          </p>
        </div>

        <div class="card" style="padding:var(--sp-4);">
          <h4 style="font-size:0.875rem;font-weight:600;color:var(--ink);margin-bottom:var(--sp-2);">Planned Features</h4>
          <ul style="font-size:0.8125rem;color:var(--ink-muted);line-height:1.8;padding-left:20px;">
            ${tool.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>
  `;
}
