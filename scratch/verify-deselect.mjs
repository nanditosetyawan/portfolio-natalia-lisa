import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const projectRoot = process.cwd();
const baseUrl = 'http://127.0.0.1:5192';
const cdpPort = 9352;
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-deselect-test-'));

const children = [];
function launch(command, args, options = {}) {
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
  children.push(child);
  return child;
}

function stopChildren() {
  for (const child of children.reverse()) if (!child.killed) child.kill();
}
process.on('exit', stopChildren);

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForJson(url, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

let socket;
try {
  console.log('Starting dedicated test Vite on 5192...');
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5192', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  });
  await waitForHttp(baseUrl);

  console.log('Starting Chrome...');
  launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1600,1050', baseUrl
  ]);

  let page;
  const targetStarted = Date.now();
  while (!page && Date.now() - targetStarted < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`);
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5192'));
    if (!page) await new Promise((r) => setTimeout(r, 100));
  }
  if (!page) throw new Error('Browser target not found.');

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
    }
  });

  function send(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result.value;
  }

  async function waitFor(expression, timeout = 20000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return;
      await new Promise((r) => setTimeout(r, 70));
    }
    throw new Error(`Timed out: ${expression}`);
  }

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false });

  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`);

  console.log('Navigating to admin/edit...');
  await evaluate(`(async () => {
    const auth = (await import('/src/stores/auth.ts')).useAuthStore();
    const router = (await import('/src/router/index.ts')).default;
    auth.$patch({ isAdmin: true, isInitialized: true, isLoading: false });
    await router.push('/admin/edit');
    return true;
  })()`);

  console.log('Waiting for .edit-page and canvas...');
  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`);

  console.log('Step 1: Selecting portfolio-hero...');
  const selectResult = await evaluate(`(async () => {
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const hero = document.querySelector('[data-editor-object-id="portfolio-hero"]');
    hero.click();
    await tick();
    const app = document.querySelector('#app').__vue_app__;
    const editor = app.config.globalProperties.$pinia._s.get('editor');
    return {
      selectedObjectId: editor.selectedObjectId,
      selectedCount: editor.selectedObjectIds.length,
      heroHasOutline: hero.classList.contains('editor-preview-selected'),
      totalOutlineElements: document.querySelectorAll('.editor-preview-selected').length
    };
  })()`);
  console.log('Selected status:', selectResult);

  // Take screenshot with frame
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/editor-selected-with-frame.png', Buffer.from(shot1.data, 'base64'));
  console.log('Saved editor-selected-with-frame.png');

  // Step 2: Click on empty section background inside previewRuntime
  console.log('Step 2: Clicking empty section background inside previewRuntime...');
  const deselectSectionResult = await evaluate(`(async () => {
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const runtime = document.querySelector('.editor-preview-runtime');
    runtime.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    await tick();
    const app = document.querySelector('#app').__vue_app__;
    const editor = app.config.globalProperties.$pinia._s.get('editor');
    const hero = document.querySelector('[data-editor-object-id="portfolio-hero"]');
    return {
      selectedObjectId: editor.selectedObjectId,
      selectedCount: editor.selectedObjectIds.length,
      heroHasOutline: hero.classList.contains('editor-preview-selected'),
      totalOutlineElements: document.querySelectorAll('.editor-preview-selected').length,
      statusBarSelection: document.querySelector('.editor-status-bar')?.innerText.split('\\n')[0]
    };
  })()`);
  console.log('Deselected by section background click:', deselectSectionResult);

  // Take screenshot without frame
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/editor-deselected-empty-bg.png', Buffer.from(shot2.data, 'base64'));
  console.log('Saved editor-deselected-empty-bg.png');

  // Step 3: Reselect element, then click outer canvas background (canvas-scroll)
  console.log('Step 3: Reselect element, then click outer canvas background...');
  await evaluate(`(async () => {
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const hero = document.querySelector('[data-editor-object-id="portfolio-hero"]');
    hero.click();
    await tick();
  })()`);

  const deselectCanvasResult = await evaluate(`(async () => {
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector('.canvas-scroll');
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    await tick();
    const app = document.querySelector('#app').__vue_app__;
    const editor = app.config.globalProperties.$pinia._s.get('editor');
    return {
      selectedObjectId: editor.selectedObjectId,
      selectedCount: editor.selectedObjectIds.length,
      totalOutlineElements: document.querySelectorAll('.editor-preview-selected').length
    };
  })()`);
  console.log('Deselected by outer canvas click:', deselectCanvasResult);

  // Step 4: Verify clicking inside Inspector does NOT deselect
  console.log('Step 4: Select element and verify clicking inside Inspector does NOT deselect...');
  await evaluate(`(async () => {
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const hero = document.querySelector('[data-editor-object-id="portfolio-hero"]');
    hero.click();
    await tick();
  })()`);

  const inspectorClickResult = await evaluate(`(async () => {
    const tick = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const inspector = document.querySelector('.property-editor') || document.querySelector('aside');
    const input = inspector.querySelector('input') || inspector;
    input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    await tick();
    const app = document.querySelector('#app').__vue_app__;
    const editor = app.config.globalProperties.$pinia._s.get('editor');
    return {
      selectedObjectId: editor.selectedObjectId,
      selectedCount: editor.selectedObjectIds.length,
      totalOutlineElements: document.querySelectorAll('.editor-preview-selected').length
    };
  })()`);
  console.log('Inspector click result (should still be selected):', inspectorClickResult);

  if (deselectSectionResult.selectedObjectId !== '' || deselectSectionResult.totalOutlineElements !== 0) {
    throw new Error('Deselect by section background failed!');
  }
  if (deselectCanvasResult.selectedObjectId !== '' || deselectCanvasResult.totalOutlineElements !== 0) {
    throw new Error('Deselect by outer canvas click failed!');
  }
  if (inspectorClickResult.selectedObjectId !== 'portfolio-hero' || inspectorClickResult.totalOutlineElements !== 1) {
    throw new Error('Inspector click falsely deselected!');
  }

  console.log('\n>>> SUCCESS! All deselect requirements verified cleanly! <<<');
} finally {
  stopChildren();
  try { await rm(profilePath, { recursive: true, force: true }); } catch {}
}
