import { resolve } from 'node:path'

const ids = [
  'about-frame-back-2', 'about-frame-main', 'college-frame-back', 'college-frame-front',
  'shs-frame-back', 'shs-frame-front', 'experience-frame-klinik-1',
  'experience-frame-klinik-2', 'experience-frame-klinik-3', 'experience-frame-klinik-4',
  'cert-a-thumbnail', 'cert-a-detail-1', 'cert-a-detail-2', 'cert-a-detail-3',
  'cert-b-thumbnail', 'cert-b-detail-1', 'cert-b-detail-2'
]
const fixtures = [
  ['A', 'frame-a-1000x1000.svg', 1000, 1000],
  ['B', 'frame-b-1600x900.svg', 1600, 900],
  ['C', 'frame-c-900x1600.svg', 900, 1600],
  ['D', 'frame-d-2000x500.svg', 2000, 500],
  ['E', 'frame-e-100x100.svg', 100, 100],
  ['F', 'frame-f-100x50.svg', 100, 50]
].map(([name, file, width, height]) => ({ name, path: resolve('tests/fixtures', file), width, height }))

function assert(condition, message) {
  if (!condition) throw new Error(`Acceptance failure: ${message}`)
}

const pages = await (await fetch('http://127.0.0.1:9237/json')).json()
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('127.0.0.1:5173'))
if (!page) throw new Error('Vite page target not found')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let sequence = 0
const pending = new Map()
const runtimeErrors = []
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
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
const wait = (ms = 80) => new Promise((done) => setTimeout(done, ms))
async function waitFor(expression, timeout = 5000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return
    await wait()
  }
  throw new Error(`Timed out: ${expression}`)
}
async function route(hash) {
  await evaluate(`location.hash=${JSON.stringify(hash)}`)
  const selector = hash.includes('admin') ? '#photo-area-select' : '[data-photo-area-id]'
  await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
  await wait(80)
}
async function storeSnapshot() {
  return evaluate(`JSON.parse(JSON.stringify(document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value['photo-area-images'].frames))`)
}
async function upload(frameId, filePath) {
  await evaluate(`(() => { const select=document.querySelector('#photo-area-select'); select.value=${JSON.stringify(frameId)}; select.dispatchEvent(new Event('change',{bubbles:true})); })()`)
  await wait()
  const documentNode = await send('DOM.getDocument', { depth: -1, pierce: true })
  const selector = `input[type=file][data-photo-area-id="${frameId}"]`
  const query = await send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector })
  if (!query.nodeId) throw new Error(`Upload input missing for ${frameId}`)
  await send('DOM.setFileInputFiles', { nodeId: query.nodeId, files: [filePath] })
  await waitFor(`document.querySelector('[data-selected-frame-id=${JSON.stringify(frameId)}]')?.textContent.includes('Image selected')`)
}
async function openCertificateCards() {
  await evaluate(`(() => { document.querySelectorAll('.certificate-card:not(.is-expanded) .card-header').forEach(el => el.click()) })()`)
  await wait(550)
}
async function collect() {
  return evaluate(`(() => {
    const areas=[...document.querySelectorAll('[data-photo-area-id]')];
    const measurements=Object.fromEntries(areas.map(area => {
      const image=area.querySelector('.photo-area-image'); const r=area.getBoundingClientRect();
      const imageStyle=image?getComputedStyle(image):null;
      const imageWidth=imageStyle?parseFloat(imageStyle.width):0; const imageHeight=imageStyle?parseFloat(imageStyle.height):0;
      return [area.dataset.photoAreaId, { frame:[area.clientWidth,area.clientHeight], image:image?[imageWidth,imageHeight]:null,
        natural:image?[image.naturalWidth,image.naturalHeight]:null, placeholder:area.querySelectorAll('.image-boundary-placeholder,.placeholder,.cert-placeholder').length,
        clipped:image ? imageWidth>area.clientWidth+0.01 || imageHeight>area.clientHeight+0.01 : false,
        whitespace:image ? imageWidth<area.clientWidth-0.01 || imageHeight<area.clientHeight-0.01 : false }]
    }));
    return { count:areas.length, unique:new Set(areas.map(a=>a.dataset.photoAreaId)).size, measurements,
      cards:[...document.querySelectorAll('.certificate-card')].map(el=>{const r=el.getBoundingClientRect();return [r.top,r.width,r.height]}),
      slides:[...document.querySelectorAll('.slide-item')].map(el=>{const r=el.getBoundingClientRect();return [el.dataset.slideId,r.width,r.height]}),
      horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth };
  })()`)
}

await send('Runtime.enable')
await send('DOM.enable')
await send('Log.enable')
await send('Page.enable')
await evaluate(`import('/src/repositories/certificateRepository.ts').then(({certificateRepository}) => certificateRepository.clear())`)
await send('Emulation.setDeviceMetricsOverride', { width: 1422, height: 804, deviceScaleFactor: 1, mobile: false })
await send('Page.reload', { ignoreCache: true })
await waitFor(`document.readyState === 'complete'`)
await route('#/')
await openCertificateCards()
const empty = await collect()
const baselineGeometry = structuredClone(empty)
const results = []
const responsiveFixtures = []
let isolationPass = true

for (const fixture of fixtures) {
  await route('#/admin/edit')
  for (const id of ids) {
    const before = await storeSnapshot()
    await upload(id, fixture.path)
    const after = await storeSnapshot()
    const changed = ids.filter((candidate) => before[candidate].source !== after[candidate].source)
    if (changed.length !== 1 || changed[0] !== id) isolationPass = false
  }
  await route('#/')
  await openCertificateCards()
  await waitFor(`document.querySelectorAll('.photo-area-image').length === 17 && [...document.querySelectorAll('.photo-area-image')].every(img => img.naturalWidth > 0 && img.getBoundingClientRect().width > 0)`)
  const state = await collect()
  const rows = ids.map((id) => {
    const value = state.measurements[id]
    const renderedRatio = value.image[0] / value.image[1]
    const naturalRatio = value.natural[0] / value.natural[1]
    return { id, rendered: value.image, natural: value.natural, renderedRatio, naturalRatio,
      ratioDelta: Math.abs(renderedRatio - naturalRatio), scale: value.image[0] / value.natural[0],
      crop: value.clipped, whitespace: value.whitespace, placeholder: value.placeholder,
      geometryStable: Math.abs(value.frame[0]-baselineGeometry.measurements[id].frame[0])<0.05 && Math.abs(value.frame[1]-baselineGeometry.measurements[id].frame[1])<0.05 }
  })
  results.push({ fixture: fixture.name, expected:[fixture.width,fixture.height], rows,
    count:state.count, unique:state.unique, cards:state.cards, slides:state.slides, horizontalOverflow:state.horizontalOverflow })

  for (const [width, height] of [[1024, 768], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 })
    await wait(150)
    const responsiveState = await collect()
    const responsiveRows = ids.map((id) => {
      const value = responsiveState.measurements[id]
      return {
        id,
        ratioDelta: Math.abs((value.image[0] / value.image[1]) - (value.natural[0] / value.natural[1])),
        scale: value.image[0] / value.natural[0],
        placeholder: value.placeholder
      }
    })
    responsiveFixtures.push({
      fixture: fixture.name,
      width,
      height,
      count: responsiveState.count,
      unique: responsiveState.unique,
      maxRatioDelta: Math.max(...responsiveRows.map((row) => row.ratioDelta)),
      maxScale: Math.max(...responsiveRows.map((row) => row.scale)),
      placeholders: responsiveRows.reduce((sum, row) => sum + row.placeholder, 0),
      horizontalOverflow: responsiveState.horizontalOverflow
    })
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1422, height: 804, deviceScaleFactor: 1, mobile: false })
  await wait(150)
}

const finalStore = await storeSnapshot()
const spaSourceCount = Object.values(finalStore).filter((frame) => frame.source).length

const mixedPlan = [
  ['cert-a-detail-1', fixtures[0]],
  ['cert-a-detail-2', fixtures[2]],
  ['cert-a-detail-3', fixtures[3]],
  ['cert-b-detail-1', fixtures[2]],
  ['cert-b-detail-2', fixtures[3]]
]
await route('#/admin/edit')
for (const [id, fixture] of mixedPlan) await upload(id, fixture.path)
await route('#/')
await openCertificateCards()
await waitFor(`document.querySelectorAll('.slide-item .photo-area-image').length === 5`)
const mixedState = await collect()
const mixedCertificate = {
  cards: mixedState.cards,
  slides: mixedState.slides,
  natural: Object.fromEntries(mixedPlan.map(([id]) => [id, mixedState.measurements[id].natural])),
  horizontalOverflow: mixedState.horizontalOverflow
}

assert(empty.count === 17 && empty.unique === 17, 'empty inventory must be 17 unique photo areas')
assert(Object.values(empty.measurements).every((value) => value.placeholder === 1 && value.image === null), 'every empty frame must show exactly one placeholder and no image')
assert(!empty.horizontalOverflow, 'empty state must not overflow horizontally')
assert(isolationPass, 'each Admin upload must mutate only its selected source key')
assert(spaSourceCount === 17, 'all 17 sources must survive Admin-to-Guest SPA navigation')
for (const result of results) {
  assert(result.count === 17 && result.unique === 17, `fixture ${result.fixture} inventory must stay unique`)
  assert(!result.horizontalOverflow, `fixture ${result.fixture} must not overflow horizontally`)
  assert(result.rows.every((row) => row.ratioDelta <= 0.001), `fixture ${result.fixture} rendered ratios must match intrinsic ratios`)
  assert(result.rows.every((row) => row.scale <= 1.000001), `fixture ${result.fixture} must not upscale`)
  assert(result.rows.every((row) => row.placeholder === 0), `fixture ${result.fixture} placeholders must be absent after upload`)
  assert(result.rows.every((row) => row.geometryStable), `fixture ${result.fixture} frame geometry must remain stable`)
  if (['B', 'C', 'D'].includes(result.fixture)) assert(result.rows.every((row) => row.crop), `fixture ${result.fixture} must clip at every frame boundary`)
  if (['E', 'F'].includes(result.fixture)) {
    assert(result.rows.every((row) => Math.abs(row.scale - 1) <= 0.000001), `fixture ${result.fixture} scale must equal 1`)
    assert(result.rows.every((row) => row.whitespace && !row.crop), `fixture ${result.fixture} must keep whitespace without crop`)
  }
}
for (const result of responsiveFixtures) {
  assert(result.count === 17 && result.unique === 17, `${result.width}x${result.height} fixture ${result.fixture} inventory must stay unique`)
  assert(result.maxRatioDelta <= 0.001, `${result.width}x${result.height} fixture ${result.fixture} ratio must be preserved`)
  assert(result.maxScale <= 1.000001, `${result.width}x${result.height} fixture ${result.fixture} must not upscale`)
  assert(result.placeholders === 0, `${result.width}x${result.height} fixture ${result.fixture} placeholder must be absent`)
  assert(!result.horizontalOverflow, `${result.width}x${result.height} fixture ${result.fixture} must not overflow horizontally`)
}
assert(mixedCertificate.slides.every((slide, index) => Math.abs(slide[1] - baselineGeometry.slides[index][1]) < 0.05 && Math.abs(slide[2] - baselineGeometry.slides[index][2]) < 0.05), 'mixed Certificate ratios must not change sibling slide geometry')
assert(mixedCertificate.cards.every((card, index) => Math.abs(card[1] - baselineGeometry.cards[index][1]) < 0.05 && Math.abs(card[2] - baselineGeometry.cards[index][2]) < 0.05), 'mixed Certificate ratios must not change card geometry')
assert(!mixedCertificate.horizontalOverflow, 'mixed Certificate ratios must not overflow horizontally')
assert(runtimeErrors.length === 0, 'runtime console/errors must be zero')
await send('Emulation.clearDeviceMetricsOverride')

const report = {
  empty: { count:empty.count, unique:empty.unique, placeholders:Object.values(empty.measurements).filter((m)=>m.placeholder===1).length, horizontalOverflow:empty.horizontalOverflow },
  isolationPass, spaSourceCount, results, responsiveFixtures, mixedCertificate, runtimeErrors
}
const summary = {
  empty: report.empty,
  isolationPass,
  spaSourceCount,
  fixtures: results.map((result) => ({
    fixture: result.fixture,
    expected: result.expected,
    count: result.count,
    unique: result.unique,
    maxRatioDelta: Math.max(...result.rows.map((row) => row.ratioDelta)),
    maxScale: Math.max(...result.rows.map((row) => row.scale)),
    minScale: Math.min(...result.rows.map((row) => row.scale)),
    cropCount: result.rows.filter((row) => row.crop).length,
    whitespaceCount: result.rows.filter((row) => row.whitespace).length,
    placeholders: result.rows.reduce((sum, row) => sum + row.placeholder, 0),
    geometryStable: result.rows.every((row) => row.geometryStable),
    dimensions: Object.fromEntries(result.rows.map((row) => [row.id, row.rendered.map((value) => Number(value.toFixed(3)))])),
    cards: result.cards,
    slides: result.slides,
    horizontalOverflow: result.horizontalOverflow
  })),
  responsiveFixtures,
  mixedCertificate,
  runtimeErrors
}
console.log(JSON.stringify(summary))
socket.close()
