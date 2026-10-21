'use strict';
// Capture only. Original program, host source and module remain unmodified.
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const root='/home/user/madbomber-fps',repo=root+'/repo',out=root+'/evidence/session1';fs.mkdirSync(out,{recursive:true});
const puppeteer=require(repo+'/node_modules/puppeteer');
const pause=ms=>new Promise(r=>setTimeout(r,ms)),save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2));
const expected=fs.readFileSync(root+'/unpacked-analysis.bin').subarray(0x3d01,0x57c1).toString('hex');
let browser,page,server,closed=false;const logs=[],errors=[],network=[],inputs=[],moduleResponses=[],costs=[];const start=Date.now();
async function shot(name){let t=performance.now();await page.screenshot({path:out+'/'+name+'.png'});costs.push({kind:'screenshot',name,ms:performance.now()-t});save(name+'.json',await page.evaluate(()=>({at:performance.now(),origin:performance.timeOrigin,utc:new Date().toISOString(),url:location.href,text:document.body.innerText.slice(-10000),sample:globalThis.__mb?.sample(false)})));}
async function key(k){inputs.push({kind:'key',key:k,at:new Date().toISOString()});await page.keyboard.down(k);await pause(100);await page.keyboard.up(k);}
async function move(x){inputs.push({kind:'mouse',x,y:640,at:new Date().toISOString()});await page.mouse.move(x,640);}
async function close(reason){if(closed)return;closed=true;
 if(page&&!page.isClosed())try{save('restore.json',await page.evaluate(()=>{const h=globalThis.__mb;if(!h)return null;clearInterval(h.timer);const records=h.owners.map(o=>{o.ex.set_logical_frame(o.prior.addr,o.prior.pace);return {id:o.id,prior:o.prior,restored:{addr:o.ex.get_logical_frame_addr(),pace:o.ex.get_logical_frame_pace()}}});for(const fn of h.restore)fn();return {records,events:h.events,at:performance.now()};}));}catch(e){errors.push('restore '+e);}
 await browser?.close();if(server){server.kill('SIGTERM');await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));}
 save('console.json',logs);save('errors.json',errors);save('network.json',network);save('inputs.json',inputs);save('module-responses.json',moduleResponses);save('costs.json',costs);save('cleanup.json',{reason,at:new Date().toISOString(),elapsedMs:Date.now()-start,serverPid:server?.pid});
}
process.on('SIGTERM',()=>close('SIGTERM').then(()=>process.exit(1)));
const deadline=setTimeout(()=>close('60-second browser-session deadline').then(()=>process.exit(1)),60000);
(async()=>{
 server=cp.spawn('node',['tools/dev-server.js','--port=8080','--host=127.0.0.1','--isolate','--no-agent-inject'],{cwd:repo,stdio:['ignore',fs.openSync(out+'/server.log','a'),fs.openSync(out+'/server.log','a')]});await pause(700);
 browser=await puppeteer.launch({headless:false,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding'],env:{...process.env,DISPLAY:':0'},protocolTimeout:15000,timeout:20000});
 page=await browser.newPage();await page.setViewport({width:1000,height:760});
 page.on('console',m=>{if(logs.length<2000)logs.push({at:new Date().toISOString(),type:m.type(),text:m.text().slice(0,2500)});});page.on('pageerror',e=>errors.push(String(e)));
 page.on('requestfailed',r=>network.push({at:new Date().toISOString(),url:r.url(),failure:r.failure()}));
 page.on('response',async r=>{network.push({at:new Date().toISOString(),url:r.url(),status:r.status()});if(/\.wasm(?:\?|$)/.test(r.url()))try{const b=await r.buffer();moduleResponses.push({url:r.url(),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}catch(e){errors.push('module capture '+e);}});
 await page.goto('http://127.0.0.1:8080/index.html?app=madbomber&debug',{waitUntil:'load',timeout:30000});
 save('identity.json',{revision:'f09e09c6643997986bbafad69c37adae4906df90',browser:await browser.version(),node:process.version,route:page.url(),startedAt:new Date(start).toISOString(),pid:process.pid,chromePid:browser.process().pid,serverPid:server.pid,viewport:page.viewport()});
 save('gpu.json',await(await browser.target().createCDPSession()).send('SystemInfo.getInfo'));
 await page.waitForFunction(()=>runningApps.some(a=>a.name==='madbomber'&&a.wine.running),{timeout:20000});await pause(4000);await shot('menu');
 save('owner-inventory.json',await page.evaluate(expected=>{
  const app=runningApps.find(a=>a.name==='madbomber'),w=app.wine;
  if(w.guestWorker)throw Error('unexpected guest Worker backend');
  const tm=w.threadManager,h=globalThis.__mb={w,tm,original:w.instance,owners:[],rows:[],events:[],restore:[],timer:null};
  function add(id,instance){if(!instance)throw Error('missing instance '+id);const ex=instance.exports;h.owners.push({id,instance,ex,prior:{addr:ex.get_logical_frame_addr(),pace:ex.get_logical_frame_pace()},thread:ex.get_current_thread_id()});}
  add('main',w.instance);for(const [handle,t] of tm.threads){if(t.instance)add('cooperative-'+handle,t.instance);else throw Error('nonlocal owner '+handle);}
  h.read=()=>Array.from(new Uint8Array(w.memory.buffer,0x403d01-w.instance.exports.get_image_base()+0x12000,expected.length/2),b=>b.toString(16).padStart(2,'0')).join('');
  if(h.read()!==expected)throw Error('live original game-loop code does not match independently unpacked original');
  h.code=expected;h.words=new DataView(w.memory.buffer);h.word=addr=>h.words.getUint32(addr-h.original.exports.get_image_base()+0x12000,true);
  // Capture forwarding calls; do not replace exports or alter calls/results.
  function watch(obj,key){const orig=obj[key];obj[key]=function(...args){h.events.push({kind:key,args:args.map(a=>typeof a==='object'?'[object]':a),at:performance.now()});return Reflect.apply(orig,this,args);};h.restore.push(()=>obj[key]=orig);}
  watch(w,'_setLogicalFrame');watch(tm,'setWasmGlobalAll');watch(tm.threads,'set');watch(tm.threads,'delete');watch(tm.threads,'clear');
  // Observe replacement of the main instance, preserving ordinary reads/writes.
  const descriptor=Object.getOwnPropertyDescriptor(w,'instance');let live=w.instance;
  Object.defineProperty(w,'instance',{configurable:true,enumerable:descriptor.enumerable,get:()=>live,set:v=>{h.events.push({kind:'instance-replaced',at:performance.now()});live=v;}});h.restore.push(()=>Object.defineProperty(w,'instance',{...descriptor,value:live}));
  h.sample=(store=true)=>{const begin=performance.now();const rows=h.owners.map(o=>{const b=performance.now(),count=o.ex.get_logical_frame_count()>>>0,hostMs=performance.now();return {owner:o.id,thread:o.ex.get_current_thread_id(),count,hostMs,pairReadMs:hostMs-b,addr:o.ex.get_logical_frame_addr(),pace:o.ex.get_logical_frame_pace(),paced:o.ex.get_logical_frame_paced(),sameInstance:o.id==='main'?w.instance===o.instance:[...tm.threads.values()].some(t=>t.instance===o.instance)};});const r={utc:new Date().toISOString(),origin:performance.timeOrigin,rows,running:w.running,active:h.word(0x411a40),gameFrame:h.word(0x40fd40),bucketX:h.word(0x413280),bomberX:h.word(0x40fcd0),codeMatches:h.read()===h.code,events:h.events.length,ownerCount:1+tm.threads.size,sampleCostMs:0};r.sampleCostMs=performance.now()-begin;if(store)h.rows.push(r);return r;};
  for(const o of h.owners)o.ex.set_logical_frame(0x403d01,0);
  return {backend:tm.backend,guestWorker:!!w.guestWorker,mainInstanceEqualsManager:tm.mainInstance===w.instance,owners:h.owners.map(o=>({id:o.id,thread:o.thread,prior:o.prior})),liveCode:h.code,initial:h.sample(),render:{rendererType:w.renderer?.constructor?.name,context:w.renderer?.ctx?.constructor?.name},threads:[...tm.threads].map(([handle,t])=>({handle,tid:t.tid,state:t.state,startAddr:t.startAddr}))};
 },expected));
 inputs.push({kind:'click',x:330,y:199,at:new Date().toISOString()});await page.mouse.click(330,199);await key('Enter');await pause(1200);await move(612);await key('Space');await pause(300);
 await page.evaluate(()=>{const h=__mb;h.rows=[];h.sample();h.timer=setInterval(()=>h.sample(),100);});await pause(700);
 const probe=await page.evaluate(()=>{const h=__mb;clearInterval(h.timer);h.sample();return h.rows;});save('short-probe.json',probe);
 const {validate}=require(root+'/validate.js');
 const positive=probe[0].rows.filter(o=>probe.at(-1).rows.find(x=>x.owner===o.owner).count>o.count);assert.equal(positive.length,1,'unique emitting instance');const owner=positive[0].owner;
 const gate=validate(probe,owner);assert(gate.accepted,JSON.stringify(gate));
 const controls=[];for(const o of probe[0].rows.filter(o=>o.owner!==owner)){const r=validate(probe,o.owner,owner);assert(!r.accepted&&r.fps===null);controls.push({kind:'live wrong owner',owner:o.owner,result:r});}
 for(const [kind,edit] of [['disabled',p=>p[1].rows.find(o=>o.owner===owner).addr=0],['owner-change',p=>p[1].rows.find(o=>o.owner===owner).thread+=1],['clock-change',p=>p[1].origin+=1],['count-reset',p=>p[1].rows.find(o=>o.owner===owner).count=0],['lifecycle',p=>p[1].events++],['inactive',p=>p[1].active=0]]){const p=structuredClone(probe);edit(p);const r=validate(p,owner);assert(!r.accepted&&r.fps===null,kind);controls.push({kind,result:r});}
 save('premeasurement-gate.json',{at:new Date().toISOString(),owner,gate,controls});
 await shot('measure-before');
 await page.evaluate(()=>{const h=__mb;h.rows=[];h.sample();h.timer=setInterval(()=>h.sample(),100);});
 // Short actual active-play interval; no clock scaling or gameplay memory writes.
 await pause(1800);await shot('measure-during-right');await move(578);await pause(600);await move(530);await pause(500);await move(450);await pause(600);await move(358);await pause(500);
 const measured=await page.evaluate(()=>{const h=__mb;clearInterval(h.timer);h.sample();return {samples:h.rows,events:h.events,ownerInventory:h.owners.map(o=>({id:o.id,thread:o.thread})),endedAt:performance.now()};});save('measurement-raw.json',measured);save('validation.json',validate(measured.samples,owner));await shot('measure-after');
 await close('bounded measurement completed');clearTimeout(deadline);console.log('complete',JSON.stringify(validate(measured.samples,owner)));
})().catch(async e=>{errors.push(e.stack||String(e));save('failure.json',{error:e.stack||String(e)});console.error(e);await close('capture failure');clearTimeout(deadline);process.exitCode=1;});
