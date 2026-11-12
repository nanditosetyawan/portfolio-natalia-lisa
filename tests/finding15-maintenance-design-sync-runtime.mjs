import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const chromePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const artifactDir = 'C:\\Users\\VivoBook\\.gemini\\antigravity\\brain\\0b4608d3-4260-456b-99a3-1d6a6103c66e'
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))

function assert(condition, message) {
  if (!condition) throw new Error(`Finding #15 runtime failure: ${message}`)
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

async function openBrowserSession(port, cdpPort, envOverrides) {
  const profilePath = await mkdtemp(path.join(tmpdir(), `portfolio-finding15-${port}-`))
  const children = []
  const launch = (command, args, options = {}) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options })
    children.push(child)
    return child
  }
  const stopAll = async () => {
    for (const child of children.reverse()) {
      if (!child.killed) child.kill()
      child.stdout?.destroy()
      child.stderr?.destroy()
    }
    await wait(250)
    try { await rm(profilePath, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }) } catch { /* ignore */ }
  }

  const baseUrl = `http://127.0.0.1:${port}`
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, ...envOverrides }
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

  let page
  const targetStarted = Date.now()
  while (!page && Date.now() - targetStarted < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes(`127.0.0.1:${port}`))
    if (!page) await wait(100)
  }
  if (!page) throw new Error(`Finding #15 browser target on ${port} not found. vite=${viteErrors} browser=${browserErrors}`)

  const socket = new WebSocket(page.webSocketDebuggerUrl)
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
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
    if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) {
      consoleWarnings.push(message.params.args.map((entry) => entry.value ?? entry.description ?? '').join(' '))
    }
  })

  function send(method, params = {}) {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
      pending.set(id, { resolve(v) { clearTimeout(timer); resolve(v) }, reject(e) { clearTimeout(timer); reject(e) } })
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
    throw new Error(`Timed out waiting for: ${expression}`)
  }

  async function capture(filename) {
    await mkdir(artifactDir, { recursive: true })
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(artifactDir, filename), Buffer.from(shot.data, 'base64'))
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(()=>{globalThis.__f15Unhandled=[];addEventListener('unhandledrejection',(e)=>globalThis.__f15Unhandled.push(String(e.reason?.stack??e.reason)));return true})()`)

  return {
    send,
    evaluate,
    waitFor,
    capture,
    runtimeErrors,
    consoleWarnings,
    async close() {
      try { socket.close() } catch { /* ignore */ }
      await stopAll()
    }
  }
}

// =========================================================================
// PART 1 & 2: Local Mode (Preset Delete, Date/Overflow Safety, Maintenance Staged Restore, Draft Cap >= 10, Prototype Pollution Guard)
// =========================================================================
let localEvidence = null
const localSession = await openBrowserSession(5188, 9358, {
  VITE_SUPABASE_URL: ' ',
  VITE_SUPABASE_PUBLISHABLE_KEY: ' '
})

try {
  await localSession.evaluate(`(async()=>{
    const auth=(await import('/src/stores/auth.ts')).useAuthStore();
    auth.$patch({isAdmin:true,isInitialized:true,isLoading:false});
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/admin/edit');
    return true;
  })()`)
  await localSession.waitFor(`Boolean(document.querySelector('.edit-page')) && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`)

  // Seed corrupt date preset, long-name preset, and section template
  await localSession.evaluate(`(()=>{
    const design=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem');
    design.initialize();
    design.saveSectionTemplate({id:'sec-1',name:'Portfolio Style',sourceSection:'Portfolio',createdAt:new Date().toISOString(),styleValues:{}});
    design.saveComponentPreset({id:'pre-good',name:'Primary Title Style',sourceType:'Text',createdAt:new Date().toISOString(),styleValues:{'typography.fontWeight':700}});
    design.saveComponentPreset({id:'pre-long',name:'SuperLongPresetName_'+'X'.repeat(85),sourceType:'Text',createdAt:'not-a-valid-iso-date',styleValues:{'typography.fontWeight':600}});
    return design.workspace.componentPresets.length;
  })()`)

  await localSession.evaluate(`document.querySelector('.design-system-button').click()`)
  await localSession.waitFor(`Boolean(document.querySelector('.design-system-panel'))`)
  await localSession.evaluate(`[...document.querySelectorAll('.design-tabs button')].find(b=>b.textContent.trim()==='templates').click()`)
  await localSession.waitFor(`document.querySelectorAll('.template-list article').length === 3`)

  // Check zero Invalid Date + zero nameless buttons + zero mobile horizontal overflow before deleting
  const presetUiBefore = await localSession.evaluate(`(()=>{
    const panel=document.querySelector('.design-system-panel');
    const nameless=[...panel.querySelectorAll('button')].filter(b=>!b.innerText.trim()&&!b.getAttribute('aria-label')).length;
    const text=panel.querySelector('[data-design-tab="templates"]').innerText;
    const btns=[...panel.querySelectorAll('[data-design-tab="templates"] button.danger[aria-label*="Delete"]')];
    return {
      invalidDate:text.includes('Invalid Date'),
      savedFallback:text.includes('Saved'),
      nameless,
      deleteLabels:btns.map(b=>b.getAttribute('aria-label')),
      overflowDesktop:document.documentElement.scrollWidth - window.innerWidth
    };
  })()`)
  assert(!presetUiBefore.invalidDate && presetUiBefore.savedFallback, `Corrupt preset date rendered Invalid Date: ${JSON.stringify(presetUiBefore)}`)
  assert(presetUiBefore.nameless === 0 && presetUiBefore.deleteLabels.length === 3, `Preset delete buttons missing/nameless: ${JSON.stringify(presetUiBefore)}`)
  assert(presetUiBefore.overflowDesktop <= 0, `Desktop overflow with long preset: ${presetUiBefore.overflowDesktop}`)

  await localSession.capture('finding15-after-design-presets.png')

  // Check 390px mobile overflow with long preset name inside DesignSystemPanel
  await localSession.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await wait(80)
  const presetMobileOverflow = await localSession.evaluate(`document.documentElement.scrollWidth - window.innerWidth`)
  assert(presetMobileOverflow <= 0, `Mobile horizontal overflow in Templates tab: ${presetMobileOverflow}`)
  await localSession.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  // Click Delete on the corrupted-date long preset and confirm persistence across store re-init & reload
  await localSession.evaluate(`document.querySelector('button.danger[aria-label*="SuperLongPresetName_"]').click()`)
  await localSession.waitFor(`document.querySelectorAll('.template-list article').length === 2`)
  const presetAfterDelete = await localSession.evaluate(`(()=>{
    const design=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem');
    const raw=JSON.parse(localStorage.getItem('portfolio-editor-design-system-v1')||'{}');
    const footer=document.querySelector('.design-system-panel footer')?.innerText||'';
    const status=document.querySelector('.save-status')?.innerText||'';
    return {
      remainingIds:design.workspace.componentPresets.map(p=>p.id),
      persistedIds:(raw.componentPresets||[]).map(p=>p.id),
      footer,
      status
    };
  })()`)
  assert(
    presetAfterDelete.remainingIds.length === 1 && presetAfterDelete.remainingIds[0] === 'pre-good'
    && presetAfterDelete.persistedIds.length === 1 && presetAfterDelete.persistedIds[0] === 'pre-good'
    && presetAfterDelete.footer.includes('Deleted') && presetAfterDelete.status.includes('Component preset deleted.'),
    `Component preset delete failed: ${JSON.stringify(presetAfterDelete)}`
  )

  // Navigate to /admin/maintenance and test Staged Validation -> Restore Design System -> Import Snapshot as New Draft -> Cap >= 10 -> Prototype Pollution
  await localSession.evaluate(`(async()=>{
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/admin/maintenance');
    return true;
  })()`)
  await localSession.waitFor(`Boolean(document.querySelector('.maintenance-page'))`)

  const maintInitial = await localSession.evaluate(`({
    enabledCards:[...document.querySelectorAll('.maintenance-card:not(:disabled)')].length,
    importTitle:document.querySelector('.maintenance-card--import .maintenance-title')?.textContent?.trim()
  })`)
  assert(maintInitial.enabledCards === 2 && maintInitial.importTitle === 'Validate & Restore', `Initial maintenance contract broken: ${JSON.stringify(maintInitial)}`)

  // Inject prototype-pollution payload JSON -> must fail validation & NOT pollute Object.prototype
  await localSession.evaluate(`(async()=>{
    const input=document.querySelector('.maintenance-file-input');
    const dt=new DataTransfer();
    dt.items.add(new File(['{"__proto__":{"f15Polluted":true},"version":1}'],'evil.json',{type:'application/json'}));
    Object.defineProperty(input,'files',{value:dt.files,configurable:true});
    input.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`)
  await localSession.waitFor(`Boolean(document.querySelector('.validation-result--error'))`)
  const evilOutcome = await localSession.evaluate(`({
    polluted:({}).f15Polluted === true,
    hasRestoreBtns:document.querySelectorAll('.validation-action-btn').length > 0,
    errorText:document.querySelector('.validation-result')?.innerText
  })`)
  assert(!evilOutcome.polluted && !evilOutcome.hasRestoreBtns, `Prototype pollution / error UI failed: ${JSON.stringify(evilOutcome)}`)

  // Build valid Production Backup with custom theme 'Restored Rose' + 1 Draft snapshot, upload it -> must STILL be read-only first!
  const stagedOutcome = await localSession.evaluate(`(async()=>{
    const backupMod=await import('/src/production/backup.ts');
    const designMod=await import('/src/editor/designSystemRegistry.ts');
    const siteMod=await import('/src/data/default/site.ts');
    const snapMod=await import('/src/editor/editorSnapshot.ts');
    const repoMod=await import('/src/repositories/editorRevisionRepository.ts');

    const base=await backupMod.createProductionBackup();
    const restoredTheme=designMod.createDefaultDesignTheme();
    restoredTheme.name='Restored Rose';
    restoredTheme.id='theme-restored-f15';
    restoredTheme.tokens['color-primary']='#123456';
    const importedSnap=snapMod.createEditorSnapshot(siteMod.createDefaultSiteSnapshot());
    importedSnap.content.portfolio.title='BACKUP RESTORED PORTFOLIO';
    const backupObj={
      ...base,
      drafts:[{
        id:'bak-draft-1',revision_number:7,lock_version:1,status:'draft',snapshot:importedSnap,base_revision_number:null,
        created_by:'admin',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
        published_at:null,source_draft_revision_id:null,published_by:null,publish_note:null,publication_kind:null,rollback_source_revision_id:null
      }],
      designSystem:{...base.designSystem,themes:[...base.designSystem.themes,restoredTheme],activeThemeId:'theme-restored-f15'}
    };
    const zip=backupMod.createZipArchive([{name:'backup.json',content:JSON.stringify(backupObj)}]);
    const draftsBefore=await repoMod.editorDraftRepository.countDrafts();
    const input=document.querySelector('.maintenance-file-input');
    const dt=new DataTransfer();
    dt.items.add(new File([zip],'valid-backup.zip',{type:'application/zip'}));
    Object.defineProperty(input,'files',{value:dt.files,configurable:true});
    input.dispatchEvent(new Event('change',{bubbles:true}));
    for(let i=0;i<100&&!document.querySelector('.validation-action-btn');i+=1) await new Promise(r=>setTimeout(r,20));
    const draftsAfterValidation=await repoMod.editorDraftRepository.countDrafts();
    return {
      draftsBefore,
      draftsAfterValidation,
      text:document.querySelector('.validation-result')?.innerText,
      buttons:[...document.querySelectorAll('.validation-action-btn')].map(b=>b.textContent.trim())
    };
  })()`)
  assert(stagedOutcome.draftsBefore === 0 && stagedOutcome.draftsAfterValidation === 0, `Validation mutated drafts prematurely! ${JSON.stringify(stagedOutcome)}`)
  assert(stagedOutcome.buttons.includes('Restore Design System') && stagedOutcome.buttons.includes('Import Snapshot as New Draft'), `Missing restore buttons: ${JSON.stringify(stagedOutcome)}`)

  // Click Restore Design System -> confirm active theme became 'Restored Rose' without adding drafts
  await localSession.evaluate(`[...document.querySelectorAll('.validation-action-btn')].find(b=>b.textContent.includes('Restore Design System')).click()`)
  await localSession.waitFor(`Boolean(document.querySelector('.validation-action-status'))`)
  const designRestored = await localSession.evaluate(`(async()=>{
    const design=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem');
    const repoMod=await import('/src/repositories/editorRevisionRepository.ts');
    return {
      activeTheme:design.activeTheme.name,
      primary:design.activeTheme.tokens['color-primary'],
      drafts:await repoMod.editorDraftRepository.countDrafts(),
      msg:document.querySelector('.validation-action-status')?.textContent?.trim()
    };
  })()`)
  assert(designRestored.activeTheme === 'Restored Rose' && designRestored.primary === '#123456' && designRestored.drafts === 0, `Design restore failed: ${JSON.stringify(designRestored)}`)

  // Click Import Snapshot as New Draft -> creates Draft #1 without creating Published
  await localSession.evaluate(`[...document.querySelectorAll('.validation-action-btn')].find(b=>b.textContent.includes('Import Snapshot as New Draft')).click()`)
  await localSession.waitFor(`Boolean(document.querySelector('.validation-action-status--draft'))`)
  const draftImported = await localSession.evaluate(`(async()=>{
    const repoMod=await import('/src/repositories/editorRevisionRepository.ts');
    const drafts=await repoMod.editorDraftRepository.listDrafts();
    const published=await repoMod.editorPublishRepository.getPublishedRevision();
    return {
      draftCount:drafts.length,
      importedTitle:drafts[0]?.revision.snapshot.content.portfolio.title,
      publishedExists:Boolean(published),
      nameless:[...document.querySelectorAll('button')].filter(b=>!b.innerText.trim()&&!b.getAttribute('aria-label')).length,
      unlabeled:[...document.querySelectorAll('input,select')].filter(el=>!el.getAttribute('aria-label')&&!el.closest('label')).length,
      overflowDesktop:document.documentElement.scrollWidth - window.innerWidth
    };
  })()`)
  assert(
    draftImported.draftCount === 1
    && draftImported.importedTitle === 'BACKUP RESTORED PORTFOLIO'
    && !draftImported.publishedExists
    && draftImported.nameless === 0
    && draftImported.unlabeled === 0
    && draftImported.overflowDesktop <= 0,
    `Draft import check failed: ${JSON.stringify(draftImported)}`
  )

  await localSession.capture('finding15-after-maintenance-desktop.png')

  // Mobile 390x844 screenshot & overflow check on Maintenance
  await localSession.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await localSession.evaluate(`document.querySelector('.validation-result')?.scrollIntoView({block:'center'})`)
  await wait(80)
  const maintMobileOverflow = await localSession.evaluate(`document.documentElement.scrollWidth - window.innerWidth`)
  assert(maintMobileOverflow <= 0, `Maintenance mobile overflow: ${maintMobileOverflow}`)
  await localSession.capture('finding15-after-maintenance-mobile.png')
  await localSession.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  // Verify Draft >= 10 cap cleanly rejects import before calling saveDraft and clears any stale draft-success banner
  const limitBlocked = await localSession.evaluate(`(async()=>{
    const repoMod=await import('/src/repositories/editorRevisionRepository.ts');
    const siteMod=await import('/src/data/default/site.ts');
    const snapMod=await import('/src/editor/editorSnapshot.ts');
    while((await repoMod.editorDraftRepository.countDrafts()) < 10){
      await repoMod.editorDraftRepository.saveDraft({
        snapshot:snapMod.createEditorSnapshot(siteMod.createDefaultSiteSnapshot()),
        mediaReferences:[],expectedBaseRevision:null,createNew:true
      });
    }
    const lastDraftId=(await repoMod.editorDraftRepository.listDrafts())[0]?.revision.id;
    document.querySelector('.validation-action-btn--primary').click();
    for(let i=0;i<60&&!document.querySelector('.validation-action-error');i+=1) await new Promise(r=>setTimeout(r,20));
    const blockedState={
      count:await repoMod.editorDraftRepository.countDrafts(),
      staleDraftBanner:Boolean(document.querySelector('.validation-action-status--draft')),
      error:document.querySelector('.validation-action-error')?.textContent?.trim()
    };
    if(lastDraftId) await repoMod.editorDraftRepository.discardDraft(lastDraftId);
    document.querySelector('.validation-action-btn--primary').click();
    for(let i=0;i<60&&!document.querySelector('.validation-action-status--draft');i+=1) await new Promise(r=>setTimeout(r,20));
    return {
      ...blockedState,
      recoveredErrorCleared:!document.querySelector('.validation-action-error'),
      recoveredDraftBanner:Boolean(document.querySelector('.validation-action-status--draft'))
    };
  })()`)
  assert(
    limitBlocked.count === 10
    && !limitBlocked.staleDraftBanner
    && /Maximum 10 Drafts/i.test(limitBlocked.error)
    && limitBlocked.recoveredErrorCleared
    && limitBlocked.recoveredDraftBanner,
    `Draft limit / banner-reset guard failed: ${JSON.stringify(limitBlocked)}`
  )

  // Verify Open Draft in Editor button routes cleanly with ?draft=<id>
  await localSession.evaluate(`document.querySelector('.validation-link-btn').click()`)
  await localSession.waitFor(`Boolean(document.querySelector('.edit-page'))`)
  const openedDraftTitle = await localSession.evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor').draftSnapshot.content.portfolio.title`)
  assert(openedDraftTitle === 'BACKUP RESTORED PORTFOLIO', `Open Draft in Editor loaded wrong snapshot: ${openedDraftTitle}`)

  const localUnhandled = await localSession.evaluate(`globalThis.__f15Unhandled`)
  assert(localUnhandled.length === 0 && localSession.runtimeErrors.length === 0, `Local errors: ${JSON.stringify({ localUnhandled, runtimeErrors: localSession.runtimeErrors })}`)
  localEvidence = { presetUiBefore, presetAfterDelete, maintInitial, stagedOutcome: { draftsBefore: stagedOutcome.draftsBefore, draftsAfterValidation: stagedOutcome.draftsAfterValidation }, designRestored, draftImported, limitBlocked }
} finally {
  await localSession.close()
}

// =========================================================================
// PART 2 (CLOUD): Mock Supabase PostgREST + Storage Server for Option 2A Sync & Option 1B Media Preflight
// =========================================================================
const cloudState = {
  missingTableMode: false,
  storageHeadOk: true,
  workspaceRow: null,
  postCalls: 0,
  getCalls: 0,
  saveRpcCalls: 0,
  storageChecks: []
}

function defaultSeedWorkspace(name = 'Cloud Seed Rose', primary = '#992244') {
  return {
    version: 1,
    themes: [{
      id: 'cloud-theme-1',
      name,
      tokens: {
        'color-primary': primary,
        'color-secondary': '#b85b69',
        'color-accent': '#d97706',
        'color-success': '#3d6f54',
        'color-warning': '#c47f1d',
        'color-danger': '#d62828',
        'color-background': '#f6f4e8',
        'color-surface': '#fbf7ef',
        'color-border': '#dfd1c7',
        'color-text-primary': '#49362f',
        'color-text-secondary': '#80685e',
        'color-heading': '#8d363a',
        'color-link': '#9b4f5b',
        'font-heading': 'Georgia, serif',
        'font-body': 'system-ui, sans-serif',
        'typography-scale': 1,
        'radius-global': '12px',
        'shadow-global': '0 10px 30px rgba(73, 54, 47, 0.12)',
        'spacing-global': '16px',
        'transition-global': 'ease',
        'duration-global': 220
      },
      typography: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }],
    activeThemeId: 'cloud-theme-1',
    previewThemeId: null,
    references: { theme: {}, sections: {}, components: {}, objects: {} },
    typographyAssignments: {},
    buttonAssignments: {},
    sectionTemplates: [],
    componentPresets: []
  }
}

cloudState.workspaceRow = {
  user_id: 'admin-f15-1',
  workspace: defaultSeedWorkspace('Cloud Sync Rose', '#992244'),
  updated_at: new Date().toISOString()
}

const mockServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, prefer, range'
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders)
    res.end()
    return
  }

  let bodyText = ''
  for await (const chunk of req) bodyText += chunk

  if (url.pathname.startsWith('/storage/v1/object/public/portfolio-media/')) {
    cloudState.storageChecks.push(`${req.method}:${url.pathname}`)
    if (!cloudState.storageHeadOk) {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' })
      res.end(req.method === 'HEAD' ? '' : JSON.stringify({ error: 'Object not found' }))
      return
    }
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'image/webp' })
    res.end(req.method === 'HEAD' ? '' : 'ok')
    return
  }

  if (url.pathname === '/rest/v1/admin_memberships') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify([{ user_id: 'admin-f15-1' }]))
    return
  }

  if (url.pathname === '/rest/v1/design_system_workspaces') {
    if (cloudState.missingTableMode) {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.design_system_workspaces' in the schema cache" }))
      return
    }
    if (req.method === 'GET') {
      cloudState.getCalls += 1
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
      res.end(JSON.stringify(cloudState.workspaceRow ? [cloudState.workspaceRow] : []))
      return
    }
    if (req.method === 'POST') {
      cloudState.postCalls += 1
      const parsed = JSON.parse(bodyText || '{}')
      cloudState.workspaceRow = { user_id: parsed.user_id, workspace: parsed.workspace, updated_at: new Date().toISOString() }
      res.writeHead(201, corsHeaders)
      res.end()
      return
    }
  }

  if (url.pathname === '/rest/v1/rpc/get_active_published_snapshot') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify([]))
    return
  }

  if (url.pathname === '/rest/v1/site_revisions') {
    if (url.search.includes('select=id')) {
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
      res.end(JSON.stringify([{ id: 'existing-draft-1' }]))
      return
    }
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify([]))
    return
  }

  if (url.pathname === '/rest/v1/editor_favorites' || url.pathname === '/rest/v1/certificates') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify([]))
    return
  }

  if (url.pathname === '/rest/v1/rpc/save_editor_draft') {
    cloudState.saveRpcCalls += 1
    const parsed = JSON.parse(bodyText || '{}')
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
    res.end(JSON.stringify([{
      id: 'cloud-imported-draft-id',
      revision_number: 42,
      lock_version: 1,
      status: 'draft',
      snapshot: parsed.p_snapshot,
      base_revision_number: parsed.p_expected_base_revision,
      created_by: 'admin-f15-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      published_at: null,
      source_draft_revision_id: null,
      published_by: null,
      publish_note: null,
      publication_kind: null,
      rollback_source_revision_id: null
    }]))
    return
  }

  res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
  res.end(JSON.stringify([]))
})

await new Promise((resolve) => mockServer.listen(0, '127.0.0.1', resolve))
const mockPort = mockServer.address().port
const cloudSession = await openBrowserSession(5189, 9359, {
  VITE_SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
  VITE_SUPABASE_PUBLISHABLE_KEY: 'mock-anon-key'
})

try {
  // Cold Laptop B opens /admin/edit with empty localStorage -> must pull Cloud Sync Rose cleanly WITHOUT POSTing default!
  await cloudSession.evaluate(`(async()=>{
    localStorage.clear();
    const rest=await import('/src/lib/supabaseRest.ts');
    rest.setSupabaseAccessToken('mock-admin-jwt');
    const auth=(await import('/src/stores/auth.ts')).useAuthStore();
    auth.$patch({isAdmin:true,isInitialized:true,isLoading:false,session:{access_token:'mock-admin-jwt',refresh_token:'r',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'admin-f15-1',email:'admin@test'}}});
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/admin/edit');
    return true;
  })()`)
  await cloudSession.waitFor(`Boolean(document.querySelector('.edit-page'))`)
  await cloudSession.waitFor(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem').cloudSynced === true`)

  const coldPull = await cloudSession.evaluate(`(()=>{
    const design=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem');
    const cached=JSON.parse(localStorage.getItem('portfolio-editor-design-system-v1')||'{}');
    return {
      activeTheme:design.activeTheme.name,
      primary:design.activeTheme.tokens['color-primary'],
      cachedTheme:cached.themes?.[0]?.name
    };
  })()`)
  assert(
    coldPull.activeTheme === 'Cloud Sync Rose'
    && coldPull.primary === '#992244'
    && coldPull.cachedTheme === 'Cloud Sync Rose'
    && cloudState.getCalls >= 1
    && cloudState.postCalls === 0,
    `Cold Cloud pull overwrote or failed: ${JSON.stringify({ coldPull, postCalls: cloudState.postCalls })}`
  )

  // Rapid 10x slider changes + panel close flush -> debounced & coalesced to ONE POST with last value
  await cloudSession.evaluate(`document.querySelector('.design-system-button').click()`)
  await cloudSession.waitFor(`Boolean(document.querySelector('.design-system-panel'))`)
  await cloudSession.evaluate(`(()=>{
    const design=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem');
    for(let i=0;i<9;i+=1) design.updateToken('cloud-theme-1','color-primary','#11111'+i);
    design.updateToken('cloud-theme-1','color-primary','#abcdef');
    return true;
  })()`)
  const postBeforeClose = cloudState.postCalls
  assert(postBeforeClose === 0, `Debouncer fired too early (${postBeforeClose} immediate POSTs)`)

  await cloudSession.evaluate(`document.querySelector('[aria-label="Close Design System"]').click()`)
  await cloudSession.waitFor(`!document.querySelector('.design-system-panel') && document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem').hasPendingCloudSave === false`)
  assert(
    cloudState.postCalls === 1 && cloudState.workspaceRow?.workspace?.themes?.[0]?.tokens?.['color-primary'] === '#abcdef',
    `Panel-close coalesced flush failed: postCalls=${cloudState.postCalls}, primary=${cloudState.workspaceRow?.workspace?.themes?.[0]?.tokens?.['color-primary']}`
  )

  // Cold Maintenance Export pulls Cloud Design System without visiting /admin/edit first
  await cloudSession.evaluate(`(async()=>{
    localStorage.clear();
    const design=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem');
    design.$reset();
    const router=(await import('/src/router/index.ts')).default;
    await router.push('/admin/maintenance');
    return true;
  })()`)
  await cloudSession.waitFor(`Boolean(document.querySelector('.maintenance-page'))`)
  const exportedColdBackup = await cloudSession.evaluate(`(async()=>{
    const mod=await import('/src/production/backup.ts');
    const b=await mod.createProductionBackup();
    return {themeName:b.activeTheme.name,primary:b.activeTheme.tokens['color-primary']};
  })()`)
  assert(exportedColdBackup.themeName === 'Cloud Sync Rose' && exportedColdBackup.primary === '#abcdef', `Cold export missed Cloud theme: ${JSON.stringify(exportedColdBackup)}`)

  // Storage pre-flight: 404 on missing Storage media MUST block rpc/save_editor_draft; 200 MUST succeed!
  cloudState.storageHeadOk = false
  const missingMediaErr = await cloudSession.evaluate(`(async()=>{
    const mod=await import('/src/production/backup.ts');
    const siteMod=await import('/src/data/default/site.ts');
    const snapMod=await import('/src/editor/editorSnapshot.ts');
    const snap=snapMod.createEditorSnapshot(siteMod.createDefaultSiteSnapshot());
    snap.media.references.push({assetId:'missing-pic',uri:'published/missing-pic.webp',bucket:'portfolio-media',storagePath:'published/missing-pic.webp',mimeType:'image/webp'});
    try { await mod.importBackupSnapshotAsDraft(snap); return 'NO_ERROR' }
    catch(e){ return e.message }
  })()`)
  assert(/missing-pic|404|not found/i.test(missingMediaErr) && cloudState.saveRpcCalls === 0, `Missing Storage asset was not blocked before RPC: ${missingMediaErr}, rpc=${cloudState.saveRpcCalls}`)

  cloudState.storageHeadOk = true
  const validMediaImport = await cloudSession.evaluate(`(async()=>{
    const mod=await import('/src/production/backup.ts');
    const siteMod=await import('/src/data/default/site.ts');
    const snapMod=await import('/src/editor/editorSnapshot.ts');
    const snap=snapMod.createEditorSnapshot(siteMod.createDefaultSiteSnapshot());
    snap.media.references.push({assetId:'ok-pic',uri:'published/ok-pic.webp',bucket:'portfolio-media',storagePath:'published/ok-pic.webp',mimeType:'image/webp'});
    return await mod.importBackupSnapshotAsDraft(snap);
  })()`)
  assert(validMediaImport.revisionNumber === 42 && cloudState.saveRpcCalls === 1, `Storage-verified draft import failed: ${JSON.stringify({ validMediaImport, saveRpcCalls: cloudState.saveRpcCalls })}`)

  // Missing SQL table 404/PGRST205 graceful fallback
  cloudState.missingTableMode = true
  const fallbackResult = await cloudSession.evaluate(`(async()=>{
    const design=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('designSystem');
    design.updateToken('cloud-theme-1','color-primary','#445566');
    const ok=await design.flushCloudSync();
    return {ok,syncState:design.syncState,localPrimary:JSON.parse(localStorage.getItem('portfolio-editor-design-system-v1')||'{}').themes?.[0]?.tokens?.['color-primary']};
  })()`)
  assert(!fallbackResult.ok && fallbackResult.syncState === 'local-only' && fallbackResult.localPrimary === '#445566', `Missing table fallback failed: ${JSON.stringify(fallbackResult)}`)

  const cloudUnhandled = await cloudSession.evaluate(`globalThis.__f15Unhandled`)
  assert(cloudUnhandled.length === 0, `Cloud test unhandled rejections: ${JSON.stringify(cloudUnhandled)}`)

  process.stdout.write(`${JSON.stringify({
    status: 'PASS',
    scope: 'Finding #15 Maintenance Staged Restore, Component Preset Delete, Cloud Sync & Failure Guards',
    local: localEvidence,
    cloud: { coldPull, exportedColdBackup, missingMediaErr, validMediaImport, fallbackResult, getCalls: cloudState.getCalls, postCalls: cloudState.postCalls, saveRpcCalls: cloudState.saveRpcCalls, storageChecks: cloudState.storageChecks },
    screenshots: [
      path.join(artifactDir, 'finding15-after-design-presets.png'),
      path.join(artifactDir, 'finding15-after-maintenance-desktop.png'),
      path.join(artifactDir, 'finding15-after-maintenance-mobile.png')
    ]
  }, null, 2)}\n`)
} finally {
  await cloudSession.close()
  mockServer.close()
}
