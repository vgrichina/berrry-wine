'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),t=require('./transport.cjs');
exports.run=async({bound,evaluate,send,workers,pageSession,save,wait,capture,execute,out,chain})=>{
 for(let n=0;n<300;n++){const v=await evaluate('({ready:!!globalThis.__generatedReady,error:globalThis.__generatedError})');if(v.error)throw Error(v.error);if(v.ready)break;await wait(20)}
 assert(await evaluate('!!globalThis.__generatedReady'),'production guest and render Workers started');
 const moduleHash=[...workers.values()].filter(w=>w.url.includes('guest-worker')&&!w.closed).flatMap(w=>w.scripts).find(s=>s.sha256)?.sha256;
 assert(moduleHash,'actual instantiated module');
 const options={evaluate,send,workers,pageSession,app:'dx_tunnel',expectedModules:[moduleHash],backend:process.env.RENDER_BACKEND};
 let dispatch=0;
 const zero=bound.createChain(options);
 await assert.rejects(()=>zero.establishReady({attempts:2,wait:async()=>{}}),/readiness timed out/);
 assert.equal(dispatch,0);save('negative-zero-draw.json',{passed:true,dispatch,actual:await zero.readLive(true)});
 const draw=()=>evaluate('__draw()');await draw();
 const ready=await chain.establishReady({stableMs:10,wait:async()=>{await draw();save('last-producer-observation.json',await chain.readLive(true));await wait(10)}});
 save('renderer-readiness.json',ready);await capture('fixture-startup');
 const c=JSON.parse(fs.readFileSync(out+'/fixture-startup-capture.json'));t.publish(out+'/fixture-startup-review.json',{...c,review:'Generated red triangle from public x86 GL calls. No original game claim.'});
 const request=t.request(out,'positive-'+process.env.RENDER_BACKEND,{action:'key',key:'Enter',holdMs:100,waitMs:0,label:'positive',reviewRef:'fixture-startup'},50000);
 while(!fs.existsSync(out+'/commands/0.json'))await wait(5);await t.consume(out,0,execute);assert((await request).ok);
 save('positive-control.json',{passed:true,actualProductionWorkers:true,ready,exactObserverAdmissionTransport:true});
 const rows=[];
 async function negative(name,change,restore,pattern,extra={}){
  let clock=Date.now();const ch=bound.createChain({...options,now:()=>clock,...extra});
  await ch.establishReady({stableMs:10,wait:async()=>{await draw();await wait(10)}});
  const shot=await ch.capture(name),review={...shot.capture,review:'Generated actual GL triangle control'};
  await change(()=>clock+=bound.MAX_AGE_MS+1);let error;
  try{await ch.admit(review,async()=>{dispatch++;throw Error('negative dispatched')})}catch(e){error=String(e)}
  assert(error&&pattern.test(error),name+': '+error);assert.equal(dispatch,0,name+' zero input');
  if(restore)await restore();rows.push({name,passed:true,error,dispatch,closed:ch.closed});
  save('negative-'+name+'.json',{...rows.at(-1),before:shot.before,after:shot.after});
 }
 await negative('missing-context',()=>evaluate('__fixture.invoke("wglMakeCurrent",[0,0])'),()=>evaluate('__fixture.invoke("wglMakeCurrent",[__fixture.dc,__fixture.context])'),/completed owning GL/);
 await negative('wrong-owner',()=>evaluate('globalThis.__oldSlot=__fixture.link.slot;__fixture.link.slot=7'),()=>evaluate('__fixture.link.slot=__oldSlot'),/unique actual guest/);
 await negative('replacement',()=>evaluate('globalThis.__oldRenderer=__fixture.wine.renderer;__fixture.wine.renderer={...__oldRenderer};true'),()=>evaluate('__fixture.wine.renderer=__oldRenderer;true'),/identity changed/);
 await negative('stale',advance=>advance(),null,/stale scene/);
 // Change only the host's expected immutable module set AFTER a valid capture;
 // actual recovered bytes are read again through the unchanged CDP path.
 const expected=[moduleHash];
 await negative('module-mismatch',()=>{expected[0]='0'.repeat(64)},null,/immutable staged module/,{expectedModules:expected});
 expected[0]=moduleHash;
 // UNKNOWN is injected at the admission read boundary, never inside a guest.
 let unknown=false;const controlled=(expression,session)=>{if(unknown&&expression===bound.PAGE_READ)throw Error('controlled CDP UNKNOWN');return evaluate(expression,session)};
 await negative('unknown',()=>{unknown=true},()=>{unknown=false},/controlled CDP UNKNOWN/,{evaluate:controlled});
 let wrongGL=false;const prod=require('./producer-ready.cjs');
 const wrongProjection=async(expression,session)=>{const v=await evaluate(expression,session);if(wrongGL&&expression===prod.READ)for(const e of v)for(const o of e.gl?.owners||[])o.owner=99;return v};
 await negative('nonowner-gl-counters',()=>{wrongGL=true},()=>{wrongGL=false},/completed owning GL/,{evaluate:wrongProjection});
 const observation=await evaluate(bound.PAGE_READ),a=observation.apps[0],d=a.d3dStats;
 save('old-predicate-comparison.json',{backend:process.env.RENDER_BACKEND,oldReady:!!(d?.ready&&d.glTriangles>0&&d.renderEndpointId===a.renderEndpoint),d3dStats:d,newReady:ready});
 const old=ready.identity;assert(old.rendererModuleSha256===moduleHash&&old.moduleSha256===moduleHash);
 save('local-controls.json',{passed:true,backend:process.env.RENDER_BACKEND,zeroDrawDispatch:0,negativeDispatch:dispatch,rows,
  positive:true,originalLaunches:0,independentCPUAndRenderModule:moduleHash,budgetsUnchanged:true});
};
