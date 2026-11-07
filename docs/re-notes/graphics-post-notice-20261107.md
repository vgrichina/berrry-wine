# Hexen II post-notice startup and stdin ACK repair, 7 November 2026

The registered `hexen2_demo` passed its opening notice through ordinary Enter
under cooperative scheduling, created a genuine native headless GL context,
and opened MIDI with an observed function callback admission and subsequent
return to inactive state. The paired run stopped on an UNKNOWN control reply;
the real-thread arm was **not launched**. No reviewed menu or rendered world,
auxiliary-thread execution, MIDI playback, gameplay, FPS or audio quality is
qualified. This is an incomplete comparison, not a passing startup matrix.

Evidence: `scratch/runs/20261107-graphics-post-notice/`. Predecessor:
[notice-only sweep](graphics-expanded-crash-20261107.md). The title's licence
was respected: only runtime observations and emulator sources were examined;
there was no guest disassembly, memory write, private input handler, forced
fallback, guest setting/media/registry edit, clock override or nested worker.

## Observed run and first failure

The original runtime source SHA was
`94e52586d209dff22e1c3486fe3b45bf77be2b7f`, with the previously published owning
Worker MIDI repair present. Its relevant tracked source diff was empty; the
existing untracked `lib/wininit-boot.js` is preserved as a new-file patch.
`runtime-pins.json`, `source-commit.txt` and the source/input patches supply
recovery through Git, without any source or media archive.

Local preflight checked the actual registry/media closure (16 paths, no missing
or mismatched media) and literal relative CommonJS dependencies. Browserify
virtual imports and one usage-comment literal were explicitly excluded from
the filesystem audit. The production stdin client tests passed, including
framing, exact IDs, errors, child exit and real Notepad input/capture. This
preflight missed the interaction between trace windows and protocol output;
the new regression below covers that demonstrated gap.

All 470 staged runtime/input pins matched before the guest and after its exit.
All 148 observed runtime/native JS/JSON/WASM reads match their pins. The actual
module was 2,182,493 bytes, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
The manifest, root executable and media hashes are recorded by existing path,
without copying game media into local evidence. Root `glh2.exe` retains hash
`76d96731e3076441e5c70bce2089cd8f36f25b373214f656aa9d5cd8d532e9dd`;
the registered layout avoids the bundled MiniGL.

Native preflight used Node v24.22.1, `@node-3d/glfw` 7.4.1 and
`@node-3d/webgl` 6.0.3. A real context returned red RGBA `[255,0,0,255]`, GL
error zero and zero live contexts after destruction. The actual headless GL
and WGL drawable/MakeCurrent/readback regressions passed. The provider was
Mesa llvmpipe LLVM 20.1.2, WebGL 1.0, GLSL 4.50; 162 native dependency pins
matched postflight. Native GL here uses Mesa software rasterization, distinct
from the emulator's fallback renderer.

`pair.cjs` used the production `test/run.js --control-stdin` and shared
`test/control-session.js`. Exact arguments are in
`retrieved/actual3/coop/launch.json`: registered app, `--no-build`,
`--headless-gl`, `--no-threads`, batch size 50,000, 150-second wall cap,
normal CLI default clock, bounded API/input/scheduler traces through batch
15,000, individual PNG and PCM outputs. One guest ran at a time.

The 640×480 notice PNG was personally inspected: GLHexen2 accelerated-version
information with OK focused. Ping, snapshot and notice capture received exact
successful replies at batches 14,715–14,717. After review, Enter-down was
submitted at 15:48:05.648 UTC and the independently armed Enter-up at
15:48:05.798 UTC. These are ordinary production control actions, with no
guest command or private handler. Their ACKs were not observed. Release
submission is established; final consumed/released key state is unknown.

At 15:48:06.131 UTC the title created a native 640×480 context with the provider
above. WGL CreateContext and MakeCurrent both returned 1; no GL exception or
fallback was observed. At 15:48:08.500 MIDI stream open returned handle 786433,
CALLBACK_FUNCTION type 3, callback `0x441f70`. The passive pump observation
then records message 967 (`MOM_OPEN`), queue 1→0, callback-active 0→1 and EIP
equal to that registered callback. The next observation finds the callback
inactive at a different EIP. This supports open-callback execution/return;
there is no enabled per-invocation return-token trace, streaming-header
completion or playback proof. At exit the stream was not running, with zero
pending headers/callbacks. PCM is an individually retained empty file.

The scheduler observer records backend `cooperative`, requested false, and
zero auxiliary threads throughout. It provides no real-thread evidence.
The individual raw guest log has no escaped trap or unimplemented API.
No missing Win32/CPU semantic behavior was demonstrated.

At 15:48:12.655 the driver's unchanged 7-second reply deadline recorded UNKNOWN.
It requested normal quit, saved the failure and skipped the threaded arm.
No UNKNOWN input was replayed and no further original was launched. The final
PNG was inspected: it is a 512×256 raw Hexen II logo texture selected from DX
slot 3 by the harness, **not** a composited menu or world screenshot. The two
PNGs were decoded and inspected; a texture does not establish visible menu
progress. The planned post-notice control captures/snapshots are absent.

## Demonstrated harness cause and repair

`test/run.js` emitted stdin replies with `console.log`. Its bounded trace
window replaces `console.log` with a filter. Once this guest passed batch
15,000, successful and failed control replies were silently suppressed along
with diagnostics. The absence of ACK therefore does not demonstrate a slow
guest, emulator trap or unconsumed Enter. This corrects the initial timeout
interpretation; the preserved UNKNOWN result remains authoritative for input
custody.

The repair writes the existing `[ctl]` JSON protocol lines directly to stdout
for both success and error. Diagnostic filtering, dispatch, IDs, input guards,
deadline and scheduler behavior are unchanged. No API was stubbed or bypassed.

The extended `test/test-control-stdin-cli.js` runs actual production Notepad
with closed `--trace-from` and `--trace-to` windows. It checks successful ping,
synchronous-error replies, snapshots and ordinary Enter-down/up ACKs. Before
the repair the first ping receives no reply and the self-bounded guest exits
zero; the test fails with `exited before replying to window-1`. After repair
both window cases and existing stdin tests pass. Shared-client and HTTP
control regressions also pass. The mandatory
`flock /tmp/wine-build.lock bash tools/build.sh` passed; the standard module
hash remains unchanged. `repair-source.patch` records the tested repair
separately from the original runtime's source state.

The remaining prerequisite is a fresh bounded paired post-notice run using
this repaired stdin transport, preflighted with the exact closed-window
arguments, retaining exact ordinary dismissal ACKs and composited screen
captures. Native GL/MIDI open progress above is observed only in the aborted
cooperative arm. This task stops at the first control boundary as requested;
it does not repeat the accepted no-input startup matrix or infer parity.

## Evidence and lifecycle

All 46 artifact references / 45 unique hashes were retrieved and size/hash
verified before box stop, including the individual raw log, both PNGs, empty
PCM, both WASM modules and native binaries. Runtime/native postflight mismatches
and unmatched loaded reads are zero. Evidence schema/containment checks cover
this run; unrelated global failures remain separately recorded.

A separate local lifecycle watchdog was armed before allocation with delegated
normal-stop authority and a 25-minute cap. A persisted UUID Idempotency-Key
created the only fresh box, `bx_25tc5y5f`, at 15:46:26 UTC, original expiry
**16:11:26.724 UTC**. No box was resumed. After retrieval, normal stop
`stop_837e40aeaa68b3cd` completed at **15:49:38.286 UTC**, `forced:false`, error
null. The box is **archived**, stoppedAt 15:49:38.266 UTC, current archiveAfter
null. No running runtime/box ownership remains to hand back.

Remote cleanup found no owned live process. No browser, profile or control
port was created. Local lifecycle and messageboard watchers were closed and
their PIDs are absent. Shared `/home` samples stayed above 2 GB; no peer files
were removed. Only the harness repair, focused test and this note are published;
the run-specific helpers and evidence remain in the ignored run directory.
