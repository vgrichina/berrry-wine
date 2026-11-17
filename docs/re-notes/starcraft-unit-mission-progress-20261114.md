# StarCraft: manually completed supply depot and native Quit

The current registered `starcraft_shareware` completed a newly commanded Terran
Supply Depot in one live mission. A personally selected SCV received native
construction-menu and placement clicks. The finished building was then selected:
its panel showed **Terran Supply Depot, 500/500, Supplies Provided 8, Total
Supplies 50**. The initial cap was 42; minerals changed from 250 to 150. The
scaffold, finished structure, and finished building's identity panel were each
personally reviewed in complete scenes. This establishes completed construction;
the mission's “Destroy the rebel base” objective was not completed and no enemy
damage or mission victory is claimed.

Evidence: `scratch/runs/20261114-starcraft-unit-mission-progress/result.json`.
The candidate is the existing `starcraft-shareware`; this is a distinct RTS
gameplay result, not a new title or expanded 27-app/3D coverage claim.

## Current run and manual decisions

The heavy turn followed actual Minesweeper and fresh GL-startup terminal waits,
both EOFs, absent PIDs, and heavy-lock release. Their records are preserved in
`predecessor-release.json`; the earlier closed GL run was never reopened.

One original used `test/run.js --app=starcraft_shareware`, cooperative execution,
default 1000-block batches, real ticks, an 800×600 complete canvas, and fixed
1200/1220-second runtime/watchdog deadlines. The existing registered
`ophelia terran1` arguments, startup registry and game media were unchanged.
The frozen scripted gameplay runner was neither invoked nor adopted. No new
cheat, map, AI, speed, guest-state write, hidden game-state inspection, replay,
restart, right click, or scripted action list was used.

The first reviewed complete scene was the native **STRONGARM** mission title
card. It established one permanent PID/start-token/window binding, truthfully
marked bootstrap. A subsequent scene had naturally advanced to the briefing;
its visible Start button was separately reviewed and clicked. The Tips modal
was separately dismissed. An unobstructed mission scene was then admitted.

Selection, command-menu choice, placement-command state, placement target, and
results were reviewed separately. The SCV's selected portrait/green ring and
60/60 health established actual selection. The native “Select Location” text
and Cancel-only command card established the active placement command. A left
click on personally chosen clear dirt commanded construction. Natural game time
continued through travel, scaffold construction and completion.

Selected personally reviewed complete scenes, relative to the run directory:

| Evidence | What it establishes |
| --- | --- |
| `original/bootstrap-observation.png` | Native title before permanent binding |
| `original/result-selected-scv.png` | Actual selected SCV and status panel |
| `original/placement-review.png` | Native placement command active |
| `original/result-construction-started.png` | SCV constructing new scaffold |
| `original/result-construction-complete.png` | Completed structure; cap now 50 |
| `original/result-depot-identity-complete.png` | Completed Supply Depot, 500/500, +8 supplies |
| `original/quit-confirmation-review.png` | Native Exit Program confirmation, with completed depot still present |

`personal-scene-reviews.json` records the observations and image hashes.
`input-audit.json` records eleven consumed, independently released clicks.
The five gameplay clicks used scenes aged 3.720–4.330 seconds at intent creation;
the controller also rechecked freshness immediately before DOWN. Menu scenes
had a 30-second bound. All pulses were 400 ms with an independently prearmed
1750 ms fallback and unique nonces. Two admission reviews and three command
reviews expired before input/arming; their scenes were never reserved or sent.
Fresh scenes and new choices were used, with no UNKNOWN or rebind.

## Native exit and scope limits

At 292.791 seconds the irreversible Quit phase began, well before the 1020-second
gameplay cutoff. The separately reviewed native route was **MENU → End Mission
→ Exit Program → “Are you sure you want to exit Starcraft?” → Exit Program**.
Restart Mission and Quit Mission were not chosen. The final physical UP was
acknowledged. No host `quit`, cancellation request or watchdog signal ended
the original.

The log records guest `[Exit] code=0`; CLI duration was 339.356 seconds, and the
actual native wait completed at 339.607 seconds. Native, watchdog, supervisor
child and outer wrapper all returned 0 with actual waits and both EOFs. The
watchdog exited unfired, the heavy lock was released, runtime PIDs were absent
and port 8605 was closed. These are actual records, not inferred exit codes.

Shutdown also logged a secondary-thread EIP=0 diagnostic and fourteen abandoned
parked critical-section enters; the final thread summary retained another
active thread. These diagnostics remain in the log. The demonstrated claim is
native Exit Program followed by guest/process exit 0, not a guarantee of clean
shutdown for every emulated thread. No runtime patch was attempted.

No FPS, audio, browser parity, enemy destruction, full mission completion or
full-suite compatibility claim follows from this run. Box ID/expiry are null;
state is `NOT_CREATED`, and a box-stop receipt is not applicable.

## Preservation and validation

Tested source base: `f6931d34b7ada7386d335624fe77f41803a2ea4f`, with the relevant
uncommitted runtime and owned new-file binary patches in the run directory.
The source tree was not archived or copied. The tested WASM was 2,200,987 bytes,
SHA-256 `c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`;
it was referenced and hashed, not copied into evidence.

`launch-pins.json` and `postflight.json` establish **2,945 pins, zero drift**.
`registry-before.json`/`registry-after.json` preserve the full app entry, paths,
resolved dependency graph, imports, missing dependencies and twelve existing
media/system-data file hashes. The five owner-specified EXE/DLL/MPQ/installer
sizes and SHA-256 values matched exactly. No media was downloaded or copied.
The existing non-seed `shell32.dll` absence and builtin-handler fallback were
identical before/after and were also reported by the actual loader.

Validation passed: **20 own policy tests, 12 actual endpoint tests, 10 actual CLI
tests**, and `flock /tmp/wine-build.lock bash tools/build.sh` under the heavy
lock. Controls cover phase/selection/command/freshness policy, permanent identity,
sticky UNKNOWN/no replay, late/dropped ACK, actual child waits/EOF and independent
release, including parent death. Instrumentation and synthetic scene metadata
belong only to isolated Solitaire fixtures; none was loaded by StarCraft.
All 31 complete-scene PNGs passed CRC/inflate/800×600 validation. Fourteen
selected scenes have personal review notes; this run's evidence checker found
zero errors, missing artifacts or invalid metadata.

Changes are confined to the StarCraft controller, its tests and this report.
`lib/apps.js`, the frozen runner, historical StarCraft notes and peer runtime
sources remained read-only. The original is closed; no further mission is
required for this bounded task.
