import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5186'
const cdpPort = 9346
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase035-chrome-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(`Phase 035 runtime failure: ${message}`)
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
  for (const child of children.reverse()) {
    if (!child.killed) child.kill()
    child.stdout?.destroy()
    child.stderr?.destroy()
  }
}

process.on('exit', stopChildren)
process.on('SIGINT', () => { stopChildren(); process.exit(130) })

let socket
try {
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5186', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5186'))
    if (!page) await wait(100)
  }
  if (!page) throw new Error('Phase 035 browser target not found.')

  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  const consoleWarnings = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
    if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) consoleWarnings.push(message.params.args.map((entry) => entry.value ?? entry.description ?? '').join(' '))
  })

  function send(method, params = {}) {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP request timed out: ${method}`)) }, 30000)
      pending.set(id, { resolve(value) { clearTimeout(timer); resolve(value) }, reject(error) { clearTimeout(timer); reject(error) } })
    })
  }

  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
    return response.result.value
  }

  async function waitFor(expression, timeout = 20000) {
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
  try {
    await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
    await evaluate(`(()=>{globalThis.__phase035Unhandled=[];addEventListener('unhandledrejection',(event)=>globalThis.__phase035Unhandled.push(String(event.reason?.stack??event.reason)));return true})()`)
    await evaluate(`(async()=>{const auth=(await import('/src/stores/auth.ts')).useAuthStore();const router=(await import('/src/router/index.ts')).default;auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});await router.push('/admin/edit');return true})()`)
    await waitFor(`Boolean(document.querySelector('.edit-page'))&&!document.querySelector('.editor-recovery')&&Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`)
  } catch (error) {
    const diagnostics = await evaluate(`({url:location.href,body:document.body.innerText.slice(0,4000),recovery:document.querySelector('.editor-recovery')?.innerText})`)
    throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}; vite=${viteErrors}; browser=${browserErrors}; runtime=${runtimeErrors.join(' | ')}`)
  }

  const registryEvidence = await evaluate(`(async()=>{
    const animation=await import('/src/editor/animationRegistry.ts');const objects=await import('/src/editor/objectRegistry.ts');const properties=await import('/src/editor/propertyRegistry.ts');
    const encoded=animation.encodeAnimationConfiguration({...animation.defaultAnimationConfiguration(),entrance:'blur-in',hover:'glow',click:'ripple',scroll:'parallax',text:'character',loop:true,playOnce:false,direction:'alternate',fillMode:'forwards',scrollPlayback:'replay',scrollOffset:120,scrollThreshold:.25,timelineMode:'sequential',timelineDelay:80});const decoded=animation.decodeAnimationConfiguration(encoded);
    return {entrance:animation.entranceEffectRegistry.map(item=>item.id),hover:animation.hoverEffectRegistry.map(item=>item.id),click:animation.clickEffectRegistry.map(item=>item.id),scroll:animation.scrollEffectRegistry.map(item=>item.id),text:animation.textEffectRegistry.map(item=>item.id),presets:animation.animationPresetRegistry.map(item=>item.id),encodedLength:encoded.length,decoded,animationProperties:properties.propertyRegistry.filter(item=>item.category==='animation').map(item=>({key:item.propertyKey,control:item.control,field:item.animationField})),objectTypes:objects.listEditorObjectTypes().map(item=>({type:item.type,animation:item.capabilities.includes('animation'),text:item.capabilities.includes('text-animation')}))};
  })()`)
  assert(registryEvidence.entrance.length === 9 && registryEvidence.hover.length === 8 && registryEvidence.click.length === 5 && registryEvidence.scroll.length === 5 && registryEvidence.text.length === 4 && registryEvidence.presets.length === 6, `effect registry incomplete: ${JSON.stringify(registryEvidence)}`)
  assert(registryEvidence.encodedLength <= 128 && registryEvidence.decoded.entrance === 'blur-in' && registryEvidence.decoded.timelineMode === 'sequential' && registryEvidence.animationProperties.length === 25 && registryEvidence.animationProperties.some((item) => item.control === 'timeline'), `canonical animation metadata failed: ${JSON.stringify(registryEvidence)}`)
  assert(registryEvidence.objectTypes.every((item) => item.animation) && registryEvidence.objectTypes.find((item) => item.type === 'Text')?.text && !registryEvidence.objectTypes.find((item) => item.type === 'Image')?.text, `capability registry failed: ${JSON.stringify(registryEvidence.objectTypes)}`)

  const initialPanel = await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];smallest('portfolio-hero').click();await tick();const group=document.querySelector('[data-property-category="animation"]');return {selected:document.querySelector('[data-selected-entity-id]')?.dataset.selectedEntityId,exists:Boolean(group),collapsed:group?.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')==='false',fontOpen:document.querySelector('[data-property-category="font"] .accordion-toggle')?.getAttribute('aria-expanded')==='true'};})()`)
  assert(initialPanel.selected === 'portfolio-hero' && initialPanel.exists && initialPanel.collapsed && initialPanel.fontOpen, `Animation accordion default state failed: ${JSON.stringify(initialPanel)}`)

  const configured = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const group=document.querySelector('[data-property-category="animation"]');group.querySelector('.accordion-toggle').click();await tick();
    const set=(key,value)=>{const field=document.querySelector('[data-property-key="'+key+'"]');const control=field.matches('select,input')?field:field.querySelector('select,input');if(!control){const buttons=field.matches('button')?[field]:[...field.querySelectorAll('button')];const button=buttons.find(item=>item.textContent.trim().toLowerCase()===String(value).replaceAll('-',' ').toLowerCase());if(!button)throw new Error('Control not found for '+key);button.click();return}if(control.type==='checkbox')control.checked=Boolean(value);else control.value=String(value);control.dispatchEvent(new Event(control.type==='checkbox'?'change':'input',{bubbles:true}));if(control.tagName==='SELECT')control.dispatchEvent(new Event('change',{bubbles:true}))};
    const durationBefore=document.querySelector('[data-property-key="animation.duration"] input').disabled;set('animation.type','fade');await tick();const durationAfter=document.querySelector('[data-property-key="animation.duration"] input').disabled;set('animation.duration',450);set('animation.delay',100);set('animation.ease','ease-out');set('animation.playOnce',false);await tick();set('animation.loop',true);await tick();set('animation.direction','alternate');set('animation.fillMode','forwards');set('animation.hover','scale');set('animation.click','ripple');set('animation.scroll','reveal');await tick();set('animation.scrollPlayback','replay');set('animation.scrollOffset',120);set('animation.scrollThreshold',.25);set('animation.text','typewriter');set('animation.timelineMode','sequential');set('animation.timelineDelay',80);await tick();await tick();
    const animation=await import('/src/editor/animationRegistry.ts');const record=editor.draftSnapshot.animations['portfolio-hero'];const config=animation.decodeAnimationConfiguration(record.name);const fields=[...group.querySelectorAll('[data-property-key]')].map(item=>item.dataset.propertyKey);return {selected:editor.selectedObjectId,durationBefore,durationAfter,record:{...record},config,history:editor.commandHistory.length,dirty:editor.hasUnsavedChanges,active:editor.activeAccordion,fields,encodedLength:record.name.length,loopDisabled:document.querySelector('[data-property-key="animation.loop"]').disabled,directionDisabled:document.querySelector('[data-property-key="animation.direction"]').disabled};
  })()`)
  assert(configured.durationBefore && !configured.durationAfter && configured.selected === 'portfolio-hero' && configured.record.durationMs === 450 && configured.record.delayMs === 100 && configured.record.easing === 'ease-out' && configured.record.enabled, `base Animation panel binding failed: ${JSON.stringify(configured)}`)
  assert(configured.config.entrance === 'fade' && configured.config.loop && !configured.config.playOnce && configured.config.direction === 'alternate' && configured.config.fillMode === 'forwards' && configured.config.hover === 'scale' && configured.config.click === 'ripple' && configured.config.scroll === 'reveal' && configured.config.scrollPlayback === 'replay' && configured.config.scrollOffset === 120 && configured.config.scrollThreshold === .25 && configured.config.text === 'typewriter' && configured.config.timelineMode === 'sequential' && configured.config.timelineDelay === 80 && configured.encodedLength <= 128, `interaction configuration failed: ${JSON.stringify(configured.config)}`)
  assert(configured.history <= 10 && configured.dirty && configured.active === 'animation' && !configured.loopDisabled && !configured.directionDisabled && ['animation.type','animation.duration','animation.delay','animation.ease','animation.loop','animation.direction','animation.fillMode','animation.playOnce','animation.preview'].every((key) => configured.fields.includes(key)), `command/dependency panel failed: ${JSON.stringify(configured)}`)

  const previewEvidence = await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const root=document.querySelector('.preview-stage');const element=[...document.querySelectorAll('[data-editor-object-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];const before=Number(root.dataset.animationPreviewCount??0);document.querySelector('[data-property-key="animation.preview"]').click();await tick();const middle=Number(root.dataset.animationPreviewCount??0);const previewAnimations=element.getAnimations().length;element.dispatchEvent(new PointerEvent('pointerenter',{bubbles:true}));await tick();const hoverAnimations=element.getAnimations().length;element.click();await tick();const clickAnimations=element.getAnimations().length;const accordion=document.querySelector('[data-property-category="animation"] .accordion-toggle');if(accordion.getAttribute('aria-expanded')!=='true'){accordion.click();await new Promise(resolve=>setTimeout(resolve,240));await tick()}const timelineButton=document.querySelector('[data-property-key="animation.timelinePreview"] button');const timelineDisabled=timelineButton.disabled;timelineButton.click();await tick();const after=Number(root.dataset.animationPreviewCount??0);return {before,middle,after,timelineDisabled,previewAnimations,hoverAnimations,clickAnimations,timeline:element.dataset.animationTimeline,tracks:[...document.querySelectorAll('.timeline-track span')].map(item=>item.textContent.trim()),status:document.querySelector('.save-status').textContent.trim(),rootStable:root===document.querySelector('.preview-stage')};})()`)
  assert(previewEvidence.after === previewEvidence.before + 2 && !previewEvidence.timelineDisabled && previewEvidence.previewAnimations > 0 && previewEvidence.hoverAnimations > 0 && previewEvidence.clickAnimations > 0 && previewEvidence.timeline === 'sequential' && ['Entrance','Hover','Click','Scroll','Text'].every((track) => previewEvidence.tracks.includes(track)) && previewEvidence.rootStable, `live/timeline preview failed: ${JSON.stringify(previewEvidence)}`)

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  await evaluate(`document.querySelector('[data-property-category="animation"]').scrollIntoView({block:'start'})`)
  await wait(120)
  const inspectorShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-035-animation-inspector.png'), Buffer.from(inspectorShot.data, 'base64'))

  const productivityEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const settle=async()=>{await new Promise(resolve=>setTimeout(resolve,240));await tick()};const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const animation=await import('/src/editor/animationRegistry.ts');const openAnimation=async()=>{const toggle=document.querySelector('[data-property-category="animation"] .accordion-toggle');if(toggle.getAttribute('aria-expanded')!=='true'){toggle.click();await settle()}else await tick()};
    await openAnimation();const preset=document.querySelector('[data-property-key="animation.preset"]');preset.value='interactive-card';preset.dispatchEvent(new Event('change',{bubbles:true}));await tick();const sourceConfig=animation.decodeAnimationConfiguration(editor.draftSnapshot.animations['portfolio-hero'].name);document.querySelector('[data-property-key="animation.copy"]').click();
    const target=editor.objects.find(item=>item.id!=='portfolio-hero'&&item.type==='Text'&&document.querySelector('[data-editor-object-id="'+item.id+'"]'));const targetElement=[...document.querySelectorAll('[data-editor-object-id="'+target.id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];targetElement.click();await tick();await openAnimation();const paste=document.querySelector('[data-property-key="animation.paste"]');const pasteEnabled=!paste.disabled;paste.click();await tick();const pasted=animation.decodeAnimationConfiguration(editor.draftSnapshot.animations[target.id].name);
    editor.setObjectSelection(['portfolio-hero',target.id],'portfolio-hero');await tick();await openAnimation();const duplicate=document.querySelector('[data-property-key="animation.duplicate"]');const duplicateEnabled=!duplicate.disabled;duplicate.click();await tick();const duplicated=animation.decodeAnimationConfiguration(editor.draftSnapshot.animations[target.id].name);
    editor.setObjectSelection(['portfolio-hero'],'portfolio-hero');await tick();await openAnimation();document.querySelector('[data-property-key="animation.reset"]').click();await tick();const reset=!animation.hasAnimation(editor.draftSnapshot.animations['portfolio-hero']);editor.undo();await tick();const undo=animation.hasAnimation(editor.draftSnapshot.animations['portfolio-hero']);editor.redo();await tick();const redo=!animation.hasAnimation(editor.draftSnapshot.animations['portfolio-hero']);editor.undo();await tick();
    return {sourceConfig,pasteEnabled,pasted,duplicateEnabled,duplicated,reset,undo,redo,history:editor.commandHistory.length,selected:editor.selectedObjectId};
  })()`)
  assert(productivityEvidence.sourceConfig.entrance === 'fade' && productivityEvidence.sourceConfig.hover === 'lift' && productivityEvidence.sourceConfig.click === 'scale' && productivityEvidence.pasteEnabled && productivityEvidence.pasted.hover === 'lift' && productivityEvidence.duplicateEnabled && productivityEvidence.duplicated.click === 'scale' && productivityEvidence.reset && productivityEvidence.undo && productivityEvidence.redo && productivityEvidence.history <= 10 && productivityEvidence.selected === 'portfolio-hero', `preset/copy/paste/duplicate/reset failed: ${JSON.stringify(productivityEvidence)}`)

  const persistenceEvidence = await evaluate(`(async()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const snapshot=await import('/src/editor/editorSnapshot.ts');const animation=await import('/src/editor/animationRegistry.ts');const serialized=snapshot.serializeEditorSnapshot(editor.draftSnapshot);const restored=snapshot.deserializeEditorSnapshot(serialized);const config=animation.decodeAnimationConfiguration(restored.animations['portfolio-hero']?.name);const invalid=structuredClone(restored);invalid.animations['invalid-animation']={name:'x'.repeat(129),enabled:true};return {serialized:serialized.includes('a1;e='),config,valid:snapshot.validateEditorSnapshot(restored).valid,invalid:snapshot.validateEditorSnapshot(invalid).valid};})()`)
  assert(persistenceEvidence.serialized && persistenceEvidence.valid && !persistenceEvidence.invalid && persistenceEvidence.config.entrance === 'fade', `Snapshot persistence/validation failed: ${JSON.stringify(persistenceEvidence)}`)

  const globalDisableEvidence = await evaluate(`(async()=>{const waitForReason=async(reason)=>{const started=performance.now();while(document.querySelector('.preview-stage')?.dataset.animationsDisabled!==reason&&performance.now()-started<1200)await new Promise(resolve=>setTimeout(resolve,20))};const toggle=document.querySelector('[data-property-key="animation.globalDisabled"]');toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));await waitForReason('global');const root=document.querySelector('.preview-stage');const preview=document.querySelector('[data-property-key="animation.preview"]');const disabled=preview.disabled;const global=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.animations.__global__.enabled;const rootReason=root.dataset.animationsDisabled;toggle.checked=false;toggle.dispatchEvent(new Event('change',{bubbles:true}));await waitForReason('false');return {disabled,global,rootReason,reEnabled:document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.animations.__global__.enabled,reEnabledReason:root.dataset.animationsDisabled};})()`)
  assert(globalDisableEvidence.disabled && globalDisableEvidence.global === false && globalDisableEvidence.rootReason === 'global' && globalDisableEvidence.reEnabled === true && globalDisableEvidence.reEnabledReason === 'false', `global animation disable failed: ${JSON.stringify(globalDisableEvidence)}`)

  await send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  const reducedMotionEvidence = await evaluate(`(async()=>{await new Promise(resolve=>setTimeout(resolve,80));const runtime=await import('/src/runtime/animationRuntime.ts');const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const root=document.querySelector('.preview-stage');runtime.applyAnimationRuntime(root,editor.draftSnapshot,{autoplayEntrance:true,respectReducedMotion:true});const result=runtime.previewAnimation(root,editor.draftSnapshot,'portfolio-hero');const element=document.querySelector('[data-editor-object-id="portfolio-hero"]');return {preferred:runtime.prefersReducedMotion(),rootReason:root.dataset.animationsDisabled,result,animations:element.getAnimations().length};})()`)
  assert(reducedMotionEvidence.preferred && reducedMotionEvidence.rootReason === 'reduced-motion' && reducedMotionEvidence.result.reason === 'reduced-motion' && reducedMotionEvidence.animations === 0, `reduced motion failed: ${JSON.stringify(reducedMotionEvidence)}`)
  await send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })

  const guestRuntimeEvidence = await evaluate(`(async()=>{const runtime=await import('/src/runtime/publishedSnapshotDom.ts');const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const host=document.createElement('div');host.style.cssText='position:fixed;left:-9999px;top:0;width:500px';host.innerHTML='<button data-editor-object-id="portfolio-hero">Runtime target</button>';document.body.append(host);runtime.applyPublishedSnapshotDom(host,editor.draftSnapshot);const target=host.firstElementChild;const configured=target.dataset.animationEntrance;target.dispatchEvent(new PointerEvent('pointerenter',{bubbles:true}));target.click();await new Promise(resolve=>requestAnimationFrame(resolve));const animations=target.getAnimations().length;host.remove();return {configured,animations};})()`)
  assert(guestRuntimeEvidence.configured === 'fade' && guestRuntimeEvidence.animations > 0, `shared Published/Guest animation runtime failed: ${JSON.stringify(guestRuntimeEvidence)}`)

  const beforeMetrics = await send('Performance.getMetrics')
  const performanceEvidence = await evaluate(`(async()=>{const runtime=await import('/src/runtime/animationRuntime.ts');const animation=await import('/src/editor/animationRegistry.ts');const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const root=document.querySelector('.preview-stage');const guest=document.querySelector('.guest-home');const started=performance.now();for(let index=0;index<24;index+=1){runtime.previewAnimation(root,editor.draftSnapshot,'portfolio-hero',index%2?'animation':'timeline','desktop');await new Promise(resolve=>requestAnimationFrame(resolve))}const stressDuration=performance.now()-started;const performanceSnapshot=JSON.parse(JSON.stringify(editor.draftSnapshot));performanceSnapshot.animations['portfolio-hero']={name:animation.encodeAnimationConfiguration({...animation.defaultAnimationConfiguration(),entrance:'fade'}),durationMs:2000,delayMs:0,easing:'linear',enabled:true};runtime.restoreAnimationRuntime(root);runtime.previewAnimation(root,performanceSnapshot,'portfolio-hero','animation','desktop');const frames=[];for(let index=0;index<61;index+=1)frames.push(await new Promise(resolve=>requestAnimationFrame(resolve)));const intervals=frames.slice(1).map((value,index)=>value-frames[index]).sort((a,b)=>a-b);const average=intervals.reduce((sum,value)=>sum+value,0)/intervals.length;const p95=intervals[Math.floor(intervals.length*.95)]??0;runtime.restoreAnimationRuntime(root);runtime.applyAnimationRuntime(root,editor.draftSnapshot,{breakpoint:'desktop',autoplayEntrance:false,respectReducedMotion:true});return {stressDuration,averageFrameMs:average,p95FrameMs:p95,fps:1000/average,sameRoot:guest===document.querySelector('.guest-home'),history:editor.commandHistory.length};})()`)
  const afterMetrics = await send('Performance.getMetrics')
  const metricMap = (result) => Object.fromEntries(result.metrics.map((metric) => [metric.name, metric.value]))
  const before = metricMap(beforeMetrics); const after = metricMap(afterMetrics)
  const performanceMetrics = { scriptSeconds: Number(((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)).toFixed(5)), layouts: (after.LayoutCount ?? 0) - (before.LayoutCount ?? 0), styleRecalcs: (after.RecalcStyleCount ?? 0) - (before.RecalcStyleCount ?? 0) }
  assert(performanceEvidence.sameRoot && performanceEvidence.stressDuration <= 600 && performanceEvidence.fps >= 55 && performanceEvidence.p95FrameMs <= 26 && performanceEvidence.history <= 10, `Animation performance failed: ${JSON.stringify(performanceEvidence)}`)

  const accessibilityEvidence = await evaluate(`(async()=>{const group=document.querySelector('[data-property-category="animation"]');group.scrollIntoView({block:'start'});await new Promise(resolve=>requestAnimationFrame(resolve));const nameless=[...group.querySelectorAll('button')].filter(button=>!button.innerText.trim()&&!button.getAttribute('aria-label')).length;const unlabeled=[...group.querySelectorAll('input,select')].filter(control=>!control.getAttribute('aria-label')&&!control.closest('label')&&!control.closest('.property-field')?.querySelector(':scope > span')).length;const first=group.querySelector('.accordion-toggle');first.focus();const focus=getComputedStyle(first);const textObject=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').objects.find(item=>item.type==='Text');return {nameless,unlabeled,focusVisible:focus.outlineStyle!=='none'&&Number.parseFloat(focus.outlineWidth)>0,ariaExpanded:first.getAttribute('aria-expanded'),textObject:Boolean(textObject)};})()`)
  assert(accessibilityEvidence.nameless === 0 && accessibilityEvidence.unlabeled === 0 && accessibilityEvidence.focusVisible && accessibilityEvidence.ariaExpanded === 'true' && accessibilityEvidence.textObject, `Animation accessibility failed: ${JSON.stringify(accessibilityEvidence)}`)

  await evaluate(`(async()=>{const timeline=document.querySelector('[data-property-key="animation.timelinePreview"]');timeline?.scrollIntoView({block:'center'});await new Promise(resolve=>setTimeout(resolve,800));return true})()`)
  const timelineShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-035-animation-timeline.png'), Buffer.from(timelineShot.data, 'base64'))

  const unhandled = await evaluate(`globalThis.__phase035Unhandled??[]`)
  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(error))
  const seriousWarnings = consoleWarnings.filter((warning) => !/favicon|DevTools/i.test(warning))
  assert(unhandled.length === 0 && seriousErrors.length === 0 && seriousWarnings.length === 0, `browser runtime errors: ${[...unhandled, ...seriousErrors, ...seriousWarnings].join(' | ')}`)

  process.stdout.write(`${JSON.stringify({ status: 'PASS', scope: 'Phase 035 local Animation & Interaction runtime', registry: registryEvidence, configuration: configured, preview: previewEvidence, productivity: productivityEvidence, persistence: persistenceEvidence, globalDisable: globalDisableEvidence, reducedMotion: reducedMotionEvidence, guestRuntime: guestRuntimeEvidence, performance: performanceEvidence, devToolsMetrics: performanceMetrics, accessibility: accessibilityEvidence, screenshots: ['artifacts/phase-035-animation-inspector.png','artifacts/phase-035-animation-timeline.png'] }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* already closed */ }
  stopChildren()
  await wait(350)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }) } catch { /* Chromium may briefly retain its profile lock. */ }
}
