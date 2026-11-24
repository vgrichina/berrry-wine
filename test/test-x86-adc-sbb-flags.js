// Run after tools/build.sh. Complete production decoder and compiled WAT.
'use strict';
// Independent BigInt arithmetic oracle; production executes only x86 bytes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib');
const root=path.resolve(__dirname,'..'),le32=x=>[x&255,(x>>>8)&255,(x>>>16)&255,x>>>24];
function oracle(bits,sub,a,b,carry){
 const width=BigInt(bits),mod=1n<<width,sign=mod/2n,A=BigInt(a),B=BigInt(b),C=BigInt(carry);
 const full=sub?A-B-C:A+B+C,r=((full%mod)+mod)%mod;
 const signed=x=>x>=sign?x-mod:x;
 const signedFull=sub?signed(A)-signed(B)-C:signed(A)+signed(B)+C;
 let ones=0n;for(let i=0n;i<8n;i++)ones+=(r>>i)&1n;
 const cf=sub?full<0n:full>=mod,af=sub?(A%16n)<(B%16n+C):(A%16n+B%16n+C)>=16n;
 return {result:Number(r),flags:0x202|Number(cf)|(Number(ones%2n===0n)<<2)|(Number(af)<<4)|
   (Number(r===0n)<<6)|(Number(r>=sign)<<7)|(Number(signedFull < -sign || signedFull>=sign)<<11)};
}
for(const [bits,sub,a,b,c,r,f] of [
 [8,false,0,15,1,16,0x212],[8,true,16,15,1,0,0x256],
 [8,false,127,0,1,128,0xa92],[8,true,128,0,1,127,0xa12],
 [32,false,0,0xffffffff,1,0,0x257],[32,true,0,0xffffffff,1,0,0x257]]){
 const o=oracle(bits,sub,a,b,c);if(o.result!==r||o.flags!==f)throw Error('literal oracle check');
}
const cases=[];
for(const bits of [8,16,32]){
 const mod=2**bits,sign=mod/2,values=[0,1,7,8,14,15,16,17,sign-1,sign,sign+1,mod-2,mod-1];
 for(const sub of [false,true])for(const a of values)for(const b of values)for(const carry of [0,1])
 for(const form of ['rr','rr-reverse','high','acc','imm','sext','src-abs','dst-abs','src-base','dst-base','src-sib','dst-sib','mem-imm']){
  if(form==='high'&&bits!==8)continue;
  if(form==='sext'&&(bits===8||!(b<128||b>=mod-128)))continue;
  for(const cl of [0,31])cases.push({bits,sub,a,b,carry,form,cl,...oracle(bits,sub,a,b,carry)});
 }
}
const frozen=Buffer.from(JSON.stringify(cases)),oracleSha256=crypto.createHash('sha256').update(frozen).digest('hex');
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,zlib.gzipSync(frozen));console.log(JSON.stringify({cases:cases.length,oracleSha256}));}
else main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||path.join(root,'build/wine-assembly.wasm'));
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
 const pe=fs.readFileSync(path.join(root,'test/binaries/notepad.exe'));mem.set(pe,e.get_staging());e.load_pe(pe.length);
 const image=e.get_image_base(),g2w=a=>require(path.join(root,'lib/region-map.generated.js')).g2w(a,image);
 const data=image+0x800000,out=data+0x100,stack=image+0xd00000,names=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
 const cache=new Map(),failures=[],categories={};let failed=0;
 for(const t of cases){
  const {bits,sub,a,b,carry,form,cl}=t,base=sub?0x18:0x10,group=sub?3:2,w=bits/8,mask=2**bits-1;
  const imm=bits===8?[b]:bits===16?[b&255,b>>>8]:le32(b);
  const source=form.startsWith('src-'),destination=form.startsWith('dst-')||form==='mem-imm';
  const addr=form.endsWith('base')?[0x43,0x10]:form.endsWith('sib')?[0x44,0xb3,0x10]:[0x05,...le32(data)];
  let instruction;
  if(form==='rr'||form==='high'||form==='rr-reverse')instruction=[base+(bits===8?0:1)+(form==='rr-reverse'?2:0),form==='high'?0xf4:0xc2]; // AL,DL or AH,DH
  else if(form==='acc')instruction=[base+(bits===8?4:5),...imm];
  else if(form==='imm'||form==='sext')instruction=[form==='sext'?0x83:bits===8?0x80:0x81,0xc0|(group<<3),...(form==='sext'?[b&255]:imm)];
  else if(form==='mem-imm')instruction=[bits===8?0x80:0x81,addr[0]|(group<<3),...addr.slice(1),...imm];
  else instruction=[base+(bits===8?0:1)+(source?2:0),...addr];
  // Reverse-direction opcode uses DL as source and AL as destination too.
  if(form==='rr-reverse')instruction[1]=0xc2;
  else if(form==='rr')instruction[1]=0xd0;
  const code=[0x68,...le32(0xad6|carry),0x9d,...(bits===16?[0x66]:[]),...instruction,
   0x9c,0x8f,0x05,...le32(out),0xa3,...le32(out+8),0x9f,0x9c,0x8f,0x05,...le32(out+4),0xc3];
  const key=code.join(',');let address=cache.get(key);
  if(address===undefined){address=image+0x100000+cache.size*64;cache.set(key,address);mem.set(code,g2w(address));}
  const insert=(old,v,shift=0)=>Number((BigInt(old)&~(BigInt(mask)<<BigInt(shift)))|(BigInt(v)<<BigInt(shift)))>>>0;
  const regs=[0xa55ac33c,0x12340000|cl,0xaced1122,data-16-(form.endsWith('sib')?12:0),stack,0x0badf00d,3,0x99887766];
  regs[0]=insert(regs[0],destination?b:a,form==='high'?8:0);
  regs[2]=insert(regs[2],b,form==='high'?8:0);
  for(let i=0;i<8;i++)e['set_'+names[i]](regs[i]);
  mem.fill(0x5a,g2w(data-8),g2w(data+16));for(let i=0;i<w;i++)mem[g2w(data+i)]=((source?b:a)>>>(i*8))&255;
  const expectedMemory=mem.slice(g2w(data-8),g2w(data+16));
  if(destination)for(let i=0;i<w;i++)expectedMemory[8+i]=(t.result>>>(i*8))&255;
  mem.fill(0x6b,g2w(out-8),g2w(out+16));mem.fill(0xa7,g2w(stack-16),g2w(stack+16));dv.setUint32(g2w(stack),0,true);
  e.set_eip(address);e.run(10000);
  const issues=[],flags=dv.getUint32(g2w(out),true),post=dv.getUint32(g2w(out+4),true);
  for(const [name,bit] of [['CF',1],['PF',4],['AF',16],['ZF',64],['SF',128],['OF',2048]])if((flags^t.flags)&bit)issues.push(name);
  if((flags&~0x8d5)!==0x202)issues.push('other-flags');
  if(post!==flags)issues.push('lahf-preserves-flags');
  const expectedRegs=regs.slice();expectedRegs[4]=stack+4;
  if(!destination)expectedRegs[0]=insert(regs[0],t.result,form==='high'?8:0);
  const actualResultEax=dv.getUint32(g2w(out+8),true);
  if(actualResultEax!==expectedRegs[0])issues.push('result-upper-half');
  expectedRegs[0]=((expectedRegs[0]&~0xff00)|(((t.flags&0xd5)|2)<<8))>>>0;
  for(let i=0;i<8;i++)if((e['get_'+names[i]]()>>>0)!==expectedRegs[i])issues.push(names[i]);
  if(!Buffer.from(mem.slice(g2w(data-8),g2w(data+16))).equals(expectedMemory))issues.push('memory-source-dest-guards');
  const expectedOut=Buffer.alloc(24,0x6b);expectedOut.writeUInt32LE(flags,8);expectedOut.writeUInt32LE(post,12);expectedOut.writeUInt32LE(actualResultEax,16);
  if(!Buffer.from(mem.slice(g2w(out-8),g2w(out+16))).equals(expectedOut))issues.push('output-guards');
  // PUSHFD writes stack-4; RET consumes exactly one dword.
  const expectedStack=Buffer.alloc(32,0xa7);expectedStack.writeUInt32LE(post,12);expectedStack.writeUInt32LE(0,16);
  if(!Buffer.from(mem.slice(g2w(stack-16),g2w(stack+16))).equals(expectedStack))issues.push('stack-guards');
  if(e.get_eip()!==0)issues.push('return');
  if(issues.length){failed++;for(const issue of issues)categories[issue]=(categories[issue]||0)+1;if(failures.length<24)failures.push({...t,observedFlags:flags,issues});}
 }
 const result={checked:cases.length,passed:cases.length-failed,failed,categories,oracleSha256,moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex'),failures};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));process.exitCode=failed?1:0;
}
