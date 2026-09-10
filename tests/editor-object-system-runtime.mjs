import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5176'
const cdpPort = 9336
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase030-chrome-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitForHttp(url, timeout = 20000) {
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

function assert(condition, message) {
  if (!condition) throw new Error(`Phase 030 runtime failure: ${message}`)
}

process.on('exit', stopChildren)
process.on('SIGINT', () => { stopChildren(); process.exit(130) })

let socket
try {
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5176', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1600,1000', baseUrl
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  let page
  const targetStarted = Date.now()
  while (!page && Date.now() - targetStarted < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5176'))
    if (!page) await wait(100)
  }
  if (!page) throw new Error('Phase 030 browser target not found.')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  const runtimeExceptionObjectIds = []
  const runtimeExceptionRecords = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails
      const exception = details.exception
      runtimeErrors.push(exception?.description ?? details.text)
      runtimeExceptionRecords.push(JSON.stringify({ text: details.text, url: details.url, lineNumber: details.lineNumber, columnNumber: details.columnNumber, exception: exception ? { type: exception.type, subtype: exception.subtype, className: exception.className, description: exception.description, value: exception.value } : null, frames: details.stackTrace?.callFrames?.slice(0, 4) }))
      if (exception?.objectId) runtimeExceptionObjectIds.push(exception.objectId)
    }
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
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  await evaluate(`(()=>{
    globalThis.__phase030Unhandled=[];
    addEventListener('unhandledrejection',(event)=>globalThis.__phase030Unhandled.push(String(event.reason?.stack??event.reason?.message??event.reason)));
    return true;
  })()`)
  try {
    await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
    await evaluate(`(async()=>{
      const authModule=await import('/src/stores/auth.ts');
      const router=(await import('/src/router/index.ts')).default;
      const auth=authModule.useAuthStore();
      auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});
      await router.push('/admin/edit');
      return true;
    })()`)
    await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]')) && Boolean(document.querySelector('[data-object-search]'))`)
  } catch (error) {
    const diagnostics = await evaluate(`({url:location.href,body:document.body.innerText.slice(0,1800),recovery:document.querySelector('.editor-recovery')?.innerText})`)
    throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}; vite=${viteErrors}; browser=${browserErrors}; runtime=${runtimeErrors.join(' | ')}`)
  }

  const registryEvidence = await evaluate(`(async()=>{
    const objectRegistry=await import('/src/editor/objectRegistry.ts');
    const propertyRegistry=await import('/src/editor/propertyRegistry.ts');
    if(!objectRegistry.listEditorObjectTypes().some(item=>item.type==='Video')){
      objectRegistry.registerEditorObjectType({type:'Video',label:'Video',capabilities:['video','layout','effects','advanced'],compatibleStyleCapabilities:['layout','effects']});
    }
    if(!propertyRegistry.propertyRegistry.some(item=>item.propertyKey==='video.filter')){
      propertyRegistry.registerProperty(propertyRegistry.createPropertyMetadata({
        propertyKey:'video.filter',category:'effects',categoryLabel:'EFFECTS',categoryOrder:50,label:'Video Filter',control:'text',type:'string',order:500,
        commandType:'SET_PROPERTY',capability:'video',propertyPath:'filter',databaseMapping:{kind:'snapshot',path:'backgrounds.{entityId}.boxShadow'},
        defaultValue:'',styleKey:'video.filter',previewUpdater:propertyRegistry.createStylePreviewUpdater('filter')
      }));
    }
    const video=objectRegistry.createEditorObject({id:'video-runtime-proof',section:'Portfolio',label:'Video proof',kind:'video',objectType:'Video'},999);
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const editor=pinia._s.get('editor');
    return {
      builtIns:['Text','Image','Button','Container','Background','Divider','Icon'].every(type=>objectRegistry.listEditorObjectTypes().some(item=>item.type===type)),
      videoType:video.type,
      videoProperty:propertyRegistry.resolveProperties(video,editor.draftSnapshot).some(item=>item.propertyKey==='video.filter'),
      completeMetadata:propertyRegistry.propertyRegistry.every(item=>Boolean(item.type&&item.validation&&item.dependency&&item.serializer&&item.previewUpdater&&item.databaseMapping)),
      objectCount:editor.objects.length,
      completeObjects:editor.objects.every(item=>Boolean(item.id&&item.type&&item.layerId&&item.capabilities.length&&item.validation))
    };
  })()`)
  assert(registryEvidence.builtIns, 'built-in object types are not all registered')
  assert(registryEvidence.videoType === 'Video' && registryEvidence.videoProperty, 'future object/property registration required an Inspector branch')
  assert(registryEvidence.completeMetadata, 'one or more properties are missing professional registry metadata')
  assert(registryEvidence.objectCount > 10 && registryEvidence.completeObjects, 'editable runtime entities were not normalized into Editor Objects')

  const selectionEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const title=[...document.querySelectorAll('[data-editor-object-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    title.click();await tick();
    const input=document.querySelector('[data-property-key="runtime.portfolio-hero.title"] input,[data-property-key="runtime.portfolio-hero.title"] textarea');
    input.value='PORTFOLIO PHASE 030';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    for(let attempt=0;attempt<30&&!document.body.innerText.includes('PORTFOLIO PHASE 030');attempt+=1)await new Promise(resolve=>setTimeout(resolve,20));
    const currentTitle=[...document.querySelectorAll('[data-editor-object-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    const prePreview=currentTitle.textContent.trim();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const site=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('site');
    const component=currentTitle.__vueParentComponent;
    const categories=[...document.querySelectorAll('.property-group[data-property-category]')].map(node=>node.dataset.propertyCategory);
    return {
      selectedObjectId:editor.selectedObjectId,
      selectedEntityAlias:editor.selectedEntityId,
      selectedType:editor.selectedObjectType,
      selectedSection:editor.selectedSection,
      selectedLayer:editor.selectedLayer,
      selector:document.querySelector('[data-admin-entity-select]').value,
      navigatorSelected:document.querySelector('[data-layer-object-id="portfolio-hero"]')?.classList.contains('selected'),
      content:editor.draftSnapshot.content.portfolio.title,
      siteContent:site.current.content.portfolio.title,
      preview:prePreview,
      allTexts:[...document.querySelectorAll('[data-editor-object-id="portfolio-hero"]')].map(node=>({tag:node.tagName,text:node.textContent.trim(),area:node.getBoundingClientRect().width*node.getBoundingClientRect().height})),
      component:{file:component?.type?.__file,setupTitle:component?.setupState?.site?.current?.content?.portfolio?.title,sameSite:component?.setupState?.site===site,dirty:component?.effect?.dirty,flags:component?.effect?.flags},
      outline:currentTitle.classList.contains('editor-preview-selected'),
      outlineBackground:getComputedStyle(currentTitle).backgroundColor,
      categories
    };
  })()`)
  assert(selectionEvidence.selectedObjectId === 'portfolio-hero' && selectionEvidence.selectedEntityAlias === 'portfolio-hero', 'selection is not single-source')
  assert(selectionEvidence.selectedType === 'Text' && selectionEvidence.selectedSection === 'Portfolio' && selectionEvidence.selectedLayer.includes('portfolio-hero'), 'derived selection metadata is wrong')
  assert(selectionEvidence.selector === 'portfolio-hero' && selectionEvidence.navigatorSelected, 'manual selector/Navigator did not follow Preview selection')
  assert(selectionEvidence.content === 'PORTFOLIO PHASE 030' && selectionEvidence.preview === 'PORTFOLIO PHASE 030', `live content binding failed: ${JSON.stringify(selectionEvidence)}`)
  assert(selectionEvidence.outline && !selectionEvidence.outlineBackground.includes('184, 91, 105'), 'selection outline is missing or uses a blocking fill')
  for (const category of ['font', 'layout', 'effects', 'advanced']) assert(selectionEvidence.categories.includes(category), `${category.toUpperCase()} Inspector metadata group is missing`)

  const navigatorEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const search=document.querySelector('[data-object-search]');
    search.value='navigation-brand';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const visible=[...document.querySelectorAll('[data-layer-object-id]')].filter(node=>getComputedStyle(node).display!=='none');
    document.querySelector('[data-layer-object-id="navigation-brand"] .object-select').click();await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const brand=document.querySelector('[data-editor-object-id="navigation-brand"]');
    search.value='Lisa name';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const byName=[...document.querySelectorAll('[data-layer-object-id]')].filter(node=>getComputedStyle(node).display!=='none').length;
    search.value='Button';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const byType=[...document.querySelectorAll('[data-layer-object-id]')].filter(node=>getComputedStyle(node).display!=='none').length;
    search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    return {visible:visible.length,byName,byType,selected:editor.selectedObjectId,section:editor.selectedSection,outlined:brand.classList.contains('editor-preview-selected'),expanded:editor.draftSnapshot.session.expandedLayers.includes('section:Navigation')};
  })()`)
  assert(navigatorEvidence.visible === 1, 'object search did not filter by ID')
  assert(navigatorEvidence.byName === 1 && navigatorEvidence.byType >= 4, 'object search did not filter by name and type')
  assert(navigatorEvidence.selected === 'navigation-brand' && navigatorEvidence.section === 'Navigation', 'Navigator selection did not update central selection')
  assert(navigatorEvidence.outlined && navigatorEvidence.expanded, 'Navigator did not focus/expand the selected object')

  const lockHideEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const title=[...document.querySelectorAll('[data-editor-object-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    title.click();await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const actionButtons=[...document.querySelectorAll('.object-actions button')];
    actionButtons.find(button=>button.textContent.includes('Lock')).click();await tick();
    const input=document.querySelector('[data-property-key="runtime.portfolio-hero.title"] input,[data-property-key="runtime.portfolio-hero.title"] textarea');
    const before=editor.draftSnapshot.content.portfolio.title;
    input.value='LOCK MUST BLOCK';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const blocked=editor.draftSnapshot.content.portfolio.title===before&&input.disabled;
    actionButtons.find(button=>button.textContent.includes('Unlock')).click();await tick();
    [...document.querySelectorAll('.object-actions button')].find(button=>button.textContent.includes('Hide')).click();await tick();
    const hidden=title.classList.contains('editor-preview-hidden')&&editor.draftSnapshot.session.objectStates['portfolio-hero'].hidden===true;
    const guestVisibility=editor.draftSnapshot.layout['portfolio-hero']?.visibility;
    [...document.querySelectorAll('.object-actions button')].find(button=>button.textContent.includes('Show')).click();await tick();
    return {blocked,hidden,guestVisibility,restored:!title.classList.contains('editor-preview-hidden'),selected:editor.selectedObjectId};
  })()`)
  assert(lockHideEvidence.blocked, 'locked object accepted an Inspector edit')
  assert(lockHideEvidence.hidden && lockHideEvidence.guestVisibility === undefined, 'editor-only Hide leaked into Guest visibility')
  assert(lockHideEvidence.restored && lockHideEvidence.selected === 'portfolio-hero', 'Show did not restore the preview object or preserve selection')

  const copyPasteEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const title=[...document.querySelectorAll('[data-editor-object-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    title.click();await tick();
    const colorControl=document.querySelector('[data-property-key="font.color"]');colorControl.querySelector('.color-summary').click();await tick();
    const color=colorControl.querySelector('input[type="color"]');color.value='#a04f63';color.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    [...document.querySelectorAll('.object-actions button')].find(button=>button.textContent.includes('Copy Style')).click();await tick();
    const brand=document.querySelector('[data-editor-object-id="navigation-brand"]');brand.click();await tick();
    const buttons=[...document.querySelectorAll('.object-actions button')];
    const paste=buttons.find(button=>button.textContent.includes('Paste Style'));const enabled=!paste.disabled;paste.click();await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const afterPaste=editor.draftSnapshot.typography['navigation-brand']?.color;
    const command=editor.commandHistory.at(-1);
    document.querySelector('.tbar-undo').click();await tick();
    const afterUndo=editor.draftSnapshot.typography['navigation-brand']?.color;
    const selectedAfterUndo=editor.selectedObjectId;
    document.querySelector('.tbar-redo').click();await tick();
    return {enabled,afterPaste,afterUndo,afterRedo:editor.draftSnapshot.typography['navigation-brand']?.color,commandType:command?.type,changeCount:command?.changes?.length??0,selectedAfterUndo,history:editor.commandHistory.length};
  })()`)
  assert(copyPasteEvidence.enabled && copyPasteEvidence.afterPaste === '#a04f63', 'compatible Copy/Paste Style failed')
  assert(copyPasteEvidence.commandType === 'PASTE_STYLE' && copyPasteEvidence.changeCount > 1, 'Paste Style was not one logical multi-property command')
  assert(copyPasteEvidence.afterUndo !== '#a04f63' && copyPasteEvidence.afterRedo === '#a04f63', 'Paste Style Undo/Redo failed')
  assert(copyPasteEvidence.selectedAfterUndo === 'navigation-brand' && copyPasteEvidence.history <= 10, 'Undo changed selection or exceeded history limit')

  const dependencyEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const image=document.querySelector('[data-editor-object-id="portfolio-profile-media"]');image.click();await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const thicknessBefore=document.querySelector('[data-property-key="media.outlineWidth"]');
    const outlineControl=document.querySelector('[data-property-key="media.outlineEnabled"]');
    const outline=outlineControl.matches('input')?outlineControl:outlineControl.querySelector('input');
    const beforeHidden=!thicknessBefore;outline.checked=true;outline.dispatchEvent(new Event('change',{bubbles:true}));await tick();
    const currentThicknessControl=document.querySelector('[data-property-key="media.outlineWidth"]');
    const currentThickness=currentThicknessControl.matches('input')?currentThicknessControl:currentThicknessControl.querySelector('input');
    return {selected:editor.selectedObjectId,type:editor.selectedObjectType,accordion:editor.activeAccordion,beforeHidden,after:currentThickness.disabled,outlineEnabled:editor.draftSnapshot.media.styles['portfolio-profile-media']?.outlineEnabled,inlineOutline:image.style.outline};
  })()`)
  assert(dependencyEvidence.selected === 'portfolio-profile-media' && dependencyEvidence.type === 'Image' && dependencyEvidence.accordion === 'media', 'Image selection did not open MEDIA')
  assert(dependencyEvidence.beforeHidden && !dependencyEvidence.after && dependencyEvidence.outlineEnabled, `metadata dependency did not hide/reveal the dependent control: ${JSON.stringify(dependencyEvidence)}`)
  assert(dependencyEvidence.inlineOutline.includes('solid'), 'MEDIA property did not update the live preview')

  const validationEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    document.querySelector('[data-editor-object-id="portfolio-hero"]').click();await tick();
    document.querySelector('[data-property-category="effects"] .accordion-toggle').click();await tick();
    const opacity=document.querySelector('[data-property-key="effects.opacity"] input');opacity.value='101';opacity.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const bounded={errors:editor.registeredPropertyErrors.length,inline:Boolean(document.querySelector('[data-property-key="effects.opacity"]')?.closest('.property-field--error')),publishDisabled:document.querySelector('.tbar-publish').disabled,publishTitle:document.querySelector('.tbar-publish').title,opacity:editor.draftSnapshot.backgrounds['portfolio-hero']?.opacity,previewOpacity:getComputedStyle(document.querySelector('[data-editor-object-id="portfolio-hero"]')).opacity};
    opacity.value='70';opacity.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    return {bounded,restoredErrors:editor.registeredPropertyErrors.length,remaining:editor.registeredPropertyErrors.map(error=>({entityId:error.entityId,propertyKey:error.propertyKey,propertyPath:error.propertyPath,message:error.message})),opacity:editor.draftSnapshot.backgrounds['portfolio-hero']?.opacity,previewOpacity:getComputedStyle(document.querySelector('[data-editor-object-id="portfolio-hero"]')).opacity};
  })()`)
  assert(validationEvidence.bounded.errors === 0 && !validationEvidence.bounded.inline && validationEvidence.bounded.opacity === 1 && validationEvidence.bounded.previewOpacity === '1', `friendly opacity adapter did not bound an out-of-range value: ${JSON.stringify(validationEvidence)}`)
  assert(validationEvidence.restoredErrors === 0 && validationEvidence.opacity === 0.7 && validationEvidence.previewOpacity === '0.7', `corrected property did not restore validation/live preview: ${JSON.stringify(validationEvidence)}`)

  const persistenceEvidence = await evaluate(`(async()=>{
    const model=await import('/src/editor/editorSnapshot.ts');
    const repositories=await import('/src/repositories/editorRevisionRepository.ts');
    const runtime=await import('/src/runtime/publishedSnapshotDom.ts');
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const editor=pinia._s.get('editor');
    editor.setObjectState('portfolio-hero',{locked:true,hidden:true});
    const serialized=model.serializeEditorSnapshot(editor.draftSnapshot);
    const roundTrip=model.deserializeEditorSnapshot(serialized);
    const repository=new repositories.InMemoryEditorRevisionRepository();repository.seedPublished(roundTrip,1);
    const saved=await repository.saveDraft({snapshot:roundTrip,mediaReferences:[],expectedBaseRevision:1,createNew:true});
    const loaded=await repository.loadDraft(saved.revision.id);
    const root=document.createElement('div');const object=document.createElement('div');object.dataset.entityId='portfolio-hero';root.append(object);
    runtime.applyPublishedSnapshotDom(root,loaded.revision.snapshot);
    return {
      locked:loaded.revision.snapshot.session.objectStates['portfolio-hero'].locked,
      hidden:loaded.revision.snapshot.session.objectStates['portfolio-hero'].hidden,
      opacity:object.style.opacity,
      editorHiddenClass:object.classList.contains('editor-preview-hidden'),
      entities:loaded.revision.snapshot.entities.length,
      sameDraftId:(await repository.saveDraft({snapshot:loaded.revision.snapshot,mediaReferences:[],expectedBaseRevision:1,expectedDraftLockVersion:loaded.revision.lock_version,draftRevisionId:loaded.revision.id})).revision.id===loaded.revision.id
    };
  })()`)
  assert(persistenceEvidence.locked && persistenceEvidence.hidden, 'editor object session state did not survive Draft repository round-trip')
  assert(persistenceEvidence.opacity === '0.7' && !persistenceEvidence.editorHiddenClass, 'Guest shared renderer missed a property or applied editor-only Hide')
  assert(persistenceEvidence.entities > 10 && persistenceEvidence.sameDraftId, 'entity references or same-Draft update contract regressed')

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  await evaluate(`(async()=>{
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const editor=pinia._s.get('editor');
    editor.setObjectState('portfolio-hero',{locked:false,hidden:false});
    const image=document.querySelector('[data-editor-object-id="portfolio-profile-media"]');image.click();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return true;
  })()`)
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-030-professional-editor.png'), Buffer.from(screenshot.data, 'base64'))

  const rejectionReasons = await evaluate(`globalThis.__phase030Unhandled ?? []`)
  const exceptionDetails = []
  for (const objectId of runtimeExceptionObjectIds) {
    try {
      const detail = await send('Runtime.callFunctionOn', { objectId, functionDeclaration: 'function(){return String(this?.stack??this?.message??this)}', returnByValue: true })
      if (detail.result?.value) exceptionDetails.push(detail.result.value)
    } catch { /* exception object may already be released */ }
  }
  const seriousErrors = [...runtimeErrors, ...rejectionReasons, ...exceptionDetails].filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
  assert(seriousErrors.length === 0, `unexpected browser errors: ${seriousErrors.join(' | ')}; records=${runtimeExceptionRecords.join(' | ')}`)
  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    scope: 'Phase 030 local professional Editor Object System runtime',
    objectCount: registryEvidence.objectCount,
    extensibleObjectType: registryEvidence.videoType,
    selection: selectionEvidence.selectedObjectId,
    navigator: navigatorEvidence.selected,
    copyPasteCommand: copyPasteEvidence.commandType,
    dependencyNativeDisabled: dependencyEvidence.before && !dependencyEvidence.after,
    validationBlockedPublish: validationEvidence.publishDisabled,
    draftRoundTrip: persistenceEvidence.sameDraftId,
    guestMetadataRuntime: persistenceEvidence.opacity
  }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* no-op */ }
  stopChildren()
  await wait(250)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* Chromium may release its lock after process exit. */ }
}
