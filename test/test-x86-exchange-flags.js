// Complete production decoder regression. Frozen independent oracle before original baseline.
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const oracle=(()=>{

// BigInt arithmetic and architectural register slices; independent of WAT.
function arithmetic(bits,sub,a,b){
 const m=2n**BigInt(bits),s=m/2n,A=BigInt(a),B=BigInt(b),full=sub?A-B:A+B,r=(full%m+m)%m;
 const signed=x=>x>=s?x-m:x,wide=sub?signed(A)-signed(B):signed(A)+signed(B);
 let parity=0;for(let i=0n;i<8n;i++)parity+=Number((r>>i)&1n);
 return {value:Number(r),flags:0x202|Number(sub?full<0n:full>=m)|(Number(parity%2===0)<<2)|
 (Number(sub?A%16n<B%16n:A%16n+B%16n>=16n)<<4)|(Number(r===0n)<<6)|(Number(r>=s)<<7)|(Number(wide < -s||wide>=s)<<11)};
}
function slot(bits,code){return {reg:bits===8?code%4:code,shift:bits===8&&code>=4?8:0};}
function read(regs,bits,code){const p=slot(bits,code);return Number((BigInt(regs[p.reg])>>BigInt(p.shift))%(2n**BigInt(bits)));}
function write(regs,bits,code,value){const p=slot(bits,code),mask=(2n**BigInt(bits)-1n)<<BigInt(p.shift);regs[p.reg]=Number((BigInt(regs[p.reg])&~mask)|(BigInt(value)<<BigInt(p.shift)))>>>0;}
function exchange(bits,op,regs,dst,src,memory){
 const after=regs.slice(),old=memory===null?read(regs,bits,dst):memory,source=read(regs,bits,src),acc=read(regs,bits,0);
 const calc=arithmetic(bits,op==='cmpxchg',op==='cmpxchg'?acc:old,op==='cmpxchg'?old:source);
 let value=old;
 if(op==='xadd'){write(after,bits,src,old);value=calc.value;if(memory===null)write(after,bits,dst,value);}
 else if(acc===old){value=source;if(memory===null)write(after,bits,dst,value);}
 else write(after,bits,0,old);
 return {regs:after,memory:memory===null?null:value,flags:calc.flags};
}
for(const [bits,sub,a,b,v,f] of [[8,false,127,1,128,0xa92],[8,false,255,1,0,0x257],[8,true,0,1,255,0x297],[16,true,32768,1,32767,0xa16],[32,false,0xffffffff,1,0,0x257]]){
 const x=arithmetic(bits,sub,a,b);if(x.value!==v||x.flags!==f)throw Error('literal arithmetic '+JSON.stringify(x));
}
let r=[0x1234807f,0,0,0,0,0,0,0];
let e=exchange(8,'xadd',r,0,4,null);if(e.regs[0]!==0x12347fff||e.flags!==0x286)throw Error('literal AL AH alias');
e=exchange(8,'xadd',r,4,4,null);if(e.regs[0]!==0x1234007f||e.flags!==0xa47)throw Error('literal AH same');
return {arithmetic,read,write,exchange};

})();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),le=x=>[x&255,(x>>>8)&255,(x>>>16)&255,x>>>24];
const data=0xc00000,out=data+0x10000,stack=0x1100000;
function makeCases(){
 const all=[];
 for(const bits of [8,16,32]){
 const m=2**bits,values=[0,1,7,8,15,16,17,m/2-1,m/2,m/2+1,m-2,m-1];
 const codes=bits===8?[0,1,2,3,4,5,6,7]:[0,1,2,3,5,6,7];
 const forms=['abs','base','disp8','negative-disp8','disp32','sib','sib-nobase'];
 const variants=[...codes.flatMap(dst=>codes.map(src=>({form:'register',dst,src,locked:false,mode:0,align:0}))),
 ...forms.flatMap(form=>(bits===8?[0,1,4,7]:[0,1,3,6]).flatMap(src=>[0,1,7].flatMap(align=>[{form,src,align,mode:0,locked:false},{form,src,align,mode:0,locked:true},{form,src,align,mode:1,locked:true}])))] ;
 for(const op of ['cmpxchg','xadd'])for(const a of values)for(const b of values)for(const v of variants){
 const regs=[0xa55ac33c,0x12345678,0xaced1122,0x0badf00d,stack,0x23456789,0x99887766,3],addr=data+v.align;
 regs[5]=v.form==='disp8'?addr-23:v.form==='negative-disp8'?addr+23:v.form==='disp32'?addr-0x12345:v.form==='sib'?addr+111:addr;
 if(op==='cmpxchg'){oracle.write(regs,bits,0,a);if(v.form==='register')oracle.write(regs,bits,v.dst,b);oracle.write(regs,bits,v.src,(a^b^0x5a)>>>0 & (m-1));}
 else {if(v.form==='register')oracle.write(regs,bits,v.dst,a);oracle.write(regs,bits,v.src,b);}
 // EBP and EDI address registers are never selected as memory sources.
 const mem=v.form==='register'?null:op==='cmpxchg'?b:a;
 const expected=oracle.exchange(bits,op,regs,v.dst,v.src,mem);
 const address=v.form==='register'?[0xc0|v.dst]:v.form==='abs'?[5,...le(addr)]:v.form==='base'?[0x45,0]:v.form==='disp8'?[0x45,23]:v.form==='negative-disp8'?[0x45,0xe9]:v.form==='disp32'?[0x85,...le(0x12345)]:v.form==='sib'?[0x84,0xbd,...le(-123)]:[4,0xbd,...le(addr-12)];
 const instruction=[...(v.locked?[0xf0]:[]),...(bits===16?[0x66]:[]),0x0f,op==='xadd'?(bits===8?0xc0:0xc1):(bits===8?0xb0:0xb1),address[0]|(v.src<<3),...address.slice(1)];
 all.push({bits,op,a,b,...v,regs,mem,expected,instruction});
 }
 }
 return all;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
async function main(){
 const cases=makeCases(),seal={sha256:sha(Buffer.from(JSON.stringify(cases)))};
 if(seal.sha256!=='6c94db881382e4ec528ba54aeee05720f64df5f65c05fea5cec09bb24b7d47bd')throw Error('frozen oracle mismatch');
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||path.join(root,'build/wine-assembly.wasm')),module=await WebAssembly.compile(bytes);
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(module))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;
 const e=(await WebAssembly.instantiate(module,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer);
 const pe=fs.readFileSync(root+'/test/binaries/notepad.exe');mem.set(pe,e.get_staging());e.load_pe(pe.length);
 const g=a=>require(root+'/lib/region-map.generated.js').g2w(a,e.get_image_base());
 const names=['eax','ecx','edx','ebx','esp','ebp','esi','edi'],cache=new Map(),failures=[],categories={},groups={};let failed=0;
 for(const t of cases){
 const flagsIn=(t.a&1)?0xad7:0x202,code=[0x68,...le(flagsIn),0x9d,...t.instruction,0x9c,0x8f,5,...le(out),0xa3,...le(out+4),0xc3];
 const key=code.join(',');let address=cache.get(key);if(address===undefined){address=0x500000+cache.size*64;cache.set(key,address);mem.set(code,g(address));}
 e.set_lock_atomic_mode(t.mode);
 for(let i=0;i<8;i++)e['set_'+names[i]](t.regs[i]);
 const before=Buffer.alloc(64,0x5a),after=Buffer.from(before),anchor=16+t.align;
 if(t.mem!==null)for(let i=0;i<t.bits/8;i++){before[anchor+i]=(t.mem>>>(i*8))&255;after[anchor+i]=(t.expected.memory>>>(i*8))&255;}
 mem.set(before,g(data-16));mem.fill(0x6b,g(out-8),g(out+16));mem.fill(0xa7,g(stack-16),g(stack+16));dv.setUint32(g(stack),0,true);
 e.set_eip(address);const issues=[];try{e.run(100);}catch(err){issues.push('trap:'+err.message);}
 const flags=dv.getUint32(g(out),true),result=dv.getUint32(g(out+4),true);
 for(const [name,bit] of [['CF',1],['PF',4],['AF',16],['ZF',64],['SF',128],['OF',2048]])if((flags^t.expected.flags)&bit)issues.push(name);
 const expectedRegs=t.expected.regs.slice();expectedRegs[4]=stack+4;
 if(result!==expectedRegs[0])issues.push('result-upper-half');
 for(let i=0;i<8;i++)if((e['get_'+names[i]]()>>>0)!==expectedRegs[i])issues.push(names[i]);
 if(!after.equals(mem.subarray(g(data-16),g(data+48))))issues.push('memory-guards');
 const ob=Buffer.alloc(24,0x6b);ob.writeUInt32LE(flags,8);ob.writeUInt32LE(result,12);
 if(!ob.equals(mem.subarray(g(out-8),g(out+16))))issues.push('output-guards');
 const sb=Buffer.alloc(32,0xa7);sb.writeUInt32LE(flags,12);sb.writeUInt32LE(0,16);
 if(!sb.equals(mem.subarray(g(stack-16),g(stack+16))))issues.push('stack-guards');
 if(e.get_eip()!==0)issues.push('return');
 const group=[t.op,t.bits,t.form==='register'?'register':t.locked?'lock-mode'+t.mode:'memory'].join('/');
 const row=groups[group]||={count:0,failed:0};row.count++;
 if(issues.length){failed++;row.failed++;for(const s of issues)categories[s]=(categories[s]||0)+1;if(failures.length<24)failures.push({...t,flags,result,issues});}
 }
 const result={count:cases.length,passed:cases.length-failed,failed,categories,groups,failures,oracleSha256:seal.sha256,moduleSha256:sha(bytes),claims:'compiled production decoder only; no hardware concurrency or Windows/gameplay claim; only defined arithmetic flags asserted'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify({count:result.count,failed,categories,groups}));process.exitCode=failed?1:0;
}
