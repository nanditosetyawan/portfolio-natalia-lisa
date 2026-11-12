import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
].filter(Boolean)
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate))
if (!chromePath) throw new Error('Chrome/Chromium binary not found for Finding #16 runtime test.')

const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))

function assert(condition, message) {
  if (!condition) throw new Error(`Finding #16 failure: ${message}`)
}

function runViteBuild(viteEnv, outDir) {
  return new Promise((resolve, reject) => {
    const args = ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir, '--emptyOutDir']
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...viteEnv }
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += String(chunk) })
    child.stderr.on('data', (chunk) => { stderr += String(chunk) })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

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
    try { const res = await fetch(url); if (res.ok) return res.json() } catch { /* Chromium starting */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function verifyViteSiteUrlConfig() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'portfolio-finding16-builds-'))
  try {
    // 1. Empty VITE_SITE_URL: build succeeds with clear console.warn and http://localhost fallback
    const emptyOut = path.join(tempRoot, 'empty')
    const emptyRes = await runViteBuild({ VITE_SITE_URL: '' }, emptyOut)
    const emptyOutput = `${emptyRes.stdout}\n${emptyRes.stderr}`
    assert(emptyRes.code === 0, `Empty VITE_SITE_URL build failed: ${emptyOutput}`)
    assert(
      emptyOutput.includes('[build] VITE_SITE_URL is not set'),
      `Expected missing VITE_SITE_URL warning, got: ${emptyOutput}`
    )
    const emptyIndex = await readFile(path.join(emptyOut, 'index.html'), 'utf8')
    const emptyRobots = await readFile(path.join(emptyOut, 'robots.txt'), 'utf8')
    const emptySitemap = await readFile(path.join(emptyOut, 'sitemap.xml'), 'utf8')
    assert(emptyIndex.includes('http://localhost/'), 'Empty build canonical/og:url missing http://localhost')
    assert(emptyRobots.includes('Sitemap: http://localhost/sitemap.xml'), 'Empty build robots.txt missing http://localhost')
    assert(emptySitemap.includes('<loc>http://localhost/</loc>'), 'Empty build sitemap.xml missing http://localhost')

    // 2. Malformed non-empty VITE_SITE_URL: build must fail loudly
    for (const invalidUrl of ['natalia.com', 'ftp://natalia.com']) {
      const invalidRes = await runViteBuild({ VITE_SITE_URL: invalidUrl }, path.join(tempRoot, 'invalid'))
      const invalidOutput = `${invalidRes.stdout}\n${invalidRes.stderr}`
      assert(invalidRes.code !== 0, `Invalid VITE_SITE_URL "${invalidUrl}" unexpectedly passed build`)
      assert(invalidOutput.includes('Invalid VITE_SITE_URL'), `Missing clear Invalid VITE_SITE_URL error for "${invalidUrl}": ${invalidOutput}`)
    }

    // 3. Valid VITE_SITE_URL with subpath/trailing slash: normalizes to origin without empty warning
    const validOut = path.join(tempRoot, 'valid')
    const validRes = await runViteBuild({ VITE_SITE_URL: 'https://portfolio-test.example/nested/' }, validOut)
    const validOutput = `${validRes.stdout}\n${validRes.stderr}`
    assert(validRes.code === 0, `Valid VITE_SITE_URL build failed: ${validOutput}`)
    assert(!validOutput.includes('[build] VITE_SITE_URL is not set'), `Unexpected empty warning on valid VITE_SITE_URL: ${validOutput}`)
    const validIndex = await readFile(path.join(validOut, 'index.html'), 'utf8')
    const validRobots = await readFile(path.join(validOut, 'robots.txt'), 'utf8')
    const validSitemap = await readFile(path.join(validOut, 'sitemap.xml'), 'utf8')
    assert(validIndex.includes('https://portfolio-test.example/'), 'Valid build index.html missing normalized origin')
    assert(!validIndex.includes('/nested/'), 'Valid build leaked subpath instead of normalizing origin')
    assert(validRobots.includes('Sitemap: https://portfolio-test.example/sitemap.xml'), 'Valid build robots.txt wrong origin')
    assert(validSitemap.includes('<loc>https://portfolio-test.example/</loc>'), 'Valid build sitemap.xml wrong origin')
  } finally {
    await rm(tempRoot, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 })
  }
}

async function openEditorSession(port, cdpPort) {
  const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-finding16-chrome-'))
  const children = []
  const launch = (command, args, options = {}) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options })
    children.push(child)
    return child
  }

  const baseUrl = `http://127.0.0.1:${port}`
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ', VITE_SITE_URL: '' }
  })
  let viteOutput = ''
  vite.stdout.on('data', (chunk) => { viteOutput += String(chunk) })
  vite.stderr.on('data', (chunk) => { viteOutput += String(chunk) })
  await waitForHttp(baseUrl)
  assert(!viteOutput.includes('[build] VITE_SITE_URL is not set'), `Dev serve should not emit build empty warning: ${viteOutput}`)

  launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1440,1000', baseUrl
  ])

  let page
  const started = Date.now()
  while (!page && Date.now() - started < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes(`127.0.0.1:${port}`))
    if (!page) await wait(100)
  }
  assert(page, 'Chromium page target not found.')

  const socket = new WebSocket(page.webSocketDebuggerUrl)
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
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
      pending.set(id, { resolve(v) { clearTimeout(timer); resolve(v) }, reject(e) { clearTimeout(timer); reject(e) } })
    })
  }

  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
    return response.result.value
  }

  async function waitFor(expression, timeout = 15000) {
    const waitStarted = Date.now()
    while (Date.now() - waitStarted < timeout) {
      if (await evaluate(expression)) return
      await wait(60)
    }
    throw new Error(`Timed out waiting for: ${expression}`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(()=>{globalThis.__f16Unhandled=[];addEventListener('unhandledrejection',(e)=>globalThis.__f16Unhandled.push(String(e.reason?.stack??e.reason)));return true})()`)

  return {
    evaluate,
    waitFor,
    runtimeErrors,
    async close() {
      try { socket.close() } catch { /* ignore */ }
      for (const child of children.reverse()) {
        if (!child.killed) child.kill()
        child.stdout?.destroy()
        child.stderr?.destroy()
      }
      await wait(250)
      try { await rm(profilePath, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }) } catch { /* ignore */ }
    }
  }
}

await verifyViteSiteUrlConfig()

const session = await openEditorSession(5189, 9359)
try {
  // 1. Initial load with ?object=contact-cta must select contact-cta and keep preview scrolled to it (not reset by session scrollTop: 0)
  await session.evaluate(`(async()=>{
    const auth=(await import('/src/stores/auth.ts')).useAuthStore();
    auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});
    const router=(await import('/src/router/index.ts')).default;
    await router.push({ path: '/admin/edit', query: { object: 'contact-cta' } });
    return true;
  })()`)
  await session.waitFor(`(()=>{
    const editor=document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('editor');
    const scroller=document.querySelector('.canvas-scroll');
    const target=document.querySelector('[data-editor-object-id="contact-cta"]');
    if (!editor || !scroller || !target || editor.selectedObjectId !== 'contact-cta') return false;
    const sr=scroller.getBoundingClientRect();
    const tr=target.getBoundingClientRect();
    return scroller.scrollTop > 200 && tr.top < sr.bottom && tr.bottom > sr.top;
  })()`)

  const initialState = await session.evaluate(`(()=>{
    const page=document.querySelector('.edit-page');
    page.__f16SameMount = true;
    const scroller=document.querySelector('.canvas-scroll');
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    return { selectedObjectId: editor.selectedObjectId, scrollTop: scroller.scrollTop };
  })()`)

  // 2. Live ?object= change while Editor stays mounted must switch selection and scroll preview up to target
  await session.evaluate(`(async()=>{
    const router=(await import('/src/router/index.ts')).default;
    await router.push({ path: '/admin/edit', query: { object: 'about-paragraph-intro' } });
    return true;
  })()`)
  await session.waitFor(`(()=>{
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const scroller=document.querySelector('.canvas-scroll');
    const target=document.querySelector('[data-editor-object-id="about-paragraph-intro"]');
    if (!editor || !scroller || !target || editor.selectedObjectId !== 'about-paragraph-intro') return false;
    const sr=scroller.getBoundingClientRect();
    const tr=target.getBoundingClientRect();
    return scroller.scrollTop < ${initialState.scrollTop} && tr.top < sr.bottom && tr.bottom > sr.top;
  })()`)

  // 3. Active inline text edit is cancelled safely when ?object= changes (even when draft query stays matching current draftRevisionId)
  await session.evaluate(`(()=>{
    const target=document.querySelector('[data-editor-object-id="about-paragraph-intro"]');
    target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    return true;
  })()`)
  await session.waitFor(`Boolean(document.querySelector('.editor-preview-runtime [contenteditable="true"]'))`)

  const beforeQueryJumpText = await session.evaluate(`(()=>{
    const editable=document.querySelector('.editor-preview-runtime [contenteditable="true"]');
    const original=editable.innerText;
    editable.innerText='TEMP_UNSAVED_INLINE_EDIT';
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    editor.$patch({ draftRevisionId: 'draft-same-check' });
    return original;
  })()`)

  await session.evaluate(`(async()=>{
    const router=(await import('/src/router/index.ts')).default;
    await router.push({ path: '/admin/edit', query: { draft: 'draft-same-check', object: 'contact-detail-title' } });
    return true;
  })()`)

  await session.waitFor(`(()=>{
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const scroller=document.querySelector('.canvas-scroll');
    const target=document.querySelector('[data-editor-object-id="contact-detail-title"]');
    if (!editor || !scroller || !target || editor.selectedObjectId !== 'contact-detail-title') return false;
    const sr=scroller.getBoundingClientRect();
    const tr=target.getBoundingClientRect();
    return !document.querySelector('.editor-preview-runtime [contenteditable="true"]') && tr.top < sr.bottom && tr.bottom > sr.top;
  })()`)

  const finalCheck = await session.evaluate(`({
    sameMount: Boolean(document.querySelector('.edit-page')?.__f16SameMount),
    selectedObjectId: document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').selectedObjectId,
    restoredAboutText: document.querySelector('[data-editor-object-id="about-paragraph-intro"]')?.innerText?.replace(/\\s+/g, ' ').trim(),
    unhandled: globalThis.__f16Unhandled
  })`)

  assert(finalCheck.sameMount === true, 'Editor unexpectedly unmounted during live ?object= switch')
  assert(finalCheck.selectedObjectId === 'contact-detail-title', `Expected contact-detail-title selected, got ${finalCheck.selectedObjectId}`)
  assert(
    finalCheck.restoredAboutText === beforeQueryJumpText.replace(/\s+/g, ' ').trim(),
    `Inline text edit was not cancelled cleanly on ?object= navigation: "${finalCheck.restoredAboutText}"`
  )
  assert(finalCheck.unhandled.length === 0 && session.runtimeErrors.length === 0, `Runtime errors detected: ${JSON.stringify({ unhandled: finalCheck.unhandled, runtimeErrors: session.runtimeErrors })}`)

  console.log(JSON.stringify({ ok: true, initialState, finalCheck }))
} finally {
  await session.close()
}
