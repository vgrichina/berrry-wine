# Stronghold natural setup cause, 2026-11-05

The actual setup transition does not establish an input/runtime defect. The
concrete progression dependency is an observation transaction that the current
route cannot receive: an owning native whole-cycle checkpoint, the actual
selected-primary fallback copy and its layer-to-display publication lineage.
Adding only an RPC operation ID cannot repair this case. The existing linker
has zero native surface intervals and zero identified renderer members to join.
No recognizer, input, guest state, clock, cap or readiness policy is changed.
Gameplay remains unverified and no original/browser retry is authorized here.

This investigation uses published `331c216924d16740884620b44b040755480a926c`,
[its actual run report](stronghold-observed-control-gameplay-20261105.md), and
the existing native draw, control-state, render-completion and presentation
notes. Evidence is in
`scratch/runs/20261105-stronghold-natural-setup-cause/` (E below).

## Retained transition and original control flow

`inspection.json` binds the existing executable, native report, host report,
command-15 failure, captures and current source by path and SHA-256. It reads
retained evidence and PE bytes only. It does not execute the guest or fabricate
historical native events. Eleven instruction anchors are checked directly.

The three completed original draws are:

| Entry → return | Entry time minus saved timestamp | Refresh at entry | Fade entry → after update | Suppression entry → return |
| --- | ---: | ---: | --- | --- |
| 43 → 59 | 9088 ms | 1 | 32 → 32 | 0 → 0 |
| 76 → 90 | 688 ms | 0 | 32 → 15 | 0 → 1 |
| 108 → 122 | 3536 ms | 0 | 15 → 0 | 0 → 1 |

The first draw's refresh branch skips fade advancement. The next two use the
original signed arithmetic: `32-trunc(688/40)=15`, then
`max(0,15-trunc(3536/40))=0`. The refresh-zero bypass preserves timestamp
169132 after the first draw's late clock. Thus the earlier possible mechanism
of repeated sub-40-ms gaps losing residual time is **ruled out for these actual
updates**. There is no evidence here for changing time, scheduling or fade math.

Original block `429313` tests refresh and direction before `429321` writes
suppression 1. The negative clamp at `429358` clears fade and direction, not
suppression. Consequently a complete fade-zero draw that returns suppressed is
expected original behavior. The main-loop store at `576c56` clears suppression
separately; a later zero is a per-cycle observation, not a draw-completion fence.
A full-rest host ACK cannot perform that native store.

The premise that actual numbered selection changed is not supported. Every one
of the 140 retained samples has setup manager `[692f48+38]==0`; pending69165c
also stays zero in those samples. The control observer's text “unknown; no
matching setup selection” means no sampled selection, not a foreign selection
fault. Its native fault is null. No preset activation, queue or application was
recorded. There is no absence claim between sampled records.

The source also reveals an ordering dependency not captured by the current
observer. The input gate at `576b9a–576bc0` reads the **preceding cycle's**
suppression before the reset at `576c56`. With fb4694/efe4b4 zero it calls
`4e95f0` only when suppression is zero, unless alternate input flag
`[1a431a4]` permits the call. Otherwise it skips to `576bc5`. Thus fade reaching
zero inside a later draw does not retroactively admit that cycle's earlier
input traversal. These three gate operands are not retained in this actual
report; its precise input branch cannot be recovered. New observation must
sample the executed gate/successor and manager pointer `[150978c]`, rather than
interpret null selection as a broken gesture or a disabled preset.

The source has distinct ordinary selection operations: manager routine
`4e95f0` clears `+38` before input traversal; `4e97a3–4e97b7` writes a child's
address only after its separate field/global gates. Widget-local disabled16
`+38` is another object's field. Neither a null manager selection nor the
suppression-induced zero feedback warrants inventing a selected preset or
changing input handling. Hover routine returns remain description callbacks,
not activation or queued action.

The final draw returned at boundary40820404 to `4e91cf`; numbered widget draws
subsequently returned at40842013,40847488,40852951. The final ACK/capture is at
41586629, with capture PC `44fd7b` and last logged PC `44fd63`, inside the
original RGB565 sprite pixel loop. No fourth scene draw was entered. In this
run the terminal pending array is empty because the observed callback intervals
have returned, **not because the entire native scene/render pass completed**.
The existing observer does not cover that whole pass or retain the final pixel
loop's actual caller chain. It cannot identify that loop's owner from PC alone.
This differs from the predecessor run's still-pending fourth scene draw.

The setup draw is one callback among the manager calls at
`4e91b6`, `4e91c9`, `4e91cc`; widget traversal and subsequent graphics work are
separate. The main loop calls the scene manager at `576db6 -> 4e9180`, then
widget traversal at `576dcf` and `576ded`, and surface presentation at `576e30`. Source reachability does not prove the
retained run executed those unobserved callsites. A new observation must cover actual
entry, saved caller/ESP, scene manager, whole-pass return and suppression-reset
history, rather than assign all later pixel work to the preceding draw.

## Why the actual route rejects

I personally viewed final actual `route-native-boundary-10.png` and the
historically recognized setup reference. The actual image is still translucent
setup artwork with an empty map area, unavailable text, numbered circles and
partially drawn player/configuration panels. The historical reference has a
populated map and opaque panels. Neither is gameplay.

The audit compares every opaque pixel of the fixed game rectangle, without
alignment, masks, fitted thresholds or derived screenshots. The final actual
capture differs from the recognized historical setup at395139/574480 pixels,
including124223 Human/Lord pixels,49449 map pixels,69461 Deathmatch/gold pixels,
47024 player-list pixels and91 numbered-button pixels. This is not one tooltip
or hover discrepancy. The preceding actual transition differs at397531 pixels.

The actual image classifier returns `unknown`, and
`diagnosticScene(bytes, known)` returns `unknown` too. Its complete inputs are
PNG bytes and the image classifier's label. Native suppression, selection,
completed draw and host relation are not parameters to this decision. The
current attachment persists its native report and invokes the passive host
linker during capture, then returns no native observation to the route. The
first unknown-scene failure therefore is an image/dataflow decision, not a
native suppression/selection rejection. Observer-only sampling cannot change
that decision. The immutable command-15 failure must remain terminal; it cannot
be resumed to test a prospective correction.

## The missing host relation is more than RPC identity

The actual page report contains four successful upload/fallback pairs for
surface id `0x200006`, canonical storage474234880, HWND65537, presentation2,
canvas3/window4, versions1372/1374/1376/1378. All37 renderer completion records
have empty `draws`. There are **zero** native `surface-*` records in the actual
140-row native report. Host ownership and upload success are observed facts;
the selected fallback destination and its completed display membership are not.

Current native collection is scoped to four conditional guest Blt CALLs inside
`467b90`. The join starts by finding a native `surface-import-request` within
one such interval. Therefore this actual history cannot produce even a
structural candidate. A new cross-realm RPC identifier alone leaves that empty
set unchanged.

The production fallback path is materially different. `_presentDxIfDirty` calls
`presentBestDxOffscreen(true)`, which chooses the primary/offscreen source and
copies its memory in `_presentDxSurfaceToMainWindow`. The ordinary window path
writes to `_dxFrameLayer.ctx` when that layer exists, otherwise its back canvas.
The renderer then composites the layer. The observer instead accepts only a
canonical presentation's exact `p.canvas` passed to `renderer.ctx.drawImage`.
Its fallback completion explicitly has `surfaceRelation:null`; it records
neither the selected source/slot generation nor the actual copy destination.
Intermediate canvases provide additional unobserved
paths. A completed repaint and a canonical upload cannot fill these gaps.

The host deliberately allows a retained video-memory pointer to be displayed
after three deferred lock checks. That source policy is not a guest whole-frame
fence. The retained evidence does not include actual lock state at final copy,
so it would be incorrect to assert that this particular capture crossed that
branch, or to “fix” it by disabling normal retained-pointer presentation.

The new [dependency fixture](../../test/test-stronghold-natural-setup-dependency.js)
executes on both shipped modules. It uses the intact original input gate and
reset windows, 32 independent flag/fade cases per module, and an actual active
`4e95f0` CALL parked inside a synthetic callee. While that Stronghold CALL is
active, the newly shipped MDK2 ledger reports valid1/depth0. This is a concrete
counterexample to using that ledger as Stronghold pass-absence proof. The
separate original reset clears suppression; fade zero alone does not admit
input through the gate.

The composed arms execute synthetic native `REP STOSW` pixel writes, actual
`WineAssembly.getImports()` and `_presentNow()`, the real dirty/lock policy,
production host imports, renderer and observer. Windowed and exclusive modes
run with and without observation on each module. Synthetic inputs are the
surface/process table, window, presentation-HWND getter facade, broker and
paint program. Existing `test/binaries/notepad.exe` is loaded only for address
mapping; its application entry is never executed. This is not a game retry or
a reconstruction of the original capture's lock state.

One canonical upload precedes red, half-blue/half-red and blue publications.
The half-written native primary is published on the actual policy's third
held-lock check; the first two return0. Independent RGBA oracles check the
mixed frame and completed blue frame. All three layer/display hashes differ,
while the canonical upload version stays fixed and its canvas differs from
the actual fallback destination. The exclusive arm has empty identified
renderer members; the windowed arm identifies the old canonical backing only.
Fallback completion still supplies `surfaceRelation:null` in both modes.
Normal completion and canonical membership therefore cannot substitute for the
missing selected-copy/layer receipt. Observed/unobserved publications and
pixels are identical; pixel acceptance and readiness remain false.

The first two fixture attempts incorrectly required empty renderer members in
the windowed mode. They failed and are preserved in E. The fixture now models
both genuine compositor modes and preserves the canonical positive. A third
fixture attempt correctly rejected its incomplete synthetic HWND setup; only
the explicitly declared presentation-HWND facade was restored. No production
code or historical evidence was changed to make a fixture pass.

The existing native-draw suite passes 20 draw cases and 30 rejection controls
per module, with unobserved/trace/observed full-memory, register and command
parity, plus 24 host structural-join negatives and block-forwarding checks.
The full locked build passes and reproduces the exact tested module bytes.
No production Stronghold runtime, recognizer or immutable original-run binding
is amended. The native predecessor's MDK2-specific binding does not authorize
a new Stronghold original on this module pair.

The newly shipped native `pending_context_version()==1` primitive does not
supply this Stronghold proof. Its fixed relevant target set is MDK2-specific,
including `4522d0/443070` and the other MDK2 contexts; it omits Stronghold's
`4e95f0`, `4e9180` and `4e9400`. Its valid zero depth is not absence evidence
for those passes. A future extension must bind an explicit Stronghold target
profile and original image/owner epoch before execution, preserve native tier
and callback/unwind completeness, and invalidate gaps. The historical 64-return
ring and a startup stack dump are also insufficient.

## Precise next implementation dependency

The required observation transaction has three connected parts:

1. A continuous owning native whole-cycle receipt, including the scene20 draw
   entry/return, subsequent manager/widget pass and ordinary suppression reset,
   including the input gate/successor and its actual manager, plus exact
   capture/ACK epoch, step and saved caller/ESP. No current terminal
   report may become a live prefix. If coverage is missing, return unknown.
2. A passive receipt emitted at the **actual fallback copy**, identifying its
   selected surface allocation/slot, memory/storage range, destination frame
   layer or canvas, copy generation and any in-progress native write interval.
   A synthetic RPC upload result, nearest draw or same storage address is not
   that receipt. The ordinary fallback and guest-originated upload paths need
   separate provenance. No new forced present, wait or guest write is needed.
3. The real compositor's source/layer lineage through normal publication, bound
   to that copy generation and the capture. Only then can capture adjudication
   consume the native observation transaction. A diagnostic native setup label
   must remain distinct from pixel acceptance, native input readiness and
   gameplay; unrelated/foreign/stale/partial/terminal/cap-exhausted cases reject.

The observation may explicitly describe a proven owning pass still in progress
for a diagnostic setup-transition label. That does not assert a completed
return, input admission, pixel acceptance or gameplay. A pending callback by
itself, without continuous owner/copy/publication provenance, is insufficient.
This distinction matters here: the image guard stops during later pixel work,
before the missing whole-pass receipt could ever become a completion claim.

A completed ordinary unsuppressed fade-zero draw, identified ordinary host
publication, fresh personally reviewed controls and actual application/world
proof remain requirements for gameplay. This dependency grants none of them.
There is no warranted direct input/runtime correction and no screenshot
whitelist, increased cap, hover/pending-draw readiness or another original.

## Validation, publication and recovery

Shared edits/tests/build began only after D3Dqueued0432 FINAL `f1dc763eb` then
MDKnative0505 FINAL `036088ef12eb90aed902efa67545b758d5c70ecc`. E's
`release-gate.json` records fresh independent normal exit receipts, exact
PID/startTicks/profile absence, refused ports, no heavy process, free runtime
and build locks and sufficient disk. All final own fixture/build processes
exit0 normally; no browser/server/box was started.

Reproduce from repository root using existing inputs, without copying media
or modules:

```sh
STRONGHOLD_DEPENDENCY_RESULT=scratch/runs/20261105-stronghold-natural-setup-cause/dependency.json node test/test-stronghold-natural-setup-dependency.js
STRONGHOLD_CALLBACK_RUN=scratch/runs/20261105-stronghold-natural-setup-cause/native STRONGHOLD_CALLBACK_RESULT=scratch/runs/20261105-stronghold-natural-setup-cause/native-draw.json node test/test-stronghold-owning-callback-observer.js --draw-only
flock /tmp/wine-build.lock bash tools/build.sh
```

Tested source: `036088ef12eb90aed902efa67545b758d5c70ecc` plus the two
owned new-file patches in E. `inspection.json` records existing EXE,
retained reports/captures and relevant source paths/hashes. `dependency.json`
records the mapping-only PE and native paint program hashes.
`relevant-uncommitted.patch` and `owned-new-files.patch` preserve relevant
uncommitted/new source; Git is the source archive. Logs, JSON and receipts stay
in E and are not committed. `publication.json` records the own-path commit,
immediate strict pinned-SSH pull/push and remote main identity.

Final build identities (byte-identical to tested inputs):

- `build/wine-assembly.wasm`: `8605f6c4800e0286e9d863c599618d7d97cde67936f4b4e6c1528897576aa611`
- `build/wine-assembly.compat.wasm`: `ac64ace417f0af22b904213bf2f739b97a2132f7f631c261eccd855fae18c970`

The actual original's input-gate branch, final caller chain, selected fallback
copy and completed whole-pass publication remain unknown. Those are the next
concrete observation dependencies; no native/input malfunction or gameplay
has been established. Box ID/state/expiry: NA. Coordinator retains shutdown
ownership; there is no test box to stop.
