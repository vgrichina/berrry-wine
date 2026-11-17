#!/usr/bin/env node
'use strict';
// Decode a D3DVERTEXELEMENT9 array, and say whether our renderer accepts it.
//
// A declaration our renderer refuses is invisible at the point of refusal:
// $d3d9_declaration_create (src/09ae-d3d9-resources.wat) sets eax to
// D3DERR_INVALIDCALL, leaves *out at 0 and returns. The guest binds NULL, and
// the consequence surfaces much later and somewhere else, as a draw with
// neither a declaration nor an FVF that the renderer drops (the old JS host,
// deleted d3d9-retire S4, logged a bare "D3D9 FVF 0 is not implemented").
// Black & White 2's world pass lost 316,572
// draws that way. So the useful question is never "did it fail" but "which
// ELEMENT did it fail on, and which rule refused it" -- which is what this
// prints.
//
// Usage:
//   node tools/d3d9-decl-decode.js <hex>        # raw bytes, any spacing/0x
//   node tools/d3d9-decl-decode.js --stdin      # same, read from stdin
// Hex shorter than the D3DDECL_END() terminator is reported as truncated
// rather than guessed at.
const TYPE = ['FLOAT1', 'FLOAT2', 'FLOAT3', 'FLOAT4', 'D3DCOLOR', 'UBYTE4',
  'SHORT2', 'SHORT4', 'UBYTE4N', 'SHORT2N', 'SHORT4N', 'USHORT2N', 'USHORT4N',
  'UDEC3', 'DEC3N', 'FLOAT16_2', 'FLOAT16_4', 'UNUSED'];
const USAGE = ['POSITION', 'BLENDWEIGHT', 'BLENDINDICES', 'NORMAL', 'PSIZE',
  'TEXCOORD', 'TANGENT', 'BINORMAL', 'TESSFACTOR', 'POSITIONT', 'COLOR', 'FOG',
  'DEPTH', 'SAMPLE'];
const METHOD = ['DEFAULT', 'PARTIALU', 'PARTIALV', 'CROSSUV', 'UV', 'LOOKUP',
  'LOOKUPPRESAMPLED'];
const name = (table, i) => table[i] !== undefined ? table[i] : `?${i}`;

// The acceptance rules, in the order $d3d9_declaration_create applies them.
// Each returns the reason string when it REFUSES, so a decode reads as the
// refusal the emulator would actually produce.
const refuse = (e, index, seen) => {
  if (index > 16) return 'more than 17 elements before D3DDECL_END';
  if (e.stream !== 0) return `stream ${e.stream} (only stream 0 is modelled)`;
  if (e.offset & 3) return `offset ${e.offset} is not 4-byte aligned`;
  if (e.type > 4) return `type ${name(TYPE, e.type)} (only FLOAT1..4 and D3DCOLOR are modelled)`;
  if (e.method !== 0) return `method ${name(METHOD, e.method)} (only DEFAULT is modelled)`;
  if (e.usage > 13) return `usage ${e.usage} is out of range`;
  if (e.usageIndex > 15) return `usageIndex ${e.usageIndex} is out of range`;
  if (seen.has(e.usage | (e.usageIndex << 8)))
    return `duplicate ${name(USAGE, e.usage)}${e.usageIndex}`;
  return null;
};

const decode = bytes => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const elements = [], seen = new Set();
  let verdict = null;
  for (let i = 0; ; i++) {
    const at = i * 8;
    if (at + 8 > bytes.length) {
      verdict = verdict || { index: i, reason: 'truncated: no D3DDECL_END() in the bytes given' };
      break;
    }
    const stream = view.getUint16(at, true);
    if (stream === 0xff) {
      const type = bytes[at + 4];
      elements.push({ end: true, ok: type === 17 });
      if (type !== 17 && !verdict)
        verdict = { index: i, reason: `terminator has type ${name(TYPE, type)}, not UNUSED` };
      break;
    }
    const e = { stream, offset: view.getUint16(at + 2, true), type: bytes[at + 4],
      method: bytes[at + 5], usage: bytes[at + 6], usageIndex: bytes[at + 7] };
    const reason = refuse(e, i, seen);
    e.reason = reason;
    if (reason && !verdict) verdict = { index: i, reason };
    seen.add(e.usage | (e.usageIndex << 8));
    elements.push(e);
  }
  return { elements, verdict };
};

const hex = process.argv.includes('--stdin')
  ? require('fs').readFileSync(0, 'utf8')
  : process.argv.slice(2).join(' ');
const digits = hex.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
if (digits.length < 2) {
  console.error('usage: node tools/d3d9-decl-decode.js <hex bytes>   (or --stdin)');
  process.exit(2);
}
const bytes = Uint8Array.from(digits.match(/../g).map(b => parseInt(b, 16)));
const { elements, verdict } = decode(bytes);
elements.forEach((e, i) => {
  if (e.end) return console.log(`[${i}] D3DDECL_END()${e.ok ? '' : '   <-- malformed'}`);
  const label = `[${i}] stream ${e.stream} offset ${String(e.offset).padStart(3)} ` +
    `${name(TYPE, e.type).padEnd(9)} ${name(METHOD, e.method).padEnd(8)} ` +
    `${name(USAGE, e.usage)}${e.usageIndex}`;
  console.log(e.reason ? `${label}   <-- REFUSED: ${e.reason}` : label);
});
console.log(verdict
  ? `\nREFUSED at element ${verdict.index}: ${verdict.reason}`
  : '\nACCEPTED: $d3d9_declaration_create would build this declaration');
process.exit(verdict ? 1 : 0);
