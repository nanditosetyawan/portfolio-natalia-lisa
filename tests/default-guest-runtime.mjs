import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const cloudSmoke = process.argv.includes('--cloud-smoke')
const baseUrl = 'http://127.0.0.1:5178'
const cdpPort = 9338
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase030a-chrome-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const assert = (condition, message) => { if (!condition) throw new Error(`Phase 030A runtime failure: ${message}`) }

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { if ((await fetch(url)).ok) return } catch { /* Vite is starting. */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForJson(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return await response.json()
    } catch { /* Chromium is starting. */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], {
    cwd: projectRoot,
    env: cloudSmoke
      ? { ...process.env }
      : { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1440,1000', `${baseUrl}/#/`
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  let page
  const targetStarted = Date.now()
  while (!page && Date.now() - targetStarted < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5178'))
    if (!page) await wait(100)
  }
  if (!page) throw new Error('Phase 030A browser target not found.')

  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  const networkRequests = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
    if (message.method === 'Network.requestWillBeSent') networkRequests.push(message.params.request.url)
  })

  function send(method, params = {}) {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }

  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
    return response.result.value
  }

  async function waitFor(expression, timeout = 15000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(60)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  if (cloudSmoke) await send('Page.reload', { ignoreCache: true })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__) && Boolean(document.querySelector('.guest-home'))`)

  const defaultEvidence = await evaluate(`(async()=>{
    const defaults=await import('/src/runtime/defaultRuntimeSnapshot.ts');
    const runtime=await import('/src/runtime/publishedRuntime.ts');
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const site=pinia._s.get('site');
    const certificates=pinia._s.get('certificates');
    const template=defaults.loadDefaultRuntimeTemplate();
    const sections=new Set(template.snapshot.entities.map(entity=>entity.section));
    return {
      status:site.publishedRuntimeStatus,
      source:site.guestRuntimeSource,
      runtimeSource:runtime.activeGuestRuntimeSource.value,
      revision:site.publishedRevisionNumber,
      templateVersion:site.defaultRuntimeTemplateVersion,
      publishedRef:runtime.activePublishedEditorSnapshot.value,
      guestRef:Boolean(runtime.activeGuestEditorSnapshot.value),
      frozen:defaults.isCanonicalDefaultRuntimeFrozen(),
      title:site.current.content.portfolio.title,
      domTitle:document.querySelector('.portfolio-title')?.textContent.trim()??'',
      unavailable:Boolean(document.querySelector('.published-runtime-state')),
      sectionCoverage:['Portfolio','About','Education','College','SHS','Experience','Certificate','Contact'].every(section=>sections.has(section)),
      entityCount:template.snapshot.entities.length,
      certificateCount:certificates.displayedCards.length,
      mediaCount:template.snapshot.media.references.length,
      compatibility:template.snapshot.compatibility,
      visualSections:Object.keys(template.snapshot.visual).length,
      guestChildren:document.querySelectorAll('.guest-home > *').length
    };
  })()`)
  assert(defaultEvidence.status === 'ready' && defaultEvidence.source === 'default' && defaultEvidence.runtimeSource === 'default', `fresh Guest did not activate Default Runtime: ${JSON.stringify(defaultEvidence)}`)
  assert(defaultEvidence.revision === null && defaultEvidence.publishedRef === null && defaultEvidence.guestRef, 'Default Runtime was confused with a Published revision')
  assert(defaultEvidence.frozen && defaultEvidence.sectionCoverage && defaultEvidence.entityCount >= 40, `canonical Default Snapshot is incomplete: ${JSON.stringify(defaultEvidence)}`)
  assert(defaultEvidence.title === defaultEvidence.domTitle && !defaultEvidence.unavailable, 'fresh Guest rendered an empty/unavailable state instead of the template')
  assert(defaultEvidence.certificateCount >= 2 && defaultEvidence.mediaCount >= 1 && defaultEvidence.visualSections >= 9 && defaultEvidence.guestChildren >= 6, 'default content/media/visual coverage is incomplete')

  const routeIsolationEvidence = await evaluate(`(async()=>{
    const router=(await import('/src/router/index.ts')).default;
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const site=pinia._s.get('site');
    await router.push('/contact-detail');
    site.current.content.portfolio.title='EDITOR MEMORY MUST NOT LEAK';
    await router.push('/');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return {source:site.guestRuntimeSource,title:site.current.content.portfolio.title,domTitle:document.querySelector('.portfolio-title')?.textContent.trim()??''};
  })()`)
  assert(routeIsolationEvidence.source === 'default' && routeIsolationEvidence.title === defaultEvidence.title && routeIsolationEvidence.domTitle === defaultEvidence.title, `Guest route re-entry exposed editor memory: ${JSON.stringify(routeIsolationEvidence)}`)

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  const defaultShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', cloudSmoke ? 'phase-030a-cloud-default-guest.png' : 'phase-030a-default-guest.png'), Buffer.from(defaultShot.data, 'base64'))

  if (cloudSmoke) {
    const guestRequests = networkRequests.filter((url) => url.includes('/rest/v1/'))
    assert(guestRequests.some((url) => url.includes('/rpc/get_active_published_snapshot')), `Cloud Guest did not use the active Published RPC: ${guestRequests.join(', ')}`)
    assert(!guestRequests.some((url) => /\/rest\/v1\/(site_revisions|editor_favorites|site_content|media_assets|media_usages|certificates)(?:\?|$)/.test(url)), `Cloud Guest queried Draft/Favorite/editable tables: ${guestRequests.join(', ')}`)
    const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(error))
    assert(seriousErrors.length === 0, `unexpected Cloud browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)
    process.stdout.write(`${JSON.stringify({
      status: 'PASS',
      scope: 'Phase 030A anonymous Cloud Guest with zero Published revisions',
      source: defaultEvidence.source,
      revision: defaultEvidence.revision,
      activeRpcObserved: true,
      editableQueriesObserved: false,
      defaultEntities: defaultEvidence.entityCount
    }, null, 2)}\n`)
  } else {
    const contractEvidence = await evaluate(`(async()=>{
    const repositories=await import('/src/repositories/editorRevisionRepository.ts');
    const runtime=await import('/src/runtime/publishedRuntime.ts');
    const defaults=await import('/src/runtime/defaultRuntimeSnapshot.ts');
    const repo=new repositories.InMemoryEditorRevisionRepository('phase030a-admin');
    const canonical=defaults.loadDefaultRuntimeTemplate().snapshot;
    const fresh=await runtime.resolveGuestRuntimeSnapshot(repo);

    const draftOne=structuredClone(canonical);
    draftOne.content.portfolio.title='PHASE 030A DRAFT ONE';
    const draft=await repo.saveDraft({snapshot:draftOne,mediaReferences:[],expectedBaseRevision:null,createNew:true});
    await repo.addFavorite(draft.revision.id);
    const afterDraft=await runtime.resolveGuestRuntimeSnapshot(repo);
    const publishedOne=await repo.publishDraft({draftRevisionId:draft.revision.id,expectedPublishedRevision:null,expectedDraftLockVersion:draft.revision.lock_version,note:'first'});
    const afterFirstPublish=await runtime.resolveGuestRuntimeSnapshot(repo);

    const unsaved=structuredClone(draftOne);
    unsaved.content.portfolio.title='UNSAVED MUST NOT LEAK';
    const whileUnsaved=await runtime.resolveGuestRuntimeSnapshot(repo);
    const draftTwo=structuredClone(draftOne);
    draftTwo.content.portfolio.title='PHASE 030A DRAFT TWO';
    const savedTwo=await repo.saveDraft({snapshot:draftTwo,mediaReferences:[],expectedBaseRevision:publishedOne.revision_number,expectedDraftLockVersion:draft.revision.lock_version,draftRevisionId:draft.revision.id});
    const publishedTwo=await repo.publishDraft({draftRevisionId:draft.revision.id,expectedPublishedRevision:publishedOne.revision_number,expectedDraftLockVersion:savedTwo.revision.lock_version,note:'second'});
    const afterSecondPublish=await runtime.resolveGuestRuntimeSnapshot(repo);
    const rollback=await repo.rollbackRevision({targetRevisionId:publishedOne.id,expectedPublishedRevision:publishedTwo.revision_number,note:'rollback'});
    const afterRollback=await runtime.resolveGuestRuntimeSnapshot(repo);

    await repo.removeFavorite(draft.revision.id);
    const afterFavoriteDelete=await runtime.resolveGuestRuntimeSnapshot(repo);
    const draftStillExistsAfterFavoriteDelete=Boolean(await repo.loadDraft(draft.revision.id));
    await repo.addFavorite(draft.revision.id);
    await repo.discardDraft(draft.revision.id);
    const afterDraftDelete=await runtime.resolveGuestRuntimeSnapshot(repo);

    let publishedFailureFellBack=false;
    let publishedFailureMessage='';
    const brokenRepository={
      loadPublishedSnapshot:()=>repo.loadPublishedSnapshot(),
      resolvePublishedMedia:async()=>{throw new Error('simulated published media failure')}
    };
    try{await runtime.resolveGuestRuntimeSnapshot(brokenRepository)}catch(error){publishedFailureMessage=String(error?.message??error);publishedFailureFellBack=false}

    return {
      freshSource:fresh.source,
      freshRevision:fresh.revision,
      afterDraftSource:afterDraft.source,
      afterDraftTitle:afterDraft.snapshot.content.portfolio.title,
      firstSource:afterFirstPublish.source,
      firstRevision:afterFirstPublish.revision?.revision_number,
      firstTitle:afterFirstPublish.snapshot.content.portfolio.title,
      whileUnsavedTitle:whileUnsaved.snapshot.content.portfolio.title,
      secondRevision:afterSecondPublish.revision?.revision_number,
      secondTitle:afterSecondPublish.snapshot.content.portfolio.title,
      rollbackRevision:rollback.revision_number,
      rollbackSource:afterRollback.source,
      rollbackTitle:afterRollback.snapshot.content.portfolio.title,
      history:(await repo.getHistory()).length,
      draftCount:await repo.countDrafts(),
      favoriteCount:await repo.countFavorites(),
      draftStillExistsAfterFavoriteDelete,
      favoriteDeleteTitle:afterFavoriteDelete.snapshot.content.portfolio.title,
      draftDeleteTitle:afterDraftDelete.snapshot.content.portfolio.title,
      publishedFailureFellBack,
      publishedFailureMessage
    };
  })()`)
  assert(contractEvidence.freshSource === 'default' && contractEvidence.freshRevision === null, 'fresh repository did not resolve Default Runtime')
  assert(contractEvidence.afterDraftSource === 'default' && contractEvidence.afterDraftTitle === defaultEvidence.title, 'saved Draft leaked into Guest before first Publish')
  assert(contractEvidence.firstSource === 'published' && contractEvidence.firstRevision === 1 && contractEvidence.firstTitle === 'PHASE 030A DRAFT ONE', 'first Publish did not switch Default to Published')
  assert(contractEvidence.whileUnsavedTitle === 'PHASE 030A DRAFT ONE', 'unsaved Draft leaked into Published Guest')
  assert(contractEvidence.secondRevision === 2 && contractEvidence.secondTitle === 'PHASE 030A DRAFT TWO', 'second Publish did not update Guest')
  assert(contractEvidence.rollbackRevision === 3 && contractEvidence.rollbackSource === 'published' && contractEvidence.rollbackTitle === 'PHASE 030A DRAFT ONE', 'Rollback used Default or failed to restore Published history')
  assert(contractEvidence.history === 3 && contractEvidence.draftCount === 0 && contractEvidence.favoriteCount === 0, 'history/delete preservation contract failed')
  assert(contractEvidence.draftStillExistsAfterFavoriteDelete && contractEvidence.favoriteDeleteTitle === 'PHASE 030A DRAFT ONE', 'Favorite deletion changed Draft or Guest')
  assert(contractEvidence.draftDeleteTitle === 'PHASE 030A DRAFT ONE', 'Draft deletion changed Guest')
  assert(!contractEvidence.publishedFailureFellBack && contractEvidence.publishedFailureMessage.includes('simulated published media failure'), 'a broken Published Snapshot silently fell back to Default')

  const failureUiEvidence = await evaluate(`(async()=>{
    const runtime=await import('/src/runtime/publishedRuntime.ts');
    const repositories=await import('/src/repositories/editorRevisionRepository.ts');
    const defaults=await import('/src/runtime/defaultRuntimeSnapshot.ts');
    const probe=new repositories.InMemoryEditorRevisionRepository('phase030a-failure');
    probe.seedPublished(defaults.loadDefaultRuntimeTemplate().snapshot,9);
    await runtime.initializePublishedRuntime({force:true,repository:{loadPublishedSnapshot:()=>probe.loadPublishedSnapshot(),resolvePublishedMedia:async()=>{throw new Error('real published runtime failure')}}});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const site=pinia._s.get('site');
    const failed={status:site.publishedRuntimeStatus,source:site.guestRuntimeSource,message:document.querySelector('.published-runtime-state h1')?.textContent.trim()??'',retry:Boolean(document.querySelector('.published-runtime-state button'))};
    await runtime.initializePublishedRuntime({force:true});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return {...failed,restoredSource:site.guestRuntimeSource,restoredUnavailable:Boolean(document.querySelector('.published-runtime-state'))};
  })()`)
  assert(failureUiEvidence.status === 'error' && failureUiEvidence.source === null && failureUiEvidence.message === 'Published site is temporarily unavailable.' && failureUiEvidence.retry, `real Published failure did not show recoverable error UI: ${JSON.stringify(failureUiEvidence)}`)
  assert(failureUiEvidence.restoredSource === 'default' && !failureUiEvidence.restoredUnavailable, 'retry did not restore Default after the repository confirmed zero Published revisions')

  const cacheSwitchEvidence = await evaluate(`(async()=>{
    const runtime=await import('/src/runtime/publishedRuntime.ts');
    const repositories=await import('/src/repositories/editorRevisionRepository.ts');
    const defaults=await import('/src/runtime/defaultRuntimeSnapshot.ts');
    const snapshot=defaults.loadDefaultRuntimeTemplate().snapshot;
    snapshot.content.portfolio.title='PHASE 030A FIRST PUBLISHED';
    const repository=repositories.guestPublishedRepository;
    const originalLoad=repository.loadPublishedSnapshot.bind(repository);
    const staleEmptyResult=await originalLoad();
    repository.loadPublishedSnapshot=()=>new Promise(resolve=>setTimeout(()=>resolve(staleEmptyResult),120));
    const staleInitialization=runtime.initializePublishedRuntime({force:true});
    await new Promise(resolve=>setTimeout(resolve,10));
    repository.loadPublishedSnapshot=originalLoad;
    repositories.guestPublishedRepository.seedPublished(snapshot,1);
    runtime.invalidatePublishedRuntimeCache(1);
    const started=Date.now();
    while(runtime.activeGuestRuntimeSource.value!=='published'&&Date.now()-started<5000)await new Promise(resolve=>setTimeout(resolve,25));
    await staleInitialization;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const site=pinia._s.get('site');
    return {source:site.guestRuntimeSource,revision:site.publishedRevisionNumber,title:site.current.content.portfolio.title,domTitle:document.querySelector('.portfolio-title')?.textContent.trim()??'',defaultVersion:site.defaultRuntimeTemplateVersion,staleInitializationIgnored:site.guestRuntimeSource==='published'};
  })()`)
  assert(cacheSwitchEvidence.source === 'published' && cacheSwitchEvidence.revision === 1 && cacheSwitchEvidence.title === 'PHASE 030A FIRST PUBLISHED', `cache invalidation did not switch an open Guest to first Published: ${JSON.stringify(cacheSwitchEvidence)}`)
  assert(cacheSwitchEvidence.domTitle === cacheSwitchEvidence.title && cacheSwitchEvidence.defaultVersion === null && cacheSwitchEvidence.staleInitializationIgnored, 'first Published was overwritten by stale Default data or did not replace source metadata')

  const publishedShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-030a-first-published-guest.png'), Buffer.from(publishedShot.data, 'base64'))

  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
  assert(seriousErrors.length === 0, `unexpected browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    scope: 'Phase 030A Default Guest Runtime and first Publish contract',
    defaultSource: defaultEvidence.source,
    defaultEntities: defaultEvidence.entityCount,
    firstPublishedRevision: cacheSwitchEvidence.revision,
    publishRevisions: [contractEvidence.firstRevision, contractEvidence.secondRevision, contractEvidence.rollbackRevision],
    rollbackStayedPublished: contractEvidence.rollbackSource === 'published',
    draftAndFavoriteIsolation: contractEvidence.draftCount === 0 && contractEvidence.favoriteCount === 0,
    publishedFailureDidNotFallback: contractEvidence.publishedFailureMessage.includes('simulated published media failure'),
    routeReentryIsolation: routeIsolationEvidence.title === defaultEvidence.title,
    recoverableFailureUi: failureUiEvidence.status === 'error' && failureUiEvidence.retry,
    staleDefaultRaceRejected: cacheSwitchEvidence.staleInitializationIgnored
  }, null, 2)}\n`)
  }
} finally {
  try { socket?.close() } catch { /* no-op */ }
  stopChildren()
  await wait(250)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* Chromium may release its lock after process exit. */ }
}
