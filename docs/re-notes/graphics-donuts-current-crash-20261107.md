# Original Donuts: current post-LEVEL001 crash sweep, 7 November 2026

The historical crash in `lib/apps.js` does **not reproduce** on the tested
current main runtime. One original registered `dx_donuts`, with its unchanged
EXE, all 37 registered data files, `presentCap:60` and the default guest Worker,
passes the title → native Enter → LEVEL 001 → live game route. Nine fresh
full-page screenshots were personally inspected. Ordinary native Right turns
the ship visibly; native Up and Space inputs continue the live game with
changing targets and score 0 → 60 → 80 → 100. The final reviewed frame again
shows the upright ship and moving targets at score 100. All nine checkpoints
remain running without a recorded escaped trap, page exception or
unimplemented API. This is a bounded DirectDraw gameplay observation, with
zero active D3D cases and no historical27 completion claim.

Evidence is in `scratch/runs/20261107-graphics-donuts-current-crash/`.
`visual-review.json` records each inspected image hash and its interpretation;
`retrieved/original/` contains the full frames, state, native events and
admission/release receipts. The title itself documents Enter to begin,
Left/Right to turn, Up/Down for thrust and Space to fire. Each input follows
personal inspection of a fresh screen and is bound to the same live process,
Worker endpoint, instance and recovered module. Commands are Enter 100 ms,
Right 250 ms, Up 800 ms, Space 600 ms, Up 500 ms and Up 1500 ms, each with
independently scheduled release. Six trusted native down/up pairs and all nine
numbered exact ACKs, including captures and shutdown, are verified. No
UNKNOWN, replay, original relaunch or guest modification occurs.

The right-turn frame changes the initially upright ship to a diagonal heading.
Later collisions/respawns confound isolated thrust displacement: subsequent
frames show an upright repositioned ship, split targets, then a frame without
a visible ship and finally the ship present again. The fire checkpoint has
small green marks adjacent to the ship and a score increase from 60 to 80;
a single projectile trajectory or exclusive cause of scoring is not certified.
The screenshots and ordinary control route establish visible game control,
without claiming every later position or score change was caused by one key.
Owning guest slice sequence advances from 197 at title to 9969 at the last
checkpoint, 163.756 seconds later. These counters are execution observations,
not FPS measurements.

The obsolete registry comment describes a version-0x0300 device refusing
Device2A, release and a later NULL call. Existing commit
`2cee402d2e1775b3536bede375508e61c7dcefc3` (11 October 2026) removes the Device2
version floor; Device7 retains its own floor. Current implementation classifies
complete A/W IIDs, returns the matching implemented vtable and AddRefs the
queried wrapper. The existing focused regression explicitly covers Device2
on a version-3 device and balanced Release. No failing-before current emulator
mismatch was found, so no speculative semantics change, new regression or
registry edit was made. Read the old comment as historical evidence; this
note records the fresh current outcome.

The selected helper's complete import construction passes before allocation.
Native input, exact ACK, identity/staleness/UNKNOWN rejection and independently
scheduled release controls are inherited from the immediately preceding
`20261107-graphics-wormhole-bellhop-qualified` run. The copied helper bytes,
production native-input dependency, transport dependency and standard module
match those passing controls; among common runtime pins only unrelated
`TODOS.md` differs. `inherited-controls.json`,
`inherited-production-comparison.json` and `complete-helper-imports.json`
retain exact paths/hashes. The driver changes only the selected original app.
No unrelated passing controls are repeated.

Tested source is main `9838673f671ca9b655d4d1f0fc3ef4dd84b5aa4d` plus
`dirty-source.patch` and `new-source.patch`; owned run helpers are also retained
as patches. A locked `flock /tmp/wine-build.lock bash tools/build.sh` passes,
as do `test-directinput-device-com.js`, `test-directinput-root-com.js` and
`test-directinput-buffered-keyboard.js`. The standard module is
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
the actual live guest module is recovered and matches. The separately built
compatibility module is not claimed as an executed original variant.
All 2656 runtime pins pass preflight and postflight. Npm's lock metadata diff
is retained separately. All 194 successful served responses match preflight
pins or exact Git blobs. Git SHA and relevant binary diffs are the source
archive; no source tree or game-media archive is created.

Actual presentation is page `Win98Renderer` with `CanvasRenderingContext2D`;
there is no original rendering Worker endpoint or active D3D target. The UI's
WebGL selector does not turn this DirectDraw sample into a D3D case. Chrome is
151.0.7922.108, headless, with a native 1024×712 inner viewport and requested
1024×855 outer size. FPS, audio, native-Windows correctness, backend parity
and complete visual correctness are unqualified.

One fresh UUID-idempotent box, `bx_ncf8ed3v`, is created at
2026-11-07T12:05:51.630Z with a 35-minute expiry at 12:40:51.644Z. Serial file
upload supplies 69 missing paths after Git reconstruction, with no SSH/SCP,
403 retry, resume or additional box. One heavy original runtime launches.
All 98 terminal artifacts (4027308 bytes), including the unique tested module,
logs and captures, are retrieved and SHA-verified **before** the explicitly
delegated normal nonforced stop. `terminal-audit-verified.json` maps each file.
An initial postflight script incorrectly expected seven native pairs instead
of six; that bookkeeping assertion is corrected in a separate read-only audit,
with the original failure preserved and no runtime replay.

Postflight confirms both named PIDs absent, HTTP/CDP ports 35027/35411 closed,
profile absent, no writer lock and balanced empty held input. The box is
confirmed `archived` at 12:11:08.349Z, stop completed with `forced:false` and
expiry now null. Local helper checks leave no browser/profile/listener.
Sampled `/home` checks stay above 2 GB; sampling does not prove continuous
free space. Local watcher shutdown is retained in the final local postflight.
No matching candidate-corpus entry exists, so this remains a named-app
investigation without attachment to an unrelated candidate. `result.json` is
written last after publishing this note. The requested sweep is complete;
no current emulator repair is warranted.
