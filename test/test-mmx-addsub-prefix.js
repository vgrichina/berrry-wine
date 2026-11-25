'use strict';
// Decoder fixture. Expected answers are literals frozen in oracle.json; no
// production helper or generated arithmetic model computes expected results.
const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
// Frozen literal Intel oracle retained from prefix baseline.
const oracle={
  "basis": "Independent literal arithmetic edge answers, hand specified per lane width. NP MMX supported; actual 66/F2/F3 alternative encodings excluded from MMX admission; LOCK invalid. This is spec-literal/source-knowledge inference, not Windows/Wine/VM/hardware reference. Opcode/subop identifiers informed by existing source; expected arithmetic never computed from production.",
  "vectors": [
    {
      "op": "PADDB",
      "opcode": 252,
      "sub": 32,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0101010101010101",
      "expected": "0000000000000000",
      "selfExpected": "fefefefefefefefe"
    },
    {
      "op": "PADDB",
      "opcode": 252,
      "sub": 32,
      "edge": 1,
      "input": "7f7f7f7f7f7f7f7f",
      "rhs": "0101010101010101",
      "expected": "8080808080808080",
      "selfExpected": "fefefefefefefefe"
    },
    {
      "op": "PADDB",
      "opcode": 252,
      "sub": 32,
      "edge": 2,
      "input": "8080808080808080",
      "rhs": "0101010101010101",
      "expected": "8181818181818181",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PADDB",
      "opcode": 252,
      "sub": 32,
      "edge": 3,
      "input": "8080808080808080",
      "rhs": "ffffffffffffffff",
      "expected": "7f7f7f7f7f7f7f7f",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PADDW",
      "opcode": 253,
      "sub": 33,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0001000100010001",
      "expected": "0000000000000000",
      "selfExpected": "fffefffefffefffe"
    },
    {
      "op": "PADDW",
      "opcode": 253,
      "sub": 33,
      "edge": 1,
      "input": "7fff7fff7fff7fff",
      "rhs": "0001000100010001",
      "expected": "8000800080008000",
      "selfExpected": "fffefffefffefffe"
    },
    {
      "op": "PADDW",
      "opcode": 253,
      "sub": 33,
      "edge": 2,
      "input": "8000800080008000",
      "rhs": "0001000100010001",
      "expected": "8001800180018001",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PADDW",
      "opcode": 253,
      "sub": 33,
      "edge": 3,
      "input": "8000800080008000",
      "rhs": "ffffffffffffffff",
      "expected": "7fff7fff7fff7fff",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PADDD",
      "opcode": 254,
      "sub": 34,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0000000100000001",
      "expected": "0000000000000000",
      "selfExpected": "fffffffefffffffe"
    },
    {
      "op": "PADDD",
      "opcode": 254,
      "sub": 34,
      "edge": 1,
      "input": "7fffffff7fffffff",
      "rhs": "0000000100000001",
      "expected": "8000000080000000",
      "selfExpected": "fffffffefffffffe"
    },
    {
      "op": "PADDD",
      "opcode": 254,
      "sub": 34,
      "edge": 2,
      "input": "8000000080000000",
      "rhs": "0000000100000001",
      "expected": "8000000180000001",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PADDD",
      "opcode": 254,
      "sub": 34,
      "edge": 3,
      "input": "8000000080000000",
      "rhs": "ffffffffffffffff",
      "expected": "7fffffff7fffffff",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PADDQ",
      "opcode": 212,
      "sub": 35,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0000000000000001",
      "expected": "0000000000000000",
      "selfExpected": "fffffffffffffffe"
    },
    {
      "op": "PADDQ",
      "opcode": 212,
      "sub": 35,
      "edge": 1,
      "input": "7fffffffffffffff",
      "rhs": "0000000000000001",
      "expected": "8000000000000000",
      "selfExpected": "fffffffffffffffe"
    },
    {
      "op": "PADDQ",
      "opcode": 212,
      "sub": 35,
      "edge": 2,
      "input": "8000000000000000",
      "rhs": "0000000000000001",
      "expected": "8000000000000001",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PADDQ",
      "opcode": 212,
      "sub": 35,
      "edge": 3,
      "input": "8000000000000000",
      "rhs": "ffffffffffffffff",
      "expected": "7fffffffffffffff",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBB",
      "opcode": 248,
      "sub": 36,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0101010101010101",
      "expected": "fefefefefefefefe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBB",
      "opcode": 248,
      "sub": 36,
      "edge": 1,
      "input": "7f7f7f7f7f7f7f7f",
      "rhs": "0101010101010101",
      "expected": "7e7e7e7e7e7e7e7e",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBB",
      "opcode": 248,
      "sub": 36,
      "edge": 2,
      "input": "8080808080808080",
      "rhs": "0101010101010101",
      "expected": "7f7f7f7f7f7f7f7f",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBB",
      "opcode": 248,
      "sub": 36,
      "edge": 3,
      "input": "8080808080808080",
      "rhs": "ffffffffffffffff",
      "expected": "8181818181818181",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBW",
      "opcode": 249,
      "sub": 37,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0001000100010001",
      "expected": "fffefffefffefffe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBW",
      "opcode": 249,
      "sub": 37,
      "edge": 1,
      "input": "7fff7fff7fff7fff",
      "rhs": "0001000100010001",
      "expected": "7ffe7ffe7ffe7ffe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBW",
      "opcode": 249,
      "sub": 37,
      "edge": 2,
      "input": "8000800080008000",
      "rhs": "0001000100010001",
      "expected": "7fff7fff7fff7fff",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBW",
      "opcode": 249,
      "sub": 37,
      "edge": 3,
      "input": "8000800080008000",
      "rhs": "ffffffffffffffff",
      "expected": "8001800180018001",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBD",
      "opcode": 250,
      "sub": 38,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0000000100000001",
      "expected": "fffffffefffffffe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBD",
      "opcode": 250,
      "sub": 38,
      "edge": 1,
      "input": "7fffffff7fffffff",
      "rhs": "0000000100000001",
      "expected": "7ffffffe7ffffffe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBD",
      "opcode": 250,
      "sub": 38,
      "edge": 2,
      "input": "8000000080000000",
      "rhs": "0000000100000001",
      "expected": "7fffffff7fffffff",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBD",
      "opcode": 250,
      "sub": 38,
      "edge": 3,
      "input": "8000000080000000",
      "rhs": "ffffffffffffffff",
      "expected": "8000000180000001",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBQ",
      "opcode": 251,
      "sub": 39,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0000000000000001",
      "expected": "fffffffffffffffe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBQ",
      "opcode": 251,
      "sub": 39,
      "edge": 1,
      "input": "7fffffffffffffff",
      "rhs": "0000000000000001",
      "expected": "7ffffffffffffffe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBQ",
      "opcode": 251,
      "sub": 39,
      "edge": 2,
      "input": "8000000000000000",
      "rhs": "0000000000000001",
      "expected": "7fffffffffffffff",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBQ",
      "opcode": 251,
      "sub": 39,
      "edge": 3,
      "input": "8000000000000000",
      "rhs": "ffffffffffffffff",
      "expected": "8000000000000001",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PADDSB",
      "opcode": 236,
      "sub": 40,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0101010101010101",
      "expected": "0000000000000000",
      "selfExpected": "fefefefefefefefe"
    },
    {
      "op": "PADDSB",
      "opcode": 236,
      "sub": 40,
      "edge": 1,
      "input": "7f7f7f7f7f7f7f7f",
      "rhs": "0101010101010101",
      "expected": "7f7f7f7f7f7f7f7f",
      "selfExpected": "7f7f7f7f7f7f7f7f"
    },
    {
      "op": "PADDSB",
      "opcode": 236,
      "sub": 40,
      "edge": 2,
      "input": "8080808080808080",
      "rhs": "0101010101010101",
      "expected": "8181818181818181",
      "selfExpected": "8080808080808080"
    },
    {
      "op": "PADDSB",
      "opcode": 236,
      "sub": 40,
      "edge": 3,
      "input": "8080808080808080",
      "rhs": "ffffffffffffffff",
      "expected": "8080808080808080",
      "selfExpected": "8080808080808080"
    },
    {
      "op": "PADDSW",
      "opcode": 237,
      "sub": 41,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0001000100010001",
      "expected": "0000000000000000",
      "selfExpected": "fffefffefffefffe"
    },
    {
      "op": "PADDSW",
      "opcode": 237,
      "sub": 41,
      "edge": 1,
      "input": "7fff7fff7fff7fff",
      "rhs": "0001000100010001",
      "expected": "7fff7fff7fff7fff",
      "selfExpected": "7fff7fff7fff7fff"
    },
    {
      "op": "PADDSW",
      "opcode": 237,
      "sub": 41,
      "edge": 2,
      "input": "8000800080008000",
      "rhs": "0001000100010001",
      "expected": "8001800180018001",
      "selfExpected": "8000800080008000"
    },
    {
      "op": "PADDSW",
      "opcode": 237,
      "sub": 41,
      "edge": 3,
      "input": "8000800080008000",
      "rhs": "ffffffffffffffff",
      "expected": "8000800080008000",
      "selfExpected": "8000800080008000"
    },
    {
      "op": "PSUBSB",
      "opcode": 232,
      "sub": 44,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0101010101010101",
      "expected": "fefefefefefefefe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBSB",
      "opcode": 232,
      "sub": 44,
      "edge": 1,
      "input": "7f7f7f7f7f7f7f7f",
      "rhs": "0101010101010101",
      "expected": "7e7e7e7e7e7e7e7e",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBSB",
      "opcode": 232,
      "sub": 44,
      "edge": 2,
      "input": "8080808080808080",
      "rhs": "0101010101010101",
      "expected": "8080808080808080",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBSB",
      "opcode": 232,
      "sub": 44,
      "edge": 3,
      "input": "8080808080808080",
      "rhs": "ffffffffffffffff",
      "expected": "8181818181818181",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBSW",
      "opcode": 233,
      "sub": 45,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0001000100010001",
      "expected": "fffefffefffefffe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBSW",
      "opcode": 233,
      "sub": 45,
      "edge": 1,
      "input": "7fff7fff7fff7fff",
      "rhs": "0001000100010001",
      "expected": "7ffe7ffe7ffe7ffe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBSW",
      "opcode": 233,
      "sub": 45,
      "edge": 2,
      "input": "8000800080008000",
      "rhs": "0001000100010001",
      "expected": "8000800080008000",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBSW",
      "opcode": 233,
      "sub": 45,
      "edge": 3,
      "input": "8000800080008000",
      "rhs": "ffffffffffffffff",
      "expected": "8001800180018001",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PADDUSB",
      "opcode": 220,
      "sub": 48,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0101010101010101",
      "expected": "ffffffffffffffff",
      "selfExpected": "ffffffffffffffff"
    },
    {
      "op": "PADDUSB",
      "opcode": 220,
      "sub": 48,
      "edge": 1,
      "input": "7f7f7f7f7f7f7f7f",
      "rhs": "0101010101010101",
      "expected": "8080808080808080",
      "selfExpected": "fefefefefefefefe"
    },
    {
      "op": "PADDUSB",
      "opcode": 220,
      "sub": 48,
      "edge": 2,
      "input": "8080808080808080",
      "rhs": "0101010101010101",
      "expected": "8181818181818181",
      "selfExpected": "ffffffffffffffff"
    },
    {
      "op": "PADDUSB",
      "opcode": 220,
      "sub": 48,
      "edge": 3,
      "input": "8080808080808080",
      "rhs": "ffffffffffffffff",
      "expected": "ffffffffffffffff",
      "selfExpected": "ffffffffffffffff"
    },
    {
      "op": "PADDUSW",
      "opcode": 221,
      "sub": 49,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0001000100010001",
      "expected": "ffffffffffffffff",
      "selfExpected": "ffffffffffffffff"
    },
    {
      "op": "PADDUSW",
      "opcode": 221,
      "sub": 49,
      "edge": 1,
      "input": "7fff7fff7fff7fff",
      "rhs": "0001000100010001",
      "expected": "8000800080008000",
      "selfExpected": "fffefffefffefffe"
    },
    {
      "op": "PADDUSW",
      "opcode": 221,
      "sub": 49,
      "edge": 2,
      "input": "8000800080008000",
      "rhs": "0001000100010001",
      "expected": "8001800180018001",
      "selfExpected": "ffffffffffffffff"
    },
    {
      "op": "PADDUSW",
      "opcode": 221,
      "sub": 49,
      "edge": 3,
      "input": "8000800080008000",
      "rhs": "ffffffffffffffff",
      "expected": "ffffffffffffffff",
      "selfExpected": "ffffffffffffffff"
    },
    {
      "op": "PSUBUSB",
      "opcode": 216,
      "sub": 52,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0101010101010101",
      "expected": "fefefefefefefefe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBUSB",
      "opcode": 216,
      "sub": 52,
      "edge": 1,
      "input": "7f7f7f7f7f7f7f7f",
      "rhs": "0101010101010101",
      "expected": "7e7e7e7e7e7e7e7e",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBUSB",
      "opcode": 216,
      "sub": 52,
      "edge": 2,
      "input": "8080808080808080",
      "rhs": "0101010101010101",
      "expected": "7f7f7f7f7f7f7f7f",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBUSB",
      "opcode": 216,
      "sub": 52,
      "edge": 3,
      "input": "8080808080808080",
      "rhs": "ffffffffffffffff",
      "expected": "0000000000000000",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBUSW",
      "opcode": 217,
      "sub": 53,
      "edge": 0,
      "input": "ffffffffffffffff",
      "rhs": "0001000100010001",
      "expected": "fffefffefffefffe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBUSW",
      "opcode": 217,
      "sub": 53,
      "edge": 1,
      "input": "7fff7fff7fff7fff",
      "rhs": "0001000100010001",
      "expected": "7ffe7ffe7ffe7ffe",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBUSW",
      "opcode": 217,
      "sub": 53,
      "edge": 2,
      "input": "8000800080008000",
      "rhs": "0001000100010001",
      "expected": "7fff7fff7fff7fff",
      "selfExpected": "0000000000000000"
    },
    {
      "op": "PSUBUSW",
      "opcode": 217,
      "sub": 53,
      "edge": 3,
      "input": "8000800080008000",
      "rhs": "ffffffffffffffff",
      "expected": "0000000000000000",
      "selfExpected": "0000000000000000"
    }
  ]
};
const {setupWat}=require('./test-mmx-move-prefix');
module.exports={setupWat};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const mode=Number(process.env.ADDSUB_CODE16||0),big=Number(process.env.ADDSUB_CS_BIG||0),outPath=process.env.PROBE_OUT;

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

 const groups={},failures=[],controls=[],direct=[];let cases=0,failed=0,rejected=0,rejectionFailed=0,badReads=0,preservationFailures=0;
 function execute(v,dst,src,addr67,form,seg,flag,cached,prefix=[],negative=false,bad=false){
  const c=BigInt('0x'+v.rhs),s=init(v,c,dst,src,form,flag),a16=!!(mode&&!big)!==!!addr67;
  const enc=encode(dst,src,addr67,form,s.gp,seg);
  const code=[...prefix,...(addr67?[0x67]:[]),...(seg?[seg]:[]),0x0f,v.opcode,...enc.operand,0xf4];
  if(!cached)put(code);
  if(enc.addr!==null){fill(enc.addr-8,24,0x6b);qwrite(enc.addr,c);}
  const source=enc.addr===null?null:snap(enc.addr-8,24),inputBefore=snap(input-8,208);
  if(bad)e.set_fs_base(0xdead0000);
  regs.forEach((r,i)=>e['set_'+r](s.gp[i]));const before=state(),u=unmapped;let trap=null;
  try{run();}catch(err){trap=String(err.message);}
  const after=state(),issues=[],expected=s.mm.slice();
  if(!negative){expected[dst]=form==='rr'&&src===dst?v.selfExpected:v.expected;
   if(trap)issues.push('trap:'+trap);if(JSON.stringify(after.mm)!==JSON.stringify(expected))issues.push('MMX');
  }else{if(!trap)issues.push('accepted');if(JSON.stringify(before.mm)!==JSON.stringify(after.mm))issues.push('MMX-write');}
  if(JSON.stringify(before.flags)!==JSON.stringify(after.flags))issues.push('flags/TOP/tag');if(before.xmm!==after.xmm)issues.push('XMM-write');
  if(regs.some((r,i)=>(e['get_'+r]()>>>0)!==s.gp[i]))issues.push('GPR-write');
  if(!snap(input-8,208).equals(inputBefore))issues.push('input-write');if(source&&!snap(enc.addr-8,24).equals(source))issues.push('operand/neighbor-write');
  if(!snap(out-8,8).equals(Buffer.alloc(8,0x73))||!snap(out+192,8).equals(Buffer.alloc(8,0x73)))issues.push('output-guards');
  if(unmapped!==u){issues.push('operand-read:'+String(unmapped-u));if(bad)badReads++;}
  const preserved=after.mm.every((x,i)=>i===dst||x===before.mm[i])&&JSON.stringify(before.flags)===JSON.stringify(after.flags)&&before.xmm===after.xmm&&!issues.some(x=>/GPR|input-write|neighbor|guards/.test(x));if(!preserved)preservationFailures++;
  const label=negative?v.op+'/reject/'+prefix.map(x=>x.toString(16)).join('+')+'/67='+addr67+'/bad='+bad:v.op+'/'+(form==='rr'?'rr':a16?'ea16':'ea32')+'/67='+addr67+'/seg='+seg+'/cache='+cached;
  const row=groups[label]||={count:0,failed:0};row.count++;if(negative)rejected++;else cases++;
  if(issues.length){row.failed++;if(negative)rejectionFailed++;else failed++;const dest=negative?controls:failures;if(dest.filter(x=>x.label===label).length<2&&dest.length<1024)dest.push({label,op:v.op,edge:v.edge,mode,big,dst,src,form,seg,prefix,code:Buffer.from(code).toString('hex'),expected:expected[dst],actual:after.mm[dst],trapped:!!trap,unmapped:unmapped-u,preserved,issues});}
 }
 for(const v of oracle.vectors){const actual=hx(e.mmx_binop(BigInt('0x'+v.input),BigInt('0x'+v.rhs),v.sub));direct.push({op:v.op,edge:v.edge,actual,expected:v.expected,pass:actual===v.expected});const self=hx(e.mmx_binop(BigInt('0x'+v.input),BigInt('0x'+v.input),v.sub));direct.push({op:v.op,edge:v.edge,actual:self,expected:v.selfExpected,pass:self===v.selfExpected,self:true});}
 for(const addr67 of [0,1])for(const v of oracle.vectors){
  for(const flag of [0x202,0xad7,0x646])for(let dst=0;dst<8;dst++)for(let src=0;src<8;src++)for(const cached of [false,true])execute(v,dst,src,addr67,'rr',0,flag,cached);
  const a16=!!(mode&&!big)!==!!addr67,forms=a16?Array.from({length:8},(_,rm)=>[0,1,2].flatMap(mod=>(mod===0?[0]:mod===1?[-128,127]:[-32768,32767]).map(disp=>({rm,mod,disp})))).flat():['abs','disp8','disp32','sib','sib-ss','sib-abs'];
  for(const form of forms.filter(f=>mode||!a16||(f.rm===6&&f.mod===0)))for(const seg of !mode&&a16?[0x64]:[0,0x64,0x2e,0x36,0x3e])for(let dst=0;dst<8;dst++)for(const cached of [false,true])execute(v,dst,0,addr67,form,seg,0xad7,cached);
  if(v.edge===1)for(const prefix of [[0x66],[0xf2],[0xf3],[0xf0],[0xf3,0x66],[0x66,0xf2]])for(const form of ['rr',a16?{rm:6,mod:0,disp:0}:'abs'])for(let dst=0;dst<8;dst++)for(const bad of form==='rr'?[false]:[false,true])execute(v,dst,7,addr67,form,form==='rr'?0:0x64,0xad7,false,prefix,true,bad);
 }
 const result={at:new Date().toISOString(),moduleSha256:sha(bytes),mode,big,seam,oracleSha256:sha(JSON.stringify(oracle)),direct:{count:direct.length,failed:direct.filter(x=>!x.pass).length,failures:direct.filter(x=>!x.pass)},cases,failed,rejected,rejectionFailed,badReads,preservationFailures,groups,failures,controls,limits:'Four uniform-lane literal edge pairs per opcode; all MMX rr pairs incl alias, three flag patterns, fresh/cache, address67, EA32 six forms/EA16 40 forms with five segment selections except code32 EA16 only absolute FS. No claim of exhaustive arithmetic or prefix combinations. Actual66 SSE2 alternatives unsupported by this production decoder, expected fail-closed without MMX/XMM changes. Exact production code32; retained observation seam for code16/XMM/flags. No Windows/Wine/hardware/game reference.'};
 if(outPath)fs.writeFileSync(outPath,JSON.stringify(result,null,2));console.log(JSON.stringify({moduleSha256:result.moduleSha256,mode,big,seam,cases,failed,rejected,rejectionFailed,badReads,preservationFailures,directFailed:result.direct.failed}));
 assert.equal(failed,0,JSON.stringify(failures));assert.equal(rejectionFailed,0,JSON.stringify(controls));assert.equal(result.direct.failed,0);
}
if(require.main===module)main().catch(err=>{console.error(err);process.exitCode=2;});
