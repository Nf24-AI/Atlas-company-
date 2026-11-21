// DOM helpers. All dynamic text goes through esc() — model output is untrusted.
export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const fmtTime = iso => (iso ? new Date(iso).toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-SA', {dateStyle: 'short', timeStyle: 'short'}) : '');
export const usd = n => '$' + (Number(n) || 0).toFixed(Number(n) < 0.01 && Number(n) > 0 ? 5 : 3);
let toastTimer;
export function toast(s) { const el = $('toast'); el.textContent = s; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 4000); }
/** Only http(s) links from GitHub are rendered as anchors (no javascript: URLs from data). */
export const safeLink = (url, text) => (/^https:\/\/github\.com\/[\w./#-]+$/.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text || url)}</a>` : esc(text || ''));
