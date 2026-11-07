'use strict';
// Generated, ordinary NE application with imported far calls and a far WNDPROC.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.env.WINE_TEST_ROOT||path.resolve(__dirname,'..');
const {neLifecycleImage}=require(root+'/test/helpers/ne-lifecycle-image');
const {createHostImports}=require(root+'/lib/host-imports');
const context={createHostImports,console:{log(){},error(){}}};
vm.runInNewContext(fs.readFileSync(root+'/host.js','utf8')+'\n;globalThis.Host=WineAssembly;',context);

function fixture({flags=0x101,area='null',invalid=false,nested=false,reinvalidate=false,seed=false}={}) {
 const b=Buffer.alloc(0x3400),n=0x80,w=(p,v)=>b.writeUInt16LE(v&65535,p);
 neLifecycleImage({dependencies:['USER','GDI']}).copy(b,0,0,0x200);
 for(const [o,v] of [[12,1],[0x14,0],[0x18,0xff00],[0x1a,2],[0x42,0x2000],[0x44,0x100],[0x46,0x2000],[0x48,0x260],[0x4a,0xe00],[0x4c,1],[0x4e,0]])w(n+o,v);
 const c=[],rel=[],emit=(...x)=>c.push(...x),word=v=>emit(v&255,v>>>8&255);
 const push=v=>{emit(0x68);word(v);},mem=o=>{emit(0xff,0x36);word(o);};
 const far=o=>{emit(0x1e);push(o);};
 const call=(ord,mod=1)=>{emit(0x9a);rel.push([c.length,ord,mod]);word(0xffff);word(0);};
 const save=o=>{emit(0xa3);word(o);};
 const set=(o,v)=>{emit(0xc7,6);word(o);word(v);};
 const query=o=>{mem(0);far(o);push(0);call(190);save(o+8);};
 const redraw=(fl,ar='null',bad=false)=>{
   if(bad)push(typeof bad==='number'?bad:0x42);else mem(0);
   if(ar==='rect')far(0x200);else if(ar==='zero-offset'){emit(0x1e);push(0);}else {push(0);push(0);}
   if(ar==='region'||ar==='empty-region')mem(2);else if(ar==='bad-region')push(0x42);else push(0);
   push(fl);call(290);
 };
 emit(0x8b,0xc4);save(0x80);
 // Ordinary GDI allocations give the subsequent window the captured narrow
 // handle 0x0133. This exercises handle translation without patching tables.
 for(let i=0;i<50;i++){for(const v of [0,0,1,1])push(v);call(64,2);}
 // WNDCLASS16: actual code selector is only known after NE relocation.
 emit(0x0e,0x58);save(0x104);emit(0x1e,0x58);save(0x118);
 far(0x100);call(57);save(4);
 const create=()=>{far(0x180);far(0x190);push(0x1000);push(0);for(const v of [0,0,120,100,0,0,0,0,0])push(v);call(41);};
 create();save(0);
 // Clear creation damage, then reset callback observations.
 mem(0);push(0);push(0);call(127);set(0x20,0);set(0x22,0);set(0x24,0);
 if(area==='region'||area==='empty-region'){
   for(const v of (area==='empty-region'?[3,4,3,4]:[-3,7,35,41]))push(v);call(64,2);save(2);
 }
 if(seed)redraw(5,area);
 if(area==='zero-offset'){
   // DS:0000 is a valid pointer. Preserve the HWND elsewhere before using it.
   mem(0);emit(0x5b);for(const [o,v] of [[0,-5],[2,9],[4,31],[6,43]])set(o,v);
   emit(0x89,0x1e,0x90,0);
   emit(0x53,0x1e);push(0);push(0);push(flags);call(290);save(0x10);
   emit(0x8b,0x1e,0x90,0,0x89,0x1e,0,0);
 } else {redraw(flags,area,invalid);save(0x10);}
 emit(0x89,0x16,0x18,0,0x8b,0xc4);save(0x82);mem(0x20);emit(0x58);save(0x12);mem(0x22);emit(0x58);save(0x14);
 query(0x240);
 // A later UpdateWindow must consume deferred damage synchronously.
 mem(0);call(124);mem(0x20);emit(0x58);save(0x16);query(0x250);
 emit(0x8b,0xc4);save(0x84);set(0x86,0x600d);emit(0xeb,0xfe);
 while(c.length<0x1000)emit(0x90);
 // Far WNDPROC: real Pascal frame, local PAINTSTRUCT, registers restored.
 emit(0x55,0x89,0xe5,0x53,0x83,0x7e,0x0c,0x0f,0x0f,0x85);const skip=c.length;word(0);
 emit(0xff,6,0x20,0,0x83,0xec,32,0xff,0x76,0x0e,0x16,0x8d,0x46,0xde,0x50);call(39);
 save(0x2a);emit(0x8b,0x46,0xe0);save(0x28);
 for(let i=0;i<4;i++){emit(0x8b,0x46,0xe2+i*2);save(0x30+i*2);}
 if(nested){emit(0xff,0x76,0x0e);push(0);push(0);push(0);push(0x100);call(290);save(0x26);}
 if(reinvalidate){emit(0xff,0x76,0x0e);far(0x210);push(0);push(1);call(290);}
 emit(0xff,0x76,0x0e,0x16,0x8d,0x46,0xde,0x50);call(40);emit(0x83,0xc4,32);
 const afterPaint=c.length;c[skip]=(afterPaint-skip-2)&255;c[skip+1]=(afterPaint-skip-2)>>>8;
 emit(0x83,0x7e,0x0c,0x14,0x75,4,0xff,6,0x22,0);
 emit(0x5b,0x5d,0x31,0xc0,0xba,1,0,0xca,10,0); // high-word-only erase TRUE
 b.set(c,0x200);w(0x2200,rel.length);rel.forEach(([at,ord,mod],i)=>{const p=0x2202+i*8;b[p]=3;b[p+1]=1;w(p+2,at);w(p+4,mod);w(p+6,ord);});
 w(0x2600+0x102,0x1000);w(0x2600+0x116,0x180);b.write('NE_REDRAW\0',0x2600+0x180);b.write('Redraw regression\0',0x2600+0x190);
 [-5,7,35,41].forEach((v,i)=>w(0x2600+0x200+i*2,v));[11,12,13,14].forEach((v,i)=>w(0x2600+0x210+i*2,v));
 return b;
}

async function run(module,options={}){
 const wine=new context.Host();wine.memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});wine.logToUI=()=>{};
 const imports=wine.getImports({detached:true,threadId:1});imports.host.memory=wine.memory;
 const trace=[];const log=imports.host.log_i32;imports.host.log_i32=v=>{trace.push(v>>>0);if(trace.length>96)trace.shift();return log(v);};
 // Geometry supplied by the headless host; all handles and paint callbacks
 // are produced by ordinary emulator APIs, never test-only WASM exports.
 imports.host.get_window_client_size=()=>120|(100<<16);
 imports.host.get_window_rect=(_hwnd,p)=>{const v=new DataView(wine.memory.buffer);[20,20,140,120].forEach((x,i)=>v.setInt32(p+4*i,x,true));};
 const instance=await WebAssembly.instantiate(module,imports);wine.instance=instance;
 const e=instance.exports,b=fixture(options);new Uint8Array(wine.memory.buffer).set(b,e.get_staging());assert(e.load_ne(b.length)>0);
 e.set_win16_trace(1);
 const data=e.win16_seg_base_of(3),get=o=>e.guest_read8(data+o)|(e.guest_read8(data+o+1)<<8);
 try {for(let i=0;i<200&&get(0x86)!==0x600d;i++)e.run(100);}catch(error){console.error(JSON.stringify({options,eip:e.get_eip(),esp:e.get_esp(),hwnd:get(0),class:get(4),trace}));throw error;}
 const r={options,completed:get(0x86),hwnd:get(0),class:get(4),answer:get(0x10),paintAtReturn:get(0x12),eraseAtReturn:get(0x14),paintAfterUpdate:get(0x16),nestedAnswer:get(0x26),fErase:get(0x28),paintDC:get(0x2a),sp:[get(0x80),get(0x82),get(0x84)],paintRect:[0x30,0x32,0x34,0x36].map(get),deferred:[0x240,0x242,0x244,0x246,0x248].map(get),remaining:get(0x258)};
 if(process.env.REDRAW_EVIDENCE)fs.appendFileSync(process.env.REDRAW_EVIDENCE,JSON.stringify(r)+'\n');
 assert.equal(r.completed,0x600d,'real NE imported calls return to the caller');assert(r.class&&r.hwnd,'real class/window creation');
 assert.equal(get(0x18),0,'API return clears callback DX and exposes its own BOOL16');
 assert.equal(r.hwnd,0x133,'captured HWND16 is obtained through ordinary handle allocation');
 assert.equal(r.sp[1],r.sp[0],'RedrawWindow removes exactly ten Pascal bytes plus far return');assert.equal(r.sp[2],r.sp[0],'callbacks and later UpdateWindow balance');
 return r;
}
async function main(){
 const module=await WebAssembly.compile(fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||root+'/build/wine-assembly.wasm'));
 const cases=[{}, {area:'rect'}, {area:'region'}, {area:'empty-region'}, {area:'zero-offset'}, {invalid:true}, {invalid:0xfffe}, {area:'bad-region'}, {flags:1,area:'rect'}, {flags:0x105,area:'rect'}, {nested:true}, {reinvalidate:true}, {flags:0x100}, {flags:8,seed:true,area:'rect'}, {flags:8,seed:true,area:'region'}, {flags:0x110,seed:true}];
 for(const options of cases){
   const r=await run(module,options);
   if(options.invalid||options.area==='bad-region'){assert.equal(r.answer,0);assert.equal(r.paintAtReturn,0);continue;}
   assert.equal(r.answer,1);
   if(options.area==='empty-region'){assert.equal(r.paintAtReturn,0);continue;}
   if(options.flags===0x100||options.flags===8){assert.equal(r.paintAtReturn,0,'clean/validated redraw does not invent paint');assert.equal(r.deferred[4],0);assert.equal(r.paintAfterUpdate,0);continue;}
   if(options.flags===1){assert.equal(r.paintAtReturn,0,'deferred invalidation sends no synchronous callback');assert.equal(r.deferred[4],1);assert.equal(r.paintAfterUpdate,1);}
   else assert.equal(r.paintAtReturn,1,'UPDATENOW finishes WM_PAINT before the next guest instruction');
   if(options.flags===0x105){assert.equal(r.eraseAtReturn,1,'BeginPaint synchronously sends the pending far erase');assert.equal(r.fErase,0,'high-word-only DX:AX erase result is TRUE');assert(r.paintDC>0,'BeginPaint returns a real narrow DC');}
   if(options.flags===0x110)assert.equal(r.eraseAtReturn,0,'NOERASE suppresses the erase requested by an earlier invalidation');
   if(options.nested)assert.equal(r.nestedAnswer,1,'nested clean redraw returns its own BOOL');
   if(options.area==='rect'||options.area==='region')assert.deepEqual(r.paintRect,[0,7,35,41],'signed RECT16/HRGN translated and clipped');
   if(options.area==='zero-offset')assert.deepEqual(r.paintRect,[0,9,31,43],'non-null selector with zero offset is not NULL');
   if(!options.area&&!options.reinvalidate)assert.deepEqual(r.paintRect,[0,0,120,100],'NULL area invalidates the full recorded client');
   if(options.reinvalidate)assert.equal(r.deferred[4],1,'new invalidation from WM_PAINT survives outer EndPaint');
 }
 console.log('PASS native NE USER.290: captured flags, invalid HWND/HRGN, signed far RECT16 (including offset zero), regions, nested synchronous paint/erase, exact Pascal stack, deferred/new damage');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture,run};
