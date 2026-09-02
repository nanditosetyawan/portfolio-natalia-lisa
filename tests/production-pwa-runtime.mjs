import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5188'
const cdpPort = 9358
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase036-pwa-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

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

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { if ((await fetch(url)).ok) return } catch { /* Preview is starting. */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForHttpDown(url, timeout = 10000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { await fetch(url) } catch { return }
    await wait(100)
  }
  throw new Error(`Origin remained reachable after shutdown: ${url}`)
}

async function waitForJson(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { const response = await fetch(url); if (response.ok) return response.json() } catch { /* Chromium is starting. */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

process.on('exit', stopChildren)
let socket
try {
  const preview = launch(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5188', '--strictPort'], { cwd: projectRoot })
  let previewErrors = ''
  preview.stderr.on('data', (chunk) => { previewErrors += String(chunk) })
  await waitForHttp(baseUrl)
  const browser = launch(chromePath, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`, '--window-size=1440,1000', baseUrl])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })
  const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
  const page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5188'))
  if (!page) throw new Error('PWA browser target not found.')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id); pending.delete(message.id)
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
  })
  function send(method, params = {}) {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
      pending.set(id, { resolve(value) { clearTimeout(timer); resolve(value) }, reject(error) { clearTimeout(timer); reject(error) } })
    })
  }
  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
    return response.result.value
  }
  async function waitFor(expression, timeout = 30000) {
    const started = Date.now()
    while (Date.now() - started < timeout) { if (await evaluate(expression)) return; await wait(80) }
    throw new Error(`Timed out: ${expression}`)
  }
  async function capture(name) {
    await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(projectRoot, 'artifacts', name), Buffer.from(screenshot.data, 'base64'))
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Network.enable')
  await waitFor(`Boolean(document.querySelector('.guest-home'))`)
  await waitFor(`(async()=>Boolean(navigator.serviceWorker?.controller && await navigator.serviceWorker.ready))()`)
  const online = await evaluate(`(async()=>{const registration=await navigator.serviceWorker.ready;const manifest=await fetch('/manifest.webmanifest').then(response=>response.json());return {controller:Boolean(navigator.serviceWorker.controller),script:registration.active?.scriptURL,caches:await caches.keys(),manifest,source:document.querySelector('meta[name="portfolio:runtime-source"]')?.content}})()`)
  const manifest = await send('Page.getAppManifest')
  const installability = await send('Page.getInstallabilityErrors')

  preview.kill()
  preview.stdout?.destroy()
  preview.stderr?.destroy()
  await waitForHttpDown(baseUrl)
  await send('Page.navigate', { url: `${baseUrl}/?offline-test=1#/` })
  try { await waitFor(`document.body.innerText.includes('temporarily offline')`) }
  catch (error) {
    const state = await evaluate(`(async()=>({url:location.href,title:document.title,text:document.body.innerText.slice(0,1000),controller:Boolean(navigator.serviceWorker?.controller),caches:await caches.keys()}))()`)
    throw new Error(`${error.message}; offlineState=${JSON.stringify(state)}`)
  }
  const offline = await evaluate(`({title:document.title,text:document.body.innerText,vueMounted:Boolean(document.querySelector('#app')?.__vue_app__)})`)
  await capture('phase-036-offline-fallback.png')
  const recoveredPreview = launch(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5188', '--strictPort'], { cwd: projectRoot })
  recoveredPreview.stderr.on('data', (chunk) => { previewErrors += String(chunk) })
  await waitForHttp(baseUrl)
  await send('Page.navigate', { url: `${baseUrl}/#/` })
  await waitFor(`Boolean(document.querySelector('.guest-home'))`)
  const recovered = await evaluate(`({ready:Boolean(document.querySelector('.guest-home')),source:document.querySelector('meta[name="portfolio:runtime-source"]')?.content})`)

  const failures = []
  if (!online.controller || !online.script?.includes('/sw.js?build=') || online.caches.length < 1) failures.push('Service worker did not install/control the page')
  if (online.manifest.display !== 'standalone' || !online.manifest.icons?.length) failures.push('Manifest is incomplete')
  if (!manifest.url?.endsWith('/manifest.webmanifest') || manifest.errors?.length) failures.push(`CDP manifest errors: ${JSON.stringify(manifest.errors ?? [])}`)
  if (installability.installabilityErrors?.length) failures.push(`Installability errors: ${JSON.stringify(installability.installabilityErrors)}`)
  if (!offline.text.includes('temporarily offline') || offline.vueMounted) failures.push('Offline fallback did not replace the network shell')
  if (!recovered.ready || !['default','published'].includes(recovered.source)) failures.push('Online recovery failed')
  if (runtimeErrors.length) failures.push('Runtime errors occurred')

  const evidence = { status: failures.length ? 'FAIL' : 'PASS', online, appManifest: { url: manifest.url, errors: manifest.errors ?? [] }, installability: installability.installabilityErrors ?? [], offline, recovered, runtimeErrors, previewErrors, browserErrors: browserErrors.split('\n').filter((line) => /error|fail/i.test(line)).slice(0, 10), screenshot: 'artifacts/phase-036-offline-fallback.png', failures }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`)
  if (failures.length) process.exitCode = 1
} finally {
  try { socket?.close() } catch { /* best effort */ }
  stopChildren()
  await wait(200)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* Chromium may release its profile lock after exit. */ }
}
