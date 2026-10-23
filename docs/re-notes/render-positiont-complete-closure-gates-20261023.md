# POSITIONT complete closure: BLOCKED at enforced file-size admission

The single canonical attempt stopped with **exit 1 / EFBIG** while the guarded
preload staged the committed bundle for
`node tools/toyvm/bundle-browser.js --check`. The inherited
`prlimit --fsize=524288` applies to **every written file**, including staged
assets, not just stdout/stderr. The first bundle is larger than that limit.
The unchanged bundle gate body did not execute. No limit was changed, no retry
was made, and this runner is **failed evidence, not an accepted recovery recipe**.

The first resource checkpoint incorrectly described that limit as a log bound
without checking its effect on phase materialization and the future combined
file. This is a readiness-runner defect, not a production defect or unavailable
source. The next separately assigned correction must distinguish bounded logs
from admitted source/generated-file sizes before any new attempt, while keeping
all enforced controls and the same 64 MiB allocation. No authorization increase
or bypass is proposed here.

Exact fixture `7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6` keeps its accepted
source/offline result `aea185d3dfc1b772cea00ca1a4aed14b9553dfed`.
Reviewed failed predecessor `e1981c458f9fda5ecee8143cffc0f7955658bc13` remains
failed. Historical `fa1df683034ec8325893892f09577973d07acf61` remains invalid for
compliant execution: omitted external capture exceeded the cap by at least
763,032 bytes. Nothing here reclassifies that run.

## Complete static input reconciliation

The planner enumerated the actual candidate with read-only
`GIT_NO_LAZY_FETCH=1 git ls-tree -rz -l 7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6`.
It reconciled all **8,410 tracked entries**, rather than treating the inherited
3,372-entry focused `candidate-tree.json` as the entire tree. Their shared
identities match. Missing unrelated blobs appear as `BAD` sizes and were neither
fetched nor materialized; every selected input was read and its Git blob checked.

The compact [manifest](render-positiont-complete-closure-gates-20261023/manifest.json)
contains **3,147** selected inputs with path, exact blob, measured byte size,
read-only donor, final lifetime, and first phase. The
[closure receipt](render-positiont-complete-closure-gates-20261023/closure.json)
records whole root JS, recursive lib/tools/test JS, WAT/WATX, and discovered-test
sets, exact gate-consumer roots and dependency closure, bundle roots and dynamic
compile-wat edge, sealed compiler provenance inputs, and concat consumers.
The pre-execution verifier compared actual scanner membership with the direct
tree sets and verified every materialized/deferred input identity. It separately
reconciled all 286 fixture pins; no baseline or source hash was refreshed.

The inherited receipts omitted six required inputs, now resolved before the
single staging attempt:

| Input | Git blob | Bytes |
| --- | --- | ---: |
| host.js | d6edb71e5d2846b8cfda1431e535752d06a751fc | 368727 |
| sw-coi.js | b89b5a1974ed33f2a9192babb73dbe6b138e10e6 | 2291 |
| threads-probe-worker.js | 72ffb8412c411e47c10a01e98356ed101271c625 | 6137 |
| index.html | See exact manifest | 182401 |
| test/run-all.sh | See exact manifest | 9256 |
| fonts/substitutions.json | See exact manifest | 10654 |

The two committed browser bundles and exact 5,168-byte Terminal.fon were fully
available and verified read-only before execution. The font is an explicitly
pinned external asset, not an invented candidate-tree entry. The source include
universe, API/ordinal/kernel data, browser HTML graph, timeout runner/overrides,
ratchets, compiler PROVENANCE/CHANGELOG and sealed tests, layout offsets and
dynamic bundle dependencies were included. The original receipts are comparison
evidence only; their completeness is explicitly rejected.

All root/lib/tools JS stays through late layout and variant consumers; test JS
may be released only after the final broad test scanner (browser-cache check),
with sealed compiler tests, late dependency closure and exact pins retained.
The planner asserts released test inputs do not intersect late consumers.
The planned concat phase retains every pin, the source verifier and final tool
closure. No donor inputs are deleted. Actual failed phase state, including all
released identities and the partial bundle, is in
[observed-phase-state.json](render-positiont-complete-closure-gates-20261023/observed-phase-state.json).
There is no successful bundle transition receipt.

## Bounds and execution evidence

The changed design uses private Git refs/index and read-only standing object
alternates; no historical object copy, source links, shared index, or donor
metadata mutation. Source bytes are materialized and counted normally. Installed
tools run in place. Seven executable identities and all 27 pngjs 7.0.0 files
(650,101 standing bytes) were reverified; separate footprints are in
[standing.json](render-positiont-complete-closure-gates-20261023/standing.json).

Before the one materialization, the dry-run projection was:

| Phase | Bytes including reserve and growth |
| --- | ---: |
| Initial scanners | 66902127 |
| Bundles / decoder / provenance / layouts | 53401418 |
| Combined WAT / parens | 59801137 |

Each includes measured external launcher events/capture (642,943 bytes at
admission), 1,572,864 future-growth bytes, 1,048,576 private Git/code/evidence
bytes, directory bounds, and the **8,388,608-byte reserve inside 67,108,864**.
The maximum measured command admission was **67,059,965**:
56,441,800 owned + 656,693 external + 1,572,864 growth + 8,388,608 reserve.
Host free was 6,107,504,640 bytes there, above the 2,982,150,144-byte floor even
after projected growth. Detailed before-command measurements are in
[resources.jsonl](render-positiont-complete-closure-gates-20261023/resources.jsonl).
This establishes disk-accounted progress through the first denial, not complete
resource compatibility or READY. The file-size conflict invalidates that latter
claim despite feasible disk arithmetic.

[resource-checkpoint.json](render-positiont-complete-closure-gates-20261023/resource-checkpoint.json)
records all mandatory shell command lines and resource-sensitive operations from
99 executable consumer source files. Bounds were Node old-space 512 MiB per
process, timeout 600 seconds / TERM plus 5-second kill grace, CPU 600 seconds,
and the actual global file-size limit 524,288 bytes. Parent driver plus a gate
is two Node processes; the union gate can add one child (finite aggregate heap
ceiling 1,536 MiB). Heap limits do not claim to be total RSS limits.

The planned decoder exception is restricted to the exact command
`node tools/toyvm/decode-diff.js --random=20000 --seed=12345`, authentic emitted
module, one native compile, one instance, and one simultaneously live 676-page
arena: **44,302,336 aggregate bytes**. Static inspection found one makeVm call.
Actual decoder compile/instance/live arena counts are **all zero**: it was never
reached. The actual live count, module hash and decoder outcome remain unmeasured.
Other native modules/arenas remain forbidden. Existing region checks emitted the
335-byte declaration-only fragment SHA-256
`2c3a646b7b5b21185f8112fc08ea6cbcb6e9cc1e54e07695a3b7d3032cc7ea94`
through the JS compiler, with no native compilation or instantiation.

Exact launch (driver exit 1, shell exit 1):

```sh
cd /home/user/wine-assembly-render-positiont-complete-closure-gates-oct23
GIT_NO_LAZY_FETCH=1 \
NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules \
NODE_OPTIONS=--max-old-space-size=512 \
node tools/positiont-complete-readiness.cjs
```

The driver executed the exact candidate build.sh prefix before
`node tools/build-compile-wat.js`, build blob
`5407cb296ee6cdab2e30a226d1188206beb852af`, prefix SHA-256
`9010ba300b4af1a887bb7f7e078ca270fa6ec837f5419842e6d28537c5c21159`.
The actual bounded child argv is retained in
[readiness.json](render-positiont-complete-closure-gates-20261023/readiness.json).
**33 Node child invocations exited 0**, through browser-cache self-test, with
exact argv/exits retained there. The 34th invocation is the bundle preload
failure; [canonical.log](render-positiont-complete-closure-gates-20261023/canonical.log)
contains the exact EFBIG stack and shell order. These are fresh results; no gate
outcome was copied from either predecessor. Bundle check, decoder, epilogues,
compiler provenance, layouts/variants/offset freeze, concat/parens remain
unexecuted. No later prerequisite was skipped and then declared passed.

## Rejecting controls and remaining work

[controls.json](render-positiont-complete-closure-gates-20261023/controls.json)
records 23 passing checks with exact argv/exits/output: three syntax checks,
positive complete-input preflight, twelve input-class masks rejecting before
canonical subprocess creation, six forbidden compiler/native/guest operations,
and arithmetic rejection of the historical cap overrun without disk allocation.
The input masks intercept both file reads and exact Git-object reads. An initial
draft control intercepted only file reads and failed to mask the object-backed
bundle; the hook was corrected before any canonical attempt and all twelve
classes then rejected. No source or canonical gate was changed for these tests.
The controls do not claim the unexecuted decoder exception passed.

Future work requires a new bounded assignment correcting the file-size/log
design, complete re-admission and a fresh whole canonical prefix. The current
partial staging is evidence, not a runnable complete checkout. After separately
admitting a complete exact fixture checkout and build resources, the exact
future diagnostic build/qualification commands are:

```sh
# UNEXECUTED; separate complete-source/build admission required.
NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules \
node test/support/positiont-com-module.js --build-diagnostic \
  build/positiont-com-diagnostic.wasm build/positiont-com-diagnostic.provenance.json
# UNEXECUTED; separate 512 MiB arena/runtime admission required.
NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules \
node test/test-d3d9-positiont-com-qualification.js --qualify --allow-512m \
  --module=build/positiont-com-diagnostic.wasm \
  --provenance=build/positiont-com-diagnostic.provenance.json
```

All full/default production compilation, COM/native-pixel/real-heap qualification,
guest/browser/GPU/Boat work, new tools/media, worker launch/refill, merge/deploy,
main/shared-index/donor changes remain unexecuted. No box was assigned or
contacted. `bx_fn7pn7yg` is only the coordinator-reported STOPPED snapshot with
historical expiry 03:46:00.580Z, unprobed; lifecycle stays coordinator-owned.
ShadowMan `01a1671a-95fe-74c1-a580-abbf6f35b7c3`, held RichEdit, Claude B&W2,
and laptop HeroesII/Warcraft ownership are untouched.

Publication is review/runner/evidence only on
`task/render-positiont-complete-closure-gates-oct23`; exact commit and actual
strict remote SHA are in the append-only repository messageboard and external
publication receipt. Main was reconciled read-only to
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`. Stop after publishing this first
actual enforced blocker; the coordinator owns the next assignment.
