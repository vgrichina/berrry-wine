'use strict';
const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto'),vectors=[
{"id":"half-even","bits":"4004000000000000","want":["2","2","3","2"],"c1":[0,0,1,0],"pe":[1,1,1,1]},
{"id":"negative-half-even","bits":"c004000000000000","want":["-2","-3","-2","-2"],"c1":[0,1,0,0],"pe":[1,1,1,1]},
{"id":"half-odd","bits":"3ff8000000000000","want":["2","1","2","1"],"c1":[1,0,1,0],"pe":[1,1,1,1]},
{"id":"negative-half-odd","bits":"bff8000000000000","want":["-2","-2","-1","-1"],"c1":[1,1,0,0],"pe":[1,1,1,1]},
{"id":"positive-half","bits":"3fe0000000000000","want":["0","0","1","0"],"c1":[0,0,1,0],"pe":[1,1,1,1]},
{"id":"negative-half","bits":"bfe0000000000000","want":["0","-1","0","0"],"c1":[0,1,0,0],"pe":[1,1,1,1]},
{"id":"i16-upper-half","bits":"40dfffe000000000","width":16,"want":[null,"32767",null,"32767"],"c1":[0,0,0,0],"pe":[0,1,0,1]},
{"id":"i16-lower-half","bits":"c0e0001000000000","width":16,"want":["-32768",null,"-32768","-32768"],"c1":[0,0,0,0],"pe":[1,0,1,1]},
{"id":"i32-upper-half","bits":"41dfffffffe00000","width":32,"want":[null,"2147483647",null,"2147483647"],"c1":[0,0,0,0],"pe":[0,1,0,1]},
{"id":"i32-lower-half","bits":"c1e0000000100000","width":32,"want":["-2147483648",null,"-2147483648","-2147483648"],"c1":[0,0,0,0],"pe":[1,0,1,1]},
{"id":"i64-f64-upper-valid","bits":"43dfffffffffffff","width":64,"want":["9223372036854774784","9223372036854774784","9223372036854774784","9223372036854774784"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"i64-f64-overflow","bits":"43e0000000000000","width":64,"want":[null,null,null,null],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"invalid-7ff0000000000000","bits":"7ff0000000000000","want":[null,null,null,null],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"invalid-fff0000000000000","bits":"fff0000000000000","want":[null,null,null,null],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"invalid-7ff8000000000001","bits":"7ff8000000000001","want":[null,null,null,null],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"m80-above-half","mant":"a000000000000001","se":16384,"want":["3","2","3","2"],"c1":[1,0,1,0],"pe":[1,1,1,1]},
{"id":"m80-negative-above-half-magnitude","mant":"a000000000000001","se":49152,"want":["-3","-3","-2","-2"],"c1":[1,1,0,0],"pe":[1,1,1,1]},
{"id":"m80-below-odd-half","mant":"bfffffffffffffff","se":16383,"want":["1","1","2","1"],"c1":[0,0,1,0],"pe":[1,1,1,1]},
{"id":"m80-i64-upper-half","mant":"ffffffffffffffff","se":16445,"width":64,"want":[null,"9223372036854775807",null,"9223372036854775807"],"c1":[0,0,0,0],"pe":[0,1,0,1]},
{"id":"m80-i64-negative-upper-half","mant":"ffffffffffffffff","se":49213,"width":64,"want":["-9223372036854775808","-9223372036854775808","-9223372036854775807","-9223372036854775807"],"c1":[1,1,0,0],"pe":[1,1,1,1]},
{"id":"fild-9007199254740993","kind":"fild","integer":"9007199254740993","width":64,"want":["9007199254740993","9007199254740993","9007199254740993","9007199254740993"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"fild-image-9007199254740993","kind":"fild-image","integer":"9007199254740993","width":64,"want":["9007199254740993","9007199254740993","9007199254740993","9007199254740993"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"fild--9007199254740995","kind":"fild","integer":"-9007199254740995","width":64,"want":["-9007199254740995","-9007199254740995","-9007199254740995","-9007199254740995"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"fild-image--9007199254740995","kind":"fild-image","integer":"-9007199254740995","width":64,"want":["-9007199254740995","-9007199254740995","-9007199254740995","-9007199254740995"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"fild-9223372036854775807","kind":"fild","integer":"9223372036854775807","width":64,"want":["9223372036854775807","9223372036854775807","9223372036854775807","9223372036854775807"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"fild-image-9223372036854775807","kind":"fild-image","integer":"9223372036854775807","width":64,"want":["9223372036854775807","9223372036854775807","9223372036854775807","9223372036854775807"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"fild--9223372036854775808","kind":"fild","integer":"-9223372036854775808","width":64,"want":["-9223372036854775808","-9223372036854775808","-9223372036854775808","-9223372036854775808"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"fild-image--9223372036854775808","kind":"fild-image","integer":"-9223372036854775808","width":64,"want":["-9223372036854775808","-9223372036854775808","-9223372036854775808","-9223372036854775808"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"quarter","bits":"4002000000000000","want":["2","2","3","2"],"c1":[0,0,1,0],"pe":[1,1,1,1]},
{"id":"negative-quarter","bits":"c002000000000000","want":["-2","-3","-2","-2"],"c1":[0,1,0,0],"pe":[1,1,1,1]},
{"id":"three-quarters","bits":"4006000000000000","want":["3","2","3","2"],"c1":[1,0,1,0],"pe":[1,1,1,1]},
{"id":"negative-three-quarters","bits":"c006000000000000","want":["-3","-3","-2","-2"],"c1":[1,1,0,0],"pe":[1,1,1,1]},
{"id":"tiny-positive","bits":"3c90000000000000","want":["0","0","1","0"],"c1":[0,0,1,0],"pe":[1,1,1,1]},
{"id":"tiny-negative","bits":"bc90000000000000","want":["0","-1","0","0"],"c1":[0,1,0,0],"pe":[1,1,1,1]},
{"id":"exact-two","bits":"4000000000000000","want":["2","2","2","2"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"positive-zero","bits":"0000000000000000","want":["0","0","0","0"],"c1":[0,0,0,0],"pe":[0,0,0,0]},
{"id":"negative-zero","bits":"8000000000000000","want":["0","0","0","0"],"c1":[0,0,0,0],"pe":[0,0,0,0]}
];
const forms=[{name:'FIST16',op:0xdf,m:0x15,size:2,pop:0},{name:'FISTP16',op:0xdf,m:0x1d,size:2,pop:1},{name:'FIST32',op:0xdb,m:0x15,size:4,pop:0},{name:'FISTP32',op:0xdb,m:0x1d,size:4,pop:1},{name:'FISTP64',op:0xdf,m:0x3d,size:8,pop:1}];
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
async function main(){
 const [file=process.env.WINE_ASSEMBLY_WASM || 'build/wine-assembly.wasm',regionFile,out]=process.argv.slice(2),bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
 const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);e.set_esp(0x1108000);
 const regions=(regionFile?JSON.parse(fs.readFileSync(regionFile)):require('../tools/region-layout').layout().regions),base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META');
 const input=0xc02000,outAddr=0xc03000,cwp=0xc04000,env=0xc05000,imageAddr=0xc06000,swp=0xc07000;let pc=0x1820000;
 function exec(b,at){if(at===undefined){at=pc;pc+=256;mem.set([...b,0xeb,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);return at;}
 function init(rc){exec([0xdb,0xe3]);[0x37f|(rc<<10),3<<11,0xffff,0,0,0,0].forEach((v,i)=>e.guest_write32(env+i*4,v));exec([0xd9,0x25,...le(env)]);}
 function state(){const mant=Array.from({length:8},(_,i)=>BigInt.asUintN(64,e.get_mmx(i)).toString(16));return {top:e.get_fpu_top(),tags:e.get_fpu_tags(),fp:Buffer.from(mem.slice(fp,fp+128)).toString('hex'),meta:Buffer.from(mem.slice(meta,meta+32)).toString('hex'),mant};}
 let rows=[];
 for(const v of vectors)for(const f of forms.filter(f=>!v.width||v.width===f.size*8))for(let rc=0;rc<4;rc++){
  const at=pc;pc+=256;mem.set([f.op,f.m,...le(outAddr),0xeb,0],g(at));
  for(const seed of [0,0x23f])for(let repeat=0;repeat<2;repeat++){
   init(rc);
   if(v.bits){dv.setBigUint64(g(input),BigInt('0x'+v.bits),true);exec([0xdd,0x05,...le(input)]);}
   else if(v.mant){dv.setBigUint64(g(input),BigInt('0x'+v.mant),true);dv.setUint16(g(input)+8,v.se,true);exec([0xdb,0x2d,...le(input)]);}
   else {dv.setBigInt64(g(input),BigInt(v.integer),true);exec([0xdf,0x2d,...le(input)]);if(v.kind==='fild-image'){exec([0xdb,0x3d,...le(imageAddr)]);exec([0xdb,0x2d,...le(imageAddr)]);}}
   // Seed flags after source load so FLD cannot determine C1 for the operation.
   exec([0xd9,0x35,...le(env)]);
   dv.setUint16(g(env)+4,(2<<11)|seed,true);exec([0xd9,0x25,...le(env)]);
   const before=state();
   const sourceImage={mant:before.mant[2],se:dv.getUint16(meta+4,true)};
   if(v.mant){a.equal(sourceImage.mant,BigInt('0x'+v.mant).toString(16));a.equal(sourceImage.se,v.se);}
   mem.fill(0xa5,g(outAddr)-8,g(outAddr)+16);const compiled=e.get_page_compiles(),hits=e.get_page_hits(),stores=e.get_cache_stores(),alloc=e.get_thread_alloc();exec(null,at);const cache={compileDelta:e.get_page_compiles()-compiled,hitDelta:e.get_page_hits()-hits,storeDelta:e.get_cache_stores()-stores,allocationDelta:e.get_thread_alloc()-alloc};const after=state();exec([0xdd,0x3d,...le(swp)]);const sw=dv.getUint16(g(swp),true),got=BigInt.asIntN(f.size*8,f.size===8?dv.getBigUint64(g(outAddr),true):BigInt(f.size===4?dv.getUint32(g(outAddr),true):dv.getUint16(g(outAddr),true))).toString(),want=v.want[rc]??(-(1n<<BigInt(f.size*8-1))).toString();
   const checks={cached:cache.storeDelta===(seed===0&&repeat===0?1:0),integer:got===want,IE:(sw&1)===((seed&1)|(v.want[rc]===null?1:0)),PE:(sw&32)===((seed&32)|(v.pe[rc]?32:0)),C1:((sw>>>9)&1)===v.c1[rc],sticky:(sw&0x1e)===(seed&0x1e),ES:(sw&0x80)===0,top:after.top===((2+f.pop)&7),tags:after.tags===(f.pop?0:4),prefix:mem.slice(g(outAddr)-8,g(outAddr)).every(x=>x===0xa5),suffix:mem.slice(g(outAddr)+f.size,g(outAddr)+16).every(x=>x===0xa5),image:before.meta===after.meta&&JSON.stringify(before.mant)===JSON.stringify(after.mant)};
   rows.push({vector:v.id,form:f.name,rc,repeat,seed,cache,expected:{pe:v.pe[rc],c1:v.c1[rc]},source:v,sourceImage,got,want,sw,checks,pass:Object.values(checks).every(Boolean)});
  }
 }


 for(const f of forms)for(const kind of ['fraction','exact','invalid',...(f.size===8?['shadow']:[])])for(const seed of [0,0x23f])for(const redirected of [false,true]){
  init(seed?0:2);
  if(kind==='shadow'){dv.setBigInt64(g(input),9007199254740993n,true);exec([0xdf,0x2d,...le(input)]);}
  else{dv.setBigUint64(g(input),kind==='invalid'?0x7ff8000000000001n:kind==='exact'?0x4000000000000000n:0x4004000000000000n,true);exec([0xdd,0x05,...le(input)]);}
  e.set_fs_base(env+256);e.guest_write32(env+256,-1);
  const page=0xe5200000+rows.filter(r=>r.vector==='store-fault').length*0x10000;
  a(e.test_virtual_map_commit(page,4096));const dst=redirected?page+4096:page+4096-(f.size-1);
  exec([0xd9,0x35,...le(env)]);dv.setUint16(g(env)+4,(2<<11)|seed,true);exec([0xd9,0x25,...le(env)]);
  exec([0xdd,0x3d,...le(swp)]);const beforeSW=dv.getUint16(g(swp),true);
  const before=state();let trapped=false;e.set_fault_unmapped(redirected?3:2);
  try{exec([f.op,f.m,...le(dst)]);}catch(error){a(error instanceof WebAssembly.RuntimeError);trapped=true;}
  const faultYield=e.get_yield_reason(),faultEIP=e.get_eip(),after=state();
  exec([0xdd,0x3d,...le(swp)]);const afterSW=dv.getUint16(g(swp),true);
  const checks={status:afterSW===beforeSW,fault:redirected?faultYield===2&&faultEIP===0:trapped,top:after.top===before.top,tags:after.tags===before.tags,image:after.meta===before.meta&&JSON.stringify(after.mant)===JSON.stringify(before.mant),fp:after.fp===before.fp};
  rows.push({vector:'store-fault',form:f.name,kind,seed,redirected,beforeSW,afterSW,faultYield,faultEIP,trapped,checks,pass:Object.values(checks).every(Boolean)});e.set_fault_unmapped(2);
 }

 const r={module:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cases:rows.length,failures:rows.filter(r=>!r.pass).length,firstFailure:rows.find(r=>!r.pass),rows};if(out)fs.writeFileSync(out,JSON.stringify(r,null,2));console.log(JSON.stringify({cases:r.cases,failures:r.failures,firstFailure:r.firstFailure}));if(r.failures)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=2;});
