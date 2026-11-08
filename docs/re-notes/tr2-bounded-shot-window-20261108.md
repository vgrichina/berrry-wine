# TR2 bounded readiness/shot window — 2026-11-08

Offline change only. The [1940 original](tr2-mapped-weapon-original-20261108.md)
consumed Action40/full input100040, HP1000, and advanced arm frames0→1 before
the observer stopped at its first weapon return. That is early readiness,
not evidence of ineffective firing. The [native dependency map](tr2-weapon-consumption-20261108.md)
and retained exact disassembly show frames0–3 raising, frame4 requiring Action40,
and frames24 onward waiting for weapon-info cooldown before returning to4.

`tools/tr2-action-observer.cjs` now accepts **`weapon:true, untilShot:true`** in
`install`, `workerSource`, and `observedHold`. Defaults still stop at their
existing Action/weapon boundaries. The opt-in continues only after a completed
exact weapon return and a newly observed input-update entry. An update/poll
that crosses an unfinished chain, or a second weapon invocation reusing a
completed chain, fails closed. Each cycle independently links poll → Action →
saved input caller/ESP → full published input → saved weapon caller/ESP.
Paired-arm, arm-processing and shot caller/ESP checks remain active.

Five normal rows per cycle retain poll, Action, publication, weapon entry and
weapon return. Repeated gate visits produce no extra rows in this mode; entry
and return snapshots retain readiness state. The first exact linked shot
entry/return adds two rows and immediately removes the observer. `shotRecord`
links the return to its entry; `actionRecord` links both to that cycle's Action
and poll. `shotQualified` requires successful Control/Action on that chain.
The raw result may be zero: this qualifies observation of an attempted shot,
not effective firing, damage, aim, hit or kill.

At this done boundary the outer weapon function is still running:
`pendingWeapon:true` accurately reports that fact. The required shot has
returned (`pendingShot:false`); an unfinished shot, unfinished readiness update,
removal without a shot, deadline or overflow cannot qualify the opt-in. Native
hold correlation additionally requires the linked poll, Action, shot entry and
return inside the independently released hold, plus its physical Control sample.

The installation limits remain **2500ms /32 records**, with actual retired-block
debit and remainder forwarding unchanged. Sparse/PTE/DIB reads remain read-only
and fail closed. Publication GEN may advance normally or wrap; rollback and
invalid KEYS_VALID fail closed at observation boundaries. GEN is a publication
counter, not an elapsed-time freshness guarantee. Owner/image/endpoint checks
remain unchanged; unobserved internal WAT reentry/other threads remain outside
scope. No private calls, setters, tracing changes or guest writes were added.

Evidence: `scratch/runs/20261108-tr2-bounded-shot-window-2007/`. Tests execute
immutable original arm and shot instruction slices on CPU SHA256
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`, with
authored stack/state and explicit harness frame commits. Default first-return
removal is reproduced at frame1. The opt-in observes four completed raise
cycles followed by the native shot CALL/RET on cycle5, using26 rows. The shot
slice deliberately uses type2/zero-ammo return0; it does not simulate the full
weapon/ammo pipeline. Crossed cycles, caller/stack/mask mismatches, stale
publication, pending work, deadline, overflow and out-of-hold correlation are
negative fixtures. Repeated gate visits preserve later-cycle capacity.

Action observer57 checks, weapon/mapping/orchestration150 checks, and the locked
full build pass. Logs are gzip from outset with original-stream SHA256/size;
Git SHA plus the small relevant diff identify source, and existing media/module
paths and hashes identify inputs. No Chrome, game, box or worker was allocated.
Box state **NOT_CREATED**, expiry/stop receipt not applicable. No original shot
or hit claim follows. Full27/parity/audio/FPS and original-game firing remain
open; any fresh original qualification is a separately assigned next task.
