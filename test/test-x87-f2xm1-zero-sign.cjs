'use strict';
// Intel SDM Vol. 2A, F2XM1 Table 3-16, p. 3-357: -0 -> -0, +0 -> +0.
// https://cdrdv2-public.intel.com/671110/325383-sdm-vol-2abcd.pdf
// Finite in-domain controls only; this is not a transcendental accuracy test.
const assert = require('assert');
const fs = require('fs');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

// Only state setup/inspection uses test exports. Execute literal D9 F0 through
// the real x86 decoder and dispatcher, with RET to inspect the resulting state.
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

// Independent literal binary64 expectations for exact results. The +/-0.5
// controls use mathematical sqrt(2)-1 and 1/sqrt(2)-1 literals with a small
// absolute tolerance, allowing the existing pow2/subtraction rounding.
const rows = [
 [0, '0000000000000000'],
 [-0, '8000000000000000'],
 [-1, 'bfe0000000000000'],
 [1, '3ff0000000000000'],
 [-0.5, null, -0.2928932188134524755991556378951509607],
 [0.5, null, 0.4142135623730950488016887242096980786],
];
const bitsBuffer = new DataView(new ArrayBuffer(8));
function bits(value) {
 bitsBuffer.setFloat64(0, value, false);
 return bitsBuffer.getBigUint64(0, false).toString(16).padStart(16, '0');
}

async function main() {
 const bytes = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extra : source);
 const memory = new WebAssembly.Memory({initial:8192, maximum:8192, shared:true});
 const ctx = {exports:null, getMemory:()=>memory.buffer};
 const {host} = createHostImports(ctx);
 Object.assign(host, {memory, log:()=>{}, log_i32:()=>{}, exit:()=>{},
  crash_unimplemented:()=>{throw Error('unexpected unimplemented opcode');},
  wait_multiple:()=>0, shell_execute:()=>33});
 const {instance} = await WebAssembly.instantiate(bytes, {host});
 const e = ctx.exports = instance.exports;
 const mem = new Uint8Array(memory.buffer), dv = new DataView(memory.buffer);
 const exe = fs.readFileSync(__dirname + '/binaries/notepad.exe');
 mem.set(exe, e.get_staging()); assert(e.load_pe(exe.length), 'fixture PE load');
 const base = e.get_image_base() >>> 0, g = a => e.guest_to_wasm(a) >>> 0;
 const stack = base + 0xd00000;
 let code = base + 0x100000, calls = 0, failures = 0;
 const perRC = [0,0,0,0], perInput = {};
 const regs = ['eax','ecx','edx','ebx','ebp','esi','edi'];
 const flags = () => [e.get_flag_op(), e.get_flag_a(), e.get_flag_b(),
  e.get_flag_res(), e.get_flag_sign_shift(), e.test_saved_cf(), e.test_flags()];
 for (const rc of [0,1,2,3]) for (let top = 0; top < 8; top++) {
  for (const stale of [0,0x4700]) for (const [x, expectedBits, expectedValue] of rows) {
   const cw = 0x037f | (rc << 10), sw = 0x80a5 | stale;
   e.test_seed(cw, sw, top);
   const bank = [x, -0, 19.25, -20.5, 21.75, -22.25, 23.5, -24.75];
   bank.forEach((v,i)=>e.test_put(i,v));
   regs.forEach((r,i)=>e['set_'+r](0x12345000+i*0x101));
   e.set_esp(stack); dv.setUint32(g(stack),0,true);
   const beforeFlags = flags(), beforeRegs = regs.map(r=>e['get_'+r]());
   assert.notStrictEqual(beforeFlags[0],0,'nonzero lazy flag operation');
   const tags = e.get_fpu_tags();
   mem.set([0xd9,0xf0,0xc3],g(code)); e.set_eip(code); e.run(100000);
   const input = Object.is(x,-0) ? '-0' : String(x);
   const label = `F2XM1 ${input} RC${rc} TOP${top} SW${sw.toString(16)}`;
   assert.strictEqual(e.get_eip(),0,label+' returned');
   assert.strictEqual(e.get_esp(),stack+4,label+' return stack');
   assert.deepStrictEqual(regs.map(r=>e['get_'+r]()),beforeRegs,label+' registers');
   assert.deepStrictEqual(flags(),beforeFlags,label+' flags');
   assert.strictEqual(e.test_cw(),cw,label+' CW');
   assert.strictEqual(e.get_fpu_top(),top,label+' TOP');
   assert.strictEqual(e.get_fpu_tags(),tags,label+' tags');
   for (let i=1;i<8;i++) assert.strictEqual(bits(e.test_st(i)),bits(bank[i]),label+' ST'+i);
   // C0/C2/C3 are undefined and C1 concerns rounding; unrelated status is
   // preserved. Do not impose new condition-code behavior on this correction.
   assert.strictEqual(e.get_fpu_sw() & 0xb8ff,sw & 0xb8ff,label+' unrelated SW');
   const got = e.test_st(0);
   const ok = expectedBits !== null ? bits(got) === expectedBits :
    Number.isFinite(got) && Math.abs(got-expectedValue) <= 2e-16;
   if (!ok) {
    failures++; perRC[rc]++; perInput[input] = (perInput[input] || 0)+1;
    console.error(`FAIL ${label}: ST0bits=${bits(got)} want=${expectedBits ?? expectedValue}`);
   }
   calls++; code += 16;
  }
 }
 console.log(JSON.stringify({calls,failures,perRC,perInput}));
 assert.strictEqual(failures,0,'F2XM1 literal signed-zero and finite controls');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
