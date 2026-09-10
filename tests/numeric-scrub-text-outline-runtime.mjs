import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5193'
const cdpPort = 9353
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase-037b-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(`Phase 037B runtime failure: ${message}`)
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5193', '--strictPort'], {
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
  while (!page && Date.now() - targetStarted < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5193'))
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

  async function waitFor(expression, timeout = 15000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(50)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  async function selectObject(objectId, category) {
    await evaluate(`(async()=>{
      const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
      const object=editor.objects.find(candidate=>candidate.id===${JSON.stringify(objectId)});
      const section=document.querySelector('#section-select');section.value=object.section;section.dispatchEvent(new Event('change',{bubbles:true}));await tick();
      const entity=document.querySelector('#entity-select');entity.value=object.id;entity.dispatchEvent(new Event('change',{bubbles:true}));await tick();
      const group=document.querySelector('[data-property-category="${category}"]');
      if(group?.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true'){group.querySelector('.accordion-toggle').click();await tick()}
      return editor.selectedObjectId;
    })()`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(async()=>{
    const authModule=await import('/src/stores/auth.ts');
    const router=(await import('/src/router/index.ts')).default;
    authModule.useAuthStore().$patch({isAdmin:true,isInitialized:true,isLoading:false});
    await router.push({name:'admin-edit',query:{draft:'new'}});
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`)
  await wait(300)

  await selectObject('portfolio-hero', 'font')
  const scrubStart = await evaluate(`(()=>{
    const field=document.querySelector('[data-property-key="font.positionX"]');field.scrollIntoView({block:'center'});
    const button=field.querySelector('.numeric-scrub');const rect=button.getBoundingClientRect();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,value:Number(field.querySelector('input').value),history:editor.commandHistory.length,selected:editor.selectedObjectId};
  })()`)
  assert(scrubStart.selected === 'portfolio-hero', 'numeric test did not start on the selected text object')

  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: scrubStart.x, y: scrubStart.y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: scrubStart.x + 8, y: scrubStart.y, button: 'left', buttons: 1 })
  await waitFor(`Boolean(document.pointerLockElement?.classList.contains('numeric-scrub'))`)
  const lockedValue = await evaluate(`Number(document.querySelector('[data-property-key="font.positionX"] input').value)`)

  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1598, y: scrubStart.y, button: 'left', buttons: 1 })
  const edgeValue = await evaluate(`Number(document.querySelector('[data-property-key="font.positionX"] input').value)`)
  await evaluate(`document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,movementX:160,buttons:1}))`)
  const beyondEdgeValue = await evaluate(`Number(document.querySelector('[data-property-key="font.positionX"] input').value)`)
  await evaluate(`document.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,movementX:-80,buttons:1}))`)
  const reversedValue = await evaluate(`Number(document.querySelector('[data-property-key="font.positionX"] input').value)`)
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1598, y: scrubStart.y, button: 'left', buttons: 0, clickCount: 1 })
  await waitFor(`document.pointerLockElement===null && !document.documentElement.classList.contains('is-numeric-scrubbing')`)

  const scrubResult = await evaluate(`(()=>{
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const scrubbed=editor.draftSnapshot.layout['portfolio-hero'].x;const history=editor.commandHistory.length;editor.undo();
    const undone=editor.draftSnapshot.layout['portfolio-hero']?.x??0;editor.redo();const redone=editor.draftSnapshot.layout['portfolio-hero'].x;
    return {scrubbed,history,undone,redone,selected:editor.selectedObjectId};
  })()`)
  assert(lockedValue > scrubStart.value, 'Pointer Lock activation movement did not update the value')
  assert(edgeValue >= lockedValue && beyondEdgeValue > edgeValue, `relative movement stopped at the physical edge: ${JSON.stringify({ lockedValue, edgeValue, beyondEdgeValue })}`)
  assert(reversedValue < beyondEdgeValue, 'relative movement could not reverse direction')
  assert(scrubResult.history === scrubStart.history + 1, `one scrub created ${scrubResult.history - scrubStart.history} history entries`)
  assert(scrubResult.undone === scrubStart.value && scrubResult.redone === scrubResult.scrubbed && scrubResult.selected === 'portfolio-hero', `scrub Undo/Redo or selection failed: ${JSON.stringify(scrubResult)}`)

  const escapeCoordinates = await evaluate(`(()=>{const button=document.querySelector('[data-property-key="font.positionY"] .numeric-scrub');button.scrollIntoView({block:'center'});const rect=button.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2}})()`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: escapeCoordinates.x, y: escapeCoordinates.y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: escapeCoordinates.x + 8, y: escapeCoordinates.y, button: 'left', buttons: 1 })
  await waitFor(`Boolean(document.pointerLockElement?.classList.contains('numeric-scrub'))`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 })
  await waitFor(`document.pointerLockElement===null && !document.documentElement.classList.contains('is-numeric-scrubbing')`)
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: escapeCoordinates.x + 8, y: escapeCoordinates.y, button: 'left', buttons: 0, clickCount: 1 })

  await wait(1100)
  const typingAndFallback = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const xField=document.querySelector('[data-property-key="font.positionX"]');const xInput=xField.querySelector('input');const typed=17;
    xInput.value=String(typed);xInput.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const yField=document.querySelector('[data-property-key="font.positionY"]');const yInput=yField.querySelector('input');const button=yField.querySelector('.numeric-scrub');
    const before=Number(yInput.value);Object.defineProperty(button,'requestPointerLock',{configurable:true,value:()=>Promise.reject(new Error('denied for fallback test'))});
    button.dispatchEvent(new PointerEvent('pointerdown',{pointerId:77,button:0,clientX:200,bubbles:true,cancelable:true}));
    window.dispatchEvent(new PointerEvent('pointermove',{pointerId:77,button:0,clientX:240,bubbles:true,cancelable:true}));
    window.dispatchEvent(new PointerEvent('pointerup',{pointerId:77,button:0,clientX:240,bubbles:true}));await tick();delete button.requestPointerLock;
    const after=Number(yInput.value);const historyBeforeClick=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').commandHistory.length;const valueBeforeClick=Number(yInput.value);
    button.dispatchEvent(new PointerEvent('pointerdown',{pointerId:78,button:0,clientX:220,bubbles:true,cancelable:true}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:78,button:0,clientX:220,bubbles:true}));await tick();
    return {typed,canonical:document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.layout['portfolio-hero'].x,before,after,locked:Boolean(document.pointerLockElement),selected:document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').selectedObjectId,simpleClickFocused:document.activeElement===yInput,simpleClickValueStable:Number(yInput.value)===valueBeforeClick,simpleClickHistoryStable:document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').commandHistory.length===historyBeforeClick};
  })()`)
  assert(typingAndFallback.canonical === typingAndFallback.typed && typingAndFallback.after > typingAndFallback.before && !typingAndFallback.locked && typingAndFallback.selected === 'portfolio-hero', `typing/fallback behavior failed: ${JSON.stringify(typingAndFallback)}`)
  assert(typingAndFallback.simpleClickFocused && typingAndFallback.simpleClickValueStable && typingAndFallback.simpleClickHistoryStable, `simple scrub-handle click disrupted numeric editing: ${JSON.stringify(typingAndFallback)}`)

  await selectObject('portfolio-hero', 'effects')
  const outlineEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const settle=async()=>{await tick();await new Promise(resolve=>setTimeout(resolve,80));await tick()};
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const target=[...document.querySelectorAll('[data-editor-object-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    const root=target.closest('.portfolio-section');const siblings=[document.querySelector('[data-editor-object-id="profile-lisa-natalia"]'),document.querySelector('[data-editor-object-id="portfolio-profile-media"]'),root].filter(Boolean);
    const fingerprint=node=>({inline:node.getAttribute('style')||'',border:getComputedStyle(node).border,stroke:getComputedStyle(node).webkitTextStrokeWidth,rect:Object.values(node.getBoundingClientRect().toJSON()).slice(0,4)});
    const siblingBefore=siblings.map(fingerprint);const field=document.querySelector('[data-property-key="effects.border"]');const oldCanonical=editor.draftSnapshot.backgrounds['portfolio-hero']?.border??'';const historyBefore=editor.commandHistory.length;
    const toggle=field.querySelector('input[type="checkbox"]');if(!toggle.checked){toggle.click();await settle()}
    const thickness=field.querySelector('.border-grid input[type="number"]');thickness.value='3';thickness.dispatchEvent(new Event('input',{bubbles:true}));await settle();
    const colorSummary=field.querySelector('.color-summary');colorSummary.click();await settle();const hex=field.querySelector('.picker-head input:not([type="color"])');hex.value='#b85b69';hex.dispatchEvent(new Event('change',{bubbles:true}));await settle();colorSummary.click();await settle();
    const style=getComputedStyle(target);const canonical=editor.draftSnapshot.backgrounds['portfolio-hero']?.border;const siblingAfter=siblings.map(fingerprint);const historyAfter=editor.commandHistory.length;
    const after={borderStyle:style.borderTopStyle,borderWidth:style.borderTopWidth,strokeWidth:style.webkitTextStrokeWidth,strokeColor:style.webkitTextStrokeColor,paintOrder:style.paintOrder,inline:target.getAttribute('style')||'',selectionOutline:style.outlineStyle};
    editor.undo();await settle();const undo={canonical:editor.draftSnapshot.backgrounds['portfolio-hero']?.border??'',stroke:getComputedStyle(target).webkitTextStrokeWidth,border:getComputedStyle(target).borderTopStyle};
    editor.redo();await settle();const redo={canonical:editor.draftSnapshot.backgrounds['portfolio-hero']?.border??'',stroke:getComputedStyle(target).webkitTextStrokeWidth,border:getComputedStyle(target).borderTopStyle};
    const model=await import('/src/editor/editorSnapshot.ts');const serialized=model.serializeEditorSnapshot(editor.draftSnapshot);const restored=model.deserializeEditorSnapshot(serialized);
    return {label:field.closest('.property-field').querySelector(':scope > span').textContent.trim(),styleSelector:Boolean(field.querySelector('select[aria-label="Border style"]')),oldCanonical,canonical,historyBefore,historyAfter,after,undo,redo,restoredCanonical:restored.backgrounds['portfolio-hero']?.border,siblingStable:JSON.stringify(siblingBefore)===JSON.stringify(siblingAfter),selected:editor.selectedObjectId};
  })()`)
  assert(outlineEvidence.label === 'Text Outline' && !outlineEvidence.styleSelector, `Text outline UI is incorrect: ${JSON.stringify(outlineEvidence)}`)
  assert(outlineEvidence.canonical === '3px solid #b85b69' && outlineEvidence.restoredCanonical === outlineEvidence.canonical, 'Text outline did not reuse/round-trip the canonical border property')
  assert(outlineEvidence.after.borderStyle === 'none' && outlineEvidence.after.strokeWidth === '3px' && /184, 91, 105/.test(outlineEvidence.after.strokeColor), `text rendered a box border or missed glyph stroke: ${JSON.stringify(outlineEvidence.after)}`)
  assert(outlineEvidence.after.selectionOutline !== 'none' && outlineEvidence.siblingStable && outlineEvidence.selected === 'portfolio-hero', `selection outline separation or object isolation failed: ${JSON.stringify(outlineEvidence)}`)
  assert(outlineEvidence.historyAfter === outlineEvidence.historyBefore + 1 && outlineEvidence.undo.canonical === outlineEvidence.oldCanonical && outlineEvidence.redo.canonical === outlineEvidence.canonical && outlineEvidence.redo.stroke === '3px' && outlineEvidence.redo.border === 'none', `Text Outline Undo/Redo failed: ${JSON.stringify(outlineEvidence)}`)

  const responsiveOutlineEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const settle=async()=>{await tick();await new Promise(resolve=>setTimeout(resolve,70));await tick()};
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const responsive=await import('/src/editor/responsiveLayout.ts');const target=[...document.querySelectorAll('[data-editor-object-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];const root=document.querySelector('.editor-preview-runtime');
    const preset=async id=>{document.querySelector('[data-canvas-preset="'+id+'"]').click();await settle()};const thickness=()=>document.querySelector('[data-property-key="effects.border"] .border-grid input[type="number"]');
    const baseBefore=editor.draftSnapshot.backgrounds['portfolio-hero'].border;const overrideId=responsive.responsiveSnapshotEntityId('laptop','portfolio-hero');await preset('laptop-1024');const input=thickness();input.value='5';input.dispatchEvent(new Event('input',{bubbles:true}));await settle();const command=editor.commandHistory.at(-1);const tablet={base:editor.draftSnapshot.backgrounds['portfolio-hero'].border,override:editor.draftSnapshot.backgrounds[overrideId]?.border,stroke:getComputedStyle(target).webkitTextStrokeWidth};
    await preset('desktop-1440');const desktop={override:editor.draftSnapshot.backgrounds[overrideId]?.border,stroke:getComputedStyle(target).webkitTextStrokeWidth};editor.undo();await settle();await preset('laptop-1024');const undo={override:editor.draftSnapshot.backgrounds[overrideId]?.border,stroke:getComputedStyle(target).webkitTextStrokeWidth};editor.redo();await settle();const redo={override:editor.draftSnapshot.backgrounds[overrideId]?.border,stroke:getComputedStyle(target).webkitTextStrokeWidth};editor.undo();await settle();await preset('desktop-1440');
    return {baseBefore,tablet,desktop,undo,redo,command:{entityId:command?.entityId,path:command?.propertyPath},selected:editor.selectedObjectId,rootStable:root===document.querySelector('.editor-preview-runtime')};
  })()`)
  assert(responsiveOutlineEvidence.tablet.base === responsiveOutlineEvidence.baseBefore && responsiveOutlineEvidence.tablet.override === '5px solid #b85b69' && responsiveOutlineEvidence.tablet.stroke === '5px', `Tablet Text Outline did not remain a sparse override: ${JSON.stringify(responsiveOutlineEvidence)}`)
  assert(responsiveOutlineEvidence.desktop.stroke === '3px' && responsiveOutlineEvidence.desktop.override === '5px solid #b85b69', `Desktop Text Outline was overwritten by Tablet: ${JSON.stringify(responsiveOutlineEvidence)}`)
  assert(responsiveOutlineEvidence.undo.override === undefined && responsiveOutlineEvidence.undo.stroke === '3px' && responsiveOutlineEvidence.redo.stroke === '5px' && /backgrounds\.rwd-laptop-.+\.border$/.test(responsiveOutlineEvidence.command.path ?? '') && responsiveOutlineEvidence.command.entityId === 'portfolio-hero' && responsiveOutlineEvidence.selected === 'portfolio-hero' && responsiveOutlineEvidence.rootStable, `responsive Text Outline Undo/Redo or isolation failed: ${JSON.stringify(responsiveOutlineEvidence)}`)

  const semanticRuntimeEvidence = await evaluate(`(async()=>{
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const runtime=await import('/src/runtime/publishedSnapshotDom.ts');const presentation=await import('/src/editor/inspectorPresentation.ts');const registry=await import('/src/editor/propertyRegistry.ts');
    const property=registry.propertyRegistry.find(item=>item.propertyKey==='effects.border');const mediaProperty=registry.propertyRegistry.find(item=>item.propertyKey==='media.border');const cases=[
      {id:'phase037b-text',kind:'text',type:'Text',markup:'<div data-editor-object-id="phase037b-text"><h2 data-editor-object-id="phase037b-text">Outlined text</h2></div>',selector:'h2'},
      {id:'phase037b-image',kind:'media',type:'Image',markup:'<figure data-editor-object-id="phase037b-image"><img data-editor-object-id="phase037b-image" alt=""></figure>',selector:'img'},
      {id:'phase037b-button',kind:'button',type:'Button',markup:'<div data-editor-object-id="phase037b-button"><button data-editor-object-id="phase037b-button">Button</button></div>',selector:'button'},
      {id:'phase037b-container',kind:'container',type:'Container',markup:'<section data-editor-object-id="phase037b-container"><span>Child</span></section>',selector:'section'}
    ];const results=[];
    for(const fixture of cases){const host=document.createElement('div');host.className='guest-home';host.style.cssText='position:fixed;left:-3000px;top:0';host.innerHTML=fixture.markup;document.body.append(host);const snapshot=JSON.parse(JSON.stringify(editor.draftSnapshot));snapshot.entities.push({entityId:fixture.id,section:'Fixture',kind:fixture.kind,label:fixture.type});snapshot.backgrounds[fixture.id]={border:'2px solid #b85b69'};if(fixture.type==='Image')snapshot.media.styles[fixture.id]={outlineEnabled:true,outlineWidth:2};runtime.applyPublishedSnapshotDom(host,snapshot);const node=host.querySelector(fixture.selector);const style=getComputedStyle(node);const ui=presentation.resolveInspectorPresentation(fixture.type==='Image'?mediaProperty:property,fixture.type);results.push({type:fixture.type,label:ui.label,textOutline:ui.controlOptions?.textOutline===true,border:style.borderTopStyle,borderWidth:style.borderTopWidth,stroke:style.webkitTextStrokeWidth,filter:style.filter,alphaRadius:host.querySelector('feMorphology')?.getAttribute('radius')??null});host.remove()}
    return results;
  })()`)
  const textRuntime = semanticRuntimeEvidence.find((item) => item.type === 'Text')
  assert(textRuntime.label === 'Text Outline' && textRuntime.textOutline && textRuntime.border === 'none' && textRuntime.stroke === '2px', `Published Text semantic failed: ${JSON.stringify(textRuntime)}`)
  const imageRuntime = semanticRuntimeEvidence.find((item) => item.type === 'Image')
  assert(imageRuntime.label === 'Outline Color' && !imageRuntime.textOutline && imageRuntime.borderWidth === '0px' && /url\(/.test(imageRuntime.filter) && imageRuntime.alphaRadius === '2', `Image alpha-outline semantic failed: ${JSON.stringify(imageRuntime)}`)
  for (const type of ['Button', 'Container']) {
    const item = semanticRuntimeEvidence.find((candidate) => candidate.type === type)
    assert(item.label === 'Border' && !item.textOutline && item.border === 'solid' && item.borderWidth === '2px' && item.stroke === '0px', `${type} box-border semantics changed: ${JSON.stringify(item)}`)
  }

  const numericCoverageEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const settle=async()=>{await tick();await new Promise(resolve=>setTimeout(resolve,40));await tick()};
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const select=async(id,category)=>{const object=editor.objects.find(candidate=>candidate.id===id);const section=document.querySelector('#section-select');section.value=object.section;section.dispatchEvent(new Event('change',{bubbles:true}));await settle();const entity=document.querySelector('#entity-select');entity.value=id;entity.dispatchEvent(new Event('change',{bubbles:true}));await settle();const group=document.querySelector('[data-property-category="'+category+'"]');if(group?.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true'){group.querySelector('.accordion-toggle').click();await settle()}};
    const cases=[
      {name:'Opacity',id:'portfolio-hero',category:'effects',key:'effects.opacity',movement:-40},
      {name:'X',id:'portfolio-hero',category:'font',key:'font.positionX',movement:40},
      {name:'Y',id:'portfolio-hero',category:'font',key:'font.positionY',movement:40},
      {name:'Width',id:'portfolio-profile-media',category:'media',key:'media.width',movement:40},
      {name:'Height',id:'portfolio-profile-media',category:'media',key:'media.height',movement:40},
      {name:'Rotate',id:'portfolio-hero',category:'font',key:'font.rotate',movement:40},
      {name:'Blur',id:'portfolio-hero',category:'effects',key:'effects.blur',movement:40},
      {name:'Font Size',id:'portfolio-hero',category:'font',key:'font.size',movement:40},
      {name:'Border Thickness',id:'portfolio-hero',category:'effects',key:'effects.border',movement:40,nested:true}
    ];const results=[];
    for(const item of cases){await select(item.id,item.category);if(item.nested)await new Promise(resolve=>setTimeout(resolve,1100));const field=document.querySelector('[data-property-key="'+item.key+'"]');const input=item.nested?field?.querySelector('.border-grid input[type="number"]'):field?.querySelector('input[type="number"]');const button=item.nested?field?.querySelector('.border-grid .numeric-scrub'):field?.querySelector('.numeric-scrub');if(!input||!button){results.push({...item,available:false});continue}const before=Number(input.value);const historyBefore=editor.commandHistory.length;Object.defineProperty(button,'requestPointerLock',{configurable:true,value:()=>Promise.reject(new Error('coverage fallback'))});button.dispatchEvent(new PointerEvent('pointerdown',{pointerId:90,button:0,clientX:300,bubbles:true,cancelable:true}));window.dispatchEvent(new PointerEvent('pointermove',{pointerId:90,button:0,clientX:300+item.movement,bubbles:true,cancelable:true}));window.dispatchEvent(new PointerEvent('pointerup',{pointerId:90,button:0,clientX:300+item.movement,bubbles:true}));await settle();delete button.requestPointerLock;const after=Number(input.value);const historyAfter=editor.commandHistory.length;const command=editor.commandHistory.at(-1);editor.undo();await settle();const restored=Number(document.querySelector('[data-property-key="'+item.key+'"] '+(item.nested?'.border-grid ':'')+'input[type="number"]').value);results.push({...item,available:true,before,after,restored,historyDelta:historyAfter-historyBefore,commandEntity:command?.entityId,commandPath:command?.propertyPath,selected:editor.selectedObjectId})}
    return results;
  })()`)
  for (const item of numericCoverageEvidence) {
    assert(item.available && item.after !== item.before && item.restored === item.before, `${item.name} shared scrub/Undo coverage failed: ${JSON.stringify(item)}`)
    assert(item.historyDelta === 1 && item.commandEntity === item.id && item.selected === item.id, `${item.name} scrub command targeting failed: ${JSON.stringify(item)}`)
  }

  await selectObject('portfolio-hero', 'effects')
  await evaluate(`document.querySelector('.tbar-save').click()`)
  await waitFor(`document.querySelector('.editor-save-status')?.textContent.trim()==='Saved'`)
  const draftSaveEvidence = await evaluate(`(async()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const repo=await import('/src/repositories/editorRevisionRepository.ts');return {id:editor.draftRevisionId,count:await repo.editorDraftRepository.countDrafts(),border:editor.draftSnapshot.backgrounds['portfolio-hero']?.border,y:editor.draftSnapshot.layout['portfolio-hero']?.y}})()`)
  assert(draftSaveEvidence.id && draftSaveEvidence.count === 1 && draftSaveEvidence.border === '3px solid #b85b69' && draftSaveEvidence.y === 12, `Save Draft missed Text Outline or scrubbed numeric value: ${JSON.stringify(draftSaveEvidence)}`)
  await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');await router.push({name:'admin-dashboard'});await new Promise(resolve=>requestAnimationFrame(resolve));await router.push({name:'admin-edit',query:{draft:editor.draftRevisionId}});return true})()`)
  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.backgrounds['portfolio-hero']?.border==='3px solid #b85b69'`)
  const draftReloadEvidence = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const target=[...document.querySelectorAll('[data-editor-object-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];const style=getComputedStyle(target);return {id:editor.draftRevisionId,border:editor.draftSnapshot.backgrounds['portfolio-hero']?.border,y:editor.draftSnapshot.layout['portfolio-hero']?.y,stroke:style.webkitTextStrokeWidth,boxBorder:style.borderTopStyle,selected:editor.selectedObjectId}})()`)
  assert(draftReloadEvidence.id === draftSaveEvidence.id && draftReloadEvidence.border === draftSaveEvidence.border && draftReloadEvidence.y === draftSaveEvidence.y && draftReloadEvidence.stroke === '3px' && draftReloadEvidence.boxBorder === 'none' && draftReloadEvidence.selected === 'portfolio-hero', `Draft route reload did not restore Text Outline/scrub state: ${JSON.stringify(draftReloadEvidence)}`)

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  await selectObject('portfolio-hero', 'effects')
  await evaluate(`(()=>{const field=document.querySelector('[data-property-key="effects.border"]');field.scrollIntoView({block:'center'});document.querySelector('.control-panel').scrollTop=Math.max(0,field.offsetTop-180);return true})()`)
  await wait(150)
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-037b-text-outline.png'), Buffer.from(screenshot.data, 'base64'))

  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
  assert(seriousErrors.length === 0, `unexpected browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)
  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    scope: 'Phase 037B numeric Pointer Lock scrub and semantic Text Outline',
    scrub: { start: scrubStart.value, locked: lockedValue, edge: edgeValue, beyondEdge: beyondEdgeValue, reversed: reversedValue, fallback: typingAndFallback },
    numericCoverage: numericCoverageEvidence,
    textOutline: outlineEvidence,
    responsiveTextOutline: responsiveOutlineEvidence,
    draftRoundTrip: { saved: draftSaveEvidence, reloaded: draftReloadEvidence },
    publishedSemantics: semanticRuntimeEvidence,
    screenshot: 'artifacts/phase-037b-text-outline.png'
  }, null, 2)}\n`)
} finally {
  socket?.close()
  stopChildren()
  await wait(150)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* Chromium may briefly retain its profile lock. */ }
}
