# SuperTux: airborne jump, pillar clearance, enemy stomp and native Quit

Evidence: `scratch/runs/20261114-supertux-stomp-pillar/`.

One fresh original `supertux_013` reached new terrain beyond both first tall
foreground pillars, collected coins above the next block row, and defeated a
later walking enemy with a reviewed jump/stomp consequence. Native Abort
Level, map Quit Game and title Quit ended the guest with `[Exit] code=0` at
**494.228 seconds**. No life loss occurred. Level exit and full27 remain
unproved. This advances beyond the predecessor's first enemy encounter and
three-life restart in `supertux-direct-onward-20261114.md`.

## Separately observed consequences

`level-entry.png` records this run's actual baseline: **75 score, 3 coins,
four lives**, timer 286. These counters are not new progress and are not
summed with any earlier run. Right 550 ms approached the opening blocks.
The following personally reviewed Space+Right 650 ms began while no close
enemy was visible. `player-airborne-result.png` shows Tux clearly above the
ground; `row-position.png` shows him standing on the opening block row.

Further individually reviewed finite choices approached the row's end,
jumped toward the first pillar, and landed at its near edge. A fresh
Space+Right 850 ms produced `pillar-fresh-pose.png`, showing Tux airborne at
the first pillar, and `pillar-clearance-result.png`, showing **both tall
foreground pillars behind Tux** and a new block/coin row ahead. Four lives
remained. This establishes clearance beyond the first pillar without
requiring an enemy-kill claim.

Another reviewed jump reached the new row. `new-row-coin-result.png`
records **125 / 5**, four lives: +50 score and +2 coins from this run's
baseline. `row-two-onward.png` reveals further terrain, a walking enemy and
a raised platform. A fresh `enemy-platform-review.png` shows grounded Tux
around x255 and the enemy around x447, still distant. Space+Right 950 ms
was chosen from that scene. `enemy-platform-airborne.png` independently
shows the jump with the walking enemy below/right.

`stomp-defeat-result.png` then shows the enemy flattened with crossed eyes
behind Tux, a floating **50**, and **175 score / 5 coins / four lives**.
The following native pause scene retains the flattened enemy. Together,
the jump, defeated enemy sprite and +50 score establish a successful stomp
consequence. The precise collision instant is not captured; this does not
identify that enemy as the predecessor's first enemy. The net change for
this run is **+100 score, +2 coins, no lives lost**.

Native Escape paused at timer 98. With the assigned stomp and clearance
consequences established, reviewed Up/Enter selected Abort Level, the map's
Quit Game, then the title's Quit. No native level exit is claimed. No second
original launch or active extension occurred.

## Guard, build and evidence checks

The direct production endpoint is `http://127.0.0.1:8465/ctl`, with no relay,
proxy or deliberate transport delay. The repaired controller and supervisor
are byte-identical to the predecessor. Initial helper hashes matched its
passed delayed-transport, sticky UNKNOWN/noReplay and supervision controls.
The shared input-owner helper subsequently changed under another worker's
ownership. Preflight therefore reran all **three controller controls**, four
supervision controls and the outer-wait control against current dependencies;
all passed. The fresh direct endpoint and during-press observation fixtures
also passed with exactly one DOWN and normal independent UP.
The observation helper takes one capture during a manually chosen pulse;
it does not select or queue another action.

The fair turn followed native GL resize/Forsaken and LMarbles pointer
validation/publication. An initial queue-only waiter was stopped before any
original launch to accommodate LMarbles' nested diagnostic/final report.
The final gate observed both preceding tasks' release evidence. Source drift
from the older accepted closure required a **fresh locked full build**, which
passed. Fresh media verification, input-owner, all 22 guarded CLI controls
and clock checks passed. All 789 media/settings pins matched; prior native
Space/Left Control verification was reused without another Options tour.

The sole original launched at **14:56:06 UTC**, with unchanged registered
media, `--real-ticks`, a fixed **1,200-second** runtime and independently
prearmed **1,220-second** watchdog. No relay/proxy/deliberate transport delay,
state/configuration/physics/clock writes, autoplay or queued future actions
were used. Each finite choice came from a fresh personally reviewed scene.

All **22 consumed pulses / 28 guarded DOWN receipts** retained one permanent
owner, unique nonces and independently prearmed UP with actual release-child
wait 0 and separate EOFs. Maximum consumed scene age was **11.107 seconds**,
below the 12-second cap. The practical four-second immutable operation
deadline remained separate from press duration. All 21 nonfinal pulses had
actual postrelease batch progress; the final choice was checked against the
actual native exit.
Three stale reviews were positively **NOT_SENT/VALID before DOWN/arm**.
Fresh captures and new intents followed; no old intent was replayed and no
sticky UNKNOWN occurred. The observation wrapper reported missing consumed
receipts for two rejected choices; those are rejected observations, not
original inputs or terminal guard UNKNOWNs.

Launch Git SHA is `d49a82c579d5b99d8c76d07b945cdb27ccb66f0b`; module SHA-256
is `dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
`source-pins.json`, launch dirty/new-file patches and owned-controller patches
retain recovery without source/media/module copies. Postflight found no
module or media drift. Another worker changed `test/run.js` and
`lib/guest-rpc.js` during the run; their ownership was preserved, and that
source drift is explicitly recorded rather than claimed identical.

Eighteen selected personally viewed PNGs passed CRC, inflate, dimensions and
SHA checks. Canonical result filenames map to original capture names in
`capture-name-map.json`; transient captures were removed with hashes and
metadata retained. Native stdout is a compact 48 KB trace.

## Actual waits and cleanup

Native Quit produced actual native wait **0**, watchdog wait **0**, and
supervisor child wait **0**, each with separate stdout/stderr EOF receipts.
The watchdog exited on the native-wait receipt without firing, and the heavy
lock was released. No cancellation or forced native shutdown occurred.

The invoking queue execution tool separately returned **143** and its final
`outer-wait.json` is absent; the cause is unknown. `outer-child-wait.json`
still durably records the actual supervisor wait 0 with both EOFs. An
additional outer-tool/outer-wait-process wait 0 is **not** claimed or
fabricated. The native Quit result rests on the distinct guest exit, native
wait, watchdog wait and supervisor receipts.

All recorded native, watchdog, supervisor and release identities are absent;
port 8465 is closed. The read-only board watcher was already absent when
cleanup checked it. Disk remained above 1.5 GB (about 13 GB free).

No production source or other worker's WIP was edited. Box ID **none**, state
**NOT_CREATED**, expiry **null**, stop receipt **not applicable**. No boxes,
downloads or deployment occurred. This task stops after publishing
the stomp/clearance-and-Quit result. A native level exit remains future work.
