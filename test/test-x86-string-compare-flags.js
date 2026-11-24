'use strict';
// Real instruction bytes through the complete production decoder. Independent
// BigInt flags and literal traversal were frozen before baseline execution.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
function sub(bits,a,b){
 const M=2n**BigInt(bits),S=M/2n,A=BigInt(a),B=BigInt(b),R=(A-B+M)%M;
 const signed=x=>x>=S?x-M:x,wide=signed(A)-signed(B);
 let ones=0;for(let i=0n;i<8n;i++)ones+=Number(R>>i&1n);
 return 0x202|Number(A<B)|(Number(ones%2===0)<<2)|(Number(A%16n<B%16n)<<4)|(Number(R===0n)<<6)|(Number(R>=S)<<7)|(Number(wide< -S||wide>=S)<<11);
}
for(const [bits,a,b,flags] of [[8,0,1,0x297],[8,128,1,0xa12],[8,127,255,0xa83],[16,32768,1,0xa16],[32,0x80000000,1,0xa16],[8,255,255,0x246]])assert.equal(sub(bits,a,b),flags);
function cc(f){const c=!!(f&1),p=!!(f&4),z=!!(f&64),s=!!(f&128),o=!!(f&2048);return [o,!o,c,!c,z,!z,c||z,!c&&!z,s,!s,p,!p,s!==o,s===o,z||s!==o,!z&&s===o].map(Number);}
function cases(){
 const all=[];
 function add(bits,op,rep,df,count,a,b,stop,layout,seed,align){
  const width=bits/8,steps=rep==='single'?1:count===0?0:Math.min(count,stop);
  const A=Array(5).fill(a),B=Array(5).fill(b);
  // Multi traversal uses a literal first/middle/last stop; preceding elements
  // have the continuation relation, irrespective of input ZF.
  if(count===5&&rep!=='single')for(let i=0;i<5;i++){
   A[i]=a;B[i]=rep==='repe'?(i===stop-1?b:a):(i===stop-1?a:b);
  }
  const flags=(steps?sub(bits,A[steps-1],B[steps-1]):seed)|(df?1024:0);
  all.push({bits,op,rep,df,count,A,B,steps,layout,seed:seed|(df?1024:0),align,flags,cc:cc(flags)});
 }
 for(const bits of [8,16,32]){
  const M=2**bits,V=[0,1,7,8,15,16,17,M/2-1,M/2,M/2+1,M-2,M-1];
  for(const op of ['cmps','scas'])for(const rep of ['single','repe','repne'])for(const df of [0,1])for(const layout of ['dd','ss','ds','sd'])for(const seed of [0x202,0xad7]){
   for(const a of V)for(const b of V)for(const count of rep==='single'?[0,1,5]:[1])add(bits,op,rep,df,count,a,b,1,layout,seed,3);
   if(rep!=='single'){
    for(const align of [1,3,5])for(const stop of [1,3,5,6])for(const [a,b] of [[0,1],[M/2,M/2-1],[M-1,0],[15,16]])add(bits,op,rep,df,5,a,b,stop,layout,seed,align);
    for(const layout0 of [layout,'uu','ud','du'])add(bits,op,rep,df,0,M-1,0,0,layout0,seed,3);
   }
  }
 }
 return all;
}
// Literal traversal sanity separate from generated step rule.
const traversal=[['repe',[1,1,0,1,1],3,2],['repne',[0,0,1,0,0],3,2],['repe',[1,1,1,1,1],5,0],['repne',[0,0,0,0,0],5,0]];
for(const [rep,relations,n,left] of traversal){let i=0;for(const equal of relations){i++;if((rep==='repe')!==!!equal)break;}assert.equal(i,n);assert.equal(5-i,left);}
const all=cases(),json=Buffer.from(JSON.stringify(all)),seal={count:all.length,sha256:sha(json),oracleSourceSha256:sha(fs.readFileSync(__filename)),literalTraversal:traversal};
assert.equal(seal.sha256,'1b4e72e8f07cd71751cf3faa41d0cf87392272991a47ccf4298327ad4d57601b','frozen independent expectations');
main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||path.join(root,'build/wine-assembly.wasm')),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
 const pe=fs.readFileSync(root+'/test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const g=a=>e.guest_to_wasm(a)>>>0,stack=0x1100000,out=0xc80000,setup=0x480000,thunk=e.get_thunk_base()>>>0;
 const tw=g(thunk),old=dv.getUint32(tw+4,true),id=require(root+'/src/api_table.json').find(a=>a.name==='VirtualAlloc').id;
 function api(addr){
  const code=[0x6a,4,0x68,...le(0x3000),0x68,...le(4096),0x68,...le(addr),0xb8,...le(thunk),0xff,0xd0,0xc3];
  const pc=setup+api.n++*64;mem.set(code,g(pc));e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);e.run(10000);assert.equal(e.get_eax()>>>0,addr);assert.equal(e.get_eip(),0);
 }api.n=0;
 dv.setUint32(tw+4,id,true);
 for(const addr of [0x30000000,0x31000000,0x30001000,0x32000000,0x33000000,0x32001000])api(addr);
 dv.setUint32(tw+4,old,true);
 assert.notEqual(g(0x30001000),g(0x30000000)+4096);assert.notEqual(g(0x32001000),g(0x32000000)+4096);
 // Make even a speculative unmapped operand translation fail immediately.
 // Zero-count rows must reach RET with the sentinel and flags unchanged.
 e.set_fault_unmapped(2);
 const names=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],cache=new Map(),failures=[],categories={},groups={};let failed=0;
 const snap=(a,n)=>Buffer.from(Array.from({length:n},(_,i)=>mem[g(a+i)]));
 const fill=(a,n,x)=>{for(let i=0;i<n;i++)mem[g(a+i)]=x;};
 const save8=(a,v)=>[0xc6,5,...le(a),v];
 for(const t of all){
  const source=(t.layout[0]==='s'?0x30001000:t.layout[0]==='u'?0x61001000:0xc01000)-t.align;
  const dest=(t.layout[1]==='s'?0x32001000:t.layout[1]==='u'?0x62001000:0xc41000)-t.align;
  const step=t.df?-t.bits/8:t.bits/8;
  const regs=[((t.A[0]|(t.bits===8?0xa55ac300:t.bits===16?0xa55a0000:0))>>>0),t.count,0xaced1122,0x87654321,stack,0x0badf00d,source,dest];
  const guards=[];
  for(const [p,values,kind] of [[source,t.A,t.layout[0]],[dest,t.B,t.layout[1]]])if(kind!=='u'){
   const start=p-40;fill(start,96,0x5a);
   for(let i=0;i<5;i++)for(let j=0;j<t.bits/8;j++)mem[g(p+i*step+j)]=values[i]>>>(j*8)&255;
   guards.push([start,snap(start,96)]);
  }
  fill(out-8,88,0x6b);fill(stack-16,32,0xa7);e.guest_write32(stack,0);
  // Sentinel translated by unmapped reads must remain untouched at zero count.
  const sentinel=Buffer.from(mem.slice(0xf0,0x100));
  const ins=[...(t.rep==='single'?[]:[t.rep==='repe'?0xf3:0xf2]),...(t.bits===16?[0x66]:[]),t.op==='cmps'?(t.bits===8?0xa6:0xa7):(t.bits===8?0xae:0xaf)];
  const code=[0x68,...le(t.seed),0x9d,...ins,0x9c,0x8f,5,...le(out),0xa3,...le(out+4)];
  for(let c=0;c<16;c++)code.push(0x0f,0x90+c,5,...le(out+8+c));
  for(let c=0;c<16;c++)code.push(0x70+c,9,...save8(out+24+c,0),0xeb,7,...save8(out+24+c,1));
  code.push(0x9f,0xa3,...le(out+40),0x9c,0x8f,5,...le(out+44),0xc3);
  const key=code.join(',');let pc=cache.get(key);if(pc===undefined){pc=0x500000+cache.size*640;cache.set(key,pc);mem.set(code,g(pc));}
  for(let i=0;i<8;i++)e['set_'+names[i]](regs[i]);e.set_eip(pc);
  const issues=[];try{e.run(1000);}catch(err){issues.push('trap:'+err.message);}
  const flags=e.guest_read32(out)>>>0,expected=Buffer.alloc(88,0x6b);
  expected.writeUInt32LE(t.flags,8);expected.writeUInt32LE(regs[0],12);t.cc.forEach((v,i)=>{expected[16+i]=v;expected[32+i]=v;});
  const eax=((regs[0]&~0xff00)|(((t.flags&0xd5)|2)<<8))>>>0;
  expected.writeUInt32LE(eax,48);expected.writeUInt32LE(t.flags,52);
  for(const [n,bit] of [['CF',1],['PF',4],['AF',16],['ZF',64],['SF',128],['OF',2048],['DF',1024]])if((flags^t.flags)&bit)issues.push(n);
  if(!snap(out-8,88).equals(expected))issues.push('observations-or-output-guards');
  const want=regs.slice();want[0]=eax;want[1]=t.rep==='single'?t.count:t.count-t.steps;want[4]=stack+4;want[6]=(source+(t.op==='cmps'?step*t.steps:0))>>>0;want[7]=(dest+step*t.steps)>>>0;
  for(let i=0;i<8;i++)if((e['get_'+names[i]]()>>>0)!==want[i])issues.push(names[i]);
  for(const [a,b] of guards)if(!snap(a,96).equals(b))issues.push('operand-guards');
  const sb=Buffer.alloc(32,0xa7);sb.writeUInt32LE(t.flags,12);sb.writeUInt32LE(0,16);if(!snap(stack-16,32).equals(sb))issues.push('stack-guards');
  if(t.steps===0&&!Buffer.from(mem.slice(0xf0,0x100)).equals(sentinel))issues.push('zero-count-sentinel');
  if(e.get_eip()!==0)issues.push('return');
  const group=[t.op,t.bits,t.rep,t.layout,t.count===0?'zero':t.count===1?'one':'multi'].join('/'),row=groups[group]||={count:0,failed:0};row.count++;
  if(issues.length){row.failed++;failed++;for(const x of issues)categories[x]=(categories[x]||0)+1;if(failures.length<24)failures.push({t,flags,issues,observed:snap(out,48).toString('hex')});}
 }
 // Positive control: the same unmapped operand really traps when read by a
 // normal decoded instruction. Run last so its trap cannot affect a row.
 const control=setup+0x1000;mem.set([0xa1,...le(0x61000ffd),0xc3],g(control));
 e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(control);
 assert.throws(()=>e.run(1000),WebAssembly.RuntimeError,'unmapped read control');
 const result={count:all.length,failed,categories,failures,groups,oracleSha256:seal.sha256,moduleSha256:sha(bytes),moduleSize:bytes.length,unmappedReadControl:true,decoder:'complete unmodified production module; public guest API thunk setup; actual x86 Jcc/SETcc/LAHF/PUSHFD observations'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify({count:all.length,failed,categories,module:result.moduleSha256}));process.exitCode=failed?1:0;
}
