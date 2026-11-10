import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5199'
const cdpPort = 9359
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')

const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-guest-cert-refresh-'))
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
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5199', '--strictPort'],
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
  const waitFor = async (conditionExpr, timeout = 8000) => {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(conditionExpr)) return
      await wait(60)
    }
    const diag = await evaluate(`(() => {
      const pinia = document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$pinia;
      const site = pinia?._s?.get('site');
      return {
        hash: location.hash,
        status: site?.publishedRuntimeStatus,
        error: site?.errorMessage,
        source: site?.guestRuntimeSource,
        certs: document.querySelectorAll('#certificate .certificate-card').length,
        requests: window.__guestCertMock?.requests
      };
    })()`).catch(() => null)
    throw new Error(`Timed out waiting for: ${conditionExpr} | diag=${JSON.stringify(diag)} | exceptions=${JSON.stringify(runtimeExceptions)}`)
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      const __origFetch = window.fetch.bind(window);
      const mockState = {
        mode: 'empty',
        failRpc: false,
        requests: [],
        publishedRevisions: {}
      };
      window.__guestCertMock = mockState;
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
        if (url.startsWith('https://mock-supabase.local/')) {
          mockState.requests.push(url);
          if (url.includes('/rest/v1/rpc/get_active_published_snapshot')) {
            if (mockState.failRpc) {
              return new Response(JSON.stringify({ message: 'Simulated outage from upstream db' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            const rev = mockState.publishedRevisions[mockState.mode] ?? null;
            return new Response(JSON.stringify(rev ? [rev] : []), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          if (url.includes('/rest/v1/certificates')) {
            return new Response(JSON.stringify([
              { id: 'admin-only-cert', title: 'Sertifikat Dapur Belum Publish', date: '2026', description: 'Secret', order_index: 0, active: true }
            ]), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
          if (url.includes('/rest/v1/certificate_images')) {
            return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (url.includes('/rest/v1/media_assets')) {
            return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return __origFetch(input, init);
      };
    `
  })

  // Navigate to about/root? First open #/admin/login so we can build canonical EditorSnapshot mocks cleanly
  await send('Page.navigate', { url: `${baseUrl}/#/admin/login` })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)

  // Prepare Published Revision 1 (5 certs) and Published Revision 2 (replaces pub-5 with pub-6)
  await evaluate(`(async () => {
    const snapshotMod = await import('/src/editor/editorSnapshot.ts');
    const siteMod = await import('/src/data/default/site.ts');
    const base = snapshotMod.createEditorSnapshot(siteMod.createDefaultSiteSnapshot());
    base.media.references = base.media.references.map((ref) => ({
      ...ref,
      bucket: 'portfolio-media',
      storagePath: 'published/test/' + ref.assetId + '.webp',
      uri: 'published/test/' + ref.assetId + '.webp'
    }));

    const makeCard = (id, title, order) => ({
      id,
      title,
      date: '2026',
      description: 'Published desc ' + title,
      order,
      active: true,
      thumbnail: {
        id: id + '-thumb',
        source: 'https://mock-supabase.local/storage/v1/object/public/portfolio-media/published/certificates/' + id + '.webp',
        placeholder: { label: 'Thumb', hint: 'Admin', color: '#333', opacity: 1 },
        image: { objectPosition: '50% 50%' }
      },
      detailImages: [{
        id: id + '-detail-1',
        source: 'https://mock-supabase.local/storage/v1/object/public/portfolio-media/published/certificates/' + id + '-detail.webp',
        placeholder: { label: 'Detail', hint: 'Admin', color: '#333', opacity: 1 },
        image: { objectPosition: '50% 50%' }
      }]
    });

    const rev1Snap = structuredClone(base);
    rev1Snap.certificateCards = [
      makeCard('pub-1', 'Published Cert 1', 0),
      makeCard('pub-2', 'Published Cert 2', 1),
      makeCard('pub-3', 'Published Cert 3', 2),
      makeCard('pub-4', 'Published Cert 4', 3),
      makeCard('pub-5', 'Published Cert 5 (Still Live)', 4)
    ];

    const rev2Snap = structuredClone(base);
    rev2Snap.certificateCards = [
      makeCard('pub-1', 'Published Cert 1', 0),
      makeCard('pub-2', 'Published Cert 2', 1),
      makeCard('pub-3', 'Published Cert 3', 2),
      makeCard('pub-4', 'Published Cert 4', 3),
      makeCard('pub-6', 'Published Cert 6 (Newly Published)', 4)
    ];

    const now = new Date().toISOString();
    window.__guestCertMock.publishedRevisions.rev1 = {
      id: '11111111-1111-4111-8111-111111111111',
      revision_number: 1,
      lock_version: 1,
      status: 'published',
      snapshot: rev1Snap,
      base_revision_number: null,
      created_by: 'admin',
      created_at: now,
      updated_at: now,
      published_at: now,
      source_draft_revision_id: null,
      published_by: 'admin',
      publish_note: 'Rev 1',
      publication_kind: 'publish',
      rollback_source_revision_id: null
    };
    window.__guestCertMock.publishedRevisions.rev2 = {
      id: '22222222-2222-4222-8222-222222222222',
      revision_number: 2,
      lock_version: 1,
      status: 'published',
      snapshot: rev2Snap,
      base_revision_number: 1,
      created_by: 'admin',
      created_at: now,
      updated_at: now,
      published_at: now,
      source_draft_revision_id: null,
      published_by: 'admin',
      publish_note: 'Rev 2',
      publication_kind: 'publish',
      rollback_source_revision_id: null
    };
  })()`)

  // Scenario A: 0 Published revisions (default source) while raw certificates DB has admin-only row
  await evaluate(`(async () => {
    window.__guestCertMock.mode = 'empty';
    window.__guestCertMock.requests.length = 0;
    const router = (await import('/src/router/index.ts')).default;
    await router.push('/');
  })()`)
  await waitFor(`document.querySelectorAll('#certificate .certificate-card').length === 2`)
  const scenarioAInitial = await evaluate(`({
    ids: [...document.querySelectorAll('#certificate .certificate-card')].map((el) => el.dataset.certificateId),
    requests: [...window.__guestCertMock.requests]
  })`)
  assert(
    JSON.stringify(scenarioAInitial.ids) === JSON.stringify(['cert-a', 'cert-b']),
    `Scenario A initial mismatch: ${JSON.stringify(scenarioAInitial)}`
  )
  assert(
    !scenarioAInitial.requests.some((u) => /\/rest\/v1\/(certificates|certificate_images|media_assets)/.test(u)),
    `Scenario A initial leaked raw tables: ${JSON.stringify(scenarioAInitial.requests)}`
  )

  // Click Refresh button while 0 Published revisions exist
  await evaluate(`(() => {
    window.__guestCertMock.requests.length = 0;
    document.querySelector('#certificate .refresh-btn').click();
  })()`)
  await waitFor(`!document.querySelector('#certificate .refresh-btn').disabled && window.__guestCertMock.requests.some((u) => u.includes('get_active_published_snapshot'))`)
  const scenarioARefresh = await evaluate(`({
    ids: [...document.querySelectorAll('#certificate .certificate-card')].map((el) => el.dataset.certificateId),
    titles: [...document.querySelectorAll('#certificate .info-title')].map((el) => el.textContent.trim()),
    requests: [...window.__guestCertMock.requests]
  })`)
  assert(
    JSON.stringify(scenarioARefresh.ids) === JSON.stringify(['cert-a', 'cert-b']) &&
      !scenarioARefresh.titles.some((t) => t.includes('Sertifikat Dapur')),
    `Scenario A refresh leaked admin-only certificates: ${JSON.stringify(scenarioARefresh)}`
  )
  assert(
    !scenarioARefresh.requests.some((u) => /\/rest\/v1\/(certificates|certificate_images|media_assets)/.test(u)),
    `Scenario A refresh queried raw tables: ${JSON.stringify(scenarioARefresh.requests)}`
  )

  // Scenario B: Published rev1 (5 certs) active; raw DB table has admin-only row and deleted pub-5
  await evaluate(`(async () => {
    const runtime = await import('/src/runtime/publishedRuntime.ts');
    const certStore = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('certificates');
    certStore.$reset();
    window.__guestCertMock.mode = 'rev1';
    window.__guestCertMock.requests.length = 0;
    runtime.invalidatePublishedRuntimeCache(1);
    await runtime.initializePublishedRuntime({ force: true });
  })()`)
  await waitFor(`document.querySelectorAll('#certificate .certificate-card[data-certificate-id^="pub-"]').length === 2`)
  const scenarioBInitial = await evaluate(`({
    ids: [...document.querySelectorAll('#certificate .certificate-card')].map((el) => el.dataset.certificateId),
    requests: [...window.__guestCertMock.requests]
  })`)
  assert(
    JSON.stringify(scenarioBInitial.ids) === JSON.stringify(['pub-1', 'pub-2']),
    `Scenario B initial mismatch: ${JSON.stringify(scenarioBInitial)}`
  )
  assert(
    !scenarioBInitial.requests.some((u) => /\/rest\/v1\/(certificates|certificate_images|media_assets)/.test(u)),
    `Scenario B initial leaked raw tables: ${JSON.stringify(scenarioBInitial.requests)}`
  )

  // Click Refresh button while Published rev1 is active -> expands 2 -> 5 Published cards only
  await evaluate(`(() => {
    window.__guestCertMock.requests.length = 0;
    document.querySelector('#certificate .refresh-btn').click();
  })()`)
  await waitFor(`document.querySelectorAll('#certificate .certificate-card').length === 5 && !document.querySelector('#certificate .refresh-btn').disabled`)
  const scenarioBRefresh = await evaluate(`({
    ids: [...document.querySelectorAll('#certificate .certificate-card')].map((el) => el.dataset.certificateId),
    titles: [...document.querySelectorAll('#certificate .info-title')].map((el) => el.textContent.trim()),
    requests: [...window.__guestCertMock.requests]
  })`)
  assert(
    JSON.stringify(scenarioBRefresh.ids) === JSON.stringify(['pub-1', 'pub-2', 'pub-3', 'pub-4', 'pub-5']) &&
      !scenarioBRefresh.titles.some((t) => t.includes('Sertifikat Dapur')),
    `Scenario B refresh mismatch: ${JSON.stringify(scenarioBRefresh)}`
  )
  assert(
    scenarioBRefresh.requests.some((u) => u.includes('get_active_published_snapshot')) &&
      !scenarioBRefresh.requests.some((u) => /\/rest\/v1\/(certificates|certificate_images|media_assets)/.test(u)),
    `Scenario B refresh queried raw tables: ${JSON.stringify(scenarioBRefresh.requests)}`
  )

  // Scenario C: Network outage during Guest refresh keeps existing 5 Published cards and page mounted
  await evaluate(`(() => {
    window.__guestCertMock.failRpc = true;
    window.__guestCertMock.requests.length = 0;
    document.querySelector('#certificate .refresh-btn').click();
  })()`)
  await waitFor(`Boolean(document.querySelector('#certificate .certificate-status-error')) && !document.querySelector('#certificate .refresh-btn').disabled`)
  const scenarioC = await evaluate(`({
    ids: [...document.querySelectorAll('#certificate .certificate-card')].map((el) => el.dataset.certificateId),
    error: document.querySelector('#certificate .certificate-status-error')?.textContent?.trim() ?? '',
    pageUnmounted: Boolean(document.querySelector('.published-runtime-state'))
  })`)
  assert(
    scenarioC.ids.length === 5 &&
      !scenarioC.pageUnmounted &&
      scenarioC.error.includes('Data sertifikat terbaru belum dapat dimuat') &&
      !/Simulated outage|upstream db/i.test(scenarioC.error),
    `Scenario C failure behavior mismatch: ${JSON.stringify(scenarioC)}`
  )

  // Scenario D: Admin publishes Rev 2 (pub-5 removed, pub-6 added) -> Guest Refresh loads Rev 2 cleanly
  await evaluate(`(() => {
    window.__guestCertMock.failRpc = false;
    window.__guestCertMock.mode = 'rev2';
    window.__guestCertMock.requests.length = 0;
    document.querySelector('#certificate .refresh-btn').click();
  })()`)
  await waitFor(`document.querySelector('[data-certificate-id="pub-6"]') && !document.querySelector('#certificate .refresh-btn').disabled`)
  const scenarioD = await evaluate(`({
    ids: [...document.querySelectorAll('#certificate .certificate-card')].map((el) => el.dataset.certificateId),
    error: document.querySelector('#certificate .certificate-status-error')?.textContent?.trim() ?? '',
    requests: [...window.__guestCertMock.requests]
  })`)
  assert(
    JSON.stringify(scenarioD.ids) === JSON.stringify(['pub-1', 'pub-2', 'pub-3', 'pub-4', 'pub-6']) &&
      scenarioD.error === '' &&
      !scenarioD.requests.some((u) => /\/rest\/v1\/(certificates|certificate_images|media_assets)/.test(u)),
    `Scenario D rev2 update mismatch: ${JSON.stringify(scenarioD)}`
  )

  // Scenario E: Remounting Guest CertificateSection with isInitialized=false must NOT trigger raw loadInitial()
  await evaluate(`(async () => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const site = pinia._s.get('site');
    const certStore = pinia._s.get('certificates');
    window.__guestCertMock.requests.length = 0;
    site.publishedRuntimeStatus = 'loading';
    await new Promise((r) => setTimeout(r, 40));
    certStore.$reset();
    site.publishedRuntimeStatus = 'ready';
    await new Promise((r) => setTimeout(r, 120));
  })()`)
  const scenarioERequests = await evaluate(`[...window.__guestCertMock.requests]`)
  assert(
    !scenarioERequests.some((u) => /\/rest\/v1\/(certificates|certificate_images|media_assets)/.test(u)),
    `Scenario E remount queried raw tables: ${JSON.stringify(scenarioERequests)}`
  )

  assert(runtimeExceptions.length === 0, `Uncaught runtime exceptions: ${runtimeExceptions.join(' | ')}`)
  assert(!viteErrors.toLowerCase().includes('error:'), `Vite errors: ${viteErrors}`)
  assert(!browserErrors.includes('FATAL'), `Browser errors: ${browserErrors}`)

  console.log(JSON.stringify({
    status: 'PASS',
    scope: 'Finding #5 Guest Certificate Isolation & Refresh Boundary',
    scenarioA_defaultZeroPublishNoLeak: true,
    scenarioB_publishedRefresh5CardsNoLeak: true,
    scenarioC_transientOutageSafePreserve: true,
    scenarioD_publishedRev2UpdateClean: true,
    scenarioE_remountUninitializedNoRawQuery: true
  }))
} finally {
  socket?.close()
  stopChildren()
  await wait(250)
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}
