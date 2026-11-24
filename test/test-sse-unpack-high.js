'use strict';
// Intel SDM Vol.2B UNPCKHPS pp.4-738..741:
// https://cdrdv2-public.intel.com/671110/325383-sdm-vol-2abcd.pdf
// Legacy NP 0F15: raw bits [oldDest2,src2,oldDest3,src3], no FP arithmetic.
// m128 requires alignment16 and normal segment checks; legal fixtures only.
// Existing UNPCKLPS generic handler lacks explicit alignment faults. This test
// does not endorse unaligned acceptance or claim full protected segment limits.
const fs = require('fs'), crypto = require('crypto'), assert = require('assert/strict');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const le = x => [x & 255, x >>> 8 & 255, x >>> 16 & 255, x >>> 24];
// Literal [destination, source, high result, self-high result].
const vectors = [
 [[0x11111111,0x22222222,0x33333333,0x44444444],[0x55555555,0x66666666,0x77777777,0x88888888],
  [0x33333333,0x77777777,0x44444444,0x88888888],[0x33333333,0x33333333,0x44444444,0x44444444]],
 [[0x00000000,0x80000000,0x7fc12345,0xff812345],[0x7f800000,0xff800000,0x7f812346,0xffc54321],
  [0x7fc12345,0x7f812346,0xff812345,0xffc54321],[0x7fc12345,0x7fc12345,0xff812345,0xff812345]],
 [[0x7fffffff,0xffffffff,0x00000000,0x80000000],[0xdeadbeef,0x01234567,0x80000001,0x00000001],
  [0x00000000,0x80000001,0x80000000,0x00000001],[0x00000000,0x00000000,0x80000000,0x80000000]],
 [[0x00000001,0x80000001,0x7f800000,0xff800000],[0x00800000,0x80800000,0x7f7fffff,0xff7fffff],
  [0x7f800000,0x7f7fffff,0xff800000,0xff7fffff],[0x7f800000,0x7f800000,0xff800000,0xff800000]],
];
const all = [];
for (const opcode of [0x15,0x14,0x16,0xc6])
for (const form of ['rr','rm-direct','ro-direct','sib-direct','fs-direct','rm-sparse','ro-sparse','sib-sparse','fs-sparse','rm-direct-edge','rm-sparse-edge'])
for (let row=0;row<vectors.length;row++) for(let dst=0;dst<8;dst++)
for(let src=0;src<(form==='rr'?8:1);src++) {
 const [d,input,h,selfh]=vectors[row],self=form==='rr'&&src===dst,s=self?d:input;
 // Controls use independent architectural lane selection; high results above are literal.
 const want=opcode===0x15?(self?selfh:h):opcode===0x14?[d[0],s[0],d[1],s[1]]:
   opcode===0x16?[d[0],d[1],s[0],s[1]]:[d[3],d[2],s[1],s[0]];
 all.push({opcode,form,row,d,s,want,dst,src:form==='rr'?src:(dst+1)%8});
}
const seal={count:all.length,oracleSha256:sha(Buffer.from(JSON.stringify(all))),testSha256:sha(fs.readFileSync(__filename))};
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify(seal,null,2));console.log(seal);}
else main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
  const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||'build/wine-assembly.wasm');
  const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
  for(const i of WebAssembly.Module.imports(mod)){
    assert(['memory','function'].includes(i.kind));
    (imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;
  }
  const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
  const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));
  const g=a=>e.guest_to_wasm(a)>>>0,stack=0x1100000,out=0xc80000,a=0xc00000;
  const thunk=e.get_thunk_base()>>>0,tw=g(thunk),old=dv.getUint32(tw+4,true);
  dv.setUint32(tw+4,require('../src/api_table.json').find(x=>x.name==='VirtualAlloc').id,true);
  for(const [i,addr] of [0x30000000,0x31000000,0x30001000].entries()){
    const code=[0x6a,4,0x68,...le(0x3000),0x68,...le(4096),0x68,...le(addr),0xb8,...le(thunk),0xff,0xd0,0xc3],pc=0x480000+i*64;
    mem.set(code,g(pc));e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);e.run(10000);
    assert.equal(e.get_eax()>>>0,addr);assert.equal(e.get_eip(),0);
  }
  dv.setUint32(tw+4,old,true);assert.notEqual(g(0x30001000),g(0x30000000)+4096);
  e.set_fault_unmapped(2);
  const write=(addr,v)=>v.forEach((x,i)=>e.guest_write32(addr+4*i,x));
  const read=addr=>Array.from({length:4},(_,i)=>e.guest_read32(addr+4*i)>>>0);
  const snap=(addr,n)=>Buffer.from(Array.from({length:n},(_,i)=>mem[g(addr+i)]));
  const fill=(addr,n,x)=>{for(let i=0;i<n;i++)mem[g(addr+i)]=x;};
  const cache=new Map(),groups={},failures=[];let failed=0;
  for(const t of all){
    const edge=t.form.endsWith('edge'),sparse=t.form.includes('sparse');
    // An aligned m128 can end at a page boundary, never straddle it.
    const b=edge?(sparse?0x31000ff0:0xc01ff0):(sparse?0x30001000:0xc01010),seed=b;
    const rr=t.form==='rr',ro=t.form.startsWith('ro'),sib=t.form.startsWith('sib'),fs=t.form.startsWith('fs');
    e.set_fs_base(fs?b-0x100:0);
    const operand=rr?[0xc0|(t.dst<<3)|t.src]:ro?[0x43|(t.dst<<3),16]:sib?[0x44|(t.dst<<3),0xb3,16]:[5|(t.dst<<3),...le(fs?0x100:b)];
    const code=[0x0f,0x10,5|(t.dst<<3),...le(a),0x0f,0x10,5|(t.src<<3),...le(seed),
      0x68,...le(0xad7),0x9d,...(fs?[0x64]:[]),0x0f,t.opcode,...operand,...(t.opcode===0xc6?[0x1b]:[]),
      0x0f,0x11,5|(t.dst<<3),...le(out),0x0f,0x11,5|(t.src<<3),...le(out+16),
      0x9c,0x8f,5,...le(out+32),0xc3];
    const key=code.join(',');let pc=cache.get(key);
    if(pc===undefined){pc=0x1800000+cache.size*256;cache.set(key,pc);mem.set(code,g(pc));}
    fill(a-8,32,0x5a);fill(b-8,edge?24:32,0x6b);write(a,t.d);write(seed,t.s);
    const ag=snap(a-8,32),bg=snap(b-8,edge?24:32);fill(out-8,56,0x73);
    for(const [reg,val] of Object.entries({eax:0x12345678,ecx:0x23456789,edx:0x3456789a,edi:0x456789ab,ebp:0x56789abc}))e['set_'+reg](val);
    e.set_ebx(b-16-(sib?12:0));e.set_esi(3);e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);
    const issues=[];try{e.run(1000);}catch(err){issues.push('trap:'+err.message);}
    if(!issues.length){
      if(JSON.stringify(read(out))!==JSON.stringify(t.want))issues.push('destination');
      if(JSON.stringify(read(out+16))!==JSON.stringify(t.src===t.dst?t.want:t.s))issues.push('source-register');
      if((e.guest_read32(out+32)>>>0)!==0xad7)issues.push('flags');
      if(e.get_eip()!==0||(e.get_esp()>>>0)!==stack+4)issues.push('return-stack');
      if((e.get_ebx()>>>0)!==b-16-(sib?12:0)||e.get_esi()!==3)issues.push('address-registers');
      for(const [reg,val] of Object.entries({eax:0x12345678,ecx:0x23456789,edx:0x3456789a,edi:0x456789ab,ebp:0x56789abc}))if((e['get_'+reg]()>>>0)!==val)issues.push('gpr-'+reg);
      if(!snap(a-8,32).equals(ag)||!snap(b-8,edge?24:32).equals(bg))issues.push('input-guards');
      if(!snap(out-8,8).equals(Buffer.alloc(8,0x73))||!snap(out+36,12).equals(Buffer.alloc(12,0x73)))issues.push('output-guards');
    }
    const group=[t.opcode.toString(16),t.form].join('/');
    const result=groups[group]||={count:0,failed:0};result.count++;
    if(issues.length){failed++;result.failed++;if(failures.length<16)failures.push({t,issues,actual:read(out)});}
  }
  let rejected=0; const negativeFailures=[];
  for(const prefix of [[0x66],[0xf2],[0xf3],[0x66,0xf3],[0xf3,0x66],[0xf0],[0xf0,0xf3],[0xf3,0xf0],[0x66,0xf2]])
  for(const operand of [[0xc1],[5,...le(a)]]) {
    const pc=0x3800000+rejected*64;
    mem.set([...prefix,0x0f,0x15,...operand,0xc3],g(pc));
    e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);
    let trapped=false;try{e.run(1000);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}
    if(!trapped)negativeFailures.push({prefix,operand});rejected++;
  }
  const result={...seal,moduleSha256:sha(bytes),moduleSize:bytes.length,count:all.length,failed,groups,failures,rejected,negativeFailures,codeSites:cache.size,
    environment:'Node full production decoder; native or actual production trampoline supplied by WINE_ASSEMBLY_WASM',
    excluded:'Unaligned acceptance, full protected segment limits, Windows, gameplay and hardware claims'};
  if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));
  console.log(JSON.stringify({count:all.length,failed,groups,module:result.moduleSha256}));process.exitCode=failed||negativeFailures.length?1:0;
}

