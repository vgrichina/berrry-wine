#!/usr/bin/env node
'use strict';

// --fault-null=reserved (mode 5): a translation miss inside a MEM_RESERVE'd,
// uncommitted range is offered to the guest's FS:[0] handlers synchronously,
// as Windows raises EXCEPTION_ACCESS_VIOLATION there (Serious Sam's
// CTStream::ExceptionFilter commits stream pages this way). Each handler is a
// real x86 function run as a nested call: ContinueSearch (1) moves to the next
// frame, ContinueExecution (0) stops the walk. Whatever the handlers did, the
// faulting thread's registers, EIP and ESP come back unchanged, and a miss
// outside any reservation stays the quiet sentinel without running a handler.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readPE } = require('../lib/pe');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "t_valloc") (param $addr i32) (param $size i32) (param $type i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_VirtualAlloc (local.get $addr) (local.get $size) (local.get $type)
      (i32.const 4) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "t_g2w") (param $ga i32) (result i32) (call $g2w (local.get $ga)))
  (func (export "t_sentinel") (result i32) (global.get $NULL_SENTINEL))
  ;; Decoded-stream state of the block the fault interrupts.
  (func (export "t_set_stream") (param $ip i32) (param $resume i32) (param $redirected i32)
    (global.set $ip (local.get $ip)) (global.set $resume_ip (local.get $resume))
    (global.set $eip_redirected (local.get $redirected)))
  (func (export "t_ip") (result i32) (global.get $ip))
  (func (export "t_resume_ip") (result i32) (global.get $resume_ip))
  (func (export "t_eip_redirected") (result i32) (global.get $eip_redirected))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const image = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  const pe = readPE(image);
  new Uint8Array(memory.buffer).set(image, e.get_staging());
  assert(e.load_pe(image.length));

  // Scratch for handler code, frames and results: a section tail in the image.
  const section = pe.sections.find(s => s.name === '.rsrc' && s.rawSize >= 512);
  assert(section, 'fixture needs a resource-section tail');
  const S = pe.imageBase + section.rva + section.rawSize - 256;
  const seen = S, count = S + 4, frameA = S + 16, frameB = S + 24, codeA = S + 64, codeB = S + 96;
  const bytes = (ga, list) => {
    const padded = [...list]; while (padded.length % 4) padded.push(0x90);
    for (let i = 0; i < padded.length; i += 4)
      e.guest_write32(ga + i, padded[i] | padded[i + 1] << 8 | padded[i + 2] << 16 | padded[i + 3] << 24);
  };
  const le = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255];
  for (let i = 0; i < 64; i += 4) e.guest_write32(S + i, 0);
  // A: record ExceptionInformation[1] (the faulting address), ContinueSearch.
  bytes(codeA, [0x8B, 0x44, 0x24, 0x04, 0x8B, 0x40, 0x18, 0xA3, ...le(seen),
    0xB8, 1, 0, 0, 0, 0xC3]);
  // B: count the call, clobber EBX, ContinueExecution without committing.
  bytes(codeB, [0xFF, 0x05, ...le(count), 0xBB, ...le(0xDEADBEEF), 0x31, 0xC0, 0xC3]);
  e.guest_write32(frameA, frameB); e.guest_write32(frameA + 4, codeA);
  e.guest_write32(frameB, -1); e.guest_write32(frameB + 4, codeB);

  const fsBase = e.get_fs_base() >>> 0;
  const savedChain = e.guest_read32(fsBase);
  const reserved = e.t_valloc(0, 0x10000, 0x2000) >>> 0; // MEM_RESERVE only
  assert(reserved, 'reservation placed');
  const fault = reserved + 0x1234;
  const sentinel = e.t_sentinel() >>> 0;

  // The interrupted op dispatches its successor through $ip once the
  // translation returns, so the decoded-stream state is part of what must
  // survive, not just the architectural registers.
  const state = () => [e.get_eip(), e.get_esp(), e.get_eax(), e.get_ecx(),
    e.get_edx(), e.get_ebx(), e.get_ebp(), e.t_ip(), e.t_resume_ip(), e.t_eip_redirected()].map(v => v >>> 0);
  const arm = () => {
    e.set_eip(0x00401234); e.set_esp(0x07408000); e.set_ebp(0x07408100);
    e.set_eax(0x11111111); e.set_ecx(0x22222222); e.set_edx(0x33333333); e.set_ebx(0x44444444);
    e.t_set_stream(0x1a2b3c40, 0x1a2b3c48, 0);
    return state();
  };

  // Mode 0: no handlers at all.
  e.guest_write32(fsBase, frameA);
  e.set_fault_unmapped(0);
  let before = arm();
  assert.strictEqual(e.t_g2w(fault) >>> 0, sentinel, 'mode 0: a reserved miss is the sentinel');
  assert.strictEqual(e.guest_read32(count), 0, 'mode 0 runs no handler');

  // Mode 5, outside any reservation: still quiet.
  e.set_fault_unmapped(5);
  before = arm();
  assert.strictEqual(e.t_g2w(0x6ff00000) >>> 0, sentinel, 'unreserved miss is the sentinel');
  assert.strictEqual(e.guest_read32(count), 0, 'an unreserved miss runs no handler');
  assert.deepStrictEqual(state(), before, 'unreserved miss leaves the CPU alone');

  // Mode 5, reserved: A sees the address and declines, B accepts.
  before = arm();
  assert.strictEqual(e.t_g2w(fault) >>> 0, sentinel, 'an uncommitted page still misses after the handlers');
  assert.strictEqual(e.guest_read32(seen) >>> 0, fault, 'handler A got ExceptionInformation[1] = the address');
  assert.strictEqual(e.guest_read32(count), 1, 'ContinueSearch reached handler B once');
  assert.deepStrictEqual(state(), before, 'EIP, ESP, registers and the interrupted block\'s $ip restored after the nested handlers');

  // ContinueExecution stops the walk: with B first, A never runs.
  e.guest_write32(seen, 0);
  e.guest_write32(fsBase, frameB);
  e.guest_write32(frameB, frameA);
  arm();
  e.t_g2w(fault);
  assert.strictEqual(e.guest_read32(count), 2, 'B ran');
  assert.strictEqual(e.guest_read32(seen), 0, 'ContinueExecution ends the walk before A');

  // A committed page translates without involving any handler.
  assert.strictEqual(e.t_valloc(reserved, 0x1000, 0x1000) >>> 0, reserved, 'commit the first page');
  arm();
  assert.notStrictEqual(e.t_g2w(reserved + 0x10) >>> 0, sentinel, 'committed page translates');
  assert.strictEqual(e.guest_read32(count), 2, 'no handler for a committed page');
  e.guest_write32(fsBase, savedChain);
  console.log('PASS reserved-page faults run guest SEH handlers synchronously and restore the CPU');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
