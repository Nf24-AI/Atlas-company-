// Keyboard and on-screen movement buttons → a shared Set of pressed keys.
const MOVE_KEYS = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Shift']; // Shift = sprint (COS-110A)
// Letter keys use the physical key (e.code), so WASD / E / C / V / R / T / M also work while an
// Arabic (or any non-Latin) keyboard layout is active. Other keys keep e.key (arrows, Escape).
const norm = e => (/^Key[A-Z]$/.test(e.code || '') ? e.code.slice(3).toLowerCase() : e.key.length === 1 ? e.key.toLowerCase() : e.key);

export function createInput({onKey} = {}) {
  const keys = new Set();
  const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') return onKey?.('Escape', e);
    if (typing()) return;
    const k = norm(e);
    if (MOVE_KEYS.includes(k)) { keys.add(k); e.preventDefault(); return; }
    if (!e.ctrlKey && !e.metaKey && !e.altKey) onKey?.(k, e);
  });
  window.addEventListener('keyup', e => keys.delete(norm(e)));
  window.addEventListener('blur', () => keys.clear());
  for (const b of document.querySelectorAll('[data-move]')) {
    const k = b.dataset.move;
    b.addEventListener('pointerdown', e => { e.preventDefault(); keys.add(k); b.setPointerCapture(e.pointerId); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => keys.delete(k));
  }
  return keys;
}
