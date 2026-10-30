'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const {createAudioHost}=require('./lib/host-audio.js');
const {REGIONS}=require('./lib/region-map.generated.js');
const api=JSON.parse(fs.readFileSync('src/api_table.json'));
const names=['midiStreamOpen','midiOutPrepareHeader','midiStreamOut','midiStreamRestart','midiStreamStop','midiStreamClose'];
const evidence={scope:'complete canonical module; synthetic PE and backend; real run/export/API dispatch and production audio host',phase:'instantiate',calls:[],callbacks:[],synthetic:{imageBase:0x400000,sectionRVA:0x1000,initialClockMs:100,backend:'recording TinySynth and running AudioContext clock; no audio hardware',guest:'one synthetic PE; MIDI IAT imports; callback x86 RET 20; idle JMP to self; no Mad Bomber binary',services:'unused host functions throw; log records diagnostics; get_ticks uses synthetic clock'},open:['Mad Bomber guest/gameplay','native application','audio hardware','browser']};
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
  e.set_esp(stack);e.set_eip(thunks[name]);e.run(1);
  assert.equal(e.get_eip(),0,name+' return');assert.equal(e.get_esp(),stack+4*(row.nargs+1),name+' stdcall');assert.equal(e.get_api_calls(),before+1,name+' dispatch count');
  const result=e.get_eax()>>>0;evidence.calls.push({name,args,result});return result;
 }
 const out=0x405000,device=0x405010,hdr=0x405100,data=0x405180,cb=0x401080,instance=0x98765;
 put(device,0);assert.equal(call('midiStreamOpen',[out,device,1,cb,instance,3<<16]),0);
 const h=read(out);assert(h);const dev=ctx._midiOut.devices.get(h);assert(dev);assert.equal(dev.registration.owner,e);
 assert.equal(dev.registration.callback,cb);assert.equal(dev.registration.instance,instance);
 const idle=0x401000;
 function pump(expected,negative=false){
  const before=evidence.callbacks.length,oldEsp=stack+128;e.set_esp(oldEsp);e.set_eip(idle);e.set_eax(0x11223344);
  if(negative){
   // Drop exactly one already accepted stop notification at the production
   // queue/transport boundary. The host module and Wasm stay byte-identical.
   const q=ctx._midiOut.callbacks;assert.equal(q.length,1);assert.equal(q[0].message,0x3c9);q.shift();
  }
  audio.pumpWaveOutCompletions();
  if(e.get_eip()===cb){
   const sp=e.get_esp();const frame=Array.from({length:6},(_,i)=>read(sp+i*4));
   assert.equal(frame[1],h);assert.equal(frame[2],expected);assert.equal(frame[3],instance);assert.equal(frame[4],expected===0x3c9?hdr:0);assert.equal(frame[5],0);
   evidence.callbacks.push({message:expected,frame});
   e.run(1); // one block executes the actual synthetic x86 RET 20
   assert.equal(e.get_eip(),frame[0],'callback reaches real return continuation');
   assert.equal(e.thunk_word(frame[0],0)>>>0,0xcaca000a);
   e.run(1); // next bounded slice dispatches production CACA000A restore
   assert.equal(e.get_eip(),idle);assert.equal(e.get_esp(),oldEsp);assert.equal(e.get_eax()>>>0,0x11223344);
  }
  assert.equal(evidence.callbacks.length,before+1,'one stop delivery/callback required');
  assert.equal(ctx._midiOut.callbacks.length,0,'queue drained');
 }
 pump(0x3c7);
 put(hdr,data);put(hdr+4,12);put(hdr+8,12);put(hdr+16,0);put(data,480);put(data+4,0);put(data+8,0x643c90);
 assert.equal(call('midiOutPrepareHeader',[h,hdr,64]),0);assert.equal(read(hdr+16)&2,2);
 assert.equal(call('midiStreamOut',[h,hdr,64]),0);assert.equal(read(hdr+16)&18,18);assert.equal(read(hdr+16)&1,0);
 assert.equal(dev.stream.queue.length,1);assert.equal(dev.stream.queue[0].ga,hdr);assert.equal(dev.stream.queue[0].wa,wa(hdr));
 assert.equal(call('midiStreamRestart',[h]),0);assert.equal(dev.stream.running,true);
 assert.equal(call('midiStreamStop',[h]),0);assert.equal(dev.stream.queue.length,0);assert.equal(dev.stream.running,false);
 assert.equal(read(hdr+16)&19,3);pump(0x3c9);
 const count=evidence.callbacks.length,noteCount=sent.filter(m=>(m[0]&0xf0)===0x90).length;
 now=10000;audio.imports.midi_stream_service(now);audio.pumpWaveOutCompletions();
 assert.equal(evidence.callbacks.length,count);assert.equal(ctx._midiOut.callbacks.length,0);assert.equal(sent.filter(m=>(m[0]&0xf0)===0x90).length,noteCount,'no stale replay');
 assert.equal(call('midiStreamRestart',[h]),0);audio.imports.midi_stream_service(now+10000);audio.pumpWaveOutCompletions();assert.equal(ctx._midiOut.callbacks.length,0);assert.equal(sent.filter(m=>(m[0]&0xf0)===0x90).length,noteCount);
 // Reuse the stopped stream with a fresh queue, then suppress one MOM_DONE.
 put(hdr+16,2);assert.equal(call('midiStreamOut',[h,hdr,64]),0);assert.equal(call('midiStreamRestart',[h]),0);assert.equal(call('midiStreamStop',[h]),0);
 let rejected=false;try{pump(0x3c9,true);}catch(error){assert.match(error.message,/one stop delivery\/callback required/);rejected=true;evidence.negativeControl={rejected:true,error:error.message};}
 assert(rejected,'suppressed accepted MOM_DONE must distinguish lifecycle oracle');
 assert.equal(call('midiStreamClose',[h]),0);pump(0x3c8);assert.equal(ctx._midiOut.devices.has(h),false);
 evidence.flags=read(hdr+16);evidence.noStaleReplay=true;evidence.PASS=true;evidence.phase='complete';write();console.log(JSON.stringify(evidence));
}catch(error){evidence.PASS=false;evidence.blocker={phase:evidence.phase,error:error.message,stack:error.stack};write();console.error(JSON.stringify(evidence));process.exitCode=1;}
