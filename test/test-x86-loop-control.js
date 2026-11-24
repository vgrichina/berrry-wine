'use strict';
// Intel SDM Vol 2, LOOP/LOOPcc and Jcc (including E3): operand size
// truncates a TAKEN EIP; address size selects CX/ECX. No flags change.
// https://cdrdv2-public.intel.com/789581/325383-sdm-vol-2abcd.pdf
// Full production decoder only. No source rewriting or helper exports.
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const root=process.cwd(),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
// Frozen literal counter pairs: input, decremented ECX, decremented CX with
// high ECX untouched. Independent of the implementation and runner below.
const counters=[
 [0,0xffffffff,0xffff],[1,0,0],[2,1,1],[0xffff,0xfffe,0xfffe],
 [0x10000,0xffff,0x1ffff],[0xffffffff,0xfffffffe,0xfffffffe],
 [0xa55a0000,0xa559ffff,0xa55affff],[0xa55a0001,0xa55a0000,0xa55a0000],
 [0xa55affff,0xa55afffe,0xa55afffe],
];
const seeds=[['raw0',0x202],['raw1',0xed7],['lazy8n',0x282],['lazy8z',0x246],['lazy16n',0x286],['lazy16z',0x246],['lazy32n',0x286],['lazy32z',0x246]];
const cases=[];
for(const opcode of [0xe0,0xe1,0xe2,0xe3])for(const prefix of [[],[0x67],[0x66],[0x66,0x67]])
for(const [initial,dec32,dec16] of counters)for(const [seed,flags] of seeds)
for(const disp of [-128,-17,17,127])for(const layout of ['normal','page']){
 const addr16=prefix.includes(0x67),op16=prefix.includes(0x66),after=opcode===0xe3?initial:addr16?dec16:dec32;
 const nonzero=addr16?after%65536!==0:after!==0,zf=!!(flags&64);
 const taken=opcode===0xe3?!nonzero:nonzero&&(opcode===0xe2||(opcode===0xe1?zf:!zf));
 cases.push({opcode,prefix,initial,seed,flags,disp,layout,after,taken,op16});
}
const seal={count:cases.length,sha256:sha(Buffer.from(JSON.stringify(cases))),literalCounters:counters,seeds,reference:'Intel SDM Vol2 LOOP/LOOPcc + Jcc E3; 66 truncates taken EIP only, 67 selects CX; no native hardware/Windows claim'};
assert.equal(seal.sha256,'1cb0281502f66ee7fb13cabaa3a5d53efbb00836b42ce1263db68fdb9909e0a6','frozen independent reference');
if(process.env.FREEZE_ONLY){fs.writeFileSync(process.env.FREEZE_ONLY,JSON.stringify(seal,null,2));console.log(seal.count,seal.sha256);}
else main().catch(e=>{console.error(e);process.exitCode=1;});
function conditions(f){const c=!!(f&1),p=!!(f&4),z=!!(f&64),s=!!(f&128),o=!!(f&2048);return [o,!o,c,!c,z,!z,c||z,!c&&!z,s,!s,p,!p,s!==o,s===o,z||s!==o,!z&&s===o].map(Number);}
async function main(){
 const bytes=fs.readFileSync(process.env.WINE_ASSEMBLY_WASM||root+'/build/wine-assembly.wasm'),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};
 for(const i of WebAssembly.Module.imports(mod)){assert(['memory','function'].includes(i.kind));(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:()=>0;}
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),pe=fs.readFileSync(root+'/test/binaries/notepad.exe');
 mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));const g=a=>e.guest_to_wasm(a)>>>0;
 const stack=0x1100000,out=0xc80000,data=out+256,observer=0x600000,setup=0x610000;
 const save8=(a,v)=>[0xc6,5,...le(a),v];
 const obs=[0x9c,0x8f,5,...le(out)];
 for(let c=0;c<16;c++)obs.push(0x0f,0x90+c,5,...le(out+8+c));
 for(let c=0;c<16;c++)obs.push(0x70+c,9,...save8(out+24+c,0),0xeb,7,...save8(out+24+c,1));
 obs.push(0xa3,...le(out+40),0x9f,0xa3,...le(out+44),0x8b,5,...le(out+40),0x9c,0x8f,5,...le(out+48),0xc3);mem.set(obs,g(observer));
 const seedSites={};for(const [name,flags] of seeds){const bits=name.includes('16')?16:name.includes('32')?32:8;
  const code=name.startsWith('raw')?[0x68,...le(flags),0x9d,0xc3]:[0x68,...le(0x202),0x9d,...(bits===16?[0x66]:[]),bits===8?0xf6:0xf7,5,...le(data),...(bits===8?[255]:bits===16?[255,255]:[255,255,255,255]),0xc3];
  seedSites[name]=setup+Object.keys(seedSites).length*128;mem.set(code,g(seedSites[name]));
 }
 const regs=[0xa55ac33c,0,0xaced1122,0x87654321,stack,0xbadf00d,0x12345678,0x99887766],names=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
 const cache=new Map(),failures=[],categories={},groups={};let failed=0,checked=0,executedSentinels=0,interiorChecks=0;
 const run=(pc,budget)=>{e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(pc);e.run(budget);};
 for(const t of cases){
  const key=[t.opcode,t.prefix.join('.'),t.disp,t.layout].join('/');let site=cache.get(key);
  if(!site){const base=0x1800000+cache.size*0x3000,pc=base+(t.layout==='page'?0x1000-t.prefix.length-1:0x800),fall=pc+t.prefix.length+2,target=fall+t.disp;
   // Predecode an entry immediately before the branch, then enter the branch
   // interior directly on later passes. Both arms have bounded RET sentinels.
   mem.set([0x90,...t.prefix,t.opcode,t.disp&255],g(pc-1));
   mem.set([0xba,...le(0x11111111),0xc3],g(fall));mem.set([0xba,...le(0x22222222),0xc3],g(target));
   site={pc,fall,target};cache.set(key,site);
  }
  const expectedPC=t.taken?(t.op16?site.target&65535:site.target):site.fall;
  for(const entry of ['outer','interior','warm']){
   for(let i=0;i<8;i++)e['set_'+names[i]](i===1?t.initial:regs[i]);
   e.guest_write32(data,t.seed.endsWith('z')?0:t.seed.includes('8')?0x80:t.seed.includes('16')?0x8000:0x80000000);
   run(seedSites[t.seed],100);assert.equal(e.get_eip(),0,'seed returns');
   // Crucially no PUSHFD/LAHF/Jcc between lazy seed and tested instruction.
   run(site.pc-(entry==='outer'?1:0),1);
   // A warmed interior entry splits the prior NOP block; its block-end
   // consumes one quantum before LOOP. Resume that exact boundary once.
   if(entry==='outer'&&(e.get_eip()>>>0)===site.pc)e.run(1);
   const issues=[],actualPC=e.get_eip()>>>0,actualCounter=e.get_ecx()>>>0;
   if(actualPC!==expectedPC)issues.push('target');if(actualCounter!==t.after)issues.push('counter');
   for(let i=0;i<8;i++)if(i!==1&&i!==4&&(e['get_'+names[i]]()>>>0)!==regs[i])issues.push(names[i]);
   if(e.get_esp()!==stack)issues.push('branch-stack');
   // Execute high-address targets to their finite sentinels; operand16 targets
   // are checked by actual EIP because low guest addresses are unmapped here.
   if(!t.taken||!t.op16){e.run(100);if(e.get_eip()!==0)issues.push('sentinel-return');if((e.get_edx()>>>0)!==(t.taken?0x22222222:0x11111111))issues.push('sentinel-arm');executedSentinels++;}
   mem.fill(0x6b,g(out-8),g(out+64));run(observer,100);if(e.get_eip()!==0)issues.push('observer-return');
   const flags=e.guest_read32(out)>>>0,flags2=e.guest_read32(out+48)>>>0;
   if(flags!==t.flags||flags2!==t.flags)issues.push('flags');
   if(((e.guest_read32(out+44)>>>8)^t.flags)&0xd5)issues.push('LAHF');
   const cc=conditions(t.flags);for(let c=0;c<16;c++){if(mem[g(out+8+c)]!==cc[c])issues.push('SETcc'+c);if(mem[g(out+24+c)]!==cc[c])issues.push('Jcc'+c);}
   if(!mem.slice(g(out-8),g(out)).every(x=>x===0x6b)||!mem.slice(g(out+52),g(out+64)).every(x=>x===0x6b))issues.push('output-guards');
   const group=[t.opcode,t.prefix.join('.'),t.seed,t.layout].join('/'),row=groups[group]||={count:0,failed:0};row.count++;checked++;if(entry!=='outer')interiorChecks++;
   if(issues.length){failed++;row.failed++;for(const x of issues)categories[x]=(categories[x]||0)+1;if(failures.length<24)failures.push({t,entry,actualPC,expectedPC,actualCounter,flags,flags2,issues});}
  }
 }
 const result={count:checked,failed,categories,failures,groups,executedSentinels,interiorChecks,oracleSha256:seal.sha256,moduleSha256:sha(bytes),moduleSize:bytes.length,codeSites:cache.size,decoder:'full production; run(1) actual branch EIP then bounded sentinels; raw/lazy seed, PUSHFD/Jcc/SETcc/LAHF'};
 if(process.env.PROBE_OUT)fs.writeFileSync(process.env.PROBE_OUT,JSON.stringify(result,null,2));console.log(JSON.stringify({count:checked,failed,categories,module:result.moduleSha256,executedSentinels,interiorChecks}));process.exitCode=failed?1:0;
}
