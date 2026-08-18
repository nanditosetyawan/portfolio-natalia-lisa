const pages = await (await fetch('http://127.0.0.1:9238/json')).json()
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes('127.0.0.1:5173'))
if (!page) throw new Error('Vite target not found')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((done) => socket.addEventListener('open', done, { once:true }))
let sequence=0
const pending=new Map()
const runtimeErrors=[]
socket.addEventListener('message',({data})=>{
  const message=JSON.parse(data)
  if(message.id&&pending.has(message.id)){const callback=pending.get(message.id);pending.delete(message.id);callback(message)}
  if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.text)
  if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')runtimeErrors.push(message.params.entry.text)
})
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,(message)=>message.error?reject(new Error(message.error.message)):resolve(message.result));socket.send(JSON.stringify({id,method,params}))})
const evaluate=async(expression)=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,includeCommandLineAPI:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.text);return result.result.value}
const wait=(ms)=>new Promise((done)=>setTimeout(done,ms))

async function reset(width=1440,height=900,mobile=false){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile,screenWidth:width,screenHeight:height})
  await send('Page.reload',{ignoreCache:true});await wait(250)
  for(let i=0;i<60;i+=1){try{if(await evaluate(`Boolean(document.querySelector('#education')&&document.querySelector('#college'))`))break}catch{}await wait(50)}
  await wait(120)
}
async function place(selector,topVh){
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const top=e.getBoundingClientRect().top+scrollY;scrollTo(0,top-(${topVh})*innerHeight)})()`);await wait(120)
}
async function wheel(deltaY){await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:720,y:450,deltaX:0,deltaY})}
async function top(selector){return evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().top`)}
async function sample(selector,duration=650){const started=performance.now();const rows=[];while(performance.now()-started<duration){rows.push({t:performance.now()-started,top:await top(selector)});await wait(25)}return rows}
const compact=(rows)=>rows.filter((_,index)=>index%2===0).map((row)=>({t:Number(row.t.toFixed(1)),top:Number(row.top.toFixed(3))}))
const throwDuration=(rows)=>{const hit=rows.find((row)=>Math.abs(row.top)<=1);return hit?Number(hit.t.toFixed(1)):null}

await send('Page.enable');await send('Runtime.enable');await send('Log.enable')

await reset();await place('#college',.61);const downThrowBefore=await top('#college');await wheel(60);const downThrowPath=await sample('#college')
await reset();await place('#education',-.61);const upThrowBefore=await top('#education');await wheel(-60);const upThrowPath=await sample('#education')

async function repeated(direction){
  await reset();const selector=direction==='down'?'#college':'#education';await place(selector,direction==='down'?.78:-1.04);const rows=[]
  for(let i=0;i<14;i+=1){const before=await top(selector);await wheel(direction==='down'?50:-50);await wait(700);const after=await top(selector);rows.push({before:Number(before.toFixed(3)),after:Number(after.toFixed(3)),movement:Number((after-before).toFixed(3))});if(Math.abs(after)<1)break}
  return rows
}
const downResistance=await repeated('down');const upResistance=await repeated('up')

async function reverseCase(direction,phase){
  await reset();const selector=direction==='down'?'#college':'#education'
  const initial=phase==='before'?(direction==='down'?.78:-1.04):(direction==='down'?(phase==='resistance'?.68:.61):(phase==='resistance'?-.85:-.61))
  await place(selector,initial);const before=await top(selector)
  await wheel(direction==='down'?60:-60);await wait(phase==='throw'?80:phase==='resistance'?180:700);const pivot=await top(selector)
  await wheel(direction==='down'?-120:120);await wait(900);const after=await top(selector)
  return {before:Number(before.toFixed(3)),pivot:Number(pivot.toFixed(3)),after:Number(after.toFixed(3))}
}
const reverse={}
for(const direction of ['down','up'])for(const phase of ['before','resistance','throw'])reverse[`${direction}-${phase}`]=await reverseCase(direction,phase)

await reset();await place('#college',.61);await wheel(60);await wait(650);const cycleDown1=await top('#college');await wheel(-500);await wait(650);const cycleUp=await top('#education');await wheel(500);await wait(650);const cycleDown2=await top('#college')

await reset();await place('#college',0);const shsBefore=await evaluate(`document.querySelector('.shs-section').getBoundingClientRect().top`);await wheel(500);await wait(900);const downstream={college:await top('#college'),shs:await evaluate(`document.querySelector('.shs-section').getBoundingClientRect().top`),before:shsBefore}

await reset();await evaluate(`document.querySelector('#experience').scrollIntoView()`);await wait(150);const experienceBefore=await evaluate(`({height:document.querySelector('#experience').getBoundingClientRect().height,transforms:[...document.querySelectorAll('.exp-card')].map(e=>getComputedStyle(e).transform),dot:document.querySelector('.tl-active-dot').getBoundingClientRect().top})`);await wheel(500);await wait(900);const experienceAfter=await evaluate(`({height:document.querySelector('#experience').getBoundingClientRect().height,transforms:[...document.querySelectorAll('.exp-card')].map(e=>getComputedStyle(e).transform),dot:document.querySelector('.tl-active-dot').getBoundingClientRect().top})`)

await reset(390,844,true);await evaluate(`window.__touchPrevented=[];window.addEventListener('touchmove',e=>window.__touchPrevented.push(e.defaultPrevented),{passive:true});const e=document.querySelector('#college');scrollTo(0,e.getBoundingClientRect().top+scrollY-500)`);await wait(100);const touchBefore=await evaluate('scrollY');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:650}]});await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:250}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await wait(400);const touchAfter=await evaluate('scrollY');const touchPrevented=await evaluate('window.__touchPrevented')

await reset();const architecture=await evaluate(`({listeners:Object.fromEntries(['wheel','touchmove','scroll','scrollend'].map(type=>[type,getEventListeners(window)[type]?.length??0])),horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,collegeIds:document.querySelectorAll('#college').length,educationIds:document.querySelectorAll('#education').length,experienceCards:document.querySelectorAll('.exp-card').length})`)

console.log(JSON.stringify({
  throw:{down:{before:downThrowBefore,duration:throwDuration(downThrowPath),path:compact(downThrowPath)},up:{before:upThrowBefore,duration:throwDuration(upThrowPath),path:compact(upThrowPath)}},
  resistance:{down:downResistance,up:upResistance},reverse,cycle:{down1:cycleDown1,up:cycleUp,down2:cycleDown2},downstream,
  experience:{before:experienceBefore,after:experienceAfter,changed:experienceBefore.transforms.some((value,index)=>value!==experienceAfter.transforms[index])&&experienceBefore.dot!==experienceAfter.dot},
  touch:{before:touchBefore,after:touchAfter,prevented:touchPrevented},architecture,runtimeErrors
}))
socket.close()
