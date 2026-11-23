'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const root=process.cwd(),{bootRenderHarness}=require(path.join(root,'test/render-helper'));
const apiTable=require(path.join(root,'src/api_table.json'));
// Public resolver/thunk scaffolding; no export of either private driver helper.
const extraWat=String.raw`
 (func (export "dd_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "dd_regs") (result i32) (global.get $reg_base))
 (func (export "dd_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "dd_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "dd_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
`;
// Original literal inputs. UTF-16 code units are encoded independently by JS,
// including odd guest addresses and a nonzero high byte in the terminator.
function fixtures(wide){
 const encode=s=>Buffer.from(s,wide?'utf16le':'latin1');
 const rows=['DISPLAY\0','display\0','DiSpLaY\0','dIsPlAy\0','DISPLAYX\0','DISPLAY \0','\0','DISPLA\0','PRINTER\0'];
 for(let i=0;i<7;i++)rows.push('DISPLAY'.slice(0,i)+'!'+ 'DISPLAY'.slice(i+1)+'\0');
 const result=rows.map((s,i)=>({bytes:encode(s).length>= (wide?16:8)?encode(s):Buffer.concat([encode(s),Buffer.alloc((wide?16:8)-encode(s).length,0x61)]),display:i<4,label:JSON.stringify(s)}));
 if(wide){const b=encode('DISPLAY\0');b[15]=1;result.push({bytes:b,display:false,label:'nonzero UTF16 terminator high byte'});const c=encode('DISPLAY\0');c[1]=1;result.push({bytes:c,display:false,label:'nonASCII high byte'});}
 return result;
}
async function run(options={}){
 const stats={calls:0,queries:0,comparisons:0,mappingFailures:0,controlFailures:0,pixelControls:0,examples:[]};
 function compare(a,b,label,mapping=false){stats.comparisons++;if(Buffer.isBuffer(a)?a.equals(b):JSON.stringify(a)===JSON.stringify(b))return;stats[mapping?'mappingFailures':'controlFailures']++;if(stats.examples.length<20)stats.examples.push({label,actual:Buffer.isBuffer(a)?a.toString('hex'):a,expected:Buffer.isBuffer(b)?b.toString('hex'):b});}
 const {exports:e,memory}=await bootRenderHarness({extraWat,fonts:'none',width:32,height:32});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.dd_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),v=new DataView(memory.buffer),regs=e.dd_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 function put(p,b){for(let i=0;i<b.length;i++)e.guest_write8(p+i,b[i]);}
 function read(p,n){return Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));}
 const text=s=>{const b=Buffer.from(s+'\0'),p=alloc(b.length);put(p,b);return p;};
 const frame=alloc(256),stack=frame+64,other=alloc(64),direct=alloc(8192),bmi=alloc(40),out=alloc(16);
 v.setUint32(regs+16,stack,true);const module=e.dd_module(text('GDI32.DLL'))>>>0;assert.ok(module);
 const entries=new Map(),names=['CreateDCA','CreateDCW','CreateICA','CreateICW','GetDeviceCaps','DeleteDC','CreateCompatibleDC','CreateDIBSection','SelectObject','DeleteObject','SaveDC','RestoreDC','SetTextColor','GetTextColor','SetBkColor','GetBkColor','SetBkMode','GetBkMode','GetMapMode','GetROP2','GetPolyFillMode','GetStretchBltMode','GetCurrentObject','GetClipBox','IntersectClipRect','PatBlt','CreateSolidBrush'];
 for(const name of names){v.setUint32(regs+16,stack,true);const thunk=e.dd_resolve(module,text(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk,name);assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id);entries.set(name,{thunk,nargs:row.nargs});}
 function call(name,args){const row=entries.get(name);assert.equal(args.length,row.nargs);mem.fill(0x6d,wa(frame),wa(frame)+256);e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+i*4,x));const before=read(frame,256),unrelated=read(other,64),seed=[0x81234567,0x12345678,0x23456789,0x3456789a,stack,0x456789ab,0x56789abc,0x6789abcd];seed.forEach((x,i)=>v.setUint32(regs+i*4,x,true));e.dd_call(row.thunk);stats.calls++;assert.equal(e.get_esp()>>>0,stack+4+args.length*4,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of [1,2,3,5,6,7])assert.equal(v.getUint32(regs+i*4,true),seed[i],name+' register '+i);assert.deepEqual(read(frame,256),before,name+' whole frame');assert.deepEqual(read(other,64),unrelated);return e.get_eax()>>>0;}
 const caps=[2,4,6,8,10,12,14,88,90,110,111,112,113];
 // Values for this explicit 32x32, 32-bit, 96 DPI harness. These are emulator
 // display expectations, not universal Windows hardware values.
 const screenExpected=[1,8,8,32,32,32,1,96,96,0,0,0,0];
 const getCaps=dc=>caps.map(index=>call('GetDeviceCaps',[dc,index]));
 const printerBaseline={};
 for(const wide of [false,true]){const api=wide?'CreateDCW':'CreateDCA',dc=call(api,[0,0,0,0]);assert.ok(dc);printerBaseline[api]=getCaps(dc);compare(printerBaseline[api][7],300,'current printer DPI baseline');assert.equal(call('DeleteDC',[dc]),1);}
 compare(printerBaseline.CreateDCA,printerBaseline.CreateDCW,'A/W current printer baseline');stats.printerBaseline=printerBaseline;
 // Pawn's point-size scale is proportional to this DPI numerator. Keep
 // arithmetic rounding outside this driver transport regression.
 const fontSizingBaseline={screen:3360,printer:Object.fromEntries(Object.entries(printerBaseline).map(([api,values])=>[api,35*values[8]]))};stats.fontSizingBaseline=fontSizingBaseline;
 const fragmented=0x30000000,adjacent=0x31000000,decoys=[0x28000000,0x29000000];
 for(const p of [fragmented,decoys[0],decoys[1],fragmented+4096])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,8192)>>>0,adjacent);
 assert.equal(wa(decoys[0]),wa(fragmented)+4096);assert.equal(wa(decoys[1]),wa(fragmented)+8192);assert.notEqual(wa(fragmented+4096),wa(fragmented)+4096);assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const spans=[[wa(direct),8192],[wa(fragmented),4096],[wa(fragmented+4096),4096],...decoys.map(p=>[wa(p),4096]),[wa(adjacent),8192]],backing=spans.map(([p,n])=>Buffer.from(memory.buffer,p,n));
 const expected=backing.map(b=>Buffer.alloc(b.length));
 function query(wide,f,p,label,mapping=false){
  backing.forEach((b,i)=>b.fill(0x91+i));if(p)put(p,f.bytes);
  // A negative real string gets a matching physical continuation in the
  // first decoy. This catches false positives as well as missed DISPLAYs.
  const cut=4096-(p&4095),literal=Buffer.from('DISPLAY\0',wide?'utf16le':'latin1');
  if(mapping&&!f.display&&cut<literal.length)mem.set(literal.subarray(cut),wa(p)+cut);
  backing.forEach((b,i)=>b.copy(expected[i]));
  const api=wide?'CreateDCW':'CreateDCA',dc=call(api,[p,0,0,0]);assert.ok(dc,api+' allocation');stats.queries++;
  compare(getCaps(dc),f.display?screenExpected:printerBaseline[api],label+' caps',mapping);
  compare(35*call('GetDeviceCaps',[dc,90]),f.display?fontSizingBaseline.screen:fontSizingBaseline.printer[api],label+' Pawn 35pt DPI numerator',mapping);
  assert.equal(call('DeleteDC',[dc]),1,api+' release');
  backing.forEach((b,i)=>compare(b,expected[i],label+' entire backing/source/decoys '+i));
  assert.equal(e.guest_span_cursor_bytes(),0);assert.equal(e.guest_span_overflow_count(),0);
 }
 for(const wide of [false,true]){
  const fs=fixtures(wide);query(wide,{bytes:Buffer.alloc(0),display:false},0,'NULL');
  for(const f of fs){for(let phase=0;phase<4;phase++)query(wide,f,direct+32+phase,'direct '+wide+'/'+f.label+'/'+phase);
   for(let cut=1;cut<f.bytes.length;cut++)for(const start of [adjacent,fragmented])query(wide,f,start+4096-cut,'every byte cut '+wide+'/'+f.label+'/'+cut+'/'+start,start===fragmented);}
  for(const f of [fs[2],fs[4]])for(let phase=0;phase<4096;phase++)for(const start of [adjacent,fragmented])query(wide,f,start+phase,'all4096 DWORD/page phases '+wide+'/'+f.label+'/'+phase+'/'+start,start===fragmented);
  for(let mask=0;mask<128;mask++){const s=Array.from('DISPLAY',(c,i)=>mask&(1<<i)?c.toLowerCase():c).join('')+'\0';const f={bytes:Buffer.from(s,wide?'utf16le':'latin1'),display:true};for(let phase=0;phase<4;phase++)query(wide,f,direct+64+phase,'all case combinations '+wide+'/'+mask+'/'+phase);}
  for(let repeat=0;repeat<3;repeat++)for(const f of fs)query(wide,f,fragmented+4095,'repeat '+wide+'/'+f.label+'/'+repeat,true);
 }
 // Unchanged information-context routing is observed separately from the
 // display helpers. Its existing caps are the comparison control.
 for(const wide of [false,true]){const f=fixtures(wide)[2],api=wide?'CreateICW':'CreateICA';put(direct,f.bytes);const a=call(api,[direct,0,0,0]);const base=getCaps(a);assert.equal(call('DeleteDC',[a]),1);put(fragmented+4095,f.bytes);const b=call(api,[fragmented+4095,0,0,0]);compare(getCaps(b),base,api+' unchanged transport-independent routing');assert.equal(call('DeleteDC',[b]),1);}
 function target(wide){put(direct,fixtures(wide)[2].bytes);const screen=call(wide?'CreateDCW':'CreateDCA',[direct,0,0,0]);assert.ok(screen);const dc=call('CreateCompatibleDC',[screen]);assert.ok(dc);put(bmi,Buffer.alloc(40));e.guest_write32(bmi,40);e.guest_write32(bmi+4,32);e.guest_write32(bmi+8,-32);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);const bitmap=call('CreateDIBSection',[dc,bmi,0,out,0,0]),bits=e.guest_read32(out)>>>0;assert.ok(bitmap&&bits);return{screen,dc,bitmap,bits,old:call('SelectObject',[dc,bitmap])};}
 const a=target(false),b=target(true),pixels=t=>Buffer.from(memory.buffer,wa(t.bits),4096),brush=call('CreateSolidBrush',[0x003399cc]);assert.ok(brush);
 function state(t){const values=['GetTextColor','GetBkColor','GetBkMode','GetMapMode','GetROP2','GetPolyFillMode','GetStretchBltMode'].map(n=>call(n,[t.dc]));for(const type of [1,2,7])values.push(call('GetCurrentObject',[t.dc,type]));values.push(call('GetClipBox',[t.dc,out]),read(out,16).toString('hex'));return values;}
 call('SetTextColor',[a.dc,0x00123456]);call('SetTextColor',[b.dc,0x00654321]);call('SetBkMode',[a.dc,1]);const original=state(a),independent=state(b),oldBrush=call('SelectObject',[a.dc,brush]);
 function draw(label,clip){pixels(a).fill(255);pixels(b).fill(255);const before=state(a);assert.equal(call('PatBlt',[a.dc,3,4,7,8,0x00f00021]),1);const literal=Buffer.alloc(4096,255);for(let y=Math.max(4,clip[1]);y<Math.min(12,clip[3]);y++)for(let x=Math.max(3,clip[0]);x<Math.min(10,clip[2]);x++){const i=(y*32+x)*4;literal[i]=0x33;literal[i+1]=0x99;literal[i+2]=0xcc;literal[i+3]=0;}
  compare(pixels(a),literal,label+' literal public DIB pixels');compare(pixels(b),Buffer.alloc(4096,255),label+' independent DIB');compare(state(a),before,label+' draw state');compare(state(b),independent,label+' independent DC state');stats.pixelControls++;if(options.capture)options.capture(label,Buffer.from(pixels(a)),32,32);
 }
 draw('initial',[0,0,32,32]);assert.equal(call('SaveDC',[a.dc]),1);call('SetTextColor',[a.dc,0x00778899]);assert.equal(call('IntersectClipRect',[a.dc,4,5,9,11]),2);const outer=state(a);assert.equal(call('SaveDC',[a.dc]),2);call('SetBkColor',[a.dc,0x00556677]);assert.equal(call('IntersectClipRect',[a.dc,5,6,8,10]),2);const inner=state(a);
 for(const [saved,clip,label]of [[inner,[5,6,8,10],'inner'],[outer,[4,5,9,11],'outer']]){for(const wide of [false,true])query(wide,fixtures(wide)[2],fragmented+4095,label+' mapped CreateDC '+wide,true);compare(state(a),saved,label+' mapped creation state');draw(label,clip);assert.equal(call('RestoreDC',[a.dc,-1]),1);}
 call('SelectObject',[a.dc,oldBrush]);compare(state(a),original,'all caller saves restored');assert.equal(call('DeleteObject',[brush]),1);
 for(const t of [a,b]){call('SelectObject',[t.dc,t.old]);assert.equal(call('DeleteObject',[t.bitmap]),1);assert.equal(call('DeleteDC',[t.dc]),1);assert.equal(call('DeleteDC',[t.screen]),1);}
 console.log(JSON.stringify(stats));return stats;
}
module.exports={run,fixtures};
if(require.main===module)run().then(s=>{assert.equal(s.controlFailures,0);assert.equal(s.mappingFailures,0);console.log('PASS CreateDCA/W DISPLAY guest page mapping');}).catch(e=>{console.error(e);process.exitCode=1;});
