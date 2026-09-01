import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5184'
const cdpPort = 9344
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase033b-chrome-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const checkpoint = (label) => process.stderr.write(`[phase-033b] ${label}\n`)

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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5184', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)
  checkpoint('Vite ready')

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1440,1000', baseUrl
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
  const page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5184'))
  if (!page) throw new Error('Phase 033B browser target not found.')
  checkpoint('Chromium target ready')

  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeErrors = []
  const consoleWarnings = []
  const networkFailures = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id)
      pending.delete(message.id)
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
    if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
      consoleWarnings.push(message.params.args.map((entry) => entry.value ?? entry.description ?? '').join(' '))
    }
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) {
      networkFailures.push(`${message.params.errorText}:${message.params.type}`)
    }
  })

  function send(method, params = {}) {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`CDP request timed out: ${method}`))
      }, 20000)
      pending.set(id, {
        resolve(value) { clearTimeout(timer); resolve(value) },
        reject(error) { clearTimeout(timer); reject(error) }
      })
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

  async function waitFor(expression, timeout = 15000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(60)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  async function setViewport(width, height) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 480 })
    await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
  }

  async function navigate(route, selector) {
    await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;await router.push(${JSON.stringify(route)});return true})()`)
    try {
      await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))&&location.hash.split('?')[0]===${JSON.stringify(`#${route}`)}`)
    } catch (error) {
      const diagnostics = await evaluate(`({requested:${JSON.stringify(route)},hash:location.hash,body:document.body.innerText.slice(0,900),auth:(()=>{const pinia=document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia;const store=pinia?._s?.get('auth');return store?{isAdmin:store.isAdmin,isInitialized:store.isInitialized,isLoading:store.isLoading}:null})()})`)
      throw new Error(`${error.message}; routeDiagnostics=${JSON.stringify(diagnostics)}`)
    }
    await evaluate(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`)
  }

  async function auditPage(route, viewport) {
    return evaluate(`(()=>{
      const visible=(element)=>{const style=getComputedStyle(element);const rect=element.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};
      const named=(element)=>Boolean(element.getAttribute('aria-label')?.trim()||element.getAttribute('aria-labelledby')?.trim()||element.getAttribute('title')?.trim()||element.textContent?.trim());
      const controls=[...document.querySelectorAll('button,input:not([type="hidden"]),select,textarea')].filter(visible);
      const namelessButtons=controls.filter(element=>element.tagName==='BUTTON'&&!named(element)).map(element=>element.className||element.outerHTML.slice(0,80));
      const unlabeledControls=controls.filter(element=>element.tagName!=='BUTTON'&&!element.labels?.length&&!element.getAttribute('aria-label')&&!element.getAttribute('aria-labelledby')&&!element.getAttribute('title')).map(element=>element.className||element.outerHTML.slice(0,80));
      const focusables=[...document.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')].filter((element)=>visible(element)&&!element.closest('[inert]'));
      const horizontallyScrollable=(element)=>{for(let parent=element.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent);if(parent.scrollWidth>parent.clientWidth&&['auto','scroll'].includes(style.overflowX))return true}return false};
      const offscreenFocusable=focusables.filter(element=>{const rect=element.getBoundingClientRect();const overlapsViewportY=rect.bottom>0&&rect.top<innerHeight;return overlapsViewportY&&(rect.right<=0||rect.left>=innerWidth)&&!horizontallyScrollable(element)}).map(element=>element.className||element.textContent?.trim().slice(0,40));
      const nestedInteractive=[...document.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')].filter(element=>visible(element)&&element.parentElement?.closest('button,a[href],[role="button"]')).map(element=>element.className||element.tagName);
      const ids=[...document.querySelectorAll('[id]')].map(element=>element.id);const duplicateIds=[...new Set(ids.filter((id,index)=>id&&ids.indexOf(id)!==index))];
      const brokenImages=[...document.images].filter(image=>image.complete&&image.naturalWidth===0).map(image=>image.currentSrc||image.src).slice(0,10);
      const bodyWidth=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);const horizontalOverflow=Math.max(0,Math.ceil(bodyWidth-innerWidth));
      const headerTitle=document.querySelector('.admin-header .page-title')?.textContent?.trim()??null;
      const itemCount=document.querySelector('.item-count')?.textContent?.trim()??'';
      const emptyState=Boolean(document.querySelector('.empty-state,.media-empty,.media-state,.history-empty,.messages-empty'));
      const closedDrawer=document.querySelector('.admin-sidebar.drawer:not(.open)');
      return {route:${JSON.stringify(route)},viewport:${JSON.stringify(viewport)},headerTitle,horizontalOverflow,namelessButtons,unlabeledControls,offscreenFocusable,nestedInteractive,duplicateIds,brokenImages,itemCount,emptyState,closedDrawerInert:Boolean(closedDrawer?.inert),interactiveCount:focusables.length,bodyHeight:document.documentElement.scrollHeight};
    })()`)
  }

  async function capture(name) {
    await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(projectRoot, 'artifacts', name), Buffer.from(screenshot.data, 'base64'))
  }

  async function measureFrames(sample = 60) {
    return evaluate(`new Promise(resolve=>{const values=[];let previous=performance.now();function frame(now){values.push(now-previous);previous=now;if(values.length<${sample})requestAnimationFrame(frame);else{const sorted=[...values].sort((a,b)=>a-b);resolve({average:values.reduce((sum,value)=>sum+value,0)/values.length,p95:sorted[Math.floor(sorted.length*.95)]??0,fps:1000/(values.reduce((sum,value)=>sum+value,0)/values.length)})}}requestAnimationFrame(frame)})`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Network.enable')
  await send('Performance.enable')
  await setViewport(1440, 1000)
  try {
    await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`, 30000)
  } catch (error) {
    const diagnostics = await evaluate(`({url:location.href,body:document.body.innerText.slice(0,1600),html:document.documentElement.innerHTML.slice(0,1200)})`)
    throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}; vite=${viteErrors}; browser=${browserErrors}; runtime=${runtimeErrors.join(' | ')}`)
  }
  await evaluate(`(()=>{globalThis.__phase033bUnhandled=[];addEventListener('unhandledrejection',(event)=>globalThis.__phase033bUnhandled.push(String(event.reason?.stack??event.reason)));return true})()`)

  const desktop = []
  const mobile = []
  const publicRoutes = [
    ['/', '.guest-home', ''],
    ['/contact-detail', '.contact-detail-page', ''],
    ['/admin/login', '.admin-login', 'Admin Portal'],
    ['/admin/bootstrap', '.admin-login', 'First Admin Bootstrap']
  ]
  for (const [route, selector] of publicRoutes) {
    await navigate(route, selector)
    desktop.push(await auditPage(route, 'desktop'))
  }
  checkpoint('Desktop public routes audited')

  await evaluate(`(async()=>{
    const auth=(await import('/src/stores/auth.ts')).useAuthStore();auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});
    const repository=(await import('/src/repositories/messageRepository.ts')).messageRepository;const now=Date.now();
    globalThis.__phase033bMessages=[
      {id:'message-a',name:'Alpha Sender',email:'alpha@example.test',message:'First stabilization message',created_at:new Date(now-60000).toISOString(),updated_at:new Date(now-60000).toISOString(),expires_at:new Date(now+86400000).toISOString(),is_saved:false,ip_hash:'a'.repeat(64),user_agent:'runtime',status:'new',read_at:null},
      {id:'message-b',name:'Beta Sender',email:null,message:'Second stabilization message',created_at:new Date(now-120000).toISOString(),updated_at:new Date(now-120000).toISOString(),expires_at:new Date(now+172800000).toISOString(),is_saved:false,ip_hash:'b'.repeat(64),user_agent:'runtime',status:'new',read_at:null}
    ];
    repository.list=async(search='')=>globalThis.__phase033bMessages.filter(row=>[row.name,row.email??'',row.message].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
    repository.markRead=async(id)=>{const row=globalThis.__phase033bMessages.find(item=>item.id===id);row.read_at=new Date().toISOString();return {...row}};
    repository.setSaved=async(id,saved)=>{const row=globalThis.__phase033bMessages.find(item=>item.id===id);row.is_saved=saved;row.expires_at=saved?null:new Date(Date.now()+86400000).toISOString();return {...row}};
    repository.delete=async(id)=>{globalThis.__phase033bMessages=globalThis.__phase033bMessages.filter(item=>item.id!==id)};
    return true;
  })()`)

  const adminRoutes = [
    ['/admin', '.dashboard', 'Dashboard'],
    ['/admin/drafts', '.library-page', 'Draft Library'],
    ['/admin/favorites', '.library-page', 'Favorite Drafts'],
    ['/admin/published', '.history-page', 'Publish History'],
    ['/admin/media', '.admin-media-page', 'Manage Media'],
    ['/admin/media/library', '.media-library-page', 'Asset Library'],
    ['/admin/media/images', '.media-library-page', 'Galeri Gambar'],
    ['/admin/media/videos', '.media-library-page', 'Galeri Video'],
    ['/admin/media/documents', '.media-library-page', 'Galeri Dokumen'],
    ['/admin/maintenance', '.maintenance-page', 'Maintenance'],
    ['/admin/messages', '.messages-page', 'Messages'],
    ['/admin/edit', '.edit-page', 'Inspector']
  ]
  for (const [route, selector] of adminRoutes) {
    await navigate(route, selector)
    desktop.push(await auditPage(route, 'desktop'))
  }
  checkpoint('Desktop Admin routes audited')

  await navigate('/admin', '.dashboard', 'Dashboard')
  const dashboardEvidence = await evaluate(`(()=>{const cards=[...document.querySelectorAll('.card-link')];const sidebar=[...document.querySelectorAll('.nav-item')].map(item=>({label:item.textContent.trim(),hasIcon:Boolean(item.querySelector('svg'))}));const messageCard=cards.find(card=>card.textContent.includes('Pesan'));return {cards:cards.map(card=>({label:card.getAttribute('aria-label'),href:card.getAttribute('href')})),sidebar,messageCardText:messageCard?.textContent.trim(),hamburgerExpanded:document.querySelector('.admin-header .hamburger-btn')?.getAttribute('aria-expanded'),maintenanceDead:null}})()`)
  await capture('phase-033b-dashboard.png')
  const dashboardNavigation = {}
  for (const [label, expectedRoute] of [['Open Draft Library', '/admin/drafts'], ['Open Favorite Drafts', '/admin/favorites'], ['Open Messages', '/admin/messages']]) {
    await navigate('/admin', '.dashboard')
    await evaluate(`document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)})?.click()`)
    await waitFor(`location.hash.split('?')[0]===${JSON.stringify(`#${expectedRoute}`)}`)
    dashboardNavigation[label] = expectedRoute
  }

  await navigate('/admin/messages', '.messages-page', 'Messages')
  const messageEvidence = await evaluate(`(async()=>{const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));document.querySelector('.message-row')?.click();await tick();const read=Boolean(globalThis.__phase033bMessages[0].read_at);document.querySelector('.detail-save')?.click();await tick();const saved=globalThis.__phase033bMessages[0].is_saved;const search=document.querySelector('.search-box input');search.value='Beta';search.dispatchEvent(new Event('input',{bubbles:true}));for(let attempt=0;attempt<50&&document.querySelectorAll('.message-row').length!==1;attempt+=1)await wait(20);const searched=document.querySelectorAll('.message-row').length===1&&document.body.innerText.includes('Beta Sender');document.querySelector('.message-delete-btn')?.click();await tick();const dialog=Boolean(document.querySelector('[role="dialog"]'));document.querySelector('.confirm-cancel')?.click();return {read,saved,searched,dialog,count:globalThis.__phase033bMessages.length}})()`)
  await capture('phase-033b-messages.png')
  checkpoint('Message interactions audited')

  await navigate('/admin/maintenance', '.maintenance-page', 'Maintenance')
  const maintenanceEvidence = await evaluate(`(async()=>{const buttons=[...document.querySelectorAll('.maintenance-card')];const before=document.body.innerText;buttons[0]?.click();await new Promise(resolve=>requestAnimationFrame(resolve));const importNoop=location.hash.includes('/admin/maintenance')&&document.body.innerText===before;buttons[1]?.click();await new Promise(resolve=>requestAnimationFrame(resolve));const exportNoop=location.hash.includes('/admin/maintenance')&&document.body.innerText===before;buttons[2]?.click();await new Promise(resolve=>requestAnimationFrame(resolve));const resetDialog=Boolean(document.querySelector('[role="dialog"]'));return {enabled:buttons.filter(button=>!button.disabled).length,importNoop,exportNoop,resetDialog}})()`)

  await setViewport(390, 844)
  await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;pinia._s.get('auth').$patch({isAdmin:false,isInitialized:true,isLoading:false});return true})()`)
  for (const [route, selector] of publicRoutes) {
    await navigate(route, selector)
    mobile.push(await auditPage(route, 'mobile'))
  }
  await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;pinia._s.get('auth').$patch({isAdmin:true,isInitialized:true,isLoading:false});return true})()`)
  for (const [route, selector] of adminRoutes) {
    await navigate(route, selector)
    mobile.push(await auditPage(route, 'mobile'))
  }
  checkpoint('Mobile routes audited')
  await navigate('/admin', '.dashboard', 'Dashboard')
  await capture('phase-033b-mobile-dashboard.png')
  const sidebarEvidence = await evaluate(`(async()=>{const button=document.querySelector('.admin-header .hamburger-btn');button.click();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const aside=document.querySelector('.admin-sidebar');const open={expanded:button.getAttribute('aria-expanded'),inert:aside.inert,ariaHidden:aside.getAttribute('aria-hidden')};document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await new Promise(resolve=>requestAnimationFrame(resolve));return {open,closed:{inert:aside.inert,ariaHidden:aside.getAttribute('aria-hidden')}}})()`)

  await setViewport(1440, 1000)
  await navigate('/', '.guest-home')
  const guestFrames = await measureFrames()
  await capture('phase-033b-guest.png')
  await navigate('/admin/media/library', '.media-library-page', 'Asset Library')
  const mediaFrames = await measureFrames()
  await capture('phase-033b-media-library.png')
  await navigate('/admin/edit', '.edit-page', 'Inspector')
  const editorFrames = await measureFrames()
  const editorInspector = await evaluate(`(()=>({legacyTypographyControls:document.querySelectorAll('[data-property-key^="runtime:typography:"]').length,propertyKeys:[...document.querySelectorAll('[data-property-key]')].map(element=>element.getAttribute('data-property-key'))}))()`)
  await capture('phase-033b-editor.png')
  checkpoint('Frame samples collected')
  const metrics = await send('Performance.getMetrics')
  const metric = (name) => metrics.metrics.find((entry) => entry.name === name)?.value ?? 0
  const unhandled = await evaluate(`globalThis.__phase033bUnhandled`)

  const allPages = [...desktop, ...mobile]
  const expectedTitles = new Map([
    ['/admin', 'Dashboard'], ['/admin/drafts', 'Draft Library'], ['/admin/favorites', 'Favorite Drafts'],
    ['/admin/published', 'Publish History'], ['/admin/media', 'Manage Media'], ['/admin/media/library', 'Asset Library'],
    ['/admin/media/images', 'Image Gallery'], ['/admin/media/videos', 'Video Gallery'],
    ['/admin/media/documents', 'Document Gallery'], ['/admin/maintenance', 'Maintenance'],
    ['/admin/messages', 'Messages'], ['/admin/edit', 'Edit']
  ])
  const failures = []
  for (const pageAudit of allPages) {
    if (pageAudit.horizontalOverflow) failures.push(`${pageAudit.route}/${pageAudit.viewport}: horizontal overflow ${pageAudit.horizontalOverflow}px`)
    if (pageAudit.namelessButtons.length) failures.push(`${pageAudit.route}/${pageAudit.viewport}: nameless buttons`)
    if (pageAudit.unlabeledControls.length) failures.push(`${pageAudit.route}/${pageAudit.viewport}: unlabeled controls`)
    if (pageAudit.offscreenFocusable.length) failures.push(`${pageAudit.route}/${pageAudit.viewport}: horizontally offscreen focusables`)
    if (pageAudit.nestedInteractive.length) failures.push(`${pageAudit.route}/${pageAudit.viewport}: nested interactive controls`)
    if (pageAudit.duplicateIds.length) failures.push(`${pageAudit.route}/${pageAudit.viewport}: duplicate ids`)
    if (pageAudit.brokenImages.length) failures.push(`${pageAudit.route}/${pageAudit.viewport}: broken images`)
    const expectedTitle = expectedTitles.get(pageAudit.route)
    if (expectedTitle && pageAudit.headerTitle !== expectedTitle) failures.push(`${pageAudit.route}/${pageAudit.viewport}: header title ${pageAudit.headerTitle}`)
  }
  if (dashboardEvidence.sidebar.some((item) => !item.hasIcon)) failures.push('Dashboard sidebar has a missing icon')
  if (dashboardEvidence.hamburgerExpanded !== 'false') failures.push('Dashboard hamburger has no collapsed state')
  if (dashboardNavigation['Open Draft Library'] !== '/admin/drafts') failures.push('Draft dashboard card navigation failed')
  if (dashboardNavigation['Open Favorite Drafts'] !== '/admin/favorites') failures.push('Favorite dashboard card navigation failed')
  if (dashboardNavigation['Open Messages'] !== '/admin/messages') failures.push('Message dashboard card navigation failed')
  if (!messageEvidence.read || !messageEvidence.saved || !messageEvidence.searched || !messageEvidence.dialog) failures.push('Message Center interaction contract failed')
  if (maintenanceEvidence.enabled !== 0 || maintenanceEvidence.resetDialog) failures.push('Unavailable Maintenance controls are still actionable')
  if (sidebarEvidence.open.expanded !== 'true' || sidebarEvidence.open.inert || sidebarEvidence.open.ariaHidden !== 'false') failures.push('Open sidebar semantics failed')
  if (!sidebarEvidence.closed.inert || sidebarEvidence.closed.ariaHidden !== 'true') failures.push('Closed sidebar remains exposed')
  if ([guestFrames, mediaFrames, editorFrames].some((sample) => sample.fps < 50)) failures.push('Frame sample fell below 50 FPS')
  if (editorInspector.legacyTypographyControls) failures.push('Inspector still renders legacy controls alongside canonical typography metadata')
  if (runtimeErrors.length) failures.push('Runtime errors were reported')
  if (consoleWarnings.length) failures.push('Console warnings were reported')
  if (networkFailures.length) failures.push('Local runtime had network failures')
  if (unhandled.length) failures.push('Unhandled promise rejection was reported')
  if (/ResizeObserver loop/i.test(viteErrors)) failures.push('ResizeObserver loop warning remains')

  const evidence = {
    status: failures.length ? 'FAIL' : 'PASS',
    scope: 'Phase 033B full local browser stabilization audit',
    desktop,
    mobile,
    dashboard: dashboardEvidence,
    dashboardNavigation,
    messages: messageEvidence,
    maintenance: maintenanceEvidence,
    sidebar: sidebarEvidence,
    performance: { guestFrames, mediaFrames, editorFrames, scriptSeconds: metric('ScriptDuration'), layouts: metric('LayoutCount'), styleRecalcs: metric('RecalcStyleCount') },
    editorInspector,
    runtimeErrors,
    consoleWarnings,
    networkFailures,
    unhandled,
    viteErrors,
    browserErrors: browserErrors.split('\n').filter((line) => /error|fail/i.test(line)).slice(0, 10),
    screenshots: ['artifacts/phase-033b-dashboard.png','artifacts/phase-033b-mobile-dashboard.png','artifacts/phase-033b-messages.png','artifacts/phase-033b-guest.png','artifacts/phase-033b-media-library.png','artifacts/phase-033b-editor.png'],
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
