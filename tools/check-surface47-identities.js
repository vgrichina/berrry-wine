#!/usr/bin/env node
'use strict';
// Independent canonical UUID spellings from Wine's include/ddraw.h:
// https://raw.githubusercontent.com/wine-mirror/wine/master/include/ddraw.h
// Texture2: https://raw.githubusercontent.com/wine-mirror/wine/master/include/d3d.h
// IUnknown: https://raw.githubusercontent.com/wine-mirror/wine/master/include/unknwn.idl
// Do not derive these expectations from the emulator's word constants.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/09a8-handlers-directx.wat'), 'utf8');
const candidate = fs.readFileSync(path.join(root, 'test/test-directdraw-surface47-abi-candidate.js'), 'utf8');
const identities = {
  iidUnknown: '00000000-0000-0000-c000-000000000046',
  iidTexture2: '93281502-8cf8-11d0-89ab-00a0c9054129',
  iid1: '6c14db80-a733-11ce-a521-0020af0be560',
  iid4: '9c59509a-39bd-11d1-8c4a-00c04fd930c5',
  iid7: '15e65ec0-3b9c-11d2-b92f-00609797ea5b',
  iidSurface1: '6c14db81-a733-11ce-a521-0020af0be560',
  iidSurface2: '57805885-6eec-11cf-9441-a82303c10e27',
  iidSurface3: 'da044e00-69b2-11d0-a1d5-00aa00b8dfbb',
  iidSurface4: '0b2b8630-ad35-11d0-8ea6-00609797ea5b',
  iidSurface7: '06675a80-3b9b-11d2-b92f-00609797ea5b',
};
function words(uuid) {
  const [a, b, c, d, e] = uuid.split('-');
  const bytes = Buffer.alloc(16);
  bytes.writeUInt32LE(parseInt(a, 16), 0);
  bytes.writeUInt16LE(parseInt(b, 16), 4);
  bytes.writeUInt16LE(parseInt(c, 16), 6);
  Buffer.from(d + e, 'hex').copy(bytes, 8);
  return [0, 4, 8, 12].map(offset => bytes.readUInt32LE(offset));
}
const comparisons = [...source.matchAll(/\(call \$guid_words_equal \(local.get \$iid_wa\)\s*((?:\(i32.const (?:0x[0-9a-f]+|\d+)\)\s*){4})/gi)]
  .map(match => [...match[1].matchAll(/i32.const (0x[0-9a-f]+|\d+)/gi)].map(value => Number(value[1])));
for (const [name, uuid] of Object.entries(identities)) {
  const expected = words(uuid);
  const declaration = candidate.match(new RegExp(`const ${name} = guid\\(\\[([^\\]]+)\\]\\)`));
  assert(declaration, name);
  assert.deepStrictEqual(declaration[1].split(',').map(Number), expected, `${name} guest GUID bytes`);
  if (name === 'iidTexture2') {
    // Inherited legacy route tests only Data1. Validate the exact candidate
    // UUID without pretending that this route rejects malformed GUID tails.
    assert.match(source, /\(if \(i32.eq \(local.get \$iid0\) \(i32.const 0x93281502\)\) \(then\s*\(local.set \$vtbl \(global.get \$DX_VTBL_D3DTEX2\)\)\)\)/);
  } else {
    assert(comparisons.some(actual => actual.every((word, i) => word === expected[i])), `${name} production complete GUID comparison`);
  }
}
console.log('Surface ABI identities: ten independent canonical UUIDs match guest bytes; nine complete production comparisons, inherited Texture2 Data1 route');
