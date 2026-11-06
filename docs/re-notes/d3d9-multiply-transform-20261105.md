# D3D9 MultiplyTransform

Run: `scratch/runs/20261105-d3d9-multiply-transform/` (ignored evidence).
Baseline main: `23e0990db3138478f4f96262454b0875390898e2`.

## Contract and implementation

[Microsoft MultiplyTransform](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-multiplytransform)
specifies input matrix times the selected existing matrix. The existing
[transform selectors](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtransformstatetype)
remain unchanged: VIEW 2, PROJECTION 3, TEXTURE0–7 16–23, WORLD0–255
256–511. Other selectors return D3DERR_INVALIDCALL.

[BeginStateBlock's recordable-state list](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-beginstateblock)
does not include MultiplyTransform. The primary implementation cross-check,
[Wine device.c](https://github.com/wine-mirror/wine/blob/master/dlls/d3d9/device.c),
uses live `device->state` for multiplication and `device->update_state` for
SetTransform. Accordingly, multiplication changes live state during recording,
without selecting a recorded transform or changing a previously recorded setter.
Capture refreshes selected block values from live products; Apply restores those
copied values rather than replaying operations. This is a documented-list and
implementation cross-check, not a measurement against native Windows hardware.

The handler preserves its stdcall cleanup and delegates to a state helper.
The helper validates all 64 input bytes before changing the destination, gathers
valid guest-adjacent pages with nonadjacent backing, and snapshots the source in
64 new bytes at the end of each device's allocation. Existing offsets, exports,
and imports are unchanged. The existing matrix core snapshots both operands
before writing, supporting complete and partial input/destination overlap.
WORLD provenance keeps original source bits and treats a successful product as
the live writer. Invalid input returns INVALIDCALL without a successful writer
packet, sentinel modification, or diagnostic-induced memory fault.

## Evidence and checks

`baseline2/result.json` reproduces the original successful no-op through ordinary
public x86 COM vtable calls on both shipped modules, with provenance off/on.
Asymmetric noncommuting A/B matrices have input×state first word 6, reversed
order 7, and unchanged state 1. All four baseline cells observed 1 instead of 6.
The first baseline attempt failed a premature rendering-endpoint test condition;
its log is retained. No implementation change preceded the successful baseline.

`rendered-captures/result.json` and the final rendered run exercise both actual
shipped modules with provenance off/on. A generated ordinary PE runs in the
owning guest CPU Worker and uses the production shared WebGL rendering Worker.
It verifies public COM products for world/view/projection/texture selectors,
device and selector isolation, invalid selectors/pointers, stdcall stack and
callee-saved registers, recording/Capture/Apply, and split-backed input with an
unaligned float crossing the page boundary. The page independently checks the
two committed backing PTEs are nonadjacent, and separately verifies a genuinely
missing second page remains unmapped.

The rendered control draws untransformed colored vertices using the multiplied
WORLD, then overwrites the input and live WORLD before public LockRect readback.
An independent scalar matrix and triangle oracle chooses four interior/exterior
probes that distinguish product, reversed-order, and no-op geometry. Twelve
pixels per module/diagnostic cell, 48 total, must match exactly. Explicit reversed
and no-op matrices are meaningful negative controls. Full 32×32 public readback
captures are retained for each case; compatibility trace-off captures were
personally inspected and show three distinct green-triangle positions. They
are test target captures, not gameplay screenshots.

Focused checks:

- `test-d3d9-stateblocks.js`: all 266 supported selectors, independent scalar
  products, device isolation, complete/partial aliases, actual product provenance,
  and invalid-input diagnostic passivity.
- `test-d3dim-multiply-transform-order.js`.
- `test-d3d9-guest-render-worker.js` and `test-d3d9-shared-render-worker.js`.
- `test-d3d9-typed-stateblocks.js` (81 cases).
- `test-d3d9-viewport-stateblock.js` and `test-d3d9-reset-presentation.js`.
- Required `flock /tmp/wine-build.lock bash tools/build.sh`.

The standard module is 2,175,061 bytes, SHA-256
`d42c4fbcc91d8f20eac4c489f08d9cb2730f4bf2288d72903a09864c4ebb2f09`;
compatibility is 2,177,707 bytes, SHA-256
`6ca9a332279300ec89ccee7f9958c28c2e917ee36c6f23851e1c0782eb975ed3`.
Actual fetched owning modules are hashed and compared to local shipped bytes.
Run logs retain served JS identities, commands, process/port/profile identities,
exact Git revision plus relevant binary/new-file patches, and cleanup checks.

## Limits

This implements the existing selector set without broadening other D3D9 APIs.
Mappedness follows the emulator's memory model; this is not comprehensive
Windows page-protection conformance. Products use the existing f32 matrix core;
NaN payload and device-specific floating-point conformance are not asserted.
Browser controls request ANGLE SwiftShader, not physical GPU coverage.
No original game was launched, no Conan fix is claimed, and no boxes were
assigned or lifecycle operations performed (ID/state/expiry not applicable).
