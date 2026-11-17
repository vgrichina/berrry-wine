'use strict';
// WAT-owned WGL (src/09a8cw-gl-wgl.wat): the software GL context lifecycle,
// presentation, glReadPixels, glGenTextures and the GLU entry points answered
// in WAT with no command batch reaching a host. The oracle for every answer is
// the same guest call sequence on the JS-hosted path (OpenGLHostBridge), which
// this slice retires; the owned arm's harness throws if WAT sends a batch.
const assert = require('assert');
const { bootGlGps, comparePictures } = require('./helpers/gl-gps-context');

const scene = async g => {
  const out = {};
  const { call, e, wa, dc, context } = g;
  const mem = () => new Uint8Array(g.memory.buffer);
  const dv = () => new DataView(g.memory.buffer);
  const buf = n => { const p = e.guest_alloc(n) >>> 0; mem().fill(0xcd, wa(p), wa(p) + n); return p; };
  const words = (p, n) => Array.from({ length: n }, (_, i) => dv().getUint32(wa(p) + i * 4, true));
  const bytes = (p, n) => Array.from(mem().slice(wa(p), wa(p) + n));
  out.context = context;
  // A picture; read it back, then present it.
  g.clear([0.25, 0.5, 0.75, 1].map(g.f));
  g.quad(-0.5, -0.5, 0.5, 0.5, [1, 0, 0, 1].map(g.f));
  // glReadPixels: inside, and partly outside the drawable (outside stays 0).
  const rp = buf(6 * 6 * 4);
  call('glPixelStorei', [0xd05, 1]);
  call('glReadPixels', [g.size - 3, g.size - 3, 6, 6, 0x1908, 0x1401, rp]);
  out.readOutside = bytes(rp, 6 * 6 * 4);
  const rp2 = buf(16 * 3);
  call('glReadPixels', [0, 8, 16, 1, 0x1907, 0x1401, rp2]);
  out.readRow = bytes(rp2, 16 * 3);
  out.readError = call('glGetError');
  out.flush = call('glFlush');
  out.swap = g.swap();
  // Generated names: unbound names stay reserved, deletion frees them.
  const names = buf(64);
  call('glGenTextures', [3, names]); out.gen1 = words(names, 3);
  call('glBindTexture', [0xde1, out.gen1[1]]);
  call('glDeleteTextures', [1, names]);
  call('glGenTextures', [2, names]); out.gen2 = words(names, 2);
  // A second context, then sharing and deletion.
  const second = call('wglCreateContext', [dc]);
  out.second = second;
  out.shareFresh = call('wglShareLists', [context, second]);
  out.shareAgain = call('wglShareLists', [context, second]);
  call('glGenTextures', [1, names]); out.gen3 = words(names, 1);
  out.deleteCurrentOk = call('wglDeleteContext', [second]);
  out.makeMissing = call('wglMakeCurrent', [dc, 0x7777]);
  out.makeBack = call('wglMakeCurrent', [dc, context]);
  // GLU: mipmaps' size check and gluScaleImage over formats and stores.
  const src = buf(64 * 4), dst = buf(64 * 4);
  for (let i = 0; i < 64 * 4; i++) mem()[wa(src) + i] = (i * 37 + 11) & 255;
  out.mipBad = call('gluBuild2DMipmaps', [0xde1, 4, 0, 4, 0x1908, 0x1401, src]);
  out.scale = [];
  const cases = [
    [0x1909, 3, 2, 0x1401, 2, 4, 0x1401],
    [0x1908, 4, 4, 0x1401, 3, 2, 0x1401],
    [0x1907, 5, 3, 0x1401, 2, 2, 0x1406],
    [0x1908, 2, 2, 0x8033, 4, 4, 0x1401],
    [0x1908, 3, 3, 0x1401, 2, 2, 0x8367],
    [0x1907, 4, 2, 0x1403, 3, 3, 0x8363],
    [0x1909, 8, 2, 0x1a00, 4, 4, 0x1400],
    [0x1906, 3, 3, 0x1404, 2, 5, 0x1405],
    [0x1908, 2, 2, 0x1401, 1, 1, 0x8034],
  ];
  for (const [format, wi, hi, ti, wo, ho, to] of cases) {
    mem().fill(0xcd, wa(dst), wa(dst) + 64 * 4);
    const status = call('gluScaleImage', [format, wi, hi, ti, src, wo, ho, to, dst]);
    out.scale.push([status, bytes(dst, 64 * 4)]);
  }
  // Pixel store applies: unpack skip and pack row length / alignment.
  call('glPixelStorei', [0xcf3, 1]); call('glPixelStorei', [0xd02, 5]); call('glPixelStorei', [0xd05, 4]);
  mem().fill(0xcd, wa(dst), wa(dst) + 64 * 4);
  out.scale.push([call('gluScaleImage', [0x1907, 3, 3, 0x1401, src, 2, 2, 0x1401, dst]), bytes(dst, 64 * 4)]);
  call('glPixelStorei', [0xcf3, 0]); call('glPixelStorei', [0xd02, 0]); call('glPixelStorei', [0xd05, 1]);
  out.scaleErrors = [
    call('gluScaleImage', [0x1908, -1, 2, 0x1401, src, 2, 2, 0x1401, dst]),
    call('gluScaleImage', [0x1234, 2, 2, 0x1401, src, 2, 2, 0x1401, dst]),
    call('gluScaleImage', [0x1907, 2, 2, 0x8033, src, 2, 2, 0x1401, dst]),
  ];
  out.release = call('wglMakeCurrent', [0, 0]);
  out.flushNone = call('glFlush');
  out.makeAgain = call('wglMakeCurrent', [dc, context]);
  return out;
};

(async () => {
  for (const gps of [0, 1]) {
    const js = await bootGlGps({ gps });
    const jsOut = await scene(js); const jsPic = js.front();
    const wat = await bootGlGps({ gps, owned: true });
    const watOut = await scene(wat); const watPic = wat.front();
    assert.strictEqual(wat.e.gl_sw_enabled(), 1, 'owned arm draws in WAT');
    for (const key of Object.keys(jsOut)) {
      if (key === 'flush' || key === 'flushNone') continue;
      assert.deepStrictEqual(watOut[key], jsOut[key], `gps=${gps} ${key}`);
    }
    // glFlush without a current context: the JS host answered 0; so does WAT.
    assert.strictEqual(watOut.flushNone, 0);
    assert.strictEqual(watOut.flush, 1);
    const cmp = comparePictures(jsPic, watPic, 0);
    assert(cmp.ok, `gps=${gps} pictures differ: ${JSON.stringify(cmp)}`);
    // Not a vacuous comparison: the scene reached real answers.
    assert.deepStrictEqual(watOut.gen1, [1, 2, 3]);
    assert(watOut.readRow.some(v => v !== 0 && v !== 0xcd), 'pixels were read');
    assert(watOut.scale.filter(([s]) => s === 0).length >= 9, 'scale cases ran');
    assert(watOut.scale.every(([s, b]) => s || b.some(v => v !== 0xcd)), 'scale wrote output');
    console.log(JSON.stringify({ gps, context: watOut.context, second: watOut.second, gen: [watOut.gen1, watOut.gen2, watOut.gen3],
      share: [watOut.shareFresh, watOut.shareAgain], del: watOut.deleteCurrentOk, make: [watOut.makeMissing, watOut.makeBack],
      mipBad: watOut.mipBad, scaleStatus: watOut.scale.map(([s]) => s), scaleErrors: watOut.scaleErrors,
      readRow: watOut.readRow.slice(0, 6), readError: watOut.readError }));
    console.log(`gps=${gps} PASS ${Object.keys(jsOut).length} answers, scale cases ${jsOut.scale.length}`);
  }
  console.log('PASS test-gl-wgl-owned');
})().catch(error => { console.error(error); process.exit(1); });
