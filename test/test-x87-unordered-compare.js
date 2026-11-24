'use strict';
// Intel SDM Vol.2A, FUCOM/FUCOMP/FUCOMPP and FCOM/FCOMP/FCOMPP:
// https://cdrdv2-public.intel.com/671200/325462-sdm-vol-1-2abcd-3abcd.pdf
// QNaN gives C3/C2/C0=111; only ordered forms add IE. C1 clears.
// Scope: this runtime's documented f64 quiet-NaN model, masked exceptions.
// No SNaN, extended precision, Windows or hardware reference claim.
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const path=require('path'),root=path.join(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const le=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24];
// Independent literal oracle: a bits, b bits, status condition bits, NaN.
const pairs=[
 ['3ff0000000000000','4000000000000000',0x0100,0],
 ['4000000000000000','4000000000000000',0x4000,0],
 ['4008000000000000','4000000000000000',0,0],
 ['0000000000000000','8000000000000000',0x4000,0],
 ['8000000000000000','0000000000000000',0x4000,0],
 ['7ff0000000000000','7ff0000000000000',0x4000,0],
 ['fff0000000000000','fff0000000000000',0x4000,0],
 ['fff0000000000000','7ff0000000000000',0x0100,0],
 ['7ff0000000000000','fff0000000000000',0,0],
 ['7ff0000000000000','4000000000000000',0,0],
 ['fff0000000000000','4000000000000000',0x0100,0],
 ['7ff8000000000001','4000000000000000',0x4500,1],
 ['4000000000000000','7ff8000000001234',0x4500,1],
 ['fff8abcdef012345','4000000000000000',0x4500,1],
 ['4000000000000000','fff8abcdef012345',0x4500,1],
 ['7fffffffffffffff','fff8abcdef012345',0x4500,1],
];
const forms=[];
for(const ordered of [false,true]){
 for(const pop of [0,1])for(const rm of [0,1,2,7])forms.push({ordered,pop,rm,op:[ordered?0xd8:0xdd,(ordered?0xd0:0xe0)+pop*8+rm]});
 forms.push({ordered,pop:2,rm:1,op:ordered?[0xde,0xd9]:[0xda,0xe9]});
}
const oracle={pairs,forms,statusSeeds:[0,0x4700,0x4540,0x47ff],flagSeeds:[0x202,0xed7],tops:[0,1,2,3,4,5,6,7],layouts:['split','fused']};
const oracleHash=sha(Buffer.from(JSON.stringify(oracle)));
assert.equal(oracleHash,'608f19fd315281c25e5ba013401b2331cfbf798dc9945e64cab06a4a073f0a1b','frozen independent literal oracle');
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify({oracle,sha256:oracleHash},null,2));console.log('FROZEN',oracleHash);}
else main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||path.join(root,'build/wine-assembly.wasm'));
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod)){assert(['memory','function'].includes(i.kind));(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;}
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
 const pe=fs.readFileSync(path.join(root,'test/binaries/notepad.exe'));mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const g=a=>e.guest_to_wasm(a)>>>0,stack=0x1100000,data=0xc80000,env=data+128,loaded=env+32,out=env+128;
 const mov=(a,v)=>[0xc6,5,...le(a),v];
 const setup=0x600000,init=[0xdb,0xe3,0xd9,0x25,...le(env)];
 for(let i=7;i>=0;i--)init.push(0xdd,5,...le(data+i*8));
 init.push(0xd9,0x25,...le(loaded),0xc3);mem.set(init,g(setup));
 const sites=[];
 for(const form of forms)for(const layout of oracle.layouts){
  const pc=0x610000+sites.length*512;
  const code=[0x68,...le(0x202),0x9d,...form.op,0x9c,0x8f,5,...le(out),0xdf,0xe0];
  // Replaced immediate before first decode to keep two literal flag seeds.
  // Each site has a separate immutable copy per seed below.
  if(layout==='split')code.push(0xa3,...le(out+4));
  code.push(0x9e,0x9c,0x8f,5,...le(out+8));
  for(const [i,cc] of [2,4,10].entries())code.push(0x70+cc,9,...mov(out+12+i,0),0xeb,7,...mov(out+12+i,1));
  code.push(0xd9,0x35,...le(out+32));
  for(let i=0;i<8-form.pop;i++)code.push(0xdd,0x1d,...le(out+64+i*8));
  code.push(0xc3);
  for(let seed=0;seed<2;seed++){const copy=code.slice();copy.splice(1,4,...le(oracle.flagSeeds[seed]));mem.set(copy,g(pc+seed*256));}
  sites.push({form,layout,pc});
 }
 const run=pc=>{e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);e.run(1000);assert.equal(e.get_eip(),0,'bounded guest return');assert.equal(e.get_esp(),stack+4,'guest stack balance');};
 let count=0,failed=0;const categories={},failures=[];
 for(const pair of pairs)for(const {form,layout,pc} of sites)for(const top of oracle.tops)for(const sw of oracle.statusSeeds)for(let seed=0;seed<2;seed++){
  const [a,b,cc,nan]=pair,values=Array.from({length:8},(_,i)=>(0x4040000000000000n+BigInt(i)*0x100000000000n).toString(16));
  values[0]=a;if(form.rm)values[form.rm]=b;
  for(let i=0;i<8;i++)dv.setBigUint64(g(data+i*8),BigInt('0x'+values[i]),true);
  mem.fill(0,g(env),g(env+64));dv.setUint32(g(env),0x37f,true);dv.setUint32(g(env+4),top<<11,true);dv.setUint32(g(env+8),0xffff,true);
  dv.setUint32(g(loaded),0x37f,true);dv.setUint32(g(loaded+4),(top<<11)|sw,true);
  mem.fill(0x6b,g(out-8),g(out+144));run(setup);run(pc+seed*256);
  const issues=[],condition=form.rm?cc:(a.includes('ff8')||a==='7fffffffffffffff'?0x4500:0x4000);
  const expectedSW=(sw&0xb8ff)|condition|(form.ordered&&(form.rm?nan:condition===0x4500)?1:0)|(((top+form.pop)&7)<<11);
  const actualSW=dv.getUint32(g(out+36),true),flags=dv.getUint32(g(out),true),after=dv.getUint32(g(out+8),true);
  if(actualSW!==expectedSW)issues.push('status');
  if(layout==='split'&&(dv.getUint32(g(out+4),true)&65535)!==expectedSW)issues.push('FNSTSW');
  if(flags!==oracle.flagSeeds[seed])issues.push('x87-changed-EFLAGS');
  const expectedFlags=(oracle.flagSeeds[seed]&~0xd5)|((expectedSW>>>8)&0xd5);
  if(after!==expectedFlags)issues.push('SAHF');
  for(const [i,bit] of [0x100,0x4000,0x400].entries())if(mem[g(out+12+i)]!==Number(!!(expectedSW&bit)))issues.push('Jcc'+i);
  let tags=0;for(let p=0;p<form.pop;p++)tags|=3<<(((top+p)&7)*2);
  if(dv.getUint32(g(out+40),true)!==tags)issues.push('tags');
  for(let i=form.pop;i<8;i++)if(dv.getBigUint64(g(out+64+(i-form.pop)*8),true)!==BigInt('0x'+values[i]))issues.push('sentinel'+i);
  if(!mem.slice(g(out-8),g(out)).every(v=>v===0x6b)||!mem.slice(g(out+128),g(out+144)).every(v=>v===0x6b))issues.push('guards');
  count++;if(issues.length){failed++;for(const x of issues)categories[x]=(categories[x]||0)+1;if(failures.length<16)failures.push({pair,form,layout,top,sw,seed,actualSW,expectedSW,flags,after,expectedFlags,issues});}
 }
 const result={count,failed,categories,failures,oracleSha256:oracleHash,moduleSha256:sha(bytes),moduleSize:bytes.length,route:'full production decoder; actual FNSTSW/SAHF/Jcc, FLDENV/FNSTENV tags and sentinel drains'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=failed?1:0;
}
