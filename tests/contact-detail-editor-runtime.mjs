import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5205'
const cdpPort = 9365
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')

const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-contact-detail-editor-'))
const screenshotDir = await mkdtemp(path.join(tmpdir(), 'portfolio-contact-detail-shots-'))
const fixtureImagePath = path.resolve(projectRoot, 'public/social-preview.webp')
const children = []
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (condition, message) => {
  if (!condition) throw new Error(`ContactDetail runtime failure: ${message}`)
}

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      if ((await fetch(url)).ok) return
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
  for (const child of children.reverse()) {
    if (!child.killed) child.kill()
  }
}

process.on('exit', stopChildren)
process.on('SIGINT', () => { stopChildren(); process.exit(130) })

let socket
try {
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5205', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1600,1050', baseUrl
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  let page
  const started = Date.now()
  while (!page && Date.now() - started < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5205'))
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

  async function waitFor(expression, timeout = 20000) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      if (await evaluate(expression)) return
      await wait(60)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  async function dragAt(start, dx, dy) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: start.x, y: start.y, button: 'left', buttons: 1, clickCount: 1 })
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x + Math.round(dx / 2), y: start.y + Math.round(dy / 2), button: 'left', buttons: 1 })
    await wait(60)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x + dx, y: start.y + dy, button: 'left', buttons: 1 })
    await wait(40)
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: start.x + dx, y: start.y + dy, button: 'left', buttons: 0, clickCount: 1 })
    await wait(140)
  }

  async function selectEntityInEditor(entityId) {
    const ok = await evaluate(`(async()=>{
      const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const settle=async()=>{await tick();await new Promise(r=>setTimeout(r,80));await tick()};
      const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
      const obj=editor.objects.find(c=>c.id===${JSON.stringify(entityId)});
      if(!obj) return false;
      const section=document.querySelector('#section-select');
      section.value=obj.section;
      section.dispatchEvent(new Event('change',{bubbles:true}));
      await settle();
      const entity=document.querySelector('#entity-select');
      entity.value=obj.id;
      entity.dispatchEvent(new Event('change',{bubbles:true}));
      await settle();
      return editor.selectedObjectId===${JSON.stringify(entityId)};
    })()`)
    assert(ok, `Could not select entity ${entityId}`)
  }

  async function uploadToSelectedSlot(filePath) {
    const doc = await send('DOM.getDocument', { depth: -1, pierce: true })
    const query = await send('DOM.querySelector', {
      nodeId: doc.root.nodeId,
      selector: '[data-property-key="media.slotUpload"] input[type="file"]'
    })
    assert(Boolean(query.nodeId), 'media.slotUpload file input missing in Inspector')
    await send('DOM.setFileInputFiles', { nodeId: query.nodeId, files: [filePath] })
    await wait(250)
  }

  async function replaceSelectedWithLibraryPrimary() {
    await evaluate(`(async()=>{
      const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const btn=document.querySelector('[data-property-key="media.replace"] button');
      btn?.click();
      await tick();
      return true;
    })()`)
    await waitFor(`Boolean(document.querySelector('.asset-picker [data-asset-card-id="media-profile-primary"]'))`)
    await evaluate(`(async()=>{
      const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      document.querySelector('.asset-picker [data-asset-card-id="media-profile-primary"]')?.click();
      await tick();
      document.querySelector('.asset-picker .picker-actions button.primary')?.click();
      await tick();
      return true;
    })()`)
    await waitFor(`!document.querySelector('.asset-picker')`)
    await wait(120)
  }

  async function setControlValue(propertyKey, category, value) {
    const done = await evaluate(`(async()=>{
      const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const settle=async()=>{await tick();await new Promise(r=>setTimeout(r,80));await tick()};
      if (${JSON.stringify(category)}) {
        const group=document.querySelector('[data-property-category="'+${JSON.stringify(category)}+'"]');
        if (group && group.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true') {
          group.querySelector('.accordion-toggle')?.click();
          await settle();
        }
      }
      const field=document.querySelector('[data-property-key="'+${JSON.stringify(propertyKey)}+'"]');
      if (!field) return { ok:false, reason:'missing field '+${JSON.stringify(propertyKey)} };
      const colorBtn=field.querySelector('.color-summary');
      if (colorBtn) {
        if (colorBtn.getAttribute('aria-expanded')!=='true') {
          colorBtn.click();
          await settle();
        }
        const hexInput=field.querySelector('.color-popover .picker-head label input');
        if (!hexInput) return { ok:false, reason:'missing hex input in color popover for '+${JSON.stringify(propertyKey)} };
        hexInput.value=String(${JSON.stringify(value)});
        hexInput.dispatchEvent(new Event('change',{bubbles:true}));
        await settle();
        if (colorBtn.getAttribute('aria-expanded')==='true') { colorBtn.click(); await settle(); }
        return { ok:true, via:'color-hex' };
      }
      const segmented=[...field.querySelectorAll('button')];
      if (segmented.length) {
        const match=segmented.find(b=>b.textContent?.trim().toLowerCase()===String(${JSON.stringify(value)}).toLowerCase() || b.dataset.value===String(${JSON.stringify(value)}));
        if (match) { match.click(); await settle(); return { ok:true, via:'segmented' }; }
      }
      const select=field.querySelector('select');
      if (select) {
        const expected=String(${JSON.stringify(value)});
        if (![...select.options].some(o=>o.value===expected)) {
          return { ok:false, reason:'missing option '+expected+' for '+${JSON.stringify(propertyKey)}+' (available: '+[...select.options].map(o=>o.value).join('|')+')' };
        }
        select.value=expected;
        select.dispatchEvent(new Event('change',{bubbles:true}));
        await settle();
        return { ok:true, via:'select' };
      }
      const input=field.querySelector('textarea,input[type="color"],input[type="number"],input[type="text"],input:not([type="file"])');
      if (!input) return { ok:false, reason:'missing control for '+${JSON.stringify(propertyKey)} };
      input.value=String(${JSON.stringify(value)});
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.dispatchEvent(new Event('change',{bubbles:true}));
      await settle();
      return { ok:true, via:input.tagName };
    })()`)
    assert(done?.ok, `Failed setting ${propertyKey}=${value}: ${JSON.stringify(done)}`)
  }

  await send('Runtime.enable')
  await send('DOM.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false })

  await evaluate(`(()=>{globalThis.__contactDetailUnhandled=[];addEventListener('unhandledrejection',(e)=>globalThis.__contactDetailUnhandled.push(String(e.reason?.stack??e.reason)));return true})()`)
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(async()=>{
    const auth=(await import('/src/stores/auth.ts')).useAuthStore();
    const router=(await import('/src/router/index.ts')).default;
    auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});
    await router.push({name:'admin-edit',query:{draft:'new'}});
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="contact-detail-section"]')) && Boolean(document.querySelector('[data-editor-object-id="contact-message-section"]'))`)
  await wait(300)

  // 1. Structure & Empty Photo Slots in Admin Preview
  const initialStructure = await evaluate(`(()=>{
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const site=pinia._s.get('site');
    const sections=[...document.querySelectorAll('#section-select option')].map(o=>o.value);
    const homeContact=document.querySelector('#contact')?.getBoundingClientRect();
    const clickHere=document.querySelector('#contact-click-here')?.getBoundingClientRect();
    const contact2=document.querySelector('.section-contact2')?.getBoundingClientRect();
    const message=document.querySelector('.section-message')?.getBoundingClientRect();
    const backBtn=Boolean(document.querySelector('.editor-preview-runtime .back-home-btn'));
    const mainFrame=document.querySelector('.contact2-photo-frame');
    const mainPh=document.querySelector('.contact2-photo-placeholder');
    const msgFrame=document.querySelector('.message-photo-frame');
    const msgPh=document.querySelector('.message-photo-placeholder');
    const socialButtons=[...document.querySelectorAll('.social-circle-btn')];
    return {
      sections,
      verticalOrder: Boolean(homeContact && contact2 && message && homeContact.bottom <= contact2.top + 2 && contact2.bottom <= message.top + 2),
      backBtn,
      photoAreasCount: site.current.photoAreas.length,
      mainFrameH: mainFrame?.clientHeight ?? 0,
      mainPhH: mainPh?.clientHeight ?? 0,
      msgFrameH: msgFrame?.clientHeight ?? 0,
      msgPhH: msgPh?.clientHeight ?? 0,
      mainRectH: mainFrame?.getBoundingClientRect().height ?? 0,
      msgRectH: msgFrame?.getBoundingClientRect().height ?? 0,
      socialCount: socialButtons.length,
      socialAllUnlinked: socialButtons.every(b=>b.classList.contains('social-circle-btn--unlinked') && !b.getAttribute('href') && !b.getAttribute('target')),
      socialCircular: socialButtons.every(b=>parseFloat(getComputedStyle(b).borderTopLeftRadius) >= 20),
      mainFrameRadius: mainFrame ? parseFloat(getComputedStyle(mainFrame).borderTopLeftRadius) : 0
    };
  })()`)
  assert(initialStructure.sections.includes('Contact Detail') && initialStructure.sections.includes('Text Me'), `Missing new Page area options: ${JSON.stringify(initialStructure.sections)}`)
  assert(initialStructure.verticalOrder, `ContactDetail did not render seamlessly below Contact in /admin/edit: ${JSON.stringify(initialStructure)}`)
  assert(!initialStructure.backBtn, '.back-home-btn should be hidden in editorPreview')
  assert(initialStructure.photoAreasCount === 10, `site.current.photoAreas mutated unexpectedly: ${initialStructure.photoAreasCount}`)
  assert(initialStructure.mainFrameH > 400 && initialStructure.mainPhH > 350 && initialStructure.msgFrameH > 350 && initialStructure.msgPhH > 300 && initialStructure.mainRectH > 200 && initialStructure.msgRectH > 200, `Empty photo placeholders collapsed: ${JSON.stringify(initialStructure)}`)
  assert(initialStructure.socialCount === 3 && initialStructure.socialAllUnlinked && initialStructure.socialCircular && initialStructure.mainFrameRadius >= 16, `Social circles/frames lost border-radius or unlinked state in Admin: ${JSON.stringify(initialStructure)}`)

  // Clicking #contact-click-here in /admin/edit selects contact-cta without navigating
  const clickHereRes = await evaluate(`(async()=>{
    const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    document.querySelector('#contact-click-here')?.click();
    await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    return { selected: editor.selectedObjectId, hash: location.hash };
  })()`)
  assert(clickHereRes.selected === 'contact-cta' && clickHereRes.hash.includes('/admin/edit'), `Clicking CLICK HERE in Admin navigated or failed selection: ${JSON.stringify(clickHereRes)}`)

  // 2. Contact Detail Section — Background & Typography Independence
  await selectEntityInEditor('contact-detail-section')
  const sectionBgBefore = await evaluate(`({
    homeContactBg: getComputedStyle(document.querySelector('#contact')).backgroundColor,
    msgBg: getComputedStyle(document.querySelector('.section-message')).backgroundColor
  })`)
  await setControlValue('runtime.backgroundColor', 'effects', '#531820')
  const sectionBgAfter = await evaluate(`({
    detailBg: getComputedStyle(document.querySelector('.section-contact2')).backgroundColor,
    homeContactBg: getComputedStyle(document.querySelector('#contact')).backgroundColor,
    msgBg: getComputedStyle(document.querySelector('.section-message')).backgroundColor
  })`)
  assert(sectionBgAfter.detailBg === 'rgb(83, 24, 32)' && sectionBgAfter.homeContactBg === sectionBgBefore.homeContactBg && sectionBgAfter.msgBg === sectionBgBefore.msgBg, `Contact Detail background leaked: ${JSON.stringify(sectionBgAfter)}`)

  // Edit Title, Subtitle, Description independently
  await selectEntityInEditor('contact-detail-title')
  const titleKeys = await evaluate(`[...document.querySelectorAll('[data-property-key]')].map(n=>n.dataset.propertyKey)`)
  assert(!titleKeys.includes('font.positionX') && !titleKeys.includes('font.positionY'), 'Child title should not expose direct X/Y when welcome-group owns drag')
  await setControlValue('runtime.contact-detail-title.text', '', 'DR. NATALIA')
  await setControlValue('font.family', 'font', "Georgia, 'Times New Roman', serif")
  await setControlValue('runtime.fontWeight', 'font', '300')
  await setControlValue('font.style', 'font', 'italic')
  await setControlValue('font.size', 'font', '68')
  await setControlValue('font.color', 'font', '#f4e1c8')

  await selectEntityInEditor('contact-detail-subtitle')
  await setControlValue('font.color', 'font', '#ffd166')
  await setControlValue('font.style', 'font', 'italic')

  await selectEntityInEditor('contact-detail-description')
  await setControlValue('font.color', 'font', '#fff5eb')
  await setControlValue('font.family', 'font', "'Inter', system-ui, sans-serif")

  const typoCheck = await evaluate(`(()=>{
    const t=getComputedStyle(document.querySelector('[data-editor-object-id="contact-detail-title"]'));
    const s=getComputedStyle(document.querySelector('[data-editor-object-id="contact-detail-subtitle"]'));
    const d=getComputedStyle(document.querySelector('[data-editor-object-id="contact-detail-description"]'));
    return {
      title: { text: document.querySelector('[data-editor-object-id="contact-detail-title"]').textContent.trim(), font: t.fontFamily, weight: t.fontWeight, style: t.fontStyle, size: t.fontSize, color: t.color },
      subtitle: { font: s.fontFamily, style: s.fontStyle, color: s.color },
      desc: { font: d.fontFamily, style: d.fontStyle, color: d.color }
    };
  })()`)
  assert(typoCheck.title.text === 'DR. NATALIA' && typoCheck.title.font.includes('Georgia') && typoCheck.title.weight === '300' && typoCheck.title.style === 'italic' && typoCheck.title.size === '68px' && typoCheck.title.color === 'rgb(244, 225, 200)', `Title styles failed: ${JSON.stringify(typoCheck.title)}`)
  assert(typoCheck.subtitle.style === 'italic' && typoCheck.subtitle.color === 'rgb(255, 209, 102)' && !typoCheck.subtitle.font.includes('Georgia'), `Subtitle coupled to Title: ${JSON.stringify(typoCheck.subtitle)}`)
  assert(typoCheck.desc.style !== 'italic' && typoCheck.desc.color === 'rgb(255, 245, 235)' && typoCheck.desc.font.includes('Inter'), `Description coupled: ${JSON.stringify(typoCheck.desc)}`)

  // 3. Drag Group (.welcome-box) & Independent Left Photo Drag/Upload
  const dragSetup = await evaluate(`(async()=>{
    const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const titleEl=document.querySelector('[data-editor-object-id="contact-detail-title"]');
    titleEl.scrollIntoView({block:'center',inline:'center'});
    await tick();
    const rT=titleEl.getBoundingClientRect();
    const rS=document.querySelector('[data-editor-object-id="contact-detail-subtitle"]').getBoundingClientRect();
    const rW=document.querySelector('[data-editor-object-id="contact-detail-wa"]').getBoundingClientRect();
    const rP=document.querySelector('[data-editor-object-id="contact-detail-photo-main"]').getBoundingClientRect();
    const rG=document.querySelector('[data-editor-object-id="contact-detail-welcome-group"]').getBoundingClientRect();
    return {
      titleUx: JSON.parse(JSON.stringify(editor.objects.find(o=>o.id==='contact-detail-title')?.ux ?? null)),
      groupCap: JSON.parse(JSON.stringify(editor.objects.find(o=>o.id==='contact-detail-welcome-group')?.capabilities ?? [])),
      titleCenter: { x: Math.round(rT.left + rT.width * 0.4), y: Math.round(rT.top + rT.height * 0.5) },
      before: { tx: rT.x, sx: rS.x, wx: rW.x, px: rP.x, gx: rG.x, gy: rG.y }
    };
  })()`)
  await dragAt(dragSetup.titleCenter, 40, 24)
  const groupDragAfter = await evaluate(`(()=>{
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const wg=document.querySelector('[data-editor-object-id="contact-detail-welcome-group"]');
    const tl=document.querySelector('[data-editor-object-id="contact-detail-title"]');
    return JSON.parse(JSON.stringify({
      selected: editor.selectedObjectId,
      wgTranslate: wg?.style?.translate,
      tlTranslate: tl?.style?.translate,
      groupLayout: editor.draftSnapshot.layout['contact-detail-welcome-group'],
      titleLayout: editor.draftSnapshot.layout['contact-detail-title'],
      after: {
        tx: tl.getBoundingClientRect().x,
        sx: document.querySelector('[data-editor-object-id="contact-detail-subtitle"]').getBoundingClientRect().x,
        wx: document.querySelector('[data-editor-object-id="contact-detail-wa"]').getBoundingClientRect().x,
        px: document.querySelector('[data-editor-object-id="contact-detail-photo-main"]').getBoundingClientRect().x,
        gx: wg.getBoundingClientRect().x
      }
    }));
  })()`)
  assert(groupDragAfter.selected === 'contact-detail-title', `Drag should keep child selected: ${groupDragAfter.selected}`)
  assert(!groupDragAfter.titleLayout?.x && Number(groupDragAfter.groupLayout?.x) > 0 && Number(groupDragAfter.groupLayout?.y) > 0, `Drag did not route to welcome-group: setup=${JSON.stringify({titleUx:dragSetup.titleUx,groupCap:dragSetup.groupCap,center:dragSetup.titleCenter,before:dragSetup.before})} after=${JSON.stringify(groupDragAfter)}`)
  assert(groupDragAfter.after.tx > dragSetup.before.tx + 20 && groupDragAfter.after.sx > dragSetup.before.sx + 20 && groupDragAfter.after.wx > dragSetup.before.wx + 20, 'Children did not move sepaket with welcome-group')
  assert(Math.abs(groupDragAfter.after.px - dragSetup.before.px) < 1, 'Photo moved when dragging welcome-group!')

  // Nudge via social icon child routes to welcome-group too
  await selectEntityInEditor('contact-detail-wa')
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true,cancelable:true}))`)
  await wait(120)
  const afterWaNudgeX = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.layout['contact-detail-welcome-group']?.x`)
  assert(Number(afterWaNudgeX) > Number(groupDragAfter.groupLayout.x), 'ArrowRight on WA did not nudge welcome-group')

  // Fill WA & LinkedIn links (keep CV empty)
  await setControlValue('runtime.contact-detail-wa.href', 'content', 'https://wa.me/6281234567890')
  await selectEntityInEditor('contact-detail-linkedin')
  await setControlValue('runtime.contact-detail-linkedin.href', 'content', 'https://linkedin.com/in/lisa-natalia')

  // Upload, Crop, Fit, Remove+Undo, Drag, and Replace main photo
  await selectEntityInEditor('contact-detail-photo-main')
  const mainPhotoKeys = await evaluate(`[...document.querySelectorAll('[data-property-key]')].map(n=>n.dataset.propertyKey)`)
  assert(mainPhotoKeys.includes('media.slotUpload') && mainPhotoKeys.includes('media.replace') && mainPhotoKeys.includes('media.positionX') && !mainPhotoKeys.includes('media.width') && !mainPhotoKeys.includes('media.height') && !mainPhotoKeys.includes('media.duplicateReference'), `Unexpected properties on main photo: ${JSON.stringify(mainPhotoKeys)}`)
  await uploadToSelectedSlot(fixtureImagePath)
  await waitFor(`Boolean(document.querySelector('.contact2-photo-frame img.photo-area-image'))`)
  await setControlValue('media.crop', 'media', '50% 0%')
  await setControlValue('media.fit', 'media', 'contain')
  const mainPhotoMediaCheck = await evaluate(`(()=>{
    const img=document.querySelector('.contact2-photo-frame img.photo-area-image');
    return { width: img?.naturalWidth ?? 0, fit: img?.style.objectFit, pos: img?.style.objectPosition };
  })()`)
  assert(mainPhotoMediaCheck.width > 0 && mainPhotoMediaCheck.fit === 'contain' && mainPhotoMediaCheck.pos === '50% 0%', `Main photo upload/crop/fit failed: ${JSON.stringify(mainPhotoMediaCheck)}`)
  await setControlValue('media.fit', 'media', 'Fill')

  // Test remove + undo on main photo
  await evaluate(`document.querySelector('[data-property-key="media.remove"] button')?.click()`)
  await waitFor(`!document.querySelector('.contact2-photo-frame img.photo-area-image') && Boolean(document.querySelector('.contact2-photo-placeholder'))`)
  await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').undo()`)
  await waitFor(`Boolean(document.querySelector('.contact2-photo-frame img.photo-area-image'))`)
  // Also switch reference to built-in media-profile-primary before Publish (permanent URL for InMemory repo)
  await replaceSelectedWithLibraryPrimary()

  // Drag left photo independently
  const mainDragSetup = await evaluate(`(async()=>{
    const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const p=document.querySelector('[data-editor-object-id="contact-detail-photo-main"]');
    p.scrollIntoView({block:'center',inline:'center'});
    await tick();
    const rP=p.getBoundingClientRect();
    const rG=document.querySelector('[data-editor-object-id="contact-detail-welcome-group"]').getBoundingClientRect();
    return { center: { x: Math.round(rP.left + rP.width * 0.5), y: Math.round(rP.top + rP.height * 0.5) }, px: rP.x, py: rP.y, gx: rG.x };
  })()`)
  await dragAt(mainDragSetup.center, 25, 18)
  const mainDragAfter = await evaluate(`({
    px: document.querySelector('[data-editor-object-id="contact-detail-photo-main"]').getBoundingClientRect().x,
    py: document.querySelector('[data-editor-object-id="contact-detail-photo-main"]').getBoundingClientRect().y,
    gx: document.querySelector('[data-editor-object-id="contact-detail-welcome-group"]').getBoundingClientRect().x,
    layout: document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.layout['contact-detail-photo-main']
  })`)
  assert(mainDragAfter.px > mainDragSetup.px + 10 && mainDragAfter.py > mainDragSetup.py + 8 && Math.abs(mainDragAfter.gx - mainDragSetup.gx) < 1, `Main photo independent drag failed: ${JSON.stringify(mainDragAfter)}`)

  // 4. Lower Section (.section-message / TEXT ME) Controls & Strict ZERO-Drag/Lock Checks
  await selectEntityInEditor('contact-message-section')
  await setControlValue('runtime.backgroundColor', 'effects', '#efe6d8')

  await selectEntityInEditor('contact-detail-message-card')
  await setControlValue('runtime.backgroundColor', 'effects', '#fff5ec')

  await selectEntityInEditor('contact-detail-message-fields')
  await setControlValue('runtime.backgroundColor', 'effects', '#e8f1ff')

  const fieldsIsolation = await evaluate(`(()=>{
    const cardBg=getComputedStyle(document.querySelector('.message-card')).backgroundColor;
    const nameBg=getComputedStyle(document.querySelector('#name')).backgroundColor;
    const emailBg=getComputedStyle(document.querySelector('#email')).backgroundColor;
    const msgBg=getComputedStyle(document.querySelector('#message')).backgroundColor;
    return { cardBg, nameBg, emailBg, msgBg, readonly: document.querySelector('#name')?.hasAttribute('readonly') };
  })()`)
  assert(fieldsIsolation.cardBg === 'rgb(255, 245, 236)' && fieldsIsolation.nameBg === 'rgb(232, 241, 255)' && fieldsIsolation.emailBg === 'rgb(232, 241, 255)' && fieldsIsolation.msgBg === 'rgb(232, 241, 255)' && fieldsIsolation.readonly, `Message card/field bg isolation failed: ${JSON.stringify(fieldsIsolation)}`)

  // Test Paste Style fontSize block + title controls
  await selectEntityInEditor('contact-detail-title')
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'c',ctrlKey:true,bubbles:true,cancelable:true}))`)
  await wait(80)

  await selectEntityInEditor('contact-detail-message-title')
  const msgTitleKeys = await evaluate(`[...document.querySelectorAll('[data-property-key]')].map(n=>n.dataset.propertyKey)`)
  assert(!msgTitleKeys.includes('font.size') && !msgTitleKeys.includes('font.positionX') && !msgTitleKeys.includes('font.positionY') && !msgTitleKeys.some(k=>k.startsWith('runtime.contact-detail-message-title')), `Text Me title exposed forbidden controls: ${JSON.stringify(msgTitleKeys)}`)
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true,cancelable:true}))`)
  await wait(80)
  const msgTitlePasteSize = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.typography['contact-detail-message-title']?.fontSize ?? null`)
  assert(msgTitlePasteSize === null, `Paste Style injected forbidden fontSize onto message title: ${msgTitlePasteSize}`)
  await setControlValue('font.family', 'font', "Georgia, 'Times New Roman', serif")
  await setControlValue('runtime.fontWeight', 'font', '700')
  await setControlValue('font.style', 'font', 'italic')
  await setControlValue('font.color', 'font', '#214e34')

  // Test Submit Button controls + Paste Style block + no form submit
  await selectEntityInEditor('contact-detail-submit-btn')
  const btnKeys = await evaluate(`[...document.querySelectorAll('[data-property-key]')].map(n=>n.dataset.propertyKey)`)
  assert(!btnKeys.includes('font.size') && !btnKeys.includes('font.positionX') && !btnKeys.includes('font.positionY') && !btnKeys.includes('runtime.buttonTextColor') && !btnKeys.includes('runtime.buttonBorderColor') && !btnKeys.includes('runtime.buttonRadius'), `Submit button exposed forbidden controls: ${JSON.stringify(btnKeys)}`)
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,bubbles:true,cancelable:true}))`)
  await wait(80)
  const btnPasteSize = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.typography['contact-detail-submit-btn']?.fontSize ?? null`)
  assert(btnPasteSize === null, `Paste Style injected forbidden fontSize onto submit button: ${btnPasteSize}`)
  await setControlValue('font.family', 'font', "Georgia, 'Times New Roman', serif")
  await setControlValue('runtime.fontWeight', 'font', '600')
  await setControlValue('font.style', 'font', 'italic')
  await setControlValue('font.color', 'font', '#fefae0')
  await setControlValue('effects.background', 'effects', '#1b4332')

  // Upload right photo in Text Me (then replace with permanent asset for publish)
  await selectEntityInEditor('contact-detail-photo-message')
  const msgPhotoKeys = await evaluate(`[...document.querySelectorAll('[data-property-key]')].map(n=>n.dataset.propertyKey)`)
  assert(msgPhotoKeys.includes('media.slotUpload') && !msgPhotoKeys.includes('media.positionX') && !msgPhotoKeys.includes('media.width'), `Unexpected controls on message photo: ${JSON.stringify(msgPhotoKeys)}`)
  await uploadToSelectedSlot(fixtureImagePath)
  await waitFor(`Boolean(document.querySelector('.message-photo-frame img.photo-area-image'))`)
  await replaceSelectedWithLibraryPrimary()

  // Verify ZERO drag, ZERO keyboard nudge, and ZERO Delete on ALL 6 Text Me entities
  const textMeIds = [
    'contact-message-section', 'contact-detail-message-card', 'contact-detail-message-title',
    'contact-detail-message-fields', 'contact-detail-submit-btn', 'contact-detail-photo-message'
  ]
  for (const lockedId of ['contact-detail-message-card', 'contact-detail-submit-btn', 'contact-detail-photo-message']) {
    await selectEntityInEditor(lockedId)
    const beforeLockCheck = await evaluate(`(async()=>{
      const tick=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const el=document.querySelector('[data-editor-object-id="'+${JSON.stringify(lockedId)}+'"]');
      el.scrollIntoView({block:'center',inline:'center'});
      await tick();
      const r=el.getBoundingClientRect();
      return { x: r.x, y: r.y, cx: Math.round(r.left + r.width * 0.5), cy: Math.round(r.top + r.height * 0.5) };
    })()`)
    await dragAt({ x: beforeLockCheck.cx, y: beforeLockCheck.cy }, 35, 25)
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true,cancelable:true}))`)
    await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}))`)
    await wait(100)
    const afterLockCheck = await evaluate(`(()=>{
      const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
      const r=document.querySelector('[data-editor-object-id="'+${JSON.stringify(lockedId)}+'"]').getBoundingClientRect();
      return {
        x: r.x, y: r.y,
        layout: editor.draftSnapshot.layout[${JSON.stringify(lockedId)}] ?? null
      };
    })()`)
    assert(Math.abs(afterLockCheck.x - beforeLockCheck.x) < 1 && Math.abs(afterLockCheck.y - beforeLockCheck.y) < 1 && !afterLockCheck.layout?.x && afterLockCheck.layout?.display !== 'none', `Text Me entity ${lockedId} moved or deleted! ${JSON.stringify(afterLockCheck)}`)
  }
  const anyTextMeMoved = await evaluate(`(() => {
    const layout=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.layout;
    return ${JSON.stringify(textMeIds)}.some(id=>Boolean(layout[id]?.x || layout[id]?.y));
  })()`)
  assert(!anyTextMeMoved, 'One or more Text Me entities recorded x/y layout offset!')

  // Capture Screenshots 1a & 1b: Admin Preview showing Contact -> ContactDetail seam, ContactDetail & Text Me
  await selectEntityInEditor('contact-detail-title')
  await evaluate(`(async()=>{
    document.querySelector('.section-contact2')?.scrollIntoView({block:'center'});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return true;
  })()`)
  await wait(120)
  const adminShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const adminShotPath = path.join(screenshotDir, 'verify-contact-detail-admin.png')
  await writeFile(adminShotPath, Buffer.from(adminShot.data, 'base64'))

  await selectEntityInEditor('contact-detail-submit-btn')
  await evaluate(`(async()=>{
    document.querySelector('.section-message')?.scrollIntoView({block:'center'});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return true;
  })()`)
  await wait(120)
  const adminTextMeShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const adminTextMeShotPath = path.join(screenshotDir, 'verify-contact-detail-admin-textme.png')
  await writeFile(adminTextMeShotPath, Buffer.from(adminTextMeShot.data, 'base64'))

  // 5. Save Draft & Publish atomically
  await evaluate(`(document.querySelector('.tbar-save')?.click(), true)`)
  await waitFor(`(()=>{const s=document.querySelector('.editor-save-status')?.textContent?.trim();return s==='Saved'||s==='Error / Unsaved'||s==='Conflict'})()`)
  const saveCheck = await evaluate(`({
    toolbarStatus: document.querySelector('.editor-save-status')?.textContent?.trim() ?? '',
    panelStatus: document.querySelector('.save-status')?.textContent?.trim() ?? '',
    hasChanges: Boolean(document.querySelector('.editor-save-status--dirty'))
  })`)
  assert(saveCheck.toolbarStatus === 'Saved', `Save Draft failed: ${JSON.stringify(saveCheck)}`)
  await evaluate(`(document.querySelector('.tbar-publish')?.click(), true)`)
  await waitFor(`Boolean(document.querySelector('.publish-modal .publish-confirm'))`)
  await evaluate(`(document.querySelector('.publish-modal .publish-confirm')?.click(), true)`)
  await waitFor(`(()=>{const s=document.querySelector('.editor-publish-status')?.textContent?.trim();return s==='Published'||s==='Failed'})()`)
  const publishCheck = await evaluate(`({
    publishStatus: document.querySelector('.editor-publish-status')?.textContent?.trim() ?? '',
    modalErrors: [...document.querySelectorAll('.publish-errors li')].map(n=>n.textContent.trim()),
    panelStatus: document.querySelector('.save-status')?.textContent?.trim() ?? ''
  })`)
  assert(publishCheck.publishStatus === 'Published', `Publish failed: ${JSON.stringify(publishCheck)}`)

  // 6. Navigate to Guest Home (/) — verify ContactDetail is NOT mounted there, CLICK HERE routes to /contact-detail
  await evaluate(`(async()=>{
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/');
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.guest-home')) && Boolean(document.querySelector('#contact-click-here'))`)
  await wait(150)
  const guestHomeEvidence = await evaluate(`({
    hasContactDetailOnHome: Boolean(document.querySelector('.contact-detail-page')),
    clickHereText: document.querySelector('#contact-click-here')?.textContent?.trim()
  })`)
  assert(!guestHomeEvidence.hasContactDetailOnHome, 'Guest Home / accidentally rendered ContactDetail!')

  // Click CLICK HERE -> routes cleanly to /#/contact-detail
  await evaluate(`(document.querySelector('#contact-click-here')?.click(), true)`)
  await waitFor(`Boolean(document.querySelector('.contact-detail-page')) && Boolean(document.querySelector('.section-message'))`)
  await waitFor(`document.querySelector('[data-entity-id="contact-detail-title"]')?.textContent?.trim() === 'DR. NATALIA'`)
  await waitFor(`[...document.querySelectorAll('.contact2-photo-frame img, .message-photo-frame img')].every(i=>i.complete && i.naturalWidth > 0)`)

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await wait(150)

  const guestDesktopCheck = await evaluate(`(()=>{
    const sec1=document.querySelector('.section-contact2');
    const sec2=document.querySelector('.section-message');
    const card=document.querySelector('.message-card');
    const nameInput=document.querySelector('#name');
    const title=document.querySelector('[data-entity-id="contact-detail-title"]');
    const sub=document.querySelector('[data-entity-id="contact-detail-subtitle"]');
    const msgTitle=document.querySelector('[data-entity-id="contact-detail-message-title"]');
    const submitBtn=document.querySelector('[data-entity-id="contact-detail-submit-btn"]');
    const links=[...document.querySelectorAll('.social-circle-btn')].map(a=>({
      label: a.getAttribute('aria-label'),
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel')
    }));
    const backBtn=Boolean(document.querySelector('.back-home-btn'));
    const imgs=[...document.querySelectorAll('.contact2-photo-frame img, .message-photo-frame img')].map(i=>i.naturalWidth);
    return {
      backBtn,
      sec1Bg: getComputedStyle(sec1).backgroundColor,
      sec2Bg: getComputedStyle(sec2).backgroundColor,
      cardBg: getComputedStyle(card).backgroundColor,
      inputBg: getComputedStyle(nameInput).backgroundColor,
      title: { text: title?.textContent?.trim(), size: getComputedStyle(title).fontSize, color: getComputedStyle(title).color, style: getComputedStyle(title).fontStyle },
      sub: { style: getComputedStyle(sub).fontStyle, color: getComputedStyle(sub).color },
      msgTitle: { font: getComputedStyle(msgTitle).fontFamily, style: getComputedStyle(msgTitle).fontStyle, color: getComputedStyle(msgTitle).color },
      submitBtn: { bg: getComputedStyle(submitBtn).backgroundColor, color: getComputedStyle(submitBtn).color, font: getComputedStyle(submitBtn).fontFamily, style: getComputedStyle(submitBtn).fontStyle },
      links,
      imgs,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  })()`)
  assert(guestDesktopCheck.backBtn && guestDesktopCheck.sec1Bg === 'rgb(83, 24, 32)' && guestDesktopCheck.sec2Bg === 'rgb(239, 230, 216)' && guestDesktopCheck.cardBg === 'rgb(255, 245, 236)' && guestDesktopCheck.inputBg === 'rgb(232, 241, 255)', `Guest published surfaces failed: ${JSON.stringify(guestDesktopCheck)}`)
  assert(guestDesktopCheck.title.text === 'DR. NATALIA' && guestDesktopCheck.title.size === '68px' && guestDesktopCheck.msgTitle.style === 'italic' && guestDesktopCheck.msgTitle.color === 'rgb(33, 78, 52)', `Guest typography failed: ${JSON.stringify(guestDesktopCheck)}`)
  assert(guestDesktopCheck.submitBtn.bg === 'rgb(27, 67, 50)' && guestDesktopCheck.submitBtn.color === 'rgb(254, 250, 224)' && guestDesktopCheck.submitBtn.style === 'italic', `Guest button styling failed: ${JSON.stringify(guestDesktopCheck)}`)
  assert(guestDesktopCheck.links.length === 2 && guestDesktopCheck.links.every(l => l.target === '_blank' && l.rel === 'noopener noreferrer' && !l.href?.includes('#')), `Guest links check failed: ${JSON.stringify(guestDesktopCheck.links)}`)
  assert(guestDesktopCheck.imgs.length === 2 && guestDesktopCheck.imgs.every(w => w > 0) && !guestDesktopCheck.overflow, `Guest images or overflow failed: ${JSON.stringify(guestDesktopCheck)}`)

  // Screenshot 2: Guest Desktop (full page capturing both Contact2 & Text Me)
  const guestDesktopShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  const guestDesktopShotPath = path.join(screenshotDir, 'verify-contact-detail-guest-desktop.png')
  await writeFile(guestDesktopShotPath, Buffer.from(guestDesktopShot.data, 'base64'))

  // Mobile 390x844 responsive check + screenshot 3
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await wait(200)
  const guestMobileCheck = await evaluate(`(()=>{
    const title=document.querySelector('[data-entity-id="contact-detail-title"]')?.getBoundingClientRect();
    const desc=document.querySelector('[data-entity-id="contact-detail-description"]')?.getBoundingClientRect();
    const mainPhoto=document.querySelector('.contact2-photo-frame')?.getBoundingClientRect();
    const msgPhoto=document.querySelector('.message-photo-frame')?.getBoundingClientRect();
    const inside=(r)=>Boolean(r && r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= 391);
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      titleInside: inside(title),
      descInside: inside(desc),
      mainPhotoInside: inside(mainPhoto),
      msgPhotoHeight: msgPhoto?.height ?? 0,
      msgPhotoInside: inside(msgPhoto)
    };
  })()`)
  assert(!guestMobileCheck.overflow && guestMobileCheck.titleInside && guestMobileCheck.descInside && guestMobileCheck.mainPhotoInside && guestMobileCheck.msgPhotoInside && guestMobileCheck.msgPhotoHeight >= 300, `Guest ContactDetail mobile geometry failed: ${JSON.stringify(guestMobileCheck)}`)
  const guestMobileShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  const guestMobileShotPath = path.join(screenshotDir, 'verify-contact-detail-guest-mobile.png')
  await writeFile(guestMobileShotPath, Buffer.from(guestMobileShot.data, 'base64'))

  // Test form submit + button mouseup timer + route unmount cleanup (timers cleared cleanly, no errors)
  const submitCheck = await evaluate(`(async()=>{
    const { messageRepository } = await import('/src/repositories/messageRepository.ts');
    const submitted = [];
    const origCreate = messageRepository.create;
    messageRepository.create = async (input) => { submitted.push(input); };
    try {
      const btn=document.querySelector('.btn-submit');
      btn?.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
      btn?.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const nameInput=document.querySelector('#name');
      const msgInput=document.querySelector('#message');
      nameInput.value='Budi'; nameInput.dispatchEvent(new Event('input',{bubbles:true}));
      msgInput.value='Halo dok'; msgInput.dispatchEvent(new Event('input',{bubbles:true}));
      document.querySelector('.message-form')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      for(let i=0;i<40 && !document.querySelector('.success-alert');i+=1) await new Promise(r=>setTimeout(r,30));
      const alertText=document.querySelector('.success-alert')?.textContent?.trim() ?? '';
      const clearedAfterSubmit = nameInput.value === '' && msgInput.value === '';
      const router=(await import('/src/router/index.ts')).default;
      await router.push('/');
      await new Promise(r=>setTimeout(r,420));
      return { alertText, submitted, clearedAfterSubmit, navigatedHome: Boolean(document.querySelector('.guest-home')) };
    } finally {
      messageRepository.create = origCreate;
    }
  })()`)
  assert(submitCheck.alertText.includes('Pesan berhasil terkirim!') && submitCheck.clearedAfterSubmit && submitCheck.submitted.length === 1 && submitCheck.navigatedHome, `Message submit or unmount failed: ${JSON.stringify(submitCheck)}`)

  const unhandled = await evaluate(`globalThis.__contactDetailUnhandled ?? []`)
  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED/i.test(error))
  assert(unhandled.length === 0 && seriousErrors.length === 0, `Runtime errors detected: ${[...unhandled, ...seriousErrors].join(' | ')}`)

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    scope: 'Finding #11 + Admin ContactDetail Preview & Granular Controls',
    screenshots: { adminShotPath, adminTextMeShotPath, guestDesktopShotPath, guestMobileShotPath },
    guestDesktopCheck,
    submitCheck
  }, null, 2)}\n`)
} finally {
  try { socket?.close() } catch { /* already closed */ }
  stopChildren()
  await wait(300)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }) } catch { /* ignore lock */ }
}
