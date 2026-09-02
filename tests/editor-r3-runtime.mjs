import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5174'
const cdpPort = 9334
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-r3-chrome-'))
const children = []

const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function waitForHttp(url, timeout = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch { /* server is still starting */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForJson(url, timeout = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return await response.json()
    } catch { /* browser is still starting */ }
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: ' ',
      VITE_SUPABASE_PUBLISHABLE_KEY: ' '
    }
  })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profilePath}`,
    '--window-size=1440,1000',
    baseUrl
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
  const page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5174'))
  if (!page) throw new Error('Runtime test page target not found')

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

  async function waitFor(expression, timeout = 10000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(60)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  function assert(condition, message) {
    if (!condition) throw new Error(`Editor R3 runtime failure: ${message}`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  try {
    await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  } catch (error) {
    const diagnostics = await evaluate(`({url:location.href,body:document.body.innerText.slice(0,1200),html:document.documentElement.innerHTML.slice(0,1200)})`)
    throw new Error(`${error.message}; bootstrap=${JSON.stringify(diagnostics)}; vite=${viteErrors}; browser=${browserErrors}; runtime=${runtimeErrors.join(' | ')}`)
  }
  await evaluate(`(async()=>{
    const authModule=await import('/src/stores/auth.ts');
    const router=(await import('/src/router/index.ts')).default;
    const auth=authModule.useAuthStore();
    auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});
    await router.push('/admin/edit');
    return true;
  })()`)
  try {
    await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-entity-id="portfolio-hero"]'))`, 15000)
  } catch (error) {
    const diagnostics = await evaluate(`({hash:location.hash,body:document.body.innerText.slice(0,1200),recovery:document.querySelector('.editor-recovery')?.innerText,app:Boolean(document.querySelector('#app')?.__vue_app__)})`)
    throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}; runtimeErrors=${runtimeErrors.join(' | ')}`)
  }

  const fontMetadata = await evaluate(`(()=>{
    const labels=[...document.querySelectorAll('[data-property-category="font"] .property-field > span')].map(node=>node.textContent.trim());
    return {
      labels,
      pairCount:document.querySelectorAll('[data-property-category="font"] .property-row--paired').length,
      hoverNative:document.querySelector('[data-property-key="font.hover"] input[type="checkbox"]')?.tagName==='INPUT'
    };
  })()`)
  assert(fontMetadata.labels.indexOf('Font') < fontMetadata.labels.indexOf('Size'), 'FONT metadata order is wrong')
  assert(fontMetadata.labels.indexOf('Size') < fontMetadata.labels.indexOf('Spacing'), 'Size/Spacing order is wrong')
  assert(fontMetadata.labels.includes('Color') && fontMetadata.labels.includes('Text Shadow') && fontMetadata.labels.includes('Rotation'), 'FONT controls are incomplete')
  assert(fontMetadata.pairCount >= 2, 'FONT paired rows are missing')
  assert(fontMetadata.hoverNative, 'FONT Hover does not use a native dependency-aware checkbox')

  const portfolioResult = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const title=[...document.querySelectorAll('[data-editor-entity-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    title.click(); await tick();
    const input=document.querySelector('[data-property-key="runtime.portfolio-hero.title"] input,[data-property-key="runtime.portfolio-hero.title"] textarea');
    input.value='PORTFOLIO-R3'; input.dispatchEvent(new Event('input',{bubbles:true})); await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    return {selected:editor.selectedEntityId,section:editor.selectedSection,text:title.textContent.trim(),snapshot:editor.draftSnapshot.content.portfolio.title,inputValue:input.value,inputTag:input.tagName,outlined:title.classList.contains('editor-preview-selected')};
  })()`)
  assert(portfolioResult.selected === 'portfolio-hero' && portfolioResult.section === 'Portfolio', 'Portfolio preview selection failed')
  assert(portfolioResult.text === 'PORTFOLIO-R3', `Portfolio content did not update live: ${JSON.stringify(portfolioResult)}`)
  assert(portfolioResult.outlined, 'Portfolio selected outline is missing')

  const lisaResult = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const name=document.querySelector('[data-editor-entity-id="navigation-brand"]'); name.click(); await tick();
    const input=document.querySelector('[data-property-key="runtime.navigation-brand.brand"] input,[data-property-key="runtime.navigation-brand.brand"] textarea');
    input.value='LISA R3'; input.dispatchEvent(new Event('input',{bubbles:true})); await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    return {selected:editor.selectedEntityId,section:editor.selectedSection,text:name.textContent.trim(),selector:document.querySelector('[data-admin-entity-select]').value};
  })()`)
  assert(lisaResult.selected === 'navigation-brand' && lisaResult.selector === 'navigation-brand', 'Lisa selection jumped while typing')
  assert(lisaResult.section === 'Navigation' && lisaResult.text === 'LISA R3', 'Lisa name binding failed')

  const certificateResult = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const card=document.querySelector('[data-certificate-id]');
    const cardId=card.dataset.certificateId; card.click(); await tick();
    const input=document.querySelector('[data-property-key="runtime.'+cardId+'.title"] input,[data-property-key="runtime.'+cardId+'.title"] textarea');
    input.value='CERTIFICATE R3'; input.dispatchEvent(new Event('input',{bubbles:true})); await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    return {cardId,selected:editor.selectedEntityId,section:editor.selectedSection,snapshotTitle:editor.draftSnapshot.certificateCards.find(item=>item.id===cardId)?.title,previewTitle:card.querySelector('.info-title')?.textContent.trim()};
  })()`)
  assert(certificateResult.selected === certificateResult.cardId && certificateResult.section === 'Certificate', 'Certificate preview selection failed')
  assert(certificateResult.snapshotTitle === 'CERTIFICATE R3' && certificateResult.previewTitle === 'CERTIFICATE R3', 'Certificate did not bind through EditorSnapshot/live preview')

  await evaluate(`(()=>{
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const site=pinia._s.get('site');
    const source=site.current.mediaAssets[0]?.source;
    if(source&&!site.current.mediaAssets.some(asset=>asset.id==='media-runtime-secondary'))site.current.mediaAssets.push({id:'media-runtime-secondary',source,alt:'Runtime media library fixture',mimeType:'image/webp'});
    return true;
  })()`)

  const mediaResult = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const image=document.querySelector('[data-editor-entity-id="portfolio-profile-media"]'); image.click(); await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const control=(selector,leaf)=>{const root=document.querySelector(selector);return root?.matches(leaf)?root:root?.querySelector(leaf)};
    const outlineWidth=control('[data-property-key="media.outlineWidth"]','input');
    const outline=control('[data-property-key="media.outlineEnabled"]','input');
    const choose=control('[data-property-key="media.choose"]','button');
    const hover=control('[data-property-key="media.hover"]','input');
    const before=outlineWidth.disabled;
    outline.checked=true; outline.dispatchEvent(new Event('change',{bubbles:true})); await tick();
    const after=outlineWidth.disabled;
    const width=control('[data-property-key="media.width"]','input');
    width.value='280px'; width.dispatchEvent(new Event('input',{bubbles:true})); await tick();
    choose.click(); await tick();
    for(let attempt=0;attempt<60&&!document.querySelector('.asset-picker');attempt+=1)await new Promise(resolve=>setTimeout(resolve,20));
    const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media');
    const pickerOpen=Boolean(document.querySelector('.asset-picker'));
    const pickerAssets=document.querySelectorAll('.asset-picker .asset-card').length;
    document.querySelector('.asset-picker .close-button')?.click(); await tick();
    return {
      selected:editor.selectedEntityId,
      section:editor.selectedSection,
      accordion:editor.activeAccordion,
      before,
      after,
      chooseDisabled:choose.disabled,
      chooseTag:choose.tagName,
      pickerOpen,
      pickerAssets,
      chosenAsset:assignment?.assetId,
      hoverNative:hover.tagName==='INPUT'&&hover.type==='checkbox',
      width:editor.draftSnapshot.layout['portfolio-profile-media'].width,
      inlineWidth:image.style.width,
      outlined:image.classList.contains('editor-preview-selected'),
      outlineStyle:getComputedStyle(image).outlineStyle,
      outlineWidth:getComputedStyle(image).outlineWidth
    };
  })()`)
  assert(mediaResult.selected === 'portfolio-profile-media' && mediaResult.section === 'Portfolio' && mediaResult.accordion === 'media', 'media preview selection failed')
  assert(mediaResult.before && !mediaResult.after, 'Outline thickness dependency did not toggle native disabled')
  assert(!mediaResult.chooseDisabled && mediaResult.chooseTag === 'BUTTON' && mediaResult.pickerOpen && mediaResult.pickerAssets >= 1, 'repository-backed professional media picker is unavailable')
  assert(mediaResult.chosenAsset === 'media-profile-primary' && mediaResult.selected === 'portfolio-profile-media', 'Opening Choose Existing changed the selected media entity')
  assert(mediaResult.hoverNative, 'MEDIA Hover does not use a native dependency-aware checkbox')
  assert(mediaResult.width === '280px' && mediaResult.inlineWidth === '280px', 'MEDIA width did not bind to snapshot/live preview')
  assert(mediaResult.outlined && mediaResult.outlineStyle !== 'none' && mediaResult.outlineWidth === '3px', 'selected media outline is not visible')
  await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
  const mediaScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-029f-r3-media-panel-runtime.png'), Buffer.from(mediaScreenshot.data, 'base64'))

  const mediaUploadResult = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const image=document.querySelector('[data-editor-entity-id="portfolio-profile-media"]');
    const originalAsset=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media').assetId;
    const blob=await fetch(image.src).then(response=>response.blob());
    const file=new File([blob],'profile-r3.webp',{type:blob.type||'image/webp'});
    const transfer=new DataTransfer(); transfer.items.add(file);
    const uploadControl=document.querySelector('[data-property-key="media.upload"]');const upload=uploadControl.matches('input')?uploadControl:uploadControl.querySelector('input');
    upload.files=transfer.files; upload.dispatchEvent(new Event('change',{bubbles:true}));
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    for(let i=0;i<80&&editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media')?.assetId===originalAsset;i++)await new Promise(resolve=>setTimeout(resolve,25));
    await tick();
    const assignment=editor.draftSnapshot.media.assignments.find(item=>item.entityId==='portfolio-profile-media');
    const reference=editor.draftSnapshot.media.references.find(item=>item.assetId===assignment?.assetId);
    return {originalAsset,nextAsset:assignment?.assetId,reference:reference?{assetId:reference.assetId,storagePath:reference.storagePath,bucket:reference.bucket,uri:reference.uri}:null,src:image.src,selected:editor.selectedEntityId};
  })()`)
  assert(mediaUploadResult.nextAsset && mediaUploadResult.nextAsset !== mediaUploadResult.originalAsset, 'MEDIA Upload did not create a new asset reference')
  assert(mediaUploadResult.reference?.storagePath?.startsWith('draft/'), `MEDIA Upload did not stage under draft/: ${JSON.stringify(mediaUploadResult)}`)
  assert(mediaUploadResult.src.startsWith('blob:') && mediaUploadResult.selected === 'portfolio-profile-media', 'MEDIA Upload did not refresh preview or preserve selection')

  const historyResult = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const rotate=document.querySelector('[data-property-key="media.rotate"] input');
    for(let value=1;value<=12;value++){rotate.value=String(value);rotate.dispatchEvent(new Event('input',{bubbles:true}));}
    await tick();
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const editor=pinia._s.get('editor');
    const before=editor.draftSnapshot.layout['portfolio-profile-media'].rotation;
    document.querySelector('.tbar-undo').click(); await tick();
    const undone=editor.draftSnapshot.layout['portfolio-profile-media'].rotation;
    const selectedAfterUndo=editor.selectedEntityId;
    document.querySelector('.tbar-redo').click(); await tick();
    return {history:editor.commandHistory.length,before,undone,redone:editor.draftSnapshot.layout['portfolio-profile-media'].rotation,selectedAfterUndo};
  })()`)
  assert(historyResult.history > 0 && historyResult.history <= 10, 'command history is not capped at 10')
  assert(historyResult.before === 12 && historyResult.undone !== 12 && historyResult.redone === 12, 'coalesced Undo/Redo did not update snapshot')
  assert(historyResult.selectedAfterUndo === 'portfolio-profile-media', 'Undo changed the selected entity')

  await evaluate(`document.querySelector('.tbar-save').click()`)
  try {
    await waitFor(`document.querySelector('.editor-save-status')?.textContent.trim()==='Saved'`)
  } catch (error) {
    const diagnostics = await evaluate(`({toolbar:document.querySelector('.editor-save-status')?.textContent.trim(),panel:document.querySelector('.save-status')?.textContent.trim(),history:document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').commandHistory.length})`)
    throw new Error(`${error.message}; firstSave=${JSON.stringify(diagnostics)}; runtimeErrors=${runtimeErrors.join(' | ')}`)
  }
  const firstSave = await evaluate(`(async()=>{
    const repo=(await import('/src/repositories/editorRevisionRepository.ts')).editorDraftRepository;
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    return {count:await repo.countDrafts(),id:editor.draftRevisionId,lock:editor.draftLockVersion,history:editor.commandHistory.length};
  })()`)
  assert(firstSave.count === 1 && firstSave.id && firstSave.lock === 1, 'first Save Draft did not create exactly one Draft')
  assert(firstSave.history > 0, 'Save Draft incorrectly cleared command history')

  await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const title=[...document.querySelectorAll('[data-editor-entity-id="portfolio-hero"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    title.click(); await tick();
    const input=document.querySelector('[data-property-key="runtime.portfolio-hero.title"] input,[data-property-key="runtime.portfolio-hero.title"] textarea'); input.value='PORTFOLIO-R3-SAVED'; input.dispatchEvent(new Event('input',{bubbles:true})); await tick();
    document.querySelector('.tbar-save').click(); return true;
  })()`)
  await waitFor(`document.querySelector('.editor-save-status')?.textContent.trim()==='Saved'`)
  const secondSave = await evaluate(`(async()=>{const repo=(await import('/src/repositories/editorRevisionRepository.ts')).editorDraftRepository;const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return {count:await repo.countDrafts(),id:editor.draftRevisionId,lock:editor.draftLockVersion,title:editor.draftSnapshot.content.portfolio.title}})()`)
  assert(secondSave.count === 1 && secondSave.id === firstSave.id && secondSave.lock === 2, 'existing Draft save created a duplicate row or failed to advance lock')
  assert(secondSave.title === 'PORTFOLIO-R3-SAVED', 'updated Draft content was not retained')

  await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    document.querySelector('[data-editor-entity-id="navigation-brand"]').click(); await tick();
    const zoom=document.querySelector('.zoom-control select'); zoom.value='0.75'; zoom.dispatchEvent(new Event('change',{bubbles:true})); await tick();
    document.querySelector('.tbar-save').click(); return true;
  })()`)
  await waitFor(`document.querySelector('.editor-save-status')?.textContent.trim()==='Saved'`)
  await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');await router.push({name:'admin-drafts'});await new Promise(resolve=>setTimeout(resolve,100));await router.push({name:'admin-edit',query:{draft:editor.draftRevisionId}});return true})()`)
  await waitFor(`Boolean(document.querySelector('.edit-page')) && Boolean(document.querySelector('[data-editor-entity-id="navigation-brand"]'))`)
  const restoredSession = await evaluate(`(()=>{const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');return {selected:editor.selectedEntityId,section:editor.selectedSection,accordion:editor.activeAccordion,zoom:document.querySelector('.zoom-control select').value,title:editor.draftSnapshot.content.portfolio.title}})()`)
  assert(restoredSession.selected === 'navigation-brand' && restoredSession.section === 'Navigation' && restoredSession.accordion === 'font', 'selection/section/accordion session restore failed')
  assert(restoredSession.zoom === '0.75' && restoredSession.title === 'PORTFOLIO-R3-SAVED', 'zoom or Draft content restore failed')
  const restoredCertificate = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.certificateCards.some(card=>card.title==='CERTIFICATE R3')`)
  assert(restoredCertificate, 'Certificate did not survive Save Draft and editor reload')

  await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const input=document.querySelector('[data-property-key="runtime.navigation-brand.brand"] input,[data-property-key="runtime.navigation-brand.brand"] textarea');input.value='UNSAVED';input.dispatchEvent(new Event('input',{bubbles:true}));await tick();document.querySelector('.open-source-button').click();await tick();[...document.querySelectorAll('.source-options button')][0].click();await tick();return true})()`)
  await waitFor(`Boolean(document.querySelector('.unsaved-modal'))`)
  const unsavedActions = await evaluate(`[...document.querySelectorAll('.unsaved-actions button')].map(button=>button.textContent.trim())`)
  assert(JSON.stringify(unsavedActions) === JSON.stringify(['Save Draft & Continue', 'Discard Changes & Continue', 'Cancel']), 'unsaved switch protection actions are incomplete')
  await evaluate(`[...document.querySelectorAll('.unsaved-actions button')].find(button=>button.textContent.trim()==='Cancel').click()`)

  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-029f-r3-editor-runtime.png'), Buffer.from(screenshot.data, 'base64'))

  await evaluate(`document.querySelector('.tbar-save').click()`)
  await waitFor(`document.querySelector('.editor-save-status')?.textContent.trim()==='Saved'`)
  await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;await router.push({name:'admin-drafts'});return true})()`)
  await waitFor(`document.querySelectorAll('.draft-library-card').length===1`)
  const draftCardAccess = await evaluate(`(()=>{const surface=document.querySelector('.draft-library-card__surface');return {count:document.querySelectorAll('.draft-library-card').length,tag:surface?.tagName,tabindex:surface?.tabIndex,aria:surface?.getAttribute('aria-label')}})()`)
  assert(draftCardAccess.count === 1 && draftCardAccess.tag === 'BUTTON' && draftCardAccess.tabindex === 0 && draftCardAccess.aria?.includes('Open'), 'Draft Library item is not usable')
  await evaluate(`document.querySelector('.draft-library-card__favorite').click()`)
  await waitFor(`document.querySelector('.draft-library-card__favorite')?.getAttribute('aria-pressed')==='true'`)
  await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;await router.push({name:'admin-favorites'});return true})()`)
  await waitFor(`document.querySelectorAll('.draft-library-card').length===1`)
  await evaluate(`document.querySelector('.draft-library-card__favorite').click()`)
  await waitFor(`Boolean(document.querySelector('.product-empty-state'))`)
  const favoriteDeleteSemantics = await evaluate(`(async()=>{const repo=await import('/src/repositories/editorRevisionRepository.ts');return {drafts:await repo.editorDraftRepository.countDrafts(),favorites:await repo.favoriteRepository.countFavorites()}})()`)
  assert(favoriteDeleteSemantics.drafts === 1 && favoriteDeleteSemantics.favorites === 0, 'removing Favorite deleted the Draft')

  await evaluate(`(async()=>{const router=(await import('/src/router/index.ts')).default;await router.push({name:'admin-dashboard'});return true})()`)
  await waitFor(`Boolean(document.querySelector('.card-draft.card-link'))`)
  const dashboard = await evaluate(`(()=>({draftRole:document.querySelector('.card-draft').getAttribute('role'),draftTab:document.querySelector('.card-draft').getAttribute('tabindex'),favoriteRole:document.querySelector('.card-favorite').getAttribute('role'),messageLink:document.querySelector('.card-message').classList.contains('card-link'),draftText:document.querySelector('.card-draft-desc').textContent.trim(),favoriteText:document.querySelector('.card-favorite-desc').textContent.trim()}))()`)
  assert(dashboard.draftRole === 'button' && dashboard.draftTab === '0' && dashboard.favoriteRole === 'button' && dashboard.messageLink, 'Dashboard cards are not full keyboard-accessible targets')
  assert(dashboard.draftText === '1 / 10 drafts' && dashboard.favoriteText === '0 / 8 favorites', 'Dashboard counts are wrong')
  const dashboardScreenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(projectRoot, 'artifacts', 'phase-029f-r3-dashboard-runtime.png'), Buffer.from(dashboardScreenshot.data, 'base64'))
  await evaluate(`document.querySelector('.card-draft').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`)
  await waitFor(`location.hash.includes('/admin/drafts')`)

  assert(runtimeErrors.length === 0, `browser console errors: ${runtimeErrors.join(' | ')}`)
  assert(!viteErrors.includes('error'), `Vite runtime errors: ${viteErrors}`)
  assert(!browserErrors.includes('FATAL'), `Chromium runtime failure: ${browserErrors}`)

  console.log(JSON.stringify({
    status: 'PASS',
    scope: 'Phase 029F-R3 in-memory browser E2E',
    selection: true,
    propertyPanel: true,
    undoRedo: true,
    draftFavorite: true,
    authenticatedCloudSession: false,
    publishExecuted: false
  }))
} finally {
  socket?.close()
  stopChildren()
  await wait(500)
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}
