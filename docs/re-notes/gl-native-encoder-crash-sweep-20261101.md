# Compiled-Wasm OpenGL encoder crash sweep — 2026-11-01

Run `20261101-gl-native-encoder-crash-sweep`: all three requested fixtures
passed sequentially with their original assertions. The first ran every
section, without a `--section` filter. No unexpected native crash, unhandled
Wasm trap, signal, assertion failure or timeout occurred. Six intentional
native trap assertions passed; they are rejection coverage, not crashes.
Evidence remains ignored in `scratch/runs/20261101-gl-native-encoder-crash-sweep/`.

## Revision and build identity

Requested baseline is `c4472ee3bda7dc4b87549c4f594662206a7e15d7` on shared
`main`. Actual HEAD for all three commands was
`62211324e4fa6e0465199513dec92abb6f3cf61b`; the intervening change touches
only `TODOS.md` and `ops/STATUS.md`, within the permitted documentation-only
advance. All 4,462 inventoried inputs match baseline tracked bytes, match
the accepted build run's `inputs-after.json`, and are unchanged before/after
this sweep. All 67 distinct loaded CommonJS files were hashed at exit and
checked afterwards; 45 tracked loaded files match baseline. The remaining
22 installed dependencies have recorded byte identities, not Git provenance.
The inventory includes the sealed compiler graph used by `render-artifact`.

Reused accepted build evidence from
`20261101-d3d-typed-stateblock-injection/build.log` and `outcomes.json`:
`timeout 120s flock /tmp/wine-build.lock bash tools/build.sh`, exit 0 in
46.479 seconds. No build or accepted test was rerun. The current primary
artifact remains 2,025,029 bytes, SHA-256
`2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf`.
Environment: local Linux x86-64, Node 24.18.1, V8 13.6.233.17-node.50;
no WINE/GL/NODE_OPTIONS override was set. Memories are real fixed 512 MiB
shared Wasm memories. No browser or GPU driver was exercised.

## Commands and outcomes

Each test argument below followed the exact prefix
`SWEEP_CAPTURE_PREFIX="$RUN/<test-stem>" timeout 120s node --require "$RUN/capture-module.cjs"`,
with `RUN=/home/user/wine-assembly/scratch/runs/20261101-gl-native-encoder-crash-sweep`.
The scratch-only hook captures original module bytes before instantiation
and loaded CommonJS hashes on exit; it changes no compiler, source, assertion
or fixture. Full argument arrays, timing records and logs are retained in
`outcomes.json` and `<test-stem>.log`. The encoder timing record labels its
post-command timestamp `completedUTC`; the other two record `startUTC`.

| Test argument, in execution order | Exit | Seconds | Native coverage |
| --- | ---: | ---: | --- |
| `test/test-opengl-wat-encoder.js` | 0 | 3.245 | All encoder parity, pressure, boundary, error, isolation and pool sections |
| `test/test-opengl-sparse-page-arrays.js` | 0 | 3.091 | Sparse index/vertex reads, upload snapshots and software texture state |
| `test/test-opengl-client-attrib.js` | 0 | 3.729 | Client stack state, packed draws, context/list behavior and host replay |

No retries, source repairs, assertion changes or skipped sections were needed.

## Meaningful coverage and its limits

**Native producer and independent oracle.** The first fixture calls
`gl_wat_encoder_call` and `gl_wat_stream_flush` on actual compiled Wasm.
Its separate JS reference encoder provides expected bytes. Non-pressure
comparisons require identical submissions and bytes; pressure comparisons
normalize only packet-relative payload offsets and require every complete
record in order. The mocked `gpu_gl_call` captures bounded native batches,
checks record walks, and supplies deterministic context/query results and
output writes. The initial shared-offset range/alignment/malformed-record
checks exercise JS replay, not a native trap or actual worker scheduler.

All ten primitive modes run smooth and flat, including incomplete counts
0–5. State checks cover current attributes, vector inputs, server attribute
push/pop, both texture units and projective r/q. Strided client arrays cover
eight scalar types, indexed draws and offset/empty DrawArrays. Snapshot and
barrier checks include copied matrices/vectors, borrowed uploads, query output
visibility, 22 queued small texture uploads submitted together at finish,
mutation after capture, the 65,536-byte copy threshold, and synchronous
large/padded/unsupported upload cases.

**Capacity and pressure.** The unchanged production capacity is 2 MiB. Three
cases exceed it over the call sequence: generic records, packed triangle
records, and a large packed primitive following an occupied stream tail.
The first two explicitly require native submissions to outnumber the 2 MiB
oracle's submissions and the first batch to be within 300 bytes of the
512 KiB production watermark. All three require complete ordered-record
parity across batch boundaries. This proves native producer flushing in the
fixture; it does not measure real GPU/worker consumer backpressure, scheduling
or throughput, nor exhaustively reject every possible oversized record.

**Hardening and memory boundaries.** Context transitions include failed
make-current and failed deletion, 24 context keys including zero, reverse
revisits and deletion. Twenty-four nested server attribute frames, typed
integer extrema, NaN, negative zero, tiny doubles, unknown vertex types,
disabled pointers and configured pointer zero pass parity. Vector inputs at
the actual memory end exercise exactly three color floats and two vertex
floats; a direct frame containing return address plus exactly two arguments
ends at memory end. The fixture's original translator sentinels place these
vectors there; this is a targeted overread check, not general pointer safety.

Six invalid inputs deliberately require a JS RangeError and a caught native
`WebAssembly.RuntimeError`: nested Begin, generic command within Begin,
ShadeModel within Begin, unknown opcode, 64-bit texture-byte overflow and
DeleteTextures count-shift overflow. Reset separates these cases. Reset/default
state and two Wasm instances interleaved over one shared memory also pass;
the instances run sequentially, not on concurrently scheduled worker threads.

**Stream pool.** Original allocation hooks exercise successful triple-buffer
allocation, failure of either extra buffer, and default non-pooled behavior.
Assertions cover disjoint buffers, two published buffers retaining bytes while
the third is written, rotation/host return values, empty flush, invalid and
late configuration, partial-allocation rollback, and no allocation retries.
Reset preserves the current buffer. A deliberately thrown JS host-publication
error is caught; pending bytes and buffer selection survive, and retry succeeds.
That host exception is neither a Wasm trap nor a native crash. Retained buffers
are checked with a mocked consumer; real lease acknowledgements are absent.

**Sparse client inputs.** The second fixture maps five sparse pages in an
interleaved order and asserts backing pages are nonadjacent; unrelated backing
contains `0xEE`. Nine uint16 indices and four float vertices yield the same
expected packed positions inside a page and across two guest-page boundaries,
including a vertex whose components span pages. A 1,024-byte queued texture
snapshot crosses nonadjacent backing pages and survives guest mutation.
A four-float border color spanning a page boundary reaches actual native
software texture state and copied replay payload, also surviving mutation.
These are selected mapped-page crossings, not unmapped-page fault coverage,
all scalar widths or arbitrary byte-unaligned scalar straddles.

**Client attributes.** The third fixture's real native encoder restores all
supported vertex/normal/color and two-unit texture descriptors, strides,
enables and pointer validity, producing an identical 3×19-float packed draw.
Selective masks distinguish vertex state, client unpack modes and server
current color. Restored unpack alignment reaches the host frontend and the
14-byte RGB upload. Zero/unsupported masks, all bits, depth query, 16-frame
limit, overflow/underflow GL errors, Begin/End misuse, context isolation,
deletion cleanup and immediate client operations within compiled lists pass.
These GL error values are asserted returns, not native traps. Actual JS
`OpenGLHostBridge`/`FixedFunctionGL` replay is used with mocked backend creation
and upload capture; no real GPU draw or application gameplay occurs.

## Exact compiled modules and reproduction

Original captured module identities:

| Fixture | Bytes | SHA-256 |
| --- | ---: | --- |
| WAT encoder | 2,025,196 | `83b7954c2e55f32c8d716f478e294232db033b42c64ca015e0b6e941aa41afde` |
| Sparse page arrays | 2,025,050 | `c1f9f9c16d8ccac95f598f3936c45471767b1fc5450bf2acab92701cc7ec99e1` |
| Client attributes | 2,024,992 | `ac9beb2ae3f746c621d0f258d4d3a2d1910207b0006e13ed96856bd0ac4975d9` |

Client attributes has all nine non-custom sections identical to the primary
artifact; only the build's 37-byte encoded `wine-region-layout` custom section
is absent. The other modules intentionally differ through the unchanged
fixtures' original `compileSrcWasm` transforms. Encoder replaces affine
allocation/free call sites in `09a8c-gl-encoder.wat` with counting/fault hooks
and redirects `09a8e-gl-state.wat` translation through the two memory-end
sentinels (ordinary addresses still use production g2w). Sparse arrays appends
only `test_sp_map` and `test_border_ptr` exports to the state fragment. These
are compiled native producer tests with explicit instrumentation, not
byte-identical shipping-module tests.

`module-identity.json` contains section hashes and full module identities;
three exact original `.wasm` captures are retained. `verification.json`
records full fixture source hashes; `<test-stem>.original-source.txt`
preserves their exact code, including transforms. `inputs-before.json`,
`inputs-after.json`, `loaded-verification.json` and `environment.json`
record source/dependency identity. Reproduction uses these same unchanged
entrypoints and command arguments on matching source bytes. No unexpected
crash reproduction was needed.

Remaining gaps are actual consumer-load/concurrency behavior, browser GPU
execution, arbitrary invalid memory inputs and application gameplay. This
sweep establishes no full-27 result or general crash-free claim. REP tests,
diagnostics, automated-review held work and Heroes II were untouched; no
browser, heavy benchmark, box, download, access retry, worker or successor was
used. Post-test free disk was 2,434,781,184 bytes, above 2 GB. Box ID/state/expiry
and lifecycle are N/A; no box ownership to hand back. Next: coordinator reviews
this single completion; this worker stops.
