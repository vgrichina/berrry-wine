#!/usr/bin/env node
'use strict';

// Read-only static evidence gate. This neither runs nor patches the guest.
// Usage: node tools/probes/morrowind-name-consumer-static.js EXE [--self-test]
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert/strict');
const { readPE } = require('../../lib/pe');
const EXE_SHA256 = 'f48300e194c6917cd98d235d259ebc3ab5d7c2071e9b41d798b996a8ce4d0676';
const hash = b => crypto.createHash('sha256').update(b).digest('hex');

// Literal instruction/data anchors reviewed with tools/disasm.js. Full-image
// identity is mandatory; anchor-only validation is used by negative controls.
const anchors = [
  ['Name identifier', 0x7a8f6c, Buffer.from('MenuName_NameSpace\0').toString('hex')],
  ['Name child builder', 0x5e6720, '68507b63008bcf52e81335f9ff'],
  ['Name child captured in edi', 0x5e672d, '8bf8'],
  ['key callback registration', 0x637cbc, '6a206850806300683e80ffff8bcee801bcf3ff'],
  ['keyboard GUID', 0x73d5f8, '612b1d6fa0d5cf11bfc7444553540000'],
  ['keyboard creation GUID argument', 0x4061f6, '68f8d5730050ff520c'],
  ['keyboard device stored at +28', 0x40621b, '895628'],
  ['buffered read arguments', 0x406900, '8b412883ec1885c074456a008d542404528d54240c526a14c7442410010000008b0850ff5128'],
  ['returned count then event data', 0x40692a, '8b44240085c0741d8b442408'],
  ['UI polls one event', 0x580726, 'e8d561e8ff'],
  ['scan translation', 0x5807b1, '3bfb745d8b4c240c51578bcee80e0c0000'],
  ['character slot write', 0x5807e7, 'c7466410000000894668'],
  ['poll before dispatch', 0x580040, '8bcfe8b906000084c075096a008bcfe8ec0700008bcfe8650e0000'],
  ['key event dispatch', 0x580fd5, '83f810751484db74d58b46088b5604515052683e80ffffebc0'],
  ['insert low byte', 0x638589, '83c9ff33c08d7c2440885c2440c644244100f2ae'],
  ['string insert import', 0x6385a7, '8d4c2424ff1554817300'],
  ['text commit', 0x6385e2, '8b4c2458e8d5a0f3ff'],
  ['text object offset', 0x5726e1, '8dae64010000'],
  ['cursor marker', 0x7a4b50, '7c00'],
  ['clear dispatched slot', 0x581399, 'c70600000000'],
];

function verifyAnchors(bytes) {
  const pe = readPE(bytes);
  assert.equal(pe.imageBase, 0x400000, 'original preferred image base');
  for (const [label, va, hex] of anchors) {
    const offset = pe.va2off(va);
    assert.ok(offset >= 0, label + ': raw bytes unavailable');
    assert.equal(bytes.subarray(offset, offset + hex.length / 2).toString('hex'), hex, label);
  }
  return pe;
}

function verify(bytes) {
  assert.equal(bytes.length, 3907584, 'original executable size');
  assert.equal(hash(bytes), EXE_SHA256, 'original executable hash');
  return verifyAnchors(bytes);
}

function main() {
  assert.ok(process.argv[2] && !process.argv[2].startsWith('--'), 'EXE path required');
  const bytes = fs.readFileSync(process.argv[2]);
  const pe = verify(bytes);
  const negativeControls = [];
  if (process.argv.includes('--self-test')) {
    // One in-memory buffer, restored after each mutation. Original stays read-only.
    const changed = Buffer.from(bytes);
    for (const [label, va] of anchors) {
      const offset = pe.va2off(va);
      changed[offset] ^= 1;
      assert.throws(() => verifyAnchors(changed), undefined, label + ' must reject');
      changed[offset] ^= 1;
      negativeControls.push(label);
    }
    changed[pe.va2off(0x406923)] ^= 1;
    assert.throws(() => verify(changed), /original executable hash/);
    negativeControls.push('whole-image wrong hash');
    assert.throws(() => verify(bytes.subarray(0, bytes.length - 1)), /original executable size/);
    negativeControls.push('truncated image');
    verify(bytes);
  }
  console.log(JSON.stringify({
    kind: 'static-original-consumer-plan', runtimeProof: false, sourceRepair: false,
    exe: { bytes: bytes.length, sha256: EXE_SHA256, preferredBase: '0x400000' },
    anchors: anchors.map(([label, va, hex]) => ({ label, va: '0x' + va.toString(16), hex })),
    negativeControls,
    observation: {
      addressRule: 'Runtime VA = original VA + verified relocation delta. Never assume delta zero.',
      identity: 'Capture Name child EAX at 0x5e672d; retain pointer/lifetime and registered Name ID. Callback arg5 must match that child.',
      apiEntry: { pc: '0x406923', fields: ['thread/invocation', 'ESP', 'this=[ESP]', 'cb=[ESP+4]=20', 'data=[ESP+8]', 'countPtr=[ESP+12]', 'flags=[ESP+16]=0', 'input count=1', 'acquisition/format identity'] },
      apiCompletion: { pc: '0x406926', before: 'any following guest instruction', fields: ['same invocation/thread', 'EAX HRESULT', '[ESP] count', 'if HRESULT=0 and count=1: 20 bytes at ESP+4', 'dwOfs,dwData,dwTimeStamp,dwSequence,uAppData'], invalid: 'Never treat stale record bytes with zero count/error as delivery.' },
      translated: { pc: '0x5807c2', fields: ['EAX character/command', 'ESI UI manager', '[ESI+0x84] shift', '[ESI+0x9c] modifier bits', 'poll invocation'] },
      consumer: { pc: '0x638050', fields: ['entryESP', 'root=[entryESP+4]', 'event=[entryESP+8]', 'character=[entryESP+12]', 'aux=[entryESP+16]', 'element=[entryESP+20]', 'bounded current text+length and cursor'] },
      textLayout: '16-byte MSVC string object at element+0x164; data pointer at object+4, length at object+8. Validate pointers/lengths before reading <=31 bytes; record truncation. Raw text includes | cursor marker; do not confuse its removal on Name submission with character loss. Getter 0x5725f0 can inherit parent text: record actual read object and setter target separately; do not invoke it from observer.',
      commit: { beforePC: '0x6385e6', afterPC: '0x6385eb', fields: ['same invocation/target', 'bounded text+length before/after', 'cursor', 'rejection branches including 0x6385ff'], warning: 'Also observe later writes to this same text object until next poll/render; callback success does not rule out overwrite.' },
      expectedDIK: ['ShiftL=0x2a down', 'C=0x2e down/up', 'ShiftL=0x2a up', 'o=0x18 down/up', 'd=0x20 down/up', 'e=0x12 down/up', 'x=0x2d down/up'],
      discrimination: ['Missing at successful API completion: earlier DirectInput producer/queue/lifecycle boundary.', 'Present at API but absent or changed at translation/target callback: guest scheduling/modifier/routing boundary.', 'Present at callback but absent immediately after commit: edit rejection/mutation boundary.', 'Correct after commit then shortened: later overwrite; retain first writer PC.'],
      controlsRequiredBeforeGuest: ['Fail closed on binary/helper/source identity mismatch.', 'Reject zero-count/error/stale API observations and unrelated invocation/element.', 'Fixture trace missing d must identify first absent API/consumer record; complete-then-overwritten trace must identify first later writer.', 'Disabled-by-default observer must not mutate input/state or invoke guest functions.'],
      bounds: 'Future authorization required. One Name typing action; <=128 observations, <=31 text bytes/record; preserve first overflow and stop without replay.',
    },
  }, null, 2));
}

if (require.main === module) main();
