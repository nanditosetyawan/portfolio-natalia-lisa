const pages = await (await fetch('http://127.0.0.1:9238/json')).json()
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('127.0.0.1:5173'))
if (!page) throw new Error('Vite page target not found')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((done, reject) => {
  socket.addEventListener('open', done, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let sequence = 0
const pending = new Map()
const errors = []
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.id && pending.has(message.id)) {
    const callback = pending.get(message.id)
    pending.delete(message.id)
    callback(message)
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text)
})
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message.result))
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

async function prepare(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await resetPage()
}

async function resetPage() {
  await send('Page.reload', { ignoreCache: true })
  await wait(250)
  for (let i = 0; i < 60; i += 1) {
    if (await evaluate(`Boolean(document.querySelector('#education') && document.querySelector('#college'))`)) break
    await wait(50)
  }
  await wait(180)
}

async function place(selector, topVh) {
  await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); const documentTop=el.getBoundingClientRect().top+scrollY; window.scrollTo(0, documentTop - (${topVh}) * innerHeight); })()`)
  await wait(90)
}

async function wheel(deltaY, sampleMs = 900) {
  const path = []
  const started = performance.now()
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 720, y: 450, deltaX: 0, deltaY })
  while (performance.now() - started < sampleMs) {
    path.push(await evaluate(`({
      t: performance.now(),
      education: document.querySelector('#education').getBoundingClientRect().top,
      college: document.querySelector('#college').getBoundingClientRect().top,
      scrollY
    })`))
    await wait(35)
  }
  return path
}

async function scanDirection(direction, positions, delta) {
  const results = []
  for (const position of positions) {
    await resetPage()
    const selector = direction === 'down' ? '#college' : '#education'
    const topVh = direction === 'down' ? position / 100 : -position / 100
    await place(selector, topVh)
    const before = await evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().top`)
    const path = await wheel(direction === 'down' ? delta : -delta)
    const after = path.at(-1)[direction === 'down' ? 'college' : 'education']
    results.push({ position, before, after, movement: after - before, path })
  }
  return results
}

async function deltaMatrix(direction) {
  const selector = direction === 'down' ? '#college' : '#education'
  const topVh = direction === 'down' ? 1.1 : -1.1
  const results = []
  for (const amount of [120, 300, 500]) {
    await resetPage()
    await place(selector, topVh)
    const before = await evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().top`)
    const path = await wheel(direction === 'down' ? amount : -amount)
    results.push({ amount, before, after: path.at(-1)[direction === 'down' ? 'college' : 'education'], path })
  }
  return results
}

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await prepare(1440, 900)
const geometryDesktop = await evaluate(`({
  educationTop:document.querySelector('#education').getBoundingClientRect().top+scrollY,
  educationHeight:document.querySelector('#education').getBoundingClientRect().height,
  collegeTop:document.querySelector('#college').getBoundingClientRect().top+scrollY,
  collegeHeight:document.querySelector('#college').getBoundingClientRect().height,
  viewport:[innerWidth,innerHeight]
})`)
const desktop = {
  downScan: await scanDirection('down', [78,76,75,74,72,70,68,66,64,63,62,61], 60),
  upScan: await scanDirection('up', [105,100,95,90,85,80,76,75,74,72,70,68,66,64,62,61], 60),
  downDelta: await deltaMatrix('down'),
  upDelta: await deltaMatrix('up')
}

await prepare(1024, 768)
const geometryTablet = await evaluate(`({
  educationTop:document.querySelector('#education').getBoundingClientRect().top+scrollY,
  educationHeight:document.querySelector('#education').getBoundingClientRect().height,
  collegeTop:document.querySelector('#college').getBoundingClientRect().top+scrollY,
  collegeHeight:document.querySelector('#college').getBoundingClientRect().height,
  viewport:[innerWidth,innerHeight]
})`)
const tablet = {
  downScan: await scanDirection('down', [76,74,72,70,68,66,64,62,61], 60),
  upScan: await scanDirection('up', [100,95,90,85,80,76,74,72,68,64,62,61], 60)
}

const summarize = (rows) => rows.map(({ position, before, after, movement }) => ({
  position,
  before: Number(before.toFixed(3)),
  after: Number(after.toFixed(3)),
  movement: Number(movement.toFixed(3))
}))
const summarizeDelta = (rows) => rows.map(({ amount, before, after }) => ({ amount, before:Number(before.toFixed(3)), after:Number(after.toFixed(3)) }))

console.log(JSON.stringify({
  geometryDesktop,
  geometryTablet,
  desktop: {
    downScan:summarize(desktop.downScan), upScan:summarize(desktop.upScan),
    downDelta:summarizeDelta(desktop.downDelta), upDelta:summarizeDelta(desktop.upDelta)
  },
  tablet: { downScan:summarize(tablet.downScan), upScan:summarize(tablet.upScan) },
  errors
}))
socket.close()
