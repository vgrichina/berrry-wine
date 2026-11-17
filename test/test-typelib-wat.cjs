'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {compile}=require('../tools/watx');
const rawFragment=fs.readFileSync(require.resolve('../src/09a7j-typelib.wat'),'utf8');
const fragment=rawFragment.split('(func $tl_method')[0]+rawFragment.slice(rawFragment.indexOf('(func $tl_builtin_more'),rawFragment.indexOf('(func $tl_wstr'));
// Isolated binary-reader unit fixture. Addresses here belong to this small test
// module; production uses the real guest heap and guest-page accessors.
const pre=`(func $crash_unimplemented (param $n i32) (unreachable))
(memory 256) (export "memory" (memory 0))
(global $heap (mut i32) (i32.const 2097152))
(func $g2w (param $p i32) (result i32) (local.get $p))
(func $heap_alloc (param $n i32) (result i32) (local $p i32)
 (local.set $p (global.get $heap))
 (global.set $heap (i32.add (global.get $heap) (i32.and (i32.add (local.get $n) (i32.const 7)) (i32.const -8)))) (local.get $p))
(func $heap_free (param $p i32))
(func $zero_memory (param $p i32) (param $n i32) (memory.fill (local.get $p) (i32.const 0) (local.get $n)))
${[8,16,32].map(n=>`(func $gl${n} (param $p i32) (result i32) (i32.load${n===32?'':n+'_u'} (local.get $p)))
(func $gs${n} (param $p i32) (param $v i32) (i32.store${n===32?'':n} (local.get $p) (local.get $v)))`).join('\n')}`;
const post=`(func (export "decode_doc") (param $len i32) (param $stream i32) (param $bytes i32) (result i32) (local $lib i32)
 (global.set $heap (i32.const 2097152)) (global.set $tl_bad (i32.const 0))
 (local.set $lib (call $tl_new (i32.const 65536) (local.get $len)))
 (call $gs32 (i32.add (local.get $lib) (i32.const 76)) (i32.const 0))
 (call $tl_slt_doc (local.get $lib) (local.get $stream) (local.get $bytes)))
(func (export "parse") (param $len i32) (param $fmt i32) (result i32) (local $lib i32)
 (global.set $heap (i32.const 2097152)) (global.set $tl_bad (i32.const 0))
 (local.set $lib (call $tl_new (i32.const 65536) (local.get $len)))
 (if (i32.eq (local.get $fmt) (i32.const 1))
  (then (drop (call $tl_parse_msft (local.get $lib))))
  (else (drop (call $tl_parse_sltg (local.get $lib)))))
 (if (global.get $tl_bad) (then (call $tl_dispose (local.get $lib)) (return (i32.const 0))))
 (local.get $lib))`;
const r=compile(pre+fragment+post,new Map(),{mode:'production'});assert(r.success,r.error);
const bytes=Buffer.from(r.wasmBinary),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(process.env.TYPELIB_TEST_MODULE)fs.writeFileSync(process.env.TYPELIB_TEST_MODULE,bytes);
const e=new WebAssembly.Instance(new WebAssembly.Module(bytes)).exports;
const mem=new Uint8Array(e.memory.buffer),dv=new DataView(e.memory.buffer),u32=p=>dv.getUint32(p,true),u16=p=>dv.getUint16(p,true);
const str=p=>p?Buffer.from(mem.slice(p,p+u32(p-4))).toString('utf16le'):null;
function parse(b,fmt){mem.fill(0,65536,2097152);mem.set(b,65536);return e.parse(b.length,fmt);}
function metadata(lib){const ts=u32(lib+12);return {name:str(u32(lib+20)),count:u32(lib+8),types:Array.from({length:u32(lib+8)},(_,i)=>{const t=u32(ts+i*4),a=u32(t+12);return {name:str(u32(t+16)),kind:u32(a+40),funcs:u16(a+44),vars:u16(a+46),impls:u16(a+48)};})};}
const sims=require('./test-sims-typelib-native.cjs').resource();
const lib=parse(sims.data,2);assert(lib,'genuine Sims SLTG parses');
const m=metadata(lib);assert(m.count>0);assert(m.types.every(t=>t.name));
console.log(JSON.stringify({moduleSHA256:sha(bytes),resource:sims.metadata,metadata:m}));
for(const n of [0,1,4,35,36,100,sims.data.length-1024])assert.equal(parse(sims.data.subarray(0,n),2),0,'SLTG truncation '+n);
const cycle=Buffer.from(sims.data);cycle.writeUInt16LE(cycle.readUInt16LE(10),36+(cycle.readUInt16LE(10)-1)*8+6);assert.equal(parse(cycle,2),0,'cyclic SLTG block chain');
console.log('PASS native WAT SLTG readers: genuine resource metadata, truncation, cyclic chain');
// Authored MSFT file: one interface, one I4 method, one I4 parameter.
function msftFixture(recursive=false){
 const names=['Fixture','ICalculator','Add','amount'];let nameBytes=0;const no=names.map(s=>{const o=nameBytes;nameBytes+=12+s.length;return o;});
 const dir=88,ti=328,nt=428,gt=nt+nameBytes,td=gt+48,member=td+8,docBase=member+52,docs=['Library documentation','Calculator documentation','help.chm'],docOffsets=[0,23,49],b=Buffer.alloc(docBase+59);
 const w=(p,n)=>b.writeUInt32LE(n>>>0,p),h=(p,n)=>b.writeUInt16LE(n,p);
 b.write('MSFT');w(4,0x10002);w(8,0);w(20,0x41);w(24,1);w(32,1);w(56,no[0]);w(36,docOffsets[0]);w(40,123);w(60,docOffsets[2]);w(84,0);
 for(let i=0;i<15;i++){w(dir+i*16,0xffffffff);w(dir+i*16+8,0xffffffff);w(dir+i*16+12,15);}
 for(const [i,off,len]of [[0,ti,100],[5,gt,48],[7,nt,nameBytes],[9,td,8]]){w(dir+i*16,off);w(dir+i*16+4,len);}
 w(ti,3);w(ti+4,member);w(ti+24,1);w(ti+44,24);w(ti+52,no[1]);h(ti+78,4);w(ti+80,4);w(ti+60,docOffsets[1]);w(ti+68,456);
 w(dir+8*16,docBase);w(dir+8*16+4,59);docs.forEach((text,i)=>{h(docBase+docOffsets[i],text.length);b.write(text,docBase+docOffsets[i]+2);});
 for(let i=0;i<names.length;i++){w(nt+no[i]+8,names[i].length);b.write(names[i],nt+no[i]+12);}
 b.set(Buffer.from('785634123412785690abcdef01234567','hex'),gt);b.set(Buffer.from('efcdab90896745230123456789abcdef','hex'),gt+24);
 w(member,36);w(member+4,36);w(member+8,recursive?0:0x80030003);w(member+20,1|8|(4<<8));h(member+24,1);
 w(member+28,0x80030003);w(member+32,no[3]);w(member+36,1);w(member+40,7);w(member+44,no[2]);w(member+48,0);
 h(td,26);w(td+4,0);return b;
}
// Prefix-code help text fixture: bit 1 => Hello, bit 0 => terminator.
const helpFixture=Buffer.from([64,0,12,0,0,0,128,0,10,0,72,101,108,108,111,0,0,0,128]);mem.set(helpFixture,65536);assert.equal(str(e.decode_doc(helpFixture.length,18,1)),'Hello');
const ms=msftFixture(),ml=parse(ms,1);assert(ml);const mm=metadata(ml);assert.deepEqual(mm,{name:'Fixture',count:1,types:[{name:'ICalculator',kind:3,funcs:1,vars:0,impls:0}]});
const mt=u32(u32(ml+12)),mf=u32(mt+20);assert.equal(u32(mf),7);assert.equal(str(u32(mf+52)),'Add');assert.equal(u16(mf+36),3);assert.equal(u16(u32(mf+8)+4),3);assert.equal(str(u32(u32(mf+56))),'amount');
assert.equal(parse(msftFixture(true),1),0,'MSFT recursive TYPEDESC rejected');
const anonymous=Buffer.from(ms);anonymous.writeUInt32LE(0xffffffff,328+44);assert(parse(anonymous,1),'MSFT type GUID may be absent');
for(const n of [0,4,83,87,328,ms.length-1])assert.equal(parse(ms.subarray(0,n),1),0,'MSFT truncation '+n);
console.log('PASS authored MSFT: names, GUIDs, method/parameter metadata, recursive descriptor and truncations');
function sltgFixture(){
 const start=85,typeLen=119,libLen=710,b=Buffer.alloc(start+typeLen+libLen),lib=start+typeLen,base=start+43,tail=start+65;
 const w=(p,n)=>b.writeUInt32LE(n>>>0,p),h=(p,n)=>b.writeUInt16LE(n,p);
 b.write('SLTG');h(4,3);h(6,9);h(10,1);w(36,typeLen);h(40,13);h(42,2);w(44,libLen);h(50,0);
 b.set(Buffer.from('\x01CompObj\0dir\0','binary'),52);b.write('A',65);
 h(start,0x501);w(start+2,0xffffffff);w(start+10,34);b[start+26]=2;b[start+28]=2;b[start+29]=3;
 h(start+34,1);h(start+36,0xffff);b[start+38]=1;w(start+39,22);
 b[base]=0x4c;b[base+1]=0x12;h(base+2,0xffff);h(base+4,14);w(base+6,7);h(base+10,0xffff);h(base+12,0xffff);h(base+14,22);b[base+16]=4;b[base+17]=0x80;h(base+18,3);
 h(tail,1);h(tail+10,0xffff);h(tail+12,0xffff);h(tail+32,4);h(tail+34,4);h(tail+40,4);
 h(lib,0x51cc);h(lib+2,3);h(lib+6,0xffff);h(lib+8,0xffff);h(lib+10,0xffff);h(lib+16,1);h(lib+26,1);b.set(Buffer.from('785634123412785690abcdef01234567','hex'),lib+30);
 h(lib+110,1);h(lib+112,1);b[lib+114]=65;h(lib+115,0xffff);h(lib+117,0xffff);h(lib+119,8);h(lib+123,0xffff);h(lib+129,0xffff);b.set(Buffer.from('efcdab90896745230123456789abcdef','hex'),lib+131);h(lib+147,3);w(lib+149,153);h(lib+153,0xffff);b.write('Fixture\0ICalc\0Answer\0',lib+689,'binary');return b;
}
const sltg=sltgFixture(),al=parse(sltg,2);assert(al);assert.deepEqual(metadata(al),{name:'Fixture',count:1,types:[{name:'ICalc',kind:3,funcs:1,vars:0,impls:0}]});
assert.equal(str(u32(u32(u32(u32(al+12))+20)+52)),'Answer');
function msftImportFixture(){
 const b=Buffer.concat([ms,Buffer.alloc(120)]),at=ms.length,w=(p,n)=>b.writeUInt32LE(n>>>0,p);
 b.set(ms.subarray(ms.readUInt32LE(88+5*16),ms.readUInt32LE(88+5*16)+48),at);
 b.set(Buffer.from('3004020000000000c000000000000046','hex'),at+48);b.set(Buffer.from('0004020000000000c000000000000046','hex'),at+72);
 w(88+5*16,at);w(88+5*16+4,96);w(88+1*16,at+96);w(88+1*16+4,12);w(88+2*16,at+108);w(88+2*16+4,12);
 w(at+96,0x10000);w(at+100,0);w(at+104,72);w(at+108,48);w(at+112,0);w(at+116,1);b.writeUInt16LE(1,328+76);w(328+84,1);return b;
}
function retvalFixture(){const b=Buffer.from(ms),dir=88,td=b.readUInt32LE(dir+9*16),member=b.readUInt32LE(328+4);b.writeUInt32LE(0x80190019,member+8);b.writeUInt32LE(0,member+28);b.writeUInt32LE(10,member+36);b.writeUInt16LE(26,td);b.writeUInt32LE(0x80030003,td+4);return b;}
const retval=retvalFixture();assert(parse(retval,1));
const msImport=msftImportFixture();assert(parse(msImport,1));
for(const [offset,value,label]of [[32,4097,'type count'],[88+7*16,0xfffffff0,'name segment'],[88+9*16+4,4,'short descriptor segment']]){
 const malformed=Buffer.from(label==='short descriptor segment'?retval:ms);malformed.writeUInt32LE(value,offset);assert.equal(parse(malformed,1),0,'MSFT malformed '+label);
}
console.log('PASS authored SLTG method metadata and MSFT stdole import records');

async function nativeABI(){
 const {compileSrcWasm}=require('./compile-src'),{createHostImports}=require('../lib/host-imports'),{VirtualFS}=require('../lib/filesystem');
 const apiTable=require('../src/api_table.json');
 const extra=`(func (export "typelib_api_thunk") (param $id i32) (result i32) (local $v i32)
  (local.set $v (call $init_com_vtable (local.get $id) (i32.const 1))) (call $gl32 (local.get $v)))`;
 const sourcePins={};
 const wasm=compileSrcWasm((f,s)=>{sourcePins[f]=sha(Buffer.from(s));return f==='13-exports.wat'?s+'\n'+extra:s;});
 const modulePath=process.env.TYPELIB_NATIVE_MODULE||'/dev/shm/typelib-native-test.wasm';fs.writeFileSync(modulePath,wasm);assert.equal(sha(fs.readFileSync(modulePath)),sha(wasm));
 // No genuine OLEAUT32/stdole files are mapped. Original host media is untouched.
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),vfs=new VirtualFS();
 vfs.files.set('c:\\sims.exe',{data:fs.readFileSync(sims.metadata.enginePath),attrs:0x20});vfs.files.set('c:\\fixture.tlb',{data:ms,attrs:0x20});vfs.files.set('c:\\authored-sltg.tlb',{data:sltg,attrs:0x20});vfs.files.set('c:\\imported.tlb',{data:msImport,attrs:0x20});vfs.files.set('c:\\sims.tlb',{data:sims.data,attrs:0x20});
 vfs.files.set('c:\\retval.tlb',{data:retval,attrs:0x20});vfs.files.set('c:\\truncated.exe',{data:fs.readFileSync(sims.metadata.enginePath).subarray(0,64),attrs:0x20});
 const badImport=Buffer.from(msImport);badImport.writeUInt32LE(0xfffffff0,ms.length+100);vfs.files.set('c:\\bad-import.tlb',{data:badImport,attrs:0x20});
 const ctx={getMemory:()=>memory.buffer,renderer:null,vfs,resourceJson:{},apiTable};
 const imports=createHostImports(ctx);Object.assign(imports.host,{memory,create_thread:()=>0,exit_thread:()=>0,terminate_thread:()=>0,create_event:()=>0,set_event:()=>0,reset_event:()=>0,wait_single:()=>0,wait_multiple:()=>0,com_create_instance:()=>0x80004002});
 const currentClosure=require('../tools/watx-closure').watxSourceClosure();const rawSourcePins={};for(const [file,pin]of Object.entries(sourcePins)){assert.equal(sha(Buffer.from(currentClosure.vfs.get(file))),pin,'source stable through compile: '+file);rawSourcePins[file]=sha(fs.readFileSync(require('node:path').join(__dirname,'../src',file)));}
 console.log(JSON.stringify({nativeModuleBeforeExec:{modulePath,sha256:sha(wasm),sourcePins,rawSourcePins}}));
 const {instance}=await WebAssembly.instantiate(wasm,imports),w=instance.exports;ctx.exports=w;
 const calc=fs.readFileSync(require.resolve('./binaries/calc.exe'));new Uint8Array(memory.buffer).set(calc,w.get_staging());assert(w.load_pe(calc.length));
 const alloc=n=>w.guest_alloc(n)>>>0,read=p=>w.guest_read32(p)>>>0,write=(p,v)=>w.guest_write32(p,v),wide=s=>{const p=alloc((s.length+1)*2);for(let i=0;i<=s.length;i++)w.guest_write16(p+i*2,i<s.length?s.charCodeAt(i):0);return p;};
 const bstr=p=>{let s='';for(let i=0;i<read(p-4);i+=2)s+=String.fromCharCode(w.guest_read8(p+i)|(w.guest_read8(p+i+1)<<8));return s;};
 const stack=0x074ff000;
 function call(target,args){w.set_esp(stack);write(stack,0);args.forEach((a,i)=>write(stack+4+i*4,a));w.set_eip(target);w.set_yield_state(0,0);for(let i=0;i<16&&w.get_eip();i++)w.run(1000);assert.equal(w.get_eip(),0,'native call returns');assert.equal(w.get_esp()>>>0,stack+4+args.length*4,'stdcall ESP');return w.get_eax()>>>0;}
 const thunks=new Map(),api=(name,args)=>{if(!thunks.has(name))thunks.set(name,w.typelib_api_thunk(apiTable.find(a=>a.name===name).id)>>>0);return call(thunks.get(name),args);};
 const com=(obj,slot,args=[])=>call(read(read(obj)+slot*4),[obj,...args]),out=alloc(256);
 assert.equal(api('LoadTypeLib',[wide('c:\\fixture.tlb'),out]),0);const l=read(out);assert(l);assert.equal(com(l,3),1);
 assert.equal(com(l,4,[0,out+4]),0);const ti=read(out+4);assert(ti);
 // Native name search must restore canonical casing, respect capacity, and
 // transfer one real reference for every returned ITypeInfo.
 const spelling=p=>{let s='';for(let i=0;w.guest_read8(p+i)||w.guest_read8(p+i+1);i+=2)s+=String.fromCharCode(w.guest_read8(p+i)|(w.guest_read8(p+i+1)<<8));return s;};
 const search=wide('iCALCULATOR');assert.equal(com(l,10,[search,0,out+80]),0);assert.equal(read(out+80),1);assert.equal(spelling(search),'ICalculator');
 const memberSearch=wide('aDD');w.guest_write16(out+84,1);assert.equal(com(l,11,[memberSearch,0,out+88,out+92,out+84]),0);assert.equal(w.guest_read8(out+84),1);assert.equal(read(out+92),7);assert.equal(spelling(memberSearch),'Add');assert.equal(read(out+88),ti);com(read(out+88),2);
 w.guest_write16(out+84,0);write(out+88,0x12345678);assert.equal(com(l,11,[wide('Add'),0,out+88,out+92,out+84]),0);assert.equal(read(out+88),0x12345678);assert.equal(w.guest_read8(out+84),0);
 assert.equal(com(l,10,[wide('Absent'),0,out+80]),0);assert.equal(read(out+80),0);
 assert.equal(com(l,10,[0,0,out+80]),0x80070057);assert.equal(com(l,11,[search,0,out+88,out+92,0]),0x80070057);
 assert.equal(com(l,4,[99,out+80]),0x8002802b);assert.equal(read(out+80),0);
 assert.equal(com(l,9,[0xffffffff,out+40,out+44,out+48,out+52]),0);assert.equal(bstr(read(out+44)),'Library documentation');assert.equal(read(out+48),123);assert.equal(bstr(read(out+52)),'help.chm');
 assert.equal(com(ti,12,[0xffffffff,out+40,out+44,out+48,out+52]),0);assert.equal(bstr(read(out+44)),'Calculator documentation');assert.equal(read(out+48),456);
 assert.equal(com(ti,3,[out+8]),0);const attr=read(out+8);assert.equal(read(attr+40),3);assert.equal(w.guest_read8(attr+44),1);com(ti,19,[attr]);
 assert.equal(com(ti,5,[0,out+12]),0);const fd=read(out+12);assert.equal(read(fd),7);assert.equal(read(fd+20),4);com(ti,20,[fd]);
 assert.equal(com(ti,7,[7,out+32,4,out+16]),0);assert.equal(read(out+16),2);assert.equal(bstr(read(out+32)),'Add');assert.equal(bstr(read(out+36)),'amount');
 const ns=alloc(8),ids=alloc(8);write(ns,wide('aDd'));write(ns+4,wide('AMOUNT'));assert.equal(com(ti,10,[ns,2,ids]),0);assert.equal(read(ids),7);assert.equal(read(ids+4),0);
 // A real guest x86 stdcall method: return argument + 10, consume this+arg.
 const code=alloc(16);[0x8b,0x44,0x24,0x08,0x83,0xc0,0x0a,0xc2,0x08,0x00].forEach((b,i)=>w.guest_write8(code+i,b));
 const obj=alloc(4),vt=alloc(4),dp=alloc(16),arg=alloc(16),result=alloc(16);write(obj,vt);write(vt,code);write(dp,arg);write(dp+8,1);w.guest_write16(arg,3);write(arg+8,32);
 assert.equal(com(ti,11,[obj,7,1,dp,result,0,0]),0);assert.equal(w.guest_read8(result),3);assert.equal(read(result+8),42);
 assert.equal(com(ti,11,[obj,999,1,dp,result,0,0]),0x80020003);
 assert.equal(com(ti,11,[0,7,1,dp,result,0,0]),0x80070057);assert.equal(com(ti,11,[obj,7,1,0,result,0,0]),0x80070057);
 w.guest_write16(arg,8);write(out+80,99);assert.equal(com(ti,11,[obj,7,1,dp,result,0,out+80]),0x80020005);assert.equal(read(out+80),0);w.guest_write16(arg,3);
 write(dp+12,2);assert.equal(com(ti,11,[obj,7,1,dp,result,0,0]),0x80070057);write(dp+12,0);
 write(dp+8,0);assert.equal(com(ti,11,[obj,7,1,dp,result,0,0]),0x8002000e);write(dp+8,1);
 assert.equal(api('DispInvoke',[obj,ti,7,1,dp,result,0,0]),0);assert.equal(read(result+8),42);
 // Build metadata through the public METHODDATA/PARAMDATA ABI, then invoke it.
 const md=alloc(28),pd=alloc(8),intd=alloc(8);write(pd,wide('amount'));w.guest_write16(pd+4,3);
 write(md,wide('Add'));write(md+4,pd);write(md+8,7);write(md+12,0);write(md+16,4);write(md+20,1);w.guest_write16(md+24,1);w.guest_write16(md+26,3);write(intd,md);write(intd+4,1);
 assert.equal(api('CreateDispTypeInfo',[intd,1033,out+28]),0);const created=read(out+28);
 assert.equal(api('DispGetIDsOfNames',[created,ns,2,ids]),0);assert.equal(read(ids),7);
 assert.equal(api('DispInvoke',[obj,created,7,1,dp,result,0,0]),0);assert.equal(read(result+8),42);assert.equal(com(created,2),0);
 // HRESULT with an [out,retval] scalar is returned as a VARIANT, not HRESULT.
 assert.equal(api('LoadTypeLib',[wide('c:\\retval.tlb'),out+60]),0);const rl=read(out+60);assert.equal(com(rl,4,[0,out+64]),0);const rt=read(out+64),rc=alloc(16);
 [0x8b,0x44,0x24,0x08,0xc7,0x00,42,0,0,0,0x31,0xc0,0xc2,8,0].forEach((b,i)=>w.guest_write8(rc+i,b));write(vt,rc);write(dp+8,0);assert.equal(com(rt,11,[obj,7,1,dp,result,0,0]),0);assert.equal(w.guest_read8(result),3);assert.equal(read(result+8),42);
 const failure=alloc(8);[0xb8,5,0,7,0x80,0xc2,8,0].forEach((b,i)=>w.guest_write8(failure+i,b));write(vt,failure);const exception=alloc(32);assert.equal(com(rt,11,[obj,7,1,dp,result,exception,0]),0x80020009);assert.equal(read(exception+28),0x80070005);assert.equal(read(exception),0);assert.equal(com(rt,11,[obj,7,1,dp,result,0,0]),0x80020009);
 com(rt,2);com(rl,2);write(vt,code);write(dp+8,1);
 assert.notEqual(api('LoadTypeLib',[wide('c:\\truncated.exe'),out+60]),0);assert.equal(read(out+60),0);
 assert.equal(api('RegisterTypeLib',[l,wide('c:\\fixture.tlb'),0]),0);
 assert.equal(com(l,7,[out+20]),0);const la=read(out+20);assert.equal(api('LoadRegTypeLib',[la,1,0,0,out+24]),0);assert.equal(com(read(out+24),3),1);com(read(out+24),2);com(l,12,[la]);
 assert.equal(com(l,2),1,'typeinfo keeps library alive');assert.equal(com(ti,2),0,'last typeinfo retires arena');
 assert.equal(api('LoadTypeLib',[wide('c:\\sims.tlb'),out]),0);const sl=read(out);assert.equal(com(sl,3),87);
 assert.equal(com(sl,4,[8,out+4]),0);const st=read(out+4);assert.equal(com(st,8,[0,out+8]),0);assert.equal(com(st,14,[read(out+8),out+12]),0);const ref=read(out+12);assert.equal(com(ref,12,[0xffffffff,out+16,0,0,0]),0);assert.equal(bstr(read(out+16)),'IUnknown');com(ref,2);com(st,2);com(sl,2);
 assert.equal(api('LoadTypeLib',[wide('c:\\sims.exe'),out]),0);const peLib=read(out);assert.equal(com(peLib,3),87);com(peLib,2);
 assert.equal(api('LoadTypeLib',[wide('c:\\sims.exe\\1'),out]),0);assert.equal(com(read(out),3),87);com(read(out),2);
 assert.notEqual(api('LoadTypeLib',[wide('c:\\sims.exe\\65535'),out]),0);assert.equal(read(out),0);
 // Authored SLTG also reaches actual ITypeInfo::Invoke through a native vtable.
 assert.equal(api('LoadTypeLib',[wide('c:\\authored-sltg.tlb'),out]),0);const authoredLib=read(out);assert.equal(com(authoredLib,4,[0,out+4]),0);const authoredTi=read(out+4);
 const noarg=alloc(8);[0xb8,42,0,0,0,0xc2,4,0].forEach((b,i)=>w.guest_write8(noarg+i,b));write(vt,noarg);write(dp+8,0);assert.equal(com(authoredTi,11,[obj,7,1,dp,result,0,0]),0);assert.equal(read(result+8),42);com(authoredTi,2);com(authoredLib,2);write(vt,code);write(dp+8,1);
 assert.equal(api('LoadTypeLib',[wide('c:\\imported.tlb'),out]),0);const il=read(out);assert.equal(com(il,4,[0,out+4]),0);const it=read(out+4);assert.equal(com(it,8,[0,out+8]),0);assert.equal(com(it,14,[read(out+8),out+12]),0);const ir=read(out+12);assert.equal(com(ir,12,[0xffffffff,out+16,0,0,0]),0);assert.equal(bstr(read(out+16)),'IDispatch');com(ir,2);com(it,2);com(il,2);
 assert.equal(api('LoadTypeLib',[wide('c:\\bad-import.tlb'),out]),0);const bil=read(out);assert.equal(com(bil,4,[0,out+4]),0);const bit=read(out+4);assert.equal(com(bit,14,[1,out+12]),0x80028018);assert.equal(read(out+12),0);com(bit,2);com(bil,2);
 for(const [file,count]of [['stdole32.tlb',6],['stdole2.tlb',27]]){
  assert.equal(api('LoadTypeLib',[wide('c:\\windows\\system\\'+file),out]),0);const s=read(out);assert(com(s,3)>=count);
  const required=[['IUnknown',3],['IDispatch',3],['IEnumVARIANT',3]];
  if(file==='stdole2.tlb')required.push(['IFont',3],['IPicture',3],['StdFont',5],['StdPicture',5],['OLE_COLOR',6]);
  for(const [name,kind]of required){
   w.guest_write16(out+84,1);assert.equal(com(s,11,[wide(name),0,out+88,out+92,out+84]),0);assert.equal(w.guest_read8(out+84),1,file+' defines '+name);assert.equal(read(out+92),0xffffffff);
   const requiredTi=read(out+88);assert.equal(com(requiredTi,3,[out+96]),0);const requiredAttr=read(out+96);assert.equal(read(requiredAttr+40),kind,name+' TYPEKIND');
   if(kind!==6){assert.equal(com(s,6,[requiredAttr,out+100]),0,name+' GUID lookup');assert.equal(read(out+100),requiredTi);com(read(out+100),2);}
   if(kind===3)assert(w.guest_read8(requiredAttr+44)>0,name+' has method definitions');
   com(requiredTi,19,[requiredAttr]);com(requiredTi,2);
  }
  com(s,2);
 }
 assert.equal(api('LoadTypeLib',[wide('stdole2.tlb'),out]),0);const standard=read(out);
 assert.equal(com(standard,4,[0,out+4]),0);const guidType=read(out+4);assert.equal(com(guidType,6,[3,out+8]),0);const guidField=read(out+8);assert.equal(w.guest_read8(guidField+16),28);assert.equal(read(read(guidField+12)+12),8);com(guidType,21,[guidField]);com(guidType,2);
 assert.equal(com(standard,4,[33,out+4]),0);const font=read(out+4);write(ns,wide('Name'));assert.equal(com(font,10,[ns,1,ids]),0);assert.equal(read(ids),0);assert.equal(com(font,12,[0,out+16,0,0,0]),0);assert.equal(bstr(read(out+16)),'Name');com(font,2);
 assert.equal(com(standard,4,[8,out+4]),0);const cls=read(out+4);assert.equal(com(cls,9,[0,out+8]),0);assert.equal(read(out+8),1);assert.equal(com(cls,8,[0,out+8]),0);assert.equal(com(cls,14,[read(out+8),out+12]),0);com(read(out+12),2);com(cls,2);
 assert.equal(com(standard,4,[10,out+4]),0);const alias=read(out+4);assert.equal(com(alias,3,[out+8]),0);assert.equal(read(read(out+8)+40),6);com(alias,19,[read(out+8)]);com(alias,2);com(standard,2);
 assert.equal(vfs.files.has('c:\\windows\\system\\oleaut32.dll'),false);assert.equal(vfs.files.has('c:\\windows\\system\\stdole32.tlb'),false);
 console.log(JSON.stringify({status:'PASS',nativeGuestVtables:true,nativeInvokeResult:42,modulePath,moduleSHA256:sha(wasm),mappedFiles:[...vfs.files.keys()]}));
 if(process.argv.includes('--clients'))await nativeClientMatrix(wasm);
}
if(process.argv.includes('--native'))nativeABI().catch(e=>{console.error(e);process.exitCode=1;});

// Existing Sims fixture clients run as complete guest programs through ordinary
// imports, with no genuine Automation runtime providers present in the VFS.
async function nativeClientMatrix(wasm){
 const {createHostImports}=require('../lib/host-imports'),{VirtualFS}=require('../lib/filesystem');
 const dir=fs.mkdtempSync('/dev/shm/typelib-clients-');
 try{
  require('./test-sims-typelib-native.cjs').prepare(dir);
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),module=new WebAssembly.Module(wasm),results=[];
  for(const name of ['client','standalone','resource-index','missing','stdole1','stdole2','stdole32','registered-standard']){
   new Uint8Array(memory.buffer).fill(0);
   const image=fs.readFileSync(dir+'/'+name+'.exe'),vfs=new VirtualFS();
   vfs.files.set('c:\\client.exe',{data:image,attrs:0x20});vfs.files.set('c:\\typelib.dat',{data:sims.data,attrs:0x20});
   let exit=null;const ctx={getMemory:()=>memory.buffer,renderer:null,vfs,resourceJson:{},apiTable:require('../src/api_table.json'),onExit:c=>{exit=c>>>0;}};
   const imports=createHostImports(ctx);Object.assign(imports.host,{memory,create_thread:()=>0,exit_thread:()=>0,terminate_thread:()=>0,create_event:()=>0,set_event:()=>0,reset_event:()=>0,wait_single:()=>0,wait_multiple:()=>0,com_create_instance:()=>0x80004002});
   const instance=new WebAssembly.Instance(module,imports),w=instance.exports;ctx.exports=w;
   new Uint8Array(memory.buffer).set(image,w.get_staging());assert(w.load_pe(image.length));
   new Uint8Array(memory.buffer).set(Buffer.from('client.exe'),w.get_staging());w.set_exe_name(w.get_staging(),10);
   for(let i=0;i<1000&&exit===null;i++)w.run(10000);
   assert.equal(exit,0,'Sims complete guest client '+name);results.push({name,sha256:sha(image),exit});
  }
  console.log(JSON.stringify({simsClientMatrix:'PASS',moduleSHA256:sha(wasm),results}));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
