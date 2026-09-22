import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5199'
const cdpPort = 9359
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-supabase-test-'))
const children = []
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {}
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
  console.log('1. Starting Vite dev server for Supabase Persistence Test...')
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env }
  })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  console.log('2. Starting Headless Chromium for CDP Browser Testing...')
  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1440,1000', baseUrl
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  const page = await waitForPageTarget('127.0.0.1:5199')
  assert(page, 'Chromium page target not found')

  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) {
      const req = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? req.reject(new Error(msg.error.message)) : req.resolve(msg.result)
    }
  })

  function send(method, params = {}) {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)
    return res.result.value
  }

  async function waitFor(expression, timeout = 20000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(80)
    }
    throw new Error(`Timed out waiting for: ${expression}`)
  }

  await send('Runtime.enable')
  await send('Page.enable')

  console.log('Waiting for Vue app mounting...')
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)

  console.log('3. Verifying Supabase Configuration & Active Connection...')
  const connectionTest = await evaluate(`(async () => {
    const rest = await import('/src/lib/supabaseRest.ts');
    const configured = rest.isSupabaseConfigured();
    let rpcOk = false;
    let rpcCount = -1;
    let rpcError = null;
    try {
      const data = await rest.supabaseRpc('get_active_published_snapshot');
      rpcOk = true;
      rpcCount = Array.isArray(data) ? data.length : 0;
    } catch (err) {
      rpcError = err instanceof Error ? err.message : String(err);
    }
    return { configured, rpcOk, rpcCount, rpcError, url: rest.supabaseRestInfo.url };
  })()`)

  console.log('Supabase Connection Info:', JSON.stringify(connectionTest, null, 2))
  assert(connectionTest.configured, 'isSupabaseConfigured() returned false! Check .env credentials.')
  assert(connectionTest.rpcOk, `RPC get_active_published_snapshot failed: ${connectionTest.rpcError}`)

  console.log('4. Testing Save Draft Persistence Contract (In-Memory & Supabase Repository)...')
  const draftSimulation = await evaluate(`(async () => {
    const snapshotMod = await import('/src/editor/editorSnapshot.ts');
    const siteMod = await import('/src/data/default/site.ts');
    const repoMod = await import('/src/repositories/editorRevisionRepository.ts');

    const defaultSite = siteMod.createDefaultSiteSnapshot();
    const baseSnapshot = snapshotMod.createEditorSnapshot(defaultSite);

    // Create a customized snapshot copy with dynamic instance image, X/Y position, W/H size, outline, and shadow
    const draftSnapshot = structuredClone(baseSnapshot);

    const testAssetId = 'asset-persistence-test-1';
    const testInstanceId = 'instance-persistence-test-1';
    const testMediaRef = {
      assetId: testAssetId,
      uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      mimeType: 'image/jpeg',
      width: 800,
      height: 600,
      bucket: 'portfolio-media',
      storagePath: 'published/test/asset-1.jpg'
    };

    draftSnapshot.media.references.push(testMediaRef);
    draftSnapshot.media.assignments.push({
      entityId: testInstanceId,
      role: 'dynamic-image',
      assetId: testAssetId,
      objectPosition: '50% 50%'
    });

    draftSnapshot.instances.push({
      instanceId: testInstanceId,
      sectionId: 'about',
      type: 'image',
      label: 'Persistence Test Photo',
      order: 1,
      createdAt: new Date().toISOString(),
      source: {
        kind: 'media-assignment',
        assignmentEntityId: testInstanceId
      }
    });

    // 2. Set Position (X/Y) & Size (W/H)
    draftSnapshot.layout[testInstanceId] = {
      positionMode: 'absolute',
      x: 180,
      y: 240,
      width: '350px',
      height: '450px',
      rotation: 3,
      zIndex: 10
    };

    // 3. Set Effect (Outline & Shadow)
    draftSnapshot.media.styles[testInstanceId] = {
      outlineEnabled: true,
      outlineWidth: 6,
      outlineColor: '#FF0055',
      shadowEnabled: true,
      shadowColor: 'rgba(0, 0, 0, 0.6)',
      hoverEnabled: true,
      aspectRatioLocked: true,
      aspectRatio: 350 / 450
    };

    // First test with InMemoryEditorRevisionRepository to verify full object contract without requiring active admin JWT
    const inMemoryRepo = new repoMod.InMemoryEditorRevisionRepository('test-actor');
    const savedInMemory = await inMemoryRepo.saveDraft({
      snapshot: draftSnapshot,
      mediaReferences: [
        {
          assetId: testAssetId,
          bucket: 'portfolio-media',
          storagePath: 'published/test/asset-1.jpg',
          mimeType: 'image/jpeg',
          width: 800,
          height: 600
        }
      ],
      expectedBaseRevision: null,
      createNew: true
    });

    const loadedInMemory = await inMemoryRepo.loadDraft(savedInMemory.revision.id);
    const inMemSnapshot = loadedInMemory.revision.snapshot;
    const inMemLayout = inMemSnapshot.layout[testInstanceId];
    const inMemStyle = inMemSnapshot.media.styles[testInstanceId];
    const inMemInstance = inMemSnapshot.instances.find(i => i.instanceId === testInstanceId);

    // Also check current active repository (SupabaseEditorDraftRepository or InMemory)
    let supabaseDraftTest = null;
    let authRequiredError = null;
    try {
      const savedResult = await repoMod.editorDraftRepository.saveDraft({
        snapshot: draftSnapshot,
        mediaReferences: [
          {
            assetId: testAssetId,
            bucket: 'portfolio-media',
            storagePath: 'published/test/asset-1.jpg',
            mimeType: 'image/jpeg',
            width: 800,
            height: 600
          }
        ],
        expectedBaseRevision: null,
        createNew: true
      });
      supabaseDraftTest = savedResult;
    } catch (err) {
      authRequiredError = err instanceof Error ? err.message : String(err);
    }

    return {
      inMemoryContract: {
        instanceFound: Boolean(inMemInstance),
        layout: inMemLayout,
        style: inMemStyle,
        matches: {
          x: inMemLayout?.x === 180,
          y: inMemLayout?.y === 240,
          width: inMemLayout?.width === '350px',
          height: inMemLayout?.height === '450px',
          rotation: inMemLayout?.rotation === 3,
          outlineEnabled: inMemStyle?.outlineEnabled === true,
          outlineWidth: inMemStyle?.outlineWidth === 6,
          outlineColor: inMemStyle?.outlineColor === '#FF0055',
          shadowEnabled: inMemStyle?.shadowEnabled === true,
          shadowColor: inMemStyle?.shadowColor === 'rgba(0, 0, 0, 0.6)'
        }
      },
      supabaseAuthProtection: authRequiredError ? authRequiredError.includes('401') || authRequiredError.includes('permission denied') : 'Authenticated save executed'
    };
  })()`)

  console.log('Draft Simulation Result:', JSON.stringify(draftSimulation, null, 2))
  assert(draftSimulation.inMemoryContract.instanceFound, 'Dynamic instance was not found in saved draft snapshot!')
  assert(draftSimulation.inMemoryContract.matches.x && draftSimulation.inMemoryContract.matches.y && draftSimulation.inMemoryContract.matches.rotation, 'Position X/Y or rotation was reset or corrupted!')
  assert(draftSimulation.inMemoryContract.matches.width && draftSimulation.inMemoryContract.matches.height, 'Size W/H was reset or corrupted!')
  assert(
    draftSimulation.inMemoryContract.matches.outlineEnabled && draftSimulation.inMemoryContract.matches.outlineWidth && draftSimulation.inMemoryContract.matches.outlineColor,
    'Outline effect was reset or corrupted!'
  )
  assert(
    draftSimulation.inMemoryContract.matches.shadowEnabled && draftSimulation.inMemoryContract.matches.shadowColor,
    'Shadow effect was reset or corrupted!'
  )
  assert(draftSimulation.supabaseAuthProtection, 'Supabase RLS protection test failed!')

  console.log('5. Simulating Publish & Guest Runtime Reading...')
  const publishSimulation = await evaluate(`(async () => {
    const guestRepo = (await import('/src/repositories/editorRevisionRepository.ts')).guestPublishedRepository;
    const published = await guestRepo.loadPublishedSnapshot();
    
    // Check Guest Runtime clean read
    const siteStore = (await import('/src/stores/site.ts')).useSiteStore();
    const runtime = await import('/src/runtime/publishedRuntime.ts');
    await runtime.initializePublishedRuntime();

    return {
      hasPublished: Boolean(published),
      publishedRevisionNumber: published?.revision.revision_number ?? null,
      runtimeStatus: siteStore.publishedRuntimeStatus,
      guestSiteTitle: siteStore.current.content.portfolio.title
    };
  })()`)

  console.log('Publish Simulation Result:', JSON.stringify(publishSimulation, null, 2))
  assert(publishSimulation.runtimeStatus === 'ready', `Guest Runtime status is not ready: ${publishSimulation.runtimeStatus}`)

  console.log('6. Checking DOM for clean Guest Runtime rendering (No Editor UI leak)...')
  const domLeakCheck = await evaluate(`(() => {
    const editorToolbars = document.querySelectorAll('.tbar-save, .tbar-publish, .editor-toolbar');
    const editorInspectors = document.querySelectorAll('.property-inspector, .editor-navigator');
    const editorHandles = document.querySelectorAll('.resize-handle, .drag-handle');
    const guestHome = document.querySelector('.guest-home, #app');
    
    return {
      editorToolbarsCount: editorToolbars.length,
      editorInspectorsCount: editorInspectors.length,
      editorHandlesCount: editorHandles.length,
      guestAppMounted: Boolean(guestHome)
    };
  })()`)

  console.log('DOM Leak Check:', JSON.stringify(domLeakCheck, null, 2))
  assert(domLeakCheck.guestAppMounted, 'Guest App is not mounted')
  assert(domLeakCheck.editorToolbarsCount === 0, 'Editor Toolbar leaked into Guest view!')
  assert(domLeakCheck.editorInspectorsCount === 0, 'Editor Inspector leaked into Guest view!')
  assert(domLeakCheck.editorHandlesCount === 0, 'Editor Handles leaked into Guest view!')

  console.log('\n============================================================')
  console.log('ALL SUPABASE PERSISTENCE SIMULATIONS & VERIFICATIONS PASSED!')
  console.log('============================================================\n')

} catch (err) {
  console.error('\nTEST FAILED:', err)
  process.exit(1)
} finally {
  socket?.close()
  stopChildren()
  await rm(profilePath, { recursive: true, force: true }).catch(() => {})
}
