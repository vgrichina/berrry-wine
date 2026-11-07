# Hexen II repaired-ACK post-notice pair, 7 November 2026

The cooperative arm reaches a personally reviewed, composited first-person
world through ordinary menu input. The real-thread arm passes the notice and
creates native GL, then fails at MIDI stream open because the host rejects its
local main VM when an auxiliary Worker backend exists. That demonstrated guard
error is repaired and covered by a fail-before/pass-after regression. The
original threaded guest was not rerun after repair: this is **not paired world,
parity, gameplay, FPS or audio-quality qualification**.

Evidence: `scratch/runs/20261107-graphics-repaired-pair/`. Predecessor:
[post-notice ACK repair](graphics-post-notice-20261107.md). Only runtime
observations and emulator sources were examined, respecting the guest licence.
No private handler, guest memory/settings/media edit, clock override, forced
capture/fallback, UNKNOWN replay or repeat of the accepted no-input matrix was
used. There was one fresh box and one heavy guest at a time; no nested worker.

## Preflight and provenance

Original runtime source: `47b88f4a64c741d2237c2dbcbd62becc058e0b51`, containing
stdin ACK repair `10bf01e42`. `source-commit.txt`, the relevant binary Git diff,
untracked `lib/wininit-boot.js` patch, runtime pins and run-input patches preserve
recovery through Git without source archives. Media is referenced by existing
path and SHA-256; all 16 registered closure paths match the predecessor pins.
Root `glh2.exe` remains
`76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`.
The registered root layout avoids the bundled MiniGL.

The local dependency audit covers 464 runtime files, no missing imports;
Browserify virtual imports and the disasm usage-comment literal are excluded
explicitly. Both actual local Notepad controls pass the exact production
closed-window arguments: `--trace-from=1000000000 --trace-to=15000`, batch
50,000, 240-second cap, quiet/input/API/scheduler flags, `--headless-gl`, stdin
control and each scheduler flag. Ping, error, snapshot, composited PNG and
ordinary Enter-down/up replies survive the closed window. Independent UP is
armed before DOWN. An earlier preliminary local control omitted headless GL;
the separate `local-control-exact-*` runs correct that gap before allocation.
Notepad never opens GL, so this is transport evidence, not native GL proof.

On the fresh box, the actual native 8x8 context clears and reads red
`[255,0,0,255]`, GL error zero, zero live contexts after destruction. Headless-GL
and WGL drawable/MakeCurrent/readback regressions pass without skips. Provider:
Mesa llvmpipe LLVM 20.1.2, WebGL 1.0, GLSL 4.50, Node v24.22.1,
`@node-3d/glfw` 7.4.1 / `@node-3d/webgl` 6.0.3. Mesa software rasterization is
native GL here, distinct from the emulator fallback renderer.

All 470 staged runtime/input pins and 162 native dependency pins match before
and after the originals. All 300 observed runtime/native reads match. Each
original loads the same 2,182,493-byte module, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
Individual launch arguments, raw logs, commands, scheduler/MIDI/context records,
PNGs and empty PCM files are retained. The repair has separate source/test pins
and `repair-source.patch`; it was not installed into the original box.

## Observed pair

| Observation | Cooperative | Real threads requested |
|---|---|---|
| Exact ordinary notice Enter ACKs | `coop-4/5`, batches 188401/188560 | `threads-4/5`, batches 316765/316933 |
| Actual scheduler backend | cooperative | worker |
| Proven auxiliary-thread execution | none observed | none observed before failure |
| Native GL | 640x480, WGL CreateContext/MakeCurrent = 1 | 640x480, WGL CreateContext/MakeCurrent = 1 |
| MIDI | open 786433; MOM_OPEN callback admitted and later inactive | open throws before allocating device |
| Deepest composited review | first-person courtyard/world | opening notice; no post-notice PNG before failure |
| PCM | 0 bytes | 0 bytes |

Both native contexts report the provider above. No fallback or GL creation
exception is observed. The scheduler observer's `requested` field is false in
both arms because the CLI does not populate that manager option; the actual
launch flags and selected backend establish the requested/selected modes.
The main guest remains in the Node process under CLI `--threads`, unlike the
browser's slot-0 Worker. Scheduler snapshots have no auxiliary threads, and no
auxiliary execution is qualified. Selecting a backend is not concurrency proof.

Cooperative input advances reviewed MAIN / Single Player, NEW GAME, Paladin
class and Apprentice difficulty screens with one ordinary Enter pulse per
review. Every pulse has independent UP and exact ACKs (five balanced pairs).
The meshing-models loading screen is reviewed, followed by bounded passive
loading. At 15:59:36 UTC, `retrieved/actual/coop/terminal.png` is a 640x480
composited first-person stone courtyard with ramp, two fists and HUD 75/0.
Large black model/scene regions and incomplete HUD glyphs are visible; visual
correctness is not established. No movement or combat input was attempted.

All nine PNGs decode and were personally inspected. Eight are composited
screens. The exit chooser's 512x256 `coop/final-raw.png` is an offscreen hand/HUD
texture atlas, explicitly **not** world evidence. Ordinary `png:PATH` control
commands provide the reviewed screen images without a forced-capture flag.
The raw final image remains separately preserved rather than relabeled.

Cooperative MIDI opens at 15:57:12.023 UTC with CALLBACK_FUNCTION type 3,
callback `0x441f70`. The pump dequeues MOM_OPEN (967), queue 1→0, callback-active
0→1 and EIP equal to the registered callback; the next observation finds it
inactive at another EIP. This supports callback admission/execution and return
to inactive state, without per-invocation return-token proof in the original.
Only stream-open is observed; terminal stream is not running, with no pending
headers/callbacks. There is no stream-out/restart/playback or audible-output
proof. Empty PCM is not audio quality evidence.

The threaded arm receives both dismissal ACKs, creates native GL at
16:00:04.387 UTC, then throws at `midi_stream_open` at **16:00:06.295 UTC**:
`MIDI callback requires cooperative owning VM; worker delivery unsupported`.
The passive audio observer preserves the thrown import and stack path; bounded
diagnostic filtering hides the usual terminal error text from the guest log.
Thus the generic log scan's empty `errors` list does not mean absence of a
failure. The child exits 1. The subsequent snapshot rejects on child exit;
no failed input is replayed, no menu input is sent to this arm, and no
post-notice screenshot is invented. Cooperative exit 0 is merely normal quit.

## Demonstrated cause and tested repair

`lib/host-audio.js` rejected every cooperative MIDI route whenever
`ctx.threadManager.workerBackend` existed. CLI `--threads` keeps the main VM
local and uses that backend only for auxiliary VMs, so a valid main callback
was rejected before device creation. The browser owning-Worker transport repair
was present; this is a separate mixed-scheduler admission error.

The guard now accepts the local route under a Worker backend only when the
captured exports are **exactly** `threadManager.mainInstance.exports`. Unknown,
foreign and Worker proxy owners still reject before allocating a device; an
owning Worker still uses the existing fenced transport. Queue, callback-frame,
return, reentrancy and cancellation behavior are unchanged. The mandatory
callback producer census records this lifetime review and updated source hash.

The extended `test/test-midi-stream-lifecycle.js` fails against the old guard
with that same error, then passes after repair. It executes production WAT
handlers/imports and callback admission/return, checking local-main
OPEN/DONE/CLOSE function callbacks and window notifications with an auxiliary
backend, plus missing/foreign-owner rejection without allocation or queued
callbacks. The fixture's first draft used the raw WAT exports instead of its
host exports wrapper; that mismatch and failed attempt are retained, followed
by corrected-owner fail-before and pass-after controls. This is isolated
production execution, not a fresh full-game or native-audio claim.

Actual Worker callback lifecycle regressions pass for slots 0 and 3, including
broker/open/done/close/x86 return, pause/restart/stop/reset, lost ACK and stale
root/endpoint/process/document ownership. Long-message and host-owned stream
stop regressions pass. Callback census and its reconciliation regression pass.
The first locked build correctly required the changed producer review; after
that review, `flock /tmp/wine-build.lock bash tools/build.sh` passes. The standard
module hash remains unchanged. The exact remaining runtime validation is a
separately authorized fresh threaded post-notice followthrough with this fix;
original threaded menu/world, auxiliary concurrency and MIDI playback remain
unproved. Black scene regions need separate traced rendering investigation.

## Custody and lifecycle

All 84 remote artifact references / 80 unique hashes are retrieved and
size/SHA-verified before stop, including both WASMs and native binaries. Local
review copies are separately hash-verified. Early cleanup/inventory assertions
used a stale `actual3` path; those failures are preserved, and corrected-path
checks pass without rerunning a guest or input. Runtime/native postflight
mismatches and unmatched loaded reads are zero. Evidence references are checked
for this run; unrelated global evidence errors are retained separately.

An independent 25-minute normal-stop watchdog was armed before allocation at
15:56:04.227 UTC. One persisted separate UUID Idempotency-Key creates only
`bx_xtyxkm7m`, original expiry **16:21:04.408 UTC**. After retrieval and empty
owned-process checks, explicitly delegated normal stop
`stop_7c3a7af669589c18` completes **16:02:05.549 UTC**, `forced:false`, error null.
Final state is **archived**, stoppedAt 16:02:05.529 UTC, current archiveAfter
null (archive retention unknown). No resume/delete or running box is handed back.

Owned guest/supervisor processes are absent. No browser, profile, control port
or remote watcher was created. Local lifecycle/board watchers are closed, and
local PID checks are retained. Shared `/home` remained above 2 GB at sampled
checks. No peer files were removed. Only the audio guard, focused test, mandatory
producer census review and this note are committed; raw evidence stays ignored.
