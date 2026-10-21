# Mad Bomber: authenticated browser logical FPS

**94 logical gameplay loop entries / 4,438.655 ms = 21.1775864536 FPS** on
exact main `f09e09c6643997986bbafad69c37adae4906df90`. This is one short,
actual instrumented wall-clock interval, not display FPS, a sustained average,
or an uninstrumented performance estimate. One browser session completed in
14.204 seconds, under its 60-second deadline; no second session was needed.

## Game-specific semantics

Original `madbomber.exe` SHA256
`72ad26d11ddabf72c668b69eda0c7c1daa634f5cade631303ba4e05eb5f5cc09` is UPX
packed. `unpack.py` transcribes its own decompression/filter stub at
`0x416600..0x416706` into a read-only analysis copy. It does not change the
launched EXE. The stub, decoded bytes, recovered import names and disassembly
are preserved. The entire **6,848-byte live game-loop range
`0x403d01..0x4057c0`** matches the independently decoded original, before
sampling and at every sample. This live comparison is the check on the
analysis decoder, not an assumption that an unpacking script must be correct.

One entry at `0x403d01` is one iteration of the original gameplay loop:

* `0x403d0b` calls SDL_GetTicks via `0x40a980`; `0x403d13` increments the
  game's frame variable at `0x40fd40` once. SDL_PollEvent is the inner input
  loop at `0x403d20`, so multiple input events do not create extra frames.
* Active-play state at `0x411a40` gates bomber movement and bomb emission at
  `0x404197` and `0x4042fa`. The bomb loop at `0x404687` updates each active
  bomb's Y at `0x4046ed`. Bucket and drawing work are inside this same outer
  loop; SDL dirty-rectangle updates are not counted as frames.
* `0x405788..0x4057ab` performs the original SDL tick/delay check, then
  `0x4057bc` branches back to `0x403d01` unless the game exits this loop.
* The game's frame variable resets at initialization (`0x403c8b`) and the
  fire/start transition (`0x404039`). It is useful corroboration, not the
  authoritative reset-free measurement counter. During the measured interval
  it advances **27 → 121**, exactly matching marker **53 → 147**. The offset
  is 26 in every one of the 46 samples.

The existing WASM `set_logical_frame(0x403d01, 0)` installs the decoder's
logical-entry marker. Pace **0** counts without changing guest pacing;
`get_logical_frame_paced()` remains 0. The exact source has one counter
increment site, no reset writer, and per-instance initialization at zero.
Setting a new address flushes decoded code at a block boundary; that cost and
subsequent marker/cache effects are not claimed to be free. The flush precedes
both the short probe and primary interval. Decoder and micro-op compiler rules
prevent a fold or compiled loop from swallowing the marker.

These addresses belong to this original Mad Bomber build and were derived
here. No Hype address, renderer swap, requestAnimationFrame count, expected
30 FPS target or guest clock is used to calculate the result.

## Live owner, short gate and rejection controls

The registered route honors `threads:false`. Live inventory finds a main
instance with exported thread ID **1**, plus one cooperative instance with
handle **921600**, internal tid **1**, exported ID **2**. Both execute in the
page clock domain; there is no guest Worker backend. The main instance equals
`threadManager.mainInstance`. Both counters were enabled and sampled; only
main emits this game-loop marker. The cooperative instance stays at 0.

Before the primary interval, nine genuine timestamp/count pairs over
718.86 ms show **15 entries on main and zero on the cooperative instance**.
The executed task-specific validator rejects the live wrong owner and six
mutated copies of this probe: disabled marker, changed owner ID, changed clock
origin, decreased count/reset, lifecycle mutation and inactive gameplay.
All seven rejection results have FPS null. The gate was saved at
17:35:31.351Z, before primary sampling began at 17:35:31.544Z.
`validate.js` is a new capture-local contract checker; no existing production
validator or Hype validator was changed or relabelled.

Every sample records `performance.now()` paired with each instance's counter,
clock origin, current thread ID, enabled address/pace, paced count, identity,
live code match, running/active state, owner count and sampling cost. Forwarding
wrappers record host logical-setting calls and cooperative map lifecycle
changes; an instance-property observer records main-instance replacement.
They preserve original calls/results. All event records remain empty.
Original address/pace values (0/0 on both instances) were restored, timers and
wrappers removed, and the owned browser/server closed normally. The preserved
source accounts for the counter's reset-free lifetime; samples alone are not
claimed to exclude every hypothetical hidden reset or unaudited script.

## Actual interval and environment

The measured page timestamps bracket **17:35:31.544–17:35:35.983 UTC**.
Duration uses the precise monotonic timestamps, not rounded UTC strings.
There are 46 paired samples. Ordinary Enter selects One Player, Space starts
bombs, and DOM mouse events move the buckets. Personally inspected
`measure-before.png`, `measure-during-right.png` and `measure-after.png`:
active falling bombs, bucket movement and score **0 → 1 → 3** bracket and
identify this interval. All active-state samples equal 1. No restart, pause,
extra fire or menu action occurs during it. The result does not extend to the
later Press Fire state or to full-game completion.

Chrome **151.0.7922.108**, Node **24.18.1**, viewport 1000×760, game client
640×480, assigned 4-vCPU/8-GB Boat `bx_ppatp9cq`. Exact route:
`http://127.0.0.1:8080/index.html?app=madbomber&debug`, through the unchanged
registry and browser shell. Live renderer is **Win98Renderer with
CanvasRenderingContext2D**. CDP reports ANGLE/SwiftShader (SwANGLE 5.0.0),
a software graphics environment, not hardware GPU qualification. The toolbar's
WebGL selector is not evidence that this SDL game used a WebGL renderer.
Display FPS, hardware-GPU performance, audio quality, full completion and
Windows parity remain unqualified.

Sampling both owners plus authenticating the live code costs **24.925 ms**
total, median **0.5075 ms**, maximum **1.210 ms**, or **0.56154%** of the
measured interval. Maximum timestamp/count read span is 0.015 ms. The one
in-interval screenshot costs 234.872 ms of driver elapsed time; gameplay
continues and that time is included. There is no subtraction, causal
overhead baseline or claim that this isolates marker/cache, event-loop,
CDP/screenshot contention or timer costs. `overhead.json` preserves details.

## Provenance and diagnostics

No rebuild: the retained canonical module was inventoried and verified as
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`,
1,878,508 bytes. Its actual Chrome response body has that same SHA256 and
size at `/build/wine-assembly.wasm?v=dev`. Canonical build revision is
`30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`; retained build exit is 0.
Exact Git comparison to intended main changes only docs/evidence/status and
two unrelated Army observer tool/test files, absent from this route. Browser,
compiler, build inputs, package lock and production sources are unchanged.
The 7,299-entry canonical and 6,909-entry staged manifests match their Git
trees; all staged files match before and after the run.

All **168 asset pins** and **2,407 dependency files** verify pre/post. The
original retained archive is unchanged: SHA256
`b5353b73674a1af6109cb9bf3af5f7d0383308b7ef0b47d52139813ba3ee98ef`,
3,069,702 bytes. It was transferred to the fresh box without redownload or
local duplication. Exact-lockfile npm ci exit 0. No production source, guest
memory, API behavior, clock or original binary was modified.

Full diagnostics are retained: 109 console messages below the 2,000 cap,
139 network records, four failed requests and four optional 404s (build-info,
icon, favicon twice); page errors are empty. This run has one console warn
(the deprecated mobile-meta warning). Audio was not investigated. Harness,
Chrome close and server cleanup complete normally; session process exit 0.
The evidence checker and offline verifier results are retained separately.

## Evidence and handoff

Bundle: `scratch/runs/20261021-madbomber-browser-fps/`. `verify.js` replays
identity, recovery seals, live-code/owner authentication, seven controls,
measurement, matching guest frame deltas and cleanup. Four screenshots and
all diagnostics are recovered individually, with 24 remote-file seals
(1,643,807 bytes), rather than making another archive. `RECOVERY.md` preserves
staging/reproduction instructions; publication receipt records the task commit
and exact remote branch. No main merge or deployment.

**SAME bx_ppatp9cq is left RUNNING**, API state idle, health ok, expiry
**2026-10-21T19:28:40.555Z**. Owned harness PID 26854, Chrome 26876 and server
26865 are absent; port 8080 is closed. Complete staged source, dependencies,
originals, canonical module and evidence remain at `/home/user/madbomber-fps`.
Coordinator owns snapshot-stop and lifecycle. Handoff is well before 19:05 UTC.
No workers, new boxes, resumes, box SSH, public hosting, root task/status edits,
shared Git configuration, laptop/Heroes II/Warcraft III or fleet changes.
