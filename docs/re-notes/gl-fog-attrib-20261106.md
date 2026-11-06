# Public OpenGL fog attribute stack, 2026-11-06

Public production mismatch reproduced before repair. Fog restoration is repaired
in the native raster observer and WebGL frontend; focused qualification is
recorded below. Evidence: `scratch/runs/20261106-gl-fog-attrib/`.

The ordered Conan0820, LegacyMip0900 and KKnD0905 exact FINAL releases and
independent cleanup checks opened the runtime gate. Local locks were acquired
at 10:14:48Z; the immutable 45-minute window ends at 10:59:48Z and includes
cleanup. No boats, guests, original games, deployment or additional Codex workers
were used. Box ID/state/expiry: not applicable.

## Expected behavior

[Microsoft glPushAttrib documentation](https://learn.microsoft.com/en-us/windows/win32/opengl/glpushattrib),
checked 2026-11-06, specifies that GL_FOG_BIT saves fog enable, color, density,
linear start/end, index and mode. GL_ENABLE_BIT saves fog enable, leaving fog
parameters changed. GL_HINT_BIT separately saves fog hint. Unsaved groups
remain changed. A full-stack push or empty-stack pop sets an error and makes
no other state change. Attribute capacity is implementation dependent and at
least 16; test the queried capacity rather than treating a source constant as
an oracle. An overflowing push does not consume the next pop.

## Qualification design

Exercise x86 calls resolved by public LoadLibraryA/GetProcAddress in byte-identical
standard and compatibility shipped modules, using context creation/binding,
state getters and rendered pixels. Check stdcall cleanup, input stack canaries
and preserved registers. No module transforms or mirror setters are acceptance
oracles. The public regression reuses the existing period-state harness in memory;
Git remains the archive for that harness. Its public-call path loads the existing
deterministic kernel32 PE fixture, then resolves OpenGL and GDI entrypoints.
At constant eye distance 0.5, linear fog from 0 to 1 mixes red geometry and
blue fog equally, giving approximately (128, 0, 128); disabled fog leaves red.
Exponential and squared exponential expectations come from their equations;
see [Microsoft glFogf](https://learn.microsoft.com/en-us/windows/win32/opengl/glfogf),
also checked 2026-11-06. The test distance is constant across all triangle
vertices, so fog interpolation cannot change the expected center pixel.
Check selected and unselected masks, nesting, context switches, lighting
sidecars, queued immutable rendering, public depth/error behavior and guest
register preservation. Retain before-repair observations and module hashes.

Static routing evidence supplied by the coordinator is
`scratch/usage-watch/gl-fog-attrib-static.json`; its source hashes were refreshed
in the run manifests before execution. The old mirror-only test's untouched-fog expectation and
the raster's missing explicit fog branch do not establish a public defect.

## Reproduction before repair

Source base: `673b97cd8d9c48b59f0b2298dabc6420f3c2dae9`, with relevant
uncommitted hunks pinned in `baseline-prebuild-tracked.diff` and
`reproduced-before-repair-tracked.diff`. Both baseline shipped modules were built
with the locked full build before any production edits:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| standard | 2178624 | `3b7511d12f3e8d364eb6bf29cdeed8b53af07abc53644d4f186e46f8620da149` |
| compatibility | 2181270 | `33c0e72903f542222ec7bb1330a3a408743765184b4a7b8da451e24faf612f41` |

The synchronous public x86 reproduction made 227 comparisons in each module,
with 79 mismatches each. Linear, disabled, exponential and squared exponential
fog controls all passed. With enabled blue linear fog A saved by GL_FOG_BIT,
then changed to disabled green exponential fog B, pop left the software pixel
red `(255,0,0)` instead of approximately `(128,0,128)`. Public parameter getters
returned B. `glIsEnabled` returned true while native float/boolean enable getters
and raster state stayed disabled. GL_ENABLE_BIT correctly restored only enable;
unrelated polygon, lighting and hint groups left changed fog parameters intact.
The native queued standard-module reproduction also retained the defect (81
mismatches); its captured old draw remained immutable.

`before-browser/result.json` independently records actual public x86 calls,
production RPC and physical browser render Workers in both shipped modules,
WebGL1 and WebGL2. All four analytical controls passed in every cell. GL_FOG_BIT
and ALL_ATTRIB_BITS pop rendered exponential green `(94,161,0)` instead of
linear purple `(128,0,128)`, with changed parameters still queried. A nested
outer pop queried fog enabled but left the shader disabled after the inner
state had been drawn. This established both native and frontend gaps before
any repair. The first run-only helper attempt omitted its GDI surface lookup
and failed context binding; that harness error is retained separately and is
not the reproduction.

## Repair

The existing period lighting snapshot remains 976 bytes. Fog adds a separate
56-byte segment only when GL_FOG_BIT is selected: matrix fog parameters/index
and raster fog globals. The frame retains its existing owned pointer, released
on pop or nonempty-context deletion. Fog enable restores from the existing
saved capability word. Native fog enable tracking also runs for WebGL contexts,
so native getters use the same selected state. GL_ENABLE_BIT does not restore
fog parameters; GL_HINT_BIT continues to own fog hint separately.

The frontend snapshots fog values with an independent color array, restores
them for GL_FOG_BIT, and dirties the fog uniforms. Fog enable becomes dirty
for either GL_FOG_BIT or GL_ENABLE_BIT, including a pop after an intervening
draw consumed the previous uniform update. No ABI handlers changed. The old
mirror-only matrix test and complete lighting sidecar were preserved. The
incorrect raster overflow comment was corrected; public stack behavior did
not need a repair.

## Regression coverage

`test/test-gl-fog-attrib-public.js` reuses the period harness, loads a real
kernel32 fixture PE, resolves public GL/GDI functions and calls their actual
x86 thunks in unmodified module bytes. It verifies stdcall stack cleanup,
input stack canaries and all preserved guest registers on every call.
`test/gl-fog-attrib-cases.js` supplies independent documented expectations:

- Fog, enable-only, polygon, lighting, hint, combined fog/lighting and all masks;
  float/double/boolean getters, mode queries, hint ownership and analytical pixels.
- Mixed/nested stacks, context isolation, deletion with nonempty fog/lighting
  frames and survival of the other context.
- Existing lighting front/back emissions, light diffuse/position, local viewer,
  two-sided state, fog coexistence and emission pixels.
- Queried stack capacity (16 here; the documented minimum is the only literal
  capacity constraint), every accepted frame, overflow/underflow errors and
  unchanged fog/depth, plus Begin/End rejection.
- A physically queued native draw held across fog mutation and pop: immutable
  bytes/hash, captured old pixels, later restored pixels and zero fallback.
- Enable-only restoration after an intervening draw, with parameters retained.

The browser fragment-composition regression adds public state and analytical
fog pixels while preserving its existing queued texture/fog/blend equations,
lease checks, alpha witness and presentation checks. Its shared producer and
scenario also run through the actual WineAssembly process/endpoint factory.
The durable public regression rejects both retained old native modules; those
negative runs use the repaired frontend and isolate the old native defect.

Final build, focused results and cleanup are listed in the run's result.json;
all command lines and exit statuses have individual logs. Existing focused
checks passed: attrib mirror, period server state standard/compat with and
without Worker, exact-source native lighting with and without Worker, software
orthographic fog, integer light/material/fog, clipped depth fog, variable-Q fog
and projection/fog composition. No application gameplay claim follows from
these GL controls.

Git is the source archive. Source manifests, binary diffs and owned new-file
patches preserve the tested source without tree snapshots. Before/after module
binaries and unique logs/captures are retained. Shared VFS work by another
owner is included explicitly in relevant source diffs and was not edited.
No further fog repair is indicated by this scope's passing controls.

## Final result

Locked `flock /tmp/wine-build.lock bash tools/build.sh` passed on the final
source. Both exact shipped modules passed 239 synchronous comparisons and
244 queued comparisons each, with 19/21 analytical pixel cases respectively.
Both queued runs reported zero fallback and retained immutable lease hashes.
The default compile-from-source invocation passed too. WebGL1/2 across both
modules passed 56 fog cases; the actual process factory passed 84 more across
both modules and default/WebGL/software selections. The additional draw before
GL_ENABLE_BIT pop passed in all these routes. Two representative final
presentation PNGs were visually inspected; fog acceptance uses the recorded
public queries and analytical readbacks, not those final composition PNGs.

| Repaired module | Bytes | SHA-256 |
| --- | ---: | --- |
| standard | 2178864 | `ab1ce417568573f42448f031ab6cb4d8c7db0d33adb7727ca97b7e3a5be3a692` |
| compatibility | 2181510 | `4b94ed4d8851472227a00debf7148f3d4bba12c8f362bdaf381b57488eee2bd2` |

Reproduce with `GL_PERIOD_MODULE=build/wine-assembly.wasm node
test/test-gl-fog-attrib-public.js` (add `--worker` for the native queue), then
use the compatibility module path. Browser coverage is in
`node test/test-opengl-fragment-composition-web.js` and
`node test/test-gl-process-factory-composition-web.js`. Their run-specific
wrappers additionally record actual fetched module hashes and owned cleanup.
