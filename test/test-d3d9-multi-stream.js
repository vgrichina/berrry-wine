#!/usr/bin/env node
// A vertex declaration reading two streams draws what one stream draws.
//
// D3D9 devices expose 16 vertex streams, and a declaration element names the
// one it reads from. This renderer modelled exactly one: the device state held
// a single {buffer, offset, stride} triple, SetStreamSource stored nothing for
// any index but 0, and $d3d9_declaration_create refused any element naming
// another stream. All three failed SILENTLY -- SetStreamSource set
// D3DERR_INVALIDCALL, the declaration came back NULL with the HRESULT nobody
// checks, and the draw that later bound that NULL was dropped by
// lib/d3d9-host.js as "D3D9 FVF 0 is not implemented", a message about FVFs
// for a problem that has nothing to do with FVFs.
//
// Black & White 2 puts TEXCOORD2 on stream 1 throughout its menus, which is
// how ~61% of its world draws went missing in a run reporting errors=0/0. See
// docs/re-notes/black-white-2.md.
//
// The test drives the real guest-facing handlers, because that is where the
// refusals lived. Its central assertion is a comparison, not a literal: the
// same triangle, with its colour moved to a second stream, must produce the
// same pixels. A renderer that read the colour from the wrong buffer, at the
// wrong stride, or at the position stream's offset would still draw something
// -- and would still fail this.
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const { Bridge } = require('../lib/d3d9-host');

const DEVICE_CALLS = ['CreateVertexDeclaration', 'SetVertexDeclaration', 'SetStreamSource',
  'GetStreamSource', 'DrawPrimitive', 'Present', 'SetRenderState', 'CreateVertexShader',
  'CreatePixelShader', 'SetVertexShader', 'SetPixelShader', 'GetDeviceCaps'];

// POSITION as FLOAT3 and COLOR as D3DCOLOR, each element naming its stream.
// D3DVERTEXELEMENT9 is {u16 stream, u16 offset, u8 type, u8 method, u8 usage,
// u8 usageIndex}, and D3DDECL_END is {0xff,0,UNUSED(17),0,0,0}.
const declarationBytes = (colorStream, colorOffset, positionStream = 0) => {
  const bytes = new Uint8Array(24), view = new DataView(bytes.buffer);
  view.setUint16(0, positionStream, true); view.setUint16(2, 0, true);
  bytes.set([2, 0, 0, 0], 4);                       // FLOAT3 DEFAULT POSITION0
  view.setUint16(8, colorStream, true); view.setUint16(10, colorOffset, true);
  bytes.set([4, 0, 10, 0], 12);                     // D3DCOLOR DEFAULT COLOR0
  view.setUint16(16, 0xff, true); bytes.set([17, 0, 0, 0], 20);
  return bytes;
};

(async () => {
  let bridge;
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none',
    extraHostOverrides: { gpu_gl_call: (op, p, a) => bridge.call(op, p, a) },
    extraWat: `
    (func (export "create_device") (param $pp i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $pp))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (local.get $out))
      (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1)
        (i32.const 1) (i32.const 0) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "target_bits") (param $d i32) (result i32)
      (load.field DxObject misc1 (call $d3ddev_rt_entry (local.get $d))))
    (func (export "create_buffer") (param $d i32) (param $length i32) (param $out i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (local.get $out))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateVertexBuffer (local.get $d) (local.get $length)
        (i32.const 0) (i32.const 0x42) (i32.const 1) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    (func (export "clear_target") (param $d i32) (param $color i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 0))
      (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 0))
      (call $handle_IDirect3DDevice9_Clear (local.get $d) (i32.const 0) (i32.const 0)
        (i32.const 1) (local.get $color) (i32.const 0)) (i32.load offset=0 (global.get $reg_base)))
    ${[['Buffer9', 'Lock'], ['Buffer9', 'Unlock']].map(([type, n]) => `
      (func (export "${type}_${n}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
        (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
        (call $handle_IDirect3D${type}_${n} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (local.get $f) (i32.const 0))
        (i32.load offset=0 (global.get $reg_base)))`).join('\n')}
    ${DEVICE_CALLS.map(n => `(func (export "${n}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_IDirect3DDevice9_${n} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (local.get $f) (i32.const 0))
      (i32.load offset=0 (global.get $reg_base)))`).join('\n')}
  ` });
  bridge = new Bridge({ backend: 'software', enableProgrammable: true,
    getExports: () => e, getMemory: () => memory.buffer,
    guestToWasm: p => e.guest_to_wasm(p) >>> 0 });
  e.init_dx_com_thunks();

  const view = new DataView(memory.buffer);
  const wa = guest => e.guest_to_wasm(guest) >>> 0;
  const alloc = bytes => e.guest_alloc(bytes) >>> 0;
  const ok = (result, what) => assert.strictEqual(result >>> 0, 0,
    `${what} (0x${(result >>> 0).toString(16)})${bridge.lastError ? ' ' + bridge.lastError : ''}`);
  const out = alloc(4);

  // An 8x8 A8R8G8B8 windowed device with a real automatic D24X8 attachment,
  // and D3DPRESENT_INTERVAL_IMMEDIATE so the pixels are readable synchronously.
  const parameters = alloc(64);
  new Uint8Array(memory.buffer, wa(parameters), 64).fill(0);
  [8, 8, 21, 1, 0, 0, 1, 1, 1].forEach((v, i) => e.guest_write32(parameters + i * 4, v));
  e.guest_write32(parameters + 36, 1);
  e.guest_write32(parameters + 40, 77);
  e.guest_write32(parameters + 52, 0x80000000);
  ok(e.create_device(parameters, out), 'CreateDevice');
  const device = e.guest_read32(out) >>> 0;
  const caps = alloc(304);
  ok(e.GetDeviceCaps(device, caps, 0, 0, 0), 'GetDeviceCaps');
  const maxStreams = e.guest_read32(caps + 188) >>> 0;
  assert.strictEqual(maxStreams, 16, 'MaxStreams covers the implemented stream table');

  const shader = (tokens, pixel) => {
    const guest = alloc(tokens.length * 4);
    new Uint32Array(memory.buffer, wa(guest), tokens.length).set(tokens);
    ok(e[pixel ? 'CreatePixelShader' : 'CreateVertexShader'](device, guest, out, 0, 0),
      `Create${pixel ? 'Pixel' : 'Vertex'}Shader`);
    ok(e[pixel ? 'SetPixelShader' : 'SetVertexShader'](device, e.guest_read32(out) >>> 0, 0, 0, 0),
      `Set${pixel ? 'Pixel' : 'Vertex'}Shader`);
  };
  // Position straight through, colour straight through: the picture is the
  // vertex colour, so a colour fetched from the wrong place shows up as pixels.
  shader([0xfffe0101, 1, 0xc00f0000, 0x90e40000, 1, 0xd00f0000, 0x90e40001, 0xffff], false);
  shader([0xffff0101, 1, 0x800f0000, 0x90e40000, 0xffff], true);
  ok(e.SetRenderState(device, 22, 1, 0, 0), 'disable culling'); // D3DRS_CULLMODE = NONE
  ok(e.SetRenderState(device, 7, 0, 0, 0), 'disable z'); // D3DRS_ZENABLE

  const CORNERS = [[-1, 1, 0.25], [1, 1, 0.25], [-1, -1, 0.25]];
  const COLOR = 0xff2040c0;
  // One buffer holding position+colour interleaved, and two holding the same
  // data split across a pair of streams. The split pair uses a deliberately
  // DIFFERENT stride from the interleaved buffer (12 and 4 against 16), so a
  // renderer that reused stream 0's stride for stream 1 reads the wrong bytes.
  const fill = (length, write) => {
    ok(e.create_buffer(device, length, out), `CreateVertexBuffer(${length})`);
    const buffer = e.guest_read32(out) >>> 0;
    ok(e.Buffer9_Lock(buffer, 0, 0, out, 0), 'Lock');
    write(wa(e.guest_read32(out) >>> 0));
    ok(e.Buffer9_Unlock(buffer, 0, 0, 0, 0), 'Unlock');
    return buffer;
  };
  const interleaved = fill(48, at => CORNERS.forEach((corner, i) => {
    corner.forEach((c, j) => view.setFloat32(at + i * 16 + j * 4, c, true));
    view.setUint32(at + i * 16 + 12, COLOR, true);
  }));
  const positions = fill(36, at => CORNERS.forEach((corner, i) =>
    corner.forEach((c, j) => view.setFloat32(at + i * 12 + j * 4, c, true))));
  const colors = fill(12, at => CORNERS.forEach((_, i) => view.setUint32(at + i * 4, COLOR, true)));

  // Interleaved, the colour follows the position in the same vertex; split, it
  // starts its own buffer.
  const declare = (colorStream, colorOffset, positionStream = 0) => {
    const bytes = declarationBytes(colorStream, colorOffset, positionStream), guest = alloc(bytes.length);
    new Uint8Array(memory.buffer, wa(guest), bytes.length).set(bytes);
    const result = e.CreateVertexDeclaration(device, guest, out, 0, 0) >>> 0;
    return { result, declaration: e.guest_read32(out) >>> 0 };
  };

  const render = () => {
    ok(e.clear_target(device, 0xff000000), 'Clear');
    ok(e.DrawPrimitive(device, 4, 0, 1, 0), 'DrawPrimitive');
    ok(e.Present(device, 0, 0, 0, 0), 'Present');
    return new Uint32Array(memory.buffer, e.target_bits(device) >>> 0, 64)[9];
  };

  // Control: everything on stream 0, the only arrangement that ever worked.
  const single = declare(0, 12);
  ok(single.result, 'CreateVertexDeclaration(colour on stream 0)');
  assert.notStrictEqual(single.declaration, 0, 'stream-0 declaration is a real object');
  ok(e.SetVertexDeclaration(device, single.declaration, 0, 0, 0), 'SetVertexDeclaration');
  ok(e.SetStreamSource(device, 0, interleaved, 0, 16), 'bind the interleaved buffer');
  const expected = render();
  assert.strictEqual(expected, COLOR, 'the control draw must paint the vertex colour');

  // The same triangle with its colour moved to stream 1.
  const split = declare(1, 0);
  ok(split.result, 'CreateVertexDeclaration(colour on stream 1)');
  assert.notStrictEqual(split.declaration, 0,
    'a declaration naming stream 1 is created, not silently refused');
  ok(e.SetVertexDeclaration(device, split.declaration, 0, 0, 0), 'SetVertexDeclaration');
  ok(e.SetStreamSource(device, 0, positions, 0, 12), 'bind positions to stream 0');
  ok(e.SetStreamSource(device, 1, colors, 0, 4), 'SetStreamSource(1) binds');
  assert.strictEqual(render(), expected, 'two streams draw what one stream drew');

  // GetStreamSource must read back what SetStreamSource stored, for a non-zero
  // index too -- it used to answer INVALIDCALL for everything but stream 0.
  const [got, offset, stride] = [alloc(4), alloc(4), alloc(4)];
  ok(e.GetStreamSource(device, 1, got, offset, stride), 'GetStreamSource(1)');
  assert.deepStrictEqual([e.guest_read32(got) >>> 0, e.guest_read32(offset) >>> 0,
    e.guest_read32(stride) >>> 0], [colors, 0, 4], 'stream 1 reads back as it was bound');

  // Stream 0 is not mandatory. A declaration can legally source every input
  // from any one of the sixteen streams; requiring stream 0 here would be an
  // implementation artifact inherited from the old single-stream descriptor.
  const onlyOne = declare(1, 12, 1);
  ok(onlyOne.result, 'CreateVertexDeclaration(all attributes on stream 1)');
  ok(e.SetVertexDeclaration(device, onlyOne.declaration, 0, 0, 0),
    'SetVertexDeclaration(all attributes on stream 1)');
  ok(e.SetStreamSource(device, 0, 0, 0, 0), 'unbind unused stream 0');
  ok(e.SetStreamSource(device, 1, interleaved, 0, 16), 'bind all attributes to stream 1');
  assert.strictEqual(render(), expected, 'stream 1 draws without stream 0 bound');

  // Exercise the last advertised stream, with the same pixel comparison as
  // the lower streams. Consumers may reject a packing layout before creating
  // its declaration when GetDeviceCaps understates this bound.
  const last = maxStreams - 1;
  const lastDeclaration = declare(last, 12, last);
  ok(lastDeclaration.result, 'CreateVertexDeclaration(last advertised stream)');
  ok(e.SetVertexDeclaration(device, lastDeclaration.declaration, 0, 0, 0),
    'SetVertexDeclaration(last advertised stream)');
  ok(e.SetStreamSource(device, 1, 0, 0, 0), 'unbind stream 1 before last-stream draw');
  ok(e.SetStreamSource(device, last, interleaved, 0, 16), 'bind last advertised stream');
  assert.strictEqual(render(), expected, 'last advertised stream draws the same pixels');
  ok(e.SetStreamSource(device, last, 0, 0, 0), 'unbind last advertised stream');
  ok(e.SetVertexDeclaration(device, onlyOne.declaration, 0, 0, 0),
    'restore the stream-1 declaration for the unbound-stream check');

  // A stream the declaration names and nothing fills must draw NOTHING -- not
  // whatever stream 1 held last, and not stream 0's bytes read at stream 1's
  // offset. The draw is queued asynchronously, so the HRESULT it returns is
  // about queueing; the picture is what says whether it ran.
  ok(e.SetStreamSource(device, 1, 0, 0, 0), 'unbind stream 1');
  e.clear_target(device, 0xff000000);
  e.DrawPrimitive(device, 4, 0, 1, 0);
  e.Present(device, 0, 0, 0, 0);
  assert.notStrictEqual(new Uint32Array(memory.buffer, e.target_bits(device) >>> 0, 64)[9], expected,
    'a declaration naming an unbound stream does not paint the triangle');
  // The error names the stream. That matters more than it sounds: the whole
  // reason this cost a multi-session investigation is that the old failure
  // announced itself as "D3D9 FVF 0 is not implemented" from a draw that had
  // never touched an FVF. (The queue's error is sticky, so this draw also
  // takes the Clear and Present around it down with it -- a separate design
  // that test/test-d3d9-unbound-sampler.js documents.)
  assert.match(String(bridge.lastError), /stream 1/,
    'and says which stream it was, rather than blaming the FVF');

  // 16 streams exist; a 17th does not.
  assert.strictEqual(e.SetStreamSource(device, 16, colors, 0, 4) >>> 0, 0x8876086c,
    'stream 16 is out of range');

  console.log('PASS test-d3d9-multi-stream');
})().catch(error => { console.error(error); process.exit(1); });
