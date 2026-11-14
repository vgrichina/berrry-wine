# SuperTux: two new block coins and actual native Quit

Evidence: `scratch/runs/20261114-supertux-onward-quit/`.

One fresh standard CLI original using the authorized existing `--real-ticks`
advanced from its actual level-entry **score 100 / coins 4** to **150 / 6**.
Two reviewed Space jumps produced two new coin consequences and two visibly
spent question blocks. The game then exited through the reviewed title menu
**Quit**, with actual native wait **0** and separate stdout/stderr EOF.
The independent watchdog was also actually waited **0**, with both EOFs.
No enemy consequence or level exit is claimed: ordinary Abort Level returned
to the map before quitting. No score/baseline promotion is claimed.

## Identity, clock and preparation

Launch HEAD: `d6d95cf108bddbc7e2f472bf2d3b78eb726cf0d0`.
Module SHA-256:
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
All 317 runtime source pins and the module exactly matched the predecessor's
accepted locked full build. That build was reused; fresh owner, guarded CLI
and clock controls ran under the heavy-runtime lock, after TIM2/Q3's turns.
Launch/postflight pins, foreign WIP Git patches, helper pins and the new
controller patch are retained. Postflight found zero source/module/media
drift. No production code changed and no source archive was made.

Filesystem verification passed all 787 originals, authentic standing MSVCRT,
and all 786 companion manifest mappings. The native log records the six
original SDL/image/mixer/jpeg/png/zlib DLLs and CRT. EXE SHA-256 remains
`5930d9848beec72fcaea0687d745e1c9fc148245abbf3f856c208ed41d83265c`.
The registered route retained `--sdl --datadir data`, guest cwd C:\\, original
media and default profile. Personally viewed Options retained Sound/Music
checked; Keyboard Setup showed Jump Space, Run Left Control and movement
arrows. No settings, profile, physics, score or guest-clock state was injected.

`launch.json` records `--real-ticks`; actual trace says `clock=real`.
Title-ready to Keyboard Setup advanced **98,619 guest ms in 98,619.076 wall
ms**, using explicit PNG log entries and capture completion timestamps.
The earlier default service-clock timeout remains unchanged.

## Reviewed progression and fresh-intent recovery

Ordinary navigation selected Start Game, **Slot 1 — Free**, visible story
(Escape skip), world map, first **Welcome to Antarctica** node, and Enter.
Loading/black scenes received no input. Immediate action captures sometimes
preceded visible transitions; separate fresh captures observed completion
without replay. `fresh-level-baseline.png` shows **100 / 4**, four lives,
timer **292**, and grounded Tux at the start; these counters are excluded
from progress. Three finite Right choices aligned the first question block.
Space 300 ms produced **125 / 5** and a spent block in
`first-block-result.png`.

The next intended Right choice expired at **17.960 seconds**, before DOWN
or independent-release arming. `next-block-align-*` retains its NOT_SENT
rejection and old nonce. Its current immutable runtime/owner lease was VALID
after native identity, window/canvas snapshot and prior guard-status checks.
A separate fresh capture (`second-block-geometry.png`), personal review and
**new intent/new nonce** admitted the next Right choice. The native guard
also checked its original bound effect owner before consumption. The old
intent/capture was never retimestamped or replayed; no rebind, operation
extension or sticky-UNKNOWN reset occurred. `recovery-verification.json`
checks the ordering, disjoint nonces and absence of old DOWN/arm files.

Two short Right choices aligned the second question block. Space 300 ms
produced **150 / 6**, with both spent blocks visible in
`second-block-result.png`: **+50 score / +2 coins** from this run's baseline.
Four lives remained. No airborne-pose or enemy claim is needed for these
observed consequences.

Native Escape opened Pause; reviewed menu navigation selected **Abort Level**,
returning to the map at 150 / 6. The map's **Quit Game** returned to title.
A newly reviewed Up wrapped Start Game to **Quit**;
`native-quit-ready.png` shows Quit highlighted. Reviewed Enter selected it.
The independent release succeeded before native shutdown. The log records
`[Exit] code=0` and final statistics at **446.423 seconds**. No forced shutdown
is presented as Quit.

## Guards, actual waits and outer limit

All **35 consumed pulses** retained one permanent owner, unique nonces,
the unchanged 12-second review cap, finite immutable operation deadlines,
prearmed independent UP, and release-child actual wait 0 with both EOFs.
Maximum consumed review age: **10.500 seconds**. Nonterminal choices have
postrelease batch progress. The one expired choice had no DOWN/release child.
Ownership, UNKNOWN, release and deadline failures still close input permanently.

Before launch, owned controls passed normal exit, launcher process loss,
supervisor SIGTERM and independent deadline handling, with durable actual
native/watchdog waits and separate EOFs. The real production HTTP/guard test
proved zero DOWN for expired review, one fresh new intent, independent UP,
and sticky UNKNOWN after an actual transport timeout; later input and capture
were refused. Fresh production guarded CLI tests passed all 22 checks;
the real shared-WASM UI-owner tests passed too.

A real PTY test interrupted its outer launcher while the owned control child
was still running. The detached parent survived, later recording native wait
0 and watchdog wait 0 with both EOFs. An earlier PTY attempt interrupted after
its child exited; it is preserved and excluded as in-flight-loss proof. These
tests do not establish survival of SIGKILL against the detached parent itself.

For the original, the detached parent used its own OS session, null stdin,
closed inherited descriptors and file-backed output. Its independent fixed
**900-second** watchdog armed before native creation, never extended or fired,
and exited on the actual native-wait receipt. `native-wait.json`,
`watchdog-wait.json` and `supervisor-complete.json` retain the real child waits,
EOFs and heavy-lock release. No cancellation occurred. All **38 recorded
runtime/release identities** are absent and port 8465 is closed; absence does
not substitute for exit receipts.

The outer launch tool returned 0 after detaching. **The detached supervisor's
own exit status was not waited by that tool; separate outer-tool EOF is
UNKNOWN.** Its completion receipt proves its child waits, not its externally
observed exit status. This remaining outer gap does not erase the durable
native/watchdog waits. The PTY test's merged outer streams are also explicit.

Nineteen selected personally viewed PNGs passed CRC/inflate/size/SHA checks.
Intermediate/transition PNGs were removed with metadata retained. Two
postflight parser attempts confused capture `welcome-down.json` with DOWN
receipts; the corrected parser filters receipt arrays and verifies all 35.
No runtime action depended on this metadata parser. Compact JSON, logs and
Git patches retain the evidence. No boxes/downloads/deployment occurred:
box ID none, state NOT_CREATED, expiry null, stop receipt not applicable.
This run has zero evidence-reference containment, missing-file or schema
issues. The repository-wide checker exits 1 for existing foreign records;
the compact report preserves that limitation and those records were untouched.

This bounded task achieved two fresh block/coin consequences and normal Quit.
Further enemy or level-exit work needs a separately assigned task; this worker
stops without launching another original.
