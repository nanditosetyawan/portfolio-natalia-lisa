import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5177'
const cdpPort = 9335
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const serviceRoleKey = process.env.PHASE029G_SERVICE_ROLE_KEY
if (!serviceRoleKey) throw new Error('PHASE029G_SERVICE_ROLE_KEY is required for disposable Cloud E2E setup.')

const envFile = await readFile(path.join(projectRoot, '.env'), 'utf8')
const env = Object.fromEntries(envFile.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
  return match ? [[match[1], match[2].trim().replace(/^['"]|['"]$/g, '')]] : []
}))
const supabaseUrl = env.VITE_SUPABASE_URL
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!supabaseUrl || !publishableKey) throw new Error('Cloud Supabase environment is not configured.')

const service = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-029g-chrome-'))
const children = []
const testEmail = `phase029g-${crypto.randomUUID()}@example.invalid`
const testPassword = `P029g-${crypto.randomUUID()}-Aa1!`
let testUserId = null
let socket
let initialPublishedRevision = null
const initialObjects = new Map()

const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const assert = (condition, message) => { if (!condition) throw new Error(`Phase 029G runtime failure: ${message}`) }

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { if ((await fetch(url)).ok) return } catch { /* starting */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForJson(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { const response = await fetch(url); if (response.ok) return await response.json() } catch { /* starting */ }
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

async function listFolder(folder) {
  const { data, error } = await service.storage.from('portfolio-media').list(folder, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw new Error(`Storage list failed for ${folder}: ${error.message}`)
  return (data ?? []).filter((item) => item.id).map((item) => `${folder}/${item.name}`)
}

async function cleanup() {
  if (!testUserId) return
  const { data: rows } = await service.from('site_revisions').select('id,status,publication_kind,snapshot,revision_number').eq('created_by', testUserId)
  const publishedNumbers = [...new Set((rows ?? []).filter((row) => row.status === 'published').map((row) => Number(row.revision_number)))]
  const anticipated = [Number(initialPublishedRevision ?? 0) + 1, Number(initialPublishedRevision ?? 0) + 2]
  const folders = [...new Set([...publishedNumbers, ...anticipated])].map((revision) => `published/${revision}`)
  const removable = []
  for (const folder of folders) {
    const before = initialObjects.get(folder) ?? new Set()
    for (const objectPath of await listFolder(folder).catch(() => [])) if (!before.has(objectPath)) removable.push(objectPath)
  }
  if (removable.length) await service.storage.from('portfolio-media').remove(removable)
  await service.from('editor_favorites').delete().eq('user_id', testUserId)
  await service.from('site_revisions').delete().eq('created_by', testUserId).eq('publication_kind', 'rollback')
  await service.from('site_revisions').delete().eq('created_by', testUserId).eq('status', 'published')
  await service.from('site_revisions').delete().eq('created_by', testUserId).eq('status', 'draft')
  await service.from('admin_memberships').delete().eq('user_id', testUserId)
  await service.auth.admin.deleteUser(testUserId)
}

process.on('exit', stopChildren)
process.on('SIGINT', () => { stopChildren(); process.exit(130) })

let viteErrors = ''
let browserErrors = ''
try {
  const { data: activeBefore, error: activeBeforeError } = await service
    .from('site_revisions')
    .select('revision_number')
    .eq('status', 'published')
    .order('revision_number', { ascending: false })
    .limit(1)
  if (activeBeforeError) throw activeBeforeError
  initialPublishedRevision = activeBefore?.[0]?.revision_number ?? null
  for (const revision of [Number(initialPublishedRevision ?? 0) + 1, Number(initialPublishedRevision ?? 0) + 2]) {
    const folder = `published/${revision}`
    initialObjects.set(folder, new Set(await listFolder(folder)))
  }

  const { data: created, error: createError } = await service.auth.admin.createUser({ email: testEmail, password: testPassword, email_confirm: true })
  if (createError || !created.user) throw new Error(`Disposable Admin creation failed: ${createError?.message ?? 'no user'}`)
  testUserId = created.user.id
  const { error: membershipError } = await service.from('admin_memberships').insert({ user_id: testUserId, role: 'admin' })
  if (membershipError) throw new Error(`Disposable Admin membership failed: ${membershipError.message}`)

  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5177', '--strictPort'], { cwd: projectRoot, env: { ...process.env } })
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1440,1000', baseUrl
  ])
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })
  const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
  const page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5177'))
  if (!page) throw new Error('Cloud runtime page target was not found.')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  const networkRequests = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id); pending.delete(message.id)
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
    if (message.method === 'Network.requestWillBeSent') networkRequests.push(message.params.request.url)
  })
  function send(method, params = {}) { const id = ++sequence; socket.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })) }
  async function evaluate(expression) { const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text); return response.result.value }
  async function waitFor(expression, timeout = 20000) { const started = Date.now(); while (Date.now() - started < timeout) { if (await evaluate(expression)) return; await wait(80) } throw new Error(`Timed out: ${expression}`) }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)

  const inMemoryContract = await evaluate(`(async()=>{
    const mod=await import('/src/repositories/editorRevisionRepository.ts');
    const model=await import('/src/editor/editorSnapshot.ts');
    const site=await import('/src/data/default/site.ts');
    const repo=new mod.InMemoryEditorRevisionRepository('publish-contract-admin');
    const base=model.createEditorSnapshot(site.createDefaultSiteSnapshot());
    const first=structuredClone(base); first.content.portfolio.title='IN-MEMORY REVISION ONE';
    const draft=await repo.saveDraft({snapshot:first,mediaReferences:[],expectedBaseRevision:null,createNew:true});
    await repo.addFavorite(draft.revision.id);
    const one=await repo.publishDraft({draftRevisionId:draft.revision.id,expectedPublishedRevision:null,expectedDraftLockVersion:draft.revision.lock_version,note:'one'});
    const second=structuredClone(first); second.content.portfolio.title='IN-MEMORY REVISION TWO';
    const saved=await repo.saveDraft({snapshot:second,mediaReferences:[],expectedBaseRevision:one.revision_number,expectedDraftLockVersion:draft.revision.lock_version,draftRevisionId:draft.revision.id});
    const two=await repo.publishDraft({draftRevisionId:draft.revision.id,expectedPublishedRevision:one.revision_number,expectedDraftLockVersion:saved.revision.lock_version,note:'two'});
    const rolled=await repo.rollbackRevision({targetRevisionId:one.id,expectedPublishedRevision:two.revision_number,note:'restore one'});
    const active=await repo.loadPublishedSnapshot();
    return {drafts:await repo.countDrafts(),favorite:await repo.isFavorite(draft.revision.id),history:(await repo.getHistory()).length,revision:rolled.revision_number,title:active.snapshot.content.portfolio.title};
  })()`)
  assert(inMemoryContract.drafts === 1 && inMemoryContract.favorite && inMemoryContract.history === 3, 'in-memory publish preservation/history contract failed')
  assert(inMemoryContract.title === 'IN-MEMORY REVISION ONE', 'in-memory rollback did not restore the selected snapshot')

  await evaluate(`(async()=>{const auth=(await import('/src/stores/auth.ts')).useAuthStore();await auth.login(${JSON.stringify(testEmail)},${JSON.stringify(testPassword)});const router=(await import('/src/router/index.ts')).default;await router.push({name:'admin-edit',query:{draft:'new'}});return true})()`)
  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-entity-id="portfolio-hero"]'))`)

  async function editTitle(title) {
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const target=[...document.querySelectorAll('[data-editor-entity-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];target.click();await tick();const input=document.querySelector('[data-property-key="runtime.portfolio-hero.title"]');input.value=${JSON.stringify(title)};input.dispatchEvent(new Event('input',{bubbles:true}));await tick();return true})()`)
  }
  async function saveDraft() {
    const before = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftLockVersion??0`)
    await evaluate(`document.querySelector('.tbar-save').click()`)
    await waitFor(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return editor.draftLockVersion>${before}&&document.querySelector('.editor-save-status')?.textContent.trim()==='Saved'})()`)
  }
  async function publish(note, screenshotName) {
    const beforeRevision = await evaluate(`Number(document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').publishedRevisionNumber??0)`)
    await evaluate(`document.querySelector('.tbar-publish').click()`)
    await waitFor(`Boolean(document.querySelector('.publish-modal'))`)
    if (screenshotName) {
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
      await writeFile(path.join(projectRoot, 'artifacts', screenshotName), Buffer.from(shot.data, 'base64'))
    }
    await evaluate(`(()=>{const note=document.querySelector('#publish-note');note.value=${JSON.stringify(note)};note.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.publish-confirm').click();return true})()`)
    await waitFor(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return Number(editor.publishedRevisionNumber??0)>${beforeRevision}&&!editor.isPublishing&&!document.querySelector('.publish-modal')&&document.querySelector('.editor-publish-status')?.textContent.trim()==='Published'})()`, 120000)
  }

  const revisionOneTitle = `PHASE-029G-REVISION-ONE-${crypto.randomUUID().slice(0, 8)}`
  const revisionTwoTitle = `PHASE-029G-REVISION-TWO-${crypto.randomUUID().slice(0, 8)}`
  await editTitle(revisionOneTitle)
  await saveDraft()
  const savedDraft = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');await repo.favoriteRepository.addFavorite(editor.draftRevisionId);return {id:editor.draftRevisionId,lock:editor.draftLockVersion,history:editor.commandHistory.length,drafts:await repo.editorDraftRepository.countDrafts(),favorites:await repo.favoriteRepository.countFavorites()}})()`)
  assert(savedDraft.id && savedDraft.drafts === 1 && savedDraft.favorites === 1, 'Cloud Draft/Favorite setup failed')
  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  await publish('Phase 029G revision one', 'phase-029g-publish-confirmation.png')
  const afterFirstPublish = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const active=await repo.guestPublishedRepository.loadPublishedSnapshot();return {revision:active.revision.revision_number,title:active.snapshot.content.portfolio.title,drafts:await repo.editorDraftRepository.countDrafts(),favorites:await repo.favoriteRepository.countFavorites(),draftId:editor.draftRevisionId,history:editor.commandHistory.length,paths:active.snapshot.media.references.map(item=>item.storagePath)}})()`)
  const revisionOne = Number(initialPublishedRevision ?? 0) + 1
  assert(afterFirstPublish.revision === revisionOne && afterFirstPublish.title === revisionOneTitle, 'first Cloud Publish did not activate the Draft snapshot')
  assert(afterFirstPublish.drafts === 1 && afterFirstPublish.favorites === 1 && afterFirstPublish.draftId === savedDraft.id, 'Publish removed or replaced Draft/Favorite/editor source')
  assert(afterFirstPublish.history === savedDraft.history, 'Publish cleared Editor command history')
  assert(afterFirstPublish.paths.every((value) => value?.startsWith('published/')), 'Published Snapshot contains a non-published media path')

  const anonymousActive = async () => {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_active_published_snapshot`, { method: 'POST', headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, 'Content-Type': 'application/json' }, body: '{}' })
    if (!response.ok) throw new Error(`Anonymous Published RPC failed (${response.status}): ${await response.text()}`)
    return (await response.json())[0]
  }
  let anonymous = await anonymousActive()
  assert(anonymous.snapshot.content.portfolio.title === revisionOneTitle, 'anonymous Guest repository did not read revision one')
  const publicReference = anonymous.snapshot.media.references[0]
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${publicReference.bucket}/${publicReference.storagePath}`
  assert((await fetch(publicUrl)).ok, 'published public media URL is not reachable')

  await editTitle(revisionTwoTitle)
  anonymous = await anonymousActive()
  assert(anonymous.snapshot.content.portfolio.title === revisionOneTitle, 'unsaved Draft content leaked into Guest Runtime')
  await saveDraft()
  await publish('Phase 029G revision two')
  const revisionTwo = revisionOne + 1
  anonymous = await anonymousActive()
  assert(Number(anonymous.revision_number) === revisionTwo && anonymous.snapshot.content.portfolio.title === revisionTwoTitle, 'second Publish did not advance Guest Runtime')

  const staleAtomicResult = await evaluate(`(async()=>{const rest=await import('/src/lib/supabaseRest.ts');const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');try{await rest.supabaseRpc('publish_editor_draft',{p_draft_id:editor.draftRevisionId,p_prepared_snapshot:JSON.parse(JSON.stringify(editor.draftSnapshot)),p_expected_published_revision:${revisionOne},p_expected_draft_lock_version:editor.draftLockVersion,p_note:'Phase 029G stale atomic boundary test'});return {rejected:false,message:''}}catch(error){return {rejected:true,message:error instanceof Error?error.message:String(error)}}})()`)
  assert(staleAtomicResult.rejected && /changed|older|40001|409/i.test(staleAtomicResult.message), `atomic stale Publish was not rejected: ${JSON.stringify(staleAtomicResult)}`)

  const originalDraftId = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftRevisionId`)
  const missingDraftId = crypto.randomUUID()
  await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');editor.draftRevisionId=${JSON.stringify(missingDraftId)};document.querySelector('.tbar-publish').click();return true})()`)
  await waitFor(`Boolean(document.querySelector('.publish-modal'))`)
  await evaluate(`document.querySelector('.publish-confirm').click()`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').isPublishing===false`, 20000)
  const publishFailure = await evaluate(`(async()=>{const feedback=await import('/src/composables/useEditorPublish.ts');return {status:feedback.editorPublishStatus.value,errors:[...feedback.editorPublishErrors.value],modal:Boolean(document.querySelector('.publish-modal')),domErrors:[...document.querySelectorAll('.publish-errors li')].map(item=>item.textContent.trim())}})()`)
  assert(publishFailure.status === 'Failed' && publishFailure.errors.length > 0 && publishFailure.modal, `failed Publish did not surface a recoverable Failed state: ${JSON.stringify(publishFailure)}`)
  anonymous = await anonymousActive()
  assert(Number(anonymous.revision_number) === revisionTwo && anonymous.snapshot.content.portfolio.title === revisionTwoTitle, 'failed stale Publish changed Guest Runtime')
  await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');editor.draftRevisionId=${JSON.stringify(originalDraftId)};editor.publishedRevisionNumber=${revisionTwo};document.querySelector('.publish-cancel')?.click();return true})()`)

  await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;await router.push({name:'admin-published'});return true})()`)
  await waitFor(`document.querySelectorAll('.history-card').length>=2`)
  const historyShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-029g-publish-history.png'), Buffer.from(historyShot.data, 'base64'))
  await evaluate(`(()=>{const card=[...document.querySelectorAll('.history-card')].find(item=>item.querySelector('h2')?.textContent.includes('Revision ${revisionOne}'));card.querySelector('.rollback-button').click();return true})()`)
  await waitFor(`Boolean(document.querySelector('.rollback-modal'))`)
  await evaluate(`document.querySelector('.rollback-confirm').click()`)
  const rollbackRevision = revisionTwo + 1
  await waitFor(`document.querySelector('.current-badge')?.textContent.includes('#${rollbackRevision}')`, 20000)
  anonymous = await anonymousActive()
  assert(Number(anonymous.revision_number) === rollbackRevision && anonymous.snapshot.content.portfolio.title === revisionOneTitle, 'atomic Rollback did not restore revision one for Guest')

  const preserved = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');return {drafts:await repo.editorDraftRepository.countDrafts(),favorites:await repo.favoriteRepository.countFavorites(),history:(await repo.editorPublishRepository.getHistory()).length}})()`)
  assert(preserved.drafts === 1 && preserved.favorites === 1 && preserved.history >= 3, 'Rollback modified Draft/Favorite or failed to retain history')

  const directDraftResponse = await fetch(`${supabaseUrl}/rest/v1/site_revisions?select=id&status=eq.draft`, { headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` } })
  const directFavoriteResponse = await fetch(`${supabaseUrl}/rest/v1/editor_favorites?select=id`, { headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` } })
  assert(!directDraftResponse.ok && !directFavoriteResponse.ok, 'anonymous Data API can read Draft or Favorite rows')

  const requestBoundary = networkRequests.length
  await evaluate(`(async()=>{const auth=(await import('/src/stores/auth.ts')).useAuthStore();await auth.logout();const runtime=await import('/src/runtime/publishedRuntime.ts');await runtime.initializePublishedRuntime();const router=(await import('/src/router/index.ts')).default;await router.push('/');return true})()`)
  await waitFor(`Boolean(document.querySelector('.guest-home'))&&document.body.innerText.includes(${JSON.stringify(revisionOneTitle)})`)
  const guestRequests = networkRequests.slice(requestBoundary).filter((url) => url.includes('/rest/v1/'))
  assert(guestRequests.some((url) => url.includes('/rpc/get_active_published_snapshot')), 'Guest did not use the active Published RPC')
  assert(!guestRequests.some((url) => /\/rest\/v1\/(site_content|media_assets|media_usages|certificates|site_revisions)(?:\?|$)/.test(url)), `Guest queried editable/normalized tables: ${guestRequests.join(', ')}`)
  const guestMedia = await evaluate(`[...document.images].map(image=>image.src).filter(src=>src.includes('/storage/v1/object/public/portfolio-media/'))`)
  assert(guestMedia.length > 0 && guestMedia.every((url) => url.includes('/published/')), 'Guest DOM references draft or non-published Storage paths')
  const guestShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-029g-guest-rollback.png'), Buffer.from(guestShot.data, 'base64'))

  assert(runtimeErrors.length === 0, `browser console errors: ${runtimeErrors.join(' | ')}`)
  assert(!viteErrors.toLowerCase().includes('error'), `Vite runtime errors: ${viteErrors}`)
  assert(!browserErrors.includes('FATAL'), `Chromium runtime failure: ${browserErrors}`)

  console.log(JSON.stringify({
    status: 'PASS',
    scope: 'Phase 029G authenticated Cloud Publish/Guest/Rollback E2E',
    revisions: [revisionOne, revisionTwo, rollbackRevision],
    draftPreserved: true,
    favoritePreserved: true,
    guestPublishedOnly: true,
    publicBucket: true,
    cleanupScheduled: true
  }))
} finally {
  socket?.close()
  stopChildren()
  await wait(500)
  await cleanup().catch((error) => console.error(`PHASE029G_CLEANUP_ERROR=${error.message}`))
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}
