import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5209'
const cdpPort = 9369
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')

const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-admin-contact-'))
const screenshotDir = process.env.CONTACT_SHOTS_DIR
  ? path.resolve(process.env.CONTACT_SHOTS_DIR)
  : await mkdtemp(path.join(tmpdir(), 'portfolio-admin-contact-shots-'))
await mkdir(screenshotDir, { recursive: true })

const children = []
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (condition, message) => {
  if (!condition) throw new Error(`AdminContact runtime failure: ${message}`)
}

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      if ((await fetch(url)).ok) return
    } catch { /* Vite starting */ }
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
    } catch { /* Chrome starting */ }
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
  }
}

process.on('exit', stopChildren)
process.on('SIGINT', () => { stopChildren(); process.exit(130) })

let socket
try {
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5209', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  })
  vite.stderr.on('data', () => {})
  await waitForHttp(baseUrl)

  launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1440,900', baseUrl
  ])

  let page
  const started = Date.now()
  while (!page && Date.now() - started < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5209'))
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
    if (message.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      runtimeErrors.push(message.params.entry.text)
    }
  })

  function send(method, params = {}) {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }

  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
    }
    return response.result.value
  }

  async function waitFor(expression, timeout = 15000) {
    const begin = Date.now()
    while (Date.now() - begin < timeout) {
      if (await evaluate(expression)) return
      await wait(60)
    }
    throw new Error(`Timed out waiting for: ${expression}`)
  }

  async function capture(name) {
    const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const filePath = path.join(screenshotDir, name)
    await writeFile(filePath, Buffer.from(res.data, 'base64'))
    return filePath
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(()=>{globalThis.__contactUnhandled=[];addEventListener('unhandledrejection',e=>globalThis.__contactUnhandled.push(String(e.reason?.stack??e.reason)));return true})()`)

  // 1. Verify validator & sanitizer edge cases directly
  const unitChecks = await evaluate(`(async()=>{
    const repo = await import('/src/repositories/contactLinksRepository.ts');
    return {
      empty: repo.validateContactLinkInput('   ', 'WhatsApp'),
      bareWa: repo.validateContactLinkInput('wa.me/6281234567890', 'WhatsApp'),
      bareLi: repo.validateContactLinkInput('www.linkedin.com/in/lisa-natalia', 'LinkedIn'),
      relCv: repo.validateContactLinkInput('/files/cv-lisa.pdf', 'CV'),
      protoRel: repo.validateContactLinkInput('//evil.com/cv.pdf', 'CV'),
      xss: repo.validateContactLinkInput('javascript:alert(1)', 'WhatsApp'),
      deadWa: repo.validateContactLinkInput('https://wa.me/#', 'WhatsApp'),
      deadLi: repo.validateContactLinkInput('https://linkedin.com/in/#', 'LinkedIn'),
      bareMailto: repo.validateContactLinkInput('mailto:', 'WhatsApp'),
      validMailto: repo.validateContactLinkInput('mailto:lisa@example.com', 'CV'),
      bareFile: repo.validateContactLinkInput('cv.pdf', 'CV'),
      spaces: repo.validateContactLinkInput('https://wa.me/628 123', 'WhatsApp'),
      hashOnly: repo.sanitizeContactHref('#'),
      validFull: repo.sanitizeContactHref('https://wa.me/6281234567890?text=Halo')
    };
  })()`)
  assert(unitChecks.empty.error === null && unitChecks.empty.value === '', `Empty check failed: ${JSON.stringify(unitChecks.empty)}`)
  assert(unitChecks.bareWa.error === null && unitChecks.bareWa.value === 'https://wa.me/6281234567890', `Bare WA failed: ${JSON.stringify(unitChecks.bareWa)}`)
  assert(unitChecks.bareLi.error === null && unitChecks.bareLi.value === 'https://www.linkedin.com/in/lisa-natalia', `Bare LI failed: ${JSON.stringify(unitChecks.bareLi)}`)
  assert(unitChecks.relCv.error === null && unitChecks.relCv.value === '/files/cv-lisa.pdf', `Relative CV failed: ${JSON.stringify(unitChecks.relCv)}`)
  assert(unitChecks.validMailto.error === null && unitChecks.validMailto.value === 'mailto:lisa@example.com', `Valid mailto failed: ${JSON.stringify(unitChecks.validMailto)}`)
  assert(Boolean(unitChecks.protoRel.error) && Boolean(unitChecks.xss.error) && Boolean(unitChecks.deadWa.error) && Boolean(unitChecks.deadLi.error) && Boolean(unitChecks.bareMailto.error) && Boolean(unitChecks.bareFile.error) && Boolean(unitChecks.spaces.error), `Invalid URLs were not rejected: ${JSON.stringify(unitChecks)}`)
  assert(unitChecks.hashOnly === '' && unitChecks.validFull === 'https://wa.me/6281234567890?text=Halo', `Sanitizer edge check failed: ${JSON.stringify(unitChecks)}`)

  // 2. Grant admin state & navigate to /admin/messages first to test clicking Contact right below Messages in sidebar
  await evaluate(`(async()=>{
    const auth=(await import('/src/stores/auth.ts')).useAuthStore();
    auth.$patch({isAdmin:true,isInitialized:true,isLoading:false,errorMessage:''});
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/admin/messages');
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.messages-page'))`)
  await waitFor(`Boolean(document.querySelector('button[aria-label="Open sidebar"]'))`)
  await evaluate(`(document.querySelector('button[aria-label="Open sidebar"]')?.click(), true)`)
  await wait(320)

  const sidebarOrder = await evaluate(`(()=>{
    const items=[...document.querySelectorAll('#admin-sidebar .nav-item')].map(el=>({
      label: el.querySelector('.nav-label')?.textContent?.trim(),
      href: el.getAttribute('href'),
      hasIcon: Boolean(el.querySelector('svg'))
    }));
    return items;
  })()`)
  const msgIdx = sidebarOrder.findIndex(i => i.label === 'Messages')
  const contactIdx = sidebarOrder.findIndex(i => i.label === 'Contact')
  assert(msgIdx >= 0 && contactIdx === msgIdx + 1 && sidebarOrder[contactIdx]?.hasIcon && sidebarOrder[contactIdx]?.href?.includes('/admin/contact'), `Sidebar Contact item must sit right below Messages with icon: ${JSON.stringify(sidebarOrder)}`)

  const sidebarShot = await capture('verify-admin-contact-sidebar.png')

  // Click Contact item in sidebar
  await evaluate(`(document.querySelectorAll('#admin-sidebar .nav-item')[${contactIdx}]?.click(), true)`)
  await waitFor(`Boolean(document.querySelector('.contact-admin-page form.contact-card'))`)
  await wait(250)

  const initialUi = await evaluate(`(()=>{
    const inputs=[...document.querySelectorAll('.contact-admin-page input')].map(i=>({id:i.id,value:i.value,placeholder:i.placeholder}));
    const submitBtns=[...document.querySelectorAll('.contact-admin-page button[type="submit"]')].map(b=>b.textContent?.trim());
    return {
      headerTitle: document.querySelector('.admin-header .page-title')?.textContent?.trim(),
      inputs,
      submitBtns,
      saveBg: getComputedStyle(document.querySelector('.contact-save-btn')).backgroundImage,
      pageBg: getComputedStyle(document.querySelector('.contact-admin-page')).backgroundColor
    };
  })()`)
  assert(initialUi.headerTitle === 'Contact' && initialUi.inputs.length === 3 && initialUi.submitBtns.length === 1 && initialUi.submitBtns[0] === 'Save', `AdminContact form structure unexpected: ${JSON.stringify(initialUi)}`)

  // 3. Invalid input blocks submit + shows inline error
  await evaluate(`(()=>{
    const setVal=(id,val)=>{const el=document.getElementById(id);el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}))};
    setVal('contact-whatsapp-link','javascript:alert(1)');
    document.querySelector('.contact-save-btn')?.click();
    return true;
  })()`)
  await waitFor(`Boolean(document.getElementById('contact-whatsapp-link-error'))`)
  const invalidCheck = await evaluate(`({
    err: document.getElementById('contact-whatsapp-link-error')?.textContent?.trim(),
    stored: window.localStorage.getItem('portfolio-contact-links')
  })`)
  assert(Boolean(invalidCheck.err) && invalidCheck.stored === null, `Invalid URL saved or missed error: ${JSON.stringify(invalidCheck)}`)

  // 4. Valid save (bare domain WA -> normalized https://, valid LinkedIn, empty CV)
  await evaluate(`(()=>{
    const setVal=(id,val)=>{const el=document.getElementById(id);el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}))};
    setVal('contact-whatsapp-link','wa.me/6281234567890');
    setVal('contact-linkedin-link','https://www.linkedin.com/in/lisa-natalia');
    setVal('contact-cv-link','');
    document.querySelector('.contact-save-btn')?.click();
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.product-toast--success'))`)
  await waitFor(`document.getElementById('contact-whatsapp-link')?.value === 'https://wa.me/6281234567890'`)
  await wait(150)

  const desktopShot = await capture('verify-admin-contact-desktop.png')

  // 5. Navigate to Guest /contact-detail and verify dynamic links
  await evaluate(`(async()=>{
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/contact-detail');
    return true;
  })()`)
  await waitFor(`document.querySelectorAll('.social-circle-btn').length === 2`)
  const guestFirstLinks = await evaluate(`[...document.querySelectorAll('.social-circle-btn')].map(a=>({
    label: a.getAttribute('aria-label'),
    href: a.getAttribute('href'),
    target: a.getAttribute('target'),
    rel: a.getAttribute('rel')
  }))`)
  assert(
    guestFirstLinks.length === 2
    && guestFirstLinks[0].label === 'WhatsApp' && guestFirstLinks[0].href === 'https://wa.me/6281234567890'
    && guestFirstLinks[1].label === 'LinkedIn' && guestFirstLinks[1].href === 'https://www.linkedin.com/in/lisa-natalia'
    && guestFirstLinks.every(l => l.target === '_blank' && l.rel === 'noopener noreferrer'),
    `Guest links after first save mismatch: ${JSON.stringify(guestFirstLinks)}`
  )

  // 6. Navigate back to /admin/contact, reload to verify persistence, swap LinkedIn off and CV on
  await evaluate(`(async()=>{
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/admin/contact');
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.contact-admin-page form.contact-card'))`)
  await send('Page.reload', { ignoreCache: true })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(async()=>{
    const auth=(await import('/src/stores/auth.ts')).useAuthStore();
    auth.$patch({isAdmin:true,isInitialized:true,isLoading:false,errorMessage:''});
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/admin/contact');
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.contact-admin-page form.contact-card'))`)

  const persistedBeforeSwap = await evaluate(`({
    wa: document.getElementById('contact-whatsapp-link')?.value,
    li: document.getElementById('contact-linkedin-link')?.value,
    cv: document.getElementById('contact-cv-link')?.value
  })`)
  assert(
    persistedBeforeSwap.wa === 'https://wa.me/6281234567890'
    && persistedBeforeSwap.li === 'https://www.linkedin.com/in/lisa-natalia'
    && persistedBeforeSwap.cv === '',
    `Reload persistence check failed: ${JSON.stringify(persistedBeforeSwap)}`
  )

  await evaluate(`(()=>{
    const setVal=(id,val)=>{const el=document.getElementById(id);el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}))};
    setVal('contact-linkedin-link','');
    setVal('contact-cv-link','https://example.com/cv-lisa.pdf');
    document.querySelector('.contact-save-btn')?.click();
    return true;
  })()`)
  await waitFor(`JSON.parse(window.localStorage.getItem('portfolio-contact-links') || '{}').cv === 'https://example.com/cv-lisa.pdf'`)

  // Mobile responsive check on /admin/contact
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await wait(180)
  const mobileCheck = await evaluate(`(()=>{
    const card=document.querySelector('.contact-card')?.getBoundingClientRect();
    const save=document.querySelector('.contact-save-btn')?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      cardInside: Boolean(card && card.left >= -1 && card.right <= 391),
      saveInside: Boolean(save && save.left >= -1 && save.right <= 391 && save.height >= 40)
    };
  })()`)
  assert(!mobileCheck.overflow && mobileCheck.cardInside && mobileCheck.saveInside, `Mobile /admin/contact layout check failed: ${JSON.stringify(mobileCheck)}`)
  const mobileShot = await capture('verify-admin-contact-mobile.png')

  // Verify Guest updates to WA + CV
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await evaluate(`(async()=>{
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/contact-detail');
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('a[aria-label="CV / Resume"]')) && !document.querySelector('a[aria-label="LinkedIn"]')`)
  const guestShot = await capture('verify-admin-contact-guest-links.png')

  // 7. Error state safety check: failed load shows Retry instead of blank editable form
  await evaluate(`(async()=>{
    const { contactLinksRepository } = await import('/src/repositories/contactLinksRepository.ts');
    contactLinksRepository.load = async () => { throw new Error('Simulated connection outage'); };
    const auth=(await import('/src/stores/auth.ts')).useAuthStore();
    auth.$patch({isAdmin:true,isInitialized:true,isLoading:false,errorMessage:''});
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/admin/contact');
    return true;
  })()`)
  await waitFor(`document.querySelector('.contact-admin-page .product-empty-state h2')?.textContent?.includes('could not be loaded')`)
  const errorCheck = await evaluate(`({
    formPresent: Boolean(document.querySelector('.contact-admin-page form.contact-card')),
    retryPresent: Boolean(document.querySelector('.contact-admin-page .product-empty-state button'))
  })`)
  assert(!errorCheck.formPresent && errorCheck.retryPresent, `Failed load rendered blank overwriteable form: ${JSON.stringify(errorCheck)}`)

  const unhandled = await evaluate(`globalThis.__contactUnhandled ?? []`)
  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(error))
  assert(unhandled.length === 0 && seriousErrors.length === 0, `Runtime errors detected: ${[...unhandled, ...seriousErrors].join(' | ')}`)

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    scope: 'Admin Contact Sidebar + /admin/contact + Dynamic Guest /contact-detail Links',
    sidebarOrder,
    guestFirstLinks,
    mobileCheck,
    screenshots: { sidebarShot, desktopShot, mobileShot, guestShot }
  }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* closed */ }
  stopChildren()
  await wait(250)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }) } catch { /* ignore lock */ }
  if (!process.env.CONTACT_SHOTS_DIR) {
    try { await rm(screenshotDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }) } catch { /* ignore lock */ }
  }
}
