import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5211'
const cdpPort = 9371
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')

const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-finding13-chrome-'))
const shotsDir = process.env.VERIFY_SHOTS_DIR ?? ''
const children = []
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (condition, message) => { if (!condition) throw new Error(`Finding #13 test failed: ${message}`) }

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { if ((await fetch(url)).ok) return } catch { /* Vite starting */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForJson(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.json()
    } catch { /* Chrome starting */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function launch(cmd, args, options = {}) {
  const child = spawn(cmd, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options })
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
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5211', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: 'https://mock-supabase.local', VITE_SUPABASE_PUBLISHABLE_KEY: 'mock-anon-key' }
  })
  await waitForHttp(baseUrl)

  launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1440,900', 'about:blank'
  ])

  let page
  const started = Date.now()
  while (!page && Date.now() - started < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page')
    if (!page) await wait(100)
  }
  assert(page, 'Browser target not found')

  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) {
      const req = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? req.reject(new Error(msg.error.message)) : req.resolve(msg.result)
    }
    if (msg.method === 'Runtime.exceptionThrown') runtimeErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') runtimeErrors.push(msg.params.entry.text)
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
  const waitFor = async (expr, timeout = 15000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await evaluate(expr)) return
      await wait(50)
    }
    throw new Error(`Timed out: ${expr}`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      const __origFetch = window.fetch.bind(window);
      const parseInIds = (raw) => {
        if (!raw || !raw.startsWith('in.(') || !raw.endsWith(')')) return null;
        const inner = raw.slice(4, -1);
        const ids = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < inner.length; i++) {
          const ch = inner[i];
          if (inQuotes) {
            if (ch === '\\\\' && i + 1 < inner.length) { cur += inner[++i]; }
            else if (ch === '"') { inQuotes = false; }
            else cur += ch;
          } else {
            if (ch === '"') inQuotes = true;
            else if (ch === ',') { ids.push(cur); cur = ''; }
            else cur += ch;
          }
        }
        ids.push(cur);
        return ids.filter((v) => v.length > 0);
      };

      const now = Date.now();
      window.__f13Mock = {
        requests: [],
        messages: [
          { id: 'msg-alpha', name: 'Alpha Nurse', email: 'alpha@example.test', message: 'Halo klinik', created_at: new Date(now - 10000).toISOString(), updated_at: new Date(now - 10000).toISOString(), expires_at: new Date(now + 86400000).toISOString(), is_saved: false, ip_hash: 'a'.repeat(64), user_agent: 'test', status: 'new', read_at: null },
          { id: 'msg-beta', name: 'Beta Clinic', email: 'beta@example.test', message: 'Jadwal praktek', created_at: new Date(now - 20000).toISOString(), updated_at: new Date(now - 20000).toISOString(), expires_at: null, is_saved: true, ip_hash: 'b'.repeat(64), user_agent: 'test', status: 'read', read_at: new Date(now - 15000).toISOString() },
          { id: 'msg-special', name: 'Gamma, (Special)*', email: null, message: 'Cek karakter koma, (kurung) & *bintang*', created_at: new Date(now - 30000).toISOString(), updated_at: new Date(now - 30000).toISOString(), expires_at: new Date(now + 86400000).toISOString(), is_saved: false, ip_hash: 'c'.repeat(64), user_agent: 'test', status: 'new', read_at: null }
        ],
        certificates: [],
        certificate_images: [],
        media_assets: []
      };

      window.fetch = async (input, init = {}) => {
        const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
        if (!urlStr.startsWith('https://mock-supabase.local/')) return __origFetch(input, init);
        const parsed = new URL(urlStr);
        const method = (init.method ?? (input instanceof Request ? input.method : null) ?? 'GET').toUpperCase();
        const pathName = parsed.pathname;
        window.__f13Mock.requests.push({ method, pathName, search: parsed.search });
        const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

        if (pathName.endsWith('/rest/v1/rpc/get_active_published_snapshot')) return json([]);
        if (pathName.endsWith('/rest/v1/contact_profiles')) return json([]);
        if (pathName.endsWith('/rest/v1/messages')) {
          if (method === 'GET') return json(window.__f13Mock.messages);
          if (method === 'PATCH') {
            const id = parsed.searchParams.get('id')?.slice(3);
            const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
            const row = window.__f13Mock.messages.find((m) => m.id === id);
            if (row) Object.assign(row, body);
            return json(row ? [row] : []);
          }
        }
        if (pathName.endsWith('/rest/v1/certificates')) return json(window.__f13Mock.certificates);
        if (pathName.endsWith('/rest/v1/certificate_images')) return json(window.__f13Mock.certificate_images);
        if (pathName.endsWith('/rest/v1/media_assets')) {
          const idParam = parsed.searchParams.get('id');
          const ids = parseInIds(idParam);
          if (!ids) return json(window.__f13Mock.media_assets);
          return json(window.__f13Mock.media_assets.filter((asset) => ids.includes(asset.id)));
        }
        return json([]);
      };
    `
  })

  await send('Page.navigate', { url: `${baseUrl}/#/` })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)

  // Part 1: AdminMessages local computed search (0 extra /rest/v1/messages fetches)
  await evaluate(`(async () => {
    const auth = (await import('/src/stores/auth.ts')).useAuthStore();
    auth.$patch({ isAdmin: true, isInitialized: true, isLoading: false, errorMessage: '' });
    const router = (await import('/src/router/index.ts')).default;
    await router.push('/admin/messages');
  })()`)
  await waitFor(`document.querySelectorAll('.message-row').length === 3`)

  await evaluate(`document.querySelector('.message-row')?.click()`)
  await waitFor(`Boolean(document.querySelector('.message-detail'))`)

  const setSearch = async (value) => {
    await evaluate(`(() => {
      const input = document.querySelector('.search-box input');
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`)
    await wait(60)
  }

  const initialMsgGets = await evaluate(`window.__f13Mock.requests.filter(r => r.method === 'GET' && r.pathName.endsWith('/rest/v1/messages')).length`)
  assert(initialMsgGets === 1, `Expected 1 initial messages GET, got ${initialMsgGets}`)

  for (const val of ['B', 'Be', 'Beta']) await setSearch(val)
  await wait(240)
  const betaCount = await evaluate(`document.querySelectorAll('.message-row').length`)
  const detailStayed = await evaluate(`document.querySelector('.message-detail')?.textContent.includes('Alpha Nurse') ?? false`)
  assert(betaCount === 1, `Expected 1 Beta row, got ${betaCount}`)
  assert(detailStayed, 'Selected message detail disappeared unexpectedly while typing search')

  if (shotsDir) {
    await mkdir(shotsDir, { recursive: true })
    await writeFile(path.join(shotsDir, 'finding13-messages.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  }

  await setSearch(', (Special)*')
  const specialCount = await evaluate(`document.querySelectorAll('.message-row').length`)
  assert(specialCount === 1, `Expected 1 special-char row, got ${specialCount}`)

  await setSearch('   ')
  const spaceCount = await evaluate(`document.querySelectorAll('.message-row').length`)
  assert(spaceCount === 3, `Expected 3 rows on whitespace-only search, got ${spaceCount}`)

  await setSearch('no-match-xyz')
  await waitFor(`Boolean(document.querySelector('.product-empty-state'))`)
  const emptyTitle = await evaluate(`document.querySelector('.product-empty-state h2')?.textContent.trim()`)
  assert(emptyTitle === 'No matching messages', `Unexpected empty state title: ${emptyTitle}`)

  if (shotsDir) {
    await writeFile(path.join(shotsDir, 'finding13-messages-empty.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  }

  await evaluate(`document.querySelector('.product-empty-state button')?.click()`)
  await waitFor(`document.querySelectorAll('.message-row').length === 3`)

  const finalMsgGets = await evaluate(`window.__f13Mock.requests.filter(r => r.method === 'GET' && r.pathName.endsWith('/rest/v1/messages')).length`)
  assert(finalMsgGets === 1, `Search/clear caused extra GET /messages calls: ${finalMsgGets}`)

  const directRepoFiltered = await evaluate(`import('/src/repositories/messageRepository.ts').then(m => m.messageRepository.list('Beta')).then(rows => rows.map(r => r.id))`)
  assert(JSON.stringify(directRepoFiltered) === '["msg-beta"]', `messageRepository.list(search) contract broken: ${JSON.stringify(directRepoFiltered)}`)

  // Part 2: certificateRepository.list() scoped media_assets fetching
  const certReport = await evaluate(`(async () => {
    const { certificateRepository } = await import('/src/repositories/certificateRepository.ts');
    const mkCert = (id, order, active = true) => ({ id, title: id, date: '2026', description: 'desc', order_index: order, active });
    const mkImg = (id, certificate_id, role, order_index, media_asset_id) => ({ id, certificate_id, role, order_index, media_asset_id, object_position: 'center center', placeholder_config: {} });
    const mkAsset = (id) => ({ id, storage_bucket: null, storage_path: null, mime_type: 'image/webp', file_size: 100, width: 100, height: 100, alt_text: id, source_url: 'https://cdn.example/' + encodeURIComponent(id) + '.webp' });

    // 2A: No media_asset_id on any certificate_images row -> 0 media_assets requests
    window.__f13Mock.requests.length = 0;
    window.__f13Mock.certificates = [mkCert('c1', 0, true)];
    window.__f13Mock.certificate_images = [mkImg('i1', 'c1', 'thumbnail', 0, null)];
    window.__f13Mock.media_assets = [mkAsset('asset-library-only')];
    await certificateRepository.list();
    const emptyAssetsCalls = window.__f13Mock.requests.filter(r => r.pathName.endsWith('/rest/v1/media_assets')).length;

    // 2B: Referenced certificate assets (incl. duplicate & special quoted ID) fetched; unrelated library noise excluded
    window.__f13Mock.requests.length = 0;
    const specialId = 'asset"quoted,&x';
    window.__f13Mock.certificates = [mkCert('c1', 0, true), mkCert('c2', 1, true)];
    window.__f13Mock.certificate_images = [
      mkImg('i1', 'c1', 'thumbnail', 0, 'shared-asset'),
      mkImg('i2', 'c1', 'detail', 0, specialId),
      mkImg('i3', 'c2', 'thumbnail', 0, 'shared-asset')
    ];
    window.__f13Mock.media_assets = [
      mkAsset('shared-asset'), mkAsset(specialId), mkAsset('asset-library-only'), mkAsset('hero-asset'), mkAsset('cv-pdf')
    ];
    const cards2b = await certificateRepository.list();
    const mediaReqs2b = window.__f13Mock.requests.filter(r => r.pathName.endsWith('/rest/v1/media_assets'));

    // 2C: 105 unique assets -> chunked into 3 calls (50, 50, 5)
    window.__f13Mock.requests.length = 0;
    const manyCerts = [];
    const manyImgs = [];
    const manyAssets = [mkAsset('unrelated-lib-1'), mkAsset('unrelated-lib-2')];
    for (let c = 0; c < 27; c++) {
      const cid = 'bulk-' + c;
      manyCerts.push(mkCert(cid, c, true));
      const tId = 'bulk-asset-' + (c * 4);
      manyAssets.push(mkAsset(tId));
      manyImgs.push(mkImg(cid + '-t', cid, 'thumbnail', 0, tId));
      for (let d = 1; d <= 3 && (c * 4 + d) < 105; d++) {
        const aId = 'bulk-asset-' + (c * 4 + d);
        manyAssets.push(mkAsset(aId));
        manyImgs.push(mkImg(cid + '-d' + d, cid, 'detail', d - 1, aId));
      }
    }
    window.__f13Mock.certificates = manyCerts;
    window.__f13Mock.certificate_images = manyImgs;
    window.__f13Mock.media_assets = manyAssets;
    const cards2c = await certificateRepository.list();
    const mediaReqs2c = window.__f13Mock.requests.filter(r => r.pathName.endsWith('/rest/v1/media_assets'));

    return {
      emptyAssetsCalls,
      mediaReqs2bCount: mediaReqs2b.length,
      mediaQuery2b: mediaReqs2b[0]?.search ?? '',
      c1ThumbSrc: cards2b.find(c => c.id === 'c1')?.thumbnail.source ?? '',
      c1DetailSrc: cards2b.find(c => c.id === 'c1')?.detailImages[0]?.source ?? '',
      c2ThumbSrc: cards2b.find(c => c.id === 'c2')?.thumbnail.source ?? '',
      mediaReqs2cCount: mediaReqs2c.length,
      resolved2cCount: cards2c.reduce((acc, card) => acc + (card.thumbnail.source ? 1 : 0) + card.detailImages.filter(d => d.source).length, 0)
    };
  })()`)

  assert(certReport.emptyAssetsCalls === 0, `Expected 0 media_assets requests on null media_asset_id rows, got ${certReport.emptyAssetsCalls}`)
  assert(certReport.mediaReqs2bCount === 1, `Expected 1 deduplicated media_assets request, got ${certReport.mediaReqs2bCount}`)
  assert(certReport.mediaQuery2b.includes('id=in.('), `Missing id=in.() filter: ${certReport.mediaQuery2b}`)
  assert(!certReport.mediaQuery2b.includes('asset-library-only') && !certReport.mediaQuery2b.includes('hero-asset') && !certReport.mediaQuery2b.includes('cv-pdf'), `Leaked unrelated library asset IDs into query: ${certReport.mediaQuery2b}`)
  assert(certReport.c1ThumbSrc.includes('shared-asset') && certReport.c2ThumbSrc.includes('shared-asset'), 'Shared deduplicated asset failed to resolve')
  assert(certReport.c1DetailSrc.includes(encodeURIComponent('asset"quoted,&x')), `Special-char quoted asset ID failed to resolve: ${certReport.c1DetailSrc}`)
  assert(certReport.mediaReqs2cCount === 3, `Expected 3 batched media_assets requests for 105 assets, got ${certReport.mediaReqs2cCount}`)
  assert(certReport.resolved2cCount === 105, `Expected 105 resolved bulk assets, got ${certReport.resolved2cCount}`)

  const seriousErrors = runtimeErrors.filter((err) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(err))
  assert(seriousErrors.length === 0, `Browser errors encountered: ${seriousErrors.join(' | ')}`)

  process.stdout.write(`${JSON.stringify({ status: 'PASS', initialMsgGets, finalMsgGets, betaCount, specialCount, spaceCount, detailStayed, certReport }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* no-op */ }
  stopChildren()
  await wait(250)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* cleanup */ }
}
