# Original Kkrieger: accepted movement input and update progress

The fresh original-game run `20261015-kkrieger-long-input` reaches a first-person
level after one ordinary 15-second Enter hold, then accepts ordinary W in the
original guest input field, advances its update counter twice, and clears both
host and guest held state after release. This qualifies key delivery and the
identified update-routine progress. It does not measure logical FPS or establish
completed simulation, directional displacement, combat, relative mouse, or audio.

## Exact source and delivery

Controller 93374 on `bx_9ef2wdsw` ran source
`551caaf97f253928eac65a04cc6e7b91dd260f3e` in a fresh clean checkout. All 6521
physical tracked-file SHA256/size records independently match Git blobs; postflight
records match preflight exactly. The physically contained 1803537-byte module is
`937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb`, copied
from clean donor `750bc13fd07a59dfed1e49b19533a561ffea1208` only after exact
physical build/compiler comparison. An expanded 290-file production/lib/host/
compiler comparison also has no differences. The full intercommit delta is
retained; changes concern documentation, tests, and capture/gameplay tools.

The original three files came from `/home/user/wa-kkrieger-verified`, together
with the parent `.wine-assembly-browser.json`, SHA256
`d177f30379d59b6723cba5818bfc37104ef670e9c9549704d1510fd1fd9dba0b`.
Fresh actual HTTP status/body hashes for module, manifest and all three files
passed before launch. The page's own canonical-module digest and loaded-response
hash passed, with no WAT fallback. The game has 2147483648 bytes of fixed memory.
Viewport remains 1100×800 throughout; there was no Puppeteer observer attachment.

## Bounded actions and observations

The controller started 12:51:05.821Z; its absolute capture budget began
12:51:05.908Z with deadline 13:11:05.908Z. Configuration was
`WA_CAPTURE_MS=1200000 WA_START_HOLD_MS=15000 WA_INPUT_PROGRESS=1`.
The initial CLI combination `--detach --timeout` was rejected before execution;
the corrected launch uses the controller's internal hard deadline. There was
exactly one guest execution.

Scene 48 visibly shows Start new game / credits / exit. The review gate was
written 12:59:34.316Z, followed by ordinary Enter held
12:59:36.848–12:59:51.865Z. Scene 62 visibly shows a first-person level with
weapon, HUD, lit pillars and floor. Its review gate was written 13:02:27.581Z;
the controller consumed it 13:02:35.539Z with over eight minutes remaining,
well above the required 160-second collection plus 30-second shutdown reserve.

All four original code-span SHA256 pins passed. The reader kept object 25369268,
phase zero, matching focus/main HWND 65537, and pointer lock false. After the
20-second idle control, W was held 13:02:56.137–13:03:24.452Z (28.315 seconds).
The guest last-event field became 87 and forward became its positive forward
speed `0.002499997615814209`, while physical W was true. Subsequent separate
samples observed update-counter transitions 390→400→410. The collection reports
`acceptedProgress: true`, two changes. This counter is incremented before the
phase branch; it cannot establish completed movement or frames per second.

The first accepted W sample was approximately 8.02 seconds after the first
physical-held sample. Idle counter values were 380 then 390; held samples were
390, 400 and 410. The four-code-pin check and original observations are retained
in the evidence; there are 10 idle, 15 held and 5 release samples.

After host keyup, the original guest retained its held field briefly. The fifth
release sample showed last event `0x80000057`, zero forward, and physical W
false. `releaseObserved: true` is independent of the accepted-hold result.
The script intentionally keeps `gameplayVerified: false`.

Personally reviewed idle-before/idle-after and W-before/held/released images show
small pillar/lamp/floor shifts. The idle control already changes these landmarks;
the held-W shift does not establish distinct directional travel relative to that
baseline. Camera settling or bob is possible, not established. Directional
displacement remains unqualified; this is not evidence of a key-delivery failure.

The controller exited 0 at 13:03:33.187Z, over seven minutes before its deadline.
Postflight at 13:03:50.496Z found unchanged source/module, clean tracked files,
and no Node/Chrome/compiler/runtime survivors. Fixture pins also passed in the
controller's finally block. The runtime slot was released immediately after
postflight. No guest writes, forced transition, forced pointer lock, additional
input sequence, deadline extension, runtime patch, or deployment occurred.

## Evidence and recovery

Self-contained evidence is under
`scratch/runs/20261015-kkrieger-long-input/`. Remote recovery roots are
`/home/user/wa-kkrieger-long-input`, `/home/user/kkrieger-long-input-run`, and
`/home/user/kkrieger-long-receipts`; the archive is
`/home/user/kkrieger-long-final.tar.gz`. Recipes in local `receipts/` retain
preparation, source audit, visual confirmations, download, postflight, and
publication steps. Preserve binary evidence independently of Git.

All 16 focused canonical-delivery and progress tests pass with the retained
original unpacked image supplied, with no skips. An initial local test invocation
lacked the static-server file in the sparse checkout; adding that tracked fixture
resolved the setup error. No production code changed in this task.

All 166 remote capture artifacts (24611819 bytes) were copied locally and
individually SHA256/size verified. The 24356168-byte archive has SHA256
`ca9be1806fe70951c90d5c53ec581e906909c51f20e1ec8d31ef0feb19bbd53e`.
A transient Boat `state: updating` rejected the first archive chunk at offset
zero; after the box returned healthy/idle the full verified copy succeeded.
No resume, recovery, restart, or second guest run was performed. The dashboard
result was published last. Its evidence references are all valid; the global
checker still reports the unrelated historical Zuma external path.

Root independently reviewed all five control/held/release images and agrees
that travel is unqualified. The next source-only question is the original
movement consumer and player-position state: distinguish accepted input with
small simulation steps, collision, camera motion, or an unconsumed movement
field. A future bounded read-only probe needs original-code pins for any new
state; this task does not introduce or run that probe.
