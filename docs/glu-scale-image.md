# GLU image scaling contract

`gluScaleImage(format, widthIn, heightIn, typeIn, dataIn, widthOut,
heightOut, typeOut, dataOut)` is API id 4594, GL command opcode 141,
with nine physical stdcall argument dwords (40-byte cleanup including the
return address). Both identifiers are appended. Existing API rows and GL
opcodes retain their original order.

The generated dispatcher uses the existing `$handle_gpu_api` route. The WAT
encoder captures the stack and flushes opcode 141 synchronously; production
`OpenGLHostBridge.replay` returns its GLU status and writes guest memory before
the guest resumes. Input/output pixels are accessed through the canonical
guest translator while the producer is parked. The operation executes
immediately during display-list compilation, without recording a list command.

The implementation supports the GLU reference's color/index/depth formats:
COLOR_INDEX, STENCIL_INDEX, DEPTH_COMPONENT, RED, GREEN, BLUE, ALPHA, RGB,
RGBA, LUMINANCE, LUMINANCE_ALPHA, BGR and BGRA. Input and output independently
accept BYTE, UNSIGNED_BYTE, SHORT, UNSIGNED_SHORT, INT, UNSIGNED_INT, FLOAT,
BITMAP and the twelve RGB/RGBA packed pixel types (332/233_REV, 565/565_REV,
4444/4444_REV, 5551/1555_REV, 8888/8888_REV and 1010102/2101010_REV).
Three-component packed types require RGB; four-component packed types require
RGBA or BGRA. No valid type is accepted as an unimplemented success stub.

Filtering uses a box footprint for reduction and linear interpolation for
enlargement, separately per axis. Edges wrap as in the SGI GLU implementation.
Conversion uses the SGI-style unsigned 16-bit intermediate, including its
limited precision and legacy signed/index conversions. This is not a claim
of bit-identical results to every native GLU implementation. FLOAT color
values in [0, 1] are quantized to that intermediate; arbitrary nonfinite float
behavior is not qualified.

PACK and UNPACK alignment, row length, skipped rows/pixels, byte swapping and
bitmap LSB-first modes are per-context state. Client pixel-store push/pop
preserves them; integer queries expose them. Row padding and unrelated bitmap
bits remain untouched. Input is snapshotted before output, including when
buffers overlap. Sparse pages may have nonadjacent physical backing.

Return codes are 0 (success), 100900 (GLU_INVALID_ENUM), 100901
(GLU_INVALID_VALUE), 100902 (GLU_OUT_OF_MEMORY), and 100904
(GLU_INVALID_OPERATION for incompatible packed formats). A zero dimension is
a no-op, with the SGI zero-before-negative validation order. Negative
dimensions otherwise fail. Scratch storage is bounded to a combined 8,388,608
16-bit input/output components (16 MiB); exceeding it returns OUT_OF_MEMORY.
Allocation RangeError also returns OUT_OF_MEMORY.

As an emulator safety extension, null, unmapped, overflowing or out-of-linear-
memory guest spans return INVALID_VALUE. Every touched page of both buffers
is checked before writes. There is no partial output on those validation
failures. Concurrent guest remapping during a call is not qualified.
The existing current-context requirement of the GL bridge applies.

Run `node test/test-glu-scale-image.js` for production bridge and replay tests,
hash lookup/dispatch ABI checks, stable historical order, identity and resize
filters, pixel storage, scalar/packed/bitmap conversion, sparse pages, overlap,
errors and bounds. `GLU_CONTROL_SOURCE` may point to a pinned pre-change
`lib/gl-compat.js`; the same regression must reject its missing opcode.
Check generated files with `tools/gen_api_table.js --check`,
`tools/gen_dispatch.js --check`, `tools/gen-gl-encoder-abi.js --check` and
`tools/check-gl-barriers.js`.

References consulted:

- [GLU reference page published by X.Org](https://xorg.freedesktop.org/archive/X11R6.8.1/doc/gluScaleImage.3.html)
- [SGI GLU source maintained in ReactOS](https://github.com/reactos/reactos/blob/master/dll/opengl/glu32/src/libutil/mipmap.c)
- [Khronos GLU reference location](https://registry.khronos.org/OpenGL-Refpages/gl2.1/xhtml/gluScaleImage.xml)

This task verifies source generation and executable host behavior only. It
does not qualify a full WAT build, original TuxRacer PE startup, rendering or
gameplay, and uses no original game media or guest runtime.
