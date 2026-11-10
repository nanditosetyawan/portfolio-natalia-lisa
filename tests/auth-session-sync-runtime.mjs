import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5198'
const cdpPort = 9358
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-auth-sync-test-'))
const children = []
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { if ((await fetch(url)).ok) return } catch {}
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForPageTarget(urlPart, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()
      const page = targets.find((target) => target.type === 'page' && target.url.includes(urlPart))
      if (page) return page
    } catch {}
    await wait(100)
  }
  throw new Error(`Timed out waiting for Chromium page target: ${urlPart}`)
}

function launch(command, args, options = {}) {
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options })
  children.push(child)
  return child
}

function stopChildren() {
  for (const child of children.reverse()) if (!child.killed) child.kill()
}

process.on('exit', stopChildren)
process.on('SIGINT', () => { stopChildren(); process.exit(130) })

let socket
try {
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { cwd: projectRoot, env: { ...process.env } })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1280,800', `${baseUrl}/#/admin/login`
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  const page = await waitForPageTarget('127.0.0.1:5198')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })

  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) {
      const req = pending.get(msg.id); pending.delete(msg.id)
      msg.error ? req.reject(new Error(msg.error.message)) : req.resolve(msg.result)
    }
  })
  const send = (method, params = {}) => { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })) }
  const evaluate = async (expression) => { const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text); return res.result.value }

  await send('Runtime.enable')
  await send('Page.enable')
  for (let i = 0; i < 100; i += 1) {
    try {
      if (await evaluate(`Boolean(document.querySelector('#app')?.__vue_app__)`)) break
    } catch {}
    await wait(100)
  }

  const result = await evaluate(`(async () => {
    const rest = await import('/src/lib/supabaseRest.ts');
    const clientMod = await import('/src/lib/supabaseClient.ts');
    const authStoreMod = await import('/src/stores/auth.ts');

    const supabaseAuth = clientMod.supabaseClient.auth;
    const origFetch = window.fetch.bind(window);
    const sentAuthHeaders = [];
    let forceStatusByToken = {};
    let refreshCount = 0;
    let nextRefreshResponse = null;

    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/rest/v1/')) {
        const bearer = init.headers?.Authorization ?? init.headers?.authorization ?? '';
        sentAuthHeaders.push(bearer);
        const token = bearer.replace(/^Bearer\\s+/, '');
        if (url.includes('admin_memberships')) {
          return new Response(JSON.stringify([{ user_id: 'admin-user-1' }]), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        const status = forceStatusByToken[token] ?? 200;
        return new Response(status === 200 ? JSON.stringify([{ ok: true, token }]) : 'unauthorized', { status, headers: { 'Content-Type': 'application/json' } });
      }
      return origFetch(input, init);
    };

    const sessionOf = (token, userId = 'admin-user-1') => ({
      access_token: token,
      refresh_token: 'refresh-' + token,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: userId, email: 'admin@example.com' }
    });

    supabaseAuth.getSession = async () => ({ data: { session: sessionOf('jwt-initial') }, error: null });
    supabaseAuth.refreshSession = async () => {
      refreshCount += 1;
      const res = nextRefreshResponse;
      if (res?.data?.session) {
        await supabaseAuth._notifyAllSubscribers('TOKEN_REFRESHED', res.data.session);
      }
      return res;
    };
    supabaseAuth.signInWithPassword = async () => ({ data: { session: sessionOf('jwt-login'), user: sessionOf('jwt-login').user }, error: null });
    supabaseAuth.signUp = async () => ({ data: { session: sessionOf('jwt-bootstrap'), user: sessionOf('jwt-bootstrap').user }, error: null });
    supabaseAuth.signOut = async () => ({ error: null });

    const store = authStoreMod.useAuthStore();

    // 1. Direct login() on /admin/login (without prior initialize()) binds session sync for later refreshes.
    await store.login('admin@example.com', 'secret');
    await supabaseAuth._notifyAllSubscribers('TOKEN_REFRESHED', sessionOf('jwt-after-direct-login'));
    const directLoginSyncOk = store.session?.access_token === 'jwt-after-direct-login' && store.isAdmin;

    // 2. initialize() flow restores session & preserves subscription idempotently.
    store.$patch({ isInitialized: false, isLoading: false, session: null, isAdmin: false });
    await store.initialize();
    const initialAuth = store.isAdmin && store.session?.access_token === 'jwt-initial';

    // 3. INITIAL_SESSION(null) must not wipe test $patch / existing admin state.
    store.$patch({ isAdmin: true });
    await supabaseAuth._notifyAllSubscribers('INITIAL_SESSION', null);
    const preservedOnInitialNull = store.isAdmin && store.session?.access_token === 'jwt-initial';

    // 4. Background TOKEN_REFRESHED syncs both store.session and REST bearer token.
    await supabaseAuth._notifyAllSubscribers('TOKEN_REFRESHED', sessionOf('jwt-refreshed-1'));
    await rest.supabaseTableRows('site_revisions');
    const refreshedSyncOk = store.session?.access_token === 'jwt-refreshed-1' && store.isAdmin && sentAuthHeaders.at(-1) === 'Bearer jwt-refreshed-1';

    // 5. Stale token hits 401 -> 3 concurrent requests share ONE refreshSession call and retry with new token.
    forceStatusByToken = { 'jwt-refreshed-1': 401, 'jwt-refreshed-2': 200 };
    nextRefreshResponse = { data: { session: sessionOf('jwt-refreshed-2'), user: sessionOf('jwt-refreshed-2').user }, error: null };
    const concurrentBefore = sentAuthHeaders.length;
    const parallel = await Promise.all([
      rest.supabaseTableRows('site_revisions'),
      rest.supabaseTableRows('site_revisions'),
      rest.supabaseTableRows('site_revisions')
    ]);
    const deduplicatedRecoveryOk = refreshCount === 1
      && parallel.every((rows) => rows[0]?.ok === true && rows[0]?.token === 'jwt-refreshed-2')
      && store.session?.access_token === 'jwt-refreshed-2'
      && sentAuthHeaders.slice(concurrentBefore).filter((h) => h === 'Bearer jwt-refreshed-2').length === 3;

    // 6. Retry cap: if server STILL returns 401 after refresh, throw 401 after at most 1 retry.
    forceStatusByToken = { 'jwt-refreshed-2': 401, 'jwt-refreshed-3': 401 };
    nextRefreshResponse = { data: { session: sessionOf('jwt-refreshed-3'), user: sessionOf('jwt-refreshed-3').user }, error: null };
    let failedWith401 = false;
    try {
      await rest.supabaseTableRows('site_revisions');
    } catch (err) {
      failedWith401 = String(err?.message ?? err).includes('(401)');
    }
    const attemptsForToken3 = sentAuthHeaders.filter((h) => h === 'Bearer jwt-refreshed-3').length;

    // 7. SIGNED_OUT clears access token & admin state; anonymous 401 must NOT trigger refreshSession.
    await supabaseAuth._notifyAllSubscribers('SIGNED_OUT', null);
    const clearedOnSignOut = store.session === null && store.isAdmin === false;
    const anonKeyBearer = sentAuthHeaders.length;
    const refreshBeforeAnon = refreshCount;
    let anon401Failed = false;
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/rest/v1/')) {
        sentAuthHeaders.push(init.headers?.Authorization ?? '');
        return new Response('anon denied', { status: 401 });
      }
      return origFetch(input, init);
    };
    try { await rest.supabaseTableRows('messages'); } catch { anon401Failed = true; }
    const anonSkippedRefresh = anon401Failed && refreshCount === refreshBeforeAnon && !sentAuthHeaders[anonKeyBearer].includes('jwt-');

    // 8. bootstrap() refreshes authorization after bootstrap_first_admin and rejects only when DB closes bootstrap.
    let bootstrapOpen = true;
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('rpc/bootstrap_first_admin')) {
        return new Response(JSON.stringify(bootstrapOpen), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('admin_memberships')) {
        const rows = bootstrapOpen ? [{ user_id: 'admin-user-1' }] : [];
        return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return origFetch(input, init);
    };
    await store.bootstrap('first@example.com', 'Password123!');
    const bootstrapOpenOk = store.isAdmin === true && store.session?.access_token === 'jwt-bootstrap';
    bootstrapOpen = false;
    let bootstrapClosedRejected = false;
    try {
      await store.bootstrap('second@example.com', 'Password123!');
    } catch (err) {
      bootstrapClosedRejected = String(err?.message ?? err).includes('closed') && store.session === null && !store.isAdmin;
    }

    window.fetch = origFetch;
    return {
      initialAuth,
      preservedOnInitialNull,
      refreshedSyncOk,
      deduplicatedRecoveryOk,
      failedWith401,
      attemptsForToken3,
      clearedOnSignOut,
      anonSkippedRefresh,
      directLoginSyncOk,
      bootstrapOpenOk,
      bootstrapClosedRejected,
      refreshCount
    };
  })()`)

  console.log(JSON.stringify(result, null, 2))
  assert(result.initialAuth, 'Initial restoreSession failed')
  assert(result.preservedOnInitialNull, 'INITIAL_SESSION(null) wiped existing state')
  assert(result.refreshedSyncOk, 'TOKEN_REFRESHED did not sync auth store and REST header')
  assert(result.deduplicatedRecoveryOk, 'Concurrent 401 recovery failed or called refreshSession more than once')
  assert(result.failedWith401 && result.attemptsForToken3 === 1, '401 retry cap failed')
  assert(result.clearedOnSignOut, 'SIGNED_OUT did not clear session and admin state')
  assert(result.anonSkippedRefresh, 'Anonymous 401 triggered refreshSession or leaked JWT')
  assert(result.directLoginSyncOk, 'Direct login() path did not bind session sync listener')
  assert(result.bootstrapOpenOk && result.bootstrapClosedRejected, 'bootstrap() authorization check failed')
  if (viteErrors.trim()) throw new Error(`Vite stderr: ${viteErrors}`)
  if (browserErrors.trim()) console.warn(browserErrors)
  console.log(JSON.stringify({ status: 'PASS', scope: 'auth-session-sync-runtime' }))
} finally {
  socket?.close()
  stopChildren()
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}
