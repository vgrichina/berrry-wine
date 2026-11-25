'use strict';
// Decoder fixture. Expected answers are literals frozen in oracle.json; no
// production helper or generated arithmetic model computes expected results.
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
// Intel SDM Vol.2B 253667-080US June2023, pp.4-437..471.
// Literal arithmetic oracle: no production helper computes expected answers.
const oracle={
  "source": "https://cdrdv2-public.intel.com/782151/253667-sdm-vol-2b.pdf",
  "edition": "253667-080US June 2023",
  "pages": "4-437..447, 4-449..459, 4-461..471",
  "rules": "NP targets MMX; actual 66 selects SSE2 and must not alias MMX. Variable counts use all unsigned 64 bits. Logical shifts clear at count >= lane width; arithmetic shifts fill each lane with its original sign at that boundary. No flags change. Immediate groups require mod=3: /2 logical right, /4 arithmetic right (71/72 only), /6 logical left. F2/F3 unsupported, LOCK invalid: reject without architectural writes or operand memory access.",
  "countLabels": ["0","1","width-1","width","width+1","255","0000000100000000","0000000100000001","8000000000000000","ffffffffffffffff"],
  "vectors": [
    {"op":"PSRLW","opcode":209,"group":113,"digit":2,"sub":133,"width":16,"input":"8000ffff7fff0001","expected":["8000ffff7fff0001","40007fff3fff0000","0001000100000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"]},
    {"op":"PSRLD","opcode":210,"group":114,"digit":2,"sub":134,"width":32,"input":"800000017fffffff","expected":["800000017fffffff","400000003fffffff","0000000100000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"]},
    {"op":"PSRLQ","opcode":211,"group":115,"digit":2,"sub":135,"width":64,"input":"8000000000000001","expected":["8000000000000001","4000000000000000","0000000000000001","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"]},
    {"op":"PSRAW","opcode":225,"group":113,"digit":4,"sub":137,"width":16,"input":"8000ffff7fff0001","expected":["8000ffff7fff0001","c000ffff3fff0000","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000"]},
    {"op":"PSRAD","opcode":226,"group":114,"digit":4,"sub":138,"width":32,"input":"800000017fffffff","expected":["800000017fffffff","c00000003fffffff","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000","ffffffff00000000"]},
    {"op":"PSLLW","opcode":241,"group":113,"digit":6,"sub":129,"width":16,"input":"8000ffff7fff0001","expected":["8000ffff7fff0001","0000fffefffe0002","0000800080008000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"]},
    {"op":"PSLLD","opcode":242,"group":114,"digit":6,"sub":130,"width":32,"input":"800000017fffffff","expected":["800000017fffffff","00000002fffffffe","8000000080000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"]},
    {"op":"PSLLQ","opcode":243,"group":115,"digit":6,"sub":131,"width":64,"input":"8000000000000001","expected":["8000000000000001","0000000000000002","8000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000","0000000000000000"]}
  ],
  "matrix": "Both native/compat; code32, code16 small, code16 big; register variable all distinct register pairs plus alias; immediate every destination/count0..255 using boundary literals for >=width; address67 toggled; 16-bit EA rm0..7 mod0/1/2 and disp extremes in code16; 32-bit abs/disp8/disp32/SIB/baseSS/noBase; segment none/FS/CS/SS/DS; three flag states; cache cold/hit; rejected prefix variants and all reserved group digits/memory forms. Existing code32 address16 nonabsolute EA limitation is separately identified, not silently counted as supported."
};
const {setupWat}=require('./test-mmx-move-prefix');
module.exports={setupWat};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const mode=Number(process.env.SHIFT_CODE16||0),big=Number(process.env.SHIFT_CS_BIG||0);
const outPath=process.env.PROBE_OUT;
const countFor=(v,i)=>i<6?BigInt([0,1,v.width-1,v.width,v.width+1,255][i]):BigInt('0x'+oracle.countLabels[i]);
const hx=x=>BigInt.asUintN(64,x).toString(16).padStart(16,'0');
const le=x=>[x&255,x>>>8&255,x>>>16&255,x>>>24];
async function main(){
 const bytes=process.env.WINE_ASSEMBLY_WASM?fs.readFileSync(process.env.WINE_ASSEMBLY_WASM):require('./compile-src').compileSrcWasm((f,t)=>f==='13-exports.wat'?t+'\n'+setupWat:t),mod=await WebAssembly.compile(bytes),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true}),imports={};let unmapped=0;
 for(const i of WebAssembly.Module.imports(mod))(imports[i.module]||={})[i.name]=i.kind==='memory'?memory:i.name==='unmapped_trace'?()=>unmapped++:()=>0;
 const e=(await WebAssembly.instantiate(mod,imports)).exports,mem=new Uint8Array(memory.buffer),g=a=>e.guest_to_wasm(a)>>>0;
 const pe=fs.readFileSync('test/binaries/notepad.exe');mem.set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_fault_unmapped(2);
 const seam=!!e.move_setup;assert(seam||(!mode&&!big));
 const pc=0x1800200,input=0xc02000,out=0xc80000,regs=['eax','ecx','edx','ebx','esp','ebp','esi','edi'];
 const write=(a,v)=>v.forEach((x,i)=>e.guest_write32(a+i*4,x));
 const snap=(a,n)=>Buffer.from(mem.subarray(g(a),g(a)+n));
 const fill=(a,n,x)=>mem.fill(x,g(a),g(a)+n);
 const qwrite=(a,x)=>{e.guest_write32(a,Number(x&0xffffffffn));e.guest_write32(a+4,Number(x>>32n));};
 function put(code,at=pc){code.forEach((x,i)=>e.guest_write8(at+i,x));}
 function run(at=pc){e.clear_yield();e.set_eip(at);e.run(1);}
 if(!seam){put([0x0f,0x6f,0xc0,0xf4]);run();}
 function flags(){return seam?[e.move_flags(),e.move_top(),e.move_tag()]:[e.test_shift_flags(),...['op','a','b','res','sign_shift'].map(n=>e['get_flag_'+n]()),e.get_fpu_top(),e.get_fpu_tags()];}
 function state(){const mm=Array.from({length:8},(_,i)=>hx(e.get_mmx(i)));if(!seam)return {mm,flags:flags(),xmm:null};e.move_snapshot(out);return {mm,flags:flags(),xmm:snap(out+64,128).toString('hex')};}
 function init(v,c,dst,src,form,flag){
  const mm=Array.from({length:8},(_,i)=>BigInt('0xbeef0000dead0000')+BigInt(i)*0x100000001n);mm[dst]=BigInt('0x'+v.input);if(form==='rr'&&src!==dst)mm[src]=c;
  fill(input-8,208,0x5a);mm.forEach((x,i)=>qwrite(input+i*8,x));write(input+64,Array.from({length:32},(_,i)=>0x7f800001+i));fill(out-8,208,0x73);
  if(seam)e.move_setup(input,flag,mode,big);else{mm.forEach((x,i)=>e.set_mmx(i,x));e.test_shift(32,4,0x80000001,1,flag&1,flag);}
  e.set_fs_base(0xe00000);
  const gp=regs.map((_,i)=>0x71000000+i*0x10001);gp[4]=0x1108000;
  return {gp,mm:mm.map(hx)};
 }
 function encode(dst,src,addr67,form,gp,seg){
  const a16=!!(mode&&!big)!==!!addr67;if(form==='rr')return {operand:[0xc0|dst<<3|src],addr:null};
  let operand,off,base=mode?0xc00000:0;
  if(a16){const {rm,mod,disp}=form,terms=[[3,6],[3,7],[5,6],[5,7],[6],[7],[5],[3]][rm];gp[3]=0xaaaa7fe0;gp[5]=0xbbbb7ff0;gp[6]=0xcccc0020;gp[7]=0xdddd0030;
   off=(terms.reduce((n,r)=>n+(gp[r]&65535),0)+disp)&65535;if(mod===0&&rm===6)off=0x8003;
   base=mode?(terms.includes(5)&&!(mod===0&&rm===6)?0xd00000:0xc00000):0;
   operand=[mod<<6|dst<<3|rm,...(mod===0&&rm===6?[3,0x80]:mod===1?[disp&255]:mod===2?[disp&255,disp>>8&255]:[])];
  }else{off=mode?0x8003:0xc08003;
   if(form==='abs')operand=[5|dst<<3,...le(off)];
   if(form==='disp8'){gp[3]=off+128;operand=[0x43|dst<<3,0x80];}
   if(form==='disp32'){gp[3]=off+0x1234;operand=[0x83|dst<<3,...le(-0x1234)];}
   if(form==='sib'){gp[3]=off+128-12;gp[6]=3;operand=[0x44|dst<<3,0xb3,0x80];}
   if(form==='sib-ss'){gp[5]=off+128-12;gp[6]=3;operand=[0x44|dst<<3,0xb5,0x80];base=mode?0xd00000:0;}
   if(form==='sib-abs'){gp[6]=3;operand=[4|dst<<3,0xb5,...le(off-12)];}
  }
  if(seg===0x64)base=0xe00000;if(seg===0x2e)base=mode?0x1800000:0;if(seg===0x3e)base=mode?0xc00000:0;if(seg===0x36)base=mode||a16?0xd00000:0;
  return {operand,addr:(base+off)>>>0};
 }
 const groups={},failures=[],controls=[],direct=[];let cases=0,failed=0,rejected=0,rejectionFailed=0;
 function record(label,detail,issues,negative){const row=groups[label]||={count:0,failed:0};row.count++;if(negative)rejected++;else cases++;if(issues.length){row.failed++;if(negative)rejectionFailed++;else failed++;const dest=negative?controls:failures;if(dest.filter(x=>x.label===label).length<3&&dest.length<256)dest.push({label,...detail,issues});}}
 function execute(v,ci,dst,src,addr67,form,seg,flag,cached,immediate=false,prefix=[],negative=false,digit=v.digit,badEA=false){
  const c=typeof ci==='bigint'?ci:countFor(v,ci),s=init(v,c,dst,src,form,flag),a16=!!(mode&&!big)!==!!addr67;
  const enc=encode(immediate?digit:dst,immediate?dst:src,addr67,form,s.gp,seg);
  const code=[...prefix,...(addr67?[0x67]:[]),...(seg?[seg]:[]),0x0f,immediate?v.group:v.opcode,...enc.operand,...(immediate?[Number(c)]:[]),0xf4];
  if(!cached)put(code);
  if(enc.addr!==null){fill(enc.addr-8,24,0x6b);qwrite(enc.addr,c);}
  const source=enc.addr===null?null:snap(enc.addr-8,24),inputBefore=snap(input-8,208);
  regs.forEach((r,i)=>e['set_'+r](s.gp[i]));if(badEA)e.set_fs_base(0xdead0000);const before=state(),u=unmapped;let trap=null;
  try{run();}catch(err){trap=String(err.message);}
  const after=state(),issues=[],expected=s.mm.slice();
  if(!negative){
   if(form==='rr'&&src===dst&&!immediate)expected[dst]=v.op.startsWith('PSRA')?'ffffffff00000000':'0000000000000000';
   else expected[dst]=v.expected[typeof ci==='bigint'?(Number(c)>=v.width?3:Number(c)===0?0:Number(c)===1?1:2):ci];
   if(trap)issues.push('trap:'+trap);if(JSON.stringify(after.mm)!==JSON.stringify(expected))issues.push('MMX');
  }else{if(!trap)issues.push('accepted');if(JSON.stringify(before.mm)!==JSON.stringify(after.mm))issues.push('MMX-write');}
  if(JSON.stringify(before.flags)!==JSON.stringify(after.flags))issues.push('flags/TOP/tag');if(before.xmm!==after.xmm)issues.push('XMM-write');
  if(regs.some((r,i)=>(e['get_'+r]()>>>0)!==s.gp[i]))issues.push('GPR-write');
  if(!snap(input-8,208).equals(inputBefore))issues.push('input-write');if(source&&!snap(enc.addr-8,24).equals(source))issues.push('operand/neighbor-write');
  if(!snap(out-8,8).equals(Buffer.alloc(8,0x73))||!snap(out+192,8).equals(Buffer.alloc(8,0x73)))issues.push('output-guards');if(unmapped!==u)issues.push('unmapped:'+String(unmapped-u));
  const label=negative?`${v.op}/${immediate?'imm':'var'}/reject/${prefix.map(x=>x.toString(16)).join('+')||'encoding'}/67=${addr67}`:`${v.op}/${immediate?'imm':form==='rr'?'rr':a16?'ea16':'ea32'}/67=${addr67}/seg=${seg}/cache=${cached}`;
  record(label,{op:v.op,mode,big,dst,src,count:c.toString(16),form,seg,prefix,code:Buffer.from(code).toString('hex'),expected:expected[dst],actual:after.mm[dst],trapped:!!trap,preserved:JSON.stringify(before)===JSON.stringify(after)},issues,negative);
 }
 for(const v of oracle.vectors)for(let i=0;i<10;i++){const actual=hx(e.mmx_binop(BigInt('0x'+v.input),countFor(v,i),v.sub));direct.push({op:v.op,count:countFor(v,i).toString(16),actual,expected:v.expected[i],pass:actual===v.expected[i]});}
 // First establish plain code32 arithmetic, then systematically vary admission.
 for(const addr67 of [0,1])for(const v of oracle.vectors){
  for(const flag of [0x202,0xad7,0x646])for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(let ci=0;ci<10;ci++)for(const cached of [false,true])execute(v,ci,dst,src,addr67,'rr',0,flag,cached);
  // All imm8 values: nonboundary values below width need independent literals,
  // so exercise boundary0/1/width-1 and every saturating imm8 width..255.
  for(const flag of [0x202,0xad7,0x646])for(let dst=0;dst<8;dst++)for(const c of [0,1,v.width-1,...Array.from({length:256-v.width},(_,i)=>v.width+i)])for(const cached of [false,true])execute(v,BigInt(c),dst,0,addr67,'rr',0,flag,cached,true);
  const a16=!!(mode&&!big)!==!!addr67,forms=a16?Array.from({length:8},(_,rm)=>[0,1,2].flatMap(mod=>(mod===0?[0]:mod===1?[-128,127]:[-32768,32767]).map(disp=>({rm,mod,disp})))).flat():['abs','disp8','disp32','sib','sib-ss','sib-abs'];
  for(const form of forms.filter(f=>mode||!a16||(f.rm===6&&f.mod===0)))for(const seg of !mode&&a16?[0x64]:[0,0x64,0x2e,0x36,0x3e])for(let dst=0;dst<8;dst++)for(let ci=0;ci<10;ci++)for(const cached of [false,true])execute(v,ci,dst,0,addr67,form,seg,0xad7,cached);
  for(const prefix of [[0x66],[0xf2],[0xf3],[0xf0],[0xf3,0x66],[0x66,0xf2]])for(const immediate of [false,true])for(const form of ['rr',a16?{rm:6,mod:0,disp:0}:'abs'])for(let dst=0;dst<8;dst++)execute(v,1,dst,7,addr67,form,form==='rr'?0:0x64,0xad7,false,immediate,prefix,true);
  // Immediate m64 encodings are never legal, even with a valid shift digit.
  for(const digit of [0,1,2,3,4,5,6,7])for(const form of ['rr',a16?{rm:6,mod:0,disp:0}:'abs']){
   if(form==='rr'&&([2,6].includes(digit)||(digit===4&&v.group!==0x73)))continue;
   execute(v,1,3,0,addr67,form,form==='rr'?0:0x64,0xad7,false,true,[],true,digit);
  }
 }
 // Bad FS operands detect attempted reads as well as architectural writes.
 for(const v of oracle.vectors)for(const addr67 of [0,1]){
  const a16=!!(mode&&!big)!==!!addr67,form=a16?{rm:6,mod:0,disp:0}:'abs';
  for(const prefix of [[0x66],[0xf2],[0xf3],[0xf0]])for(const immediate of [false,true])
   execute(v,1,0,1,addr67,form,0x64,0xad7,false,immediate,prefix,true,v.digit,true);
  for(let digit=0;digit<8;digit++)execute(v,1,0,1,addr67,form,0x64,0xad7,false,true,[],true,digit,true);
 }
 const result={at:new Date().toISOString(),moduleSha256:sha(bytes),mode,big,seam,oracleSha256:sha(JSON.stringify(oracle)),direct:{count:direct.length,failed:direct.filter(x=>!x.pass).length,failures:direct.filter(x=>!x.pass)},cases,failed,rejected,rejectionFailed,groups,failures,controls,limits:'Immediate values2..width-2 omitted; three boundary and all saturating imm8 values covered. Exact production full decoder code32; retained setup/observation seam for code16/XMM/flags. No Windows/Wine/hardware/game reference.'};
 if(outPath)fs.writeFileSync(outPath,JSON.stringify(result,null,2));console.log(JSON.stringify({moduleSha256:result.moduleSha256,mode,big,seam,cases,failed,rejected,rejectionFailed,directFailed:result.direct.failed}));
 assert.equal(failed,0,JSON.stringify(failures));assert.equal(rejectionFailed,0,JSON.stringify(controls));assert.equal(result.direct.failed,0);
}
if(require.main===module)main().catch(err=>{console.error(err);process.exitCode=1;});
