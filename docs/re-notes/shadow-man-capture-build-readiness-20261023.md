# Shadow Man diagnostic build readiness — 2026-10-23

**BLOCKED at pre-checkout disk admission. No canonical cheap gate ran.**

Exact accepted candidate `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`,
independent acceptance `4dab22cfefb7b7048fbb6189b81cdccdd4ab8753`.
Strict actual remote refs reconciled read-only with main
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`. The coordinator's 104 candidate
and 95 review seals and prior accepted selector/Module-binding/OFF/quota/WAT/
discovery evidence are reused, not replayed.

## First prerequisite dependency

The measured materialized staging design does not fit the assigned 67,108,864
bytes. A complete scanner view alone needs these exact pinned input bytes:

| Input | Bytes |
| --- | ---: |
| src WAT/WATX, including compiler/manifest source inventory | 20,702,100 |
| lib JavaScript | 5,112,063 |
| tools JavaScript | 8,731,659 |
| test JavaScript | 18,678,546 |
| root JavaScript | 377,155 |
| **3,104 scanner-view files** | **53,601,523** |
| Measured donor Git copy for isolated branch | 7,011,075 |
| Required reserve | 8,388,608 |
| **Subtotal before other metadata, outputs or evidence** | **69,001,206** |

Subtotal exceeds cap by **1,892,342 bytes**. This is the lower bound for the
measured Git-copy/materialized-view design, **not an impossibility theorem for
a different Git or phased staging design**. No scanner file may be omitted to
make a false passing view. `region-census.js` recursively reads all `.js` under
lib/tools/test (excluding hidden paths/node_modules), plus host.js; its WAT
and allocator inputs are also needed. Other gates need root JS and WATX input.

The initial broader single-stage measured plan (3,225 files, 57,040,243 source
bytes) projected 112,614,078 bytes: source + 7,011,075 Git + 15,218,105 new loose
object upper bound + 20,761,743 combined-output allowance + 4,194,304 growth +
8,388,608 reserve. It was denied **before source checkout/materialization**.
The focused scanner subset independently establishes why that design is not
admissible; the broad total is not claimed to be an irreducible minimum.

Resume dependency belongs to the coordinator: a new, concretely measured
staging design that retains every applicable gate's exact input view, Git,
outputs, capture/evidence, temporary bytes and reserve within 64 MiB, or an
explicitly changed allocation. No production source repair is indicated by
this result. There was no unchanged staging retry or attempt to bypass
admission. Host free floor passed; disk cap, not host free space, stopped work.

## Executable verdict and controls

From the isolated review repository:

```sh
GIT_NO_LAZY_FETCH=1 python3 docs/re-notes/shadow-man-capture-build-readiness-20261023/readiness.py
```

Actual exit **2**, retained `readiness.log`. It verifies candidate/review HEAD,
3,225 exact candidate-tree blob/SHA256 input identities against available
read-only objects or hash-checked standing files, pinned authoritative build
script and its exact precompile prefix, then emits the admission denial. It
does not claim complete dynamic dependencies, build success or READY.
Missing-input control masks `src/main.watx` across **all** recovery donors in
memory and exits **3** before gates. No donor/shared file is removed.

```sh
GIT_NO_LAZY_FETCH=1 python3 docs/re-notes/shadow-man-capture-build-readiness-20261023/test-deliverable.py
```

Actual exit **0**. `checks.json` records exact argv/cwd/env, exits, expected
messages and 30-second control limits. Canonical-entrypoint, native Module,
native compile and 512 MiB memory requests each exit1 at the guard **before**
compilation/allocation; shell and JS syntax pass. Python uses AST syntax checks.
No native fragment or module was compiled, no linear memory was allocated.

The gate prefix is derived from exact candidate `tools/build.sh` (blob
`5407cb296ee6cdab2e30a226d1188206beb852af`), not the earlier recipe. Only its
entrypoint-relative `cd` is replaced by explicit `SHADOW_SOURCE_ROOT`.
Every canonical command/argument array/failure branch through concat and
`check-parens` is retained. Source generation is `node tools/concat-wat.js`,
which writes include-ordered `build/combined.wat`; that file is not compiled.
The prefix ends with a literal exit before `tools/build-compile-wat.js` and
omits both full compilation and the postcompile data-overlap check. No gate
output was copied. `no-compile.cjs` additionally rejects canonical entrypoint
loading, helper `compileSrcWasm`, native compile/instantiate/Module/Instance,
and unbounded or >8 MiB memory. The driver never launches the original full
script or a default source compile. All gates remain **UNEXECUTED**, rather
than passing from inspection. Resource redesign requires a new admission;
the driver provides no cap override and never prints READY from source gates.

## Source and dependency boundaries

`closure-inputs.json` gives exact path/blob/SHA256/size/recovery source for every
measured file. All measured pins were locally available, including compiler
blobs absent from the sparse candidate donor but present by exact hash in the
standing repository. No lazy/broad fetch/archive/cold recovery was used.
This is an available input inventory, not a complete transitive-closure PASS.

`source-boundaries.json` retains the 127 main.watx include order/input identities,
compiler/provenance identities, diagnostic signatures and a 99-file lexical
literal-require graph rooted at the actual runner, preload, adapter and canonical
compiler route. Literal parsing includes optional/commented references: the
unresolved `tools/disasm.js -> ./tools/disasm` is not promoted to an execution
failure. External requests include optional GPU/native paths and pngjs; package
availability/version and all dynamic/data dependencies remain unqualified.
The actual renderer path is run.js -> canvas-compat -> raster-canvas -> pngjs;
run.js catches some imports. Missing optional branches are not falsely called
canonical compiler blockers. Computed require/import/importScripts, runtime
generated source, subprocesses, game files, fonts and conditional data loads
are not proved by this lexical graph. No guest media or 2,083-file restoration.

The producer census scans src WAT/WATX, root JS and recursive lib JS; actual
test/run.js and tools CJS adapters lie outside its JS scope. Its WAT call-graph
reachability and pinned JS boundary patterns do not establish whole-runtime
ownership. Prior four reviewed / 404 unrelated entries retain **pending lifetime
ownership**, unchanged. No temporary-lock pass or transitive-census pass is
claimed. Region owners, mirror freshness, provenance seal, test discovery/tier/
timeout, full census and remaining mandatory canonical checks are all pending.

Diagnostic source declares `set_null_diag(i32)->()`,
`null_diag_field(i32)->i32`, `null_diag_token()->i64`, `null_diag_root()->i64`.
It uses existing `host.log_eip(i32)->()` and internal `$null_diag_event`; source
inspection finds no newly required host import in that fragment. Full import
signature equality, cross-fragment binding, duplicate export rejection and
actual emitted signatures still require the admitted canonical build.

## Future recipe, not execution authorization

After complete closure, all cheap gates and new resource admission, exact
candidate canonical production options are rooted at src/main.watx through
tools/watx-closure.js: mode=production, standardWat=true, runtimeBuiltins=false,
strictDeclarations=true; primary tailCalls=true, compat tailCalls=false, no
region shake, no name section, no legacy compiler, no extraWat stub imports.
The diagnostic code is already in the pinned source; no appended test module
or source transformation is needed. From an isolated exact candidate build:

```sh
env -u NODE_OPTIONS -u WINE_REGION_SHAKE WINE_WAT_COMPILER=watx WINE_WAT_NAMES=0 \
  bash tools/build.sh
sha256sum build/wine-assembly.wasm build/wine-assembly.compat.wasm
node tools/wasm-data.js build/wine-assembly.wasm --overlaps
node /home/user/wine-assembly-shadow-man-capture-build-readiness-oct23/docs/re-notes/shadow-man-capture-build-readiness-20261023/qualify-after-admission.cjs \
  build/wine-assembly.wasm ACTUAL_NEW_SHA256
```

These commands were **not run**. `qualify-after-admission.cjs` is future-only:
it performs full native Module validation (not instantiation), rejects a start
section before validation, checks hash/export kinds, host log/memory imports
and one `wine-region-layout` section, and records complete inventories. It does
not alone validate every emitted signature or the layout hash's correctness;
compare those to pinned header/import signatures/generated mirror and layout
metadata, validate actual function types against the signatures above and the
capture helper, before claiming module qualification. It cannot be reached by
the readiness driver. Expected fresh artifact hash/size and compiler RSS/output
needs are **unknown**, not invented from native fragment fixtures. Future build
admission must include compiler heap/RSS, two outputs, combined.wat, all gate
resource needs and the separately checked disk floor/cap. No 512 MiB guest
arena is necessary for a build; guest execution needs its own allocation.

Full handler/module/start/guest/zero-writer/persistence/reopen/Play remain
**UNQUALIFIED**. Ordinary CACA0005 remains ordinary-or-unknown; writer unproven.
Accepted fixture hashes and bounded 8 MiB arenas from prior reviews remain
scoped offline evidence, not current full-module results.

## Publication and lifecycle

Review/evidence-only packaging was separately admitted before creating this
isolated repository: 18,545,411 projected bytes including 8 MiB reserve. No
production sources were materialized. Standing installed Node/Python/Git/Bash/
SSH identities and donor Git footprints are recorded separately in
`standing-identities.json`; no tool installs/copies or accounting links.
Final footprint/publication receipt follows in the same evidence directory.
Parent paths are preserved via the isolated index, without shared-index/main/
donor metadata edits. Task branch is
`task/shadow-man-capture-build-readiness-oct23`; no merge/force push/deploy.

No workers/refill, Boat/browser/GPU/guest/runtime/recovery allocation or contact.
No assigned box. bx_fn7pn7yg is coordinator-reported snapshot STOPPED with
historical expiry 2026-10-23T03:46:00.580Z, unprobed. Coordinator owns lifecycle.
POSITIONT session01a16700, RichEdit hold, Claude B&W2 and laptop claims preserved.
One assigned task ends at this concrete admission blocker; coordinator decides
the next assignment.
