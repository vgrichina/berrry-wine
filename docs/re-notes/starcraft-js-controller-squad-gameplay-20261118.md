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

The first original box gesture consumed its DOWN and held motion, but generic
cleanup sent mouse UP at the DOWN point; the settled scene had no selection.
Ctrl-click selected one Marine (40/40 HP, zero kills), not a squad. This is a
transport-versus-gameplay distinction, not combat success.

The follow-up controller correction sends only a guarded mouse UP at the
already reviewed endpoint for a two-edge selection, before its independently
prearmed all-UP cleanup. It adds no DOWN, target, gesture, hold time or freshness
allowance. The endpoint UP has its own nonce and actual native consumption
receipt; the final independent release still establishes physical UP. Its
nonce is included in subsequent lease validation. Authored native controls
compare the actual UP coordinate with the actual second edge coordinate.

An initial test additionally required Ctrl in the native mouse-UP wParam. It
failed: the current renderer emits zero modifier flags on mouse UP, despite
Ctrl being present on DOWN. That existing runtime limitation remains explicit;
this controller does not change the foreign-owned renderer or claim that
transport receipts alone establish same-type selection. The corrected box
route is the available path to personally inspect multiple-unit selection.

The ONE authorized original used registered `starcraft_shareware`, unchanged
`ophelia terran1` arguments/media and retained module SHA256
`0414c10712d244ffc215fa30165dde4785f71d7b0a95425b91678b74744ef70d`.
Controller commits `8212da1f6` and `9b7b8592c` were each tested, locked-built and
immediately strict-pulled/pushed before their respective original actions.

The corrected box produced three selected Marine HUD icons and three green
selection circles in `original/squadverified.png`. Capture-to-dispatch was
2.899 seconds (`boxendpoint-workflow.json`). A separate Attack command was
consumed and `original/armed.png` visibly showed Select Target. No enemy was
visible, so the pending command was cancelled through its native Cancel icon;
no enemy target or squad combat result is claimed. A preceding single Marine
already showed 34/40 HP and Kills 1 in `original/boxcorrect.png`; these ambient
changes predate our Attack and cannot count as commanded enemy consequence.

After a subsequent Move command and separate visible road target, DOWN was
consumed and the independent release returned UP ACK. The subsequent snapshot
failed the conjunction `physicalUp && capture === '0x0'` at 1794963282.828.
The failed snapshot itself was not retained, so which conjunct failed is
unknown. `terminal-input-failure.json` closed the scope permanently; there
were **no later endpoint requests, replay or second original**. Only a local
supervisor cancellation request followed. Native exit 0 is an actual host-stop
wait, **not ordinary Quit or combat success**. Independent watchdog exited for
actual-native-wait; containment reported no leak. The sampled original free
/home minimum was 1,755,918,336 bytes (50 ms sampling; instantaneous minimum
unknown), above the 1.5 GB floor.

Outcome: the JavaScript controller and visible squad selection/Attack arming
are established. Separate enemy targeting, enemy HP/destruction, persistent
enemy consequence, objective progress, and ordinary ExitProgram remain open.
The current original is closed and cannot be resumed; another original would
require fresh owner authorization. No box was created (ID/expiry null; stop
not applicable). Final selected whole screenshots, source/diff/module/media
pins, release/wait receipts and recovery instructions are in the run result.
