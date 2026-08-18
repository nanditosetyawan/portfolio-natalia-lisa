import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const cdpPort = process.env.CDP_PORT ?? '9241'
const pages = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('127.0.0.1:5173'))
if (!page) throw new Error('Responsive visual page target not found')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once:true }); socket.addEventListener('error', reject, { once:true }) })
let sequence=0
const pending=new Map()
const runtimeErrors=[]
socket.addEventListener('message',({data})=>{const message=JSON.parse(data);if(message.id&&pending.has(message.id)){pending.get(message.id)(message.result);pending.delete(message.id)}if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.text);if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')runtimeErrors.push(message.params.entry.text)})
const send=(method,params={})=>new Promise(resolve=>{const id=++sequence;pending.set(id,resolve);socket.send(JSON.stringify({id,method,params}))})
const evaluate=async expression=>(await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const assert=(condition,message)=>{if(!condition)throw new Error(`Responsive visual failure: ${message}`)}

await send('Page.enable');await send('Runtime.enable');await send('Log.enable')
await evaluate(`location.hash='#/'`);await send('Page.reload',{ignoreCache:true});await wait(450)
const sections=[['portfolio','#main'],['about','#about'],['education','#education'],['college','#college-section'],['shs','#shs-section'],['experience','#experience'],['certificate','#certificate'],['contact','#contact']]
const viewports=[[1422,804],[1024,768],[390,844]]
const report=[]
for(const [width,height] of viewports){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<500,screenWidth:width,screenHeight:height})
  await send('Page.reload',{ignoreCache:true})
  await wait(450)
  for(const [name,selector] of sections){
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView()`);await wait(180)
    const metrics=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});const rect=el.getBoundingClientRect();const clientWidth=document.documentElement.clientWidth;return {id:el.id,width:rect.width,height:rect.height,scrollWidth:document.documentElement.scrollWidth,clientWidth,overflow:document.documentElement.scrollWidth>clientWidth,wideContainers:[...document.querySelectorAll('html,body,#app,body *')].filter(node=>node.scrollWidth>clientWidth).sort((a,b)=>b.scrollWidth-a.scrollWidth).slice(0,16).map(node=>({tag:node.tagName,id:node.id,class:node.className?.toString().slice(0,60),scrollWidth:node.scrollWidth,clientWidth:node.clientWidth})),offenders:[...document.querySelectorAll('body *')].filter(node=>{const r=node.getBoundingClientRect();return r.right>clientWidth+0.5||r.left<-.5}).slice(0,12).map(node=>({tag:node.tagName,class:node.className?.toString().slice(0,80),left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right})),photoIds:[...el.querySelectorAll('[data-photo-area-id]')].map(area=>area.dataset.photoAreaId)}})()`)
    const screenshot=await send('Page.captureScreenshot',{format:'png',fromSurface:true})
    const path=join(tmpdir(),`entity-remediation-011-${width}x${height}-${name}.png`)
    writeFileSync(path,Buffer.from(screenshot.data,'base64'))
    report.push({width,height,name,path,...metrics})
  }
}
assert(report.every(item=>!item.overflow),`horizontal overflow: ${JSON.stringify(report.filter(item=>item.overflow).slice(0,1))}`)
assert(report.every(item=>new Set(item.photoIds).size===item.photoIds.length),'photo IDs must be unique within every section')
assert(runtimeErrors.length===0,'console/runtime errors must be zero')
await send('Emulation.clearDeviceMetricsOverride')
socket.close()
console.log(JSON.stringify({report,runtimeErrors}))
