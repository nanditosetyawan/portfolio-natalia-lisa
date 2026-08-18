import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const pages = await (await fetch('http://127.0.0.1:9237/json')).json()
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('127.0.0.1:5173'))
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((done) => socket.addEventListener('open', done, { once: true }))
let sequence = 0
const pending = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (pending.has(message.id)) { pending.get(message.id)(message.result); pending.delete(message.id) }
})
const send = (method, params = {}) => new Promise((done) => { const id=++sequence; pending.set(id,done); socket.send(JSON.stringify({id,method,params})) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true })).result.value
const wait = (ms) => new Promise((done) => setTimeout(done, ms))

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width:1422, height:804, deviceScaleFactor:1, mobile:false })
await evaluate(`location.hash='#/'`)
await wait(300)

const configIsolation = await evaluate(`(async()=>{
  const [about,college,shs,cert]=await Promise.all([
    import('/src/data/default/visual/about.ts'), import('/src/data/default/visual/college.ts'),
    import('/src/data/default/visual/shs.ts'), import('/src/data/default/certificates.ts')]);
  const pairs=[
    [about.defaultAboutConfig.frameBack2Placeholder,about.defaultAboutConfig.frameMainPlaceholder],
    [college.defaultCollegeConfig.frameBackPlaceholder,college.defaultCollegeConfig.frameFrontPlaceholder],
    [shs.defaultSHSConfig.frameBackPlaceholder,shs.defaultSHSConfig.frameFrontPlaceholder]
  ];
  const refIndependent=pairs.every(([a,b])=>a!==b); const before=pairs.map(([,b])=>b.color);
  pairs.forEach(([a],i)=>a.color='#00000'+i); const mutationIndependent=pairs.every(([,b],i)=>b.color===before[i]);
  const photos=cert.defaultCertificates.cards.flatMap(card=>[card.thumbnail,...card.detailImages]);
  return {refIndependent,mutationIndependent,certificateCount:photos.length,certificateUnique:new Set(photos.map(p=>p.id)).size,
    certificatePlaceholderIndependent:new Set(photos.map(p=>p.placeholder)).size===photos.length};
})()`)

const screenshots = []
for (const [name, selector] of [['about','#about'],['college','#college'],['shs','.shs-section'],['experience','#experience'],['certificate','#certificate']]) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView()`)
  if (name === 'certificate') await evaluate(`document.querySelectorAll('.certificate-card:not(.is-expanded) .card-header').forEach(e=>e.click())`)
  await wait(550)
  const capture = await send('Page.captureScreenshot', { format:'png', fromSurface:true })
  const path = join(tmpdir(), `frame-image-remediation-009-${name}.png`)
  writeFileSync(path, Buffer.from(capture.data, 'base64'))
  screenshots.push(path)
}

await evaluate(`document.querySelector('#experience').scrollIntoView()`)
await wait(120)
const experienceBefore = await evaluate(`({transforms:[...document.querySelectorAll('.exp-card')].map(e=>getComputedStyle(e).transform),dot:document.querySelector('.tl-active-dot').getBoundingClientRect().top,height:document.querySelector('#experience').getBoundingClientRect().height})`)
await evaluate(`window.scrollTo(0, document.querySelector('#experience').offsetTop + 500)`)
await wait(180)
const experienceAfter = await evaluate(`({transforms:[...document.querySelectorAll('.exp-card')].map(e=>getComputedStyle(e).transform),dot:document.querySelector('.tl-active-dot').getBoundingClientRect().top,height:document.querySelector('#experience').getBoundingClientRect().height})`)
const structure = await evaluate(`({navbar:Boolean(document.querySelector('.guest-navbar')),collegeIds:document.querySelectorAll('#college').length,educationIds:document.querySelectorAll('#education').length,experienceCards:document.querySelectorAll('.exp-card').length,lenisRoots:document.querySelectorAll('html.lenis').length})`)

await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true, screenWidth:390, screenHeight:844 })
await evaluate(`window.scrollTo(0,document.querySelector('#college').offsetTop-500)`)
await wait(100)
const touchBefore = await evaluate(`scrollY`)
await send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:195,y:650}] })
await send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x:195,y:250}] })
await send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] })
await wait(350)
const touchAfter = await evaluate(`scrollY`)
await send('Emulation.clearDeviceMetricsOverride')

await send('Page.reload', { ignoreCache:true })
await wait(450)
const hardRefresh = await evaluate(`({images:document.querySelectorAll('.photo-area-image').length,placeholders:document.querySelectorAll('[data-photo-area-id] .image-boundary-placeholder,[data-photo-area-id] .placeholder,[data-photo-area-id] .cert-placeholder').length})`)

console.log(JSON.stringify({configIsolation,screenshots,structure,experience:{before:experienceBefore,after:experienceAfter,changed:experienceBefore.transforms.some((value,index)=>value!==experienceAfter.transforms[index])&&experienceBefore.dot!==experienceAfter.dot},touch:{before:touchBefore,after:touchAfter,moved:touchAfter!==touchBefore},hardRefresh}))
socket.close()
