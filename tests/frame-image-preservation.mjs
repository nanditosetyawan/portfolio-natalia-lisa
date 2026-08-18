import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const cdpPort = process.env.CDP_PORT ?? '9237'
const pages = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('127.0.0.1:5173'))
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((done) => socket.addEventListener('open', done, { once: true }))
let sequence = 0
const pending = new Map()
const runtimeErrors = []
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (pending.has(message.id)) { pending.get(message.id)(message.result); pending.delete(message.id) }
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text)
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
})
const send = (method, params = {}) => new Promise((done) => { const id=++sequence; pending.set(id,done); socket.send(JSON.stringify({id,method,params})) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true })).result.value
const wait = (ms) => new Promise((done) => setTimeout(done, ms))
const assert = (condition, message) => { if (!condition) throw new Error(`Preservation failure: ${message}`) }

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await evaluate(`import('/src/repositories/certificateRepository.ts').then(({certificateRepository}) => certificateRepository.clear())`)
await send('Emulation.setDeviceMetricsOverride', { width:1422, height:804, deviceScaleFactor:1, mobile:false })
await evaluate(`location.hash='#/'`)
await send('Page.reload', { ignoreCache:true })
await wait(450)

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
for (const [name, selector] of [['about','#about'],['college','#college-section'],['shs','.shs-section'],['experience','#experience'],['certificate','#certificate']]) {
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
const structure = await evaluate(`({navbar:Boolean(document.querySelector('.guest-navbar')),collegeIds:document.querySelectorAll('#college-section').length,educationIds:document.querySelectorAll('#education').length,experienceCards:document.querySelectorAll('.exp-card').length,lenisRoots:document.querySelectorAll('html.lenis').length})`)

await evaluate(`document.querySelector('a[href="#experience"]')?.click()`)
await wait(1400)
const navbarNavigation = await evaluate(`Math.abs(document.querySelector('#experience').getBoundingClientRect().top) <= 2`)

await send('Emulation.setEmulatedMedia', { features:[{name:'prefers-reduced-motion',value:'reduce'}] })
await evaluate(`(() => { const college=document.querySelector('#college-section'); const top=college.getBoundingClientRect().top+scrollY; window.scrollTo(0,top-innerHeight*0.60) })()`)
await wait(100)
await send('Input.dispatchMouseEvent', { type:'mouseWheel', x:500, y:400, deltaX:0, deltaY:60 })
await wait(1400)
const reducedMotion = await evaluate(`({matches:matchMedia('(prefers-reduced-motion: reduce)').matches,collegeTop:document.querySelector('#college-section').getBoundingClientRect().top})`)
await send('Emulation.setEmulatedMedia', { features:[] })

await send('Emulation.setDeviceMetricsOverride', { width:390, height:844, deviceScaleFactor:1, mobile:true, screenWidth:390, screenHeight:844 })
await evaluate(`window.scrollTo(0,document.querySelector('#college-section').offsetTop-500)`)
await wait(100)
await evaluate(`window.__photoAreaTouchPrevented=[];window.addEventListener('touchmove',(event)=>window.__photoAreaTouchPrevented.push(event.defaultPrevented),{capture:true,once:true})`)
const touchBefore = await evaluate(`scrollY`)
await send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x:195,y:650}] })
await send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{x:195,y:250}] })
await send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] })
await wait(350)
const touchAfter = await evaluate(`scrollY`)
const touchPrevented = await evaluate(`window.__photoAreaTouchPrevented`)
await send('Emulation.clearDeviceMetricsOverride')

await send('Page.reload', { ignoreCache:true })
await wait(450)
const hardRefresh = await evaluate(`({images:document.querySelectorAll('.photo-area-image').length,placeholders:document.querySelectorAll('[data-photo-area-id] .image-boundary-placeholder,[data-photo-area-id] .placeholder,[data-photo-area-id] .cert-placeholder').length})`)

const experience = {before:experienceBefore,after:experienceAfter,changed:experienceBefore.transforms.some((value,index)=>value!==experienceAfter.transforms[index])&&experienceBefore.dot!==experienceAfter.dot}
const touch = {before:touchBefore,after:touchAfter,moved:touchAfter!==touchBefore,defaultPrevented:touchPrevented}
assert(configIsolation.refIndependent && configIsolation.mutationIndependent, 'About/College/SHS placeholder objects must be reference and mutation independent')
assert(configIsolation.certificateCount === 7 && configIsolation.certificateUnique === 7 && configIsolation.certificatePlaceholderIndependent, 'Certificate must expose seven independent photo and placeholder objects')
assert(structure.navbar && structure.collegeIds === 1 && structure.educationIds === 1 && structure.experienceCards === 4 && structure.lenisRoots === 1, 'navbar/anchors/Experience/Lenis DOM structure must be preserved')
assert(experience.before.height === experience.after.height && experience.before.height === 3216 && experience.changed, 'Experience must remain 400vh at 804px and keep its special scroll transforms/dot')
assert(navbarNavigation, 'programmatic navbar navigation must reach Experience anchor')
assert(reducedMotion.matches && reducedMotion.collegeTop > 100, 'reduced motion must bypass magnetic commit')
assert(touch.moved && touch.defaultPrevented.every((value) => value === false), 'mobile native touch must move and remain unprevented')
assert(hardRefresh.images === 0 && hardRefresh.placeholders === 12, 'hard refresh must document session-only state without claiming durable persistence')
assert(runtimeErrors.length === 0, 'console/runtime errors must be zero')
console.log(JSON.stringify({configIsolation,screenshots,structure,navbarNavigation,reducedMotion,experience,touch,hardRefresh,runtimeErrors}))
socket.close()
