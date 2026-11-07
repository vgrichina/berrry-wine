# MCM original natural Flip spans — 2026-11-07

The dominant synchronous Flip cost is **inside `gl.readPixels`** on the
original owning Worker WebGL renderer. Four natural Flip fences spend
99.91–99.97% of their inclusive wall time there. The first three also retain
complete writeback/watch spans: writeback takes 0.70–2.10 ms and watch capture
0.01–0.02 ms, versus 2,113–2,482 ms readback. No optimization was implemented
or measured. This identifies the blocking call; it does not separate queued
GPU work, driver wait, transfer, or internal format conversion within that call.

Evidence: `scratch/runs/20261107-mcm-original-flip-spans/`, especially
`probe-read.json`, `span-analysis.json`, `probe-live-identity.json`,
`original/evaluation-times.jsonl`, and `review/race-settled.png`.

## Original and measurement

Exactly one original was launched on fresh UUID-idempotent boat
`bx_tzs7wvwu`, using source commit
`d5d4f01d262528c237d3206aa39e592cb959901c` plus recorded relevant binary
patches, including the existing untracked `lib/wininit-boot.js`. All 892
staged file hashes/lengths matched before launch and at termination. The 311
registered original inputs remain pinned to existing paths; the companion
manifest matches the preceding original's retained manifest. No source/media
archive was made. Existing built modules were used; no rebuild was needed.

Personally reviewed the native route: video-memory OK, RIDER name, Single
Player Event, Stunt Quarry, Practice/two opponents, T-rific, default rider and
yellow bike, Start. `race-settled.png` shows textured quarry terrain, the
centered rider and yellow bike, and a near-zero gauge. No driving or steering
input was sent. Race presence is established; driving speed, steering, FPS,
audio and parity are not evaluated.

Actual environment: baremetal boat provider; Chrome 151.0.7922.108,
V8 15.1.206.16; legacy WebGL endpoint 1; reported GPU
`ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6 (Core Profile) Mesa 23.2.1)`.
Independent live page/guest/renderer/module checks established guest target
`EE3345AD566B65A360B821AD64D871DA` and renderer target
`C0AB8841570DEB2B70D8F8C69E819F3F`. Both recovered live modules hash to
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
The probe's endpoint/epoch agrees with the independently established renderer
epoch retained in the identity receipt.

The accepted probe was installed only after that identity check, then armed
for 10,000 ms with 512 records. It retained 238 completed spans, zero dropped,
and stopped admitting spans at its monotonic deadline. No extra sync,
readback, guest call, clock/configuration change or bypass was introduced.
The natural fourth readback crossed the deadline: enclosing spans complete,
but subsequent writeback/watch entries are absent and are not estimated.

| Batch / Flip ordinal | Replay ms | Fence ms | readPixels ms | Writeback ms | Watch ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 117 / 132 | 2772.785 | 2472.175 | 2470.010 | 2.095 | 0.010 |
| 123 / 132 | 2926.055 | 2482.485 | 2481.750 | 0.700 | 0.020 |
| 129 / 37 | 2303.400 | 2113.740 | 2112.775 | 0.940 | 0.010 |
| 135 / 38 | 2493.475 | 2315.590 | 2314.430 | deadline-excluded | deadline-excluded |

Every row is correlated by owning endpoint, epoch, batch sequence and
production Flip record ordinal/kind. Durations are inclusive and overlap;
watch capture is nested in writeback. Whole-batch admitted flush spans total
295.315, 438.525, 187.125 and 98.330 ms respectively; the fourth total excludes
any post-deadline entries. Target binding is at most 0.005 ms. The fence's
own initial flush is included, so fence time cannot be added to flush time.

Host request/reply times are recorded separately for every page and renderer
evaluation. The post-return receipt read ran 14:07:01.156–14:07:01.764Z
(607.784 ms), distinct from the measured readback spans. Disposal returned
14:07:01.767Z. The probe cannot observe the middle of a synchronous call.

## Controls and closure

Existing live identity/module inventory, 12-second capture freshness,
independent scheduled key release, exact numbered ACK and terminal UNKNOWN
rules were preserved. Two requests were refused before dispatch as stale,
each followed only by fresh capture. A local caller mistakenly attempted
retrieval after the second refusal; the absent capture fetch failed and is
retained. It sent no input and did not replay an uncertain command. A local
probe-command parser omission was corrected before publishing any command.
All 18 actual commands (0–17) have matching successful exact-ID ACKs, including
the explicit zero-effect refusal status where applicable. No fixture suites
were repeated and production files were not changed.

Physical/async keys were released and input queue empty before ordinary quit.
Chrome exited 0, all 14 recorded processes disappeared, both ports refused,
and profile/writer lock were absent. All 188 terminal artifacts, 9,028,999
bytes, were recovered with SHA-256/length verification before delegated
normal stop. Boat `bx_tzs7wvwu` is **archived**, stopped 14:08:05.599Z,
operation completed 14:08:05.618Z, `forced:false`, active expiry null.
Original archive deadline was 14:32:41.267Z. The immutable task/runtime cap
was 14:02:41.096–14:27:41.096Z. No old boat was resumed, stopped or deleted.
Sampled local free disk stayed above 3.68 GB; checks immediately preceded
allocation and artifact retrieval. Remote preflight free disk was 58.4 GB.
Continuous disk telemetry is not claimed.

Span completion/correlation/nesting/bounds, media-reference identity,
terminal retrieval and cleanup assertions pass. Documentation whitespace and
run evidence validation are recorded with the run. The next design question
is how to avoid blocking the renderer event loop while retaining ordered DIB,
scratch, snapshot and completion ownership. That requires a separately scoped
regression and implementation; this measurement proves no optimization gain.
