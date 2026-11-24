'use strict';
// Full production decoder. Oracle is mathematical BigInt, independent of WAT.
// Run from the repository root after the locked tools/build.sh. Both canonical
// dispatch modes can be selected with WINE_ASSEMBLY_WASM; no helper exports.
// Nonzero shifts leave AF undefined, OF is checked only at masked count one,
// and SHL/SHR CF is checked only below the operand width. SAR retains sign-out.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=process.cwd(),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
function expected(bits,op,value,count,flags){
 const W=BigInt(bits),M=2n**W,S=M/2n,A=BigInt(value),C=BigInt(count&31);
 if(!C)return {result:value,flags,mask:0xffffffff};
 const signed=A>=S?A-M:A;
 const R=(op===7?(signed>>C)+M:op===5?A>>C:A<<C)%M;
 const cf=Number(op===7?(C>=W?A>=S:(A>>(C-1n)&1n)):op===5?(A>>(C-1n)&1n):C<W?(A>>(W-C)&1n):0n);
 const of=op===7?0:op===5?Number(A>=S):Number(R>=S)^cf;
 let parity=0;for(let i=0n;i<8n;i++)parity^=Number(R>>i&1n);
 const out=(flags&~0x8d5)|cf|((1^parity)<<2)|(Number(R===0n)<<6)|(Number(R>=S)<<7)|(of<<11);
 const mask=(0xffffffff&~0x10&~(C===1n?0:0x800)&~(op!==7&&C>=W?1:0))>>>0;
 return {result:Number(R),flags:out>>>0,mask};
}
// Literal value/defined flag examples pin overflow, sign, parity, saturation.
for(const [bits,op,value,count,result,flags,mask] of [
 [8,4,0x40,1,0x80,0xa82,0x8c5],[8,6,0x80,1,0,0xa47,0x8c5],
 [8,5,0x80,1,0x40,0xa02,0x8c5],[8,7,0x81,1,0xc0,0x287,0x8c5],
 [8,7,0x80,31,0xff,0x287,0xc5],[8,5,0xff,8,0,0x246,0xc4],
 [16,4,0x4000,1,0x8000,0xa86,0x8c5],[32,5,0x80000000,1,0x40000000,0xa06,0x8c5],
 [32,7,0x80000000,31,0xffffffff,0x286,0xc5],[8,4,0x81,32,0x81,0xad7,0xffffffff],
]){const x=expected(bits,op,value,count,count===32?0xad7:0x202);assert.equal(x.result,result);assert.equal((x.flags^flags)&mask,0);}
function cc(f){const c=!!(f&1),p=!!(f&4),z=!!(f&64),s=!!(f&128),o=!!(f&2048);return [o,!o,c,!c,z,!z,c||z,!c&&!z,s,!s,p,!p,s!==o,s===o,z||s!==o,!z&&s===o].map(Number);}
const deps=[0x800,0x800,1,1,64,64,65,65,128,128,4,4,0x880,0x880,0x8c0,0x8c0];
const all=[];
for(const bits of [8,16,32])for(const op of [4,6,5,7])
for(const form of [...(bits===8?Array.from({length:8},(_,i)=>'r'+i):[0,1,2,3,5,6,7].map(i=>'r'+i)),'da','db','ds','sa','sb','ss'])
for(const mode of ['one','imm','cl'])for(const count of mode==='one'?[1]:[...new Set([0,1,bits-1,bits,bits+1,31,32,33,255])])
for(const value of [0,1,2**(bits-1)-1,2**(bits-1),2**bits-1,Math.floor((2**bits-1)/3)])
for(const seed of ['raw0','raw1','lazy8','lazy16','lazy32']){
 const regs=[0xa55ac33c,0x12345604,0xaced1122,0x87654321,0x1100000,0xbadf00d,3,0x12345678];
 const reg=form[0]==='r'?Number(form.slice(1)):null,idx=bits===8&&reg>=4?reg-4:reg,shift=bits===8&&reg>=4?8:0;
 const mask=bits===32?0xffffffff:(2**bits-1)<<shift;
 if(reg!==null)regs[idx]=((regs[idx]&~mask)|(value<<shift))>>>0;
 if(mode==='cl')regs[1]=((regs[1]&~255)|count)>>>0;
 const actualValue=reg===null?value:Number((BigInt(regs[idx])>>BigInt(shift))%(2n**BigInt(bits)));
 const flags=seed==='raw0'?0x202:seed==='raw1'?0xad7:seed==='lazy8'?0x282:0x286;
 all.push({bits,op,form,mode,count,value,seed,regs,idx,shift,...expected(bits,op,actualValue,count,flags),beforeFlags:flags});
}
const seal={count:all.length,sha256:sha(Buffer.from(JSON.stringify(all))),oracleSourceSha256:sha(fs.readFileSync(__filename))};
assert.equal(seal.sha256,'ee86de3a083e523ce5706aa9901bdd0184dc39e90cac8d5a2f181cc40e3ac8d9','frozen independent expectations');
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify(seal,null,2));console.log(seal);}
else main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||root+'/build/wine-assembly.wasm'),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod)){assert(['memory','function'].includes(i.kind));(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;}
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
 const pe=fs.readFileSync(root+'/test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const g=a=>e.guest_to_wasm(a)>>>0,stack=0x1100000,out=0xc80000,seeddata=out+256,setup=0x480000,thunk=e.get_thunk_base()>>>0;
 const tw=g(thunk),old=dv.getUint32(tw+4,true),id=require(root+'/src/api_table.json').find(a=>a.name==='VirtualAlloc').id;
 dv.setUint32(tw+4,id,true);
 for(const [i,a] of [0x30000000,0x31000000,0x30001000].entries()){
  const code=[0x6a,4,0x68,...le(0x3000),0x68,...le(4096),0x68,...le(a),0xb8,...le(thunk),0xff,0xd0,0xc3],pc=setup+i*64;
  mem.set(code,g(pc));e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);e.run(10000);assert.equal(e.get_eax()>>>0,a);assert.equal(e.get_eip(),0);
 }dv.setUint32(tw+4,old,true);assert.notEqual(g(0x30001000),g(0x30000000)+4096);
 const names=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],cache=new Map(),failures=[],categories={},groups={};let failed=0;
 const snap=(a,n)=>Buffer.from(Array.from({length:n},(_,i)=>mem[g(a+i)]));
 const fill=(a,n,x)=>{for(let i=0;i<n;i++)mem[g(a+i)]=x;};
 const save8=(a,v)=>[0xc6,5,...le(a),v];
 for(const t of all){
  const register=t.form[0]==='r',data=(t.form[0]==='s'?0x30001000:0xc01000)-1;
  const regs=t.regs.slice();if(!register){regs[3]=data-16-(t.form[1]==='s'?12:0);regs[6]=3;}
  const operand=register?[0xc0|(t.op<<3)|Number(t.form.slice(1))]:t.form[1]==='a'?[5|(t.op<<3),...le(data)]:t.form[1]==='b'?[0x43|(t.op<<3),16]:[0x44|(t.op<<3),0xb3,16];
  const opcode=(t.mode==='one'?0xd0:t.mode==='cl'?0xd2:0xc0)+(t.bits===8?0:1);
  const ins=[...(t.bits===16?[0x66]:[]),opcode,...operand,...(t.mode==='imm'?[t.count]:[])];
  const seed=t.seed.startsWith('raw')?[0x68,...le(t.beforeFlags),0x9d]:[...(t.seed==='lazy16'?[0x66]:[]),t.seed==='lazy8'?0xf6:0xf7,5,...le(seeddata),...(t.seed==='lazy8'?[255]:t.seed==='lazy16'?[255,255]:[255,255,255,255])];
  const code=[0x68,...le(0x202),0x9d,...seed,0x9c,0x8f,5,...le(out),...ins,0x9c,0x8f,5,...le(out+4)];
  for(let c=0;c<16;c++)code.push(0x0f,0x90+c,5,...le(out+8+c));
  for(let c=0;c<16;c++)code.push(0x70+c,9,...save8(out+24+c,0),0xeb,7,...save8(out+24+c,1));
  code.push(0xa3,...le(out+40),0x9f,0xa3,...le(out+44),0x8b,5,...le(out+40),0x9c,0x8f,5,...le(out+48),0xc3);
  const key=code.join(',');let pc=cache.get(key);if(pc===undefined){pc=0x1800000+cache.size*640;cache.set(key,pc);mem.set(code,g(pc));}
  fill(data-8,24,0x5a);for(let j=0;j<t.bits/8;j++)mem[g(data+j)]=t.value>>>(j*8)&255;
  const guard=snap(data-8,24);if(!register)for(let j=0;j<t.bits/8;j++)guard[8+j]=t.result>>>(j*8)&255;
  fill(out-8,72,0x6b);e.guest_write32(seeddata,t.seed==='lazy8'?0x80:t.seed==='lazy16'?0x8000:0x80000000);
  fill(stack-16,32,0xa7);e.guest_write32(stack,0);
  for(let i=0;i<8;i++)e['set_'+names[i]](regs[i]);e.set_eip(pc);
  const issues=[];try{e.run(1000);}catch(err){issues.push('trap:'+err.message);}
  const before=e.guest_read32(out)>>>0,flags=e.guest_read32(out+4)>>>0,flags2=e.guest_read32(out+48)>>>0;
  if(before!==t.beforeFlags)issues.push('fixture-flags');
  for(const [n,b] of [['CF',1],['PF',4],['AF',16],['ZF',64],['SF',128],['OF',2048],['other',0xfffff72a]])if((flags^t.flags)&t.mask&b)issues.push(n);
  if((flags2^t.flags)&t.mask)issues.push('flags-after-observers');
  const ccs=cc(t.flags);for(let c=0;c<16;c++)if((deps[c]&t.mask)===deps[c]){if(mem[g(out+8+c)]!==ccs[c])issues.push('SETcc'+c);if(mem[g(out+24+c)]!==ccs[c])issues.push('Jcc'+c);}
  if(((e.guest_read32(out+44)>>>8)^t.flags)&t.mask&0xd5)issues.push('LAHF');
  const want=regs.slice();want[4]=stack+4;
  if(register){const mask=t.bits===32?0xffffffff:(2**t.bits-1)<<t.shift;want[t.idx]=((regs[t.idx]&~mask)|(t.result<<t.shift))>>>0;}
  for(let i=0;i<8;i++)if((e['get_'+names[i]]()>>>0)!==want[i])issues.push(names[i]);
  if((e.guest_read32(out+40)>>>0)!==want[0])issues.push('saved-eax');
  if(!snap(data-8,24).equals(guard))issues.push('operand-guards');
  if(!snap(out-8,8).equals(Buffer.alloc(8,0x6b))||!snap(out+52,12).equals(Buffer.alloc(12,0x6b)))issues.push('output-guards');
  const sb=Buffer.alloc(32,0xa7);sb.writeUInt32LE(flags2,12);sb.writeUInt32LE(0,16);if(!snap(stack-16,32).equals(sb))issues.push('stack-guards');
  if(e.get_eip()!==0)issues.push('return');
  const group=[t.bits,t.op,t.form,t.mode,t.count&31].join('/'),row=groups[group]||={count:0,failed:0};row.count++;
  if(issues.length){row.failed++;failed++;for(const x of issues)categories[x]=(categories[x]||0)+1;if(failures.length<24)failures.push({t,before,flags,flags2,issues});}
 }
 const result={count:all.length,failed,categories,failures,groups,oracleSha256:seal.sha256,moduleSha256:sha(bytes),moduleSize:bytes.length,codeSites:cache.size,decoder:'full production x86; Jcc/SETcc/LAHF/PUSHFD; sparse pages allocated via decoded guest VirtualAlloc calls'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify({count:all.length,failed,categories,module:result.moduleSha256,codeSites:cache.size}));process.exitCode=failed?1:0;
}
