// HUD layout (COS-108-B): the team roster (right) and floor map (left) are collapsible so the default
// roam view keeps the office visible. Each has a visible toggle button (also T / M on the keyboard),
// exposes aria-expanded, and remembers the choice in this browser only (localStorage, no server).
// Never collapsed: the top bar (DEMO/LIVE/STATIC badge, STOPPED badge), the proximity prompt and
// the consent/security notices inside panels.
const STORE_KEY = 'atlas-hud-v1';
export const HUD_DEFAULTS = Object.freeze({team: false, map: false});

function load() {
  try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); if (v && typeof v === 'object') return {team: v.team === true, map: v.map === true}; } catch { /* corrupt or blocked storage */ }
  return {...HUD_DEFAULTS};
}

export function createHud({onToggle} = {}) {
  const state = load();
  const parts = {
    team: {btn: document.getElementById('teamToggle'), panel: document.getElementById('teamPanel'), cls: 'hud-team-open'},
    map: {btn: document.getElementById('mapToggle'), panel: document.getElementById('mapPanel'), cls: 'hud-map-open'},
  };
  const apply = () => {
    for (const [k, p] of Object.entries(parts)) {
      document.body.classList.toggle(p.cls, state[k]);
      p.btn.setAttribute('aria-expanded', String(state[k]));
      p.panel.hidden = !state[k];
    }
  };
  const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* not persisted */ } };
  const set = (k, open) => { if (!(k in parts)) return; state[k] = Boolean(open); apply(); save(); onToggle?.(k, state[k]); };
  for (const [k, p] of Object.entries(parts)) p.btn.addEventListener('click', () => set(k, !state[k]));
  apply();
  return {
    get state() { return {...state}; },
    set, toggle: k => set(k, !state[k]),
    /** Compact team summary shown on the collapsed button: one dot per AI employee + attention count. */
    summarize(employees, pendingApprovals) {
      const dots = parts.team.btn.querySelector('.hud-dots'), badge = parts.team.btn.querySelector('.hud-alert');
      dots.innerHTML = employees.map(e => `<i style="background:${e.color}" title="${e.title}"></i>`).join('');
      const blocked = employees.filter(e => e.status === 'blocked').length, alerts = blocked + pendingApprovals;
      badge.hidden = !alerts; badge.textContent = String(alerts);
      parts.team.btn.classList.toggle('has-alert', alerts > 0);
      parts.team.btn.dataset.blocked = String(blocked);
    },
  };
}
