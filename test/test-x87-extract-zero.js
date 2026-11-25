'use strict';
const fs=require('fs'),a=require('assert/strict'),crypto=require('crypto');
const vectors=[{id:'positive-zero',mant:'0000000000000000',se:0,sig:['0000000000000000',0],exp:['8000000000000000',65535]},{id:'negative-zero',mant:'0000000000000000',se:32768,sig:['0000000000000000',32768],exp:['8000000000000000',65535]}];
if(process.argv[2]==='--oracle'){fs.writeFileSync(process.argv[3],JSON.stringify({vectors,sticky:'old six OR04',C1:0,undefined:['C0','C2','C3'],order:['new ST0 signed zero','new ST1 negative infinity']},null,2));process.exit(0);}
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
async function main(){
 const [file='build/wine-assembly.wasm',regionFile,out]=process.argv.slice(2),bytes=fs.readFileSync(file),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='math_log2'?Math.log2:i.name==='math_pow2'?x=>2**x:()=>0;
 const e=new WebAssembly.Instance(mod,imports).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=x=>e.guest_to_wasm(x)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());a(e.load_pe(pe.length));e.set_fault_unmapped(2);e.set_uop(0);e.set_esp(0x1108000);
 const regions=(regionFile?JSON.parse(fs.readFileSync(regionFile)):require('../tools/region-layout').layout().regions),base=n=>regions.find(r=>r.name==='$'+n).base,fp=base('FPU_FILE'),meta=base('FPU_IMAGE_META'),mmxDecl=fs.readFileSync('src/01-header.wat','utf8').match(/\(global \$MMX_FILE i32 \(region\.addr \$(\w+) (0x[0-9a-f]+)\)\)/),mmx=base(mmxDecl[1])+Number(mmxDecl[2]);
 const input=0xc02000,env=0xc05000,swp=0xc07000;let pc=0x1820000;
 function exec(b,at){if(at===undefined){at=pc;pc+=128;mem.set([...b,0xeb,0],g(at));}e.clear_yield();e.set_eip(at);e.run(1);return at;}
 function load(m,se){dv.setBigUint64(g(input),BigInt('0x'+m),true);dv.setUint16(g(input)+8,se,true);exec([0xdb,0x2d,...le(input)]);}
 function state(){return {top:e.get_fpu_top(),tags:e.get_fpu_tags(),fp:Buffer.from(mem.slice(fp,fp+128)).toString('hex'),meta:Buffer.from(mem.slice(meta,meta+32)).toString('hex'),images:Array.from({length:8},(_,i)=>[dv.getBigUint64(mmx+i*8,true).toString(16).padStart(16,'0'),dv.getUint16(meta+2*i,true)])};}
 const regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
 const rows=[];
 for(const top of [2,5])for(const v of vectors)for(const precision of [0,2,3])for(let rc=0;rc<4;rc++){
  const at=pc;pc+=128;mem.set([0xd9,0xf4,0xeb,0],g(at));
  for(const seed of [0,0x23f])for(let repeat=0;repeat<2;repeat++){
   exec([0xdb,0xe3]);for(let p=0;p<8;p++)dv.setBigUint64(fp+64+p*8,0x1122334455667700n+BigInt(p),true);[0x7f|(precision<<8)|(rc<<10),((top+7)&7)<<11,0xffff,0,0,0,0].forEach((x,i)=>e.guest_write32(env+i*4,x));exec([0xd9,0x25,...le(env)]);
   // Six occupied untouched neighbors plus source; the push destination is empty.
   for(let i=0;i<6;i++)load((0x9000000000000001n+BigInt(i)).toString(16),16400+i);
   exec([0xd9,0x35,...le(env)]);dv.setUint16(g(env)+4,(((top+1)&7)<<11)|seed,true);exec([0xd9,0x25,...le(env)]);
   load(v.mant,v.se);exec([0x68,...le(0xed7),0x9d]);const gp=regs.map(r=>e['get_'+r]()),before=state(),q=(top+7)&7;a.equal(before.top,top);a.deepEqual(before.images[top],[v.mant,v.se]);a.equal(before.tags&(1<<q),0);
   const hits=e.get_page_hits(),stores=e.get_cache_stores();exec(null,at);const cache={hits:e.get_page_hits()-hits,stores:e.get_cache_stores()-stores},after=state(),afterGP=regs.map(r=>e['get_'+r]());exec([0xdd,0x3d,...le(swp)]);const sw=dv.getUint16(g(swp),true);
   exec([0xd9,0x35,...le(env+96)]);const cw=dv.getUint16(g(env+96),true);exec([0x9c,0x8f,5,...le(env+160)]);const cpuFlags=dv.getUint32(g(env+160),true);
   mem.fill(0xa5,g(input+48),g(input+104));const stored=[];for(let k=0;k<2;k++){exec([0xdb,0x3d,...le(input+64+k*16)]);stored.push([dv.getBigUint64(g(input+64+k*16),true).toString(16).padStart(16,'0'),dv.getUint16(g(input+72+k*16),true)]);}
   const afterStores=state();const storeBounds=mem.slice(g(input+48),g(input+104)).every((v,i)=>((i>=16&&i<26)||(i>=32&&i<42))||v===0xa5);
   const equal=(x,y)=>JSON.stringify(x)===JSON.stringify(y),checks={statusTOP:((sw>>>11)&7)===q,storePreservesImages:equal(afterStores.images,after.images),storePreservesFP:afterStores.fp===after.fp,storePreservesMeta:afterStores.meta===after.meta,storeTags:afterStores.tags===(before.tags&~(1<<top)),storeBounds,cw:cw===(0x7f|(precision<<8)|(rc<<10)),flags:cpuFlags===0xed7,gp:equal(gp,afterGP),imageValid:dv.getUint32(meta+16,true)===(Buffer.from(before.meta,'hex').readUInt32LE(16)|(1<<q)),sig:equal(after.images[q],v.sig),exponent:equal(after.images[top],v.exp),stores:equal(stored,[v.sig,v.exp]),pop:e.get_fpu_top()===((top+1)&7),top:after.top===q,tags:after.tags===(before.tags|(1<<q)),sticky:(sw&0xff)===((seed&0xff)|4),C1:(sw&0x200)===0,neighbors:after.images.every((x,i)=>i===top||i===q||equal(x,before.images[i])),neighborFP:Buffer.from(after.fp,'hex').every((x,i)=>[top,q].some(p=>i>=p*8&&i<p*8+8)||x===Buffer.from(before.fp,'hex')[i]),meta:Buffer.from(after.meta,'hex').every((x,i)=>i===16||[top,q].some(p=>i>=p*2&&i<p*2+2)||x===Buffer.from(before.meta,'hex')[i]),cached:cache.stores===(seed===0&&repeat===0?1:0)&&((seed===0&&repeat===0)||cache.hits===1)};
   rows.push({top,vector:v.id,precision,rc,seed,repeat,cache,before,after,afterStores,gp,afterGP,cw,cpuFlags,stored,storeBuffer:Buffer.from(mem.slice(g(input+48),g(input+104))).toString('hex'),got:[after.images[q],after.images[top]],want:[v.sig,v.exp],sw,checks,pass:Object.values(checks).every(Boolean)});
  }
 }
 const failureCounts={};for(const r of rows)for(const [k,v]of Object.entries(r.checks))if(!v)failureCounts[k]=(failureCounts[k]||0)+1;
 const result={module:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cases:rows.length,failures:rows.filter(r=>!r.pass).length,failureCounts,firstFailure:rows.find(r=>!r.pass),rows};if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,rows:undefined}));if(result.failures)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=2;});
