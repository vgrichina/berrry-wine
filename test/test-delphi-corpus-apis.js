#!/usr/bin/env node
'use strict';
// APIs and semantics the Delphi corpus sweep (scratch/runs/20261125-delphi-corpus)
// found missing: VerSetConditionMask (Inno Setup 6), UuidFromStringA (Audiere
// under Hero GM7), LookupPrivilegeValueW (Double Commander), CreateFileMappingW
// (HeidiSQL), and VirtualAlloc refusing a fixed MEM_RESERVE over memory that is
// already allocated (the Delphi memory manager growing over MakeObjectInstance
// thunks crashed every Remar GM7 runner).

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const callWat = (name, nargs) => String.raw`
  (func (export "t_${name}") (param $a0 i32) (param $a1 i32) (param $a2 i32)
      (param $a3 i32) (param $a4 i32) (param $a5 i32) (result i32)
    (local $saved i32) (local $frame i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (local.set $frame (call $heap_alloc (i32.const 64)))
    (call $gs32 (i32.add (local.get $frame) (i32.const 24)) (local.get $a5))
    (i32.store offset=16 (global.get $reg_base) (local.get $frame))
    (call $handle_${name} (local.get $a0) (local.get $a1) (local.get $a2)
      (local.get $a3) (local.get $a4) (i32.const 0))
    (global.set $t_esp_delta (i32.sub (i32.load offset=16 (global.get $reg_base)) (local.get $frame)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load offset=0 (global.get $reg_base)))`;

const extraWat = String.raw`
  (global $t_esp_delta (mut i32) (i32.const 0))
  (func (export "t_esp_delta") (result i32) (global.get $t_esp_delta))
  (func (export "t_edx") (result i32) (i32.load offset=8 (global.get $reg_base)))
  (func (export "t_last_error") (result i32) (global.get $last_error))
  (func (export "t_set_last_error") (param $v i32) (global.set $last_error (local.get $v)))
  ${callWat('VerSetConditionMask')}
  ${callWat('UuidFromStringA')}
  ${callWat('LookupPrivilegeValueA')}
  ${callWat('LookupPrivilegeValueW')}
  ${callWat('CreateFileMappingW')}
  ${callWat('OpenFileMappingW')}
  ${callWat('VirtualAlloc')}
  ${callWat('VirtualFree')}
  ${callWat('GetCPInfo')}
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const toWasm = guest => (guest - imageBase + guestBase) >>> 0;
  const view = () => new DataView(memory.buffer);
  const alloc = size => e.guest_alloc(size) >>> 0;
  const u32 = g => view().getUint32(toWasm(g), true);
  const set32 = (g, v) => view().setUint32(toWasm(g), v >>> 0, true);
  const writeA = (g, s) => { const v = view(); for (let i = 0; i < s.length; i++) v.setUint8(toWasm(g) + i, s.charCodeAt(i)); v.setUint8(toWasm(g) + s.length, 0); };
  const writeW = (g, s) => { const v = view(); for (let i = 0; i < s.length; i++) v.setUint16(toWasm(g) + 2 * i, s.charCodeAt(i), true); v.setUint16(toWasm(g) + 2 * s.length, 0, true); };
  const call = (name, ...a) => { while (a.length < 6) a.push(0); return e['t_' + name](...a) >>> 0; };

  // --- VerSetConditionMask: 64-bit mask in EDX:EAX, 4 stdcall dwords.
  const VER_EQUAL = 1, VER_GREATER_EQUAL = 3;
  let lo = call('VerSetConditionMask', 0, 0, 0x02, VER_GREATER_EQUAL);  // VER_MAJORVERSION
  assert.deepStrictEqual([lo, e.t_edx() >>> 0], [3 << 3, 0], 'major version field is bits 3..5');
  assert.strictEqual(e.t_esp_delta(), 20, 'VerSetConditionMask pops four dwords');
  lo = call('VerSetConditionMask', lo, 0, 0x01, VER_GREATER_EQUAL);    // VER_MINORVERSION
  lo = call('VerSetConditionMask', lo, 0, 0x20, VER_GREATER_EQUAL);    // VER_SERVICEPACKMAJOR
  assert.strictEqual(lo, (3 << 3) | 3 | (3 << 15), 'fields accumulate like kernel32 (0x1801b)');
  assert.strictEqual(call('VerSetConditionMask', 0, 0x55, 0x80, VER_EQUAL), 1 << 21,
    'VER_PRODUCT_TYPE is bit 21 and the high dword passes through');
  assert.strictEqual(e.t_edx() >>> 0, 0x55);
  assert.strictEqual(call('VerSetConditionMask', 0x1234, 0, 0, VER_EQUAL), 0x1234, 'empty type mask is a no-op');
  assert.strictEqual(call('VerSetConditionMask', 0, 0, 0x03, VER_EQUAL), 1 << 3,
    'several type bits pick the highest, as kernel32 does');

  // --- UuidFromStringA
  const s = alloc(64), u = alloc(16);
  writeA(s, '8BEAB5C2-3BBC-4A5C-9F5E-1F2E3D4C5B6A');
  assert.strictEqual(call('UuidFromStringA', s, u), 0, 'RPC_S_OK');
  assert.strictEqual(e.t_esp_delta(), 12);
  assert.deepStrictEqual([u32(u), u32(u + 4), u32(u + 8), u32(u + 12)],
    [0x8BEAB5C2, 0x4A5C3BBC, 0x2E1F5E9F, 0x6A5B4C3D]);
  set32(u, 0xdeadbeef);
  writeA(s, '{8BEAB5C2-3BBC-4A5C-9F5E-1F2E3D4C5B6A}');
  assert.strictEqual(call('UuidFromStringA', s, u), 1705, 'braces are RPC_S_INVALID_STRING_UUID');
  writeA(s, '8BEAB5C2-3BBC-4A5C-9F5E-1F2E3D4C5B6Ax');
  assert.strictEqual(call('UuidFromStringA', s, u), 1705, 'trailing text is rejected');
  assert.strictEqual(u32(u), 0xdeadbeef, 'a rejected string leaves the output alone');
  assert.strictEqual(call('UuidFromStringA', 0, u), 0, 'NULL is the nil UUID');
  assert.deepStrictEqual([u32(u), u32(u + 12)], [0, 0]);

  // --- LookupPrivilegeValueW shares the A table and validation.
  const n = alloc(160), luid = alloc(8);
  writeW(n, 'seshutdownprivilege');
  e.t_set_last_error(0x1111);
  assert.strictEqual(call('LookupPrivilegeValueW', 0, n, luid), 1);
  assert.strictEqual(e.t_esp_delta(), 16);
  writeA(n, 'SeShutdownPrivilege');
  const wLuid = u32(luid);
  assert.strictEqual(call('LookupPrivilegeValueA', 0, n, luid), 1);
  assert.strictEqual(wLuid, u32(luid), 'W and A agree on the LUID');
  assert.strictEqual(wLuid, 19, 'SeShutdownPrivilege is LUID 19');
  writeW(n, 'SeNoSuchPrivilege');
  assert.strictEqual(call('LookupPrivilegeValueW', 0, n, luid), 0);
  assert.strictEqual(e.t_last_error(), 1313, 'ERROR_NO_SUCH_PRIVILEGE');
  writeA(n, 'SeShutdownPrivilege');
  assert.strictEqual(call('LookupPrivilegeValueA', 0, n, luid), 1, 'the W mode does not leak into A');

  // --- CreateFileMappingW: a UTF-16 name another call can reopen by name.
  const mn = alloc(80);
  writeW(mn, 'HeidiSQL_Single');
  const h = call('CreateFileMappingW', 0xFFFFFFFF, 0, 4, 0, 4096, mn);
  assert.notStrictEqual(h, 0, 'anonymous named section is created');
  assert.strictEqual(e.t_esp_delta(), 28);
  const again = call('CreateFileMappingW', 0xFFFFFFFF, 0, 4, 0, 4096, mn);
  assert.notStrictEqual(again, 0);
  assert.strictEqual(e.t_last_error(), 183, 'the same wide name is ERROR_ALREADY_EXISTS');
  assert.notStrictEqual(call('OpenFileMappingW', 4, 0, mn), 0, 'OpenFileMappingW finds the W name');

  // --- VirtualAlloc: a fixed MEM_RESERVE over allocated memory fails with 487.
  const MEM_COMMIT = 0x1000, MEM_RESERVE = 0x2000, MEM_RELEASE = 0x8000;
  const region = call('VirtualAlloc', 0, 0x100000, MEM_RESERVE, 4);
  assert.notStrictEqual(region, 0);
  const page = call('VirtualAlloc', 0, 0x1000, MEM_COMMIT | MEM_RESERVE, 0x40);
  assert.notStrictEqual(page, 0);
  assert.strictEqual(call('VirtualAlloc', page, 0x100000, MEM_RESERVE, 4), 0,
    'reserving over a committed page must fail (Delphi MM grows into thunks otherwise)');
  assert.strictEqual(e.t_last_error(), 487, 'ERROR_INVALID_ADDRESS');
  assert.strictEqual(e.t_esp_delta(), 20);
  assert.strictEqual(call('VirtualAlloc', region + 0x10000, 0x10000, MEM_RESERVE, 4), 0,
    'reserving inside an existing reservation fails too');
  assert.strictEqual(call('VirtualFree', region, 0, MEM_RELEASE), 1);
  assert.strictEqual(call('VirtualAlloc', region, 0x100000, MEM_RESERVE, 4), region,
    'a released range can be reserved at its own address again');
  assert.strictEqual(call('VirtualAlloc', region, 0x1000, MEM_COMMIT, 4), region,
    'committing inside a reservation still works');

  // --- GetCPInfo for CP_UTF8 / CP_UTF7 (Delphi 2009+ TEncoding.UTF8/UTF7).
  const cpi = alloc(20);
  set32(cpi, 0xdeadbeef);
  assert.strictEqual(call('GetCPInfo', 65001, cpi), 1, 'CP_UTF8 is described');
  assert.strictEqual(e.t_esp_delta(), 12);
  assert.deepStrictEqual([u32(cpi), u32(cpi + 4) & 0xffff, u32(cpi + 8), u32(cpi + 16) & 0xffff], [4, 0x3f, 0, 0]);
  assert.strictEqual(call('GetCPInfo', 65000, cpi), 1, 'CP_UTF7 is described');
  assert.strictEqual(u32(cpi), 5);
  assert.strictEqual(call('GetCPInfo', 1252, cpi), 1);
  assert.strictEqual(u32(cpi), 1, 'CP1252 is still single-byte');
  assert.strictEqual(call('GetCPInfo', 12345, cpi), 0, 'an unknown page still fails');

  console.log('test-delphi-corpus-apis: OK');
})().catch(err => { console.error(err); process.exit(1); });
