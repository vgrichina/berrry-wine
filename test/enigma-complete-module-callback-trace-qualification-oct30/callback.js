'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const {createAudioHost}=require('./lib/host-audio.js');
const {REGIONS}=require('./lib/region-map.generated.js');
const api=JSON.parse(fs.readFileSync('src/api_table.json'));
const names=['midiStreamOpen'];
const evidence={scope:'complete canonical module; synthetic PE and backend; real run/export/API dispatch and production audio host',phase:'instantiate',calls:[],callbacks:[],synthetic:{imageBase:0x400000,sectionRVA:0x1000,initialClockMs:100,backend:'recording TinySynth and running AudioContext clock; no audio hardware',guest:'one synthetic PE; MIDI IAT imports; callback x86 RET 20; idle JMP to self; no original Enigma binary',services:'unused host functions throw; log records diagnostics; get_ticks uses synthetic clock'},open:['original Enigma guest/gameplay','native application','audio hardware','browser']};
const write=()=>fs.writeFileSync('lifecycle-report.json',JSON.stringify(evidence,null,2));
let now=100;
try{
 const memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true}),dv=new DataView(memory.buffer);
 const sent=[];
 class Synth{send(msg){sent.push([...msg]);} allSoundOff(ch){sent.push(['allSoundOff',ch]);} reset(){sent.push(['reset']);}}
 const ctx={getMemory:()=>memory.buffer,WebAudioTinySynth:Synth,guestNowMs:()=>now,audioClockMs:()=>now};
 const audio=createAudioHost(ctx,{getHost:()=>({}),profileNow:()=>0,profileEvent:()=>{}});
 ctx._voices._ensureCtx=()=>({state:'running',get currentTime(){return now/1000;}});
 const bytes=fs.readFileSync('complete.wasm');
 evidence.moduleSHA256=crypto.createHash('sha256').update(bytes).digest('hex');
 const moduleUnderTest=new WebAssembly.Module(bytes),host={...audio.imports,memory,get_ticks:()=>now,log:(p,n)=>{evidence.logs??=[];evidence.logs.push(Buffer.from(memory.buffer,p,n).toString());}};
 for(const i of WebAssembly.Module.imports(moduleUnderTest)){
  assert.equal(i.module,'host');
  if(!(i.name in host)){assert.equal(i.kind,'function');host[i.name]=()=>{throw Error('fail-closed unused host service: '+i.name);};}
 }
 const e=new WebAssembly.Instance(moduleUnderTest,{host}).exports;ctx.exports=e;
 // Canonical diagnostic switch removes log/log_api_exit host calls while
 // preserving get_api_calls; neither MIDI handlers nor lifecycle change.
 e.set_api_log(0);evidence.synthetic.apiLogging='disabled by production set_api_log(0); API counter asserted';
 evidence.instantiated=true;evidence.phase='initialize synthetic PE through production load_pe';write();
 // One ordinary PE section holds a real import descriptor, ILT/IAT and the
 // synthetic callback/idle bytes. Production load_pe performs lookup/init.
 const pe=Buffer.alloc(0x1200),u16=(p,v)=>pe.writeUInt16LE(v,p),u32=(p,v)=>pe.writeUInt32LE(v>>>0,p);
 u16(0,0x5a4d);u32(0x3c,0x80);u32(0x80,0x4550);u16(0x84,0x14c);u16(0x86,1);u16(0x94,224);u16(0x96,0x102);
 u16(0x98,0x10b);u32(0xa8,0x1000);u32(0xb4,0x400000);u32(0xb8,0x1000);u32(0xbc,0x200);u32(0xd0,0x10000);u32(0xd4,0x200);u16(0xdc,3);u32(0xe0,0x100000);u32(0xf4,16);u32(0x100,0x1100);u32(0x104,40);
 pe.write('.text',0x178);u32(0x180,0x1000);u32(0x184,0x1000);u32(0x188,0x1000);u32(0x18c,0x200);u32(0x19c,0xe0000020);
 const off=rva=>rva-0x1000+0x200;
 pe[off(0x1000)]=0xeb;pe[off(0x1000)+1]=0xfe;
 pe[off(0x1080)]=0xc2;pe[off(0x1080)+1]=20;pe[off(0x1080)+2]=0;
 u32(off(0x1100),0x1200);u32(off(0x110c),0x1180);u32(off(0x1110),0x1240);pe.write('WINMM.dll\0',off(0x1180));
 names.forEach((name,i)=>{const rva=0x1300+i*64;u32(off(0x1200)+4*i,rva);u32(off(0x1240)+4*i,rva);pe.write(name+'\0',off(rva)+2);});
 fs.writeFileSync('synthetic-midi.exe',pe);evidence.synthetic.peSHA256=crypto.createHash('sha256').update(pe).digest('hex');
 new Uint8Array(memory.buffer,REGIONS.PE_STAGING.base,pe.length).set(pe);
 assert.equal(e.load_pe(pe.length),0x401000,'production initializer returns entry point');
 e.seal_thunks();evidence.initialized=true;
 const wa=g=>e.guest_to_wasm(g)>>>0,read=g=>dv.getUint32(wa(g),true),put=(g,v)=>dv.setUint32(wa(g),v>>>0,true);
 const thunks=Object.fromEntries(names.map((n,i)=>[n,read(0x401240+4*i)]));
 evidence.identities=names.map(name=>{const row=api.find(r=>r.name===name);assert(row);assert.equal(row.id,api.indexOf(row));assert.equal(e.thunk_word(thunks[name],1),row.id,name+' real lookup ID');return {name,id:row.id,nargs:row.nargs,thunk:thunks[name]};});
 evidence.phase='real exported run -> win32_dispatch -> registered MIDI handlers';write();
 const stack=e.get_esp()-4096;
 function call(name,args){
  const row=api.find(r=>r.name===name),before=e.get_api_calls();
  assert.equal(args.length,row.nargs,name+' nargs');put(stack,0);args.forEach((a,i)=>put(stack+4+i*4,a));
  e.set_yield_state(0,0);e.set_esp(stack);e.set_eip(thunks[name]);e.run(1);
  assert.equal(e.get_eip(),0,name+' return');assert.equal(e.get_esp(),stack+4*(row.nargs+1),name+' stdcall');assert.equal(e.get_api_calls(),before+1,name+' dispatch count');
  const result=e.get_eax()>>>0;evidence.calls.push({name,args,result});return result;
 }
 const out=0x405000,device=0x405010,hdr=0x405100,data=0x405180,cb=0x401080,instance=0x98765;
 put(device,0);assert.equal(call('midiStreamOpen',[out,device,1,cb,instance,3<<16]),0);
 const h=read(out);assert(h);const dev=ctx._midiOut.devices.get(h);assert(dev);assert.equal(dev.registration.owner,e);
 assert.equal(dev.registration.callback,cb);assert.equal(dev.registration.instance,instance);

 const idle=0x401000,oldEsp=stack+128,savedEax=0x11223344;
 const trace=()=>Array.from({length:8},(_,i)=>e.get_audio_callback_trace(i)>>>0);
 const wait=()=>[e.get_yield_reason(),e.get_wait_handle(),e.get_wait_timeout(),e.get_wait_stack_bytes(),e.get_wait_handles_ptr(),e.get_wait_all(),e.get_yield_flag()];
 const oracle=(t,serial,saved)=>{
  assert.equal(t[0],0,'active cleared after continuation');
  assert.equal(t[1],serial,'returned serial must match admitted invocation');
  assert.deepEqual(t.slice(2),[idle,oldEsp,...saved.slice(0,4)].map(x=>x>>>0),'trace restored context');
 };
 e.set_audio_callback_trace(1);assert.deepEqual(trace(),Array(8).fill(0));
 let lastSerial=0;
 function finish(enabled,expectedMessage,reason=0){
  e.set_esp(oldEsp);e.set_eip(idle);e.set_eax(savedEax);e.set_yield_state(reason,reason?1:0);
  const saved=wait(),before=trace(),expectedHandle=ctx._midiOut.callbacks[0].handle;
  audio.pumpWaveOutCompletions();
  assert.equal(e.get_eip(),cb,'registered production host callback admitted');
  const admitted=trace(),serial=admitted[0];
  if(enabled){assert(serial>0);assert.notEqual(serial,lastSerial);assert.equal(admitted[1],before[1]);lastSerial=serial;}
  else assert.deepEqual(admitted,before,'disabled tracing does not issue token');
  const sp=e.get_esp(),frame=Array.from({length:6},(_,i)=>read(sp+4*i));
  assert.deepEqual(frame.slice(1),[expectedHandle,expectedMessage,instance,0,0]);
  const rejectedBefore=trace(),regs=[e.get_eip(),e.get_esp(),e.get_eax()],waitBefore=wait();
  assert.equal(e.fire_midi_out_callback_bound(h,0,cb,instance,expectedMessage),0,'nested admission rejected');
  assert.deepEqual(trace(),rejectedBefore,'rejection issues no token');
  assert.deepEqual([e.get_eip(),e.get_esp(),e.get_eax()],regs);assert.deepEqual(wait(),waitBefore);
  e.run(1);assert.equal(e.get_eip(),frame[0],'actual x86 RET20 reaches continuation');
  assert.equal(e.thunk_word(frame[0],0)>>>0,0xcaca000a);
  const afterRet=trace();if(enabled){assert.equal(afterRet[0],serial);assert.notEqual(afterRet[1],serial);}
  if(enabled && evidence.callbacks.length===1){
   // Executable negative control: withhold the actual continuation dispatch
   // after the actual RET20 and apply the unchanged restoration oracle.
   let failed=false;try{oracle(trace(),serial,saved);}catch(error){
    assert.match(error.message,/active cleared after continuation/);failed=true;
    evidence.negativeControl={rejected:true,intervention:'withheld CACA000A dispatch after actual RET20',actualTrace:trace(),error:error.message};
   }assert(failed,'omitted continuation must fail restoration oracle');
  }
  e.run(1);assert.equal(e.get_eip(),idle);assert.equal(e.get_esp(),oldEsp);assert.equal(e.get_eax()>>>0,savedEax);assert.deepEqual(wait(),saved,'supported wait context restored');
  const returned=trace();if(enabled)oracle(returned,serial,saved);else assert.deepEqual(returned,before);
  evidence.callbacks.push({enabled,serial,savedContext:{eip:idle,esp:oldEsp,eax:savedEax,wait:saved},admitted,afterRet,returned,frame,rejectedAdmission:true});
  assert.equal(ctx._midiOut.callbacks.length,0);
  return {serial,saved,returned};
 }
 evidence.phase='first registered callback RET20 and CACA000A';write();
 const first=finish(true,0x3c7);
 // Queue two further notifications using the registered production device.
 // Closing/opening APIs are unnecessary: use the host's real queue entry shape.
 // The producer is instead a second actual midiStreamOpen registration below.
 function openAgain(){put(device,0);assert.equal(call('midiStreamOpen',[out,device,1,cb,instance,3<<16]),0);return read(out);}
 // Each open owns a different handle; update the expected callback frame.
 const oldHandle=h;
 // Keep registration/host producer authoritative, using one new open notification
 // then closing over its handle in the independent continuation helper.
 evidence.phase='second invocation';write();
 const h2=openAgain();assert.notEqual(h2,oldHandle);
 // Handle identity for subsequent frames is read from the production queue.
 const secondExpected=ctx._midiOut.callbacks[0];assert(secondExpected);
 evidence.secondHandle=h2;
 function nextFinish(enabled,reason){
  // finish's original handle expectation is deliberately parameterized below.
  return finish(enabled,0x3c7,reason);
 }
 const second=nextFinish(true,1);
 e.set_audio_callback_trace(0);openAgain();const third=nextFinish(false,0);
 assert(evidence.negativeControl?.rejected);evidence.traceOracleSource='pinned src/13-exports.wat get_audio_callback_trace and wave_callback_restore_wait';
 evidence.PASS=true;evidence.phase='complete';write();console.log(JSON.stringify(evidence));
}catch(error){evidence.PASS=false;evidence.blocker={phase:evidence.phase,error:error.message,stack:error.stack};write();console.error(JSON.stringify(evidence));process.exitCode=1;}
