import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5186'
const cdpPort = 9356
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-phase036-chrome-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const checkpoint = (label) => process.stderr.write(`[phase-036] ${label}\n`)

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
  const distFiles = await readdir(path.join(projectRoot, 'dist'))
  const distAssets = await readdir(path.join(projectRoot, 'dist', 'assets'))
  const required = ['index.html', 'manifest.webmanifest', 'sw.js', 'offline.html', 'robots.txt', 'sitemap.xml', 'social-preview.webp', 'app-icon.svg']
  const missing = required.filter((name) => !distFiles.includes(name))
  const entry = distAssets.find((name) => /^index-[\w-]+\.js$/.test(name))
  const entryBytes = entry ? (await stat(path.join(projectRoot, 'dist', 'assets', entry))).size : 0
  const staticEvidence = {
    missing,
    entry,
    entryBytes,
    sourceMaps: distAssets.filter((name) => name.endsWith('.map')).length,
    robots: await readFile(path.join(projectRoot, 'dist', 'robots.txt'), 'utf8'),
    sitemap: await readFile(path.join(projectRoot, 'dist', 'sitemap.xml'), 'utf8'),
    serviceWorker: await readFile(path.join(projectRoot, 'dist', 'sw.js'), 'utf8')
  }

  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5186', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ', VITE_SITE_URL: baseUrl }
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
  const page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5186'))
  if (!page) throw new Error('Phase 036 browser target not found.')
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
    if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) consoleWarnings.push(message.params.args.map((entry) => entry.value ?? entry.description ?? '').join(' '))
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) networkFailures.push(`${message.params.errorText}:${message.params.type}`)
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
      if (attempt < 3 && error instanceof Error && error.message.includes('Execution context was destroyed')) { await wait(100); return evaluate(expression, attempt + 1) }
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

  async function capture(name) {
    await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(projectRoot, 'artifacts', name), Buffer.from(screenshot.data, 'base64'))
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Network.enable')
  await send('Performance.enable')
  await waitFor(`Boolean(document.querySelector('.guest-home'))`, 30000)
  checkpoint('Guest ready')

  const seo = await evaluate(`(()=>{
    const meta=(selector)=>document.head.querySelector(selector)?.getAttribute('content')??'';
    const json=JSON.parse(document.getElementById('portfolio-structured-data')?.textContent??'{}');
    const hero=document.querySelector('.profile-image');
    return {title:document.title,description:meta('meta[name="description"]'),canonical:document.querySelector('link[rel="canonical"]')?.href,ogTitle:meta('meta[property="og:title"]'),ogImage:meta('meta[property="og:image"]'),twitter:meta('meta[name="twitter:card"]'),robots:meta('meta[name="robots"]'),jsonType:json['@type'],personType:json.mainEntity?.['@type'],runtime:meta('meta[name="portfolio:runtime-source"]'),heroPreload:document.querySelector('#portfolio-hero-preload')?.href,heroLoading:hero?.loading,heroDecoding:hero?.decoding,heroPriority:hero?.fetchPriority,lazyImages:document.querySelectorAll('img[loading="lazy"][decoding="async"]').length,manifest:document.querySelector('link[rel="manifest"]')?.href,skipLink:Boolean(document.querySelector('.skip-link'))};
  })()`)
  await capture('phase-036-guest-production.png')

  const performance = await evaluate(`new Promise(resolve=>{const values=[];let previous=performance.now();function frame(now){values.push(now-previous);previous=now;if(values.length<60)requestAnimationFrame(frame);else{const sorted=[...values].sort((a,b)=>a-b);resolve({fps:1000/(values.reduce((sum,value)=>sum+value,0)/values.length),p95:sorted[Math.floor(sorted.length*.95)]??0})}}requestAnimationFrame(frame)})`)

  const unknown = await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;await router.push('/missing-production-route');await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return {page:Boolean(document.querySelector('.not-found-page')),robots:document.querySelector('meta[name="robots"]')?.content,title:document.title}})()`)

  await evaluate(`(async()=>{const auth=(await import('/src/stores/auth.ts')).useAuthStore();auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});const router=(await import('/src/router/index.ts')).default;await router.push('/admin/maintenance');return true})()`)
  await waitFor(`Boolean(document.querySelector('.maintenance-page'))`)
  const backup = await evaluate(`(async()=>{
    const module=await import('/src/production/backup.ts');
    const value=await module.createProductionBackup();
    const valid=module.validateBackupValue(value);
    const zip=module.createZipArchive([{name:'backup.json',content:JSON.stringify(value)}]);
    const zipValidation=await module.validateBackupFile(new File([zip],'backup.zip',{type:'application/zip'}));
    const credential=module.validateBackupValue({...value,access_token:'must-not-export'});
    const brokenFavorite=module.validateBackupValue({...value,favorites:[{id:'bad',user_id:'user',revision_id:'missing',created_at:new Date().toISOString()}]});
    return {valid:valid.valid,kind:valid.kind,zipValid:zipValidation.valid,credentialRejected:!credential.valid,brokenFavoriteRejected:!brokenFavorite.valid,serialized:JSON.stringify(value),summary:valid.summary,zipSize:zip.size};
  })()`)
  await evaluate(`document.querySelector('.maintenance-card--export')?.click()`)
  await waitFor(`Boolean(document.querySelector('.export-primary-actions'))`)
  const maintenance = await evaluate(`(async()=>{
    let downloads=0;const original=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){downloads+=1};
    document.querySelectorAll('.export-primary-actions button').forEach(button=>button.click());
    await new Promise(resolve=>setTimeout(resolve,50));HTMLAnchorElement.prototype.click=original;
    const module=await import('/src/production/backup.ts');const value=await module.createProductionBackup();const zip=module.createZipArchive([{name:'backup.json',content:JSON.stringify(value)}]);
    const input=document.querySelector('.maintenance-file-input');const transfer=new DataTransfer();transfer.items.add(new File([zip],'backup.zip',{type:'application/zip'}));Object.defineProperty(input,'files',{value:transfer.files,configurable:true});input.dispatchEvent(new Event('change',{bubbles:true}));
    for(let attempt=0;attempt<100&&!document.querySelector('.validation-result');attempt+=1)await new Promise(resolve=>setTimeout(resolve,20));
    const controls=[...document.querySelectorAll('.maintenance-modal button:not(:disabled),.maintenance-card:not(:disabled),.maintenance-file-input')];
    const unlabeled=controls.filter(element=>element.tagName==='INPUT'&&!element.getAttribute('aria-label')).length;
    return {downloads,dialog:Boolean(document.querySelector('.maintenance-modal')),jsonZipButtons:document.querySelectorAll('.export-primary-actions button').length,individual:document.querySelectorAll('.export-parts button').length,validResult:document.querySelector('.validation-result strong')?.textContent?.includes('valid'),unlabeled,resetDisabled:document.querySelector('.maintenance-card--reset')?.disabled};
  })()`)
  await capture('phase-036-maintenance-backup.png')

  const diagnostics = await evaluate(`(async()=>{const module=await import('/src/production/monitoring.ts');module.reportRuntimeDiagnostic('warning','network','test access_token=secret',{resource:'https://example.test/file?token=secret'});const data=module.getRuntimeDiagnostics();const latest=data.diagnostics.at(-1);return {buildId:data.buildId,appVersion:data.appVersion,redacted:latest.message.includes('[redacted]'),resource:latest.context.resource,metrics:data.metrics}})()`)
  const metrics = await send('Performance.getMetrics')
  const metric = (name) => metrics.metrics.find((entry) => entry.name === name)?.value ?? 0

  const failures = []
  if (staticEvidence.missing.length) failures.push(`Missing production assets: ${staticEvidence.missing.join(', ')}`)
  if (!staticEvidence.entry || staticEvidence.entryBytes > 50_000) failures.push(`Entry chunk is not hardened: ${staticEvidence.entryBytes}`)
  if (staticEvidence.sourceMaps) failures.push('Production source maps were emitted')
  if (!staticEvidence.robots.includes('Sitemap:') || !staticEvidence.sitemap.includes('<urlset')) failures.push('Crawler artifacts are invalid')
  if (/supabase/i.test(staticEvidence.serviceWorker)) failures.push('Service worker contains a Supabase cache path')
  if (!seo.title.includes('Lisa Natalia') || !seo.description.includes('Mahasiswa Keperawatan') || !seo.canonical.startsWith(baseUrl) || !seo.ogImage.startsWith(baseUrl) || seo.twitter !== 'summary_large_image') failures.push('Dynamic SEO/social metadata failed')
  if (seo.jsonType !== 'ProfilePage' || seo.personType !== 'Person' || !['default','published'].includes(seo.runtime)) failures.push('JSON-LD or runtime metadata failed')
  if (!seo.heroPreload || seo.heroLoading !== 'eager' || seo.heroDecoding !== 'async' || seo.heroPriority !== 'high' || seo.lazyImages < 1) failures.push('Image loading optimization failed')
  if (!seo.manifest || !seo.skipLink) failures.push('Manifest or skip link is missing')
  if (!unknown.page || !unknown.robots.includes('noindex')) failures.push('404 handling failed')
  if (!backup.valid || !backup.zipValid || !backup.credentialRejected || !backup.brokenFavoriteRejected || /access_token|refresh_token|service_role/i.test(backup.serialized)) failures.push('Backup validation or credential exclusion failed')
  if (maintenance.downloads !== 2 || maintenance.jsonZipButtons !== 2 || maintenance.individual !== 5 || !maintenance.validResult || maintenance.unlabeled || !maintenance.resetDisabled) failures.push('Maintenance UX failed')
  if (!diagnostics.redacted || /[?&]token=/.test(diagnostics.resource) || !diagnostics.buildId) failures.push('Runtime diagnostics redaction failed')
  if (performance.fps < 50 || performance.p95 > 25) failures.push(`Guest frame sample failed: ${JSON.stringify(performance)}`)
  if (runtimeErrors.length) failures.push('Runtime errors were reported')
  if (consoleWarnings.length) failures.push('Console warnings/errors were reported')
  if (networkFailures.length) failures.push('Local same-origin network failures were reported')

  const evidence = {
    status: failures.length ? 'FAIL' : 'PASS',
    static: staticEvidence,
    seo,
    notFound: unknown,
    backup: { ...backup, serialized: `[${backup.serialized.length} bytes, credential-free]` },
    maintenance,
    diagnostics,
    performance: { frames: performance, scriptSeconds: metric('ScriptDuration'), layouts: metric('LayoutCount'), styleRecalcs: metric('RecalcStyleCount') },
    runtimeErrors,
    consoleWarnings,
    networkFailures,
    viteErrors,
    browserErrors: browserErrors.split('\n').filter((line) => /error|fail/i.test(line)).slice(0, 10),
    screenshots: ['artifacts/phase-036-guest-production.png', 'artifacts/phase-036-maintenance-backup.png'],
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
