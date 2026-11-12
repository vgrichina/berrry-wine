# Quake III: bounded capture and controlled Major follow-up, 2026-11-12

This follows [the controlled-frag attempt](quake3-controlled-major-frag-20261112.md)
(`f7bea4c4b`). Its archived original request remains **UNKNOWN**, with no replay.
The earlier Up → Back sequence did not select I Can Win. Bring It On and Back
were the actual visible states; no easier difficulty is inherited here.

Evidence is under `scratch/runs/20261112-quake3-capture-completion-major-1910/`
and its `-screencast`, `-browser-compositor`, and `-trusted-motion` siblings.
Each has exact source Git/pins and run helper patches. Game media is referenced
by path and SHA, not copied into an evidence archive. The original registered
`quake3_demo` uses pak SHA
`e77abad2466f45a0a7ea018445528f9b95a0fe7789fa1abc1a7718bbf0754b08`
and actual recovered CPU/owning-renderer module SHA
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.

The initial instrumentation records CDP submit/reply times, worker Debugger
attachment/source recovery, compositor tracing, and page/CPU progress while a
screenshot is outstanding. Local Boids complete-frame captures and independent
key/button release controls pass. In the fresh original, complete Choose Level
and Difficulty frames took about 27.3 and 15.7 seconds; another capture reached
the unchanged 30-second bound and remains UNKNOWN. Early outstanding captures
coexisted with responsive page evaluation, rAF and CPU progress. Later page and
renderer evaluation also showed long delays. Debugger source recovery was much
shorter locally. These observations do not isolate a production queue,
readback, compositor or Debugger defect. Trace completion itself was UNKNOWN.

The bounded harness then used native CDP PNG screencast frames, acknowledged by
frame session. It checks native timestamp, complete CSS viewport dimensions,
scale, strict PNG CRC/decode and SHA, and the unchanged before/after binding to
all 22 actual owner fields. It never clips, crops, resizes or substitutes a
frame. This method alone still reached a 30-second UNKNOWN in local original
Quake. A subsequent local original with Chrome `--disable-gpu-compositing`
returned eight complete frames in 51–228 ms, through Difficulty and a later
connection screen, with actual guest WebGL ownership and completed draws.
This Chrome setting does not select guest SoftwareGL. No timeout was increased,
no production code was changed, and the original timeout cause remains UNKNOWN.

A capture-only remote browser with the qualified configuration returned five
complete frames in 49–213 ms and closed normally. Its final screenshot still
shows Choose Level: the label `difficulty-verified` expressed command intent,
not the scene. `fresh-native-route-review.json` explicitly records that limit.
It was retired before combat when an inherited motion-helper assumption was
found unqualified.

The local protocol control proves that CDP `movementX/Y` extras on an unchanged
`x/y` produce a trusted pointer-locked event with zero delta. Varying CDP `x/y`
produces the requested trusted relative delta (80,30), including a subsequent
click/reset/move case (25,-10). The corrected run helper records and verifies
actual trusted DOM movement under screen pointer lock, rather than equating a
CDP ACK with aim. It also fixes the motion action's absent-key list handling.
The unchanged release/binding/observer helpers and 25 negative controls are
reused only by exact SHA; capture and changed motion controls are separate.

The final helper's local original check acquired real screen pointer lock with
a native click, recorded trusted deltas (80,30) and (240,117), and showed the
native game cursor at the corresponding later positions. Input ACK and returned
PNG do not prove that the game consumed the event before that particular frame;
the observed menu change and cursor update appeared in later frames. All local
Chrome, Node and durable owner parents for this final check returned 0 with
stdout/stderr EOF. Six focused native-input tests pass; nine Boids full frames,
including held-key and held-button frames, pass again. The 11 referenced old
proof/helper SHA values were rechecked exactly. No unchanged full matrix ran.

Before the final original launch, provisioning the motion-qualified helper set
hit a separate 30-second 4 MiB PUT deadline, with response headers UNKNOWN.
That attempt stayed terminal; it launched no original and replayed no PUT.
The capture-only box was normally stopped after its unique outputs were
recovered. Its original outer session returned 143 and its manager/watchdog
actual waits are UNKNOWN; Chrome/runtime waits are independently 0/EOF. A
separate authorized lifecycle stop after an independent idle/no-receipt GET
completed normally. Those limits are retained rather than synthesizing waits.

The next bounded upload uses 1 MiB parts and the same strict deadlines and
actual production assembler. A local real HTTP test verifies exact lengths,
ordered assembly and whole SHA, plus corrupt-part refusal before final phase
checks. A durable detached lifecycle parent was added before allocation. All
capture/input/worker helpers are byte-identical to the final local qualified
set; their proofs are referenced by exact SHA in `final-controls-reused.json`.
The new evidence sibling is `-small-upload`. No runtime capture repair is
claimed from this provisioning change.

Final frozen source commit: `ae83f8d550685f98de2f0bd75acf4c7e10a875f4`.
Final import manifest SHA:
`86b92f3bf227ff4044475e38cb99342f5b89d82e64af1e20cbad2385ef591ea3`.
Remote reread/import validation passed for all 893 staged files before launching
the next original. Relevant uncommitted source hunks and all new run helpers
remain recorded as binary patches beside those pins.

The fresh WebGL original returned complete native main, Choose Level and
Difficulty screens. `difficulty-menu.png` shows Bring It On white. A native
click acquired screen pointer lock; trusted relative movement placed the native
cursor on I Can Win, which remained red until the actual click. After that
click it turned white and Bring It On turned red. In
`verified-skill-before-fight.png`, I Can Win remains white with the cursor moved
away to the gold Fight button. This is the new actual UI selection proof;
it does not revise the earlier Up → Back failure. Only then was Fight clicked.
`native-skill-selection.json` binds the reviewed images and SHA values to their
actual owner identities.

The original then loaded Q3DM1 and returned a living arena with health 116,
ammo 100 and score 0–0. Trusted relative motion subsequently changed the actual
native view. Short independently released movement, aiming and fire/retreat
chords produced complete original frames during key/button holds. Major was
visible in the courtyard and later close in the firepit hall, with the native
`Major` crosshair name. Machine-gun muzzle flash, cases/impacts and ammo changes
were visible, followed by a native Shotgun pickup (ammo 10). **None of these is
a player frag.** No explicit player kill message, confirmed outgoing hit or
player score increase was earned; the last reviewed frame shows health 100,
shotgun ammo 10 and score 0–0.

The specific combat limitation was target tracking across reviewed actions:
Major crossed the close hall and passed behind pillars while a correction was
being applied; returned images show shots/impacts away from her current
position. A CDP aim ACK is therefore not treated as a hit or proof that the
correction was consumed before that action's returned frame. There is no proven
runtime input defect or guest hold-duration claim. The next encounter needs a
faster reviewed target-follow/fire interval and confirmation from a kill
message or scoreboard, using the now-qualified complete-frame route.

The final attempted turn was refused **before dispatch** by the actual `/home`
free-space floor. After own closed evidence was compressed losslessly and
identical immutable outputs were linked with exact byte/SHA checks, free space
was 1,494,900,736 bytes, below 1,500,000,000. The task applied no reserve change
and no RAM gate. A normal browser quit was acknowledged; evidence recovery and
normal delegated box shutdown followed. `final-resource-block.json` retains
the measured refusal and unearned frag scope. No paired SoftwareGL combat was
started, because a WebGL controlled frag had not been earned. The paired/full
27 scope remains open; no parity, FPS, audio or broad crash-free claim is made.

Final recovery independently fetched each of 331 paths twice and verified raw
size/SHA. Offline strict decode/CRC checks passed for **42 complete 1024×712
PNGs** (one host-shell startup frame), **41 full 22-field game bindings**, **nine original held full frames**, and
**17 key/button holds** with acknowledged independent UPs and release-parent
0/EOF. Ten actual trusted relative-motion receipts match the requested deltas.
All 32 ordinary native snapshots recover actual 04 CPU and owning 04 renderer
scripts, a real WebGL context and positive completed/draw/present counts.
The native full-frame completion intervals are 26–131 ms in this bounded run;
these are capture intervals, not game FPS. `retrieval-verified.json` and
`actual-owner-motion-verified.json` contain the counts and scope.

All boxes created by this task are archived, with final expiry **null** and
completed unforced stop receipts (error null):

| Box | Stop receipt | Completion UTC |
| --- | --- | --- |
| `bx_d8ejaamr` | `stop_0529e4a0d0dd4f0b` | 19:28:55.037 |
| `bx_nfch7ctw` | `stop_2bb77197ecf5baa6` | 20:01:05.043 |
| `bx_uzj8t7gk` | `stop_cda95637c766518e` | 20:27:00.299 |

The final independent GET agrees with the manager's archived state/receipt.
Final Chrome and Node parents returned 0 with separate stdout/stderr EOF.
The durable lifecycle parent, manager parent and actual independent watchdog
wait also returned 0/EOF. The remote owner process's outer Popen parent has no
actual wait receipt and remains UNKNOWN. The intermediate screencast-only
local run likewise has outer execution 143 and Node/owner waits UNKNOWN;
its Chrome close is 0/EOF. These do not inherit the final run's clean joins.
The second box's lost manager/watchdog parent waits remain UNKNOWN as above.

This is a docs-only tracked change with ignored run-local harness fixes. No
production capture defect was proved or production code changed, so no runtime
repair/build or matched-original causal-repair claim is made. Focused controls,
unchanged exact-SHA proofs, native menu/arena evidence and final recovery checks
are the validation. Parent/root artifact review remains pending. Next is a
fresh controlled Major encounter with sufficient actual disk headroom, retaining
the frozen full-viewport/owner requirements and faster target-follow/fire review;
paired SoftwareGL combat and full-27 acceptance remain open.
