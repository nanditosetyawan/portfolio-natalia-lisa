import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5182'
const cdpPort = 9342
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase032-chrome-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(`Phase 032 runtime failure: ${message}`)
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5182', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5182'))
    if (!page) await wait(100)
  }
  if (!page) throw new Error('Phase 032 browser target not found.')

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
  await evaluate(`(()=>{globalThis.__phase032Unhandled=[];addEventListener('unhandledrejection',(event)=>globalThis.__phase032Unhandled.push(String(event.reason?.stack??event.reason)));return true})()`)

  try {
    await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
    await evaluate(`(async()=>{const auth=(await import('/src/stores/auth.ts')).useAuthStore();const router=(await import('/src/router/index.ts')).default;auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});await router.push('/admin/media');return true})()`)
    await waitFor(`Boolean(document.querySelector('.media-library-page')) && Boolean(document.querySelector('[data-asset-card-id="media-profile-primary"]'))`)
  } catch (error) {
    const diagnostics = await evaluate(`({url:location.href,body:document.body.innerText.slice(0,2600)})`)
    throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}; vite=${viteErrors}; browser=${browserErrors}; runtime=${runtimeErrors.join(' | ')}`)
  }

  const baseEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const library=pinia._s.get('media-library');
    const asset=library.assets.find(candidate=>candidate.id==='media-profile-primary');const card=document.querySelector('[data-asset-card-id="media-profile-primary"]');card.click();await tick();
    const filters=[...document.querySelectorAll('.filter-tabs button')].map(button=>button.textContent.trim());
    const details=document.querySelector('.asset-details').innerText;const usageButtons=document.querySelectorAll('.usage-section button').length;
    const favorite=card.querySelector('.favorite-button');favorite.click();await tick();
    const favoriteStored=JSON.parse(localStorage.getItem('portfolio:media-favorites:v1')??'[]').includes(asset.id);
    const deleteDisabled=document.querySelector('.bulk-toolbar .danger')?.disabled;
    return {assetCount:library.assets.length,id:asset?.id,usageCount:asset?.usageCount,builtIn:asset?.isBuiltIn,filters,details,usageButtons,favoriteStored,deleteDisabled,location:asset?.location};
  })()`)
  assert(baseEvidence.assetCount >= 1 && baseEvidence.id === 'media-profile-primary' && baseEvidence.usageCount === 3 && baseEvidence.builtIn, `default asset aggregation failed: ${JSON.stringify(baseEvidence)}`)
  for (const label of ['Images','Icons','Background','Logo','Unused','Recently uploaded','Favorites']) assert(baseEvidence.filters.some((value) => value.includes(label)), `asset filter missing: ${label}`)
  assert(baseEvidence.details.includes('Dimensions') && baseEvidence.details.includes('Mime type') && baseEvidence.details.includes('Location') && baseEvidence.usageButtons === 3 && baseEvidence.favoriteStored && baseEvidence.deleteDisabled, 'details, usage, favorites, or built-in delete safety failed')

  const mutationEvidence = await evaluate(`(async()=>{
    const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const library=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('media-library');
    const input=document.querySelector('input[type="file"][multiple]');const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),character=>character.charCodeAt(0));
    const transfer=new DataTransfer();for(const name of ['phase32-one.png','phase32-two.png','phase32-three.png'])transfer.items.add(new File([bytes],name,{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    for(let attempt=0;attempt<120&&(library.mutating||library.assets.filter(asset=>asset.storagePath?.startsWith('draft/library/')).length<3);attempt+=1)await wait(25);await tick();
    const uploads=library.assets.filter(asset=>asset.storagePath?.startsWith('draft/library/'));const ids=uploads.map(asset=>asset.id);
    const card=(id)=>document.querySelector('[data-asset-card-id="'+CSS.escape(id)+'"]');card(ids[0]).click();card(ids[1]).dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await tick();
    const multiSelected=document.querySelectorAll('.asset-card[aria-selected="true"]').length;[...document.querySelectorAll('.bulk-toolbar button')].find(button=>button.textContent.includes('Favorite')).click();await tick();
    const multiFavorites=ids.slice(0,2).every(id=>library.assets.find(asset=>asset.id===id)?.isFavorite);
    let downloadClicks=0;const originalAnchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){downloadClicks+=1};[...document.querySelectorAll('.bulk-toolbar button')].find(button=>button.textContent.includes('Download')).click();for(let attempt=0;attempt<60&&downloadClicks<2;attempt+=1)await wait(20);HTMLAnchorElement.prototype.click=originalAnchorClick;
    [...document.querySelectorAll('.bulk-toolbar button')].find(button=>button.textContent.includes('Rename')).click();await tick();let bulkInput=document.querySelector('.library-dialog input');bulkInput.value='Batch Asset';bulkInput.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.library-dialog').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));for(let attempt=0;attempt<80&&!ids.slice(0,2).every(id=>library.assets.find(asset=>asset.id===id)?.name.startsWith('Batch Asset'));attempt+=1)await wait(20);await tick();const bulkRenamed=ids.slice(0,2).every(id=>library.assets.find(asset=>asset.id===id)?.name.startsWith('Batch Asset'));
    [...document.querySelectorAll('.bulk-toolbar button')].find(button=>button.textContent.includes('Move')).click();await tick();bulkInput=document.querySelector('.library-dialog input');bulkInput.value='batch/set';bulkInput.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.library-dialog').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));for(let attempt=0;attempt<80&&!ids.slice(0,2).every(id=>library.assets.find(asset=>asset.id===id)?.folder.includes('batch/set'));attempt+=1)await wait(20);await tick();const bulkMoved=ids.slice(0,2).every(id=>library.assets.find(asset=>asset.id===id)?.folder.includes('batch/set'));
    document.querySelector('.clear-selection').click();card(ids[0]).click();await tick();
    [...document.querySelectorAll('.bulk-toolbar button')].find(button=>button.textContent.includes('Rename')).click();await tick();const rename=document.querySelector('.library-dialog input');rename.value='Editorial Portrait';rename.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.library-dialog').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    for(let attempt=0;attempt<80&&library.assets.find(asset=>asset.id===ids[0])?.name!=='Editorial Portrait';attempt+=1)await wait(20);await tick();
    [...document.querySelectorAll('.bulk-toolbar button')].find(button=>button.textContent.includes('Move')).click();await tick();const folder=document.querySelector('.library-dialog input');folder.value='campaign/portraits';folder.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.library-dialog').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    for(let attempt=0;attempt<80&&!library.assets.find(asset=>asset.id===ids[0])?.folder.includes('campaign/portraits');attempt+=1)await wait(20);await tick();
    document.querySelector('.clear-selection').click();card(ids[1]).click();card(ids[2]).dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));await tick();document.querySelector('.bulk-toolbar .danger').click();await tick();[...document.querySelectorAll('.library-dialog button')].find(button=>button.textContent.includes('Delete permanently')).click();
    for(let attempt=0;attempt<80&&ids.slice(1).some(id=>library.assets.some(asset=>asset.id===id));attempt+=1)await wait(20);await tick();
    const renamed=library.assets.find(asset=>asset.id===ids[0]);
    return {ids,uploadCount:uploads.length,multiSelected,multiFavorites,downloadClicks,bulkRenamed,bulkMoved,renamed:renamed?.name,folder:renamed?.folder,deleted:ids.slice(1).every(id=>!library.assets.some(asset=>asset.id===id)),safe:renamed?.safeToDelete,status:document.querySelector('.library-status').textContent};
  })()`)
  assert(mutationEvidence.uploadCount === 3 && mutationEvidence.multiSelected === 2 && mutationEvidence.multiFavorites && mutationEvidence.downloadClicks === 2 && mutationEvidence.bulkRenamed && mutationEvidence.bulkMoved, `upload or bulk actions failed: ${JSON.stringify(mutationEvidence)}`)
  assert(mutationEvidence.renamed === 'Editorial Portrait' && mutationEvidence.folder.includes('campaign/portraits') && mutationEvidence.deleted && mutationEvidence.safe, `rename/move/delete safety failed: ${JSON.stringify(mutationEvidence)}`)

  const beforeMetrics = await send('Performance.getMetrics')
  const performanceEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const library=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('media-library');const source=library.assets[0].sourceUrl;
    const fixtures=Array.from({length:260},(_,index)=>({id:'phase32-fixture-'+String(index).padStart(3,'0'),name:'Fixture '+String(index).padStart(3,'0'),kind:index%11===0?'icon':'image',mimeType:'image/png',sourceUrl:source,thumbnailUrl:source,bucket:null,storagePath:null,folder:'fixture/folder',width:1200,height:800,fileSize:1024+index,createdAt:new Date(Date.now()-index*1000).toISOString(),updatedAt:new Date().toISOString(),lastUsedAt:null,location:'Library',safety:'used',safeToDelete:false,isBuiltIn:false,isFavorite:false,metadataPersisted:false,usages:[],usageCount:index%5}));library.$patch({assets:[...library.assets,...fixtures]});await tick();
    const total=library.assets.length;const rendered=document.querySelectorAll('.asset-card').length;const input=document.querySelector('[data-media-search]');const started=performance.now();for(let index=0;index<80;index+=1){input.value=index===79?'fixture 259':'fixture '+index;input.dispatchEvent(new Event('input',{bubbles:true}));}await tick();const searchDuration=performance.now()-started;const searched=document.querySelectorAll('.asset-card').length;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const first=document.querySelector('.asset-card');first.focus();first.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await tick();const keyboardSelected=document.querySelector('.asset-card[aria-selected="true"]')?.dataset.assetCardId??null;
    const unlabeled=[...document.querySelectorAll('.media-library-page button,.media-library-page input,.media-library-page select')].filter(element=>!(element.getAttribute('aria-label')||element.textContent.trim()||element.closest('label'))).length;
    const grid=document.querySelector('[role="grid"]');const focusStyle=getComputedStyle(document.activeElement);const focusVisible=focusStyle.outlineStyle!=='none'&&Number.parseFloat(focusStyle.outlineWidth)>0;
    return {total,rendered,searched,searchDuration,keyboardSelected,unlabeled,rowCount:grid.getAttribute('aria-rowcount'),colCount:grid.getAttribute('aria-colcount'),focusVisible};
  })()`)
  const afterMetrics = await send('Performance.getMetrics')
  const metricMap = (result) => Object.fromEntries(result.metrics.map((metric) => [metric.name, metric.value]))
  const before = metricMap(beforeMetrics); const after = metricMap(afterMetrics)
  const performanceMetrics = { scriptSeconds: Number(((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)).toFixed(5)), layouts: (after.LayoutCount ?? 0) - (before.LayoutCount ?? 0) }
  assert(performanceEvidence.total >= 260 && performanceEvidence.rendered < 70 && performanceEvidence.searched === 1, `virtualization or instant search failed: ${JSON.stringify(performanceEvidence)}`)
  assert(performanceEvidence.searchDuration < 250 && performanceEvidence.keyboardSelected && performanceEvidence.unlabeled === 0 && Number(performanceEvidence.rowCount) > 0 && Number(performanceEvidence.colCount) > 0 && performanceEvidence.focusVisible, `performance/accessibility failed: ${JSON.stringify(performanceEvidence)}`)

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  const libraryShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-032-asset-library.png'), Buffer.from(libraryShot.data, 'base64'))

  const editorEvidence = await evaluate(`(async()=>{
    const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const app=document.querySelector('#app').__vue_app__;const pinia=app.config.globalProperties.$pinia;const library=pinia._s.get('media-library');library.$patch({assets:library.assets.filter(asset=>!asset.id.startsWith('phase32-fixture-'))});
    const asset=library.assets.find(candidate=>candidate.name==='Editorial Portrait');const search=document.querySelector('[data-media-search]');search.value='Lisa Natalia';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();document.querySelector('[data-asset-card-id="media-profile-primary"]').click();await tick();document.querySelector('.usage-section button').click();
    for(let attempt=0;attempt<180&&(!document.querySelector('.edit-page')||document.querySelector('.editor-recovery')||!document.querySelector('[data-property-key="media.choose"]'));attempt+=1)await wait(30);await tick();
    const editor=pinia._s.get('editor');const routeSelected=editor.selectedObjectId;const choose=document.querySelector('[data-property-key="media.choose"]');choose.click();
    for(let attempt=0;attempt<80&&!document.querySelector('.asset-picker');attempt+=1)await wait(20);await tick();
    const pickerSearch=document.querySelector('.asset-picker input[type="search"]');const tabs=[...document.querySelectorAll('.picker-tabs button')].map(button=>button.textContent.trim());pickerSearch.value='Editorial Portrait';pickerSearch.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const pickerCard=document.querySelector('[data-asset-card-id="'+CSS.escape(asset.id)+'"]');pickerCard.focus();pickerCard.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));await tick();const keyboard=Boolean(document.querySelector('.asset-picker .asset-card[aria-selected="true"]'));
    return {assetId:asset.id,routeSelected,tabs,keyboard,pickerOpen:Boolean(document.querySelector('.asset-picker')),pickerCard:Boolean(pickerCard),controls:[...document.querySelectorAll('[data-property-category="media"] .property-field>span')].map(node=>node.textContent.trim())};
  })()`)
  assert(editorEvidence.routeSelected === 'portfolio-profile-media' && editorEvidence.pickerOpen && editorEvidence.pickerCard && editorEvidence.keyboard, `usage deep link or picker failed: ${JSON.stringify(editorEvidence)}`)
  for (const label of ['Upload','Choose Existing','Replace','Remove','Duplicate Reference','Reveal in Library']) assert(editorEvidence.controls.includes(label), `Editor media action missing: ${label}`)
  assert(['All','Favorites','Recent'].every((tab) => editorEvidence.tabs.includes(tab)), 'picker Favorites/Recent tabs are incomplete')

  const pickerShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-032-media-picker.png'), Buffer.from(pickerShot.data, 'base64'))

  const bindingEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const asset=library.assets.find(candidate=>candidate.name==='Editorial Portrait');
    const pickerCard=document.querySelector('[data-asset-card-id="'+CSS.escape(asset.id)+'"]');pickerCard.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await tick();const area='portfolio-profile-media';const applied=editor.draftSnapshot.media.assignments.find(item=>item.entityId===area)?.assetId;const command=editor.commandHistory.at(-1)?.type;const pickerClosed=!document.querySelector('.asset-picker');
    const beforeRefs=editor.draftSnapshot.media.references.length;document.querySelector('[data-property-key="media.duplicateReference"]').click();await tick();const duplicated=editor.draftSnapshot.media.assignments.find(item=>item.entityId===area)?.assetId;const afterRefs=editor.draftSnapshot.media.references.length;editor.undo();await tick();
    document.querySelector('[data-property-key="media.remove"]').click();await tick();const removed=!editor.draftSnapshot.media.assignments.some(item=>item.entityId===area);editor.undo();await tick();const restored=editor.draftSnapshot.media.assignments.find(item=>item.entityId===area)?.assetId===applied;
    let revealed='';const originalOpen=window.open;window.open=(url)=>{revealed=String(url);return null};document.querySelector('[data-property-key="media.reveal"]').click();window.open=originalOpen;
    document.querySelector('[data-property-key="media.choose"]').click();for(let attempt=0;attempt<60&&!document.querySelector('.asset-picker');attempt+=1)await wait(20);await tick();
    const target=[...document.querySelectorAll('[data-editor-object-id="portfolio-profile-media"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];const transfer=new DataTransfer();transfer.setData('application/x-portfolio-asset',asset.id);target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer,clientX:target.getBoundingClientRect().left+3,clientY:target.getBoundingClientRect().top+3}));await tick();const highlighted=target.classList.contains('editor-media-drop-target');target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer,clientX:target.getBoundingClientRect().left+3,clientY:target.getBoundingClientRect().top+3}));await tick();const dropped=editor.draftSnapshot.media.assignments.find(item=>item.entityId===area)?.assetId===asset.id;const mediaElement=document.querySelector('[data-media-usage-id="portfolio-profile-media"]')??document.querySelector('[data-editor-object-id="portfolio-profile-media"]');const previewSource=mediaElement?.matches('img')?mediaElement.src:mediaElement?.querySelector('img')?.src??'';
    return {applied,command,pickerClosed,beforeRefs,afterRefs,duplicated,removed,restored,revealed,highlighted,dropped,previewSource,selection:editor.selectedObjectId,history:editor.commandHistory.length};
  })()`)
  assert(bindingEvidence.applied === editorEvidence.assetId && bindingEvidence.command === 'SET_IMAGE_REFERENCE' && bindingEvidence.pickerClosed, `picker apply did not bind Snapshot: ${JSON.stringify(bindingEvidence)}`)
  assert(bindingEvidence.duplicated !== bindingEvidence.applied && bindingEvidence.afterRefs === bindingEvidence.beforeRefs + 1 && bindingEvidence.removed && bindingEvidence.restored, 'duplicate/remove/undo reference workflow failed')
  assert(bindingEvidence.revealed.includes('/admin/media') && bindingEvidence.revealed.includes('asset=') && bindingEvidence.highlighted && bindingEvidence.dropped && bindingEvidence.previewSource.startsWith('blob:') && bindingEvidence.selection === 'portfolio-profile-media' && bindingEvidence.history <= 10, `reveal, live preview, or drag/drop workflow failed: ${JSON.stringify(bindingEvidence)}`)

  const unhandled = await evaluate(`globalThis.__phase032Unhandled ?? []`)
  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(error))
  assert(unhandled.length === 0 && seriousErrors.length === 0, `browser runtime errors: ${[...unhandled, ...seriousErrors].join(' | ')}`)

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    scope: 'Phase 032 local Asset Library and Editor integration runtime',
    base: baseEvidence,
    mutations: mutationEvidence,
    performance: performanceEvidence,
    devToolsMetrics: performanceMetrics,
    editor: editorEvidence,
    binding: bindingEvidence,
    screenshots: ['artifacts/phase-032-asset-library.png','artifacts/phase-032-media-picker.png']
  }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* already closed */ }
  stopChildren()
  await wait(350)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }) } catch { /* Chromium may briefly retain its lock. */ }
}
