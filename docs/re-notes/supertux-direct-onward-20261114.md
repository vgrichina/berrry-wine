# SuperTux: direct guarded route reached an enemy/life-loss consequence and native Quit

Evidence: `scratch/runs/20261114-supertux-direct-onward/`.

One fresh original `supertux_013` followed Start Game → Slot 1 Free → visible
story → ordinary map → Welcome to Antarctica. Two personally reviewed finite
Right choices advanced along the opening snow, past the positions of the
earlier run's first two block rewards, toward the first raised pillar. A pale
walking enemy approached Tux; the following scene lost one life and the level
restarted with **Tux × 3**. Native Abort Level, map Quit Game and title Quit then
ended the process normally. This is an enemy encounter/life-loss consequence;
no stomp, enemy kill, pillar landing, passage beyond the entire opening block
row, level exit or full27 completion is claimed.

The earlier successful run remains **100/4 → 150/6**, two spent blocks and
native Quit, as recorded in `supertux-onward-quit-20261114.md`. The subsequent
relay-expiry attempt remains **zero original inputs, no gameplay, no native
Quit**, as recorded in `supertux-deadline-onward-20261114.md`. Their notes and
terminal evidence were hash-pinned and left intact.

## Direct route and preparation

The run used **http://127.0.0.1:8465/ctl directly**, with the unchanged
production HTTP server and guard. No original relay, proxy or deliberate
transport delay existed. Before launch, `test_direct.py` exercised the
controller's actual default endpoint against the production HTTP/guard
fixture: exactly one DOWN, normal independently armed UP, progress, actual
fixture wait 0 and both EOFs. This synthetic check is not guest gameplay.

All 21 recorded helper hashes matched. The predecessor's passed actual-HTTP
**150 ms delayed transport / 60 ms pulse**, sticky consumed-UNKNOWN/noReplay,
expiry and independent fallback controls, four supervision controls and
outer-wait control were reused by exact hashes. Delay remains fixture-only.
The controller is byte-identical to that repaired controller: normal pulse
duration is separate from the immutable operation deadline
`min(admission + 4 seconds, capture + 12 seconds)`. It retains one permanent
owner, unique nonces, a 12-second scene cap and independently prearmed UP.
No terminal failure was reset, intent replayed, owner rebound or deadline
extended. This original had no NOT_SENT rejection or UNKNOWN.

Commands were prebuilt before launch; each actual choice was made only after
personally viewing its fresh full scene. Accepted settings/media matched the
earlier native Space/Left-Control verification (789 pins); no Options tour
was repeated. Registered media, profile, SDL/datadir route and existing
`--real-ticks` stayed unchanged; no state, simulation or clock was injected.

The fair turn followed LMarbles6's actual completion and Forsaken's bounded
preflight failure with `originalLaunched=false` and actual supervisor wait.
The first queue-only waiter expected a completion file omitted on preflight
return; it was stopped before any SuperTux launch and replaced with a gate
accepting those explicit receipts. This was not an original restart.
Heavy-lock ownership and build-lock preflight then preceded the sole launch.
The exact 317-file accepted source closure and WASM matched the accepted
locked full build, which was reused. Fresh media, shared-WASM input-owner,
22 guarded CLI and clock tests passed. All 787 originals, authentic standing
CRT and 786 registered manifest mappings passed.

## Reviewed consequence and limits

`level-entry.png` records this run's baseline: **score 50, coins 2, four
lives, timer 295**, grounded Tux at the start. These counters are not new
progress. Right 650 ms, then separately reviewed Right 800 ms, scrolled the
opening blocks left and brought the raised snow pillar into view.
`pillar-approach.png` shows grounded Tux around x255, a pale enemy around
x305 and the pillar beginning around x487. Tux was still beneath the latter
part of the opening row; this does not establish clearing that entire row.

A fresh reviewed Space+Right 250 ms intent received two CONSUMED guard
receipts and independent normal UP. `enemy-jump.png` then shows three lives
and Tux absent, with the enemy farther left; `enemy-contact-result.png`
shows the restart card **Tux × 3**. `respawn-visible.png` confirms three lives
back at the start, still **50/2**. The proximity, life loss and restart support
an enemy-encounter consequence. The exact contact instant was not captured.
The native dispatch trace records the two UPs but no corresponding DOWN
dequeue for this jump intent: guard consumption is not proof of guest jump
execution. No successful airborne/stomp claim follows from its ACKs.

Native Escape opened Pause. Reviewed Up selected Abort Level, Enter returned
to the map, Escape/Up/Enter selected Quit Game, and reviewed title Up selected
Quit. `native-quit-ready.png` shows Quit highlighted; a fresh Enter selected
it. Loading and transition captures received no speculative input or replay.

## Waits, identity and cleanup

The fixed **1,200-second** original started at 14:17:12 UTC, after an
independent **1,220-second** watchdog was observably armed. Native Quit
produced `[Exit] code=0` and statistics at **306.936 seconds**. Runtime,
watchdog, supervisor child and outer waiter each have actual **wait 0** and
separate stdout/stderr EOF receipts. The watchdog exited on the native-wait
receipt without firing; the heavy lock was released. The invoking execution
tool also returned 0. No cancellation or forced shutdown occurred.

All **16 pulses / 17 guarded DOWN receipts** used the same owner, distinct
nonces and prearmed independent release, with actual release-child wait 0
and both EOFs. Fifteen nonfinal pulses have postrelease batch progress;
the final choice awaits the actual native exit instead. Maximum consumed
scene age was **6.580 seconds**. Guard receipts do not promote every input
to guest dispatch, as the jump limitation above demonstrates.

Launch Git SHA is `545d22c4f31f6885f7437204409c53160c6103f9`, also recorded
in `source-pins.json`; module SHA-256 is
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
Postflight found zero source/module/media drift. Exact Git identity, relevant
uncommitted binary diffs and new-controller patches retain recovery without
source/media copies or archives. Seventeen selected personally reviewed PNGs
passed CRC, inflate, dimensions and SHA checks; transient images were removed
with their hashes/metadata retained. All recorded runtime/release identities
are absent and port 8465 is closed, supporting the actual wait receipts.

No production code or foreign WIP was edited. Box ID **none**, state
**NOT_CREATED**, expiry **null**, stop receipt **not applicable**. No boxes,
downloads or deployment occurred. Disk remained above 1.5 GB. This worker
publishes the bounded encounter-and-Quit result and stops; any later effort
to clear the pillar or reach the exit requires a separately assigned run.
