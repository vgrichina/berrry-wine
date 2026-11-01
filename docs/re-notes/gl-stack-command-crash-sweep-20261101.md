# OpenGL stack, command and display-list crash sweep — 2026-11-01

Run: `20261101-gl-stack-command-crash-sweep` (local, ignored evidence in
`scratch/runs/20261101-gl-stack-command-crash-sweep/`). All four requested
fixtures passed sequentially. No unexpected native crash, unhandled Wasm trap,
signal or timeout occurred. Two deliberate `assert.throws(WebAssembly.RuntimeError)`
guards in the display-list fixture passed. These fixtures establish neither
overall crash freedom nor gameplay compatibility.

## Revision, environment and build evidence

- Requested baseline: `c08ac560f008bf74d0f40ee417f7e9bd11156b3a`, branch `main`.
- Actual HEAD for every test: `ae6767ceb68bf39b8aae4c1c35071ef74ce94a47`.
  The intervening commit changes only `TODOS.md` and `ops/STATUS.md`, allowed
  by the assignment's documentation-only advancement provision.
- Linux x86-64, Node `24.18.1`, V8 `13.6.233.17-node.50`. Local headless
  `render-helper` uses the repository's JS raster canvas; no browser/WebGL
  driver, game executable or remote box was exercised.
- All 4,462 inventoried inputs match the accepted preceding run's
  `inputs-after.json`, match baseline tracked bytes, and remain unchanged
  before/after these tests. The 67 distinct loaded CommonJS modules were
  hashed at exit and checked again afterwards; all 45 tracked loaded modules
  match baseline. The other 22 are installed dependencies, with exit-time
  byte identities recorded, not Git provenance. The sealed compiler graph's
  sources are covered by the input inventory.
- Reused accepted `timeout 120s flock /tmp/wine-build.lock bash tools/build.sh`
  evidence from `20261101-d3d-typed-stateblock-injection/build.log` and
  `outcomes.json`: exit 0, 46.479 seconds. No full build or accepted D3D test
  was rerun. Current primary artifact is 2,025,029 bytes, SHA-256
  `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.

## Commands and outcomes

Each command below had the exact prefix
`SWEEP_CAPTURE_PREFIX="$RUN/<test-stem>" timeout 120s node --require "$RUN/capture-module.cjs"`,
where `RUN=/home/user/wine-assembly/scratch/runs/20261101-gl-stack-command-crash-sweep`.
The scratch-only capture hook records original Wasm bytes before instantiation
and loaded CommonJS file hashes on exit. It does not replace the compiler,
assertions, fixture or production source. Full argument arrays, start times
and logs are in `outcomes.json` and the four `<test-stem>.log` files.

| Test argument, in execution order | Exit | Seconds | Coverage kind |
| --- | ---: | ---: | --- |
| `test/test-gl-matrix-stacks.js` | 0 | 8.446 | Compiled Wasm state exports versus JS matrix oracle and semantic checks |
| `test/test-gl-attrib-stack.js` | 0 | 5.505 | Compiled Wasm observer/state exports |
| `test/test-opengl-command-stream.js` | 0 | 0.123 | JS reference encoder, real JS replay/RPC plumbing, mocked endpoints |
| `test/test-opengl-display-lists.js` | 0 | 6.118 | Compiled Wasm lists/encoder/software raster, plus JS replay doubles |

No assertion, production, test, shared helper or compiler file was changed.
No test was skipped or retried.

## Meaningful invariants reached

**Matrix state:** all four stacks start one entry deep; the scripted matrix
operations preserve selected stack and depth and compare state after each
step. Shipping JS identity/multiply/frustum/ortho provide direct oracles;
translation/scale/rotation use transcribed references plus independent vector
checks. Non-axis rotation uses the fixture's documented tolerance. Projection
underflow keeps depth zero (one entry); 31 pushes fill 32 entries; the next
push reports `0x0503`, preserves depth and top. This boundary exercise is on
the projection stack, not an exhaustive overflow sweep of every stack.
Texture-unit matrices remain independent; invalid matrix mode leaves selection
unchanged. Lighting/material/fog defaults, clamps and selected light bounds
also pass, including modelview light-position transformation and matrix state
still working after lighting writes.

**Attribute state:** mutation between push/pop proves restoration of material,
shininess, ambient and active texture state; two distinct nested frames restore
in the correct order. Empty pop reports `0x0504`, changes neither state nor
depth, and leaves the mirror trusted. Sixteen pushes succeed; the seventeenth
reports `0x0503`, leaves depth 16, and latches the `glPushAttrib` untrusted
opcode. The fixture deliberately asserts the existing compatibility gap:
individual light parameters and fog are not restored. Passing is not proof of
complete OpenGL attribute-mask semantics or post-overflow recovery.

**Command stream:** scalar arguments and small pointed matrices survive caller
scratch reuse; opcode/argument widths, sparse-pointer vectors, immediate-mode
packing and context ownership pass. A 256-byte reference-encoder capacity
forces submission before overflow without presenting; only explicit present
publishes a frame. Texture upload borrows live guest bytes synchronously after
pending work. Query barriers submit before return. Main/worker RPC doubles
preserve order, result/output visibility and acknowledgement timing, with
optional supported/disabled/unsupported pool metadata. This test imports
`test/helpers/gl-reference-encoder.js`, not a compiled native producer. Its
`WebAssembly.Memory` objects are real shared memories, but no Wasm module is
compiled or instantiated: native encoder capacity, actual worker scheduling
and browser GPU consumption remain unvalidated by these checks.

**Display lists:** compiled Wasm distinguishes reserved from defined names;
reservations are contiguous/disjoint; scalar payloads survive stack reuse;
compile-only defers execution and compile-and-execute runs once immediately.
Nested playback resolves replacement definitions and ignores deleted names;
deleted names can be reserved again. Empty and maximum-GLuint names work,
self-recursion returns (source bounds it at 64), and contexts have independent
namespaces. Zero/negative/oversized reservations, invalid modes, nested
compilation and EndList during an open primitive produce their expected
errors. Reset removes both existing namespace and in-progress capture.
Unsupported pointer capture (`glLoadMatrixf`) deliberately traps before state
mutation; unrelated state change (`glBindTexture`) inside Begin/End also
deliberately traps. Both are caught by existing assertions, not new failures.

Material payload ownership, per-vertex emission and strip winding pass through
the real WAT encoder with captured host batches. Invalid material inputs do
not corrupt primitive/state; the injected test export verifies production
stdcall cleanup and guards the following stack word. The software rasterizer
actually draws a red point with the earlier material and produces no green
pixels from a later material change. JS doubles additionally verify scoped
lighting restoration after a draw exception. These are narrow lifetime/state
checks, not allocator leak measurement, context-destruction coverage or a game.

## Exact modules and reproduction evidence

The matrix and attribute runs independently instantiate identical 2,024,992-byte
modules, SHA-256
`ac9beb2ae3f746c621d0f258d4d3a2d1910207b0006e13ed96856bd0ac4975d9`.
All nine non-custom sections exactly match the primary artifact; the build
adds only its 37-byte encoded `wine-region-layout` custom section. Thus these
are actual compiled canonical-source Wasm runs, with the stamp distinction
recorded rather than claiming byte identity with the shipped artifact.

Display lists instantiate a 2,025,078-byte module, SHA-256
`344f3c8096ac13e4f7d85e9cf4f3b2d8531696b66dc6fc1a0dfe8a81d5ff0a1d`.
Its only fixture source addition is the original `material_api_test` export
appended to `13-exports.wat`; `GL_MATERIAL_MUTATION` and render-artifact override
environment variables were absent. The original extra WAT, full transformed
exports source, their hashes, and section comparison are retained in
`display-lists-extra.wat`, `display-lists-13-exports.wat` and
`module-identity.json`. Three exact original `.wasm` captures remain ignored;
the command-stream test produces none.

`baseline-inputs.json`, `inputs-before.json`, `inputs-after.json`,
`environment.json`, `loaded-verification.json`, `verification.json` and each
test's module/loaded-module records supply full source/module identities.
Reproduction uses the four unchanged entrypoints and the commands above on
matching input bytes. No crash reproduction was needed.

Remaining evidence gap is native producer overflow/order under actual consumer
load and real application gameplay; neither is inferred from this sweep.
REP/held tasks, Heroes II, browsers, benchmarks, downloads, access retries and
deployment were untouched. Free disk stayed above 2 GB (2,446,188,544 bytes at
post-test verification). Box ID/state/expiry and lifecycle: N/A; no box assigned
or accessed, ownership none. Next: coordinator reviews this single completion;
this worker stops without launching a successor.
