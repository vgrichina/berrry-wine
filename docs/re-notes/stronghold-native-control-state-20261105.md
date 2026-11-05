# Stronghold passive native control state, 2026-11-05

Implemented passive control samples and native boundary intervals in the
existing composed owning-Worker observer. Readiness remains false and host
presentation remains unknown. Retained original gameplay was not retried.
Evidence lives in `scratch/runs/20261105-stronghold-native-control-state/`;
`final-inputs.json` records exact Git SHA and existing input hashes.

Shared changes and executable tests started only after ReturnFire0305
`691020294`, MDK0320 `68423e88b`, and D3D70330 `f1d62b136` FINAL runtime AND
file RELEASE ALLBUILDSFINISHED. `release-gate.json` independently verifies
normal prior browser exit, exact process identities absent, ports refused,
profiles absent, no heavy processes, both locks free and sufficient disk.
Predecessor0325 was not reinserted into the queue.

The task follows the missing evidence in
[the published fresh setup investigation](stronghold-fresh-setup-readiness-20261105.md),
commit `1bcfd0de488d7ecbf80dd4eb73904ec1f8c46897`. No readiness grant, guard
relaxation, screenshot whitelist, production input/guest write, clock/scheduler
change or original/game/browser retry was performed. Fixture caller/data
writes below are explicit synthetic inputs.

The actual original executable is referenced in place:
`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`,
SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
New samples cannot backfill the retained command-14 history: its pending
preset, feedback and selected-control values remain unknown. Static default
data and fixture state are not historical values. Source analysis establishes
these separate contracts:

- Constructor `0x4259d0` passes descriptor `0x5ba528` to original widget
  initializer `0x4e9280`, using manager `0x692f48`. Initializer `0x4e92bf`
  writes each widget's owner at `+0x4c` and inherits child callback pointers
  from the parent when unset. Numbered children are `0x5ba6b8`, `0x5ba708`,
  `0x5ba758`, with arguments 1, 2, 3; parent callbacks are activation
  `0x42d880` and hover `0x42d850`.
- Widget selection writes the current child's address to its manager `+0x38`
  at `0x4e97b4`. Selection, callback argument and hover feedback are different
  identities. A pointer/argument match alone cannot certify callback delivery.
- Generic widget traversal tests type flag `0x80000000` before dispatch;
  `0x00800000` excludes ordinary draw mode 1 but permits draw mode 3. Original
  draw `0x4e9e30` skips a nonzero 16-bit `+0x36`. Original input `0x4e9620`
  skips nonzero `+0x36` or `+0x38`. These samples do not identify visible pixels.
- Original draw combines signed 16-bit hover `+0x32` and press `+0x34` into
  feedback `[0x995674]`; nonzero `[0xd138b0]` clears feedback. The two outgoing
  suppression branch blocks, not an arbitrary PC in the middle of a decoded
  block, witness that choice. Mode `[0x1681318]`, pending `[0x69165c]` and
  description `[0x69332c]` remain separate state.
- Hover entry/return changes description only. Activation entry/return and
  choice-1 queue evidence are separate from updater edge decision and
  application entry/return. Application is admitted as evidence only within
  an observed updater, accepted native edge, recheck and exact caller/stack
  interval. Pending clear is a subsequent event.
- Native mouse `0x1bd2670` compares held `+0x40` and prior held `+0x4c`, clears
  edge `+0x34`, then sets edge only on a newly held transition. This is observed
  only with the original object/constants and executed branch history.

The shared factory contributes events/state/pending intervals to the
existing owning observer. It has no separate timer, guest export mutation,
hook or cap. Existing first-fault, 50M boundaries, 360s, 2048 records, 1MB,
ACK and host rest requirements stay intact. The old standalone preset helper
also exposes feedback and suppression in its state samples. No historical
runtime pin is amended: a changed observer remains a changed dependency for
any historical original-run closure.

The executed fixtures use original PE fragments through the actual
serialized production owning attachment and shipped OS Worker on both shipped
module variants. Caller/data/sprite metadata are explicitly synthetic. The
application positive uses out-of-range argument 4 to exercise native entry,
return and pending clear without inventing successful preset configuration.
Choice 1 deliberately remains pending at its original UI helper; its queue is
not an application or completed frame. Independent unobserved and trace-only
arms compare all memory pages, CPU registers and identical slice commands.
These tests are synthetic fixture evidence, never original gameplay.

Validation passed on both shipped modules, SHA-256
`3859c274df0233659eb10fe4d2784fff7d1553242b4ae2b3bf653e5d2ebdd95b`
and `9f042b70d7e43d3947415e1de01e7a540b3c7f7fa6c7fbefabdbea17e9633e95`:

- `node test/test-stronghold-owning-callback-observer.js --controls-only`:
  actual serialized production attachment and shipped OS Worker, 20 memory/CPU
  checkpoints and 696 identical slice commands per arm/module. Unobserved,
  trace-only and observed arms match every memory page, registers and commands.
  Original traversal and input fragments independently check hidden/type-mode
  flags and hidden/disabled input rejection. Feedback covers suppression on/off,
  hover-only, press-only and signed hover/press OR. Mode rejection, pending
  rejection, selected/foreign identity, hover relation, edge rejection/acceptance,
  application return/clear, mouse new/held/released transitions and partial queue
  are exercised. A labeled synthetic host ACK checks pending control report
  composition only; it is not a real guest/browser ACK or completed frame.
- Thirteen additional control negatives per module: application without updater,
  application return without history, edge without updater, feedback without
  widget, wrong widget owner, mouse object, thread, changed saved caller, wrong
  PC registers, changed feedback instruction bytes, record overflow, byte
  overflow and foreign epoch. First fault and rows stay fixed after subsequent
  annotation/finish/check; guest state is unchanged after rejected slices.
- `node test/test-stronghold-native-preset-observer.js`: both-module standalone
  original-fragment/Worker parity and existing negatives pass, including added
  feedback/suppression/pending samples. Its existing ordinary-untraced RPC page
  exception remains explicit in `native-preset.log`; trace-only parity is full.
- `node test/test-stronghold-owning-callback-observer.js`: both-module original
  draw arithmetic/parity, callback/branch/scene/setup regressions, import
  forwarding/exception behavior and host pipeline identity/failure/bounds,
  including 24 structural join negatives, pass. Existing ACK, full-rest,
  caps and first-failure guards remain intact.
- Offline `stronghold-local-runtime.prepare` composition compiles the actual
  driver/route/retained closure. Historical `acceptedRuntimePins` rejects the
  changed observer. The historical positive runtime suite is not requalified,
  and `stronghold-local-runtime.cjs` is byte unchanged.
- `flock /tmp/wine-build.lock bash tools/build.sh`: pass; both module hashes
  remain those released by D3D70330. `git diff --check`: pass.

Results and logs: `controls-final.json`, `controls-final.log`,
`native-preset.log`, `owning-regression.log`, `build.log`, `final-inputs.json`.
All tests are offline; no Chrome, original retry or box was used. Exact Git SHA,
relevant binary diff and new-file patches preserve source recovery. Existing
media/modules stay at their recorded paths with hashes, without copies,
archives or source snapshots.

Remaining prerequisite: a real same-owner/epoch return of an unsuppressed
fade-zero draw, identified ordinary host publication, fresh reviewed pixels
and warranted control evidence within the unchanged caps. The retained fourth
draw remains pending. New fixture samples cannot repair that retained history.
Hover, activation, application, draw completion and host presentation remain
distinct; readiness is false and host relation unknown.

Box ID/state/expiry: N/A. Shutdown remains coordinator-owned.
