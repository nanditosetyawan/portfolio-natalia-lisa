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
  const imageResponses = []
  const failedImageRequests = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
    if (message.method === 'Network.responseReceived' && message.params.type === 'Image') {
      imageResponses.push({ url: message.params.response.url.split('?')[0], status: message.params.response.status, mimeType: message.params.response.mimeType })
    }
    if (message.method === 'Network.loadingFailed' && message.params.type === 'Image') {
      failedImageRequests.push({ error: message.params.errorText, canceled: Boolean(message.params.canceled) })
    }
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

  const imageLoadEvidence = []
  async function requireLoadedImage(selector, label) {
    await waitFor(`(()=>{const image=document.querySelector(${JSON.stringify(selector)});return image instanceof HTMLImageElement&&image.complete&&image.naturalWidth>0&&image.naturalHeight>0})()`)
    const evidence = await evaluate(`(()=>{const image=document.querySelector(${JSON.stringify(selector)});return{label:${JSON.stringify(label)},complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,sourceType:image.currentSrc.startsWith('blob:')?'object-url':image.currentSrc.includes('/storage/v1/object/public/')?'public-storage':image.currentSrc.startsWith('data:')?'data':'application-asset',loadState:image.dataset.mediaLoadState??null}})()`)
    imageLoadEvidence.push(evidence)
    return evidence
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
    return evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));const ids=${JSON.stringify(ids)};const element=id=>document.querySelector('[data-snapshot-instance-id="'+CSS.escape(id)+'"]')||document.querySelector('[data-editor-object-id="'+CSS.escape(id)+'"]');const state={};for(const id of ids){const node=element(id);const rect=node?.getBoundingClientRect();const style=node?getComputedStyle(node):null;state[id]={exists:Boolean(node),rect:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,computed:style?{width:style.width,height:style.height,translate:style.translate,rotate:style.rotate,opacity:style.opacity,borderRadius:style.borderRadius,filter:style.filter,boxShadow:style.boxShadow}:null,layout:clone(editor.draftSnapshot.layout[id]??null),media:clone(editor.draftSnapshot.media.styles[id]??null),background:clone(editor.draftSnapshot.backgrounds[id]??null),assetId:editor.draftSnapshot.media.assignments.find(item=>item.entityId===id)?.assetId??null,nodeMarker:node?.dataset.phase038Node??null}}return{selected:editor.selectedObjectId,instances:clone(editor.draftSnapshot.instances),objects:state,rootMarker:document.querySelector('.guest-home')?.dataset.phase038Root??null,section:clone(editor.draftSnapshot.layout['portfolio']??null)}})()`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')
  await send('Page.enable')
  await send('DOM.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(()=>{globalThis.__phase038bMediaErrors=[];window.addEventListener('portfolio:media-load-error',(event)=>globalThis.__phase038bMediaErrors.push(event.detail));return true})()`)
  await evaluate(`(async()=>{const authModule=await import('/src/stores/auth.ts');const router=(await import('/src/router/index.ts')).default;authModule.useAuthStore().$patch({isAdmin:true,isInitialized:true,isLoading:false});await router.push({name:'admin-edit',query:{draft:'new'}});return true})()`)
  await waitFor(`Boolean(document.querySelector('.edit-page'))&&!document.querySelector('.editor-recovery')&&Boolean(document.querySelector('[data-editor-object-id="portfolio-profile-media"]'))`)
  await settle(250)

  const compatibility = await evaluate(`(async()=>{const defaults=await import('/src/data/default/site.ts');const snapshots=await import('/src/editor/editorSnapshot.ts');const repository=await import('/src/repositories/editorRevisionRepository.ts');const commands=await import('/src/editor/editorInstanceCommands.ts');const legacy=snapshots.createEditorSnapshot(defaults.createDefaultSiteSnapshot());delete legacy.instances;legacy.compatibility={schemaVersion:1,minimumReaderVersion:1,maximumWriterVersion:1};const restored=snapshots.deserializeEditorSnapshot(JSON.stringify(legacy));const restoredBefore={version:restored.compatibility.schemaVersion,instances:restored.instances.length};const isolated=new repository.InMemoryEditorRevisionRepository('compatibility-admin');isolated.seedPublished(legacy,1);const oldPublished=await isolated.loadPublishedSnapshot();const reference=restored.media.references[0];const insertion=commands.insertImageInstanceChanges(restored,{section:'Portfolio',reference,layout:{positionMode:'absolute',x:10,y:12,width:'160px',height:'120px'}});const write=(root,path,value)=>{const parts=path.split('.');let parent=root;for(const part of parts.slice(0,-1)){parent[part]??={};parent=parent[part]}const leaf=parts.at(-1);if(value===undefined)delete parent[leaf];else parent[leaf]=structuredClone(value)};for(const change of insertion.changes)write(restored,change.propertyPath,change.nextValue);const saved=await isolated.saveDraft({snapshot:restored,mediaReferences:[],expectedBaseRevision:1,createNew:true});const published=await isolated.publishDraft({draftRevisionId:saved.revision.id,expectedPublishedRevision:1,expectedDraftLockVersion:saved.revision.lock_version});const rollback=await isolated.rollbackRevision({targetRevisionId:oldPublished.revision.id,expectedPublishedRevision:published.revision_number});const active=await isolated.loadPublishedSnapshot();const invalid=structuredClone(restored);invalid.media.assignments=invalid.media.assignments.filter(item=>item.entityId!==insertion.instance.instanceId);const invalidFixed=structuredClone(restored);const fixedAssignment=invalidFixed.media.assignments.find(item=>!item.entityId.startsWith('portfolio-image-'));invalidFixed.media.references=invalidFixed.media.references.filter(item=>item.assetId!==fixedAssignment.assetId);return{restoredVersion:restoredBefore.version,restoredInstances:restoredBefore.instances,oldStoredVersion:oldPublished.snapshot.compatibility.schemaVersion,oldStoredInstances:oldPublished.snapshot.instances.length,publishedInstances:published.snapshot.instances.map(item=>item.instanceId),rollbackKind:rollback.publication_kind,activeInstances:active.snapshot.instances.length,draftInstances:(await isolated.loadDraft(saved.revision.id)).revision.snapshot.instances.map(item=>item.instanceId),orphanRejected:!snapshots.validateEditorSnapshot(invalid).valid,fixedOrphanRejected:!snapshots.validateEditorSnapshot(invalidFixed).valid,serializedIds:snapshots.deserializeEditorSnapshot(snapshots.serializeEditorSnapshot(restored)).instances.map(item=>item.instanceId)}})()`)
  assert(compatibility.restoredVersion === 2 && compatibility.restoredInstances === 0 && compatibility.oldStoredVersion === 2 && compatibility.oldStoredInstances === 0, `v1 compatibility normalization failed: ${JSON.stringify(compatibility)}`)
  assert(compatibility.publishedInstances.length === 1 && compatibility.activeInstances === 0 && compatibility.draftInstances.length === 1 && compatibility.rollbackKind === 'rollback' && compatibility.orphanRejected && compatibility.fixedOrphanRejected && JSON.stringify(compatibility.serializedIds) === JSON.stringify(compatibility.draftInstances), `old-revision publish/rollback compatibility failed: ${JSON.stringify(compatibility)}`)

  const limits = await evaluate(`(async()=>{
    const defaults=await import('/src/data/default/site.ts');
    const snapshots=await import('/src/editor/editorSnapshot.ts');
    const instances=await import('/src/editor/editorInstances.ts');
    const commands=await import('/src/editor/editorInstanceCommands.ts');
    const repository=await import('/src/repositories/editorRevisionRepository.ts');
    const write=(root,path,value)=>{const parts=path.split('.');let parent=root;for(const part of parts.slice(0,-1)){parent[part]??={};parent=parent[part]}const leaf=parts.at(-1);if(value===undefined)delete parent[leaf];else parent[leaf]=structuredClone(value)};
    const sectionSnapshot=snapshots.createEditorSnapshot(defaults.createDefaultSiteSnapshot());
    const reference=sectionSnapshot.media.references[0];
    for(let index=0;index<instances.MAX_DYNAMIC_INSTANCES_PER_SECTION;index+=1){
      const result=commands.insertImageInstanceChanges(sectionSnapshot,{section:'Portfolio',reference,label:'Limit '+index,instanceId:'limit-image-portfolio-'+index,createdAt:new Date(index).toISOString(),layout:{positionMode:'absolute',x:index,y:index,width:100,height:100,rotation:0,display:'block',visibility:'visible',zIndex:index+1}});
      for(const change of result.changes)write(sectionSnapshot,change.propertyPath,change.nextValue);
    }
    const validAt50=snapshots.validateEditorSnapshot(sectionSnapshot);
    let sectionRejected=false;let sectionMessage='';
    try{commands.insertImageInstanceChanges(sectionSnapshot,{section:'Portfolio',reference})}catch(error){sectionRejected=true;sectionMessage=String(error?.message??error)}
    const invalid51=structuredClone(sectionSnapshot);const first=invalid51.instances[0];const extraId='limit-image-portfolio-50';
    invalid51.instances.push({...structuredClone(first),instanceId:extraId,label:'Limit 50',order:50,source:{kind:'media-assignment',assignmentEntityId:extraId}});
    invalid51.media.assignments.push({...structuredClone(invalid51.media.assignments.find(item=>item.entityId===first.instanceId)),entityId:extraId});
    invalid51.layout[extraId]=structuredClone(invalid51.layout[first.instanceId]);
    invalid51.media.styles[extraId]=structuredClone(invalid51.media.styles[first.instanceId]);
    const invalidAt51=snapshots.validateEditorSnapshot(invalid51);
    const isolated=new repository.InMemoryEditorRevisionRepository('limit-admin');
    const saved=await isolated.saveDraft({snapshot:sectionSnapshot,mediaReferences:[],expectedBaseRevision:null,createNew:true});
    const loaded=await isolated.loadDraft(saved.revision.id);
    const published=await isolated.publishDraft({draftRevisionId:saved.revision.id,expectedPublishedRevision:null,expectedDraftLockVersion:saved.revision.lock_version});
    let invalidSaveRejected=false;
    try{await isolated.saveDraft({snapshot:invalid51,mediaReferences:[],expectedBaseRevision:published.revision_number,createNew:true})}catch{invalidSaveRejected=true}
    const active=await isolated.loadPublishedSnapshot();
    const totalSnapshot=snapshots.createEditorSnapshot(defaults.createDefaultSiteSnapshot());
    totalSnapshot.instances=Array.from({length:instances.MAX_DYNAMIC_INSTANCES_PER_SNAPSHOT},(_,index)=>({instanceId:'total-image-'+index,type:'image',sectionId:'portfolio',label:'Total '+index,order:index,source:{kind:'media-assignment',assignmentEntityId:'total-image-'+index},createdAt:new Date(0).toISOString()}));
    let totalRejected=false;try{instances.assertCanInsertEditorInstance(totalSnapshot,'Portfolio')}catch{totalRejected=true}
    return{sectionMaximum:instances.MAX_DYNAMIC_INSTANCES_PER_SECTION,totalMaximum:instances.MAX_DYNAMIC_INSTANCES_PER_SNAPSHOT,validAt50:validAt50.valid,acceptedCount:loaded.revision.snapshot.instances.length,publishedCount:published.snapshot.instances.length,roundTripIds:snapshots.deserializeEditorSnapshot(snapshots.serializeEditorSnapshot(sectionSnapshot)).instances.length,sectionRejected,sectionMessage,invalidAt51:!invalidAt51.valid,invalidErrors:invalidAt51.errors,invalidSaveRejected,noPartial:(await isolated.countDrafts())===1&&(await isolated.getHistory()).length===1&&active.snapshot.instances.length===50,totalRejected};
  })()`)
  assert(limits.sectionMaximum === 50 && limits.totalMaximum === 500 && limits.validAt50 && limits.acceptedCount === 50 && limits.publishedCount === 50 && limits.roundTripIds === 50 && limits.sectionRejected && limits.sectionMessage.includes('Maximum 50') && limits.invalidAt51 && limits.invalidErrors.some((error) => error.includes('maximum of 50')) && limits.invalidSaveRejected && limits.noPartial && limits.totalRejected, `dynamic instance safety limits were not enforced: ${JSON.stringify(limits)}`)

  const uploadRules = await evaluate(`(async()=>{const rules=await import('/src/lib/mediaUploadRules.ts');const MiB=1024*1024;const check=(name,type,size,purpose)=>{try{const result=rules.validateMediaUploadFile(new File([new Uint8Array(size)],name,{type}),purpose);return{accepted:true,extension:result.extension,kind:result.kind,maximumBytes:result.maximumBytes}}catch(error){return{accepted:false,error:String(error?.message??error)}}};return{libraryAccept:rules.MEDIA_LIBRARY_FILE_ACCEPT,imageAccept:rules.EDITOR_IMAGE_FILE_ACCEPT,webpLibrary:check('image.webp','image/webp',1,'library'),webpImage:check('image.webp','image/webp',1,'image'),gifLibrary:check('motion.gif','image/gif',1,'library'),gifImage:check('motion.gif','image/gif',1,'image'),pdfLibrary:check('document.pdf','application/pdf',1,'library'),pdfImage:check('document.pdf','application/pdf',1,'image'),pngLibrary:check('image.png','image/png',1,'library'),pngImage:check('image.png','image/png',1,'image'),jpegLibrary:check('image.jpg','image/jpeg',1,'library'),svgLibrary:check('image.svg','image/svg+xml',1,'library'),mimeMismatch:check('image.webp','image/png',1,'library'),webpAtLimit:check('image.webp','image/webp',2*MiB,'image'),webpOverLimit:check('image.webp','image/webp',2*MiB+1,'image'),gifAtLimit:check('motion.gif','image/gif',10*MiB,'image'),gifOverLimit:check('motion.gif','image/gif',10*MiB+1,'image')}})()`)
  assert(uploadRules.libraryAccept === '.webp,.gif,.pdf,image/webp,image/gif,application/pdf' && uploadRules.imageAccept === '.webp,.gif,image/webp,image/gif' && uploadRules.webpLibrary.accepted && uploadRules.webpImage.accepted && uploadRules.gifLibrary.accepted && uploadRules.gifImage.accepted && uploadRules.pdfLibrary.accepted && !uploadRules.pdfImage.accepted && !uploadRules.pngLibrary.accepted && !uploadRules.pngImage.accepted && !uploadRules.jpegLibrary.accepted && !uploadRules.svgLibrary.accepted && !uploadRules.mimeMismatch.accepted && uploadRules.webpAtLimit.accepted && !uploadRules.webpOverLimit.accepted && uploadRules.gifAtLimit.accepted && !uploadRules.gifOverLimit.accepted, `shared media upload rules diverged: ${JSON.stringify(uploadRules)}`)

  const gifLoad = await evaluate(`(async()=>{const media=await import('/src/repositories/mediaRepository.ts');const bytes=Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='),character=>character.charCodeAt(0));const uploaded=await media.uploadLibraryMedia(new File([bytes],'phase038b.gif',{type:'image/gif'}));const response=await fetch(uploaded.previewUrl);const image=new Image();image.src=uploaded.previewUrl;await new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true})});const result={status:response.status,contentType:response.headers.get('content-type'),complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight};await media.deleteLibraryMedia(uploaded.row);return result})()`)
  assert(gifLoad.status === 200 && gifLoad.contentType === 'image/gif' && gifLoad.complete && gifLoad.naturalWidth === 1 && gifLoad.naturalHeight === 1, `supported GIF did not decode as an image: ${JSON.stringify(gifLoad)}`)

  await selectObject('portfolio-hero')
  await evaluate(`document.querySelector('.guest-home').dataset.phase038Root='stable'`)
  const baseline = await evaluate(`(async()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');await library.refresh();const selected=editor.objects.find(item=>item.id===editor.selectedObjectId);const upload=document.querySelector('[data-property-key="media.upload"] input[type="file"]');return{fixedAsset:editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId,assets:library.assets.length,assetIds:library.assets.map(item=>item.id),instances:editor.draftSnapshot.instances.length,selected:{id:selected?.id,type:selected?.type,section:selected?.section},mediaInsert:upload?.disabled===false,editorAccept:upload?.accept}})()`)
  assert(baseline.selected.id === 'portfolio-hero' && baseline.selected.type === 'Text' && baseline.selected.section === 'Portfolio' && baseline.mediaInsert && baseline.editorAccept === uploadRules.imageAccept, `Portfolio Text did not expose section-scoped insertion: ${JSON.stringify(baseline)}`)

  await selectObject('portfolio-profile-media')
  const fixedCanvasLoad = await requireLoadedImage('[data-editor-object-id="portfolio-profile-media"]', 'fixed-profile-canvas')
  const fixedInspectorLoad = await requireLoadedImage('.media-thumbnail img', 'fixed-profile-inspector')
  const fixedMedia = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media');const reference=editor.draftSnapshot.media.references.find(item=>item.assetId===assignment?.assetId);const canvas=document.querySelector('[data-editor-object-id="portfolio-profile-media"]');const inspector=document.querySelector('.media-thumbnail img');return{assignment:assignment?JSON.parse(JSON.stringify(assignment)):null,reference:reference?JSON.parse(JSON.stringify(reference)):null,canvasSource:canvas?.currentSrc??'',inspectorSource:inspector?.currentSrc??'',inspectorText:document.querySelector('.media-thumbnail')?.textContent?.trim()??''}})()`)
  assert(fixedMedia.assignment?.assetId === fixedMedia.reference?.assetId && fixedMedia.canvasSource === fixedMedia.inspectorSource && !fixedMedia.inspectorText.includes('No media assigned'), `fixed Image assignment/Canvas/Inspector source diverged: ${JSON.stringify(fixedMedia)}`)
  await selectObject('portfolio-hero')

  const uploadFile = path.join(projectRoot, 'public', 'social-preview.webp')
  const uiLimitSetup = await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const commands=await import('/src/editor/editorInstanceCommands.ts');const snapshots=await import('/src/editor/editorSnapshot.ts');const scratch=JSON.parse(JSON.stringify(editor.draftSnapshot));const reference=scratch.media.references[0];const write=(root,path,value)=>{const parts=path.split('.');let parent=root;for(const part of parts.slice(0,-1)){parent[part]??={};parent=parent[part]}const leaf=parts.at(-1);if(value===undefined)delete parent[leaf];else parent[leaf]=structuredClone(value)};for(let index=0;index<50;index+=1){const result=commands.insertImageInstanceChanges(scratch,{section:'Portfolio',reference,label:'UI Limit '+index,instanceId:'ui-limit-image-'+index,createdAt:new Date(index).toISOString(),layout:{positionMode:'absolute',x:index,y:index,width:32,height:32,rotation:0,display:'block',visibility:'visible',zIndex:index+1}});for(const change of result.changes)write(scratch,change.propertyPath,change.nextValue)}const applied=editor.setProperties('portfolio-hero',[{propertyPath:'instances',nextValue:scratch.instances},{propertyPath:'media.references',nextValue:scratch.media.references},{propertyPath:'media.assignments',nextValue:scratch.media.assignments},{propertyPath:'layout',nextValue:scratch.layout},{propertyPath:'media.styles',nextValue:scratch.media.styles}],{interaction:'phase-038a-ui-limit'},'INSERT_INSTANCE');await tick();await tick();return{applied,count:editor.draftSnapshot.instances.length,valid:snapshots.validateEditorSnapshot(editor.draftSnapshot).valid,command:editor.commandHistory.at(-1)?.type}})()`)
  await waitFor(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const upload=document.querySelector('[data-property-key="media.upload"] input[type="file"]');return editor.draftSnapshot.instances.length===50&&upload?.disabled===true})()`, 20_000)
  await setFileInput('[data-property-key="media.upload"] input[type="file"]', uploadFile)
  await evaluate(`document.querySelector('[data-property-key="media.upload"] input[type="file"]').dispatchEvent(new Event('change',{bubbles:true}))`)
  await settle(180)
  const uiLimitBlocked = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const field=document.querySelector('[data-property-key="media.upload"]');return{count:editor.draftSnapshot.instances.length,assets:library.assets.length,disabled:field?.querySelector('input[type="file"]')?.disabled,status:document.querySelector('.save-status')?.textContent?.trim(),helper:field?.textContent?.trim()}})()`)
  assert(uiLimitSetup.applied && uiLimitSetup.count === 50 && uiLimitSetup.valid && uiLimitSetup.command === 'INSERT_INSTANCE' && uiLimitBlocked.count === 50 && uiLimitBlocked.assets === baseline.assets && uiLimitBlocked.disabled && uiLimitBlocked.status.includes('Maximum 50'), `UI limit preflight allowed a partial 51st upload/instance: ${JSON.stringify({uiLimitSetup,uiLimitBlocked})}`)
  await evaluate(`document.querySelector('.tbar-undo').click()`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.length===0`)
  await settle(120)

  const rejectedUploadFile = path.join(profilePath, 'phase038a-rejected.png')
  await writeFile(rejectedUploadFile, Buffer.from('not-a-supported-image'))
  await setFileInput('[data-property-key="media.upload"] input[type="file"]', rejectedUploadFile)
  await settle(150)
  const editorInvalidUpload = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;return{instances:pinia._s.get('editor').draftSnapshot.instances.length,assets:pinia._s.get('media-library').assets.length,status:document.querySelector('.save-status')?.textContent?.trim()}})()`)
  assert(editorInvalidUpload.instances === 0 && editorInvalidUpload.assets === baseline.assets && /\.png|WEBP|GIF/i.test(editorInvalidUpload.status), `Editor accepted an upload rejected by the shared rules: ${JSON.stringify(editorInvalidUpload)}`)

  await setFileInput('[data-property-key="media.upload"] input[type="file"]', uploadFile)
  await waitFor(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;return pinia._s.get('editor').draftSnapshot.instances.length===1&&!pinia._s.get('media-library').mutating})()`)
  await settle(180)
  const insertedB = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));const instance=editor.draftSnapshot.instances[0];const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId===instance.instanceId);const asset=library.assets.find(item=>item.id===assignment.assetId);const node=document.querySelector('[data-snapshot-instance-id="'+CSS.escape(instance.instanceId)+'"]');const style=node?getComputedStyle(node):null;const rect=node?.getBoundingClientRect();return{id:instance.instanceId,label:instance.label,createdAt:instance.createdAt,assetId:assignment.assetId,asset:{name:asset?.name,path:asset?.storagePath,persisted:asset?.metadataPersisted,width:asset?.width,height:asset?.height},fixedAsset:editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId,assetCount:library.assets.length,dom:Boolean(node),geometry:{canonical:clone(editor.draftSnapshot.layout[instance.instanceId]),computed:style?{width:style.width,height:style.height}:null,origin:{top:node?.style.top,left:node?.style.left,right:node?.style.right,bottom:node?.style.bottom},inline:node?.getAttribute('style'),matches:[...document.querySelectorAll('[data-snapshot-instance-id="'+CSS.escape(instance.instanceId)+'"]')].map(item=>({tag:item.tagName,style:item.getAttribute('style'),editorId:item.dataset.editorObjectId})),rect:rect?{width:rect.width,height:rect.height}:null,command:clone(editor.commandHistory.at(-1))},registered:editor.objects.some(item=>item.id===instance.instanceId&&item.type==='Image'&&item.ux?.dynamicInstance),selected:editor.selectedObjectId}})()`)
  assert(insertedB.id.startsWith('portfolio-image-') && insertedB.fixedAsset === baseline.fixedAsset && insertedB.assetCount === baseline.assets + 1 && insertedB.asset.path.startsWith('draft/library/') && insertedB.asset.persisted && insertedB.dom && insertedB.registered && insertedB.selected === insertedB.id, `Upload did not create canonical Image B: ${JSON.stringify({baseline,insertedB})}`)
  assert(insertedB.geometry.origin.top === '0px' && insertedB.geometry.origin.left === '0px' && insertedB.geometry.origin.right === 'auto' && insertedB.geometry.origin.bottom === 'auto' && Number.parseFloat(insertedB.geometry.computed.width) === Number.parseFloat(insertedB.geometry.canonical.width) && Number.parseFloat(insertedB.geometry.computed.height) === Number.parseFloat(insertedB.geometry.canonical.height), `new IMG did not project from an explicit section origin with canonical W/H: ${JSON.stringify(insertedB.geometry)}`)
  await requireLoadedImage(`[data-snapshot-instance-id="${insertedB.id}"]`, 'uploaded-image-b')

  await evaluate(`document.querySelector('[data-property-key="media.choose"] button').click()`)
  await waitFor(`Boolean(document.querySelector('.asset-picker'))`)
  const assetsBeforeChoose = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('media-library').assets.length`)
  await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const card=document.querySelector('[data-asset-card-id="media-profile-primary"]');if(!card)throw new Error('Existing Media Library asset was not found.');card.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await tick();await tick()})()`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.length===2`)
  await settle(150)
  const insertedC = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const instance=editor.draftSnapshot.instances.find(item=>item.instanceId!==${JSON.stringify(insertedB.id)});const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId===instance.instanceId);return{id:instance.instanceId,assetId:assignment.assetId,assets:library.assets.length,selected:editor.selectedObjectId,fixedExists:Boolean(document.querySelector('[data-editor-object-id="portfolio-profile-media"]')),dynamicDom:[...document.querySelectorAll('[data-snapshot-instance-id]')].map(item=>item.dataset.snapshotInstanceId),pickerClosed:!document.querySelector('.asset-picker')}})()`)
  assert(insertedC.id !== insertedB.id && insertedC.assetId === 'media-profile-primary' && insertedC.assets === assetsBeforeChoose && insertedC.selected === insertedC.id && insertedC.fixedExists && insertedC.dynamicDom.includes(insertedB.id) && insertedC.dynamicDom.includes(insertedC.id) && insertedC.pickerClosed, `Choose from Media did not create canonical Image C: ${JSON.stringify(insertedC)}`)
  await requireLoadedImage(`[data-snapshot-instance-id="${insertedC.id}"]`, 'existing-media-image-c')

  await selectObject('portfolio-hero')
  await evaluate(`document.querySelector('[data-property-key="media.choose"] button').click()`)
  await waitFor(`Boolean(document.querySelector('.asset-picker'))`)
  await evaluate(`(()=>{const card=document.querySelector('[data-asset-card-id="media-profile-primary"]');if(!card)throw new Error('Existing Media Library asset was not found for the second insertion.');card.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));return true})()`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.length===3`)
  await settle(120)
  const insertedD = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const known=new Set(${JSON.stringify([insertedB.id, insertedC.id])});const instance=editor.draftSnapshot.instances.find(item=>!known.has(item.instanceId));const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId===instance.instanceId);const ids=[...document.querySelectorAll('[data-snapshot-instance-id]')].map(item=>item.dataset.snapshotInstanceId);const records=[${JSON.stringify(insertedB.id)},${JSON.stringify(insertedC.id)},instance.instanceId];return{id:instance.instanceId,assetId:assignment.assetId,selected:editor.selectedObjectId,ids,unique:new Set(ids).size===ids.length,assets:pinia._s.get('media-library').assets.length,independentRecords:new Set(records.map(id=>editor.draftSnapshot.layout[id])).size===records.length&&new Set(records.map(id=>editor.draftSnapshot.media.styles[id])).size===records.length}})()`)
  assert(insertedD.id !== insertedC.id && insertedD.assetId === insertedC.assetId && insertedD.selected === insertedD.id && insertedD.assets === assetsBeforeChoose && insertedD.unique && insertedD.independentRecords && [insertedB.id, insertedC.id, insertedD.id].every((id) => insertedD.ids.includes(id)), `Choosing the same asset twice did not create independent Image C/D instances: ${JSON.stringify(insertedD)}`)
  await requireLoadedImage(`[data-snapshot-instance-id="${insertedD.id}"]`, 'same-asset-image-d')

  await evaluate(`(()=>{const image=document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');image.dataset.phase038Node='stable';image.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));return true})()`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').selectedObjectId===${JSON.stringify(insertedB.id)}`)
  const previewSelection = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const layer=document.querySelector('[data-layer-object-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');return{selected:editor.selectedObjectId,section:editor.selectedSection,layerSelected:layer?.classList.contains('selected'),mediaOpen:document.querySelector('[data-property-category="media"] .accordion-toggle')?.getAttribute('aria-expanded')}})()`)
  assert(previewSelection.selected === insertedB.id && previewSelection.section === 'Portfolio' && previewSelection.layerSelected && previewSelection.mediaOpen === 'true', `Preview/Navigator/Inspector selection did not converge: ${JSON.stringify(previewSelection)}`)
  const dynamicInspectorLoad = await requireLoadedImage('.media-thumbnail img', 'dynamic-image-b-inspector')

  const navigator = await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const article=()=>document.querySelector('[data-layer-object-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');const buttons=()=>article().querySelectorAll('.object-state-button');article().querySelector('.object-select').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));await tick();const rename=document.querySelector('[data-layer-rename-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');rename.value='Image B';rename.dispatchEvent(new Event('input',{bubbles:true}));rename.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();const renamed=editor.draftSnapshot.instances.find(item=>item.instanceId===${JSON.stringify(insertedB.id)})?.label;buttons()[0].click();await tick();buttons()[1].click();await tick();const activeState=editor.objectState(${JSON.stringify(insertedB.id)});const locked={locked:Boolean(activeState.locked),hidden:Boolean(activeState.hidden)};buttons()[0].click();await tick();buttons()[1].click();await tick();const restoredState=editor.objectState(${JSON.stringify(insertedB.id)});const unlocked={locked:Boolean(restoredState.locked),hidden:Boolean(restoredState.hidden)};const beforeOrders=editor.draftSnapshot.instances.map(item=>({id:item.instanceId,order:item.order}));article().querySelector('.layer-drag-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',altKey:true,bubbles:true,cancelable:true}));await tick();await tick();return{renamed,locked,unlocked,beforeOrders,afterOrders:editor.draftSnapshot.instances.map(item=>({id:item.instanceId,order:item.order})),layerText:article()?.textContent??'',selected:editor.selectedObjectId}})()`)
  assert(navigator.renamed === 'Image B' && navigator.locked.locked && navigator.locked.hidden && !navigator.unlocked.locked && !navigator.unlocked.hidden && navigator.layerText.includes('Image B') && navigator.selected === insertedB.id && JSON.stringify(navigator.beforeOrders) !== JSON.stringify(navigator.afterOrders), `Navigator dynamic-instance actions failed: ${JSON.stringify(navigator)}`)

  await selectObject(insertedB.id)
  const beforeGeometry = await captureScene(['portfolio-profile-media', insertedB.id, insertedC.id, insertedD.id])
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
  const afterGeometry = await captureScene(['portfolio-profile-media', insertedB.id, insertedC.id, insertedD.id])
  const unchanged = (id) => JSON.stringify({ layout: beforeGeometry.objects[id].layout, media: beforeGeometry.objects[id].media, background: beforeGeometry.objects[id].background }) === JSON.stringify({ layout: afterGeometry.objects[id].layout, media: afterGeometry.objects[id].media, background: afterGeometry.objects[id].background })
  const insertedBRatio = afterGeometry.objects[insertedB.id].media.aspectRatio
  const expectedDesktopHeight = 300 / insertedBRatio
  assert(afterGeometry.objects[insertedB.id].computed.width === '300px' && Math.abs(Number.parseFloat(afterGeometry.objects[insertedB.id].computed.height) - expectedDesktopHeight) < .02 && afterGeometry.objects[insertedB.id].computed.translate === '190px 35px' && afterGeometry.objects[insertedB.id].computed.rotate === '9deg' && beforeGeometry.objects[insertedB.id].rect.width !== afterGeometry.objects[insertedB.id].rect.width && beforeGeometry.objects[insertedB.id].rect.height !== afterGeometry.objects[insertedB.id].rect.height, `Image B geometry/aspect lock did not resize the semantic IMG: ${JSON.stringify(afterGeometry.objects[insertedB.id])}`)
  assert(afterGeometry.objects[insertedB.id].media.aspectRatioLocked && Number.isFinite(insertedBRatio) && insertedBRatio > 0 && /url\(/.test(afterGeometry.objects[insertedB.id].computed.filter) && /drop-shadow\(/.test(afterGeometry.objects[insertedB.id].computed.filter) && afterGeometry.objects[insertedB.id].computed.boxShadow === 'none', `Image B alpha-aware effects did not render: ${JSON.stringify(afterGeometry.objects[insertedB.id])}`)
  assert(unchanged('portfolio-profile-media') && unchanged(insertedC.id) && unchanged(insertedD.id) && afterGeometry.selected === insertedB.id && afterGeometry.rootMarker === 'stable' && afterGeometry.objects[insertedB.id].nodeMarker === 'stable' && JSON.stringify(beforeGeometry.section) === JSON.stringify(afterGeometry.section), `Image B mutation leaked or remounted Preview: ${JSON.stringify({before:beforeGeometry,after:afterGeometry})}`)

  const hoverBefore = await evaluate(`getComputedStyle(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]')).opacity`)
  const hoverProbe = await evaluate(`(()=>{const image=document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');const rect=image.getBoundingClientRect();for(let y=Math.max(1,Math.ceil(rect.top));y<Math.min(innerHeight-1,Math.floor(rect.bottom));y+=4){for(let x=Math.max(1,Math.ceil(rect.left));x<Math.min(innerWidth-1,Math.floor(rect.right));x+=4){if(document.elementFromPoint(x,y)===image)return{point:{x,y}}}}const x=Math.max(1,Math.min(innerWidth-1,Math.round(rect.left+rect.width/2)));const y=Math.max(1,Math.min(innerHeight-1,Math.round(rect.top+rect.height/2)));const describe=node=>({tag:node.tagName,id:node.id,class:typeof node.className==='string'?node.className:'',editorId:node.dataset?.editorObjectId,instanceId:node.dataset?.snapshotInstanceId,z:getComputedStyle(node).zIndex,pointer:getComputedStyle(node).pointerEvents});return{point:null,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},image:describe(image),parent:describe(image.parentElement),stack:document.elementsFromPoint(x,y).slice(0,8).map(describe)}})()`)
  assert(hoverProbe.point, `Dynamic Image B had no pointer-visible hit-test point: ${JSON.stringify(hoverProbe)}`)
  const hoverPoint = hoverProbe.point
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hoverPoint.x, y: hoverPoint.y })
  await settle(260)
  const hoverInside = await evaluate(`getComputedStyle(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]')).opacity`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 })
  await settle(260)
  const hoverAfter = await evaluate(`getComputedStyle(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]')).opacity`)
  const dynamicHover = { before: hoverBefore, inside: hoverInside, after: hoverAfter, point: hoverPoint }
  assert(dynamicHover.inside !== dynamicHover.before && dynamicHover.after === dynamicHover.before, `Dynamic Image Hover Style did not enter/restore on real pointer movement: ${JSON.stringify(dynamicHover)}`)

  const responsive = await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));document.querySelector('[data-canvas-preset="laptop-1024"]').click();await tick();await tick();return true})()`)
  void responsive
  await setInput('media.width', 260)
  const tablet = await evaluate(`(async()=>{const responsive=await import('/src/editor/responsiveLayout.ts');const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));const id=responsive.responsiveSnapshotEntityId('laptop',${JSON.stringify(insertedB.id)});const image=document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');return{id,base:clone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),override:clone(editor.draftSnapshot.layout[id]),mediaBase:clone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedB.id)}]),mediaOverride:clone(editor.draftSnapshot.media.styles[id]),computed:{width:getComputedStyle(image).width,height:getComputedStyle(image).height}}})()`)
  const expectedTabletHeight = 260 / insertedBRatio
  assert(tablet.base.width === '300px' && Math.abs(Number.parseFloat(tablet.base.height) - expectedDesktopHeight) < .02 && tablet.override.width === '260px' && Math.abs(Number.parseFloat(tablet.override.height) - expectedTabletHeight) < .02 && tablet.computed.width === '260px' && Math.abs(Number.parseFloat(tablet.computed.height) - expectedTabletHeight) < .02, `Dynamic sparse responsive geometry failed: ${JSON.stringify(tablet)}`)
  await evaluate(`document.querySelector('[data-canvas-preset="desktop-1440"]').click()`)
  await settle()

  await selectObject(insertedB.id, 'animation')
  await setSelect('animation.type', 'fade')
  const animation = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const image=document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');return{settings:JSON.parse(JSON.stringify(editor.draftSnapshot.animations[${JSON.stringify(insertedB.id)}])),entrance:image.dataset.animationEntrance,selected:editor.selectedObjectId}})()`)
  assert(animation.settings?.name && animation.entrance === 'fade' && animation.selected === insertedB.id, `Dynamic animation integration failed: ${JSON.stringify(animation)}`)

  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'c',ctrlKey:true,bubbles:true}))`)
  await selectObject(insertedC.id)
  const cStyleBeforePaste = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));return{layout:clone(editor.draftSnapshot.layout[${JSON.stringify(insertedC.id)}]),media:clone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedC.id)}]),background:clone(editor.draftSnapshot.backgrounds[${JSON.stringify(insertedC.id)}]??null)}})()`)
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true}))`)
  await settle()
  const stylePaste = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));const pasted={layout:clone(editor.draftSnapshot.layout[${JSON.stringify(insertedC.id)}]),media:clone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedC.id)}]),background:clone(editor.draftSnapshot.backgrounds[${JSON.stringify(insertedC.id)}]??null)};editor.undo();return{pasted,history:editor.commandHistory.length,selected:editor.selectedObjectId}})()`)
  await settle()
  const cStyleAfterUndo = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));return{layout:clone(editor.draftSnapshot.layout[${JSON.stringify(insertedC.id)}]),media:clone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedC.id)}]),background:clone(editor.draftSnapshot.backgrounds[${JSON.stringify(insertedC.id)}]??null)}})()`)
  assert(stylePaste.pasted.layout.width === '300px' && stylePaste.pasted.media.outlineEnabled && stylePaste.pasted.background.boxShadow && JSON.stringify(cStyleBeforePaste) === JSON.stringify(cStyleAfterUndo), `Dynamic Copy/Paste Style or Undo failed: ${JSON.stringify({cStyleBeforePaste,stylePaste,cStyleAfterUndo})}`)
  await selectObject(insertedB.id)

  const oldAssetId = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)}).assetId`)
  const beforeReplaceConfig = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>JSON.parse(JSON.stringify(value));return{layout:clone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),style:clone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedB.id)}]),background:clone(editor.draftSnapshot.backgrounds[${JSON.stringify(insertedB.id)}]),animation:clone(editor.draftSnapshot.animations[${JSON.stringify(insertedB.id)}])}})()`)
  await evaluate(`document.querySelector('[data-property-key="media.replace"] button').click()`)
  await waitFor(`Boolean(document.querySelector('.asset-picker'))`)
  await evaluate(`(()=>{const card=document.querySelector('[data-asset-card-id="media-profile-primary"]');if(!card)throw new Error('Replacement Media Library asset was not found.');card.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));return true})()`)
  await waitFor(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');return !library.mutating&&editor.draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)})?.assetId!==${JSON.stringify(oldAssetId)}})()`)
  const replace = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const clone=value=>JSON.parse(JSON.stringify(value));const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)});return{idStillPresent:editor.draftSnapshot.instances.some(item=>item.instanceId===${JSON.stringify(insertedB.id)}),newAssetId:assignment.assetId,oldAssetPresent:library.assets.some(item=>item.id===${JSON.stringify(oldAssetId)}),config:{layout:clone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),style:clone(editor.draftSnapshot.media.styles[${JSON.stringify(insertedB.id)}]),background:clone(editor.draftSnapshot.backgrounds[${JSON.stringify(insertedB.id)}]),animation:clone(editor.draftSnapshot.animations[${JSON.stringify(insertedB.id)}])},command:editor.commandHistory.at(-1)?.type,selected:editor.selectedObjectId}})()`)
  assert(replace.idStillPresent && replace.newAssetId !== oldAssetId && replace.oldAssetPresent && replace.command === 'REPLACE_MEDIA' && replace.selected === insertedB.id && JSON.stringify(replace.config) === JSON.stringify(beforeReplaceConfig), `Replace changed identity/configuration or deleted old asset: ${JSON.stringify(replace)}`)
  await requireLoadedImage(`[data-snapshot-instance-id="${insertedB.id}"]`, 'replaced-image-b')

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  await evaluate(`document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]')?.scrollIntoView({block:'center',inline:'center'})`)
  await settle(150)
  const editorScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-038a-media-instances.png'), Buffer.from(editorScreenshot.data, 'base64'))
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-038b-media-source-integrity.png'), Buffer.from(editorScreenshot.data, 'base64'))

  const firstSave = await saveDraft()
  const beforeReload = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>JSON.parse(JSON.stringify(value));return{ids:editor.draftSnapshot.instances.map(item=>item.instanceId),instances:clone(editor.draftSnapshot.instances),layout:clone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),responsive:clone(editor.draftSnapshot.layout[${JSON.stringify(tablet.id)}]),asset:editor.draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)})?.assetId,schema:editor.draftSnapshot.compatibility.schemaVersion}})()`)
  await routeTo('admin-dashboard')
  await routeTo('admin-edit', { draft: firstSave.id })
  await waitFor(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return Boolean(document.querySelector('.edit-page'))&&!document.querySelector('.editor-recovery')&&editor.draftSnapshot.instances.length===3&&editor.draftSnapshot.instances.every(item=>document.querySelector('[data-snapshot-instance-id="'+CSS.escape(item.instanceId)+'"]'))})()`)
  const afterReload = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>JSON.parse(JSON.stringify(value));return{ids:editor.draftSnapshot.instances.map(item=>item.instanceId),instances:clone(editor.draftSnapshot.instances),layout:clone(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}]),responsive:clone(editor.draftSnapshot.layout[${JSON.stringify(tablet.id)}]),asset:editor.draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)})?.assetId,schema:editor.draftSnapshot.compatibility.schemaVersion,registered:editor.draftSnapshot.instances.every(item=>editor.objects.some(object=>object.id===item.instanceId)),selected:editor.selectedObjectId}})()`)
  assert(JSON.stringify(beforeReload) === JSON.stringify({ ...afterReload, registered: undefined, selected: undefined }) || (JSON.stringify(beforeReload.ids) === JSON.stringify(afterReload.ids) && JSON.stringify(beforeReload.instances) === JSON.stringify(afterReload.instances) && JSON.stringify(beforeReload.layout) === JSON.stringify(afterReload.layout) && JSON.stringify(beforeReload.responsive) === JSON.stringify(afterReload.responsive) && beforeReload.asset === afterReload.asset && afterReload.schema === 2 && afterReload.registered), `Draft reload changed stable instances: ${JSON.stringify({beforeReload,afterReload})}`)
  for (const instanceId of afterReload.ids) await requireLoadedImage(`[data-snapshot-instance-id="${instanceId}"]`, `draft-reload-${instanceId}`)

  await selectObject(insertedB.id)
  const beforeDuplicate = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return{ids:editor.draftSnapshot.instances.map(item=>item.instanceId),layout:JSON.parse(JSON.stringify(editor.draftSnapshot.layout[${JSON.stringify(insertedB.id)}])),asset:editor.draftSnapshot.media.assignments.find(item=>item.entityId===${JSON.stringify(insertedB.id)})?.assetId}})()`)
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'d',ctrlKey:true,bubbles:true,cancelable:true}))`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.length===4`)
  const duplicated = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>JSON.parse(JSON.stringify(value));const instance=editor.draftSnapshot.instances.find(item=>!${JSON.stringify(beforeDuplicate.ids)}.includes(item.instanceId));const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId===instance.instanceId);const layout=editor.draftSnapshot.layout[instance.instanceId];return{id:instance.instanceId,assetId:assignment.assetId,layout:clone(layout),style:clone(editor.draftSnapshot.media.styles[instance.instanceId]),animation:clone(editor.draftSnapshot.animations[instance.instanceId]),selected:editor.selectedObjectId,command:editor.commandHistory.at(-1)?.type,dom:Boolean(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(instance.instanceId)+'"]'))}})()`)
  assert(duplicated.id !== insertedB.id && duplicated.assetId === beforeDuplicate.asset && duplicated.layout.x === Number.parseFloat(beforeDuplicate.layout.x) + 24 && duplicated.layout.y === Number.parseFloat(beforeDuplicate.layout.y) + 24 && duplicated.style.outlineEnabled && duplicated.animation.name && duplicated.selected === duplicated.id && duplicated.command === 'DUPLICATE_INSTANCE' && duplicated.dom, `Duplicate did not create an independent canonical Image D: ${JSON.stringify({beforeDuplicate,duplicated})}`)
  await requireLoadedImage(`[data-snapshot-instance-id="${duplicated.id}"]`, 'duplicated-image')
  await evaluate(`document.querySelector('.tbar-undo').click()`)
  await waitFor(`!document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.some(item=>item.instanceId===${JSON.stringify(duplicated.id)})`)
  const undoDuplicate = await evaluate(`!document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(duplicated.id)})+'"]')`)
  await evaluate(`document.querySelector('.tbar-redo').click()`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.some(item=>item.instanceId===${JSON.stringify(duplicated.id)})`)
  const redoDuplicate = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return{sameId:editor.draftSnapshot.instances.some(item=>item.instanceId===${JSON.stringify(duplicated.id)}),dom:Boolean(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(duplicated.id)})+'"]')),history:editor.commandHistory.length}})()`)
  assert(undoDuplicate && redoDuplicate.sameId && redoDuplicate.dom && redoDuplicate.history <= 10, `Duplicate Undo/Redo identity failed: ${JSON.stringify({undoDuplicate,redoDuplicate})}`)
  await requireLoadedImage(`[data-snapshot-instance-id="${duplicated.id}"]`, 'redo-duplicated-image')

  const beforeDuplicateReload = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));return{ids:editor.draftSnapshot.instances.map(item=>item.instanceId),instances:clone(editor.draftSnapshot.instances),objects:Object.fromEntries(editor.draftSnapshot.instances.map(item=>[item.instanceId,{assetId:editor.draftSnapshot.media.assignments.find(assignment=>assignment.entityId===item.instanceId)?.assetId,layout:clone(editor.draftSnapshot.layout[item.instanceId]),media:clone(editor.draftSnapshot.media.styles[item.instanceId]),background:clone(editor.draftSnapshot.backgrounds[item.instanceId]??null),animation:clone(editor.draftSnapshot.animations[item.instanceId]??null)}]))}})()`)
  const secondSave = await saveDraft()
  await routeTo('admin-dashboard')
  await routeTo('admin-edit', { draft: secondSave.id })
  await waitFor(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return editor.draftSnapshot.instances.length===4&&editor.draftSnapshot.instances.every(item=>document.querySelector('[data-snapshot-instance-id="'+CSS.escape(item.instanceId)+'"]'))})()`)
  const afterDuplicateReload = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));return{ids:editor.draftSnapshot.instances.map(item=>item.instanceId),instances:clone(editor.draftSnapshot.instances),objects:Object.fromEntries(editor.draftSnapshot.instances.map(item=>[item.instanceId,{assetId:editor.draftSnapshot.media.assignments.find(assignment=>assignment.entityId===item.instanceId)?.assetId,layout:clone(editor.draftSnapshot.layout[item.instanceId]),media:clone(editor.draftSnapshot.media.styles[item.instanceId]),background:clone(editor.draftSnapshot.backgrounds[item.instanceId]??null),animation:clone(editor.draftSnapshot.animations[item.instanceId]??null)}])),registered:editor.draftSnapshot.instances.every(item=>editor.objects.some(object=>object.id===item.instanceId)),domIds:[...document.querySelectorAll('[data-snapshot-instance-id]')].map(item=>item.dataset.snapshotInstanceId)}})()`)
  assert(JSON.stringify(beforeDuplicateReload.ids) === JSON.stringify(afterDuplicateReload.ids) && JSON.stringify(beforeDuplicateReload.instances) === JSON.stringify(afterDuplicateReload.instances) && JSON.stringify(beforeDuplicateReload.objects) === JSON.stringify(afterDuplicateReload.objects) && afterDuplicateReload.registered && afterDuplicateReload.domIds.length === 4 && new Set(afterDuplicateReload.domIds).size === 4, `Draft reload lost independent A/B/C/D image-instance state: ${JSON.stringify({beforeDuplicateReload,afterDuplicateReload})}`)
  for (const instanceId of afterDuplicateReload.ids) await requireLoadedImage(`[data-snapshot-instance-id="${instanceId}"]`, `draft-hard-reload-${instanceId}`)
  const favorite = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');await repo.favoriteRepository.addFavorite(${JSON.stringify(secondSave.id)});return{favorite:await repo.favoriteRepository.isFavorite(${JSON.stringify(secondSave.id)}),drafts:await repo.editorDraftRepository.countDrafts(),favorites:await repo.favoriteRepository.countFavorites()}})()`)
  assert(favorite.favorite && favorite.drafts === 1 && favorite.favorites === 1, `Draft/Favorite pre-publish contract failed: ${JSON.stringify(favorite)}`)
  const revisionOne = await publishDraft()
  assert(revisionOne === 1, `First Published revision was not #1: ${revisionOne}`)
  const postPublishPreservation = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');const draft=await repo.editorDraftRepository.loadDraft(${JSON.stringify(secondSave.id)});const published=await repo.guestPublishedRepository.loadPublishedSnapshot();return{draftIds:draft.revision.snapshot.instances.map(item=>item.instanceId),publishedIds:published.snapshot.instances.map(item=>item.instanceId),draftMedia:draft.revision.snapshot.media.references.map(item=>({id:item.assetId,path:item.storagePath??null,bucket:item.bucket??null})),publishedMedia:published.snapshot.media.references.map(item=>({id:item.assetId,path:item.storagePath??null,bucket:item.bucket??null})),favorite:await repo.favoriteRepository.isFavorite(${JSON.stringify(secondSave.id)}),history:(await repo.editorPublishRepository.getHistory()).map(item=>({id:item.id,revision:item.revision_number,kind:item.publication_kind}))}})()`)
  const draftStorageReferencesAreIsolated = postPublishPreservation.draftMedia
    .filter((item) => item.path)
    .every((item) => item.bucket === 'portfolio-media' && item.path.startsWith('draft/'))
  assert(postPublishPreservation.draftIds.length === 4 && JSON.stringify(postPublishPreservation.draftIds) === JSON.stringify(postPublishPreservation.publishedIds) && postPublishPreservation.favorite && postPublishPreservation.history.length === 1 && draftStorageReferencesAreIsolated && postPublishPreservation.publishedMedia.every((item) => item.bucket === 'portfolio-media' && item.path?.startsWith('published/')), `Atomic Publish did not preserve Draft/Favorite/instances or media isolation: ${JSON.stringify(postPublishPreservation)}`)

  await routeTo('home')
  await waitFor(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;return Boolean(document.querySelector('.guest-home'))&&document.querySelectorAll('[data-snapshot-instance-id]').length===4})()`, 20_000)
  const guestOne = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const site=pinia._s.get('site');const images=[...document.querySelectorAll('[data-snapshot-instance-id]')];return{ids:images.map(item=>item.dataset.snapshotInstanceId),fixed:Boolean(document.querySelector('.profile-image[data-media-usage-id]')),revision:site.publishedRevisionNumber,source:site.guestRuntimeSource,guestSource:Boolean(document.querySelector('.guest-home'))}})()`)
  assert(guestOne.revision === 1 && guestOne.source === 'published' && guestOne.fixed && guestOne.ids.length === 4 && postPublishPreservation.publishedIds.every((id) => guestOne.ids.includes(id)), `Guest did not render Published dynamic instances: ${JSON.stringify(guestOne)}`)
  await requireLoadedImage('.profile-image[data-media-usage-id]', 'published-fixed-profile')
  for (const instanceId of guestOne.ids) await requireLoadedImage(`[data-snapshot-instance-id="${instanceId}"]`, `published-revision-1-${instanceId}`)

  await routeTo('admin-edit', { draft: secondSave.id })
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.instances.length===4`)
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
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('site').publishedRevisionNumber===2`)
  const guestTwo = await evaluate(`(()=>({ids:[...document.querySelectorAll('[data-snapshot-instance-id]')].map(item=>item.dataset.snapshotInstanceId),hasC:Boolean(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedC.id)})+'"]'))}))()`)
  assert(!guestTwo.hasC && guestTwo.ids.length === 3, `Second Publish did not update Guest instance collection: ${JSON.stringify(guestTwo)}`)
  for (const instanceId of guestTwo.ids) await requireLoadedImage(`[data-snapshot-instance-id="${instanceId}"]`, `published-revision-2-${instanceId}`)

  const rollback = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');const runtime=await import('/src/runtime/publishedRuntime.ts');const history=await repo.editorPublishRepository.getHistory();const target=history.find(item=>item.revision_number===1);const revision=await repo.editorPublishRepository.rollbackRevision({targetRevisionId:target.id,expectedPublishedRevision:2,note:'Phase 038 runtime rollback'});runtime.invalidatePublishedRuntimeCache(revision.revision_number);await runtime.initializePublishedRuntime({force:true});const draft=await repo.editorDraftRepository.loadDraft(${JSON.stringify(deleteSave.id)});const active=await repo.guestPublishedRepository.loadPublishedSnapshot();return{revision:revision.revision_number,kind:revision.publication_kind,source:revision.rollback_source_revision_id,activeIds:active.snapshot.instances.map(item=>item.instanceId),activeMedia:active.snapshot.media.references.map(item=>({path:item.storagePath??null,bucket:item.bucket??null})),draftIds:draft.revision.snapshot.instances.map(item=>item.instanceId),favorite:await repo.favoriteRepository.isFavorite(${JSON.stringify(deleteSave.id)}),history:(await repo.editorPublishRepository.getHistory()).map(item=>({revision:item.revision_number,kind:item.publication_kind}))}})()`)
  await waitFor(`Boolean(document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedC.id)})+'"]'))`)
  assert(rollback.revision === 3 && rollback.kind === 'rollback' && rollback.activeIds.includes(insertedC.id) && rollback.activeMedia.every((item) => item.bucket === 'portfolio-media' && item.path?.startsWith('published/')) && !rollback.draftIds.includes(insertedC.id) && rollback.favorite && rollback.history.length === 3, `Rollback changed Draft/Favorite, media isolation, or failed to restore instances: ${JSON.stringify(rollback)}`)
  for (const instanceId of rollback.activeIds) await requireLoadedImage(`[data-snapshot-instance-id="${instanceId}"]`, `rollback-${instanceId}`)

  const mediaUsage = await evaluate(`(async()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const library=pinia._s.get('media-library');await library.refresh();const replacement=${JSON.stringify(replace.newAssetId)};const asset=library.assets.find(item=>item.id===replacement);return{id:asset?.id,usageCount:asset?.usageCount,usages:asset?.usages.map(item=>({entityId:item.entityId,source:item.source,section:item.section,label:item.label})),safeToDelete:asset?.safeToDelete,location:asset?.location}})()`)
  const usageEntities = new Set((mediaUsage.usages ?? []).map((usage) => usage.entityId))
  const usageKeys = (mediaUsage.usages ?? []).map((usage) => `${usage.source}:${usage.entityId}`)
  const dynamicUsageKeys = new Set(usageKeys.filter((key) => [insertedB.id, insertedC.id, insertedD.id, duplicated.id].some((id) => key.endsWith(`:${id}`))))
  assert(mediaUsage.id === replace.newAssetId && mediaUsage.usageCount === mediaUsage.usages.length && new Set(usageKeys).size === usageKeys.length && usageEntities.has(insertedB.id) && usageEntities.has(insertedC.id) && usageEntities.has(insertedD.id) && usageEntities.has(duplicated.id) && dynamicUsageKeys.has(`draft:${insertedB.id}`) && dynamicUsageKeys.has(`published:${insertedB.id}`) && dynamicUsageKeys.has(`draft:${insertedD.id}`) && dynamicUsageKeys.has(`published:${insertedD.id}`) && dynamicUsageKeys.has(`draft:${duplicated.id}`) && dynamicUsageKeys.has(`published:${duplicated.id}`) && dynamicUsageKeys.has(`published:${insertedC.id}`) && !mediaUsage.safeToDelete && mediaUsage.location === 'Both', `Media usage did not count dynamic references independently: ${JSON.stringify(mediaUsage)}`)

  const performance = await evaluate(`new Promise(resolve=>{const root=document.querySelector('.guest-home');const node=document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]');const frames=[];let previous=performance.now();let count=0;const step=now=>{frames.push(now-previous);previous=now;count+=1;if(count<90)requestAnimationFrame(step);else{const values=frames.slice(1);resolve({fps:Number((1000/(values.reduce((a,b)=>a+b,0)/values.length)).toFixed(2)),sameRoot:root===document.querySelector('.guest-home'),sameNode:node===document.querySelector('[data-snapshot-instance-id="'+CSS.escape(${JSON.stringify(insertedB.id)})+'"]'),dynamicCount:document.querySelectorAll('[data-snapshot-instance-id]').length,filters:document.querySelectorAll('svg[data-snapshot-image-filter]').length})}};requestAnimationFrame(step)})`)
  assert(performance.fps >= 50 && performance.sameRoot && performance.sameNode && performance.dynamicCount === 4 && performance.filters <= performance.dynamicCount, `Dynamic projection performance/remount regression: ${JSON.stringify(performance)}`)

  const guestScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-038a-guest-rollback.png'), Buffer.from(guestScreenshot.data, 'base64'))

  const mediaDiagnostics = await evaluate(`globalThis.__phase038bMediaErrors??[]`)
  const badImageResponses = imageResponses.filter((response) => response.status < 200 || response.status >= 400 || (response.mimeType && !response.mimeType.startsWith('image/')))
  const requiredImageFailures = failedImageRequests.filter((failure) => !failure.canceled && !/ERR_ABORTED/i.test(failure.error))
  assert(imageLoadEvidence.length >= 20 && imageLoadEvidence.every((item) => item.complete && item.naturalWidth > 0 && item.naturalHeight > 0), `Required IMG decode evidence is incomplete: ${JSON.stringify(imageLoadEvidence)}`)
  assert(mediaDiagnostics.length === 0 && badImageResponses.length === 0 && requiredImageFailures.length === 0, `Image network/load integrity failed: ${JSON.stringify({mediaDiagnostics,badImageResponses,requiredImageFailures})}`)
  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
  assert(seriousErrors.length === 0, `Unexpected browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)
  process.stdout.write(`${JSON.stringify({status:'PASS',scope:'Phase 038A/038B Media instance and source integrity',compatibility,limits,uploadRules,gifLoad,uiLimit:{setup:uiLimitSetup,blocked:uiLimitBlocked},editorInvalidUpload,fixedMedia:{canonical:fixedMedia,canvas:fixedCanvasLoad,inspector:fixedInspectorLoad},insert:{baseline,imageB:insertedB,imageC:insertedC,imageD:insertedD},previewSelection,dynamicInspectorLoad,navigator,geometry:{before:beforeGeometry,after:afterGeometry},dynamicHover,responsive,animation,stylePaste:{pasted:stylePaste.pasted,restored:cStyleAfterUndo},replace,draft:{firstSave,beforeReload,afterReload,beforeDuplicateReload,afterDuplicateReload},duplicate:{duplicated,undoDuplicate,redoDuplicate},publish:{revisionOne,postPublishPreservation,guestOne,revisionTwo,guestTwo},deleteSafety,rollback,mediaUsage,imageLoad:{evidence:imageLoadEvidence,responses:imageResponses,failedRequests:failedImageRequests,diagnostics:mediaDiagnostics},performance,screenshots:['artifacts/phase-038a-media-instances.png','artifacts/phase-038b-media-source-integrity.png','artifacts/phase-038a-guest-rollback.png'],cloudMutation:'NOT RUN — isolated local repository/runtime certification; no disposable Cloud browser credential was used.'},null,2)}\n`)
  if (viteErrors.trim()) process.stderr.write(viteErrors)
  if (browserErrors.includes('ERROR:')) process.stderr.write(browserErrors)
} finally {
  socket?.close()
  stopChildren()
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}
