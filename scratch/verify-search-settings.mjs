import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const projectRoot = process.cwd();
const baseUrl = 'http://127.0.0.1:5194';
const cdpPort = 9354;
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-search-test-'));

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
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5194', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5194'));
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

  await evaluate(`(async () => {
    const auth = (await import('/src/stores/auth.ts')).useAuthStore();
    const router = (await import('/src/router/index.ts')).default;
    auth.$patch({ isAdmin: true, isInitialized: true, isLoading: false });
    await router.push('/admin/edit');
    return true;
  })()`);

  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`);

  console.log('Selecting portfolio-hero...');
  await evaluate(`(() => {
    document.querySelector('[data-editor-object-id="portfolio-hero"]').click();
  })()`);
  await new Promise((r) => setTimeout(r, 300));

  // Test 1: Search "color"
  console.log('Test 1: Search "color"...');
  const searchColorRes = await evaluate(`(async () => {
    const input = document.querySelector('[data-property-search]');
    input.value = 'color';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));

    const visibleFields = [...document.querySelectorAll('.property-field:not(.property-field--disabled)')].map(el => el.querySelector('span')?.textContent?.trim());
    const badge = document.querySelector('.search-match-badge')?.textContent?.trim();
    const hasMatchClass = Boolean(document.querySelector('.property-field--match'));
    const clearBtn = Boolean(document.querySelector('.search-clear-button'));
    return { visibleFields, badge, hasMatchClass, clearBtn };
  })()`);
  console.log('Search "color" result:', searchColorRes);

  const shot1 = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: 450, height: 750, scale: 1 }
  });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/inspector-search-color.png', Buffer.from(shot1.data, 'base64'));
  console.log('Saved inspector-search-color.png');

  // Test 2: Search Indonesian "bayangan" (shadow)
  console.log('Test 2: Search Indonesian "bayangan"...');
  const searchBayanganRes = await evaluate(`(async () => {
    const input = document.querySelector('[data-property-search]');
    input.value = 'bayangan';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 100));

    const visibleFields = [...document.querySelectorAll('.property-field')].map(el => el.querySelector('span')?.textContent?.trim());
    const badge = document.querySelector('.search-match-badge')?.textContent?.trim();
    const hasMatchClass = Boolean(document.querySelector('.property-field--match'));
    return { visibleFields, badge, hasMatchClass };
  })()`);
  console.log('Search "bayangan" result:', searchBayanganRes);

  const shot2 = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: 450, height: 750, scale: 1 }
  });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/inspector-search-bayangan.png', Buffer.from(shot2.data, 'base64'));
  console.log('Saved inspector-search-bayangan.png');

  // Test 3: Clear search
  console.log('Test 3: Click clear button...');
  const clearRes = await evaluate(`(async () => {
    const clearBtn = document.querySelector('.search-clear-button');
    if (clearBtn) clearBtn.click();
    await new Promise((r) => setTimeout(r, 100));

    const visibleFields = [...document.querySelectorAll('.property-field')].map(el => el.querySelector('span')?.textContent?.trim());
    const badge = Boolean(document.querySelector('.search-match-badge'));
    return { totalVisible: visibleFields.length, hasBadge: badge };
  })()`);
  console.log('Clear result:', clearRes);

  const shot3 = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: 450, height: 750, scale: 1 }
  });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/inspector-search-cleared.png', Buffer.from(shot3.data, 'base64'));
  console.log('Saved inspector-search-cleared.png');

  if (!searchColorRes.hasMatchClass || !searchColorRes.clearBtn) {
    throw new Error('Search "color" failed verification!');
  }
  if (!searchBayanganRes.hasMatchClass) {
    throw new Error('Search "bayangan" failed verification!');
  }
  if (clearRes.totalVisible < 5 || clearRes.hasBadge) {
    throw new Error('Clear search failed verification!');
  }

  console.log('\n>>> ALL SEARCH SETTINGS TESTS PASSED CLEANLY! <<<');
} finally {
  stopChildren();
  try { await rm(profilePath, { recursive: true, force: true }); } catch {}
}
