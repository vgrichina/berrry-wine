'use strict';
// Offline original code and retained-frame interpretation. No browser or box.
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),vm=require('node:vm'),crypto=require('node:crypto');
const root=require('node:path').resolve(__dirname,'..'),run=process.argv[2];assert(run,'evidence directory required');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=cp.execFileSync('python3',['-c',"import importlib.util;s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h);print(h.level_start_driver_source());print(h.startup_completion_observer_source())"],{cwd:root,encoding:'utf8'});
const scope={setTimeout,clearTimeout,Date,DataView};vm.createContext(scope);vm.runInContext(source+';globalThis.create=createLevelStartDriver;globalThis.install=installStartupCompletion;',scope);
(async()=>{
 const wasm=fs.readFileSync(root+'/build/wine-assembly.wasm'),module=await WebAssembly.compile(wasm),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{}},imports=require('../lib/host-imports').createHostImports(ctx);imports.host.memory=memory;
 for(const x of WebAssembly.Module.imports(module))if(x.kind==='function'&&!imports.host[x.name])imports.host[x.name]=()=>{throw Error('unexpected import '+x.name)};
 const e=(await WebAssembly.instantiate(module,imports)).exports;ctx.exports=e;
 const media=root+'/test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/',pe=fs.readFileSync(media+'lbreakout2.exe'),sdl=fs.readFileSync(media+'SDL.dll');
 assert.equal(sha(pe),'cc1fd5c3d229cc1d4f910e658f5abefa80ef8ebf4b5e47801648f0be0e1ca244');
 const b=new Uint8Array(memory.buffer),v=new DataView(memory.buffer),wa=p=>e.guest_to_wasm(p)>>>0,w=(p,n)=>v.setUint32(wa(p),n>>>0,true),u=p=>v.getUint32(wa(p),true);
 b.set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const loader=require('../lib/dll-loader'),loaded=loader.loadDlls(e,memory.buffer,pe,[{name:'SDL.dll',bytes:sdl},{name:'msvcrt.dll',bytes:fs.readFileSync(root+'/test/binaries/dlls/msvcrt.dll')}],()=>{});
 const hex=(pc,n)=>Buffer.from(b.subarray(wa(pc),wa(pc)+n)).toString('hex');
 for(const [pc,h] of [[0x451ae0,'ff2508054800'],[0x426c54,'e887ae0200'],[0x418682,'e829e50000'],[0x426d99,'ff00'],[0x426dca,'ff00']])assert.equal(hex(pc,h.length/2),h);
 const stack=e.guest_alloc(65536)+65000;
 const start=(pc,args=[])=>{e.set_esp(stack);e.call_func(pc,...Array.from({length:4},(_,i)=>args[i]||0));const sp=e.get_esp()>>>0;for(let i=4;i<args.length;i++)w(sp+4+i*4,args[i]);return sp;};
 const finish=driver=>{let blocks=0;for(let i=0;e.get_eip();i++){assert(i<20000,'bounded original return');driver.run(10000);blocks+=driver.get_last_run_blocks();assert.equal(e.get_yield_reason(),0);}return blocks;};
 start(loader._test.findDllExport(e,memory.buffer,loaded[0].loadAddr,'SDL_CreateRGBSurface'),[0,640,480,32,0xff0000,0xff00,0xff,0]);finish(e);
 const surface=e.get_eax()>>>0;assert(surface);w(0x452464,surface);
 const pixels=wa(u(surface+20)),pitch=v.getUint16(wa(surface+16),true);assert.equal(pitch,2560);
 const expected=new Uint8Array(640*480);
 for(let i=0;i<expected.length;i++){const blue=i&255,green=(i*7)&255,red=(i*13)&255;v.setUint32(pixels+i*4,(red<<16)|(green<<8)|blue,true);expected[i]=(red+2*green+blue)>>>2;}
 const validator=await require('../lib/lbreakout-input-observer').install({enabled:true,validateOnly:true,exports:e,memory,exeBytes:pe,sdlBytes:sdl});const binding=validator.snapshot().binding;validator.stop('offline validated');
 let observer;const samples=[];
 const driver=scope.create(e,pc=>{
  assert.equal(pc,0x451ae0);const sample=observer.snapshot().lastSample;
  // The function reads and writes each pixel with separate original memcpy
  // calls; compare successive read calls, not a read with its writeback.
  if(sample.stack.words[0]===0x426c59)samples.push(sample);
  if(samples.length===2)driver.trace(0,0,0);
 });
 observer=await scope.install({e:{...driver.exports,set_trace_eip_range:driver.trace},memory,binding,token:'offline-gray',expected:0});
 driver.trace(1,0x451ae0,0x451ae1);
 const sp=start(0x426bb0,[surface,0,0,-1,-1,0]),blocks=finish(driver.exports);
 assert.equal(e.get_esp()>>>0,sp+4);assert.equal(samples.length,2);
 for(const [i,s] of samples.entries()){
  assert(!s.error);assert.equal(s.stack.words[0],0x426c59);assert.equal(s.stack.words[14],i);assert.equal(s.stack.words[13],0);assert.equal(s.stack.words[3],4);
 }
 assert.equal(samples[1].stack.words[2]-samples[0].stack.words[2],4,'original source advances one pixel');
 for(let i=0;i<expected.length;i++){const gray=expected[i];assert.equal(v.getUint32(pixels+i*4,true),(gray<<16)|(gray<<8)|gray,'full original grayscale output '+i);}
 observer.stop('offline original return');
 // Decode the retained native sample, including conservative refusal controls.
 const decode=String.raw`
import importlib.util,json,pathlib,copy,datetime
s=importlib.util.spec_from_file_location('h','tools/lbreakout-case-inspection.py');h=importlib.util.module_from_spec(s);s.loader.exec_module(h)
r=pathlib.Path(RUN);receipt=json.loads((r/'recovered/original/completion-failure-startup-startup.json').read_text());failure=json.loads((r/'recovered/original/first-browser-failure.json').read_text())
at=datetime.datetime.fromisoformat(failure['at'].replace('Z','+00:00')).timestamp()*1000
result=h.classify_startup_failure(receipt,at)
assert result['kind']=='original-theme-grayscale' and result['preMenu']
assert result['pixel']==dict(x=240,y=168) and result['rectangle']==dict(x=0,y=0,width=640,height=480)
assert result['processedPixels']==107760 and result['remainingPixelsIncludingCurrent']==199440
assert result['sampleAgeAtFailureMs']==11 and result['sampleBeforeDeadlineMs']==4
assert result['inferredPitch']==2560 and result['copy']['size']==4 and result['surface']!=result['screen']
for mutation in ['return','caller','frame','width','x','size','offset','destination','future','media','missing']:
 v=copy.deepcopy(receipt);o=v['lastObservation'];p=o['lastSample'];words=p['stack']['words']
 if mutation=='return':words[0]+=1
 elif mutation=='caller':words[16]+=1
 elif mutation=='frame':p['registers']['ebp']+=4
 elif mutation=='width':words[20]=0
 elif mutation=='x':words[14]=640
 elif mutation=='size':words[3]=0x100000
 elif mutation=='offset':words[11]+=1
 elif mutation=='destination':words[1]+=4
 elif mutation=='future':p['at']=at+1
 elif mutation=='media':o['binding']['media']['exe']='foreign'
 elif mutation=='missing':o['lastSample']=None
 assert h.classify_startup_failure(v,at)['kind']=='unknown',mutation
(r/'native-startup-classification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
`;
 const decoded=JSON.parse(cp.execFileSync('python3',['-c','RUN='+JSON.stringify(run)+'\n'+decode],{cwd:root,encoding:'utf8'}));
 const result={passed:true,module:sha(wasm),exe:sha(pe),sdl:sha(sdl),blocks,samples,decoded,fullPixels:expected.length,originalCdeclReturn:true,scope:'offline isolated original grayscale; native sample interpretation, no native completion/time claim'};
 fs.writeFileSync(run+'/original-gray-control.json',JSON.stringify(result,null,2));
 console.log('PASS original grayscale advances one pixel and returns with all 307200 pixels correct; retained native frame and 11 refusal controls; sample age distinct from failure time');
})().catch(e=>{console.error(e);process.exitCode=1;});
