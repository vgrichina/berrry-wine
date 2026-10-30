'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const {create} = require('./first-post-input');
const source = fs.readFileSync(process.argv[2], 'utf8');
const a = source.indexOf('  // --- Override input for test injection ---');
const b = source.indexOf('  // Task-owned bounded observer', a);
assert(a > 0 && b > a);
const productionInput = source.slice(a, b);
const install = source.slice(source.indexOf('  const firstPostInput ='), source.indexOf('  const imports = { host: h };'));
assert(install.includes('firstPostInput.bindInput(h'));
assert(source.indexOf(install) > source.lastIndexOf('h.check_input =', source.indexOf(install)));
const workerBind = source.match(/    firstPostInput\.bind\(wh,[^\n]+/)[0];
const memory = {buffer: new ArrayBuffer(1024)};
Buffer.from(memory.buffer).write('WaitForSingleObject');
let batch = 1, inputCalls = 0, waitCalls = 0, exits = 0, logs = 0;
const exportsFor = tid => ({get_current_thread_id:()=>tid,get_eip:()=>0x1000+tid,
  get_esp:()=>0x100,get_yield_flag:()=>0,get_yield_reason:()=>0,
  get_wait_handle:()=>0, get_api_calls:()=>7, get_eax:()=>123,
  guest_read32:addr => addr===0x100 ? 0x777 : 0xe0003+tid});
function scenario(oldOrder=false, omitWorker=false) {
  const h = {check_input:()=>0, log:()=>{logs++;return 19;},
    log_api_exit:()=>{exits++;return 21;}, wait_single:()=>{waitCalls++;return 258;}};
  const e=exportsFor(1), instance={exports:e};
  const ctx = {h,memory,Buffer,instance,apiByName:new Map([['WaitForSingleObject',{}]]),
    require:()=>({create}),tickState:{batch},guestPollTrace:{entries:0},
    guestPollState:()=>({rendererDepth:0}),inputEvent:null,crossThreadMsgs:[],inputQueue:[],
    renderer:{checkInput:()=>{inputCalls++;return {wParam:38,msg:256,lParam:9};}},
    installingFiles:false,inputConsumptionTrace:{dequeue:()=>{}},messageBoundaryTrace:{dequeue:()=>{}},logs:[]};
  vm.createContext(ctx);
  // Execute the real production assignment in its actual relative order.
  vm.runInContext(oldOrder ? install+productionInput : productionInput+install,ctx);
  vm.runInContext('globalThis.obs=firstPostInput;',ctx);
  const obs=ctx.obs;
  h.log(0,19);h.log_api_exit(); // Initializer traffic must be cleared/excluded.
  assert.equal(obs.snapshot().up,null);
  assert.equal(h.check_input(),0x260100);
  assert(obs.snapshot().up,'actual production input overwrote the observer');
  assert.equal(obs.snapshot().up.nativeDequeue.event.wParam,38);
  assert.equal(h.log(0,19),19);assert.equal(h.wait_single(7,10),258);assert.equal(h.log_api_exit(),21);
  const wh={log:()=>31,log_api_exit:()=>32,wait_single:()=>0};
  Object.assign(ctx,{wh,workerInstance:{exports:exportsFor(2)},tid:1});
  if (!omitWorker) vm.runInContext(workerBind,ctx);
  wh.log(0,19);wh.wait_single(8,20);wh.log_api_exit();
  assert.equal(obs.snapshot().lanes['worker:1'].first[0].tid,2);
  assert.equal(obs.snapshot().lanes['worker:1'].firstWait.handle,8);
  const first=JSON.stringify(obs.snapshot().lanes.main.first[0]);
  for(let i=0;i<100;i++){h.log(0,19);h.log_api_exit();}
  const snap=obs.snapshot();assert.equal(snap.lanes.main.first.length,48);
  assert.equal(JSON.stringify(snap.lanes.main.first[0]),first);
  assert.equal(snap.lanes.main.firstWait.handle,7);
  assert.equal(snap.lanes.main.firstWait.invocation.name,'WaitForSingleObject');
  assert(snap.lanes.main.frozen);const before=JSON.stringify(snap.lanes.main.first);
  h.check_input();assert.equal(JSON.stringify(obs.snapshot().lanes.main.first),before);
  return snap;
}
scenario();
assert.throws(()=>scenario(true),/overwrote/);
assert.throws(()=>scenario(false,true));
assert(inputCalls===4 && waitCalls===2 && exits>100 && logs>100);
console.log(JSON.stringify({PASS:true,productionBindingOrder:true,oldOverwrittenHookRejected:true,
  missingWorkerBindingRejected:true,firstRingFrozen:true,returnValuesPreserved:true}));
