import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function findChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Chrome executable not found');
}

const chromePath = findChromePath();
const port = 5198;
const cdpPort = 9448;
const baseUrl = `http://127.0.0.1:${port}`;
const profilePath = path.join(process.env.TEMP || '.', `verify-box-paragraf-${Date.now()}`);

const childProcesses = [];
function launch(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'pipe', ...options });
  childProcesses.push(child);
  return child;
}

function cleanup() {
  for (const child of childProcesses) {
    try { child.kill('SIGKILL'); } catch {}
  }
  try { fs.rmSync(profilePath, { recursive: true, force: true }); } catch {}
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

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
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: process.cwd(),
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
    page = targets.find((target) => target.type === 'page' && target.url.includes(String(port)));
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

  // Wait for Vue
  const appStarted = Date.now();
  while (Date.now() - appStarted < 15000) {
    const hasVue = await evaluate(`Boolean(document.querySelector('#app')?.__vue_app__)`);
    if (hasVue) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  // Authenticate and navigate to AdminEdit
  await evaluate(`(async () => {
    const authModule = await import('/src/stores/auth.ts');
    const router = (await import('/src/router/index.ts')).default;
    const auth = authModule.useAuthStore();
    auth.$patch({ isAdmin: true, isInitialized: true, isLoading: false });
    await router.push({ name: 'admin-edit', query: { draft: 'new' } });
  })()`);

  // Wait for editor to mount
  const editorStarted = Date.now();
  while (Date.now() - editorStarted < 15000) {
    const ready = await evaluate(`Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 150));
  }

  // Select 'portfolio-hero' and open BOX PARAGRAF accordion
  const info = await evaluate(`(async () => {
    const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    const hero = smallest('portfolio-hero');
    hero.click();
    await new Promise(r => setTimeout(r, 120));

    const editor = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    // Open layout / box paragraf
    editor.setAccordion('layout');
    await new Promise(r => setTimeout(r, 120));

    const boxGroup = document.querySelector('.property-group[data-property-category="layout"]');
    const boxNav = [...document.querySelectorAll('.inspector-category-nav button')].find(b => b.textContent.trim().includes('BOX PARAGRAF'));
    const toggleLabel = boxGroup?.querySelector('.accordion-toggle span:first-child')?.textContent?.trim();

    boxGroup?.scrollIntoView({ block: 'center' });

    return {
      selectedId: editor.selectedObjectId,
      activeAccordion: editor.activeAccordion,
      navLabel: boxNav?.textContent?.trim(),
      toggleLabel
    };
  })()`);

  console.log('BOX PARAGRAF result:', JSON.stringify(info, null, 2));

  await new Promise(r => setTimeout(r, 200));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const artifactPath = 'C:\\Users\\VivoBook\\.gemini\\antigravity\\brain\\0b4608d3-4260-456b-99a3-1d6a6103c66e\\inspector-box-paragraf.png';
  fs.writeFileSync(artifactPath, Buffer.from(screenshot.data, 'base64'));
  console.log('Saved screenshot to:', artifactPath);

  cleanup();
  process.exit(0);
} catch (err) {
  console.error(err);
  cleanup();
  process.exit(1);
}
