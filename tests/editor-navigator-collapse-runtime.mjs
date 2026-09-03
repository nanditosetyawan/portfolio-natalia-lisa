import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5189'
const cdpPort = 9349
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-navigator-collapse-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(`Navigator collapse runtime failure: ${message}`)
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5189', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5189'))
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

  async function waitFor(expression, timeout = 15000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(60)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  async function openEditor(clearPreference = false) {
    await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
    await evaluate(`(async()=>{
      ${clearPreference ? "localStorage.removeItem('portfolio-editor-navigator-open');" : ''}
      const authModule=await import('/src/stores/auth.ts');
      const router=(await import('/src/router/index.ts')).default;
      const auth=authModule.useAuthStore();
      auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});
      await router.push('/admin/edit');
      return true;
    })()`)
    await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]')) && Boolean(document.querySelector('.navigator-toggle'))`)
    await wait(450)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  await openEditor(true)
  await evaluate(`(()=>{document.querySelector('.control-panel').scrollTop=0;document.querySelector('.canvas-scroll').scrollTop=0;return true})()`)
  await wait(100)

  const before = await evaluate(`(()=>{
    const rect=(node)=>{const value=node.getBoundingClientRect();return {x:value.x,y:value.y,width:value.width,height:value.height}};
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const navigator=document.querySelector('.navigator-column');
    const panel=document.querySelector('.control-panel');
    const canvas=document.querySelector('.canvas-container');
    const frame=document.querySelector('.preview-frame');
    const runtime=document.querySelector('.editor-preview-runtime');
    globalThis.__navigatorCollapseRefs={navigator,runtime,canvas};
    return {
      navigator:rect(navigator),panel:rect(panel),canvas:rect(canvas),frame:rect(frame),
      toggleText:document.querySelector('.navigator-toggle').textContent.trim(),
      toggleRect:rect(document.querySelector('.navigator-toggle')),
      expanded:document.querySelector('.navigator-toggle').getAttribute('aria-expanded'),
      state:editor.navigatorOpen,
      selection:editor.selectedObjectId,
      zoom:{choice:document.querySelector('.zoom-control select').value,user:editor.draftSnapshot.session.userZoom},
      scroll:{panel:panel.scrollTop,top:document.querySelector('.canvas-scroll').scrollTop,left:document.querySelector('.canvas-scroll').scrollLeft},
      dirty:{content:editor.hasUnsavedChanges,session:editor.sessionDirty,history:editor.commandHistory.length},
      updateCount:Number(document.querySelector('[data-preview-update-count]')?.dataset.previewUpdateCount??0)
    };
  })()`)
  assert(before.state && before.expanded === 'true' && before.toggleText === 'Close Navigator', `default open state is wrong: ${JSON.stringify(before)}`)
  assert(before.navigator.width >= 210 && before.toggleRect.height === 42 && before.toggleRect.width >= 170 && before.toggleRect.width <= 190, `open layout/button geometry is wrong: ${JSON.stringify(before)}`)

  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  const beforeScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'editor-navigator-before.png'), Buffer.from(beforeScreenshot.data, 'base64'))

  const expectedScroll = await evaluate(`(()=>{const panel=document.querySelector('.control-panel');const canvas=document.querySelector('.canvas-scroll');canvas.scrollTop=160;return {panel:panel.scrollTop,top:canvas.scrollTop,left:canvas.scrollLeft}})()`)
  await wait(100)

  await evaluate(`document.querySelector('.navigator-toggle').click()`)
  await wait(350)
  const after = await evaluate(`(()=>{
    const rect=(node)=>{const value=node.getBoundingClientRect();return {x:value.x,y:value.y,width:value.width,height:value.height}};
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const navigator=document.querySelector('.navigator-column');
    const panel=document.querySelector('.control-panel');
    const canvas=document.querySelector('.canvas-container');
    const frame=document.querySelector('.preview-frame');
    return {
      navigator:rect(navigator),panel:rect(panel),canvas:rect(canvas),frame:rect(frame),
      sameNavigator:navigator===globalThis.__navigatorCollapseRefs.navigator,
      sameCanvas:canvas===globalThis.__navigatorCollapseRefs.canvas,
      sameRuntime:document.querySelector('.editor-preview-runtime')===globalThis.__navigatorCollapseRefs.runtime,
      ariaHidden:navigator.getAttribute('aria-hidden'),inert:navigator.inert,
      visibility:getComputedStyle(navigator).visibility,
      toggleText:document.querySelector('.navigator-toggle').textContent.trim(),
      expanded:document.querySelector('.navigator-toggle').getAttribute('aria-expanded'),
      state:editor.navigatorOpen,stored:localStorage.getItem('portfolio-editor-navigator-open'),
      selection:editor.selectedObjectId,
      zoom:{choice:document.querySelector('.zoom-control select').value,user:editor.draftSnapshot.session.userZoom},
      scroll:{panel:panel.scrollTop,top:document.querySelector('.canvas-scroll').scrollTop,left:document.querySelector('.canvas-scroll').scrollLeft},
      dirty:{content:editor.hasUnsavedChanges,session:editor.sessionDirty,history:editor.commandHistory.length},
      updateCount:Number(document.querySelector('[data-preview-update-count]')?.dataset.previewUpdateCount??0)
    };
  })()`)
  const closeEnough = (left, right, tolerance = 1) => Math.abs(left - right) <= tolerance
  assert(!after.state && after.stored === 'false' && after.expanded === 'false' && after.toggleText === 'Open Navigator', `closed preference/label is wrong: ${JSON.stringify(after)}`)
  assert(after.navigator.width <= 0.5 && after.ariaHidden === 'true' && after.inert && after.visibility === 'hidden', `Navigator did not disappear completely: ${JSON.stringify(after)}`)
  assert(closeEnough(after.panel.x, before.navigator.x) && closeEnough(after.panel.width, before.panel.width), `Inspector width changed: before=${JSON.stringify(before.panel)} after=${JSON.stringify(after.panel)}`)
  assert(closeEnough(after.canvas.x, after.panel.x + after.panel.width) && closeEnough(after.canvas.width, before.canvas.width + before.navigator.width), `Canvas did not reclaim Navigator width: before=${JSON.stringify(before.canvas)} after=${JSON.stringify(after.canvas)}`)
  assert(after.frame.width > before.frame.width && after.frame.height > before.frame.height, `Fit Preview did not enlarge with Canvas: before=${JSON.stringify(before.frame)} after=${JSON.stringify(after.frame)}`)
  assert(after.sameNavigator && after.sameCanvas && after.sameRuntime && after.updateCount === before.updateCount, `collapse remounted or refreshed Preview: ${JSON.stringify(after)}`)
  assert(after.selection === before.selection && JSON.stringify(after.zoom) === JSON.stringify(before.zoom) && JSON.stringify(after.scroll) === JSON.stringify(expectedScroll), `selection, zoom choice, or scroll position changed: before=${JSON.stringify(before)} expectedScroll=${JSON.stringify(expectedScroll)} after=${JSON.stringify(after)}`)
  assert(JSON.stringify(after.dirty) === JSON.stringify(before.dirty), `layout toggle changed editor persistence/history state: before=${JSON.stringify(before.dirty)} after=${JSON.stringify(after.dirty)}`)

  await evaluate(`(()=>{document.querySelector('.canvas-scroll').scrollTop=0;return true})()`)
  await wait(80)
  const afterScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'editor-navigator-after.png'), Buffer.from(afterScreenshot.data, 'base64'))

  await send('Page.reload', { ignoreCache: true })
  await openEditor(false)
  const restored = await evaluate(`(()=>{
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const navigator=document.querySelector('.navigator-column');
    return {state:editor.navigatorOpen,width:navigator.getBoundingClientRect().width,hidden:navigator.getAttribute('aria-hidden'),label:document.querySelector('.navigator-toggle').textContent.trim()};
  })()`)
  assert(!restored.state && restored.width <= 0.5 && restored.hidden === 'true' && restored.label === 'Open Navigator', `closed state did not survive reload: ${JSON.stringify(restored)}`)

  const navigatorBehavior = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    document.querySelector('.navigator-toggle').click();await new Promise(resolve=>setTimeout(resolve,260));
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const search=document.querySelector('[data-object-search]');
    search.value='navigation-brand';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const visible=[...document.querySelectorAll('[data-layer-object-id]')].filter(node=>getComputedStyle(node).display!=='none');
    const row=document.querySelector('[data-layer-object-id="navigation-brand"]');
    row.querySelector('.object-select').click();await tick();
    const stateButtons=row.querySelectorAll('.object-state-button');
    stateButtons[0].click();await tick();const locked=editor.objectState('navigation-brand').locked;stateButtons[0].click();await tick();
    stateButtons[1].click();await tick();const hidden=editor.objectState('navigation-brand').hidden;stateButtons[1].click();await tick();
    row.querySelector('.object-select').dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}));await tick();
    const rename=row.querySelector('input');rename.value='Navigation brand verified';rename.dispatchEvent(new Event('input',{bubbles:true}));rename.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await tick();
    const renamed=editor.objects.find(object=>object.id==='navigation-brand')?.name;
    search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));await tick();
    const handle=document.querySelector('[data-layer-object-id="navigation-brand"] .layer-drag-handle');
    const beforeOrder=editor.objects.find(object=>object.id==='navigation-brand')?.order;
    handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',altKey:true,bubbles:true,cancelable:true}));await tick();
    const afterOrder=editor.objects.find(object=>object.id==='navigation-brand')?.order;
    return {open:editor.navigatorOpen,visible:visible.length,selected:editor.selectedObjectId,section:editor.selectedSection,locked,hidden,renamed,beforeOrder,afterOrder,outlined:document.querySelector('[data-editor-object-id="navigation-brand"]')?.classList.contains('editor-preview-selected')};
  })()`)
  assert(navigatorBehavior.open && navigatorBehavior.visible === 1 && navigatorBehavior.selected === 'navigation-brand' && navigatorBehavior.section === 'Navigation', `Navigator search/selection regressed: ${JSON.stringify(navigatorBehavior)}`)
  assert(navigatorBehavior.locked && navigatorBehavior.hidden && navigatorBehavior.renamed === 'Navigation brand verified', `Navigator lock/hide/rename regressed: ${JSON.stringify(navigatorBehavior)}`)
  assert(navigatorBehavior.beforeOrder !== navigatorBehavior.afterOrder && navigatorBehavior.outlined, `Navigator reorder/selection outline regressed: ${JSON.stringify(navigatorBehavior)}`)

  const explicitZoomEvidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const zoom=document.querySelector('.zoom-control select');const canvas=document.querySelector('.canvas-scroll');
    zoom.value='0.75';zoom.dispatchEvent(new Event('change',{bubbles:true}));await tick();canvas.scrollTop=80;await tick();
    const before={choice:zoom.value,user:editor.draftSnapshot.session.userZoom,scrollTop:canvas.scrollTop,selection:editor.selectedObjectId,history:editor.commandHistory.length};
    document.querySelector('.navigator-toggle').click();await new Promise(resolve=>setTimeout(resolve,260));
    const after={choice:zoom.value,user:editor.draftSnapshot.session.userZoom,scrollTop:canvas.scrollTop,selection:editor.selectedObjectId,history:editor.commandHistory.length};
    document.querySelector('.navigator-toggle').click();await new Promise(resolve=>setTimeout(resolve,260));
    zoom.value='fit';zoom.dispatchEvent(new Event('change',{bubbles:true}));await tick();
    return {before,after};
  })()`)
  assert(JSON.stringify(explicitZoomEvidence.before) === JSON.stringify(explicitZoomEvidence.after) && explicitZoomEvidence.after.user === 0.75, `explicit Zoom, scroll, selection, or history changed during collapse: ${JSON.stringify(explicitZoomEvidence)}`)

  await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1000, deviceScaleFactor: 1, mobile: false })
  await wait(300)
  const mobileBefore = await evaluate(`(()=>{const rect=(node)=>{const value=node.getBoundingClientRect();return {x:value.x,y:value.y,width:value.width,height:value.height}};return {navigator:rect(document.querySelector('.navigator-column')),panel:rect(document.querySelector('.control-panel')),canvas:rect(document.querySelector('.canvas-container')),frame:rect(document.querySelector('.preview-frame')),updateCount:Number(document.querySelector('[data-preview-update-count]')?.dataset.previewUpdateCount??0)}})()`)
  await evaluate(`document.querySelector('.navigator-toggle').click()`)
  await wait(350)
  const mobileAfter = await evaluate(`(()=>{const rect=(node)=>{const value=node.getBoundingClientRect();return {x:value.x,y:value.y,width:value.width,height:value.height}};return {navigator:rect(document.querySelector('.navigator-column')),panel:rect(document.querySelector('.control-panel')),canvas:rect(document.querySelector('.canvas-container')),frame:rect(document.querySelector('.preview-frame')),updateCount:Number(document.querySelector('[data-preview-update-count]')?.dataset.previewUpdateCount??0)}})()`)
  assert(mobileAfter.navigator.height <= 0.5 && closeEnough(mobileAfter.panel.height, mobileBefore.panel.height), `mobile Inspector height changed: before=${JSON.stringify(mobileBefore)} after=${JSON.stringify(mobileAfter)}`)
  assert(closeEnough(mobileAfter.canvas.y, mobileAfter.panel.y + mobileAfter.panel.height) && closeEnough(mobileAfter.canvas.height, mobileBefore.canvas.height + mobileBefore.navigator.height), `mobile Canvas did not reclaim Navigator height: before=${JSON.stringify(mobileBefore.canvas)} after=${JSON.stringify(mobileAfter.canvas)}`)
  assert(closeEnough(mobileAfter.frame.width, mobileBefore.frame.width) && closeEnough(mobileAfter.frame.height, mobileBefore.frame.height) && mobileAfter.updateCount === mobileBefore.updateCount, `mobile Preview remounted or refreshed: before=${JSON.stringify(mobileBefore)} after=${JSON.stringify(mobileAfter)}`)

  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
  assert(seriousErrors.length === 0, `unexpected browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)
  process.stdout.write(`${JSON.stringify({ status: 'PASS', before, after, expectedScroll, restored, navigatorBehavior, explicitZoomEvidence, mobile: { before: mobileBefore, after: mobileAfter } }, null, 2)}\n`)
} finally {
  socket?.close()
  stopChildren()
  await wait(150)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* Chromium may briefly retain its profile lock. */ }
}
