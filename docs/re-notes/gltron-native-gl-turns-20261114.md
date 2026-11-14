# Original GLTron: actual native GL live turns, 2026-11-14

The registered original GLTron rendered through actual native `--headless-gl`,
made two reviewed live A turns in the final fresh round, and reached the natural
**PLAYER 3 WINS!** result. No production source was changed. Evidence is in
`scratch/runs/20261114-gltron-native-gl-turns/result.json`.

## Actual renderer and inputs

The passive observer records one successful native context, successful binding
of context 1 to owner 0 and hwnd 65537, `currentByOwner=[[0,1]]`, and
`gl_sw_enabled=0`. Authentic guest presentation commands produced native
readbacks, initially black during asset loading and then nonblack. The run
completed 2,952 authentic presents/native readbacks, 460,592 executed draws and
18,189,063 vertices. No later context creation or binding switch appears in the trace. The selected compositor images were individually viewed.
This is actual native WebGL on llvmpipe LLVM 20.1.2; it is not physical-GPU,
browser, parity or historical 27-app acceptance.

The original 92 media paths were unchanged. The actual module read was
2,199,488 bytes, SHA-256
`c7f5bada4da4b4ed95b235add0aa1c9843176805d29d5b1ee79359752a19d348`.
The tested main commit was `3ea50a0f34264ebd94d9c7a908e54d3eb5a2571f`.
All 317 launch source pins remained unchanged; all 300 overlapping predecessor
pins matched. Git plus the retained binary source diff and addition patches
preserve the dirty runtime identity, without a source archive or module dump.

The command used the registered app, `--no-build --no-threads --headless-gl
--real-ticks --max-batches=1000000000 --max-seconds=240 --quiet-api
--quiet-blocks --gl-census --control-stdin --png-canvas`. No batch-size override
was supplied: the default was **1,000 blocks**. The observer wraps existing
context/bind/present/readback/compositor functions without additional rendering,
readback, swap or forced-presentation calls. No software fallback was selected.

## Reviewed final round

All image names below are relative to the evidence directory.

* `native-main-menu.png`: fresh original main menu after ordinary asset loading;
  Return opened Game, then ordinary Start Game entered gameplay.
* `native-last-start.png`, batch 175880: after the preceding natural result,
  ordinary Return started the final fresh round and Space paused it. The yellow
  cycle is intact, its initial trail is short, and **GAME IS PAUSED** is visible.
  The console's old crash/winner lines persist across rounds.
* `native-last-corner-one.png`, batch 180741: after Return resumed and a finite
  A down/up at 180019/180045, the intact cycle faces a changed world orientation.
  The yellow minimap trail has a visible bend near its lower-right start and a
  northbound leg. Space pauses the settled frame, 696 batches after A-UP.
* `native-last-corner-two.png`, batch 187994: after another separately reviewed
  Return resume and finite A down/up at 187238/187273, the intact yellow cycle
  faces a different wall/trail orientation and the yellow endpoint reaches the top of its preceding northbound leg.
  The new westbound horizontal minimap leg is not clearly rasterized;
  cycle, camera, world and endpoint changes support the second live turn.
  The pause banner is present, 721 batches after A-UP.
* `native-natural-result.png`, batch 195578: ordinary Return resumed with no
  more steering; yellow debris shows the player's natural crash.
* `native-final-outcome.png`, batch 202646, guest-ms 237984: new round console
  entries culminate in WINNER: 3 and the large **PLAYER 3 WINS!** banner.
  The shutdown frame was also viewed and shows that same result.

Each selected turn followed review of the current intact cycle, forward path
and minimap; focus remained hwnd 0x10001. The control publisher reserves IDs
exclusively, claims before sending, never replays UNKNOWN, and prearms each
independent finite 80-ms UP timer before DOWN. ACKs establish release and batch
progress; the viewed geometry establishes turns. There was no route automation,
tracking, guest-state/configuration/clock/AI write or synthetic GL publication.

Earlier rounds are explicitly rejected as turn proof. The initial start/pause
commands were consumed during transition and the first round reached PLAYER 4
WINS. In the next round, attempting Space as resume produced no reviewed corner;
a later settled frame showed yellow crash debris (`native-corner-one-settled.png`).
That round was allowed to finish naturally before the final fresh round. Return
was then used to resume from the visually verified native Space pause, as in the
successful predecessor. No failed or dead turn is counted above.

## Recovery, checks and lifecycle

The predecessor had removed its regenerable native install. Its retained npm
lock and offline cache restored glfw 7.4.1/webgl 6.0.3; all 162 dependency file
hashes exactly matched. Initial native preflight failed the resized-buffer
right-edge readback assertion. An unchanged repeat passed the complete native
shader/readback/compositor test. Both logs are retained: the intermittent resize
failure remains a limitation, not a claimed production repair or hidden PASS.
The actual original subsequently rendered through the observed native backend.

Eight focused input/lifecycle tests passed, including balanced Space, duplicate
and invalid refusal, actual lost-child UNKNOWN/no replay, normal completion,
supervisor signal and independent deadline expiry with actual waits and both
EOFs. These synthetic tests are controls, not gameplay evidence.

One immutable actual gameplay attempt ran to the original 240-second bound.
Its independent 260-second watchdog armed before the runtime child. Runtime wait
was 0, stdout and stderr both reached EOF, watchdog wait was 0, both PIDs were
absent afterward, and every key DOWN had its matching acknowledged UP. The heavy
runtime lock was released at completion; no lock is held during finalization.
Builds additionally use the build lock. The first finite build queue expired without launching a build. The next
fair queued turn actually ran `tools/build.sh` under both locks and failed at
the foreign-owned ToyVM browser bundle freshness gate: 2,651,545 bytes versus
2,651,735 regenerated bytes, first differences 801005/853049. `build.log` and
`build-receipt.json` retain that failure. No passing full build is claimed,
no owner files were edited, and this publication contains documentation only.

Only seven selected result images, compact logs/JSON and small Git patches are
retained. The separately viewed redundant captures were removed. The restored
native dependency install was hash-verified before its own regenerable files
were removed; the lock/cache recipe and pins remain. No media was copied or
downloaded. Free /home disk remained above 14 GB, exceeding the 1.5 GB floor.
No box was created: ID null, state NOT_CREATED, expiry null, stop receipt N/A.
Foreign WIP and files remained untouched. The assigned gameplay task is complete;
no further runtime attempt is needed.
