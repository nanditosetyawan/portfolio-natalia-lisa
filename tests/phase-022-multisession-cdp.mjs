const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json()
const adminTarget = targets.find((item) => item.type === 'page' && item.url.includes('127.0.0.1:5174'))
if (!adminTarget) throw new Error('Admin page not found')
const ws = new WebSocket(adminTarget.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (event) => { const message = JSON.parse(event.data); const resolve = pending.get(message.id); if (resolve) { pending.delete(message.id); resolve(message) } })
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
function call(method, params = {}) { return new Promise((resolve, reject) => { const requestId = ++id; pending.set(requestId, (message) => message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result)); ws.send(JSON.stringify({ id: requestId, method, params })) }) }
async function evaluate(expression) { const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result?.value }
async function repo(expression) { return evaluate(`import('/src/repositories/siteRepository.ts').then(async({siteRepository})=>{${expression}})`) }

const a = { id:'e2e022-multi-a', order:0, label:'E2E Multi A', school:'E2E Multi A', period:'2026', description:'E2E Multi A', frameIds:{back:'e2e022-multi-a-back',front:'e2e022-multi-a-front'} }
const b = { id:'e2e022-multi-b', order:1, label:'E2E Multi B', school:'E2E Multi B', period:'2026', description:'E2E Multi B', frameIds:{back:'e2e022-multi-b-back',front:'e2e022-multi-b-front'} }
await repo(`await siteRepository.deleteCollege(${JSON.stringify(a.id)}).catch(()=>undefined); await siteRepository.deleteCollege(${JSON.stringify(b.id)}).catch(()=>undefined); await siteRepository.createCollege(${JSON.stringify(a)}); await siteRepository.createCollege(${JSON.stringify(b)}); await siteRepository.updateCollege(${JSON.stringify({...a,school:'E2E Multi A UPDATED'})})`)
await evaluate("window.open('http://127.0.0.1:5174/#/','_blank')")
await new Promise((resolve) => setTimeout(resolve, 1500))
const afterOpen = await (await fetch('http://127.0.0.1:9333/json/list')).json()
const guestTarget = afterOpen.find((item) => item.type === 'page' && item.url.includes('127.0.0.1:5174/#/') && item.id !== adminTarget.id)
if (!guestTarget) throw new Error('Second guest page was not opened')
const guestWs = new WebSocket(guestTarget.webSocketDebuggerUrl)
let guestId = 0
const guestPending = new Map()
guestWs.addEventListener('message', (event) => { const message = JSON.parse(event.data); const resolve = guestPending.get(message.id); if (resolve) { guestPending.delete(message.id); resolve(message) } })
await new Promise((resolve, reject) => { guestWs.addEventListener('open', resolve, { once: true }); guestWs.addEventListener('error', reject, { once: true }) })
function guestCall(method, params = {}) { return new Promise((resolve, reject) => { const requestId = ++guestId; guestPending.set(requestId, (message) => message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result)); guestWs.send(JSON.stringify({ id: requestId, method, params })) }) }
const guestValue = await new Promise(async (resolve, reject) => { try { const result = await guestCall('Runtime.evaluate', { expression:`(()=>{const pinia=document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia; const site=pinia?._s.get('site'); return site?.current?.content?.college?.items?.filter(x=>x.id.startsWith('e2e022-multi-')).map(x=>({id:x.id,school:x.school,order:x.order}))??[]})()`, awaitPromise:true, returnByValue:true }); resolve(result.result?.value) } catch (error) { reject(error) } })
await repo(`await siteRepository.deleteCollege(${JSON.stringify(a.id)}); await siteRepository.deleteCollege(${JSON.stringify(b.id)})`)
console.log(JSON.stringify({guestSession:guestValue,cleaned:true}, null, 2))
guestWs.close(); ws.close()
