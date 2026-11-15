'use strict';
// Authored fault models plus explicit, watched current-native browser modes.
// Default imports install no guard and perform no guest execution.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function source(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
const {nativeContext:candidateNativeContext,workerBridge:candidateWorkerBridge,pageBridge:candidatePageBridge} = require('../tools/gta2-browser-release-binding.cjs');
function authoredPE() {
  // Independently authored Win32 program, no original bytes or helper imports.
  const bytes = Buffer.alloc(0x4400), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
  const raw = rva => rva - 0x1000 + 0x400, base = 0x400000;
  const dword = (offset, value) => bytes.writeUInt32LE(value >>> 0, offset);
  bytes.writeUInt16LE(0x5a4d, 0);dword(0x3c, pe);dword(pe, 0x4550);
  bytes.writeUInt16LE(0x14c, pe+4);bytes.writeUInt16LE(1, pe+6);
  bytes.writeUInt16LE(0xe0, pe+20);bytes.writeUInt16LE(0x10e, pe+22);
  bytes.writeUInt16LE(0x10b, opt);dword(opt+16, 0x2000);dword(opt+28, base);
  dword(opt+32, 0x1000);dword(opt+36, 0x400);dword(opt+56, 0x5000);dword(opt+60, 0x400);
  bytes.writeUInt16LE(4, opt+40);bytes.writeUInt16LE(4, opt+48);bytes.writeUInt16LE(2, opt+68);
  dword(opt+72, 0x100000);dword(opt+76, 0x1000);dword(opt+80, 0x100000);dword(opt+84, 0x1000);dword(opt+92, 16);
  bytes.write('.native', section);dword(section+8, 0x4000);dword(section+12, 0x1000);
  dword(section+16, 0x4000);dword(section+20, 0x400);dword(section+36, 0xe0000060);
  dword(opt+104, 0x1000);dword(opt+108, 80);
  const apis = new Map();let strings = 0x1600;
  const libraries = [
    ['kernel32.dll', ['ExitProcess','OutputDebugStringA']],
    ['user32.dll', ['RegisterClassA','CreateWindowExA','MessageBoxA','GetMessageA','TranslateMessage',
      'DispatchMessageA','DefWindowProcA','GetDC','ReleaseDC','FillRect','UpdateWindow']],
    ['gdi32.dll', ['CreateSolidBrush','DeleteObject']],
  ];
  libraries.forEach(([library, names], index) => {
    const descriptor = 0x1000 + index*20, thunk = 0x1200 + index*0x100;
    dword(raw(descriptor), thunk);dword(raw(descriptor+12), strings);dword(raw(descriptor+16), thunk);
    bytes.write(library+'\0', raw(strings));strings += library.length+1;
    names.forEach((name, i) => {
      dword(raw(thunk+i*4), strings);bytes.write(name+'\0', raw(strings+2));
      strings += name.length+3;apis.set(name, base+thunk+i*4);
    });
  });
  assert(strings < 0x2000);
  const text = (rva, value) => bytes.write(value+'\0', raw(rva));
  text(0x3000, 'BrowserNativeBindingFixture');text(0x3060, 'Native input binding fixture');
  text(0x30c0, 'FIRST native modal');text(0x3100, 'First complete native scene. Enter opens the second modal.');
  text(0x3180, 'SECOND native modal');text(0x31c0, 'Second complete native scene. Enter returns to the main input window.');
  text(0x3280, 'AUTHORED_NATIVE_KEY_DOWN');text(0x32c0, 'AUTHORED_NATIVE_KEY_UP');
  text(0x3300, 'AUTHORED_NATIVE_QUIT');
  dword(raw(0x3504), base+0x2600);dword(raw(0x3510), base);dword(raw(0x351c), 6);dword(raw(0x3524), base+0x3000);
  [0,0,640,420].forEach((value,i) => dword(raw(0x3600+i*4), value));
  const assemble = start => {
    const code = [], labels = new Map(), fixups = [];
    const emit = (...values) => code.push(...values);
    const u32 = value => [value&255,value>>>8&255,value>>>16&255,value>>>24];
    const push = value => emit(0x68,...u32(value));
    const call = name => {assert(apis.has(name));emit(0xff,0x15,...u32(apis.get(name)));};
    const label = name => {assert(!labels.has(name));labels.set(name,code.length);};
    const jump = (name, condition) => {
      emit(...(condition ? [0x0f,condition] : [0xe9]));fixups.push({offset:code.length,name});emit(0,0,0,0);
    };
    return {emit,u32,push,call,label,jump,finish:() => {
      const buffer = Buffer.from(code);
      for (const {offset,name} of fixups) {assert(labels.has(name));buffer.writeInt32LE(labels.get(name)-offset-4,offset);}
      assert(start+buffer.length < (start===0x2000 ? 0x2600 : 0x3000));buffer.copy(bytes,raw(start));
    }};
  };
  {
    const {emit,u32,push,call,label,jump,finish} = assemble(0x2000);
    push(base+0x3500);call('RegisterClassA');
    for (const value of [0,base,0,0,420,640,80,80,0x10cf0000,base+0x3060,base+0x3000,0]) push(value);
    call('CreateWindowExA');emit(0xa3,...u32(base+0x3540));emit(0x50);call('UpdateWindow');
    for (const [caption,message] of [[0x30c0,0x3100],[0x3180,0x31c0]]) {
      push(0x40);push(base+caption);push(base+message);emit(0xff,0x35,...u32(base+0x3540));call('MessageBoxA');
    }
    label('pump');push(0);push(0);push(0);push(base+0x3580);call('GetMessageA');
    emit(0x85,0xc0);jump('exit',0x84);push(base+0x3580);call('TranslateMessage');
    push(base+0x3580);call('DispatchMessageA');jump('pump');label('exit');push(0);call('ExitProcess');emit(0xcc);finish();
  }
  {
    const {emit,u32,push,call,label,jump,finish} = assemble(0x2600);
    emit(0x55,0x89,0xe5,0x53,0x56,0x57); // preserve all callee-saved registers
    emit(0x81,0x7d,0x0c,...u32(0x100));jump('down',0x84);
    emit(0x81,0x7d,0x0c,...u32(0x101));jump('up',0x84);
    for (const offset of [20,16,12,8]) emit(0xff,0x75,offset);
    call('DefWindowProcA');jump('return');
    label('down');emit(0x83,0x7d,0x10,27);jump('quit',0x84);
    push(base+0x3280);call('OutputDebugStringA');push(0x00a040);call('CreateSolidBrush');emit(0x89,0xc7);jump('paint');
    label('up');push(base+0x32c0);call('OutputDebugStringA');push(0x805020);call('CreateSolidBrush');emit(0x89,0xc7);
    label('paint');emit(0xff,0x75,8);call('GetDC');emit(0x89,0xc6,0x57);push(base+0x3600);emit(0x56);call('FillRect');
    emit(0x56,0xff,0x75,8);call('ReleaseDC');emit(0x57);call('DeleteObject');emit(0x31,0xc0);jump('return');
    label('quit');push(base+0x3300);call('OutputDebugStringA');push(0);call('ExitProcess');emit(0xcc);
    label('return');emit(0x5f,0x5e,0x5b,0x5d,0xc2,0x10,0);finish();
  }
  return bytes;
}
// Authored candidate state machine. It has no repository imports and no native
// claim: production must supply its *owning* synchronous native read and effect.
// Keeping it here during the ordered light phase does not install a guard.
function candidateGate({read, effect, clock = Date.now, random = () => crypto.randomUUID()}) {
  let binding = null, active = null, terminal = null;
  const nonces = new Set();
  const copy = value => JSON.parse(JSON.stringify(value));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function requireLive(expected) {
    const actual = read();
    assert(actual.healthy === true, 'native owner unavailable');
    assert(equal(actual.identity, expected.identity), 'native owner/source/backend changed');
    assert(equal(actual.context, expected.context), 'native HWND/focus/context changed');
    return actual;
  }
  function open() { assert(!terminal, 'permanent UNKNOWN; zero later requests'); }
  function fail(error) { terminal = String(error); throw error; }
  return {
    bind(review) {
      open();
      try {
        assert(!active, 'binding after arm');
        assert(review.reviewed === true && review.observation.trim() && /^[a-f0-9]{64}$/.test(review.pngSHA256));
        assert(Number.isSafeInteger(review.capturedAt) && clock() >= review.capturedAt);
        assert([5000, 30000].includes(review.maxAgeMs));
        requireLive(review);
        binding = copy({...review, bindingToken:random()});
        return copy(binding);
      } catch (error) { return fail(error); }
    },
    arm(intent) {
      open();
      try {
        assert(binding && !active, 'one independent arm per binding');
        assert(/^[a-z0-9-]{8,100}$/.test(intent.nonce) && !nonces.has(intent.nonce), 'fresh intent nonce');
        // Burn the nonce before native validation. A failed intent is never replayed.
        nonces.add(intent.nonce);
        assert(intent.intent.trim() && intent.childToken && intent.bindingToken === binding.bindingToken);
        assert(Number.isSafeInteger(intent.startedAt) && clock() >= intent.startedAt && clock() - intent.startedAt <= 500);
        assert(clock() - binding.capturedAt < binding.maxAgeMs, 'stale reviewed native scene');
        requireLive(binding);
        active = copy({...intent, armedAt:clock(), fallbackAt:clock()+1500, keys:intent.keys, consumed:[]});
        assert(Array.isArray(active.keys) && active.keys.length > 0 && active.keys.length <= 2 && new Set(active.keys).size === active.keys.length);
        return copy({...active, scene:binding, nativeVerified:true});
      } catch (error) { return fail(error); }
    },
    consume({nonce, childToken, key}) {
      open();
      try {
        assert(active && nonce === active.nonce && childToken === active.childToken, 'intent/independent arm changed');
        assert(clock() < active.fallbackAt - 250 && clock() - binding.capturedAt < binding.maxAgeMs, 'lease expired');
        assert(active.keys.includes(key) && !active.consumed.includes(key), 'unarmed or duplicate DOWN');
        requireLive(binding);
        // Claim before a possibly partial native effect; throwing never permits retry.
        active.consumed.push(key);
        effect(key);
        return {state:'CONSUMED', nonce, key, at:clock()};
      } catch (error) { return fail(error); }
    },
    get closed() { return terminal !== null; },
  };
}
function candidateFaults() {
  // All mutations below are AUTHORED FAULTS; none is a historical-cause claim.
  const original = {healthy:true, identity:{source:'current-source', helper:'current-helper',
    pid:123, startToken:'start', endpoint:'endpoint', ownerEpoch:'owner', module:'module', backend:'software'},
    context:{hwnd:1, generation:'1', focus:1, capture:0, modal:0, processId:7, threadId:9}};
  const results = [];
  const cases = [
    ...Object.keys(original.identity).map(key => ['changed-' + key, s => s.identity[key] = 'changed']),
    ...Object.keys(original.context).map(key => ['changed-' + key, s => s.context[key] = 'changed']),
    ['dead-process', s => s.healthy = false],
  ];
  for (const [name, mutate] of cases) {
    let current = copy(original), effects = 0, reads = 0;
    const gate = candidateGate({read:() => {reads++;return copy(current);}, effect:() => effects++, clock:() => 1000, random:() => 'binding'});
    const binding = gate.bind({...original, capturedAt:900, maxAgeMs:5000, reviewed:true,
      observation:'authored model only', pngSHA256:'a'.repeat(64)});
    gate.arm({bindingToken:binding.bindingToken, nonce:'authored-fault-001', intent:'authored model edge',
      childToken:'independent-child', startedAt:950, keys:[38]});
    mutate(current);
    assert.throws(() => gate.consume({nonce:'authored-fault-001', childToken:'independent-child', key:38}));
    const before = reads;
    for (const operation of [() => gate.bind(binding), () => gate.arm({}),
      () => gate.consume({nonce:'later', childToken:'later', key:38})]) assert.throws(operation, /permanent UNKNOWN/);
    assert.equal(effects, 0);assert.equal(reads, before, 'zero later native reads');
    results.push({name, classification:'AUTHORED_FAULT', effects, laterReads:0, permanentlyClosed:gate.closed});
  }
  for (const name of ['changed-nonce', 'changed-child-token', 'unarmed-key', 'duplicate-down',
    'duplicate-arm', 'binding-after-arm', 'stale-lease', 'stale-scene', 'late-prearm']) {
    let tick = 1000, effects = 0, reads = 0;
    const gate = candidateGate({read:() => {reads++;return copy(original);},
      effect:() => effects++, clock:() => tick, random:() => 'binding'});
    const binding = gate.bind({...original, capturedAt:900, maxAgeMs:5000, reviewed:true,
      observation:'authored model only', pngSHA256:'b'.repeat(64)});
    const intent = {bindingToken:binding.bindingToken, nonce:'authored-fault-002',
      intent:'authored model edge', childToken:'child', startedAt:950, keys:[38]};
    const edge = {nonce:intent.nonce, childToken:'child', key:38};
    if (name === 'late-prearm') tick = 1451;
    else gate.arm(intent);
    if (name === 'duplicate-down') gate.consume(edge);
    if (name === 'stale-lease') tick = 2250;
    if (name === 'stale-scene') tick = 5900;
    const operation = name === 'binding-after-arm' ? () => gate.bind(binding)
      : ['duplicate-arm', 'late-prearm'].includes(name) ? () => gate.arm(intent)
      : () => gate.consume({...edge, ...(name === 'changed-nonce' ? {nonce:'changed-nonce'} :
        name === 'changed-child-token' ? {childToken:'changed'} : name === 'unarmed-key' ? {key:13} : {})});
    assert.throws(operation);
    assert(gate.closed);
    const priorReads = reads, priorEffects = effects;
    for (const later of [() => gate.bind(binding), () => gate.arm(intent), () => gate.consume(edge)])
      assert.throws(later, /permanent UNKNOWN/);
    assert.equal(reads, priorReads);assert.equal(effects, priorEffects);
    results.push({name, classification:'AUTHORED_FAULT', effectsBeforeFault:name === 'duplicate-down' ? 1 : 0,
      laterEffects:0, laterReads:0, permanentlyClosed:true});
  }
  return {kind:'AUTHORED_CANDIDATE_MODEL_ONLY', results, actualNativeQualification:false};
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
}
async function candidateBridgeModel() {
  const vm = require('node:vm');
  const results = [];
  for (const fault of ['none','changed-native-context','late-prearm','duplicate-arm','binding-after-arm',
    'changed-endpoint','retired-owner','changed-handler','stale-lease','changed-nonce','dead-native',
    'changed-instance','active-writer','nested-send']) {
    let native = {healthy:true,context:{main:{hwnd:1,generation:'1'},focus:{hwnd:1,generation:'1'}}};
    let reads = 0, commits = 0, forwarded = 0;
    const messages = [], self = {onmessage:() => forwarded++,postMessage:message => {
      messages.push(message);
      if (message.t === 'gta2NativeCommitV1') {
        commits++;
        const words = new Int32Array(message.commit);Atomics.store(words,1,message.key);Atomics.store(words,0,1);
      }
    }};
    let tick=Date.now();class ModelDate extends Date {static now(){return tick;}}
    const context = {instance:{exports:{}},endpointIdentity:17,workerSlot:0,scopedRetiring:false,
      threadSendFrames:[],threadSendWaits:{fenced:() => false,rootSend:null},writerActive:() => 0,
      commandWriterHandoff:null,self,crypto,SharedArrayBuffer,Int32Array,Atomics,Date:ModelDate,
      readNative:() => {reads++;return structuredClone(native);},commandQueue:Promise.resolve()};
    const installed = vm.runInNewContext('('+candidateWorkerBridge.toString()+')(readNative)',context);
    const installedHandler=self.onmessage;
    const send = async (action, body = {}) => {
      installedHandler({data:{t:'gta2NativeRequestV1',request:messages.length+1,
        endpointIdentity:installed.endpointIdentity,epoch:installed.epoch,action,...body}});
      await context.commandQueue;
      return messages.at(-1);
    };
    self.onmessage({data:{t:'ordinary-existing-channel'}});assert.equal(forwarded,1);
    const review = {native:installed,reviewed:true,observation:'AUTHORED VM MODEL, no native proof',
      pngSHA256:'c'.repeat(64),capturedAt:tick,maxAgeMs:5000};
    const binding = (await send('bind',{review})).result;assert(binding?.token);
    const intent = {bindingToken:binding.token,nonce:'authored-model-001',intent:'model edge',
      childToken:'authored-child',keys:[38],startedAt:tick-(fault==='late-prearm'?501:0)};
    const arm = await send('arm',intent);
    if (fault === 'late-prearm') assert(arm.error);
    else {
      assert(arm.result?.armed);
      if (fault === 'duplicate-arm') assert((await send('arm',intent)).error);
      else if(fault==='binding-after-arm')assert((await send('bind',{review})).error);
      else {
        if (fault === 'changed-native-context') native.context.focus.generation = 'changed';
        if (fault === 'changed-endpoint') context.endpointIdentity=99;
        if (fault === 'retired-owner') context.scopedRetiring=true;
        if (fault === 'changed-handler') self.onmessage=()=>{};
        if (fault === 'stale-lease') tick+=1500;
        if (fault === 'dead-native') native.healthy=false;
        if (fault === 'changed-instance') context.instance={exports:{}};
        if (fault === 'active-writer') context.writerActive=()=>1;
        if (fault === 'nested-send') context.threadSendFrames.push({});
        const receipt = await send('consume',{nonce:fault==='changed-nonce'?'changed-nonce':intent.nonce,childToken:intent.childToken,key:38,
          commit:new SharedArrayBuffer(8),deadline:tick+3000});
        if (fault !== 'none') assert(receipt.error);
        else {
          assert.equal(receipt.result.state,'CONSUMED');assert.equal(commits,1);
          native.context.focus.generation = 'legitimate-change-after-consumption';
          assert.equal((await send('finish',{nonce:intent.nonce,childToken:intent.childToken})).result.state,'RELEASED');
        }
      }
    }
    if (fault !== 'none') {
      const before = reads;
      for (const action of ['read','bind','arm','consume']) assert((await send(action)).error);
      assert.equal(reads,before,'no later native reads after permanent refusal');assert.equal(commits,0);
    }
    results.push({fault: fault === 'none' ? 'NONE_AUTHORED_MODEL_SUCCESS' : 'AUTHORED_FAULT_'+fault,
      commits,forwarded,actualNativeQualification:false});
  }
  return {kind:'AUTHORED_VM_PROTOCOL_MODEL_ONLY',results,sourceHelperExecuted:false,guestExecuted:false};
}
async function candidatePageModel() {
  const vm = require('node:vm'), results = [];
  for (const fault of ['none','changed-context','changed-window-generation','changed-backend',
    'changed-handler','duplicate-down','duplicate-arm','binding-after-arm']) {
    let native = {healthy:true,context:{processId:3,main:{hwnd:1,generation:'1',threadId:7},focus:{hwnd:1,generation:'1',threadId:7},modal:null}};
    let generation = '1', reads = 0, effects = 0, ups = 0;
    const ex = {wnd_lookup_generation:() => generation,wnd_lookup_live:() => 1,get_window_thread:() => 7};
    const renderer = {canvas:{},inputQueue:[],windows:{1:{visible:true,processId:3,wasm:{exports:ex}}},
      _physicalKeys:{},_mouseButtonsMask:0,
      handleKeyDown(key) {effects++;this._physicalKeys[key]=true;},
      handleKeyUp(key) {ups++;this._physicalKeys[key]=false;},handleKeyPress() {throw Error('unexpected character');},
      peekKeyDownState(key) {return !!this._physicalKeys[key];}};
    const wine = {running:true,processId:3,renderer,memory:{buffer:new SharedArrayBuffer(128)},instance:renderer.windows[1].wasm,_wasmModule:{}};
    const sandbox = {runningApps:[{name:'authored-model',wine}],crypto,SharedArrayBuffer,Int32Array,Atomics,Date,
      setTimeout,clearTimeout,readNative:() => {reads++;return structuredClone(native);}};
    const context = vm.createContext(sandbox);
    vm.runInContext('('+candidatePageBridge.toString()+')({app:"authored-model",backend:"software",nativeOwner:{epoch:"authored-main",endpointIdentity:"main"}},readNative)',context);
    const api = sandbox.__gta2NativeReleasePageV1;
    const observed = await api.read();
    const review = {...observed,reviewed:true,observation:'AUTHORED MAIN PAGE MODEL ONLY',pngSHA256:'d'.repeat(64),
      capturedAt:Date.now(),maxAgeMs:5000};
    const binding = await api.bind(review);
    await api.attest(binding);
    const intent = {bindingToken:binding.bindingToken,nonce:'authored-page-001',intent:'model edge',keys:[38],
      childToken:'authored-child',startedAt:Date.now()};
    await api.arm(intent);
    if (fault === 'changed-context') native.context.focus.generation='2';
    if (fault === 'changed-window-generation') generation='2';
    if (fault === 'changed-backend') wine._renderWorkerManager={ports:new Map([[1,{id:1,options:{backend:'webgl'}}]])};
    if (fault === 'changed-handler') renderer.handleKeyDown=()=>{};
    if (fault === 'duplicate-arm') await assert.rejects(api.arm(intent));
    else if (fault === 'binding-after-arm') await assert.rejects(api.bind(review));
    else {
      // Retain the installed handler for the changed-function fault: actual
      // ownership validation must refuse even if an old function is invoked.
      const down = vm.runInContext('__gta2NativeReleasePageV1',context);
      if (fault === 'changed-handler') {
        await assert.rejects(down.read());
      } else {
        renderer.handleKeyDown(38,{});await Promise.resolve();await Promise.resolve();
        if (fault === 'duplicate-down') renderer.handleKeyDown(38,{});
        await Promise.resolve();
      }
    }
    if (fault === 'none') {
      assert.equal(effects,1);assert.equal(api.status(intent.nonce).receipts[0].state,'CONSUMED');
      native.context.focus.generation='post-consumption-legitimate-change';
      renderer.handleKeyUp(38,{});
      assert.equal((await api.finish(intent)).state,'RELEASED');
      assert.equal(ups,1);
    } else {
      assert.equal(effects,fault === 'duplicate-down' ? 1 : 0);
      const prior = reads;
      await assert.rejects(api.read(),/permanent/);await assert.rejects(api.bind(review),/permanent/);
      renderer.handleKeyUp(38,{}); // Independent UP still reaches original renderer.
      assert.equal(ups,1);assert.equal(reads,prior);
    }
    results.push({fault:'AUTHORED_MODEL_'+fault,effects,ups,actualNativeQualification:false});
  }
  return {kind:'AUTHORED_MAIN_PAGE_MODEL_ONLY',results,actualNativeQualification:false};
}
async function browserFixture(out,mode) {
  assert(['main','worker'].includes(mode));assert(path.isAbsolute(out));fs.mkdirSync(out,{recursive:true});
  const cp=require('node:child_process'),controller=require('../tools/gta2-paired-controller.cjs');
  const native=require('../tools/gta2-browser-release-binding.cjs'),helper=require('../'+controller.HELPER);
  const pause=ms=>new Promise(r=>setTimeout(r,ms)),record=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  const fixture=path.join(ROOT,'scratch/runs/20261115-gta2-browser-release-scene-binding/authored-native-input.exe');
  assert.equal(sha(fs.readFileSync(fixture)),sha(authoredPE()),'only this authored fixture may launch');
  const files=['host.js','index.html',...fs.readdirSync(path.join(ROOT,'lib')).filter(n=>n.endsWith('.js')).map(n=>'lib/'+n),
    'tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs',controller.HELPER,'build/wine-assembly.wasm'];
  const pins={files:files.map(p=>({path:p,sha256:sha(fs.readFileSync(path.join(ROOT,p)))})),modules:[sha(fs.readFileSync(path.join(ROOT,'build/wine-assembly.wasm')))]};record('pins.json',pins);
  let server,browser,joined,c,session,chain,latest,bridgeOptions;const workers=new Map(),tasks=[],http=[];
  const app='authored_native_binding_fixture';
  const evaluate=(expression,s=session)=>native.evaluate(c,s,expression);
  async function capture(label){
    native.verifyPins(pins);const before=await evaluate('__gta2NativeReleasePageV1.read()');
    const at=Date.now();let png,identity;
    if(chain){const value=await chain.capture(label);png=value.png;identity=value.capture.identity;}
    else {png=Buffer.from((await c.send('Page.captureScreenshot',{format:'png'},session)).data,'base64');identity={processId:before.native.context.processId};}
    const after=await evaluate('__gta2NativeReleasePageV1.read()');assert.deepEqual(before,after,'complete capture native context stable');
    fs.writeFileSync(path.join(out,label+'.png'),png,{flag:'wx'});
    latest={label,owner:identity,review:{...after,capturedAt:at,pngSHA256:sha(png)},nativeDebugLog:await evaluate(`document.getElementById('log')?.textContent?.slice(-12000)`)};record(label+'.json',latest);return latest;
  }
  try{
    server=await require('./static-server.js').startStaticServer({root:ROOT,crossOriginIsolated:true,rewritePath:p=>p.startsWith('/binaries/')?'/test'+p:p});
    server.prependListener('request',(req,res)=>{const chunks=[],wr=res.write,en=res.end;res.write=function(b){if(b)chunks.push(Buffer.from(b));return wr.apply(this,arguments);};res.end=function(b){if(b)chunks.push(Buffer.from(b));return en.apply(this,arguments);};res.once('finish',()=>http.push({url:req.url,status:res.statusCode,sha256:sha(Buffer.concat(chunks))}));});
    browser=cp.spawn('/usr/bin/google-chrome',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--window-size=1024,900','--remote-debugging-port=0','--user-data-dir='+out+'/profile','about:blank'],{stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';browser.stdout.on('data',b=>stdout+=b);browser.stderr.on('data',b=>stderr+=b);
    joined=new Promise(resolve=>browser.once('close',(code,signal)=>{record('chrome-wait.json',{pid:browser.pid,code,signal,actualWait:true,stdoutEOF:browser.stdout.readableEnded,stderrEOF:browser.stderr.readableEnded,stdout,stderr});resolve();}));
    const stat=fs.readFileSync('/proc/'+browser.pid+'/stat','utf8'),startToken=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];record('chrome-pid.json',{pid:browser.pid,startToken});
    let url;const end=Date.now()+3000;while(!(url=controller.devtoolsEndpoint(out+'/profile/DevToolsActivePort'))){assert(Date.now()<end);assert.equal(browser.exitCode,null);await pause(20);}
    c=controller.connection(url,v=>record('UNKNOWN.json',v));await c.ready;
    c.event=v=>{
      if(v.method==='Target.attachedToTarget'&&v.params.targetInfo.type==='worker'){
        const {sessionId,targetInfo}=v.params,w={sessionId,targetId:targetInfo.targetId,url:targetInfo.url,scripts:[],closed:false};workers.set(sessionId,w);
        const task=(async()=>{await c.send('Runtime.enable',{},sessionId);await c.send('Debugger.enable',{},sessionId);await c.send('Runtime.runIfWaitingForDebugger',{},sessionId);})();tasks.push(task);task.catch(()=>{});
      }else if(v.method==='Target.detachedFromTarget'){const w=workers.get(v.params.sessionId);if(w)w.closed=true;}
      else if(v.method==='Debugger.scriptParsed'&&workers.has(v.sessionId)){
        const w=workers.get(v.sessionId),row={url:v.params.url,scriptId:v.params.scriptId};w.scripts.push(row);
        const task=c.send('Debugger.getScriptSource',{scriptId:row.scriptId},v.sessionId).then(value=>{const bytes=value.bytecode?Buffer.from(value.bytecode,'base64'):Buffer.from(value.scriptSource||'');Object.assign(row,{sha256:sha(bytes),size:bytes.length,bytecodeAvailable:!!value.bytecode});});tasks.push(task);task.catch(error=>row.error=String(error));
      }
    };
    const pages=(await c.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page');assert.equal(pages.length,1);const targetId=pages[0].targetId;
    session=(await c.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
    await c.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true},session);await c.send('Page.enable',{},session);
    await c.send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/index.html?debug&'+(mode==='worker'?'threads':'no-threads')+'&d3d-renderer=software'},session);
    const loadEnd=Date.now()+20000;while(!await evaluate(`typeof shell!=='undefined'&&typeof apps!=='undefined'`)){assert(Date.now()<loadEnd,'page ready');await pause(50);}
    const fixtureURL='/'+path.relative(ROOT,fixture);
    await evaluate(`(()=>{apps.${app}={label:'Authored native binding fixture',exe:${JSON.stringify(fixtureURL)},dlls:[],files:[]};shell.launchApp('${app}').catch(e=>console.error(e));return true;})()`);
    const nativeEnd=Date.now()+20000;for(;;){
      const value=await evaluate(`runningApps.map(a=>({running:a.wine.running,stopped:a.wine._stopped,worker:!!a.wine.guestWorker,slice:!!a.wine._workerLastSlice}))`);
      if(value.length===1&&value[0].running&&(mode==='main'||value[0].slice)){assert.equal(value[0].worker,mode==='worker');break;}
      assert(!value.some(a=>a.stopped),'authored fixture stopped during startup');assert(Date.now()<nativeEnd,'native fixture ready');await pause(50);
    }
    await Promise.all(tasks);bridgeOptions=await native.install({c,pageSession:session,workers,app,backend:'software'});
    if(mode==='worker')chain=helper.createChain({evaluate,send:c.send,workers,pageSession:session,app,expectedModules:pins.modules});
    await controller.boundedOperation(c,'fixture complete capture',()=>capture('first-modal'));
    record('ready.json',{mode,app,originalLaunched:false,bridgeOptions,at:Date.now()});
    for(let n=0;;n++){
      const file=path.join(out,'command-'+n+'.json');const commandEnd=Date.now()+90000;
      while(!fs.existsSync(file)){assert(Date.now()<commandEnd,'bounded personal review wait');await pause(25);}
      const cmd=JSON.parse(fs.readFileSync(file));
      if(cmd.action==='close'){record('receipt-'+n+'.json',{hostOnly:true});break;}
      await controller.boundedOperation(c,'authored fixture '+cmd.action,async()=>{
        if(cmd.action==='capture'){await capture(cmd.name);record('receipt-'+n+'.json',{state:'CAPTURED',latest});return;}
        assert.equal(cmd.action,'pulse');assert.equal(cmd.review,latest.label);assert(cmd.observation?.trim()&&cmd.intent?.trim());
        assert(/^[a-z0-9-]{8,100}$/.test(cmd.nonce));assert(Date.now()-latest.review.capturedAt<30000,'fresh complete personally reviewed menu scene');
        assert(!fs.existsSync(path.join(out,'used-'+latest.label+'.json')));record('used-'+latest.label+'.json',{nonce:cmd.nonce,observation:cmd.observation,intent:cmd.intent});
        const review={...latest.review,reviewed:true,observation:cmd.observation,maxAgeMs:30000};
        const binding=await evaluate(`__gta2NativeReleasePageV1.bind(${JSON.stringify(review)})`);
        const result=await controller.releaseGesture({c,session,out,name:cmd.name,keys:cmd.keys,ms:cmd.ms,
          cfg:{url,pid:browser.pid,startToken,targetId,owner:latest.owner,pins,bridgeOptions,review,
            bindingToken:binding.bindingToken,nonce:cmd.nonce,intent:cmd.intent}});
        record('receipt-'+n+'.json',{state:'ACK',result,at:Date.now()});
      });
    }
    record('outcome.json',{state:'COMPLETED_AUTHORED_FIXTURE',mode,originalLaunched:false});
  }catch(error){
    if(c&&!c.closed){
      try{const shot=await c.send('Page.captureScreenshot',{format:'png'},session);fs.writeFileSync(path.join(out,'first-failure.png'),Buffer.from(shot.data,'base64'),{flag:'wx'});}catch{}
      c.seal(error);
    }
    record('failure.json',{error:error.stack,originalLaunched:false,noRetry:true});process.exitCode=1;
  }finally{
    if(c)c.stop();if(browser){browser.kill('SIGTERM');let timer;try{await Promise.race([joined,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Chrome teardown exceeded 3s')),3000);})]);}catch{browser.kill('SIGKILL');await joined;}finally{clearTimeout(timer);}}
    if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
    record('executed-sources.json',{workers:[...workers.values()]});record('http.json',http);fs.rmSync(out+'/profile',{recursive:true,force:true});
  }
}
function verifyRelease(directory, expectedSHA256) {
  const base = fs.realpathSync(directory);
  const readRef = ref => {
    const file = fs.realpathSync(path.resolve(base, ref.path));
    assert(file.startsWith(base + path.sep), 'release reference must stay in its run');
    const bytes = fs.readFileSync(file);
    assert.equal(sha(bytes), ref.sha256, ref.path);
    return JSON.parse(bytes);
  };
  const bytes = fs.readFileSync(path.join(base, 'runtime-release.json'));
  assert.equal(sha(bytes), expectedSHA256);
  const release = JSON.parse(bytes);
  assert.equal(release.sourceBuildRuntimeReleased, true);
  assert.equal(release.published, true);
  assert.equal(release.strictPullPush, true);
  for (const ref of [release.result, ...(release.evidence || [])]) readRef(ref);
  const closure = readRef(release.directClosure);
  for (const ref of closure.receipts) {
    const receipt = readRef(ref);
    for (const key of ['actualWait', 'stdoutEOF', 'stderrEOF'])
      assert.equal(receipt[key], true, ref.path + ' ' + key);
  }
  for (const ref of closure.additionalLifecycleRefs || []) readRef(ref);
  for (const entry of closure.pids) {
    const pid = typeof entry === 'number' ? entry : entry.pid;
    assert(Number.isSafeInteger(pid) && pid > 1);
    for (const target of [pid, -pid]) {
      assert.throws(() => process.kill(target, 0), e => e.code === 'ESRCH', 'PID/group still present ' + target);
    }
  }
  return {at:new Date().toISOString(), directory:base, sha256:expectedSHA256,
    main:release.main, sourceBuildRuntimeReleased:true,
    actualWaitBothEOF:closure.receipts.length, pidsAndGroupsAbsent:closure.pids.length,
    historicalUnknown:closure.ancillaryUnknown || null,
    meaning:'Read-only personal release check; does not admit a lane without both current predecessors'};
}
function verifyObservedBlocker(directory) {
  const base=fs.realpathSync(directory),read=file=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'));
  const prefix='worker-qualification/control/';
  const cfg=read(prefix+'first-enter-release-config.json'),wait=read(prefix+'first-enter-release-wait.json');
  assert(wait.actualWait&&wait.stdoutEOF&&wait.stderrEOF);assert.equal(wait.code,0);
  const arm=JSON.parse(wait.stdout.trim()),up=read(prefix+'first-enter-up.json'),attest=read(prefix+'first-enter-attestation.json');
  assert(arm.at-cfg.startedAt>=0&&arm.at-cfg.startedAt<=500);assert.equal(arm.nonce,cfg.nonce);
  assert.deepEqual(arm.native,cfg.review.native);assert.deepEqual(arm.pageIdentity,cfg.review.pageIdentity);
  assert.equal(arm.bindingToken,cfg.bindingToken);assert.equal(arm.childToken,attest.childToken);
  assert.deepEqual(attest.native.native,cfg.review.native);assert.equal(attest.native.reviewedPNG,cfg.review.pngSHA256);
  assert.equal(sha(fs.readFileSync(path.join(base,prefix+'first-modal.png'))),cfg.review.pngSHA256);
  assert.equal(attest.currentHelperSHA256,cfg.pins.files.find(p=>p.path==='tools/gta2-browser-release-binding.cjs').sha256);
  assert(attest.sources.some(s=>s.bytecodeAvailable&&cfg.pins.modules.includes(s.sha256)));
  assert(attest.sources.some(s=>s.url.includes('/lib/guest-worker.js')&&s.sha256===cfg.pins.files.find(p=>p.path==='lib/guest-worker.js').sha256));
  assert(up.released.physicalUp);assert.deepEqual(up.released.events.map(e=>e.type),['DOWN','UP']);
  const hold=up.released.events[1].at-up.released.events[0].at;assert(hold>=80&&hold<=1400);assert(up.ack-up.released.events[0].at<=1750);
  const failed=[];
  for(const [folder,name] of [['worker-qualification/control/','second-enter'],['main-qualification/control/','first-enter']]){
    const result=read(folder+name+'-release-wait.json'),failure=read(folder+'failure.json'),unknown=read(folder+'UNKNOWN.json');
    assert(result.actualWait&&result.stdoutEOF&&result.stderrEOF);assert.equal(result.code,1);assert.equal(result.stdout,'');
    assert.match(result.stderr,/prearm exceeded 500ms/);assert.match(failure.error,/release prearm timeout/);
    assert.equal(failure.originalLaunched,false);assert.equal(unknown.permanentClose,true);assert.equal(unknown.laterRequestsAllowed,0);
    assert(!fs.existsSync(path.join(base,folder+name+'-up.json')));assert(!fs.existsSync(path.join(base,folder+name+'-attestation.json')));
    failed.push({folder,name,classification:'CURRENT_AUTHORED_BROWSER_PREARM_FAILURE',acceptedArm:false,downPermitted:false,permanentClose:true,laterRequestsAllowed:0});
  }
  for(const [folder,name]of [['worker-qualification','first-enter'],['worker-qualification','second-enter'],['main-qualification','first-enter']]){
    const pid=read(folder+'/control/'+name+'-release-wait.json').pid;
    for(const target of [pid,-pid])assert.throws(()=>process.kill(target,0),e=>e.code==='ESRCH');
  }
  return {observedRuntimeMain:fs.readFileSync(path.join(base,'validation-head.txt'),'utf8').trim(),
    observedHelperSHA256:attest.currentHelperSHA256,observedControllerSHA256:cfg.pins.files.find(p=>p.path==='tools/gta2-paired-controller.cjs').sha256,
    firstArmMs:arm.at-cfg.startedAt,physicalHoldMs:hold,physicalUPAcknowledgementMs:up.ack-up.released.events[0].at,
    failed,finalSourceCompleteNativeQualification:false,originalAttempts:0,nativeQuit:false,historicalNativeTimeoutCause:'UNPROVED'};
}
function currentMedia() {
  const rows=JSON.parse(source('scratch/runs/20261107-gta2-current-driving/fixture-identity.json')).matches;
  assert.equal(rows.length,71);assert.equal(new Set(rows.map(r=>r.path)).size,71);
  for(const row of rows){const bytes=fs.readFileSync(path.join(ROOT,row.path));assert.equal(bytes.length,row.size,row.path);assert.equal(sha(bytes),row.sha256,row.path);}
  const exe=rows.find(row=>row.path.endsWith('/gta2.exe'));
  assert.equal(exe.sha256,'97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3');
  const dlls=[['test/binaries/dlls/comctl32.dll','28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4'],
    ['test/binaries/dlls/commctrl.dll','39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9'],
    ['test/binaries/sims-native-common-controls/kommctrl.dll','39bbfafa8b759ebfcf6a00ee878fa494581a9144891bbd788bded61441de13f9']];
  for(const [file,hash]of dlls)assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash,file);
  const registration=require('../lib/apps.js').APPS.gta2_demo;assert(registration);
  assert.equal(fs.realpathSync(path.join(ROOT,registration.exe.startsWith('binaries/')?'test/'+registration.exe:registration.exe)),fs.realpathSync(path.join(ROOT,exe.path)));
  return {paths:rows.length,exe:exe.sha256,dlls,registration,registrationSHA256:sha(Buffer.from(JSON.stringify(registration))),
    staticOnly:true,genuineFTTargetInvocation:'UNPROVED',originalLaunched:false};
}
function currentSourceGuards() {
  const helper=require('../tools/gta2-browser-release-binding.cjs');
  const files=['tools/gta2-browser-release-binding.cjs','tools/gta2-paired-controller.cjs',
    'scratch/runs/20261108-redline-car-door-native/bound-input.cjs','build/wine-assembly.wasm'];
  const pins={files:files.map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(ROOT,file)))}))};
  helper.verifyPins(pins);
  for(const file of files){const changed=structuredClone(pins);changed.files.find(p=>p.path===file).sha256='0'.repeat(64);assert.throws(()=>helper.verifyPins(changed),/current source changed/);}
  for(const file of ['../outside','/absolute'])assert.throws(()=>helper.verifyPins({files:[{path:file,sha256:'0'.repeat(64)}]}));
  const stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8'),token=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
  helper.checkPID(process.pid,token);assert.throws(()=>helper.checkPID(process.pid,'replaced'));assert.throws(()=>helper.checkPID(2147483647,'absent'));
  const worker=helper.workerSource(),page=helper.pageSource({app:'authored',backend:'software',nativeOwner:{epoch:'authored',endpointIdentity:'main'}});
  assert(worker.includes('self.onmessage===onMessage'));assert(worker.includes('Atomics.wait'));
  assert(page.includes('originalDown.call(renderer'));assert(page.includes('wnd_lookup_generation'));assert(page.includes('permanent page UNKNOWN'));
  return {classification:'AUTHORED_PIN_PID_AND_SOURCE_GUARDS',files:files.length,mutationsRefused:files.length+4,
    actualNativeQualification:false,workerSourceSHA256:sha(Buffer.from(worker)),pageSourceSHA256:sha(Buffer.from(page))};
}
function audit() {
  const controller = source('tools/gta2-paired-controller.cjs');
  const helperPath = 'scratch/runs/20261108-redline-car-door-native/bound-input.cjs';
  const helper = source(helperPath);
  const exports = source('src/13-exports.wat');
  const worker = source('lib/guest-worker.js');
  const release = controller.slice(controller.indexOf('async function release('), controller.indexOf('async function browser('));
  assert(release.includes('cfg.startToken'), 'retain process-start identity');
  assert(release.includes("'Target.attachToTarget'"), 'actual independent child attaches its own transport');
  const waits = [...controller.matchAll(/setTimeout\([^\n]+?(?:arm timeout|prearm timeout)[^\n]+?,(\d+)\)/g)].map(m => Number(m[1]));
  // The initial legacy audit is retained in the run. Current implementation
  // has a shared 500ms launch deadline in both child and parent paths.
  const gaps = {
    prearmWaitsMs: waits,
    uniform500ms: controller.includes('500-(Date.now()-config.startedAt)') && controller.includes('500-(Date.now()-cfg.startedAt)') && !controller.includes("prearm timeout')),1000"),
    childMentionsNonce: /cfg\.nonce/.test(release),
    childMentionsScene: /cfg\.(?:scene|review)/.test(release),
    actualNativeBridge: controller.includes('gta2-browser-release-binding.cjs') && controller.includes('native.attestExecuted'),
    nativeSceneInHelper: /get_focus_hwnd|wnd_lookup_generation|cli-native-scene/.test(helper),
    workerContextIsInstanceLocal: ['main', 'focus', 'capture'].every(name =>
      exports.includes(`(func (export "get_${name}_hwnd")`) &&
      new RegExp(`export "get_${name}_hwnd"\\)[^\\n]+global.get \\$${name}_hwnd`).test(exports)),
    workerPublishesPriorFocus: worker.includes('focusHwnd: ex.get_focus_hwnd'),
  };
  return {kind: 'SOURCE_OBSERVATIONS_ONLY', gaps,
    pins: ['tools/gta2-paired-controller.cjs', helperPath, 'src/13-exports.wat', 'lib/guest-worker.js']
      .map(file => ({path:file, sha256:sha(fs.readFileSync(path.join(ROOT, file)))})),
    helperExecuted:false, nativeExecuted:false, browserExecuted:false,
    productionRepairQualified:false, historicalNativeTimeoutCause:'UNPROVED'};
}
if (require.main === module) {
  assert(['--audit', '--release', '--candidate-faults', '--prepare-fixture', '--bridge-model', '--page-model', '--browser-fixture', '--media', '--source-guards', '--verify-observed-blocker'].includes(process.argv[2]), 'explicit light-phase mode required');
  if(process.argv[2] === '--verify-observed-blocker')console.log(JSON.stringify(verifyObservedBlocker(process.argv[3]),null,2));
  else if(process.argv[2] === '--media')console.log(JSON.stringify(currentMedia(),null,2));
  else if(process.argv[2] === '--source-guards')console.log(JSON.stringify(currentSourceGuards(),null,2));
  else if (process.argv[2] === '--browser-fixture') browserFixture(process.argv[3],process.argv[4]).catch(error=>{console.error(error);process.exitCode=1;});
  else if (process.argv[2] === '--prepare-fixture') {
    const fixture = authoredPE();fs.writeFileSync(process.argv[3],fixture,{flag:'wx'});
    console.log(JSON.stringify({classification:'AUTHORED_FIXTURE_UNEXECUTED',sha256:sha(fixture),size:fixture.length}));
  } else if (process.argv[2] === '--page-model') candidatePageModel().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error);process.exitCode=1;});
  else if (process.argv[2] === '--bridge-model') candidateBridgeModel().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error);process.exitCode=1;});
  else console.log(JSON.stringify(process.argv[2] === '--audit' ? audit() : process.argv[2] === '--candidate-faults' ? candidateFaults() :
    verifyRelease(process.argv[3], process.argv[4]), null, 2));
}
module.exports = {audit, verifyRelease, candidateGate, candidateFaults, authoredPE, candidateNativeContext, candidateWorkerBridge, candidatePageBridge, candidateBridgeModel, candidatePageModel, browserFixture, currentMedia, currentSourceGuards, verifyObservedBlocker};
