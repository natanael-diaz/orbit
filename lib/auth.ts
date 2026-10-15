import { env } from 'cloudflare:workers';
import { db } from './store';
import { requireIdentity, SESSION_SECONDS } from './accounts';
export const COOKIE = 'orbit_session';
export function sessionToken(request: Request) {
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(COOKIE + '='))
    ?.slice(COOKIE.length + 1);
}
export const currentUser = (request: Request) => requireIdentity(db(), sessionToken(request));
export const setupToken = () => (env.ORBIT_SETUP_TOKEN || '').trim();
export function sessionCookie(request: Request, token: string, clear = false) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}
