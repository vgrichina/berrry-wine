# Caesar III demo

## Payload

The playable payload is produced by the original Sierra/Impressions demo
installer chain documented in `sources.md`:

```text
caesar3.exe (ZipMagic wrapper)
  -> setup.exe (Win16 bootstrap)
  -> _ins5176._mp (InstallShield engine)
  -> installed/c3.exe + SMACKW32.DLL + 112 data/audio files
```

The launcher mounts that installed tree through the `caesar3_demo` manifest.
It does not substitute files extracted outside the installer workflow.

## Name entry

The demo copies `The new governor` into its 32-byte player-name buffer at
`0x57eb3c`. Its capture initializer at `0x49f7b7` computes length 16 but leaves
the capture cursor at zero with overwrite mode enabled. The first five typed
characters therefore produced `Codexew governor`.

`lib/app-profiles.js` verifies the original instruction bytes at `0x41607d`
before replacing only that default-name copy with a bounded 32-byte clear. The
patch applies to the loaded image, not the installer-produced file on disk. A
different `c3.exe` is rejected by the expected-byte check.

## Gameplay gate

`test/test-caesar3-gameplay.js` launches one headless CLI process with frozen
stdio control and the CLI's own `--max-seconds=90` bound. It drives:

```text
title -> Start new game -> type Codex -> Continue
      -> Assignment 1 briefing -> To the city -> live city
```

Mouse presses retain separate down/up execution slices because Caesar samples
button state from its frame loop. The test asserts that the live name buffer is
exactly `Codex`, captures the name screen, then verifies the final 800x600 city
by its terrain/control-panel regions. Set `CAESAR3_NAME_SCREENSHOT` and
`CAESAR3_SCREENSHOT` to retain both PNGs.

## Hot loops (handler-hist, 2026-09-19)

`node test/run.js --app=caesar3_demo --no-build --quiet-api --max-batches=900
--batch-size=100000 --handler-hist --handler-hist-thread=0,0,0
--handler-hist-start=300 --handler-hist-stop=900 --hist-json=F --no-close`
writes three windows; `tools/loop-class-share.js F --exe=...c3.exe` attributes
each hot block to the loop containing it.

| VA | window 300-500 | window 500-700 | what it is |
|---|---|---|---|
| `exe+0x49e9ca` | **27.96%** | not in top | indexed byte `memcpy`, `i` spilled to `[ebp-0x4]`, bound `[ebp+0x10]`, src `[ebp+0x8]`, dst `[ebp+0xc]` |
| `exe+0x417204` | 7.86% | **45.98%** | per-frame logic, no load/store/advance shape |
| `exe+0x4a3ebc` | 29.56% | — | |
| `exe+0x40f407` | 6.15% | — | inside the `0x40f6d9` RLE sprite ladder already folded by `RLE_RUN` H424 |

**The two windows disagree strongly about where the time goes**, so quote a VA
with its window or not at all. Both windows are dominated by loops the current
self-loop matcher cannot see (~59% and ~88% of block entries) — see §22 of
[loop-idiom-superops-design.md](../loop-idiom-superops-design.md). Windows at
batches 500 and 700 came back byte-identical, which is the determinism holding,
not a sampling error.

## The unrolled tile blit and the uop tier (2026-09-29)

`exe+0x41ceb0` is the function that ran the RECT_RUN fold (H427, retired
2026-09-30, see the update below). It is wrapped in `pushad` (`exe+0x41ced7`) and `popad`
(`exe+0x41e085`), and its body is two fully unrolled copies with no loop:

- **Top half: `exe+0x41cf0f`..`exe+0x41d799`.** About 467 straight
  instructions, `mov eax,[esi+k]; mov [edi+edx+d],eax` pairs with an
  `add edx,ecx` per row. The only branch is at the end:
  `cmp [ebp+0xc],4; jnz 0x41d7a0; jmp 0x41e085`.
  - The threaded decoder cuts this run into blocks at `exe+0x41d002`, so that
    address is a block entry too, with the same entry count as `0x41cf0f`
    (153,872 in the window).
- **Bottom half: `exe+0x41d7a0`..`exe+0x41e085`.** About 470 straight
  instructions that fall straight into `popad`. There is no branch before the
  `popad`.

With the fold off, H421 (`copy32_ro_to_sib`, the pair these rows decode to) is
**67.3%** of every threaded dispatch in the gameplay window (72.6M of 107.9M,
batches 3500..end). With the fold on it is 9.8% (3.4M of 34.5M).

### Per-site verdicts

Measured with `--uop-census`, `--branch-clock` and the fold off, on the
`tools/uop-game-ab.js` c3 route (`CAESAR3_CITY_BATCHES=2000`).

| head | trace max 160 (default) | trace max 400 | `$UC_MAX_LOOP` 600 build, max 600 |
|---|---|---|---|
| `exe+0x41ceb0` (entry) | installed, retired poor: 256 enters, 256 blocks, exit `exe+0x41ced7` (`pushad`) | same | same |
| `exe+0x41ced7` `pushad` | head-unsupported (op 60) | same | same |
| `exe+0x41cf0f` top half | **no-backedge** | **no-backedge** | **no-backedge** |
| `exe+0x41d002` top half, 2nd threaded block | no-backedge | **installed**, 397 insns, then **retired poor**: 256 enters, 152 blocks, exit `exe+0x41d7a0` | installed, 397 insns, retired poor: 256 enters, 160 blocks, exit `exe+0x41d008` |
| `exe+0x41d7a0` bottom half | no-backedge, `popad` at `exe+0x41e085` unsupported | same | same |

### Why no program ever covers either half

1. **The cap cuts a run that has no branch in it.**
   - A trace may leave only through a branch, and the trim step drops every
     non-branch member whose successor is outside the trace.
   - At 160, the top half's first 160 instructions contain no branch, so the
     trim removes all of them and the verdict is `no-backedge`.
2. **The top half needs about 467 instructions.**
   - `set_uop_trace_limits` silently clamps the maximum to `$UC_MAX_LOOP`
     (400), so asking for more gets 400.
   - Even a build with `$UC_MAX_LOOP` 600 still declines `0x41cf0f`. The most
     likely cause is the scan budget: `$UC_MAX_SCAN` (600) is exceeded, and
     the halved-span retry reports `no-backedge`. That was not instrumented
     further.
3. **The bottom half can never be a trace, whatever the cap.** It runs into
   `popad`, which the compiler does not support, before any branch.
4. **Even the part that compiles is retired as poor.**
   - `$uop_poor_check` retires a program when, after 256 enters, it has
     spent fewer than 2 blocks per enter.
   - Under `--branch-clock` a block is one executed branch. A straight-line
     trace that ends in one `jnz` can therefore never exceed 1 block per
     enter, however many instructions it retires (here 397 per enter).
   - So the rule retires a program for being straight-line, not for
     retiring little work per enter.
5. **Without `--branch-clock` (the CLI default) there is one more wall.**
   - The instruction clock also refuses any compiler block with more than 200
     instructions on one page (reason 7, `long-block`, 07e).
   - `test/test-uop-compiler.js`'s `trace-limits` case hit exactly this
     before it was switched to the branch clock.

The uop counters are identical with the fold on and off at the default cap:
828 installs, 44 kills, 8,040,181 enters, 243,860,426 blocks. The fold changes
only what the threaded fallback runs. So RECT_RUN stays (+37% user CPU
without it, see below), and uop taking this function would need all of the
following:

- `pushad`/`popad` support;
- a trace cap above about 470 instructions, with the scan budget and
  `UC_INSN` scratch (about 600 records at 256 bytes each) grown to match;
- a poor rule that counts retired instructions rather than branches.

On the same route (box2, `--branch-clock`, three interleaved runs each), fold
off, uop user CPU is 6.35 s at max 160 against 4.63 s with the fold on. A
larger cap recovers about 4% of that 37%: 6.11 s at max 400, which is the one
program at `0x41d002` running before it is retired, plus the rest of the
program mix. Full table: §20 of
[uop-tier-design.md](../uop-tier-design.md).

**Update 2026-09-30: the uop tier takes the blit and RECT_RUN is retired**
(4a9dc294; details in §21 of [uop-tier-design.md](../uop-tier-design.md)).

- **How the tier takes it.** The three prerequisites above landed, but in a
  different form:
  - pushad/popad became micro-op kind 31;
  - the poor rule now credits x86 work (op 84);
  - the cap stayed at 160. Instead of a bigger cap, a trace ends in a cut
    exit, so each half runs as a chain of 160-instruction traces.
- **Supporting fixes.**
  - MCOPY coalesces the `mov r,[S+d] / mov [D+d'],r` rows.
  - DIB pages no longer alias `.text` in the code-page bitmap.
  - Hot-table slots are sticky, so the tail at `0x41de07` reaches its
    threshold.
  - Cut landings end threaded blocks, which fixed a Diablo regression the
    cut exits had caused.
- **Result.** On box2, with `--branch-clock` and 3 interleaved reps:
  - fold on: 4.548 s, band 1.3%;
  - fold off: 4.590 s (+0.9%);
  - the retired build: 4.58 / 4.61 / 4.58;
  - frames md5-identical throughout.

Per-site census, fold off:

| head | status |
|---|---|
| `0x41ceb0` | trace, 36 insns |
| `0x41cef6` | head-unsupported, dead |
| `0x41cf0f`, `0x41d1b6`, `0x41d4ca`, `0x41d7a0`, `0x41d7db`, `0x41dab9`, `0x41daf3` | traces, 160 insns |
| `0x41ddcd` | trace, 149 insns |
| `0x41de07` | trace, 137 insns, through `popad` |
| `0x41e007` | trace, 32 insns |
| `0x41e085` (`popad`/`ret`) | declined, no back edge |
| `0x41e08a` | declined |

The fold's slot 427 is now `$th_retired_fold`. `--no-fold=rect-run` and
`--no-rect-run` no longer exist.

## Original browser city gameplay (2026-10-30)

Run `scratch/runs/20261030T2200Z-caesar3-city/retry/` used the retained
installer-produced payload in local Chrome 151, served only on localhost.
The loaded JavaScript and launch-time source hashes match main commit
`d4fb06b46`; the frozen gameplay module SHA-256 is
`1dbddeafbeff685596095d18a4fd9240820b00b0fa293d21ac03393f9f652fb1`.
`launch-source-commit.json`, `source-assets.json`, and `retry/requests.json`
retain source, installed-file inventory, and observed HTTP response hashes.
The app reported 112 mounted data files. HTTP evidence contains 80 installed
payload responses, including the EXE and real SMACKW32 DLL; it is not a
claim that every mounted file has a separate captured HTTP response.

Puppeteer dispatched ordinary browser mouse/key events: dismiss title,
Start new game, type Codex, Continue, To the city, select road/housing tools,
place roads and housing, then select and place a well and prefecture. Page
capture listeners recorded trusted events; no guest-memory edits or injected
game-state changes drove construction. Read-only export samples recorded
presentation counters. An observer briefly changed the viewport through
Puppeteer's default viewport behavior; it was restored to 1100x850 before
continuing, and the affected commands/captures remain in the evidence.

Personally inspected captures show actual progression:

- `city-initial.png`: January 500 BC, population 0, treasury 2000.
- `roads-and-houses.png`: April, population 15, new road branch, tents and
  arriving settlers. The road button's tooltip says **Build roads**.
- `city-growing.png`: June, population 36, more tents and plots.
- `city-later.png`: the original **First fire** tutorial; population falls
  as houses burn. This is game simulation, not an execution trap.
- `water-placed.png`: July, population 45, a built well beside housing.
- `prefecture-near-road.png`: the prefecture is built for 20 denarii.
- `occupied-tent.png`: September, population 41; the guest's own **Large
  tent** information panel reports **7 occupants**.
- `city-september.png`: inhabited settlement, well, prefecture, walkers,
  and ruins left by the earlier fire.

All names above are under `retry/`. Each PNG is identified by SHA-256 in the
run's artifact manifest. Presentation samples increased from 1220 to 4134
and beyond; the logical-frame address/count remain zero. Those are separate
samples, not atomic screenshot/frame-counter pairs or an FPS measurement.
The first attempt lost its browser connection after housing placement;
its evidence is retained without an inhabited-city claim. A detached retry
completed gameplay and closed its browser and private server normally.

`node test/test-caesar3-gameplay.js` passed. A detached
`flock /tmp/wine-build.lock bash tools/build.sh` also passed; that later build
includes concurrent GL work and produced module `d69d1158f7707c8f...`, distinct
from the frozen gameplay module above. No Caesar execution blocker requiring
a runtime repair was reproduced. This records city construction and
inhabitation, not completion of the assignment's population-150 objective.
No Boat, public deployment, or asset replacement was used. Next useful
gameplay work is sustaining services and reaching that assignment objective.


## Population extension with services (2026-10-30)

Run `scratch/runs/20261030T2213Z-caesar3-pop150/` advanced ordinary browser
city gameplay to a personally inspected **126** in October 499 BC; the final
November captures show **124**, treasury 1152. **Population 150 was not reached.**
The earlier session had no retained city save, so this run used its known menu
route and expanded a fresh city rather than repeating startup investigation.

The browser used the exact retained `1dbddeafbeff685596095d18a4fd9240820b00b0fa293d21ac03393f9f652fb1`
module from the preceding run. Its compiled-source identity remains the preceding
run's retained provenance; it is not a build of the current source. Current
launch-time source commit/hashes are in `launch-source.json`, and HTTP response
hashes in `requests.json` identify resources actually served. The installer-produced
payload remained unchanged; `assets-check.json` verifies 93 observed installed-file
responses, while the app reported 112 mounted files. Local Chrome 151 ran with
SwiftShader, no guest Worker, and a fixed 1100x850 viewport. Browser mouse/key
inputs were trusted native events; construction and progression used no guest
memory edits. The only page evaluation beyond the launch was evidence inspection.

Personally inspected checkpoints include March 500 BC population 36, April 62,
November's first-100 milestone at 102, September 499 BC population 111,
`population-last-expansion.png` at 126, and `final-return-city.png` at 124.
`engineer-staffed-check.png` shows all five employees and an engineer out working.
`prefecture-november.png` and `east-prefecture-final.png` show fully staffed
six-employee prefectures out patrolling at separate stages; `east-well-final.png`
shows the eastern well's native information panel. The final occupied dwelling
is a **Small tent with 5 occupants**. Its panel explicitly reports that the nearby
prefecture harms desirability. Earlier fire/collapse notices, nonadjacent engineer
warnings and failed placement attempts are retained, including unsuccessful Senate
placements; no Senate construction or employment diagnosis is claimed.

The concrete remaining gameplay gap is service coverage and housing evolution:
old-quarter fires/collapses repeatedly offset immigration, while the final eastern
tent remains small beside the prefecture. Built wells and staffed prefectures were
demonstrated over advancing time, but sustained citywide coverage and the 150-person
objective remain unproven. Next play should separate prefectures from housing,
provide garden desirability, and protect the old quarter while filling the new
streets. `save-dialog.png` records the native Save game rejection, **Not available
in the demo version**, so there is no ordinary save to hand off.

`node test/test-caesar3-gameplay.js` passed on the separate current build observed
as `7e8d3194fd189a8e...`; this does not qualify that module for the extended city
route. No runtime code was changed, execution blocker reproduced, or full build
required for this documentation-only outcome. The bounded browser controller was
quit explicitly, its Chrome/server closed, and local endpoints were checked closed.
No Boat, assigned box, public deployment, FPS or audio qualification was involved.
Exact captures, input history, hashes, cleanup and the partial outcome are retained
in the run's `result.json` and artifact manifest.

## Protected city, staffed Senate, and population 148 (2026-10-30)

Run `scratch/runs/20261030T2240Z-caesar3-protected/` made one bounded local
browser gameplay attempt with a recovery launch. Its **highest and last
personally inspected population was 148**, November 498 BC through January
497 BC; the last capture shows treasury 557. **Population 150 and an assignment
transition remain unproven.** The browser closed at its 28-minute controller
deadline, 46 seconds after that final capture, so this is the observed peak,
not an assertion about every intervening simulation tick. The final queued
engineer-post/growth-check commands were never executed.

The retained browser module is exactly
`1dbddeafbeff685596095d18a4fd9240820b00b0fa293d21ac03393f9f652fb1`.
`original-source-assets.json` and `original-launch-source-commit.json` preserve
the preceding run's source identity at `d4fb06b465988b52d98f5c9299c47c8391537f1e`;
this run did not reconstruct that module from current source. Current launch
source hashes and actual HTTP response hashes are retained separately. Installed
payload checks matched all 86 observed installed-file responses against both
disk and retained hashes; the app mounted 112 files.
Chrome 151 used SwiftShader, a fixed 1100x850 viewport, and no guest Worker.
The final inspected history contains 451 trusted input events and no untrusted
events. Gameplay used browser mouse/keyboard events without guest memory,
state, or asset edits. The normal existing launcher profile was unchanged.

Useful inspected progression and constraints:

- The first fire tutorial explicitly unlocks the prefecture only **after**
  the first fire. The first collapse similarly unlocks the engineer. A western
  prefecture had all six employees and a prefect patrolling at population 63;
  an engineer had all five employees and was out working at population 70.
- A cleared cross street provided a separate expansion. A genuinely built
  Senate, unlike the preceding run's failed placements, showed **30 of 30
  employees** and complete efficiency at population 97. Its placement preview
  had shown unemployment of 74%; later growth followed its construction, but
  this is not a controlled attribution of the population stall.
- The city displayed its first-100 milestone at population 103. Labour and
  Population advisors explicitly said **Not available in this assignment**.
  A branch dwelling was a **Large tent with 28 occupants**, whose native panel
  required a local market for further evolution.
- Clearing a nearby temple footprint accidentally demolished the Senate.
  The temple also lacked road access. It was removed and the Senate rebuilt;
  the restored Senate again showed all 30 employees. These were construction
  errors, not reproduced emulator defects.
- A short western street beside the existing service end, individual housing
  placements, and a new well brought the city from 103 to 126 and then 148.
  Two final plots remained vacant in the last capture. Their sustained
  occupation and the remaining two citizens were not demonstrated. Citywide
  protection and a functioning temple were not qualified.

For replay, cancel tools or dismiss information panels by right-clicking the
blank sidebar, e.g. `(740,750)`. Right-clicking bare map terrain instead opens
another native information panel. Use individual placement clicks with distinct
press/release slices; the fast drag helper was unreliable for this route.
Spacebar is the demonstrated native pause control. Large footprints need room:
clearing one occupied footprint cell removes the whole building. Keep the Senate
and any future temple sites well separated and verify road access before growing
the residential block. No working demo save is available from the preceding
native Save game rejection, so the next attempt still requires a fresh city.

The first Chrome launch was externally terminated by SIGKILL after the initial
population-zero capture; its cause is unknown and its evidence is preserved.
The recovery browser ran until its bounded deadline. Both private servers and
Chrome processes were verified gone, endpoints closed, and profiles removed.
No Boat or assigned box was used (ID/state/expiry not applicable); no public
deployment or workers were launched. Disk remained above 2 GB.

`node test/test-caesar3-gameplay.js` passed on the separate current build.
No runtime code changed, so no full build was needed for this documentation-only
outcome. Exact inputs, inspected capture hashes, source/module/assets provenance,
cleanup, and the remaining limitations are retained in the run's `result.json`.

## Early western expansion interrupted by browser termination (2026-10-30)

Run `scratch/runs/20261030T2316Z-caesar3-final/` made one bounded original
browser attempt with one recovery launch. **Population 150 and the objective
transition remain unproven.** The first browser's last inspected frame shows
population **61**, March 500 BC, with the western street, individual housing
plots, and well already built. The recovery's last inspected frame shows
**64**, April 500 BC. These are sampled observations, not final simulation
counts: both browsers subsequently disappeared before the next capture.

The concrete execution interruption is retained in `browser-exit.json` and
`recovery/browser-exit.json`: Chrome PIDs 1109572 and 1116305 exited with
**SIGKILL** at 23:19:40 and 23:27:40 UTC. Subsequent screenshots failed with
`TargetCloseError`. The sender and cause are unknown. Readable cgroup
`memory.events` counters through `user.slice` showed zero OOM kills when
inspected; kernel logs were unavailable. This does not establish a gameplay
or emulator defect, and no speculative repair was made. See
`termination-diagnostics.json` for the diagnostic boundary.

This replay moved the demonstrated western layout into March 500 BC rather
than leaving it until late growth. It used individual placements and native
Spacebar pause. A separate road connector and Senate clearing were prepared,
but the administration button was still disabled in the inspected April frame;
**no Senate construction or staffing is claimed**. Prefecture and engineer
staffing were likewise not reached in this run. The native speed dialog showed
90%, followed by an ordinary browser click on its increase control. Further
water placement and growth-check commands were attempted, but the browser
termination prevented their visual qualification. The failed temple placement
and accidental Senate demolition from the preceding run were not repeated.

Both launches used the retained browser module
`1dbddeafbeff685596095d18a4fd9240820b00b0fa293d21ac03393f9f652fb1`, with its
original source manifests copied into the run. First-launch source hashes and
actual response hashes for both launches are retained separately; this is not
a claim that the retained module was rebuilt from current main. All 114
inventoried installed files still matched the original recorded hashes; 206
observed installed-file responses across both launches, covering 113 distinct
files, matched disk and original hashes. The app reported 112 mounted data
files. The last successful input snapshots contain 88 and 164 trusted events,
respectively, with zero untrusted events. No guest state, asset, or additional
profile patch drove gameplay.

`node test/test-caesar3-gameplay.js` passed on the separate current module.
No runtime source changed and no full build was required. Both private servers,
browsers, and controllers were closed or verified absent, known ports were
closed, and private profiles removed. No Boat or assigned box was used
(ID/state/expiry not applicable). Before another fresh city, identify the
repeated Chrome SIGKILL source or provide a browser lifetime that survives the
growth window; native demo saves remain unavailable. The gameplay follow-up is
still unlocked staffed protection, a verified Senate, and inspected population
150 plus the assignment transition.

## Current pinned private-box replay: population 76, staffed protection, riots (2026-11-12)

Evidence: `scratch/runs/20261112-caesar3-current-population-assignment-0927/`,
with the joined successful allocation under `fresh/`. This is an incomplete
population/assignment attempt, not a new qualification: the previous 148 remains
the highest demonstrated population. No emulator source changed or speculative
repair was made. The original demo's disabled Save remains outside acceptance.

The run verified the original installed EXE, SMACKW32, and 112 data files using
the retained installer provenance manifest. Runtime source was pinned to
`8a834a3dc7affc8c6e53245beab56e87a32b81e8`, excluding shared WIP; the actual
compiled browser module was independently captured as
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
The approved expected-byte name profile was unchanged. All 684 remote input pins
passed before browser launch and again after normal runtime closure.

The original title → Start New Game → name C → Continue → Assignment 1 → To
the city route was reviewed in full frames. Construction used native Space
pause, individual balanced trusted clicks, sidebar cancellation, and the native
speed dialog (90% to 100%). First fire and first collapse unlocked protection.
Final native panels report **prefecture 6/6, out patrolling**, and **engineer
5/5, out working**. The first prefecture had staffed successfully but collapsed
before an engineer was available. The Senate unlocked; its attempted large
footprints were rejected on uncleared land, so no Senate construction or
employment is claimed.

Cleared western housing grew the city to **76** in February–April 497 BC. A
reviewed Small tent panel had **5 occupants** and reported poor desirability
from a nearby Small tent. The native **Rioting in the city** message then cited
desperate conditions; buildings were destroyed. The final paused June 497 BC
frame shows **population 53, treasury 1545**. Initial fire losses, one accidental
occupied-house clearing, uncleared vegetation, and delayed services/layout were
play/construction errors. They do not establish an emulator failure. Population
150 and the assignment transition remain unproved.

The changed lifetime approach was a fresh private box with an independently
prearmed immutable 55-minute watchdog, actual joined provisioning and full hash
closure before browser launch. Chrome survived the play window and closed
normally (code 0, no signal); no SIGKILL recurred. Actual runtime parent wait
returned 0 with both EOFs, browser/Chrome/owner PIDs were absent, the profile was
removed and its private port closed. Unique module/log evidence was compressed
and hashed remotely before recovery. Local helper mistakes (prebrowser manifest
mismatch, stale-frame refusal before input, duplicate capture label) are retained
with their causal boundaries, not hidden or replayed blindly. See `RESULT.md`,
`fresh/final-remote-summary.json`, recovery manifests, and lifecycle stop files.

The actionable next replay needs cleared and watered early housing frontage,
both protections immediately after their unlocks, a separate cleared Senate
site connected to the road, and tent desirability/services addressed before
years of growth. This attempt ended within its bounded lease after gameplay
setbacks; it found no new emulator blocker.

Recovery verified 1,085 file references (1,081 distinct hashes), with independent
remote rereads and raw/compressed module validation. The successful box
`bx_tk77y82n` is **archived**, stopped at `2026-11-12T10:23:37.243Z`, expiry
NULL; receipt `stop_b25688f8b7c4698b` completed, unforced, error NULL. The
initial prebrowser box `bx_55fgj8cg` was also archived normally. Watchdog parent
wait returned 0 with EOF. The local long launcher returned 143 and its
manager-parent wait record is absent; that manager exit remains unknown,
separately from the verified remote runtime parent/Chrome normal exits.
