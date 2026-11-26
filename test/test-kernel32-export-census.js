#!/usr/bin/env node
'use strict';
// Pure JS: every implemented API that Wine's kernel32.spec places in KERNEL32
// is named by the KERNEL32 export manifest, and the census itself tells an
// implemented handler from a direct fail-fast one. No module or guest run.
const assert = require('node:assert/strict');
const { census, dispatchTargets, wineNamesFromSpec } = require('../tools/kernel32-export-census');

const { manifest, missing } = census();
assert.deepEqual(missing, [], `implemented KERNEL32 APIs not exported: ${missing.join(' ')}`);
const exported = new Set(manifest.exports.map(e => e.api));
// The 2026-11-26 gap list (HeidiSQL's unpacker and NT-era Delphi RTLs).
for (const name of ['CreateFileMappingW', 'VerSetConditionMask', 'VerifyVersionInfoW',
  'CompareStringOrdinal', 'GetFileSizeEx', 'SetFilePointerEx', 'EnumSystemLocalesW'])
  assert(exported.has(name), `${name} exported`);
// CharUpperBuffW is USER32: never in the KERNEL32 surface.
assert(!exported.has('CharUpperBuffW'));
assert(manifest.exports.length > 512, 'manifest beyond the old 512-entry image cap');

// Spec parsing: ordinal-only, -i386, -import and stub lines.
assert.deepEqual(wineNamesFromSpec([
  '@ stdcall -import ActivateActCtx(ptr ptr)',
  '101 stub -i386 @',
  '@ stub CreateKernelThread',
  '# comment SomeName',
  '@ stdcall -arch=win32 Foo(long)'].join('\n')), ['ActivateActCtx', 'CreateKernelThread', 'Foo']);

// Dispatch parsing: a case that calls another API's handler resolves to it.
const t = dispatchTargets([
  '    ) ;; 7: GetStringTypeExA',
  '      (call $handle_GetStringTypeA (local.get $arg0))',
  '    ) ;; 8: NoHandler',
  '      (call $crash_unimplemented (local.get $name_ptr))'].join('\n'));
assert.equal(t.get('GetStringTypeExA'), 'GetStringTypeA');
assert.equal(t.get('NoHandler'), null);
console.log(`PASS kernel32 export census: ${manifest.exports.length} exports cover every implemented Wine-KERNEL32 API`);
