# Stronghold ordinary post-preset readiness: supported boundary, 2026-11-04

An input-free settling repair is **not proved**. The original executable has a
pending-preset application path gated by a native left-press edge. The recovered
host state does not establish whether that path was entered, remained pending,
or completed. Keep the first unexpected-result rejection. No driver, recognizer,
patch, template, tolerance, accepted scene, or Start behavior changed.

This is the offline successor to
[the c13849a61 failed attempt](stronghold-setup-preset-native-world-20261104.md),
not a continuation of its closed session. Evidence is in
`scratch/runs/20261104-stronghold-post-preset-readiness/`; original artifacts remain
at their original paths. No browser, emulator/game, remote API, runtime, box,
public deployment, or subworker was used.

## What the recovered capture establishes

The original seal verifies `recovered/closed/route-native-boundary-19.png` and its
state JSON under `20261104-stronghold-setup-preset-native-world`. PNG SHA-256 is
`9fcc66eea4ba565a7fce8bc891e811219687e1c2f5f9419f806361aee9c404fe`.
Personal inspection shows Zephyr description, Normal Game, 2000/2000 gold and
empty opponents. The unchanged native classifier returns `unknown`: the Zephyr
description patch matches `9aad37f9…4547386d`, while settings/gold is
`4e42eb0d…2a7b5be`, not accepted `aa3ac86e…312cd`. The retained ready image
`20261104-stronghold-browser-village/review/zephyr-ready.png`, SHA-256
`e0dda59a268679e21f6bc31f15e80ea2420c51544267d4c789edd38fbd07ef93`, remains a
positive `scenario` control (Human Advantage, 8000/2000, Rat).

Boundary19 passes the existing host readiness check: frozen 16ms, one host,
owning Worker, explicit drained input and zero button mask. Navigation used
12416 steps, route 1856. Command19 was the first failure; the original deadline
still had 123.043 seconds left. None of these host observations proves native
preset application. There is no later sample from that failed session to use.

## Original native transition

The existing original PE is referenced in place, never copied:
`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`
(2699264 bytes, SHA-256
`9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`).
The focused test derives VA mapping from PE sections and pins the decisive
instructions; bounded disassembly is retained in this run. These are static
control-flow findings, not a trace of command19.

- Scene20 constructor `0x4259d0` installs descriptor `0x5ba528`. Its numbered
  preset parent `0x5ba668` references activation `0x42d880` and a distinct hover
  callback `0x42d850`. First child `0x5ba6b8` carries index 1. This avoids confusing
  the separate generic button parent at `0x5ba7a8` with the numbered preset.
- Hover callback, conditional on `[0x1681318]==99` and `[0x995674]!=0`, writes its
  argument to description index `[0x69332c]` at `0x42d866`. Setup drawing reads
  that index after `0x429b1b` calls updater `0x42db40`. Thus description alone
  cannot establish activation or applied settings.
- Activation `0x42d880` also requires `[0x1681318]==99` and no pending selection
  `[0x69165c]==0`. Choice 1 branches to `0x42d9de`, calls reset `0x42d7d0`, then
  writes pending selection 1 at `0x42da1c` and saved choice 1 at `0x42da26`.
  It clears `[0x1bd26a4]` at `0x42da71` with ESI zero.
- Updater `0x42db40` checks pending selection. At `0x42db53` it compares native
  `[0x1bd26a4]` to zero and branches past application when zero. With a nonzero
  edge it calls `0x49e720`, rechecks pending selection, calls application handler
  `0x42e490` at `0x42db72`, then clears pending and sets `[0x692404]=1`.
- Main-loop call `0x576a83` passes mouse object `0x1bd2670` to poll `0x468930`.
  Poll compares current held `+0x40` with prior held `+0x4c`, clears `+0x34`,
  and sets it to 1 only for a newly held transition at `0x468b50`.
  `0x1bd2670+0x34 == 0x1bd26a4`: the updater gate is the native press edge.
  Choice-1 application `0x42e577` calls reset, sets configuration fields and calls
  opponent addition `0x4a4780` with argument 1.

This rules out treating the pending path as an unconditional next-frame apply.
It does **not** prove that command19 took that path or that an extra click is
correct. Do not add input, repeat preset activation, or replace the guard based
on this static finding. Other native paths or a render lag remain possible.

## Existing driver and tested boundary

The unchanged run-owned `20261104-stronghold-setup-preset-native-world/route-driver.cjs`
SHA-256 is `bb38b5787c277c94c2913a9ddba72a8663b9fd2fb706a88e320bcb83419633de`.
`route-press-preset` requires the separately reviewed exact preset1 hover,
performs balanced DOWN/UP through explicit per-event drainage, captures, and
immediately rejects anything other than the existing expected `zephyr-ready`.
There is no post-press settling phase. This identifies an implementation
boundary; it does not establish that adding a wait repairs the native result.

Run `node test/test-stronghold-post-preset-readiness.js`. It verifies original
sealed capture/state (adjacent gzip decoded in memory only after matching its
uncompressed seal), exact-ready positive, original PE gates, and executes the
unchanged driver's state machine with an explicitly synthetic IO/base adapter.
The route controls accept exact ready, reject unknown/world/unchanged setup,
preserve terminal first-failure without extra input/steps, reject an expired
live deadline and exhausted aggregate budget, enforce the 4096 maximum and
64-step chunks, and reject foreign input telemetry. The synthetic adapter does
not establish native delivery, execution, or eventual convergence. Existing
navigation 16384, route 4096, arrival 3072, stability 768, per-ACK 64, command
40s and original browser 360s bounds remain unchanged.

## Exact missing causal evidence and next dependency

Before authorizing a driver wait, a separately scoped fresh original attempt
needs a bounded read-only guest trace spanning preset DOWN consumption, the
activation callback, UP consumption and setup update/presentation. At minimum
capture native PC/callback argument plus `[0x1681318]`, `[0x69165c]`,
`[0x690f7c]`, `[0x69332c]`, mouse `+0x34/+0x40/+0x4c`, and entry/return of
`0x42e490` with the associated displayed settings. The current host snapshot
contains none of that causal state. Specifically distinguish:

1. Activation never entered or was rejected by its native gate.
2. Activation queued choice 1 and is waiting on a press edge.
3. Application completed but a later input-free native update/present is pending.

Only case 3 with observed convergence and a demonstrated bound supports the
requested settling phase. Cases 1/2 require diagnosis of native input/order,
not an unconditional delay. Any future observation must fit the same aggregate,
ACK and original deadline caps and reject genuine first failures; it must not
resume this closed failed session or execute Start to test readiness.

Outcome: tested, evidence-grounded supported boundary; readiness gap remains
unrepaired pending that native trace. No driver ownership was claimed. No box
was assigned; box ID/state/expiry are not applicable and lifecycle remains with
the coordinator. Serialized full build and focused test results are retained in
the run. Git is the source archive: exact base SHA and owned new-file binary
patches are retained, without source/media/module archives.
