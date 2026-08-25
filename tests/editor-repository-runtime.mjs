const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))
const cdpPort = process.env.CDP_PORT ?? '9241'
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()
const page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1'))
if (!page) throw new Error('Runtime test page target not found')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
let sequence = 0
const pending = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.id && pending.has(message.id)) {
    const request = pending.get(message.id)
    pending.delete(message.id)
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
  }
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
function assert(condition, message) { if (!condition) throw new Error(`Editor repository failure: ${message}`) }

await send('Runtime.enable')
await evaluate(`(async()=>{const mod=await import('/src/repositories/editorRevisionRepository.ts'); const model=await import('/src/editor/editorSnapshot.ts'); const site=await import('/src/data/default/site.ts'); const repo=new mod.InMemoryEditorRevisionRepository(); const base=model.createEditorSnapshot(site.createDefaultSiteSnapshot()); repo.seedPublished(base,7); const pub=await repo.loadPublishedSnapshot(); if(!pub||pub.revision.revision_number!==7) throw new Error('published snapshot load failed'); const draft=structuredClone(base); draft.content.portfolio.title='Runtime draft'; const saved=await repo.saveDraft({snapshot:draft,mediaReferences:[],expectedBaseRevision:7}); if(saved.revision.status!=='draft') throw new Error('draft save failed'); const status=await repo.getDraftStatus(); if(!status.hasDraft||status.baseRevisionNumber!==7) throw new Error('draft status failed'); const loaded=await repo.loadDraft(); if(loaded.revision.snapshot.content.portfolio.title!=='Runtime draft') throw new Error('draft reload failed'); let conflict=false; try{await repo.saveDraft({snapshot:base,mediaReferences:[],expectedBaseRevision:6})}catch(error){conflict=error.code==='REVISION_CONFLICT'} if(!conflict) throw new Error('stale revision was not rejected'); const validation=await repo.validateDraft(saved.revision.id); if(!validation.valid) throw new Error('draft validation failed'); const serialized=model.serializeEditorSnapshot(draft); if(model.deserializeEditorSnapshot(serialized).content.portfolio.title!=='Runtime draft') throw new Error('snapshot serialization failed'); await repo.discardDraft(); if((await repo.loadDraft())!==null) throw new Error('draft discard failed'); return true})()`)
assert(true, 'unreachable')
console.log(JSON.stringify({ status: 'PASS', scope: 'Phase 029C repository boundary', publishExecuted: false, storageTouched: false }))
