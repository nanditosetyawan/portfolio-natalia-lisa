import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const projectRoot = process.cwd();
const baseUrl = 'http://127.0.0.1:5193';
const cdpPort = 9353;
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-no-editing-box-'));

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
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5193', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5193'));
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

  const hasContextBox = await evaluate(`Boolean(document.querySelector('.responsive-inspector-context'))`);
  console.log('Has .responsive-inspector-context:', hasContextBox);

  // Take screenshot of inspector
  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: 450, height: 750, scale: 1 }
  });
  fs.writeFileSync('C:/Users/VivoBook/.gemini/antigravity/brain/0b4608d3-4260-456b-99a3-1d6a6103c66e/inspector-no-editing-box.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved inspector-no-editing-box.png');

  if (hasContextBox) {
    throw new Error('.responsive-inspector-context is still present in DOM!');
  }
  console.log('VERIFICATION SUCCESSFUL: Box is completely gone!');
} finally {
  stopChildren();
  try { await rm(profilePath, { recursive: true, force: true }); } catch {}
}

