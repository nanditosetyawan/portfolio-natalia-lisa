import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5196'
const cdpPort = 9356
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase-038-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function waitForHttp(url, timeout = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch { /* Vite is starting. */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForJson(url, timeout = 20_000) {
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5196', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1600,1050', baseUrl
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  let page
  const targetStarted = Date.now()
  while (!page && Date.now() - targetStarted < 15_000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5196'))
    if (!page) await wait(100)
  }
  if (!page) throw new Error('Browser target not found.')

  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
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

  async function waitFor(expression, timeout = 20_000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(50)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  async function setFileInput(selector, filePath) {
    const { root } = await send('DOM.getDocument', { depth: 1 })
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector })
    if (!nodeId) throw new Error(`File input was not found: ${selector}`)
    await send('DOM.setFileInputFiles', { nodeId, files: [filePath] })
  }

  const settle = async (milliseconds = 90) => {
    await wait(milliseconds)
    await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
  }

  async function selectObject(objectId, category = 'media') {
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const object=editor.objects.find(candidate=>candidate.id===${JSON.stringify(objectId)});if(!object)throw new Error('Object not registered: '+${JSON.stringify(objectId)});editor.selectObject(object);await tick();const group=document.querySelector('[data-property-category="'+${JSON.stringify(category)}+'"]');if(group?.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true'){group.querySelector('.accordion-toggle').click();await tick()}return editor.selectedObjectId})()`)
    await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').selectedObjectId===${JSON.stringify(objectId)}`)
  }

  async function setInput(key, value, selector = 'input') {
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const field=document.querySelector('[data-property-key=${JSON.stringify(key)}]');if(!field)throw new Error('Missing field: '+${JSON.stringify(key)});field.scrollIntoView({block:'center'});const input=field.querySelector(${JSON.stringify(selector)});if(!input)throw new Error('Missing input: '+${JSON.stringify(key)});input.value=${JSON.stringify(String(value))};input.dispatchEvent(new Event('input',{bubbles:true}));await tick()})()`)
    await settle()
  }

  async function setSelect(key, value) {
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const field=document.querySelector('[data-property-key=${JSON.stringify(key)}]');if(!field)throw new Error('Missing select: '+${JSON.stringify(key)});field.scrollIntoView({block:'center'});const select=field.querySelector('select');if(!select)throw new Error('Missing select control: '+${JSON.stringify(key)});select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));await tick()})()`)
    await settle()
  }

  async function ensureToggle(key, enabled) {
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const field=document.querySelector('[data-property-key=${JSON.stringify(key)}]');if(!field)throw new Error('Missing toggle: '+${JSON.stringify(key)});field.scrollIntoView({block:'center'});const input=field.querySelector('input[type="checkbox"]');if(!input)throw new Error('Missing checkbox: '+${JSON.stringify(key)});if(Boolean(input.checked)!==${enabled})input.click();await tick()})()`)
    await settle()
  }

  async function setColor(key, value) {
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const field=document.querySelector('[data-property-key=${JSON.stringify(key)}]');if(!field)throw new Error('Missing color: '+${JSON.stringify(key)});field.scrollIntoView({block:'center'});field.querySelector('.color-summary').click();await tick();const input=field.querySelector('.picker-head input:not([type="color"])');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}));await tick();field.querySelector('.color-summary').click();await tick()})()`)
    await settle()
  }

  async function saveDraft() {
    const before = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftLockVersion`)
    await evaluate(`document.querySelector('.tbar-save').click()`)
    await waitFor(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return !editor.isSavingDraft&&editor.draftRevisionId&&editor.draftLockVersion!==${JSON.stringify(before)}&&document.querySelector('.editor-save-status')?.textContent.trim()==='Saved'})()`)
    return evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return{id:editor.draftRevisionId,lock:editor.draftLockVersion,revision:editor.draftRevisionNumber,base:editor.baseRevisionNumber}})()`)
  }

  async function publishDraft() {
    const before = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').publishedRevisionNumber`)
    await evaluate(`document.querySelector('.tbar-publish').click()`)
    await waitFor(`Boolean(document.querySelector('.publish-modal'))`)
    await evaluate(`document.querySelector('.publish-confirm').click()`)
    const expected = (before ?? 0) + 1
    await waitFor(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return !editor.isPublishing&&editor.publishedRevisionNumber===${expected}&&!document.querySelector('.publish-modal')})()`, 30_000)
    return expected
  }

  async function routeTo(name, query = null) {
    await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;await router.push({name:${JSON.stringify(name)},...(${JSON.stringify(query)}?{query:${JSON.stringify(query)}}:{})});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return router.currentRoute.value.fullPath})()`)
    await settle(150)
  }

  async function captureScene(ids) {
    return evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const ids=${JSON.stringify(ids)};const element=id=>document.querySelector('[data-snapshot-instance-id="'+CSS.escape(id)+'"]')||document.querySelector('[data-editor-object-id="'+CSS.escape(id)+'"]');const state={};for(const id of ids){const node=element(id);const rect=node?.getBoundingClientRect();const style=node?getComputedStyle(node):null;state[id]={exists:Boolean(node),rect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,computed:style?{width:style.width,height:style.height,translate:style.translate,rotate:style.rotate,opacity:style.opacity,borderRadius:style.borderRadius,filter:style.filter,boxShadow:style.boxShadow}:null,layout:structuredClone(editor.draftSnapshot.layout[id]??null),media:structuredClone(editor.draftSnapshot.media.styles[id]??null),background:structuredClone(editor.draftSnapshot.backgrounds[id]??null),assetId:editor.draftSnapshot.media.assignments.find(item=>item.entityId===id)?.assetId??null,nodeMarker:node?.dataset.phase038Node??null}}return{selected:editor.selectedObjectId,instances:structuredClone(editor.draftSnapshot.instances),objects:state,rootMarker:document.querySelector('.guest-home')?.dataset.phase038Root??null,section:structuredClone(editor.draftSnapshot.layout['portfolio']??null)}})()`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('DOM.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(async()=>{const authModule=await import('/src/stores/auth.ts');const router=(await import('/src/router/index.ts')).default;authModule.useAuthStore().$patch({isAdmin:true,isInitialized:true,isLoading:false});await router.push({name:'admin-edit',query:{draft:'new'}});return true})()`)
  await waitFor(`Boolean(document.querySelector('.edit-page'))&&!document.querySelector('.editor-recovery')&&Boolean(document.querySelector('[data-editor-object-id="portfolio-profile-media"]'))`)
  await settle(250)

  const compatibility = await evaluate(`(async()=>{const defaults=await import('/src/data/default/site.ts');const snapshots=await import('/src/editor/editorSnapshot.ts');const repository=await import('/src/repositories/editorRevisionRepository.ts');const commands=await import('/src/editor/editorInstanceCommands.ts');const legacy=snapshots.createEditorSnapshot(defaults.createDefaultSiteSnapshot());delete legacy.instances;legacy.compatibility={schemaVersion:1,minimumReaderVersion:1,maximumWriterVersion:1};const restored=snapshots.deserializeEditorSnapshot(JSON.stringify(legacy));const isolated=new repository.InMemoryEditorRevisionRepository('compatibility-admin');isolated.seedPublished(legacy,1);const oldPublished=await isolated.loadPublishedSnapshot();const reference=restored.media.references[0];const insertion=commands.insertImageInstanceChanges(restored,{section:'Portfolio',reference,layout:{positionMode:'absolute',x:10,y:12,width:'160px',height:'120px'}});const write=(root,path,value)=>{const parts=path.split('.');let parent=root;for(const part of parts.slice(0,-1)){parent[part]??={};parent=parent[part]}const leaf=parts.at(-1);if(value===undefined)delete parent[leaf];else parent[leaf]=structuredClone(value)};for(const change of insertion.changes)write(restored,change.propertyPath,change.nextValue);const saved=await isolated.saveDraft({snapshot:restored,mediaReferences:[],expectedBaseRevision:1,createNew:true});const published=await isolated.publishDraft({draftRevisionId:saved.revision.id,expectedPublishedRevision:1,expectedDraftLockVersion:saved.revision.lock_version});const rollback=await isolated.rollbackRevision({targetRevisionId:oldPublished.revision.id,expectedPublishedRevision:published.revision_number});const active=await isolated.loadPublishedSnapshot();const invalid=structuredClone(restored);invalid.media.assignments=invalid.media.assignments.filter(item=>item.entityId!==insertion.instance.instanceId);return{restoredVersion:restored.compatibility.schemaVersion,restoredInstances:restored.instances.length,oldStoredVersion:oldPublished.snapshot.compatibility.schemaVersion,oldStoredInstances:oldPublished.snapshot.instances.length,publishedInstances:published.snapshot.instances.map(item=>item.instanceId),rollbackKind:rollback.publication_kind,activeInstances:active.snapshot.instances.length,draftInstances:(await isolated.loadDraft(saved.revision.id)).revision.snapshot.instances.map(item=>item.instanceId),orphanRejected:!snapshots.validateEditorSnapshot(invalid).valid,serializedIds:snapshots.deserializeEditorSnapshot(snapshots.serializeEditorSnapshot(restored)).instances.map(item=>item.instanceId)}})()`)
  assert(compatibility.restoredVersion === 2 && compatibility.restoredInstances === 0 && compatibility.oldStoredVersion === 2 && compatibility.oldStoredInstances === 0, `v1 compatibility normalization failed: ${JSON.stringify(compatibility)}`)
  assert(compatibility.publishedInstances.length === 1 && compatibility.activeInstances === 0 && compatibility.draftInstances.length === 1 && compatibility.rollbackKind === 'rollback' && compatibility.orphanRejected && JSON.stringify(compatibility.serializedIds) === JSON.stringify(compatibility.draftInstances), `old-revision publish/rollback compatibility failed: ${JSON.stringify(compatibility)}`)

  await selectObject('portfolio-profile-media')
  await evaluate(`document.querySelector('.guest-home').dataset.phase038Root='stable'`)
  const baseline = await evaluate(`(async()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');await library.refresh();return{fixedAsset:editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId,assets:library.assets.length,assetIds:library.assets.map(item=>item.id),instances:editor.draftSnapshot.instances.length}})()`)

  const uploadFile = path.join(profilePath, 'phase038-image-b.svg')
  await writeFile(uploadFile, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><path fill="#b85b69" d="M200 0 400 300H0z"/></svg>')
  await setFileInput('[data-property-key="media.upload"] input[type="file"]', uploadFile)
  await waitFor(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;return pinia._s.get('editor').draftSnapshot.instances.length===1&&!pinia._s.get('media-library').mutating})()`)
  await settle(180)
  const insertedB = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const instance=editor.draftSnapshot.instances[0];const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId===instance.instanceId);const asset=library.assets.find(item=>item.id===assignment.assetId);return{id:instance.instanceId,label:instance.label,createdAt:instance.createdAt,assetId:assignment.assetId,asset:{name:asset?.name,path:asset?.storagePath,persisted:asset?.metadataPersisted},fixedAsset:editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId,assetCount:library.assets.length,dom:Boolean(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(instance.instanceId)+'"]')),registered:editor.objects.some(item=>item.id===instance.instanceId&&item.type==='Image'&&item.ux?.dynamicInstance),selected:editor.selectedObjectId}})()`)
  assert(insertedB.id.startsWith('portfolio-image-') && insertedB.fixedAsset === baseline.fixedAsset && insertedB.assetCount === baseline.assets + 1 && insertedB.asset.path.startsWith('draft/library/') && insertedB.asset.persisted && insertedB.dom && insertedB.registered && insertedB.selected === insertedB.id, `Upload did not create canonical Image B: ${JSON.stringify({baseline,insertedB})}`)

  await evaluate(`document.querySelector('[data-property-key="media.choose"] button').click()`)
  await waitFor(`Boolean(document.querySelector('.asset-picker'))`)
  const assetsBeforeChoose = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('media-library').assets.length`)
  await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const card=document.querySelector('[data-asset-card-id="media-profile-primary"]');if(!card)throw new Error('Existing Media Library asset was not found.');card.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await tick();await tick()})()`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.length===2`)
  await settle(150)
  const insertedC = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const instance=editor.draftSnapshot.instances.find(item=>item.instanceId!==${JSON.stringify(insertedB.id)});const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId===instance.instanceId);return{id:instance.instanceId,assetId:assignment.assetId,assets:library.assets.length,selected:editor.selectedObjectId,fixedExists:Boolean(document.querySelector('[data-editor-object-id="portfolio-profile-media"]')),dynamicDom:[...document.querySelectorAll('[data-snapshot-instance-id]')].map(item=>item.dataset.snapshotInstanceId),pickerClosed:!document.querySelector('.asset-picker')}})()`)
  assert(insertedC.id !== insertedB.id && insertedC.assetId === 'media-profile-primary' && insertedC.assets === assetsBeforeChoose && insertedC.selected === insertedC.id && insertedC.fixedExists && insertedC.dynamicDom.includes(insertedB.id) && insertedC.dynamicDom.includes(insertedC.id) && insertedC.pickerClosed, `Choose from Media did not create canonical Image C: ${JSON.stringify(insertedC)}`)

  await evaluate(`(()=>{const image=document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');image.dataset.phase038Node='stable';image.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true})()`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').selectedObjectId===${JSON.stringify(insertedB.id)}`)
  const previewSelection = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const layer=document.querySelector('[data-layer-object-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');return{selected:editor.selectedObjectId,section:editor.selectedSection,layerSelected:layer?.classList.contains('selected'),mediaOpen:document.querySelector('[data-property-category="media"] .accordion-toggle')?.getAttribute('aria-expanded')}})()`)
  assert(previewSelection.selected === insertedB.id && previewSelection.section === 'Portfolio' && previewSelection.layerSelected && previewSelection.mediaOpen === 'true', `Preview/Navigator/Inspector selection did not converge: ${JSON.stringify(previewSelection)}`)

  const navigator = await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const article=()=>document.querySelector('[data-layer-object-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');article().querySelector('.object-select').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));await tick();const rename=document.querySelector('[data-layer-rename-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');rename.value='Image B';rename.dispatchEvent(new Event('input',{bubbles:true}));rename.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();const renamed=editor.draftSnapshot.instances.find(item=>item.instanceId===${JSON.stringify(insertedB.id)})?.label;const buttons=article().querySelectorAll('.object-state-button');buttons[0].click();buttons[1].click();await tick();const locked=editor.objectState(${JSON.stringify(insertedB.id)});buttons[0].click();buttons[1].click();await tick();const unlocked=editor.objectState(${JSON.stringify(insertedB.id)});const beforeOrders=editor.draftSnapshot.instances.map(item=>({id:item.instanceId,order:item.order}));article().querySelector('.layer-drag-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',altKey:true,bubbles:true,cancelable:true}));await tick();await tick();return{renamed,locked,unlocked,beforeOrders,afterOrders:editor.draftSnapshot.instances.map(item=>({id:item.instanceId,order:item.order})),layerText:article()?.textContent??'',selected:editor.selectedObjectId}})()`)
  assert(navigator.renamed === 'Image B' && navigator.locked.locked && navigator.locked.hidden && !navigator.unlocked.locked && !navigator.unlocked.hidden && navigator.layerText.includes('Image B') && navigator.selected === insertedB.id && JSON.stringify(navigator.beforeOrders) !== JSON.stringify(navigator.afterOrders), `Navigator dynamic-instance actions failed: ${JSON.stringify(navigator)}`)

  await selectObject(insertedB.id)
  const beforeGeometry = await captureScene(['portfolio-profile-media', insertedB.id, insertedC.id])
  await setInput('media.width', 240)
  await setInput('media.height', 180)
  await ensureToggle('media.aspectRatioLocked', true)
  await setInput('media.width', 300)
  await setInput('media.positionX', 190)
  await setInput('media.positionY', 35)
  await setInput('media.rotate', 9)
  await setInput('media.opacity', 74)
  await setInput('media.radius', 17)
  await ensureToggle('media.outlineEnabled', true)
  await setInput('media.outlineWidth', 5)
  await setColor('media.border', '#b85b69')
  await ensureToggle('effects.shadow', true)
  await ensureToggle('media.hover', true)
  const afterGeometry = await captureScene(['portfolio-profile-media', insertedB.id, insertedC.id])
  const unchanged = (id) => JSON.stringify({ layout: beforeGeometry.objects[id].layout, media: beforeGeometry.objects[id].media, background: beforeGeometry.objects[id].background }) === JSON.stringify({ layout: afterGeometry.objects[id].layout, media: afterGeometry.objects[id].media, background: afterGeometry.objects[id].background })
  assert(afterGeometry.objects[insertedB.id].computed.width === '300px' && afterGeometry.objects[insertedB.id].computed.height === '225px' && afterGeometry.objects[insertedB.id].computed.translate === '190px 35px' && afterGeometry.objects[insertedB.id].computed.rotate === '9deg', `Image B geometry/aspect lock did not render: ${JSON.stringify(afterGeometry.objects[insertedB.id])}`)
  assert(afterGeometry.objects[insertedB.id].media.aspectRatioLocked && Math.abs(afterGeometry.objects[insertedB.id].media.aspectRatio - 4 / 3) < .001 && /url\(/.test(afterGeometry.objects[insertedB.id].computed.filter) && /drop-shadow\(/.test(afterGeometry.objects[insertedB.id].computed.filter) && afterGeometry.objects[insertedB.id].computed.boxShadow === 'none', `Image B alpha-aware effects did not render: ${JSON.stringify(afterGeometry.objects[insertedB.id])}`)
  assert(unchanged('portfolio-profile-media') && unchanged(insertedC.id) && afterGeometry.selected === insertedB.id && afterGeometry.rootMarker === 'stable' && afterGeometry.objects[insertedB.id].nodeMarker === 'stable' && JSON.stringify(beforeGeometry.section) === JSON.stringify(afterGeometry.section), `Image B mutation leaked or remounted Preview: ${JSON.stringify({before:beforeGeometry,after:afterGeometry})}`)

  const responsive = await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));document.querySelector('[data-canvas-preset="laptop-1024"]').click();await tick();await tick();return true})()`)
  void responsive
  await setInput('media.width', 260)
  const tablet = await evaluate(`(async()=>{const responsive=await import('/src/editor/responsiveLayout.ts');const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const id=responsive.responsiveSnapshotEntityId('laptop',${JSON.stringify(insertedB.id)});const image=document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');return{id,base:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),override:structuredClone(editor.draftSnapshot.layout[id]),mediaBase:structuredClone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedB.id)}]),mediaOverride:structuredClone(editor.draftSnapshot.media.styles[id]),computed:{width:getComputedStyle(image).width,height:getComputedStyle(image).height}}})()`)
  assert(tablet.base.width === '300px' && tablet.base.height === '225px' && tablet.override.width === '260px' && tablet.override.height === '195px' && tablet.computed.width === '260px' && tablet.computed.height === '195px', `Dynamic sparse responsive geometry failed: ${JSON.stringify(tablet)}`)
  await evaluate(`document.querySelector('[data-canvas-preset="desktop-1440"]').click()`)
  await settle()

  await selectObject(insertedB.id, 'animation')
  await setSelect('animation.type', 'fade')
  const animation = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const image=document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');return{settings:structuredClone(editor.draftSnapshot.animations[${JSON.stringify(insertedB.id)}]),entrance:image.dataset.animationEntrance,selected:editor.selectedObjectId}})()`)
  assert(animation.settings?.name && animation.entrance === 'fade' && animation.selected === insertedB.id, `Dynamic animation integration failed: ${JSON.stringify(animation)}`)

  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'c',ctrlKey:true,bubbles:true}))`)
  await selectObject(insertedC.id)
  const cStyleBeforePaste = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return{layout:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(insertedC.id)}]),media:structuredClone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedC.id)}]),background:structuredClone(editor.draftSnapshot.backgrounds[${JSON.stringify(insertedC.id)}]??null)}})()`)
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true}))`)
  await settle()
  const stylePaste = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const pasted={layout:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(insertedC.id)}]),media:structuredClone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedC.id)}]),background:structuredClone(editor.draftSnapshot.backgrounds[${JSON.stringify(insertedC.id)}]??null)};editor.undo();return{pasted,history:editor.commandHistory.length,selected:editor.selectedObjectId}})()`)
  await settle()
  const cStyleAfterUndo = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return{layout:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(insertedC.id)}]),media:structuredClone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedC.id)}]),background:structuredClone(editor.draftSnapshot.backgrounds[${JSON.stringify(insertedC.id)}]??null)}})()`)
  assert(stylePaste.pasted.layout.width === '300px' && stylePaste.pasted.media.outlineEnabled && stylePaste.pasted.background.boxShadow && JSON.stringify(cStyleBeforePaste) === JSON.stringify(cStyleAfterUndo), `Dynamic Copy/Paste Style or Undo failed: ${JSON.stringify({cStyleBeforePaste,stylePaste,cStyleAfterUndo})}`)
  await selectObject(insertedB.id)

  const oldAssetId = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)}).assetId`)
  const beforeReplaceConfig = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return{layout:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),style:structuredClone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedB.id)}]),background:structuredClone(editor.draftSnapshot.backgrounds[${JSON.stringify(insertedB.id)}]),animation:structuredClone(editor.draftSnapshot.animations[${JSON.stringify(insertedB.id)}])}})()`)
  const replacementFile = path.join(profilePath, 'phase038-image-b-replacement.svg')
  await writeFile(replacementFile, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><circle cx="200" cy="150" r="140" fill="#49362f"/></svg>')
  await setFileInput('[data-property-key="media.replace"] input[type="file"]', replacementFile)
  await waitFor(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');return !library.mutating&&editor.draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)})?.assetId!==${JSON.stringify(oldAssetId)}})()`)
  const replace = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)});return{idStillPresent:editor.draftSnapshot.instances.some(item=>item.instanceId===${JSON.stringify(insertedB.id)}),newAssetId:assignment.assetId,oldAssetPresent:library.assets.some(item=>item.id===${JSON.stringify(oldAssetId)}),config:{layout:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),style:structuredClone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedB.id)}]),background:structuredClone(editor.draftSnapshot.backgrounds[${JSON.stringify(insertedB.id)}]),animation:structuredClone(editor.draftSnapshot.animations[${JSON.stringify(insertedB.id)}])},command:editor.commandHistory.at(-1)?.type,selected:editor.selectedObjectId}})()`)
  assert(replace.idStillPresent && replace.newAssetId !== oldAssetId && replace.oldAssetPresent && replace.command === 'REPLACE_MEDIA' && replace.selected === insertedB.id && JSON.stringify(replace.config) === JSON.stringify(beforeReplaceConfig), `Replace changed identity/configuration or deleted old asset: ${JSON.stringify(replace)}`)

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  await evaluate(`document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]')?.scrollIntoView({block:'center',inline:'center'})`)
  await settle(150)
  const editorScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-038-editor-instances.png'), Buffer.from(editorScreenshot.data, 'base64'))

  const firstSave = await saveDraft()
  const beforeReload = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return{ids:editor.draftSnapshot.instances.map(item=>item.instanceId),instances:structuredClone(editor.draftSnapshot.instances),layout:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),responsive:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(tablet.id)}]),asset:editor.draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)})?.assetId,schema:editor.draftSnapshot.compatibility.schemaVersion}})()`)
  await routeTo('admin-dashboard')
  await routeTo('admin-edit', { draft: firstSave.id })
  await waitFor(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return Boolean(document.querySelector('.edit-page'))&&!document.querySelector('.editor-recovery')&&editor.draftSnapshot.instances.length===2&&editor.draftSnapshot.instances.every(item=>document.querySelector('[data-snapshot-instance-id="'+CSS.escape(item.instanceId)+'"]'))})()`)
  const afterReload = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return{ids:editor.draftSnapshot.instances.map(item=>item.instanceId),instances:structuredClone(editor.draftSnapshot.instances),layout:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),responsive:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(tablet.id)}]),asset:editor.draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)})?.assetId,schema:editor.draftSnapshot.compatibility.schemaVersion,registered:editor.draftSnapshot.instances.every(item=>editor.objects.some(object=>object.id===item.instanceId)),selected:editor.selectedObjectId}})()`)
  assert(JSON.stringify(beforeReload) === JSON.stringify({ ...afterReload, registered: undefined, selected: undefined }) || (JSON.stringify(beforeReload.ids) === JSON.stringify(afterReload.ids) && JSON.stringify(beforeReload.instances) === JSON.stringify(afterReload.instances) && JSON.stringify(beforeReload.layout) === JSON.stringify(afterReload.layout) && JSON.stringify(beforeReload.responsive) === JSON.stringify(afterReload.responsive) && beforeReload.asset === afterReload.asset && afterReload.schema === 2 && afterReload.registered), `Draft reload changed stable instances: ${JSON.stringify({beforeReload,afterReload})}`)

  await selectObject(insertedB.id)
  const beforeDuplicate = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return{ids:editor.draftSnapshot.instances.map(item=>item.instanceId),layout:structuredClone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),asset:editor.draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)})?.assetId}})()`)
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'d',ctrlKey:true,bubbles:true,cancelable:true}))`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.length===3`)
  const duplicated = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const instance=editor.draftSnapshot.instances.find(item=>!${JSON.stringify(beforeDuplicate.ids)}.includes(item.instanceId));const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId===instance.instanceId);const layout=editor.draftSnapshot.layout[instance.instanceId];return{id:instance.instanceId,assetId:assignment.assetId,layout:structuredClone(layout),style:structuredClone(editor.draftSnapshot.media.styles[instance.instanceId]),animation:structuredClone(editor.draftSnapshot.animations[instance.instanceId]),selected:editor.selectedObjectId,command:editor.commandHistory.at(-1)?.type,dom:Boolean(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(instance.instanceId)+'"]'))}})()`)
  assert(duplicated.id !== insertedB.id && duplicated.assetId === beforeDuplicate.asset && duplicated.layout.x === Number.parseFloat(beforeDuplicate.layout.x) + 24 && duplicated.layout.y === Number.parseFloat(beforeDuplicate.layout.y) + 24 && duplicated.style.outlineEnabled && duplicated.animation.name && duplicated.selected === duplicated.id && duplicated.command === 'DUPLICATE_INSTANCE' && duplicated.dom, `Duplicate did not create an independent canonical Image D: ${JSON.stringify({beforeDuplicate,duplicated})}`)
  await evaluate(`document.querySelector('.tbar-undo').click()`)
  await waitFor(`!document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.some(item=>item.instanceId===${JSON.stringify(duplicated.id)})`)
  const undoDuplicate = await evaluate(`!document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(duplicated.id)})+'"]')`)
  await evaluate(`document.querySelector('.tbar-redo').click()`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.some(item=>item.instanceId===${JSON.stringify(duplicated.id)})`)
  const redoDuplicate = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return{sameId:editor.draftSnapshot.instances.some(item=>item.instanceId===${JSON.stringify(duplicated.id)}),dom:Boolean(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(duplicated.id)})+'"]')),history:editor.commandHistory.length}})()`)
  assert(undoDuplicate && redoDuplicate.sameId && redoDuplicate.dom && redoDuplicate.history <= 10, `Duplicate Undo/Redo identity failed: ${JSON.stringify({undoDuplicate,redoDuplicate})}`)

  const secondSave = await saveDraft()
  const favorite = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');await repo.favoriteRepository.addFavorite(${JSON.stringify(secondSave.id)});return{favorite:await repo.favoriteRepository.isFavorite(${JSON.stringify(secondSave.id)}),drafts:await repo.editorDraftRepository.countDrafts(),favorites:await repo.favoriteRepository.countFavorites()}})()`)
  assert(favorite.favorite && favorite.drafts === 1 && favorite.favorites === 1, `Draft/Favorite pre-publish contract failed: ${JSON.stringify(favorite)}`)
  const revisionOne = await publishDraft()
  assert(revisionOne === 1, `First Published revision was not #1: ${revisionOne}`)
  const postPublishPreservation = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');const draft=await repo.editorDraftRepository.loadDraft(${JSON.stringify(secondSave.id)});const published=await repo.guestPublishedRepository.loadPublishedSnapshot();return{draftIds:draft.revision.snapshot.instances.map(item=>item.instanceId),publishedIds:published.snapshot.instances.map(item=>item.instanceId),favorite:await repo.favoriteRepository.isFavorite(${JSON.stringify(secondSave.id)}),history:(await repo.editorPublishRepository.getHistory()).map(item=>({id:item.id,revision:item.revision_number,kind:item.publication_kind}))}})()`)
  assert(postPublishPreservation.draftIds.length === 3 && JSON.stringify(postPublishPreservation.draftIds) === JSON.stringify(postPublishPreservation.publishedIds) && postPublishPreservation.favorite && postPublishPreservation.history.length === 1, `Atomic Publish did not preserve Draft/Favorite/instances: ${JSON.stringify(postPublishPreservation)}`)

  await routeTo('home')
  await waitFor(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;return Boolean(document.querySelector('.guest-home'))&&document.querySelectorAll('[data-snapshot-instance-id]').length===3})()`, 20_000)
  const guestOne = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const published=pinia._s.get('site').publishedRuntime;const images=[...document.querySelectorAll('[data-snapshot-instance-id]')];return{ids:images.map(item=>item.dataset.snapshotInstanceId),fixed:Boolean(document.querySelector('[data-editor-object-id="portfolio-profile-media"]')),revision:published.revisionNumber,paths:pinia._s.get('editor').draftSnapshot.media.references.map(item=>item.storagePath??null),guestSource:document.querySelector('.guest-home')?true:false}})()`)
  assert(guestOne.revision === 1 && guestOne.fixed && guestOne.ids.length === 3 && postPublishPreservation.publishedIds.every((id) => guestOne.ids.includes(id)), `Guest did not render Published dynamic instances: ${JSON.stringify(guestOne)}`)

  await routeTo('admin-edit', { draft: secondSave.id })
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.length===3`)
  await selectObject(insertedC.id)
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}))`)
  await waitFor(`Boolean(document.querySelector('.product-confirmation'))`)
  await evaluate(`document.querySelector('.product-confirmation__confirm').click()`)
  await waitFor(`!document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.some(item=>item.instanceId===${JSON.stringify(insertedC.id)})`)
  const deleteSafety = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');return{instanceGone:!editor.draftSnapshot.instances.some(item=>item.instanceId===${JSON.stringify(insertedC.id)}),assetStillPresent:library.assets.some(item=>item.id==='media-profile-primary'),domGone:!document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedC.id)})+'"]'),command:editor.commandHistory.at(-1)?.type}})()`)
  assert(deleteSafety.instanceGone && deleteSafety.assetStillPresent && deleteSafety.domGone && deleteSafety.command === 'DELETE_INSTANCE', `Delete removed an asset or left the instance projection: ${JSON.stringify(deleteSafety)}`)
  const deleteSave = await saveDraft()
  const publishedBeforeSecond = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');const active=await repo.guestPublishedRepository.loadPublishedSnapshot();const draft=await repo.editorDraftRepository.loadDraft(${JSON.stringify(deleteSave.id)});return{publishedHasC:active.snapshot.instances.some(item=>item.instanceId===${JSON.stringify(insertedC.id)}),draftHasC:draft.revision.snapshot.instances.some(item=>item.instanceId===${JSON.stringify(insertedC.id)})}})()`)
  assert(publishedBeforeSecond.publishedHasC && !publishedBeforeSecond.draftHasC, `Draft isolation from active Guest revision failed: ${JSON.stringify(publishedBeforeSecond)}`)

  const revisionTwo = await publishDraft()
  assert(revisionTwo === 2, `Second Published revision was not #2: ${revisionTwo}`)
  await routeTo('home')
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('site').publishedRuntime.revisionNumber===2`)
  const guestTwo = await evaluate(`(()=>({ids:[...document.querySelectorAll('[data-snapshot-instance-id]')].map(item=>item.dataset.snapshotInstanceId),hasC:Boolean(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedC.id)})+'"]'))}))()`)
  assert(!guestTwo.hasC && guestTwo.ids.length === 2, `Second Publish did not update Guest instance collection: ${JSON.stringify(guestTwo)}`)

  const rollback = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');const runtime=await import('/src/runtime/publishedRuntime.ts');const history=await repo.editorPublishRepository.getHistory();const target=history.find(item=>item.revision_number===1);const revision=await repo.editorPublishRepository.rollbackRevision({targetRevisionId:target.id,expectedPublishedRevision:2,note:'Phase 038 runtime rollback'});runtime.invalidatePublishedRuntimeCache(revision.revision_number);await runtime.initializePublishedRuntime({force:true});const draft=await repo.editorDraftRepository.loadDraft(${JSON.stringify(deleteSave.id)});return{revision:revision.revision_number,kind:revision.publication_kind,source:revision.rollback_source_revision_id,activeIds:(await repo.guestPublishedRepository.loadPublishedSnapshot()).snapshot.instances.map(item=>item.instanceId),draftIds:draft.revision.snapshot.instances.map(item=>item.instanceId),favorite:await repo.favoriteRepository.isFavorite(${JSON.stringify(deleteSave.id)}),history:(await repo.editorPublishRepository.getHistory()).map(item=>({revision:item.revision_number,kind:item.publication_kind}))}})()`)
  await waitFor(`Boolean(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedC.id)})+'"]'))`)
  assert(rollback.revision === 3 && rollback.kind === 'rollback' && rollback.activeIds.includes(insertedC.id) && !rollback.draftIds.includes(insertedC.id) && rollback.favorite && rollback.history.length === 3, `Rollback changed Draft/Favorite or failed to restore instances: ${JSON.stringify(rollback)}`)

  const mediaUsage = await evaluate(`(async()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const library=pinia._s.get('media-library');await library.refresh();const replacement=${JSON.stringify(replace.newAssetId)};const asset=library.assets.find(item=>item.id===replacement);return{id:asset?.id,usageCount:asset?.usageCount,usages:asset?.usages.map(item=>({entityId:item.entityId,source:item.source,section:item.section,label:item.label})),safeToDelete:asset?.safeToDelete,location:asset?.location}})()`)
  const usageEntities = new Set((mediaUsage.usages ?? []).map((usage) => usage.entityId))
  assert(mediaUsage.id === replace.newAssetId && mediaUsage.usageCount === 4 && usageEntities.has(insertedB.id) && usageEntities.has(duplicated.id) && !mediaUsage.safeToDelete && mediaUsage.location === 'Both', `Media usage did not count dynamic references independently: ${JSON.stringify(mediaUsage)}`)

  const performance = await evaluate(`new Promise(resolve=>{const root=document.querySelector('.guest-home');const node=document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');const frames=[];let previous=performance.now();let count=0;const step=now=>{frames.push(now-previous);previous=now;count+=1;if(count<90)requestAnimationFrame(step);else{const values=frames.slice(1);resolve({fps:Number((1000/(values.reduce((a,b)=>a+b,0)/values.length)).toFixed(2)),sameRoot:root===document.querySelector('.guest-home'),sameNode:node===document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]'),dynamicCount:document.querySelectorAll('[data-snapshot-instance-id]').length,filters:document.querySelectorAll('svg[data-snapshot-image-filter]').length})}};requestAnimationFrame(step)})`)
  assert(performance.fps >= 50 && performance.sameRoot && performance.sameNode && performance.dynamicCount === 3 && performance.filters <= performance.dynamicCount, `Dynamic projection performance/remount regression: ${JSON.stringify(performance)}`)

  const guestScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-038-guest-rollback.png'), Buffer.from(guestScreenshot.data, 'base64'))

  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
  assert(seriousErrors.length === 0, `Unexpected browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)
  process.stdout.write(`${JSON.stringify({status:'PASS',scope:'Phase 038 canonical dynamic Editor instances',compatibility,insert:{baseline,imageB:insertedB,imageC:insertedC},previewSelection,navigator,geometry:{before:beforeGeometry,after:afterGeometry},responsive,animation,stylePaste:{pasted:stylePaste.pasted,restored:cStyleAfterUndo},replace,draft:{firstSave,beforeReload,afterReload},duplicate:{duplicated,undoDuplicate,redoDuplicate},publish:{revisionOne,postPublishPreservation,guestOne,revisionTwo,guestTwo},deleteSafety,rollback,mediaUsage,performance,screenshots:['artifacts/phase-038-editor-instances.png','artifacts/phase-038-guest-rollback.png'],cloudMutation:'NOT RUN — isolated local repository/runtime certification; no disposable Cloud credential was used.'},null,2)}\n`)
  if (viteErrors.trim()) process.stderr.write(viteErrors)
  if (browserErrors.includes('ERROR:')) process.stderr.write(browserErrors)
} finally {
  socket?.close()
  stopChildren()
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}
