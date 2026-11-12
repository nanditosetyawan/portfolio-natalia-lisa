import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5212'
const cdpPort = 9372
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')

const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-finding14-chrome-'))
const shotsDir = process.env.VERIFY_SHOTS_DIR ?? ''
const children = []
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (condition, message) => { if (!condition) throw new Error(`Finding #14 test failed: ${message}`) }

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
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5212', '--strictPort'], {
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
        return inner.split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
      };

      const pngAssetId = '11111111-0000-4000-8000-000000000001';
      const extAssetId = '22222222-0000-4000-8000-000000000002';
      const fallbackAssetId = '33333333-0000-4000-8000-000000000003';
      const unusedAssetId = '44444444-0000-4000-8000-000000000004';

      window.__f14Mock = {
        failOrderPatch: false,
        alertCalls: [],
        mediaQueries: [],
        certificates: [
          { id: 'cert-1', title: 'Sertifikat PNG & GIF', date: '2026-04', description: 'Non-webp path check', order_index: 0, active: true },
          { id: 'cert-2', title: 'Sertifikat Fallback WebP', date: '2026-03', description: 'Legacy fallback check', order_index: 1, active: true }
        ],
        certificate_images: [
          { id: 'img-1-thumb', certificate_id: 'cert-1', role: 'thumbnail', order_index: 0, media_asset_id: pngAssetId, object_position: '50% 50%', placeholder_config: {} },
          { id: 'img-1-d0', certificate_id: 'cert-1', role: 'detail', order_index: 0, media_asset_id: extAssetId, object_position: '50% 50%', placeholder_config: {} },
          { id: 'img-2-thumb', certificate_id: 'cert-2', role: 'thumbnail', order_index: 0, media_asset_id: fallbackAssetId, object_position: '50% 50%', placeholder_config: {} }
        ],
        media_assets: [
          { id: pngAssetId, storage_bucket: 'portfolio-media', storage_path: 'draft/library/custom-thumb.png', mime_type: 'image/png', file_size: 2048, width: 400, height: 300, alt_text: 'custom-thumb', source_url: null, created_at: '2026-11-11T10:00:00Z', updated_at: '2026-11-11T10:00:00Z' },
          { id: extAssetId, storage_bucket: 'portfolio-media', storage_path: 'published/certificates/ext.gif', mime_type: 'image/gif', file_size: 4096, width: 600, height: 400, alt_text: 'ext-gif', source_url: 'https://cdn.example.test/detail-banner.gif', created_at: '2026-11-11T10:00:00Z', updated_at: '2026-11-11T10:00:00Z' },
          { id: unusedAssetId, storage_bucket: 'portfolio-media', storage_path: 'draft/library/unrelated.webp', mime_type: 'image/webp', file_size: 1024, width: 100, height: 100, alt_text: 'unrelated', source_url: null, created_at: '2026-11-11T10:00:00Z', updated_at: '2026-11-11T10:00:00Z' }
        ],
        site_revisions: []
      };

      window.alert = (msg) => { window.__f14Mock.alertCalls.push(String(msg)); };

      window.fetch = async (input, init = {}) => {
        const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
        if (!urlStr.startsWith('https://mock-supabase.local/')) return __origFetch(input, init);
        const parsed = new URL(urlStr);
        const method = (init.method ?? (input instanceof Request ? input.method : null) ?? 'GET').toUpperCase();
        const p = parsed.pathname;
        const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

        if (p.includes('/storage/v1/object/portfolio-media/')) {
          return json({ Key: decodeURIComponent(p.split('/storage/v1/object/')[1] ?? '') });
        }
        if (p.endsWith('/rest/v1/admin_memberships')) return json([{ user_id: 'admin-1' }]);
        if (p.endsWith('/rest/v1/rpc/get_active_published_snapshot')) {
          const pub = window.__f14Mock.site_revisions.find((r) => r.status === 'published');
          return json(pub ? [pub] : []);
        }
        if (p.endsWith('/rest/v1/site_revisions')) {
          const st = parsed.searchParams.get('status');
          let rows = window.__f14Mock.site_revisions;
          if (st?.startsWith('eq.')) rows = rows.filter((r) => r.status === st.slice(3));
          return json(rows);
        }
        if (p.endsWith('/rest/v1/certificates')) {
          if (method === 'GET') return json([...window.__f14Mock.certificates].sort((a, b) => a.order_index - b.order_index));
          if (method === 'PATCH') {
            if (window.__f14Mock.failOrderPatch) return json({ code: 'PGRST000', message: 'Order persist failed mock' }, 500);
            const id = parsed.searchParams.get('id')?.slice(3);
            const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
            const row = window.__f14Mock.certificates.find((c) => c.id === id);
            if (row) Object.assign(row, body);
            return json(row ? [row] : []);
          }
        }
        if (p.endsWith('/rest/v1/certificate_images')) return json(window.__f14Mock.certificate_images);
        if (p.endsWith('/rest/v1/media_assets')) {
          if (method === 'GET') {
            const idParam = parsed.searchParams.get('id');
            window.__f14Mock.mediaQueries.push(parsed.search);
            const ids = parseInIds(idParam);
            if (!ids) return json(window.__f14Mock.media_assets);
            return json(window.__f14Mock.media_assets.filter((row) => ids.includes(row.id)));
          }
          if (method === 'POST') {
            const rows = Array.isArray(JSON.parse(init.body)) ? JSON.parse(init.body) : [JSON.parse(init.body)];
            window.__f14Mock.media_assets.push(...rows);
            return json(rows, 201);
          }
        }
        return json([]);
      };
    `
  })

  await send('Page.navigate', { url: `${baseUrl}/#/` })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)

  await evaluate(`(async () => {
    const [snapshotMod, siteMod, clientMod, authMod, routerMod] = await Promise.all([
      import('/src/editor/editorSnapshot.ts'),
      import('/src/data/default/site.ts'),
      import('/src/lib/supabaseClient.ts'),
      import('/src/stores/auth.ts'),
      import('/src/router/index.ts')
    ]);
    const baseSnap = snapshotMod.createEditorSnapshot(siteMod.createDefaultSiteSnapshot());
    const pubSnap = structuredClone(baseSnap);
    pubSnap.certificateCards = [{
      id: 'cert-pub-legacy',
      title: 'Published Cert Legacy',
      date: '2026-01',
      description: 'Pub desc',
      order: 0,
      active: true,
      thumbnail: {
        id: 'legacy-thumb',
        source: 'https://mock-supabase.local/storage/v1/object/public/portfolio-media/draft/library/custom-thumb.png',
        placeholder: { label: 'Thumb', hint: 'Admin', color: '#333', opacity: 1 },
        image: { objectPosition: '50% 50%' }
      },
      detailImages: []
    }];
    const draftSnap = structuredClone(baseSnap);
    draftSnap.certificateCards = [];
    window.__f14Mock.site_revisions = [
      {
        id: 'rev-pub-1', revision_number: 1, lock_version: 1, status: 'published',
        base_revision_number: null, created_by: 'admin-1', created_at: '2026-11-11T09:00:00Z', updated_at: '2026-11-11T09:00:00Z',
        published_at: '2026-11-11T09:00:00Z', source_draft_revision_id: null, published_by: 'admin-1', publish_note: null, publication_kind: 'publish', rollback_source_revision_id: null,
        snapshot: pubSnap
      },
      {
        id: 'rev-draft-2', revision_number: 2, lock_version: 1, status: 'draft',
        base_revision_number: 1, created_by: 'admin-1', created_at: '2026-11-11T09:30:00Z', updated_at: '2026-11-11T09:30:00Z',
        published_at: null, source_draft_revision_id: null, published_by: null, publish_note: null, publication_kind: null, rollback_source_revision_id: null,
        snapshot: draftSnap
      }
    ];

    const auth = authMod.useAuthStore();
    const session = { access_token: 'jwt-f14', refresh_token: 'ref-f14', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'admin-1', email: 'admin@example.com' } };
    clientMod.supabaseClient.auth.getSession = async () => ({ data: { session }, error: null });
    auth.$patch({ session, isAdmin: true, isInitialized: true, isLoading: false });
    await routerMod.default.push('/admin/media/library');
  })()`)

  await waitFor(`Boolean(document.querySelector('.media-library-page input[type="file"][multiple]')) && !document.querySelector('.asset-grid-loading') && Boolean(document.querySelector('.asset-card'))`)

  // 1. Verify Asset Library file input accept + PDF upload + iframe preview
  const pdfResult = await evaluate(`(async () => {
    const rules = await import('/src/lib/mediaUploadRules.ts');
    const input = document.querySelector('.media-library-page input[type="file"][multiple]');
    const accept = input.getAttribute('accept') ?? '';
    const library = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('media-library');

    const pdfBytes = new TextEncoder().encode('%PDF-1.4\\n1 0 obj <<>> endobj\\ntrailer <<>>\\n%%EOF');
    const dt = new DataTransfer();
    dt.items.add(new File([pdfBytes], 'sertifikat-dokumen.pdf', { type: 'application/pdf' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    for (let i = 0; i < 120; i++) {
      if (!library.mutating && library.assets.some((a) => a.mimeType === 'application/pdf')) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const uploadedPdf = library.assets.find((a) => a.mimeType === 'application/pdf');
    const iframe = document.querySelector('.asset-details .detail-preview iframe');
    const errorBanner = document.querySelector('.library-error')?.textContent?.trim() ?? '';
    const statusText = document.querySelector('.library-status')?.textContent?.trim() ?? '';
    return {
      accept,
      expectedAccept: rules.MEDIA_LIBRARY_FILE_ACCEPT,
      uploaded: Boolean(uploadedPdf),
      storagePath: uploadedPdf?.storagePath ?? '',
      iframeSrc: iframe?.getAttribute('src') ?? '',
      errorBanner,
      statusText
    };
  })()`)

  assert(pdfResult.accept === pdfResult.expectedAccept && pdfResult.accept.includes('application/pdf'), `Asset Library accept mismatch: ${JSON.stringify(pdfResult)}`)
  assert(pdfResult.uploaded && pdfResult.storagePath.startsWith('draft/library/') && pdfResult.storagePath.endsWith('.pdf'), `PDF upload failed: ${JSON.stringify(pdfResult)}`)
  assert(pdfResult.iframeSrc.includes('draft/library/') && pdfResult.iframeSrc.endsWith('.pdf') && !pdfResult.errorBanner, `PDF detail iframe preview missing: ${JSON.stringify(pdfResult)}`)

  if (shotsDir) {
    await mkdir(shotsDir, { recursive: true })
    await writeFile(path.join(shotsDir, 'finding14-asset-library-pdf.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  }

  // 2. Verify AdminCertificates resolves real storage_path / source_url, retains custom storage_path on snapshot delete check, and replaces alert() with toast + rollback
  await evaluate(`(async () => {
    window.__f14Mock.mediaQueries = [];
    const router = (await import('/src/router/index.ts')).default;
    await router.push('/admin/certificates');
  })()`)
  await waitFor(`document.querySelectorAll('.cert-item').length === 2`)

  const certMediaCheck = await evaluate(`(async () => {
    const cards = Array.from(document.querySelectorAll('.cert-item'));
    const card1ThumbSrc = cards[0].querySelector('.cert-thumb img')?.getAttribute('src') ?? '';
    const card2ThumbSrc = cards[1].querySelector('.cert-thumb img')?.getAttribute('src') ?? '';

    // Expand Cert 1 to check detail image URL
    cards[0].querySelector('.cert-header').click();
    await new Promise((r) => setTimeout(r, 80));
    const slideSrc = cards[0].querySelector('.slide-img')?.getAttribute('src') ?? '';

    // Open Edit modal to inspect existingThumb & existingDetails previews
    cards[0].querySelector('.edit-btn').click();
    await new Promise((r) => setTimeout(r, 60));
    const modalThumbSrc = document.querySelector('.existing-preview img')?.getAttribute('src') ?? '';
    const modalDetailSrc = document.querySelector('.selected-file-item .tiny-preview')?.getAttribute('src') ?? '';
    document.querySelector('.modal-actions button[type="button"]').click();
    await new Promise((r) => setTimeout(r, 60));

    // Trigger delete confirmation to verify storage_path matching in Published snapshot warning
    cards[0].querySelector('.delete-btn').click();
    for (let i = 0; i < 60 && !document.querySelector('.delete-confirm-modal'); i++) {
      await new Promise((r) => setTimeout(r, 30));
    }
    const publishedWarningVisible = Boolean(document.querySelector('.delete-published-warning'));
    document.querySelector('.delete-confirm-modal .modal-actions button[type="button"]').click();
    await new Promise((r) => setTimeout(r, 60));

    return {
      card1ThumbSrc,
      card2ThumbSrc,
      slideSrc,
      modalThumbSrc,
      modalDetailSrc,
      publishedWarningVisible,
      mediaQueries: [...window.__f14Mock.mediaQueries]
    };
  })()`)

  assert(certMediaCheck.card1ThumbSrc.endsWith('/draft/library/custom-thumb.png'), `Cert 1 thumb still forced .webp: ${certMediaCheck.card1ThumbSrc}`)
  assert(certMediaCheck.modalThumbSrc === certMediaCheck.card1ThumbSrc, `Edit modal thumb mismatch: ${certMediaCheck.modalThumbSrc}`)
  assert(certMediaCheck.slideSrc === 'https://cdn.example.test/detail-banner.gif' && certMediaCheck.modalDetailSrc === 'https://cdn.example.test/detail-banner.gif', `Detail image source_url not used: ${JSON.stringify(certMediaCheck)}`)
  assert(certMediaCheck.card2ThumbSrc.endsWith('/published/certificates/33333333-0000-4000-8000-000000000003.webp'), `Legacy fallback .webp broke: ${certMediaCheck.card2ThumbSrc}`)
  assert(certMediaCheck.publishedWarningVisible, 'Snapshot reference lookup missed non-.webp storage_path in delete warning')
  assert(certMediaCheck.mediaQueries.every((q) => q.includes('id=in.')), `Expected scoped media_assets query, got: ${JSON.stringify(certMediaCheck.mediaQueries)}`)

  if (shotsDir) {
    await writeFile(path.join(shotsDir, 'finding14-admin-certs.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  }

  // 3. Reorder failure: alert() must NOT be called; error toast must show; DOM order must roll back
  const orderFailureCheck = await evaluate(`(async () => {
    window.__f14Mock.failOrderPatch = true;
    const cards = Array.from(document.querySelectorAll('.cert-item'));
    const dt = new DataTransfer();
    cards[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    cards[1].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    cards[1].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    cards[0].dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));

    for (let i = 0; i < 80; i++) {
      if (document.querySelector('.product-toast--error')) break;
      await new Promise((r) => setTimeout(r, 30));
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const toastEl = document.querySelector('.product-toast--error');
    const titlesAfterRollback = Array.from(document.querySelectorAll('.cert-item h3')).map((h) => h.textContent.trim());
    return {
      alertCallCount: window.__f14Mock.alertCalls.length,
      toastText: toastEl?.innerText?.trim() ?? '',
      titlesAfterRollback
    };
  })()`)

  assert(orderFailureCheck.alertCallCount === 0, `window.alert was still called: ${orderFailureCheck.alertCallCount}`)
  assert(orderFailureCheck.toastText.includes('Gagal menyimpan urutan baru') && orderFailureCheck.toastText.includes('Order persist failed mock'), `Expected error toast message, got: ${orderFailureCheck.toastText}`)
  assert(JSON.stringify(orderFailureCheck.titlesAfterRollback) === JSON.stringify(['Sertifikat PNG & GIF', 'Sertifikat Fallback WebP']), `Order did not roll back: ${JSON.stringify(orderFailureCheck.titlesAfterRollback)}`)

  if (shotsDir) {
    await writeFile(path.join(shotsDir, 'finding14-cert-order-error-toast.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  }

  const seriousErrors = runtimeErrors.filter((err) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(err))
  assert(seriousErrors.length === 0, `Browser runtime errors: ${seriousErrors.join(' | ')}`)

  console.log(JSON.stringify({ status: 'PASS', scope: 'finding-14-asset-pdf-cert-media-order', pdfResult, certMediaCheck, orderFailureCheck }, null, 2))
} finally {
  socket?.close()
  stopChildren()
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}

