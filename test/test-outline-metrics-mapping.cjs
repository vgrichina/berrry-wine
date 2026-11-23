'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
// Original CC0 sfnt bytes, parsed without invoking the candidate or font helpers.
function original(root,name,sha){
 const bytes=fs.readFileSync(path.join(root,'test/fixtures/ttc-ebdt',name));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sha);
 const offsets=bytes.toString('ascii',0,4)==='ttcf'?Array.from({length:bytes.readUInt32BE(8)},(_,i)=>bytes.readUInt32BE(12+i*4)):[0];
 const members=offsets.map(offset=>{
  const tables=new Map();
  for(let i=0;i<bytes.readUInt16BE(offset+4);i++){const row=offset+12+i*16,start=bytes.readUInt32BE(row+8),len=bytes.readUInt32BE(row+12);assert.ok(start+len<=bytes.length);tables.set(bytes.toString('ascii',row,row+4),bytes.subarray(start,start+len));}
  const names=tables.get('name'),start=names.readUInt16BE(4);let family;
  for(let i=0;i<names.readUInt16BE(2);i++){const r=6+i*12;if(names.readUInt16BE(r)===3&&names.readUInt16BE(r+4)===0x409&&names.readUInt16BE(r+6)===1){const b=names.subarray(start+names.readUInt16BE(r+10),start+names.readUInt16BE(r+10)+names.readUInt16BE(r+8));family=Array.from({length:b.length/2},(_,j)=>String.fromCharCode(b.readUInt16BE(j*2))).join('');}}
  assert.ok(family);return{family,tables};
 });return{name,bytes,members};
}
function expected(member,ppem,wide){
 const t=member.tables,head=t.get('head'),os=t.get('OS/2'),h=t.get('hhea'),post=t.get('post');
 const u=(b,o)=>b.readUInt16BE(o),s=(b,o)=>b.readInt16BE(o),upem=u(head,18);
 const round=n=>n<0?-Math.floor((-n+upem/2)/upem):Math.floor((n+upem/2)/upem),scale=n=>round(n*ppem);
 const italic=!!(u(os,62)&1),weight=u(os,4)||400,style=weight>=700?(italic?'Bold Italic':'Bold'):(italic?'Italic':'Regular');
 const names=[member.family,member.family,style,member.family+(style==='Regular'?'':' '+style)],base=wide?216:212,shift=wide?4:0;
 const strings=names.map(n=>Buffer.from(n+'\0',wide?'utf16le':'latin1')),b=Buffer.alloc(base+strings.reduce((n,v)=>n+v.length,0));
 const put=(o,v)=>b.writeInt32LE(v|0,o),f=(o,v)=>put(o+shift,v);
 put(0,base);
 const ascent=scale(u(os,74)||s(h,4)),descent=scale(u(os,76)||-s(h,6));
 const ext=Math.max(0,s(h,8)-(u(os,74)+u(os,76)-(s(h,4)-s(h,6))));
 const metrics=[ascent+descent,ascent,descent,Math.max(0,ascent+descent-ppem),scale(ext),scale(s(os,2)),scale(u(h,10)),weight,0,96,96];
 assert.ok(s(os,2)>0,'fixture has independent average width');assert.ok(!t.has('VDMX'),'fixture uses design metrics');
 metrics.forEach((v,i)=>put(4+i*4,v));
 const first=u(os,64),last=u(os,66),pitch=post.readUInt32BE(12)?0x36:((os[33]>=2&&os[33]<=10)?0x17:0x27);
 if(wide){[first,last,31,32].forEach((v,i)=>b.writeUInt16LE(v,48+i*2));b[56]=+italic;b[59]=pitch;}else{[Math.min(first,255),Math.min(last,255),31,32,+italic,0,0,pitch].forEach((v,i)=>b[48+i]=v);}
 os.copy(b,61+shift,32,42);f(72,u(os,62));f(76,u(os,8));f(80,1);f(88,(Math.imul(post.readInt32BE(4),10)>>16));f(92,upem);
 [68,70,72].forEach((o,i)=>f(96+i*4,s(os,o)));
 [36,38,40,42].forEach((o,i)=>f(116+i*4,s(head,o)));
 [4,6,8].forEach((o,i)=>f(132+i*4,s(h,o)));f(144,u(head,46));
 for(let i=0;i<10;i++)f(148+i*4,s(os,10+i*2));f(188,s(post,10));f(192,s(post,8));
 let cursor=base;strings.forEach((v,i)=>{f(196+i*4,cursor);v.copy(b,cursor);cursor+=v.length;});return b;
}

const {bootRenderHarness}=require('./render-helper');
const apiTable=require('../src/api_table.json');
// https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getoutlinetextmetricsa
// Transport regression. The oracle preserves the project's existing metric
// and virtual-name policy; it is not a new Windows metric policy.
const extraWat=String.raw`
 (func (export "otm_init")
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $update_thunk_end))
 (func (export "otm_regs") (result i32) (global.get $reg_base))
 (func (export "otm_module") (param i32) (result i32)
  (call $handle_GetModuleHandleA (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "otm_resolve") (param i32 i32) (result i32)
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (i32.load (global.get $reg_base)))
 (func (export "otm_call") (param i32)
  (global.set $eip (i32.const 0x456789ab))
  (call $win32_dispatch (i32.shr_u (i32.sub (local.get 0) (global.get $thunk_guest_base)) (i32.const 3))))
 (func (export "otm_win16") (param $dc i32) (param $cb i32) (param $out i32) (param $stack i32) (result i32)
  (call $win16_seg_set (i32.const 1) (i32.const 0x100000) (i32.const 65536) (i32.const 0) (i32.const 1))
  (call $win16_seg_set (i32.const 2) (local.get $out) (i32.const 65536) (i32.const 1) (i32.const 2))
  (i32.store offset=16 (global.get $reg_base) (local.get $stack))
  (call $gs16 (local.get $stack) (i32.const 0x90))
  (call $gs16 (i32.add (local.get $stack) (i32.const 2)) (i32.const 0xf))
  (call $gs16 (i32.add (local.get $stack) (i32.const 4)) (i32.const 0))
  (call $gs16 (i32.add (local.get $stack) (i32.const 6)) (select (i32.const 0x17) (i32.const 0) (local.get $out)))
  (call $gs16 (i32.add (local.get $stack) (i32.const 8)) (local.get $cb))
  (call $gs16 (i32.add (local.get $stack) (i32.const 10)) (call $win16_h16 (local.get $dc)))
  (call $win16_GetOutlineTextMetrics)
  (i32.load (global.get $reg_base)))
`;
const stats={calls:0,queries:0,comparisons:0,renders:0,renderHashes:[],mappingFailures:0,controlFailures:0,decoyCorruptions:0,examples:[]};
function compare(actual,wanted,label,mapping=false){
 stats.comparisons++;if(Buffer.isBuffer(actual)?actual.equals(wanted):actual===wanted)return;
 stats[mapping?'mappingFailures':'controlFailures']++;
 if(stats.examples.length<20){let first=0;if(Buffer.isBuffer(actual))while(first<actual.length&&actual[first]===wanted[first])first++;
 stats.examples.push({label,mapping,first,actual:Buffer.isBuffer(actual)?actual.subarray(first,first+16).toString('hex'):actual,expected:Buffer.isBuffer(wanted)?wanted.subarray(first,first+16).toString('hex'):wanted});}
}
async function main(){
 const root=path.resolve(__dirname,'..');
 const files=[original(root,'faces.ttc','72f4c72ec3b3283eb8c086ce0041169dfd2c879d6251b8752465e2201a9504ca'),original(root,'complex.ttf','719404b7ccf42626db10cd2fb7939f0536a8ddb279619e564f776c70ae7409e7')];
 const {exports:e,memory,hostCtx}=await bootRenderHarness({extraWat,width:96,height:48});
 for(const key of hostCtx.vfs.files.keys())if(/\.(ttf|ttc|otf)$/i.test(key))hostCtx.vfs.files.delete(key);
 for(const file of files)hostCtx.vfs.files.set('c:\\windows\\fonts\\'+file.name,{data:new Uint8Array(file.bytes),attrs:0x20});
 e.init_thread(1,0x400000,0,0,0,0,0);e.heap_init(0x800000);e.otm_init();e.set_api_log(0);
 const mem=new Uint8Array(memory.buffer),v=new DataView(memory.buffer),regs=e.otm_regs()>>>0;
 const wa=p=>e.guest_to_wasm(p)>>>0,alloc=n=>{const p=e.guest_alloc(n)>>>0;assert.ok(p);return p;};
 const put=(p,b)=>b.forEach((x,i)=>e.guest_write8(p+i,x)),read=(p,n)=>Buffer.from(Array.from({length:n},(_,i)=>e.guest_read8(p+i)));
 const str=(s,wide=false)=>{const b=Buffer.from(s+'\0',wide?'utf16le':'latin1'),p=alloc(b.length);put(p,b);return p;};
 const frame=alloc(256),stack=frame+64,other=alloc(64),thunks=new Map();
 v.setUint32(regs+16,stack,true);const module=e.otm_module(str('GDI32.DLL'))>>>0;assert.ok(module);
 for(const name of ['GetOutlineTextMetricsA','GetOutlineTextMetricsW','CreateCompatibleDC','DeleteDC','CreateFontA','CreateFontW','SelectObject','GetCurrentObject','GetStockObject','DeleteObject','SaveDC','RestoreDC','CreateDIBSection','TextOutA','TextOutW','SetBkMode','SetTextColor']){
  v.setUint32(regs+16,stack,true);const thunk=e.otm_resolve(module,str(name))>>>0,row=apiTable.find(r=>r.name===name);assert.ok(thunk,name);assert.equal(row.convention,'stdcall');assert.equal(e.guest_read32(thunk+4),row.id);thunks.set(name,{thunk,nargs:row.nargs});
 }
 function call(name,args){
  const entry=thunks.get(name);assert.equal(args.length,entry.nargs);mem.fill(0x5a,wa(frame),wa(frame)+256);e.guest_write32(stack,0x12345678);args.forEach((x,i)=>e.guest_write32(stack+4+4*i,x));
  const before=read(frame,256),unrelated=read(other,64),seed=[0xa0123456,0x11223344,0x22334455,0x33445566,stack,0x44556677,0x55667788,0x66778899];seed.forEach((x,i)=>v.setUint32(regs+i*4,x,true));e.otm_call(entry.thunk);stats.calls++;
  assert.equal(e.get_esp()>>>0,stack+4+args.length*4,name+' ESP');assert.equal(e.get_eip()>>>0,0x456789ab,name+' EIP');for(const i of [1,2,3,5,6,7])assert.equal(v.getUint32(regs+i*4,true),seed[i],name+' register '+i);
  assert.deepEqual(read(frame,256),before,name+' stack');assert.deepEqual(read(other,64),unrelated);return e.get_eax()>>>0;
 }
 const dc=call('CreateCompatibleDC',[0]),independent=call('CreateCompatibleDC',[0]);assert.ok(dc&&independent);
 const base=0x30000000,adjacent=0x31000000,decoys=[0x28000000,0x29000000],hole=0x32000000;
 for(const p of [base,decoys[0],base+4096,decoys[1],hole])assert.equal(e.test_virtual_map_commit(p,4096)>>>0,p);
 assert.equal(e.test_virtual_map_commit(adjacent,8192)>>>0,adjacent);assert.equal(wa(decoys[0]),wa(base)+4096);assert.equal(wa(decoys[1]),wa(base+4096)+4096);assert.notEqual(wa(base+4096),wa(base)+4096);assert.equal(wa(adjacent+4096),wa(adjacent)+4096);
 const direct=alloc(8192),spans=[[wa(direct),8192],[wa(base),4096],[wa(base+4096),4096],...decoys.map(p=>[wa(p),4096]),[wa(adjacent),8192],[wa(hole),4096],[wa(0),64]];
 const buffers=spans.map(([p,n])=>Buffer.from(mem.buffer,p,n)),before=buffers.map(b=>Buffer.alloc(b.length)),wanted=before.map(b=>Buffer.alloc(b.length));
 function query(wide,p,cb,answer,label,mapping=false,target=dc){
  spans.forEach(([p,n],i)=>{mem.fill(0x91+i,p,p+n);buffers[i].copy(before[i]);before[i].copy(wanted[i]);});
  const valid=answer&&(!p||cb>=answer.length)&&!(p===0x90000000||p===hole+4095||p===0xfffffff0),result=valid?answer.length:0;
  if(valid&&p)for(let j=0;j<answer.length;j++){const physical=wa(p+j),i=spans.findIndex(([s,n])=>physical>=s&&physical<s+n);assert.ok(i>=0);wanted[i][physical-spans[i][0]]=answer[j];}
  compare(call(wide?'GetOutlineTextMetricsW':'GetOutlineTextMetricsA',[target,cb,p]),result,label+' return',mapping);stats.queries++;
  buffers.forEach((b,i)=>{compare(b,wanted[i],label+' full backing '+i,mapping);if((i===3||i===4)&&!b.equals(wanted[i]))stats.decoyCorruptions++;});
  assert.equal(e.guest_span_cursor_bytes(),0,label+' released');assert.equal(e.guest_span_overflow_count(),0);
 }
 const bmi=alloc(40),out=alloc(4);mem.fill(0,wa(bmi),wa(bmi)+40);e.guest_write32(bmi,40);e.guest_write32(bmi+4,96);e.guest_write32(bmi+8,-48);e.guest_write16(bmi+12,1);e.guest_write16(bmi+14,32);
 const bitmap=call('CreateDIBSection',[dc,bmi,0,out,0,0]),bits=e.guest_read32(out)>>>0;assert.ok(bitmap);const oldBitmap=call('SelectObject',[dc,bitmap]);call('SetBkMode',[dc,1]);call('SetTextColor',[dc,0]);
 const sample=str('AHI'),sampleW=str('AHI',true);
 function draw(wide){const p=wa(bits),n=96*48*4,pre=Buffer.from(mem.subarray(p-16,p)),post=Buffer.from(mem.subarray(p+n,p+n+16));mem.fill(255,p,p+n);assert.equal(call(wide?'TextOutW':'TextOutA',[dc,3,3,wide?sampleW:sample,3]),1);const b=Buffer.from(mem.subarray(p,p+n));assert.ok(b.some(x=>x!==255));assert.deepEqual(Buffer.from(mem.subarray(p-16,p)),pre);assert.deepEqual(Buffer.from(mem.subarray(p+n,p+n+16)),post);stats.renders++;stats.renderHashes.push(crypto.createHash('sha256').update(b).digest('hex'));return b;}
 const fonts=[];
 for(const file of files)for(const member of file.members)for(const fontWide of [false,true])for(const ppem of [12,24]){const font=call(fontWide?'CreateFontW':'CreateFontA',[-ppem,0,0,0,400,0,0,0,0,0,0,0,0,str(member.family,fontWide)]);assert.ok(font);fonts.push({font,member,ppem,fontWide});}
 const oldFont=call('SelectObject',[dc,fonts[0].font]),otherFont=call('SelectObject',[independent,fonts[1].font]);
 for(const record of fonts){const {font,member,ppem,fontWide}=record;call('SelectObject',[dc,font]);const rendered=draw(false);compare(draw(true),rendered,'A/W TextOut initial');
  for(const wide of [false,true]){const answer=expected(member,ppem,wide),label=member.family+'/'+ppem+'/'+fontWide+'/'+wide;
   for(const cb of [0,1,answer.length-1,answer.length,0xffffffff])query(wide,0,cb,answer,label+'/NULL');
   for(const cb of [0,1,answer.length-1])for(const p of [direct+17,base+4095,adjacent+4095])query(wide,p,cb,answer,label+'/short');
   for(const p of [0x90000000,hole+4095,0xfffffff0])query(wide,p,answer.length,answer,label+'/invalid');
   for(let repeat=0;repeat<2;repeat++){
    query(wide,direct+17,answer.length+19,answer,label+'/contiguous');
    // Every byte split covers every fixed field, padding, offset, string and
    // UTF-16 code unit. All backing and two physical decoys are compared.
    for(let cut=1;cut<answer.length;cut++)for(const start of [adjacent,base])query(wide,start+4096-cut,answer.length+(repeat?19:0),answer,label+'/'+repeat+'/'+cut,start===base);
   }
   for(const target of [0,0xdeadbeef,independent])for(const p of [0,direct+17,base+4095]){
    const independentAnswer=target===independent?expected(fonts[1].member,fonts[1].ppem,wide):null;query(wide,p,answer.length+128,independentAnswer,label+'/DC/'+target,p===base+4095,target);
   }
  }
  compare(call('GetCurrentObject',[dc,6]),font,'selected font');compare(call('GetCurrentObject',[independent,6]),fonts[1].font,'independent font');compare(draw(false),rendered,'queries preserve TextOutA');compare(draw(true),rendered,'queries preserve TextOutW');
  assert.equal(call('SaveDC',[dc]),1);const next=fonts[(fonts.indexOf(record)+1)%fonts.length];call('SelectObject',[dc,next.font]);assert.equal(call('SaveDC',[dc]),2);call('SelectObject',[dc,call('GetStockObject',[10])]);
  for(const wide of [false,true])for(const p of [0,direct+17,base+4095])query(wide,p,1024,null,'bitmap font');
  assert.equal(call('RestoreDC',[dc,-1]),1);compare(call('GetCurrentObject',[dc,6]),next.font,'inner restored');for(const wide of [false,true])query(wide,base+4095,1024,expected(next.member,next.ppem,wide),'inner restore metrics',true);
  assert.equal(call('RestoreDC',[dc,-1]),1);compare(call('GetCurrentObject',[dc,6]),font,'outer restored');for(const wide of [false,true])query(wide,base+4095,1024,expected(member,ppem,wide),'outer restore metrics',true);compare(draw(false),rendered,'restored TextOut');
 }
 // Exercise the unchanged Win16 adapter as a real Pascal frame. Its Win32
 // scratch buffer is a guest address: retaining that helper ABI is essential.
 const last=fonts.at(-1),a=expected(last.member,last.ppem,false),small=Buffer.alloc(a.length-98),word=(o,n)=>small.writeUInt16LE(n&65535,o);
 word(0,114);for(let i=0;i<8;i++)word(2+i*2,a.readInt32LE(4+i*4));a.copy(small,18,52,55);a.copy(small,21,48,52);a.copy(small,25,55,57);[32,36,40].forEach((o,i)=>word(27+i*2,a.readInt32LE(4+o)));
 a.copy(small,33,60,71);for(let i=0;i<31;i++)word(44+i*2,a.readInt32LE(72+i*4));for(let i=0;i<4;i++)word(106+i*2,a.readUInt32LE(196+i*4)-98);a.copy(small,114,212);
 const narrow=alloc(1024),pascal=alloc(64)+16;
 for(const [cb,p,result] of [[0,0,small.length],[65535,0,small.length],[small.length-1,narrow,0],[small.length,narrow,small.length]]){
  mem.fill(0xa5,wa(narrow),wa(narrow)+1024);assert.equal(e.otm_win16(dc,cb,p,pascal)>>>0,result);assert.equal(e.get_esp()>>>0,pascal+12);assert.equal(e.get_eip()>>>0,0x100090);
  assert.deepEqual(read(narrow,1024),p&&result?Buffer.concat([small,Buffer.alloc(1024-small.length,0xa5)]):Buffer.alloc(1024,0xa5));assert.equal(e.guest_span_cursor_bytes(),0);
 }
 call('SelectObject',[dc,oldFont]);call('SelectObject',[independent,otherFont]);call('SelectObject',[dc,oldBitmap]);assert.equal(call('DeleteObject',[bitmap]),1);for(const {font} of fonts)assert.equal(call('DeleteObject',[font]),1);assert.equal(call('DeleteDC',[dc]),1);assert.equal(call('DeleteDC',[independent]),1);
 console.log(JSON.stringify(stats));assert.equal(stats.controlFailures,0,'independent sfnt, names, contract and ABI controls');assert.equal(stats.mappingFailures,0,'mapped output and all backing');console.log('PASS outline metrics public A/W mapping, independent CC0 oracle, every split, decoys, state, TextOut and stdcall');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
