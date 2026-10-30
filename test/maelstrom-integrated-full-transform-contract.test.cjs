'use strict';
// Offline contract: complete production transform first; only its emitted
// set_uop/mne_uop_switch functions are compiled in the synthetic fixture below.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {createHash} = require('node:crypto');
const root = path.resolve(__dirname, '..');
const inputRoot = process.argv[2];
assert.ok(inputRoot, 'usage: node TEST INPUT_ROOT [REPORT.json]');
const sha = x => createHash('sha256').update(x).digest('hex');
const pins = {
  'tools/maelstrom-native-errno-latch.cjs':'6d6105f10636bc160eec3baa62b5abe42fa6c1306958bfa786717bfb8b109e42',
  'tools/maelstrom-select-completion-hook.cjs':'b8fbdf8bc259f903c4b0c0b78f2834698c97759b7cf3cb9fc0d1f5a77a0c932d',
  'tools/maelstrom-original-errno-adapter.cjs':'cbe04fef7e98c1ff607251812225b8314fc0aaff2c289331b95839cfe2df2b49',
  'tools/watx.js':'d04ed1d5ca74fc1b6f10357576a38e726d58f0ad908ccf34a29de35052aa1a33',
  'tools/watx-src/compiler-parser.js':'ef37c325225a95aaf8ddb5186a9c6cea1aa00fb4040e9077767e432011800236',
  'tools/watx-src/compiler-stages.js':'b2d79b473ac8d3083c33d9d6e635f04aeae2c33c35a2907767f503f38ecb0a03',
  'tools/watx-src/compiler-codegen.js':'84744dbdef3897f589f1c1465cc6d3025448250df09b1254369fdb16f73fa94d',
  'tools/watx-src/compiler.js':'0633b916abfcab30ba5f2698b27da2454ae387afd3c781e1c35d21c8506f5175',
};
for (const [p,h] of Object.entries(pins)) assert.equal(sha(fs.readFileSync(path.join(root,p))),h,p);
const helperFile = path.join(root,'tools/maelstrom-native-errno-latch.cjs');
const helper = require(helperFile);
const adapter = require('../tools/maelstrom-original-errno-adapter.cjs');
const sourcePins = {...helper.PINS,...helper.UOP_PINS};
assert.equal(Object.keys(sourcePins).length,13);
const sources = Object.fromEntries(Object.keys(sourcePins).map(p => [p,fs.readFileSync(path.join(inputRoot,p),'utf8')]));
for (const [p,h] of Object.entries(sourcePins)) assert.equal(sha(sources[p]),h,p);
Object.freeze(sources);
const original = '/tmp/maelstrom-frozen-original-recovered-capture-oct25';
const binaryPaths = {net:original+'/vfs/maelstrom/SDL_net.dll',crt:original+'/runtime/system/msvcrt.dll',exe:original+'/vfs/maelstrom/Maelstrom.exe'};
const binaries = Object.fromEntries(Object.entries(binaryPaths).map(([k,p])=>[k,fs.readFileSync(p)]));
const options = {enabled:true,binaries,crtLoadedBase:0x522000,uopNativeBoundaries:true};
// FIRST behavioral checkpoint. No historical runner or hand assembled source
// replaces this exact complete transform call on the entire pinned closure.
const output = helper.transform(sources,options);
assert.deepEqual(Object.keys(output).sort(),Object.keys(sources).sort());
console.log('PASS first boundary: pinned production transform accepted all 13 fragments and original binaries');
const changed = Object.keys(output).filter(p=>output[p]!==sources[p]).sort();
let sourceTamper=0,binaryTamper=0;
assert.deepEqual(changed,['src/05-alu.wat','src/06b-core-handlers.wat','src/07d-uop-engine.wat','src/07e-uop-compiler.wat','src/09b-dispatch.wat','src/09d-winsock.wat']);
for (const [p,h] of Object.entries(sourcePins)) assert.equal(sha(sources[p]),h,'input unchanged '+p);
const inaccessible = new Proxy({}, {get(){throw Error('disabled inspected input');},ownKeys(){throw Error('disabled enumerated input');}});
assert.equal(helper.transform(inaccessible),inaccessible);
assert.equal(helper.transform(inaccessible,{enabled:false,get binaries(){throw Error('disabled inspected binaries');}}),inaccessible);
assert.equal(helper.transform(sources,{enabled:false}),sources);
for(const p of Object.keys(sources)) {
  assert.throws(()=>helper.transform({...sources,[p]:sources[p]+'\n;; altered'},options),
    e=>e.message==='source pin: '+p);sourceTamper++;
}
for(const k of Object.keys(binaries)) {
  const b=Buffer.from(binaries[k]);b[b.length-1]^=1;
  assert.throws(()=>helper.transform(sources,{...options,binaries:{...binaries,[k]:b}}),
    e=>e.message==='binary pin: '+k);binaryTamper++;
}
for(const base of [undefined,0,-1,0x522001,0x80000000,1.5])
  assert.throws(()=>helper.transform(sources,{...options,crtLoadedBase:base}),/explicit future native CRT loaded base required/);
// Extract one balanced form from real transform output. Comments/strings are
// skipped, rather than treating a ')' in a comment as a function terminator.
function form(text,anchor) {
  const start=text.indexOf(anchor);assert.ok(start>=0,anchor);
  assert.equal(text.indexOf(anchor,start+anchor.length),-1,'unique '+anchor);
  let depth=0,quoted=false,line=false,block=0;
  for(let i=start;i<text.length;i++) {
    const c=text[i],n=text[i+1];
    if(line){if(c==='\n')line=false;continue;}
    if(block){if(c==='('&&n===';'){block++;i++;}else if(c===';'&&n===')'){block--;i++;}continue;}
    if(quoted){if(c==='\\')i++;else if(c==='"')quoted=false;continue;}
    if(c===';'&&n===';'){line=true;i++;continue;}
    if(c==='('&&n===';'){block=1;i++;continue;}
    if(c==='"'){quoted=true;continue;}
    if(c==='(')depth++;else if(c===')'&&--depth===0)return text.slice(start,i+1);
  }
  assert.fail('unbalanced '+anchor);
}
const winsock=output['src/09d-winsock.wat'];
const switchForm=form(winsock,'(func $mne_uop_switch ');
const setter=form(output['src/07d-uop-engine.wat'],'(func (export "set_uop")');
assert.ok(setter.indexOf('(call $mne_uop_switch')<setter.indexOf('(global.set $uop_enabled'));
const complete=form(winsock,'(func $mne_complete\n');
assert.match(complete,/\(global\.set \$mne_rejectReason \(i32\.const 16\)\)/);
assert.match(form(output['src/06b-core-handlers.wat'],'(func $th_call_r '),/\(call \$mne_call /);
assert.match(form(output['src/05-alu.wat'],'(func $th_ret '),/\(call \$mne_return \(local.get \$mne_source\)\)/);
assert.match(winsock,/\(then \(call \$mne_complete\)\)/);
const a=helper.verifyBinaries(binaries);
for(const addr of [a.successor-2,options.crtLoadedBase+a.crtRetRva])
  assert.ok(output['src/07e-uop-compiler.wat'].includes('(i32.eq (local.get $addr) (i32.const '+addr+'))'));
assert.ok(output['src/07e-uop-compiler.wat'].includes('(then (call $uc_unsup (local.get $R)) (return))'));
for(const k of [...helper.FIELDS,...helper.DIAGNOSTIC_FIELDS,...helper.MODE_SWITCH_DIAGNOSTIC_FIELDS])
  form(winsock,'(func (export "mne_'+k+'")');
for(let reason=1;reason<=36;reason++)
  assert.ok(winsock.includes('(global.set $mne_rejectReason (i32.const '+reason+'))'),'reason '+reason);
// A tiny fixture executes only emitted switch/setter code, with explicit
// synthetic pre-state. Other emulator functions are counted stubs. It does not
// execute select, CALL, RET, guest instructions, or the full generated module.
const {compile}=require('../tools/watx.js');
const names=[...helper.FIELDS,...helper.DIAGNOSTIC_FIELDS,...helper.MODE_SWITCH_DIAGNOSTIC_FIELDS].map(k=>'mne_'+k)
  .concat(['mne_uopMode','uop_enabled','code16','block_exec_enabled','eip','current_thread_id','reg_base',
    'msc_ret','msc_phase','msc_completions','msc_fault','msc_active','msc_capped','flushes','refreshes']);
assert.equal(new Set(names).size,names.length);
const declarations=names.map(n=>'(global $'+n+' (mut i32) (i32.const 0))').join('\n');
const access=names.map(n=>'(func (export "set_'+n+'") (param $v i32) (global.set $'+n+' (local.get $v)))\n'+
  '(func (export "get_'+n+'") (result i32) (global.get $'+n+'))').join('\n');
const stubs='(func $uop_flush (global.set $flushes (i32.add (global.get $flushes) (i32.const 1))))\n'+
  '(func $bx_hot_gate_refresh (global.set $refreshes (i32.add (global.get $refreshes) (i32.const 1))))';
function fixture(sw) {
  const text=declarations+'\n'+access+'\n'+stubs+'\n'+sw+'\n'+setter+'\n';
  const c=compile(text,new Map(),{logSummary:false,logFunctions:false,debugArtifacts:false});
  assert.equal(c.success,true,JSON.stringify(c.errors||c));
  assert.ok(WebAssembly.validate(c.wasmBinary));
  return {module:new WebAssembly.Module(c.wasmBinary),sha256:sha(text),wasmSHA256:sha(c.wasmBinary)};
}
function sample(f,from,status,other,request) {
  const e=new WebAssembly.Instance(f.module).exports;
  // Production adapter consumes actual Wasm diagnostic getters. Only start
  // and unrelated select scalars are synthetic; no select execution is claimed.
  const exports={mne_start:()=>e.set_mne_status(1)},rows=[];
  for(const k of [...helper.FIELDS,...helper.DIAGNOSTIC_FIELDS,...helper.MODE_SWITCH_DIAGNOSTIC_FIELDS])
    exports['mne_'+k]=e['get_mne_'+k];
  for(const k of ['started','phase','token','entries','parks','completions','fault','capped','active','thread','regs','pre','post','ret','result'])
    exports['msc_'+k]=()=>0;
  const owner=adapter.createAdapter({exports},{persist:r=>rows.push(r),readLive:()=>({synthetic:true})});
  owner.start();
  const init={mne_uopMode:from,uop_enabled:from,mne_status:status,mne_event:Math.max(0,Math.min(status,3)-1),
    code16:other&1,block_exec_enabled:(other>>>1)&1,eip:0xf1234567,current_thread_id:7,reg_base:0x80000000,
    msc_ret:helper.SELECT_RETURN,msc_phase:3,msc_completions:1};
  for(const [n,v] of Object.entries(init))e['set_'+n](v);
  e.set_uop(request);
  const get=ks=>Object.fromEntries(ks.map(k=>[k,e['get_mne_'+k]()>>>0]));
  return {e,owner,rows,n:get(helper.FIELDS),d:get(helper.DIAGNOSTIC_FIELDS),s:get(helper.MODE_SWITCH_DIAGNOSTIC_FIELDS)};
}
function checkSwitch(row,from,status,other,request) {
  const {e,n,d,s}=row;
  assert.equal(n.status,5);assert.equal(n.event,status-1);assert.equal(d.rejectReason,15);
  assert.equal(d.rejectModes,(from<<2)|other);assert.equal(d.rejectExpectedRet,helper.SELECT_RETURN);
  assert.deepEqual(s,{rejectRequestedMode:request!==0?1:0,rejectLatchedMode:from,rejectPC:0xf1234567,
    rejectThread:7,rejectRegs:0x80000000,rejectStatus:status});
  const decoded=adapter.decodeRejection(n,d,s);
  assert.equal(decoded.modeSwitch.boundaryPC,0xf1234567);
  assert.equal(decoded.modeSwitch.statusBeforeRejection,status);
  assert.equal(e.get_uop_enabled(),request!==0?1:0);
  assert.equal(e.get_flushes(),request===0?1:0);assert.equal(e.get_refreshes(),1);
  assert.throws(()=>row.owner.observe(1),/^Error: native latch status rejection$/);
  assert.equal(row.rows.length,2);assert.equal(row.rows[1].kind,'rejected');
  assert.deepEqual(row.rows[1].historicalNativeRejection,decoded);
  assert.equal(row.owner.observe(2),null,'adapter seals terminal rejection');
  // Terminal rejection stays immutable on a later opposite request.
  e.set_uop(from);
  for(const [k,v] of Object.entries(s))assert.equal(e['get_mne_'+k]()>>>0,v);
  return decoded;
}
const f=fixture(switchForm);let switches=0,noops=0,terminal=0;
for(const from of [0,1])for(const status of [1,2,3])for(const other of [0,1,2,3]) {
  checkSwitch(sample(f,from,status,other,1-from),from,status,other,1-from);switches++;
  const row=sample(f,from,status,other,from);
  assert.equal(row.n.status,status);assert.equal(row.d.rejectReason,0);
  assert.ok(Object.values(row.s).every(x=>x===0));noops++;
}
for(const from of [0,1])for(const status of [0,4,5]) {
  const row=sample(f,from,status,0,1-from);
  assert.equal(row.n.status,status);assert.equal(row.d.rejectReason,0);
  assert.ok(Object.values(row.s).every(x=>x===0));terminal++;
}
for(const request of [-1,2,0x7fffffff])checkSwitch(sample(f,0,1,0,request),0,1,0,request);
// Meaningful mutation of the actual production transform: remove its PC
// diagnostic assignment, then transform the full closure again. The same
// emitted-code oracle must reject its incomplete diagnostic.
const code=fs.readFileSync(helperFile,'utf8');
const mutation="${set('rejectPC', '(global.get $eip)')}";
assert.equal(code.split(mutation).length,2);
const sandbox={require:createRequire(helperFile),module:{exports:{}},Buffer};
vm.runInNewContext(code.replace(mutation,''),sandbox,{filename:helperFile+'#diagnostic-removal-mutant'});
const mutantOutput=sandbox.module.exports.transform(sources,options);
for(const p of Object.keys(output))assert.equal(mutantOutput[p],p==='src/09d-winsock.wat'
  ? output[p].replace('(global.set $mne_rejectPC (global.get $eip))','') : output[p], 'isolated mutant '+p);
const mutant=fixture(form(mutantOutput['src/09d-winsock.wat'],'(func $mne_uop_switch '));
assert.throws(()=>checkSwitch(sample(mutant,0,1,0,1),0,1,0,1),
  e=>e.code==='ERR_ASSERTION'&&e.actual?.rejectPC===0&&e.expected?.rejectPC===0xf1234567,
  'diagnostic removal must be killed specifically for missing boundary PC');
const report={schema:'maelstrom-integrated-full-transform-contract/v1',passed:true,
  productionRevision:'b115cacaf93ba01f526610126c72a185e6abf5c5',historicalBase:'55f9724ef127100c3bb54aebca73e5cda5472c5f',
  productionPins:pins,sourcePins,binaryPins:helper.BINARY_PINS,binaryPaths,options:{enabled:true,crtLoadedBase:options.crtLoadedBase,uopNativeBoundaries:true},
  changed,outputs:Object.fromEntries(Object.keys(output).sort().map(p=>[p,{bytes:Buffer.byteLength(output[p]),sha256:sha(output[p]),changed:output[p]!==sources[p]}])),
  checks:{sourceTamper,binaryTamper,disabledIdentity:3,invalidBases:6,switches,noops,terminal,normalizedRequests:3,adapterPersistedRejections:switches+3,diagnosticRemovalMutantKilled:true},
  fixture:{sourceSHA256:f.sha256,wasmSHA256:f.wasmSHA256,extractedSwitchSHA256:sha(switchForm),extractedSetterSHA256:sha(setter)},
  limitations:['Complete production transform accepted; complete generated module not compiled or instantiated.',
    'Only emitted set_uop and mne_uop_switch executed with synthetic pre-state and counted flush/refresh stubs.',
    'CALL/RET/select instrumentation checked as emitted source only; guest ordering and native errno capture unqualified.',
    'No browser, guest, gameplay, runtime, Boat, full build, performance or causal-instruction claim.']};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,checks:report.checks,changed,fixture:report.fixture}));
