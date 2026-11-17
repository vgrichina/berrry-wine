#!/usr/bin/env node
// The fixed-function pipeline accepts any declaration type that carries three
// coordinates, not just FLOAT3 and FLOAT4.
//
// Black & White 2's land declares `SHORT4 DEFAULT POSITION0` -- a 16-bit
// heightfield, which is what a terrain mesh would naturally use. Once
// $d3d9_declaration_create stopped refusing types above 4, that declaration
// reached the backend and the NEXT gate refused it instead: fixedPrograms
// insisted the position be FLOAT3 or FLOAT4, so the land draw died one step
// further along with `invalid fixed position format`. drive37 measured it at
// pick+800s with the declaration counter sitting at zero.
//
// Reading the coordinates is not the hard part -- the fetch loop already
// expands every declared type into a float4 register. So each case below
// spells the SAME triangle in a different type and must rasterize the same
// pixels the FLOAT3 spelling does; comparing renders rather than a literal
// keeps the test about the position decode.
//
// The refusals that remain are the ones worth keeping loud: a byte quadruple
// is a colour or an index set, never a coordinate, and POSITIONT's fourth
// component is a real reciprocal w and so must be a float.
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { Device } = require('../lib/d3d9-software-backend');

const W = 16, H = 16;
const identity = () => Float32Array.from([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
// Integer clip-space corners, so every encoding below can hold them exactly
// and a failure is a decode bug rather than a rounding one. The triangle
// covers the target's lower-left half.
const CORNERS = [[-1,-1], [1,-1], [-1,1]];

// type, bytes, and how to write one corner's x,y,z,w.
const CASES = {
  FLOAT3:    { type: 2,  bytes: 12, write: (v,at,x,y) => [x,y,0].forEach((c,i) => v.setFloat32(at+i*4, c, true)) },
  FLOAT4:    { type: 3,  bytes: 16, write: (v,at,x,y) => [x,y,0,1].forEach((c,i) => v.setFloat32(at+i*4, c, true)) },
  SHORT4:    { type: 7,  bytes: 8,  write: (v,at,x,y) => [x,y,0,1].forEach((c,i) => v.setInt16(at+i*2, c, true)) },
  // SHORT4N scales by 32767, so it lands a half-ULP short of the corners
  // rather than exactly on them. That is fine here and is the reason the
  // corners are the clip volume's edges: a vertex that misses by 3e-5 of clip
  // space covers the same pixels, while a component read at the wrong scale
  // or from the wrong offset misses by a whole triangle.
  SHORT4N:   { type: 10, bytes: 8,  write: (v,at,x,y) => [x,y,0,1].forEach((c,i) =>
                 v.setInt16(at+i*2, Math.round(c*32767), true)) },
  FLOAT16_4: { type: 16, bytes: 8,  write: (v,at,x,y) => [x,y,0,1].forEach((c,i) =>
                 v.setUint16(at+i*2, c === 0 ? 0 : (c < 0 ? 0x8000 : 0) | (15 << 10), true)) },
};

const draw = ({ type, bytes, write }, corners = CORNERS) => {
  const stride = bytes + 4;
  const vertices = new Uint8Array(corners.length * stride), view = new DataView(vertices.buffer);
  corners.forEach(([x,y], j) => {
    write(view, j*stride, x, y);
    view.setUint32(j*stride + bytes, 0xff0000ff, true);  // descriptor colour bytes are RGBA
  });
  return { primitive: 4, primitiveCount: 1, stride, vertices, textures: [],
    attributes: [{ register: 0, usage: 0, usageIndex: 0, type, offset: 0 },
      { register: 5, usage: 10, usageIndex: 0, type: 4, offset: bytes }],
    vertexShader: null, pixelShader: null,
    state: { zenable: false, zwrite: false, cull: 1 },
    fixedFunction: { lighting: false, fog: false, specular: false, textureFactor: 0xffffffff,
      world: identity(), view: identity(), projection: identity(),
      stages: [{ colorOp: 2, colorArg1: 0, colorArg2: 0, alphaOp: 2, alphaArg1: 0, alphaArg2: 0,
        constant: 0xffffffff, transformFlags: 0, texCoordIndex: 0 }, { colorOp: 1 }] } };
};

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const device = new Device({ getExports: () => e, getMemory: () => memory.buffer, width: W, height: H });
  try {
    const render = snapshot => {
      device.clear([0,0,0,1], 1);
      device.draw(snapshot);
      return [...device.present().pixels];
    };
    const want = render(draw(CASES.FLOAT3));
    assert.ok(want.some((v,i) => i % 4 !== 3 && v !== 0), 'the control triangle must actually cover pixels');

    for (const [name, encoding] of Object.entries(CASES)) {
      assert.deepStrictEqual(render(draw(encoding)), want,
        `${name} POSITION0 must rasterize the same triangle FLOAT3 does`);
    }

    // A byte quadruple as a position stays refused. D3DCOLOR's components are
    // permuted by the producer before the backend sees them and UBYTE4 is
    // an index set, so either one here is a bug, not a coordinate encoding.
    for (const type of [4, 5, 8]) {
      assert.throws(() => device.draw(draw({ type, bytes: 4,
        write: (v,at,x,y) => [x,y,0,1].forEach((c,i) => v.setUint8(at+i, c & 255)) })),
        /invalid fixed position format/, `type ${type} is not a position`);
    }
    // And so does a type that cannot carry three coordinates at all.
    assert.throws(() => device.draw(draw({ type: 6, bytes: 4,
      write: (v,at,x,y) => [x,y].forEach((c,i) => v.setInt16(at+i*2, c, true)) })),
      /invalid fixed position format/, 'SHORT2 has no z');

    // POSITIONT is still FLOAT4 only: its w is a reciprocal the rasterizer
    // divides by, and an integer encoding of it would mean something else.
    const transformed = draw(CASES.SHORT4);
    transformed.attributes[0].usage = 9;
    assert.throws(() => device.draw(transformed), /invalid fixed position format/,
      'POSITIONT needs a real float w');
  } finally { device.destroy(); assert.strictEqual(device.bytes, 0); }

  console.log('PASS test-d3d9-fixed-position-types');
})().catch(error => { console.error(error); process.exit(1); });
