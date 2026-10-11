#!/usr/bin/env node
'use strict';

// A page-crossing access whose second translation runs a fault filter that
// rearranges the window must not use the first translation afterwards.
//
// Serious Sam's CTStream keeps a two-page window over a reserved stream: on an
// access violation at page p its filter decommits what it holds and commits
// p and p+1, loading them from disk. A dword read straddling pages 1 and 2
// with pages 0-1 committed faults on page 2; the filter then decommits page 1.
// The accessor used to finish the read from page 1's translation taken before
// the fault -- now zero-filled backing -- and level loading read a corrupt
// count ("LOADING ENTITIES" stalled appending 13.7 million entries). An x86
// restart re-translates both pages; the accessor must give the same answer,
// and a store must land every byte.

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
  (func (export "t_vfree") (param $addr i32) (param $size i32) (param $type i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_VirtualFree (local.get $addr) (local.get $size) (local.get $type)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "t_gl32") (param $ga i32) (result i32) (call $gl32 (local.get $ga)))
  (func (export "t_gs32") (param $ga i32) (param $v i32) (call $gs32 (local.get $ga) (local.get $v)))
  (func (export "t_epoch") (result i32) (global.get $fault_sync_epoch))
  (func (export "t_thunk") (param $id i32) (result i32)
    (local $p i32)
    (local.set $p (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $p) (i32.const 0))
    (i32.store offset=4 (local.get $p) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (call $w2g (local.get $p)))
`;

const VIRTUAL_ALLOC = 719, VIRTUAL_FREE = 720;
const MEM_COMMIT = 0x1000, MEM_RESERVE = 0x2000;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const image = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  const pe = readPE(image);
  new Uint8Array(memory.buffer).set(image, e.get_staging());
  assert(e.load_pe(image.length));
  const apiNames = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/api_table.json'), 'utf8'));
  assert.strictEqual(apiNames[VIRTUAL_ALLOC].name, 'VirtualAlloc');
  assert.strictEqual(apiNames[VIRTUAL_FREE].name, 'VirtualFree');

  const section = pe.sections.find(s => s.name === '.rsrc' && s.rawSize >= 512);
  assert(section, 'fixture needs a resource-section tail');
  const S = pe.imageBase + section.rva + section.rawSize - 256;
  const slotVA = S, slotVF = S + 4, frame = S + 16, code = S + 32;
  const R = e.t_valloc(0, 0x10000, MEM_RESERVE) >>> 0;
  assert(R, 'reservation');
  e.guest_write32(slotVA, e.t_thunk(VIRTUAL_ALLOC));
  e.guest_write32(slotVF, e.t_thunk(VIRTUAL_FREE));

  const le = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255];
  // handler(rec, frame, ctx, disp), cdecl:
  //   p = (info[1] - R) & ~0xFFF          page offset of the fault
  //   VirtualFree(R, 0x10000, MEM_DECOMMIT)
  //   VirtualAlloc(R + p, 0x2000, MEM_COMMIT, PAGE_READWRITE)
  //   fill page p with 0x10 + p/0x1000 and page p+1 with one more
  //   return ExceptionContinueExecution
  const asm = [
    0x8B, 0x44, 0x24, 0x04,             // mov eax,[esp+4]
    0x8B, 0x40, 0x18,                   // mov eax,[eax+24]
    0x2D, ...le(R),                     // sub eax,R
    0x25, ...le(0xFFFFF000),            // and eax,~0xFFF
    0x89, 0xC6,                         // mov esi,eax
    0x68, ...le(0x4000),                // push MEM_DECOMMIT
    0x68, ...le(0x10000),               // push 0x10000
    0x68, ...le(R),                     // push R
    0xFF, 0x15, ...le(slotVF),          // call [VirtualFree]
    0x6A, 0x04,                         // push PAGE_READWRITE
    0x68, ...le(MEM_COMMIT),            // push MEM_COMMIT
    0x68, ...le(0x2000),                // push 0x2000
    0x8D, 0x86, ...le(R),               // lea eax,[esi+R]
    0x50,                               // push eax
    0xFF, 0x15, ...le(slotVA),          // call [VirtualAlloc]
    0x8D, 0xBE, ...le(R),               // lea edi,[esi+R]
    0x89, 0xF0,                         // mov eax,esi
    0xC1, 0xE8, 0x0C,                   // shr eax,12
    0x04, 0x10,                         // add al,0x10
    0xFC,                               // cld
    0xB9, ...le(0x1000), 0xF3, 0xAA,    // mov ecx,0x1000 ; rep stosb
    0xFE, 0xC0,                         // inc al
    0xB9, ...le(0x1000), 0xF3, 0xAA,    // mov ecx,0x1000 ; rep stosb
    0x31, 0xC0,                         // xor eax,eax
    0xC3,                               // ret
  ];
  while (asm.length % 4) asm.push(0x90);
  for (let i = 0; i < asm.length; i += 4)
    e.guest_write32(code + i, asm[i] | asm[i + 1] << 8 | asm[i + 2] << 16 | asm[i + 3] << 24);
  e.guest_write32(frame, -1); e.guest_write32(frame + 4, code);
  e.guest_write32(e.get_fs_base() >>> 0, frame);
  e.set_fault_unmapped(5);

  // The window starts on pages 0-1, as loaded by an earlier fault.
  const fillWindow = page => {
    assert.strictEqual(e.t_valloc(R + page * 0x1000, 0x2000, MEM_COMMIT) >>> 0, R + page * 0x1000);
    for (let i = 0; i < 0x2000; i += 4) {
      const b = 0x10 + page + (i >= 0x1000 ? 1 : 0);
      e.guest_write32(R + page * 0x1000 + i, b * 0x01010101);
    }
  };
  const arm = () => { e.set_eip(0x00401234); e.set_esp(0x07408000); };

  fillWindow(0);
  arm();
  const epoch0 = e.t_epoch();
  assert.strictEqual(e.t_gl32(R + 0x1FFE) >>> 0, 0x12121111,
    'a dword straddling pages 1-2 reads both pages as the restarted instruction would');
  assert(e.t_epoch() > epoch0, 'the read went through the fault filter');

  // A store from the same starting window lands all four bytes.
  assert.strictEqual(e.t_vfree(R, 0x10000, 0x4000), 1, 'decommit the window');
  fillWindow(0);
  arm();
  e.t_gs32(R + 0x1FFE, 0xA1B2C3D4);
  assert.strictEqual(e.t_gl32(R + 0x1FFE) >>> 0, 0xA1B2C3D4,
    'a straddling store survives the filter decommitting its first page');
  console.log('PASS page-crossing accesses re-translate after a fault filter rearranges the window');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
