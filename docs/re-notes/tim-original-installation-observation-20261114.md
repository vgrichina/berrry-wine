# Original TIM: actual Smart Start installation

On 2026-11-14, original INSTALL.COM copied the game through its actual
Smart Start UI and wrote its own configuration. Evidence is
`scratch/runs/20261114-tim-ordinary-install/result.json`; reusable guest files
and provenance are in `scratch/game-state/tim-20261114/`.

The canonical `tools/toyvm/run-dos.js` initial-floppy route loaded
`A:/INSTALL.COM` from borrowed, read-only
`/dev/shm/wine-owner187-tim-disk.img`, SHA-256
`d0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657`.
C: began as an empty writable Map with no host fileRoot. After viewing the real
first menu (`review-01.png`), one ordinary Digit3 selected the visible copy
choice. The next actual frame (`review-02.png`) displayed the drive chooser
with **C:** selected and Enter labelled **Start copy**. A separately reviewed
Enter accepted that drive. No destination-edit screen appeared. The next
actual frame (`review-03.png`) returned to the Smart Start main menu. All
three retained screenshots were viewed. This records the actual default
installation path through the output namespace, rather than inferring it
from the menu text alone.

Each action used the canonical persistent controller: fresh actual frame,
program/target/digest binding, independently prearmed release before DOWN,
actual execution after DOWN, key and mouse UP, actual execution after UP, and
a fresh acknowledged consequence. The immediate post-UP observation and the
later settled keyboard-wait frame are separately recorded. Exactly two actions
and three reviews occurred; the controller stopped with held input false.

The canonical `save-files` exporter preserved only the actual guest overlay.
Eleven original files appeared under **C:\SIERRA\TIM**, with byte hashes
matching the original FAT12 payloads, including packed TIM.EXE (111951 bytes,
SHA-256 `34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c`).
The installer also produced `C:\SIERRA\TIM.BAT` (35 bytes) and
`C:\SIERRA\TIM\RESOURCE.CFG` (three actual binary bytes **02 02 00**, SHA-256
`138793139d414148c3ea406f4b273bdfb394d17fab3636115815abdf639d433d`).
These bytes were observed only after guest production; no configuration was
supplied by the host. `export.json` and game-state `provenance.json` record
all paths, lengths, hashes and producer route. No executable was unpacked or
substituted. No manual/password answer, solver, memory injection or blind
input chain was used.

The install process retired 20,590,333 dispatches, reached the next BIOS
keyboard wait without unimplemented services, runtime errors, selector or
protected-transfer stops, and settled in 42.48 seconds. Its actual ToyVM module
SHA-256 was `239f6584b458eb0b9c5f2916bd63b29681d2a446d1b821ea45a1cace6b823060`
(346059 bytes); no module dump is retained. Source recovery uses the result's
exact Git commit plus `relevant-wip.patch`, `new-sources.patch` and source pins.
All incoming TOYVM/CF/CD/loader WIP was preserved.

Both phases use exclusive `/tmp/wine-heavy-runtime.lock` ownership. Each new
owner has its own fixed 110-second absolute controller deadline, within the
canonical 120-second maximum, armed before guest construction; no controller
lease is renewed. An independent supervisor prearms a 120-second monotonic
process-group termination deadline, adopts orphan watchdogs, waits its actual
child and drains stdout and stderr to EOF. Reusable file output, rather than
guest memory or executable dumps, is the handoff between the completed install
session and the separate conditional launch.

## Conditional installed original launch and observed boundary

After verifying the exported files and original executable hash, a **separate**
canonical `runDos` session loaded the persisted
`scratch/game-state/tim-20261114/C/sierra/tim/tim.exe`, with that genuine C:
root mounted and cwd `sierra/tim`, empty arguments, no automatic keys and no
input delivered. This did not resume or extend the installer controller.
The same incoming ToyVM source/module was used. The run reached mode 12h's
640×480 planar four-bit surface but ended at its 105-second runner limit.
`launch/terminal-screen.png` was viewed: it is entirely black. This is a
concrete startup timeout boundary, **not a first game or puzzle frame**.

`launch/runtime.json` records 680,429,566 dispatches, 257 interrupts,
`ranOutOfTime:true`, no key wait, no guest exit, no unimplemented service,
no stuck-address report, no bad selector/protected-transfer stop, and no
runtime exception. Final CS:IP was DF66:81B0; that is an observation, not a
proved root cause. The launch produced no new overlay files, and all original
persisted installed bytes remained unchanged. No further attempt or guessed
hardware/menu answer was made.

The install child PID 3153087 and supervisor 3152943 settled with return code
0 and both streams at EOF. Launch child 3154461 and supervisor 3154459 likewise
settled with return code 0, both EOF, and no adopted or remaining children.
The launch's independently observed controller-watchdog child 3154468 is also
absent. Neither external deadline killed a process; canonical controller
closure awaited its watchdog after release. No remote box was created: box ID
NONE, state NOT_CREATED, expiry null, stop receipt N/A.

`validation.json` passes all eleven original payload comparisons, thirteen
export hash checks, 105 unchanged source pins, original-media identity,
post-UP execution/fresh consequence checks, released-input state and both
process lifecycle checks. Only the four explicitly result-named PNGs remain;
no frame series, capture archive, module/memory dump or source archive was
created. More than 15 GB remained free on /home. This task changed only this
observation note outside ignored evidence/state; no production code or full
build was needed. Next work is diagnosing the observed installed-original
black graphics timeout using this genuine persisted C: output.
