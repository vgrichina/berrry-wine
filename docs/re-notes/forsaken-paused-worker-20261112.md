# Forsaken paused-worker observer repair, 2026-11-12

The original startup blocker is reproducible in a small real Chrome dedicated
worker. The frozen attach order waits for `Runtime.evaluate` before
`Runtime.runIfWaitingForDebugger`; evaluation has an unknown outcome after
20 seconds even for a minimal globals probe. Neither a guest-worker control
nor a renderer-worker control reaches resume. Each unknown context was closed
without replay. This is an observer startup defect, not a proved game defect.

Predecessor: [the frozen raw-state startup blocker](forsaken-raw-state-boundary-20261112.md)
at `6cce439d8`. New local controls are retained in
`scratch/runs/20261112-forsaken-paused-worker-1645/`; the fresh original run is
`scratch/runs/20261112-forsaken-paused-worker-1645-original/`.

The run-local repair arms `beforeScriptExecution`, separately awaits startup
resume and the actual instrumentation pause, removes its breakpoint, installs
the observers with separately awaited `Debugger.evaluateOnCallFrame` commands,
then separately awaits `Debugger.resume`. This installs the observers before
the worker's first script executes. `Runtime.evaluate` at the instrumentation
pause also timed out in a separate control; it is not used for installation.

Call-frame evaluation exposed another concrete initialization failure: the old
renderer observer's synchronous `importScripts` fails while paused. The repaired
boundary helper uses an isolated lexical copy of the exact pinned region-map
and pure JS translator sources. It neither fetches those dependencies while
paused nor duplicates the guest bootstrap's global lexical declarations.
Observation method bodies and the ordinary worker bootstrap remain unchanged.

The attach helper checks the exact target type, recognized path, paused script
URL, dedicated-worker global class, classic `importScripts` readiness and GPU
globals. Actual module-worker, unknown-scope, missing-GPU-global and deliberate
observer-failure controls terminate before observer resume. A separate wrong
target-type control makes zero protocol calls and proves sticky failure.

Both real production worker bootstrap scripts subsequently run and emit a
post-resume ready message. The actual paused Chrome guest-worker control also
uses the production encoder: opaque/additive/opaque packets and command messages
are byte-identical to a separate unobserved Chrome control. Its natural enqueue,
owned-copy and publication observations retain the three state values with zero
observer errors. Adapter return/error identity and high/sparse translation
regressions pass with the repaired helper. The prior real-x86 22-poststore,
combined ACK/drain and locked-build evidence is reused with its recorded hashes;
no production runtime source changed.

The original run's final helper/data pins were frozen read-only and reread.
The actual local `Transport.provision` whole-input seam, stale-final-pin
rejection, Python syntax/safe imports and JavaScript transitive-import preflight
passed before allocation. The same attach/boundary bytes passed the real Chrome
controls. An independently observed two-hour watchdog preceded private box
allocation. Provisioning reread all 1,553 remote paths, and the remote full-pin
and import preflight passed before Chrome. The source base is main
`241ff557017eaf834e270357a03f2377107e6945`, with exact binary source patches
and helper patches retained as gzip plus raw SHA-256 recovery records. Git is
the source archive; no source-tree or media archive was made.

## Original raw-state transition

Fresh original menus, VOLCANO briefing and native `a600/a700/a300` reached the
corridor. `corridor.png` at 16:58:23.321Z shows five lives and SHLD128/HULL128.
The subsequent primary pulse's capture shows four lives and a respawn; the
passive capture at **16:59:43.823Z** shows the white viewport. This differs from
the predecessor's five-life sequence. In particular, the first retained sampled
white transition below precedes the primary keydown at 16:58:57.826Z; do not
attribute its cause to that input. Ten full frames, eight balanced native pulses,
sixteen trusted game input edges and ten command ACKs are retained; none was
replayed. Owner/module bindings and independently armed releases are retained.

The actual owner is WebGL2 on Intel UHD 620 / Mesa 23.2.1 through ANGLE,
endpoint 1. The recovered module matches normal
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`;
the unchanged compat module is
`29722b7f115faa0807b8a8543ab4ed221e9c820d699a7d6e10a025aa29487ed4`.
CPU target `167F6369A155520B062BDD93F21E840D` and GPU target
`232BBC76756B54E88BE5E3BDE45460C2` retain the complete owning identity.

`transition-analysis.json` joins natural source sequence/ordinal and producer
buffer/index/offset/ordinal. Its first retained selected-pixel white transition
after the corridor fence is **GPU order 30810, sequence 10339 / ordinal 0**,
in `diagnostic-tick-138.json.gz`, drained at 16:58:49.621Z. The sampled pixel
changes `[255,251,239,255]` to `[255,255,255,255]`. This is scene geometry using
texture entry 131811840, with depth writes enabled and additive ONE/ONE blend.
This identifies a sampled-pixel transition, not the exact instant the entire
viewport becomes white or the texture's earlier asset/writer provenance.

For this draw the complete retained chain agrees:

- Live CPU state: device 136454216, device slot 9, state guest 15893092,
  translated state address 11772516, observed before enqueue.
- Owned packet: producer buffer 2 / index 1 / offset 0 / ordinal 0.
- Published packet: sequence 10339 / ordinal 0.
- Replay source: the same sequence/ordinal, then workspace guest 25227268 /
  translated address 21106692, then raw state before and after description.

Every boundary retains RS1=208, RS7=1, RS14=1, RS15=0, RS19=2, RS20=2,
RS21=2 and RS27=1, with render-state-region FNV32 1932394300. The description
agrees on blend=1, srcblend=2, dstblend=2, zwrite=1 and zenable=1. FNV is an
auxiliary checksum; it is not a cryptographic proof of all state bytes.

The missing distinction from the predecessor is now observed directly:
opaque restores **do** reach the same live state. CPU boundary rows 165068,
165070 and 165072 read back RS27=0, RS14=1 and RS20=1. Subsequent natural
changed-state hooks and readbacks, rows **165090 / 165092**, set RS27=1 and
RS20=2 again. Row 165094 reads back texture handle 208 with that additive
state, before enqueue-owned row 165096. Therefore this white-producing draw
already has additive state before snapshotting. These records do not prove
why those natural state writes occur or whether the guest's intended rendering
is correct; they do not establish a snapshot/replay/description corruption.
No runtime defect was proved and no runtime repair was made.

Across 190 drains there are 265,572 boundary rows, 449,846 retained CPU rows
and 9,583 GPU producer events. All 40,263 observed next-natural-boundary
post-store readbacks match the requested value. There are 26,575 matching
live/owned snapshots and matching owned/publication pairs, and 25,590 matching
publication/replay pairs. All 25,592 observed source/replay-workspace pairs
agree. Raw state is unchanged across description. Thirteen direct raw/description
differences are expected depth normalization: ZENABLE=0 makes effective
ZWRITE=0 despite raw ZWRITEENABLE=1, as implemented at
`src/09ab-handlers-d3dim-core.wat:802`; they are retained explicitly in analysis.

Limits remain explicit: the old CPU observer dropped 10,108 startup rows;
boundary rows have no recorded gaps, drops or observer errors; GPU event drops
are zero. Fifteen ground drains reached their existing record limit, including
command 7. The first white witness's tick-138 drain did not reach that limit.
Two final replay keys, 12140/0 and 12141/0, lack publication rows in the retained
producer sampling; both are after the selected white witnesses. Startup replay
source packets before trace arming are also absent. These limits preclude a
claim of complete global boundary coverage. CPU and GPU serials are separate
orders, joined only through the observed packet boundaries.

## Shutdown and next boundary

All 326 unique remote outputs were downloaded twice independently, then reread
and SHA-256 verified locally before delegated normal stop. Chrome and the browser
runner have actual zero parent waits and both EOFs. The outer API command was
independently observed exited/known with exitCode=0 and untruncated stdout/stderr
before archival. An earlier read-only GET used the wrong ID kind and returned
400; the corrected process-ID GET is retained. No unknown outer status is filled
from a nested wait. Local lifecycle client, owning parent and independent
watchdog all have actual zero waits and EOF evidence.

Box **`bx_3cu575f5`** initially expired at 18:51:00.826Z. Its final state is
**archived / expiry null**. Normal stop **`stop_b8febdfce98fe864`** completed
at **17:01:02.886Z**, forced=false, error=null. Do not resume or delete it.
The 26 exploratory/control Chrome processes also retain actual close/EOF
records and bounded independent watchdog cleanup. Sampled actual local free
disk stayed above 1.5 GB; no RAM gate was used.

The paused-worker bootstrap seam is repaired and original raw-state witnesses
are obtained. Further cause work should identify the origin and intended state
of the additive writes **before enqueue**, with the life-loss/respawn difference
preserved. Do not introduce a blend, clear or texture workaround. There is no
changed-original before/after, parity, FPS, audio, full-27, enemy-defeat or level
completion claim. This worker does not confer independent root acceptance.
