# Recoil force-field objective attempt, 2026-11-08

Run: `scratch/runs/20261108-recoil-forcefield-objective/`.

**Objective incomplete; the first new gameplay limitation is loss of the tank
while locating the beach exit.** One fresh original reached Mission 1 through
Software → OK → Game → Start → New Game, default `user`, Medium, with the opening
playing naturally. There was no restart, combat firing, starting-biped
destruction, objective-counter increment, demonstrated force-field removal or
onward access. No emulator mismatch was established and no production code or
game media was changed. The earlier movement and score-1550 enemy destruction
acceptances remain in the linked prior notes, not this run's deliverable:
[current gameplay](recoil-current-gameplay-20261107.md) and
[native objective](recoil-native-objective-20261108.md).

The installed `game/docs/index.html` manual was read, including arrows, relative
aim, R/O mission panes, M wireframe map, C turret-to-chassis centering, V camera
perspective and Backspace chassis-to-turret centering. The fresh native
`original/mission-brief.png` repeats “1.1 Operation Short Circuit”: the force
field above the beach blocks the hilltop enemy base; find and destroy its power
control. Its map marks the start on the island's east side. The manual describes
green reticle triangles as damageable targets, not proof of mission relevance.

Personally reviewed route evidence, relative to the run:

- `original/gameplay.png`, `mission-review.png`, `objective.png` and
  `route-map.png`: beach wreck and enemies, R transmission pane, then O statistics
  **objectives 0/4, enemies killed 0/102, score 0**. The text subsequently states
  the force-field power-control task. M opens the wireframe map over the terrain.
  The screenshot health readings are 83, 77, 72 and 67 respectively; the first
  two command-review prose estimates (81 and 80) are incorrect and superseded
  by these images.
- `original/past-wreck.png`: a 700-ms Up+Right hold moves/turns past the wreck,
  exposing open sand and the cliff base, with the concrete wall to the left.
- `original/cliff-approach.png`: a 2,004-ms forward interval reaches the steep
  cliff face. This is an obstacle, not a traversed beach exit; health is 37.
- `original/cliff-left.png`: a 1,301-ms left turn exposes an uphill paved ramp
  with distant red/green gate structures at the far left; health is 23. Neither
  a power control nor the gate's force-field identity is established.
- `original/road-aligned.png`: despite its command-derived name, the subsequent
  450-ms Up+Left arc **overshoots** that route. The ramp is now at the far right,
  the view faces beach vehicles, health is 12 and score remains 0.
- `original/ramp-view.png`: the next capture shows the destroyed player tank,
  flames/debris and the native Load Game / New Game / Quit menu. This is player
  death, not target destruction or objective progress. The final 180-ms Right
  correction has no demonstrated living-tank response: its first passive held
  frame, `original/held-1794122311228.png`, already shows the death menu. Death
  lies between the last living capture at **07:18:09.101Z** and that held frame
  at **07:18:31.228Z**; its exact instant is unmeasured. The correction is not
  claimed to have caused death. No further gameplay input followed review of it.

In-hold frames `original/held-1794122247983.png` and
`original/held-1794122271668.png` were also reviewed. They show cliff approach
and incoming cyan fire near the tank. No outgoing attack or power-control damage
is attributed to these effects. The last readable objective counter remains
the initial 0/4; no post-death numeric objective reading is available.

The initial locked shared-tree build **failed before compilation** at the
producer census for peer-owned `host.js`, `lib/guest-thread-host.js` and
`lib/thread-manager.js` WIP. `build.log` preserves that failure. Following the
coordinator's messageboard clarification, the tested runtime instead uses
published Git blobs from **`59abb98bf4bd1fdb51e4aacb30038256042885ad`**, individually
staged without the active peer WIP. The published WAT closure was compiled in
memory with unchanged, hash-checked published compiler tools; no second checkout
or source archive was created. `published-compile.json` pins every WAT input,
and `compiler-provenance.json` verifies the compiler files against that commit.
The actual CDP-recovered original and local Calc modules match the compiled pin:
**`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`**.
This does not turn the failed shared-tree build into a passing build.

`runtime-pins.json` records all **726** staged closure/input files and their
Git/artifact providers. The existing untracked `lib/wininit-boot.js` is retained
as its explicit patch. The tested published-source patch is empty;
`excluded-peer-wip.patch` records the untested shared changes separately.
All **107 original files plus the existing manifest** match the supplied pins;
all **113** local HTTP fixture/dependency checks pass. Game files are referenced
by path and SHA-256, not archived into evidence. The executable remains
`82632b1b46153014af0caf1e0c9dfdebbb0d8482ba65b2735064f10972afa076`.
The first `fixture-identity.json` mistakenly used empty `app.files`; its
zero-file success was vacuous and is withdrawn, preserved separately as
`fixture-identity-invalid-zero-files.json`. The corrected report follows the
actual `localFileManifest`: **106 manifest entries + executable = 107 originals**,
plus the manifest pin, **76,019,820 bytes** altogether. Every supplied path,
size and SHA matches a staged runtime pin. `fixture-regression.json` rejects
empty, missing and duplicate registrations and a wrong staged executable hash.
The preparation helper was corrected for future use; the original was not replayed.

The unchanged qualified capture/admission chain retains exact owner/module
identity, screenshot hashes, original capture timestamps, the 120-second
review bound, independent release and sticky UNKNOWN closure. Real-Chromium
generated controls pass owner replacements, stale/slow capture, slow sampler,
partial delivery, UNKNOWN/late ACK rejection, relative motion, trusted mouse
down/up, and trusted R/O/M/C/V/Backspace down/up with released key states.
R/O/M semantics were observed in the original; C/V/Backspace were qualified for
native delivery locally, not exercised in gameplay. All **21** original numbered
commands have exact successful ACKs; no original UNKNOWN or input replay occurred.
The `fire`-named menu operations only select New Game and Start.

Two local staging failures are retained: a compile helper initially read the
wrong compiler-result property, and the first local Calc server supplied Git
bytes with working-tree content lengths, truncating changed JavaScript. Both
were corrected before box allocation. The second Calc run confirmed the actual
published module and live owner chain. All local browsers/PIDs/ports/profiles
were drained before the original. These are helper failures, not guest fixes.

The environment is headless desktop Chrome 151.0.7922.108, V8 15.1.206.16,
1024×768, cross-origin isolated, Threads enabled, registered unchanged route
`/index.html?debug&threads&app=recoil_demo`. The original selects Software.
Observed rendering is **software page Canvas2D**, with no owning D3D render-worker
endpoint; the toolbar's WebGL selection is not backend proof. Original process
1000 / endpoint 1 / slot 0 and document epoch
`3b6f7b42-7007-4f56-8768-5905d2b51eac` retain software renderer object `:5` in the
passive monitor. Physical hold intervals and passive guest/canvas changes do not
measure simulation steps or FPS.

All **307 remote artifacts / 26,957,532 bytes** were retrieved and independently
SHA-256 verified before normal stop. The first post-quit inventory asserted
before all PIDs disappeared; that exact failure is retained. A separate later
read-only observation and settled inventory confirm all **15** recorded PIDs
absent, HTTP/CDP ports refused, profile/writer lock absent and inputs released.
No browser or input was relaunched to obtain that observation. The independently
prearmed 25-minute watchdog and normal-stop child both exited 0; the supervisor
finished with no children. Box **`bx_8547pftx`** is **archived**, stopped at
**07:19:52.506Z**, final expiry/archive-after **null** (initial expiry
07:37:54.570Z). Stop **`stop_b32ed826a009544a`** completed at **07:19:52.526Z**,
**forced=false**, error null. `final-stop-receipt.json` retains the final GET.
Sampled disk stayed above 5 GB. No resume/delete, RAM gate or public deployment
was used.

`evidence-check.json` passes published-provider pins, the real nonempty fixture
closure, **68 original PNG CRC/IDAT/hash checks**, exact ACKs, bounded releases,
actual module equality, retrieval hashes and complete runtime/lifecycle drain.
Owned result containment/schema and note whitespace checks pass. The repository
evidence checker retains seven unrelated containment errors.

Next: a separately authorized fresh attempt should take the now-visible uphill
ramp earlier, with a shorter observation/decision interval before incoming fire
exhausts health. Identify the actual power control from fresh terrain/reticle
evidence before attacking, then require objective text/counter change or proven
force-field/onward-access consequence. No source fix is justified by this run.
Full27, parity, audio and unmeasured FPS remain open.
