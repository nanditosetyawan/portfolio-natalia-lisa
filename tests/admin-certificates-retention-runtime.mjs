import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5197'
const cdpPort = 9357
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')

const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-cert-retention-test-'))
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5197', '--strictPort'], { cwd: projectRoot, env: { ...process.env } })
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
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })

  let sequence = 0
  const pending = new Map()
  const runtimeExceptions = []
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) {
      const req = pending.get(msg.id); pending.delete(msg.id)
      msg.error ? req.reject(new Error(msg.error.message)) : req.resolve(msg.result)
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      runtimeExceptions.push(msg.params?.exceptionDetails?.exception?.description ?? msg.params?.exceptionDetails?.text ?? 'Unknown exception')
    }
  })
  const send = (method, params = {}) => { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })) }
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
    throw new Error(`Timed out waiting for: ${conditionExpr}`)
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      const __origFetch = window.fetch.bind(window);
      window.__origFetch = __origFetch;
      window.fetch = (...args) => window.__mockFetchHandler ? window.__mockFetchHandler(...args) : __origFetch(...args);
    `
  })
  await send('Page.navigate', { url: `${baseUrl}/#/admin/login` })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)

  // Install in-memory Supabase REST + Storage mock enforcing certificate_images unique(certificate_id, role, order_index)
  await evaluate(`(async () => {
    const snapshotMod = await import('/src/editor/editorSnapshot.ts');
    const siteMod = await import('/src/data/default/site.ts');
    const clientMod = await import('/src/lib/supabaseClient.ts');
    const authStoreMod = await import('/src/stores/auth.ts');

    const baseSnap = snapshotMod.createEditorSnapshot(siteMod.createDefaultSiteSnapshot());
    const makeCard = (id, title, thumbAssetId, detailAssetIds) => ({
      id,
      title,
      date: '2026-01',
      description: 'Desc ' + title,
      order: 0,
      active: true,
      thumbnail: {
        id: id + '-thumb-area',
        source: 'https://mock.supabase.co/storage/v1/object/public/portfolio-media/published/certificates/' + thumbAssetId + '.webp',
        placeholder: { label: 'Thumb', hint: 'Admin', color: '#333', opacity: 1 },
        image: { objectPosition: '50% 50%' }
      },
      detailImages: detailAssetIds.map((assetId, idx) => ({
        id: id + '-detail-area-' + idx,
        source: 'https://mock.supabase.co/storage/v1/object/public/portfolio-media/published/certificates/' + assetId + '.webp',
        placeholder: { label: 'Detail', hint: 'Admin', color: '#333', opacity: 1 },
        image: { objectPosition: '50% 50%' }
      }))
    });

    const assetA_Thumb = 'aaaaaaaa-0000-4000-8000-000000000001';
    const assetA_D0 = 'aaaaaaaa-0000-4000-8000-000000000002';
    const assetA_D1 = 'aaaaaaaa-0000-4000-8000-000000000003';
    const assetB_Thumb = 'bbbbbbbb-0000-4000-8000-000000000001';
    const assetB_D0 = 'bbbbbbbb-0000-4000-8000-000000000002';
    const assetC_Thumb = 'cccccccc-0000-4000-8000-000000000001';
    const assetC_D0 = 'cccccccc-0000-4000-8000-000000000002';
    const assetC_D1 = 'cccccccc-0000-4000-8000-000000000003';

    const publishedSnapshot = structuredClone(baseSnap);
    publishedSnapshot.certificateCards = [makeCard('cert-a', 'Published Cert A', assetA_Thumb, [assetA_D0, assetA_D1])];

    const draftSnapshot = structuredClone(baseSnap);
    draftSnapshot.certificateCards = [
      makeCard('cert-a', 'Published Cert A', assetA_Thumb, [assetA_D0, assetA_D1]),
      makeCard('cert-b', 'Draft Only Cert B', assetB_Thumb, [assetB_D0])
    ];

    const db = {
      failSiteRevisionsLookup: false,
      deletedStoragePaths: [],
      deletedMediaAssetIds: [],
      storageObjects: new Set([
        'published/certificates/' + assetA_Thumb + '.webp',
        'published/certificates/' + assetA_D0 + '.webp',
        'published/certificates/' + assetA_D1 + '.webp',
        'published/certificates/' + assetB_Thumb + '.webp',
        'published/certificates/' + assetB_D0 + '.webp',
        'published/certificates/' + assetC_Thumb + '.webp',
        'published/certificates/' + assetC_D0 + '.webp',
        'published/certificates/' + assetC_D1 + '.webp'
      ]),
      certificates: [
        { id: 'cert-a', title: 'Published Cert A', date: '2026-01', description: 'Desc A', order_index: 0, active: true },
        { id: 'cert-b', title: 'Draft Only Cert B', date: '2026-02', description: 'Desc B', order_index: 1, active: true },
        { id: 'cert-c', title: 'Orphan Cert C', date: '2026-03', description: 'Desc C', order_index: 2, active: true }
      ],
      certificate_images: [
        { id: 'img-a-thumb', certificate_id: 'cert-a', role: 'thumbnail', order_index: 0, media_asset_id: assetA_Thumb, object_position: '50% 50%', placeholder_config: {} },
        { id: 'img-a-d0', certificate_id: 'cert-a', role: 'detail', order_index: 0, media_asset_id: assetA_D0, object_position: '50% 50%', placeholder_config: {} },
        { id: 'img-a-d1', certificate_id: 'cert-a', role: 'detail', order_index: 1, media_asset_id: assetA_D1, object_position: '50% 50%', placeholder_config: {} },
        { id: 'img-b-thumb', certificate_id: 'cert-b', role: 'thumbnail', order_index: 0, media_asset_id: assetB_Thumb, object_position: '50% 50%', placeholder_config: {} },
        { id: 'img-b-d0', certificate_id: 'cert-b', role: 'detail', order_index: 0, media_asset_id: assetB_D0, object_position: '50% 50%', placeholder_config: {} },
        { id: 'img-c-thumb', certificate_id: 'cert-c', role: 'thumbnail', order_index: 0, media_asset_id: assetC_Thumb, object_position: '50% 50%', placeholder_config: {} },
        { id: 'img-c-d0', certificate_id: 'cert-c', role: 'detail', order_index: 0, media_asset_id: assetC_D0, object_position: '50% 50%', placeholder_config: {} },
        { id: 'img-c-d1', certificate_id: 'cert-c', role: 'detail', order_index: 1, media_asset_id: assetC_D1, object_position: '50% 50%', placeholder_config: {} }
      ],
      media_assets: [
        assetA_Thumb, assetA_D0, assetA_D1,
        assetB_Thumb, assetB_D0,
        assetC_Thumb, assetC_D0, assetC_D1
      ].map((id) => ({ id, storage_bucket: 'portfolio-media', storage_path: 'published/certificates/' + id + '.webp', mime_type: 'image/webp', file_size: 1200, alt_text: id })),
      site_revisions: [
        {
          id: 'rev-pub-4', revision_number: 4, lock_version: 1, status: 'published',
          snapshot: publishedSnapshot, base_revision_number: 3, created_by: 'admin-1',
          created_at: '2026-11-10T10:00:00Z', updated_at: '2026-11-10T10:00:00Z',
          published_at: '2026-11-10T10:00:00Z', source_draft_revision_id: null,
          published_by: 'admin-1', publish_note: null, publication_kind: 'publish', rollback_source_revision_id: null
        },
        {
          id: 'rev-draft-5', revision_number: 5, lock_version: 2, status: 'draft',
          snapshot: draftSnapshot, base_revision_number: 4, created_by: 'admin-1',
          created_at: '2026-11-10T11:00:00Z', updated_at: '2026-11-10T11:00:00Z',
          published_at: null, source_draft_revision_id: null,
          published_by: null, publish_note: null, publication_kind: null, rollback_source_revision_id: null
        }
      ]
    };

    window.__certMockDb = db;
    const origFetch = window.__origFetch ?? window.fetch.bind(window);
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    const parseInList = (raw) => {
      const match = /^in\\.\\((.*)\\)$/.exec(raw ?? '');
      return match ? match[1].split(',').map((item) => item.replace(/^"|"$/g, '')) : [];
    };
    const isSingle = (init) => {
      const h = init?.headers;
      const accept = h instanceof Headers ? (h.get('Accept') ?? '') : String(h?.Accept ?? h?.accept ?? '');
      return accept.includes('application/vnd.pgrst.object+json');
    };
    const parseBody = (init) => {
      if (!init?.body) return null;
      return typeof init.body === 'string' ? JSON.parse(init.body) : null;
    };

    window.__mockFetchHandler = async (input, init = {}) => {
      const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
      if (!urlStr.includes('/rest/v1/') && !urlStr.includes('/storage/v1/')) return origFetch(input, init);
      const parsed = new URL(urlStr);
      const method = (init.method ?? (input instanceof Request ? input.method : null) ?? 'GET').toUpperCase();
      const body = parseBody(init);
      const p = parsed.pathname;

      if (p.includes('/storage/v1/object/portfolio-media')) {
        if (method === 'DELETE') {
          const paths = body?.prefixes ?? [];
          for (const pathItem of paths) {
            db.storageObjects.delete(pathItem);
            db.deletedStoragePaths.push(pathItem);
          }
          return json(paths.map((name) => ({ name })));
        }
        const objectPath = p.split('/storage/v1/object/portfolio-media/')[1] ?? '';
        db.storageObjects.add(decodeURIComponent(objectPath));
        return json({ Key: 'portfolio-media/' + objectPath });
      }

      if (p.endsWith('/rest/v1/admin_memberships')) return json([{ user_id: 'admin-1' }]);
      if (p.endsWith('/rest/v1/rpc/get_active_published_snapshot')) {
        const active = db.site_revisions.filter((r) => r.status === 'published').sort((a, b) => b.revision_number - a.revision_number);
        return json(active.slice(0, 1));
      }
      if (p.endsWith('/rest/v1/rpc/save_editor_draft')) {
        const idx = db.site_revisions.findIndex((r) => r.id === body.p_draft_id);
        if (idx < 0) return json({ message: 'Draft revision was not found.' }, 404);
        db.site_revisions[idx] = {
          ...db.site_revisions[idx],
          snapshot: body.p_snapshot,
          lock_version: db.site_revisions[idx].lock_version + 1,
          updated_at: new Date().toISOString()
        };
        return json([db.site_revisions[idx]]);
      }

      if (p.endsWith('/rest/v1/site_revisions')) {
        const statusParam = parsed.searchParams.get('status');
        if (db.failSiteRevisionsLookup && statusParam?.startsWith('in.')) return json({ message: 'simulated db outage' }, 500);
        let rows = [...db.site_revisions];
        if (statusParam?.startsWith('eq.')) rows = rows.filter((r) => r.status === statusParam.slice(3));
        else if (statusParam?.startsWith('in.')) {
          const statuses = parseInList(statusParam);
          rows = rows.filter((r) => statuses.includes(r.status));
        }
        const idParam = parsed.searchParams.get('id');
        if (idParam?.startsWith('eq.')) rows = rows.filter((r) => r.id === idParam.slice(3));
        return json(rows);
      }

      if (p.endsWith('/rest/v1/certificates')) {
        if (method === 'GET') return json([...db.certificates].sort((a, b) => a.order_index - b.order_index));
        if (method === 'PATCH') {
          const id = parsed.searchParams.get('id')?.slice(3);
          const idx = db.certificates.findIndex((c) => c.id === id);
          if (idx >= 0) db.certificates[idx] = { ...db.certificates[idx], ...body };
          return json(isSingle(init) ? db.certificates[idx] : [db.certificates[idx]]);
        }
        if (method === 'POST') {
          const row = Array.isArray(body) ? body[0] : body;
          db.certificates.push(row);
          return json(isSingle(init) ? row : [row], 201);
        }
        if (method === 'DELETE') {
          const id = parsed.searchParams.get('id')?.slice(3);
          db.certificates = db.certificates.filter((c) => c.id !== id);
          return json([]);
        }
      }

      if (p.endsWith('/rest/v1/certificate_images')) {
        if (method === 'GET') {
          let rows = [...db.certificate_images];
          const inAsset = parsed.searchParams.get('media_asset_id');
          if (inAsset?.startsWith('in.')) {
            const ids = parseInList(inAsset);
            rows = rows.filter((img) => ids.includes(img.media_asset_id));
          }
          return json(rows.sort((a, b) => a.order_index - b.order_index));
        }
        if (method === 'POST') {
          const items = Array.isArray(body) ? body : [body];
          for (const item of items) {
            const clash = db.certificate_images.some((existing) =>
              existing.certificate_id === item.certificate_id
              && existing.role === item.role
              && existing.order_index === item.order_index
            );
            if (clash) {
              return json({
                code: '23505',
                message: 'duplicate key value violates unique constraint "certificate_images_certificate_id_role_order_index_key"'
              }, 409);
            }
            db.certificate_images.push(item);
          }
          return json(items, 201);
        }
        if (method === 'DELETE') {
          const eqId = parsed.searchParams.get('id');
          const inId = eqId?.startsWith('in.') ? parseInList(eqId) : null;
          const certEq = parsed.searchParams.get('certificate_id');
          db.certificate_images = db.certificate_images.filter((img) => {
            if (eqId?.startsWith('eq.') && img.id === eqId.slice(3)) return false;
            if (inId && inId.includes(img.id)) return false;
            if (certEq?.startsWith('eq.') && img.certificate_id === certEq.slice(3)) return false;
            return true;
          });
          return json([]);
        }
      }

      if (p.endsWith('/rest/v1/entity_media') || p.endsWith('/rest/v1/photo_frames')) {
        return json([]);
      }

      if (p.endsWith('/rest/v1/media_assets')) {
        if (method === 'GET') {
          let rows = [...db.media_assets];
          const idParam = parsed.searchParams.get('id');
          if (idParam?.startsWith('in.')) {
            const ids = parseInList(idParam);
            rows = rows.filter((row) => ids.includes(row.id));
          }
          return json(rows);
        }
        if (method === 'POST') {
          const rows = Array.isArray(body) ? body : [body];
          db.media_assets.push(...rows);
          return json(rows, 201);
        }
        if (method === 'DELETE') {
          const id = parsed.searchParams.get('id')?.slice(3);
          db.media_assets = db.media_assets.filter((row) => row.id !== id);
          if (id) db.deletedMediaAssetIds.push(id);
          return json([]);
        }
      }

      return json([]);
    };

    const session = {
      access_token: 'jwt-cert-admin',
      refresh_token: 'refresh-cert',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'admin-1', email: 'admin@example.com' }
    };
    clientMod.supabaseClient.auth.getSession = async () => ({ data: { session }, error: null });
    const auth = authStoreMod.useAuthStore();
    auth.$patch({ session, isAdmin: true, isInitialized: true, isLoading: false });
  })()`)

  await evaluate(`location.hash = '#/admin/certificates'`)
  try {
    await waitFor(`document.querySelectorAll('.cert-item').length === 3`)
  } catch (err) {
    const diag = await evaluate(`({ hash: location.hash, text: document.body?.innerText?.slice(0, 500) })`).catch(() => ({}))
    throw new Error(`${err.message} | diag=${JSON.stringify(diag)} | exceptions=${runtimeExceptions.join(' ; ')}`)
  }

  // Helper to attach mock WEBP files inside the edit modal
  const editCertScenario = await evaluate(`(async () => {
    const db = window.__certMockDb;
    const cards = Array.from(document.querySelectorAll('.cert-item'));
    const findCard = (title) => cards.find((el) => el.querySelector('h3')?.textContent?.includes(title));

    // --- Scenario 1: Edit Cert A (currently live in Published #4), remove detail[0] & replace thumbnail + add new detail ---
    findCard('Published Cert A').querySelector('.edit-btn').click();
    await new Promise((r) => setTimeout(r, 80));

    // Remove detail #1 (order_index 0: assetA_D0)
    document.querySelectorAll('.selected-file-item .remove-file-btn')[0].click();
    await new Promise((r) => setTimeout(r, 40));

    const fileInputs = Array.from(document.querySelectorAll('.modal-content input[type="file"]'));
    const setFiles = (input, files) => {
      const dt = new DataTransfer();
      for (const f of files) dt.items.add(f);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    setFiles(fileInputs[0], [new File([new Uint8Array([82, 73, 70, 70])], 'new-thumb-a.webp', { type: 'image/webp' })]);
    setFiles(fileInputs[1], [new File([new Uint8Array([82, 73, 70, 70])], 'new-detail-a.webp', { type: 'image/webp' })]);
    document.querySelector('.modal-content button[type="submit"]').click();

    for (let i = 0; i < 80; i++) {
      if (!document.querySelector('.modal-content')) break;
      const errText = document.querySelector('.error-msg')?.textContent?.trim();
      if (errText) throw new Error('Cert A edit failed: ' + errText);
      await new Promise((r) => setTimeout(r, 50));
    }
    if (document.querySelector('.modal-content')) throw new Error('Cert A modal stayed open');

    const certADetails = db.certificate_images.filter((img) => img.certificate_id === 'cert-a' && img.role === 'detail');
    const certAThumb = db.certificate_images.find((img) => img.certificate_id === 'cert-a' && img.role === 'thumbnail');
    db.certANewAssetIds = [certAThumb?.media_asset_id, ...certADetails.filter((d) => d.order_index === 2).map((d) => d.media_asset_id)].filter(Boolean);
    const scenario1 = {
      orderIndices: certADetails.map((d) => d.order_index),
      publishedThumbRetained: db.storageObjects.has('published/certificates/aaaaaaaa-0000-4000-8000-000000000001.webp'),
      publishedDetail0Retained: db.storageObjects.has('published/certificates/aaaaaaaa-0000-4000-8000-000000000002.webp'),
      deletedMediaCountAfterA: db.deletedMediaAssetIds.length
    };

    // --- Scenario 2: Edit Cert C (NOT in Published/Draft), remove detail[0] & add new detail ---
    const cards2 = Array.from(document.querySelectorAll('.cert-item'));
    cards2.find((el) => el.querySelector('h3')?.textContent?.includes('Orphan Cert C')).querySelector('.edit-btn').click();
    await new Promise((r) => setTimeout(r, 80));
    document.querySelectorAll('.selected-file-item .remove-file-btn')[0].click();
    await new Promise((r) => setTimeout(r, 40));
    const cInputs = Array.from(document.querySelectorAll('.modal-content input[type="file"]'));
    setFiles(cInputs[1], [new File([new Uint8Array([82, 73, 70, 70])], 'new-detail-c.webp', { type: 'image/webp' })]);
    document.querySelector('.modal-content button[type="submit"]').click();

    for (let i = 0; i < 80; i++) {
      if (!document.querySelector('.modal-content')) break;
      const errText = document.querySelector('.error-msg')?.textContent?.trim();
      if (errText) throw new Error('Cert C edit failed: ' + errText);
      await new Promise((r) => setTimeout(r, 50));
    }

    const certCDetails = db.certificate_images.filter((img) => img.certificate_id === 'cert-c' && img.role === 'detail');
    const scenario2 = {
      orderIndices: certCDetails.map((d) => d.order_index),
      unreferencedDetailDeleted: !db.storageObjects.has('published/certificates/cccccccc-0000-4000-8000-000000000002.webp')
        && db.deletedMediaAssetIds.includes('cccccccc-0000-4000-8000-000000000002')
    };

    return { scenario1, scenario2 };
  })()`)

  // Scenario 3: Delete Cert A -> verify BOTH Published #4 & Draft #5 modal warnings + Published retention
  const deleteAScenario = await evaluate(`(async () => {
    const db = window.__certMockDb;
    const cards = Array.from(document.querySelectorAll('.cert-item'));
    cards.find((el) => el.querySelector('h3')?.textContent?.includes('Published Cert A')).querySelector('.delete-btn').click();

    for (let i = 0; i < 60; i++) {
      if (document.querySelector('.delete-confirm-modal')) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    const pubWarning = document.querySelector('.delete-published-warning')?.textContent ?? '';
    const draftWarning = document.querySelector('.delete-draft-warning')?.textContent ?? '';
    const confirmLabel = document.querySelector('.danger-confirm-btn')?.textContent?.trim() ?? '';

    document.querySelector('.danger-confirm-btn').click();
    for (let i = 0; i < 60; i++) {
      if (!document.querySelector('.delete-confirm-modal') && document.querySelectorAll('.cert-item').length === 2) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    const draftRev = db.site_revisions.find((r) => r.id === 'rev-draft-5');
    return {
      pubWarningHasRev4: pubWarning.includes('Revisi #4'),
      pubWarningExplainsUpdatePublish: pubWarning.includes('Update ke Draf') && pubWarning.includes('Publish ulang'),
      pubWarningMentions404: pubWarning.includes('404'),
      draftWarningHasDraft5: draftWarning.includes('Draf #5'),
      confirmLabel,
      draftPrunedCertA: !draftRev.snapshot.certificateCards.some((c) => c.id === 'cert-a'),
      draftStillHasCertB: draftRev.snapshot.certificateCards.some((c) => c.id === 'cert-b'),
      publishedDetail1Retained: db.storageObjects.has('published/certificates/aaaaaaaa-0000-4000-8000-000000000003.webp'),
      publishedThumbRetained: db.storageObjects.has('published/certificates/aaaaaaaa-0000-4000-8000-000000000001.webp'),
      newUnpublishedEditAssetsDeleted: db.certANewAssetIds.every((id) =>
        db.deletedMediaAssetIds.includes(id) && !db.storageObjects.has('published/certificates/' + id + '.webp')
      )
    };
  })()`)

  // Scenario 4: Delete Cert B (Draft-only) -> verify NO published warning, Draft pruned FIRST, Storage objects cleaned up!
  const deleteBScenario = await evaluate(`(async () => {
    const db = window.__certMockDb;
    const cards = Array.from(document.querySelectorAll('.cert-item'));
    cards.find((el) => el.querySelector('h3')?.textContent?.includes('Draft Only Cert B')).querySelector('.delete-btn').click();

    for (let i = 0; i < 60; i++) {
      if (document.querySelector('.delete-confirm-modal')) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    const hasPubWarning = Boolean(document.querySelector('.delete-published-warning'));
    const draftWarning = document.querySelector('.delete-draft-warning')?.textContent ?? '';
    document.querySelector('.danger-confirm-btn').click();
    for (let i = 0; i < 60; i++) {
      if (!document.querySelector('.delete-confirm-modal') && document.querySelectorAll('.cert-item').length === 1) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    return {
      hasPubWarning,
      draftWarningHasDraft5: draftWarning.includes('Draf #5'),
      draftBAssetsDeleted: !db.storageObjects.has('published/certificates/bbbbbbbb-0000-4000-8000-000000000001.webp')
        && !db.storageObjects.has('published/certificates/bbbbbbbb-0000-4000-8000-000000000002.webp')
        && db.deletedMediaAssetIds.includes('bbbbbbbb-0000-4000-8000-000000000001')
        && db.deletedMediaAssetIds.includes('bbbbbbbb-0000-4000-8000-000000000002')
    };
  })()`)

  // Scenario 5: Fail-closed safety -> site_revisions lookup outage during Cert C deletion retains Cert C assets instead of wiping Storage
  const failClosedScenario = await evaluate(`(async () => {
    const db = window.__certMockDb;
    const cards = Array.from(document.querySelectorAll('.cert-item'));
    cards.find((el) => el.querySelector('h3')?.textContent?.includes('Orphan Cert C')).querySelector('.delete-btn').click();

    for (let i = 0; i < 60; i++) {
      if (document.querySelector('.delete-confirm-modal')) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    db.failSiteRevisionsLookup = true;
    document.querySelector('.danger-confirm-btn').click();
    for (let i = 0; i < 60; i++) {
      if (!document.querySelector('.delete-confirm-modal') && document.querySelector('.empty-state')) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    return {
      retainedThumbOnLookupOutage: db.storageObjects.has('published/certificates/cccccccc-0000-4000-8000-000000000001.webp'),
      retainedDetail1OnLookupOutage: db.storageObjects.has('published/certificates/cccccccc-0000-4000-8000-000000000003.webp')
    };
  })()`)

  console.log(JSON.stringify({ editCertScenario, deleteAScenario, deleteBScenario, failClosedScenario }, null, 2))

  assert(JSON.stringify(editCertScenario.scenario1.orderIndices) === '[1,2]', 'Cert A detail order_index collision not resolved')
  assert(editCertScenario.scenario1.publishedThumbRetained && editCertScenario.scenario1.publishedDetail0Retained, 'Published Cert A assets were mistakenly deleted on edit')
  assert(editCertScenario.scenario1.deletedMediaCountAfterA === 0, 'Expected zero media deletions for Published Cert A assets')

  assert(JSON.stringify(editCertScenario.scenario2.orderIndices) === '[1,2]', 'Cert C detail order_index should be [1,2]')
  assert(editCertScenario.scenario2.unreferencedDetailDeleted, 'Unreferenced Cert C detail asset should be deleted')

  assert(deleteAScenario.pubWarningHasRev4 && deleteAScenario.pubWarningExplainsUpdatePublish && deleteAScenario.pubWarningMentions404, 'Published warning modal content incomplete')
  assert(deleteAScenario.draftWarningHasDraft5 && deleteAScenario.confirmLabel === 'Tetap Hapus', 'Draft warning / confirm label mismatch')
  assert(deleteAScenario.draftPrunedCertA && deleteAScenario.draftStillHasCertB, 'Draft pruning failed for Cert A')
  assert(deleteAScenario.publishedThumbRetained && deleteAScenario.publishedDetail1Retained, 'Published Cert A Storage assets should stay intact after delete')
  assert(deleteAScenario.newUnpublishedEditAssetsDeleted, 'Newly uploaded unreferenced assets on Cert A should be cleaned up on delete')

  assert(!deleteBScenario.hasPubWarning && deleteBScenario.draftWarningHasDraft5, 'Draft-only Cert B modal flags incorrect')
  assert(deleteBScenario.draftBAssetsDeleted, 'Draft-only Cert B assets leaked instead of being deleted after draft prune')

  assert(failClosedScenario.retainedThumbOnLookupOutage && failClosedScenario.retainedDetail1OnLookupOutage, 'Fail-closed check failed on site_revisions outage')
  assert(runtimeExceptions.length === 0, `Runtime exceptions detected: ${runtimeExceptions.join('; ')}`)

  if (viteErrors.trim()) throw new Error(`Vite stderr: ${viteErrors}`)
  if (browserErrors.trim()) console.warn(browserErrors)
  console.log(JSON.stringify({ status: 'PASS', scope: 'admin-certificates-retention-runtime' }))
} finally {
  socket?.close()
  stopChildren()
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}
