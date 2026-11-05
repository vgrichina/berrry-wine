# Age of Wonders II: current browser movement and joined callback, 2026-11-05

Task: `AOW2-RENDERING-COVERAGE-20261009`. Evidence:
`scratch/runs/20261105-aow2-joined-callback/`.

## Current original observation

One original browser session reached Scenario → Single → Start, dismissed
Julia's introduction, selected the six-unit army and completed two plotted
and confirmed moves. I personally reviewed the current scene before each
input and the before/selection/path/arrival captures. The army moved from the
tower base to the southeast clearing and then south; the Party movement
display changed **20/20 → 13/20 → 10/20**. `army-selected.png`, `plotted.png`,
`arrived.png`, `second-plotted.png` and `second-arrived.png` retain the visible
positions, paths and changing panel. `before.png` retains the initial world.
The first attempted selection hit a Gold resource; its `selected.png` filename
does not prove army selection. `army-selected.png` is the actual selection.

Full captures and lossless, unchanged-pixel `*-map-patch.png` and
`*-party-panel.png` extractions are retained. `patch-extraction.json` records
the exact source hashes and crop rectangles. Earlier generic `*-panel.png`
crops cover the right-side minimap, not the Party movement display. Two
explicitly named `reference-native-*` images are recovered historical
references, never new browser evidence. No historical coordinates were
replayed without inspecting the current browser scene.

Mountains, trees, tower, army sprites, path markers and the Party panel render.
**Large ground areas remain black** in the current browser images; full terrain
parity is not established. The accepted native army/rendering result stands.
No speculative terrain repair was attempted. The next rendering discriminator
is the owning terrain/ground draw and its texture/blend/target state compared
with the accepted native image, rather than another unchanged original run.

Completed Worker data attests actual legacy WebGL ownership at render endpoint
1, not merely a renderer request. Main slot 0 completed-fence sequences advance
3739 → 5032 → 5775 at selection/first arrival/second arrival; second arrival
reports 473,339 draw calls, zero renderer errors/fallbacks and zero completed
software/fallback draws. The reported context is WebGL 2.0 with renderer string
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
This is the reported context identity, not physical-GPU qualification; launch
arguments still requested ANGLE/SwiftShader. Full counters and endpoint options
are retained in the checkpoint JSON.

Logical gameplay FPS remains unknown: there is no measured game-update cadence.
Movements establish updates, not an FPS rate. Audio remains unqualified: no
output was captured and headless Chrome included `--mute-audio`.

## First original rejection and causal repair

The first joined rejection was retained synchronously from the production
error-details log at **21:33:36.613Z**, before retirement, even though its caller
caught it. `first-rejection.json` identifies:

- `clear_yield`, endpoint **1**, actual Worker slot **0**, request **8756**;
- issuing `GuestThreadHost.releaseMainMessagePoint`, called by `host.js` step
  at the yield-17 branch;
- owning callback frame **137**, scoped epoch **9**, kind **12** (I/O),
  incomplete, no publication/fault; root send null;
- matching receiving `commandContext` and issuing `exportRequest`, pending
  true and retirement/stopped flags false.

The original's main completed sequences continued through 9055 (Scenario),
10415 (Single), 20781 (loaded), 22199 (army selected), 22895 (first arrival)
and 23401 (second arrival). This rejection was **not a fatal stop**. Miles
thread exits/late slices are not established causes. The earlier synthetic
`releaseMainMessagePoint` interleave is not substituted for this original
issuer/endpoint/frame/epoch evidence.

The host's former root release read yield 17, cleared the incoming-send flag
and cleared the yield through three separately awaited export requests. The
original proves that the last continuation can reach an owning callback's
scoped I/O instead of its suspended root message call.

The repair makes root message-point release one receiving-endpoint operation
shared by actual Workers and the local endpoint. Any callback frame or outgoing
root send returns an explicit `callback-owned` defer before accessing exports.
Otherwise the endpoint checks the current yield is 17 and clears the incoming
flag and yield synchronously. An ordinary different yield returns an explicit
`not-message-point` result. Transport and retirement failures propagate instead
of being swallowed. Existing export fences, wait reservations, scoped loader/
yield ownership, resume receipts/acknowledgements and retirement ordering remain
unchanged. No guest state is inspected through a guard bypass.

The new real Worker-0/local regression fails against the old implementation
(`atomic-before.log`): the stale root release reaches scoped I/O and silently
returns no defer result. It passes after the repair and verifies scoped I/O,
nested scopes, completed-but-unresumed callbacks, a callback itself at yield 17
without a reservation, root-send preservation, root restoration/ordinary
release and transport/retirement error propagation. Existing diagnostics remain
tested using an explicitly historical three-request transport probe; that
probe is no longer described as the repaired production method.

`original-order-negative.log` additionally loads the original production host
from the recorded Git commit **in memory only** and admits the scoped I/O
callback specifically after the incoming flag clear, before `clear_yield`.
That exact-order negative control fails; the same final regression passes
against the repaired host (`original-order-positive.log`). No shared source
was reverted, archived or replaced to run this control.

There was **no second original session**. Original movement/rendering evidence
uses the pre-repair runtime; the causal repair is covered by protocol tests,
not claimed as post-repair original-game acceptance.

## Identity, validation and lifecycle

The ordered exact FINAL runtime AND file RELEASE ALLBUILDSFINISHED records were
Aranna passive-resource2005 at 20:54:13Z, Conan first-draw2030 at 21:18:34Z,
then legacy alpha16-target2040 at 21:29:42Z. Independent checks at
**21:30:33.802749Z** passed for 510 absent PIDs, 203 refused ports, 68 absent
profiles, four free locks, zero heavy runtime and the disk floor. All shared
edits/tests/build/browser/guest waited for this gate; the cleanup deadline is
22:15:33Z. Source-only preparation rehashed all 1,064 retained fixture pins in
place without media copies.

Original EXE remains 5,748,736 bytes, SHA-256
`a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7`, under
`test/binaries/win98-games-a-d/Age of Wonders2 demo-SW/extracted/`.
Current boot/fonts/native DLL closure, manifest and Worker-import prerequisites
passed. Static imports are an inventory, not invocation or API compatibility.

Actual original source commit was
`989ce3d323c40d40adbc3d86d134537d013962c5`. The prelaunch source records agree;
162 served JavaScript responses match their recorded source hashes. The actual
HTTP-200 noncached standard Wasm response is retained and hashes to
`16dc14ec794aa225ac9cfd414b64049e4b7a8dc7e161585ac20584cc29ce00b6`
(2,174,170 bytes). Built compat identity is
`83b3bb3ddc4bf3efe8af8e99d6489a2cfafa0f3c210ba39633c2e0941499ed37`
(2,176,816 bytes); the original browser used standard. JavaScript-only repair
does not change these interpreter modules.

The sole browser ran 21:32:06Z–21:39:12Z using Chrome 151.0.7922.108,
Node v24.18.1, a fresh owned profile, `defaultViewport:null`, and origin
`http://127.0.0.1:34955/index.html?debug&threads&d3d-renderer=webgl` with
COOP/COEP and cross-origin isolation. Actual generated production guest Worker
URLs, full Chrome arguments, serving/CDP ports and completed slices are retained.
The driver performs ordinary DOM mouse inputs and reads existing host metadata;
it makes no guest export calls, debug setters, breakpoint changes or forced
guest execution. No queued action timed out or was replayed.

Four focused protocol suites passed before the original and after the repair:
reservation, scoped yields, frame ownership and wait retirement. The actual
synthetic fixture is retained, 1,372 bytes, SHA-256
`4e3e7a797017fda64615819b6f7160ef7a3aea0f197726f76e9dd6838f8036c2`;
it tests production JS protocol, not the full original interpreter. Final
neighbor checks cover scoped loaders, wait identity and process-send admission/
runtime. The reviewed callback census retains general ownership as pending.
Required locked full builds and exact command outcomes are retained.

An initial final-build attempt correctly failed a missed census hash update;
its correction and later validation are retained. A corrected build's wrapper
terminated with signal 143 while its detached compiler continued: the pending
PIDs were resolved absent and complete module/data-check output retained before
a separately supervised final build. The original driver's enclosing wrapper
also returned 143 after ordinary closure; the Chrome exit code is 0, the driver
wrote `CLOSED ordinary stop`, and its own exit status is unknown. No cause is
invented for these wrapper terminations. No platform rejection/flag occurred.

Exact Git commits, relevant binary diffs, owned new-file patches, served-runtime
identity, fixture pins and unique logs/captures/modules preserve recovery; Git
is the source archive. No source tree archive, repeated media, download or
extraction was made. No corpus candidate exists for this app, so evidence stays
in this investigation instead of being attached to an unrelated dashboard card.
No boxes, subworkers, public deployment or Heroes II session were used.
Box ID/state/expiry: N/A; no box lifecycle operation occurred.

Final publication and independent process/port/profile/lock cleanup are recorded
in the run's `published.json` and `cleanup.json`. All owned files/runtime are
released only after those checks. Next: inspect the black-ground rendering
discriminator; any new original run needs separate authorization and a material
change. No logical FPS, audio or full terrain-parity acceptance is claimed.
