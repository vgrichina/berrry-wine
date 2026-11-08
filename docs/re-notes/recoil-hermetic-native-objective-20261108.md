# Recoil hermetic native objective, 2026-11-08

Run: `scratch/runs/20261108-recoil-hermetic-native-objective/`.

The single original reached a new native transition/freshness boundary. It did
not qualify a temporal HUD or dispatch C, M or movement. The worker then
implemented and tested a generic compound-driver correction in separate retained
inputs, without retrying the original. Native consumption, ramp/control access,
power-control destruction and onward objective progress remain unproved.

## Prerequisites and original identity

The predecessor [HUD-gate repair](recoil-native-hud-gate-20261108.md), including
its original browser bytes and artifacts, remains unchanged. This task adapts
its provisioning reference under the new authorization; the completed
predecessor's allocation refusal was not removed in place.

All **755 repaired pins** passed locally against published Git
`49874a81c5ae180c20a15c6bb169d9041f028cae`, including the 23 SHA-pinned pngjs
7.0.0 files from the retained SHA-512-verified dependency closure. The hermetic
negative full entry rejected missing pngjs before browser output. The good
delayed-HUD full entry passed locally under `wine-runtime.lock`, including all
113 HTTP pins and trusted generated-fixture key events. Existing twelve timing
regressions, eleven integrated cases and the native Calculator Edit → Copy
control were reused by retained path/hash, not presented as fresh game evidence.
The bound-input, ordinary-key, pointer and transport helpers were unchanged.

The remote launcher independently checked all 755 staged bytes before its one
launch. The recovered original Worker module is
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
The ordinary route is `/index.html?debug&threads&app=recoil_demo`, Chrome
151.0.7922.108, Threads, cross-origin isolation, 1024×768 browser viewport and
native 640×480 Software presentation. Toolbar WebGL is not backend evidence.
Published Git providers exclude peer WIP. Exact Git, relevant binary diff,
owned-input patches and media path/size/SHA pins provide recovery; no source or
media archive was made. No production emulator files changed or build was
claimed.

## Fresh briefing resolves the objective numbering

Ordinary Software → OK → Game → Start → New Game retained the visible default
name `user` and Medium difficulty. Native Start and the natural opening followed.
An independent passive recorder captured the cycling native loading briefing,
including its text, objective illustrations and map. These panels are not pause.

`scene-review/observed-1794128776075.png` shows **1.1 Operation Short Circuit**:
the force field above the beach blocks access to the enemy base at the top of
the hill; find and destroy the force-field power control. The illustration shows
the ramp entrance and posts; the map circles its northeast beach/road area.
`scene-review/observed-1794128795262.png` shows **1.3 Destroy Rocket Sites**, with
different objective imagery and map markers. Native 1.2 Missile Control and
1.4 Go to Landing Site were also captured. Thus 1.3 is a later cycling
subobjective, not evidence replacing the fresh 1.1 force-field objective.
`briefing-review.json` records this review. No actual control was identified.

## Native pause and the first new boundary

`disembark.png` shows living HUD health 100 and timer 00:00:00. Ordinary Escape
is followed by `native-pause.png` at **09:10:13.110Z**, still showing HUD timer
00:00:03, then `pause-current.png` at **09:10:24.278Z**, visibly showing the
native Resume menu. Relative menu movement produces fresh highlighted Resume
in `resume-ready.png` at **09:10:58.763Z**. Those captures are in `review/` and
the independently retrieved `original/`.

Command 28, `first-hud-gated`, was the only compound attempt. It planned C then
ordinary M for map review, followed by release/Escape. Resume DOWN was dispatched
at **09:11:22.243Z** and UP at **09:11:22.372Z**. The pre-Resume baseline and
subsequent probes remained the same native menu PNG. The third post-Resume probe
began at **09:11:23.307Z** and completed at **09:11:24.356Z**: **1,049 ms** old.
The driver threw `HUD probe stale before action`, sent release/Escape at
09:11:24.357Z and Escape UP at 09:11:24.438Z. Its receipt has **zero attempted
gameplay keys**. The prior 2,400-ms overall window also included both transition
and temporal-HUD qualification, leaving no separately reserved command window.

The independent observer first captures the returned native HUD at
**09:11:24.432Z**, health 100, timer 00:00:03, in
`original/observed-1794129084432.png`. That is a sampled upper bound on visible
resumption, not its exact time. The enclosing HUD readings span 71.322 wall
seconds with the same displayed timer; this supports excluding native menu time
from that timer. It does not measure exact actor/health freeze or make loading,
briefing or map panels pauses.

Commands 0–27 have exact ACKs. Command 28 has no ACK and remains sticky UNKNOWN;
source ordering and zero DOWN rows do not convert it to an acknowledged
zero-effect command. There was no replay, second Resume, restart, attack, guest
write, private guest handler, forced scene/configuration/clock/seed or deployment.
The overall Escape was independently released at the host, but a post-compound
native MENU was **not** captured before closure. The last living sample is not a
final-state claim. No native C/M consumption, fresh temporal gate, movement or
objective consequence is accepted.

## Tested generic integration correction

The actual original `compound-v2.cjs`, `browser-run-v3.cjs` and 755-pin inventory
remain unchanged. New `compound-v3.cjs` / `browser-run-v4.cjs` use a separate
**4,500-ms transition gate** (validated maximum 5,000 ms) and a command window
started only after a qualified HUD. The immutable overall timer and the gate-miss
release/Escape timer are armed before Resume. After qualification, an independently
armed action timer bounds the command; per-key releases and the 80-ms C timer
remain independent of ACKs. Gameplay DOWN still requires an image no more than
250 ms old and cannot follow an absolute deadline.

Stale samples are retained and discarded while waiting inside this one bounded
transition; they neither admit keys nor seed a temporal pair. A sample that ages
past 250 ms during evidence saving also resets the pair. This does not resend
Resume or reopen an UNKNOWN transport. Full owner/module checks remain intact;
no cache or identity check was weakened to make images appear fresh. Gate failure
still means release and stop, not another gameplay attempt.

`boundary-baseline-qualification.json` reproduces zero gameplay and the stale
probe failure through the unchanged full browser entry. Its generated fixture
models the observed 1,049-ms stall and a returned HUD after 2.2 seconds, with a
distinct timer image at 3.3 seconds. These are explicitly generated fixtures
using retained native images, not another Recoil launch.

`corrected-qualification.json` passes six full-browser cases: that transition
replay, persistent stale images, changed owner, partial UNKNOWN, delayed C ACK
and delayed arrow ACK. The transition replay admits trusted generated C/Up after
the fresh temporal pair. Persistent stale images admit no gameplay. Changed
ownership and partial delivery retain sticky UNKNOWN/no replay. Delayed C ACK
releases C independently and rejects the subsequent stale arrow; arrow UP and
overall Escape remain independently bounded. Every fixture closes Chrome with
code 0; expected driver refusal is checked separately.

`boundary-regression.json` additionally passes seven deadline/release cases and
a recorded-native-image test proving that a stale first timer cannot seed a
fresh pair. Cases cover absent/late gates, synchronous deadline overrun, a
separate ordinary-command window, C ACK delay, overrun between two DOWNs and an
invalid gate bound. The new local closure has **757 pins**. This is a substantive
tested harness correction at the observed boundary, not evidence that the
native objective or corrected original-game gate now works. No second original
was allocated to test it.

## Retrieval, shutdown and remaining work

All **558 remote files / 83,664,519 bytes**, comprising **491 unique SHA-256
values**, were retrieved and independently rehashed before delegated shutdown.
All **250 original PNGs** pass decoding/CRC checks. Verification checks the
actual module, 28 ACKs/one UNKNOWN, zero gameplay DOWNs, five known runtime PIDs
absent, HTTP/CDP ports closed, profile and writer gone, and last observed mouse
and arrows released. Local full-entry and correction browsers, drivers, ports,
profiles and writers are drained. The independent normal/watchdog children exit
0 and their supervisor ends with no children. `verification.json` retains these
checks; the original timing/cleanup limitations above remain explicit.

The one UUID-idempotent allocation was **`bx_6zp7wwsr`**, created at
**09:00:17.139Z**, with initial expiry **09:26:17.008Z**. An observable detached
25-minute watchdog was armed before allocation, deadline **09:25:17.150Z**.
The box became **archived at 09:13:10.383Z**, expiry **null**. Stop receipt
**`stop_543466a94268adb9`** completed **09:13:10.462Z**, forced false, error null;
`final-stop-receipt.json` retains the final observed state. No box was resumed or
deleted. Disk remained above 5 GB.

Next is a separately authorized original using the corrected, hermetically
qualified closure: qualify fresh native temporal HUD before C, demonstrate actual
ordinary consumption and independent releases plus visible native MENU, then
take a separately bounded movement toward a freshly reviewed ramp/control.
The fresh 1.1 briefing is available, but an actionable control/target must still
be identified before attack. Objective completion, full27, parity, audio and
simulation FPS remain open.
