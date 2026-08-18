import { resolve } from 'node:path'

const fixtures = {
  portrait: resolve('tests/fixtures/frame-c-900x1600.svg'),
  wide: resolve('tests/fixtures/frame-d-2000x500.svg'),
  small: resolve('tests/fixtures/frame-e-100x100.svg')
}

const pages = await (await fetch('http://127.0.0.1:9239/json')).json()
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('127.0.0.1:5173'))
if (!page) throw new Error('Certificate test page target not found')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let sequence = 0
const pending = new Map()
const runtimeErrors = []
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.id && pending.has(message.id)) {
    const { resolve: done, reject } = pending.get(message.id)
    pending.delete(message.id)
    message.error ? reject(new Error(message.error.message)) : done(message.result)
  }
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text)
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
})

function send(method, params = {}) {
  const id = ++sequence
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolveCall, reject) => pending.set(id, { resolve: resolveCall, reject }))
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

const wait = (milliseconds = 80) => new Promise((done) => setTimeout(done, milliseconds))
async function waitFor(expression, timeout = 5000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return
    await wait()
  }
  throw new Error(`Timed out: ${expression}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(`Certificate acceptance failure: ${message}`)
}

function databaseCertificate(id, order) {
  return {
    id,
    title: `Database ${id.toUpperCase()}`,
    date: `202${order}`,
    description: `Persistent certificate ${id}`,
    order,
    active: true,
    thumbnail: {
      id: `${id}-thumbnail`, source: '',
      placeholder: { label: 'Thumbnail sertif', hint: 'Database image', color: '#5A3E35', opacity: 1 },
      image: { objectPosition: 'center center' }
    },
    detailImages: [1, 2].map((number) => ({
      id: `${id}-detail-${number}`, source: '',
      placeholder: { label: `Database detail ${number}`, hint: 'Database image', color: '#5A3E35', opacity: 1 },
      image: { objectPosition: 'center center' }
    }))
  }
}

async function route(hash) {
  await evaluate(`location.hash=${JSON.stringify(hash)}`)
  await waitFor(hash.includes('admin') ? `Boolean(document.querySelector('#photo-area-select'))` : `Boolean(document.querySelector('#certificate'))`)
  await wait(100)
}

async function seed(records, showAll = false) {
  await evaluate(`(async()=>{
    const {certificateRepository}=await import('/src/repositories/certificateRepository.ts');
    await certificateRepository.replaceAll(${JSON.stringify(records)});
    const store=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('certificates');
    store.$reset();
    await store.fetchCertificates(${showAll});
  })()`)
  await wait()
}

async function uiState() {
  return evaluate(`(() => ({
    cards:[...document.querySelectorAll('.certificate-card')].map(card=>({id:card.dataset.certificateId,origin:card.dataset.certificateOrigin,title:card.querySelector('.info-title')?.textContent.trim()})),
    duplicateIds:(()=>{const ids=[...document.querySelectorAll('.certificate-card')].map(card=>card.dataset.certificateId);return ids.length-new Set(ids).size})(),
    loading:Boolean(document.querySelector('.certificate-status')?.textContent.includes('Loading')),
    error:document.querySelector('.certificate-status-error')?.textContent.trim()||'',
    refreshDisabled:document.querySelector('.refresh-btn').disabled,
    horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
  }))()`)
}

async function upload(frameId, filePath) {
  await route('#/admin/edit')
  await evaluate(`(()=>{const select=document.querySelector('#photo-area-select');select.value=${JSON.stringify(frameId)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await wait()
  const documentNode = await send('DOM.getDocument', { depth: -1, pierce: true })
  const query = await send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: `input[type=file][data-photo-area-id="${frameId}"]` })
  if (!query.nodeId) throw new Error(`Admin upload target missing: ${frameId}`)
  await send('DOM.setFileInputFiles', { nodeId: query.nodeId, files: [filePath] })
  await waitFor(`document.querySelector('[data-selected-frame-id=${JSON.stringify(frameId)}]')?.textContent.includes('Image selected')`)
  await wait(150)
}

await send('Runtime.enable')
await send('Log.enable')
await send('DOM.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1422, height: 804, deviceScaleFactor: 1, mobile: false })
await route('#/')

const report = {}

await seed([])
report.A = await uiState()
assert(JSON.stringify(report.A.cards.map((card) => [card.id, card.origin])) === JSON.stringify([['cert-a', 'default'], ['cert-b', 'default']]), 'A: empty database must render two defaults')

await seed([databaseCertificate('db-x', 0)])
report.B = await uiState()
assert(JSON.stringify(report.B.cards.map((card) => [card.id, card.origin])) === JSON.stringify([['db-x', 'database'], ['cert-b', 'default']]), 'B: one database record must fill slot one and retain Default B')

await seed([databaseCertificate('db-a', 0), databaseCertificate('db-b', 1)])
report.C = await uiState()
assert(report.C.cards.length === 2 && report.C.cards.every((card) => card.origin === 'database'), 'C: two database records must suppress defaults')

const fiveRecords = Array.from({ length: 5 }, (_, index) => databaseCertificate(`db-${index + 1}`, index))
await seed(fiveRecords)
report.DInitial = await uiState()
assert(report.DInitial.cards.length === 2, 'D: five database records must initially render two')
await evaluate(`document.querySelector('.refresh-btn').click()`)
await waitFor(`document.querySelectorAll('.certificate-card').length===5 && !document.querySelector('.refresh-btn').disabled`)
report.DRefresh = await uiState()
assert(report.DRefresh.cards.length === 5 && report.DRefresh.cards.every((card) => card.origin === 'database'), 'D: refresh must fetch and show all five database records')

await seed([])
await evaluate(`document.querySelector('.refresh-btn').click()`)
await waitFor(`!document.querySelector('.refresh-btn').disabled`)
report.E = await uiState()
assert(report.E.cards.length === 2 && report.E.cards.every((card) => card.origin === 'default'), 'E: refresh on empty database must retain two defaults')

await seed([databaseCertificate('db-x', 0)])
await evaluate(`document.querySelector('.refresh-btn').click()`)
await waitFor(`!document.querySelector('.refresh-btn').disabled`)
report.F = await uiState()
assert(report.F.cards.length === 2 && report.F.cards[0].origin === 'database' && report.F.cards[1].id === 'cert-b', 'F: refresh with one record must retain slot fallback')

await seed(fiveRecords)
await evaluate(`document.querySelector('.refresh-btn').click()`)
await waitFor(`document.querySelectorAll('.certificate-card').length===5`)
await evaluate(`document.querySelector('.refresh-btn').click()`)
await waitFor(`!document.querySelector('.refresh-btn').disabled`)
report.G = await uiState()
assert(report.G.cards.length === 5 && report.G.duplicateIds === 0, 'G: repeated refresh must not duplicate records')

await send('Page.reload', { ignoreCache: true })
await waitFor(`document.readyState==='complete' && document.querySelectorAll('.certificate-card[data-certificate-origin="database"]').length===2`)
report.HInitial = await uiState()
await evaluate(`document.querySelector('.refresh-btn').click()`)
await waitFor(`document.querySelectorAll('.certificate-card').length===5`)
report.HRefresh = await uiState()
assert(report.HInitial.cards.every((card) => card.origin === 'database') && report.HRefresh.cards.length === 5, 'H: hard refresh must retain IndexedDB records')

await seed([{ id:'incomplete', order:0 }, { id:'inactive', active:false }])
report.incomplete = await uiState()
assert(report.incomplete.cards.length === 2 && report.incomplete.cards[0].id === 'incomplete' && report.incomplete.cards[0].title === 'Certificate', 'incomplete data must normalize safely and invalid/duplicate/inactive rows must be ignored')
report.validation = await evaluate(`import('/src/stores/certificates.ts').then(({normalizeDatabaseCertificates}) => {
  const rows=normalizeDatabaseCertificates([{title:'missing id'},{id:'same'},{id:'same',title:'duplicate'},{id:'hidden',active:false}]);
  return rows.map(row=>row.id);
})`)
assert(JSON.stringify(report.validation) === JSON.stringify(['same']), 'validator must reject missing IDs, duplicates, and inactive records')

report.databaseFailure = await evaluate(`(async()=>{
  const {certificateRepository}=await import('/src/repositories/certificateRepository.ts');
  const original=certificateRepository.list;
  certificateRepository.list=async()=>{throw new Error('raw database failure')};
  const store=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('certificates');
  store.$reset(); await store.fetchCertificates(false);
  const result={ids:store.displayedCards.map(card=>card.id),error:store.errorMessage};
  certificateRepository.list=original;
  return result;
})()`)
assert(JSON.stringify(report.databaseFailure.ids) === JSON.stringify(['cert-a','cert-b']) && !report.databaseFailure.error.includes('raw database'), 'database failure must use safe default fallback without leaking raw errors')

report.loading = await evaluate(`(async()=>{
  const {certificateRepository}=await import('/src/repositories/certificateRepository.ts');
  const original=certificateRepository.list;
  certificateRepository.list=()=>new Promise(resolve=>setTimeout(()=>resolve([]),180));
  const store=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('certificates');
  store.$reset(); const pending=store.refreshCertificates(); await new Promise(resolve=>setTimeout(resolve,30));
  const during={loading:store.isLoading,disabled:document.querySelector('.refresh-btn').disabled,status:document.querySelector('.certificate-status')?.textContent.trim()};
  await pending; certificateRepository.list=original; return during;
})()`)
assert(report.loading.loading && report.loading.disabled && report.loading.status === 'Loading certificates...', 'refresh must expose loading state and disable repeated requests')

await seed([])
await upload('cert-a-thumbnail', fixtures.portrait)
await route('#/')
await waitFor(`document.querySelector('[data-certificate-id="cert-a"] .photo-area-image')?.naturalWidth===900`)
const portraitBeforeReload = await evaluate(`(()=>{const area=document.querySelector('[data-photo-area-id="cert-a-thumbnail"]');const image=area.querySelector('img');const ir=image.getBoundingClientRect();return {natural:[image.naturalWidth,image.naturalHeight],rendered:[ir.width,ir.height],boundary:[area.clientWidth,area.clientHeight],ratioDelta:Math.abs(ir.width/ir.height-image.naturalWidth/image.naturalHeight),clipped:ir.height>area.clientHeight+0.01,certBPlaceholder:Boolean(document.querySelector('[data-certificate-id="cert-b"] .placeholder'))}})()`)
await send('Page.reload', { ignoreCache: true })
await waitFor(`document.querySelector('[data-certificate-id="cert-a"] .photo-area-image')?.naturalWidth===900`)
const portraitAfterReload = await evaluate(`(()=>{const image=document.querySelector('[data-photo-area-id="cert-a-thumbnail"] img');return {source:image.src,natural:[image.naturalWidth,image.naturalHeight]}})()`)
report.I = { beforeReload: portraitBeforeReload, afterReload: portraitAfterReload }
assert(portraitBeforeReload.ratioDelta <= 0.001 && portraitBeforeReload.clipped && portraitBeforeReload.certBPlaceholder && portraitAfterReload.natural[0] === 900, 'I/K/H: portrait upload must be isolated, clipped, proportional, and persistent')

await route('#/')
await evaluate(`document.querySelector('[data-certificate-id="cert-a"] .card-header').click()`)
await wait(550)
const geometryBefore = await evaluate(`({slides:[...document.querySelectorAll('.slide-item')].map(el=>[el.getBoundingClientRect().width,el.getBoundingClientRect().height]),cards:[...document.querySelectorAll('.certificate-card')].map(el=>[el.getBoundingClientRect().width,el.getBoundingClientRect().height])})`)
await upload('cert-a-detail-1', fixtures.wide)
const sourceSnapshot = await evaluate(`import('/src/repositories/certificateRepository.ts').then(async({certificateRepository})=>(await certificateRepository.list()).find(card=>card.id==='cert-a').detailImages.map(image=>image.source))`)
await route('#/')
await evaluate(`document.querySelector('[data-certificate-id="cert-a"] .card-header').click()`)
await wait(550)
await waitFor(`document.querySelector('[data-photo-area-id="cert-a-detail-1"] img')?.naturalWidth===2000`)
const detailResult = await evaluate(`(()=>{const area=document.querySelector('[data-photo-area-id="cert-a-detail-1"]');const image=area.querySelector('img');const ir=image.getBoundingClientRect();return {ratioDelta:Math.abs(ir.width/ir.height-4),scale:ir.width/image.naturalWidth,clipped:ir.width>area.clientWidth+0.01,slides:[...document.querySelectorAll('.slide-item')].map(el=>[el.getBoundingClientRect().width,el.getBoundingClientRect().height]),cards:[...document.querySelectorAll('.certificate-card')].map(el=>[el.getBoundingClientRect().width,el.getBoundingClientRect().height])}})()`)
report.JM = { sourceSnapshot: sourceSnapshot.map(Boolean), geometryBefore, detailResult }
assert(sourceSnapshot[0] && sourceSnapshot.slice(1).every((source) => !source), 'J: detail mutation must leave every sibling detail source unchanged')
assert(detailResult.ratioDelta <= 0.001 && detailResult.scale <= 1 && detailResult.clipped, 'M: wide detail image must remain proportional, not upscale, and clip')
assert(JSON.stringify(geometryBefore) === JSON.stringify({slides:detailResult.slides,cards:detailResult.cards}), 'detail image mutation must not alter slide/card geometry')

await upload('cert-a-thumbnail', fixtures.small)
await route('#/')
await waitFor(`document.querySelector('[data-photo-area-id="cert-a-thumbnail"] img')?.naturalWidth===100`)
report.L = await evaluate(`(()=>{const area=document.querySelector('[data-photo-area-id="cert-a-thumbnail"]');const image=area.querySelector('img');const rect=image.getBoundingClientRect();return {rendered:[rect.width,rect.height],scale:rect.width/image.naturalWidth,ratioDelta:Math.abs(rect.width/rect.height-1),whitespace:rect.width<area.clientWidth&&rect.height<area.clientHeight}})()`)
assert(report.L.scale === 1 && report.L.ratioDelta <= 0.001 && report.L.whitespace, 'L: small image must remain intrinsic size with whitespace')

report.final = await uiState()
assert(!report.final.horizontalOverflow && report.final.duplicateIds === 0 && runtimeErrors.length === 0, 'final Certificate runtime must have no overflow, duplicate IDs, or runtime errors')
report.runtimeErrors = runtimeErrors

await evaluate(`import('/src/repositories/certificateRepository.ts').then(({certificateRepository}) => certificateRepository.clear())`)
console.log(JSON.stringify(report))
socket.close()
