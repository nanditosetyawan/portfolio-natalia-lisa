import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5199'
const cdpPort = 9359
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-finding12-chrome-'))
const shotsDir = process.env.VERIFY_SHOTS_DIR ?? ''
const children = []
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (condition, message) => { if (!condition) throw new Error(`Finding #12 check failed: ${message}`) }

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { if ((await fetch(url)).ok) return } catch { /* Vite starting */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForJson(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.json()
    } catch { /* Chrome starting */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function launch(cmd, args, options = {}) {
  const child = spawn(cmd, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options })
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
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5199', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  })
  await waitForHttp(baseUrl)

  launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1440,1000', `${baseUrl}/#/`
  ])

  let page
  const started = Date.now()
  while (!page && Date.now() - started < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5199'))
    if (!page) await wait(100)
  }
  assert(page, 'Browser target not found')

  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) {
      const req = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? req.reject(new Error(msg.error.message)) : req.resolve(msg.result)
    }
    if (msg.method === 'Runtime.exceptionThrown') runtimeErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') runtimeErrors.push(msg.params.entry.text)
  })

  const send = (method, params = {}) => {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)
    return res.result.value
  }
  const waitFor = async (expr, timeout = 15000) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await evaluate(expr)) return
      await wait(60)
    }
    throw new Error(`Timed out: ${expr}`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#about .about-container')) && Boolean(document.querySelector('#shs-section .shs-calendar span'))`)

  if (shotsDir) {
    await mkdir(shotsDir, { recursive: true })
    await evaluate(`document.querySelector('#about').scrollIntoView()`)
    await wait(250)
    await writeFile(path.join(shotsDir, 'finding12-about.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    await evaluate(`document.querySelector('#shs-section').scrollIntoView()`)
    await wait(250)
    await writeFile(path.join(shotsDir, 'finding12-shs.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
  }

  const evidence = await evaluate(`(async () => {
    const flush = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const site = pinia._s.get('site')

    const aboutEl = document.querySelector('#about .about-container')
    const aboutSec = document.querySelector('#about')
    const aboutTitle = document.querySelector('#about .about-title')
    const aboutFrame = document.querySelector('#about .frame-main')
    const collegeCal = document.querySelector('#college-section .college-calendar span')
    const shsCal = document.querySelector('#shs-section .shs-calendar span')
    const shsLabel = document.querySelector('#shs-section .shs-label')
    const shsSchool = document.querySelector('#shs-section .shs-school')
    const shsDesc = document.querySelector('#shs-section .shs-desc')
    const shsSec = document.querySelector('#shs-section')

    const initial = {
      shsCalFont: getComputedStyle(shsCal).fontFamily,
      shsLabelFont: getComputedStyle(shsLabel).fontFamily,
      shsSchoolFont: getComputedStyle(shsSchool).fontFamily,
      shsDescFont: getComputedStyle(shsDesc).fontFamily,
      collegeCalFont: getComputedStyle(collegeCal).fontFamily,
      aboutGap: getComputedStyle(aboutEl).columnGap,
      aboutMinHeight: getComputedStyle(aboutEl).minHeight,
      aboutBg: getComputedStyle(aboutSec).backgroundColor,
      shsBg: getComputedStyle(shsSec).backgroundColor,
      aboutFrameW: getComputedStyle(aboutFrame).width,
      aboutTitleFont: getComputedStyle(aboutTitle).fontFamily
    }

    // 1. Canonical vConfig.calendar.fontFamily update + element/section independence
    site.current.visual.shs.calendar.fontFamily = 'Georgia, serif'
    await flush()
    const shsFontUpdated = {
      shsCalFont: getComputedStyle(shsCal).fontFamily,
      shsSchoolFont: getComputedStyle(shsSchool).fontFamily,
      shsDescFont: getComputedStyle(shsDesc).fontFamily,
      collegeCalFont: getComputedStyle(collegeCal).fontFamily,
      shsBg: getComputedStyle(shsSec).backgroundColor
    }

    // 2. Legacy .family fallback branch
    delete site.current.visual.shs.calendar.fontFamily
    site.current.visual.shs.calendar.family = "'Courier New', monospace"
    await flush()
    const shsLegacyFallback = getComputedStyle(shsCal).fontFamily

    // 3. About container gap & minHeight dynamic v-bind + independence
    site.current.visual.about.container.gap = '96px'
    site.current.visual.about.container.minHeight = '520px'
    await flush()
    const aboutUpdated = {
      gap: getComputedStyle(aboutEl).columnGap,
      minHeight: getComputedStyle(aboutEl).minHeight,
      aboutBg: getComputedStyle(aboutSec).backgroundColor,
      aboutFrameW: getComputedStyle(aboutFrame).width,
      aboutTitleFont: getComputedStyle(aboutTitle).fontFamily
    }

    // 4. About container empty-string fallback branch
    site.current.visual.about.container.gap = ''
    site.current.visual.about.container.minHeight = ''
    await flush()
    const aboutFallback = {
      gap: getComputedStyle(aboutEl).columnGap,
      minHeight: getComputedStyle(aboutEl).minHeight
    }

    // Re-apply custom desktop override to verify @media tablet/mobile still wins below
    site.current.visual.about.container.gap = '96px'
    site.current.visual.about.container.minHeight = '520px'
    await flush()
    return { initial, shsFontUpdated, shsLegacyFallback, aboutUpdated, aboutFallback }
  })()`)

  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false })
  await wait(120)
  const tabletGap = await evaluate(`getComputedStyle(document.querySelector('#about .about-container')).columnGap`)

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await wait(120)
  const mobileMinHeight = await evaluate(`getComputedStyle(document.querySelector('#about .about-container')).minHeight`)

  assert(evidence.initial.shsCalFont.includes('Inter'), `unexpected default SHS calendar font: ${evidence.initial.shsCalFont}`)
  assert(evidence.initial.aboutGap === '56px' && evidence.initial.aboutMinHeight === '784px', `unexpected default About container: ${JSON.stringify(evidence.initial)}`)

  assert(evidence.shsFontUpdated.shsCalFont.includes('Georgia'), `SHS calendar fontFamily did not update: ${evidence.shsFontUpdated.shsCalFont}`)
  assert(evidence.shsFontUpdated.shsSchoolFont === evidence.initial.shsSchoolFont, 'SHS school font leaked')
  assert(evidence.shsFontUpdated.shsDescFont === evidence.initial.shsDescFont, 'SHS description font leaked')
  assert(evidence.shsFontUpdated.collegeCalFont === evidence.initial.collegeCalFont, 'College calendar font leaked')
  assert(evidence.shsFontUpdated.shsBg === evidence.initial.shsBg, 'SHS background changed')

  assert(evidence.shsLegacyFallback.includes('Courier New'), `legacy .family fallback failed: ${evidence.shsLegacyFallback}`)

  assert(evidence.aboutUpdated.gap === '96px' && evidence.aboutUpdated.minHeight === '520px', `About v-bind still overwritten: ${JSON.stringify(evidence.aboutUpdated)}`)
  assert(evidence.aboutUpdated.aboutBg === evidence.initial.aboutBg && evidence.aboutUpdated.aboutFrameW === evidence.initial.aboutFrameW && evidence.aboutUpdated.aboutTitleFont === evidence.initial.aboutTitleFont, 'About section/frame/title leaked')
  assert(evidence.aboutFallback.gap === '56px' && evidence.aboutFallback.minHeight === '784px', `About fallback failed: ${JSON.stringify(evidence.aboutFallback)}`)

  assert(tabletGap === '32px', `tablet @media containerGap overridden: ${tabletGap}`)
  assert(mobileMinHeight === '0px', `mobile @media containerMinHeight overridden: ${mobileMinHeight}`)

  const seriousErrors = runtimeErrors.filter((err) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(err))
  assert(seriousErrors.length === 0, `browser errors: ${seriousErrors.join(' | ')}`)

  process.stdout.write(`${JSON.stringify({ status: 'PASS', tabletGap, mobileMinHeight, ...evidence }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* no-op */ }
  stopChildren()
  await wait(250)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* cleanup */ }
}
