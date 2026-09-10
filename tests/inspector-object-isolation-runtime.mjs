import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const projectRoot = process.cwd()
const baseUrl = 'http://127.0.0.1:5192'
const cdpPort = 9352
const chromePath = process.env.CHROME_PATH ?? 'C:\\Users\\VivoBook\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
const profilePath = await mkdtemp(path.join(tmpdir(), 'portfolio-object-isolation-'))
const children = []
const wait = (milliseconds = 50) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function assert(condition, message) {
  if (!condition) throw new Error(`Inspector object isolation runtime failure: ${message}`)
}

async function waitForHttp(url, timeout = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch { /* Vite is starting. */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForJson(url, timeout = 20_000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return await response.json()
    } catch { /* Chromium is starting. */ }
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
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
  const vite = launch(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5192', '--strictPort'], {
    cwd: projectRoot,
    env: { ...process.env, VITE_SUPABASE_URL: ' ', VITE_SUPABASE_PUBLISHABLE_KEY: ' ' }
  })
  let viteErrors = ''
  vite.stderr.on('data', (chunk) => { viteErrors += String(chunk) })
  await waitForHttp(baseUrl)

  const browser = launch(chromePath, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profilePath}`,
    '--window-size=1600,1050', baseUrl
  ])
  let browserErrors = ''
  browser.stderr.on('data', (chunk) => { browserErrors += String(chunk) })

  let page
  const targetStarted = Date.now()
  while (!page && Date.now() - targetStarted < 15_000) {
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json`)
    page = targets.find((target) => target.type === 'page' && target.url.includes('127.0.0.1:5192'))
    if (!page) await wait(100)
  }
  if (!page) throw new Error('Browser target not found.')

  socket = new WebSocket(page.webSocketDebuggerUrl)
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

  async function waitFor(expression, timeout = 20_000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return
      await wait(70)
    }
    throw new Error(`Timed out: ${expression}`)
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1050, deviceScaleFactor: 1, mobile: false })
  await waitFor(`Boolean(document.querySelector('#app')?.__vue_app__)`)
  await evaluate(`(async()=>{
    const authModule=await import('/src/stores/auth.ts');
    const router=(await import('/src/router/index.ts')).default;
    authModule.useAuthStore().$patch({isAdmin:true,isInitialized:true,isLoading:false});
    await router.push({name:'admin-edit',query:{draft:'new'}});
    return true;
  })()`)
  await waitFor(`Boolean(document.querySelector('.edit-page')) && !document.querySelector('.editor-recovery') && Boolean(document.querySelector('[data-editor-object-id="portfolio-hero"]'))`)
  await wait(350)

  const evidence = await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const freeze=document.createElement('style');
    freeze.dataset.phase037aFreeze='true';
    freeze.textContent='*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}';
    document.head.append(freeze);
    await tick();
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const exact=id=>[...document.querySelectorAll('[data-editor-object-id="'+CSS.escape(id)+'"]')];
    const target=exact('portfolio-hero').sort((a,b)=>a.getBoundingClientRect().width*a.getBoundingClientRect().height-b.getBoundingClientRect().width*b.getBoundingClientRect().height)[0];
    target.click();await tick();
    const section=target.closest('.portfolio-section');
    const tracked=[];const seen=new Set();
    const add=(node,role)=>{if(!node||seen.has(node))return;seen.add(node);tracked.push({node,role})};
    add(target,'selected-text');add(section,'section-root');
    for(const node of exact('portfolio-hero'))add(node,node===target?'selected-text':'duplicate-target');
    for(const node of section.querySelectorAll('[data-editor-object-id],[data-editor-entity-id],img,svg')){
      const id=node.getAttribute('data-editor-object-id')||node.getAttribute('data-editor-entity-id')||'';
      const role=id==='profile-lisa-natalia'?'lisa-text':id==='portfolio-profile-media'?'profile-image':id?'sibling-object':node.matches('img')?'image-descendant':'decorative';
      add(node,role);
    }
    const pathOf=node=>{const parts=[];let current=node;while(current&&current!==section){const parent=current.parentElement;if(!parent)break;parts.unshift([...parent.children].indexOf(current));current=parent}return parts.join('.')||'root'};
    const fingerprint=({node,role})=>{const style=getComputedStyle(node);const rect=node.getBoundingClientRect();return {key:role+'|'+(node.getAttribute('data-editor-object-id')||node.getAttribute('data-editor-entity-id')||node.tagName)+'|'+pathOf(node),role,objectId:node.getAttribute('data-editor-object-id')||'',tag:node.tagName,className:typeof node.className==='string'?node.className:'',inlineStyle:node.getAttribute('style')||'',rect:{x:+rect.x.toFixed(2),y:+rect.y.toFixed(2),width:+rect.width.toFixed(2),height:+rect.height.toFixed(2)},style:{transform:style.transform,translate:style.translate,rotate:style.rotate,width:style.width,height:style.height,margin:style.margin,padding:style.padding,justifyContent:style.justifyContent,textAlign:style.textAlign,position:style.position,left:style.left,top:style.top}}};
    const copy=value=>JSON.parse(JSON.stringify(value));
    const canonicalDomains=['layout','typography','backgrounds','buttons','animations'];
    const capture=()=>({selectedObjectId:editor.selectedObjectId,records:Object.fromEntries(canonicalDomains.map(domain=>[domain,copy(editor.draftSnapshot[domain])])),mediaStyles:copy(editor.draftSnapshot.media.styles),nodes:Object.fromEntries(tracked.map(item=>{const value=fingerprint(item);return [value.key,value]}))});
    const compare=(before,after)=>{const nodeDiffs=[];for(const [key,left] of Object.entries(before.nodes)){const right=after.nodes[key];if(!right)continue;const changed=[];if(left.inlineStyle!==right.inlineStyle)changed.push('inlineStyle');for(const field of Object.keys(left.style))if(left.style[field]!==right.style[field])changed.push('style.'+field);for(const field of Object.keys(left.rect))if(left.rect[field]!==right.rect[field])changed.push('rect.'+field);if(changed.length)nodeDiffs.push({key,role:left.role,objectId:left.objectId,changed,before:{inlineStyle:left.inlineStyle,rect:left.rect,style:left.style},after:{inlineStyle:right.inlineStyle,rect:right.rect,style:right.style}})}const canonical=[];for(const domain of canonicalDomains){const leftRecord=before.records[domain];const rightRecord=after.records[domain];for(const id of new Set([...Object.keys(leftRecord),...Object.keys(rightRecord)])){if(JSON.stringify(leftRecord[id])!==JSON.stringify(rightRecord[id]))canonical.push({domain,id,before:leftRecord[id],after:rightRecord[id]})}}for(const id of new Set([...Object.keys(before.mediaStyles),...Object.keys(after.mediaStyles)])){if(JSON.stringify(before.mediaStyles[id])!==JSON.stringify(after.mediaStyles[id]))canonical.push({domain:'media.styles',id,before:before.mediaStyles[id],after:after.mediaStyles[id]})}return {nodeDiffs,canonical}};
    const open=async category=>{const group=document.querySelector('[data-property-category="'+category+'"]');if(group&&group.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true'){group.querySelector('.accordion-toggle').click();await tick()}};
    const mutate=async spec=>{await open(spec.category);const field=document.querySelector('[data-property-key="'+spec.key+'"]');if(!field)return {control:spec.key,available:false};const control=field.querySelector('input,select');if(!control||control.disabled)return {control:spec.key,available:true,enabled:false};const before=capture();if(control.tagName==='SELECT'){control.value=spec.value;control.dispatchEvent(new Event('change',{bubbles:true}))}else{control.value=String(spec.value);control.dispatchEvent(new Event('input',{bubbles:true}))}await tick();const after=capture();const diff=compare(before,after);editor.undo();await tick();return {control:spec.key,available:true,enabled:true,selectedBefore:before.selectedObjectId,selectedAfter:after.selectedObjectId,...diff}};
    const specs=[
      {key:'font.positionX',value:17,category:'font'},
      {key:'font.positionY',value:19,category:'font'},
      {key:'font.rotate',value:7,category:'font'},
      {key:'position.width',value:333,category:'layout'},
      {key:'position.height',value:77,category:'layout'},
      {key:'layout.alignment',value:'center',category:'layout'},
      {key:'layout.margin',value:13,category:'layout'},
      {key:'layout.padding',value:11,category:'layout'},
      {key:'runtime.textAlign',value:'center',category:'font'},
      {key:'effects.opacity',value:63,category:'effects'},
      {key:'effects.blur',value:2,category:'effects'},
      {key:'effects.radius',value:12,category:'effects'}
    ];
    const mutations=[];for(const spec of specs)mutations.push(await mutate(spec));
    const objectTargets=editor.objects.map(object=>{const node=document.querySelector('[data-editor-object-id="'+CSS.escape(object.id)+'"]');return {id:object.id,type:object.type,section:object.section,target:node?node.tagName+'.'+(typeof node.className==='string'?node.className.split(' ').slice(0,2).join('.'): ''):null}});
    const markerCounts=Object.groupBy([...document.querySelectorAll('[data-editor-object-id]')],node=>node.getAttribute('data-editor-object-id'));const duplicateMarkerIds=Object.entries(markerCounts).filter(([,nodes])=>nodes.length>1).map(([id,nodes])=>({id,count:nodes.length}));
    return {selectedObjectId:editor.selectedObjectId,targetInstances:exact('portfolio-hero').map(node=>({tag:node.tagName,className:typeof node.className==='string'?node.className:'',path:pathOf(node),area:+(node.getBoundingClientRect().width*node.getBoundingClientRect().height).toFixed(2)})),duplicateMarkerIds,tracked:tracked.map(({node,role})=>({role,objectId:node.getAttribute('data-editor-object-id')||'',tag:node.tagName,path:pathOf(node)})),objectTargets,mutations};
  })()`)

  const mutationSummary = evidence.mutations.map((mutation) => ({
    control: mutation.control,
    available: mutation.available,
    enabled: mutation.enabled,
    selectedBefore: mutation.selectedBefore,
    selectedAfter: mutation.selectedAfter,
    canonicalTargets: (mutation.canonical ?? []).map((change) => `${change.domain}.${change.id}`),
    changedNodes: (mutation.nodeDiffs ?? []).map((change) => ({
      role: change.role,
      objectId: change.objectId,
      tag: change.key.split('|')[2]?.split('|')[0] ?? '',
      fields: change.changed
    }))
  }))
  process.stdout.write(`${JSON.stringify({
    status: process.env.PHASE037A_DIAGNOSTIC === '1' ? 'DIAGNOSTIC' : 'VERIFICATION',
    selectedObjectId: evidence.selectedObjectId,
    targetInstances: evidence.targetInstances,
    duplicateMarkerIds: evidence.duplicateMarkerIds,
    objectTargets: process.env.PHASE037A_DIAGNOSTIC === '1' ? evidence.objectTargets : undefined,
    mutationSummary
  })}\n`)
  if (process.env.PHASE037A_DIAGNOSTIC === '1') {
    const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
    assert(seriousErrors.length === 0, `unexpected browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)
  } else {
    assert(evidence.targetInstances.length === 1 && evidence.targetInstances[0]?.tag === 'H1', `Portfolio object did not resolve to one H1 owner: ${JSON.stringify(evidence.targetInstances)}`)
    assert(evidence.duplicateMarkerIds.length === 0, `Editor Object markers are not one-to-one: ${JSON.stringify(evidence.duplicateMarkerIds)}`)
    for (const mutation of evidence.mutations.filter((item) => item.enabled)) {
      const leaks = mutation.nodeDiffs?.filter((item) => item.role !== 'selected-text') ?? []
      assert(mutation.selectedBefore === 'portfolio-hero' && mutation.selectedAfter === 'portfolio-hero', `selection changed during ${mutation.control}`)
      assert(leaks.length === 0, `${mutation.control} leaked beyond selected DOM target: ${JSON.stringify(leaks)}`)
      assert(mutation.canonical?.length === 1 && mutation.canonical[0]?.id === 'portfolio-hero', `${mutation.control} wrote outside the selected canonical object: ${JSON.stringify(mutation.canonical)}`)
    }
    const legacyAlignment = evidence.mutations.find((item) => item.control === 'layout.alignment')
    assert(legacyAlignment?.available === false, 'legacy no-op alignment remains visible for Text')
  }

  const panelEvidence = process.env.PHASE037A_DIAGNOSTIC === '1' ? null : await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const settle=async()=>{await tick();await new Promise(resolve=>setTimeout(resolve,220))};
    const collect=async id=>{
      const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
      const object=editor.objects.find(candidate=>candidate.id===id);
      if(!object)return {id,missing:true};
      const sectionSelect=document.querySelector('#section-select');sectionSelect.value=object.section;sectionSelect.dispatchEvent(new Event('change',{bubbles:true}));await settle();
      const entitySelect=document.querySelector('#entity-select');entitySelect.value=id;entitySelect.dispatchEvent(new Event('change',{bubbles:true}));await settle();
      const groups={};
      for(const group of [...document.querySelectorAll('.property-group[data-property-category]')]){
        const key=group.dataset.propertyCategory;const toggle=group.querySelector('.accordion-toggle');
        if(toggle&&toggle.getAttribute('aria-expanded')!=='true'){toggle.click();await settle()}
        groups[key]=[...group.querySelectorAll('[data-property-key]')].map(control=>({
          key:control.dataset.propertyKey,
          inspectorKey:control.dataset.inspectorKey,
          label:control.closest('.property-field')?.querySelector(':scope > span')?.textContent?.trim(),
          disabled:[...control.querySelectorAll('input,select,button,textarea')].filter(item=>item.type!=='hidden').every(item=>item.disabled)
        }));
      }
      return {id,type:object?.type,section:object?.section,groups,selected:editor.selectedObjectId};
    };
    return {
      text:await collect('portfolio-hero'),
      image:await collect('portfolio-profile-media'),
      button:await collect('about-cta-learn-more'),
      frame:await collect('about-frame-main')
    };
  })()`)

  if (panelEvidence) {
    const keys = (entry, group) => (entry.groups[group] ?? []).map((item) => item.key)
    const panelSummary = Object.fromEntries(Object.entries(panelEvidence).map(([name, entry]) => [name, {
      id: entry.id,
      type: entry.type,
      selected: entry.selected,
      groups: Object.fromEntries(Object.keys(entry.groups ?? {}).filter((group) => group !== 'advanced').map((group) => [group, keys(entry, group)])),
      disabled: Object.values(entry.groups ?? {}).flat().filter((item) => item.disabled).map((item) => item.key),
      advancedCount: keys(entry, 'advanced').length
    }]))
    process.stdout.write(`${JSON.stringify({ status: 'PANEL_MATRIX', panelSummary })}\n`)
    assert(panelEvidence.text.selected === 'portfolio-hero' && panelEvidence.text.type === 'Text', 'Text capability matrix lost selection')
    assert(!panelEvidence.text.groups.media, 'Text exposes a Media accordion')
    assert(['font.positionX', 'font.positionY', 'font.rotate', 'runtime.textAlign'].every((key) => keys(panelEvidence.text, 'font').includes(key)), `Text Typography ownership is incomplete: ${JSON.stringify(panelEvidence.text.groups)}`)
    assert(['position.x', 'position.y', 'position.rotation', 'layout.alignment'].every((key) => !keys(panelEvidence.text, 'layout').includes(key)), `Text exposes duplicate/no-op Layout transforms: ${JSON.stringify(panelEvidence.text.groups.layout)}`)
    assert(!keys(panelEvidence.text, 'effects').includes('effects.shadow'), 'Text exposes generic box Shadow beside Typography Shadow')
    assert(panelEvidence.text.groups.font.find((item) => item.key === 'font.hover')?.label === 'Hover style' && panelEvidence.text.groups.interaction.find((item) => item.key === 'animation.hover')?.label === 'Hover motion', 'Typography Hover Style and Animation Hover Motion are not semantically distinguished')

    assert(panelEvidence.image.selected === 'portfolio-profile-media' && panelEvidence.image.type === 'Image', 'Image capability matrix lost selection')
    assert(!panelEvidence.image.groups.font, 'Image exposes a Typography accordion')
    assert(['media.width', 'media.height', 'media.positionX', 'media.positionY', 'media.outlineEnabled', 'media.rotate'].every((key) => keys(panelEvidence.image, 'media').includes(key)), `Image Media ownership is incomplete: ${JSON.stringify(panelEvidence.image.groups)}`)
    assert(['position.x', 'position.y', 'position.width', 'position.height', 'position.rotation', 'layout.alignment', 'effects.opacity', 'effects.border', 'effects.radius'].every((key) => ![...keys(panelEvidence.image, 'layout'), ...keys(panelEvidence.image, 'effects')].includes(key)), `Image exposes duplicated geometry/effects: ${JSON.stringify(panelEvidence.image.groups)}`)

    assert(panelEvidence.button.selected === 'about-cta-learn-more' && panelEvidence.button.type === 'Button' && !panelEvidence.button.groups.media, 'Button capability ownership is incorrect')
    assert(['font.positionX', 'font.positionY', 'font.rotate', 'runtime.textAlign'].every((key) => keys(panelEvidence.button, 'font').includes(key)), `Button Typography ownership is incomplete: ${JSON.stringify(panelEvidence.button.groups)}`)
    assert(!keys(panelEvidence.button, 'effects').includes('effects.shadow'), 'Button exposes duplicate normal Shadow')

    const duplicateRuntimeGeometry = new Set([
      'runtime:layout:left:left',
      'runtime:layout:top:top',
      'runtime:layout:width:width',
      'runtime:layout:height:height',
      'runtime:layout:maxWidth:maxWidth',
      'runtime:appearance:transformRotate:transformRotate',
      'runtime:appearance:borderRadius:borderRadius',
      'runtime:appearance:boxShadow:boxShadow'
    ])
    const duplicateRuntime = Object.values(panelEvidence.frame.groups).flat().filter((item) => duplicateRuntimeGeometry.has(item.key))
    assert(duplicateRuntime.length === 0, `legacy runtime geometry remains duplicated in the frame Inspector: ${JSON.stringify(duplicateRuntime)}`)
    for (const entry of Object.values(panelEvidence)) {
      const normalKeys = new Set(Object.entries(entry.groups).filter(([group]) => group !== 'advanced').flatMap(([, items]) => items.map((item) => item.key)))
      const invalidAdvancedDuplicates = (entry.groups.advanced ?? []).filter((item) => normalKeys.has(item.key) && !item.inspectorKey?.startsWith('details:'))
      assert(invalidAdvancedDuplicates.length === 0, `Advanced repeats a normal action instead of exposing canonical details: ${JSON.stringify(invalidAdvancedDuplicates)}`)
    }
  }

  const sectionEvidence = process.env.PHASE037A_DIAGNOSTIC === '1' ? null : await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const settle=async()=>{await tick();await new Promise(resolve=>setTimeout(resolve,80));await tick()};
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const sections=['Portfolio','About','Education','Experience','Certificate','Contact'];
    const rootSelector='.portfolio-section,.about-section,.education-section,.experience-section,.certificate-section,.contact-section';
    const select=async object=>{
      const sectionSelect=document.querySelector('#section-select');sectionSelect.value=object.section;sectionSelect.dispatchEvent(new Event('change',{bubbles:true}));await settle();
      const entitySelect=document.querySelector('#entity-select');entitySelect.value=object.id;entitySelect.dispatchEvent(new Event('change',{bubbles:true}));await settle();
    };
    const fingerprint=node=>{const rect=node.getBoundingClientRect();const style=getComputedStyle(node);return {inline:node.getAttribute('style')||'',rect:[rect.x,rect.y,rect.width,rect.height].map(value=>+value.toFixed(2)),style:[style.transform,style.translate,style.rotate,style.width,style.height,style.position]}};
    const withoutSelected=id=>{const result={};for(const domain of ['layout','typography','backgrounds','buttons','animations'])result[domain]=Object.fromEntries(Object.entries(editor.draftSnapshot[domain]).filter(([key])=>key!==id));result.media=Object.fromEntries(Object.entries(editor.draftSnapshot.media.styles).filter(([key])=>key!==id));return JSON.stringify(result)};
    const results=[];
    for(let index=0;index<sections.length;index+=1){
      const section=sections[index];
      const object=editor.objects.find(candidate=>candidate.section===section&&candidate.type==='Text'&&document.querySelector('[data-editor-object-id="'+CSS.escape(candidate.id)+'"]'));
      if(!object){results.push({section,missing:true});continue}
      await select(object);
      const target=document.querySelector('[data-editor-object-id="'+CSS.escape(object.id)+'"]');
      const root=target.closest(rootSelector);
      if(!root){results.push({section,id:object.id,missingRoot:true});continue}
      const ownedDescendants=[...target.querySelectorAll('*')];
      const tracked=[root,...root.querySelectorAll('[data-editor-object-id],[class*="decor"],[aria-hidden="true"] svg,img')].filter((node,position,array)=>node!==target&&!target.contains(node)&&array.indexOf(node)===position);
      const beforeTarget=fingerprint(target);const beforeOthers=tracked.map(fingerprint);const beforeCanonical=withoutSelected(object.id);
      const group=document.querySelector('[data-property-category="font"]');if(group?.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true'){group.querySelector('.accordion-toggle').click();await settle()}
      const input=document.querySelector('[data-property-key="font.positionX"] input');
      if(!input||input.disabled){results.push({section,id:object.id,missingControl:true});continue}
      input.value=String((Number(input.value)||0)+9+index);input.dispatchEvent(new Event('input',{bubbles:true}));await settle();
      const afterTarget=fingerprint(target);const afterOthers=tracked.map(fingerprint);const afterCanonical=withoutSelected(object.id);const command=editor.commandHistory.at(-1);
      const siblingDiffs=beforeOthers.flatMap((value,itemIndex)=>JSON.stringify(value)===JSON.stringify(afterOthers[itemIndex])?[]:[itemIndex]);
      results.push({section,id:object.id,selected:editor.selectedObjectId,targetChanged:JSON.stringify(beforeTarget)!==JSON.stringify(afterTarget),ownedDescendants:ownedDescendants.length,siblingDiffs,parentChanged:siblingDiffs.includes(0),nonTargetCanonicalChanged:beforeCanonical!==afterCanonical,commandEntity:command?.entityId,commandPath:command?.propertyPath});
      editor.undo();await settle();
    }
    return results;
  })()`)

  if (sectionEvidence) {
    process.stdout.write(`${JSON.stringify({ status: 'SECTION_ISOLATION', sections: sectionEvidence })}\n`)
    assert(sectionEvidence.length === 6 && sectionEvidence.every((item) => !item.missing && !item.missingRoot && !item.missingControl), `section coverage is incomplete: ${JSON.stringify(sectionEvidence)}`)
    for (const item of sectionEvidence) {
      assert(item.selected === item.id && item.targetChanged, `${item.section} selected Text did not receive its X mutation: ${JSON.stringify(item)}`)
      assert(item.siblingDiffs.length === 0 && !item.parentChanged, `${item.section} X mutation changed parent/sibling geometry: ${JSON.stringify(item)}`)
      assert(!item.nonTargetCanonicalChanged && item.commandEntity === item.id && item.commandPath === `layout.${item.id}.x`, `${item.section} X mutation escaped its canonical record: ${JSON.stringify(item)}`)
    }
  }

  const objectMutationEvidence = process.env.PHASE037A_DIAGNOSTIC === '1' ? null : await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const settle=async()=>{await tick();await new Promise(resolve=>setTimeout(resolve,70));await tick()};
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const rootSelector='.portfolio-section,.about-section,.education-section,.experience-section,.certificate-section,.contact-section';
    const select=async id=>{const object=editor.objects.find(candidate=>candidate.id===id);const section=document.querySelector('#section-select');section.value=object.section;section.dispatchEvent(new Event('change',{bubbles:true}));await settle();const entity=document.querySelector('#entity-select');entity.value=id;entity.dispatchEvent(new Event('change',{bubbles:true}));await settle();return object};
    const fingerprint=node=>{const rect=node.getBoundingClientRect();const style=getComputedStyle(node);return {inline:node.getAttribute('style')||'',rect:[rect.x,rect.y,rect.width,rect.height].map(value=>+value.toFixed(2)),style:[style.transform,style.translate,style.rotate,style.width,style.height,style.opacity,style.border,style.borderRadius,style.color,style.textAlign]}};
    const canonicalWithout=id=>{const result={};for(const domain of ['layout','typography','backgrounds','buttons','animations'])result[domain]=Object.fromEntries(Object.entries(editor.draftSnapshot[domain]).filter(([key])=>key!==id));result.media=Object.fromEntries(Object.entries(editor.draftSnapshot.media.styles).filter(([key])=>key!==id));return JSON.stringify(result)};
    const open=async category=>{const group=document.querySelector('[data-property-category="'+category+'"]');if(group?.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true'){group.querySelector('.accordion-toggle').click();await settle()}return group};
    const assign=async(field,value)=>{
      const checkbox=field.querySelector('input[type="checkbox"]');
      if(checkbox){checkbox.checked=Boolean(value);checkbox.dispatchEvent(new Event('change',{bubbles:true}));return}
      const colorButton=field.querySelector('.color-summary');
      if(colorButton){colorButton.click();await settle();const hex=field.querySelector('.picker-head input:not([type="color"])');hex.value=String(value);hex.dispatchEvent(new Event('change',{bubbles:true}));return}
      const control=field.querySelector('select,textarea,input:not([type="file"]):not([type="hidden"]):not([type="range"])')??field.querySelector('input[type="range"]');
      if(!control)return;
      control.value=String(value);control.dispatchEvent(new Event(control.tagName==='SELECT'?'change':'input',{bubbles:true}));
    };
    const run=async(id,specs)=>{
      await select(id);const target=document.querySelector('[data-editor-object-id="'+CSS.escape(id)+'"]');const root=target.closest(rootSelector);const tracked=[root,...root.querySelectorAll('[data-editor-object-id],[class*="decor"],[aria-hidden="true"] svg,img')].filter((node,index,array)=>node!==target&&!target.contains(node)&&array.indexOf(node)===index);
      const results=[];
      for(const spec of specs){
        await open(spec.category);const field=document.querySelector('[data-property-key="'+spec.key+'"]');
        if(!field){results.push({key:spec.key,available:false});continue}
        const controls=[...field.querySelectorAll('input,select,textarea,button')].filter(control=>control.type!=='hidden');
        const enabled=controls.some(control=>!control.disabled);
        if(!enabled){results.push({key:spec.key,available:true,enabled:false});continue}
        const before=fingerprint(target);const siblings=tracked.map(fingerprint);const canonical=canonicalWithout(id);
        await assign(field,spec.value);await settle();
        const after=fingerprint(target);const afterSiblings=tracked.map(fingerprint);const command=editor.commandHistory.at(-1);
        const siblingDiffs=siblings.flatMap((value,index)=>{const afterValue=afterSiblings[index];if(JSON.stringify(value)===JSON.stringify(afterValue))return[];return [{index,inlineChanged:value.inline!==afterValue.inline,computedChanged:JSON.stringify(value.style)!==JSON.stringify(afterValue.style),geometryChanged:JSON.stringify(value.rect)!==JSON.stringify(afterValue.rect)}]});
        const result={key:spec.key,available:true,enabled:true,allowReflow:Boolean(spec.allowReflow),selected:editor.selectedObjectId,targetChanged:JSON.stringify(before)!==JSON.stringify(after),siblingDiffs,nonTargetCanonicalChanged:canonical!==canonicalWithout(id),commandEntity:command?.entityId,commandPath:command?.propertyPath};
        editor.undo();await settle();result.restored=JSON.stringify(before)===JSON.stringify(fingerprint(target));results.push(result);
      }
      return {id,type:editor.objects.find(candidate=>candidate.id===id)?.type,results};
    };
    return {
      image:await run('portfolio-profile-media',[
        {key:'media.positionX',category:'media',value:14},{key:'media.positionY',category:'media',value:16},{key:'media.rotate',category:'media',value:8},
        {key:'media.width',category:'media',value:430},{key:'media.height',category:'media',value:610},{key:'media.opacity',category:'media',value:73},
        {key:'media.radius',category:'media',value:21},{key:'media.outlineEnabled',category:'media',value:true}
      ]),
      button:await run('about-cta-learn-more',[
        {key:'font.positionX',category:'font',value:12},{key:'font.positionY',category:'font',value:14},{key:'font.rotate',category:'font',value:6},
        {key:'position.width',category:'layout',value:190},{key:'position.height',category:'layout',value:52,allowReflow:true},{key:'runtime.textAlign',category:'font',value:'center'},
        {key:'font.color',category:'font',value:'#8d363a'},{key:'font.shadow',category:'font',value:true},{key:'effects.opacity',category:'effects',value:74},
        {key:'effects.border',category:'effects',value:'2px solid #8d363a',allowReflow:true},{key:'effects.radius',category:'effects',value:17}
      ])
    };
  })()`)

  if (objectMutationEvidence) {
    const compact = Object.fromEntries(Object.entries(objectMutationEvidence).map(([type, entry]) => [type, entry.results.map((item) => ({ key: item.key, available: item.available, enabled: item.enabled, targetChanged: item.targetChanged, siblingDiffs: item.siblingDiffs, restored: item.restored, commandPath: item.commandPath }))]))
    process.stdout.write(`${JSON.stringify({ status: 'OBJECT_MUTATIONS', objects: compact })}\n`)
    for (const entry of Object.values(objectMutationEvidence)) {
      for (const item of entry.results) {
        assert(item.available && item.enabled, `${entry.type} control is unexpectedly unavailable: ${JSON.stringify(item)}`)
        assert(item.selected === entry.id && item.targetChanged, `${entry.type} ${item.key} did not affect the selected target: ${JSON.stringify(item)}`)
        const directSiblingMutations = item.siblingDiffs.filter((diff) => diff.inlineChanged)
        const forbiddenGeometryChanges = item.allowReflow ? [] : item.siblingDiffs
        assert(directSiblingMutations.length === 0 && forbiddenGeometryChanges.length === 0 && !item.nonTargetCanonicalChanged, `${entry.type} ${item.key} leaked to parent/siblings: ${JSON.stringify(item)}`)
        assert(item.commandEntity === entry.id && item.restored, `${entry.type} ${item.key} command/Undo isolation failed: ${JSON.stringify(item)}`)
      }
    }
  }

  const typeResolverEvidence = process.env.PHASE037A_DIAGNOSTIC === '1' ? null : await evaluate(`(async()=>{
    const resolver=await import('/src/editor/objectDomTarget.ts');const runtime=await import('/src/editor/propertyRuntime.ts');
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const fixtures=[
      {type:'Text',kind:'text',markup:id=>'<section data-entity-id="'+id+'"><span data-entity-id="'+id+'">Text</span></section>',tag:'SPAN',position:true},
      {type:'Image',kind:'media',markup:id=>'<figure data-entity-id="'+id+'"><img data-entity-id="'+id+'" alt="fixture"></figure>',tag:'IMG',position:true},
      {type:'Button',kind:'button',markup:id=>'<div data-entity-id="'+id+'"><button data-entity-id="'+id+'">Button</button></div>',tag:'BUTTON',position:true},
      {type:'Container',kind:'container',markup:id=>'<section data-entity-id="'+id+'"><span data-entity-id="'+id+'">Child</span></section>',tag:'SECTION',position:true},
      {type:'Background',kind:'background',markup:id=>'<div data-entity-id="'+id+'"><span data-entity-id="'+id+'">Background child</span></div>',tag:'DIV',position:false},
      {type:'Divider',kind:'divider',markup:id=>'<div data-entity-id="'+id+'"><hr data-entity-id="'+id+'"></div>',tag:'HR',position:true},
      {type:'Icon',kind:'icon',markup:id=>'<div data-entity-id="'+id+'"><svg data-entity-id="'+id+'" viewBox="0 0 10 10"><path d="M0 0h10v10z"></path></svg></div>',tag:'svg',position:true}
    ];
    const results=[];
    for(const [index,fixture] of fixtures.entries()){
      const id='phase037a-'+fixture.type.toLowerCase();const host=document.createElement('div');host.style.cssText='position:fixed;left:-2000px;top:'+(index*80)+'px;width:300px;height:60px';host.innerHTML=fixture.markup(id)+'<aside data-fixture-outside="true">Outside</aside>';document.body.append(host);
      const snapshot=JSON.parse(JSON.stringify(editor.draftSnapshot));snapshot.entities.push({entityId:id,section:'Fixture',kind:fixture.kind,label:fixture.type});
      const target=resolver.resolveObjectDomTarget(host,id,fixture.type);const candidates=[...host.querySelectorAll('[data-entity-id="'+id+'"]')];const nonTargets=candidates.filter(node=>node!==target);const before=nonTargets.map(node=>node.getAttribute('style')||'');const outside=host.querySelector('[data-fixture-outside]');const outsideBefore=outside.getAttribute('style')||'';const child=target?.querySelector('*');const childBefore=child?.getBoundingClientRect().x;
      if(fixture.position){snapshot.layout[id]={x:23,y:9,rotation:4};runtime.applyRegisteredObjectProperties(host,snapshot,id)}
      await new Promise(resolve=>requestAnimationFrame(resolve));const childAfter=child?.getBoundingClientRect().x;
      results.push({type:fixture.type,resolved:target?.tagName.toUpperCase(),expected:fixture.tag.toUpperCase(),targetStyle:target?.getAttribute('style')||'',nonTargetStyleStable:nonTargets.every((node,itemIndex)=>(node.getAttribute('style')||'')===before[itemIndex]),outsideStable:(outside.getAttribute('style')||'')===outsideBefore,containerChildMoved:fixture.type==='Container'?childBefore!==childAfter:undefined});
      host.remove();
    }
    return results;
  })()`)

  if (typeResolverEvidence) {
    process.stdout.write(`${JSON.stringify({ status: 'OBJECT_TYPE_TARGETS', types: typeResolverEvidence })}\n`)
    for (const item of typeResolverEvidence) {
      assert(item.resolved === item.expected, `${item.type} resolved to ${item.resolved} instead of ${item.expected}`)
      assert(item.nonTargetStyleStable && item.outsideStable, `${item.type} runtime wrote outside its semantic owner: ${JSON.stringify(item)}`)
      if (item.type !== 'Background') assert(Boolean(item.targetStyle), `${item.type} supported transform did not reach its owner`)
      if (item.type === 'Container') assert(item.containerChildMoved, 'Container selection did not move its owned child subtree')
    }
  }

  const responsiveIsolationEvidence = process.env.PHASE037A_DIAGNOSTIC === '1' ? null : await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const settle=async()=>{await tick();await new Promise(resolve=>setTimeout(resolve,100));await tick()};
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const responsive=await import('/src/editor/responsiveLayout.ts');const id='portfolio-hero';
    const select=async()=>{const section=document.querySelector('#section-select');section.value='Portfolio';section.dispatchEvent(new Event('change',{bubbles:true}));await settle();const entity=document.querySelector('#entity-select');entity.value=id;entity.dispatchEvent(new Event('change',{bubbles:true}));await settle()};
    const preset=async value=>{document.querySelector('[data-canvas-preset="'+value+'"]').click();await settle()};
    const open=async()=>{const toggle=document.querySelector('[data-property-category="font"] .accordion-toggle');if(toggle?.getAttribute('aria-expanded')!=='true'){toggle.click();await settle()}};
    const captureOthers=()=>{const target=document.querySelector('[data-editor-object-id="'+id+'"]');const root=target.closest('.portfolio-section');return [...root.querySelectorAll('[data-editor-object-id],[class*="decor"],img,svg')].filter(node=>node!==target&&!target.contains(node)).map(node=>{const rect=node.getBoundingClientRect();return {inline:node.getAttribute('style')||'',rect:[rect.x,rect.y,rect.width,rect.height].map(value=>+value.toFixed(2))}})};
    const setX=async value=>{await open();const input=document.querySelector('[data-property-key="font.positionX"] input');input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));await settle();return editor.commandHistory.at(-1)};
    await select();const runtimeRoot=document.querySelector('.editor-preview-runtime');const baseBefore=JSON.stringify(editor.draftSnapshot.layout[id]??{});const virtualId=responsive.responsiveSnapshotEntityId('laptop',id);const laptopBefore=JSON.stringify(editor.draftSnapshot.layout[virtualId]);const laptopBeforeValue=editor.draftSnapshot.layout[virtualId]?.x;
    await preset('laptop-1024');const laptopOthers=captureOthers();const laptopCommand=await setX(41);const laptopAfterOthers=captureOthers();const laptopOverride=JSON.stringify(editor.draftSnapshot.layout[virtualId]);const baseAfterLaptop=JSON.stringify(editor.draftSnapshot.layout[id]??{});
    await preset('desktop-1440');const desktopOthers=captureOthers();const overrideBeforeDesktop=JSON.stringify(editor.draftSnapshot.layout[virtualId]);const desktopCommand=await setX(7);const desktopAfterOthers=captureOthers();const overrideAfterDesktop=JSON.stringify(editor.draftSnapshot.layout[virtualId]);const desktopValue=editor.draftSnapshot.layout[id]?.x;
    editor.undo();await settle();await preset('laptop-1024');editor.undo();await settle();await preset('desktop-1440');
    return {selected:editor.selectedObjectId,rootStable:runtimeRoot===document.querySelector('.editor-preview-runtime'),baseBefore,baseAfterLaptop,laptopBefore,laptopOverride,laptopCommand:{entityId:laptopCommand?.entityId,path:laptopCommand?.propertyPath},laptopSiblingStable:JSON.stringify(laptopOthers)===JSON.stringify(laptopAfterOthers),desktopCommand:{entityId:desktopCommand?.entityId,path:desktopCommand?.propertyPath},desktopSiblingStable:JSON.stringify(desktopOthers)===JSON.stringify(desktopAfterOthers),desktopValue,overrideStable:overrideBeforeDesktop===overrideAfterDesktop,restoredBase:JSON.stringify(editor.draftSnapshot.layout[id]??{})===baseBefore,restoredLaptop:Object.is(editor.draftSnapshot.layout[virtualId]?.x,laptopBeforeValue)};
  })()`)

  if (responsiveIsolationEvidence) {
    process.stdout.write(`${JSON.stringify({ status: 'RESPONSIVE_ISOLATION', ...responsiveIsolationEvidence })}\n`)
    assert(responsiveIsolationEvidence.selected === 'portfolio-hero' && responsiveIsolationEvidence.rootStable, 'breakpoint editing changed selection or remounted Preview')
    assert(responsiveIsolationEvidence.baseAfterLaptop === responsiveIsolationEvidence.baseBefore && responsiveIsolationEvidence.laptopOverride !== responsiveIsolationEvidence.laptopBefore, 'Tablet edit did not remain a sparse override')
    assert(responsiveIsolationEvidence.laptopCommand.entityId === 'portfolio-hero' && /layout\.rwd-laptop-.+\.x$/.test(responsiveIsolationEvidence.laptopCommand.path ?? '') && responsiveIsolationEvidence.laptopSiblingStable, `Tablet X edit escaped its object/breakpoint: ${JSON.stringify(responsiveIsolationEvidence)}`)
    assert(responsiveIsolationEvidence.desktopValue === 7 && responsiveIsolationEvidence.overrideStable && responsiveIsolationEvidence.desktopCommand.path === 'layout.portfolio-hero.x' && responsiveIsolationEvidence.desktopSiblingStable, `Desktop X edit overwrote Tablet or sibling state: ${JSON.stringify(responsiveIsolationEvidence)}`)
    assert(responsiveIsolationEvidence.restoredBase && responsiveIsolationEvidence.restoredLaptop, 'responsive isolation cleanup did not restore prior records')
  }

  const dependencyAlignmentEvidence = process.env.PHASE037A_DIAGNOSTIC === '1' ? null : await evaluate(`(async()=>{
    const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const settle=async()=>{await tick();await new Promise(resolve=>setTimeout(resolve,90));await tick()};
    const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');
    const select=async id=>{const object=editor.objects.find(candidate=>candidate.id===id);const section=document.querySelector('#section-select');section.value=object.section;section.dispatchEvent(new Event('change',{bubbles:true}));await settle();const entity=document.querySelector('#entity-select');entity.value=id;entity.dispatchEvent(new Event('change',{bubbles:true}));await settle()};
    const open=async category=>{const toggle=document.querySelector('[data-property-category="'+category+'"] .accordion-toggle');if(toggle?.getAttribute('aria-expanded')!=='true'){toggle.click();await settle()}};
    await select('portfolio-profile-media');await open('media');let outline=document.querySelector('[data-property-key="media.outlineEnabled"] input[type="checkbox"]');if(outline.checked){outline.click();await settle()}
    const thicknessOff=!document.querySelector('[data-property-key="media.outlineWidth"]');outline.click();await settle();const thickness=document.querySelector('[data-property-key="media.outlineWidth"] input');const thicknessOn=Boolean(thickness&&!thickness.disabled);thickness.value='5';thickness.dispatchEvent(new Event('input',{bubbles:true}));await settle();const image=document.querySelector('[data-editor-object-id="portfolio-profile-media"]');const inlineOutline=image.style.outline;const outlineWidth=getComputedStyle(image).outlineWidth;const outlineCommand=editor.commandHistory.at(-1);editor.undo();await settle();editor.undo();await settle();
    await select('about-frame-main');await open('layout');const mode=document.querySelector('[data-property-key="responsive.container.mode"]');const horizontal=[...mode.querySelectorAll('button')].find(button=>button.textContent.trim()==='Horizontal');const frame=document.querySelector('[data-editor-object-id="about-frame-main"]');const descendant=frame.querySelector('*');const descendantBefore=descendant?.getAttribute('style')||'';horizontal.click();await settle();const alignmentField=document.querySelector('[data-property-key="responsive.container.align"]');const alignment=alignmentField?.querySelector('select');const alignmentAvailable=Boolean(alignment&&!alignment.disabled);alignment.value='center';alignment.dispatchEvent(new Event('change',{bubbles:true}));await settle();const frameStyle=getComputedStyle(frame);const alignmentCommand=editor.commandHistory.at(-1);const descendantStable=(descendant?.getAttribute('style')||'')===descendantBefore;editor.undo();await settle();editor.undo();await settle();
    return {thicknessOff,thicknessOn,inlineOutline,outlineWidth,outlineCommand:{entityId:outlineCommand?.entityId,path:outlineCommand?.propertyPath},alignmentAvailable,display:frameStyle.display,alignItems:frameStyle.alignItems,alignmentCommand:{entityId:alignmentCommand?.entityId,path:alignmentCommand?.propertyPath},descendantStable,selection:editor.selectedObjectId};
  })()`)

  if (dependencyAlignmentEvidence) {
    process.stdout.write(`${JSON.stringify({ status: 'DEPENDENCY_ALIGNMENT', ...dependencyAlignmentEvidence })}\n`)
    assert(dependencyAlignmentEvidence.thicknessOff && dependencyAlignmentEvidence.thicknessOn && dependencyAlignmentEvidence.inlineOutline.includes('5px'), `Outline dependency is not functional: ${JSON.stringify(dependencyAlignmentEvidence)}`)
    assert(dependencyAlignmentEvidence.outlineCommand.entityId === 'portfolio-profile-media' && dependencyAlignmentEvidence.outlineCommand.path === 'media.styles.portfolio-profile-media.outlineWidth', 'Outline thickness escaped selected Image')
    assert(dependencyAlignmentEvidence.alignmentAvailable && dependencyAlignmentEvidence.display === 'flex' && dependencyAlignmentEvidence.alignItems === 'center', `Container alignment is enabled but has no effect: ${JSON.stringify(dependencyAlignmentEvidence)}`)
    assert(dependencyAlignmentEvidence.alignmentCommand.entityId === 'about-frame-main' && dependencyAlignmentEvidence.selection === 'about-frame-main' && dependencyAlignmentEvidence.descendantStable, 'Container alignment mutated a child directly or changed selection')
  }

  if (process.env.PHASE037A_DIAGNOSTIC !== '1') {
    await mkdir(path.join(projectRoot, 'artifacts'), { recursive: true })
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const select=async id=>{const object=editor.objects.find(candidate=>candidate.id===id);const section=document.querySelector('#section-select');section.value=object.section;section.dispatchEvent(new Event('change',{bubbles:true}));await tick();const entity=document.querySelector('#entity-select');entity.value=id;entity.dispatchEvent(new Event('change',{bubbles:true}));await tick()};await select('portfolio-hero');document.querySelector('.canvas-scroll').scrollTop=0;const group=document.querySelector('[data-property-category="font"]');if(group?.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true')group.querySelector('.accordion-toggle').click();document.querySelector('.control-panel').scrollTop=0;await tick();return true})()`)
    const textShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(projectRoot, 'artifacts', 'phase-037a-text-object-isolation.png'), Buffer.from(textShot.data, 'base64'))
    await evaluate(`(async()=>{const tick=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const editor=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('editor');const object=editor.objects.find(candidate=>candidate.id==='portfolio-profile-media');const section=document.querySelector('#section-select');section.value=object.section;section.dispatchEvent(new Event('change',{bubbles:true}));await tick();const entity=document.querySelector('#entity-select');entity.value=object.id;entity.dispatchEvent(new Event('change',{bubbles:true}));await tick();document.querySelector('.canvas-scroll').scrollTop=0;const group=document.querySelector('[data-property-category="media"]');if(group?.querySelector('.accordion-toggle')?.getAttribute('aria-expanded')!=='true')group.querySelector('.accordion-toggle').click();document.querySelector('.control-panel').scrollTop=0;await tick();return true})()`)
    const imageShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(path.join(projectRoot, 'artifacts', 'phase-037a-image-object-isolation.png'), Buffer.from(imageShot.data, 'base64'))
  }

  const seriousErrors = runtimeErrors.filter((error) => !/favicon|ERR_NAME_NOT_RESOLVED|Supabase configuration is unavailable/i.test(error))
  assert(seriousErrors.length === 0, `unexpected browser errors: ${seriousErrors.join(' | ')}; vite=${viteErrors}; browser=${browserErrors}`)
} finally {
  socket?.close()
  stopChildren()
  await wait(150)
  try { await rm(profilePath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 }) } catch { /* Chromium may briefly retain its profile lock. */ }
}
