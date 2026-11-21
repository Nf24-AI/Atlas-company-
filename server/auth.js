// Local authentication: one CEO account per installation, scrypt password hashing,
// opaque session tokens (only their SHA-256 is stored), HttpOnly SameSite=Strict cookie.
import crypto from 'node:crypto';
import {HttpError} from './http.js';

const SCRYPT = {N: 16384, r: 8, p: 1, keylen: 64};
export const SESSION_COOKIE = 'atlas_sid';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, {N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p});
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, {N: +N, r: +r, p: +p});
  return crypto.timingSafeEqual(expected, actual);
}

/** Password policy: length over complexity (NIST 800-63B style). */
export function checkPasswordPolicy(pw) {
  if (typeof pw !== 'string' || pw.length < 10) throw new HttpError(400, 'Password must be at least 10 characters');
  if (pw.length > 200) throw new HttpError(400, 'Password too long');
}

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

export function createSessions(db, {days = 7} = {}) {
  return {
    create(userId) {
      const token = crypto.randomBytes(32).toString('base64url');
      const now = new Date(), exp = new Date(now.getTime() + days * 864e5);
      db.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?,?,?,?,?)', sha256(token), userId, now.toISOString(), exp.toISOString(), now.toISOString());
      return {token, maxAge: days * 86400};
    },
    /** Returns the user for a valid, unexpired session token, else null. */
    resolve(token) {
      if (!token || token.length > 100) return null;
      const row = db.get('SELECT s.token_hash, s.expires_at, u.id, u.email, u.display_name, u.locale FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?', sha256(token));
      if (!row) return null;
      if (row.expires_at <= new Date().toISOString()) { db.run('DELETE FROM sessions WHERE token_hash = ?', row.token_hash); return null; }
      return {id: row.id, email: row.email, displayName: row.display_name, locale: row.locale};
    },
    destroy(token) { if (token) db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token)); },
    purgeExpired() { db.run('DELETE FROM sessions WHERE expires_at <= ?', new Date().toISOString()); },
  };
}
