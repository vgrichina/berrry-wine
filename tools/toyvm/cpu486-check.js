#!/usr/bin/env node
'use strict';

// Literal instruction controls for the baseline (pre-CPUID) 486, and the
// same probes on a 386. No host CPU-family answer participates in these tests.
const assert = require('node:assert/strict');
const { makeVm } = require('./vm');
const { setCpuLevel, decodeOne } = require('./decode');
const checkpoint = require('./checkpoint');
const CODE = 0x1000, SP = 0xfff0, AC = 0x40000;
const dword = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24 & 255];
const mov = (r, n) => [0x66, 0xb8 + r, ...dword(n)];
const loadFlags = n => [0x66, 0x68, ...dword(n), 0x66, 0x9d];
const readFlags = [0x66, 0x9c, 0x66, 0x5a]; // EDX
let count = 0;
function check(name, fn) { fn(); count++; console.log('ok ' + name); }
function run(vm, cpu, code, flags = 0x246) {
  setCpuLevel(cpu); vm.exports.set_cpu(cpu);
  vm.setAll({ cs: 0, ip: CODE, ds: 0, es: 0, ss: 0, sp: SP, ax: 0, bx: 0, cx: 0, dx: 0, flags });
  vm.mem.set(code, CODE);
  vm.mem.fill(0xa5, SP, SP + 16);
  let steps = 0;
  while (vm.get('gip') < CODE + code.length) {
    assert.ok(steps++ < 128, 'instruction bound');
    assert.ok(vm.stepOne(), 'decode at ' + vm.get('gip').toString(16));
  }
  assert.deepEqual([...vm.mem.slice(SP, SP + 16)], Array(16).fill(0xa5), 'stack overrun');
}
async function main() {
  for (const lazyFlags of [true]) {
    const vm = await makeVm('tailcall', { exportAll: true, lazyFlags });
    const tag = lazyFlags ? 'lazy' : 'eager';
    for (const cpu of [386, 486]) {
      const expectedAC = cpu === 486 ? AC : 0;
      // Save full original flags, toggle only AC, observe the exact delta,
      // then restore flags without changing the observed result in EAX.
      const probe = [0x66, 0x9c, 0x66, 0x5b, 0x66, 0x8b, 0xc3,
        0x66, 0x35, ...dword(AC), 0x66, 0x50, 0x66, 0x9d,
        0x66, 0x9c, 0x66, 0x58, 0x66, 0x33, 0xc3, 0x66, 0x53, 0x66, 0x9d];
      run(vm, cpu, probe);
      check(`${tag} ${cpu} AC differential, full flags and stack restored`, () => {
        assert.equal(vm.raw('ax') >>> 0, expectedAC);
        assert.equal(vm.raw('bx'), 0x246);
        assert.equal(vm.raw('flags'), 0x246);
        assert.equal(vm.get('sp'), SP);
      });
      run(vm, cpu, probe.slice(0, -4), 0x202);
      check(`${tag} ${cpu} missing flags restore is detected`, () => assert.notEqual(vm.raw('flags'), 0x202));
      run(vm, cpu, probe.slice(0, -2));
      check(`${tag} ${cpu} missing POPFD leaves a detectable stack imbalance`, () => assert.equal(vm.get('sp'), SP - 4));
      run(vm, cpu, [...probe.slice(0, -4), 0x53, 0x9d]);
      check(`${tag} ${cpu} word restore balances a word, not a dword`, () => {
        assert.equal(vm.get('sp'), SP); assert.equal(vm.raw('flags') & AC, expectedAC);
        // On 486 the word POPF cannot restore the original upper EFLAGS.
        if (cpu === 486) assert.notEqual(vm.raw('flags'), 0x246);
      });
      run(vm, cpu, [...loadFlags(0x27002a), ...readFlags]);
      check(`${tag} ${cpu} reserved/ID/VM/RF input does not become AC or defined state`, () => {
        assert.equal(vm.raw('dx'), expectedAC | 2);
        assert.equal(vm.get('sp'), SP);
      });
      // Every family below previously contained a 16-bit mask capable of
      // erasing AC. Check each independently, including eager helpers and lazy
      // materialization in the normal interpreter.
      const preserve = [
        ['POPF word', [0x68, 2, 0, 0x9d]],
        ['SAHF', [0xb4, 0xd5, 0x9e]], ['CLC', [0xf8]], ['CLI', [0xfa]],
        ['ADD16', [0x05, 1, 0]], ['SUB32', [0x66, 0x2d, 1, 0, 0, 0]],
        ['INC16', [0x40]], ['DEC32', [0x66, 0x48]], ['XOR', [0x31, 0xc0]],
        ['MUL', [0xb0, 7, 0xf6, 0xe0]], ['SHL', [0xd1, 0xe0]],
        ['ROL', [0xd1, 0xc0]], ['SHLD', [0x0f, 0xa4, 0xc8, 1]],
        ['BT', [0x0f, 0xba, 0xe0, 1]], ['BSF', [0xb8, 1, 0, 0x0f, 0xbc, 0xc0]],
      ];
      for (const [name, bytes] of preserve) {
        run(vm, cpu, [...loadFlags(AC | 2), ...bytes, ...readFlags]);
        check(`${tag} ${cpu} ${name} preserves selected AC`, () => assert.equal(vm.raw('dx') & AC, expectedAC));
      }
      run(vm, cpu, [...loadFlags(AC | 2), ...loadFlags(2), ...readFlags]);
      check(`${tag} ${cpu} POPFD can clear AC`, () => assert.equal(vm.raw('dx'), 2));
      // Word IRET must preserve AC; IRETD takes AC from the full frame.
      for (const wide of [false, true]) {
        const prefix = wide ? [0x66] : [], push = n => [...prefix, 0x68, ...(wide ? dword(n) : dword(n).slice(0, 2))];
        const frame = [...push(wide ? 2 : 0x246), ...push(0), ...push(CODE + 0x80), ...prefix, 0xcf];
        run(vm, cpu, [...loadFlags(AC | 2), ...frame]);
        check(`${tag} ${cpu} IRET${wide ? 'D' : ''} flags and stack`, () => {
          assert.equal(vm.raw('flags'), wide ? 2 : expectedAC | 0x246);
          assert.equal(vm.get('sp'), SP);
          assert.equal(vm.get('gip'), CODE + 0x80);
        });
      }
    }
    // Native snapshot must include both AC and the selected defined mask.
    run(vm, 486, loadFlags(AC | 0x246));
    const state = checkpoint.snapshot(vm);
    vm.exports.set_cpu(386); vm.exports.set_flags(2); vm.set('sp', 0x8000);
    checkpoint.restore(vm, state);
    check(`${tag} checkpoint restores AC, CPU mask, flags and SP`, () => {
      assert.equal(vm.raw('flags'), AC | 0x246);
      assert.equal(vm.exports.mget_f_def(), 0x47fd5);
      assert.equal(vm.get('sp'), SP);
    });
    const saved = state.globals[0].name;
    state.globals[0].name = 'invalid';
    check(`${tag} corrupt restore rejected without flags/stack mutation`, () => {
      assert.throws(() => checkpoint.restore(vm, state), /ABI/);
      assert.equal(vm.raw('flags'), AC | 0x246); assert.equal(vm.get('sp'), SP);
    });
    state.globals[0].name = saved;
    vm.exports.set_cpu(386);
    check(`${tag} changing model clears unavailable AC`, () => assert.equal(vm.raw('flags'), 0x246));

    const instructions = [
      ['BSWAP', [...mov(0, 0x12345678), 0x66, 0x0f, 0xc8], v => assert.equal(v.raw('ax'), 0x78563412)],
      ['XADD32 register', [...mov(0, 0xffffffff), ...mov(1, 1), 0x66, 0x0f, 0xc1, 0xc8], v => {
        assert.equal(v.raw('ax'), 0); assert.equal(v.raw('cx') >>> 0, 0xffffffff); assert.equal(v.raw('flags') & 0x8d5, 0x55);
      }],
      ['XADD16 alias', [0xb8, 7, 0, 0x0f, 0xc1, 0xc0], v => assert.equal(v.get('ax'), 14)],
      ['XADD8 memory', [0xc6, 0x06, 0, 0x30, 0xff, 0xb1, 1, 0x0f, 0xc0, 0x0e, 0, 0x30], v => {
        assert.equal(v.mem[0x3000], 0); assert.equal(v.get('cx'), 0xff); assert.equal(v.raw('flags') & 0x8d5, 0x55);
      }],
      ['CMPXCHG32 equal', [...mov(0, 7), ...mov(1, 7), ...mov(3, 9), 0x66, 0x0f, 0xb1, 0xd9], v => {
        assert.equal(v.raw('cx'), 9); assert.equal(v.raw('ax'), 7); assert.equal(v.raw('flags') & 0x8d5, 0x44);
      }],
      ['CMPXCHG16 unequal memory', [0xc7, 0x06, 0, 0x30, 8, 0, 0xb8, 7, 0, 0xbb, 9, 0, 0x0f, 0xb1, 0x1e, 0, 0x30], v => {
        assert.equal(v.get('ax'), 8); assert.equal(v.mem[0x3000], 8); assert.equal(v.raw('flags') & 0x8d5, 0x95);
      }],
    ];
    for (const [name, bytes, want] of instructions) {
      run(vm, 486, [...loadFlags(AC | 2), ...bytes]);
      check(`${tag} 486 ${name} data/flags`, () => { want(vm); assert.equal(vm.raw('flags') & AC, AC); });
    }
    for (const code of [[0x66, 0x0f, 0xc8], [0x0f, 0xc1, 0xc8], [0x0f, 0xb0, 0xc8], [0x0f, 8], [0x0f, 9]]) {
      for (const cpu of [386, 486]) {
        setCpuLevel(cpu);
        check(`${tag} ${cpu} opcode level ${Buffer.from(code).toString('hex')}`, () => {
          assert.equal(!!decodeOne(n => code[n] || 0, 0, 0), cpu === 486);
        });
      }
    }
  }
  // Supported DOS runner selects the same CPU for the decoder and native VM,
  // and its serialized recipe must preserve that choice on a fresh runner.
  const image = Uint8Array.from([...loadFlags(AC | 2), 0xeb, 0xfe]);
  for (const cpu of [386, 486]) {
    const r = await checkpoint.createMachineRunner({ image, cpu, budget: 128, sessionOptions: { slice: 8, wasmDecode: false } });
    r.step();
    const saved = r.capture();
    const resumed = await checkpoint.resumeMachineRunner(saved);
    check(`${cpu} DOS runner and recovery preserve model/AC`, () => {
      assert.equal(r.vm.raw('flags') & AC, cpu === 486 ? AC : 0);
      assert.equal(resumed.vm.raw('flags'), r.vm.raw('flags'));
      assert.equal(resumed.vm.exports.mget_f_def(), cpu === 486 ? 0x47fd5 : 0x7fd5);
    });
  }
  await assert.rejects(checkpoint.createMachineRunner({ image, cpu: 586 }), /CPU model/);
  console.log(`${++count} controls passed`);
}
main().catch(e => { console.error(e.stack); process.exitCode = 1; });
