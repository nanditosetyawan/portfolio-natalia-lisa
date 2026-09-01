import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5185'
const cdpPort = 9345
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase034-chrome-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(`Phase 034 runtime failure: ${message}`)
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5185', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5185'))
    if (!page) await wait(100)
  }
  if (!page) throw new Error('Phase 034 browser target not found.')

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
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP request timed out: ${method}`)) }, 20000)
      pending.set(id, { resolve(value) { clearTimeout(timer); resolve(value) }, reject(error) { clearTimeout(timer); reject(error) } })
    })
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
  try {
    await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
    await evaluate(`(()=>{globalThis.__phase034Unhandled=[];addEventListener('unhandledrejection',(event)=>globalThis.__phase034Unhandled.push(String(event.reason?.stack??event.reason)));return true})()`)
    await evaluate(`(async()=>{const auth=(await import('/src/stores/auth.ts')).useAuthStore();const router=(await import('/src/router/index.ts')).default;auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});await router.push('/admin/edit');return true})()`)
    await waitFor(`Boolean(document.querySelector('.edit-page'))&&!document.querySelector('.editor-recovery')&&Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`)
  } catch (error) {
    const diagnostics = await evaluate(`({url:location.href,body:document.body.innerText.slice(0,3500),recovery:document.querySelector('.editor-recovery')?.innerText})`)
    throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}; vite=${viteErrors}; browser=${browserErrors}; runtime=${runtimeErrors.join(' | ')}`)
  }

  const registryEvidence = await evaluate(`(async()=>{
    const registry=await import('/src/editor/designSystemRegistry.ts');const properties=await import('/src/editor/propertyRegistry.ts');
    const theme=registry.createDefaultDesignTheme();const audit=registry.auditDesignTheme(theme);
    return {tokens:registry.designTokenRegistry.map(token=>token.id),roles:registry.typographyRoleRegistry.map(role=>role.id),variants:registry.buttonStyleRegistry.map(item=>item.id),sizes:registry.buttonSizeRegistry.map(item=>item.id),components:registry.reusableComponentRegistry.map(item=>item.id),sections:registry.reusableSectionRegistry.map(item=>item.id),tokenProperties:properties.propertyRegistry.filter(item=>item.designToken).length,audit:audit.map(item=>item.id),contrast:registry.contrastRatio('#49362f','#f6f4e8')};
  })()`)
  assert(registryEvidence.tokens.length === 21 && ['color-primary','color-secondary','color-accent','color-success','color-warning','color-danger','color-background','color-surface','color-border','color-text-primary','color-text-secondary','color-heading','color-link','radius-global','shadow-global','spacing-global','transition-global','duration-global','typography-scale'].every((id) => registryEvidence.tokens.includes(id)), `token registry incomplete: ${JSON.stringify(registryEvidence)}`)
  assert(registryEvidence.roles.length === 10 && registryEvidence.variants.length === 6 && registryEvidence.sizes.length === 3 && registryEvidence.components.length === 13 && registryEvidence.sections.length === 10 && registryEvidence.tokenProperties >= 12, `design registries incomplete: ${JSON.stringify(registryEvidence)}`)
  assert(registryEvidence.audit.includes('touch:button-small') && registryEvidence.contrast > 4.5, `accessibility engine failed: ${JSON.stringify(registryEvidence)}`)

  const tokenBindingEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    smallest('portfolio-hero').click();await tick();const group=document.querySelector('[data-property-category="font"]');if(group.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true')group.querySelector('.accordion-toggle').click();await tick();
    const field=document.querySelector('[data-property-key="font.color"]').closest('.property-field');const selects=field.querySelectorAll('.design-reference-control select');selects[0].value='object';selects[0].dispatchEvent(new Event('change',{bubbles:true}));selects[1].value='color-primary';selects[1].dispatchEvent(new Event('change',{bubbles:true}));await tick();
    return {selected:editor.selectedObjectId,color:editor.draftSnapshot.typography['portfolio-hero']?.color,reference:document.querySelector('[data-property-key="font.color"]').closest('.property-field').querySelector('.design-reference-control').dataset.designReference,tokenLabel:field.innerText.includes('Primary Color'),objectIds:[...editor.previewMutation.objectIds],history:editor.commandHistory.length};
  })()`)
  assert(tokenBindingEvidence.selected === 'portfolio-hero' && tokenBindingEvidence.color === '#8d363a' && tokenBindingEvidence.reference.includes('Inherited') && tokenBindingEvidence.tokenLabel && tokenBindingEvidence.objectIds.length === 1 && tokenBindingEvidence.objectIds[0] === 'portfolio-hero', `token binding failed: ${JSON.stringify(tokenBindingEvidence)}`)

  await evaluate(`document.querySelector('.design-system-button').click()`)
  await waitFor(`Boolean(document.querySelector('.design-system-panel [data-design-tab="theme"]'))`)
  const managerStructure = await evaluate(`({tabs:[...document.querySelectorAll('.design-tabs button')].map(button=>button.textContent.trim()),tokenFields:document.querySelectorAll('.token-field').length,activeThemes:document.querySelectorAll('.theme-list article.active').length,dialog:document.querySelector('.design-system-panel').getAttribute('role'),modal:document.querySelector('.design-system-panel').getAttribute('aria-modal')})`)
  assert(['theme','typography','buttons','components','sections','templates','audit'].every((tab) => managerStructure.tabs.includes(tab)) && managerStructure.tokenFields === 21 && managerStructure.activeThemes === 1 && managerStructure.dialog === 'dialog' && managerStructure.modal === 'true', `Theme Manager structure failed: ${JSON.stringify(managerStructure)}`)

  const themeEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const clickText=(selector,text)=>[...document.querySelectorAll(selector)].find(item=>item.textContent.includes(text))?.click();
    const create=document.querySelector('.create-theme input');create.value='Phase 034 Rose';create.dispatchEvent(new Event('input',{bubbles:true}));clickText('.create-theme button','Create Theme');await tick();
    const primary=document.querySelector('[data-token-id="color-primary"] input:not([type="color"])');const root=document.querySelector('.guest-home');root.dataset.phase034Identity='stable';const countBefore=Number(document.querySelector('.performance-status').dataset.previewUpdateCount??0);primary.value='#663344';primary.dispatchEvent(new Event('change',{bubbles:true}));await tick();await tick();
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const design=pinia._s.get('designSystem');const element=[...document.querySelectorAll('[data-editor-object-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    return {themes:design.workspace.themes.length,active:design.activeTheme.name,activeCount:design.workspace.themes.filter(theme=>theme.id===design.workspace.activeThemeId).length,color:editor.draftSnapshot.typography['portfolio-hero']?.color,computed:getComputedStyle(element).color,cssVariable:document.querySelector('.preview-stage').style.getPropertyValue('--ds-color-primary'),sameRoot:root===document.querySelector('.guest-home')&&root.dataset.phase034Identity==='stable',targetedUpdates:Number(document.querySelector('.performance-status').dataset.previewUpdateCount??0)-countBefore,mutationIds:[...editor.previewMutation.objectIds],stored:Boolean(localStorage.getItem('portfolio-editor-design-system-v1'))};
  })()`)
  assert(themeEvidence.themes === 2 && themeEvidence.active === 'Phase 034 Rose' && themeEvidence.activeCount === 1 && themeEvidence.color === '#663344' && themeEvidence.computed === 'rgb(102, 51, 68)' && themeEvidence.cssVariable === '#663344' && themeEvidence.sameRoot && themeEvidence.targetedUpdates <= 3 && themeEvidence.mutationIds.length === 1 && themeEvidence.stored, `Theme/token live Preview failed: ${JSON.stringify(themeEvidence)}`)

  const hierarchyEvidence = await evaluate(`(()=>{
    const design=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem');const context={objectId:'phase34-object',section:'Portfolio',component:'Text'};const key='phase34.test';
    design.setReference('theme',context,key,'color-primary');const theme=design.resolveReference(context,key);design.setReference('section',context,key,'color-secondary');const section=design.resolveReference(context,key);design.setReference('component',context,key,'color-accent');const component=design.resolveReference(context,key);design.setReference('object',context,key,'color-danger');const object=design.resolveReference(context,key);const overridden=design.markOverride(context,key);design.removeReference('object',context,key);const fallback=design.resolveReference(context,key);design.removeReference('component',context,key);design.removeReference('section',context,key);design.removeReference('theme',context,key);
    const activeId=design.activeTheme.id;const duplicate=design.duplicateTheme(activeId);const renamed=duplicate?design.renameTheme(duplicate.id,'Phase 034 Duplicate'):false;const previewed=design.preview(activeId);const activated=duplicate?design.activate(duplicate.id):false;const deleted=duplicate?design.deleteTheme(duplicate.id):false;design.activate(activeId);
    return {theme:{scope:theme?.scope,tokenId:theme?.tokenId},section:{scope:section?.scope,tokenId:section?.tokenId},component:{scope:component?.scope,tokenId:component?.tokenId},object:{scope:object?.scope,tokenId:object?.tokenId},overridden:Boolean(overridden?.overridden),fallback:{scope:fallback?.scope,tokenId:fallback?.tokenId},renamed,previewed,activated,deleted,themes:design.workspace.themes.length,active:design.activeTheme.name};
  })()`)
  assert(hierarchyEvidence.theme.scope === 'theme' && hierarchyEvidence.section.scope === 'section' && hierarchyEvidence.component.scope === 'component' && hierarchyEvidence.object.scope === 'object' && hierarchyEvidence.overridden && hierarchyEvidence.fallback.scope === 'component', `Theme > Section > Component > Object inheritance failed: ${JSON.stringify(hierarchyEvidence)}`)
  assert(hierarchyEvidence.renamed && hierarchyEvidence.previewed && hierarchyEvidence.activated && hierarchyEvidence.deleted && hierarchyEvidence.themes === 2 && hierarchyEvidence.active === 'Phase 034 Rose', `Theme CRUD/preview/switch failed: ${JSON.stringify(hierarchyEvidence)}`)

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  const themeShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-034-theme-manager.png'), Buffer.from(themeShot.data, 'base64'))

  const typographyEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const clickText=(selector,text)=>[...document.querySelectorAll(selector)].find(item=>item.textContent.trim()===text)?.click();
    clickText('.design-tabs button','typography');await tick();clickText('.role-list button','Heading 1');await tick();clickText('[data-design-tab="typography"] button','Apply Heading 1 to selection');await tick();document.querySelector('[aria-label="Close Design System"]').click();await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const design=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem');const field=document.querySelector('[data-property-key="font.size"]');const input=field.querySelector('input');input.value='3rem';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();const overridden=field.closest('.property-field').querySelector('.design-reference-state')?.textContent.trim();field.closest('.property-field').querySelector('.design-reference-control button')?.click();await tick();const reset=editor.draftSnapshot.typography['portfolio-hero']?.fontSize;editor.undo();await tick();const undo=editor.draftSnapshot.typography['portfolio-hero']?.fontSize;editor.redo();await tick();const redo=editor.draftSnapshot.typography['portfolio-hero']?.fontSize;
    const assignment=design.workspace.typographyAssignments['portfolio-hero'];return {assignment:{roleId:assignment?.roleId,overriddenStyleKeys:[...(assignment?.overriddenStyleKeys??[])]},fontFamily:editor.draftSnapshot.typography['portfolio-hero']?.fontFamily,fontWeight:editor.draftSnapshot.typography['portfolio-hero']?.fontWeight,reset,undo,redo,overridden,history:editor.commandHistory.length,selected:editor.selectedObjectId};
  })()`)
  assert(typographyEvidence.assignment.roleId === 'heading-1' && typographyEvidence.fontFamily.includes('Georgia') && typographyEvidence.fontWeight === 700 && typographyEvidence.overridden === 'Overridden' && typographyEvidence.reset === '4rem' && typographyEvidence.undo === '3rem' && typographyEvidence.redo === '4rem' && typographyEvidence.history <= 10 && typographyEvidence.selected === 'portfolio-hero', `global typography inheritance/reset failed: ${JSON.stringify(typographyEvidence)}`)

  const inspectorShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-034-token-inspector.png'), Buffer.from(inspectorShot.data, 'base64'))

  const libraryEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const app=document.querySelector('#app').__vue_app__;const pinia=app.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const design=pinia._s.get('designSystem');
    const button=editor.objects.find(object=>object.type==='Button');if(button){editor.setObjectSelection([button.id],button.id);await tick();document.querySelector('.design-system-button').click();await tick();[...document.querySelectorAll('.design-tabs button')].find(item=>item.textContent.trim()==='buttons').click();await tick();[...document.querySelectorAll('.button-recipes button')].find(item=>item.textContent.trim()==='Danger').click();[...document.querySelectorAll('.size-recipes button')].find(item=>item.textContent.trim()==='Large').click();[...document.querySelectorAll('[data-design-tab="buttons"] button')].find(item=>item.textContent.includes('Apply button style')).click();await tick();document.querySelector('[aria-label="Close Design System"]').click();await tick();}
    const text=editor.objects.find(object=>object.type==='Text'&&object.capabilities.includes('typography'));editor.setObjectSelection([text.id],text.id);await tick();document.querySelector('.design-system-button').click();await tick();[...document.querySelectorAll('.design-tabs button')].find(item=>item.textContent.trim()==='components').click();await tick();const search=document.querySelector('[aria-label="Search components"]');search.value='section title';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();document.querySelector('[data-design-tab="components"] .library-grid article button:not(:disabled)')?.click();await tick();[...document.querySelectorAll('[data-design-tab="components"] button')].find(item=>item.textContent.includes('Save selected style'))?.click();await tick();
    const componentCount=document.querySelectorAll('[data-design-tab="components"] .library-grid article').length;[...document.querySelectorAll('.design-tabs button')].find(item=>item.textContent.trim()==='sections').click();await tick();[...document.querySelectorAll('[data-design-tab="sections"] button')].find(item=>item.textContent.includes('Save current Section'))?.click();await tick();const unavailable=[...document.querySelectorAll('[data-design-tab="sections"] button[disabled]')].map(item=>item.closest('article')?.querySelector('h4')?.textContent);[...document.querySelectorAll('.design-tabs button')].find(item=>item.textContent.trim()==='templates').click();await tick();
    const snapshotModule=await import('/src/editor/editorSnapshot.ts');const serialized=snapshotModule.serializeEditorSnapshot(editor.draftSnapshot);const restored=snapshotModule.deserializeEditorSnapshot(serialized);
    const assignment=button?design.workspace.buttonAssignments[button.id]:null;return {buttonId:button?.id,buttonBackground:button?editor.draftSnapshot.buttons[button.id]?.backgroundColor:null,buttonPadding:button?editor.draftSnapshot.layout[button.id]?.padding:null,buttonAssignment:assignment?{variantId:assignment.variantId,sizeId:assignment.sizeId}:null,textId:text.id,textFont:editor.draftSnapshot.typography[text.id]?.fontFamily,componentCount,componentPresets:design.workspace.componentPresets.length,sectionTemplates:design.workspace.sectionTemplates.length,unavailable,templateRows:document.querySelectorAll('.template-list article').length,roundTrip:Boolean(restored.typography[text.id]),fixedObjects:editor.objects.filter(object=>!object.ux?.collectionPath).length};
  })()`)
  assert(libraryEvidence.buttonId && libraryEvidence.buttonBackground === '#d62828' && libraryEvidence.buttonPadding === '1rem 1.25rem' && libraryEvidence.buttonAssignment.variantId === 'danger' && libraryEvidence.buttonAssignment.sizeId === 'large', `button system failed: ${JSON.stringify(libraryEvidence)}`)
  assert(libraryEvidence.textFont.includes('Georgia') && libraryEvidence.componentCount === 1 && libraryEvidence.componentPresets === 1 && libraryEvidence.sectionTemplates === 1 && libraryEvidence.unavailable.includes('Skills') && libraryEvidence.unavailable.includes('Testimonials') && libraryEvidence.unavailable.includes('Footer') && libraryEvidence.templateRows >= 2 && libraryEvidence.roundTrip && libraryEvidence.fixedObjects > 0, `component/section/template library failed: ${JSON.stringify(libraryEvidence)}`)

  const libraryShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-034-component-section-library.png'), Buffer.from(libraryShot.data, 'base64'))

  const beforeMetrics = await send('Performance.getMetrics')
  const performanceEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(resolve));[...document.querySelectorAll('.design-tabs button')].find(item=>item.textContent.trim()==='theme').click();await tick();const input=document.querySelector('[data-token-id="color-danger"] input:not([type="color"])');const root=document.querySelector('.guest-home');const countBefore=Number(document.querySelector('.performance-status').dataset.previewUpdateCount??0);const started=performance.now();for(let index=0;index<12;index+=1){input.value=index%2?'#d62828':'#b92a32';input.dispatchEvent(new Event('change',{bubbles:true}));await tick()}await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));document.querySelector('[aria-label="Close Design System"]').click();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const frames=[];for(let index=0;index<61;index+=1)frames.push(await new Promise(resolve=>requestAnimationFrame(resolve)));const intervals=frames.slice(1).map((value,index)=>value-frames[index]).sort((a,b)=>a-b);const average=intervals.reduce((sum,value)=>sum+value,0)/intervals.length;const p95=intervals[Math.floor(intervals.length*.95)]??0;const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return {duration:performance.now()-started,averageFrameMs:average,p95FrameMs:p95,fps:1000/average,sameRoot:root===document.querySelector('.guest-home'),targetedUpdates:Number(document.querySelector('.performance-status').dataset.previewUpdateCount??0)-countBefore,lastMutationIds:[...editor.previewMutation.objectIds],history:editor.commandHistory.length};
  })()`)
  const afterMetrics = await send('Performance.getMetrics')
  const metricMap = (result) => Object.fromEntries(result.metrics.map((metric) => [metric.name, metric.value]))
  const before = metricMap(beforeMetrics); const after = metricMap(afterMetrics)
  const performanceMetrics = { scriptSeconds: Number(((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)).toFixed(5)), layouts: (after.LayoutCount ?? 0) - (before.LayoutCount ?? 0), styleRecalcs: (after.RecalcStyleCount ?? 0) - (before.RecalcStyleCount ?? 0) }
  assert(performanceEvidence.sameRoot && performanceEvidence.fps >= 55 && performanceEvidence.p95FrameMs <= 26 && performanceEvidence.targetedUpdates > 0 && performanceEvidence.targetedUpdates <= 15 && performanceEvidence.lastMutationIds.length === 1 && performanceEvidence.history <= 10, `targeted Design System performance failed: ${JSON.stringify(performanceEvidence)}`)

  const accessibilityEvidence = await evaluate(`(async()=>{document.querySelector('.design-system-button').click();await new Promise(resolve=>requestAnimationFrame(resolve));[...document.querySelectorAll('.design-tabs button')].find(item=>item.textContent.trim()==='audit').click();await new Promise(resolve=>requestAnimationFrame(resolve));const dialog=document.querySelector('.design-system-panel');const nameless=[...dialog.querySelectorAll('button')].filter(button=>!button.innerText.trim()&&!button.getAttribute('aria-label')).length;const unlabeled=[...dialog.querySelectorAll('input,select')].filter(control=>!control.getAttribute('aria-label')&&!control.closest('label')).length;const first=document.querySelector('.design-tabs button');first.focus();const focus=getComputedStyle(first);return {nameless,unlabeled,auditRows:document.querySelectorAll('.audit-list article').length,focusVisible:focus.outlineStyle!=='none'&&Number.parseFloat(focus.outlineWidth)>0,issues:document.querySelector('[data-design-tab="audit"]')?.innerText};})()`)
  assert(accessibilityEvidence.nameless === 0 && accessibilityEvidence.unlabeled === 0 && accessibilityEvidence.auditRows >= 1 && accessibilityEvidence.focusVisible && accessibilityEvidence.issues.includes('touch target'), `Design System accessibility failed: ${JSON.stringify(accessibilityEvidence)}`)

  const unhandled = await evaluate(`globalThis.__phase034Unhandled??[]`)
  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(error))
  const seriousWarnings = consoleWarnings.filter((warning) => !/favicon|DevTools/i.test(warning))
  assert(unhandled.length === 0 && seriousErrors.length === 0 && seriousWarnings.length === 0, `browser runtime errors: ${[...unhandled, ...seriousErrors, ...seriousWarnings].join(' | ')}`)

  process.stdout.write(`${JSON.stringify({ status: 'PASS', scope: 'Phase 034 local Design System runtime', registry: registryEvidence, tokenBinding: tokenBindingEvidence, theme: themeEvidence, hierarchy: hierarchyEvidence, typography: typographyEvidence, libraries: libraryEvidence, performance: performanceEvidence, devToolsMetrics: performanceMetrics, accessibility: accessibilityEvidence, screenshots: ['artifacts/phase-034-theme-manager.png','artifacts/phase-034-token-inspector.png','artifacts/phase-034-component-section-library.png'] }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* already closed */ }
  stopChildren()
  await wait(350)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }) } catch { /* Chromium may briefly retain its profile lock. */ }
}
