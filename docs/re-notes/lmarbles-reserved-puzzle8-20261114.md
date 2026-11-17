# LMarbles: mechanical Quit reserve, original Puzzle8 clear, Puzzle9 denied

Run: `scratch/runs/20261114-lmarbles-reserved-puzzle8/`.

Puzzle8 cleared after 62 individually reviewed, manually delivered settled slides:
Moves96 → Moves34, native bonus tally2700, green eighth selector dot. The tally
continuation returned to Puzzle1 at score2700. Selecting the first dot in row2
(the ninth puzzle) displayed **Access Denied**. Puzzle9 entry/clear is unproved;
no locked-level bypass, state import, second original, or campaign completion
claim follows. Full27 remains unproved. Ordinary native Escape → reviewed Y →
reviewed setup Escape exited with guest `[Exit] code=0` and actual harness wait0.

## Durable controller and regression scope

New `tools/lmarbles-controller.py` adopts the exact prior tested pointer helper
SHA256 `54508b765ea1499c403cfb109168057bb5704a7d4d7b68e65ff62607ea5de3f5`.
The prior recovered supervisor SHA256 is
`57ae4c3032e1b6b85536c0b72e57cc3a194fff10d9f236affd58bf5069f29331`.
New `tools/lmarbles-supervisor.py` persists runtimeDeadline and the immutable
`gameplayCutoff = runtimeDeadline - 180` before starting the original. The
controller checks that relationship and creation time. It checks intent before
a lease, before independent release-child arm, and immediately before each DOWN;
the production guard deadline is also clamped to the gameplay cutoff. An action
whose complete operation window would cross the cutoff is refused before arm.
Crossing the cutoff permanently enters Quit phase. Gameplay is the default;
slides, selection and motion cannot be silently renamed Quit.

Explicit Quit intents permanently enter Quit phase even earlier. They accept
only individually reviewed ordinary Escape/Y route choices, with the route
bound in that fresh capture's review. No automatic Quit sequence exists.
Permanent ownership, unique nonces, guard implementation and noReplay remain.
Direct loopback /ctl is checked against the actual native PID/start token and
listening socket. No relay or rebind is used. A separate release child is armed
before DOWN with an immutable two-second cap; consumed-time release scheduling
and actual transport-return ACK timing are preserved. LateACK/UNKNOWN remain
terminal, with independent UP attempted and no replay. Final owner-exit evidence
requires matching actual normal native wait and both EOFs; it never fabricates a
physical UP ACK or guest Quit. This original obtained actual UP ACK for all110.

Exact new tests and fixture:

- `test/test-lmarbles-reserve.py`: 11 synthetic endpoint/process tests using the
  real production `lib/control-server` and `lib/cli-guarded-input`, actual release
  children and actual normal/TERM/KILL/lateEOF/durable waits. Crossing cutoff
  during the lease produces zero guarded-input requests and zero DOWN, with no
  release child armed. It covers default gameplay, irreversible Quit, valid fresh
  Quit after cutoff, anti-relabel, 40ms final fixture, lateACK independent UP,
  lostACK UNKNOWN/noReplay, and durable normal/waiterTERM/invokerKILL.
- The same test file's `LMARBLES_ACTUAL_CLI=1` mode adds two actual production
  `test/run.js` HTTP/renderer tests, using synthetic Solitaire rather than an
  original game: 40ms independent UP/progress, a real cutoff crossed during lease
  with zero added DOWN and a valid fresh Quit intent afterward, plus delayedACK
  independent UP/sticky noReplay. `test/fixtures/lmarbles-reserve-endpoint.js`
  owns both the synthetic server and isolated CLI preload. No fixture or delay
  is loaded in original LMarbles.
- `test/test-lmarbles-sdl-transition-candidate.js` calls authentic SDL public
  video/event APIs across a same-coordinate video/game-phase boundary and then
  a distinct motion. Existing owner/guard/SDL tests, native modal test and media
  verification also passed. Full build passed under heavy + build locks before
  the original and again before publication. Logs and actual separate-EOF waits
  are retained in the run.

## First-press boundary: a56 is not universal

The prior run's correct SDL coordinates with stale `game.lastMotion` are a real
counterexample to claiming a56 universally fixes first selection. The new public
SDL consumer keeps the pointer at140,150 across `SDL_SetVideoMode`; SDL delivers
the ordinary button without zero-delta motion. A genuine distinct move to160,170
emits SDL motion and the following ordinary button works. This fixture exercises
a public video transition in one SDL window; it does not model every internal
LMarbles phase or prove a separate operating-system implementation behaves the
same. No emulator divergence warranting another runtime patch was established.
No forced-hover72590, queue-only candidate, synthetic native hover-state write,
or game patch was restored.

In this original, a personally reviewed, ordinary distinct mousemove into the
board preceded the first blue selection. Read-only inspection then showed both
SDL and game.lastMotion327,95 (screen350,138); the subsequent first selection
worked. This is a legitimate input workaround, not a universal a56-fix claim.

## Bounded original and lifecycle

Coordinator17:56:27 explicitly reordered the already-active Forsaken validation
before reserved LMarbles, followed by LBreakout. No overlap or old-window
extension occurred. This sole new fixed1800s run began17:57:55.122Z with an
independent1820s watchdog prearmed. Its cutoff18:24:55.122Z and native deadline
18:27:55.122Z were persisted before native startup. Native PID3767127,
startToken272628440, DIRECT port8538, actual guest Workers1+2, real ticks,
Normal/Original/Michael. The eighth confirmation was viewed before accepting;
settled original eighth geometry, six blue/three gray, arrows, target and Moves96
matched the validated read-only model. The62 suggestions were consulted read-only;
every selection and settled slide was personally reviewed and individually sent.

Native finished18:18:09.418Z after1213.060s, 405.705s before the gameplay cutoff.
All110 DOWN intents have unique nonces, prearmed release, consumed receipts,
independent UP ACK and actual release-child wait0/bothEOF. Fresh full-scene age
at DOWN never exceeded18.653s. All108 non-final actions have post-release batch
progress; final choices await native lifecycle evidence. No UNKNOWN, replay,
after-cutoff gameplay, input auto-sequence, guest/media/config/physics/clock
write or timeout occurred. Read-only samples and ordinary guest UI effects are
separate from prohibited state writes.

Actual native, watchdog, supervisor and durable outer waits all exited0 with
separate stdout/stderr EOF; watchdog exited on actual native wait without firing.
The launch tool's direct child also has an actual separate-EOF wait. The external
exec tool exposes combined output, so its separate EOF status is unknown, not
inferred. Quit evidence is distinct from harness timeout. Native process absent,
port8538 closed. No box was created: ID/expiry null, state NOT_CREATED, stop N/A.

## Provenance and evidence

Original loaded module SHA256:
`c94ccf1b179f18bd4b47867445afed8cef2f1393b19aabfd259c7f3b94a7be09`.
Launch source base `204b0adcd8cdf405a808e2080fbe1962971762f8`, with Git binary
patches for relevant dirty/new source. Controller used throughout original:
`fc6c1334ac6454d95b2ce3d0bfc6f5f7837fa49ccab4969dea31012bd63d4c2d`;
supervisor `5c3b67add267af04376d84060ef8760c67eb054d9de69019ad272db51be3678f`.
All101 actually loaded source files matched at postflight. Broad1674 source
pins disclose the concurrently changed, unloaded `tools/forsaken-controller.py`;
this was not used by LMarbles. All87 media/CRT hashes matched; all86 manifest
file sizes, hashes and VFS paths were checked. Original level SHA256 remains
`f6cf4f13a52e8b2c52aac714dc02a70770297c627f27b5510d7dd228af1d30f8`.

Only16 named result PNGs are retained, each CRC/inflate/SHA verified; intermediate
review captures were hashed then removed. Compact native logs, action journals,
waits, media/source pins and Git patches remain. No source tree/module/media
copy, frame series or archive was made. Prior1200s timeout and terminal files
were read-only and remain unchanged. The failed action spelling `mouse:` was
rejected by the whitelist before intent/arm/DOWN, then corrected to the ordinary
`mousedown:` command; it was not an UNKNOWN or replay. A read-only sample filename
collision after tally also refused overwrite and was reissued under a new name.

Next work would require a separately authorized native route through the chapter
prerequisites to unlock Puzzle9. This task stops after publishing its reserve fix,
Puzzle8 clear/tally, native Quit and precise Puzzle9 blocker.
