# Finite JavaScript StarCraft control (2026-11-18)

Evidence: `scratch/runs/20261118-starcraft-js-controller-squad-gameplay/`.

`tools/starcraft-combat-controller.cjs` ports the released combat policy and
Barrage transport to Node, reusing `native-supervisor-common.cjs`. It has no
world interpretation or gameplay loop. Ctrl-click and box selection remain
finite gestures; Attack and the enemy target require separate reviewed scenes.
The immutable bounds remain five seconds for gameplay, thirty for menus, six
for an operation, one for each input confirmation, a prearmed independent
1,750 ms fallback, two seconds for physical release, and a 180-second Quit
reserve. Actual UNKNOWN closes the scope without later endpoint requests.
Transport ACKs cannot assert combat success or attribute ambient kills.

The `submit` CLI accepts a human's complete-scene review and one gesture in one
invocation. Combined mission admission and that gesture share one freshly
verified lease; no intervening HTTP request or human-review step occurs.
The independent child receives pulse deadlines over its pipe before audit
writes. Failed/lost replies still reach independent release. A normal final
owner exit is distinguished from a physical UP acknowledgement.

Self-contained tests cover 45 policy/result/closure checks. Authored native
controls exercise actual Ctrl DOWN, left DOWN with Ctrl modifier, box DOWN and
held-button motion, separate Attack/target policy, physical UP, real postrelease
progress, and a deliberately lost ACK after actual native consumption. That
fault retains independent UP and refuses a later capture locally. Native
containment uses `tools/native-supervise.cjs`; no leaked processes were reported.
The four existing supervisor test groups also pass.

Whole-image manual workflow was measured separately from synthetic test-review
times. Initial verbose submission took 7.645 seconds; a compact command reached
5.211 seconds, then another review arrived in 4.454 seconds but expired after
arm. Those local refusals sent no gameplay input. Removing duplicate admission
lease work and forwarding the whole lossless PNG directly from the capture
command, with a compact run-specific human submission helper, produced:

- Capture start 1794962277.081, PNG completion 1794962277.157.
- Personal review recorded 1794962279.947.
- Consumed dispatch confirmed 1794962280.288: **3.207 seconds** from capture.
- Independent UP acknowledged 1794962280.727: **3.646 seconds** from capture.

These are authored-fixture measurements, not original squad/combat evidence.
No guard or solver was widened. Earlier scope receipts and local failures are
retained separately; matching successful controls are reused.

The new repository gates initially rejected six released prepolicy orphan WIP
files. The coordinator preserved and retired those files. This worker pruned
only 50 obsolete Python paths and four obsolete caller entries from the
shrink-only allowlist; it added none and executed no Python. Subsequent build
failures named foreign async-render callback producers, which remain with
their owner. Original gameplay results and final publication are recorded in
this run's result.json after all artifacts.
