# GL 1.1 interleaved client arrays

`glInterleavedArrays` now resolves through the real WGL and `opengl32.dll`
procedure paths (API id 4314, GL opcode 177). Native client state implements all
14 GL 1.1 formats. Draws continue through the existing native encoder,
software rasterizer, shared render worker and WebGL consumers.

The layout and enable rules were checked against [GL 1.1 section 2.8,
table 2.5, printed pages 25–26](https://registry.khronos.org/OpenGL/specs/gl/glspec11.pdf).
The independent literal fixture is `test/helpers/gl-interleaved-layouts.json`;
production code contains its own format cases and does not read that fixture.

| Format | Packed stride (bytes) |
| --- | ---: |
| V2F | 8 |
| V3F | 12 |
| C4UB_V2F | 12 |
| C4UB_V3F | 16 |
| C3F_V3F | 24 |
| N3F_V3F | 24 |
| C4F_N3F_V3F | 40 |
| T2F_V3F | 20 |
| T4F_V4F | 32 |
| T2F_C4UB_V3F | 24 |
| T2F_C3F_V3F | 32 |
| T2F_N3F_V3F | 32 |
| T2F_C4F_N3F_V3F | 48 |
| T4F_C4F_N3F_V4F | 60 |

Zero stride selects the packed stride. Positive strides, including overlapping
records, are retained. Setup stores guest addresses without reading array
memory. Invalid formats and negative strides report `GL_INVALID_ENUM` and
`GL_INVALID_VALUE` before changing descriptors. Setup during an executing or
compiling Begin/End reports `GL_INVALID_OPERATION`. Vertex arrays are enabled;
index and edge arrays are disabled; optional arrays are enabled only when
present. Absent descriptors remain untouched. Only the client-active texture
array changes. Client stacks and context switching preserve this state; server
attribute stacks do not restore it. Client array enables have native boolean,
integer, float, double and `glIsEnabled` queries.

Array setup executes immediately in both display-list modes and is not list
content. Array draws and elements inside lists now capture owned scalar
attribute/position values. Replay uses the then-current transforms and disabled
current attributes, without reading freed/replaced array or index storage or
restoring client descriptors. Queued draws own their packed records before
source memory changes; deleting a context fences its pending draw.

The frame-state regression fixture previously tried to update an undefined
texture level. It now defines a genuine 16×16 level before the valid update and
separately checks undefined-level rejection. Production texture validation is
unchanged.

## Verification

Evidence: `scratch/runs/20261102-gl-interleaved-streamed-resume/` (ignored).
Ordered Oni96725 then Braveheart25443 terminal/result/final/exact release and
scoped helper absence were independently consumed before shared edits or boat
use. Their 50 and 272 final artifact hashes matched. Prior untested drafts were
reviewed; the old incomplete test assembler was repaired before installation.

The unchanged source was compiled and invoked through the real module lookup
and Win32 dispatcher. It exited 1 at `real export glInterleavedArrays` (null
lookup), with test module SHA-256
`bf6c35fdd9061fc73ce052bbc86139f0454204f5613083bf733a8c9b2ffb645b`.
This is an executed old failure, not an inferred export comparison.

Final direct and actual queued software runs each check 84 literal draws
(14 formats × packed/padded strides × DrawArrays/DrawElements/list), owned
19-float vertex payloads and inside/outside pixels. State checks cover both
client texture units, all enable transitions, preserved absent descriptors,
invalid setup, unmapped-pointer setup, overlapping strides, both list modes,
client/server stacks, context deletion/recreation and pending-queue fencing.
The queue requires positive queued-draw counts and zero fallbacks.

Both routes also feed their native-produced records through the production
browser decoder, bridge, frontend and shaders on actual WebGL 1 and 2. Each
route passes 504 color/normal-lighting/projective-texture pixel cases. Pixel
oracles include byte color normalization, literal lighting values 191/255,
and nearest-sampled texture colors selected by real projective q. Installed
Chrome uses ANGLE SwiftShader; this does not establish hardware-GPU coverage.

Repeatable commands:

```
node test/test-gl-interleaved.js
node test/test-gl-interleaved.js --worker
node test/test-gl-interleaved-web.js
node test/test-gl-interleaved-web.js --worker
node test/test-gl-interleaved.js --negative-controls
node test/test-gl-interleaved-web.js --negative-controls
flock /tmp/wine-build.lock bash tools/build.sh
```

The four semantic controls deliberately corrupt packed stride, owned list
color capture, shader normal consumption and projective q. Each exits 1 at its
specified descriptor/value/pixel assertion. The positive tests retain real
behavior checks; lookup success alone cannot pass. The availability regression
was changed only after direct/queued/WebGL coverage passed: 56 observed names
remain rejected. No original MDK2 or held game retry was performed.

Twelve focused regressions passed: frame state, command stream, texcoord4,
server attributes, display lists, stipple, procedure availability (including
its three broken-lookup controls), client arrays, client attributes, sparse
pages, boolean/pointer queries and shared render-worker protocol. Queued stipple
is checked separately. The first focused attempt stopped on missing bundled
fonts; required existing font bytes were subsequently streamed and SHA-verified,
then the suite passed. No fonts or browsers were downloaded.

The locked full build passed on the finite-TTL boat. Because that streamed tree
has no Git metadata, its API-table gate could only do the index check; the real
shared checkout's `node tools/check-api-table.js` also passed append-only versus
HEAD. Exact final source/compiler/test/font verification matched all 3,995
pinned inputs, with no mismatches. The source context is main
`fd69d481859504a3ea234557b08f70171ad09fff` plus this change; its underlying
DirectDraw repair is `ab3596819df988f9eea258604f66a0104eea7d36`.

| Executed/built artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Instrumented native test module | 2073436 | `aba030f7c3ca2ee583a0f6e03dfce55d8b33f69d319c224dc6a6a4e6fe57490e` |
| Production full-build module | 2073181 | `46c90ae60c2d47d0451e5b972c88ce8d0444500e7e734fd0683ca3ca18a7667a` |
| Compatibility full-build module | 2075754 | `f1e1c74334fb3dc439e89fa62fa2740b0b2776fff0ac50eff1acf0139d5eada9` |

Test-only accessors invoke the actual lookup, dispatcher and production GL
functions; no implementation is replaced. The instrumented module adds those
accessors to the same full source closure. Compressed identities pin every
compiler member and `src/api_table.json`. The shared local build remains the
older `307168f9e0475fd3c10f87cbc5d98f05006c6d4494d2f564381a9a0ebe289fe6`
module; it was not substituted for the actual tested module. Recovery recipes
and verified built artifacts are retained in the run.

## Transport and limits

Fresh own boat `bx_pefugusd` had original expiry
`2026-11-02T21:19:20.407Z`, recorded before use. Source was streamed directly
without a local source archive or checkout copy. The first owned stream was
aborted and its process group removed when headroom fell below the 2,000,000,000
byte floor. Its supervisor minimum was 1,974,009,856 bytes; the continuous observer
recorded 1,969,983,488. Thus this run cannot claim whole-task floor compliance.
No source extraction or tests ran from that partial transfer. Its size/SHA and
cleanup evidence were retrieved and verified before its owned remote partial
was removed. No foreign artifact was removed by this worker.

After the coordinator independently verified and retired its released redundant
transport caches, the retry used a 64 MiB reserve and passed at minimum
2,087,272,448 bytes free. The 81,509,424-byte compressed stream SHA was
`060bb886d5d013761f18564961352babd6fe9bfa7292805fae7144be2d72559f`;
all 8,841 exact members were size/SHA-verified after extraction. Later transfers,
retrievals and extraction retain the floor guard and their own recorded minima.

All 66 remote evidence snapshot members were retrieved and SHA-verified,
including both production modules, the instrumented module, actual test logs,
final source identity, and cleanup metadata. The modules were also checked
against their separately recorded build identities. Remote test/browser helpers
and temporary browser profiles were absent before shutdown. Only then was the
explicitly delegated stop requested for `bx_pefugusd`; it reached STOPPED at
`2026-11-02T19:43:13.659Z`. No old or foreign boat was resumed or stopped.
`final-retrieval-verification.json`, `stop-request.json`, `box-stopped.json` and
the final local helper audit preserve that ordering. The original expiry above
is retained independently of the stopped boat's changed TTL metadata.

The main commit/pull/push result is preserved in `publication.json`; its explicit
file list excludes foreign/laptop/HeroesII work. This is GL conformance coverage,
not MDK2 gameplay acceptance or a public deployment. Remaining unsupported
families still gate any original MDK2 retry.
