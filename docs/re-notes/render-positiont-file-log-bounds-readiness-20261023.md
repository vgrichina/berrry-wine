# POSITIONT canonical pre-compilation readiness: READY

The one fresh canonical attempt for exact fixture
`7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6` completed with driver/shell exit **0**.
All **52 Node invocations** exited 0, through `build/combined.wat` and the unchanged
paren/label gate. No production compilation or COM/runtime qualification ran.
Source/offline acceptance `aea185d3dfc1b772cea00ca1a4aed14b9553dfed` remains scoped.

The corrected executable [runner](../../tools/positiont-complete-readiness.cjs)
uses an independent [pipe supervisor](../../tools/positiont-bounded-capture.py):
regular files have finite `RLIMIT_FSIZE=25165824` (24 MiB), while combined
stdout/stderr capture has its own **524288-byte** ceiling. Overflow fails exit
125, preserves only the bounded failure transcript, sends TERM/KILL to the
child group, and reaps descendants using Linux subreaper ownership. No overflow
can report success. The inherited host file hard limit was unlimited; no system
hard limit was raised or removed. CPU 600 seconds per child, total wall 600
seconds, and Node old-space 512 MiB per process remain enforced. The supervisor
lowers both child file limits. The driver creates an exclusive attempt latch.

Actual capture was **33,620 bytes**, elapsed **18.637 seconds**, exit 0, with
the group fully reaped. The complete launch argv, exit, finite limits, and counts
are in [capture.json](render-positiont-file-log-bounds-readiness-20261023/capture.json).
The exact argv/exits of every Node consumer are in
[readiness.json](render-positiont-file-log-bounds-readiness-20261023/readiness.json);
shell trace and outcomes are in
[canonical.log](render-positiont-file-log-bounds-readiness-20261023/canonical.log).
The shell prints its original “Compiling (WATX)” announcement, then exits at the
authorized boundary; `tools/build-compile-wat.js` is excluded and unexecuted.

## Input and resource checkpoint

Before the one materialization the [planner](../../tools/positiont-complete-plan.py)
independently enumerated all 8,410 candidate Git entries, read every selected
input, verified its blob/size/availability, and recomputed root JS, recursive
lib/tools/test JS, WAT/WATX, discovered-test and mandatory-consumer membership.
It independently reconciled the same **3,147 inputs** and their phase lifetimes
with failed donor `fa469c19999b4b2ee649f9734dea0a4c1756ed0e`, and all **286 pins**.
The donor's 16 sealed files were also checked against actual files and exact
commit objects. Historical gate outcomes were not reused. The earlier focused
3,372-entry receipt does not define tree completeness.

The [manifest](render-positiont-file-log-bounds-readiness-20261023/manifest.json)
records path, blob, bytes, exact read-only donor, last lifetime and first phase.
[closure.json](render-positiont-file-log-bounds-readiness-20261023/closure.json)
records direct universes, consumer roots, literal/dynamic edges, provenance,
bundles and concat membership. Required root JS, HTML, run-all shell, dynamic
JSON, Terminal.fon, both committed bundles and sealed compiler tests are included.
All root/lib/tools JS survives late consumers. Only fully consumed test inputs
are released before bundle loading; concat retains all pins and final tools.
The independent membership assertions reject a release intersecting late reads.

[resource-checkpoint.json](render-positiont-file-log-bounds-readiness-20261023/resource-checkpoint.json)
contains the complete literal canonical prefix and exact resource-operation
source index. Build blob is `5407cb296ee6cdab2e30a226d1188206beb852af`, prefix SHA-256
`9010ba300b4af1a887bb7f7e078ca270fa6ec837f5419842e6d28537c5c21159`.
The prefix was sliced unchanged before `node tools/build-compile-wat.js`.
The mandatory nested test-manifest shell was separately read, including both
Node consumers and its exact run-all input. Check/self-test branches use memory;
the generated disk files are the temporary prefix and combined WAT. Child
process concurrency is at most three Node processes including driver and union
subprocess (aggregate old-space ceilings 1,536 MiB; these are not RSS ceilings).
Other native compilation/instantiation/arenas remain rejected. Declaration-only
region emission is not a native compile or memory allocation.

| Phase | Pre-staging projection | Measured phase admission |
| --- | ---: | ---: |
| Initial scanners | 66,494,318 | peak 66,696,175 |
| Bundles / decoder / provenance / layouts | 52,993,609 | 53,375,343 |
| Combined WAT / parens | 59,393,328 | 59,851,196 |

Each total includes task-owned source/Git/directories/evidence/temp/output,
external launcher events/capture, **1,572,864 bytes future growth**, and the full
**8,388,608-byte reserve inside 67,108,864**. Dry directory/metadata estimates
are superseded by actual recursive measurements before commands and phase
transitions; the initial measured peak was 201,857 bytes above the dry estimate and
still 412,689 bytes below the cap. The peak components were 56,496,662 owned +
238,041 external + 1,572,864 growth + 8,388,608 reserve = **66,696,175**.
Host free there was 5,317,328,896 bytes, above the **2,982,150,144-byte** floor
after projected growth. Both projected phase generation and actual writes were
admitted. Full before-command measurements are in
[resources.jsonl](render-positiont-file-log-bounds-readiness-20261023/resources.jsonl).
Future growth covers launcher events, capture/evidence, Git/index/publication and
temporary metadata. No allocation increase was used.

Source bytes are ordinary copies, without source links. Private Git uses explicit
read-only object alternates; donor index/refs/metadata and shared index were not
written. The private index was populated from the exact candidate only after
scanner inputs were released, preserving all parent tree entries at publication.
Installed executables ran in place; seven identities and all 27 pngjs 7.0.0 files
were reverified in [standing.json](render-positiont-file-log-bounds-readiness-20261023/standing.json).
No tool was copied or installed. Failed donors remain read-only evidence.

## Authentic decoder, generated file and controls

The mandatory command was exactly:

```sh
node tools/toyvm/decode-diff.js --random=20000 --seed=12345
```

It passed with **one native compile, one instance, one simultaneously live arena,
676 pages / 44,302,336 aggregate bytes**. The exact emitted native module was
343,731 bytes, SHA-256
`91747769679ce2e661242d0777c1f0fb5aeffe48cbbe2f71ea9443eaf57a45cf`;
emitted source SHA-256
`a2ff9f6ff00090aadc88155995abb17974116e88b7855fe4d500e3a7e542cddd`.
At allocation the process reported RSS 293,449,728, heap used 65,275,632 and
external 48,108,805 bytes. Exact source/argv, emitted digest, compile/instance
count, one finite arena and 512 MiB heap were guarded. No larger arena authority
or production compiler exception was added.

The unchanged concat produced **20,695,174 bytes** and passed parens/labels,
SHA-256 `c09a0de8c309750b22210b2280215ab1d7f30c2b78f2b14e2e66f88ee12d2f8f`.
This real generated multi-MiB write independently demonstrates that the capture
ceiling no longer constrains admitted source/generated file sizes.
[final-state.json](render-positiont-file-log-bounds-readiness-20261023/final-state.json)
records all 290 retained exact files, 2,857 released identities, and output hash.
The generated WAT is retained locally, not committed as a 20 MiB evidence copy;
its deterministic recovery recipe is the unchanged concat command after fresh
admission of the exact source include closure.

[bounds-controls.json](render-positiont-file-log-bounds-readiness-20261023/bounds-controls.json)
has four passing real controls: a 2,349,309-byte regular file with tiny capture;
24 MiB+1 ftruncate rejection with EFBIG and zero allocated file length; exact
512 KiB combined stdout/stderr success; and one-byte aggregate overflow failure
with TERM-resistant descendant killed and reaped. Synthetic large log payloads
were removed after recording exact sizes/hashes; peak control file+log payload
was 2,873,597 bytes. No oversized real allocation was made for rejection.

[controls.json](render-positiont-file-log-bounds-readiness-20261023/controls.json)
has 23 fresh checks: syntax, positive exact-input verification, twelve actual
file/object input-class masks rejecting before canonical execution, six
full/default/unknown/native/512 MiB rejecting compiler controls, and arithmetic
over-cap rejection without disk allocation. These controls did not execute
native code or allocate a guest arena.

Exact successful driver command:

```sh
cd /home/user/wine-assembly-render-positiont-file-log-bounds-readiness-oct23
GIT_NO_LAZY_FETCH=1 \
NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules \
NODE_OPTIONS=--max-old-space-size=512 \
node tools/positiont-complete-readiness.cjs
```

## Separate future build admission

READY applies to this pre-compilation prefix only. A future complete exact
checkout/private Git view, diagnostic compiler memory/CPU/module outputs,
provenance files, capture and temporary growth need separate measured admission;
the released scanner inputs cannot be assumed present in this final phase view.
Then the exact diagnostic build recipe is:

```sh
# UNEXECUTED; separately admitted complete exact fixture/source/build resources.
NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules \
node test/support/positiont-com-module.js --build-diagnostic \
  build/positiont-com-diagnostic.wasm build/positiont-com-diagnostic.provenance.json
# UNEXECUTED; separate 512 MiB guest/runtime allocation and qualification authority.
NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules \
node test/test-d3d9-positiont-com-qualification.js --qualify --allow-512m \
  --module=build/positiont-com-diagnostic.wasm \
  --provenance=build/positiont-com-diagnostic.provenance.json
```

Failed `fa469c19` is not an accepted recipe; earlier `e1981c45` remains incomplete,
and historical `fa1df683` accounting overrun remains invalid. No production defect
was established and no production source, owner, hash, ratchet or generated
baseline was changed. Full/default/canonical production compile, COM/native
pixels/real heap, Boat/guest/browser/GPU/media/tools/runtime remain unexecuted.
No box was assigned/contacted. `bx_fn7pn7yg` remains only the coordinator-reported
STOPPED snapshot, historical expiry 03:46:00.580Z unprobed; coordinator owns lifecycle.
ShadowMan `01a16727-317d-77d0-a8f4-e29186a1e0de`, held RichEdit, Claude B&W2 and
laptop claims are untouched. No workers/refill, integration, merge or deploy.

Publication is only runner/report/evidence on
`task/render-positiont-file-log-bounds-readiness-oct23`. Strict actual remote SHA
and unchanged main `bb9c496ed13095cc832fdf607f0937fb9c14b7de` are recorded in the
append-only repository messageboard and external publication receipt. Stop after
publication; coordinator owns the next assignment.
