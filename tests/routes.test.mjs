import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './d1-fixture.mjs';
import { addUser, UserInput, grantCredit, GrantInput, balance } from '../lib/accounts.ts';
const environment = {
  ORBIT_SETUP_TOKEN: 'synthetic-setup-token-not-a-real-secret-1234',
  X_BEARER_TOKEN: 'synthetic',
  OPENAI_API_KEY: 'synthetic',
};
globalThis.__orbitTestEnv = environment;
const auth = await import('../app/api/auth/route.ts');
const admin = await import('../app/api/admin/route.ts');
const desk = await import('../app/api/desk/route.ts');
function request(path, payload, cookie = '', origin = 'https://orbit.test') {
  return new Request(
    'https://orbit.test' + path,
    payload
      ? {
          method: 'POST',
          headers: { origin, cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      : { headers: { cookie } },
  );
}
const credentials = {
  email: 'admin@example.test',
  password: 'synthetic-test-password',
  name: 'Admin',
};
const cookie = (response) => response.headers.get('set-cookie')?.split(';')[0] || '';

test('API integration: setup, roles, user isolation, paid gating before fetch, credits and logout', async () => {
  const { database } = fixture();
  environment.DB = database;
  assert.equal((await desk.GET(request('/api/desk'))).status, 401);
  assert.equal((await admin.GET(request('/api/admin'))).status, 401);
  assert.equal(
    (
      await auth.POST(
        request('/api/auth', { action: 'setup', ...credentials, setupToken: 'wrong' }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await auth.POST(
        request(
          '/api/auth',
          { action: 'setup', ...credentials, setupToken: environment.ORBIT_SETUP_TOKEN },
          '',
          'https://evil.test',
        ),
      )
    ).status,
    403,
  );
  const initial = await auth.POST(
    request('/api/auth', {
      action: 'setup',
      ...credentials,
      setupToken: environment.ORBIT_SETUP_TOKEN,
    }),
  );
  assert.equal(initial.status, 200);
  assert.match(initial.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.match(initial.headers.get('set-cookie'), /Secure/);
  const adminCookie = cookie(initial),
    actor = (await initial.json()).user;
  assert.equal(
    (
      await auth.POST(
        request('/api/auth', {
          action: 'setup',
          ...credentials,
          setupToken: environment.ORBIT_SETUP_TOKEN,
        }),
      )
    ).status,
    409,
  );
  assert.equal((await auth.GET(request('/api/auth'))).status, 200);
  const userId = await addUser(
    database,
    actor,
    UserInput.parse({
      email: 'user@example.test',
      name: 'User',
      password: 'synthetic-user-password',
      role: 'user',
    }),
  );
  const logged = await auth.POST(
    request('/api/auth', {
      action: 'login',
      email: 'user@example.test',
      password: 'synthetic-user-password',
    }),
  );
  assert.equal(logged.status, 200);
  const userCookie = cookie(logged);
  assert.equal((await admin.GET(request('/api/admin', null, userCookie))).status, 403);
  assert.equal(
    (await admin.POST(request('/api/admin', { action: 'grantCredit' }, userCookie))).status,
    403,
  );
  const demo = await desk.POST(request('/api/desk', { action: 'demo' }, userCookie));
  assert.equal(demo.status, 200);
  const runId = (await demo.json()).id;
  assert.equal((await desk.GET(request('/api/desk', null, adminCookie))).status, 200);
  assert.equal(
    (await (await desk.GET(request('/api/desk', null, adminCookie))).json()).runs.length,
    0,
  );
  assert.equal(
    (
      await desk.POST(
        request(
          '/api/desk',
          { action: 'analyze', id: runId, language: 'en', niche: 'VTuber' },
          adminCookie,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (await desk.POST(request('/api/desk', { action: 'deleteRun', id: runId }, adminCookie))).status,
    200,
  );
  assert.equal(
    (await (await desk.GET(request('/api/desk', null, userCookie))).json()).runs.length,
    1,
  );
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error('No provider calls allowed');
  };
  try {
    const denied = await desk.POST(
      request(
        '/api/desk',
        {
          action: 'collect',
          mode: 'topics',
          target: '',
          niche: 'VTuber',
          language: 'en',
          query: '',
          postLimit: 10,
        },
        userCookie,
      ),
    );
    assert.equal(denied.status, 402);
    assert.equal(calls, 0);
    const imported = await desk.POST(
      request(
        '/api/desk',
        {
          action: 'import',
          data: {
            profile: null,
            posts: [
              {
                id: '1',
                text: 'Test',
                author: 'test',
                created_at: '2026-10-01T00:00:00Z',
                kind: 'original',
                url: '',
                metrics: { likes: null, replies: null, reposts: null, quotes: null, views: null },
                media: [],
                references: [],
              },
            ],
          },
        },
        userCookie,
      ),
    );
    assert.equal(imported.status, 200);
    const importedId = (await imported.json()).id;
    const deniedAI = await desk.POST(
      request(
        '/api/desk',
        { action: 'analyze', id: importedId, language: 'en', niche: 'VTuber' },
        userCookie,
      ),
    );
    assert.equal(deniedAI.status, 402);
    assert.equal(calls, 0);
    const grant = GrantInput.parse({
      id: crypto.randomUUID(),
      userId,
      amount: 3,
      note: 'API test grant',
    });
    assert.equal(
      (await admin.POST(request('/api/admin', { action: 'grantCredit', ...grant }, adminCookie)))
        .status,
      200,
    );
    assert.equal(await balance(database, userId), 3);
    for (const mode of ['topics', 'replies', 'leads', 'connections']) {
      const empty = await desk.POST(
        request(
          '/api/desk',
          {
            action: 'collect',
            mode,
            target: '',
            niche: '  ',
            query: ' ',
            language: 'en',
            postLimit: 10,
          },
          userCookie,
        ),
      );
      assert.equal(empty.status, 400);
      assert.match((await empty.json()).error, /Isi niche/);
      assert.equal(calls, 0);
      assert.equal(await balance(database, userId), 3);
    }
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ detail: 'synthetic rejection' }, { status: 429 });
    };
    const rejected = await desk.POST(
      request(
        '/api/desk',
        {
          action: 'collect',
          mode: 'topics',
          target: '',
          niche: 'VTuber',
          language: 'en',
          query: '',
          postLimit: 10,
        },
        userCookie,
      ),
    );
    assert.equal(rejected.status, 400);
    assert.equal(await balance(database, userId), 3);
    globalThis.fetch = async () => {
      calls++;
      throw Error('synthetic timeout');
    };
    const timeout = await desk.POST(
      request(
        '/api/desk',
        {
          action: 'collect',
          mode: 'topics',
          target: '',
          niche: 'VTuber',
          language: 'en',
          query: '',
          postLimit: 10,
        },
        userCookie,
      ),
    );
    assert.equal(timeout.status, 400);
    assert.equal(await balance(database, userId), 2.85);
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.ok(String(url).startsWith('https://api.x.com/2/'));
      assert.equal(new URL(url).searchParams.get('query'), 'SaaS lang:en -is:retweet');
      assert.equal(options.method, undefined); // X remains GET-only.
      return Response.json({
        data: [
          {
            id: '123',
            author_id: 'u1',
            text: 'Synthetic post',
            created_at: '2026-10-01T00:00:00Z',
          },
        ],
        includes: { users: [{ id: 'u1', username: 'creator' }] },
      });
    };
    const collected = await desk.POST(
      request(
        '/api/desk',
        {
          action: 'collect',
          mode: 'topics',
          target: '',
          niche: '',
          language: 'en',
          query: 'SaaS lang:en -is:retweet',
          postLimit: 10,
        },
        userCookie,
      ),
    );
    assert.equal(collected.status, 200);
    assert.equal(await balance(database, userId), 2.835);
    const collectedId = (await collected.json()).id;
    const analysis = {
      summary: 'Synthetic',
      positioning: '',
      brand: '',
      feel: '',
      reply_pattern: '',
      repost_pattern: '',
      evidence_ids: ['123'],
      posts: [],
      topics: [],
      candidates: [],
    };
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      const body = JSON.parse(options.body);
      assert.equal(body.messages.length, 2);
      assert.equal(body.messages[0].role, 'system');
      assert.match(body.messages[0].content, /general-purpose/);
      assert.match(body.messages[0].content, /Active lead preset: General/);
      assert.equal(body.messages[1].role, 'user');
      assert.ok(body.messages[1].content.includes('SaaS'));
      assert.ok(!body.messages[1].content.includes('media'));
      return Response.json({
        choices: [{ message: { content: JSON.stringify(analysis) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 10 },
      });
    };
    const analyzed = await desk.POST(
      request(
        '/api/desk',
        { action: 'analyze', id: collectedId, language: 'en', niche: 'SaaS' },
        userCookie,
      ),
    );
    assert.equal(analyzed.status, 200);
    assert.equal(await balance(database, userId), 2.83488);
    const beforeCached = calls;
    const cached = await desk.POST(
      request(
        '/api/desk',
        { action: 'analyze', id: collectedId, language: 'en', niche: 'VTuber' },
        userCookie,
      ),
    );
    assert.equal(cached.status, 200);
    assert.equal((await cached.json()).cached, true);
    assert.equal(calls, beforeCached);
    assert.equal(await balance(database, userId), 2.83488);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(
    (await desk.POST(request('/api/desk', { action: 'demo' }, userCookie, 'http://orbit.test')))
      .status,
    403,
  );
  const logout = await auth.POST(request('/api/auth', { action: 'logout' }, userCookie));
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await desk.GET(request('/api/desk', null, userCookie))).status, 401);
  const summary = await admin.GET(request('/api/admin', null, adminCookie));
  assert.equal(summary.status, 200);
  const text = JSON.stringify(await summary.json());
  assert.ok(!text.includes('password_hash'));
  assert.ok(!text.includes(environment.ORBIT_SETUP_TOKEN));
  assert.ok(!text.includes('token_hash'));
});

test('desk credit response is read-only, owner-scoped and excludes admin/provider credentials', async () => {
  const { database, sqlite } = fixture();
  environment.DB = database;
  const initial = await auth.POST(
    request('/api/auth', {
      action: 'setup',
      ...credentials,
      setupToken: environment.ORBIT_SETUP_TOKEN,
    }),
  );
  assert.equal(initial.status, 200);
  const actor = (await initial.json()).user;
  const userId = await addUser(
    database,
    actor,
    UserInput.parse({
      email: 'viewer@example.test',
      name: 'Viewer',
      password: 'synthetic-viewer-password',
      role: 'user',
    }),
  );
  await grantCredit(
    database,
    actor,
    GrantInput.parse({
      id: crypto.randomUUID(),
      userId: actor.id,
      amount: 100,
      note: 'Private admin grant',
    }),
  );
  await grantCredit(
    database,
    actor,
    GrantInput.parse({ id: crypto.randomUUID(), userId, amount: 3, note: 'Welcome credit' }),
  );
  const logged = await auth.POST(
    request('/api/auth', {
      action: 'login',
      email: 'viewer@example.test',
      password: 'synthetic-viewer-password',
    }),
  );
  const viewerCookie = cookie(logged);
  const response = await desk.GET(request('/api/desk?userId=' + actor.id, null, viewerCookie));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const own = await response.json();
  assert.equal(own.user.id, userId);
  assert.equal(own.balance, 3);
  assert.equal(own.credit.balance, 3);
  assert.equal(own.credit.granted, 3);
  assert.equal(own.credit.spent, 0);
  assert.equal(own.credit.reserved, 0);
  assert.equal(own.credit.historical, 0);
  assert.equal(own.credit.grants.length, 1);
  assert.equal(own.credit.grants[0].note, 'Welcome credit');
  const text = JSON.stringify(own);
  for (const hidden of [
    'Private admin grant',
    actor.email,
    'password_hash',
    'token_hash',
    environment.ORBIT_SETUP_TOKEN,
    environment.OPENAI_API_KEY,
  ])
    assert.ok(!text.includes(hidden));
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM ledger').get().n, 0);
  assert.equal(
    (await desk.POST(request('/api/desk', { action: 'grantCredit', amount: 100 }, viewerCookie)))
      .status,
    400,
  );
  assert.equal(await balance(database, userId), 3);
});
