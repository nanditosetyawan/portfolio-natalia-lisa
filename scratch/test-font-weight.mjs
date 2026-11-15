import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const projectRoot = process.cwd();
const baseUrl = 'http://127.0.0.1:5196';
const cdpPort = 9356;
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-weight-test-'));

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
  launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5196', '--strictPort'], {
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
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5196'));
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

  console.log('Selecting portfolio-hero...');
  await evaluate(`
    (async () => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');
      if (hero) hero.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 600));

  const infoBefore = await evaluate(`
    (() => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');
      const cs = getComputedStyle(hero);
      return {
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        inlineFontWeight: hero.style.fontWeight
      };
    })()
  `);
  console.log('Info BEFORE changing weight:', infoBefore);

  console.log('Selecting Light (300) in Weight select...');
  const changeRes = await evaluate(`
    (async () => {
      const weightField = document.querySelector('[data-property-key="runtime.fontWeight"] select');
      if (!weightField) return { error: 'Weight select not found' };
      weightField.value = '300';
      weightField.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));

      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');
      const cs = getComputedStyle(hero);
      return {
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        inlineFontWeight: hero.style.fontWeight
      };
    })()
  `);
  console.log('Info AFTER changing weight to 300:', changeRes);

  console.log('Now testing changing font family to Georgia or Arial with weight 300 vs 700...');
  const testFonts = await evaluate(`
    (async () => {
      const smallest = (id) => [...document.querySelectorAll('[data-editor-object-id="' + id + '"]')].sort((a,b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
      const hero = smallest('portfolio-hero');

      // Test with Inter / Segoe UI / Arial / Georgia
      hero.style.fontFamily = 'Georgia, serif';
      hero.style.fontWeight = '400';
      const georgia400 = getComputedStyle(hero).fontWeight;
      hero.style.fontWeight = '700';
      const georgia700 = getComputedStyle(hero).fontWeight;

      hero.style.fontFamily = "'Arial Black', sans-serif";
      hero.style.fontWeight = '300';
      const arialBlack300 = getComputedStyle(hero).fontWeight;
      hero.style.fontWeight = '900';
      const arialBlack900 = getComputedStyle(hero).fontWeight;

      hero.style.fontFamily = "Impact, sans-serif";
      hero.style.fontWeight = '300';
      const impact300 = getComputedStyle(hero).fontWeight;

      return {
        georgia400,
        georgia700,
        arialBlack300,
        arialBlack900,
        impact300
      };
    })()
  `);
  console.log('Font test results:', testFonts);

  // Check what font family is set in the default snapshot for portfolio title
  const snapshotData = await evaluate(`
    (() => {
      const app = document.querySelector('#app');
      const editorStore = app?.__vue_app__?.config?.globalProperties?.$pinia?.state?.value?.editor;
      return {
        typography: editorStore?.draftSnapshot?.typography?.['portfolio-hero'],
        visualPortfolio: editorStore?.draftSnapshot?.visual?.portfolio?.title
      };
    })()
  `);
  console.log('Snapshot Data for portfolio-hero:', snapshotData);

  socket.close();
  stopChildren();
  await rm(profilePath, { recursive: true, force: true });
} catch (error) {
  console.error(error);
  stopChildren();
  await rm(profilePath, { recursive: true, force: true });
}
