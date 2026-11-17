# SuperTux: Welcome to Antarctica level-exit attempt

Evidence: `scratch/runs/20261114-supertux-level-exit/`.

**Level exit, map unlock, next-level entry and native Quit remain unproved.**
One fresh original reached the opening level, then stopped on a sticky
controller failure before the second movement gesture sent DOWN. The failure
was retained without retry, reclassification, fresh intent or guard bypass.
Orderly supervisor SIGTERM ended the runtime after **248.321 seconds**.
Full27 remains unproved. No production repair or second original followed.

## Actual native observations

Personally reviewed Start Game, Slot 1 Free, the story and ordinary Escape
to the map. This run's map and level baseline was **50 score, 2 coins, four
lives**, distinct from the predecessor's 75/3 baseline. `welcome-node.png`
shows Welcome to Antarctica selected. `level-entry.png` records timer 299
and the initial spawn falling above the ground; this is not commanded-jump
evidence.

From that fresh scene, Right + Left Control for 850 ms moved Tux along the
flat floor toward the opening overhead block row. `opening-run.png` shows
him grounded, still **50 / 2 / four lives**, timer 292. No enemy defeat,
pillar clearance or successful jump was established. The native state after
the terminal controller failure was not captured; no later life/score state
is inferred from the last reviewed image or from input receipts.

## Precise bounded blocker

The next reviewed Right + Left Control intent was created at scene age
**11.829440 seconds**, before the twelve-second admission limit. Its
separate four-second operation deadline was clamped to the scene's
twelve-second boundary, leaving only **170.560 ms** for an intended 850 ms
pulse. The independent release child reported armed **58.125 ms after**
that deadline. The parent's before-DOWN assertion then failed with
`operation deadline before DOWN`.

`terminal-blocker-analysis.json` and the immutable intent/operation/arm
records retain that ordering. The failed gesture has **zero DOWN receipts**
and no DOWN record. Its already armed release fired, returned UP ACK, and
was actually waited with exit 0 and separate EOFs. This was **not** a
positively NOT_SENT/VALID rejection: the controller wrote its terminal
`noReplay` failure, which remains intact. No subsequent capture or input
was attempted through another path.

Review took too long near the admission boundary. A future controller change
should reject an insufficient complete operation window before arming as
positively unsent, with focused boundary controls. That prospective change
does not authorize clearing this run's terminal state. A fresh original
requires a new assignment. Native Abort/mapQuit/titleQuit could not be
submitted after the terminal guard closed; cleanup therefore used the
supervisor's orderly SIGTERM path, not native Quit.

## Controls, build and identities

The controller, supervisor and during-press observation helper are identical
to the tested SuperTux stomp/pillar predecessor. Current guarded-input helper
hashes matched its passed controls at preparation and launch. Fresh default DIRECT endpoint and
during-press capture fixtures passed, including capture strictly between
consumed DOWN and independently scheduled release. The actual original uses
no relay, proxy or deliberate transport delay.

The fair turn followed actual Forsaken readiness and CLI scope/LMarbles7
supervisor completion. Source drift from the predecessor required a fresh
full build under both heavy and build locks; it passed. All **1,637** checked
build inputs remained stable during the build. Media verification, input
owner tests, all **22** guarded CLI controls and real-clock controls passed.
All **789** media/settings pins matched the previously reviewed native
Space jump / Left Control run bindings; another Options tour was unnecessary.

The sole original launched at **15:38:55 UTC** with unchanged registered
`supertux_013` media, `--real-ticks`, a fixed **1,200-second** native runtime
and an independently prearmed **1,220-second** watchdog. Every admitted finite gesture used a newly
personally reviewed scene younger than twelve seconds, one permanent owner,
a separate immutable operation deadline, independent prearmed UP and actual
postrelease progress. All **six consumed pulses / seven DOWN receipts**
retained that owner and unique nonces; maximum consumed scene age was
**7.068800 seconds**. All release-child waits were 0 with separate EOFs,
including the seventh, failed-intent release. There were zero NOT_SENT/VALID
rejections. The successful fixture observation path remains tested, but no
actual gameplay jump was attempted before failure.

Launch Git SHA: `f4ea2d2d51721eeba1f906e036911aad74abe25f`.
Module SHA-256:
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
`source-pins.json` covers 1,640 source/tool files. Relevant dirty/new-runtime
and owned-controller Git patches retain recovery without source-tree,
module or media copies. Postflight found zero source/media drift and an
identical module. Other workers' ownership and WIP were preserved.

## Waits, retained evidence and cleanup

Native stdout records `[signal] SIGTERM requested orderly shutdown`, with
actual native wait **0**, not a native `[Exit]`/Quit consequence. Watchdog,
supervisor child, outer waiter and invoking queue tool also actually returned
**0**. Each process receipt has separate stdout/stderr EOFs. Unlike the
predecessor's unknown outer-tool ending, this tool's final exit was observed.
The watchdog exited on the native-wait receipt without firing. The heavy
lock was released; recorded native/watchdog/supervisor/release identities
are absent and port 8465 is closed.

Five selected personally reviewed PNGs passed dimensions, CRC, inflate and
SHA checks. Early `result.json` was updated with selected current scenes,
then finalized with the precise blocker and actual waits. Transient captures
were removed with their hashes and metadata retained. Evidence references
are checked locally before publication. Disk remained above 1.5 GB
(approximately 13 GB free).

No production source, other worker's WIP or media was modified. No download,
deployment, box or additional worker was used. Box ID **none**, state
**NOT_CREATED**, expiry **null**, stop receipt **not applicable**.
