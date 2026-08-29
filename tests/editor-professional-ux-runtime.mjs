import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5181'
const cdpPort = 9341
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase031-chrome-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(`Phase 031 runtime failure: ${message}`)
}

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

process.on('exit', stopChildren)
process.on('SIGINT', () => { stopChildren(); process.exit(130) })

let socket
try {
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5181'))
    if (!page) await wait(100)
  }
  if (!page) throw new Error('Phase 031 browser target not found.')

  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  const traceEvents = []
  let resolveTrace = null
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
    if (message.method === 'Tracing.dataCollected') traceEvents.push(...message.params.value)
    if (message.method === 'Tracing.tracingComplete') {
      resolveTrace?.()
      resolveTrace = null
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
  await send('Performance.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  await evaluate(`(()=>{
    globalThis.__phase031Unhandled=[];
    addEventListener('unhandledrejection',(event)=>globalThis.__phase031Unhandled.push(String(event.reason?.stack??event.reason?.message??event.reason)));
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
    await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]')) && Boolean(document.querySelector('.editor-status-bar'))`)
  } catch (error) {
    const diagnostics = await evaluate(`({url:location.href,body:document.body.innerText.slice(0,2200),recovery:document.querySelector('.editor-recovery')?.innerText})`)
    throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}; vite=${viteErrors}; browser=${browserErrors}; runtime=${runtimeErrors.join(' | ')}`)
  }

  const selectionEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const key=(key,options={})=>window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options}));
    const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    const title=smallest('portfolio-hero');title.click();await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const outline={selected:title.classList.contains('editor-preview-selected--primary'),background:getComputedStyle(title).backgroundColor};
    title.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await tick();
    const inlineStarted=title.contentEditable==='true';title.innerText='PHASE 031 INLINE';title.blur();await tick();
    const inlineCommitted=editor.draftSnapshot.content.portfolio.title;
    const current=smallest('portfolio-hero');current.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await tick();
    current.innerText='CANCELLED VALUE';key('Escape');await tick();
    const escapeValue=editor.draftSnapshot.content.portfolio.title;
    const beforeTab=editor.selectedObjectId;key('Tab');await tick();const afterTab=editor.selectedObjectId;key('Tab',{shiftKey:true});await tick();
    const afterShiftTab=editor.selectedObjectId;
    const x0=Number(editor.draftSnapshot.layout['portfolio-hero']?.x??0);const y0=Number(editor.draftSnapshot.layout['portfolio-hero']?.y??0);
    key('ArrowRight');key('ArrowDown',{shiftKey:true});await tick();
    const x1=Number(editor.draftSnapshot.layout['portfolio-hero']?.x??0);const y1=Number(editor.draftSnapshot.layout['portfolio-hero']?.y??0);
    key('z',{ctrlKey:true});await tick();const undoY=Number(editor.draftSnapshot.layout['portfolio-hero']?.y??0);
    key('z',{ctrlKey:true,shiftKey:true});await tick();const redoY=Number(editor.draftSnapshot.layout['portfolio-hero']?.y??0);
    return {outline,inlineStarted,inlineCommitted,escapeValue,beforeTab,afterTab,afterShiftTab,x0,y0,x1,y1,undoY,redoY,selected:editor.selectedObjectId,history:editor.commandHistory.length};
  })()`)
  assert(selectionEvidence.outline.selected && !selectionEvidence.outline.background.includes('184, 91, 105'), 'single selection is missing a transparent primary outline')
  assert(selectionEvidence.inlineStarted && selectionEvidence.inlineCommitted === 'PHASE 031 INLINE' && selectionEvidence.escapeValue === 'PHASE 031 INLINE', 'double-click inline editing or ESC cancellation failed')
  assert(selectionEvidence.afterTab !== selectionEvidence.beforeTab && selectionEvidence.afterShiftTab === selectionEvidence.beforeTab, 'TAB/SHIFT+TAB traversal failed')
  assert(selectionEvidence.x1 === selectionEvidence.x0 + 1 && selectionEvidence.y1 === selectionEvidence.y0 + 10 && selectionEvidence.undoY === selectionEvidence.y0 && selectionEvidence.redoY === selectionEvidence.y1, 'arrow nudge or keyboard Undo/Redo failed')
  assert(selectionEvidence.selected === 'portfolio-hero' && selectionEvidence.history <= 10, 'typing/nudging changed selection or exceeded history limit')

  const multiEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const title=smallest('portfolio-hero');const name=smallest('navigation-brand');
    title.click();name.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await tick();
    const ctrlIds=[...editor.selectedObjectIds];
    const rangeTarget=smallest('portfolio-profile-media');rangeTarget.dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}));await tick();
    const rangeCount=editor.selectedObjectIds.length;
    title.click();name.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await tick();
    const before=new Map(editor.selectedObjectIds.map(id=>[id,{x:Number(editor.draftSnapshot.layout[id]?.x??0),y:Number(editor.draftSnapshot.layout[id]?.y??0)}]));
    const rect=title.getBoundingClientRect();title.dispatchEvent(new PointerEvent('pointerdown',{pointerId:21,button:0,clientX:rect.left+5,clientY:rect.top+5,bubbles:true}));
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:21,button:0,clientX:rect.left+17,clientY:rect.top+13,bubbles:true}));
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:21,button:0,clientX:rect.left+17,clientY:rect.top+13,bubbles:true}));await tick();
    const moved=editor.selectedObjectIds.every(id=>Number(editor.draftSnapshot.layout[id]?.x??0)>before.get(id).x&&Number(editor.draftSnapshot.layout[id]?.y??0)>before.get(id).y);
    const dragCommand=editor.commandHistory.at(-1);
    const runtime=document.querySelector('.editor-preview-runtime');const canvas=document.querySelector('.canvas-container').getBoundingClientRect();
    runtime.dispatchEvent(new PointerEvent('pointerdown',{pointerId:22,button:0,clientX:canvas.left+10,clientY:canvas.top+70,bubbles:true}));
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:22,button:0,clientX:canvas.right-10,clientY:canvas.bottom-45,bubbles:true}));
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:22,button:0,clientX:canvas.right-10,clientY:canvas.bottom-45,bubbles:true}));await tick();
    const boxCount=editor.selectedObjectIds.length;
    const align=[...document.querySelectorAll('.selection-toolbar button')].find(button=>button.getAttribute('aria-label')==='Align left');const alignEnabled=Boolean(align&&!align.disabled);align?.click();await tick();
    const alignType=editor.commandHistory.at(-1)?.type;
    const distribute=[...document.querySelectorAll('.selection-toolbar button')].find(button=>button.getAttribute('aria-label')==='Distribute horizontally');const distributeEnabled=Boolean(distribute&&!distribute.disabled);distribute?.click();await tick();const distributeType=editor.commandHistory.at(-1)?.type;
    editor.undo();editor.undo();editor.undo();await tick();title.click();name.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await tick();
    return {ctrlIds,rangeCount,moved,dragType:dragCommand?.type,dragChanges:dragCommand?.changes?.length??0,boxCount,alignEnabled,alignType,distributeEnabled,distributeType,selectionToolbar:Boolean(document.querySelector('.selection-toolbar'))};
  })()`)
  assert(multiEvidence.ctrlIds.length === 2 && multiEvidence.rangeCount >= 2, 'CTRL/Shift click multi-selection failed')
  assert(multiEvidence.moved && multiEvidence.dragType === 'NUDGE' && multiEvidence.dragChanges >= 2, 'group drag did not create one multi-object movement command')
  assert(multiEvidence.boxCount > 2 && multiEvidence.selectionToolbar, 'selection box did not produce a multi-selection')
  assert(multiEvidence.alignEnabled && multiEvidence.alignType === 'ALIGN' && multiEvidence.distributeEnabled && multiEvidence.distributeType === 'DISTRIBUTE', 'alignment/distribution controls failed')

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  const selectionShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-031-multi-selection.png'), Buffer.from(selectionShot.data, 'base64'))

  const layerShortcutEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const key=(key,options={})=>window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options}));
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const search=document.querySelector('[data-object-search]');const originalCount=editor.draftSnapshot.content.about.paragraphs.length;
    const paragraph=editor.objects.find(object=>object.ux?.collectionPath==='content.about.paragraphs');
    search.value=paragraph.id;search.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const row=document.querySelector('[data-layer-object-id="'+paragraph.id+'"]');row.querySelector('.object-select').click();await tick();
    const selectedBeforeDuplicate={id:editor.selectedObjectId,ux:editor.selectedObject?.ux,locked:editor.objectState(editor.selectedObjectId).locked};
    key('d',{ctrlKey:true});
    for(let attempt=0;attempt<80&&!editor.selectedObjectId.includes('-copy-');attempt+=1)await new Promise(resolve=>setTimeout(resolve,20));
    await tick();
    const duplicateId=editor.selectedObjectId;const duplicateCount=editor.draftSnapshot.content.about.paragraphs.length;const duplicateStatus=document.querySelector('.save-status')?.textContent;const duplicateCommand=editor.commandHistory.at(-1)?.type;const duplicateUnhandled=[...(globalThis.__phase031Unhandled??[])];
    key('Delete');await tick();await tick();const deletedCount=editor.draftSnapshot.content.about.paragraphs.length;
    search.value=paragraph.id;search.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const originalRow=document.querySelector('[data-layer-object-id="'+paragraph.id+'"]');originalRow.querySelector('.object-select').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));await tick();
    const rename=originalRow.querySelector('input');rename.value='Renamed paragraph';rename.dispatchEvent(new Event('input',{bubbles:true}));rename.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();
    const renamed=editor.objects.find(object=>object.id===paragraph.id)?.name;
    search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const aboutHeading=[...document.querySelectorAll('.layer-heading')].find(button=>button.textContent.includes('About'));const expandedBefore=aboutHeading.getAttribute('aria-expanded');aboutHeading.click();await tick();
    const collapsed=aboutHeading.getAttribute('aria-expanded')!==expandedBefore;
    aboutHeading.click();await tick();
    search.value=paragraph.id;search.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const handle=document.querySelector('[data-layer-object-id="'+paragraph.id+'"] .layer-drag-handle');const orderBefore=editor.objects.find(object=>object.id===paragraph.id)?.order;
    handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',altKey:true,bubbles:true,cancelable:true}));await tick();
    const orderAfter=editor.objects.find(object=>object.id===paragraph.id)?.order;
    const lock=document.querySelector('[data-layer-object-id="'+paragraph.id+'"] .object-state-button');lock.click();await tick();const locked=editor.objectState(paragraph.id).locked;lock.click();await tick();
    const hide=document.querySelectorAll('[data-layer-object-id="'+paragraph.id+'"] .object-state-button')[1];hide.click();await tick();const hidden=editor.objectState(paragraph.id).hidden;hide.click();await tick();
    key('c',{ctrlKey:true});
    return {originalCount,duplicateCount,deletedCount,duplicateId,duplicateStatus,duplicateCommand,duplicateUnhandled,selectedBeforeDuplicate,renamed,collapsed,orderBefore,orderAfter,locked,hidden,searchResults:document.querySelectorAll('[data-layer-object-id]').length};
  })()`)
  assert(layerShortcutEvidence.duplicateCount === layerShortcutEvidence.originalCount + 1 && layerShortcutEvidence.deletedCount === layerShortcutEvidence.originalCount && layerShortcutEvidence.duplicateId.includes('-copy-'), `CTRL+D/Delete failed for a metadata-declared repeatable object: ${JSON.stringify(layerShortcutEvidence)}`)
  assert(layerShortcutEvidence.renamed === 'Renamed paragraph' && layerShortcutEvidence.collapsed, 'Layer rename/collapse failed')
  assert(layerShortcutEvidence.orderAfter !== layerShortcutEvidence.orderBefore && layerShortcutEvidence.locked && layerShortcutEvidence.hidden && layerShortcutEvidence.searchResults === 1, 'Layer reorder/lock/hide/search failed')

  const inspectorEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    smallest('portfolio-hero').click();await tick();
    const propertySearch=document.querySelector('[data-property-search]');propertySearch.value='color';propertySearch.dispatchEvent(new Event('input',{bubbles:true}));await tick();await new Promise(resolve=>setTimeout(resolve,220));
    const colorSearchAccordion=editor.activeAccordion;const colorMounted=Boolean(document.querySelector('[data-property-key="font.color"]'));
    propertySearch.value='shadow';propertySearch.dispatchEvent(new Event('input',{bubbles:true}));await tick();await new Promise(resolve=>setTimeout(resolve,220));
    const searchAccordion=editor.activeAccordion;const effectsMounted=Boolean(document.querySelector('[data-property-key="effects.shadow"]'));const fontUnmounted=!document.querySelector('[data-property-key="font.family"]');
    const transitionDuration=getComputedStyle(document.querySelector('[data-property-category="effects"] .accordion-content')).transitionDuration;
    propertySearch.value='';propertySearch.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('[data-property-category="font"] .accordion-toggle').click();await tick();
    const shadowControl=document.querySelector('[data-property-key="font.shadow"]');const shadowToggle=shadowControl.querySelector('input[type="checkbox"]');const shadowValue=shadowControl.querySelector('input:not([type="checkbox"])');const shadowDisabledBefore=shadowValue.disabled;shadowToggle.click();await tick();const shadowDisabledAfter=shadowValue.disabled;
    const colorControl=document.querySelector('[data-property-key="font.color"]');colorControl.querySelector('.color-summary').click();await tick();
    const hex=colorControl.querySelector('.picker-head input:not([type="color"])');hex.value='#7f4055';hex.dispatchEvent(new Event('change',{bubbles:true}));await tick();
    const colorValue=editor.draftSnapshot.typography['portfolio-hero']?.color;const colorFeatures={rgb:colorControl.querySelectorAll('.rgb-grid input').length,alpha:Boolean(colorControl.querySelector('.alpha-control')),recent:Boolean(colorControl.querySelector('.recent-colors')),eyedropperSupported:'EyeDropper' in window,eyedropperShown:Boolean(colorControl.querySelector('.eyedropper'))};
    colorControl.querySelector('.color-summary').click();await tick();
    document.querySelector('[data-property-category="layout"] .accordion-toggle').click();await tick();
    const xControl=document.querySelector('[data-property-key="position.x"]');const xInput=xControl.querySelector('input');const scrub=xControl.querySelector('.numeric-scrub');
    const x0=Number(editor.draftSnapshot.layout['portfolio-hero']?.x??0);xInput.dispatchEvent(new WheelEvent('wheel',{deltaY:-1,shiftKey:true,bubbles:true,cancelable:true}));await tick();const xShift=Number(editor.draftSnapshot.layout['portfolio-hero']?.x??0);
    xInput.dispatchEvent(new WheelEvent('wheel',{deltaY:-1,altKey:true,bubbles:true,cancelable:true}));await tick();const xAlt=Number(editor.draftSnapshot.layout['portfolio-hero']?.x??0);
    scrub.dispatchEvent(new PointerEvent('pointerdown',{pointerId:31,button:0,clientX:100,bubbles:true}));window.dispatchEvent(new PointerEvent('pointermove',{pointerId:31,button:0,clientX:120,bubbles:true}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:31,button:0,clientX:120,bubbles:true}));await tick();const xDrag=Number(editor.draftSnapshot.layout['portfolio-hero']?.x??0);
    const noRotate=editor.objects.find(object=>object.capabilities.includes('typography')&&!object.capabilities.includes('rotate'));
    if(noRotate){const selector=document.querySelector('[data-admin-entity-select]');const section=document.querySelector('#section-select');section.value=noRotate.section;section.dispatchEvent(new Event('change',{bubbles:true}));await tick();selector.value=noRotate.id;selector.dispatchEvent(new Event('change',{bubbles:true}));await tick();}
    const rotationHidden=noRotate?!document.querySelector('[data-property-key="font.rotate"]'):true;
    const imageObject=editor.objects.find(object=>object.id==='portfolio-profile-media')??editor.objects.find(object=>object.type==='Image');const image=smallest(imageObject.id);image.click();image.scrollIntoView({block:'center',inline:'center'});await tick();
    const mediaLabels=[...document.querySelectorAll('[data-property-category="media"] .property-field>span')].map(node=>node.textContent.trim());
    const outlineControl=document.querySelector('[data-property-key="media.outlineEnabled"]');const outline=outlineControl.matches('input')?outlineControl:outlineControl.querySelector('input');
    const thicknessControl=document.querySelector('[data-property-key="media.outlineWidth"]');const thickness=thicknessControl.matches('input')?thicknessControl:thicknessControl.querySelector('input');const thicknessBefore=thickness.disabled;outline.click();await tick();const thicknessAfter=thickness.disabled;
    const fitOptions=[...document.querySelectorAll('[data-property-key="media.fit"] button')].map(button=>button.textContent.trim());
    return {colorSearchAccordion,colorMounted,searchAccordion,effectsMounted,fontUnmounted,transitionDuration,shadowDisabledBefore,shadowDisabledAfter,colorValue,colorFeatures,x0,xShift,xAlt,xDrag,rotationHidden,mediaLabels,thicknessBefore,thicknessAfter,fitOptions,thumbnail:Boolean(document.querySelector('[data-property-key="media.preview"] img')),accordion:editor.activeAccordion};
  })()`)
  assert(inspectorEvidence.colorSearchAccordion === 'font' && inspectorEvidence.colorMounted, 'property search did not jump to Typography Color')
  assert(inspectorEvidence.searchAccordion === 'effects' && inspectorEvidence.effectsMounted && inspectorEvidence.fontUnmounted, 'property search did not jump to Effects or closed accordions remained mounted')
  assert(inspectorEvidence.transitionDuration !== '0s', 'Inspector accordion has no animated transition')
  assert(inspectorEvidence.shadowDisabledBefore && !inspectorEvidence.shadowDisabledAfter, 'Shadow smart control dependency failed')
  assert(inspectorEvidence.colorValue === '#7f4055' && inspectorEvidence.colorFeatures.rgb === 3 && inspectorEvidence.colorFeatures.alpha && inspectorEvidence.colorFeatures.recent && inspectorEvidence.colorFeatures.eyedropperShown === inspectorEvidence.colorFeatures.eyedropperSupported, 'professional color picker is incomplete')
  assert(Math.abs(inspectorEvidence.xShift - inspectorEvidence.x0 - 10) < .001 && Math.abs(inspectorEvidence.xAlt - inspectorEvidence.xShift - .1) < .001 && inspectorEvidence.xDrag > inspectorEvidence.xAlt, 'numeric wheel/modifier/scrub controls failed')
  assert(inspectorEvidence.rotationHidden, 'unsupported rotation was not hidden')
  for (const label of ['Preview','Upload','Media Picker','Replace','Crop focus','Fit','Width','Height','Opacity','Border','Radius','Outline','Outline Thickness','Rotation']) assert(inspectorEvidence.mediaLabels.includes(label), `MEDIA control missing: ${label}`)
  assert(inspectorEvidence.thicknessBefore && !inspectorEvidence.thicknessAfter && inspectorEvidence.fitOptions.join('|') === 'Fit|Fill|Contain' && inspectorEvidence.thumbnail, `MEDIA dependency/Fit/thumbnail behavior failed: ${JSON.stringify(inspectorEvidence)}`)

  const inspectorShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-031-professional-editor-ux.png'), Buffer.from(inspectorShot.data, 'base64'))

  const workspaceEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    const zoom=document.querySelector('.zoom-control select');const presets=[...zoom.options].map(option=>option.textContent.trim());zoom.value='1.5';zoom.dispatchEvent(new Event('change',{bubbles:true}));await tick();const zoom150=editor.draftSnapshot.session.userZoom;
    const scroll=document.querySelector('.canvas-scroll');const bounds=scroll.getBoundingClientRect();scroll.dispatchEvent(new WheelEvent('wheel',{deltaY:-1,ctrlKey:true,clientX:bounds.left+300,clientY:bounds.top+220,bubbles:true,cancelable:true}));await tick();const zoomWheel=editor.draftSnapshot.session.userZoom;
    zoom.value='2';zoom.dispatchEvent(new Event('change',{bubbles:true}));await tick();scroll.scrollLeft=250;scroll.scrollTop=250;scroll.dispatchEvent(new PointerEvent('pointerdown',{pointerId:41,button:1,clientX:500,clientY:500,bubbles:true,cancelable:true}));window.dispatchEvent(new PointerEvent('pointermove',{pointerId:41,button:1,clientX:450,clientY:460,bubbles:true}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:41,button:1,clientX:450,clientY:460,bubbles:true}));await tick();const panned=scroll.scrollLeft>250&&scroll.scrollTop>250;
    const title=smallest('portfolio-hero');title.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:900,clientY:250}));await tick();const contextActions=[...document.querySelectorAll('.editor-context-menu button')].map(button=>button.textContent.trim());document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));await tick();
    title.click();await tick();const status=document.querySelector('.editor-status-bar').innerText;const namelessButtons=[...document.querySelectorAll('.edit-page button')].filter(button=>!(button.getAttribute('aria-label')||button.textContent.trim()||button.title)).length;const unlabeledInputs=[...document.querySelectorAll('.edit-page input,.edit-page select,.edit-page textarea')].filter(input=>!(input.getAttribute('aria-label')||input.id&&document.querySelector('label[for="'+CSS.escape(input.id)+'"]')||input.closest('label'))).length;
    const focusTarget=document.querySelector('.open-source-button');focusTarget.focus();const focusStyle=getComputedStyle(focusTarget);const visibleFocus=focusStyle.outlineStyle!=='none'&&Number.parseFloat(focusStyle.outlineWidth)>0;
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true}));
    for(let attempt=0;attempt<100&&(editor.isSavingDraft||!editor.draftRevisionId);attempt+=1)await new Promise(resolve=>setTimeout(resolve,25));
    const saved=Boolean(editor.draftRevisionId)&&!editor.hasUnsavedChanges;const saveDiagnostics={header:document.querySelector('.editor-save-status')?.textContent?.trim()??'',local:document.querySelector('.save-status')?.textContent?.trim()??'',errors:editor.registeredPropertyErrors.map(error=>({path:error.propertyPath,message:error.message})),publishTitle:document.querySelector('.tbar-publish')?.title??'',draftRevisionId:editor.draftRevisionId,hasUnsavedChanges:editor.hasUnsavedChanges};
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',ctrlKey:true,bubbles:true,cancelable:true}));await tick();const publishDialog=Boolean(document.querySelector('.publish-modal'));document.querySelector('.publish-cancel')?.click();
    return {presets,zoom150,zoomWheel,panned,contextActions,status,namelessButtons,unlabeledInputs,visibleFocus,saved,publishDialog,saveDiagnostics,sessionAccordion:editor.draftSnapshot.session.activeAccordion,sessionSearch:editor.draftSnapshot.session.propertySearch};
  })()`)
  assert(['25%','50%','75%','100%','125%','150%','200%'].every((preset) => workspaceEvidence.presets.includes(preset)) && workspaceEvidence.zoom150 === 1.5 && workspaceEvidence.zoomWheel > workspaceEvidence.zoom150 && workspaceEvidence.panned, 'zoom presets, CTRL+Wheel, or middle-mouse pan failed')
  for (const action of ['Duplicate','Copy Style','Paste Style','Bring Front','Send Back','Delete']) assert(workspaceEvidence.contextActions.some((label) => label.includes(action)), `context action missing: ${action}`)
  assert(['SELECTION','POSITION','SIZE','DRAFT','REVISION','ZOOM','PREVIEW'].every((label) => workspaceEvidence.status.toUpperCase().includes(label)), 'status bar is incomplete')
  assert(workspaceEvidence.namelessButtons === 0 && workspaceEvidence.unlabeledInputs === 0 && workspaceEvidence.visibleFocus, `accessibility labels/focus failed: ${JSON.stringify(workspaceEvidence)}`)
  assert(workspaceEvidence.saved && workspaceEvidence.publishDialog, `CTRL+S or CTRL+P confirmation shortcut failed: ${JSON.stringify(workspaceEvidence)}`)

  const beforeMetrics = await send('Performance.getMetrics')
  const traceDone = new Promise((resolve) => { resolveTrace = resolve })
  await send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing', options: 'sampling-frequency=10000' })
  const performanceEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    smallest('portfolio-hero').click();await tick();document.querySelector('[data-property-category="effects"] .accordion-toggle').click();await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const root=document.querySelector('.guest-home');const countBefore=Number(document.querySelector('.performance-status').dataset.previewUpdateCount??0);const input=document.querySelector('[data-property-key="effects.opacity"] input');
    let removedRoot=0;const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.removedNodes)if(node===root||(node.nodeType===1&&node.contains?.(root)))removedRoot+=1});observer.observe(document.querySelector('.editor-preview-runtime'),{childList:true,subtree:true});
    const started=performance.now();for(let index=0;index<80;index+=1){input.value=String(.2+(index%7)/10);input.dispatchEvent(new Event('input',{bubbles:true}));}await tick();const burstDuration=performance.now()-started;observer.disconnect();
    const countAfter=Number(document.querySelector('.performance-status').dataset.previewUpdateCount??0);const frames=[];for(let index=0;index<61;index+=1)frames.push(await new Promise(resolve=>requestAnimationFrame(resolve)));const intervals=frames.slice(1).map((value,index)=>value-frames[index]).sort((a,b)=>a-b);const average=intervals.reduce((sum,value)=>sum+value,0)/intervals.length;const p95=intervals[Math.floor(intervals.length*.95)]??0;
    return {sameRoot:root===document.querySelector('.guest-home'),removedRoot,targetedUpdates:countAfter-countBefore,burstDuration,averageFrameMs:average,p95FrameMs:p95,measuredFps:1000/average,history:editor.commandHistory.length,opacity:editor.draftSnapshot.backgrounds['portfolio-hero']?.opacity};
  })()`)
  await send('Tracing.end')
  await Promise.race([traceDone, wait(10000)])
  const afterMetrics = await send('Performance.getMetrics')
  const metricMap = (result) => Object.fromEntries(result.metrics.map((metric) => [metric.name, metric.value]))
  const before = metricMap(beforeMetrics)
  const after = metricMap(afterMetrics)
  const metricDelta = {
    ScriptDuration: Number(((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)).toFixed(6)),
    TaskDuration: Number(((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)).toFixed(6)),
    LayoutCount: (after.LayoutCount ?? 0) - (before.LayoutCount ?? 0),
    RecalcStyleCount: (after.RecalcStyleCount ?? 0) - (before.RecalcStyleCount ?? 0)
  }
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-031-performance-trace.json'), JSON.stringify({ traceEvents, metadata: { performanceEvidence, metricDelta } }))
  assert(performanceEvidence.sameRoot && performanceEvidence.removedRoot === 0, 'property updates replaced the Guest preview tree')
  assert(performanceEvidence.targetedUpdates <= 3 && performanceEvidence.history <= 10, `preview burst was not rAF-batched or history exceeded 10: ${JSON.stringify(performanceEvidence)}`)
  assert(performanceEvidence.measuredFps >= 55 && performanceEvidence.p95FrameMs <= 25, `preview did not sustain the 60 FPS budget: ${JSON.stringify(performanceEvidence)}`)

  const unhandled = await evaluate(`globalThis.__phase031Unhandled ?? []`)
  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(error))
  assert(unhandled.length === 0 && seriousErrors.length === 0, `browser runtime errors: ${[...unhandled, ...seriousErrors].join(' | ')}`)

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    scope: 'Phase 031 local Professional Editor UX runtime',
    selection: selectionEvidence,
    multiSelection: multiEvidence,
    layersAndShortcuts: layerShortcutEvidence,
    inspector: inspectorEvidence,
    workspace: workspaceEvidence,
    performance: performanceEvidence,
    devToolsMetrics: metricDelta,
    traceEvents: traceEvents.length,
    screenshots: ['artifacts/phase-031-multi-selection.png', 'artifacts/phase-031-professional-editor-ux.png']
  }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* already closed */ }
  stopChildren()
  await wait(350)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }) } catch { /* Chromium may briefly retain its profile lock on Windows. */ }
}
