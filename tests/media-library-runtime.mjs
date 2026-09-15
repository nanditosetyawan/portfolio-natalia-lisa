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
    await waitFor(`document.querySelectorAll('.admin-media-page .media-card').length===4 && Boolean(document.querySelector('.admin-media-page .media-badge'))`)
  } catch (error) {
    const diagnostics = await evaluate(`({url:location.href,body:document.body.innerText.slice(0,2600)})`)
    throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}; vite=${viteErrors}; browser=${browserErrors}; runtime=${runtimeErrors.join(' | ')}`)
  }

  const restorationEvidence = await evaluate(`(async()=>{
    const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));const router=(await import('/src/router/index.ts')).default;
    const categories=[...document.querySelectorAll('.admin-media-page .media-card')].map(card=>card.querySelector('.card-title')?.textContent?.trim());
    const firstCard=document.querySelector('.admin-media-page .media-card');const firstCardStyle=getComputedStyle(firstCard);const borderRadius=firstCardStyle.borderRadius;const background=firstCardStyle.backgroundColor;const advancedOnMain=Boolean(document.querySelector('.library-tools,.filter-tabs,.asset-details'));
    const imageBadge=[...document.querySelectorAll('.admin-media-page .media-card')].find(card=>card.querySelector('.card-title')?.textContent?.trim()==='Gambar')?.querySelector('.media-badge')?.textContent?.trim();
    await router.push('/admin/media/images');for(let attempt=0;attempt<100&&!document.querySelector('.media-library-page .page-header .page-title');attempt+=1)await wait(20);const images={title:document.querySelector('.media-library-page .page-header .page-title')?.textContent?.trim(),cards:document.querySelectorAll('.media-grid .media-card').length,hasRealThumbnail:Boolean(document.querySelector('.media-grid .media-card img'))};
    await router.push('/admin/media/videos');for(let attempt=0;attempt<100&&document.querySelector('.media-library-page .page-header .page-title')?.textContent?.trim()!=='Galeri Video';attempt+=1)await wait(20);const videos={title:document.querySelector('.media-library-page .page-header .page-title')?.textContent?.trim(),count:document.querySelector('.media-library-page .item-count')?.textContent?.trim()};
    await router.push('/admin/media/documents');for(let attempt=0;attempt<100&&document.querySelector('.media-library-page .page-header .page-title')?.textContent?.trim()!=='Galeri Dokumen';attempt+=1)await wait(20);const documents={title:document.querySelector('.media-library-page .page-header .page-title')?.textContent?.trim(),count:document.querySelector('.media-library-page .item-count')?.textContent?.trim()};
    await router.push('/admin/media');for(let attempt=0;attempt<100&&!document.querySelector('.admin-media-page');attempt+=1)await wait(20);
    return {categories,borderRadius,background,advancedOnMain,imageBadge,images,videos,documents};
  })()`)
  assert(JSON.stringify(restorationEvidence.categories) === JSON.stringify(['Upload','Gambar','Video','Dokumen']) && restorationEvidence.borderRadius === '24px' && !restorationEvidence.advancedOnMain && Number(restorationEvidence.imageBadge) > 0, `original Manage Media UI was not restored: ${JSON.stringify(restorationEvidence)}`)
  assert(restorationEvidence.images.title === 'Galeri Gambar' && restorationEvidence.images.cards > 0 && restorationEvidence.images.hasRealThumbnail && restorationEvidence.videos.title === 'Galeri Video' && restorationEvidence.documents.title === 'Galeri Dokumen', `restored gallery routes or repository bindings failed: ${JSON.stringify(restorationEvidence)}`)

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  const restoredShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-033a-restored-admin-media.png'), Buffer.from(restoredShot.data, 'base64'))

  const restoredCrudEvidence = await evaluate(`(async()=>{
    const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const router=(await import('/src/router/index.ts')).default;const library=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('media-library');
    [...document.querySelectorAll('.admin-media-page .media-card')].find(card=>card.querySelector('.card-title')?.textContent?.trim()==='Upload').click();for(let attempt=0;attempt<100&&!document.querySelector('.upload-workspace input[type="file"]');attempt+=1)await wait(20);await tick();
    const input=document.querySelector('.upload-workspace input[type="file"]');const transfer=new DataTransfer();transfer.items.add(new File([new TextEncoder().encode('%PDF-1.4\\n%%EOF')],'phase33a-proof.pdf',{type:'application/pdf'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));await tick();document.querySelector('.submit-upload-btn').click();
    for(let attempt=0;attempt<120&&!library.assets.some(asset=>asset.mimeType==='application/pdf');attempt+=1)await wait(25);await tick();const uploaded=library.assets.find(asset=>asset.mimeType==='application/pdf');
    await router.push('/admin/media/documents');for(let attempt=0;attempt<100&&!document.querySelector('.media-card');attempt+=1)await wait(20);document.querySelector('.action-edit').click();await tick();const rename=document.querySelector('.modal-input');rename.value='Restored Document';rename.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('.modal-btn-save').click();for(let attempt=0;attempt<80&&library.assets.find(asset=>asset.id===uploaded?.id)?.name!=='Restored Document';attempt+=1)await wait(20);await tick();const renamed=library.assets.find(asset=>asset.id===uploaded?.id)?.name==='Restored Document';
    document.querySelector('.action-view').click();await tick();const realPreview=Boolean(document.querySelector('.modal-doc-viewer iframe'));document.querySelector('.modal-close-btn').click();await tick();const deleteButton=document.querySelector('.action-delete');const deleteEnabled=!deleteButton.disabled;deleteButton.click();await tick();document.querySelector('.modal-btn-danger').click();for(let attempt=0;attempt<80&&library.assets.some(asset=>asset.id===uploaded?.id);attempt+=1)await wait(20);await tick();const deleted=!library.assets.some(asset=>asset.id===uploaded?.id);
    return {uploaded:Boolean(uploaded),storagePath:uploaded?.storagePath,renamed,realPreview,deleteEnabled,deleted};
  })()`)
  assert(restoredCrudEvidence.uploaded && restoredCrudEvidence.storagePath?.startsWith('draft/library/') && restoredCrudEvidence.renamed && restoredCrudEvidence.realPreview && restoredCrudEvidence.deleteEnabled && restoredCrudEvidence.deleted, `restored Upload/Document repository workflow failed: ${JSON.stringify(restoredCrudEvidence)}`)

  try {
    await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;await router.push('/admin/media/library');return true})()`)
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
    const thumbnail=card.querySelector('img');const favorite=card.querySelector('.favorite-button');favorite.click();await tick();
    const favoriteStored=JSON.parse(localStorage.getItem('portfolio:media-favorites:v1')??'[]').includes(asset.id);
    favorite.click();await tick();const favoriteRemoved=!JSON.parse(localStorage.getItem('portfolio:media-favorites:v1')??'[]').includes(asset.id);favorite.click();await tick();
    const deleteDisabled=document.querySelector('.bulk-toolbar .danger')?.disabled;
    const sortOptions=[...document.querySelectorAll('.sort-control option')].map(option=>option.value);
    return {assetCount:library.assets.length,id:asset?.id,usageCount:asset?.usageCount,builtIn:asset?.isBuiltIn,filters,details,usageButtons,favoriteStored,favoriteRemoved,deleteDisabled,location:asset?.location,sortOptions,lazy:thumbnail?.loading,decoding:thumbnail?.decoding,rowIndex:card.getAttribute('aria-rowindex'),colIndex:card.getAttribute('aria-colindex'),cardLabel:card.getAttribute('aria-label')};
  })()`)
  assert(baseEvidence.assetCount >= 1 && baseEvidence.id === 'media-profile-primary' && baseEvidence.usageCount === 3 && baseEvidence.builtIn, `default asset aggregation failed: ${JSON.stringify(baseEvidence)}`)
  for (const label of ['Images','Icons','Background','Logo','Unused','Recently uploaded','Favorites']) assert(baseEvidence.filters.some((value) => value.includes(label)), `asset filter missing: ${label}`)
  assert(baseEvidence.details.includes('Dimensions') && baseEvidence.details.includes('Mime type') && baseEvidence.details.includes('Location') && baseEvidence.usageButtons === 3 && baseEvidence.favoriteStored && baseEvidence.favoriteRemoved && baseEvidence.deleteDisabled, 'details, usage, favorites, or built-in delete safety failed')
  assert(['newest','oldest','name','size','usage'].every((value) => baseEvidence.sortOptions.includes(value)) && baseEvidence.lazy === 'lazy' && baseEvidence.decoding === 'async' && Number(baseEvidence.rowIndex) > 0 && Number(baseEvidence.colIndex) > 0 && baseEvidence.cardLabel.includes('Lisa Natalia'), `sort, thumbnail, or grid semantics are incomplete: ${JSON.stringify(baseEvidence)}`)

  const mutationEvidence = await evaluate(`(async()=>{
    const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const library=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('media-library');
    const input=document.querySelector('input[type="file"][multiple]');const source=await (await fetch('/social-preview.webp')).blob();
    const transfer=new DataTransfer();for(const name of ['phase32-one.webp','phase32-two.webp','phase32-three.webp'])transfer.items.add(new File([source],name,{type:'image/webp'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
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
    const fixtures=Array.from({length:300},(_,index)=>({id:'phase32-fixture-'+String(index).padStart(3,'0'),name:'Fixture '+String(index).padStart(3,'0'),kind:index%19===0?'logo':index%17===0?'background':index%11===0?'icon':'image',mimeType:'image/png',sourceUrl:source,thumbnailUrl:source,bucket:null,storagePath:null,folder:'fixture/folder',width:1200,height:800,fileSize:1024+index,createdAt:new Date(Date.now()-index*1000).toISOString(),updatedAt:new Date().toISOString(),lastUsedAt:null,location:'Library',safety:'used',safeToDelete:false,isBuiltIn:false,isFavorite:false,metadataPersisted:false,usages:[],usageCount:index%5}));library.$patch({assets:[...library.assets,...fixtures]});await tick();
    const query=(filter,sort='name')=>library.queryAssets({search:'',filter,sort});const monotonic=(items,compare)=>items.every((item,index)=>index===0||compare(items[index-1],item)<=0);
    const sorted={name:monotonic(query('all','name'),(a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id)),oldest:monotonic(query('all','oldest'),(a,b)=>(a.createdAt??'').localeCompare(b.createdAt??'')||a.id.localeCompare(b.id)),newest:monotonic(query('all','newest'),(a,b)=>(b.createdAt??'').localeCompare(a.createdAt??'')||a.id.localeCompare(b.id)),size:monotonic(query('all','size'),(a,b)=>(b.fileSize??-1)-(a.fileSize??-1)||a.id.localeCompare(b.id)),usage:monotonic(query('all','usage'),(a,b)=>b.usageCount-a.usageCount||a.id.localeCompare(b.id))};
    const filterChecks={images:query('images').length>0&&query('images').every(asset=>asset.kind==='image'),icons:query('icons').length>0&&query('icons').every(asset=>asset.kind==='icon'),backgrounds:query('backgrounds').length>0&&query('backgrounds').every(asset=>asset.kind==='background'),logos:query('logos').length>0&&query('logos').every(asset=>asset.kind==='logo'),unused:query('unused').length>0&&query('unused').every(asset=>asset.usageCount===0),recent:query('recent').length>0&&query('recent').every(asset=>Boolean(asset.createdAt)),favorites:query('favorites').length>0&&query('favorites').every(asset=>asset.isFavorite)};
    const total=library.assets.length;const rendered=document.querySelectorAll('.asset-card').length;const input=document.querySelector('[data-media-search]');const started=performance.now();for(let index=0;index<80;index+=1){input.value=index===79?'fixture 299':'fixture '+index;input.dispatchEvent(new Event('input',{bubbles:true}));}await tick();const searchDuration=performance.now()-started;const searched=document.querySelectorAll('.asset-card').length;input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const first=document.querySelector('.asset-card');first.focus();first.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await tick();const keyboardSelected=document.querySelector('.asset-card[aria-selected="true"]')?.dataset.assetCardId??null;
    const unlabeled=[...document.querySelectorAll('.media-library-page button,.media-library-page input,.media-library-page select')].filter(element=>!(element.getAttribute('aria-label')||element.textContent.trim()||element.closest('label'))).length;
    const grid=document.querySelector('[role="grid"]');const focusStyle=getComputedStyle(document.activeElement);const focusVisible=focusStyle.outlineStyle!=='none'&&Number.parseFloat(focusStyle.outlineWidth)>0;const lazyImages=[...document.querySelectorAll('.asset-card img')].every(image=>image.loading==='lazy'&&image.decoding==='async');
    return {total,rendered,searched,searchDuration,keyboardSelected,unlabeled,rowCount:grid.getAttribute('aria-rowcount'),colCount:grid.getAttribute('aria-colcount'),focusVisible,sorted,filterChecks,lazyImages};
  })()`)
  const afterMetrics = await send('Performance.getMetrics')
  const metricMap = (result) => Object.fromEntries(result.metrics.map((metric) => [metric.name, metric.value]))
  const before = metricMap(beforeMetrics); const after = metricMap(afterMetrics)
  const performanceMetrics = { scriptSeconds: Number(((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)).toFixed(5)), layouts: (after.LayoutCount ?? 0) - (before.LayoutCount ?? 0) }
  assert(performanceEvidence.total >= 300 && performanceEvidence.rendered < 70 && performanceEvidence.searched === 1, `virtualization or instant search failed: ${JSON.stringify(performanceEvidence)}`)
  assert(performanceEvidence.searchDuration < 250 && performanceEvidence.keyboardSelected && performanceEvidence.unlabeled === 0 && Number(performanceEvidence.rowCount) > 0 && Number(performanceEvidence.colCount) > 0 && performanceEvidence.focusVisible && performanceEvidence.lazyImages, `performance/accessibility failed: ${JSON.stringify(performanceEvidence)}`)
  assert(Object.values(performanceEvidence.sorted).every(Boolean) && Object.values(performanceEvidence.filterChecks).every(Boolean), `sorting or filter behavior failed: ${JSON.stringify(performanceEvidence)}`)

  const libraryShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-032-asset-library.png'), Buffer.from(libraryShot.data, 'base64'))

  const editorEvidence = await evaluate(`(async()=>{
    const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const app=document.querySelector('#app').__vue_app__;const pinia=app.config.globalProperties.$pinia;const library=pinia._s.get('media-library');library.$patch({assets:library.assets.filter(asset=>!asset.id.startsWith('phase32-fixture-'))});
    const asset=library.assets.find(candidate=>candidate.name==='Editorial Portrait');const search=document.querySelector('[data-media-search]');search.value='Lisa Natalia';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();document.querySelector('[data-asset-card-id="media-profile-primary"]').click();await tick();document.querySelector('.usage-section button').click();
    for(let attempt=0;attempt<180&&(!document.querySelector('.edit-page')||document.querySelector('.editor-recovery')||!document.querySelector('[data-property-key="media.choose"]'));attempt+=1)await wait(30);await tick();
    const editor=pinia._s.get('editor');const routeSelected=editor.selectedObjectId;const choose=document.querySelector('[data-property-key="media.choose"] button');choose.click();
    for(let attempt=0;attempt<80&&!document.querySelector('.asset-picker');attempt+=1)await wait(20);await tick();
    const pickerSearch=document.querySelector('.asset-picker input[type="search"]');const tabButtons=[...document.querySelectorAll('.picker-tabs button')];const tabs=tabButtons.map(button=>button.textContent.trim());pickerSearch.value='Editorial Portrait';pickerSearch.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    tabButtons.find(button=>button.textContent.trim()==='Favorites').click();await tick();const favoriteResult=Boolean(document.querySelector('[data-asset-card-id="'+CSS.escape(asset.id)+'"]'));tabButtons.find(button=>button.textContent.trim()==='Recent').click();await tick();const recentResult=Boolean(document.querySelector('[data-asset-card-id="'+CSS.escape(asset.id)+'"]'));tabButtons.find(button=>button.textContent.trim()==='All').click();await tick();
    const pickerCard=document.querySelector('[data-asset-card-id="'+CSS.escape(asset.id)+'"]');pickerCard.focus();pickerCard.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true,cancelable:true}));await tick();const keyboard=Boolean(document.querySelector('.asset-picker .asset-card[aria-selected="true"]'));
    return {assetId:asset.id,routeSelected,tabs,favoriteResult,recentResult,keyboard,pickerOpen:Boolean(document.querySelector('.asset-picker')),pickerCard:Boolean(pickerCard),controls:[...document.querySelectorAll('[data-property-category="media"] .property-field>span')].map(node=>node.textContent.trim())};
  })()`)
  assert(editorEvidence.routeSelected === 'portfolio-profile-media' && editorEvidence.pickerOpen && editorEvidence.pickerCard && editorEvidence.keyboard && editorEvidence.favoriteResult && editorEvidence.recentResult, `usage deep link or picker failed: ${JSON.stringify(editorEvidence)}`)
  for (const label of ['Upload New Image','Choose from Media','Replace Selected Image','Remove Selected Image','Duplicate Image','Show in Media Library']) assert(editorEvidence.controls.includes(label), `Editor media action missing: ${label}`)
  assert(!editorEvidence.controls.includes('Reuse this image'), 'redundant media-reference action remained visible')
  assert(['All','Favorites','Recent'].every((tab) => editorEvidence.tabs.includes(tab)), 'picker Favorites/Recent tabs are incomplete')

  const pickerShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-032-media-picker.png'), Buffer.from(pickerShot.data, 'base64'))

  const bindingEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const editor=pinia._s.get('editor');const library=pinia._s.get('media-library');const asset=library.assets.find(candidate=>candidate.name==='Editorial Portrait');
    const area='portfolio-profile-media';const opened=[];const originalOpen=window.open;window.open=(url)=>{opened.push(String(url));return null};const before=editor.draftSnapshot.media.assignments.find(item=>item.entityId===area)?.assetId;const historyBefore=editor.commandHistory.length;const instanceIdsBefore=editor.draftSnapshot.instances.map(item=>item.instanceId);
    const pickerCard=document.querySelector('[data-asset-card-id="'+CSS.escape(asset.id)+'"]');pickerCard.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await tick();const afterBrowse=editor.draftSnapshot.media.assignments.find(item=>item.entityId===area)?.assetId;const inserted=editor.draftSnapshot.instances.find(item=>!instanceIdsBefore.includes(item.instanceId));const insertedAssignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId===inserted?.instanceId);const historyAfterBrowse=editor.commandHistory.length;const pickerClosed=!document.querySelector('.asset-picker');const duplicateVisible=Boolean(document.querySelector('[data-property-key="media.duplicateReference"]'));const insertCommand=editor.commandHistory.at(-1)?.type;
    document.querySelector('[data-property-key="media.remove"] button').click();for(let attempt=0;attempt<60&&!document.querySelector('.product-confirmation');attempt+=1)await wait(20);document.querySelector('.product-confirmation__confirm').click();for(let attempt=0;attempt<60&&editor.draftSnapshot.instances.some(item=>item.instanceId===inserted.instanceId);attempt+=1)await wait(20);await tick();const removed=!editor.draftSnapshot.instances.some(item=>item.instanceId===inserted.instanceId);const underlyingAssetRetained=library.assets.some(item=>item.id===insertedAssignment.assetId);const orphanReferenceRemoved=!editor.draftSnapshot.media.references.some(item=>item.assetId===insertedAssignment.assetId);editor.undo();for(let attempt=0;attempt<60&&!editor.objects.some(item=>item.id===inserted.instanceId);attempt+=1)await wait(20);await tick();const restored=editor.draftSnapshot.instances.some(item=>item.instanceId===inserted.instanceId)&&editor.draftSnapshot.media.assignments.some(item=>item.entityId===inserted.instanceId&&item.assetId===insertedAssignment.assetId);document.querySelector('[data-snapshot-instance-id="'+CSS.escape(inserted.instanceId)+'"]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));await tick();
    document.querySelector('[data-property-key="media.reveal"] button').click();editor.selectObject(editor.objects.find(item=>item.id===area));await tick();
    document.querySelector('[data-property-key="media.choose"] button').click();for(let attempt=0;attempt<60&&!document.querySelector('.asset-picker');attempt+=1)await wait(20);await tick();
    const target=[...document.querySelectorAll('[data-editor-object-id="portfolio-profile-media"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];const transfer=new DataTransfer();transfer.setData('application/x-portfolio-asset',asset.id);target.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:transfer,clientX:target.getBoundingClientRect().left+3,clientY:target.getBoundingClientRect().top+3}));await tick();const highlighted=target.classList.contains('editor-media-drop-target');target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer,clientX:target.getBoundingClientRect().left+3,clientY:target.getBoundingClientRect().top+3}));await tick();const dropped=editor.draftSnapshot.media.assignments.find(item=>item.entityId===area)?.assetId===asset.id;const mediaElement=document.querySelector('[data-media-usage-id="portfolio-profile-media"]')??document.querySelector('[data-editor-object-id="portfolio-profile-media"]');const previewSource=mediaElement?.matches('img')?mediaElement.src:mediaElement?.querySelector('img')?.src??'';
    const command=editor.commandHistory.at(-1)?.type;window.open=originalOpen;return {before,afterBrowse,historyBefore,historyAfterBrowse,pickerClosed,duplicateVisible,inserted:{id:inserted?.instanceId,assetId:insertedAssignment?.assetId},insertCommand,removed,underlyingAssetRetained,orphanReferenceRemoved,restored,opened,highlighted,dropped,command,previewSource,selection:editor.selectedObjectId,history:editor.commandHistory.length};
  })()`)
  assert(bindingEvidence.afterBrowse === bindingEvidence.before && bindingEvidence.historyAfterBrowse >= bindingEvidence.historyBefore && bindingEvidence.pickerClosed && bindingEvidence.inserted.id && bindingEvidence.inserted.assetId === editorEvidence.assetId && bindingEvidence.insertCommand === 'INSERT_INSTANCE' && bindingEvidence.opened.some((url) => url.includes(`asset=${editorEvidence.assetId}`)), `Choose from Media did not preserve the fixed image while inserting a canonical instance: ${JSON.stringify(bindingEvidence)}`)
  assert(bindingEvidence.duplicateVisible && bindingEvidence.removed && bindingEvidence.underlyingAssetRetained && bindingEvidence.orphanReferenceRemoved && bindingEvidence.restored, `dynamic remove/reference safety workflow failed: ${JSON.stringify(bindingEvidence)}`)
  assert(bindingEvidence.command === 'SET_IMAGE_REFERENCE' && bindingEvidence.opened.some((url) => url.includes('/admin/media') && url.includes('asset=')) && bindingEvidence.highlighted && bindingEvidence.dropped && bindingEvidence.previewSource.startsWith('blob:') && bindingEvidence.selection === 'portfolio-profile-media' && bindingEvidence.history <= 10, `reveal, repository-backed drag/drop, or live preview workflow failed: ${JSON.stringify(bindingEvidence)}`)

  const unhandled = await evaluate(`globalThis.__phase032Unhandled ?? []`)
  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(error))
  assert(unhandled.length === 0 && seriousErrors.length === 0, `browser runtime errors: ${[...unhandled, ...seriousErrors].join(' | ')}`)

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    scope: 'Phase 032 Asset Library plus Phase 033A restored Media UI runtime',
    restoration: restorationEvidence,
    restoredCrud: restoredCrudEvidence,
    base: baseEvidence,
    mutations: mutationEvidence,
    performance: performanceEvidence,
    devToolsMetrics: performanceMetrics,
    editor: editorEvidence,
    binding: bindingEvidence,
    screenshots: ['artifacts/phase-033a-restored-admin-media.png','artifacts/phase-032-asset-library.png','artifacts/phase-032-media-picker.png']
  }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* already closed */ }
  stopChildren()
  await wait(350)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }) } catch { /* Chromium may briefly retain its lock. */ }
}
