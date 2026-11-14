# LBreakout2 brick-progress attempt: controller closes before gameplay

The single authorized fresh run did **not** reach gameplay. It reached the
original main menu and visibly highlighted **Local Game** after one Down.
Start Original Set, brick destruction, score change, level advancement and
native Quit are all **unproved**. No darkening is called destruction, and no
historical score or gameplay capture is promoted as a result of this run.
Evidence is `scratch/runs/20261114-lbreakout-brick-progress/result.json`.

Read-only preparation covered the two reviewed November 14 notes, embedded
original control/Quick Help text, the original brick atlas and first level.
The help documents P pause, arrow movement, fire and default random serve
angles. The first board has 154 occupied cells, including fourteen `b` tiles
in its accessible bottom row. Prior reviewed images show gaps in that row
with score progression, making it a candidate target; its precise durability
mapping was not independently established. Native pause, paddle and serve
inputs were never attempted in this run.

The concrete blocker is the published controller's post-ACK persistence path.
The first 120 ms Down had a unique nonce, permanent production owner, direct
PID/socket identity, a personally reviewed full scene aged 6.225 seconds,
complete operation window and independent UP process armed before DOWN.
The production receipt was CONSUMED. Its recorded ACK returned **1.016 ms**
after consumption, so the assertion text **“ACK arrived too late for complete
pulse”** does not describe the recorded transport timing.

Before checking that assertion, the helper synchronously persists ACK timing,
receipt, DOWN and release-schedule files with fsync. Their timestamps show
the post-ACK evidence path passed the 120 ms pulse end; the release schedule
was written about 594 ms after consumption. Exact individual fsync costs
were not instrumented. The independent release request fired around 670 ms
and its ACK arrived at **709.220 ms**, below the two-second cap. The release
child was actually waited with exit 0 and separate EOF. Native input logs
contain both Down and Up for focus `0x10001`; their individual native delivery
times are not separately timestamped. The subsequent read-only full scene
shows Local Game highlighted, and batch 74337 advanced beyond review batch
23389. Guard status was CANCELLED with reason `independent release`.

The helper's sticky closure was respected: no replay, rebind, replacement
controller, second original or further input followed. Consequently the
requested native Quit route could not be attempted. Existing helper files
were owned by the active Forsaken worker, so this worker made no production
source change. `blocker-timing.json` preserves the timing evidence. The next
helper work should cover a timely ACK followed by slow durable persistence,
while retaining the permanent guard, independent release cap and fail-closed
semantics. This is not evidence of an SDL/gameplay common cause; gameplay
effects of the published SDL arrival repair remain unassessed here.

After the required SuperTux/Forsaken/LM8 terminal receipts, this worker passed
the media verifier, all **29** published controller regressions, four
production guard/owner/step/SDL test files, four run-local durable-wait controls
(normal, TERM, invoker loss and late inherited EOF), and a fresh full build
under both heavy and build locks. The registered `lbreakout2_251` used the
unchanged 800×600 CLI, real ticks, cooperative threads and 1000-block slices.
The immutable limits were 900 seconds plus an independently prearmed
920-second watchdog. Runtime PID was **3750398**, start token **272538917**,
owning the direct production listener on **8529**. No relay, original test
delay, clock/physics/config/media/state write, tracking or autoplay was used.

The supervisor's cancellation request caused **host SIGTERM orderly shutdown**
at runtime statistics **112.127 seconds**, with no guest Exit event. This is
**neither native Quit nor timeout**. Native, watchdog, supervisor, outer-child,
additional outer and short launcher child were actually waited with status 0
and separate stdout/stderr EOF. The external tool returned 0 with combined
output; its separate EOF status remains unknown. The watchdog did not fire,
the heavy lock was released, all six recorded runtime/release PIDs are absent,
and port 8529 is closed. No deadline was extended.

Tested Git source was `596d9af868c1ac3acebcbfcd867cde2904a5eb72`, with relevant
dirty/new Git patches retained. Module SHA256 was
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
Launch and immediate postflight matched all **1672** source pins, **222**
client/manifest/CRT pins and the module. The later postflight explicitly
records two helper changes made by their owner after this worker's 17:45:26
release; both tested older helpers recover exactly from the pinned Git commit.
Only two selected, personally reviewed full PNGs remain, with CRC/inflate/SHA
verification. Git plus patches is the source archive; no source/media/module
copy or bundle was retained.

Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **not
applicable**. No box, worker, network fetch or deployment was created. This
worker stops with the concrete controller blocker and missing native Quit
recorded; full27 and the SuperTux second-row/pit blocker remain unproved.
