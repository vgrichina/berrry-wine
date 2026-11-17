# GL browser startup and shade repair continuation, 2026-11-16

The independent browser watchdog startup defect is reproduced and repaired in
uncommitted WIP. Full publication remains unqualified: both current shared and
HEAD-plus-whole-owned browser runs stop at the same software GL_POINTS pixel
failure. No implementation is committed by this continuation.

Evidence: `scratch/runs/20261116-gl-browser-startup-shade-repair-continuation/result.json`.
Source recovery uses exact Git SHAs, binary patches and file hashes. No source
tree, game media or Wasm bundle is archived. The seven inherited files were
preserved byte-for-byte before any edit; the only inherited file edited by this
continuation is `test/test-gl-native-render-load-web.js`. The generic
GL_LIGHTING_BIT shade-mask repair and its other inherited fixtures remain WIP.

## Startup diagnosis and repair

`test/test-gl-browser-watchdog-startup.cjs` creates a new browser profile,
HTTP origin, shared state and nested guard for each case. Its Chrome launcher
cannot exec until an independent PID-generation watchdog has armed. The fixture
records actual script entry, initialization entry, shared ready publication,
direct event delivery, fixed absolute deadlines, termination and output EOFs.

The synchronous case reached its original 3,000 ms deadline with no child script
entry, no initialization, no ready publication or receipt, and zero GL/later
requests. A separate yielding case entered and published ready in 37 ms and
received the real stop acknowledgement. This reproduces the creator blocking
its nested browser Worker from starting. The old failed endpoint was never
reconnected or retried.

The owned harness now yields only during startup, retaining the absolute
three-second deadline from launch. The physical guard checks the shared terminal
state and startup deadline before publishing ready. Startup errors and expiration
remain permanent UNKNOWN; the independent operation guard and its fixed
three-second bounds remain intact. No fake ready or deadline extension is used.

Seven authored Node controls pass, including an actually blocked parent and an
actually thrown startup error. All eight fresh browser cases complete with
actual Chrome/supervisor waits and both output EOFs: synchronous reproduction,
yielding success, stalled parent, late ACK, early EOF, cancellation, startup
failure and generation replacement. Negative browser cases refuse replay,
rebind and late-ready attempts before dispatch. The delayed ACK cannot publish
ready after terminal state. The physical guard reaches the host while the
producer is blocked. These controls do not qualify native GL rendering.

## Current qualification and first remaining blocker

At Git `d89d4ee914c37787dc4f7173620042a04099beb0` plus the recorded whole-owned
patches, both source views pass a full locked build and all 17 focused commands,
including the full encoder, real delayed Worker, context/pool/error isolation,
state/array/pressure coverage and normal/compat public x86 native GL. Each native
module executes 664 public calls and 36 observations on llvmpipe; this is software
coverage. The HEAD view includes all seven inherited files and the new guard
fixture, while excluding foreign uncommitted source through the pinned read view.
Actual executed JS/JSON, HTTP scripts, compiled/instantiated Wasm and native addon
pins are retained. Browser SystemInfo identifies ANGLE_SWIFTSHADER; the page's
Intel renderer string does not establish hardware coverage.

Both browser runs pass default WebGL and software scenarios, plus WebGL points.
The default WebGL scenario retains 14 leased batches, zero copied bytes, FIFO,
two live credits, reuse, retirement and partial-fault checks. Each successful
scenario records real guard ready/stop receipts and zero later requests.

The fourth of 26 scenarios, software primitive mode 0, fails: all six samples at
canvas pixel (0,7), expected white for point (-0.875,-0.875), retain the six clear
colours. Both source views produce the identical failure. This is an assertion
failure after real rendering, not startup UNKNOWN; Chrome exits normally with
both EOFs. No assertion was relaxed. Later 22 primitive scenarios, including
browser EDGE and projective-W cases, remain unrun/unqualified.

Static follow-up identifies a likely software raster cause:
`src/09a8g-gl-raster.wat` projects x=0.5 through `gl_sw_coord`, rounding it to 1,
then its point path uses that integer directly. The WebGL contract covers x=0.
This raster source was not edited. A dedicated full-pixel point witness and a
correct software point raster rule are the next work before resuming the full
matrix. The generic shade and startup fixes are retained as material WIP until
all required checks pass; passing subsets do not establish complete publication.

## Lifecycle and scope

Work began only after the root remote-merge release and both final predecessor
releases. Personal verification checked Sims release `e6ce7ded…` against 1,094
direct hashes, 992 actual waits/both EOFs and 930 absent PID/groups; GTA2 release
`60743c2c…` against 141 hashes, 96 actual waits/both EOFs and 96 absent PID/groups.
Historical missing receipts remain UNKNOWN and are not inferred from absence.
Every new runtime retains its own closure evidence. Final source patches,
selected full captures/logs, native pins and closure are named in the result.
Foreign WIP is preserved and unadopted. NativeQuit is distinct from fixture host
stop. No original game, gameplay/parity/FPS/audio, full-27 or hardware claim is
made. No workers or boxes were created; box ID/state/expiry/stop receipt are
null/NOT_CREATED/not applicable/not applicable.
