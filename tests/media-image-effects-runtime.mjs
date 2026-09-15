import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5194'
const cdpPort = 9354
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase-037c-'))
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5194', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5194'))
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

  async function setFileInput(selector, filePath) {
    const { root } = await send('DOM.getDocument', { depth: 1 })
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector })
    if (!nodeId) throw new Error(`File input was not found: ${selector}`)
    await send('DOM.setFileInputFiles', { nodeId, files: [filePath] })
  }

  async function waitFor(expression, timeout = 20_000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(50)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('DOM.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(async()=>{
    const authModule=await import('/src/stores/auth.ts');
    const router=(await import('/src/router/index.ts')).default;
    authModule.useAuthStore().$patch({isAdmin:true,isInitialized:true,isLoading:false});
    await router.push({name:'admin-edit',query:{draft:'new'}});
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-profile-media"]'))`)
  await wait(300)

  await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const object=editor.objects.find(candidate=>candidate.id==='portfolio-profile-media');
    const section=document.querySelector('#section-select');section.value=object.section;section.dispatchEvent(new Event('change',{bubbles:true}));await tick();
    const entity=document.querySelector('#entity-select');entity.value=object.id;entity.dispatchEvent(new Event('change',{bubbles:true}));await tick();
    const group=document.querySelector('[data-property-category="media"]');if(group?.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true'){group.querySelector('.accordion-toggle').click();await tick()}
  })()`)

  const settle = async (milliseconds = 90) => {
    await wait(milliseconds)
    await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
  }

  async function inspect(label) {
    return evaluate(`(()=>{
      const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
      const editor=pinia._s.get('editor');
      const image=document.querySelector('[data-editor-object-id="portfolio-profile-media"]');
      const wrapper=image.closest('.profile-image-wrapper');
      const style=getComputedStyle(image);const wrapperStyle=getComputedStyle(wrapper);
      const rect=image.getBoundingClientRect();const wrapperRect=wrapper.getBoundingClientRect();
      const filterSvg=[...document.querySelectorAll('svg[data-snapshot-image-filter]')].find(node=>node.dataset.snapshotImageFilter==='portfolio-profile-media');
      const morphology=filterSvg?.querySelector('feMorphology');const flood=filterSvg?.querySelector('feFlood');
      const selectors=['.portfolio-title','.decor-stethoscope','.decor-ecg','.decor-pill','.cross-1','.circle-1','.sparkle-1','.portfolio-section'];
      const fingerprint=node=>{const computed=getComputedStyle(node);const bounds=node.getBoundingClientRect();return {selector:node.matches('.portfolio-section')?'section':node.className,inline:node.getAttribute('style')||'',rect:[bounds.x,bounds.y,bounds.width,bounds.height].map(value=>Number(value.toFixed(3))),transform:computed.transform,translate:computed.translate,rotate:computed.rotate,filter:computed.filter,opacity:computed.opacity}};
      const unrelatedCanonical={};for(const domain of ['layout','backgrounds'])unrelatedCanonical[domain]=Object.fromEntries(Object.entries(editor.draftSnapshot[domain]).filter(([id])=>!id.includes('portfolio-profile-media')));
      const layout=editor.draftSnapshot.layout['portfolio-profile-media']??{};
      return {label:${JSON.stringify(label)},tag:image.tagName,className:image.className,selected:editor.selectedObjectId,previewRootIdentity:document.querySelector('.guest-home')?.dataset.phase037cIdentity,
        canonical:{layout:{...layout},media:{...(editor.draftSnapshot.media.styles['portfolio-profile-media']??{})},background:{...(editor.draftSnapshot.backgrounds['portfolio-profile-media']??{})}},
        image:{rect:{width:rect.width,height:rect.height,left:rect.left,top:rect.top},computed:{width:style.width,height:style.height,maxWidth:style.maxWidth,minWidth:style.minWidth,maxHeight:style.maxHeight,minHeight:style.minHeight,aspectRatio:style.aspectRatio,objectFit:style.objectFit,transform:style.transform,translate:style.translate,rotate:style.rotate,opacity:style.opacity,border:style.border,outline:style.outline,boxShadow:style.boxShadow,filter:style.filter,borderRadius:style.borderRadius},inline:image.getAttribute('style'),naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight},
        wrapper:{rect:{width:wrapperRect.width,height:wrapperRect.height},computed:{width:wrapperStyle.width,height:wrapperStyle.height,overflow:wrapperStyle.overflow,transform:wrapperStyle.transform},inline:wrapper.getAttribute('style')},
        alphaFilter:filterSvg?{id:filterSvg.querySelector('filter')?.id,radius:morphology?.getAttribute('radius'),color:flood?.getAttribute('flood-color')}:null,
        siblingFingerprint:selectors.map(selector=>document.querySelector(selector)).filter(Boolean).map(fingerprint),unrelatedCanonical};
    })()`)
  }

  async function setInput(key, value, selector = 'input') {
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const field=document.querySelector('[data-property-key=${JSON.stringify(key)}]');if(!field)throw new Error('Missing field: '+${JSON.stringify(key)});field.scrollIntoView({block:'center'});const input=field.querySelector(${JSON.stringify(selector)});if(!input)throw new Error('Missing input: '+${JSON.stringify(key)});input.value=${JSON.stringify(String(value))};input.dispatchEvent(new Event('input',{bubbles:true}));await tick();})()`)
    await settle()
  }

  async function setColor(key, value) {
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const field=document.querySelector('[data-property-key=${JSON.stringify(key)}]');field.scrollIntoView({block:'center'});field.querySelector('.color-summary').click();await tick();const input=field.querySelector('.picker-head input:not([type="color"])');input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}));await tick();field.querySelector('.color-summary').click();await tick();})()`)
    await settle()
  }

  async function ensureToggle(key, enabled) {
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const field=document.querySelector('[data-property-key=${JSON.stringify(key)}]');if(!field)throw new Error('Missing toggle: '+${JSON.stringify(key)});field.scrollIntoView({block:'center'});const input=field.querySelector('input[type="checkbox"]');if(Boolean(input.checked)!==${enabled})input.click();await tick();})()`)
    await settle()
  }

  await evaluate(`document.querySelector('.guest-home').dataset.phase037cIdentity='stable'`)
  const architecture = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const images=editor.objects.filter(object=>object.type==='Image');return {imageObjects:images.map(object=>({id:object.id,section:object.section,collectionPath:object.ux?.collectionPath??null})),profileCollectionPath:editor.objects.find(object=>object.id==='portfolio-profile-media')?.ux?.collectionPath??null,snapshotEntityOnly:editor.draftSnapshot.entities.find(entity=>entity.entityId==='portfolio-profile-media')};})()`)
  assert(architecture.profileCollectionPath === null, `fixed profile Image unexpectedly declares a repeatable collection: ${JSON.stringify(architecture)}`)

  const panelSemantics = await evaluate(`(()=>{const fields=[...document.querySelectorAll('[data-property-category="media"] .property-field')];return {labels:fields.map(field=>field.querySelector(':scope > span')?.textContent.trim()).filter(Boolean),keys:fields.map(field=>field.dataset.propertyKey),reuseVisible:Boolean(document.querySelector('[data-property-key="media.duplicateReference"]')),genericShadowVisible:Boolean(document.querySelector('[data-property-category="effects"] [data-property-key="effects.shadow"]')),imageShadowCategory:document.querySelector('[data-property-key="effects.shadow"]')?.closest('[data-property-category]')?.dataset.propertyCategory,shadowLabels:[...document.querySelectorAll('[data-property-key="effects.shadow"] .shadow-grid label>span')].map(node=>node.textContent.trim())};})()`)
  for (const label of ['Preview','Upload New Image','Choose from Media','Replace Selected Image','Remove Selected Image','W','H','Hover Style','Outline','Image Shadow','Radius','Opacity','Rotate']) assert(panelSemantics.labels.includes(label), `missing friendly Media control: ${label}; ${JSON.stringify(panelSemantics)}`)
  assert(panelSemantics.reuseVisible && panelSemantics.labels.includes('Duplicate Image') && !panelSemantics.genericShadowVisible && panelSemantics.imageShadowCategory === 'media' && !panelSemantics.shadowLabels.includes('Spread'), `Media action/effect ownership failed: ${JSON.stringify(panelSemantics)}`)

  const before = await inspect('before')
  await setInput('media.width', 400)
  const afterWidth = await inspect('after-width')
  await setInput('media.height', 450)
  const afterHeight = await inspect('after-height')
  assert(afterWidth.canonical.layout.width === '400px' && afterWidth.image.rect.width < before.image.rect.width - 20 && afterWidth.wrapper.rect.width === afterWidth.image.rect.width, `W did not change actual selected IMG geometry: ${JSON.stringify({before:before.image,after:afterWidth.image,wrapper:afterWidth.wrapper})}`)
  assert(afterHeight.canonical.layout.height === '450px' && afterHeight.image.rect.height < afterWidth.image.rect.height - 20 && afterHeight.wrapper.rect.height === afterHeight.image.rect.height, `H did not change actual selected IMG geometry: ${JSON.stringify({before:afterWidth.image,after:afterHeight.image,wrapper:afterHeight.wrapper})}`)

  await setInput('media.positionX', 14)
  await setInput('media.positionY', -8)
  await setInput('media.rotate', 7)
  await setInput('media.radius', 18)
  await setInput('media.opacity', 72)
  const geometry = await inspect('geometry')
  assert(geometry.image.computed.translate === '14px -8px' && geometry.image.computed.rotate === '7deg' && geometry.image.computed.borderRadius === '18px' && Math.abs(Number(geometry.image.computed.opacity) - .72) < .01, `Image geometry/effects did not reach semantic IMG: ${JSON.stringify(geometry.image.computed)}`)

  await ensureToggle('media.hover', true)
  const hoverBefore = await inspect('hover-before')
  const center = await evaluate(`(()=>{const rect=document.querySelector('[data-editor-object-id="portfolio-profile-media"]').getBoundingClientRect();return{x:rect.left+rect.width/2,y:rect.top+rect.height/2}})()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: center.x, y: center.y })
  await wait(260)
  const hoverInside = await inspect('hover-inside')
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 })
  await wait(260)
  const hoverAfter = await inspect('hover-after')
  assert(Number(hoverInside.image.computed.opacity) < Number(hoverBefore.image.computed.opacity) - .05 && Math.abs(Number(hoverAfter.image.computed.opacity) - Number(hoverBefore.image.computed.opacity)) < .01, `real pointer Hover Style did not enter/restore: ${JSON.stringify({before:hoverBefore.image.computed.opacity,inside:hoverInside.image.computed.opacity,after:hoverAfter.image.computed.opacity})}`)

  await ensureToggle('media.outlineEnabled', true)
  const outlineDependencies = await evaluate(`(()=>({thickness:Boolean(document.querySelector('[data-property-key="media.outlineWidth"] input:not(:disabled)')),color:Boolean(document.querySelector('[data-property-key="media.border"] button:not(:disabled)'))}))()`)
  assert(outlineDependencies.thickness && outlineDependencies.color, `Outline dependencies did not become available: ${JSON.stringify(outlineDependencies)}`)
  await setInput('media.outlineWidth', 2)
  const outlineThin = await inspect('outline-thin')
  await setInput('media.outlineWidth', 6)
  await setColor('media.border', '#b85b69')
  const outline = await inspect('outline')
  assert(outlineThin.alphaFilter?.radius === '2' && outline.alphaFilter?.radius === '6' && outline.alphaFilter?.color === '#b85b69', `alpha outline Thickness/Color did not update SVG SourceAlpha filter: ${JSON.stringify({thin:outlineThin.alphaFilter,outline:outline.alphaFilter})}`)
  assert(/url\(/.test(outline.image.computed.filter) && outline.image.computed.boxShadow === 'none' && !/solid 6px/.test(outline.image.computed.outline), `Image Outline fell back to a rectangular element effect: ${JSON.stringify(outline.image.computed)}`)

  const historyBeforeShadow = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').commandHistory.length`)
  await ensureToggle('effects.shadow', true)
  const shadow = await inspect('shadow')
  assert(/drop-shadow\(/.test(shadow.image.computed.filter) && shadow.image.computed.boxShadow === 'none' && shadow.canonical.background.boxShadow, `Image Shadow is not alpha-aware: ${JSON.stringify(shadow)}`)
  const shadowHistory = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const after=editor.commandHistory.length;editor.undo();return {after,canonical:editor.draftSnapshot.backgrounds['portfolio-profile-media']?.boxShadow??''}})()`)
  await settle()
  const shadowUndo = await inspect('shadow-undo')
  await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').redo()`)
  await settle()
  const shadowRedo = await inspect('shadow-redo')
  assert(shadowHistory.after === Math.min(10, historyBeforeShadow + 1) && !/drop-shadow\(/.test(shadowUndo.image.computed.filter) && /drop-shadow\(/.test(shadowRedo.image.computed.filter), `Image Shadow Undo/Redo failed: ${JSON.stringify({shadowHistory,undo:shadowUndo.image.computed.filter,redo:shadowRedo.image.computed.filter})}`)

  const isolation = await inspect('isolation')
  assert(JSON.stringify(before.siblingFingerprint) === JSON.stringify(isolation.siblingFingerprint) && JSON.stringify(before.unrelatedCanonical) === JSON.stringify(isolation.unrelatedCanonical) && isolation.selected === 'portfolio-profile-media' && isolation.previewRootIdentity === 'stable', `Image property mutation leaked to sibling/section or remounted Preview: ${JSON.stringify({before:before.siblingFingerprint,after:isolation.siblingFingerprint,selected:isolation.selected,root:isolation.previewRootIdentity})}`)

  const responsive = await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const settle=async()=>{await tick();await new Promise(resolve=>setTimeout(resolve,80));await tick()};const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const module=await import('/src/editor/responsiveLayout.ts');const click=async id=>{document.querySelector('[data-canvas-preset="'+id+'"]').click();await settle()};await click('laptop-1024');const width=document.querySelector('[data-property-key="media.width"] input');width.value='360';width.dispatchEvent(new Event('input',{bubbles:true}));await settle();const outlineWidth=document.querySelector('[data-property-key="media.outlineWidth"] input');outlineWidth.value='8';outlineWidth.dispatchEvent(new Event('input',{bubbles:true}));await settle();const overrideId=module.responsiveSnapshotEntityId('laptop','portfolio-profile-media');const image=document.querySelector('[data-editor-object-id="portfolio-profile-media"]');const tablet={baseWidth:editor.draftSnapshot.layout['portfolio-profile-media'].width,overrideWidth:editor.draftSnapshot.layout[overrideId]?.width,baseOutline:editor.draftSnapshot.media.styles['portfolio-profile-media'].outlineWidth,overrideOutline:editor.draftSnapshot.media.styles[overrideId]?.outlineWidth,computedWidth:getComputedStyle(image).width,radius:document.querySelector('svg[data-snapshot-image-filter="portfolio-profile-media"] feMorphology')?.getAttribute('radius')};await click('desktop-1440');const desktop={computedWidth:getComputedStyle(image).width,radius:document.querySelector('svg[data-snapshot-image-filter="portfolio-profile-media"] feMorphology')?.getAttribute('radius')};return {overrideId,tablet,desktop,selected:editor.selectedObjectId,root:document.querySelector('.guest-home').dataset.phase037cIdentity};})()`)
  assert(responsive.tablet.baseWidth === '400px' && responsive.tablet.overrideWidth === '360px' && responsive.tablet.baseOutline === 6 && responsive.tablet.overrideOutline === 8 && responsive.tablet.computedWidth === '360px' && responsive.tablet.radius === '8', `Tablet sparse Image override failed: ${JSON.stringify(responsive)}`)
  assert(responsive.desktop.computedWidth === '400px' && responsive.desktop.radius === '6' && responsive.selected === 'portfolio-profile-media' && responsive.root === 'stable', `Desktop Image base was overwritten by Tablet: ${JSON.stringify(responsive)}`)

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  await evaluate(`(()=>{const field=document.querySelector('[data-property-key="effects.shadow"]');field.scrollIntoView({block:'center'});document.querySelector('.control-panel').scrollTop=Math.max(0,field.offsetTop-180);return true})()`)
  await settle(150)
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-037c-alpha-image-effects.png'), Buffer.from(screenshot.data, 'base64'))

  const actionSetup = await evaluate(`(async()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');await library.refresh();const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media');return {assignment:assignment?.assetId,assets:library.assets.length,assetIds:library.assets.map(item=>item.id),instances:editor.draftSnapshot.instances.map(item=>item.instanceId),history:editor.commandHistory.length,selected:editor.selectedObjectId}})()`)
  const uploadFile = path.join(projectRoot, 'public', 'social-preview.webp')
  await setFileInput('[data-property-key="media.upload"] input[type="file"]', uploadFile)
  await wait(150)
  await waitFor(`(()=>{const library=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('media-library');return !library.mutating})()`)
  const upload = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const previousIds=new Set(${JSON.stringify(actionSetup.assetIds)});const asset=library.assets.find(item=>!previousIds.has(item.id));const instance=editor.draftSnapshot.instances.find(item=>!${JSON.stringify(actionSetup.instances)}.includes(item.instanceId));const instanceAssignment=instance?editor.draftSnapshot.media.assignments.find(item=>item.entityId===instance.instanceId):null;return {asset:asset?{id:asset.id,name:asset.name,path:asset.storagePath,persisted:asset.metadataPersisted}:null,assetNames:library.assets.map(item=>({id:item.id,name:item.name,path:item.storagePath})),assignment:editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId,assets:library.assets.length,libraryError:library.error,status:document.querySelector('.save-status')?.textContent?.trim()??'',history:editor.commandHistory.length,selected:editor.selectedObjectId,instances:editor.draftSnapshot.instances.map(item=>item.instanceId),instance:instance?{id:instance.instanceId,assetId:instanceAssignment?.assetId}:null}})()`)
  assert(upload.asset, `Upload New Image did not register an Asset Library row: ${JSON.stringify(upload)}`)
  assert(upload.assignment === actionSetup.assignment && upload.assets === actionSetup.assets + 1 && upload.history === Math.min(10, actionSetup.history + 1) && upload.asset.path.startsWith('draft/library/') && upload.asset.persisted && upload.instances.length === actionSetup.instances.length + 1 && upload.instance?.assetId === upload.asset.id && upload.selected === upload.instance?.id, `Upload New Image failed to insert an independent canonical instance: ${JSON.stringify({actionSetup,upload})}`)

  await evaluate(`document.querySelector('[data-property-key="media.choose"] button').click()`)
  await waitFor(`Boolean(document.querySelector('.asset-picker'))`)
  const browse = await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const before=editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId;const history=editor.commandHistory.length;const instanceIds=editor.draftSnapshot.instances.map(item=>item.instanceId);const card=document.querySelector('[data-asset-card-id="'+CSS.escape(${JSON.stringify(upload.asset.id)})+'"]');card.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await tick();await tick();const instance=editor.draftSnapshot.instances.find(item=>!instanceIds.includes(item.instanceId));return {before,after:editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId,historyBefore:history,historyAfter:editor.commandHistory.length,pickerClosed:!document.querySelector('.asset-picker'),instanceCountBefore:instanceIds.length,instanceCountAfter:editor.draftSnapshot.instances.length,newInstance:instance?{id:instance.instanceId,assetId:editor.draftSnapshot.media.assignments.find(item=>item.entityId===instance.instanceId)?.assetId}:null,selected:editor.selectedObjectId};})()`)
  assert(browse.before === browse.after && browse.historyAfter === Math.min(10, browse.historyBefore + 1) && browse.pickerClosed && browse.instanceCountAfter === browse.instanceCountBefore + 1 && browse.newInstance?.assetId === upload.asset.id && browse.selected === browse.newInstance?.id, `Choose from Media failed to insert an independent canonical instance: ${JSON.stringify(browse)}`)

  await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const object=editor.objects.find(candidate=>candidate.id==='portfolio-profile-media');editor.selectObject(object);await tick();await tick();return editor.selectedObjectId})()`)
  await waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').selectedObjectId==='portfolio-profile-media'`)

  const replaceAssetsBefore = upload.assets
  await evaluate(`document.querySelector('[data-property-key="media.replace"] button').click()`)
  await waitFor(`Boolean(document.querySelector('.asset-picker'))`)
  await evaluate(`(()=>{const card=document.querySelector('[data-asset-card-id="'+CSS.escape(${JSON.stringify(upload.asset.id)})+'"]');if(!card)throw new Error('Uploaded Media Library asset was not found for replacement.');card.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));return true})()`)
  await waitFor(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');return !library.mutating&&!document.querySelector('.asset-picker')&&editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId===${JSON.stringify(upload.asset.id)}})()`)
  const replace = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const asset=library.assets.find(item=>item.id===${JSON.stringify(upload.asset.id)});return {newId:asset.id,path:asset.storagePath,assignment:editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId,assets:library.assets.length,oldAssetStillPresent:library.assets.some(item=>item.id===${JSON.stringify(actionSetup.assignment)}),oldReferenceStillPresent:editor.draftSnapshot.media.references.some(item=>item.assetId===${JSON.stringify(actionSetup.assignment)}),command:editor.commandHistory.at(-1)?.type,selected:editor.selectedObjectId}})()`)
  assert(replace.assignment === replace.newId && replace.assets === replaceAssetsBefore && replace.oldAssetStillPresent && replace.oldReferenceStillPresent && replace.command === 'REPLACE_MEDIA' && replace.selected === 'portfolio-profile-media', `Replace Selected Image was unsafe or mistargeted: ${JSON.stringify(replace)}`)
  const replaceUndoRedo = await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const id=()=>editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId;editor.undo();await tick();const undo=id();editor.redo();await tick();const redo=id();return {undo,redo,selected:editor.selectedObjectId}})()`)
  assert(replaceUndoRedo.undo === actionSetup.assignment && replaceUndoRedo.redo === replace.newId && replaceUndoRedo.selected === 'portfolio-profile-media', `Replace Undo/Redo failed: ${JSON.stringify(replaceUndoRedo)}`)

  await evaluate(`document.querySelector('[data-property-key="media.remove"] button').click()`)
  await settle()
  const remove = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const removed=!editor.draftSnapshot.media.assignments.some(item=>item.entityId==='portfolio-profile-media');const assetStillPresent=library.assets.some(item=>item.id===${JSON.stringify(replace.newId)});const command=editor.commandHistory.at(-1)?.type;editor.undo();return {removed,assetStillPresent,command,selected:editor.selectedObjectId}})()`)
  await settle()
  const removeRestored = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId`)
  assert(remove.removed && remove.assetStillPresent && remove.command === 'DELETE_MEDIA' && removeRestored === replace.newId && remove.selected === 'portfolio-profile-media', `Remove Selected Image deleted the asset or failed Undo: ${JSON.stringify({remove,removeRestored})}`)

  await evaluate(`document.querySelector('.tbar-save').click()`)
  await waitFor(`document.querySelector('.editor-save-status')?.textContent.trim()==='Saved'`)
  const draftSaved = await evaluate(`(async()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const repo=await import('/src/repositories/editorRevisionRepository.ts');return {id:editor.draftRevisionId,count:await repo.editorDraftRepository.countDrafts(),assignment:editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId,width:editor.draftSnapshot.layout['portfolio-profile-media']?.width,height:editor.draftSnapshot.layout['portfolio-profile-media']?.height,outline:editor.draftSnapshot.media.styles['portfolio-profile-media'],background:editor.draftSnapshot.backgrounds['portfolio-profile-media']}})()`)
  await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');await router.push({name:'admin-dashboard'});await new Promise(resolve=>requestAnimationFrame(resolve));await router.push({name:'admin-edit',query:{draft:editor.draftRevisionId}});return true})()`)
  await waitFor(`Boolean(document.querySelector('.edit-page'))&&!document.querySelector('.editor-recovery')&&document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId===${JSON.stringify(replace.newId)}`)
  await settle(180)
  const draftReloaded = await inspect('draft-reloaded')
  assert(draftSaved.id && draftSaved.count === 1 && draftReloaded.canonical.layout.width === '400px' && draftReloaded.canonical.layout.height === '450px' && draftReloaded.canonical.media.outlineEnabled && draftReloaded.canonical.media.outlineWidth === 6 && /url\(/.test(draftReloaded.image.computed.filter) && /drop-shadow\(/.test(draftReloaded.image.computed.filter), `Draft/reload lost Image geometry/effects: ${JSON.stringify({draftSaved,draftReloaded})}`)

  const publishedContract = await evaluate(`(async()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const runtime=await import('/src/runtime/publishedSnapshotDom.ts');const host=document.createElement('div');host.className='guest-home';host.style.cssText='position:fixed;left:-2000px;top:0';host.innerHTML='<img data-editor-object-id="portfolio-profile-media" alt="Published fixture">';document.body.append(host);runtime.applyPublishedSnapshotDom(host,JSON.parse(JSON.stringify(editor.draftSnapshot)));const image=host.querySelector('img');const style=getComputedStyle(image);const result={width:style.width,height:style.height,filter:style.filter,boxShadow:style.boxShadow,border:style.border,hoverClass:image.classList.contains('snapshot-runtime-media-hover'),outlineRadius:host.querySelector('feMorphology')?.getAttribute('radius'),outlineColor:host.querySelector('feFlood')?.getAttribute('flood-color'),assignment:editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId};host.remove();return result;})()`)
  assert(publishedContract.width === '400px' && publishedContract.height === '450px' && /url\(/.test(publishedContract.filter) && /drop-shadow\(/.test(publishedContract.filter) && publishedContract.boxShadow === 'none' && publishedContract.hoverClass && publishedContract.outlineRadius === '6' && publishedContract.assignment === replace.newId, `local Published/Guest renderer contract failed: ${JSON.stringify(publishedContract)}`)

  const performance = await evaluate(`new Promise(resolve=>{const root=document.querySelector('.guest-home');const before=root;const frames=[];let previous=performance.now();let count=0;const step=now=>{frames.push(now-previous);previous=now;count+=1;if(count<120)requestAnimationFrame(step);else{const sorted=frames.slice(1).sort((a,b)=>a-b);resolve({fps:Number((1000/(frames.slice(1).reduce((a,b)=>a+b,0)/(frames.length-1))).toFixed(2)),p95:Number(sorted[Math.floor(sorted.length*.95)].toFixed(2)),sameRoot:before===document.querySelector('.guest-home'),filters:document.querySelectorAll('svg[data-snapshot-image-filter]').length})}};requestAnimationFrame(step)})`)
  assert(performance.fps >= 50 && performance.sameRoot && performance.filters <= 1, `Image effect performance/remount regression: ${JSON.stringify(performance)}`)

  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
  assert(seriousErrors.length === 0, `unexpected browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)
  process.stdout.write(`${JSON.stringify({status:'PASS',scope:'Phase 037C Media semantics, computed geometry, alpha-aware effects',architecture,panelSemantics,geometry:{before:before.image.rect,width:afterWidth.image.rect,height:afterHeight.image.rect,final:geometry.image.computed},hover:{before:hoverBefore.image.computed.opacity,inside:hoverInside.image.computed.opacity,after:hoverAfter.image.computed.opacity},outline:{thin:outlineThin.alphaFilter,final:outline.alphaFilter,filter:outline.image.computed.filter},shadow:{canonical:shadow.canonical.background.boxShadow,filter:shadow.image.computed.filter},responsive,actions:{upload,browse,replace,replaceUndoRedo,remove},draftRoundTrip:{saved:draftSaved,reloaded:{canonical:draftReloaded.canonical,filter:draftReloaded.image.computed.filter}},publishedContract,performance,screenshot:'artifacts/phase-037c-alpha-image-effects.png'},null,2)}\n`)
  if (viteErrors.trim()) process.stderr.write(viteErrors)
  if (browserErrors.includes('ERROR:')) process.stderr.write(browserErrors)
} finally {
  socket?.close()
  stopChildren()
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}
