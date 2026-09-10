import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5183'
const cdpPort = 9343
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase033-chrome-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(`Phase 033 runtime failure: ${message}`)
}

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
    try { const response = await fetch(url); if (response.ok) return response.json() } catch { /* Chromium is starting. */ }
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5183', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5183'))
    if (!page) await wait(100)
  }
  if (!page) throw new Error('Phase 033 browser target not found.')

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
      await wait(60)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Performance.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  await evaluate(`(()=>{globalThis.__phase033Unhandled=[];addEventListener('unhandledrejection',(event)=>globalThis.__phase033Unhandled.push(String(event.reason?.stack??event.reason)));return true})()`)

  try {
    await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
    await evaluate(`(async()=>{const auth=(await import('/src/stores/auth.ts')).useAuthStore();const router=(await import('/src/router/index.ts')).default;auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});await router.push('/admin/edit');return true})()`)
    await waitFor(`Boolean(document.querySelector('.edit-page'))&&!document.querySelector('.editor-recovery')&&Boolean(document.querySelector('[data-canvas-preset="laptop-1024"]'))&&Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`)
  } catch (error) {
    const diagnostics = await evaluate(`({url:location.href,body:document.body.innerText.slice(0,3000),recovery:document.querySelector('.editor-recovery')?.innerText})`)
    throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}; vite=${viteErrors}; browser=${browserErrors}; runtime=${runtimeErrors.join(' | ')}`)
  }

  const canvasEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const root=document.querySelector('.guest-home');root.dataset.phase033Identity='stable';
    const widths={};for(const id of ['desktop-1440','laptop-1024']){document.querySelector('[data-canvas-preset="'+id+'"]').click();await tick();widths[id]=document.querySelector('.preview-stage').style.width;}
    const buttons=[...document.querySelectorAll('[data-canvas-preset]')];const checked=buttons.filter(button=>button.getAttribute('aria-checked')==='true').length;
    buttons[0].focus();buttons[0].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await tick();const keyboardPreset=document.activeElement?.dataset.canvasPreset;const focus=getComputedStyle(document.activeElement);
    const responsive=await import('/src/editor/responsiveLayout.ts');return {widths,sameRoot:root===document.querySelector('.guest-home')&&root.dataset.phase033Identity==='stable',checked,keyboardPreset,focusVisible:focus.outlineStyle!=='none'&&Number.parseFloat(focus.outlineWidth)>0,labels:buttons.map(button=>button.getAttribute('aria-label')),breakpoint:document.querySelector('.preview-stage').dataset.responsiveBreakpoint,internalPresets:responsive.responsiveCanvasPresets.map(item=>item.id)};
  })()`)
  assert(canvasEvidence.sameRoot && canvasEvidence.checked === 1 && canvasEvidence.keyboardPreset === 'laptop-1024' && canvasEvidence.focusVisible, `canvas identity or keyboard accessibility failed: ${JSON.stringify(canvasEvidence)}`)
  assert(JSON.stringify(canvasEvidence.widths) === JSON.stringify({ 'desktop-1440': '1440px', 'laptop-1024': '1024px' }), `user-facing canvas widths failed: ${JSON.stringify(canvasEvidence.widths)}`)
  assert(JSON.stringify(canvasEvidence.labels) === JSON.stringify(['Desktop','Tablet Landscape']) && ['desktop-1440','desktop-1280','laptop-1024','tablet-768','mobile-390'].every((id) => canvasEvidence.internalPresets.includes(id)), 'simple viewport UI or internal breakpoint registry is incomplete')

  const overrideEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const waitFrames=async()=>{await tick();await tick()};
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    const clickPreset=async(id)=>{document.querySelector('[data-canvas-preset="'+id+'"]').click();await waitFrames()};
    const open=async(category)=>{const button=document.querySelector('[data-property-category="'+category+'"] .accordion-toggle');if(button?.getAttribute('aria-expanded')!=='true')button?.click();await tick()};
    const setInput=async(selector,value)=>{const input=document.querySelector(selector);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));await waitFrames();return input};
    const id='portfolio-hero';smallest(id).click();await tick();const selectedBefore=editor.selectedObjectId;const baseBefore=JSON.stringify(editor.draftSnapshot.typography[id]??{});
    await clickPreset('desktop-1440');await open('font');const desktopValue=document.querySelector('[data-property-key="font.size"] input').value;
    await clickPreset('laptop-1024');await open('font');const inheritedValue=document.querySelector('[data-property-key="font.size"] input').value;const inheritedSource=document.querySelector('[data-property-key="font.size"]').closest('.property-field').dataset.responsiveSource;await setInput('[data-property-key="font.size"] input','44');
    const laptopRecord=Object.entries(editor.draftSnapshot.typography).find(([key,value])=>key.startsWith('rwd-laptop-')&&value.fontSize==='44px');
    const overrideSource=document.querySelector('[data-property-key="font.size"]').closest('.property-field').dataset.responsiveSource;const computedTablet=getComputedStyle(smallest(id)).fontSize;const resetVisible=Boolean(document.querySelector('[aria-label="Use Desktop value for Size"]'));
    editor.undo();await waitFrames();const undoValue=document.querySelector('[data-property-key="font.size"] input').value;editor.redo();await waitFrames();const redoValue=document.querySelector('[data-property-key="font.size"] input').value;
    const snapshotModule=await import('/src/editor/editorSnapshot.ts');const serialized=snapshotModule.serializeEditorSnapshot(editor.draftSnapshot);const restored=snapshotModule.deserializeEditorSnapshot(serialized);const roundTrip=Object.values(restored.typography).some(value=>value.fontSize==='44px');
    document.querySelector('[aria-label="Use Desktop value for Size"]').click();await waitFrames();const resetValue=document.querySelector('[data-property-key="font.size"] input').value;const resetSource=document.querySelector('[data-property-key="font.size"]').closest('.property-field').dataset.responsiveSource;
    return {selectedBefore,selectedAfter:editor.selectedObjectId,baseUnchanged:JSON.stringify(editor.draftSnapshot.typography[id]??{})===baseBefore,laptopRecord:Boolean(laptopRecord),desktopValue,inheritedValue,inheritedSource,overrideSource,computedTablet,resetVisible,undoValue,redoValue,resetValue,resetSource,roundTrip,history:editor.commandHistory.length,dirty:editor.hasUnsavedChanges};
  })()`)
  assert(overrideEvidence.selectedBefore === 'portfolio-hero' && overrideEvidence.selectedAfter === 'portfolio-hero' && overrideEvidence.baseUnchanged, `selection or base independence failed: ${JSON.stringify(overrideEvidence)}`)
  assert(overrideEvidence.laptopRecord && overrideEvidence.inheritedSource === 'Using Desktop value' && overrideEvidence.inheritedValue === overrideEvidence.desktopValue, `sparse inheritance failed: ${JSON.stringify(overrideEvidence)}`)
  assert(overrideEvidence.overrideSource === 'Tablet value' && overrideEvidence.computedTablet === '44px' && overrideEvidence.resetVisible && overrideEvidence.undoValue === overrideEvidence.inheritedValue && overrideEvidence.redoValue === '44' && overrideEvidence.resetValue === overrideEvidence.inheritedValue && overrideEvidence.resetSource === 'Using Desktop value', `override/undo/reset live Preview failed: ${JSON.stringify(overrideEvidence)}`)
  assert(overrideEvidence.roundTrip && overrideEvidence.history <= 10 && overrideEvidence.dirty, `serialization or command history failed: ${JSON.stringify(overrideEvidence)}`)

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  const mobileShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-033-tablet-responsive-editor.png'), Buffer.from(mobileShot.data, 'base64'))
  await evaluate(`(async()=>{const group=document.querySelector('[data-property-category="layout"]');const button=group?.querySelector('.accordion-toggle');if(button?.getAttribute('aria-expanded')!=='true')button?.click();await new Promise(resolve=>setTimeout(resolve,240));group?.scrollIntoView({block:'start'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true})()`)
  const inspectorShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-033-responsive-inspector.png'), Buffer.from(inspectorShot.data, 'base64'))

  const engineEvidence = await evaluate(`(async()=>{
    const responsive=await import('/src/editor/responsiveLayout.ts');const snapshotModule=await import('/src/editor/editorSnapshot.ts');const defaults=await import('/src/data/default/site.ts');
    const snapshot=snapshotModule.createEditorSnapshot(defaults.createDefaultSiteSnapshot());const write=(path,value)=>{const keys=path.split('.');const leaf=keys.pop();const parent=keys.reduce((current,key)=>(current[key]??={}),snapshot);if(value===undefined)delete parent[leaf];else parent[leaf]=structuredClone(value)};
    const descriptor={entityId:'phase33-container',section:'Test',label:'Container',kind:'container',objectType:'Container',layerId:'test/container',parentLayerId:'test',capabilities:['container','layout','position'],propertyValues:{}};
    const properties=responsive.resolveResponsiveLayoutProperties(descriptor,'mobile');const byKey=Object.fromEntries(properties.map(property=>[property.metadata.propertyKey,property]));const set=(key,value,breakpoint='mobile')=>responsive.responsiveLayoutPropertyChanges(byKey[key],descriptor.entityId,breakpoint,value).forEach(change=>write(change.propertyPath,change.nextValue));
    set('responsive.container.mode','row');set('responsive.container.wrap',true);set('responsive.container.gap',24);set('responsive.container.padding','12px');set('responsive.container.align','center');set('responsive.container.justify','space-between');set('responsive.safeArea',true);set('responsive.visibility','all');
    const root=document.createElement('div');const element=document.createElement('div');element.dataset.editorObjectId=descriptor.entityId;element.append(document.createElement('span'),document.createElement('span'));root.append(element);document.body.append(root);responsive.applyResponsiveObjectProperties(root,snapshot,descriptor,'mobile');
    const row={display:element.style.display,direction:element.style.flexDirection,wrap:element.style.flexWrap,gap:element.style.gap,padding:element.style.padding,align:element.style.alignItems,justify:element.style.justifyContent,safe:element.classList.contains('editor-mobile-safe-area')};
    responsive.restoreResponsiveObjectProperties(root,descriptor.entityId);set('responsive.container.mode','grid');set('responsive.grid.columns',3);set('responsive.grid.rows',2);set('responsive.grid.gap',16);set('responsive.grid.alignment','center');set('responsive.grid.collapse',true);responsive.applyResponsiveObjectProperties(root,snapshot,descriptor,'mobile');
    const grid={display:element.style.display,columns:element.style.gridTemplateColumns,rows:element.style.gridTemplateRows,gap:element.style.gap,place:element.style.placeItems};
    const child={...descriptor,entityId:'phase33-child',label:'Child',objectType:'Text',kind:'text',capabilities:['layout','position'],propertyValues:{}};const childProperties=responsive.resolveResponsiveLayoutProperties(child,'mobile');const childByKey=Object.fromEntries(childProperties.map(property=>[property.metadata.propertyKey,property]));const setChild=(key,value,breakpoint='mobile')=>responsive.responsiveLayoutPropertyChanges(childByKey[key],child.entityId,breakpoint,value).forEach(change=>write(change.propertyPath,change.nextValue));
    setChild('responsive.grid.columnSpan',2);setChild('responsive.grid.rowSpan',3);setChild('responsive.flex.grow',2);setChild('responsive.flex.shrink',0);setChild('responsive.flex.basis','50%');setChild('responsive.flex.alignSelf','center');setChild('responsive.flex.justifySelf','end');setChild('responsive.constraint.horizontal','right');setChild('responsive.constraint.vertical','bottom');setChild('responsive.visibility','mobile');
    const childElement=document.createElement('div');childElement.dataset.editorObjectId=child.entityId;root.append(childElement);responsive.applyResponsiveObjectProperties(root,snapshot,child,'mobile');const childMobile={column:childElement.style.gridColumn,row:childElement.style.gridRow,grow:childElement.style.flexGrow,shrink:childElement.style.flexShrink,basis:childElement.style.flexBasis,align:childElement.style.alignSelf,justify:childElement.style.justifySelf,right:childElement.classList.contains('editor-constraint-x-right'),bottom:childElement.classList.contains('editor-constraint-y-bottom'),display:childElement.style.display};responsive.restoreResponsiveObjectProperties(root,child.entityId);responsive.applyResponsiveObjectProperties(root,snapshot,child,'desktop');const desktopHidden=childElement.style.display==='none';
    const cloneChanges=responsive.cloneResponsiveObjectChanges(snapshot,child.entityId,'phase33-child-copy');cloneChanges.forEach(change=>write(change.propertyPath,change.nextValue));const cloneHasData=responsive.objectHasResponsiveData(snapshot,'phase33-child-copy');const removeChanges=responsive.removeResponsiveObjectChanges(snapshot,child.entityId);removeChanges.forEach(change=>write(change.propertyPath,change.nextValue));const sourceRemoved=!responsive.objectHasResponsiveData(snapshot,child.entityId);const valid=snapshotModule.serializeEditorSnapshot(snapshot).length>0;root.remove();return {row,grid,childMobile,desktopHidden,valid,cloneHasData,sourceRemoved,metadataCount:responsive.responsiveLayoutRegistry.length,controls:[...new Set(responsive.responsiveLayoutRegistry.map(property=>property.metadata.control))]};
  })()`)
  assert(engineEvidence.row.display === 'flex' && engineEvidence.row.direction === 'row' && engineEvidence.row.wrap === 'wrap' && engineEvidence.row.gap === '24px' && engineEvidence.row.padding === '12px' && engineEvidence.row.align === 'center' && engineEvidence.row.justify === 'space-between' && engineEvidence.row.safe, `auto layout engine failed: ${JSON.stringify(engineEvidence.row)}`)
  assert(engineEvidence.grid.display === 'grid' && engineEvidence.grid.columns.includes('1fr') && engineEvidence.grid.rows.includes('repeat(2') && engineEvidence.grid.gap === '16px' && engineEvidence.grid.place === 'center', `grid/collapse engine failed: ${JSON.stringify(engineEvidence.grid)}`)
  assert(engineEvidence.childMobile.column === 'span 2' && engineEvidence.childMobile.row === 'span 3' && engineEvidence.childMobile.grow === '2' && engineEvidence.childMobile.shrink === '0' && engineEvidence.childMobile.basis === '50%' && engineEvidence.childMobile.align === 'center' && engineEvidence.childMobile.justify === 'end' && engineEvidence.childMobile.right && engineEvidence.childMobile.bottom && engineEvidence.childMobile.display !== 'none' && engineEvidence.desktopHidden && engineEvidence.valid && engineEvidence.cloneHasData && engineEvidence.sourceRemoved, `flex/constraints/visibility persistence failed: ${JSON.stringify(engineEvidence.childMobile)}`)
  assert(engineEvidence.metadataCount >= 23 && ['segmented','checkbox','number','text','select'].every((control) => engineEvidence.controls.includes(control)), `metadata-driven responsive registry is incomplete: ${JSON.stringify(engineEvidence)}`)

  const beforeMetrics = await send('Performance.getMetrics')
  const performanceEvidence = await evaluate(`(async()=>{const buttons=[...document.querySelectorAll('[data-canvas-preset]')];const root=document.querySelector('.guest-home');const countBefore=Number(document.querySelector('.performance-status').dataset.previewUpdateCount??0);const started=performance.now();for(let index=0;index<36;index+=1){buttons[index%buttons.length].click();await new Promise(resolve=>requestAnimationFrame(resolve));}await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const duration=performance.now()-started;const frames=[];for(let index=0;index<61;index+=1)frames.push(await new Promise(resolve=>requestAnimationFrame(resolve)));const intervals=frames.slice(1).map((value,index)=>value-frames[index]).sort((a,b)=>a-b);const average=intervals.reduce((sum,value)=>sum+value,0)/intervals.length;const p95=intervals[Math.floor(intervals.length*.95)]??0;return {sameRoot:root===document.querySelector('.guest-home'),duration,averageFrameMs:average,p95FrameMs:p95,fps:1000/average,targetedUpdates:Number(document.querySelector('.performance-status').dataset.previewUpdateCount??0)-countBefore};})()`)
  const afterMetrics = await send('Performance.getMetrics')
  const metricMap = (result) => Object.fromEntries(result.metrics.map((metric) => [metric.name, metric.value]))
  const before = metricMap(beforeMetrics); const after = metricMap(afterMetrics)
  const performanceMetrics = { scriptSeconds: Number(((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)).toFixed(5)), layouts: (after.LayoutCount ?? 0) - (before.LayoutCount ?? 0), styleRecalcs: (after.RecalcStyleCount ?? 0) - (before.RecalcStyleCount ?? 0) }
  assert(performanceEvidence.sameRoot && performanceEvidence.fps >= 55 && performanceEvidence.p95FrameMs <= 26 && performanceEvidence.targetedUpdates <= 38, `responsive Preview performance failed: ${JSON.stringify(performanceEvidence)}`)

  const desktopButton = await evaluate(`(async()=>{document.querySelector('[data-canvas-preset="desktop-1440"]').click();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true})()`)
  assert(desktopButton, 'desktop screenshot preparation failed')
  const desktopShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-033-desktop-responsive-editor.png'), Buffer.from(desktopShot.data, 'base64'))

  const unhandled = await evaluate(`globalThis.__phase033Unhandled??[]`)
  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(error))
  assert(unhandled.length === 0 && seriousErrors.length === 0, `browser runtime errors: ${[...unhandled, ...seriousErrors].join(' | ')}`)

  process.stdout.write(`${JSON.stringify({ status: 'PASS', scope: 'Phase 033 local Responsive Layout Editor runtime', canvas: canvasEvidence, overrides: overrideEvidence, engine: engineEvidence, performance: performanceEvidence, devToolsMetrics: performanceMetrics, screenshots: ['artifacts/phase-033-mobile-responsive-editor.png','artifacts/phase-033-responsive-inspector.png','artifacts/phase-033-desktop-responsive-editor.png'] }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* already closed */ }
  stopChildren()
  await wait(350)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }) } catch { /* Chromium may briefly retain its profile lock. */ }
}
