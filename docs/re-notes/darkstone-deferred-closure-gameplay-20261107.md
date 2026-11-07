# Darkstone: original loot pickup and native save/reload, 2026-11-07

**Verified:** the unchanged registered original demo reached Ardyl, defeated a
skeleton, and picked up **32 gold**. Personally reviewed inventory captures show
**Gold 1500 → 1532**, **Victories 0+0 → 1+0**, and survival at **LIFE 22/35**.
The original native save menu created a named save; loading that slot returned
to Ardyl with **Gold 1532**, **Victories 1+0**, and **LIFE 16/35** in the reviewed
inventory. Combat continued around the save/load sequence; exact LIFE restoration
is not claimed. This advances beyond the [November 4 skeleton victory](darkstone-webgl-ardyl-combat-20261104.md).

Evidence is in ignored `scratch/runs/20261107-darkstone-deferred-closure-gameplay/`
(R). Darkstone remains an investigation without an unrelated candidate-corpus
attachment. No emulator mismatch was demonstrated and no production code changed.

## Staging repair and focused checks

The [predecessor](darkstone-native-loot-resume-20261107.md) omitted its deferred
`worker-observe.js`. The successor's manifest preparation now includes owned
`.js`, `.cjs`, and `.py` helpers explicitly. Its **502 staged pins** include the
selected observer, all **149 `lib/*.js`** files, worker entry points and deferred
`importScripts` resources, original media, and the inherited helper closure.
R/deferred-resource-audit.json distinguishes static reads from files generated
by this run, such as reviews, ACKs and Chrome's endpoint file.

Before allocation, R/test-deferred.cjs executed the **exact event function
extracted from the selected browser driver**, restricting its observer read to
the staged manifest and verifying size and SHA-256. The missing-file control
rejected with ENOENT before worker resume; the positive control executed the
pinned observer and reached `Runtime.runIfWaitingForDebugger` in order.
R/deferred-closure-tests.json retains both outcomes. A further physical
absent/present-file check, R/real-file-closure-tests.json, also passed; it was
performed during evidence closure, not represented as a preallocation check.

The focused local actual-Chromium fixture also attached the production guest
and legacy WebGL renderer through the selected observer path. Its captured
observer context records a WebGL context, and its quit received an exact ACK.
The browser exited normally and its PIDs, ports, profile, writer and input
cleared. This is generated-fixture attach evidence, not original gameplay.

The browser, input, transport, request and observer helpers are byte-identical
to the passing predecessor. R/inherited-controls-verification.json verifies
the retained release, identity, negative-ACK and reviewed click/H/quit controls;
broad qualification was not repeated. R/import-closure.json records the import
trace. Original inputs and the runtime remained unchanged throughout staging.

## Personally reviewed original route

Every ordinary input followed a fresh personally inspected capture. Native
button/key release was independently scheduled before awaiting DOWN; all
commands received exact matching ACKs. No UNKNOWN original command occurred,
no command was replayed, and no admission guard was relaxed.

The original menus created warrior **A** and placed him in the party. Town's
inventory established Gold 1500, LIFE 35/35, Victories 0+0, one apple, and the
starting sword, shield and helmet. The upper-left path led to Ardyl; ground
clicks crossed the bridge and clearing toward the skeletons beside the trees.
Bounded native holds engaged combat; F visibly selected Manual mode.

The ground gold label and pile were reviewed before pickup. Its stylized first
digit was initially misread as 5 during live commentary; the numeric inventory
consequence is **+32**, not +52. A left click on a belt potion also lifted the
starter object rather than establishing potion use; subsequent captures show
a bottle on the ground. Potion consumption is not claimed. Several inventory
requests did not visibly open the panel; the successful post-pickup capture,
R/review/pack-after-gold.png, establishes Gold 1532 and the victory consequence.

Native Q was followed by Escape → Save a Game → New Save. The load screen
personally showed the quick-save and highlighted named slot, with an Ardyl
thumbnail. Selecting OK produced Ardyl loading art and then the world.
R/review/restored-inventory.png confirms the earned gold and victory survived
the native load. This is an in-process native load, not a browser restart or
cross-session persistence claim.

Read-only VFS observation recovered the original game's native files without
editing them: `characters.lpl` (1,342,076 bytes), quick-save
`gameffffffff_ffffffff.sav` and named `game641d_6aef1a57.sav` (3,204,264 bytes
each). R/recovered/original/native-vfs-saves.json records their SHA-256 identities
and uniquely retained bytes. No guest code, configuration, memory, save bytes
or clock was modified by the harness.

## Runtime and closure

One fresh UUID-idempotent 40-minute box, **bx_bq7atbkq**, was allocated at
12:17:40 UTC with original expiry **2026-11-07T12:57:40.902Z**. Its immutable
browser deadline was **12:42:40.733Z**, fixed before allocation. All uploads
used the supported serial API route; no SSH/SCP, old-box resume, second box or
second original browser was used. Sampled `/home` free space stayed above 2 GB;
no RAM gate was used.

Original Chrome **151.0.7922.108** ran from **12:18:47.680Z** to normal exit
**12:35:53.443Z**, code 0 and no signal. The owning renderer was
`lib/d3d-render-worker.js`, endpoint 1, `{api:"legacy",backend:"webgl"}`.
Instantiated guest and renderer module bytes were retrieved as SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`
(2,182,493 bytes). System GPU metadata identifies ANGLE SwiftShader; the
worker's Intel string does not establish physical GPU execution.

R/final-gameplay-audit.json verifies **41 exact ACKs**, **22 balanced native
mouse pairs**, **12 balanced native key pairs**, trusted events, empty final
input queue, mouse mask zero and no original worker errors or UNKNOWNs.
An initial terminal cleanup assertion ran before driver retirement completed;
later read-only inspection established both owned PIDs absent and both ports
closed, with profile, writer and held input clear. No input was retried.

All **458 unique remote artifacts / 31,609,116 bytes**, including captures,
native saves and instantiated module bytes, were retrieved and SHA-verified
**before** the explicitly delegated normal nonforced stop. All 502 remote pins
still matched. The stop completed with `forced:false`; R/boat-archived-state.json
verifies **archived**, stopped **2026-11-07T12:38:03.222Z**, and expiry cleared.
There is no running box custody to hand back. Local qualification and watcher
cleanup are recorded in R/cleanup-local.json.

R/checkout-head.txt records source checkout
`d9091912da1b342cca4296621cc9af0b8e9a64cc`; the inherited runtime pin set also
records its source commit. R/relevant-tracked.patch, the relevant untracked
source patch, R/owned-harness.patch and R/source-recovery.json preserve source
recovery. Git is the source archive; no source/media archive was created.
R/evidence-inventory.json hashes the retained artifacts and R/result.json is
written last after publication. No FPS, audio, parity or full-game claim is made.

Next: any further gameplay requires a separately assigned fresh run; this task
ends with the reviewed loot and native save/load consequence above.
