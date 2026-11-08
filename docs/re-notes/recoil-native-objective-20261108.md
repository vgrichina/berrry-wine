# Recoil original demo: native objective, 2026-11-08

Run: `scratch/runs/20261108-recoil-native-objective/`.

This single fresh-box run follows the accepted movement/turn/pulse work in
[recoil-current-gameplay-20261107.md](recoil-current-gameplay-20261107.md).
It uses the unchanged registered original demo and the supplied 107 original
file pins plus manifest pin; no guest/configuration/clock state is edited.

The reviewed native Mission 1 brief, “1.1 Operation Short Circuit,” says:
the force field above the beach blocks access to the hilltop enemy base;
find the force-field power control and destroy it. Its map marks the start
on the east side of the island. The ordinary Software → OK → Game → Start →
New Game route retains the default user and Medium difficulty. The opening
plays naturally without skip input.

**New enemy destruction passed.** No emulator change was needed. The tank
remains at the starting beach: this run does not repeat forward/turn holds.
After reviewing the brief and R/O panes, ordinary relative mouse aim targets
the unobstructed right-hand green biped beyond the wreck. Green reticle
triangles identify a damageable object under the included manual's description.
A bounded 1.8-second primary left-button burst produces a target explosion,
debris and score increase, followed by the target's disappearance.

Personally reviewed evidence, relative to the run:

- `original/mission-brief.png`: native mission description and island map.
- `original/gameplay.png` → `original/mission-review.png` →
  `original/objective.png`: R opens the transmission pane, initially static;
  O exposes Operation Short Circuit statistics: objectives 0/4, enemies killed
  0/102, score 0. The original text continues appearing naturally.
- `original/biped-aim.png`: the reticle is centered on the right-hand biped
  with green triangles; the pane now visibly repeats the force-field power
  control objective. Both brief and live objective text were reviewed before
  choosing this enemy as the immediate target.
- `original/held-1794104044308.png`, `held-1794104044979.png`,
  `held-1794104045593.png`, `held-1794104045964.png` (all in `original/`):
  target initially intact, outgoing cyan pulses, a scout crossing the line
  of fire, and a large blue-white effect near the end of the hold. That last
  effect alone is not treated as proof of target damage.
- `original/biped-after.png`: score **0 → 1550**, orange explosion at the
  targeted biped, flying fragments, and a burning target image in the lower
  left pane. `original/kill-stats.png` is the settled follow-up: that biped is
  absent and score remains 1550. Despite its command-derived filename, this
  image shows mission text, not a readable post-kill numeric counter. No
  exact kill-count increment or completed mission objective is claimed.

Health had already fallen from 76 to 53 before firing and reaches 47 after
the burst, then 42 in the settled view. This is incoming player damage,
separate from outgoing destruction. The green reticle, target-centered orange
explosion/debris, persistent score gain and missing target together support
the enemy consequence; cyan muzzle flashes alone do not. Other enemies remain.
The force-field objective is reviewed but not completed.

The source is main `7849be78c2c4cac23bbe3ab6f9ec6e0d26926a73` plus the empty
`relevant-source.patch` and retained pre-existing untracked
`new-lib_wininit-boot.js.patch`. `runtime-pins.json` records 726 individually
staged closure/input files, and `fixture-identity.json` records media paths
and hashes. All 108 supplied fixture pins pass unchanged. Original executable:
`82632b1b46153014af0caf1e0c9dfdebbb0d8482ba65b2735064f10972afa076`.
The actual CDP-recovered guest module matches the staged build:
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
Git and the recorded patches are the source archive; no source/media archive
was made. Owned new inputs and this note are also preserved as patches.

The environment is headless desktop Chrome 151.0.7922.108, V8 15.1.206.16,
1024×768, cross-origin isolated, Threads enabled, registered route
`/index.html?debug&threads&app=recoil_demo`, unchanged defaults. The game selects
Software; the observed renderer is the page's Canvas2D renderer, with no owning
D3D render-worker endpoint. Software Canvas2D does not establish GL coverage.
The live game is process 1000, endpoint 1, slot 0; the captured guest Worker
target is `ACF66C91F816A3BB1129559B5579A9A0`, document epoch
`b3aa39e5-5f46-42fd-8a0a-72b9c23e5a0d`, renderer object `epoch:5`.

The prior qualified capture/admission/ACK driver is reused, retaining its
120-second reviewed-scene bound, object/epoch/module checks and sticky UNKNOWN
closure. Run-local extensions admit the documented R/O/M/C/V/Backspace keys
and an optional right-button burst; only R/O and primary fire are used in
gameplay. Focused key/release checks pass; right advanced fire is not qualified
by this run. Native browser key/type/combo preflights pass. Each dependent
view was personally reviewed before its next input. There are 18 contiguous
successful numbered ACKs, zero UNKNOWN outcomes, and no input replay.

Validation: locked `tools/build.sh` passes; local HTTP checks pass for 113
fixture/dependency URLs; all 726 runtime pins pass again after the original.
All 32 recovered PNGs pass CRC/IDAT decoding and capture hashes. The 1,893-ms
physical burst has 14 passive held frames, 13 canvas hashes, stable document
and renderer owners, and guest sequence 25168→25371. These counters do not
measure simulation steps or FPS. `evidence-check.json` retains the checks.
Owned evidence containment and note whitespace checks pass. The repository-wide
evidence checker still reports seven unrelated containment errors.
An unresolved run-helper import was caught and restored locally before box
allocation; there was one original browser launch and no original retry.

All **234 remote artifacts / 15,585,560 bytes** were retrieved and independently
SHA-256 verified before normal shutdown. Unique modules, logs and captures are
retained. The browser exited 0, all 15 recorded PIDs disappeared, HTTP/CDP ports
refused connections, profile/writer lock were absent, and keys/buttons were
released. The detached independent 25-minute watchdog was armed before the
UUID-idempotent allocation; both lifecycle children exited 0 and the supervisor
finished with no children. Box **`bx_hbb9765a`** is **archived**, stopped at
**02:15:16.774Z**, expiry/archive-after **null** (initial expiry
02:34:57.693Z). Stop **`stop_4d5138b6250029a5`** completed at
02:15:16.794Z, **forced=false**. The final GET receipt is retained locally.
Sampled local free disk remained above 5 GB; no RAM gate, resume, delete or
public deployment was used.

Next: follow the reviewed force-field power-control objective in a separately
bounded run. FPS, audio, full playability, physical phone, WebKit, accelerated
rendering and native-game parity remain separate.
