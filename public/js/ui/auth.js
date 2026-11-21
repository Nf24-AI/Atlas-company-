// Auth gate: first-run CEO setup or sign-in. Session lives in an HttpOnly cookie set by the
// server; this module never sees or stores credentials beyond the form submission.
import {api} from '../net/api-client.js';
import {t} from './i18n.js';
import {esc} from './dom.js';

export async function ensureSignedIn(root) {
  const status = await api('/api/auth/status');
  if (status.user) return status.user;
  return new Promise(resolve => {
    const setup = status.setupRequired;
    root.hidden = false;
    root.innerHTML = `<form class="auth-card frosted" id="authForm" novalidate>
      <div class="brand"><div class="brand-symbol">A<span>·</span></div><div><b>ATLAS</b><small>COMPANY OS</small></div></div>
      <h2>${esc(setup ? t('setup') : t('login'))}</h2>
      <p class="muted">${setup ? 'أول تشغيل: أنشئ حساب الرئيس التنفيذي المحلي. يُحفظ على جهازك فقط (SQLite).' : 'سجّل الدخول لإدارة شركتك.'}</p>
      ${setup ? `<label>${esc(t('name'))}<input name="displayName" required maxlength="80" autocomplete="name"></label><label>${esc(t('company'))}<input name="companyName" value="ATLAS" maxlength="80"></label>` : ''}
      <label>${esc(t('email'))}<input name="email" type="email" required autocomplete="username"></label>
      <label>${esc(t('password'))}<input name="password" type="password" required minlength="10" autocomplete="${setup ? 'new-password' : 'current-password'}"></label>
      <div class="auth-error" id="authError" role="alert"></div>
      <button class="btn primary" type="submit">${esc(setup ? t('setup') : t('login'))}</button>
    </form>`;
    const form = root.querySelector('#authForm');
    form.querySelector('input').focus();
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(form));
      const btn = form.querySelector('button'); btn.disabled = true;
      try {
        await api(setup ? '/api/auth/setup' : '/api/auth/login', body);
        root.hidden = true; root.innerHTML = '';
        resolve((await api('/api/auth/status')).user);
      } catch (err) { form.querySelector('#authError').textContent = err.message; btn.disabled = false; }
    });
  });
}
