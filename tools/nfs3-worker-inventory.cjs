'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
// Harness-only transport tag. No guest memory, clock, dispatch or polling changes.
function installPageObserver(){
  const Native=globalThis.Worker, records=new Map(),ids=new WeakMap(),refs=new WeakMap();let serial=0,refSerial=0;
  const ref=x=>{if(!x||!['object','function'].includes(typeof x))return null;if(!refs.has(x))refs.set(x,++refSerial);return refs.get(x);};
  const generation=crypto.randomUUID();
  globalThis.Worker=class extends Native{
    constructor(...args){super(...args);const id=generation+':'+(++serial);
      const r={id,url:String(args[0]),createdAt:Date.now(),terminatedAt:null,init:null,module:null,memory:null};
      records.set(id,r);ids.set(this,id);
      const post=this.postMessage.bind(this),terminate=this.terminate.bind(this);
      this.postMessage=(message,...rest)=>{
        if(message&&['init','render-init'].includes(message.t)){
          if(r.init)throw Error('UNKNOWN repeated Worker initialization');
          r.init={kind:message.t,endpoint:message.endpointIdentity??null,slot:message.slot??null};
          r.module=message.module;r.memory=message.memory;
          return post({...message,__nfsInventoryActor:id},...rest);
        }return post(message,...rest);
      };
      this.terminate=(...rest)=>{const result=terminate(...rest);r.terminatedAt=Date.now();return result;};
    }
  };
  globalThis.__nfsWorkerInventory={snapshot(wine){
    const owners=[],backend=wine?.guestWorker;
    const add=(worker,module,memory,kind,endpoint,slot)=>{
      const id=ids.get(worker),r=records.get(id);
      if(!r||r.terminatedAt||r.module!==module||r.memory!==memory||memory!==wine.memory||module!==wine._wasmModule)
        throw Error('UNKNOWN actual owner/module/memory generation');
      if(kind==='guest'&&(r.init?.endpoint!==endpoint||r.init?.slot!==slot))throw Error('UNKNOWN endpoint/slot generation');
      owners.push({id,kind,endpoint,slot});
    };
    if(!backend||backend._stopped||wine._stopped||!backend.link||backend.link._retirementComplete||backend.link._transportFailure)throw Error('UNKNOWN required backend retired');
    const links=new Set([backend.link,...backend.threadLinks.values(),...(backend._startingLinks||[]),...(backend._retirementLinks||[])]);
    for(const link of links){if(!link)continue;if(link._retirementComplete)continue;
      if(link._transportFailure)throw Error('UNKNOWN live transport failure');
      add(link.worker,link.module,link.memory,'guest',link.endpointIdentity,link.slot);
      owners[owners.length-1].linkGeneration=ref(link);}
    const manager=wine._renderWorkerManager;
    if(manager){if(manager._retired)throw Error('UNKNOWN required render owner retired');
      add(manager.worker,manager.options.module,manager.options.memory,'render',null,null);}
    const win=wine.renderer?.windows,windowIds=win?Object.keys(win).filter(id=>win[id]?.visible).map(id=>({id,generation:ref(win[id]),processId:win[id].processId})):[];
    const endpoints=manager?[...manager.ports].map(([id,port])=>({id,generation:ref(port),closed:!!port.closed,api:port.options?.api})):[];
    if(endpoints.some(e=>e.closed))throw Error('UNKNOWN required endpoint closed');
    return {generation,owners,windowIds,processId:wine.processId,backendGeneration:ref(backend),processGeneration:ref(wine._processObject),managerGeneration:ref(manager),endpoints,
      records:[...records.values()].filter(r=>r.init).map(({module,memory,...r})=>r)};
  }};
}
function workerBootstrap(){return `;addEventListener('message',function nfsInventoryTag(e){if(e.data?.__nfsInventoryActor){globalThis.__nfsInventoryActor=e.data.__nfsInventoryActor;console.debug('NFS_INVENTORY_ACTOR',globalThis.__nfsInventoryActor);removeEventListener('message',nfsInventoryTag);}});\n`;}
async function moduleBytes(session,target){
  const modules=[],tasks=[];let first;
  const parsed=e=>{if(e.scriptLanguage!=='WebAssembly'&&!e.url?.startsWith('wasm:'))return;
    const task=session.send('Debugger.getScriptSource',{scriptId:e.scriptId}).then(r=>{
      assert(r.bytecode,'UNKNOWN missing native module bytes');const b=Buffer.from(r.bytecode,'base64');
      modules.push({target,scriptId:e.scriptId,sha256:crypto.createHash('sha256').update(b).digest('hex'),size:b.length});
    });task.catch(()=>{});tasks.push(task);};
  session.on('Debugger.scriptParsed',parsed);
  try{await session.send('Debugger.enable');await Promise.all(tasks);}catch(e){first=e;}
  finally{session.off('Debugger.scriptParsed',parsed);
    // An UNKNOWN closes this scope. Do not issue a cleanup endpoint request.
    if(!first)try{await session.send('Debugger.disable');}catch(e){first=e;}}
  if(first)throw first;return modules;
}
function track(browser){
  const rows=[],tasks=[];let first=null,closed=false;
  const created=target=>{if(closed||!['other','worker'].includes(target.type()))return;
    const row={target,session:null,actor:null,destroyed:false};rows.push(row);
    const task=(async()=>{row.session=await target.createCDPSession();
      row.session.on('Runtime.consoleAPICalled',e=>{if(e.args?.[0]?.value==='NFS_INVENTORY_ACTOR'){
        const id=e.args[1]?.value;if(row.actor&&row.actor!==id)first||=Error('UNKNOWN target actor changed');row.actor=id;}});
      await row.session.send('Runtime.enable');})();tasks.push(task);task.catch(e=>{first||=e;});
  };
  const destroyed=target=>{const row=rows.find(r=>r.target===target);if(row)row.destroyed=true;};
  browser.on('targetcreated',created);browser.on('targetdestroyed',destroyed);
  return {rows,async ready(){await Promise.all(tasks);if(first)throw first;},close(){closed=true;browser.off('targetcreated',created);browser.off('targetdestroyed',destroyed);}};
}
async function inventory({snapshot,tracker,sha256,read=moduleBytes}){
  await tracker.ready();const before=await snapshot(),modules=[],retired=[];
  assert(before.owners.length>0,'UNKNOWN empty actual owners');
  assert.equal(new Set(before.owners.map(o=>o.id)).size,before.owners.length,'UNKNOWN duplicate owner');
  const active=new Set(before.owners.map(o=>o.id));
  for(const record of before.records){
    if(active.has(record.id))assert(!record.terminatedAt,'UNKNOWN retired required owner');
    else {assert(record.terminatedAt,'UNKNOWN initialized nonowner without retirement');
      retired.push({...record,byteIdentity:null,reason:'terminated nonowner; bytes not recovered before retirement'});}
  }
  for(const row of tracker.rows){
    if(row.actor&&!active.has(row.actor))assert(retired.some(r=>r.id===row.actor),'UNKNOWN unaccounted target');
    if(row.destroyed)assert(retired.some(r=>r.id===row.actor),'UNKNOWN unexpected target disconnect');
  }
  for(const owner of before.owners){
    const matches=tracker.rows.filter(r=>r.actor===owner.id);assert.equal(matches.length,1,'UNKNOWN required target not uniquely bound');
    const row=matches[0];assert(!row.destroyed,'UNKNOWN live owner disconnected');
    const bytes=await read(row.session,row.target.url());assert.equal(bytes.length,1,'UNKNOWN owner native module count');
    assert.equal(bytes[0].sha256,sha256,'UNKNOWN native byte hash mismatch');modules.push({...bytes[0],owner});
  }
  const after=await snapshot();assert.deepEqual(after,before,'UNKNOWN owner/generation/window changed during inventory');
  return {snapshot:before,modules,retired,fixtureCountAssumption:false};
}
module.exports={installPageObserver,workerBootstrap,moduleBytes,track,inventory};
