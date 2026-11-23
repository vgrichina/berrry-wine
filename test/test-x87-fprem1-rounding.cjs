'use strict';
// Intel SDM Vol. 2, FPREM1: nearest-even quotient, independent of CW.RC.
// Only small exact finite operands and complete reductions are covered here.
// https://cdrdv2-public.intel.com/671110/325383-sdm-vol-2abcd.pdf
const assert = require('assert');
const fs = require('fs');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

// Test-only state setup/inspection. The instruction itself always goes through
// literal x86 bytes, the normal decoder and the execution dispatcher.
const extra = `
(func (export "test_seed") (param $cw i32) (param $sw i32) (param $top i32)
 (global.set $fpu_cw (local.get $cw))
 (global.set $fpu_sw (local.get $sw))
 (global.set $fpu_top (local.get $top))
 (global.set $flag_op (i32.const 8)) (global.set $flag_a (i32.const 1))
 (global.set $flag_b (i32.const 0)) (global.set $flag_res (i32.const -1))
 (global.set $saved_cf (i32.const 1)) (global.set $flag_sign_shift (i32.const 31)))
(func (export "test_put") (param $i i32) (param $v f64)
 (call $fpu_set (local.get $i) (local.get $v)))
(func (export "test_st") (param $i i32) (result f64) (call $fpu_get (local.get $i)))
(func (export "test_cw") (result i32) (global.get $fpu_cw))
(func (export "test_saved_cf") (result i32) (global.get $saved_cf))
(func (export "test_flags") (result i32)
 (i32.or (call $get_cf)
  (i32.or (i32.shl (call $get_pf) (i32.const 2))
   (i32.or (i32.shl (call $get_zf) (i32.const 6))
    (i32.or (i32.shl (call $get_sf) (i32.const 7))
     (i32.shl (call $get_of) (i32.const 11)))))))
`;

// Literal oracle: dividend, divisor, FPREM1 remainder/condition bits,
// FPREM remainder/condition bits. Halfway quotients have both even and odd
// integer neighbors; non-halfway cases distinguish nearest from truncation.
// C0=Q2, C1=Q0, C3=Q1 (magnitude bits); completed reduction clears C2.
const rows = [
  [1,4,1,0,1,0], [1,-4,1,0,1,0],
  [-1,4,-1,0,-1,0], [-1,-4,-1,0,-1,0],
  [3,4,-1,0x0200,3,0], [3,-4,-1,0x0200,3,0],
  [-3,4,1,0x0200,-3,0], [-3,-4,1,0x0200,-3,0],
  [5,2,1,0x4000,1,0x4000], [5,-2,1,0x4000,1,0x4000],
  [-5,2,-1,0x4000,-1,0x4000], [-5,-2,-1,0x4000,-1,0x4000],
  [7,2,-1,0x0100,1,0x4200], [7,-2,-1,0x0100,1,0x4200],
  [-7,2,1,0x0100,-1,0x4200], [-7,-2,1,0x0100,-1,0x4200],
  [9,2,1,0x0100,1,0x0100], [9,-2,1,0x0100,1,0x0100],
  [-9,2,-1,0x0100,-1,0x0100], [-9,-2,-1,0x0100,-1,0x0100],
  [11,2,-1,0x4100,1,0x0300], [11,-2,-1,0x4100,1,0x0300],
  [-11,2,1,0x4100,-1,0x0300], [-11,-2,1,0x4100,-1,0x0300],
  [13,2,1,0x4100,1,0x4100], [13,-2,1,0x4100,1,0x4100],
  [-13,2,-1,0x4100,-1,0x4100], [-13,-2,-1,0x4100,-1,0x4100],
  [15,2,-1,0,1,0x4300], [15,-2,-1,0,1,0x4300],
  [-15,2,1,0,-1,0x4300], [-15,-2,1,0,-1,0x4300],
  [17,4,1,0x0100,1,0x0100], [17,-4,1,0x0100,1,0x0100],
  [-17,4,-1,0x0100,-1,0x0100], [-17,-4,-1,0x0100,-1,0x0100],
  [23,4,-1,0x4100,3,0x0300], [23,-4,-1,0x4100,3,0x0300],
  [-23,4,1,0x4100,-3,0x0300], [-23,-4,1,0x4100,-3,0x0300],
];
// x, RC0..RC3 result and C1: FRNDINT must remain RC-sensitive.
const rounding = [
  [2.5,[2,2,3,2],[0,0,0x200,0]],
  [3.5,[4,3,4,3],[0x200,0,0x200,0]],
  [-2.5,[-2,-3,-2,-2],[0x200,0,0x200,0x200]],
  [-3.5,[-4,-4,-3,-3],[0,0,0x200,0x200]],
  [2.75,[3,2,3,2],[0x200,0,0x200,0]],
  [-2.75,[-3,-3,-2,-2],[0,0,0x200,0x200]],
];

async function main() {
  const bytes = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extra : source);
  const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const ctx = {exports:null,getMemory:()=>memory.buffer};
  const {host} = createHostImports(ctx);
  Object.assign(host,{memory,log:()=>{},log_i32:()=>{},exit:()=>{},
    crash_unimplemented:()=>{throw Error('unexpected unimplemented opcode');},
    wait_multiple:()=>0,shell_execute:()=>33});
  const {instance} = await WebAssembly.instantiate(bytes,{host});
  const e = ctx.exports = instance.exports;
  const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
  const exe = fs.readFileSync(__dirname+'/binaries/notepad.exe');
  mem.set(exe,e.get_staging()); assert(e.load_pe(exe.length),'fixture PE load');
  const base = e.get_image_base() >>> 0;
  const g = a => e.guest_to_wasm(a) >>> 0;
  const stack = base+0xd00000;
  let code = base+0x100000, calls = 0, failures = 0;
  const perRC = [0,0,0,0], perOp = {FPREM1:0,FPREM:0,FRNDINT:0};
  const regs = ['eax','ecx','edx','ebx','ebp','esi','edi'];
  const flags = () => [e.get_flag_op(),e.get_flag_a(),e.get_flag_b(),
    e.get_flag_res(),e.get_flag_sign_shift(),e.test_saved_cf(),e.test_flags()];
  function execute(op, opcode, x, y, result, wantSW, rc, top, stale) {
    const cw = 0x037f | (rc << 10), sw = 0x80a5 | stale;
    e.test_seed(cw,sw,top);
    const bank = [x,y,19.25,-20.5,21.75,-22.25,23.5,-24.75];
    bank.forEach((v,i)=>e.test_put(i,v));
    regs.forEach((r,i)=>e['set_'+r](0x12345000+i*0x101));
    e.set_esp(stack); dv.setUint32(g(stack),0,true);
    const beforeFlags = flags(), beforeRegs = regs.map(r=>e['get_'+r]());
    const tags = e.get_fpu_tags();
    mem.set([0xd9,opcode,0xc3],g(code)); e.set_eip(code); e.run(100000);
    const label = `${op} ${x}/${y} RC${rc} TOP${top} SW${sw.toString(16)}`;
    assert.strictEqual(e.get_eip(),0,label+' returned');
    assert.strictEqual(e.get_esp(),stack+4,label+' return stack');
    assert.deepStrictEqual(regs.map(r=>e['get_'+r]()),beforeRegs,label+' registers');
    assert.deepStrictEqual(flags(),beforeFlags,label+' flags');
    assert.strictEqual(e.test_cw(),cw,label+' CW');
    assert.strictEqual(e.get_fpu_top(),top,label+' TOP');
    assert.strictEqual(e.get_fpu_tags(),tags,label+' tags');
    for(let i=1;i<8;i++) assert.strictEqual(e.test_st(i),bank[i],label+' ST'+i);
    assert.strictEqual(e.get_fpu_sw() & 0xb8ff,sw & 0xb8ff,label+' unrelated SW');
    const got = e.test_st(0), gotSW = e.get_fpu_sw();
    if (!Object.is(got,result) || gotSW !== wantSW) {
      failures++; perRC[rc]++; perOp[op]++;
      console.error(`FAIL ${label}: ST0=${got} want=${result}; SW=0x${gotSW.toString(16)} want=0x${wantSW.toString(16)}`);
    }
    calls++; code += 16;
  }
  for(const rc of [0,1,2,3]) for(const top of [0,3,7]) for(const stale of [0,0x4700]) {
    for(const [x,y,r,cc,t,tc] of rows) {
      execute('FPREM1',0xf5,x,y,r,0x80a5|cc,rc,top,stale);
      execute('FPREM',0xf8,x,y,t,0x80a5|tc,rc,top,stale);
    }
    for(const [x,results,c1] of rounding) {
      execute('FRNDINT',0xfc,x,4,results[rc],0x80a5|(stale&0x4500)|c1[rc],rc,top,stale);
    }
  }
  console.log(JSON.stringify({calls,failures,perRC,perOp}));
  assert.strictEqual(failures,0,'literal x87 rounding matrices');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
