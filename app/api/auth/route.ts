import { z } from 'zod';
import { db } from '../../../lib/store';
import {
  AccessError,
  Email,
  UserInput,
  digest,
  equal,
  login,
  setupAdmin,
  throttle,
} from '../../../lib/accounts';
import { currentUser, sessionCookie, sessionToken, setupToken } from '../../../lib/auth';
import { body, failure, json } from '../../../lib/http';

export async function GET(request: Request) {
  try {
    const initialized = !!(await db().prepare('SELECT id FROM users LIMIT 1').first());
    let user = null;
    try {
      user = await currentUser(request);
    } catch (e) {
      if (!(e instanceof AccessError)) throw e;
    }
    return json({ initialized, setupAvailable: !initialized && setupToken().length >= 32, user });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const input = await body(request);
    if (input.action === 'logout') {
      const token = sessionToken(request);
      if (token)
        await db()
          .prepare('DELETE FROM sessions WHERE token_hash=?')
          .bind(await digest(token))
          .run();
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request, '', true) });
    }
    if (!['login', 'setup'].includes(input.action)) throw new AccessError('Aksi tidak dikenal.');
    const email = Email.parse(input.email);
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    await throttle(db(), [await digest('ip:' + ip), await digest('email:' + email)]);
    let result;
    if (input.action === 'setup') {
      const configured = setupToken();
      const provided = z.string().max(256).parse(input.setupToken);
      if (configured.length < 32 || !equal(await digest(provided), await digest(configured)))
        throw new AccessError('Setup token tidak valid atau belum dikonfigurasi.', 403);
      result = await setupAdmin(db(), UserInput.parse({ ...input, role: 'admin' }));
    } else {
      result = await login(db(), email, z.string().min(1).max(128).parse(input.password));
    }
    return json({ user: result.user }, 200, { 'Set-Cookie': sessionCookie(request, result.token) });
  } catch (e) {
    return failure(e);
  }
}
