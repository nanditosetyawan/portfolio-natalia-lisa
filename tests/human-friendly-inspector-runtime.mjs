import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5191'
const cdpPort = 9351
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-human-inspector-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(`Human-friendly Inspector runtime failure: ${message}`)
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5191', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5191'))
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

  async function waitFor(expression, timeout = 20000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(70)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  async function screenshot(name) {
    await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(projectRoot, 'artifacts', name), Buffer.from(shot.data, 'base64'))
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(async()=>{
    const authModule=await import('/src/stores/auth.ts');
    const router=(await import('/src/router/index.ts')).default;
    const auth=authModule.useAuthStore();
    auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});
    await router.push({name:'admin-edit',query:{draft:'new'}});
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`)
  await wait(350)

  const initialEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    smallest('portfolio-hero').click();await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const panel=document.querySelector('.control-panel');
    const font=document.querySelector('[data-property-category="font"]');
    const labels=[...font.querySelectorAll('.property-field>span')].map(node=>node.textContent.trim());
    const categoryLabels=[...panel.querySelectorAll('.inspector-category-nav button')].map(node=>node.textContent.trim());
    const sizeField=document.querySelector('[data-property-key="font.size"]');
    const familyField=document.querySelector('[data-property-key="font.family"]');
    const forbidden=['Direct value','Inherited','Token reference','CSS Variable','Metadata key','Canonical value','clamp(',' rem',' vw','Object Editor','Entity / element'];
    const visibleText=panel.innerText;
    const advanced=document.querySelector('[data-property-category="advanced"]');
    return {
      selected:editor.selectedObjectId,
      active:editor.activeAccordion,
      labels,categoryLabels,visibleText,
      forbidden:forbidden.filter(value=>visibleText.includes(value)),
      familyTag:familyField?.querySelector('select')?.tagName,
      familyOptions:[...familyField?.querySelectorAll('option')??[]].map(item=>item.textContent.trim()),
      sizeType:sizeField?.querySelector('input')?.type,
      sizeValue:sizeField?.querySelector('input')?.value,
      sizeUnit:sizeField?.querySelector('.property-unit')?.textContent.trim(),
      canonicalSize:editor.draftSnapshot.typography['portfolio-hero']?.fontSize,
      advancedCollapsed:advanced?.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')==='false',
      viewportButtons:[...document.querySelectorAll('.breakpoint-toolbar button')].map(button=>({text:button.textContent.trim(),label:button.getAttribute('aria-label'),id:button.dataset.canvasPreset})),
      selectorLabels:[...panel.querySelectorAll('label.field-label')].map(label=>label.childNodes[0]?.textContent?.trim()??label.textContent.trim())
    };
  })()`)
  assert(initialEvidence.selected === 'portfolio-hero' && initialEvidence.active === 'font', `text selection/default Typography failed: ${JSON.stringify(initialEvidence)}`)
  assert(initialEvidence.forbidden.length === 0, `normal Inspector exposes developer language: ${JSON.stringify(initialEvidence.forbidden)}`)
  assert(initialEvidence.familyTag === 'SELECT' && initialEvidence.familyOptions.includes('Inter') && initialEvidence.familyOptions.includes('Georgia'), 'Font is not a friendly shipped-font dropdown')
  assert(initialEvidence.familyOptions.filter((label) => label === 'Inter').length === 1, `Font dropdown contains duplicate human-facing names: ${JSON.stringify(initialEvidence.familyOptions)}`)
  assert(initialEvidence.sizeType === 'number' && Number.isFinite(Number(initialEvidence.sizeValue)) && initialEvidence.sizeUnit === 'px', `font-size adapter is not numeric px: ${JSON.stringify(initialEvidence)}`)
  assert(initialEvidence.labels.indexOf('Font') < initialEvidence.labels.indexOf('Size') && initialEvidence.labels.indexOf('Size') < initialEvidence.labels.indexOf('Letter spacing') && initialEvidence.labels.indexOf('Letter spacing') < initialEvidence.labels.indexOf('Color') && initialEvidence.labels.indexOf('Color') < initialEvidence.labels.indexOf('Shadow') && initialEvidence.labels.indexOf('Shadow') < initialEvidence.labels.indexOf('Hover style') && initialEvidence.labels.indexOf('Hover style') < initialEvidence.labels.indexOf('Text alignment') && initialEvidence.labels.indexOf('Text alignment') < initialEvidence.labels.indexOf('X'), `Typography order is wrong: ${JSON.stringify(initialEvidence.labels)}`)
  assert(initialEvidence.categoryLabels.includes('TYPOGRAPHY') && initialEvidence.categoryLabels.includes('LAYOUT') && initialEvidence.categoryLabels.includes('EFFECTS') && initialEvidence.categoryLabels.includes('ANIMATION'), `visual category navigation is incomplete: ${JSON.stringify(initialEvidence.categoryLabels)}`)
  assert(initialEvidence.advancedCollapsed && initialEvidence.viewportButtons.length === 2 && initialEvidence.viewportButtons[0].label === 'Desktop' && initialEvidence.viewportButtons[1].label === 'Tablet Landscape', `Advanced/default viewport UX is wrong: ${JSON.stringify(initialEvidence)}`)
  assert(initialEvidence.selectorLabels.includes('Page area') && initialEvidence.selectorLabels.includes('Element'), `friendly selectors are missing: ${JSON.stringify(initialEvidence.selectorLabels)}`)

  const inventoryEvidence = await evaluate(`(async()=>{
    const properties=await import('/src/editor/propertyRegistry.ts');const responsive=await import('/src/editor/responsiveLayout.ts');const presentation=await import('/src/editor/inspectorPresentation.ts');const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const sources=[...properties.propertyRegistry.map(property=>({property,source:'property'})),...responsive.responsiveLayoutRegistry.map(item=>({property:item.metadata,source:'responsive'}))];
    const records=sources.map(({property,source})=>{const objectTypes=[...new Set(editor.objects.filter(object=>object.capabilities.includes(property.capability)).map(object=>object.type))];const variants=(objectTypes.length?objectTypes:[undefined]).map(objectType=>({objectType:objectType??'none',...presentation.resolveInspectorPresentation(property,objectType)}));return {propertyKey:property.propertyKey,originalLabel:property.label,control:property.control,canonicalType:property.valueType,defaultValue:property.defaultValue,capability:property.capability,objectTypes,source,mapping:property.databaseMapping,commandType:property.commandType,dependencyKeys:property.dependency.keys,previewStyles:property.previewUpdater.styles,designTokenKinds:property.designToken?.kinds??[],labels:[...new Set(variants.map(item=>item.label))],modes:[...new Set(variants.map(item=>item.mode))],classifications:[...new Set(variants.map(item=>item.classification))],adapters:[...new Set(variants.map(item=>item.adapter))],simpleText:variants.filter(item=>item.mode==='simple').map(item=>[item.label,...(item.options??[]).map(option=>option.label),item.helperText??''].join(' '))}});
    const forbidden=[['Object',/\\bobject\\b/i],['Component',/\\bcomponent\\b/i],['Section',/\\bsection\\b/i],['Theme reference',/theme reference/i],['Direct',/\\bdirect\\b/i],['Inherited',/\\binherited\\b/i],['Token reference',/token reference/i],['CSS Variable',/css variable/i],['Metadata key',/metadata key/i],['Canonical value',/canonical value/i],['clamp()',/clamp\\(/i],['rem',/\\brem\\b/i],['vw',/\\bvw\\b/i],['CSS Display',/css display/i]];const developerIssues=records.flatMap(record=>record.simpleText.flatMap(text=>forbidden.filter(([,pattern])=>pattern.test(text)).map(([term])=>({propertyKey:record.propertyKey,term,text}))));
    const classificationCounts={};const modeCounts={};for(const record of records){for(const value of record.classifications)classificationCounts[value]=(classificationCounts[value]??0)+1;for(const value of record.modes)modeCounts[value]=(modeCounts[value]??0)+1}
    return {total:records.length,propertyCount:properties.propertyRegistry.length,responsiveCount:responsive.responsiveLayoutRegistry.length,classificationCounts,modeCounts,developerIssues,broken:records.filter(record=>record.classifications.includes('BROKEN')).map(record=>record.propertyKey),records};
  })()`)
  assert(inventoryEvidence.total >= 120 && inventoryEvidence.propertyCount > 80 && inventoryEvidence.responsiveCount === 23, `registered Inspector inventory is incomplete: ${JSON.stringify(inventoryEvidence)}`)
  assert(inventoryEvidence.broken.length === 0 && inventoryEvidence.developerIssues.length === 0, `registered Inspector audit found broken/developer-facing controls: ${JSON.stringify({broken:inventoryEvidence.broken,developerIssues:inventoryEvidence.developerIssues})}`)

  const advancedEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    document.querySelector('[data-property-category="advanced"] .accordion-toggle').click();await tick();
    const raw=document.querySelector('[data-inspector-key="details:font.size"] input,[data-inspector-key="details:font.size"] output');
    const source=document.querySelector('[data-inspector-key="details:font.size"]')?.closest('.property-field')?.querySelector('.design-reference-control');
    const value=raw?.value??raw?.textContent?.trim()??'';
    document.querySelector('.inspector-category-nav button')?.click();await tick();
    return {value,canonical:document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.typography['portfolio-hero']?.fontSize,source:Boolean(source),active:document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').activeAccordion};
  })()`)
  assert(advancedEvidence.value.includes('clamp(') && advancedEvidence.source && advancedEvidence.active === 'font', `Advanced did not preserve/expose the original responsive value: ${JSON.stringify(advancedEvidence)}`)

  const typographyEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const target=smallest('portfolio-hero');const unrelated=smallest('navigation-brand');
    const root=document.querySelector('.guest-home');root.dataset.phase037Identity='stable';
    const unrelatedBefore={fontSize:getComputedStyle(unrelated).fontSize,canonical:editor.draftSnapshot.typography['navigation-brand']?.fontSize};
    const updatesBefore=Number(document.querySelector('.performance-status').dataset.previewUpdateCount??0);
    const setInput=async(key,value)=>{const input=document.querySelector('[data-property-key="'+key+'"] input');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));await tick()};
    await setInput('font.size',52);
    const afterSize={canonical:editor.draftSnapshot.typography['portfolio-hero']?.fontSize,computed:getComputedStyle(target).fontSize,selected:editor.selectedObjectId,unrelatedComputed:getComputedStyle(unrelated).fontSize,unrelatedCanonical:editor.draftSnapshot.typography['navigation-brand']?.fontSize};
    editor.undo();await tick();const undo=editor.draftSnapshot.typography['portfolio-hero']?.fontSize;
    editor.redo();await tick();const redo=editor.draftSnapshot.typography['portfolio-hero']?.fontSize;
    const font=document.querySelector('[data-property-key="font.family"] select');font.value=[...font.options].find(option=>option.textContent.trim()==='Georgia').value;font.dispatchEvent(new Event('change',{bubbles:true}));await tick();
    await setInput('font.spacing',4);
    const colorSummary=document.querySelector('[data-property-key="font.color"] .color-summary');colorSummary.click();await tick();
    const hex=document.querySelector('[data-property-key="font.color"] .picker-head input:not([type="color"])');hex.value='#8d363a';hex.dispatchEvent(new Event('change',{bubbles:true}));await tick();colorSummary.click();await tick();
    const shadow=document.querySelector('[data-property-key="font.shadow"] input[type="checkbox"]');if(shadow.checked)shadow.click();await tick();shadow.click();await tick();
    const shadowX=document.querySelector('[data-property-key="font.shadow"] .shadow-grid input');shadowX.value='3';shadowX.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const textAlign=document.querySelector('[data-property-key="runtime.textAlign"] select');textAlign.value='center';textAlign.dispatchEvent(new Event('change',{bubbles:true}));await tick();
    await setInput('font.positionX',7);await setInput('font.positionY',9);await setInput('font.rotate',5);
    return {
      afterSize,undo,redo,
      font:editor.draftSnapshot.typography['portfolio-hero']?.fontFamily,
      spacing:editor.draftSnapshot.typography['portfolio-hero']?.letterSpacing,
      color:editor.draftSnapshot.typography['portfolio-hero']?.color,
      shadow:editor.draftSnapshot.typography['portfolio-hero']?.textShadow,
      textAlign:{canonical:editor.draftSnapshot.typography['portfolio-hero']?.textAlign,computed:getComputedStyle(target).textAlign},
      layout:{...editor.draftSnapshot.layout['portfolio-hero']},
      selected:editor.selectedObjectId,
      unrelatedBefore,
      sameRoot:root===document.querySelector('.guest-home')&&root.dataset.phase037Identity==='stable',
      targetedUpdates:Number(document.querySelector('.performance-status').dataset.previewUpdateCount??0)-updatesBefore,
      history:editor.commandHistory.length
    };
  })()`)
  assert(typographyEvidence.afterSize.canonical === '52px' && typographyEvidence.afterSize.computed === '52px' && typographyEvidence.afterSize.selected === 'portfolio-hero', `font-size round trip/selection failed: ${JSON.stringify(typographyEvidence)}`)
  assert(typographyEvidence.undo !== '52px' && typographyEvidence.redo === '52px', `font-size Undo/Redo failed: ${JSON.stringify(typographyEvidence)}`)
  assert(typographyEvidence.afterSize.unrelatedComputed === typographyEvidence.unrelatedBefore.fontSize && typographyEvidence.afterSize.unrelatedCanonical === typographyEvidence.unrelatedBefore.canonical, `text edit leaked to an unrelated object: ${JSON.stringify(typographyEvidence)}`)
  assert(typographyEvidence.font.includes('Georgia') && typographyEvidence.spacing === '4px' && typographyEvidence.color === '#8d363a' && typographyEvidence.shadow.includes('3px') && typographyEvidence.textAlign.canonical === 'center' && typographyEvidence.textAlign.computed === 'center' && typographyEvidence.layout.x === 7 && typographyEvidence.layout.y === 9 && typographyEvidence.layout.rotation === 5, `friendly Typography controls did not write canonical properties: ${JSON.stringify(typographyEvidence)}`)
  assert(typographyEvidence.selected === 'portfolio-hero' && typographyEvidence.sameRoot && typographyEvidence.targetedUpdates > 0 && typographyEvidence.history <= 10, `selection/performance/history contract failed: ${JSON.stringify(typographyEvidence)}`)
  await evaluate(`document.querySelector('[data-property-category="font"]').scrollIntoView({block:'start'})`)
  await wait(180)
  await screenshot('phase-037-human-inspector-typography.png')

  const responsiveEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    document.querySelector('[data-canvas-preset="laptop-1024"]').click();await tick();
    const typographyChip=[...document.querySelectorAll('.inspector-category-nav button')].find(button=>button.textContent.trim()==='TYPOGRAPHY');typographyChip.click();await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const before=document.querySelector('[data-property-key="font.size"]').closest('.property-field').dataset.responsiveSource;
    const input=document.querySelector('[data-property-key="font.size"] input');input.value='44';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const responsive=await import('/src/editor/responsiveLayout.ts');const id=responsive.responsiveSnapshotEntityId('laptop','portfolio-hero');
    const after=document.querySelector('[data-property-key="font.size"]').closest('.property-field').dataset.responsiveSource;
    const stored=editor.draftSnapshot.typography[id]?.fontSize;
    const reset=document.querySelector('[aria-label="Use Desktop value for Size"]');const resetText=reset?.textContent.trim();reset?.click();await tick();
    const cleared=editor.draftSnapshot.typography[id]?.fontSize;
    const finalSource=document.querySelector('[data-property-key="font.size"]').closest('.property-field').dataset.responsiveSource;
    return {before,after,stored,resetText,cleared,finalSource,breakpoint:document.querySelector('.preview-stage').dataset.responsiveBreakpoint,selected:editor.selectedObjectId};
  })()`)
  assert(responsiveEvidence.before === 'Using Desktop value' && responsiveEvidence.after === 'Tablet value' && responsiveEvidence.stored === '44px', `Tablet sparse override failed: ${JSON.stringify(responsiveEvidence)}`)
  assert(responsiveEvidence.resetText === 'Use Desktop value' && responsiveEvidence.cleared === undefined && responsiveEvidence.finalSource === 'Using Desktop value' && responsiveEvidence.breakpoint === 'laptop' && responsiveEvidence.selected === 'portfolio-hero', `Tablet reset/inheritance UX failed: ${JSON.stringify(responsiveEvidence)}`)

  const mediaEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const smallest=(id)=>[...document.querySelectorAll('[data-editor-object-id="'+id+'"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    document.querySelector('[data-canvas-preset="desktop-1440"]').click();await tick();smallest('portfolio-profile-media').click();await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const media=document.querySelector('[data-property-category="media"]');
    const labels=[...media.querySelectorAll('.property-field>span')].map(node=>node.textContent.trim());
    const noTypography=!document.querySelector('[data-property-category="font"]');
    const setInput=async(key,value)=>{const input=document.querySelector('[data-property-key="'+key+'"] input');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));await tick()};
    const outline=document.querySelector('[data-property-key="media.outlineEnabled"] input[type="checkbox"]');if(outline.checked)outline.click();await tick();
    const thicknessHiddenOff=!document.querySelector('[data-property-key="media.outlineWidth"]');outline.click();await tick();
    const thickness=document.querySelector('[data-property-key="media.outlineWidth"] input');const thicknessEnabled=Boolean(thickness&&!thickness.disabled);thickness.value='4';thickness.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    await setInput('media.width',420);await setInput('media.height',600);await setInput('media.radius',18);await setInput('media.opacity',80);await setInput('media.positionX',11);await setInput('media.positionY',13);await setInput('media.rotate',6);
    const target=smallest('portfolio-profile-media');
    return {
      selected:editor.selectedObjectId,active:editor.activeAccordion,labels,noTypography,
      thumbnail:Boolean(document.querySelector('[data-property-key="media.preview"] img')),
      choose:Boolean(document.querySelector('[data-property-key="media.choose"] button')),
      replaceDisabled:Boolean(document.querySelector('[data-property-key="media.replace"] input')?.disabled),
      thicknessHiddenOff,thicknessEnabled,
      layout:{...editor.draftSnapshot.layout['portfolio-profile-media']},
      style:{...editor.draftSnapshot.media.styles['portfolio-profile-media']},
      background:{...editor.draftSnapshot.backgrounds['portfolio-profile-media']},
      computed:{width:getComputedStyle(target).width,height:getComputedStyle(target).height,opacity:getComputedStyle(target).opacity,borderRadius:getComputedStyle(target).borderRadius},
      history:editor.commandHistory.length
    };
  })()`)
  assert(mediaEvidence.selected === 'portfolio-profile-media' && mediaEvidence.active === 'media' && mediaEvidence.noTypography, `capability-aware image selection failed: ${JSON.stringify(mediaEvidence)}`)
  assert(mediaEvidence.labels.includes('Preview') && mediaEvidence.labels.includes('Upload New Image') && mediaEvidence.labels.includes('Choose from Media') && mediaEvidence.labels.includes('Replace Selected Image') && mediaEvidence.labels.includes('Remove Selected Image') && mediaEvidence.labels.includes('W') && mediaEvidence.labels.includes('H') && mediaEvidence.labels.includes('Fit') && mediaEvidence.labels.includes('Hover Style') && mediaEvidence.labels.includes('Image Shadow') && mediaEvidence.labels.includes('Outline') && mediaEvidence.labels.includes('Radius') && mediaEvidence.labels.includes('Opacity') && mediaEvidence.labels.includes('Rotate') && !mediaEvidence.labels.includes('Reuse this image'), `Media controls/order are incomplete or redundant: ${JSON.stringify(mediaEvidence.labels)}`)
  assert(mediaEvidence.thumbnail && mediaEvidence.choose && !mediaEvidence.replaceDisabled && mediaEvidence.thicknessHiddenOff && mediaEvidence.thicknessEnabled, `Media preview/actions/dependency failed: ${JSON.stringify(mediaEvidence)}`)
  assert(mediaEvidence.layout.width === '420px' && mediaEvidence.layout.height === '600px' && mediaEvidence.layout.x === 11 && mediaEvidence.layout.y === 13 && mediaEvidence.layout.rotation === 6 && mediaEvidence.style.outlineEnabled === true && mediaEvidence.style.outlineWidth === 4 && mediaEvidence.background.borderRadius === '18px' && mediaEvidence.background.opacity === .8 && mediaEvidence.history <= 10, `Media adapters did not update canonical values: ${JSON.stringify(mediaEvidence)}`)
  await evaluate(`document.querySelector('[data-property-category="media"]').scrollIntoView({block:'start'})`)
  await wait(180)
  await screenshot('phase-037-human-inspector-media.png')

  const roundTripEvidence = await evaluate(`(async()=>{
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const model=await import('/src/editor/editorSnapshot.ts');const presentation=await import('/src/editor/inspectorPresentation.ts');const registry=await import('/src/editor/propertyRegistry.ts');
    const restored=model.deserializeEditorSnapshot(model.serializeEditorSnapshot(editor.draftSnapshot));
    const size=registry.propertyRegistry.find(property=>property.propertyKey==='font.size');const view=presentation.resolveInspectorPresentation(size,'Text');
    return {friendly:presentation.formatInspectorValue(view,restored.typography['portfolio-hero']?.fontSize),canonical:restored.typography['portfolio-hero']?.fontSize,mediaWidth:restored.layout['portfolio-profile-media']?.width,valid:model.validateEditorSnapshot(restored).valid};
  })()`)
  assert(roundTripEvidence.valid && roundTripEvidence.friendly === 52 && roundTripEvidence.canonical === '52px' && roundTripEvidence.mediaWidth === '420px', `Snapshot serialization adapter round trip failed: ${JSON.stringify(roundTripEvidence)}`)

  await evaluate(`document.querySelector('.tbar-save').click()`)
  await waitFor(`document.querySelector('.editor-save-status')?.textContent.trim()==='Saved'`)
  const draftEvidence = await evaluate(`(async()=>{
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const repo=await import('/src/repositories/editorRevisionRepository.ts');
    return {id:editor.draftRevisionId,count:await repo.editorDraftRepository.countDrafts(),fontSize:editor.draftSnapshot.typography['portfolio-hero']?.fontSize,mediaWidth:editor.draftSnapshot.layout['portfolio-profile-media']?.width};
  })()`)
  assert(draftEvidence.id && draftEvidence.count === 1 && draftEvidence.fontSize === '52px' && draftEvidence.mediaWidth === '420px', `Save Draft did not persist friendly edits: ${JSON.stringify(draftEvidence)}`)

  await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');await router.push({name:'admin-dashboard'});await new Promise(resolve=>requestAnimationFrame(resolve));await router.push({name:'admin-edit',query:{draft:editor.draftRevisionId}});return true})()`)
  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.typography['portfolio-hero']?.fontSize==='52px'`)
  const reloadEvidence = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return {fontSize:editor.draftSnapshot.typography['portfolio-hero']?.fontSize,spacing:editor.draftSnapshot.typography['portfolio-hero']?.letterSpacing,color:editor.draftSnapshot.typography['portfolio-hero']?.color,mediaWidth:editor.draftSnapshot.layout['portfolio-profile-media']?.width,mediaOpacity:editor.draftSnapshot.backgrounds['portfolio-profile-media']?.opacity,selected:editor.selectedObjectId}})()`)
  assert(reloadEvidence.fontSize === '52px' && reloadEvidence.spacing === '4px' && reloadEvidence.color === '#8d363a' && reloadEvidence.mediaWidth === '420px' && reloadEvidence.mediaOpacity === .8 && reloadEvidence.selected === 'portfolio-profile-media', `Draft reload did not restore friendly edits/session: ${JSON.stringify(reloadEvidence)}`)

  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
  assert(seriousErrors.length === 0, `unexpected browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)
  process.stdout.write(`${JSON.stringify({ status: 'PASS', initialEvidence, inventoryEvidence, advancedEvidence, typographyEvidence, responsiveEvidence, mediaEvidence, roundTripEvidence, draftEvidence, reloadEvidence, screenshots: ['artifacts/phase-037-human-inspector-typography.png','artifacts/phase-037-human-inspector-media.png'] }, null, 2)}\n`)
} finally {
  socket?.close()
  stopChildren()
  await wait(150)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* Chromium may briefly retain its profile lock. */ }
}
