import fs from 'node:fs'

const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json()
const target = targets.find((item) => item.type === 'page' && item.url.includes('127.0.0.1:5174'))
if (!target) throw new Error('Authenticated Vite page was not found on isolated CDP')

const socket = new WebSocket(target.webSocketDebuggerUrl)
let sequence = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  const resolver = pending.get(message.id)
  if (resolver) { pending.delete(message.id); resolver(message) }
})
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, (message) => message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result))
    socket.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'Browser evaluation failed')
  if (result.result?.subtype === 'error') throw new Error(result.result.description ?? result.result.value?.message ?? 'Browser evaluation failed')
  return result.result?.value
}

async function wait(ms = 700) { await new Promise((resolve) => setTimeout(resolve, ms)) }
async function reload() { await evaluate('location.reload()'); await wait(1200) }
async function guestSnapshot() {
  await evaluate("location.hash='#/'")
  await wait(1200)
  return evaluate(`(()=>{const pinia=document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia; const site=pinia?._s.get('site'); return {college:site?.current?.content?.college?.items?.map(x=>({id:x.id,school:x.school,order:x.order}))??[],shs:site?.current?.content?.shs?.items?.map(x=>({id:x.id,school:x.school,order:x.order}))??[],experience:site?.current?.content?.experience?.items?.map(x=>({id:x.id,title:x.title,order:x.order}))??[]}})()`)
}

const result = { auth: null, college: {}, shs: {}, experience: {}, certificate: {}, storage: null }
result.auth = await evaluate(`(()=>{const pinia=document.querySelector('#app')?.__vue_app__?.config.globalProperties.$pinia; const auth=pinia?._s.get('auth'); return {url:location.href,authenticated:Boolean(auth?.session?.access_token),isAdmin:Boolean(auth?.isAdmin),userId:auth?.session?.user?.id??null}})()`)
if (!result.auth.authenticated || !result.auth.isAdmin) throw new Error(`Isolated browser is not authorized Admin: ${JSON.stringify(result.auth)}`)

const collegeA = { id:'e2e022-college-a', order:0, label:'E2E College A', school:'E2E College A', period:'2022', description:'E2E College A', frameIds:{back:'e2e022-college-a-back',front:'e2e022-college-a-front'} }
const collegeB = { id:'e2e022-college-b', order:1, label:'E2E College B', school:'E2E College B', period:'2023', description:'E2E College B', frameIds:{back:'e2e022-college-b-back',front:'e2e022-college-b-front'} }
const shsA = { id:'e2e022-shs-a', order:0, label:'E2E SHS A', school:'E2E SHS A', period:'2018', description:'E2E SHS A', frameIds:{back:'e2e022-shs-a-back',front:'e2e022-shs-a-front'} }
const shsB = { id:'e2e022-shs-b', order:1, label:'E2E SHS B', school:'E2E SHS B', period:'2019', description:'E2E SHS B', frameIds:{back:'e2e022-shs-b-back',front:'e2e022-shs-b-front'} }
const experienceA = { id:'e2e022-experience-a', order:0, frameId:'e2e022-experience-a-frame', title:'E2E Experience A', date:'2024', description:'E2E Experience A', layout:'layout-text-left' }
const experienceB = { id:'e2e022-experience-b', order:1, frameId:'e2e022-experience-b-frame', title:'E2E Experience B', date:'2025', description:'E2E Experience B', layout:'layout-img-left' }
const certificateA = { id:'e2e022-certificate-a', order:0, title:'E2E Certificate A', date:'2024', description:'E2E Certificate A', active:true, thumbnail:{id:'e2e022-certificate-a-thumb',source:'',placeholder:{label:'E2E A',hint:'E2E',color:'#999',opacity:1},image:{objectPosition:'center center'}},detailImages:[] }
const certificateB = { id:'e2e022-certificate-b', order:1, title:'E2E Certificate B', date:'2025', description:'E2E Certificate B', active:true, thumbnail:{id:'e2e022-certificate-b-thumb',source:'',placeholder:{label:'E2E B',hint:'E2E',color:'#999',opacity:1},image:{objectPosition:'center center'}},detailImages:[] }

async function siteCall(code) { return evaluate(`import('/src/repositories/siteRepository.ts').then(async({siteRepository})=>{${code}})`) }
async function certCall(code) { return evaluate(`import('/src/repositories/certificateRepository.ts').then(async({certificateRepository})=>{${code}})`) }
async function siteLoad() { return siteCall('return await siteRepository.load()') }
async function certList() { return certCall('return await certificateRepository.list()') }

for (const [method, ids] of [
  ['deleteCollege', ['e2e022-college-a', 'e2e022-college-b']],
  ['deleteShs', ['e2e022-shs-a', 'e2e022-shs-b']],
  ['deleteExperience', ['e2e022-experience-a', 'e2e022-experience-b']]
]) {
  for (const id of ids) await siteCall(`await siteRepository.${method}(${JSON.stringify(id)}).catch(()=>undefined)`)
}
for (const id of ['e2e022-certificate-a', 'e2e022-certificate-b']) await certCall(`await certificateRepository.delete(${JSON.stringify(id)}).catch(()=>undefined)`)

for (const [name, a, b, create, update, reorder, remove, load, pick] of [
  ['college', collegeA, collegeB, 'createCollege', 'updateCollege', 'reorderCollege', 'deleteCollege', 'content.college.items', 'school'],
  ['shs', shsA, shsB, 'createShs', 'updateShs', 'reorderShs', 'deleteShs', 'content.shs.items', 'school'],
  ['experience', experienceA, experienceB, 'createExperience', 'updateExperience', 'reorderExperience', 'deleteExperience', 'content.experience.items', 'title']
]) {
  result[name].create = await siteCall(`await siteRepository.${create}(${JSON.stringify(a)}); await siteRepository.${create}(${JSON.stringify(b)}); return await siteRepository.load()`)
  const created = await siteLoad()
  result[name].createdIds = created.content[name === 'experience' ? 'experience' : name].items.filter(x=>x.id.startsWith('e2e022-')).map(x=>x.id)
  const changed = {...a, [pick]: `E2E ${name.toUpperCase()} A UPDATED`}
  await siteCall(`await siteRepository.${update}(${JSON.stringify(changed)})`)
  const updated = await siteLoad()
  result[name].updated = updated.content[name === 'experience' ? 'experience' : name].items.find(x=>x.id===a.id)
  await siteCall(`await siteRepository.${reorder}([${JSON.stringify(b.id)},${JSON.stringify(a.id)}])`)
  const reordered = await siteLoad()
  result[name].reordered = reordered.content[name === 'experience' ? 'experience' : name].items.filter(x=>x.id.startsWith('e2e022-')).map(x=>({id:x.id,order:x.order}))
  await reload()
  result[name].afterRefresh = await siteLoad().then(snapshot=>snapshot.content[name === 'experience' ? 'experience' : name].items.filter(x=>x.id.startsWith('e2e022-')).map(x=>({id:x.id,value:x[pick],order:x.order})))
  result[name].guest = await guestSnapshot()
  await siteCall(`await siteRepository.${remove}(${JSON.stringify(a.id)})`)
  const sibling = await siteLoad()
  result[name].siblingAfterDelete = sibling.content[name === 'experience' ? 'experience' : name].items.find(x=>x.id===b.id)
  await siteCall(`await siteRepository.${remove}(${JSON.stringify(b.id)})`)
}

result.certificate.create = await certCall(`await certificateRepository.put(${JSON.stringify(certificateA)}); await certificateRepository.put(${JSON.stringify(certificateB)}); return await certificateRepository.list()`)
result.certificate.created = (await certList()).filter(x=>x.id.startsWith('e2e022-')).map(x=>({id:x.id,order:x.order}))
await certCall(`await certificateRepository.put(${JSON.stringify({...certificateA,title:'E2E Certificate A UPDATED'})})`)
result.certificate.updated = (await certList()).find(x=>x.id===certificateA.id)
await certCall(`await certificateRepository.reorder([${JSON.stringify(certificateB.id)},${JSON.stringify(certificateA.id)}])`)
result.certificate.reordered = (await certList()).filter(x=>x.id.startsWith('e2e022-')).map(x=>({id:x.id,order:x.order}))
await reload()
result.certificate.afterRefresh = (await certList()).filter(x=>x.id.startsWith('e2e022-')).map(x=>({id:x.id,title:x.title,order:x.order}))
await certCall(`await certificateRepository.delete(${JSON.stringify(certificateA.id)}); await certificateRepository.delete(${JSON.stringify(certificateB.id)})`)
result.certificate.cleaned = (await certList()).filter(x=>x.id.startsWith('e2e022-'))

result.storage = await evaluate(`import('/src/lib/supabaseClient.ts').then(async({supabaseClient})=>{const {data,error}=await supabaseClient.storage.listBuckets(); return {buckets:data?.map(x=>({id:x.id,name:x.name,public:x.public}))??[],error:error?.message??null}})`)
fs.writeFileSync('tests/phase-022-cdp-result.json', JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
socket.close()
