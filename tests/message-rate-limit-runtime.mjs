import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5204'
const cdpPort = 9364
const chromePath = [
  process.env.CHROME_PATH,
  'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].find((candidate) => candidate && existsSync(candidate))
if (!chromePath) throw new Error('No Chromium/Chrome/Edge executable found; set CHROME_PATH.')

const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-message-rate-limit-'))
const children = []
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms))
const assert = (condition, message) => { if (!condition) throw new Error(message) }

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try { if ((await fetch(url)).ok) return } catch {}
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForPageTarget(urlPart, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()
      const page = targets.find((target) => target.type === 'page' && target.url.includes(urlPart))
      if (page) return page
    } catch {}
    await wait(100)
  }
  throw new Error(`Timed out waiting for Chromium page target: ${urlPart}`)
}

function launch(command, args, options = {}) {
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options })
  children.push(child)
  return child
}

function stopChildren() {
  for (const child of children.reverse()) if (!child.killed) child.kill()
}

process.on('exit', stopChildren)
process.on('SIGINT', () => { stopChildren(); process.exit(130) })

let socket
try {
  const vite = launch(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5204', '--strictPort'],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: 'https://mock-supabase.local',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'mock-publishable-key',
        VITE_SUPABASE_ANON_KEY: 'mock-anon-key'
      }
    }
  )
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1280,900', 'about:blank'
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  const page = await waitForPageTarget('about:blank')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let sequence = 0
  const pending = new Map()
  const runtimeExceptions = []
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data)
    if (msg.id && pending.has(msg.id)) {
      const req = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? req.reject(new Error(msg.error.message)) : req.resolve(msg.result)
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      runtimeExceptions.push(msg.params?.exceptionDetails?.exception?.description ?? msg.params?.exceptionDetails?.text ?? 'Unknown exception')
    }
  })

  const send = (method, params = {}) => {
    const id = ++sequence
    socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
  }
  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)
    return res.result.value
  }
  const waitFor = async (conditionExpr, timeout = 12000) => {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(conditionExpr)) return
      await wait(70)
    }
    throw new Error(`Timed out waiting for: ${conditionExpr}`)
  }

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      (() => {
        if (window.__messageRateLimitMockInstalled) return;
        window.__messageRateLimitMockInstalled = true;
        window.__messageRateMode = 'ok';
        const origFetch = window.fetch.bind(window);
        window.fetch = async (input, init = {}) => {
          const url = typeof input === 'string' ? input : input.url;
          if (url.includes('/rest/v1/rpc/get_active_published_snapshot')) {
            return new Response(JSON.stringify(null), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (url.includes('/rest/v1/messages') && String(init.method ?? 'GET').toUpperCase() === 'POST') {
            if (window.__messageRateMode === 'ip_limit') {
              return new Response(JSON.stringify({ code: 'PT429', details: null, hint: null, message: "You have reached today's message limit. Please try again tomorrow." }), { status: 429, headers: { 'Content-Type': 'application/json' } });
            }
            if (window.__messageRateMode === 'global_limit') {
              return new Response(JSON.stringify({ code: 'PT429', details: null, hint: null, message: 'Too many messages received right now. Please try again later.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response('', { status: 201 });
          }
          return origFetch(input, init);
        };
      })();
    `
  })

  await send('Page.navigate', { url: `${baseUrl}/#/contact-detail` })
  await waitFor(`Boolean(document.querySelector('.message-form'))`)

  const submitForm = async (mode, messageText) => {
    await evaluate(`(() => {
      window.__messageRateMode = ${JSON.stringify(mode)};
      const setVal = (sel, val) => {
        const el = document.querySelector(sel);
        el.value = val;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      setVal('#name', 'Tester');
      setVal('#email', 'tester@example.com');
      setVal('#message', ${JSON.stringify(messageText)});
      document.querySelector('.message-form').requestSubmit();
    })()`)
    await waitFor(`!document.querySelector('.btn-submit').disabled && Boolean(document.querySelector('.success-alert'))`)
    return evaluate(`document.querySelector('.success-alert').textContent.trim()`)
  }

  const okText = await submitForm('ok', 'Hello message 1')
  assert(okText === 'Pesan berhasil terkirim!', `Unexpected success alert: ${okText}`)

  const ipLimitText = await submitForm('ip_limit', 'Blocked by IP')
  assert(ipLimitText === "You have reached today's message limit. Please try again tomorrow.", `Unexpected per-IP limit text: ${ipLimitText}`)

  const globalLimitText = await submitForm('global_limit', 'Blocked by global cap')
  assert(
    globalLimitText === 'Maaf, pengiriman pesan sedang dibatasi sementara. Silakan coba lagi nanti.' && !globalLimitText.includes('"PT429"'),
    `Unexpected global PT429 text: ${globalLimitText}`
  )

  assert(runtimeExceptions.length === 0, `Runtime exceptions: ${runtimeExceptions.join(' | ')}`)
  if (viteErrors.trim()) throw new Error(`Vite stderr: ${viteErrors}`)
  if (browserErrors.trim()) console.warn(browserErrors)
  console.log(JSON.stringify({ status: 'PASS', scope: 'message-rate-limit-runtime', okText, ipLimitText, globalLimitText }))
} finally {
  socket?.close()
  stopChildren()
  await rm(profilePath, { recursive: true, force: true }).catch(() => undefined)
}
