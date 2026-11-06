# Aranna listener acceptance and draw-result boundary

`NEW-GAME-ARANNA-DEMO-20261010` remains at Main Menu. One original run now
proves a candidate accepted during the actual Single Player mouse-down callback,
and separately correlates owning allocation refusal with a zero draw result and
the guest's success branch. It does **not** prove that the accepted candidate is
the Single Player action handler, that a transition was queued, or that allocation
refusal caused the failed menu transition. No emulator repair was justified.

Evidence: `scratch/runs/20261106-aranna-complete-listener/`. The run uses existing
28-media paths and SHA-256 identities in `media-references.json`; nothing was
copied. Exact Git SHA, relevant binary diff, and owned new-file patches are in
`preoriginal-source.json` and its referenced patches. Runtime source was
`46a8f96556578a0f9ea7c81b85224ba9297afe78`; later shared commits were documentation
only, and the post-original source/module/helper guard passed.

The released incomplete draft is read-only at
`scratch/runs/20261106-aranna-listener-draw/observer-transform.cjs`, SHA-256
`625c96b15e9397fc38af393a8b2169ef1dc9e5e7db260d1b793faa641986e471`.
Its listener/predicate disassembly was reused as evidence, not as tested observer
code. The new transform extends the released menu-input observer described in
[aranna-menu-input-cause-20261106.md](aranna-menu-input-cause-20261106.md),
commit `dc9d1a51126dae8f011fa2a06eeb6d3ffffa6b15`.

## Tested observer and controls

The observer has 48 private invocation slots, per-thread nested parent IDs,
separate bounded admission by transaction kind, and end packets independent of
detail quotas. It copies GPR/lazy flags, x87 payload and environment, thread and
fault state. It neither translates new guest addresses nor writes guest state.
Allocator records use already validated locals at actual list/bin/large-list
visits; accepted-free records follow the allocator's normal accounting commit.
It does not borrow a free list or claim an exhaustive arena census.

Actual hooks cover traversal `0x4182b4`, predicate `0x43a540`, its fallback
indirect call returning to `0x43a5b2`, owning heap operations, serialized post-queue
results and public queue APIs, unconditional VB draw results with call return
`0x65f8ff`, and consumer branches at `0x41f009` / `0x41f01d`. Detail quotas are
256 block records, 512 combined draw/consumer edge copies, 2,048 combined span
and arena copies, and separately bounded API/OOM/queue records. Transaction
ends remain available after these quotas fill. Draw admission permits 64 initial
samples and additional samples after actual final allocation refusal, up to 384.

The required locked build passed. Both ordinaryAPI and actual owningWorker
routes passed on standard and compatibility modules, each against its own
uninstrumented same-closure baseline. Baselines exactly match shipped bytes;
imports/exports remain unchanged. The generated sparse PE uses ordinary public
DirectDraw/D3D/VB calls, recursive listener/predicate calls, an indirect callback,
PostMessage, three allocation sizes, real reserve/fault/SEH resume, and live FLD1
and FLDPI values. CPU/GPR/lazy flags, saved x87 payload/environment, input and
COM results match. Each observed route completes 75 transactions, rejects a
removed real end packet, saturates its detail quota with ends retained, visits
all three allocator paths, and exercises both consumer comparisons. See
`validation-finished.json` and `controls/transactions-*.json`.

Two harness-only attempts are retained. First, queued WM_USER messages overwrote
the fixture's last-message coordinate slot; the final fixture stores actual UP
coordinates separately. Second, the cached tight loop produced only 321 block
observations, so a 4,096 detail cap was not exercised; the final 256 cap is
actually saturated. No emulator assertion was suppressed or guest game changed.
Final source/helper/module/media guards passed before and after the original.

## Actual menu boundary

Ordinary input accepted the reviewed EULA, skipped the intro, clicked visible
Single Player at browser `(340,355.9936)`, and sent Enter. Captures
`after-intro.png`, `after-single-player.png`, `after-enter.png`, and `late-menu.png`
were personally reviewed. All remain Main Menu; the late background is visibly
degraded. There is no gameplay movement plus another response. FPS and audio
are unknown.

The mouse-down callback is invocation `0x13b`, actual WndProc `0x414f7c`, HWND
`0x1000e`, message `0x201`, lParam `0x00970190` (400,151). Its first traversal
`0x13c` returns zero at `0x414e5d`. Its second traversal `0x140`, under the same
callback, tests candidates `0x0860a888`, `0x08609964`, `0x08609d40`. The first two
return AL=0; predicate `0x143` returns EAX `0x08af0f01` (AL=1), and traversal
returns `0x08609d40` at `0x418168`. This proves actual candidate acceptance,
without establishing the candidate's semantic button/action identity. The
subsequent UP callback `0x144` has lParam `0x012c0190` (400,300); the different
release point is retained, with no cursor repair or causality claim.

Enter down/up callbacks `0x145` / `0x14c` each traverse all three candidates and
return zero. Their fallback indirect invocations `0x149` / `0x150` call target
`0x4b9240`, return to `0x43a5b2`, and complete under their predicate parents.
Escape supplies the other two observed fallback calls. Six traversal and 18
predicate invocations have matching ends. No serialized post or public queue
result occurred while these observed listener frames were active.

Coverage matters: `0x43b388` can invoke handlers through `0x43b49e`, including
indirect calls at `0x43b4ac` / `0x43b4d2`; these are outside this observer's specific
fallback-call hook. The 256 block-detail quota had already filled before the
click. Absence of the observed queue events therefore does not establish absence
of an internal guest transition. Read-only caller/inner disassemblies are retained
as `menu-caller-readonly.txt`, `menu-dispatch-readonly.txt`, and
`predicate-inner-readonly.txt`. The next menu boundary is the accepted query's
actual handler and internal transition/release consumer, not callback delivery.

## Actual draw and allocator boundary

The fully drained run has 8,101 scalar packets and 1,600 completed transactions,
with zero packet errors or missing ends. All 378 admitted accepted frees have
matching arena copies, true returns, and aligned spans within copied validated
bounds. There are 1,024 visited-span and 1,024 matching arena records; the shared
span quota fills. These are partial visits, never complete free-list ownership.

`causal-correlations.json` joins 17 failed owning allocations to their actual VB
draw parents. All 17 draw results are zero and all 17 scoped guest consumers
complete with zero. Five retain the selected success edge: comparison fall
`0x41f00d`, target and selected PC `0x41f060`. The remaining edge copies are
quota-limited, so their branch direction is not claimed from absent packets.
For example allocation `0x167`, requested 45,056 bytes, returns zero under draw
`0x166`. Its unconditional draw snapshot has call return `0x65f8ff`, EAX=0;
consumer `0x168` selects `0x41f060`. Records 4491, 4493, 4494, 4497 identify the
allocation end, result snapshot, draw end and selected branch respectively.
The observer snapshot PC remains dispatch PC `0x65f8d8`; the copied actual call
return and subsequent guest edge establish consumption.

Independent scalar notifications total 6,178: 3,089 reservation refusals of
1,048,576 bytes (reason 3), plus 3,089 final refusals (reason 1) with sizes
34,408 / 45,064 / 18,696 / 18,536 / 17,480. This is stronger than a static consumer
prediction: retained failures demonstrably reach the normal guest success branch.
It does not connect allocation failure to menu acceptance/transition. A result-code
change alone is not justified as a gameplay repair.

## Lifecycle and publication

Conan0240, KKnD0245, then operationWebGL0247 released exactly in order. Independent
cleanup passed before opening the immutable window at 04:04:24Z, deadline
04:49:24Z. The sole original launched about 04:08:28Z and closed at 04:15:50Z.
The late sample crossed the probe's 420-second ordinary-input queue deadline;
the following quit file was not processed. This is retained as a harness timeout,
not relabeled a successful normal quit. Browser cleanup drained all 14,292 copied
rows (plus one module-selection record), and Chrome exited 0. No retry occurred.

`original-transactions.json` independently matches drained counts and validates
parents, endpoints and accepted-free provenance. Cleanup records all owned PIDs,
ports and profiles absent, four locks free, no heavy runtime, and free disk above
the required floor. No box was created or assigned; ID/state/expiry are N/A.
Only this note is published; production/test sources were unchanged. Run artifacts
and helper new-file patches remain in the ignored evidence directory, with hashes
reopened and `result.json` written last. Next work should observe the inner handler
and transition/release path identified above, retaining the same ownership limits.
