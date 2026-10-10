'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const {createObserver, install, overlay, linkOverlay, activateExisting} = require('../tools/antara-win16-callback');
const {prepare}=require('../tools/antara-win16-callback-prepare');
for(const prefix of [undefined,'/home/user/antara-owning-queue-20261008','/home/user/antara-install-x/../bad','/tmp/antara-install-x'])assert.throws(()=>prepare('/tmp/unused-antara','/tmp/unused-antara',prefix),/prefix/);
let clock = 10, reads = 0; const switches = [], buffer = new ArrayBuffer(65536);
const values = {get_current_thread_id: 2, get_eip: 0x2100, get_esp: 0x3100, get_ebp: 0x120, get_eax: 1, get_edx: 0, get_sreg_cs: 0x47, get_sreg_ss: 0x87, get_sreg_ds: 0x37, win16_last_module: 2, win16_last_ordinal: 76};
const ex = {set_win16_trace: v => switches.push(v), guest_to_wasm: p => p, win16_seg_base: i => i === 8 ? 0x2000 : 0x3000, win16_seg_limit: () => 4096};
for (const [k, v] of Object.entries(values)) ex[k] = () => { reads++; return v; };
const options = {getExports: () => ex, getMemory: () => buffer, slot: 1, now: () => clock, baselineTrace: 0};
// Unrelated calls to the newly selected APIs must perform zero owner reads.
const precise=createObserver(options);precise.activate('precise','hover');precise.activate('precise','down');
const feed=(marker,words)=>{precise.word(marker);for(const v of words)precise.word(v);};
feed(0xca16a9eb,[98306,0x201,1,0x00900198,98306,0]);
const beforePrecise=reads, beforeRows=precise.status().rows.length;
for(let i=0;i<100;i++)for(const key of [0x2002e,0x2003b,0x2002a,0x2007c]){feed(0xca16a9f0,[key,0x2120,...Array(13).fill(0)]);feed(0xca16a9ef,Array(6).fill(0));}
assert.equal(reads,beforePrecise);assert.equal(precise.status().rows.length,beforeRows);
feed(0xca16a9f0,[0x2002e,0x1adafc,...Array(13).fill(0)]);
assert.equal(precise.status().rows.at(-1).words[0],0x2002e);assert(precise.status().rows.at(-1).owner.savedFrames);
precise.stop('test');reads=0;switches.length=0;
assert.throws(() => createObserver({...options, baselineTrace: 1}), /baseline/);
assert.throws(() => createObserver({...options, durationMs: 9000}), /bounds/);
const o = createObserver(options);
function frame(marker, words) { o.word(marker); for (const v of words) o.word(v); }
const call = (key, args = []) => frame(0xca16a9f0, [key, 0x2120, ...Array.from({length: 12}, (_, i) => args[i] || 0), 0]);
frame(0xca16a9eb, [98306, 0x201, 1, 0x00910198, 98306, 0]);
const paintReads = reads;
for(let i=0;i<500;i++){call(0x2006b,[0,0,0,15,2]);frame(0xca16a9ef,[0,0,0x2100,0x3100,14,0x37]);}
assert.equal(reads,paintReads);
assert.equal(reads, 0); assert.equal(o.status().rows.length, 0);
o.input(0x10201);assert.deepEqual(switches,[]);o.activate('forwarded');assert.deepEqual(switches,[1]);
for (let i = 0; i < 1000; i++) { frame(0xca16a9eb, [98306, 15, 0, 0, 98306, 0]); call(0x20042); frame(0xca16a9ef, [0, 0, 0x2100, 0x3100, 8, 0x37]); }
assert.equal(reads, 0); assert.deepEqual(o.status().bytes, {down: 0, up: 0});
frame(0xca16a9eb, [98306, 0x201, 1, 0x00910198, 98306, 0]);
call(0x2004c, [408, 145, 0x100, 0x37]);
assert.equal(o.status().rows.at(-1).owner.ptInRect.x, 408);
assert.equal(o.status().rows.at(-1).owner.ptInRect.y, 145);
// Marker-valued payloads are data, not a framing reset.
frame(0xca16a9ef, [0xca16a9eb, 0, 0x2100, 0x3100, 8, 0x37]);
assert.equal(o.status().rows.at(-1).kind, 'handler-exit');
assert.equal(o.status().rows.at(-1).words[0], 0xca16a9eb);
const downBytes = o.status().bytes.down; assert(downBytes > 0);
o.input(0x202); frame(0xca16a9eb, [98306, 0x202, 0, 0x00910198, 98306, 0]); call(0x2006b,[0,0,0,0x202,2]);
assert(o.status().bytes.up > 0); assert.equal(o.status().bytes.down, downBytes);
const before = reads; clock = 8010; call(0x2004c);
assert.equal(reads, before); assert.equal(o.status().reason, 'deadline'); assert.deepEqual(switches, [1, 0]);
clock = 0; const capped = createObserver({...options, maxRows: 4, maxBytes: 1024});
capped.activate('cap');capped.input(0x201); for(let i=0;i<100;i++) capped.importValue('check_input_hwnd', 98306);
capped.input(0x202); capped.importValue('check_input_hwnd', 98306);
assert.equal(capped.status().rows.length,4); assert(capped.status().omitted.down > 0);
assert.equal(capped.status().rows.at(-1).phase,'up'); capped.stop('test');

clock = 0; const h = {check_input() { assert.equal(this, h); return 0x201; }, log_i32() { return 17; }, check_input_hwnd() { return 98306; }, check_input_lparam() { return 0x00910198; }};
const originals = {...h}, wrapped = install(h, options);
wrapped.activate('imports');
assert.equal(h.check_input(), 0x201); assert.equal(h.log_i32(123), 17);
assert.equal(h.check_input_hwnd(), 98306); assert.equal(h.check_input_lparam(), 0x00910198);
wrapped.stop(); for (const n of Object.keys(h)) assert.equal(h[n], originals[n]);
const failure = Error('original failure'); h.check_input = () => { throw failure; };
const w2 = install(h, options); assert.throws(() => h.check_input(), e => e === failure); w2.stop();
const incomplete={...originals};delete incomplete.check_input_lparam;const saved={...incomplete};
assert.throws(()=>install(incomplete,options),/missing import check_input_lparam/);
assert.deepEqual(incomplete,saved);
const newerHost={...originals},owned=install(newerHost,options),newer=()=>999;
newerHost.log_i32=newer;owned.stop();assert.equal(newerHost.log_i32,newer);
const broken={...ex,set_win16_trace(v){if(v===0)throw Error('restore denied');}};
const brokenObserver=createObserver({...options,getExports:()=>broken});brokenObserver.activate('broken');brokenObserver.stop('test');
assert.equal(brokenObserver.status().active,false);assert.match(brokenObserver.status().flagRestoreError,/restore denied/);assert.equal(brokenObserver.status().errors,1);
// Expiry inside a getter prevents the buffer/translator from being touched.
for(const boundary of ['getter','buffer','translator']){
 clock=0;let bufferReads=0,translations=0,afterExpiryGetters=0;
 const guardedEx={...ex,guest_to_wasm(p){translations++;if(boundary==='translator')clock=8000;return p;}};
 for(const [n,v]of Object.entries(values))guardedEx[n]=()=>{if(clock>=8000)afterExpiryGetters++;if(boundary==='getter'&&n==='get_current_thread_id')clock=8000;return v;};
 const g=createObserver({...options,getExports:()=>guardedEx,getMemory:()=>{bufferReads++;if(boundary==='buffer')clock=8000;return buffer;}});
 g.activate('guards');g.input(0x201);g.word(0xca16a9eb);for(const v of [98306,0x201,1,0x00910198,98306,0])g.word(v);
 assert.equal(afterExpiryGetters,0);assert.equal(g.status().bytes.down,0);assert.equal(g.status().reason,'deadline');
 if(boundary==='getter'){assert.equal(bufferReads,0);assert.equal(translations,0);}
 if(boundary==='buffer')assert.equal(translations,0);
 if(boundary==='translator')assert.equal(translations,1);
 g.stop('explicit stop');assert.equal(g.status().reason,'deadline');
}
const worker = fs.readFileSync(require.resolve('../lib/guest-worker.js'), 'utf8');
const generated = overlay(worker, fs.readFileSync(require.resolve('../tools/antara-win16-callback'), 'utf8'));
new vm.Script(generated); assert(generated.endsWith(worker.slice(worker.lastIndexOf('\n'))));
assert.throws(() => overlay('', ''), /anchor/);
const linkSource = linkOverlay(fs.readFileSync(require.resolve('../lib/guest-thread-host'), 'utf8'));
const moduleObject = {exports: {}}; const messages = [];
vm.runInNewContext(linkSource, {module: moduleObject, require: p => require('../lib/' + p.replace('./', '')), console});
const link = new moduleObject.exports.WorkerLink({slot: 1, log: m => messages.push(m)});
const receipt = o.status(); link._onMessage({t: 'antaraWin16Receipt', receipt});
assert.equal(link.antaraWin16Receipt, receipt); assert.equal(messages.length,0);
assert.throws(() => linkOverlay(''), /anchor/);
// Owning child receives a queue route without ever polling host DOWN.
clock=0;const child=createObserver(options);child.activate('child');
for(const v of [0xca16a9eb,98306,0x201,1,0x00910198,98306,0])child.word(v);
assert.equal(child.status().rows[0].kind,'route');assert(child.status().rows[0].owner);assert(!child.status().rows.some(r=>r.kind==='input-poll'));child.stop('test');
clock=0;const rawCap=createObserver({...options,maxWords:32,cpuNow:()=>0});rawCap.activate('raw');for(let i=0;i<1000;i++)rawCap.word(123);
assert.equal(rawCap.status().traceWords,32);assert.equal(rawCap.status().active,false);rawCap.activate('raw','up');for(let i=0;i<1000;i++)rawCap.word(123);assert.deepEqual(rawCap.status().raw,{down:32,up:32});assert.throws(()=>rawCap.activate('raw','up'),/rejected/);
let cpuClock=0;const cpuCap=createObserver({...options,cpuNow:()=>cpuClock++,maxCpuMs:2});cpuCap.activate('cpu');for(let i=0;i<100;i++)cpuCap.word(123);assert.equal(cpuCap.status().traceWords,2);assert.equal(cpuCap.status().active,false);
const throwHost={...originals,log_i32(){throw failure;}},throwProbe=install(throwHost,options);throwProbe.activate('throws');assert.throws(()=>throwHost.log_i32(1),e=>e===failure);assert.equal(throwProbe.status().active,false);throwProbe.stop();
// An owning queue MOVE establishes context without a host poll. Capture the
// bounded saved chain and object fields, preserving memory byte-for-byte.
clock=0;
const gateMemory=new ArrayBuffer(65536), gateView=new DataView(gateMemory);
function put(at, words){words.forEach((v,i)=>gateView.setUint16(at+i*2,v,true));}
put(0x3120,[0x140,0x122f,0x47,0x200,0x87]);
put(0x3140,[0x160,0x24e8,0x5f,0x200,0x87]);
put(0x3160,[0x160,0x1eb1,0x47,0x200,0x87]);
put(0x33c4,[99,1]);put(0x33e2,[408,144,1]);
const preserved=Buffer.from(gateMemory).toString('hex');
const gateEx={...ex,win16_seg_limit:()=>65536,win16_seg_base:i=>i===8?0x2000:i===11?0x4000:0x3000};
const gates=createObserver({...options,getExports:()=>gateEx,getMemory:()=>gateMemory});gates.activate('hover');
for(const v of [0xca16a9eb,98306,0x200,0,0x00900198,98306,0])gates.word(v);
for(const v of [0xca16a9f0,0x2007a,0x2120,0,0,0,0x200,0,0,0,0,0,0,0,0,0])gates.word(v);
const savedFrames=gates.status().rows.at(-1).owner.savedFrames;
assert.equal(savedFrames.length,3);assert.equal(savedFrames[1].returnSelector,0x5f);
assert.equal(savedFrames[1].code.bytes.length,256);
assert.deepEqual(savedFrames[1].objectGatesCandidate.bytes.slice(30),[152,1,144,0,1,0]);
assert.equal(Buffer.from(gateMemory).toString('hex'),preserved);gates.stop('test');
// Negative control reproduces the actual capture loss: hover shares DOWN's
// rows in the old two-phase activation. The new third ACK reserves DOWN's
// original action frame within exactly the old TOTAL resource ceilings.
function emit(o, marker, words){o.word(marker);for(const v of words)o.word(v);}
const floodOptions={...options,getExports:()=>gateEx,getMemory:()=>gateMemory,cpuNow:()=>0};
const sharedHover=createObserver(floodOptions);sharedHover.activate('old-shape');
for(let i=0;i<1000;i++)emit(sharedHover,0xca16a9eb,[98306,0x200,0,0x00900198,98306,0]);
emit(sharedHover,0xca16a9eb,[98306,0x201,1,0x00900198,98306,0]);
assert(!sharedHover.status().rows.some(r=>r.kind==='route'&&r.words[1]===0x201));sharedHover.stop('test');
const reservedHover=createObserver(floodOptions);reservedHover.activate('reserved','hover');
for(let i=0;i<5000;i++)emit(reservedHover,0xca16a9eb,[98306,0x200,0,0x00900198,98306,0]);
assert.equal(reservedHover.status().raw.hover,32768);assert.equal(reservedHover.status().active,false);
assert(reservedHover.status().omitted.hover>0);assert.equal(reservedHover.status().errors,0);
reservedHover.activate('reserved','down');
emit(reservedHover,0xca16a9eb,[98306,0x201,1,0x00900198,98306,0]);
emit(reservedHover,0xca16a9f0,[0x2007a,0x2120,0,0,0,0x201,0,0,0,0,0,0,0,0,0]);
const downFrame=reservedHover.status().rows.find(r=>r.phase==='down'&&r.kind==='call');
assert.equal(downFrame.owner.savedFrames[1].returnOffset,0x24e8);
assert.deepEqual(downFrame.owner.savedFrames[1].objectGatesCandidate.bytes.slice(30),[152,1,144,0,1,0]);
assert.throws(()=>reservedHover.activate('reserved','down'),/rejected/);
reservedHover.activate('reserved','up');emit(reservedHover,0xca16a9eb,[98306,0x202,0,0x00900198,98306,0]);
assert(reservedHover.status().rows.some(r=>r.phase==='up'&&r.kind==='route'));
const budgets=reservedHover.status();
assert(budgets.rows.length<=128);assert(Object.values(budgets.bytes).reduce((a,b)=>a+b,0)<=32768);
assert(Object.values(budgets.raw).reduce((a,b)=>a+b,0)<=131072);
assert(budgets.bytes.hover<=8192&&budgets.bytes.down<=8192&&budgets.bytes.up<=16384);
reservedHover.stop('test');assert.equal(Buffer.from(gateMemory).toString('hex'),preserved);
const splitCpu=createObserver({...floodOptions,maxCpuMs:100});splitCpu.activate('cpu-split','hover');
for(let i=0;i<100;i++)splitCpu.charge(1);assert.equal(splitCpu.status().cpuMs.hover,50);
splitCpu.activate('cpu-split','down');for(let i=0;i<100;i++)splitCpu.charge(1);assert.equal(splitCpu.status().cpuMs.down,50);
splitCpu.activate('cpu-split','up');for(let i=0;i<150;i++)splitCpu.charge(1);assert.equal(splitCpu.status().cpuMs.up,100);
assert.equal(Object.values(splitCpu.status().cpuMs).reduce((a,b)=>a+b,0),200);
async function coordination(){
 const acks=[];function fake(slot){const l={slot,antaraWin16Ready:true,_seq:0,_pending:new Map()};l.worker={postMessage(m){acks.push(m);const p=l._pending.get(m.seq);l._pending.delete(m.seq);p.resolve({ack:{slot,active:m.t==='antaraActivate',token:m.token,phase:m.phase,deadline:Date.now()+8000}});}};return l;}
 const main=fake(0),owner=fake(1),wine={guestWorker:{link:main},threadManager:{threads:new Map([[1,{link:owner}]])}};
 assert.equal((await activateExisting(wine,'ready','down')).length,2);assert.equal((await activateExisting(wine,'ready','up')).length,2);assert.equal(acks.length,4);
 const split={guestWorker:{link:fake(0)},threadManager:{threads:new Map([[1,{link:fake(1)}]])}};
 assert.equal((await activateExisting(split,'split','hover')).length,2);assert.equal((await activateExisting(split,'split','down')).length,2);assert.equal((await activateExisting(split,'split','up')).length,2);
 await assert.rejects(()=>activateExisting(split,'split','down'),/activation token/);
 wine.threadManager.threads.set(2,{link:fake(2)});await assert.rejects(()=>activateExisting(wine,'ready','up'),/existing Workers/);
 const failed=fake(1);failed.worker.postMessage=m=>{const p=failed._pending.get(m.seq);failed._pending.delete(m.seq);p.resolve({ack:{active:false}});};const bad={guestWorker:{link:fake(0)},threadManager:{threads:new Map([[1,{link:failed}]])}};await assert.rejects(()=>activateExisting(bad,'reject','down'),/click refused/);assert(acks.some(m=>m.t==='antaraStop'));
 console.log('Antara explicit forwarded-owner route, DOWN/UP acknowledgment, late-worker refusal, raw CPU/word caps, original-forward-once, error cleanup, deadline/getter/translator and generated overlay PASS');
}
coordination().catch(e=>{console.error(e);process.exitCode=1;});

// Trap reserve survives exhausted ordinary quotas and reaches the link before
// teardown; snapshot/restore failures still produce the final receipt.
clock=0;const faultEx={...gateEx,get_dbg_prev_eip:()=>0x2120,get_dbg_prev2_eip:()=>0x2110};
const fault=createObserver({...floodOptions,getExports:()=>faultEx,maxWords:32});fault.activate('fault');for(let i=0;i<100;i++)fault.word(123);
assert.equal(fault.status().active,false);fault.trap('unreachable');
assert.equal(fault.status().trap.owner.csBase,0x2000);assert.equal(fault.status().trap.owner.savedFrames.length,3);
assert.equal(fault.status().trap.owner.prev2Eip,0x2110);assert(fault.status().bytes.trap<=2048);assert.equal(fault.status().reason,'owning trap');
const same=fault.status().trap;fault.trap('again');assert.equal(fault.status().trap,same);
const final=fault.status();link._onMessage({t:'antaraWin16Receipt',receipt:final,final:true});assert.equal(messages.length,1);assert(messages[0].startsWith('ANTARA_FINAL '));assert.equal(JSON.parse(messages[0].slice(13)).trap.message,'unreachable');
const trapHook=generated.slice(generated.lastIndexOf('          trapped = String(err && err.message || err);'),generated.indexOf('          if (!mmPump && ex.get_last_run_blocks)'));
const sent=[];const probeFailure=Error('snapshot failure');vm.runInNewContext(trapHook,{err:Error('guest trap'),antaraProbe:{trap(){throw probeFailure;},stop(){},status(){return{trap:{error:'snapshot failure'}};}},rawSend:m=>sent.push(m)});assert.equal(sent[0].final,true);assert.equal(sent[0].receipt.trap.error,'snapshot failure');
console.log('Trap reserve after flood, saved selectors/code, final link delivery and exception-safe catch receipt PASS');
