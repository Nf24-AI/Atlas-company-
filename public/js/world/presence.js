// Employee presence (COS-108-C): the ONLY mapping from a real backend work status to what the office
// shows — body pose, beacon/floor-ring behaviour and the label. Pure data, importable from Node.
// Rule: an employee only looks busy when the store says so. `typing` is reserved for `executing`
// (a recorded tool run); anything unrecognised renders as `unknown`, never as working.
export const PRESENCE = Object.freeze({
  available: Object.freeze({pose: 'idle', attention: false, busy: false}),
  planning: Object.freeze({pose: 'thinking', attention: false, busy: true}),
  in_meeting: Object.freeze({pose: 'talking', attention: false, busy: true}),
  executing: Object.freeze({pose: 'typing', attention: false, busy: true}),
  reviewing: Object.freeze({pose: 'reading', attention: false, busy: true}),
  blocked: Object.freeze({pose: 'blocked', attention: true, busy: false}),
  awaiting_approval: Object.freeze({pose: 'waiting', attention: true, busy: false}),
  completed: Object.freeze({pose: 'done', attention: false, busy: false}),
  unknown: Object.freeze({pose: 'unknown', attention: false, busy: false}),
});
export const KNOWN_STATUSES = Object.freeze(Object.keys(PRESENCE).filter(k => k !== 'unknown'));

/** Presence for a status string from the API. Missing / unrecognised → `unknown`. */
export function presenceFor(status) {
  const key = Object.hasOwn(PRESENCE, status) && status !== 'unknown' ? status : 'unknown';
  return {status: key, ...PRESENCE[key]};
}
