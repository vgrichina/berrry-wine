# Jedi native CLI staging preflight

**Ready for coordinator review: the host staging blocker is reproduced and the
complete source-derived no-build CLI closure passes a no-guest preflight.**
This does not prove gameplay or authorize a campaign. No game, guest, browser,
boat, build, movie or Play action ran in this task. No production code changed.

Input is committed main `16948c36fb0e13240a90998b2ec6b5fc4380b89a`.
Executable staging/preflight helpers, tests, exact Git blob/SHA256 manifests,
logs and recovery instructions are retained in gitignored
`scratch/runs/20261103-jedi-cli-staging-preflight/`.
The previous [attempt](jedi-observed-encounter-20261103.md) remains a host
startup failure, with no gameplay observation.

## Cause reproduced

All **56** predecessor payloads were reverified against their stored and
original fullSHA/lengths, plus the 2249380-byte archive SHA256
`4d6e431f9f40bba3dc56c4e4212e0536da1c3344092882b964965419edcfa331`.
The recovered `stage-runtime-native.py` selected names from an older donor
manifest. Its 216-name selection omitted both `lib/process-desktop.js` and
`tools/disasm.js`. `complete-runtime.py` added sealed libraries, producing
217 final members and repairing only the first omission.

Executing the exact predecessor observer code again reproduces the gap:
removing process-desktop yields `authorityReady:false/MODULE_NOT_FOUND`;
removing disasm still yields `authorityReady:true`. That observer exercises
named-event/desktop authorities and fork arguments, not `test/run.js` startup.
The earlier actual CLI reached the unconditional, function-scoped disasm import
at line6500 after PE loading. Focused observer passes never covered that import.

## Recipe and verification

`stage.py REPO COMMIT NEW_RUNTIME_DIR` invokes `analyze.cjs` using Node24's
bundled Acorn8.16.0 and reads committed Git blobs only. It stages a runtime
subset, without checkout, clone, worktree or repository copy. Selection starts
at fresh committed `test/run.js`, recursively follows literal/computed constant
requires, and resolves the actual media-loader calls and render-adapter table.
It inventories all three remaining dynamic require sites and rejects an unknown
site. A region-map override is outside this qualified profile.

The resulting manifest contains **178 files /10172374 bytes**: 119 reachable
code/JSON modules, constant data paths, four VM-loaded compiler stage scripts,
34 unconditional system/font mounts derived from the committed shared policies,
27 verified pngjs7.0.0 files, and the pinned Wasm. Categories overlap. Import
execution initially exposed the compiler's data-loaded stages; deriving its
committed `FILES` array fixed that omission without weakening checks.
Historical manifests supply provenance checks for pngjs, never runtime selection.

Reused module:2088037 bytes, SHA256
`1f39572325be5251c4b9a923e83d4ea9ff33962d4d3e7911a4835df20cf0ae7e`.
The helper requires exact bytes and verifies that the accepted locked-build
revision `0d1d8e71d41172bc0f7ed7b56a3d521deabaf294` differs from the input only
in two documentation files; its entire source tree is identical. No compile,
module instantiation or Wasm execution is claimed here. Changed non-documentation
inputs require a newly qualified module rather than silent reuse.

`preflight.py RUNTIME_DIR` verifies exact membership, every byte count/fullSHA,
and absence of symlinks. It then executes real module initialization, host
imports/system-data mounting, font reads, PNG encode/decode, and genuine guest-
and render-Worker **bootstrap only**, with no initialization/slice messages.
All115 reachable JS modules are covered by imports or their actual entrypoint/
Worker bootstrap. The unchanged CLI runs with `--no-build`, explicit pinned
Wasm and an intentionally absent EXE: it reaches `main()`/`readAssetBytes` at
line1776 and returns the expected ENOENT before PE loading. This is an expected
boundary result, not a successful game launch.

Import auditing rejects resolution outside the staged tree, records caught
missing-module attempts as failures, and forbids WebAssembly compilation,
instantiation and memory creation. Complete closure passes with245 import
resolutions and113 actual CLI initialization resolutions. Separate Worker ready
receipts contain no import failures. No fake modules or missing-module
suppression were added.

`test-preflight.py` proves both manifest rejection and actual import/data
rejection for seven omissions: disasm, simd-ops, process-desktop, pngjs's entry,
System.fon, stdole2.tlb and compiler-parser.js. Restoring the exact bytes passes
the same helper. Five unmodified committed tests pass: guest-clock source,
startup clock, batch clock, input-consumption clock domain and keyboard message
lParam. All original clock/input assertions and five clock mutation rejections
remain intact. No unrelated fixtures were changed or counted as repaired.

## Limits and next dispatch

Qualified profile: native CLI, prebuilt pinned module, pure-JS raster/PNG,
no region override. Optional native GPU packages (`@node-3d/glfw`,
`@node-3d/webgl`) and decodeImage's `skia-canvas` are explicitly unqualified.
Compiler modules initialize, but auto-build/source compilation is untested;
use the explicit no-build pin. Recording/ffmpeg, browser imports, GPU context
creation and Worker protocol execution remain untested.

The no-guest boundary deliberately precedes PE loading. Guest imports, actual
Wasm/layout acceptance, dynamic DLL discovery/LoadLibrary, child execution,
asset mounting/lazy reads, registry mutation, control-server readiness, input
delivery and gameplay remain untested. The predecessor log's absent real
shell32/comctl32 warnings remain unresolved guest-path evidence; preflight does
not dismiss them. The original28-file and76-entry registry inputs were not
modified; their recovered pin/integrity payloads still verify. They are separate
campaign inputs, not substitutes for this runtime manifest.

The coordinator must review this preflight and dispatch any next campaign.
That dispatch must combine the regenerated exact-source runtime with verified
original game/registry/DLL inputs and separately staged controller helpers,
preserve original input/clock assertions, and retain the first-blocker stop.
No boat was allocated or operated; there is no running box or shutdown handoff.
Home free space remained above7GB. Only this worker's ignored staging copies
were cleaned; foreign WIP and predecessor evidence were untouched.
