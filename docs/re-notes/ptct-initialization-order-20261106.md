# PTCT initialization order — 2026-11-06

The original executes texture initialization from a CRT initializer table,
before the resolution chooser, window creation, and first current GL context.
Guest API entry, synchronous stream replay, original return sites and small
read-only guest-code excerpts establish this boundary. No emulator ordering
discrepancy was reproduced; no semantic repair is justified. Original animated
beam phases were inspected on software and WebGL. Complete intro playback,
normal timing and Windows-reference correctness remain unverified.

## Workflow and identity

Read `CLAUDE.md`, the agent capture workflow in `ops/README.md`, and
`ptct-texture-correctness-20261106.md`. Work stayed read-only until the
coordinator's explicit 16:11:04.945421 UTC grant, expiring at 16:56:04.945421
including cleanup. Both predecessor FINAL records and cleanup were checked.
Only one local heavy runtime ran at a time. No box or additional worker was
used. No guest bytes, context state, texture state or media were replaced.
This follow-up reused the retained capture workflow rather than repeating the
texture census.

Original: `test/binaries/demoscene/ptct/PTCT.exe`, 74,752 bytes, SHA-256
`89028685eb2968dcc9a9dd6b7941e4fad47a70e505820dc1be350a0d30526cc4`.
Registered `ptct` still uses resolution chooser command 1.

Evidence: `scratch/runs/20261106-ptct-initialization-order/`. Tested Git source:
`e88ea99caaae474aea18afd8ad59cce567974399`. `tested-inputs.json` pins 1,282
source/runtime inputs; `postbuild-identity.json` verifies their hashes after the
locked full build. `runtime-source.patch` and `runtime-source-final.patch`
record tracked production differences (empty); `untracked-wininit.patch`
preserves a pre-existing untracked runtime input without adopting ownership.
Git plus these patches provide source recovery; no source/media archive was
made. Small instruction excerpts are emulator execution evidence only.

`flock /tmp/wine-build.lock bash tools/build.sh` passed. Both rebuilt shipped
modules retained their pinned identities:

| Module | Bytes | SHA-256 |
| --- | --- | --- |
| `build/wine-assembly.wasm` | 2,180,377 | `43a0097ab79e1e9102d6f12411485a359ebe10b03af5fcf22675b75ad701a081` |
| `build/wine-assembly.compat.wasm` | 2,183,023 | `7219c6f2d7bcf6f91975a8b3bb9fbac35cbc5933c8fc47fe5d4a44b31f1c7a46` |

Both successful original browsers observed actual standard-module instantiation
with the first hash. The bounded CLI explicitly selected the compatibility
file with `--no-build`. These are distinct module observations, not a claim
that every browser callback was repeated on the compatibility module.

## Actual issue, replay, and return order

Reused `test/run.js` bounded API/GL/callstack tracing first.
`cli-compat-correct-path.log` ran at most 25 wall seconds / 100,000 batches,
trace window 0–10,000, callstack depth 24, stack scan at allocation/context
creation, breakpoint `0x412310`, and counters at all five requested sites.
Chooser input was `--input=1:wait-dlg-control:1:5000,2:dlg-cmd:1`.
It ended normally after 80,960 batches / 24.998 seconds with 4,592 API calls.
API #281 allocation and #284 upload precede #300 DialogBoxParamA, then #418
CreateWindowExA, #428 context creation and #429 make-current. All five site
counters are one. CLI API text is buffered by batch: API sequence numbers and
the breakpoint, not textual line position, establish issue order.

This CLI has no drawable GL backend: context creation returns zero and making
NULL current returns one. Those values are a harness limitation, not an
original context defect or a rendering comparison. The first CLI attempt
stopped at its 1,000-batch bound before initialization; another command used an
incorrect hyphenated compatibility filename and was rejected before guest
execution. Their logs remain preserved as unsuccessful harness attempts.

The qualified run-only browser observer wraps existing API-entry/exit, flush,
bridge and EIP hooks. Debug exports only enable observation; guest execution
and API return values are not changed. `software-order/phase-0.json` and
`webgl-order/phase-0.json` retain the complete startup event sequence, stacks
and original return states. The first three operations all occur at guest
208 ms on guest thread **1**, bridge owner key **0**, current **0**, contexts
**0**. Owner key zero is not a guest thread ID.

| Operation | Guest issue / stream behavior | Original return state |
| --- | --- | --- |
| `glGenTextures(1, 0x074ffeac)` | Entry → flush → replay → API exit → original return | `0x412310`, ESP `0x074ffe98` → `0x074ffea4` |
| `glBindTexture(GL_TEXTURE_2D, 0)` | Entry and return; buffered record replays in the next upload flush | `0x412322`, ESP `0x074ffe98` → `0x074ffea4` |
| `glTexImage2D(..., 0x5f7324)` | Entry → flush replays preceding bind then upload → exit → return | `0x41236d`, ESP `0x074ffe7c` → `0x074ffea4` |
| `wglCreateContext(0x00310001)` | Later synchronous flush, contexts 0 → 1, result 1 | `0x411c08`, ESP `0x074ffcf8` → `0x074ffd00` |
| `wglMakeCurrent(0x00310001, 1)` | Later synchronous flush, current 0 → 1, result 1 | `0x411c1b`, ESP `0x074ffcf4` → `0x074ffd00` |

Context creation/current occur at 256 ms software, 272 ms WebGL. A second
pre-context bind buffered after upload is drained before context creation,
also with no current context. The short bind buffering is real, but does not
turn a valid-context upload into an early observation. The allocation and
upload replay synchronously while their originating guest calls are active.

`return-state-comparison.json` verifies all five original EIPs, guest thread 1,
expected stdcall ESP advances and unchanged shadow returns on each backend.
Software records EBP preservation; WebGL additionally records preserved EBX,
ESI and EDI across each individual call. Changes made by guest instructions
between calls are not misclassified as API corruption. Raw EAX zero for void
GL calls is not an allocation-success result. Both WGL returns are one.
No first emulator divergence was found at these boundaries.

## Why initialization precedes context creation

At allocation, both browsers retain the same eight shadow return addresses:
`0x4187f0`, `0x418813`, `0x416829`, `0x41673e`, `0x4189f4`, `0x4085d8`,
`0x4085b5`, `0x418c34`. The CLI agrees and its physical stack also contains
the MSVCRT initializer iterator return. `caller-*.bin`, `startup-extra.json`,
and `webgl-order/startup-extra.json` retain bounded read-only excerpts and
pointer tables from the original execution, without a source/media snapshot.

The supported call chain is concrete:

1. Original `0x418c25` pushes end `0x41d00c` and begin `0x41d000`, then calls
   `0x418e34`, returning to `0x418c34`.
2. The helper jumps through IAT slot `0x41a140`, observed as `0x597fa8`.
   This is the loaded MSVCRT `_initterm` export: DLL base `0x596000` plus
   export RVA `0x1fa8`. Its original instructions iterate non-null function
   pointers and call them.
3. The observed initializer table includes `0x4085b0` at `0x41d004`.
   `0x4085b0` calls `0x4085c0`; that function passes constructor `0x416730`,
   destructor `0x416890`, count 16, size `0x5c`, and object base `0x41ea28`
   to `0x4189b6`. The captured return chain enters that constructor and then
   the texture initialization path.
4. Later original window startup calls CreateWindowExA at `0x411f6b`, resumes
   at `0x411f71`, then calls context setup `0x411b30` at `0x411f76`, returning
   to `0x411f7b`. This puts context setup after the window-creation callback
   continuation completes, rather than inside the earlier CRT initializer.

The late read-only initializer-table snapshot is labeled with its actual
capture time, not represented as a snapshot taken at the first texture call.
The original instructions and matching live/CLI call chains support the
initializer interpretation. Full symbolic CRT/object names are not inferred.

API handler-exit hooks for DialogBoxParamA and CreateWindowExA can point into
a scheduled dialog/window callback before their public API continuation has
returned. They are not interchangeable with an original return-site event.
All named GL/WGL site snapshots have synchronous-depth zero, but that counter
alone does not rule out continuation callbacks. The retained stacks, original
code and return transitions establish the limited path above; they do not
certify every nested callback or all future thread scheduling.

Source review agrees: `src/09a8c-gl-encoder.wat` copies command arguments,
flushes barriers synchronously through opcode `0x10001`, and applies context
state transitions after the WGL result. `lib/host-imports.js` directly replays
local batches, `lib/gl-command-stream.js` preserves record order, and
`lib/gl-compat.js` traces before `_call` looks up current context. The separate
Worker endpoint does not establish reordering on these `no-threads` runs.
Bridge owner is restored in `finally`. `src/09a5*` startup/window continuations
and the normal browser startup `send_message` path were reviewed, not replaced.

Microsoft specifies that GL calls without a current rendering context have
no effect: [Rendering Contexts](https://learn.microsoft.com/en-us/windows/win32/opengl/rendering-contexts).
[WglMakeCurrent](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglmakecurrent)
defines calling-thread binding and NULL-context unbinding. These semantics
support preserving this boundary; they do not justify creating a context early
or replaying the upload after later context creation.

## Controls, failure history, and animation review

`prepare-control.cjs` generates a two-dialog PE. The existing registered
startup scheduler selects command 1; the guest stores return value 1 and shows
“Command consumed”. `control/proof.json` passes and its final image was
personally inspected. This control initially preceded the additional observer.

The first original software attempt failed at **16:19:26.978 UTC** in that
observer's TextDecoder call: it decoded a shared view without copying it.
DllMain had not completed (EIP `0x59944e`, ESP `0x074fffe0`, EAX 1); no chooser
or texture code ran. The shell stopped and released the instance. The failed
observer source is retained as `order-observe.failed.js`, alongside its logs
and `observer-failure.json`; this is not a guest/emulator failure.

At 16:22:13 the coordinator explicitly clarified that this setup error permits
a corrected clean launch within the existing deadline, after generated
shared-memory validation. The run-local decoder now copies the bytes before
decoding. `control-order/proof.json` passes the actual API-entry/exit observation
on guest thread 1, as well as command return 1. Both successful originals then
launched cleanly; no partial failed DllMain state was resumed. The WebGL
observer adds read-only nonvolatile-register getters; its software version is
retained separately as `order-observe.software.js`.

Successful captures reuse the retained driver, registered Launch and chooser,
`WineFrozen.step(10,16)`, Chrome 151 / ANGLE SwiftShader, and
`debug&no-threads&perf-stream&frozen=16&gl-renderer=<backend>`. The software
route's WAT software-enabled/present counters identify its actual backend;
the shell's visible GPU dropdown is not an authoritative backend identity.
`capture-verification.json` checks static served files and actual module
identities; dynamic/bundled responses and optional 404s remain explicitly
separate rather than claimed as verified single files.

I personally inspected matching original software/WebGL phases 5, 20, and 35:
two gray beams on black, a bright overlap stripe, and a dense white lower-right
fan. Their phase alignment and last-present ordinals are retained in
`scene-review.json`. Small visible edge/position differences are not established
as defects: context/start clocks differ by 16 ms. The earlier retained phase
pairs were also inspected and remain attributed to their older module in the
texture note. They are not substitutes for the new captures.

Each new route records 36 presents over stepped 180 seconds. The first capture
checkpoint already contains three presents; it is not a screenshot of present
one. These observations establish changing beam scenes, not normal playback,
complete intro coverage or pixel equality. Backend agreement does not establish
Windows-reference correctness. No verified Windows capture is available.

No implementation changed, so no causal repair or repair regression is claimed.
Further work needs a verified Windows reference and a timing investigation,
while preserving the established pre-context behavior unless new causal
evidence contradicts it.

`final-cleanup.json` checks own absent processes/profiles, closed server ports,
released holder/watcher, four free locks and disk above 2 GB. No box
ID/state/expiry applies. `result.json` is published last as an investigation
record; PTCT has no matching candidate-corpus entry and this is not a candidate
rendering pass.
