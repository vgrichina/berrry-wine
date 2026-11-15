'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {createHostImports}=require('../lib/host-imports');
const {cursorFixture}=require('./helpers/ne-native-cursor-image');
const {createCanvas}=require('../lib/canvas-compat'),{Win98Renderer}=require('../lib/renderer');
(async()=>{
 const module=await WebAssembly.compile(fs.readFileSync(process.env.WINE_TEST_WASM||path.join(__dirname,'../build/wine-assembly.wasm')));
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const canvas=createCanvas(640,480),events=[],renderer=new Win98Renderer(canvas);
 canvas.style={};
 const ctx={getMemory:()=>memory.buffer,renderer,resourceJson:{}};
 const imports=createHostImports(ctx);imports.host.memory=memory;
 for(const name of ['set_cursor','set_cursor_image']) {const real=imports.host[name];imports.host[name]=(...a)=>{const bits=name==='set_cursor_image'&&a[5]?Buffer.from(new Uint8Array(memory.buffer,a[5]>>>0,a[1]*a[2]*4)):null;const value=real(...a);events.push({name,args:a,css:canvas.style.cursor||null,bgra:bits?bits.toString('hex'):null});return value;};}
 const secondCanvas=createCanvas(640,480),secondEvents=[],secondRenderer=new Win98Renderer(secondCanvas);
 secondCanvas.style={};
 const secondCtx={getMemory:()=>memory.buffer,renderer:secondRenderer,resourceJson:{}};
 const secondImports=createHostImports(secondCtx);secondImports.host.memory=memory;
 for(const name of ['set_cursor','set_cursor_image']){const real=secondImports.host[name];secondImports.host[name]=(...args)=>{const result=real(...args);secondEvents.push({name,args,css:secondCanvas.style.cursor});return result;};}
 const e=(await WebAssembly.instantiate(module,imports)).exports;
 const second=(await WebAssembly.instantiate(module,secondImports)).exports;
 renderer.wasm={exports:e};renderer.wasmMemory=memory;secondRenderer.wasm={exports:second};secondRenderer.wasmMemory=memory;
 ctx.instance={exports:e};ctx.wasmMemory=memory;secondCtx.instance={exports:second};secondCtx.wasmMemory=memory;
 ctx.exports=e;
 const fixture=cursorFixture({modules:true});new Uint8Array(memory.buffer).set(fixture.b,e.get_staging());assert(e.load_ne(fixture.b.length)>0);
 assert(second.load_ne(fixture.b.length)>0);const entry=e.get_eip(),stack=e.get_esp();
 function stageModules(){for(const [id,name,alternate] of [[13,'ART_A',false],[14,'ART_B',true]]){
   const dll=cursorFixture().b;dll.writeUInt16LE(0x8001,0x8c);
   if(alternate)require('./helpers/ne-native-cursor-image').cursorImage(true).copy(dll,0x2100);
   ctx.vfs.files.set(`c:\\${name.toLowerCase()}.dll`,{data:dll,attrs:0x20});
   const slot=e.win16_dynamic_module_slot(id-13);new Uint8Array(memory.buffer).set([name.length,...Buffer.from(name)],slot);
   new Uint8Array(memory.buffer).set(dll,e.win16_dll_staging(id));assert.equal(e.load_ne_dll_sized(id,dll.length),1);
 }}stageModules();
 const base=e.win16_seg_base_of(e.get_sreg_ds()>>>3),get=o=>e.guest_read8(base+o)|(e.guest_read8(base+o+1)<<8);
 let rounds=0;while(rounds++<50&&get(0x7e)!==0x600d)e.run(1000);
 const words=Object.fromEntries(Object.entries(fixture.slots).map(([k,o])=>[k,get(o)]));
 const summary={complete:get(0x7e)===0x600d,rounds,words,events,currentThread:e.get_current_thread_id(),threadCursor:e.get_cursor()>>>0};
 const out=process.env.CURSOR_PROOF_DIR;if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'native-api-output.json'),JSON.stringify(summary,null,2)+'\n');}
 assert(summary.complete,'native far program completes');assert.notEqual(words.systemA,words.systemB,'actual system loads retain distinct handles');
 assert(events.some(x=>x.css==='ew-resize'),'native system A publishes horizontal resize');assert(events.some(x=>x.css==='ns-resize'),'native system B publishes vertical resize');
 assert.equal(words.previous_systemB,words.systemA);assert.equal(words.previousNull,words.systemB);assert.equal(words.previous_resourceA,0);
 assert(words.resourceA&&words.resourceB&&words.named);assert.notEqual(words.resourceA,words.resourceB);assert.equal(words.resourceAgain,words.resourceA);
 assert(words.rawCursor,'raw CURSOR ordinal resolves');assert.equal(words.malformed,0,'malformed resource fails');
 assert.equal(words.previous_resourceB,words.resourceA);assert.equal(words.previous_named,words.resourceB);assert.equal(words.afterSharedDestroy,words.named);
 assert.equal(words.getCursor,words.resourceA);assert.equal(words.hiddenCount,65535);assert.equal(words.visibleCount,0);
 assert(words.moduleA&&words.moduleB&&words.moduleCursorA&&words.moduleCursorB);assert.notEqual(words.moduleCursorA,words.moduleCursorB,'same resource ID stays module-qualified');assert.notEqual(words.moduleCursorA,words.resourceA);
 assert.equal(words.retiredCursor,0);assert.equal(words.afterOtherUnload,words.moduleCursorB);assert.equal(words.afterSelectedUnload,0);
 assert(words.window);assert.equal(words.focused,words.window);assert.equal(words.unfocused,0);assert.equal(words.afterFocus,words.resourceA,'native focus preserves installed cursor');
 assert.equal(words.badModule,0);assert.equal(words.missing,0);assert.equal(words.badSystem,0);assert.equal(words.badSet,0);assert.equal(words.spBefore,words.spAfter,'Pascal stack restores');
 assert.equal(words.badDestroy,0);assert.equal(words.nullDestroy,0);
 const pixels=events.filter(x=>x.bgra);assert(pixels.length>=2,'real cursor planes reach host');assert(new Set(pixels.map(x=>x.bgra)).size>=2,'distinct decoded pixels');
 for(const p of pixels){const b=Buffer.from(p.bgra,'hex');assert([...b].some((v,i)=>i%4===3&&v===0),'mask transparency');assert([...b].some((v,i)=>i%4===3&&v===255),'visible cursor pixels');}
 assert(pixels.some(x=>x.args[3]===1&&x.args[4]===2),'first resource hotspot');assert(pixels.some(x=>x.args[3]===3&&x.args[4]===1),'second resource hotspot');
 stageModules();secondCtx.exports=second;for(const [key,value] of ctx.vfs.files)secondCtx.vfs.files.set(key,value);
 const firstThreadCursor=e.get_thread_cursor(1)>>>0;
 second.init_thread(1,0,0,0,0,0,0,0);second.set_esp(stack);second.set_eip(entry);
 e.guest_write32(base+0x7c,0);rounds=0;while(rounds++<50&&get(0x7e)!==0x600d)second.run(1000);
 assert.equal(get(0x7e),0x600d,'second native thread completes');
 assert.equal(get(fixture.slots.spBefore),get(fixture.slots.spAfter),'second native Pascal stack restores');
 assert.equal(get(fixture.slots.resourceA),words.resourceA,'shared lifetime survives another instance');
 assert.equal(get(fixture.slots.previous_systemB),words.systemA,'second thread native previous handle');
 assert.equal(e.get_thread_cursor(1)>>>0,firstThreadCursor,'other thread selection is isolated');
 assert(secondEvents.some(x=>x.name==='set_cursor_image'&&x.args[5]&&x.css.startsWith('url(')),'fresh host cache receives shared resource pixels');
 if(out)fs.writeFileSync(path.join(out,'second-instance-output.json'),JSON.stringify({secondEvents,thread1:e.get_thread_cursor(1)>>>0,thread2:e.get_thread_cursor(2)>>>0,words:Object.fromEntries(Object.entries(fixture.slots).map(([k,o])=>[k,get(o)]))},null,2)+'\n');
 if(out){for(const [i,p] of pixels.slice(0,2).entries()){const m=/base64,([^)]*)\)/.exec(p.css);assert(m,'actual host image URL');const png=cp.spawnSync('convert',['cur:-','png:-'],{input:Buffer.from(m[1],'base64')});assert.equal(png.status,0,png.stderr.toString());fs.writeFileSync(path.join(out,`native-resource-${i+1}.png`),png.stdout);}}
 console.log('PASS native Win16 far-Pascal cursor APIs, previous/null/invalid, shared lifetime, decoded mask/hotspot and actual host CSS/pixels');
})().catch(e=>{console.error(e);process.exitCode=1;});
