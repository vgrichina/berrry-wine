'use strict';
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const api=require('../lib/drakan-observer-worker.js');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const SELECTED='a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295';
const { requireLiveIdentity } = require('./drakan-live-identity.cjs');
let current;
exports.binding=async function(p){
 const request=JSON.parse(p.payload);assert(current&&request.token===current.token,'bound independent release caller');
 const {evaluate,token}=current;
 try{const receipt=current.probe?{probe:true}:await current.release();await evaluate(`__drakanCaller.ack(${JSON.stringify(token)},null,${JSON.stringify(receipt)})`);}
 catch(error){await evaluate(`__drakanCaller.ack(${JSON.stringify(token)},${JSON.stringify(String(error))})`);}
};
// Extracted from the retained 0635 actual caller. runtimePins is its independently
// pinned closure manifest. This entry point conveys no original authorization.
exports.hold=async function({send,evaluate,workers,session,identity,holdMs,save,root,runtimePins}){
 assert(!current&&identity.moduleSha256===SELECTED&&holdMs>=50&&holdMs<=1900,'fresh canonical owner and bounded T');
 const owners=[...workers.values()].filter(w=>!w.closed&&w.targetId===identity.workerTarget);assert.equal(owners.length,1);
 const page=await evaluate(`(async()=>{const w=runningApps[0].wine,g=w.guestWorker,l=g.link,o=drakanBrowserOwners.get(w);if(!o||o.used||o.link!==l||o.worker!==g||o.module!==w._wasmModule||o.memory!==w.memory||o.instance!==w.instance||l._stopping||l._stopped||WINE_DRAKAN_OBSERVER!==true)throw Error('actual integrated browser owner unavailable');const b=l.drakanModuleBytes;if(!b)throw Error('actual selected bytes unavailable');return {moduleMap:w.moduleMap,bytes:b.byteLength,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join(''),endpoint:l.endpointIdentity,slot:l.slot,process:w.processId,bridge:typeof __drakanReleaseRequest==='function'&&!__drakanCaller.used}})()`);
 assert.equal(page.sha256,SELECTED);assert.equal(page.bytes,2185596);assert(page.bridge&&page.endpoint===identity.endpoint&&page.slot===0&&page.process===identity.processId);
 const modules=page.moduleMap.filter(m=>m.name.toLowerCase()==='dragon.rfl');assert.equal(modules.length,1);const base=modules[0].base;

 const media=runtimePins.files;
 const find=sha=>{const p=media.filter(p=>p.sha256===sha);assert.equal(p.length,1);const b=fs.readFileSync(root+'/'+p[0].path);assert.equal(hash(b),sha);return b;};
 const pins=await api.installedPins(find(api.MEDIA.exe),find(api.MEDIA.rfl),base);
 const windows=Object.fromEntries(Object.entries(pins).map(([k,p])=>[k,{address:p.address,count:p.bytes.length}]));
 const live=await evaluate(`(()=>{const d=new DataView(memory.buffer),g=a=>{const p=a-0x400000+RegionMap.BASE.GUEST_BASE;if(p<RegionMap.BASE.GUEST_BASE||p+4>RegionMap.BASE.VIRTUAL_BACKING_BASE)throw Error('direct window');return p;},u=a=>d.getUint32(g(a),true),object=u(0x47b700),actor=u(object+0xa0),devices=[];for(let a=RegionMap.BASE.DX_OBJECTS;a<RegionMap.REGIONS.DX_OBJECTS.end;a+=32)if(d.getUint32(a,true)===7&&d.getUint32(a+8,true)===1)devices.push(a);return {object,actor,back:u(actor+0x58),vtable:u(actor),base:u(object+0xa8)-0x4b320,devices,endpoint:endpointIdentity,slot:workerSlot,process:Atomics.load(new Int32Array(memory.buffer),RegionMap.BASE.SHARED_PROCESS_ID>>>2),epoch:Number(Atomics.load(new BigUint64Array(memory.buffer),(RegionMap.BASE.CALLBACK_OWNERSHIP+8)>>>3)),root:String(instance.exports.null_diag_root()),token:String(instance.exports.null_diag_token()),thread:instance.exports.get_current_thread_id(),pins:Object.fromEntries(Object.entries(${JSON.stringify(windows)}).map(([k,p])=>[k,Array.from(new Uint8Array(memory.buffer,g(p.address),p.count))]))}})()`,owners[0].sessionId);
 requireLiveIdentity({live,base,identity,save});
 assert.equal(live.devices.length,1);for(const [k,p] of Object.entries(pins))assert.deepEqual(live.pins[k],Array.from(p.bytes),k+' fresh relocated code');
 save('pre-down-gates',{page,live,installedMedia:api.MEDIA,pins:Object.fromEntries(Object.entries(pins).map(([k,p])=>[k,{address:p.address,size:p.bytes.length,sha256:hash(p.bytes)}])),guestWrites:0,extraInputPolls:0});
 // Observable bridge probe, with no physical input, before arming the original.
 const token=crypto.randomUUID();current={token,probe:true,evaluate};
 const probe=await evaluate(`__drakanCaller.bridge(${JSON.stringify(token)})`);assert(probe.probe);current=null;
 const request={base,object:live.object,actor:live.actor,keyboardDevice:live.devices[0],maxMs:holdMs,token,pins:Object.fromEntries(Object.entries(pins).map(([k,p])=>[k,{address:p.address,bytes:Array.from(p.bytes)}]))};
 await evaluate(`(()=>{const s=__drakanCaller;if(s.armed||s.used)throw Error('caller already armed');s.armed=${JSON.stringify(request)};const l=runningApps[0].wine.guestWorker.link;l.worker.addEventListener('message',()=>setTimeout(()=>{const c=l.drakanController;if(c?.completed&&!c.stopped)c.stop('first qualified COMPLETE');},0));return true})()`);
 const event={key:'t',code:'KeyT',windowsVirtualKeyCode:84};let promise,timer,finished,releaseAt;
 const started=Date.now();
 const release=()=>promise??=(async()=>{releaseAt=Date.now();await send('Input.dispatchKeyEvent',{type:'keyUp',...event},session);finished=Date.now();const receipt={started,releaseAt,finished,elapsedMs:finished-started,physicalCompletion:true};save('physical-release',receipt);assert(finished-started<=2000,'actual physical completion exceeded 2000ms');return receipt;})();
 current={token,evaluate,release};
 try{
  timer=setTimeout(()=>release().catch(()=>{}),holdMs); // PREARM before native down dispatch.
  await send('Input.dispatchKeyEvent',{type:'keyDown',...event},session);
  const result=await evaluate(`__drakanCaller.outcome`);assert(result,'trusted down observer missing');save('browser-result',result);
  await release();
  const events=await evaluate('__drakanCaller.events');const downs=events.filter(e=>e.code==='KeyT'&&e.type==='keydown'),ups=events.filter(e=>e.code==='KeyT'&&e.type==='keyup');assert.equal(downs.length,1);assert.equal(ups.length,1);assert(downs[0].trusted&&ups[0].trusted&&ups[0].at-downs[0].at<=2000);
  save('trusted-input',{events,physicalCompletion:finished,requestedMs:holdMs});
  assert(result.ok,'browser observer error: '+result.error);return {started,releaseAt,finished,result};
 }finally{clearTimeout(timer);try{await release();}finally{current=null;}}
};
