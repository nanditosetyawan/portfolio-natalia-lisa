import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5201'
const cdpPort = 9361
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')

const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-rollback-numbering-'))
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
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5201', '--strictPort'],
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
      const __origFetch = window.fetch.bind(window);
      window.__origFetch = __origFetch;
      window.fetch = (...args) => window.__mockFetchHandler ? window.__mockFetchHandler(...args) : __origFetch(...args);
    `
  })
  await send('Page.navigate', { url: `${baseUrl}/#/admin/login` })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)

  const inMemoryResult = await evaluate(`(async () => {
    const repoMod = await import('/src/repositories/editorRevisionRepository.ts');
    const snapshotMod = await import('/src/editor/editorSnapshot.ts');
    const siteMod = await import('/src/data/default/site.ts');

    const base = snapshotMod.createEditorSnapshot(siteMod.createDefaultSiteSnapshot());

    // Case 1: Publish #1 -> Publish #2 -> Draft #3 exists -> Rollback to #1 must allocate #4 (not collide with Draft #3)
    const repoWithHigherDraft = new repoMod.InMemoryEditorRevisionRepository('admin-rollback-test');
    repoWithHigherDraft.seedPublished({ ...structuredClone(base), content: { ...base.content, portfolio: { ...base.content.portfolio, title: 'Published V1' } } }, 1);
    repoWithHigherDraft.seedPublished({ ...structuredClone(base), content: { ...base.content, portfolio: { ...base.content.portfolio, title: 'Published V2' } } }, 2);
    const higherDraft = await repoWithHigherDraft.saveDraft({
      snapshot: { ...structuredClone(base), content: { ...base.content, portfolio: { ...base.content.portfolio, title: 'Draft V3 Unreleased' } } },
      mediaReferences: [],
      expectedBaseRevision: 2,
      createNew: true
    });
    const pub1 = (await repoWithHigherDraft.getHistory()).find((r) => r.revision_number === 1);
    const rolled = await repoWithHigherDraft.rollbackRevision({
      targetRevisionId: pub1.id,
      expectedPublishedRevision: 2,
      note: 'rollback while draft #3 exists'
    });
    const draftAfter = await repoWithHigherDraft.loadDraft(higherDraft.revision.id);
    const activeAfter = await repoWithHigherDraft.loadPublishedSnapshot();

    // Case 2: Classic sequence without extra draft still yields 3
    const repoClassic = new repoMod.InMemoryEditorRevisionRepository('admin-classic');
    const d1 = await repoClassic.saveDraft({ snapshot: structuredClone(base), mediaReferences: [], expectedBaseRevision: null, createNew: true });
    const p1 = await repoClassic.publishDraft({ draftRevisionId: d1.revision.id, expectedPublishedRevision: null, expectedDraftLockVersion: d1.revision.lock_version, note: 'p1' });
    const d1b = await repoClassic.saveDraft({ snapshot: structuredClone(base), mediaReferences: [], expectedBaseRevision: p1.revision_number, expectedDraftLockVersion: d1.revision.lock_version, draftRevisionId: d1.revision.id });
    const p2 = await repoClassic.publishDraft({ draftRevisionId: d1.revision.id, expectedPublishedRevision: p1.revision_number, expectedDraftLockVersion: d1b.revision.lock_version, note: 'p2' });
    const rbClassic = await repoClassic.rollbackRevision({ targetRevisionId: p1.id, expectedPublishedRevision: p2.revision_number });

    return {
      higherDraftNumber: higherDraft.revision.revision_number,
      rolledNumber: rolled.revision_number,
      draftUntouchedTitle: draftAfter?.revision.snapshot.content.portfolio.title,
      activeTitle: activeAfter?.snapshot.content.portfolio.title,
      classicRollbackNumber: rbClassic.revision_number
    };
  })()`)
  assert(
    inMemoryResult.higherDraftNumber === 3
      && inMemoryResult.rolledNumber === 4
      && inMemoryResult.draftUntouchedTitle === 'Draft V3 Unreleased'
      && inMemoryResult.activeTitle === 'Published V1'
      && inMemoryResult.classicRollbackNumber === 3,
    `InMemoryEditorRevisionRepository rollback numbering failed: ${JSON.stringify(inMemoryResult)}`
  )

  // Install stateful mock implementing 0028 + 0033 Postgres semantics and Supabase Storage API
  await evaluate(`(async () => {
    const authStore = (await import('/src/stores/auth.ts')).useAuthStore();
    const restMod = await import('/src/lib/supabaseRest.ts');
    const clientMod = await import('/src/lib/supabaseClient.ts');

    const adminId = '11111111-1111-4111-8111-111111111111';
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);

    const db = {
      site_revisions: [],
      storage: new Map(),
      storageWrites: [],
      rpcCalls: []
    };
    window.__rollbackFixMock = db;

    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    const parseJsonBody = (init) => {
      if (!init?.body || typeof init.body !== 'string') return null;
      return JSON.parse(init.body);
    };
    const globalMaxRevision = () => db.site_revisions.reduce((m, r) => Math.max(m, Number(r.revision_number)), 0);
    const currentPublishedRevision = () => {
      const pubs = db.site_revisions.filter((r) => r.status === 'published').sort((a, b) => b.revision_number - a.revision_number);
      return pubs[0]?.revision_number ?? null;
    };

    const origFetch = window.__origFetch ?? window.fetch.bind(window);
    window.__mockFetchHandler = async (input, init = {}) => {
      const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
      if (!urlStr.startsWith('https://mock-supabase.local')) return origFetch(input, init);

      const parsed = new URL(urlStr);
      const p = parsed.pathname;
      const method = (init.method ?? (input instanceof Request ? input.method : null) ?? 'GET').toUpperCase();

      if (p.endsWith('/rest/v1/admin_memberships')) return json([{ user_id: adminId }]);

      if (p === '/storage/v1/object/copy' && method === 'POST') {
        const body = parseJsonBody(init);
        const src = db.storage.get(body.sourceKey);
        if (!src) return json({ error: 'Not found', message: 'Source object missing' }, 404);
        db.storage.set(body.destinationKey, { bytes: src.bytes, mimeType: src.mimeType });
        db.storageWrites.push({ op: 'copy', from: body.sourceKey, path: body.destinationKey });
        return json({ Key: 'portfolio-media/' + body.destinationKey });
      }

      if (p.startsWith('/storage/v1/object/public/portfolio-media/')) {
        const objectPath = decodeURIComponent(p.slice('/storage/v1/object/public/portfolio-media/'.length));
        const item = db.storage.get(objectPath);
        if (!item) return json({ error: 'Not found' }, 404);
        return new Response(item.bytes, { status: 200, headers: { 'Content-Type': item.mimeType } });
      }

      if (p.startsWith('/storage/v1/object/portfolio-media/')) {
        const objectPath = decodeURIComponent(p.slice('/storage/v1/object/portfolio-media/'.length));
        if (method === 'GET') {
          const item = db.storage.get(objectPath);
          if (!item) return json({ error: 'Not found' }, 404);
          return new Response(item.bytes, { status: 200, headers: { 'Content-Type': item.mimeType } });
        }
        if (method === 'POST' || method === 'PUT') {
          let mimeType = 'image/png';
          let bytes = pngBytes;
          if (init.body instanceof FormData) {
            const fileEntry = [...init.body.values()].find((v) => v instanceof Blob);
            if (fileEntry) {
              if (fileEntry.type) mimeType = fileEntry.type;
              bytes = new Uint8Array(await fileEntry.arrayBuffer());
            }
          } else if (init.body instanceof Blob) {
            if (init.body.type) mimeType = init.body.type;
            bytes = new Uint8Array(await init.body.arrayBuffer());
          }
          db.storage.set(objectPath, { bytes, mimeType });
          db.storageWrites.push({ op: 'upload', path: objectPath });
          return json({ Key: 'portfolio-media/' + objectPath });
        }
      }

      if (p.endsWith('/rest/v1/rpc/save_editor_draft') && method === 'POST') {
        const body = parseJsonBody(init);
        db.rpcCalls.push('save_editor_draft');
        if (body.p_draft_id) {
          const idx = db.site_revisions.findIndex((r) => r.id === body.p_draft_id && r.status === 'draft');
          if (idx < 0) return json({ message: 'Draft revision was not found.' }, 404);
          if (db.site_revisions[idx].lock_version !== body.p_expected_lock_version) {
            return json({ code: 'PT409', message: 'The Draft changed since it was loaded. Reload the latest Draft.' }, 409);
          }
          db.site_revisions[idx] = {
            ...db.site_revisions[idx],
            snapshot: body.p_snapshot,
            base_revision_number: body.p_expected_base_revision,
            lock_version: db.site_revisions[idx].lock_version + 1,
            updated_at: new Date().toISOString()
          };
          return json([db.site_revisions[idx]]);
        }
        const nextRev = globalMaxRevision() + 1;
        const now = new Date().toISOString();
        const created = {
          id: crypto.randomUUID(),
          revision_number: nextRev,
          lock_version: 1,
          status: 'draft',
          snapshot: body.p_snapshot,
          base_revision_number: body.p_expected_base_revision,
          created_by: adminId,
          created_at: now,
          updated_at: now,
          published_at: null,
          source_draft_revision_id: null,
          published_by: null,
          publish_note: null,
          publication_kind: null,
          rollback_source_revision_id: null
        };
        db.site_revisions.push(created);
        return json([created]);
      }

      if (p.endsWith('/rest/v1/rpc/publish_editor_draft') && method === 'POST') {
        const body = parseJsonBody(init);
        db.rpcCalls.push('publish_editor_draft');
        const currentPub = currentPublishedRevision();
        if (currentPub !== body.p_expected_published_revision) {
          return json({ code: 'PT409', message: 'The Published revision changed while this Draft was being prepared.' }, 409);
        }
        const draftRow = db.site_revisions.find((r) => r.id === body.p_draft_id && r.status === 'draft');
        if (!draftRow) return json({ message: 'Draft revision was not found.' }, 404);
        if (draftRow.lock_version !== body.p_expected_draft_lock_version) {
          return json({ code: 'PT409', message: 'The Draft changed while Publish was being prepared.' }, 409);
        }
        const refs = body.p_prepared_snapshot?.media?.references ?? [];
        for (const ref of refs) {
          if (typeof ref.storagePath !== 'string' || !ref.storagePath.startsWith('published/') || !db.storage.has(ref.storagePath)) {
            return json({ message: 'Prepared Published media object missing or outside published/*: ' + ref.storagePath }, 400);
          }
        }
        const nextRev = globalMaxRevision() + 1;
        const now = new Date().toISOString();
        const publishedRow = {
          id: crypto.randomUUID(),
          revision_number: nextRev,
          lock_version: 1,
          status: 'published',
          snapshot: body.p_prepared_snapshot,
          base_revision_number: currentPub,
          created_by: adminId,
          created_at: now,
          updated_at: now,
          published_at: now,
          source_draft_revision_id: draftRow.id,
          published_by: adminId,
          publish_note: body.p_note ?? null,
          publication_kind: 'publish',
          rollback_source_revision_id: null
        };
        db.site_revisions.push(publishedRow);
        return json([publishedRow]);
      }

      if (p.endsWith('/rest/v1/rpc/rollback_published_revision') && method === 'POST') {
        const body = parseJsonBody(init);
        db.rpcCalls.push('rollback_published_revision');
        const currentPub = currentPublishedRevision();
        if (currentPub !== body.p_expected_published_revision) {
          return json({ code: 'PT409', message: 'The Published revision changed before Rollback could activate.' }, 409);
        }
        const target = db.site_revisions.find((r) => r.id === body.p_target_revision_id && r.status === 'published');
        if (!target) return json({ message: 'Published revision was not found.' }, 404);
        if (currentPub === null || target.revision_number >= currentPub) {
          return json({ message: 'Rollback must select an older Published revision.' }, 400);
        }
        // Mirror 0033 fix: allocate global max(revision_number) + 1 across ALL statuses
        const nextRev = globalMaxRevision() + 1;
        if (db.site_revisions.some((r) => r.revision_number === nextRev)) {
          return json({ code: '23505', message: 'duplicate revision_number collision' }, 409);
        }
        const now = new Date().toISOString();
        const rolledRow = {
          id: crypto.randomUUID(),
          revision_number: nextRev,
          lock_version: 1,
          status: 'published',
          snapshot: structuredClone(target.snapshot),
          base_revision_number: currentPub,
          created_by: adminId,
          created_at: now,
          updated_at: now,
          published_at: now,
          source_draft_revision_id: target.source_draft_revision_id,
          published_by: adminId,
          publish_note: body.p_note ?? null,
          publication_kind: 'rollback',
          rollback_source_revision_id: target.id
        };
        db.site_revisions.push(rolledRow);
        return json([rolledRow]);
      }

      if (p.endsWith('/rest/v1/rpc/get_active_published_snapshot')) {
        const pubs = db.site_revisions.filter((r) => r.status === 'published').sort((a, b) => b.revision_number - a.revision_number);
        return json(pubs.slice(0, 1));
      }

      if (p.endsWith('/rest/v1/site_revisions')) {
        let rows = [...db.site_revisions];
        const statusParam = parsed.searchParams.get('status');
        if (statusParam?.startsWith('eq.')) rows = rows.filter((r) => r.status === statusParam.slice(3));
        const idParam = parsed.searchParams.get('id');
        if (idParam?.startsWith('eq.')) rows = rows.filter((r) => r.id === idParam.slice(3));
        if (parsed.searchParams.get('order') === 'revision_number.desc') {
          rows.sort((a, b) => b.revision_number - a.revision_number);
        } else {
          rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        }
        const limit = Number(parsed.searchParams.get('limit') ?? 0);
        if (limit > 0) rows = rows.slice(0, limit);
        return json(rows);
      }

      return json([]);
    };

    // Establish authenticated admin session cleanly
    const session = {
      access_token: 'mock-admin-jwt',
      refresh_token: 'mock-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: adminId, email: 'admin@test.invalid' }
    };
    clientMod.supabaseClient.auth.getSession = async () => ({ data: { session }, error: null });
    restMod.setSupabaseAccessToken('mock-admin-jwt');
    authStore.$patch({ session, isAdmin: true, isInitialized: true, isLoading: false });
  })()`)

  // Execute Draft -> Publish -> Edit -> Publish -> Newer Draft -> UI Rollback end-to-end
  const pipelineData = await evaluate(`(async () => {
    const repoMod = await import('/src/repositories/editorRevisionRepository.ts');
    const snapshotMod = await import('/src/editor/editorSnapshot.ts');
    const siteMod = await import('/src/data/default/site.ts');

    const base = snapshotMod.createEditorSnapshot(siteMod.createDefaultSiteSnapshot());
    const pngBlob = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4])], { type: 'image/png' });
    const pngFile = new File([pngBlob], 'hero-one.png', { type: 'image/png' });

    // Step 1: Upload Draft media + Save Draft (#1)
    const uploadedDraftMedia = await repoMod.editorDraftRepository.uploadDraftMedia(pngFile, 'draft-scope-one');
    const snap1 = structuredClone(base);
    snap1.content.portfolio.title = 'VERSION ONE TITLE';
    // Keep profile usage pointing to an image ref with our uploaded draft media
    const profileRef = snap1.media.references.find((r) => {
      const assignment = snap1.media.assignments.find((a) => a.entityId === snap1.content.profile.mediaUsageId);
      return assignment && r.assetId === assignment.assetId;
    });
    if (profileRef) {
      profileRef.uri = uploadedDraftMedia.storagePath;
      profileRef.bucket = uploadedDraftMedia.bucket;
      profileRef.storagePath = uploadedDraftMedia.storagePath;
      profileRef.mimeType = 'image/png';
    }
    const draft1 = await repoMod.editorDraftRepository.saveDraft({
      snapshot: snap1,
      mediaReferences: [uploadedDraftMedia],
      expectedBaseRevision: null,
      createNew: true
    });

    // Step 2: Publish Draft #1 when expectedPublishedRevision === null (0028 DB gives rev #2!)
    const pubOne = await repoMod.editorPublishRepository.publishDraft({
      draftRevisionId: draft1.revision.id,
      expectedPublishedRevision: null,
      expectedDraftLockVersion: draft1.revision.lock_version,
      note: 'first release'
    });
    const pubOneWritesAfter = window.__rollbackFixMock.storageWrites.map((w) => ({ ...w }));

    // Step 3: Save edit on Draft #1 -> Publish second revision (DB gives rev #3!)
    const snap2 = structuredClone(snap1);
    snap2.content.portfolio.title = 'VERSION TWO TITLE';
    const draft1b = await repoMod.editorDraftRepository.saveDraft({
      snapshot: snap2,
      mediaReferences: [uploadedDraftMedia],
      expectedBaseRevision: pubOne.revision_number,
      expectedDraftLockVersion: draft1.revision.lock_version,
      draftRevisionId: draft1.revision.id
    });
    const pubTwo = await repoMod.editorPublishRepository.publishDraft({
      draftRevisionId: draft1.revision.id,
      expectedPublishedRevision: pubOne.revision_number,
      expectedDraftLockVersion: draft1b.revision.lock_version,
      note: 'second release'
    });

    // Step 4: Create a NEW Draft BEFORE triggering Rollback (DB gives Draft #4!)
    const snap4 = structuredClone(snap2);
    snap4.content.portfolio.title = 'DRAFT FOUR UNPUBLISHED';
    const draft4 = await repoMod.editorDraftRepository.saveDraft({
      snapshot: snap4,
      mediaReferences: [uploadedDraftMedia],
      expectedBaseRevision: pubTwo.revision_number,
      createNew: true
    });

    return {
      draft1Rev: draft1.revision.revision_number,
      pubOneRev: pubOne.revision_number,
      pubOnePaths: pubOne.snapshot.media.references.map((r) => r.storagePath),
      pubTwoRev: pubTwo.revision_number,
      draft4Rev: draft4.revision.revision_number,
      storageWrites: pubOneWritesAfter,
      profileRefId: profileRef?.assetId ?? null
    };
  })()`)

  const uuidPublishedRegex = /^published\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+$/
  const promotedProfileWrite = pipelineData.storageWrites.find((w) => w.op === 'copy' && w.path.includes(pipelineData.profileRefId))
  assert(
    pipelineData.draft1Rev === 1
      && pipelineData.pubOneRev === 2
      && pipelineData.pubTwoRev === 3
      && pipelineData.draft4Rev === 4,
    `Unexpected revision sequence before Rollback: ${JSON.stringify(pipelineData)}`
  )
  assert(
    promotedProfileWrite && uuidPublishedRegex.test(promotedProfileWrite.path) && !promotedProfileWrite.path.startsWith('published/1/'),
    `publishDraft still used guessed revision folder or wrong Storage path: ${JSON.stringify(pipelineData.storageWrites)}`
  )
  assert(
    pipelineData.pubOnePaths.every((p) => uuidPublishedRegex.test(p)),
    `Published snapshot media references did not use attemptId prefix: ${JSON.stringify(pipelineData.pubOnePaths)}`
  )

  // Step 5: Navigate to /admin/published in Chrome & execute Rollback via real UI
  await evaluate(`(async () => {
    const router = (await import('/src/router/index.ts')).default;
    await router.push({ name: 'admin-published' });
    return true;
  })()`)
  await waitFor(`document.querySelectorAll('.history-card').length === 2`)
  await evaluate(`(() => {
    const card = [...document.querySelectorAll('.history-card')].find((el) => el.querySelector('h2')?.textContent.includes('Revision 2'));
    card.querySelector('.rollback-button').click();
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.rollback-modal'))`)
  await evaluate(`(() => {
    const note = document.querySelector('#rollback-note');
    note.value = 'rollback past draft 4';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.rollback-confirm').click();
    return true;
  })()`)
  await waitFor(`document.querySelector('.current-badge')?.textContent.includes('#5') && !document.querySelector('.rollback-modal')`)

  const postRollback = await evaluate(`(async () => {
    const repoMod = await import('/src/repositories/editorRevisionRepository.ts');
    const db = window.__rollbackFixMock;
    const allNumbers = db.site_revisions.map((r) => r.revision_number);
    const active = await repoMod.guestPublishedRepository.loadPublishedSnapshot();
    const draft4Row = db.site_revisions.find((r) => r.revision_number === 4);

    // Also confirm stale PT409 guard still surfaces PublishConflictError
    let conflictCaught = false;
    try {
      await repoMod.editorPublishRepository.rollbackRevision({
        targetRevisionId: active.revision.rollback_source_revision_id,
        expectedPublishedRevision: 3,
        note: 'stale expected'
      });
    } catch (err) {
      conflictCaught = err instanceof repoMod.PublishConflictError;
    }

    return {
      uiBadge: document.querySelector('.current-badge')?.textContent.trim(),
      uiStatus: document.querySelector('.history-status')?.textContent.trim(),
      rows: db.site_revisions.map((r) => ({ rev: r.revision_number, status: r.status, kind: r.publication_kind })),
      uniqueRevisionCount: new Set(allNumbers).size,
      totalRows: allNumbers.length,
      activeRev: active?.revision.revision_number,
      activeTitle: active?.snapshot.content.portfolio.title,
      draft4Status: draft4Row?.status,
      draft4Title: draft4Row?.snapshot.content.portfolio.title,
      conflictCaught
    };
  })()`)

  assert(
    postRollback.uiBadge?.includes('#5')
      && postRollback.uiStatus?.includes('#5')
      && postRollback.uniqueRevisionCount === postRollback.totalRows
      && postRollback.activeRev === 5
      && postRollback.activeTitle === 'VERSION ONE TITLE'
      && postRollback.draft4Status === 'draft'
      && postRollback.draft4Title === 'DRAFT FOUR UNPUBLISHED'
      && postRollback.conflictCaught,
    `Rollback numbering UI/DB check failed: ${JSON.stringify(postRollback)}`
  )

  // Step 6: Verify Guest Home hydrates revision #5 (VERSION ONE TITLE) with published/<uuid>/... media URL
  const guestAfterRollback = await evaluate(`(async () => {
    const runtime = await import('/src/runtime/publishedRuntime.ts');
    const siteStore = (await import('/src/stores/site.ts')).useSiteStore();
    const router = (await import('/src/router/index.ts')).default;
    await runtime.initializePublishedRuntime({ force: true });
    await router.push({ name: 'home' });
    return {
      source: siteStore.guestRuntimeSource,
      revision: siteStore.publishedRevisionNumber,
      title: siteStore.current.content.portfolio.title
    };
  })()`)
  await waitFor(`document.querySelector('.guest-home .portfolio-title')?.textContent.trim() === 'VERSION ONE TITLE'`)
  assert(
    guestAfterRollback.source === 'published'
      && guestAfterRollback.revision === 5
      && guestAfterRollback.title === 'VERSION ONE TITLE',
    `Guest Home after Rollback did not hydrate #5: ${JSON.stringify(guestAfterRollback)}`
  )

  assert(runtimeExceptions.length === 0, `Uncaught browser exceptions: ${runtimeExceptions.join(' | ')}`)
  assert(!viteErrors.toLowerCase().includes('error'), `Vite stderr errors: ${viteErrors}`)
  assert(!browserErrors.includes('FATAL'), `Chromium fatal errors: ${browserErrors}`)

  console.log(JSON.stringify({
    status: 'PASS',
    scope: 'Finding #6 rollback numbering & publishDraft Storage path',
    inMemory: inMemoryResult,
    pipeline: { draft1: pipelineData.draft1Rev, pub1: pipelineData.pubOneRev, pub2: pipelineData.pubTwoRev, draft4: pipelineData.draft4Rev },
    rollback: { activeRev: postRollback.activeRev, uniqueRevisionCount: postRollback.uniqueRevisionCount, conflictCaught: postRollback.conflictCaught },
    storageAttemptUuidPaths: pipelineData.pubOnePaths.length
  }))
} finally {
  socket?.close()
  stopChildren()
  await wait(300)
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}
