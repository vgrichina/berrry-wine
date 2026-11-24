'use strict';
// Run after tools/build.sh. Executes instruction bytes through the complete
// compiled production decoder, with no extracted flag/decoder helpers.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const le32=x=>[x&255,(x>>>8)&255,(x>>>16)&255,x>>>24];
const cases=[];
// Protected 32-bit user execution: CPL=3, IOPL=0, VM=0, IF initially 1.
// POPF cannot modify IF/IOPL/RF/VM/VIF/VIP or reserved bits. AC/ID are
// writable by POPFD; POPF preserves the upper half. No undefined flags asserted.
for(let n=0;n<128;n++) {
  const status=[0,2,4,6,7,10,11].reduce((v,b,i)=>v|(((n>>>i)&1)<<b),0);
  for(const upper of [0,0x240000]) {
    const seed=0x202|status|upper;
    for(const kind of ['popfd','popf','sahf','pushfd','pushf','ax-pushf','rotate0','rotate1','stc','clc','cmc']) {
      const target=(~status)&0xcd5;
      const flags=kind==='popfd'?0x202|target|upper:
        kind==='popf'?0x202|target|upper:
        kind==='sahf'?(seed&~0xd5)|(target&0xd5):
        kind==='stc'?seed|1:kind==='clc'?seed&~1:kind==='cmc'?seed^1:
        kind==='rotate1'?(seed&~0x801)|0x801:seed;
      cases.push({kind,seed,input:target|upper|0xffdb3200,flags:flags>>>0,
        ah:((flags&0xd5)|2),stackDelta:4,upperGuard:0xa55a});
    }
  }
}
// Literal defined AF after nibble carry/borrow, then status capture.
for(const [body,flags] of [
  [[0xb0,15,0x04,1],0x212], [[0xb0,16,0x2c,1],0x216],
  [[0xb0,0,0x2c,1],0x297], [[0xb0,255,0x04,1],0x257],
  [[0xb8,15,0,0,0,0x40],0x212], [[0xb8,16,0,0,0,0x48],0x216],
]) cases.push({kind:'arithmetic',seed:0x202,input:0,body,flags,ah:(flags&0xd5)|2,stackDelta:4,upperGuard:null});
if(process.env.FREEZE_ONLY) {
  fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify({mode:'protected32 CPL3 IOPL0 VM0; IF=1',
    writablePopfd:'0x00244dd5',reserved:'bit1=1; bits3,5,15,22..31=0',
    guards:'all GPRs, EAX upper/AL, stack ESP+4 and byte perimeter; PUSHF writes two bytes; LAHF preserves flags',cases},null,2));
} else main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||path.join(root,'build/wine-assembly.wasm'));
 const mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod)) (imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
 const pe=fs.readFileSync(path.join(root,'test/binaries/notepad.exe'));mem.set(pe,e.get_staging());e.load_pe(pe.length);
 const image=e.get_image_base(),g2w=a=>require(path.join(root,'lib/region-map.generated.js')).g2w(a,image);
 const stack=image+0xd00000,data=image+0x800000,names=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
 const failures=[],categories={};let checked=0;
 for(const t of cases){
   const prefix=[0x68,...le32(t.seed),0x9d];
   const body=t.kind==='popfd'?[0x68,...le32(t.input),0x9d]:
     t.kind==='popf'?[0x66,0x68,t.input&255,(t.input>>>8)&255,0x66,0x9d]:
     t.kind==='sahf'?[0xb4,t.input&255,0x9e]:
     t.kind==='pushfd'?[0x9c,0x8f,0x05,...le32(data+8)]:
     t.kind==='pushf'?[0x66,0x9c,0x66,0x8f,0x05,...le32(data+8)]:
     t.kind==='ax-pushf'?[0x66,0x9c,0x66,0x58]:
     t.kind==='rotate0'?[0xc1,0xd0,0]:t.kind==='rotate1'?[0xc1,0xc0,1]:
     t.kind==='stc'?[0xf9]:t.kind==='clc'?[0xf8]:t.kind==='cmc'?[0xf5]:t.body;
   const code=[...prefix,...body,0x9c,0x8f,0x05,...le32(data),0x9f,
     0x9c,0x8f,0x05,...le32(data+12),0xc3];
   const addr=image+0x100000+checked*128;mem.set(code,g2w(addr));
   const regs=[0xa55a1234,0x12345678,0xaced1122,0x87654321,stack,0x0badf00d,3,0x99887766];
   for(let i=0;i<8;i++)e['set_'+names[i]](regs[i]);
   mem.fill(0x5a,g2w(data-8),g2w(data+24));mem.fill(0xa7,g2w(stack-16),g2w(stack+16));dv.setUint32(g2w(stack),0,true);
   e.set_eip(addr);e.run(10000);
   const issues=[],observed=dv.getUint32(g2w(data),true),eax=e.get_eax()>>>0;
   if(observed!==t.flags)issues.push('flags');
   if(dv.getUint32(g2w(data+12),true)!==t.flags)issues.push('lahf-preserves-flags');
   if(((eax>>>8)&255)!==t.ah)issues.push('lahf');
   let expectedEax=regs[0];
   if(t.kind==='ax-pushf')expectedEax=(expectedEax&0xffff0000)|(t.flags&65535);
   if(t.kind==='sahf')expectedEax=(expectedEax&~0xff00)|((t.input&255)<<8);
   if(t.kind==='rotate1')expectedEax=((expectedEax<<1)|(expectedEax>>>31))>>>0;
   if(t.kind==='arithmetic'){
     // These literal instructions change AL, or EAX for INC/DEC.
     expectedEax=t.body.includes(0x40)?16:t.body.includes(0x48)?15:
       (regs[0]&~255)|(t.body[1]===255?0:t.body[2]===4?16:t.body[1]===0?255:15);
   }
   expectedEax=((expectedEax&~0xff00)|(t.ah<<8))>>>0;
   if(eax!==expectedEax)issues.push('eax-upper-al');
   for(let i=1;i<8;i++)if((e['get_'+names[i]]()>>>0)!==(i===4?stack+4:regs[i]))issues.push(names[i]);
   const out=Buffer.alloc(32,0x5a);out.writeUInt32LE(t.flags>>>0,8);out.writeUInt32LE(t.flags>>>0,20);
   if(t.kind==='pushfd')out.writeUInt32LE(t.flags>>>0,16);
   if(t.kind==='pushf')out.writeUInt16LE(t.flags&65535,16);
   if(!Buffer.from(mem.slice(g2w(data-8),g2w(data+24))).equals(out))issues.push('output-perimeter');
   const st=Buffer.alloc(32,0xa7);st.writeUInt32LE(t.flags>>>0,12);st.writeUInt32LE(0,16);
   if(!Buffer.from(mem.slice(g2w(stack-16),g2w(stack+16))).equals(st))issues.push('stack-perimeter');
   if(e.get_eip()!==0)issues.push('return');
   if(issues.length){for(const issue of issues)categories[issue]=(categories[issue]||0)+1;failures.push({...t,observed,eax,issues});}
   checked++;
 }
 const result={checked,passed:checked-failures.length,failed:failures.length,categories,moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex'),failures};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));
 console.log(JSON.stringify({...result,failures:failures.slice(0,6)},null,2));process.exitCode=failures.length?1:0;
}
