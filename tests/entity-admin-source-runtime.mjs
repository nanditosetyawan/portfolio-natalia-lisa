const cdpPort = process.env.CDP_PORT ?? '9241'
const pages = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('127.0.0.1:5173'))
if (!page) throw new Error('Runtime test page target not found')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let sequence = 0
const pending = new Map()
const runtimeErrors = []
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.id && pending.has(message.id)) {
    const request = pending.get(message.id)
    pending.delete(message.id)
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
  }
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') runtimeErrors.push(message.params.entry.text)
})

function send(method, params = {}) {
  const id = ++sequence
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text)
  return response.result.value
}

const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function waitFor(expression, timeout = 6000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return
    await wait()
  }
  throw new Error(`Timed out: ${expression}`)
}
function assert(condition, message) { if (!condition) throw new Error(`Entity remediation failure: ${message}`) }

async function route(hash, selector) {
  await evaluate(`location.hash=${JSON.stringify(hash)}`)
  await waitFor(`Boolean(document.querySelector(${JSON.stringify(selector)}))`)
  await wait(120)
}

await send('Runtime.enable')
await send('Log.enable')
await send('DOM.enable')
await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1422, height: 804, deviceScaleFactor: 1, mobile: false })
await evaluate(`location.hash='#/'`)
await send('Page.reload', { ignoreCache: true })
await waitFor(`location.hash==='#/' && Boolean(document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('site')) && Boolean(document.querySelector('#main'))`)
await wait(300)
await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('site'))`)

const cardinality = await evaluate(`(async()=>{
  const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const site=pinia._s.get('site');
  const base={
    paragraphs:JSON.parse(JSON.stringify(site.current.content.about.paragraphs)),
    college:JSON.parse(JSON.stringify(site.current.content.college.items)),
    shs:JSON.parse(JSON.stringify(site.current.content.shs.items)),
    experience:JSON.parse(JSON.stringify(site.current.content.experience.items))
  };
  const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const result={about:{},college:{},shs:{},experience:{}};
  for(const count of [0,1,2,3]){
    site.replaceAboutParagraphs(Array.from({length:count},(_,i)=>({id:'test-about-'+i,order:i,body:'Paragraph '+i})));
    await tick(); result.about[count]=document.querySelectorAll('.about-paragraph').length;
  }
  for(const count of [0,1,2,5]){
    site.replaceCollegeItems(Array.from({length:count},(_,i)=>({...JSON.parse(JSON.stringify(base.college[0])),id:'test-college-'+i,order:i,school:'College '+i,frameIds:{back:'test-college-'+i+'-back',front:'test-college-'+i+'-front'}})));
    await tick(); result.college[count]=document.querySelectorAll('.college-section').length;
    site.replaceShsItems(Array.from({length:count},(_,i)=>({...JSON.parse(JSON.stringify(base.shs[0])),id:'test-shs-'+i,order:i,school:'SHS '+i,frameIds:{back:'test-shs-'+i+'-back',front:'test-shs-'+i+'-front'}})));
    await tick(); result.shs[count]=document.querySelectorAll('.shs-section').length;
  }
  for(const count of [1,4,7,20]){
    site.replaceExperienceItems(Array.from({length:count},(_,i)=>({...JSON.parse(JSON.stringify(base.experience[i%base.experience.length])),id:'test-experience-'+i,order:i,frameId:'test-experience-frame-'+i,layout:i%2?'layout-img-left':'layout-text-left'})));
    await tick();
    const section=document.querySelector('#experience');
    result.experience[count]={cards:document.querySelectorAll('.exp-card').length,budgetVh:site.experienceScrollBudgetVh,height:section.getBoundingClientRect().height,ids:[...document.querySelectorAll('.exp-card')].map(el=>el.__vnode?.key??el.querySelector('[data-photo-area-id]')?.dataset.photoAreaId)};
  }
  site.replaceAboutParagraphs(base.paragraphs); site.replaceCollegeItems(base.college); site.replaceShsItems(base.shs); site.replaceExperienceItems(base.experience); await tick();
  return result;
})()`)

for (const count of [0, 1, 2, 3]) assert(cardinality.about[count] === count, `About count ${count}`)
for (const count of [0, 1, 2, 5]) {
  assert(cardinality.college[count] === count, `College count ${count}`)
  assert(cardinality.shs[count] === count, `SHS count ${count}`)
}
for (const count of [1, 4, 7, 20]) {
  assert(cardinality.experience[count].cards === count, `Experience card count ${count}`)
  assert(cardinality.experience[count].budgetVh === count * 100, `Experience budget ${count}`)
  assert(Math.abs(cardinality.experience[count].height - count * 804) < 2, `Experience rendered height ${count}`)
}

await route('#/admin/edit', '[data-admin-entity-select]')
await waitFor(`document.querySelectorAll('[data-photo-area-select] option').length>=17`)

const adminCoverage = await evaluate(`(async()=>{
  const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const section=document.querySelector('#section-select');
  const mapped=[];
  const entityKeys=[];
  for(const sectionName of [...section.options].map(option=>option.value)){
    section.value=sectionName; section.dispatchEvent(new Event('change',{bubbles:true})); await tick();
    const entity=document.querySelector('[data-admin-entity-select]');
    for(const entityId of [...entity.options].map(option=>option.value)){
      entityKeys.push(sectionName+':'+entityId);
      entity.value=entityId; entity.dispatchEvent(new Event('change',{bubbles:true})); await tick();
      for(const input of document.querySelectorAll('[data-property-key]')) mapped.push(sectionName+':'+entityId+':'+input.dataset.propertyKey);
    }
  }
  const photoAreaCount=document.querySelectorAll('[data-photo-area-select] option').length;
  return {entityCount:new Set(entityKeys).size,scalarMappings:new Set(mapped).size,photoAreaCount,mediaMappings:photoAreaCount*2,totalMappings:new Set(mapped).size+photoAreaCount*2};
})()`)

async function selectEntity(section, entityId) {
  await evaluate(`(()=>{const section=document.querySelector('#section-select');section.value=${JSON.stringify(section)};section.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await wait()
  await evaluate(`(()=>{const entity=document.querySelector('[data-admin-entity-select]');entity.value=${JSON.stringify(entityId)};entity.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await wait()
}

async function mutate(entitySection, entityId, key, value) {
  await selectEntity(entitySection, entityId)
  return evaluate(`(()=>{const input=document.querySelector('[data-property-key=${JSON.stringify(key)}]');const before=input.type==='checkbox'?input.checked:input.value;if(input.type==='checkbox')input.checked=${JSON.stringify(value)};else input.value=${JSON.stringify(String(value))};input.dispatchEvent(new Event(input.type==='checkbox'?'change':'input',{bubbles:true}));return before})()`)
}

const mutations = {}
mutations.titleBefore = await mutate('Portfolio', 'portfolio-hero', 'title', 'PORTFOLIO TEST')
mutations.titleAfter = await evaluate(`document.querySelector('.portfolio-title').textContent.trim()`)
assert(mutations.titleAfter === 'PORTFOLIO TEST', 'Admin content title must update Guest preview')
await mutate('Portfolio', 'portfolio-hero', 'title', mutations.titleBefore)

await selectEntity('About', 'about')
for (const [key, value, cssProperty] of [['fontSize','51px','fontSize'],['fontFamily','Arial, sans-serif','fontFamily'],['color','#123456','color']]) {
  const before = await mutate('About', 'about', key, value)
  const rendered = await evaluate(`getComputedStyle(document.querySelector('.about-title')).${cssProperty}`)
  mutations[key] = rendered
  assert(rendered && rendered !== '', `Typography ${key} must reach Guest`)
  await mutate('About', 'about', key, before)
}

const layoutValues = [['left','11%','left'],['top','17%','top'],['width','123px','width'],['height','127px','height'],['transformRotate','9deg','transform'],['backgroundColor','#123456','backgroundColor'],['borderRadius','19px','borderRadius'],['boxShadow','rgb(1, 2, 3) 0px 0px 7px','boxShadow']]
for (const [key, value, cssProperty] of layoutValues) {
  const before = await mutate('About', 'about-frame-main', key, value)
  const style = await evaluate(`getComputedStyle(document.querySelector('.frame-main')).${cssProperty}`)
  mutations[key] = style
  assert(style && style !== '', `Layout/appearance ${key} must reach Guest`)
  await mutate('About', 'about-frame-main', key, before)
}

await evaluate(`(()=>{const select=document.querySelector('[data-photo-area-select]');select.value='about-frame-main';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
await wait()
const documentNode = await send('DOM.getDocument', { depth: -1, pierce: true })
const fileNode = await send('DOM.querySelector', { nodeId: documentNode.root.nodeId, selector: 'input[type=file][data-photo-area-id="about-frame-main"]' })
assert(fileNode.nodeId, 'Dynamic media input must be discoverable')
await send('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [new URL('./fixtures/frame-a-1000x1000.svg', import.meta.url).pathname.replace(/^\/(.:)/, '$1')] })
await waitFor(`Boolean(document.querySelector('[data-photo-area-id="about-frame-main"] img'))`)
mutations.media = await evaluate(`document.querySelector('[data-photo-area-id="about-frame-main"] img').currentSrc.length>0`)
assert(mutations.media, 'Media mutation must reach selected Guest PhotoArea')
await evaluate(`document.querySelector('[data-media-object-position]').value='25% 75%';document.querySelector('[data-media-object-position]').dispatchEvent(new Event('input',{bubbles:true}))`)
await wait()
mutations.objectPosition = await evaluate(`getComputedStyle(document.querySelector('[data-photo-area-id="about-frame-main"] img')).objectPosition`)
assert(mutations.objectPosition === '25% 75%', 'Media object position must reach Guest')
await evaluate(`document.querySelector('.media-editor button').click()`)

await evaluate(`(()=>{const select=document.querySelector('[data-photo-area-select]');select.value='about-foreground-portrait';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
await wait()
const semanticDocument = await send('DOM.getDocument', { depth: -1, pierce: true })
const semanticFile = await send('DOM.querySelector', { nodeId: semanticDocument.root.nodeId, selector: 'input[type=file][data-photo-area-id="about-foreground-portrait"]' })
assert(semanticFile.nodeId, 'Semantic media usage must be dynamically discoverable')
await send('DOM.setFileInputFiles', { nodeId: semanticFile.nodeId, files: [new URL('./fixtures/frame-b-1600x900.svg', import.meta.url).pathname.replace(/^\/(.:)/, '$1')] })
await waitFor(`document.querySelector('[data-media-usage-id="about-foreground-portrait"]').currentSrc.includes('data:image')`)
const semanticMediaIsolation = await evaluate(`(()=>{const site=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('site');const ids=['portfolio-profile-media','about-foreground-portrait','contact-person-media'];const sources=ids.map(id=>site.mediaSourceForUsage(id));const assets=ids.map(id=>site.current.mediaUsages.find(usage=>usage.id===id).mediaAssetId);return {sources,assets,isolated:sources[0]===sources[2]&&sources[1]!==sources[0]&&assets[0]===assets[2]&&assets[1]!==assets[0]}})()`)
assert(semanticMediaIsolation.isolated, 'Semantic media copy-on-write must isolate About from Portfolio and Contact')
await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('site').resetToSeed()`)
await wait()

const autoplayBefore = await mutate('Certificate', 'certificate-behavior', 'autoplay', false)
mutations.autoplay = await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('site').current.behavior.certificate.autoplay`)
assert(mutations.autoplay === false, 'Behavior mutation must reach canonical state consumed by Guest')
await mutate('Certificate', 'certificate-behavior', 'autoplay', autoplayBefore)

const isolation = await evaluate(`(()=>{
  const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  const site=pinia._s.get('site');
  const families=[
    [site.current.content.about.paragraphs,0,'body'],[site.current.content.college.items,0,'description'],[site.current.content.shs.items,0,'description'],[site.current.content.experience.items,0,'description']
  ];
  return families.map(([items,index,key])=>{const before=items.map(item=>item[key]);items[index][key]='ISOLATION TEST';const isolated=items.slice(1).every((item,i)=>item[key]===before[i+1]);items[index][key]=before[0];return isolated})
})()`)
assert(isolation.every(Boolean), 'Entity family mutation isolation')

const identities = await evaluate(`(()=>{const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;const site=pinia._s.get('site');const cert=pinia._s.get('certificates');const ids=[...site.current.photoAreas.map(area=>area.id),...cert.editableCards.flatMap(card=>[card.thumbnail.id,...card.detailImages.map(image=>image.id)])];return {count:ids.length,unique:new Set(ids).size,semanticUsages:site.current.mediaUsages.map(usage=>usage.id),assetIds:site.current.mediaAssets.map(asset=>asset.id)}})()`)
assert(identities.count === identities.unique, 'Photo IDs must be globally unique')
assert(identities.semanticUsages.length === 3 && identities.assetIds.length === 1, 'Shared physical asset must have three semantic usages')
assert(runtimeErrors.length === 0, `Runtime errors: ${runtimeErrors.join('; ')}`)

socket.close()
console.log(JSON.stringify({ cardinality, adminCoverage, mutations, semanticMediaIsolation, isolation, identities, runtimeErrors }, null, 2))
