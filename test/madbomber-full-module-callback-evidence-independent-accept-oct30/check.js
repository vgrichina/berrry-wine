'use strict';
// Evidence/oracle controls only. No Wasm compilation, instantiation or guest replay.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),assert=require('assert/strict');
const ROOT=process.cwd(),HERE=__dirname,PRIOR=path.join(ROOT,'test/madbomber-complete-input-full-module-midi-qualification-oct30');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p));
if(process.argv[2]==='startup'){
 const s={kind:'startup only',node:process.execPath,realNode:fs.realpathSync(process.execPath),nodeVersion:process.version,execArgv:process.execArgv,limits:fs.readFileSync('/proc/self/limits','utf8'),nodeOptions:process.env.NODE_OPTIONS??null,sharedMemory:new WebAssembly.Memory({initial:1,maximum:1,shared:true}).buffer instanceof SharedArrayBuffer};
 assert(s.sharedMemory);fs.writeFileSync(path.join(HERE,'startup.json'),JSON.stringify(s,null,2));console.log(JSON.stringify(s));process.exit(0);
}
assert.equal(process.argv[2],'check');
const pins=json(path.join(HERE,'input-pins.json'));
for(const [p,v] of Object.entries(pins.inputs)){const b=fs.readFileSync(p);assert.equal(b.length,v.bytes,'length '+p);assert.equal(sha(b),v.sha256,'source identity '+p);}
const src=fs.readFileSync(path.join(PRIOR,'lifecycle.js'),'utf8'),host=fs.readFileSync('lib/host-audio.js','utf8'),wat=fs.readFileSync('src/13-exports.wat','utf8');
const r=json(path.join(PRIOR,'lifecycle-report.json')),compile=json(path.join(PRIOR,'compile-report.json')),manifest=json(path.join(PRIOR,'artifact-manifest.json')),api=json('src/api_table.json');
const names=['midiStreamOpen','midiOutPrepareHeader','midiStreamOut','midiStreamRestart','midiStreamStop','midiStreamClose'];
const result={kind:'independent retained-evidence and original-oracle controls; no production execution',candidate:pins.candidate,verifiedInputs:Object.keys(pins.inputs).length,checks:[],controls:[],counterexamples:[]};
function check(name,f){f();result.checks.push(name);}
function reject(name,f,pattern){let error;try{f();}catch(e){error=e;}assert(error,name+' must reject');assert.match(error.message,pattern);result.controls.push({name,rejected:true,reason:error.message,scope:'evidence/oracle control; no production mutation'});}
function identity(report,expectedModule,sourceExpected=pins.inputs['lib/host-audio.js'].sha256){
 assert.equal(report.moduleSHA256,expectedModule,'expected module identity');
 assert.equal(sha(fs.readFileSync('lib/host-audio.js')),sourceExpected,'expected source identity');
}
check('20 exact SHA256 and byte pins',()=>assert.equal(result.verifiedInputs,20));
check('retained compile/lifecycle/module manifest agree',()=>{identity(r,manifest['complete.wasm'].sha256);assert.equal(compile.moduleSHA256,r.moduleSHA256);assert.equal(compile.moduleBytes,manifest['complete.wasm'].bytes);assert.equal(compile.importCount,291);assert.equal(compile.exportCount,2225);});
reject('falsified expected module identity',()=>identity(r,'0'.repeat(64)),/expected module identity/);
reject('falsified expected source identity',()=>identity(r,compile.moduleSHA256,'0'.repeat(64)),/expected source identity/);
// Execute ONLY the exact pinned synthetic PE constructor, stopping before any file/VM load.
const peSource=src.slice(src.indexOf(' const pe=Buffer.alloc'),src.indexOf(" fs.writeFileSync('synthetic-midi.exe'"));
assert(peSource.startsWith(' const pe=Buffer.alloc'));assert(!peSource.includes('load_pe'));
const pe=vm.runInNewContext(peSource+'\npe;', {Buffer,names},{timeout:1000});
check('exact synthetic PE bytes and RET20 ABI',()=>{
 assert.equal(sha(pe),r.synthetic.peSHA256);assert.equal(sha(pe),manifest['synthetic-midi.exe'].sha256);assert.equal(pe.length,4608);
 assert.equal(pe.readUInt16LE(0x84),0x14c);assert.deepEqual([...pe.subarray(0x280,0x283)],[0xc2,20,0]);
 assert.equal(pe.readUInt32LE(0x100),0x1100);assert.equal(pe.readUInt32LE(0x300),0x1200);assert.equal(pe.readUInt32LE(0x310),0x1240);
 const off=rva=>rva-0x1000+0x200;
 names.forEach((n,i)=>{const nrva=pe.readUInt32LE(off(0x1240)+i*4);assert.equal(nrva,pe.readUInt32LE(off(0x1200)+i*4));const p=off(nrva)+2;assert.equal(pe.subarray(p,pe.indexOf(0,p)).toString(),n);});
});
check('candidate source callback has five arguments plus continuation',()=>{
 const body=wat.slice(wat.indexOf('  (func $fire_audio_callback_bound'),wat.indexOf('  ;; Existing cooperative entry retains'));
 const pushes=[...body.matchAll(/\(call \$gs32[^\n]+/g)].map(m=>m[0]);
 assert.equal(pushes.length,6);
 ['(i32.const 0)','(local.get $wave_hdr)','(local.get $instance)','(local.get $message)','(local.get $handle)','(global.get $mm_timer_ret_thunk)'].forEach((v,i)=>assert(pushes[i].includes(v)));
 assert(body.includes('(call $save_caller_regs)'));assert(wat.includes('(export "fire_midi_out_callback_bound")'));
});
check('retained IAT IDs/nargs match current candidate table',()=>{
 assert.equal(r.identities.length,6);
 r.identities.forEach((id,i)=>{assert.equal(id.name,names[i]);assert.equal(api[id.id].name,id.name);assert.equal(api[id.id].id,id.id);assert.equal(api[id.id].nargs,id.nargs);assert.equal(id.thunk,0x7500000+i*8);});
 assert.deepEqual(r.calls.map(c=>c.name),['midiStreamOpen','midiOutPrepareHeader','midiStreamOut','midiStreamRestart','midiStreamStop','midiStreamRestart','midiStreamOut','midiStreamRestart','midiStreamStop','midiStreamClose']);
 r.calls.forEach(c=>{assert.equal(c.result,0);assert.equal(c.args.length,api.find(x=>x.name===c.name).nargs);});
});
const h=0xc0001,hdr=0x405100,instance=0x98765,cb=0x401080,idle=0x401000,stack=0x7400000;
check('retained callback frames and final header flags',()=>{
 assert.deepEqual(r.callbacks.map(c=>c.message),[0x3c7,0x3c9,0x3c8]);
 for(const c of r.callbacks)assert.deepEqual(c.frame,[0x7500130,h,c.message,instance,c.message===0x3c9?hdr:0,0]);
 assert.equal(r.flags&19,3);assert(r.negativeControl.rejected);assert.match(r.negativeControl.error,/one stop delivery\/callback required/);
});
// The unchanged original pump is the system under test here. This adapter supplies
// retained frame values and abstract register observations, NOT a Wasm implementation.
const pumpSource=src.slice(src.indexOf(' function pump('),src.indexOf(' pump(0x3c7);'));
assert(pumpSource.includes("assert.equal(e.get_eip(),idle)"));
function oracle(options={}){
 const evidence={callbacks:[]},ctx={_midiOut:{callbacks:[{message:0x3c9}]}},frame=r.callbacks[1].frame.slice();
 if(options.badArgument)frame[2]=0x3c8;
 let state={eip:idle,esp:stack+128,eax:0x11223344,ecx:0x1122,edx:0x3344,flags:0x202},runs=0;
 const callbackSp=stack+128-40-24;
 const e={set_esp:v=>state.esp=v,set_eip:v=>state.eip=v,set_eax:v=>state.eax=v,get_esp:()=>state.esp,get_eip:()=>state.eip,get_eax:()=>state.eax,
 thunk_word:()=>options.badMarker?0xcaca000b:0xcaca000a,
 run:()=>{runs++;if(runs===1){state.eip=options.badReturn?frame[0]+8:frame[0];state.esp+=24;}
 else {state.eip=idle;state.esp=stack+128-(options.badStack?4:0);state.eax=options.badEax?0xdead:0x11223344;if(options.badUncheckedState){state.ecx=0xdead;state.edx=0xbeef;state.flags=0;}}}};
 const read=a=>frame[(a-callbackSp)/4];
 const audio={pumpWaveOutCompletions:()=>{if(ctx._midiOut.callbacks.length){ctx._midiOut.callbacks.shift();state.esp=callbackSp;state.eip=cb;}}};
 const context={assert,evidence,ctx,stack,e,idle,cb,h,hdr,instance,read,audio};
 vm.runInNewContext(pumpSource+'\npump(0x3c9,'+Boolean(options.suppress)+');',context,{timeout:1000});
 return {state,runs};
}
check('unchanged original pump accepts retained MOM_DONE frame',()=>assert.equal(oracle().runs,2));
reject('corrupt callback message frame',()=>oracle({badArgument:true}),/968 !== 969/);
reject('corrupt return continuation',()=>oracle({badReturn:true}),/callback reaches real return continuation/);
reject('corrupt continuation marker',()=>oracle({badMarker:true}),/3402235915[\s\S]*3402235914/);
reject('corrupt restored stack',()=>oracle({badStack:true}),/Expected values to be strictly equal/);
reject('corrupt restored EAX',()=>oracle({badEax:true}),/Expected values to be strictly equal/);
reject('suppress accepted MOM_DONE',()=>oracle({suppress:true}),/one stop delivery\/callback required/);
const unchecked=oracle({badUncheckedState:true});
assert.equal(unchecked.state.ecx,0xdead);assert.equal(unchecked.state.edx,0xbeef);assert.equal(unchecked.state.flags,0);
result.counterexamples.push({name:'original callback oracle accepts corrupt ECX/EDX/flags observations',acceptedByOriginalOracle:true,state:unchecked.state,scope:'oracle-adapter counterexample only; not a production mutation or demonstrated production defect'});
// Exercise the precise post-stop service assertions with a transport that accepts
// a stale notification (therefore drains it) and redirects EIP. Final close below
// this excerpt might detect its in-flight guard; this is NOT a whole-harness bypass.
const staleSource=src.slice(src.indexOf(' now=10000;'),src.indexOf(' // Reuse the stopped stream'));
assert(staleSource.includes("'no stale replay'"));
const stale={eip:idle,deliveries:0},evidence={callbacks:[{},{}]},ctx={_midiOut:{callbacks:[]}};
const audio={imports:{midi_stream_service:()=>{}},pumpWaveOutCompletions:()=>{if(!stale.deliveries){stale.deliveries++;stale.eip=cb;}ctx._midiOut.callbacks.length=0;}};
vm.runInNewContext(staleSource,{now:100,count:2,noteCount:0,sent:[],assert,evidence,ctx,audio,h,call:()=>0},{timeout:1000});
assert.equal(stale.deliveries,1);assert.equal(stale.eip,cb);
result.counterexamples.push({name:'post-stop service assertion excerpt accepts consumed stale callback',acceptedByOriginalOracle:true,deliveries:1,eip:stale.eip,scope:'excerpt-level only; full close pump may catch outstanding callback; no whole-harness bypass claimed'});
check('source-owned host stop/complete/owner model',()=>{
 for(const s of ['if (submission.done) return;','submission.done = true;','s.queue = [];','s.running = false;','s.due = null;','s.remainder = 0n;','_midiNotify(dev, 0x3c9, submission.ga);',"if (r.owner !== ctx.exports) throw new Error('MIDI callback owner changed');"])assert(host.includes(s));
});
result.decision='ACCEPT retained synthetic-boundary evidence with scope downgrade; WITHHOLD independent full-module execution and general CPU-state restoration qualification';
result.productionExecutedLocally=false;result.moduleBytesInspected=false;
fs.writeFileSync(path.join(HERE,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
