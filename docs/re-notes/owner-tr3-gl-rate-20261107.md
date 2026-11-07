# Owner TR3 WebGL check — 2026-11-07

**This attempt ended at the welcome screen because of a worker screenshot-review
error. It establishes no original TR3 GL gameplay, rate or release quality.**
The claimed disappearance of the welcome dialog is withdrawn: the initial and
fresh PNGs are byte-identical, and re-review at original resolution clearly
shows the welcome dialog and OK. No emulator defect was demonstrated.

Evidence: `scratch/runs/20261107-owner-tr3-gl-rate/`. Owner Telegram172 requested
actual GL movement, turning, weapon draw and ordinary-speed rate/quality checks.
The previous TR3 software and completed owner TR2 GL findings were read first.
Only one original executable launch occurred, on a fresh separate boat. No
second original, controlled stepping, local runtime/source/build lane, nested
worker, source/media archive or public deployment occurred.

## Terminal review failure and corrected evidence

Production URL:
`index.html?debug&threads&d3d-renderer=webgl&app=tomb_raider_3_demo`.
Original launch was 03:00:48 UTC. The initial screenshot at 03:01:06.928 UTC
shows the playable-demo welcome, Lara portrait, explanatory text and OK/Cancel.
The first ordinary OK request expired before dispatch; the complete ACK says
`refused-before-dispatch`, `effects=0`, `refreshRequired=true`.

A separate capture at 03:01:26.165 UTC was incorrectly assessed as showing only
the teal desktop. The worker stopped rather than clicking an allegedly absent
control. **Both retained PNGs have the same 142,558 bytes and SHA-256**:

`8f46cb0db4f3be58aa15e609ba983dc5f811b038abc4d0defb10e6ec4d8c2865`.

After shutdown, `view_image` with `detail: original` clearly showed the welcome
in the fresh PNG. The false assessment, subsequent shutdown and correction are
recorded in `capture-reviews.json`. The evidence does not establish a lost
dialog, composition defect or emulator failure. The exact terminal limitation
is worker review reliability and premature termination of the one original.

All three original commands have complete ACKs: zero-effect stale refusal,
fresh capture, ordinary quit. No successful guest input, partial or UNKNOWN
action, consumed-ID replay or second original occurred. Setup, passport,
New Game, Jungle, short forward movement, turning and weapon draw were never
reached. No gameplay quality or release recommendation follows.

## Actual renderer ownership and rate limits

The original has an isolated guest Worker, target
`DC144129B4608752702A2E72B725DE9E`, but **no render endpoint or owning render
Worker** at either welcome checkpoint. Original `d3dStats` is empty. Its GL
renderer string, GL error count and fallback count are unavailable, not zero.

Before the original, the production direct Boids qualification exercised an
actual guest Worker and healthy owning render Worker:

- Target `E030FDD009E52425557E8712625122C6`, session
  `8E36D9F85485609B6B71465071700215`, endpoint 1, `legacy/webgl`.
- Actual adapter present, failed=null, ready=1, control error=0;
  completed sequence 41→50. Natural endpoint draw calls 335→469,
  transport submissions 24→32 and flips 5→7. Samples are sequential.
- Natural endpoint errors=0, fallbacks=0, native software completions=0,
  fallback software completions=0.
- GL renderer:
  `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`.
  GL version: `WebGL 2.0 (OpenGL ES 3.0 Chromium)`.

This fresh boat used SwiftShader for its demonstrated WebGL context. It does
not reproduce the prior TR2 boat's Intel context and supplies no physical GPU
acceleration claim. The toolbar alone was never used to infer acceleration.
Boids qualification is not original TR3 rendering or performance evidence.

Displayed frames, renderer submissions and guest updates remain separate:
no sustained screen-canvas upload/display sample was collected; transport
submissions and draw calls above are not displayed frames; TR3 has no registered
validated logical-update marker. Original update rate and frame-time distribution
are unknown. Browser rAF, scheduler slices, cumulative flips and launch duration
were not converted into game FPS. A proposed `rate.cjs` observer was written
locally but never uploaded or executed; it provides no measurement or validated
collector claim. Physical scanout was not measured in headless Chrome.

## Qualification and retained identities

Nine atomic transport cases, seven executor/recovery cases, seven actual
production direct-initializer cases, balanced production renderer key-state
controls and invalid-duration controls passed. Native CDP trusted balanced
Up/Left/Space/Enter/Escape pairs passed on a generated blank page. The unchanged
scene guard remains 12 seconds; allowed key holds remain 50–2000 ms.

A separate generated PE ran in a real guest Worker, loaded pinned native
COMCTL32, returned DllMain EAX=1 and showed an ordinary tabbed property sheet.
Its explanatory label, OK/Cancel and disabled Apply were personally reviewed
before a balanced ordinary OK click and normal close. Boids and generated
controls ran before the original; their browser profiles and ports were closed.
An immediate pre-original sample briefly caught the generated controller finishing
exit; the later independent check confirms every tracked controller absent.

Qualification capture retrieval was attempted before startup existed. That
read-only request failed with FileNotFoundError; the qualification subsequently
completed normally. An initial diagnostic also tried to UTF-8 decode a binary
Chrome profile log. These retained helper errors are neither risk flags nor
UNKNOWN input outcomes. No input was replayed to repair them.

Staged source commit: `d96dd8ab7bf776350dc2ec1a73d708a8cefe543f`.
Relevant dirty/new-source binary patches and owned helper patches are retained;
Git remains the source archive. Actual original guest Wasm bytecode SHA-256:
`07f1cc970038f8ab31313b8b200edf26caa63473f293f5fc937f5cfe5c5c7f6e`,
2,181,179 bytes, matching the existing staged module. It was reused without a
rebuild; staging HEAD is not asserted as fresh module-build provenance.

All 633 provisioned serving/helper pins match before the original and after exit.
All 167 successful original HTTP responses match pinned bytes; four non-200
responses are retained. Executing JS was not separately debugger-source-verified
before shutdown. Chrome was 151.0.7922.108, headless, 1024×768 viewport.

All ten existing TR3 media identities match the retained software-run fixture.
The 920,064-byte `tomb3.exe` SHA-256 is
`8c7b25460f62c180ae675c2696ac66c8f97948a16458d0598ba72794ddcc7814`.
Native COMCTL32 SHA-256 is
`28a41e6a35c4509924a32a99841a815cf49e1d3ee6912ec26a823e45472edfa4`.
Media/config/save bytes were not edited or substituted. Upstream provenance and
historical native comparison evidence remain unavailable.

## Cleanup and next work

All 111 inventoried remote run artifacts were retrieved or matched with exact
size/SHA-256, with duplicate-module mappings retained. Original Chrome exited
normally, code 0, at 03:01:33 UTC. Independent cleanup at 03:01:49 UTC confirms
all six controller/browser PIDs absent, all six ports refusing, three profiles
absent and no writer locks. Cleanup's generic `pending: UNKNOWN; never replay`
template is not an UNKNOWN command outcome.

Fresh boat `bx_paqmnu8u` was created using a UUID Idempotency-Key persisted and
fsynced before allocation. Initial expiry: 03:59:17.190 UTC. Explicitly delegated
normal stop `stop_c4ac12ff7eb06dd0` completed at 03:01:51.340 UTC,
forced=false, error=null. State is archived, active expiry null. Allocation to
completed stop took about 154 seconds, within 35 minutes. Observed local free
disk remained above 2 GB. No held-risk retry, old403 resume or deployment occurred.

The next authorized attempt needs reliable fresh screenshot review, checking
byte identity and original-resolution evidence before declaring a missing dialog.
Original GL movement/actions and an ordinary-speed collector with explicit frame,
submission and logical-update semantics remain outstanding. No repair or build
was justified here. Publication and ownership release precede `result.json`,
written last, then stop.
