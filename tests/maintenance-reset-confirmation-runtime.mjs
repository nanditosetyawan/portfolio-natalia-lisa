import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5202'
const cdpPort = 9362
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')

const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-reset-confirm-'))
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
  const vite = launch(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5202', '--strictPort'],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: 'https://mock-supabase.local',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'mock-publishable-key',
        VITE_SUPABASE_ANON_KEY: 'mock-anon-key'
      }
    }
  )
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1280,900', 'about:blank'
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  const page = await waitForPageTarget('about:blank')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeExceptions = []
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) {
      const req = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? req.reject(new Error(msg.error.message)) : req.resolve(msg.result)
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      runtimeExceptions.push(msg.params?.exceptionDetails?.exception?.description ?? msg.params?.exceptionDetails?.text ?? 'Unknown exception')
    }
  })

  const send = (method, params = {}) => {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)
    return res.result.value
  }
  const waitFor = async (conditionExpr, timeout = 10000) => {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(conditionExpr)) return
      await wait(80)
    }
    throw new Error(`Timed out waiting for: ${conditionExpr}`)
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      if (!window.sessionStorage.getItem('__resetConfirmMock')) {
        window.sessionStorage.setItem('__resetConfirmMock', JSON.stringify({ hasPublished: true, resetCalls: 0, failResetOnce: true }));
      }
      const __origFetch = window.fetch.bind(window);
      window.fetch = async (input, init = {}) => {
        const rawUrl = typeof input === 'string' ? input : input.url;
        if (!rawUrl.startsWith('https://mock-supabase.local')) return __origFetch(input, init);
        const state = JSON.parse(window.sessionStorage.getItem('__resetConfirmMock') || '{}');
        const p = new URL(rawUrl).pathname;
        const json = (payload, status = 200) => status === 204
          ? new Response(null, { status })
          : new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

        if (p.endsWith('/rest/v1/rpc/get_active_published_snapshot')) {
          if (!state.hasPublished) return json([]);
          return json([{
            id: '11111111-1111-4111-8111-111111111111',
            revision_number: 2,
            lock_version: 1,
            status: 'published',
            snapshot: null,
            base_revision_number: 1,
            created_by: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            published_at: new Date().toISOString(),
            source_draft_revision_id: '22222222-2222-4222-8222-222222222222',
            published_by: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            publish_note: 'live rev',
            publication_kind: 'publish',
            rollback_source_revision_id: null
          }]);
        }

        if (p.endsWith('/rest/v1/rpc/reset_site_to_default')) {
          if (state.failResetOnce) {
            state.failResetOnce = false;
            window.sessionStorage.setItem('__resetConfirmMock', JSON.stringify(state));
            return json({ message: 'Simulated network timeout during reset' }, 500);
          }
          state.resetCalls = (state.resetCalls || 0) + 1;
          state.hasPublished = false;
          window.sessionStorage.setItem('__resetConfirmMock', JSON.stringify(state));
          return json(null, 204);
        }

        if (p.endsWith('/rest/v1/admin_users')) {
          return json([{ user_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }]);
        }
        return json([]);
      };
    `
  })

  await send('Page.navigate', { url: `${baseUrl}/#/admin/login` })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)

  await evaluate(`(async () => {
    const authMod = await import('/src/stores/auth.ts');
    const clientMod = await import('/src/lib/supabaseClient.ts');
    const revMod = await import('/src/repositories/editorRevisionRepository.ts');
    const session = {
      access_token: 'mock-admin-jwt',
      refresh_token: 'mock-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'admin@test.invalid' }
    };
    const authStore = authMod.useAuthStore();
    authStore.$patch({ session, isAdmin: true, isInitialized: true, isLoading: false });
    if (clientMod.supabaseClient) {
      clientMod.supabaseClient.auth.getSession = async () => ({ data: { session }, error: null });
    }
    revMod.editorPublishRepository.getPublishedRevision = async () => {
      const state = JSON.parse(window.sessionStorage.getItem('__resetConfirmMock') || '{}');
      return state.hasPublished ? { revision_number: 2 } : null;
    };
    const router = (await import('/src/router/index.ts')).default;
    await router.push('/admin/maintenance');
    return true;
  })()`)

  await waitFor(`document.querySelector('.maintenance-card--reset') && document.querySelector('.maintenance-card--reset').disabled === false`)

  // Open modal and check warning text, a11y labels, and initial disabled confirm button
  await evaluate(`document.querySelector('.maintenance-card--reset').click()`)
  await waitFor(`Boolean(document.querySelector('#reset-title'))`)

  const modalInitial = await evaluate(`(() => {
    const dialog = document.querySelector('.maintenance-modal[role="dialog"]');
    const warning = document.querySelector('.reset-warning-text')?.textContent.trim() ?? '';
    const dangerItem = document.querySelector('.reset-feature-danger')?.textContent.trim() ?? '';
    const safeItems = [...document.querySelectorAll('.reset-features-list li:not(.reset-feature-danger)')].map((el) => el.textContent.trim());
    const input = document.querySelector('#reset-confirm-input');
    const label = document.querySelector('label[for="reset-confirm-input"]')?.textContent.trim() ?? '';
    const dangerBtn = document.querySelector('.btn-danger');
    dangerBtn?.click();
    const state = JSON.parse(window.sessionStorage.getItem('__resetConfirmMock') || '{}');
    return {
      title: document.querySelector('#reset-title')?.textContent.trim() ?? '',
      warningMentionsHistory: /permanently erase all Publish History/i.test(warning),
      dangerMentionsRollback: /Publish History and Rollback versions will be permanently deleted/i.test(dangerItem) && /cannot be restored via Rollback/i.test(dangerItem),
      safeCount: safeItems.length,
      hasLabelAndAria: Boolean(label) && Boolean(input?.getAttribute('aria-label')),
      btnDisabledInitially: Boolean(dangerBtn?.disabled),
      dialogFocused: document.activeElement === dialog,
      rpcCallsAfterDisabledClick: state.resetCalls
    };
  })()`)

  assert(modalInitial.title === 'Reset Published Site', `Unexpected modal title: ${JSON.stringify(modalInitial)}`)
  assert(modalInitial.warningMentionsHistory && modalInitial.dangerMentionsRollback, `Missing explicit Publish History deletion warning: ${JSON.stringify(modalInitial)}`)
  assert(modalInitial.safeCount === 2, `Expected Drafts/Favorites & Media/Certificates items preserved: ${JSON.stringify(modalInitial)}`)
  assert(modalInitial.hasLabelAndAria, `Reset confirmation input missing label/aria-label: ${JSON.stringify(modalInitial)}`)
  assert(modalInitial.btnDisabledInitially && modalInitial.rpcCallsAfterDisabledClick === 0, `Reset button must start disabled without calling RPC: ${JSON.stringify(modalInitial)}`)

  // Partial or mismatched word must keep confirm disabled
  await evaluate(`(() => {
    const input = document.querySelector('#reset-confirm-input');
    input.value = 'RESE';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`)
  await wait(30)
  const partialDisabled = await evaluate(`document.querySelector('.btn-danger').disabled`)
  assert(partialDisabled === true, 'Partial text RESE must keep Reset button disabled')

  // Escape closes modal and clears typed text when reopened
  await evaluate(`document.querySelector('.maintenance-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await waitFor(`!document.querySelector('#reset-title')`)
  await evaluate(`document.querySelector('.maintenance-card--reset').click()`)
  await waitFor(`Boolean(document.querySelector('#reset-confirm-input'))`)
  const reopenedState = await evaluate(`({
    value: document.querySelector('#reset-confirm-input').value,
    disabled: document.querySelector('.btn-danger').disabled
  })`)
  assert(reopenedState.value === '' && reopenedState.disabled === true, `Reopening Reset modal retained stale confirmation text: ${JSON.stringify(reopenedState)}`)

  // Capture screenshot if CAPTURE_MODAL_PATH is explicitly requested
  if (process.env.CAPTURE_MODAL_PATH) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const { writeFile } = await import('node:fs/promises')
    await writeFile(process.env.CAPTURE_MODAL_PATH, Buffer.from(shot.data, 'base64'))
  }

  // Case-insensitive RESET enables confirm button, handles first simulated RPC error safely, then succeeds on second click
  await evaluate(`(() => {
    const input = document.querySelector('#reset-confirm-input');
    input.value = 'RESET';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`)
  await waitFor(`document.querySelector('.btn-danger').disabled === false`)
  await evaluate(`document.querySelector('.btn-danger').click()`)
  await waitFor(`Boolean(document.querySelector('.maintenance-error[role="alert"]'))`)

  const afterFailedRpc = await evaluate(`({
    errorText: document.querySelector('.maintenance-error[role="alert"]')?.textContent.trim() ?? '',
    modalStillOpen: Boolean(document.querySelector('#reset-title')),
    calls: JSON.parse(window.sessionStorage.getItem('__resetConfirmMock') || '{}').resetCalls
  })`)
  assert(afterFailedRpc.modalStillOpen && /Reset failed:/i.test(afterFailedRpc.errorText) && afterFailedRpc.calls === 0, `Failed reset RPC did not keep modal recoverable: ${JSON.stringify(afterFailedRpc)}`)

  // Second click executes RPC and completes reload cleanly
  await evaluate(`document.querySelector('.btn-danger').click()`)
  const started = Date.now()
  let postResetState = null
  while (Date.now() - started < 10000) {
    try {
      const state = await evaluate(`JSON.parse(window.sessionStorage.getItem('__resetConfirmMock') || '{}')`)
      if (state.resetCalls === 1 && state.hasPublished === false) {
        postResetState = state
        break
      }
    } catch {}
    await wait(80)
  }
  assert(postResetState?.resetCalls === 1 && postResetState?.hasPublished === false, `Confirmed Reset did not invoke reset_site_to_default RPC: ${JSON.stringify(postResetState)}`)

  assert(runtimeExceptions.length === 0, `Uncaught runtime exceptions: ${runtimeExceptions.join(' | ')}`)
  assert(!browserErrors.includes('FATAL'), `Browser fatal error: ${browserErrors}`)
  const realViteErrors = viteErrors
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .filter((l) => !l.includes('(client)') && !l.includes('Factory Reset Error') && !l.includes('Simulated network timeout'))
    .join('\n')
  assert(!/error/i.test(realViteErrors), `Vite stderr error: ${realViteErrors}`)

  console.log(JSON.stringify({
    status: 'PASS',
    modalInitial,
    reopenedState,
    afterFailedRpc,
    postResetState
  }, null, 2))
} finally {
  try { await send('Browser.close') } catch {}
  socket?.close()
  stopChildren()
  await wait(250)
  await rm(profilePath, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 }).catch(() => {})
}
