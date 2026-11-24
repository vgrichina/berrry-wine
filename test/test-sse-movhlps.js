'use strict';

// Intel SDM Vol.2B, MOVHLPS, pp.4-81/82 (legacy NP 0F12, ModRM.mod=3):
// https://cdrdv2-public.intel.com/671110/325383-sdm-vol-2abcd.pdf
// The expected MOVHLPS bits below are literal, frozen before implementation.
// No float conversion, host SIMD, emulator helper, or Windows/Wine oracle.
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert/strict');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const le = x => [x & 255, x >>> 8 & 255, x >>> 16 & 255, x >>> 24];
// [old destination, old source, distinct-register result, self-alias result].
const vectors = [
  [[0x11111111,0x22222222,0x33333333,0x44444444], [0x55555555,0x66666666,0x77777777,0x88888888],
   [0x77777777,0x88888888,0x33333333,0x44444444], [0x33333333,0x44444444,0x33333333,0x44444444]],
  [[0x7fc12345,0xffc54321,0x80000000,0x00000000], [0x3f800000,0xbf800000,0x7f800000,0xff800000],
   [0x7f800000,0xff800000,0x80000000,0x00000000], [0x80000000,0x00000000,0x80000000,0x00000000]],
  [[0x00000000,0x80000000,0x7fcabcde,0xffc13579], [0x7f800000,0xff800000,0x7f812345,0xff812346],
   [0x7f812345,0xff812346,0x7fcabcde,0xffc13579], [0x7fcabcde,0xffc13579,0x7fcabcde,0xffc13579]],
  [[0x7f800000,0xff800000,0x00000001,0x80000001], [0x7fffffff,0xffffffff,0x00000000,0x80000000],
   [0x00000000,0x80000000,0x00000001,0x80000001], [0x00000001,0x80000001,0x00000001,0x80000001]],
  [[0xdeadbeef,0x01234567,0x7f812345,0xff812346], [0x76543210,0x89abcdef,0x7fc00001,0xffc00002],
   [0x7fc00001,0xffc00002,0x7f812345,0xff812346], [0x7f812345,0xff812346,0x7f812345,0xff812346]],
  [[0xffffffff,0x00000000,0xaaaaaaaa,0x55555555], [0x11111111,0x99999999,0x13579bdf,0x2468ace0],
   [0x13579bdf,0x2468ace0,0xaaaaaaaa,0x55555555], [0xaaaaaaaa,0x55555555,0xaaaaaaaa,0x55555555]],
  [[0x00800000,0x80800000,0x7f7fffff,0xff7fffff], [0x007fffff,0x807fffff,0x00000001,0x80000001],
   [0x00000001,0x80000001,0x7f7fffff,0xff7fffff], [0x7f7fffff,0xff7fffff,0x7f7fffff,0xff7fffff]],
  [[0x3f800000,0xbf800000,0x40000000,0xc0000000], [0x40400000,0xc0400000,0x40800000,0xc0800000],
   [0x40800000,0xc0800000,0x40000000,0xc0000000], [0x40000000,0xc0000000,0x40000000,0xc0000000]],
];
const seal = {oracleSha256:sha(JSON.stringify(vectors)),testSha256:sha(fs.readFileSync(__filename))};
if (process.env.FREEZE_ONLY) {
  fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify(seal,null,2));
  console.log(seal);
} else main().catch(err => { console.error(err); process.exitCode=1; });

async function main() {
  const bytes = process.env.WINE_ASSEMBLY_WASM
    ? fs.readFileSync(process.env.WINE_ASSEMBLY_WASM) : require('./compile-src').compileSrcWasm();
  const mod=await WebAssembly.compile(bytes);
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
  for(const i of WebAssembly.Module.imports(mod)) {
    assert(['memory','function'].includes(i.kind));
    (imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;
  }
  const e=(await WebAssembly.instantiate(mod,imports)).exports;
  const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),g=a=>e.guest_to_wasm(a)>>>0;
  const pe=fs.readFileSync('test/binaries/notepad.exe'); mem.set(pe,e.get_staging()); assert(e.load_pe(pe.length));
  const stack=0x1100000,input=0xc00003,out=0xc80003;
  const thunk=e.get_thunk_base()>>>0,tw=g(thunk),old=dv.getUint32(tw+4,true);
  dv.setUint32(tw+4,require('../src/api_table.json').find(x=>x.name==='VirtualAlloc').id,true);
  for(const [i,addr] of [0x30000000,0x31000000,0x30001000].entries()) {
    const code=[0x6a,4,0x68,...le(0x3000),0x68,...le(4096),0x68,...le(addr),0xb8,...le(thunk),0xff,0xd0,0xc3];
    mem.set(code,g(0x480000+i*64)); e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(0x480000+i*64);e.run(10000);
    assert.equal(e.get_eax()>>>0,addr);assert.equal(e.get_eip(),0);
  }
  dv.setUint32(tw+4,old,true);assert.notEqual(g(0x30001000),g(0x30000000)+4096);
  e.set_fault_unmapped(2);
  const read=(a,n)=>Array.from({length:n},(_,i)=>e.guest_read32(a+4*i)>>>0);
  const write=(a,v)=>v.forEach((x,i)=>e.guest_write32(a+4*i,x));
  const fill=(a,n,x)=>{for(let i=0;i<n;i++)mem[g(a+i)]=x;};
  const snap=(a,n)=>Buffer.from(Array.from({length:n},(_,i)=>mem[g(a+i)]));
  const groups={},failures=[],sites=new Map();let failed=0,count=0;
  const gprs={eax:0x71000000,ecx:0x72000000,edx:0x73000000,ebx:0x74000000,ebp:0x75000000,esi:0x76000000,edi:0x77000000};
  function execute({label,row,dst,src,opcode=0x12,repeats=1,b=null,store=false,form='abs',pcOverride=null,patch=false}) {
    const [d,s,distinct,self]=vectors[row], rr=b===null;
    const initial=Array.from({length:8},(_,i)=>vectors[i][0].slice());initial[dst]=d.slice();
    if(rr&&src!==dst)initial[src]=s.slice();
    const source=rr?initial[src]:s;
    let want=initial.map(v=>v.slice());
    if(!store) want[dst]=opcode===0x12 ? (rr?(dst===src?self:distinct):[s[0],s[1],d[2],d[3]])
      : opcode===0x16?[d[0],d[1],source[0],source[1]]
      : opcode===0x14?[d[0],source[0],d[1],source[1]]:[d[2],source[2],d[3],source[3]];
    const operand=rr?[0xc0|dst<<3|src]:form==='disp'?[0x43|dst<<3,16]
      :form==='sib'?[0x44|dst<<3,0xb3,16]:[5|dst<<3,...le(b)];
    const setup=initial.flatMap((_,i)=>[0x0f,0x10,5|i<<3,...le(input+16*i)]);
    const instruction=[0x0f,opcode,...operand];
    const code=[...setup,0x68,...le(0xad7),0x9d,...Array.from({length:repeats},()=>instruction).flat(),
      ...initial.flatMap((_,i)=>[0x0f,0x11,5|i<<3,...le(out+16*i)]),0x9c,0x8f,5,...le(out+128),0xc3];
    const key=code.join(',');let pc=pcOverride??sites.get(key);
    if(pc===undefined){pc=0x1800000+sites.size*512;sites.set(key,pc);mem.set(code,g(pc));}
    else if(patch) code.forEach((x,i)=>e.guest_write8(pc+i,x));
    fill(input-8,144,0x5a);initial.forEach((v,i)=>write(input+16*i,v));
    const inputGuard=snap(input-8,144);fill(out-8,152,0x73);
    let memoryGuard;
    const edge=b!==null&&b===0x31000ff8,n=edge?16:24;
    if(b!==null){fill(b-8,n,0x6b);write(b,s.slice(0,2));memoryGuard=snap(b-8,n);}
    for(const [reg,val] of Object.entries(gprs))e['set_'+reg](val);
    if(!rr){e.set_ebx(b-16-(form==='sib'?12:0));e.set_esi(3);}
    e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);
    const issues=[];try{e.run(10000);}catch(err){issues.push('trap:'+err.message);}
    if(!issues.length) {
      if(JSON.stringify(read(out,32))!==JSON.stringify(want.flat()))issues.push('all-XMM-bits');
      if((e.guest_read32(out+128)>>>0)!==0xad7)issues.push('flags');
      if(e.get_eip()!==0||(e.get_esp()>>>0)!==stack+4)issues.push('return-stack');
      for(const [reg,val] of Object.entries(gprs)) {
        const expected=!rr&&reg==='ebx'?b-16-(form==='sib'?12:0):!rr&&reg==='esi'?3:val;
        if((e['get_'+reg]()>>>0)!==expected)issues.push('gpr-'+reg);
      }
      if(!snap(input-8,144).equals(inputGuard))issues.push('input-guards');
      if(!snap(out-8,8).equals(Buffer.alloc(8,0x73))||!snap(out+132,12).equals(Buffer.alloc(12,0x73)))issues.push('output-guards');
      if(b!==null){
        const expected=Buffer.from(memoryGuard);if(store)d.slice(0,2).forEach((x,i)=>expected.writeUInt32LE(x,8+4*i));
        if(!snap(b-8,n).equals(expected))issues.push('memory-exact64-guards');
      }
    }
    const group=groups[label]||={count:0,failed:0};group.count++;count++;
    if(issues.length){group.failed++;failed++;if(failures.length<24)failures.push({label,row,dst,src,opcode,repeats,b,issues,actual:read(out+16*dst,4),want:want[dst]});}
  }
  // Identical instruction sites get different literal data, then execute cached.
  for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)
  for(const repeats of [1,2,7])for(let cached=0;cached<2;cached++)
    execute({label:'MOVHLPS/'+(dst===src?'self':'distinct')+'/'+(cached?'cached':'first'),row,dst,src,repeats});
  for(const [opcode,label] of [[0x16,'MOVLHPS'],[0x14,'UNPCKLPS'],[0x15,'UNPCKHPS']])
  for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)execute({label,row,dst,src,opcode});
  for(const [b,form] of [[0xc01003,'abs'],[0xc01007,'disp'],[0xc0100f,'sib'],
    ...Array.from({length:7},(_,i)=>[0x30000ff9+i,'abs']),[0x31000ff8,'abs']])
  for(const store of [false,true])for(let row=0;row<vectors.length;row++)for(let dst=0;dst<8;dst++)
    execute({label:'MOVLPS/'+(store?'store':'load')+'/'+form+'/'+b.toString(16),row,dst,src:0,b,store,form,opcode:store?0x13:0x12});
  // Rewrite the same decoded instruction through the public code-write path.
  for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(let cached=0;cached<2;cached++)
    execute({label:'MOVHLPS/codewrite',row:(dst+src)%8,dst,src,pcOverride:0x3700000,patch:!cached});
  let rejected=0;const negativeFailures=[];
  for(const prefix of [[0x66],[0xf2],[0xf3],[0xf0],[0x66,0xf3],[0xf3,0x66],[0xf0,0xf3],[0xf3,0xf0]])
  for(const opcode of [0x12,0x13])for(const operand of [[0xc1],[5,...le(input)]])negative(prefix,opcode,operand);
  for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)negative([],0x13,[0xc0|dst<<3|src]);
  function negative(prefix,opcode,operand) {
    const pc=0x3800000+rejected++*64;mem.set([...prefix,0x0f,opcode,...operand,0xc3],g(pc));
    e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);
    let trapped=false;try{e.run(1000);}catch(err){trapped=err instanceof WebAssembly.RuntimeError;}
    if(!trapped)negativeFailures.push({prefix,opcode,operand});
  }
  const result={...seal,moduleSha256:sha(bytes),moduleSize:bytes.length,count,failed,groups,failures,rejected,negativeFailures,codeSites:sites.size,
    environment:'Node full decoder; native or actual production trampoline module supplied by WINE_ASSEMBLY_WASM',
    excluded:'MXCSR exceptions/status; AVX/SSE2 additions; Windows, hardware and gameplay claims'};
  if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));
  console.log(JSON.stringify({count,failed,groups,rejected,negativeFailures,module:result.moduleSha256}));
  process.exitCode=failed||negativeFailures.length?1:0;
}
