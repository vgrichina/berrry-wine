'use strict';

// Native WAT OpenGL command-stream ABI metadata and host replay.
// The guest encoder writes validated records directly into linear memory.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GLCommandStream = factory();
})(typeof self !== 'undefined' ? self : globalThis, function () {
  const DEFAULT_BYTES = 2 * 1024 * 1024;
  const HEADER_BYTES = 32;
  const FLAG_POINTER_COPY = 1;
  const FLAG_POINTER_BORROW = 2;
  // Internal command produced by the encoder. It is intentionally outside the
  // guest-visible gl*/wgl* opcode range.
  const PACKED_DRAW_OPCODE = 0x10000;
  // Internal endpoint used by the WAT encoder. The remaining arguments to
  // gpu_gl_call are a linear-memory byte offset and byte length.
  const WAT_STREAM_FLUSH_OPCODE = 0x10001;
  // position3 + color4 + texcoord2 + normal3 + texcoord2 (ARB unit 1).
  // Unit 1's pair is appended rather than interleaved so every existing
  // attribute keeps the byte offset the frontend already publishes.
  const VERTEX_FLOATS = 14;

  const ARG_WORDS = [
    2, 2, 1, 4, 1, 1, 1, 4, 1, 1, 1, 0, 0, 2, 1, 1,
    2, 7, 4, 1, 4, 1, 0, 3, 1, 4, 1, 1, 2, 2, 3, 1,
    12, 0, 1, 1, 12, 0, 0, 4, 3, 3, 2, 2, 3, 9, 3, 9,
    1, 1, 1, 2, 2, 4, 3, 1, 4, 2, 1,
    8, 18, 7, 8, 3, 1, 1, 2, 3, 3, 2, 2, 3, 3, 2, 2, 2, 1, 0,
    2, 2, 2,
    1,
    3,
    3, 3, 3,
    1, 1, 4, 3, 8, 1, 3,
    0, 1, 1, 3, 2, 6,
    1,
    // glTexCoordPointer, glColorPointer, glDrawElements, glGetIntegerv, glReadBuffer
    4, 4, 4, 2, 1,
    // ARB_multitexture: glActiveTextureARB, glClientActiveTextureARB,
    // glMultiTexCoord2fARB(target, s, t)
    1, 1, 3,
    // glDrawArrays(mode, first, count) -- the Descent demo's OpenGL renderer
    3,
    // glMultMatrixf(m) -- UE1 OpenGlDrv; m is copied into the stream like
    // glLoadMatrixf's
    1,
    // glClearDepth(GLclampd) -- a double, two words
    2,
    // glColor3ub(r, g, b) -- Anachronox's ref_gl
    3,
    // glTexParameterfv / glGetTexParameterfv
    3, 3,
    // glGetTexLevelParameteriv / glGetTexLevelParameterfv
    4, 4,
  ];

  const BARRIERS = new Set([
    11, // glFinish
    12, // glGetError
    13, // glGetFloatv
    17, // glReadPixels
    48, 49, 50, 51, 52, 53, 54, // WGL lifecycle/pixel-format operations
    55, // gpuPresent / SwapBuffers
    65, // glIsEnabled
    74, // glGenTextures writes guest output names
    93, // glFlush submits prior rendering commands
    // glGetIntegerv writes its answer into guest memory, so a caller may read
    // that memory on the very next instruction. Warcraft III does exactly that
    // with GL_MAX_TEXTURE_UNITS_ARB: it queries the unit count and copies the
    // result straight into its renderer. Batched, the copy ran first and read
    // zero, and a renderer that believes it has no texture units never calls
    // glEnable(GL_TEXTURE_2D) at all -- the whole scene draws untextured, with
    // nothing in any log to say a query was late rather than wrong.
    103, // glGetIntegerv
    113, // glGetTexParameterfv writes output before the guest resumes
    114, 115, // glGetTexLevelParameteriv/fv: Serious Sam reads the answer at once
  ]);

  function memoryBatch(memory, byteOffset, byteLength) {
    const buffer = memory && memory.buffer ? memory.buffer : memory;
    // WebAssembly shared memory remains a valid SharedArrayBuffer even when
    // cross-origin isolation hides the global constructor. Constructor and
    // instanceof checks also reject buffers created in another realm. DataView
    // performs the specification's internal ArrayBuffer/SharedArrayBuffer slot
    // check without either limitation.
    try {
      new DataView(buffer, 0, 0);
    } catch (_) {
      throw new TypeError('GL command memory is not an ArrayBuffer');
    }
    byteOffset = Number(byteOffset >>> 0);
    byteLength = Number(byteLength >>> 0);
    if ((byteOffset & 3) || (byteLength & 3)
        || byteOffset > buffer.byteLength || byteLength > buffer.byteLength - byteOffset) {
      throw new RangeError('invalid GL command memory range');
    }
    return { buffer, byteOffset, bytes: byteLength };
  }

  function replay(batch, execute) {
    if (!batch || !batch.buffer) return 0;
    const base = batch.byteOffset === undefined ? 0 : Number(batch.byteOffset >>> 0);
    const bytes = Number(batch.bytes >>> 0);
    if ((base & 3) || (bytes & 3) || base > batch.buffer.byteLength
        || bytes > batch.buffer.byteLength - base) {
      throw new RangeError('invalid GL command batch range');
    }
    const limit = bytes;
    const view = new DataView(batch.buffer, base, limit);
    let offset = 0, count = 0, result = 0;
    while (offset < limit) {
      if (offset + HEADER_BYTES > limit) throw new RangeError('truncated GL command header');
      const recordBytes = view.getUint32(offset, true);
      if (recordBytes < HEADER_BYTES || (recordBytes & 3)
          || recordBytes > limit - offset) {
        throw new RangeError('invalid GL command length');
      }
      const opcode = view.getUint32(offset + 4, true) | 0;
      const capture = {
        buffer: batch.buffer,
        stackOffset: base + offset + HEADER_BYTES,
        stackBytes: view.getUint32(offset + 12, true),
        pointerGuest: view.getUint32(offset + 16, true) >>> 0,
        pointerLength: view.getUint32(offset + 20, true) >>> 0,
        pointerOffset: view.getUint32(offset + 24, true) >>> 0,
        pointerBorrowed: !!(view.getUint32(offset + 28, true) & FLAG_POINTER_BORROW),
      };
      if ((capture.stackBytes & 3) || capture.stackBytes > recordBytes - HEADER_BYTES
          || (capture.pointerOffset && (capture.pointerOffset < offset + HEADER_BYTES
            || capture.pointerLength > offset + recordBytes - capture.pointerOffset))) {
        throw new RangeError('invalid GL command payload');
      }
      if (capture.pointerOffset) capture.pointerOffset += base;
      result = execute(opcode, view.getUint32(offset + 8, true) >>> 0, capture) | 0;
      offset += recordBytes;
      count++;
    }
    if (offset !== limit || (batch.commands !== undefined && count !== (batch.commands | 0))) {
      throw new RangeError('GL command batch count mismatch');
    }
    return result;
  }

  return {
    DEFAULT_BYTES, HEADER_BYTES, FLAG_POINTER_COPY, FLAG_POINTER_BORROW,
    PACKED_DRAW_OPCODE, WAT_STREAM_FLUSH_OPCODE, VERTEX_FLOATS,
    ARG_WORDS, BARRIERS, memoryBatch, replay,
  };
});
