# MW3 native consumer to cockpit — 2026-11-07

The original registered MW3 demo reached the cockpit through ordinary trusted
Chromium input. The route crossed Main Menu → Pilot Entry → Instant Action
setup → operation map → Launch → cockpit. Native cursor consumption and actual
successful DirectInput button returns were established before navigation.
No production repair, forced relative profile, private input handler, guest
write, configuration change or clock change was needed.

Evidence: `scratch/runs/20261107-mw3-native-consumer/`. Predecessor `a69755789`
was terminal/released. The mouse-consumption and corrected-client notes,
`CLAUDE.md`, app notes and published Dungeon Keeper helper were read. No nested
worker, accepted sample matrix, old box resume/deletion or archive was used.

## Native prerequisite and actual completion

The unchanged published `tools/dungeon-keeper-native-motion.cjs`, SHA-256
`b42d047597f3d7e41b15a6c358fede65549cb0d28e505f36906de42f2780df6e`,
passed its focused bounded motion tests. Its previously published actual
production sample was not repeated. Bounds, physical continuity, automatic
unlocked selection and capture-intent refusal remain intact.

This original reported automatic capture intent true, no explicit profile,
cooperative flags **5**, sensitivity approximately **1.3**, and software cursor
`(320,240)`. One reviewed blank-background acquisition click acquired
Pointer Lock on `screen`; UP was armed before DOWN and independently attempted
at 100 ms. The acquisition click's returned button state is **UNKNOWN**:
completion observation had not yet been armed. A later asynchronous all-zero
buffer snapshot does not fill that gap.

Four trusted `(-2,-2)` native moves at nominal 40 ms intervals were admitted
through the published helper. The real software cursor at `0x600f90/94`
changed to **(312,232)**, matching the renderer and personally reviewed pixels.
Larger subsequent steps demonstrated the expected sensitivity difference:
renderer `(280,212)` versus software cursor `(272,208)`. Navigation used the
observed software cursor and fresh pixels, never an absolute one-jump guess.

The run-specific completion probe attached read-only through CDP to the exact
owning guest Worker and verified its executing module bytes. A source-name
function index was rejected after its binary body proved unrelated; no
breakpoint was installed there. The actual 470-byte GetDeviceState body was
identified by its complete binary structure, including acquisition/argument
failure returns, mouse state writes and final HRESULT/stack cleanup.
`completion-binary-proof.json` retains its bytes at module offsets
**887472..887941**, definition index **5662**. CDP confirmed executable
locations and placed a false-returning diagnostic condition at **887941**,
after success and buffer writes, before function end. It recorded host time,
EAX, EIP, caller return address, all 16 bytes at `0x600f68..77`, software cursor,
device pointer and cooperative flags. It never wrote guest memory or invoked
an input handler. Both bounded 45-second probes removed their breakpoints and
diagnostic buffers, then exited normally.

The idle probe retained **1,568** actual completions. The button probe retained
**1,517**. All observed returns had **HRESULT 0** and caller return address
**0x4fa56c**; `get_eip()` retained the containing guest block head `0x4fa55f`.
A separately reviewed diagnostic click at the existing physical anchor sent
zero repositioning motion and one trusted DOWN/independent UP pair:

| Observation | Host UTC | Returned left button |
| --- | --- | --- |
| DOWN attempted / acknowledged | 15:10:29.924 / 29.932 | Not inferred from ACK |
| Actual GetDeviceState completions | 15:10:29.943, 29.962, 29.984, 30.022 | `0x80` in byte 12 |
| Independent UP attempted / acknowledged | 15:10:30.023 / 30.025 | Not inferred from ACK |
| First subsequent retained completion | 15:10:30.045 | `0x00` |

Every pressed completion contained zero X/Y/Z and remaining button bytes;
cursor stayed `(312,232)`. Current device pointer was `136454304`. HRESULT 0
establishes acquired state for those successful calls; the unchanged automatic
hint also reported an acquired exclusive mouse. Raw DxObject table flags were
not separately captured and remain **UNKNOWN**. This qualification observes a
real returned press and release; DOM events or an empty queue alone were not
used as substitutes. The logpoint adds diagnostic overhead, so it establishes
consumption, not uninstrumented timing or performance.

## Personally reviewed navigation

Each deliberate command used current immutable PNG bytes, a written personal
review, unchanged 18-field owner/module admission, the existing freshness bound
and exact numbered ACK. UNKNOWN remains sticky and was never replayed. Every
press retained independently armed UP. Pointer Lock and automatic detection
were left unchanged. The native event record contains **63 trusted events**.

Bounded steering placed the software cursor `(272,208)` visibly on Instant
Action. One zero-jump click opened Pilot Entry. Trusted `a`, then Enter,
created and listed pilot `a`. Bounded steering placed the cursor `(432,324)`
on Accept; a click opened Instant Action setup with the default Bushwacker,
Operation 1A, Battle Progression and Wave 1. Accept opened the operation map.
Passive captures allowed its bottom controls to settle. Bounded native motion
placed `(575,432)` over the highlighted lower-right icon with a visible
**Launch** tooltip. One click opened the cockpit. The historical route was
read only for this deployment target; its private handlers were never called.

The personally inspected immutable `reviewed/mission.png`, SHA-256
`b525433cde54b35d81240e3ab3e5fda05e3645e8233b4e7359afa9ee757407c7`,
shows cockpit framing, green HUD and weapon labels, radar/mech display and
terrain. Its capture completed **15:16:03.433Z**. No further gameplay input was
sent. No movement, turning, firing, FPS, texture-parity or sustained playability
claim follows from this cockpit image. The next executable work, if separately
requested, is a fresh native cockpit action/consequence qualification with
the observer armed before the first relevant press.

## Identity, validation and shutdown

All **306** inherited runtime/media pins verified before allocation. The
successor's **308** individually staged pins verified before launch and after
completion. The tested source checkout was
`df0bbae0c5af942debbcdd45f5537ea3be97fd13`; the inherited manifest records its
earlier baseline. Both live guest and owning renderer executing modules were
retrieved through CDP and matched SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`
(2,182,493 bytes). This is measured module identity, not a rebuild claim at the
tested source commit. Git SHA, relevant binary diffs, run-helper patches and
existing path/hash/length media references preserve recovery without source
or media archives.

Focused native motion tests, JS syntax, exact numbered ACKs **0–16**, PNG and
executing-module hashes, actual completion correlation, independent release,
post-run pins and recovered SHA/length checks passed. Final verifier initially
expected a number inside raw `reply-N.json`; the transport stores the number
in the caller ACK instead. It was corrected to cross-check filename, command
ID and actual caller ACK without rerunning the browser. No production code
changed, so a locked build was not required. The global evidence checker still
reports the preexisting unrelated Alice containment error; owned artifact
verification passes.

All **232** terminal artifacts (**11,224,275 bytes**) were recovered and
SHA/length verified. Chrome exited normally with code 0 at **15:16:27.428Z**.
The first cleanup check caught the Node driver still exiting; its failed
assertion and exact observation were retained. A later read found the driver
absent without any signal. Final custody confirms driver/Chrome/probe processes
absent, both ports closed, profile and writer lock absent, and held inputs empty.
Sampled local free disk stayed above 2 GB; no continuous minimum is claimed.

One fresh `POST /sandboxes` used a persisted UUID Idempotency-Key. Its immutable
allocation-derived execution deadline was **15:29:54.480Z**. Explicitly
delegated normal shutdown followed verified recovery. Box **bx_gqacr4dy** is
**archived**, stop **stop_81c953274d17186b** completed **15:18:02.292Z**,
`forced:false`. Current `archiveAfter` is null; original expiry was
**16:04:54.297Z**. Retained-data expiry is unknown. No old box was touched and
no lifecycle ownership remains. This single bounded task stops here.
