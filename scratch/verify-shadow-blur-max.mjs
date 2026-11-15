import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const projectRoot = process.cwd();
const baseUrl = 'http://127.0.0.1:5195';
const cdpPort = 9355;
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-blur-test-'));

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

try {
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5195', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  });
  await waitForHttp(baseUrl);

  launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1600,1050', baseUrl
  ]);

  let page;
  const targetStarted = Date.now();
  while (!page && Date.now() - targetStarted < 15000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`);
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5195'));
    if (!page) await new Promise((r) => setTimeout(r, 100));
  }
  if (!page) throw new Error('Browser target not found.');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
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

  await send('Page.enable');
  await send('Runtime.enable');

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (result.exceptionDetails) {
      throw new Error(`Evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
    }
    return result.result.value;
  }

  // Wait for Vue and authenticate
  const appStarted = Date.now();
  while (Date.now() - appStarted < 15000) {
    const hasVue = await evaluate(`Boolean(document.querySelector('#app')?.__vue_app__)`);
    if (hasVue) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  await evaluate(`(async () => {
    const authModule = await import('/src/stores/auth.ts');
    const router = (await import('/src/router/index.ts')).default;
    const auth = authModule.useAuthStore();
    auth.$patch({ isAdmin: true, isInitialized: true, isLoading: false });
    await router.push({ name: 'admin-edit', query: { draft: 'new' } });
    return true;
  })()`);

  // Wait for editor ready
  const startWait = Date.now();
  while (Date.now() - startWait < 15000) {
    const ready = await evaluate(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log('Selecting smallest portfolio-hero...');
  await evaluate(`
    (async () => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');
      if (hero) hero.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 600));

  console.log('Ensuring Shadow is ON and inspecting Blur input attributes...');
  const initialBlurInfo = await evaluate(`
    (async () => {
      const fontToggle = document.querySelector('[data-property-category="font"] .accordion-toggle');
      if (fontToggle && fontToggle.getAttribute('aria-expanded') !== 'true') {
        fontToggle.click();
        await new Promise(r => setTimeout(r, 100));
      }
      const shadowField = document.querySelector('[data-property-key="font.shadow"]');
      if (!shadowField) return { error: 'Shadow field not found', bodyText: document.querySelector('.property-editor')?.innerText };
      const checkbox = shadowField.querySelector('input[type="checkbox"]');
      if (checkbox && !checkbox.checked) {
        checkbox.click();
        await new Promise(r => setTimeout(r, 100));
      }
      const blurInput = shadowField.querySelector('.shadow-grid label:nth-child(3) input');
      if (!blurInput) return { error: 'Blur input not found' };
      return {
        min: blurInput.getAttribute('min'),
        max: blurInput.getAttribute('max'),
        value: blurInput.value
      };
    })()
  `);
  console.log('Initial Blur Info:', initialBlurInfo);

  console.log('Test 1: Type 150 into Blur input...');
  const typed150 = await evaluate(`
    (async () => {
      const shadowField = document.querySelector('[data-property-key="font.shadow"]');
      const blurInput = shadowField.querySelector('.shadow-grid label:nth-child(3) input');
      blurInput.value = '150';
      blurInput.dispatchEvent(new Event('input', { bubbles: true }));
      blurInput.dispatchEvent(new Event('blur', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      return {
        inputValue: blurInput.value,
        blurAttrMax: blurInput.getAttribute('max')
      };
    })()
  `);
  console.log('Typed 150 result:', typed150);

  await new Promise((r) => setTimeout(r, 200));

  console.log('Test 2: Check snapshot textShadow blur value...');
  const snapshotShadow = await evaluate(`
    (() => {
      const app = document.querySelector('#app');
      const editorStore = app?.__vue_app__?.config?.globalProperties?.$pinia?.state?.value?.editor;
      const shadow = editorStore?.draftSnapshot?.typography?.['portfolio-hero']?.textShadow;
      return shadow;
    })()
  `);
  console.log('Snapshot textShadow:', snapshotShadow);

  console.log('Test 3: ArrowUp at 100...');
  const arrowUpRes = await evaluate(`
    (async () => {
      const shadowField = document.querySelector('[data-property-key="font.shadow"]');
      const blurInput = shadowField.querySelector('.shadow-grid label:nth-child(3) input');
      blurInput.focus();
      blurInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      return blurInput.value;
    })()
  `);
  console.log('ArrowUp at 100 result:', arrowUpRes);

  console.log('Test 4: Type 200 into Blur input...');
  const typed200 = await evaluate(`
    (async () => {
      const shadowField = document.querySelector('[data-property-key="font.shadow"]');
      const blurInput = shadowField.querySelector('.shadow-grid label:nth-child(3) input');
      blurInput.value = '200';
      blurInput.dispatchEvent(new Event('input', { bubbles: true }));
      blurInput.dispatchEvent(new Event('blur', { bubbles: true }));
      await new Promise(r => setTimeout(r, 100));
      return blurInput.value;
    })()
  `);
  console.log('Typed 200 result:', typed200);

  // Capture screenshot of inspector
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/inspector-shadow-blur-max100.png', Buffer.from(screenshotRes.data, 'base64'));
  console.log('Saved inspector-shadow-blur-max100.png');

  socket.close();
  stopChildren();
  await new Promise((r) => setTimeout(r, 500));
  try {
    await rm(profilePath, { recursive: true, force: true });
  } catch {}

  if (typed150.inputValue === '100' && snapshotShadow.includes('100px') && arrowUpRes === '100' && typed200 === '100' && initialBlurInfo.max === '100') {
    console.log('>>> ALL SHADOW BLUR MAX 100 TESTS PASSED CLEANLY! <<<');
    process.exit(0);
  } else {
    console.error('FAILED assertion', { typed150, snapshotShadow, arrowUpRes, typed200, initialBlurInfo });
    process.exit(1);
  }
} catch (error) {
  console.error(error);
  stopChildren();
  await new Promise((r) => setTimeout(r, 500));
  try {
    await rm(profilePath, { recursive: true, force: true });
  } catch {}
  process.exit(1);
}
