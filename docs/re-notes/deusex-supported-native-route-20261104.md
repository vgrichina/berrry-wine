# Deus Ex: measured Left preparation overshoots bearing; takeoff withheld

One original count14 Load restores exact, inspected Small0 gameplay. Five short,
released Left pulses remain natively settled and supported, but their measured
net displacement overshoots the planned Left component. The actual position
fails the unchanged route guard before Down or Up. **Preparation is incomplete;
no running takeoff or jump occurs, and Z96 remains unreached.** Gameplay stops
on that first safety failure, without correction, turn, reload, retry or save.

Evidence and run-only helpers: `scratch/runs/20261104-deusex-supported-native-route/`.
Inputs read include the supported-bearing plan published at `5c0acc4e2`, atomic
preparation/takeoff and readiness/timing notes, supported short-runup, native
speed, aligned jump, predecessor task/helpers, original binding references and
read-only geometry checker. No production source or game check changed.

## Exact runtime and prerequisite checks

Fresh assigned bx_dzkgnet6 was verified and board-ACKed before use: healthy,
hydrated, RUNNING/APIidle, expiry **2026-11-04T04:42:08.886Z**. Lifecycle remains
with the coordinator. No allocation, resume, stop, delete, other credential,
old-box retry, local heavy execution or second browser occurred.

The runtime was staged once directly onto that lease from exact Git base
`a504fa248caaecbbb042b65e9ae5384a340ade26` plus the recorded nine-file
historical-source.patch, SHA256
`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
A temporary Git index applies the patch without a checkout copy or source archive;
all source blobs and remaining media/config/checkpoint inputs match all453 pins.
The canonical module is1,898,260 bytes, SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`.
Companion module **ABSENT**. No substitution, build or rebuild. Media were
transferred once into the leased runtime, never into evidence; existing paths
and full hashes remain in provision-manifest.json. Git HEAD and relevant binary
diff are recorded; run helpers and this owned note are retained as patches.

Immutable input directory remains
`scratch/runs/20261104-deusex-small0-reload-onward/recovered/native-save-export/`:

| Input | SHA256 |
| --- | --- |
| 0.bin / saveinfo | `4cfa57f28a079c1b0bcc0f4a002b24f845005122adf3d5ed39f04cd2fc2ba2a6` |
| 1.bin / training | `ab8b1fa27157a6dc6f6e9a000acab0082f02be3c7478a7f982c27eab2759a730` |

The manifest and both bytes are referenced unchanged. Original config hashes and
bindings pass the geometry suite: Left=strafeleft, Down=backward; no turn needed.

Before Chrome: geometry/test_geometry.py passes all6 groups, including4,836
independent grid cases, count14 decoding and original controls. Six atomic queue
and sequencing tests pass. All14 timing/readiness/support cases pass locally and
remotely; helper syntax checks pass. The actual capture function passes mocked
actor/screenshot/state ordering and propagated screenshot-failure checks. Actual
remote download of unique export-mock bytes passes full size/SHA and rejects
wrong-size and wrong-SHA pins. The native export mock verifies two exact outputs;
those bytes stay separately marked as mock. All453 actual remote pins match,
Chrome and Puppeteer resolve, and no browser precedes these checks.

Run-only prerequisite failures are preserved in prerequisite-failures.json:
boat-dev is absent (installed boat used); a loose historical font-map snapshot
is absent (exact bytes read from an existing retained archive); and the fresh
box lacks /home/user/wine-assembly (dependency lookup corrected to the staged
runtime). All repairs occur before Chrome; no assertions or guest checks weaken.

The inherited145ms runup, Physics/Base and pre-Space margin8 guards remain.
Unused run-only takeoff preparation adds an ACKed driver action, target-side
feet>96 boundary check and40ms Space request, with local/remote guard fixtures.
It is never invoked: no runtime validation of flight timing, vertical clearance,
Space hold, landing or those supplemental helper paths is claimed.

## Actual preparation and first guard failure

Inspected02-count14-dialog.png shows count14/time01:17:23. One ordinary Enter
loads it. Inspected04-restored.png shows the crate room and gameplay HUD, without
LOADING. Native reads confirm `(7026.704590,-1707.887939,109.602844)`, yaw250640,
height43, Physics1, BaseCrateUnbreakableSmall0, velocity0, healthy standing running
state and original three-worker identity. The driver records visual approval.

The plan calls for Left8.627353 world units, then Down24.401001 toward
`(7008,-1690)`, using measurements rather than duration replay. Each pulse below
requires settled Physics1/BaseSmall0 and positive radial margin before and after.

| Requested Left ms | Trusted hold ms | Operation ms | Settled displacement | Margin after |
| ---: | ---: | ---: | ---: | ---: |
| 20 | 20 | 23 | 0 | 0.342617 |
| 30 | 34 | 43 | 6.273930 | 5.180960 |
| 10 | 10 | 12 | 0 | 5.180960 |
| 15 | 16 | 17 | 0 | 5.180960 |
| 20 | 21 | 22 | 5.909363 | 9.296152 |

After the first nonzero pulse, only2.353423 Left units remained. The next10ms
and15ms requested pulses produced no movement. The final20ms request measured
21ms trusted hold but moved5.909363 units after release and settling. Thus total
Left12.183294 overshoots the ideal component by3.555941. This is a measured
control-resolution failure of the preparation, despite every hold and native
support check passing. It is not evidence of a duration-to-displacement law or
proof that a shorter pulse must work. No earlier ten-adjustment replay occurred.

Actual final native state is `(7015.830566,-1713.382324,109.602844)`, yaw250640,
Physics1/BaseSmall0, velocity0, margin9.296152. geometry.py with exact measured
--x/--y/--yaw returns exit1: tall-front projection7045.449013 is below required
7047; target-near projection7063.639159 is within7088. Native backward motion at
the same yaw preserves this projected line, so Down cannot repair that rejection.
The first safety failure ends gameplay immediately. Only capture/recovery and
quit follow. There is no Down preparation, Up, Space, corrective Right, turn,
console, cheat, guest-memory write, new Load, native save/export or second launch.
The145ms and pre-Space margin8 guards are never reached.

The final05-guard-stop.png is blank teal, unlike the inspected restored gameplay
capture. No pageerror log is produced and reflected native state remains Small0;
this run does not establish the cause or claim a visually verified final scene.
That limitation is retained rather than replacing the capture or rerunning.

## Verification and handback

Ten sequential requests receive matching successful terminal ACKs, maximum6
steps. All20 trusted events balance; five preparation holds are10–34ms with
separate12–43ms operation times. All4,864 basic and4,629 reflected samples remain
Physics1; reflected Bases remain Small0. Original count14 bytes and all453 pins
match after execution. No native target contact, full-footprint containment,
landing, FPS, guest exit or game completion claim follows from geometry.

All57 preclose unique files and the actual canonical module are recovered with
full SHA before close. Final62 files pass full size/SHA verification. Browser
segment is166.432seconds. Cleanup completes **03:49:12.671Z**, with driver8663
and Chrome8671 absent, port8123 closed and held keys empty, before04:32Z.
Box bx_dzkgnet6 remains RUNNING/APIidle, healthy and hydrated, expiry04:42:08.886Z,
handed back to the coordinator for lifecycle ownership. No helper remains open.

Focused evidence checker passes. Only this note is committed; run-only helpers,
logs, captures and recovered module remain under the ignored run directory.
No production change requires a full build. Next dependency is a separately
authorized preparation that resolves short-pulse displacement uncertainty while
remaining inside the feasible bearing region. This task starts no successor.
