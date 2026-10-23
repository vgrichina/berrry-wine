# POSITIONT COM fixture independent acceptance, 2026-10-23

**ACCEPT fixture source/offline only**, exact commit
`7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6`. Ready for its separately admitted
full-module diagnostic build and qualification. No fixture defect requiring a
change was found. No production changes were made. Acceptance of production
numerical policy remains the existing scoped source/software decision for
`5427a9e2e7d20984249cadcf67f1cb33cc9d85c0`, reviewed in
`6ac29d0c4bd8def2f5cf06d4cac1795a08f1e754`; this review does not reopen it.

Full COM, production heap failure/reuse/free, native raster execution and the
512 MiB arena are **NOT EXECUTED here**. No native fragment was compiled. No
browser/GPU/guest/Boat/recovery/media operations occurred. The existing 26 seals
and strict remote receipt were coordinator-verified inputs, reused without a
second packaging inventory. A fresh strict read-only remote query independently
matched fixture `7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6` and main
`bb9c496ed13095cc832fdf607f0937fb9c14b7de` before review.

## Correctness trace

The fixture is a handler-level integration test. Its wrappers do not execute
an x86 CALL/RET or canonical thunk lookup, which the implementation report
explicitly excludes. Each of 25 production handler targets has exactly the five
argument parameters plus name pointer that its wrapper calls. The nine diagnostic
arguments are also written at guest ESP+4 through ESP+36, with ESP reset for each
call. CreateDevice reads presentation parameters/out at +24/+28; texture creation
reads format/pool/out at +24/+28/+32; buffers read out/shared at +24/+28;
DrawIndexedPrimitive reads start/count at +24/+28; Clear reads depth/stencil at
+24/+28. These agree with the actual handlers, including signed BaseVertex.
No fixture dispatch target or allocator replaces production behavior.

| Important assertion / input ID | Production path and review conclusion |
| --- | --- |
| `DP-start2-offset16-stride48`, three `DIP-*` cases | `09ad-handlers-d3d9.wat` DrawPrimitive/DrawIndexedPrimitive enter `09ae-d3d9-resources.wat:$d3d9_draw_buffer`; `lib/d3d9-host.js` validates/copies packed range, handles INDEX16 normalization or INDEX32 gathering, then publishes DRAW. Prefix/suffix poison, exact 144-byte equality against DP, normalized [0,1,2] and independent red pixels prevent a shared black result from passing. Base +1/-1, nonzero min/start, offset16 and differing source record origins are represented. |
| `DP-multistream2and5-start2-distinct-strides` | Real declaration creation/binding and stream sources feed the same buffer draw path. No stream0, position stream2 stride24/offset4, color+UV stream5 stride32/offset4 and20. Packed stride56 and offsets4/28/44 plus red pixels expose wrong stream, stride or declaration offset. |
| `DPUP-copied-POSITIONT` | Production DrawPrimitiveUP descriptor -> Bridge snapshot -> native POSITIONT selection. User-pointer records are independently allocated through guest_alloc and copied by the host. |
| Admitted native selection / finite RHW fallback | `lib/d3d9-host.js` calls `ShaderIR.fixedPositionT` before `_issue`; `lib/d3d-shader-ir.js` owns descriptor creation, native compilation, IR copying and finally frees. Fixture observes the real export invocation, checks packet profile and IR origin4, traps fallback count changes on the first admitted draw. Unsafe RHW control requires absent shared IR, unchanged shared compile count and one actual backend fallback. |
| Complete frame/depth | `lib/d3d9-software-backend.js:prepare` programs shared vertex/pixel IR; the native software path receives actual depth attachments/state. Analytic 8x8 BGRA oracle requires exactly ten red pixels (x+y<4), black elsewhere, alpha255 throughout. Depth .5 against clear .4 must be black, clear1 must draw red, later green .75 must preserve red. This independently checks rejection, acceptance and depth writes/order. It is not merely equality of two renderer outputs. |
| `real-allocator-failure-recovery` | Only a 288-byte descriptor request is redirected to `e.guest_alloc(0xfffffff1)`. `13-exports.wat:guest_alloc` directly calls `$heap_alloc`; `10-helpers.wat:$heap_alloc` rejects sizes above unsigned0x7ffffff0 before header arithmetic, with reason5. No fabricated zero or OOM stub. Failure must precede shared compilation/publication, preserve cleared black pixels and report descriptor allocation failure; ordinary allocation is restored and red recovery required. This tests oversized-request propagation, **not exhaustion**, and not every native allocation failure site. |
| Six original-address observations and poison | `d3d_fixed_free` in `09aj-d3d-fixed.wat` frees four referenced IR/VM allocations and the bundle. The wrapper records each actual payload extent before delegating; `$w2g` converts native pointers and `$heap_payload_size_unchecked` masks the header then subtracts4. Extents must be positive and <=128KiB. Descriptor is separately recorded. Reuse only counts addresses returned by production guest_alloc; every target must be observed within64 attempts/target and1MiB total requests. Poison writes precisely the size requested from the returned allocation, including when a differently sized target is observed incidentally. No direct write through a freed address occurs. It can fail if allocator coalescing/liveness prevents original-address reuse; that is an intentional hard qualification stop, not a source-level proof that native reuse will succeed. |
| Deferred queue copy | The exact fixture block uses a real second CommandQueue behind an incomplete FENCE, then normal defensive `submit` copies an authentic captured COM packet. Caller vertex/vertex-IR bytes are overwritten before the gate resolves; the backend executes the copied DRAW. The saved producer IR must separately survive real heap poison. This does not test async Bridge worker transport or guest continuation parking, as explicitly documented. |
| Invalid ranges | Out-of-range StartVertex and index3+ outside declared min0/num3 require nonzero HRESULT, no new draw packet and black framebuffer. The latter also requires the specific declared-index-range error. |
| Disposal | Stream/index/texture/declaration bindings are cleared; shared Shader9 Release is the canonical buffer/declaration Release handler, not a test alias with new semantics. Resource releases and final Device9 Release reach Bridge RESOURCE_RELEASE and software `destroy`; fixture requires destroyed=true, bytes=0, advancing real heap frees and removal from Bridge.devices before close. Raw caller allocations are freed separately. This does not assert a global heap-allocation/free equality. |

`test/render-helper.js` changes only the optional prebuilt branch and lazy source
compiler require. Ordinary byte compilation still passes the same transform and
tail-call option, caches by both, and receives the `{module, instance}` instantiate
result. The prebuilt branch receives an Instance directly and returns the exact
supplied Module. `extraWat` with a prebuilt Module rejects. The new integration
test is explicitly e2e; offline guards remain unit. No default compile is added
to the qualification CLI or loader.

## Provenance and build contract

`loadPrebuilt` reads the actual named module, compares actual length/SHA256 to
the required provenance, constructs that exact Module, validates all named
function exports and host.memory import, verifies pinned local blobs, and returns
that Module directly to bootRenderHarness. There is no separate caller-supplied
Module that can diverge from the bytes checked. Changed actual module bytes,
changed candidate blobs and a single missing required export were independently
rejected through this path. The source pins match the exact candidate under test.
This is an integrity/build receipt, not a cryptographic attestation of a build:
the operator must retain the actual build log and actual diagnostic SHA. A forged
receipt plus an arbitrary export shell is intentionally not treated here as a
secure compiler attestation.

The builder's call signature matches authentic `compileSrcWasm(transform,
{tailCalls:true})`. The adapter applies the appended export WAT to all three VFS
aliases for13-exports.wat, leaves other source unchanged, and calls canonical
`compileClosure`. That closure calls `compile(source,vfs,options)` with production,
standardWat=true, runtimeBuiltins=false, strictDeclarations=true, tailCalls=true,
and no regionShake/nameSection unless explicitly supplied. The fixture does not
supply those overrides. Required native exports all exist in pinned production
source; the q_* exports are the appended diagnostic functions. Included source
files are locally present. These are source/contract checks, **not a compile**.

The appended WAT hash remains
`4bd65ac87452abb4ec5f728f88b399439c9fa4fec91a53b3e6cb96468f58d068`;
source/compiler pin-map hash remains
`f108ba0cae9dccea9d1628a7581e032e4743cfa54b2da4a21420857e7b7e3cfc`.
No diagnostic full-module SHA exists from this review.

## Executed independent controls

Reproducible review code:
`docs/re-notes/render-positiont-com-fixture-independent-review-20261023/controls.cjs`.
Evidence: `scratch/runs/20261023-render-positiont-com-fixture-independent-review`.
`checks.json` records exact argv/cwd/exits,40-second subprocess bounds and logs.
The final driver runs with REVIEW_TMP and TMPDIR inside that task evidence area.

Final checks, all exit0:

```sh
node --check docs/re-notes/render-positiont-com-fixture-independent-review-20261023/controls.cjs
REVIEW_TMP="$PWD/scratch/runs/20261023-render-positiont-com-fixture-independent-review/tmp" TMPDIR="$PWD/scratch/runs/20261023-render-positiont-com-fixture-independent-review/tmp" node docs/re-notes/render-positiont-com-fixture-independent-review-20261023/controls.cjs
node test/test-d3d9-positiont-com-qualification-guard.js
```

The independent driver adds the following controls beyond unchanged guards:

- Loader positive control uses a real **uninstantiated**1625-byte Wasm export
  shell SHA256`9ce01225a62e81b0d66c97f0a242e82acc226f0bfe6d54c359bcefdf25728eea`.
  A valid added custom section with the old receipt rejects at actual moduleSHA;
  omitting only q_Declaration_Release rejects at that named export; interception
  of actual lib/d3d-shader-ir.js bytes rejects at candidate source mismatch.
- Builder/adapter/closure execute their real JS option/transform contracts with
  a compiler stand-in. No source compiler is invoked. Output is explicitly named
  CONTRACT-SHELL, never a qualification artifact.
- Ordinary helper compatibility uses a real8-byte empty module,64KiB shared
  memory, compiler/canvas/host stand-ins, and verifies extraWat transformation,
  tailCalls=false, cache reuse and returned instance/module shape.
- Exact extracted fixture reuse code runs against a host allocator model in a
  2MiB ArrayBuffer. All six original addresses are mandatory; a non-reusing model
  fails precisely at the address assertion after64 calls. Poison writes preserve
  canaries immediately before/after each returned allocation. This checks the JS
  observation contract, not production allocator success.
- Exact extracted fixture deferred-queue code executes the actual CommandQueue
  with a host pixel executor. Baseline executes once after the gate and passes;
  alias and corrupt-IR controls also execute once, print their armed markers,
  and fail specifically at the complete framebuffer oracle. The driver requires
  those exact rejections; setup/guard failures do not satisfy it. These are host
  byte/pixel stand-ins, **not native software raster execution**.
- Focused source checks confirm the required native exports,25 handler signatures,
  all nine diagnostic stack slots, canonical include availability, actual huge
  request guard and test tier classifications. No broad test suite was executed.

Unchanged guard's11 groups also pass, including default/incomplete CLI rejection
before compiler/host imports,13 provenance fields, changed module bytes, missing
exports/source, analytic all-black/one-pixel/depth mismatches, native route refusal
and actual queue byte copying. Its helper check uses an empty8-byte module
SHA256`93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476`
and64KiB shared memory with host stand-ins. Its29-form parse and prior syntax/tier
checks were reused from the exact input evidence where unchanged.

Two initial independent-test construction errors are retained in check-01 and
check-03: the review stub initially inspected compile's second rather than third
argument, then the review VM passed foreign-realm plain objects to CommandQueue,
which correctly rejects host objects. The test adapter and queue evaluation realm
were corrected; fixture/production code was untouched. check-04 passes before the
final source-contract addition; final checks cover the completed review code.

## Next separately admitted qualification

Use a complete exact-candidate checkout plus fixture/support changes, installed
dependencies (including pngjs), Node with SIMD/tail-call support, a fresh empty
output directory, and separately admitted build/output/512MiB execution resources.
Known cheap prerequisites: pinned blobs verify, every main.watx include exists,
the existing ordinary helper dependencies resolve, and the diagnostic appended
exports remain unchanged. Keep normal canonical build/prerequisite gates; the
direct diagnostic recipe does not itself establish every repository build gate.

After admission, the existing actionable recipe is:

```sh
timeout --signal=TERM 900s node test/support/positiont-com-module.js --build-diagnostic /ABS/OUT/positiont-com-diagnostic.wasm /ABS/OUT/positiont-com-diagnostic.json
timeout --signal=TERM 120s node test/test-d3d9-positiont-com-qualification.js --qualify --module=/ABS/OUT/positiont-com-diagnostic.wasm --provenance=/ABS/OUT/positiont-com-diagnostic.json --allow-512m
```

Require build0 then baseline0. In fresh processes repeat that qualification
command with each of `--negative-control=disable-shared-route`,
`--negative-control=alias-queued-bytes`, and
`--negative-control=corrupt-queued-ir`. Each must exit1 after its ARMED marker at
the actual native-selection oracle or queued native-byte/pixel failure. An early
HRESULT/setup/provenance failure, an unarmed exit, or timeout is not negative
control success. Stop on the first unexpected failure or resource/reuse bound;
retain module/provenance/logs and return to coordinator. These full-module
positive/negative runs remain unexecuted. GPU/WebGL1/2 driver pixels, games and
general fixed compiler paths remain outside even that future COM qualification.

## Isolation and resources

Dedicated branch `task/render-positiont-com-fixture-independent-review-oct23` in
`/home/user/wine-assembly-render-positiont-com-fixture-independent-review-oct23`.
The exact donor was read-only; its files and small independent Git database were
copied after measured admission, with no shared index or donor metadata writes.
`admission.json` records the pre-checkout file manifest and installed tool
identities/SHA256/standing footprints. Measured material37308831B +8MiB growth
+8MiB reserve =54086047B <67108864B. Host free6473924608B before checkout minus
material and growth remains above2982150144B. Installed tools execute in place;
there are no installed executable copies/installs, links, archives or fetches. Final resource and
publication receipts record actual totals, inherited-tree preservation, remote
SHA verification and evidence seals. All tracked changes are this review's report,
control code and durable evidence copies, not production or fixture repairs.

No box was assigned or contacted. bx_fn7pn7yg is coordinator-reported snapshot
STOPPED, historical expiry03:46:00.580Z, state unprobed here. Coordinator retains
lifecycle ownership. ShadowMan/RichEdit, Claude B&W2 live renderer investigation
and laptop HeroesII/Warcraft ownership are preserved. No workers, merge, deploy,
force-push, replacement task, new game or queue refill. Stop after publication.
