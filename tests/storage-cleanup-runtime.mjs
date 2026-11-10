import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5203'
const cdpPort = 9363
const screenshotDir = process.env.CLEANUP_SCREENSHOT_DIR || null
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')

const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-storage-cleanup-'))
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
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5203', '--strictPort'],
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
  const waitFor = async (conditionExpr, timeout = 12000) => {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(conditionExpr)) return
      await wait(70)
    }
    throw new Error(`Timed out waiting for: ${conditionExpr}`)
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      (() => {
        if (window.__storageCleanupMockInstalled) return;
        window.__storageCleanupMockInstalled = true;
        const oldIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        const recentIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const objects = [
          // Referenced active DB objects (5)
          { path: 'published/live/hero.webp', size: 220000, created_at: oldIso, updated_at: oldIso },
          { path: 'published/certificates/cert-keep.webp', size: 25000, created_at: oldIso, updated_at: oldIso },
          { path: 'draft/editor-session-a/active-draft.png', size: 480000, created_at: recentIso, updated_at: recentIso },
          { path: 'portfolio/about/1/keep icon.svg', size: 12000, created_at: oldIso, updated_at: oldIso },
          { path: 'draft/literal%20key.png', size: 18000, created_at: oldIso, updated_at: oldIso },
          // Unsaved active Pinia session object (> 1h old, NOT in DB RPC yet) (1)
          { path: 'draft/editor-session-unsaved/keep-me.png', size: 310000, created_at: oldIso, updated_at: oldIso },
          // Supabase internal folder placeholder (should be ignored)
          { path: 'published/.emptyFolderPlaceholder', size: 0, created_at: oldIso, updated_at: oldIso },
          // Recent (< 1h) orphans (3, including upsert/update recency)
          { path: 'draft/library/recent-upload-1.webp', size: 150000, created_at: recentIso, updated_at: recentIso },
          { path: 'published/recent-attempt/new-temp.webp', size: 95000, created_at: recentIso, updated_at: recentIso },
          { path: 'portfolio/updated-recently.webp', size: 70000, created_at: oldIso, updated_at: recentIso },
          // Old (> 1h) orphans (54 -> tests >50 batching, % key preservation & TOCTOU skip)
          { path: 'published/1/toctou-saved.png', size: 120000, created_at: oldIso, updated_at: oldIso },
          { path: 'draft/editor-session-old/stale-draft.png', size: 350000, created_at: oldIso, updated_at: oldIso },
          { path: 'portfolio/old/stale-legacy.jpg', size: 80000, created_at: oldIso, updated_at: oldIso },
          { path: 'draft/orphan%20percent.png', size: 42000, created_at: oldIso, updated_at: oldIso },
          ...Array.from({ length: 50 }, (_, idx) => ({
            path: idx < 25
              ? 'published/2/orphan-' + String(idx + 1).padStart(2, '0') + '.webp'
              : 'published/certificates/orphan-cert-' + String(idx - 24).padStart(2, '0') + '.webp',
            size: 100000 + idx * 1024,
            created_at: oldIso,
            updated_at: oldIso
          }))
        ];

        const state = {
          failRpcNext: true,
          referenced: [
            'https://mock-supabase.local/storage/v1/object/public/portfolio-media/published/live/hero.webp?v=1',
            'published/certificates/cert-keep.webp',
            'draft/editor-session-a/active-draft.png',
            'portfolio/about/1/keep%20icon.svg',
            'draft/literal%20key.png'
          ],
          objects,
          deleteBatches: [],
          rpcCalls: 0,
          listCalls: []
        };
        window.__storageCleanupState = state;

        const __origFetch = window.fetch.bind(window);
        window.fetch = async (input, init = {}) => {
          const rawUrl = typeof input === 'string' ? input : input.url;
          if (!rawUrl.startsWith('https://mock-supabase.local')) return __origFetch(input, init);
          const url = new URL(rawUrl);
          const p = url.pathname;
          const method = (init.method || 'GET').toUpperCase();
          const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

          if (p.endsWith('/rest/v1/rpc/list_referenced_storage_paths')) {
            state.rpcCalls += 1;
            if (state.failRpcNext) {
              state.failRpcNext = false;
              return json({ message: 'Simulated RPC outage for fail-closed test' }, 500);
            }
            return json(state.referenced);
          }

          if (p.endsWith('/rest/v1/media_assets')) return json([]);
          if (p.endsWith('/rest/v1/site_revisions')) return json([]);
          if (p.endsWith('/rest/v1/rpc/get_active_published_snapshot')) return json([]);

          if (p === '/storage/v1/object/list/portfolio-media' && method === 'POST') {
            const body = JSON.parse(String(init.body || '{}'));
            const prefix = String(body.prefix || '').replace(/^\\/+|\\/+$/g, '');
            const requestedLimit = Number(body.limit || 100);
            // Simulate a strict server page cap (10 items/page) even when client asks for 1000
            const limit = Math.min(requestedLimit, 10);
            const offset = Number(body.offset || 0);
            state.listCalls.push({ prefix, limit, offset });

            const directPrefix = prefix ? prefix + '/' : '';
            const folders = new Set();
            const files = [];
            for (const obj of state.objects) {
              if (!obj.path.startsWith(directPrefix)) continue;
              const remainder = obj.path.slice(directPrefix.length);
              const slashIdx = remainder.indexOf('/');
              if (slashIdx >= 0) {
                const folderName = remainder.slice(0, slashIdx);
                if (folderName) folders.add(folderName);
              } else if (remainder) {
                files.push({
                  name: remainder,
                  id: 'id-' + obj.path,
                  created_at: obj.created_at,
                  updated_at: obj.updated_at || obj.created_at,
                  metadata: { size: obj.size, mimetype: 'image/webp' }
                });
              }
            }
            const combined = [
              ...[...folders].sort().map((name) => ({ name, id: null, created_at: null, metadata: null })),
              ...files.sort((a, b) => a.name.localeCompare(b.name))
            ];
            return json(combined.slice(offset, offset + limit));
          }

          if (p === '/storage/v1/object/portfolio-media' && method === 'DELETE') {
            const body = JSON.parse(String(init.body || '{}'));
            const prefixes = Array.isArray(body.prefixes) ? body.prefixes : [];
            state.deleteBatches.push(prefixes);
            const removeSet = new Set(prefixes);
            const removed = state.objects.filter((obj) => removeSet.has(obj.path)).map((obj) => ({ name: obj.path }));
            state.objects = state.objects.filter((obj) => !removeSet.has(obj.path));
            return json(removed);
          }

          return json([]);
        };
      })();
    `
  })

  await send('Page.navigate', { url: `${baseUrl}/` })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)

  // Authenticate as Admin, inject an unsaved in-memory editor session asset, and navigate to Manage Media (/admin/media)
  await evaluate(`(async () => {
    const auth = (await import('/src/stores/auth.ts')).useAuthStore();
    const editor = (await import('/src/stores/editor.ts')).useEditorStore();
    const router = (await import('/src/router/index.ts')).default;
    auth.$patch({ isAdmin: true, isInitialized: true, isLoading: false, errorMessage: '' });
    editor.$patch({
      draftMediaReferences: [{
        assetId: 'unsaved-session-asset',
        entityId: 'about.title',
        role: 'background',
        storagePath: 'draft/editor-session-unsaved/keep-me.png',
        url: 'https://mock-supabase.local/storage/v1/object/public/portfolio-media/draft/editor-session-unsaved/keep-me.png',
        mimeType: 'image/png'
      }]
    });
    await router.push('/admin/media');
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.admin-media-page')) && Boolean(document.querySelector('[data-storage-cleanup-trigger]'))`)

  // 1. Verify top-right header trigger placement on /admin/media and absence on child route
  const desktopHeaderAudit = await evaluate(`(() => {
    const header = document.querySelector('.admin-header');
    const title = header?.querySelector('.page-title');
    const btn = document.querySelector('[data-storage-cleanup-trigger]');
    const headerRect = header?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    const btnRect = btn?.getBoundingClientRect();
    const categories = [...document.querySelectorAll('.admin-media-page .media-card .card-title')].map((el) => el.textContent?.trim());
    return {
      title: title?.textContent?.trim(),
      btnText: btn?.textContent?.trim(),
      isRightOfTitle: Boolean(btnRect && titleRect && btnRect.left > titleRect.right),
      isInsideHeader: Boolean(btnRect && headerRect && btnRect.top >= headerRect.top && btnRect.bottom <= headerRect.bottom && btnRect.right <= headerRect.right),
      horizontalOverflow: Math.max(0, Math.ceil(document.documentElement.scrollWidth - innerWidth)),
      categories
    };
  })()`)
  assert(desktopHeaderAudit.title === 'Manage Media', `Expected title Manage Media, got ${JSON.stringify(desktopHeaderAudit)}`)
  assert(desktopHeaderAudit.isRightOfTitle && desktopHeaderAudit.isInsideHeader, `Button should be inside header top-right: ${JSON.stringify(desktopHeaderAudit)}`)
  assert(desktopHeaderAudit.horizontalOverflow === 0, `Desktop horizontal overflow: ${desktopHeaderAudit.horizontalOverflow}`)
  assert(JSON.stringify(desktopHeaderAudit.categories) === JSON.stringify(['Upload', 'Gambar', 'Video', 'Dokumen']), `Manage Media cards altered unexpectedly: ${JSON.stringify(desktopHeaderAudit.categories)}`)

  if (screenshotDir) {
    const headerShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(screenshotDir, 'verify-finding8-desktop-header.png'), Buffer.from(headerShot.data, 'base64'))
  }

  // Verify button disappears on sub-route /admin/media/images and returns on /admin/media
  const subRouteAbsent = await evaluate(`(async () => {
    const router = (await import('/src/router/index.ts')).default;
    await router.push('/admin/media/images');
    await new Promise((r) => setTimeout(r, 80));
    const onSubRoute = Boolean(document.querySelector('[data-storage-cleanup-trigger]'));
    await router.push('/admin/media');
    await new Promise((r) => setTimeout(r, 80));
    const backOnMain = Boolean(document.querySelector('[data-storage-cleanup-trigger]'));
    return { onSubRoute, backOnMain };
  })()`)
  assert(!subRouteAbsent.onSubRoute && subRouteAbsent.backOnMain, `Trigger scope mismatch: ${JSON.stringify(subRouteAbsent)}`)

  // 2. Fail-closed check: open modal while RPC fails with HTTP 500
  await evaluate(`document.querySelector('[data-storage-cleanup-trigger]').click()`)
  await waitFor(`Boolean(document.querySelector('.cleanup-modal .cleanup-alert--error'))`)
  const failClosedAudit = await evaluate(`({
    alertText: document.querySelector('.cleanup-modal .cleanup-alert--error')?.innerText ?? '',
    confirmDisabled: Boolean(document.querySelector('[data-storage-cleanup-confirm]')?.disabled),
    deleteBatches: window.__storageCleanupState.deleteBatches.length
  })`)
  assert(failClosedAudit.confirmDisabled && failClosedAudit.deleteBatches === 0 && failClosedAudit.alertText.includes('Fail-Closed'), `Fail-closed guard failed: ${JSON.stringify(failClosedAudit)}`)

  // 3. Click Scan Ulang -> succeeds, lists 54 safe orphans + 3 protected recent + 5 DB + 1 active session, with 2-step confirmation initially locked
  await evaluate(`[...document.querySelectorAll('.cleanup-modal button')].find((b) => b.textContent.includes('Scan Ulang')).click()`)
  await waitFor(`document.querySelectorAll('.cleanup-modal .cleanup-stat').length === 3 && document.querySelectorAll('.cleanup-file-list li').length === 54`)
  const scanAudit = await evaluate(`(() => {
    const modalRect = document.querySelector('.cleanup-modal')?.getBoundingClientRect();
    const footerRect = document.querySelector('.cleanup-footer')?.getBoundingClientRect();
    return {
      stats: [...document.querySelectorAll('.cleanup-modal .cleanup-stat')].map((el) => el.innerText.replace(/\\n+/g, ' | ')),
      warn: document.querySelector('.cleanup-modal .cleanup-alert--warn')?.innerText ?? '',
      shield: document.querySelector('.cleanup-modal .cleanup-shield-box')?.innerText ?? '',
      confirmText: document.querySelector('[data-storage-cleanup-confirm]')?.textContent?.trim() ?? '',
      confirmLockedInitially: Boolean(document.querySelector('[data-storage-cleanup-confirm]')?.disabled),
      guardCheckedInitially: Boolean(document.querySelector('[data-storage-cleanup-guard]')?.checked),
      footerPinnedVisible: Boolean(modalRect && footerRect && footerRect.bottom <= modalRect.bottom + 1),
      listCount: document.querySelectorAll('.cleanup-file-list li').length,
      paginatedPublished2: window.__storageCleanupState.listCalls.some((c) => c.prefix === 'published/2' && c.offset >= 20),
      sampleDateText: document.querySelector('.cleanup-file-list li .cleanup-file-date')?.textContent?.trim() ?? '',
      literalOrphanListed: [...document.querySelectorAll('.cleanup-file-list .cleanup-file-path')].some((el) => el.textContent === 'draft/orphan%20percent.png'),
      sessionProtectedAbsentFromOrphans: ![...document.querySelectorAll('.cleanup-file-list .cleanup-file-path')].some((el) => el.textContent === 'draft/editor-session-unsaved/keep-me.png')
    };
  })()`)
  assert(scanAudit.stats[0].includes('63') && scanAudit.stats[1].includes('6') && scanAudit.stats[1].includes('1 sesi aktif') && scanAudit.stats[2].includes('54'), `Unexpected scan stats: ${JSON.stringify(scanAudit)}`)
  assert(scanAudit.warn.includes('3 file yatim') && scanAudit.listCount === 54, `Expected 3 protected recent + 54 safe list: ${JSON.stringify(scanAudit)}`)
  assert(scanAudit.confirmLockedInitially && !scanAudit.guardCheckedInitially && scanAudit.footerPinnedVisible, `2-step confirmation or pinned footer check failed: ${JSON.stringify(scanAudit)}`)
  assert(scanAudit.paginatedPublished2 && scanAudit.sampleDateText.length > 0 && scanAudit.literalOrphanListed && scanAudit.sessionProtectedAbsentFromOrphans, `Pagination/date/%/session guard check failed: ${JSON.stringify(scanAudit)}`)
  assert(scanAudit.shield.includes('editan aktif di browser'), `Missing shield box text: ${JSON.stringify(scanAudit)}`)

  if (screenshotDir) {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(screenshotDir, 'verify-finding8-cleanup-modal-desktop.png'), Buffer.from(shot.data, 'base64'))
  }

  // 4. Toggle "Sertakan upload baru (< 1 jam)" + test 2-step confirmation guard reset on scope change
  const toggleAudit = await evaluate(`(async () => {
    const checkbox = document.querySelector('#storage-cleanup-include-recent');
    const guard = document.querySelector('[data-storage-cleanup-guard]');
    const confirmBtn = document.querySelector('[data-storage-cleanup-confirm]');
    checkbox.click();
    await new Promise((r) => setTimeout(r, 40));
    const checkedCount = document.querySelectorAll('.cleanup-file-list li').length;
    guard.click();
    await new Promise((r) => setTimeout(r, 40));
    const enabledAfterGuard = !confirmBtn.disabled;
    checkbox.click();
    await new Promise((r) => setTimeout(r, 40));
    const uncheckedCount = document.querySelectorAll('.cleanup-file-list li').length;
    const guardResetOnScopeChange = !guard.checked && confirmBtn.disabled;
    guard.click();
    await new Promise((r) => setTimeout(r, 40));
    const rearmed = guard.checked && !confirmBtn.disabled;
    return { checkedCount, enabledAfterGuard, uncheckedCount, guardResetOnScopeChange, rearmed };
  })()`)
  assert(
    toggleAudit.checkedCount === 57 &&
    toggleAudit.enabledAfterGuard &&
    toggleAudit.uncheckedCount === 54 &&
    toggleAudit.guardResetOnScopeChange &&
    toggleAudit.rearmed,
    `Include-recent / 2-step guard mismatch: ${JSON.stringify(toggleAudit)}`
  )

  // 5. Simulate TOCTOU race (another admin saves Draft referencing published/1/toctou-saved.png right before Delete click), then click Clean Storage
  await evaluate(`window.__storageCleanupState.referenced.push('published/1/toctou-saved.png'); true`)
  await evaluate(`document.querySelector('[data-storage-cleanup-confirm]').click()`)
  await waitFor(`Boolean(document.querySelector('.cleanup-modal .cleanup-alert--success')) && !document.querySelector('[data-storage-cleanup-confirm]')?.getAttribute('aria-busy')?.includes('true') && window.__storageCleanupState.deleteBatches.length === 2`)
  await wait(80)

  const cleanupAudit = await evaluate(`({
    successText: document.querySelector('.cleanup-modal .cleanup-alert--success')?.innerText ?? '',
    batchSizes: window.__storageCleanupState.deleteBatches.map((b) => b.length),
    deletedExactPercentKey: window.__storageCleanupState.deleteBatches.flat().includes('draft/orphan%20percent.png'),
    remainingPaths: window.__storageCleanupState.objects.map((o) => o.path),
    statsAfter: [...document.querySelectorAll('.cleanup-modal .cleanup-stat')].map((el) => el.innerText.replace(/\\n+/g, ' | ')),
    confirmDisabledAfter: Boolean(document.querySelector('[data-storage-cleanup-confirm]')?.disabled),
    placeholderKept: window.__storageCleanupState.objects.some((o) => o.path === 'published/.emptyFolderPlaceholder'),
    literalKept: window.__storageCleanupState.objects.some((o) => o.path === 'draft/literal%20key.png'),
    sessionKept: window.__storageCleanupState.objects.some((o) => o.path === 'draft/editor-session-unsaved/keep-me.png'),
    updatedRecentKept: window.__storageCleanupState.objects.some((o) => o.path === 'portfolio/updated-recently.webp'),
    toctouKept: window.__storageCleanupState.objects.some((o) => o.path === 'published/1/toctou-saved.png')
  })`)
  assert(cleanupAudit.batchSizes.length === 2 && cleanupAudit.batchSizes[0] === 50 && cleanupAudit.batchSizes[1] === 3, `Expected batches [50, 3], got ${JSON.stringify(cleanupAudit)}`)
  assert(cleanupAudit.remainingPaths.length === 11, `Expected 11 remaining (5 DB + 1 session + 1 TOCTOU + 3 recent + 1 placeholder), got ${JSON.stringify(cleanupAudit.remainingPaths)}`)
  assert(cleanupAudit.deletedExactPercentKey, 'Verbatim %20 orphan key should be sent unchanged to Storage remove API')
  assert(cleanupAudit.placeholderKept && cleanupAudit.literalKept && cleanupAudit.sessionKept && cleanupAudit.updatedRecentKept && cleanupAudit.toctouKept && cleanupAudit.confirmDisabledAfter, `Safety retention failed: ${JSON.stringify(cleanupAudit)}`)
  assert(cleanupAudit.successText.includes('53 file yatim') && cleanupAudit.successText.includes('dilewati'), `Expected cleanup summary banner, got: ${cleanupAudit.successText}`)

  // Close modal via Escape
  await evaluate(`document.querySelector('.cleanup-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`)
  await waitFor(`!document.querySelector('.cleanup-modal')`)

  // 6. Mobile 390x844 layout & overflow check for Manage Media header + modal
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await wait(120)
  const mobileAudit = await evaluate(`(() => {
    const header = document.querySelector('.admin-header');
    const title = header?.querySelector('.page-title');
    const btn = document.querySelector('[data-storage-cleanup-trigger]');
    const btnRect = btn?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      horizontalOverflow: Math.max(0, Math.ceil(document.documentElement.scrollWidth - innerWidth)),
      btnFits: Boolean(btnRect && headerRect && btnRect.right <= innerWidth && btnRect.left > title.getBoundingClientRect().left),
      btnRight: btnRect?.right,
      innerWidth
    };
  })()`)
  assert(mobileAudit.horizontalOverflow === 0 && mobileAudit.btnFits, `Mobile header overflow/fit issue: ${JSON.stringify(mobileAudit)}`)

  if (screenshotDir) {
    const mobileHeaderShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(screenshotDir, 'verify-finding8-mobile-header.png'), Buffer.from(mobileHeaderShot.data, 'base64'))
  }

  // Reopen cleanup modal on mobile to verify responsive cards, stacked file rows, pinned footer & 2-step checkbox overflow
  await evaluate(`(async () => {
    document.querySelectorAll('.feedback-toast-close, [aria-label="Tutup notifikasi"], .toast-close').forEach((el) => el.click());
    document.querySelector('[data-storage-cleanup-trigger]').click();
  })()`)
  await waitFor(`Boolean(document.querySelector('.cleanup-modal #storage-cleanup-include-recent'))`)
  await evaluate(`document.querySelector('#storage-cleanup-include-recent').click()`)
  await waitFor(`document.querySelectorAll('.cleanup-file-list li').length === 3`)
  const mobileModalAudit = await evaluate(`(() => {
    const modal = document.querySelector('.cleanup-modal');
    const footer = document.querySelector('.cleanup-footer');
    const confirmBtn = document.querySelector('[data-storage-cleanup-confirm]');
    const modalRect = modal?.getBoundingClientRect();
    const footerRect = footer?.getBoundingClientRect();
    return {
      horizontalOverflow: Math.max(0, Math.ceil(document.documentElement.scrollWidth - innerWidth)),
      modalFitsWidth: Boolean(modalRect && modalRect.width <= innerWidth),
      footerPinnedVisible: Boolean(modalRect && footerRect && footerRect.bottom <= modalRect.bottom + 1),
      modalHorizontalOverflow: modal ? Math.max(0, Math.ceil(modal.scrollWidth - modal.clientWidth)) : 0,
      hasGuardCheckbox: Boolean(document.querySelector('[data-storage-cleanup-guard]')),
      confirmDisabled: Boolean(confirmBtn?.disabled)
    };
  })()`)
  assert(
    mobileModalAudit.horizontalOverflow === 0 &&
    mobileModalAudit.modalFitsWidth &&
    mobileModalAudit.footerPinnedVisible &&
    mobileModalAudit.modalHorizontalOverflow === 0 &&
    mobileModalAudit.hasGuardCheckbox &&
    mobileModalAudit.confirmDisabled,
    `Mobile modal layout overflow/guard check failed: ${JSON.stringify(mobileModalAudit)}`
  )
  if (screenshotDir) {
    const mobileModalShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(screenshotDir, 'verify-finding8-cleanup-modal-mobile.png'), Buffer.from(mobileModalShot.data, 'base64'))
  }

  assert(runtimeExceptions.length === 0, `Runtime exceptions detected: ${runtimeExceptions.join(' | ')}`)

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    desktopHeaderAudit,
    subRouteAbsent,
    failClosedAudit,
    scanAudit: { stats: scanAudit.stats, listCount: scanAudit.listCount, confirmText: scanAudit.confirmText },
    toggleAudit,
    cleanupAudit,
    mobileAudit,
    mobileModalAudit
  }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch {}
  stopChildren()
  await wait(350)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 10, retryDelay: 150 }) } catch {}
}
