import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5190'
const cdpPort = 9350
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-natural-scroll-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(`Natural scroll runtime failure: ${message}`)
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5190', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1600,1000', baseUrl
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  let page
  const targetStarted = Date.now()
  while (!page && Date.now() - targetStarted < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5190'))
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

  async function pointFor(expression) {
    return evaluate(`(()=>{const node=${expression};const rect=node.getBoundingClientRect();return {x:Math.round(rect.left+rect.width/2),y:Math.round(rect.top+Math.min(rect.height/2,120))}})()`)
  }

  async function wheelAt(point, deltaY, modifiers = 0) {
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: point.x, y: point.y, deltaX: 0, deltaY, modifiers })
    await wait(180)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(async()=>{
    localStorage.removeItem('portfolio-editor-navigator-open');
    const authModule=await import('/src/stores/auth.ts');
    const router=(await import('/src/router/index.ts')).default;
    const auth=authModule.useAuthStore();auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});
    await router.push('/admin/edit');return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`)
  await wait(500)

  await evaluate(`(async()=>{
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    for(const section of new Set(editor.objects.map(object=>object.section)))editor.setLayerExpanded('section:'+section,true);
    globalThis.__naturalWheelEvents=[];
    window.addEventListener('wheel',(event)=>globalThis.__naturalWheelEvents.push({tag:event.target?.tagName,prevented:event.defaultPrevented,ctrl:event.ctrlKey}),{passive:true});
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true;
  })()`)

  const styles = await evaluate(`(()=>{
    const info=(node)=>{const style=getComputedStyle(node);return {overflowX:style.overflowX,overflowY:style.overflowY,overscrollY:style.overscrollBehaviorY,pointerEvents:style.pointerEvents,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight,lenisPrevent:Boolean(node.closest('[data-lenis-prevent]'))}};
    return {navigator:info(document.querySelector('.object-navigator')),layerTree:info(document.querySelector('.layer-tree')),inspector:info(document.querySelector('.control-panel')),preview:info(document.querySelector('.canvas-scroll'))};
  })()`)
  for (const [name, value] of Object.entries({ navigator: styles.navigator, inspector: styles.inspector, preview: styles.preview })) {
    assert(value.overflowY === 'auto' && value.scrollHeight > value.clientHeight && value.pointerEvents !== 'none' && value.lenisPrevent, `${name} is not a native active scroll container: ${JSON.stringify(value)}`)
    assert(value.overscrollY === 'auto', `${name} still locks overscroll chaining: ${JSON.stringify(value)}`)
  }
  assert(styles.navigator.overflowX === 'hidden' && styles.inspector.overflowX === 'hidden' && styles.preview.overflowX === 'auto' && styles.layerTree.overflowY === 'visible', `overflow axis ownership is wrong: ${JSON.stringify(styles)}`)

  await evaluate(`document.querySelector('.object-navigator').scrollTop=0`)
  const navigatorPoint = await pointFor(`document.querySelector('.object-search')`)
  await wheelAt(navigatorPoint, 260)
  const navigatorEvidence = await evaluate(`(()=>({top:document.querySelector('.object-navigator').scrollTop,events:globalThis.__naturalWheelEvents.splice(0)}))()`)
  assert(navigatorEvidence.top > 0 && navigatorEvidence.events.some((event) => !event.prevented), `Navigator did not natively scroll from its Search/header area: ${JSON.stringify(navigatorEvidence)}`)

  await evaluate(`document.querySelector('.control-panel').scrollTop=0`)
  const inspectorPoint = await pointFor(`document.querySelector('.panel-heading')`)
  await wheelAt(inspectorPoint, 260)
  const inspectorEvidence = await evaluate(`(()=>({top:document.querySelector('.control-panel').scrollTop,events:globalThis.__naturalWheelEvents.splice(0)}))()`)
  assert(inspectorEvidence.top > 0 && inspectorEvidence.events.some((event) => !event.prevented), `Inspector did not natively scroll: ${JSON.stringify(inspectorEvidence)}`)

  const numericBefore = await evaluate(`(async()=>{
    const panel=document.querySelector('.control-panel');
    const input=[...panel.querySelectorAll('input[type="number"]:not(:disabled)')].find(node=>node.offsetParent);
    if(!input)throw new Error('No active numeric Inspector control found.');
    input.dataset.naturalScrollProbe='numeric';input.scrollIntoView({block:'center'});input.blur();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return {top:panel.scrollTop,value:input.value};
  })()`)
  const numericPoint = await pointFor(`document.querySelector('[data-natural-scroll-probe="numeric"]')`)
  await wheelAt(numericPoint, 180)
  const numericEvidence = await evaluate(`(()=>{const panel=document.querySelector('.control-panel');const input=document.querySelector('[data-natural-scroll-probe="numeric"]');return {before:${JSON.stringify(numericBefore)},top:panel.scrollTop,value:input.value,events:globalThis.__naturalWheelEvents.splice(0)}})()`)
  assert(numericEvidence.top > numericEvidence.before.top && numericEvidence.value === numericEvidence.before.value && numericEvidence.events.some((event) => !event.prevented), `unfocused numeric field blocked Inspector scrolling or changed value: ${JSON.stringify(numericEvidence)}`)

  await evaluate(`document.querySelector('.canvas-scroll').scrollTop=0`)
  const previewPoint = await pointFor(`document.querySelector('.canvas-scroll')`)
  await wheelAt(previewPoint, 260)
  const previewEvidence = await evaluate(`(()=>({top:document.querySelector('.canvas-scroll').scrollTop,events:globalThis.__naturalWheelEvents.splice(0)}))()`)
  assert(previewEvidence.top > 0 && previewEvidence.events.some((event) => !event.prevented), `Preview did not natively scroll: ${JSON.stringify(previewEvidence)}`)

  await evaluate(`document.querySelector('.canvas-scroll').scrollTop=0`)
  for (let index = 0; index < 5; index += 1) await wheelAt(previewPoint, 18.5)
  const precisionEvidence = await evaluate(`(()=>({top:document.querySelector('.canvas-scroll').scrollTop,events:globalThis.__naturalWheelEvents.splice(0)}))()`)
  assert(precisionEvidence.top > 0 && precisionEvidence.events.length >= 5 && precisionEvidence.events.every((event) => !event.prevented), `high-resolution/touchpad-style wheel input was blocked: ${JSON.stringify(precisionEvidence)}`)

  const zoomBefore = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.session.userZoom`)
  await wheelAt(previewPoint, -120, 2)
  const zoomEvidence = await evaluate(`(()=>({before:${JSON.stringify(zoomBefore)},after:document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.session.userZoom,events:globalThis.__naturalWheelEvents.splice(0)}))()`)
  assert(typeof zoomEvidence.after === 'number' && zoomEvidence.after !== zoomEvidence.before && zoomEvidence.events.some((event) => event.ctrl && event.prevented), `Ctrl+Wheel Zoom behavior regressed: ${JSON.stringify(zoomEvidence)}`)

  await evaluate(`document.querySelector('.control-panel').scrollTop=0`)
  const scrollbar = await evaluate(`(()=>{const node=document.querySelector('.control-panel');const rect=node.getBoundingClientRect();const width=node.offsetWidth-node.clientWidth;const thumb=Math.max(24,node.clientHeight*node.clientHeight/node.scrollHeight);return {x:Math.round(rect.right-Math.max(3,width/2)),startY:Math.round(rect.top+thumb/2),endY:Math.round(rect.top+thumb/2+140),width}})()`)
  if (scrollbar.width > 0) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: scrollbar.x, y: scrollbar.startY, button: 'none', buttons: 0 })
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: scrollbar.x, y: scrollbar.startY, button: 'left', buttons: 1, clickCount: 1 })
    await wait(80)
    for (let step = 1; step <= 8; step += 1) {
      const y = Math.round(scrollbar.startY + (scrollbar.endY - scrollbar.startY) * step / 8)
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: scrollbar.x, y, button: 'none', buttons: 1 })
      await wait(25)
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: scrollbar.x, y: scrollbar.endY, button: 'left', buttons: 0, clickCount: 1 })
    await wait(150)
  }
  const scrollbarEvidence = await evaluate(`document.querySelector('.control-panel').scrollTop`)
  const scrollbarStatus = scrollbar.width <= 0
    ? 'NOT AVAILABLE'
    : scrollbarEvidence > 0
      ? 'OBSERVED'
      : 'NOT RUN — synthetic CDP input cannot certify native scrollbar-thumb dragging'

  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
  assert(seriousErrors.length === 0, `unexpected browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)
  process.stdout.write(`${JSON.stringify({ status: 'PASS', styles, navigatorEvidence, inspectorEvidence, numericEvidence, previewEvidence, precisionEvidence, zoomEvidence, scrollbar: { ...scrollbar, scrollTop: scrollbarEvidence, status: scrollbarStatus } }, null, 2)}\n`)
} finally {
  socket?.close()
  stopChildren()
  await wait(150)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* Chromium may briefly retain its profile lock. */ }
}
