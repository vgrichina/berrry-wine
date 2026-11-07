# Owner GTA2 WebGL and ordinary-rate check — 2026-11-07

The original GTA2 Wild Demo renders through its actual WebGL Worker and supports
personally reviewed settled walking and native Enter vehicle entry. **This run
does not qualify sustained driving or steering, and supplies no release-quality
recommendation.** The ordinary walking sample was visibly slow: 77 successful
screen upload/composition completions in 30.003 seconds, about 2.57 per second.
These are not unique game frames or guest updates. No emulator defect was
demonstrated and no production implementation changed.

Evidence: `scratch/runs/20261107-owner-gta2-gl-rate/`. This is the single-task
follow-through to owner Telegram172, after reading the software GTA2 and corrected
TR2/TR3 GL findings. Exactly one original launched, at 03:09:41 UTC, through
`index.html?debug&threads&d3d-renderer=webgl&app=gta2_demo`. The production direct
initializer selected the registered app while the dropdown remained Notepad.
Miles used its original app-local
`/binaries/candidates/gta2-demo/installed/Program_Executable_Files/mss32.dll`
route. No catalog substitution or original media/config/save edit occurred.

## Personally reviewed gameplay and terminal limitation

Every used capture was freshly retrieved and viewed with `view_image`,
`detail: original`, before its geometry or scene description informed another
action. Capture hashes, sizes and dimensions are retained in
`capture-identities.json`; action-specific descriptions remain in request/review
records. No inherited TR2 review or ambiguous TR3 display assessment was reused.

- `review/playing.png` shows the on-foot player on the round brick park pad.
  `walk4` shows the pad behind the player; `walk13` shows the stair landing;
  `walk22` shows the stair bottom; `walk28` shows the alley mouth and upper
  road; `walk36` shows the grass median. Each walking capture follows native Up
  release and 1000 ms without input. Static landmarks move relative to the
  centered player, establishing walking beyond NPC animation.
- `walk41` shows the player near lower-road traffic. A balanced native Enter
  hold of 2000 ms produces `entry1`, with the player at the green car door.
  `settle-entry` shows the ejected occupant and $10. After another 6000 ms
  without input, `entry-settled2` shows the BUG banner, centered green car and
  no on-foot player, confirming completed native entry.
- Separate Up holds produced `drive1`, `drive3` and `drive5`. Road marks shift
  only slightly; this does not qualify substantial sustained driving. The
  separate Left hold in `steer1` was balanced, 2000 ms, followed by 2000 ms
  without input. I cannot confidently resolve a heading change relative to
  `drive5`. A separate Down/reverse hold in `reverse1` gives only a small
  opposite landmark shift. It does not establish steering.

The terminal limitation is **unresolved visual driving/steering qualification**,
not a transport failure or demonstrated emulator defect. No further gameplay
input followed `reverse1`; executing identities were retrieved and the browser
closed normally. The evidence does not determine whether the weak motion was
ordinary vehicle/traffic state, the low effective cadence, or another cause.
No harness repairs, further originals or controlled stepping followed.

All 56 original commands have complete ACKs, including quit. Three requests
expired before dispatch with explicit effects=0; fresh captures and new IDs
followed. No partial/UNKNOWN input or replay occurred. A read-only fetch for
the nonexistent `drive2` capture after a stale refusal failed without guest
effect. An early generated-startup fetch also preceded readiness and failed;
later read-only retrieval used a separate label. Both helper errors are retained.
The cleanup template's generic `UNKNOWN; never replay` is not an input outcome.

## Ordinary wall-clock rate and counter meanings

The measured interval was **03:13:07.539–03:13:37.543 UTC**, elapsed
**30,003.390 ms**, during ordinary walking on the stairs. Native key holds and
state/screenshot inspections occurred during the interval; their overhead is
included. There was no Frozen toggle, controlled stepping, guest-clock scaling
or scheduler change. The page remained visible to the headless browser.

The observer wraps the actual host `_presentNow` method, preserving its
receiver, arguments and return value, and timestamps successful returns. The
production method returns success when DirectDraw pixels upload or scheduled
composition completes. It can publish repeated content and can combine work;
therefore these events are **screen upload/composition completions**, not a
validated count of unique game frames, compositor presentations or physical
scanouts. The hook is restored afterward. Local preservation controls and a
generated live Worker sample passed before the original.

| Measurement | Result |
|---|---:|
| Successful screen upload/composition completions | 77 |
| Completion rate over measured wall time | 2.566/s |
| Consecutive completion intervals | 76 |
| Minimum / mean interval | 6.530 / 378.194 ms |
| Median / p90 interval | 454.805 / 590.570 ms |
| p95 / p99 / maximum interval | 669.700 / 763.900 / 763.900 ms |
| Naturally returned renderer submission delta | 199 (2715 → 2914) |
| Transport flip delta | 52 (711 → 763) |
| Owning-endpoint draw-call delta | 11,487 (84,284 → 95,771) |
| Unique presented game frames / physical scanout rate | unknown |
| Guest logical-update rate | unknown |

Percentiles use nearest rank over the 76 recorded intervals. Boundary gaps are
not included in those intervals; the rate uses all 77 events and the full
elapsed window. Renderer before/after snapshots are sequential naturally
returned counters and can lag endpoint work. Submissions, flips and draws are
different events, none converted into FPS. GTA2 has no registered validated
logical-update marker in this staged app entry. Raw timestamps, both counter
snapshots and analysis remain in `rate-sample.json` and `rate-analysis.json`.
This one observed interval is not a clean benchmark or proof of general rate.

## Actual WebGL ownership and tested identities

Original owning render Worker target: `0D112AD8E72FC49C581AEBB4B6AF86B1`,
session `BC02953E49FAD594455A2E747959CD02`, endpoint 1, legacy/webgl.
At `reverse1`, its adapter is present, failed=null, ready=1, control error=0,
completed sequence=13,004, batches=7589 and commands=250,769.
Naturally returned endpoint stats report errors=0, fallbacks=0 and both direct
software and fallback-software completions=0. Those are reported counters,
not separate instrumentation of every GL call or parity acceptance.

Actual owning-context renderer string:

`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`

GL version: `WebGL 2.0 (OpenGL ES 3.0 Chromium)`. Chrome was
151.0.7922.108, V8 15.1.206.16, headless, viewport 1024×768. This identity is
from the owning endpoint, not the toolbar or the prior TR3 SwiftShader boat.

Before the original, actual production direct-initializer, atomic transport,
executor/recovery, literal action, renderer key-state and duration controls
passed. Up, Left, Space, Enter and Escape ran balanced trusted CDP pairs on
about:blank in each browser; invalid holds produced zero events. The copied
TR3 native preflight did **not** include Down or Right. Down passed the
literal executor and production renderer/DirectInput state controls, but its
later reverse action lacks the requested prior trusted-browser qualification.
This closeout-discovered coverage gap further limits that action; it was not
repaired by relaunching the original. Holds remain
50–2000 ms and the unmodified scene guard remains 12 seconds.

The generated Boids guest ran in a real Worker with an actual healthy WebGL
owner, target `B0777E81EC7047223A9477F2BF2E8C9B`, reported errors/fallbacks 0
and the same Intel renderer. Natural draw calls advanced 536→603. Its colored
boids and boundaries were personally viewed. A separate generated PE loaded
original native COMCTL32, returned DllMain EAX=1 and showed the ordinary tabbed
property sheet. A balanced click on its reviewed OK dismissed it. Both native
captures are 1024×768 but differ in size/hash; **both were re-viewed at original
resolution after comparing identities**, confirming presence then dismissal.
Qualification browsers were fully cleaned before the original.

Staged source HEAD: `1d8d03ccabb91fde9b93c3625f6ecae62af56585`.
Relevant dirty/new-source patches and owned helper patches are retained; Git
is the source archive. All three actual original Workers yielded Wasm SHA-256
`07f1cc970038f8ab31313b8b200edf26caa63473f293f5fc937f5cfe5c5c7f6e`,
2,181,179 bytes. This existing module was reused, without claiming staging
HEAD as fresh module-build provenance. All 37 executing JavaScript source
records from the three Workers matched exact staged bytes.

All 696 runtime/helper pins match remotely before the original and after exit.
All 71 retained GTA2 media inputs, 26,207,806 bytes, match before/after.
Installed `gta2.exe` SHA-256 remains
`97ad743b6ec9ea1be95282053c3127084acd764a7f37a3e57e2268af52d02ae3`;
Miles remains `0974b244354a5d13e0711db15430c05f7949dc279b63897146f304d1401153fc`.
All 617 successful HTTP responses match exact files, including 251 original
responses; there are no unmapped successful responses. Non-200 optional
bundle/auth/build-info/favicon responses remain recorded. Individual fonts
loaded. SHELL32/OLE32 used the recorded built-in stubs. Upstream provenance
and historical native reference evidence remain unavailable.

## Completed cleanup and remaining work

All 579 inventoried remote artifacts were retrieved and hash/size verified;
duplicate modules have explicit retained-file mappings. Original Chrome exited
normally at 03:21:47 UTC, code 0. An immediate inventory caught its controller
finishing exit; the independent 03:22:01 check confirms all six tracked PIDs
absent, six ports refusing, three profiles absent and all writer locks absent.
The local messageboard watcher was stopped. No local guest runtime/source/build
lane was used; initial offline helper adaptation errors were corrected before
allocation and are not original-emulator failures.

Fresh boat `bx_rs2buhtv` used a persisted, fsynced UUID Idempotency-Key.
Explicitly delegated normal stop `stop_8f9f9ca61a57d939` completed at
**03:22:44.561 UTC**, forced=false, error=null. State is archived, active expiry
null; initial expiry was 04:07:07.025 UTC. Allocation through retrieval and
completed stop took about **15 minutes 38 seconds**, within 35 minutes.
Minimum observed local free disk was 2,091,184,128 bytes, above 2 GB.
No old403 resume, held-risk retry, nested worker, source/media archive,
automated risk flag or public deployment occurred.

Findings only are published; no production fix or full build is claimed.
Meaningful sustained driving and a visually resolved steering change remain
outstanding. The low observed upload cadence needs investigation before any
ordinary-speed quality recommendation. No combat, audio, parity or full27
claim follows. Publication and ownership release precede `result.json`, written
last, then this worker stops.
