import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5188'
const cdpPort = 9358
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase036a-chrome-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const checkpoint = (label) => process.stderr.write(`[phase-036a] ${label}\n`)

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
  for (const child of children.reverse()) {
    if (!child.killed) child.kill()
    child.stdout?.destroy()
    child.stderr?.destroy()
  }
}

process.on('exit', stopChildren)
process.on('SIGINT', () => { stopChildren(); process.exit(130) })

let socket
try {
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5188', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1440,1000', baseUrl
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
  const page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5188'))
  if (!page) throw new Error('Phase 036A browser target not found.')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  const consoleWarnings = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) consoleWarnings.push(message.params.args.map((entry) => entry.value ?? entry.description ?? '').join(' '))
  })

  function send(method, params = {}) {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP request timed out: ${method}`)) }, 20000)
      pending.set(id, { resolve(value) { clearTimeout(timer); resolve(value) }, reject(error) { clearTimeout(timer); reject(error) } })
    })
  }

  async function evaluate(expression, attempt = 0) {
    try {
      const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
      return response.result.value
    } catch (error) {
      if (attempt < 3 && error instanceof Error && error.message.includes('Execution context was destroyed')) {
        await wait(100)
        return evaluate(expression, attempt + 1)
      }
      throw error
    }
  }

  async function waitFor(expression, timeout = 20000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(60)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  async function setViewport(width, height) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 480 })
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
  }

  async function navigate(route, selector) {
    await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;await router.push(${JSON.stringify(route)});return true})()`)
    await waitFor(`location.hash.split('?')[0]===${JSON.stringify(`#${route}`)}&&Boolean(document.querySelector(${JSON.stringify(selector)}))`)
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
  }

  async function capture(name) {
    await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(projectRoot, 'artifacts', name), Buffer.from(screenshot.data, 'base64'))
  }

  async function auditPage(route, viewport) {
    return evaluate(`(()=>{
      const visible=(element)=>{const style=getComputedStyle(element);const rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
      const named=(element)=>Boolean(element.getAttribute('aria-label')?.trim()||element.getAttribute('aria-labelledby')?.trim()||element.getAttribute('title')?.trim()||element.textContent?.trim());
      const controls=[...document.querySelectorAll('button,input:not([type="hidden"]),select,textarea')].filter(visible);
      const nameless=controls.filter(element=>element.tagName==='BUTTON'?!named(element):(!element.labels?.length&&!element.getAttribute('aria-label')&&!element.getAttribute('aria-labelledby')&&!element.getAttribute('title'))).map(element=>element.className||element.outerHTML.slice(0,80));
      const nested=[...document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')].filter(element=>visible(element)&&element.parentElement?.closest('button,a[href],[role="button"]')).map(element=>element.className||element.tagName);
      const ids=[...document.querySelectorAll('[id]')].map(element=>element.id);const duplicateIds=[...new Set(ids.filter((id,index)=>id&&ids.indexOf(id)!==index))];
      const brokenImages=[...document.images].filter(image=>image.complete&&image.naturalWidth===0).length;
      const horizontalOverflow=Math.max(0,Math.ceil(Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth));
      return {route:${JSON.stringify(route)},viewport:${JSON.stringify(viewport)},horizontalOverflow,nameless,nested,duplicateIds,brokenImages,emptyState:Boolean(document.querySelector('.product-empty-state')),skeletons:document.querySelectorAll('.product-skeleton').length};
    })()`)
  }

  async function measureFrames(sample = 60) {
    return evaluate(`new Promise(resolve=>{const values=[];let previous=performance.now();function frame(now){values.push(now-previous);previous=now;if(values.length<${sample})requestAnimationFrame(frame);else{const sorted=[...values].sort((a,b)=>a-b);const average=values.reduce((sum,value)=>sum+value,0)/values.length;resolve({average,p95:sorted[Math.floor(sorted.length*.95)]??0,fps:1000/average})}}requestAnimationFrame(frame)})`)
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Performance.enable')
  await setViewport(1440, 1000)
  await waitFor("Boolean(document.querySelector('#app')?.__vue_app__)", 30000)
  await evaluate(`(()=>{globalThis.__phase036aUnhandled=[];addEventListener('unhandledrejection',(event)=>globalThis.__phase036aUnhandled.push(String(event.reason?.stack??event.reason)));return true})()`)

  await evaluate(`(async()=>{
    const auth=(await import('/src/stores/auth.ts')).useAuthStore();auth.$patch({isAdmin:true,isInitialized:true,isLoading:false,errorMessage:''});
    const revisions=await import('/src/repositories/editorRevisionRepository.ts');
    revisions.editorDraftRepository.listDrafts=async()=>[];revisions.editorDraftRepository.countDrafts=async()=>0;
    revisions.favoriteRepository.listFavorites=async()=>[];revisions.favoriteRepository.countFavorites=async()=>0;
    revisions.editorPublishRepository.getHistory=async()=>[];revisions.guestPublishedRepository.loadPublishedSnapshot=async()=>null;
    const messages=(await import('/src/repositories/messageRepository.ts')).messageRepository;const now=Date.now();
    globalThis.__phase036aListCalls=0;globalThis.__phase036aMessages=[{id:'polish-message',name:'Polish Sender',email:'polish@example.test',message:'Product polish message',created_at:new Date(now-60000).toISOString(),updated_at:new Date(now-60000).toISOString(),expires_at:new Date(now+86400000).toISOString(),is_saved:false,ip_hash:'a'.repeat(64),user_agent:'runtime',status:'new',read_at:null}];
    messages.list=async(search='')=>{globalThis.__phase036aListCalls+=1;return globalThis.__phase036aMessages.filter(row=>[row.name,row.email??'',row.message].join(' ').toLowerCase().includes(search.trim().toLowerCase()))};
    messages.markRead=async(id)=>{const row=globalThis.__phase036aMessages.find(item=>item.id===id);row.read_at=new Date().toISOString();return {...row}};
    messages.setSaved=async(id,saved)=>{const row=globalThis.__phase036aMessages.find(item=>item.id===id);row.is_saved=saved;row.expires_at=saved?null:new Date(Date.now()+86400000).toISOString();return {...row}};
    messages.delete=async(id)=>{globalThis.__phase036aMessages=globalThis.__phase036aMessages.filter(item=>item.id!==id)};
    return true;
  })()`)

  const desktop = []
  const routes = [
    ['/', '.guest-home'], ['/admin', '.dashboard'], ['/admin/drafts', '.library-page'], ['/admin/favorites', '.library-page'],
    ['/admin/published', '.history-page'], ['/admin/media', '.admin-media-page'], ['/admin/media/library', '.media-library-page'],
    ['/admin/media/videos', '.media-library-page'], ['/admin/messages', '.messages-page'], ['/admin/maintenance', '.maintenance-page'], ['/admin/edit', '.edit-page']
  ]
  for (const [route, selector] of routes) {
    await navigate(route, selector)
    desktop.push(await auditPage(route, 'desktop'))
  }
  checkpoint('Desktop product routes audited')

  await navigate('/admin', '.dashboard')
  await waitFor("!document.querySelector('.card-clock-desc')?.textContent.includes('--')")
  const dashboard = await evaluate(`(()=>({clock:document.querySelector('.card-clock-desc')?.textContent.trim(),skeletons:document.querySelectorAll('.product-skeleton').length,cards:[...document.querySelectorAll('.card-link')].map(card=>({label:card.getAttribute('aria-label'),role:card.getAttribute('role'),tabIndex:card.tabIndex}))}))()`)
  await capture('phase-036a-dashboard.png')

  const emptyStates = {}
  for (const [key, route, title] of [
    ['drafts','/admin/drafts','No saved Drafts yet'],['favorites','/admin/favorites','No Favorite Drafts yet'],['history','/admin/published','No Published revisions yet'],['videos','/admin/media/videos','Belum ada video']
  ]) {
    await navigate(route, key === 'history' ? '.history-page' : key === 'videos' ? '.media-library-page' : '.library-page')
    await waitFor(`document.querySelector('.product-empty-state h2')?.textContent.includes(${JSON.stringify(title)})`)
    emptyStates[key] = await evaluate(`(()=>{const state=document.querySelector('.product-empty-state');return {title:state?.querySelector('h2')?.textContent.trim(),description:state?.querySelector('span:not(.product-empty-state__illustration)')?.textContent.trim(),actions:state?.querySelectorAll('button,a').length,illustration:Boolean(state?.querySelector('.product-empty-state__illustration svg'))}})()`)
    if (key === 'drafts') await capture('phase-036a-drafts-empty.png')
    if (key === 'videos') await capture('phase-036a-media-empty.png')
  }

  await navigate('/admin/messages', '.messages-page')
  await waitFor("document.querySelectorAll('.message-row').length===1")
  const messageFeedback = await evaluate(`(async()=>{
    const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));const input=document.querySelector('.search-box input');const before=globalThis.__phase036aListCalls;
    for(const value of ['P','Po','Polish']){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))}await sleep(320);const debouncedCalls=globalThis.__phase036aListCalls-before;
    input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));await sleep(260);
    document.querySelector('.message-row')?.click();await sleep(30);document.querySelector('.detail-save')?.click();await sleep(30);
    const successToast=Boolean(document.querySelector('.product-toast--success[role="status"]'));
    const deleteButton=document.querySelector('.message-delete-btn');deleteButton?.focus();deleteButton?.click();await sleep(30);
    const dialog=document.querySelector('.product-confirmation');const cancelFocused=document.activeElement?.classList.contains('confirm-cancel');
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await sleep(220);const escapeDismissed=!document.querySelector('.product-confirmation');const focusRestored=document.activeElement===deleteButton;
    deleteButton?.click();await sleep(30);document.querySelector('.product-confirmation__confirm')?.click();await sleep(30);
    return {debouncedCalls,successToast,cancelFocused,escapeDismissed,focusRestored,remaining:globalThis.__phase036aMessages.length,empty:Boolean(document.querySelector('.product-empty-state'))};
  })()`)
  await capture('phase-036a-messages-feedback.png')

  const networkFeedback = await evaluate(`(async()=>{const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));dispatchEvent(new Event('offline'));await sleep(20);const offline=document.querySelector('.product-toast--warning')?.textContent.includes('offline')??false;dispatchEvent(new Event('online'));await sleep(20);const restored=[...document.querySelectorAll('.product-toast--success')].some(item=>item.textContent.includes('Connection restored'));return {offline,restored}})()`)

  await evaluate(`(async()=>{const feedback=await import('/src/composables/useProductFeedback.ts');feedback.productFeedback.clear();return true})()`)
  await wait(220)

  await navigate('/admin/maintenance', '.maintenance-page')
  await capture('phase-036a-maintenance.png')
  await navigate('/admin/edit', '.edit-page')
  const editor = await evaluate(`(()=>({persistentHeader:document.querySelector('.admin-header')?.getBoundingClientRect().top===0,stableScrollbars:getComputedStyle(document.querySelector('.control-panel')).scrollbarGutter,accordionTransitions:getComputedStyle(document.querySelector('.accordion-content')).transitionDuration,statusBar:Boolean(document.querySelector('.editor-status-bar')),selectionOutline:Boolean(document.querySelector('.editor-preview-selected--primary'))}))()`)
  const editorFrames = await measureFrames()
  await capture('phase-036a-editor.png')
  await navigate('/', '.guest-home')
  const guestFeedbackIsolated = await evaluate("document.querySelectorAll('.product-toast').length===0")
  const guestFrames = await measureFrames()
  await capture('phase-036a-guest.png')

  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;pinia._s.get('auth').$patch({isAdmin:false,isInitialized:true,isLoading:false});return true})()`)
  await navigate('/admin/login', '.admin-login')
  const reducedMotion = await evaluate(`(()=>{const button=document.querySelector('.login-card button');return {transition:button?getComputedStyle(button).transitionDuration:null,focusName:button?.textContent.trim()}})()`)
  await capture('phase-036a-login.png')
  await send('Emulation.setEmulatedMedia', { features: [] })

  await setViewport(390, 844)
  await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;pinia._s.get('auth').$patch({isAdmin:true,isInitialized:true,isLoading:false});return true})()`)
  await navigate('/admin', '.dashboard')
  const mobile = await auditPage('/admin', 'mobile')
  const touchTargets = await evaluate(`(()=>{const visible=(element)=>{const style=getComputedStyle(element);const rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};const controls=[...document.querySelectorAll('.admin-content button,.admin-header button')].filter(visible);return {count:controls.length,below44:controls.filter(item=>item.getBoundingClientRect().height<43.5).map(item=>item.className||item.textContent.trim()).slice(0,10)}})()`)
  await capture('phase-036a-mobile-dashboard.png')

  const unhandled = await evaluate('globalThis.__phase036aUnhandled')
  const metrics = await send('Performance.getMetrics')
  const metric = (name) => metrics.metrics.find((entry) => entry.name === name)?.value ?? 0
  const allAudits = [...desktop, mobile]
  const failures = []
  if (allAudits.some((entry) => entry.horizontalOverflow || entry.nameless.length || entry.nested.length || entry.duplicateIds.length || entry.brokenImages)) failures.push('A route accessibility/layout audit failed')
  if (!dashboard.clock || dashboard.clock.includes('--') || dashboard.skeletons || dashboard.cards.some((card) => card.role !== 'button' || card.tabIndex !== 0)) failures.push('Dashboard startup/card polish failed')
  if (Object.values(emptyStates).some((state) => !state.title || !state.description || state.actions < 1 || !state.illustration)) failures.push('A required complete empty state is incomplete')
  if (messageFeedback.debouncedCalls !== 1 || !messageFeedback.successToast || !messageFeedback.cancelFocused || !messageFeedback.escapeDismissed || !messageFeedback.focusRestored || messageFeedback.remaining !== 0 || !messageFeedback.empty) failures.push(`Message feedback/focus/debounce failed: ${JSON.stringify(messageFeedback)}`)
  if (!networkFeedback.offline || !networkFeedback.restored || !guestFeedbackIsolated) failures.push('Unified feedback or Admin-to-Guest feedback isolation failed')
  if (!editor.persistentHeader || !editor.stableScrollbars.includes('stable') || !editor.statusBar || !editor.selectionOutline) failures.push(`Editor polish evidence failed: ${JSON.stringify(editor)}`)
  if (editorFrames.fps < 50 || guestFrames.fps < 50 || editorFrames.p95 > 25 || guestFrames.p95 > 25) failures.push('Frame pacing fell below the Phase 036A target')
  if (!reducedMotion.transition.split(',').every((value) => Number.parseFloat(value) <= .01)) failures.push(`Reduced-motion timing remains too long: ${reducedMotion.transition}`)
  if (touchTargets.below44.length) failures.push(`Mobile touch targets below 44px: ${touchTargets.below44.join(', ')}`)
  if (runtimeErrors.length || consoleWarnings.length || unhandled.length) failures.push('Runtime errors, warnings or unhandled rejections were reported')

  const evidence = {
    status: failures.length ? 'FAIL' : 'PASS', scope: 'Phase 036A local product polish browser audit', desktop, mobile,
    dashboard, emptyStates, messageFeedback, networkFeedback, guestFeedbackIsolated, editor, reducedMotion, touchTargets,
    performance: { editorFrames, guestFrames, scriptSeconds: metric('ScriptDuration'), layouts: metric('LayoutCount'), styleRecalcs: metric('RecalcStyleCount') },
    runtimeErrors, consoleWarnings, unhandled, viteErrors,
    browserErrors: browserErrors.split('\n').filter((line) => /error|fail/i.test(line)).slice(0, 10),
    screenshots: ['artifacts/phase-036a-dashboard.png','artifacts/phase-036a-drafts-empty.png','artifacts/phase-036a-media-empty.png','artifacts/phase-036a-messages-feedback.png','artifacts/phase-036a-maintenance.png','artifacts/phase-036a-editor.png','artifacts/phase-036a-guest.png','artifacts/phase-036a-login.png','artifacts/phase-036a-mobile-dashboard.png'],
    failures
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`)
  if (failures.length) process.exitCode = 1
  checkpoint(`Audit ${evidence.status}`)
} finally {
  try { socket?.close() } catch { /* best effort */ }
  stopChildren()
  await wait(200)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* Chromium may release its lock after exit. */ }
}
