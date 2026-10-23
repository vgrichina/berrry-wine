# Shadow Man fresh selected-send repair — 2026-10-23

Offline scoped repair of aac3cf5db81fc2946f9bfc2f09a11a9c7be021ec, closing the
fresh-run selection prerequisite found by independent review
ff5156adfe3b8708bf15f5689cd02ce928a5fc62. No production WAT/modal behavior change.
Evidence paths below are relative to the sibling directory with this basename.
Prior 79 publication seals remain prior integrity evidence, reused unchanged;
they are not substituted for these executable behavioral checks.

## Supported selection contract

The existing preload now accepts this explicit action intent through its existing
`SHADOW_NULL_SELECTION` variable:

```json
{"mode":"selected-action","actionSequence":3,"cmdId":3}
```

`3` is the synthetic fixture's dequeued action sequence, not a guest-run recipe.
Choose the one intended action sequence from the actual input schedule, counting
**all** dequeued actions. The intent allows only these three keys, requires a
positive safe-integer sequence and final Beenden command 3. HWND and batch must
be absent. The helper privately copies/freezes the intent. It still validates
PID, runner path and byte pin, exact instantiated Module/instance, `dlg-cmd`,
sequence, command and supported resolved-dialog route. This selects one explicit
action; it does not accept every send or a later action with a matching command.

At the existing actual runner pre-send boundary, after modal/parent/slot
resolution, the adapter validates current nonzero u32 HWND and safe-integer
nonnegative current batch, and snapshots the four resolved fields. The existing
capture arm path deep-copies/freezes, seals, writes and fsyncs that exact context
with the original intent, returned prior-action receipts, pre-arm registers,
source count and metadata **before** breakpoint/trace/diagnostic mutation and
native send. One-shot use is consumed before arming; retention/arm failures
cannot rearm. Returned sends and exceptions still fail terminally.

Existing four-key exact selection remains strict, including batch/HWND. Neither
mode implements late environment registration. Invalid mixed intent/exact keys,
unknown modes, stale selectors, duplicate calls and capture rearm reject. A late
environment replacement cannot change the private intent or exact selector.
No changes to preload compile-byte/Module binding, exports, startup OFF,
quota reservation, zero classification or terminal behavior were needed.

## Executable acceptance

From this isolated checkout:

```sh
GIT_NO_LAZY_FETCH=1 python3 docs/re-notes/shadow-man-fresh-selection-repair-20261023/run-checks.py
```

Exit **0**, ten guarded checks. Exact argv, cwd, environment deltas, exits,
stdout/stderr and 75-second external command limits are in `checks.json`.
The discoverable existing unit entry now executes four focused children with
15-second external guards, within its unchanged registered 75-second timeout:

```sh
GIT_NO_LAZY_FETCH=1 \
SHADOW_NULL_TEST_COMPILER=/home/user/wine-assembly-shadow-man-null-hook-independent-review-oct23/tools/watx.js \
SHADOW_NULL_TEST_OUTPUT="$PWD/docs/re-notes/shadow-man-fresh-selection-repair-20261023" \
node test/test-shadow-man-null-capture.js
```

Exit **0**. The full sender and modal-prefix fixture is reused unchanged; the
new test extracts the actual runner queue/dequeue prefix and actual dlg-cmd
branch, not an invented action driver. `runner-extract.js` records those bytes.
The new driver draws a fresh HWND in [12000,60000) and a current batch in [20,30)
**only after both synthetic Configuration1024/OK1 sends return**. No future HWND
or batch appears in the preload intent. Resolver values are scripted, not real
guest observations. Native sender body/CACA0005/zero predicate are actual source.

`fresh-selection-results.json` and per-case `.trace`/`.jsonl` retain:

| Case | Child exit | Assertion |
| --- | ---: | --- |
| Fresh modal, renderer parent, slot | 86 each | Actual differing batch and fresh HWND acquired after OK; exact receipt before native sender |
| Fresh modal plus environment replacement | 86 | Original explicit intent remains privately selected |
| Wrong command, stale exact selection, stale exact + late env update | 1 each | No arm/event record and no final send receipt |
| Absent dialog | 0 | Runner reports NO DIALOG; no arm, source count0; missing-terminal record correctly prevents capture claim |
| No hook/default OFF | 0 | Direct returned native sends; source count0, no capture |
| Invalid mixed intent/late HWND key | 1 | Rejects at adapter creation, before dequeue |

Every positive receipt seal is verified; pre-arm source count is0; first native
sender record count is1. The fsync observer records the actual sealed receipt
only after the real fsync returns, before the first native sender record.
`fresh-unit-controls.json` independently exercises actual capture with
instrumented exports: persist → breakpoint/trace → arm → send, deeply frozen
intent, mutation-resistant private selection, duplicate/rearm rejects. Twelve
wrong PID/runner/instance/action/sequence/cmd/invalid HWND/batch/resolution
contexts and nine invalid registrations reject without arm/send.

The original maintained suites also pass: actual sender Config/OK +40 modal
completion prefixes consume zero quota while OFF; source event33 traps;
ordinary zero cannot continue; terminal reservation, exceptions, retention,
returned-send, required-block and starvation controls remain accepted.
Compile-byte copies, changed valid Module/custom section, unbound Module,
constructor/streaming/alternate forms, repeated compile/instance, start section,
wrong PID/runner hash and missing exports retain their expected rejection.
Exit86 alone remains insufficient: a missing-export capture failure also exits86.

## Old candidate rejecting controls

Before editing, the review's exact actual-runner/native-sender reproducer ran
against the old candidate: preknown modal/parent/slot exit86; fresh modal,
parent, slot, differing current batch and late env update exit1 before send.
`reproduce-old.cjs` retains that reproducer and reexecutes against the read-only
exact old candidate in check6, exit0 because rejection is its expected finding.
`old-candidate/fresh-selection-results.json` retains exact input IDs, argv and
outputs. Check7's **desired fresh acceptance** assertion actually exits1 on
those observations. It is not reported as an acceptance pass.

Check5 executes the new desired fresh fixture against the exact old runner and
preload using `SHADOW_NULL_TEST_SOURCE_ROOT` and isolated `old-intent-oracle`
output: exit1 at expected86 versus actual1, with `invalid final Beenden selector`.
The same new fixture accepts the repaired adapter. Source-root override exists
only in the test fixture; production helper has no such bypass.

Initial fixture construction failures were a CommonJS `exports` binding name
collision and two overstrict test assumptions (exit-handler fsync is a trace,
and NO DIALOG appends a log). They were corrected before acceptance. No product
failure was suppressed; final expected stdout/stderr is in the command ledger.

## Pins, census and limits

`source-checks.json` proves runner, preload, all three production WAT fragments
and the entire408-entry census byte-identical to aac3cf5. Exactly4 previously
reviewed entries/404 unrelated entries are unchanged, ownership all pending.
Only a cjs diagnostic adapter changed; the pinned scanner scans WAT/root JS/lib
JS, so **zero** ledger entries are affected by this repair. No blind hash update
or ownership upgrade. Scoped30-producer/discovery/timeout checks pass; full
transitive census, full manifest and actual Module exports remain pending.

New selected-send native fixture: 3526bytes,
SHA256 `103b6e04fc7b5a30a820eba0d76c171fa8f4db5967860849ad9fb89c4a44a00e`.
Retained sender/modal fixture:3394bytes SHA256
`5b874002a970b97d246408739811bd1802a8c31a6dc2357973579ce67c55f8ab`;
original hook:902bytes SHA256
`f45414f005d33707d05e0a16d9abf6d77f2ddce5aa00ddcddc73551e68e500dd`.
Each fixed initial=maximum128-page arena is **8MiB**. Resolver/translator,
invocation allocation and callback/run seams are scripted. VM calls have1s
limits; each fresh/binding child has5s external timeout. Arena limits do not
bound Node/compiler RSS. WAT and recovery commands are retained; ignored wasm
outputs are reproducible and their hashes recorded. No full/default/canonical
compile, guest, media, Boat, browser, GPU or runtime/recovery was attempted.

`admission.json` was measured BEFORE checkout: projected30,703,293bytes including
Git/source/metadata/output/temp growth and8MiB reserve, cap67,108,864; free
5,786,017,792 minus projected growth exceeds floor2,982,150,144. Installed tools
execute in place; standing hashes/footprints, compiler and read-only donors are
recorded separately. `standing-additional-scripts.json` records the in-place
scoped timeout dependencies. Final task footprint and publication seals are in
the task scratch publication receipt. No links, installs, lazy/broad fetch or
archive. Independent repository/index; named-path staging only, parent tree
preserved outside two modified files and new focused fixture/report/evidence.

## Next prerequisite and handoff

This closes the offline fresh-selection execution prerequisite only. Before
native module or guest qualification, independently review the adapter and
complete/admit the existing exact source closure/provenance/manifest/transitive
census/gates, then separately authorized canonical compilation and actual
imports/exports/start absence inventory. The retained pinned build recipe in
review43a1d1d remains unexecuted here. Qualify revised module with actual runner,
PID and single instance, complete game fixture, observable fresh OK/launcher
route, the explicitly counted selected action intent, exclusive evidence output,
block policy and external watchdog. No historical HWND/batch can substitute.
Configuration/OK returned receipts do not prove visual success, persistence,
reopen, Play, gameplay, modal ownership or a zero writer. Ordinary CACA0005
first-zero remains `ordinary-or-unknown; zero-writer unproven`.

StrictSSH read-only remote main reconciled to
bb9c496ed13095cc832fdf607f0937fb9c14b7de; input/review task refs match. No merge,
deploy/shared-index/donor metadata/main mutation. Commit/verified remote branch
are recorded in the append-only shared board and scratch publication receipt.
No workers launched, no queue refill. Parallel POSITIONT/RichEdit, Claude B&W2
and laptop HeroesII/Warcraft claims preserved. No assigned/contacted box;
bx_fn7pn7yg remains coordinator-reported snapshotSTOPPED, historical expiry
2026-10-23T03:46:00.580Z, state unprobed. Coordinator retains lifecycle/shutdown.
One bounded task complete; coordinator decides next assignment.
