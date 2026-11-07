'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const transport=require('../tools/mw3-run-transport.cjs');
const epoch=Date.parse('2026-11-07T22:00:00Z');
function fixture(t,remaining=180000){
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'mw3-deadline-'));
 t.after(()=>fs.rmSync(out,{recursive:true,force:true}));
 fs.mkdirSync(out+'/commands');
 fs.writeFileSync(out+'/execution-window.json',JSON.stringify({browserStop:new Date(epoch+remaining).toISOString()}));
 t.mock.timers.enable({apis:['Date','setTimeout'],now:epoch});
 return out;
}
async function advance(t,ms){for(let n=0;n<ms;n+=10){t.mock.timers.tick(Math.min(10,ms-n));for(let i=0;i<8;i++)await Promise.resolve();}}
const command={action:'capture',label:'settled-cockpit',waitMs:30000};
test('actual numbered ACK path budgets 30s passive wait and bounded capture work',async t=>{
 const out=fixture(t);let effects=0;
 const request=transport.request(out,'settle-cockpit',command,20000);
 const published=JSON.parse(fs.readFileSync(out+'/commands/0.json'));
 assert.equal(published.timing.ackEnd-epoch,52000);
 const consume=transport.consume(out,0,async c=>{effects++;await new Promise(r=>setTimeout(r,c.waitMs+500));});
 await advance(t,20010);assert(!fs.existsSync(out+'/transport-closed.json'));
 await advance(t,10510);assert.equal((await request).id,'settle-cockpit');await consume;
 assert.equal(effects,1);
 await assert.rejects(transport.request(out,'settle-cockpit',command,20000),/EEXIST/);
 await assert.rejects(transport.consume(out,0,()=>{effects++;}),/duplicate ID/);
 assert.equal(effects,1);
});
test('cannot fit cleanup reserve: no publication or consumed UUID',async t=>{
 const out=fixture(t,81999);
 await assert.rejects(transport.request(out,'no-room',command,20000),/not queued/);
 assert.deepEqual(fs.readdirSync(out+'/commands'),[]);assert(!fs.existsSync(out+'/id-no-room'));
 for(const waitMs of [-1,30001,Infinity,NaN])assert.throws(()=>transport.budget(out,{...command,waitMs}),/bounded passive/);
 for(const timeout of [0,55001,Infinity])assert.throws(()=>transport.budget(out,command,timeout),/bounded ACK/);
});
test('first UNKNOWN stays closed after late ACK; no resend or subsequent execution',async t=>{
 const out=fixture(t);let effects=0;
 const request=transport.request(out,'late',command,20000);const rejected=assert.rejects(request,/ACK deadline/);
 // An external producer finishes late, as in the retained run. It cannot reopen admission.
 setTimeout(()=>{effects++;transport.publish(out+'/reply-0.json',{ok:true,id:'late'});},53000);
 await advance(t,52010);await rejected;assert(fs.existsSync(out+'/transport-closed.json'));
 await advance(t,1000);assert.equal(effects,1);
 await assert.rejects(transport.request(out,'late',command,20000),/EEXIST/);
 await assert.rejects(transport.request(out,'next',command,20000),/sticky/);
 assert.equal(fs.readdirSync(out+'/commands').length,1);
 await assert.rejects(transport.consume(out,0,()=>{effects++;}),/sticky/);assert.equal(effects,1);
});
test('bounded work fault cancels timer and stops on first UNKNOWN',async t=>{
 const out=fixture(t);let dispatches=0;
 const request=transport.request(out,'work-timeout',{...command,waitMs:0});
 const rejected=assert.rejects(request,/runtime first fault/);
 const consumed=assert.rejects(transport.consume(out,0,async(c,mark)=>{mark();dispatches++;await new Promise(()=>{});}),/work deadline/);
 await advance(t,20010);await consumed;await rejected;
 assert.equal(dispatches,1);assert(fs.existsSync(out+'/first-failure.json'));
 await assert.rejects(transport.request(out,'after-fault',{...command,waitMs:0}),/sticky/);
});
test('zero-effect stale refusal permits only a new capture',async t=>{
 const out=fixture(t);const c={...command,waitMs:0};
 const first=transport.request(out,'stale',c);
 await transport.consume(out,0,async()=>{throw Object.assign(Error('stale'),{code:'STALE_SCENE_BEFORE_DISPATCH'});});
 await advance(t,20);assert.equal((await first).status,'refused-before-dispatch');
 await assert.rejects(transport.request(out,'key',{action:'key',key:'e',waitMs:0}),/ONLY fresh capture/);
 const fresh=transport.request(out,'refresh',c);await transport.consume(out,1,async()=>{});
 await advance(t,20);assert.equal((await fresh).id,'refresh');
});
test('wrong ACK identity is terminal and cannot admit a next command',async t=>{
 const out=fixture(t);const c={...command,waitMs:0};const request=transport.request(out,'identity',c);
 const rejected=assert.rejects(request,/exact ACK ID/);
 transport.publish(out+'/reply-0.json',{ok:true,id:'foreign'});await advance(t,20);await rejected;
 await assert.rejects(transport.request(out,'next',c),/sticky/);
});
test('consumer rejects a changed immutable run deadline before execution',async t=>{
 const out=fixture(t);let effects=0;
 const request=transport.request(out,'immutable',{...command,waitMs:0});
 const rejected=assert.rejects(request,/runtime first fault/);
 const window=JSON.parse(fs.readFileSync(out+'/execution-window.json'));
 window.browserStop=new Date(epoch+240000).toISOString();
 fs.writeFileSync(out+'/execution-window.json',JSON.stringify(window));
 await assert.rejects(transport.consume(out,0,()=>{effects++;}),/exact immutable run deadline/);
 await advance(t,20);await rejected;assert.equal(effects,0);
 await assert.rejects(transport.request(out,'after-change',command),/sticky/);
});
test('expired work deadline refuses dispatch without extending cleanup or run window',async t=>{
 const out=fixture(t);let effects=0;
 const window=fs.readFileSync(out+'/execution-window.json','utf8');
 const request=transport.request(out,'expired',{...command,waitMs:0});
 const rejected=assert.rejects(request,/runtime first fault/);
 t.mock.timers.tick(20001);
 await assert.rejects(transport.consume(out,0,()=>{effects++;}),/bounded command deadline/);
 await advance(t,20);await rejected;
 assert.equal(effects,0);assert.equal(fs.readFileSync(out+'/execution-window.json','utf8'),window);
 assert.equal(fs.readdirSync(out+'/commands').length,1);
});
