"use strict";
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict'),path=require('path');
const root=process.cwd(),out=path.join(root,'evidence');fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={base:'dc22b2b38624da40b2dcec29c76bfb986ae03a35',node:process.version,v8:process.versions.v8,options:{mode:'production',standardWat:true,strictDeclarations:true,runtimeBuiltins:false,tailCalls:true},steps:[],limitations:['x86 execution OPEN','native execution OPEN','audio hardware OPEN','browser OPEN','gameplay OPEN','MIDI lifecycle OPEN']};
function save(){fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));}
try {
 const pins=JSON.parse(fs.readFileSync('test/madbomber-full-module-midi-dispatch-qualification-oct30/pins.json'));
 for(const [f,p] of Object.entries(pins.sourcePins)){let b=fs.readFileSync(f);assert.equal(b.length,p.bytes,f);assert.equal(sha(b),p.sha256,f);}
 report.steps.push('all 139 canonical input pins verified');save();
 const {watxSourceClosure,compileClosure}=require(path.join(root,'tools/watx-closure'));
 const result=compileClosure(watxSourceClosure(),{tailCalls:true});
 report.compilerKeys=Object.keys(result);assert(result.wasmBinary);let bytes=Buffer.from(result.wasmBinary);report.wasm={bytes:bytes.length,sha256:sha(bytes)};fs.writeFileSync(path.join(out,'canonical.wasm'),bytes);report.steps.push('complete canonical main closure compiled');save();
 const mod=new WebAssembly.Module(bytes);const imports=WebAssembly.Module.imports(mod),exports=WebAssembly.Module.exports(mod);
 fs.writeFileSync(path.join(out,'imports.json'),JSON.stringify(imports,null,2));fs.writeFileSync(path.join(out,'exports.json'),JSON.stringify(exports,null,2));report.inventory={imports:imports.length,exports:exports.length,importsSHA256:sha(fs.readFileSync(path.join(out,'imports.json'))),exportsSHA256:sha(fs.readFileSync(path.join(out,'exports.json')))};save();
 const memory=new WebAssembly.Memory({initial:8192,maximum:32768,shared:true});
 const ctx={getMemory:()=>memory.buffer,guestNowMs:()=>100,audioClockMs:()=>100};
 const {createAudioHost}=require(path.join(root,'lib/host-audio'));
 const audio=createAudioHost(ctx,{getHost:()=>({}),profileNow:()=>0,profileEvent:()=>{}});
 const called=[];const host={...audio.imports,memory,get_ticks:()=>100};
 for(const i of imports){assert.equal(i.module,'host','unexpected namespace');if(!(i.name in host)){assert.equal(i.kind,'function',JSON.stringify(i));host[i.name]=()=>{called.push(i.name);throw Error('unused host import reached: '+i.name);};}}
 report.syntheticState={memory:'512MiB shared, zeroed except canonical data segments; maximum 32768 pages',clock:100,unrelatedHost:'fail closed',audio:'unchanged production createAudioHost; no backend injected',guest:'no PE, x86 instructions, registers, windows or callback owner fabricated'};
 const instance=new WebAssembly.Instance(mod,{host});ctx.exports=instance.exports;report.steps.push('complete canonical module instantiated with production audio imports');report.unrelatedImportsCalled=called;save();
 const candidates=exports.filter(x=>x.kind==='function'&&/^(win32_dispatch|dispatch_api_table|midiStream(Open|Out|Restart|Stop)|test_call_midiStream(Open|Out|Restart|Stop))$/.test(x.name));
 report.dispatchExports=candidates;
 if(!candidates.length){report.status='BLOCKED';report.blocker='Canonical full module exports neither Win32 API dispatch nor MIDI stream call wrappers. win32_dispatch and dispatch_api_table are private. Lifecycle cannot be invoked through the requested exported API boundary without production changes or guest execution, which this bounded harness does not substitute.';save();console.log(JSON.stringify(report));process.exitCode=2;}
 else {throw Error('export identity needs coordinator review before lifecycle invocation: '+JSON.stringify(candidates));}
}catch(e){report.status='BLOCKED';report.blocker=String(e.stack||e);save();console.error(report.blocker);process.exitCode=2;}
