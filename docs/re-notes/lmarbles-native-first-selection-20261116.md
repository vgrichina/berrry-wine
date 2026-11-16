# Native SDL first-board selection, 2026-11-16

The prior original endpoint is closed and was never contacted. Its historical
Puzzle8 clear, Puzzle9, native Quit and missing waits remain UNKNOWN. No prior
route or progress was imported. This task uses no workers or boxes.

## Cause and repair

The host input queue becoming empty does not prove native PeekMessage has
finished its pump. Posted messages, paint and timers can still be returned.
The old time-plus-host-poll gate could publish DOWN inside that same SDL pump.
SDL WinDIB then updated its button position before the post-pump cursor query,
suppressing the motion event that updates the application's lastMotion.

The generic USER input bridge now acknowledges a genuinely empty, unfiltered
native PeekMessage/GetMessage pump. A moved button on a native-pump window
waits for that acknowledgement as well as the existing hold floor. The
acknowledgement is scoped to actual memory, native thread, window identity,
live process and native window generation. It adds no clicks and reads no
application-private state. Existing physical release behavior remains.

An independently authored fixture loads authentic SDL.dll and uses its public
Init, SetVideoMode, PollEvent and Quit exports. It models its own selector,
confirmation and board, accepts an actual public Y event, and introduces ten
native posted messages with 12ms servicing intervals. Before the fix SDL
published only DOWN at (140,150), leaving fixture lastMotion at (510,350) and
reopening confirmation. The exact current fixture, including its public Y
transition, also fails using the previous Git publisher with the same sealed
module (native-before-exact-fixture). After the fix actual SDL publishes motion before DOWN
and the first board selection succeeds. Public SDL video recreation invalidates
the old scene; production guards reject stale focus and focus/window generation
intents with zero input effects. This is causal native qualification, not a
claim that an original game board has already been selected.

## Media, controller and runtime

The original manifest legitimately contains all 86 inventory entries, including
the EXE, with SHA-256 fields. The verifier expected only 85 companions without
SHA fields. Expected rows now exactly retain all 86 paths, lengths and hashes;
seven independent corruption controls must fail. Inventory digest remains
`aa2cbae11ba5b5a57010643b886552b3ee955e441f76976a3a7593018816d93b`;
CRT SHA-256 remains
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcb852db99fd1`.
No media or manifest was changed.

The manual controller now binds the reviewed native scene and validates each
intent at consumption. Captures also latch the irreversible 180-second Quit
reserve. Fresh reviews, confirmations, physical UP, independent finite release,
nonce ownership and sticky UNKNOWN behavior remain mandatory. The supervisor
seals runtime source and module inputs in transient memfds so other workers can
build without mutating a reader. Evidence retains Git SHA and binary patches,
not source/media/module bundles. An independent watchdog is armed before launch.

## Qualification and evidence

Evidence: `scratch/runs/20261116-lmarbles-native-first-selection-puzzle8/`.
The native red/green runs retain actual native, watchdog and supervisor waits
and both pipe EOFs. The first candidate build failed a stale review digest;
corrected candidate-v2 passed the full locked build. Native SDL, eleven reserve
and process tests, two actual CLI process tests, and the strict native controller
with independent UP and capture-cutoff transition passed. The first controller
fixture correctly refused a six-second operation within its five-second gameplay
window; the corrected fixture provides fifteen seconds and passes.

The sealed qualified native module SHA-256 is
`692766434b357897de3ad9310edaab8432f9438806183f024b478e3faed9a271`.
Its build source is recorded by build-source.json plus build-source.patch;
foreign GL and other shared-tree WIP is explicitly unadopted. Final helper full locked build also passed, with an exact match to the sealed
module. The one authorized fresh original run follows publication.


## One fresh original and closure

Implementation commit `4a8331cf9` was published on main before the original.
Exactly one registered `lmarbles_108` was launched, with genuine guest Workers1
and2, real ticks and untouched media. The complete setup showed Normal,
Original, Michael. The visible eighth Tier1 selector dot opened the actual
level8/chapter1 confirmation; one reviewed Y entered settled Puzzle8 Moves96.

The first board pointer press directly selected the central blue marble, with a
visible cyan ring. No preliminary pointer intent, repeated click, selector
confirmation or imported progress was used. Subsequent manually chosen slides
reached Moves76 (20 completed slides), paired two grays and released the third
from the left pocket. Each intention followed a fresh complete-scene review;
two aged reviews were refused as NOT_SENT and replaced with fresh captures and
new intentions. No solver, OCR, tile-map reader or queued route was used.

Puzzle8 remained incomplete at the fixed gameplay cutoff. This is a bounded
manual-play limitation, **not a new native failure**. Puzzle8 clear, tally and
Puzzle9 were not achieved. There was no recurrence of the selection bug.

The independently prearmed watchdog deadline was launch+1220 seconds, native
runtime deadline launch+1200, gameplay cutoff launch+1020 (09:39:45.059 UTC).
The irreversible Quit phase latched before the next capture/intent. All sent
DOWNs were consumed, all independent UPs acknowledged, and no gameplay was
admitted at or after cutoff. Escape opened ordinary “Do you really want to
quit? (y/n)”; reviewed Y returned to setup. A further reviewed Escape from
setup produced native `[Exit] code=0`, waveOut close and worker2 exit. Native
PID3327612 actually waited0 with both EOFs at09:40:30.694 UTC, before either
deadline; the watchdog exited through actual-native-wait without signalling.
No host Quit/WM_CLOSE/cancellation was injected. Native ordinary exit is proved;
an additional main-menu Quit screenshot was not observed or fabricated.

The final auto-capture encountered the already-waited native terminal. Its
sticky failure is preserved and no subsequent endpoint request was made. The
parent recorded its actual child wait0/bothEOF; the invoking tool nevertheless
reported143, preserved separately in tool-channel-outcome.json. These are
separate observations. The module-holder launcher has no standalone actual
parent wait receipt (UNKNOWN); its native/watchdog/supervisor waits are0 and
all recorded PIDs are absent. Missing older historical receipts remain UNKNOWN.

Eight selected result-named screenshots, image hashes, intentions, actual wait
chains, sealed-source Git/patch/module pins and closure checks are indexed by
result.json. The holder closed normally, the original port45499 is closed,
and the media postflight again verifies all86 SHA-pinned files plus authentic
CRT. No box was created (ID/state/expiry/stop: not applicable). No new original
or restart is authorized by this result; further Puzzle8 completion needs a
separately assigned manual run. Source and runtime ownership are released at
final publication.
