# Forsaken first-white tracing attempt, 2026-11-12

The combat-white cause remains unproved. This attempt stopped at a concrete
caller blocker before combat: command 0 delivered one native Enter and completed
its bound capture, then exceeded the immutable 20-second work deadline while
awaiting the new post-capture diagnostic drain. No later gameplay/input was sent.
There is no runtime fix or changed-path before/after claim.

The predecessor's [two-owner combat evidence](forsaken-owner-enemy-20261112.md)
was read before allocation, including retained state/API records, the natural
render audit and full after-secondary/first-white captures. Its postwhite
ONE/ONE draws, depth-only clears and sampled white uploads remain evidence of
the saturated path, not of the first producer transition or a native crash.

Evidence: `scratch/runs/20261112-forsaken-first-white-1540/` (ignored).
`runtime-pins.json` records staged main
`0284c9d79c20872b21fa8dac60443a9ad7353b46`, `relevant-source.patch` and
`untracked-runtime.patch`. `owned-inputs.patch` records the staged helpers;
`final-owned-helpers.patch` preserves the final local recovery/analysis helpers.
Source/media trees were not archived. The original executable and existing
873 media pins were referenced and checked without copying media into the run.
The recovered actual module is 2,189,863 bytes, SHA-256
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.

## Diagnostic path and observed state

The existing `lib/d3dim-draw-trace.js` producer observer was used on the actual
legacy WebGL adapter. It records natural clears/uploads/readbacks and selected
covering draws, with bounded retention and explicit drops. Its GPU sample reads
can synchronize rendering; these observations are not performance evidence.
It does not add guest state setters, input, draw flushes or guest API calls.

A run-local `cpu-observer.js` wraps existing `log`, `log_i32`, `log_api_exit`,
`dx_trace` and `gpu_gl_call` imports before ordinary guest instantiation. Original
imports run once with their original returns/errors. Selected public D3D calls
retain entry arguments and return registers; existing kind-29 hooks identify
changed states in `$d3dim_set_render_state`, including execute-buffer states.
The observer uses pure register getters and direct-window stack reads, retains
at most 4,096 events between drains and reports overflow. CPU and GPU orders are
separate; natural command boundaries are retained, not a global ordering oracle.
No production source was changed.

Before original launch, a real x86 Device2/3 public-COM pixel fixture against the
built module emitted 1,701 observer rows with no drops/error, including public
arguments/returns and kind-29 changes. The fixture used the async instantiation
entry point observed by the helper, instead of its usual `new Instance`; its
COM calls and pixel assertions were unchanged. This is diagnostic fixture
validation, not original-game validation. Exact helper import/input closure
passed locally and remotely for all 1,547 staged files before launch.

Five compressed original drains were recovered (`diagnostic-summary.json`):
one startup drain and four subsequent drains. Startup retained the earliest
4,096 of 16,879 CPU events and explicitly dropped 12,783; therefore it cannot
prove an uninterrupted startup transition. All four later drains have zero CPU
or GPU drops and no reported CPU observation error. The secondary guest Worker
has no selected events in these drains.

In the last successful menu drain, the owning guest emitted 200 public
`IDirect3DDevice_Execute` entries and twelve each of BeginScene, EndScene,
Viewport_Clear and Surface_Flip. Changed-state hooks show eleven changes each
to blend-enable 1 then 0, destination blend 2 then 1, and depth-write 0 then 1.
The owning GPU drain records twelve accepted flags-3 clears and 22 selected
covering draw records with blending false, source 2, destination 1. The backend
maps these factors to ONE/ZERO. Thus this original menu path demonstrably
restores opaque state through execute buffers; additive state is not permanently
stuck from initial launch. This does not identify what happens during combat.
No combat, incoming-damage flash, respawn or first-white transition was reached.

Actual guest Worker `533B67761F4045B2B42C20CAA100C04E` and RenderWorker
`DBBAD01140C8329E623CC286E79A0DA0`, endpoint 1, were bound to their recovered
module and observed WebGL context. Requested GPU flags were not treated as
actual-owner proof. This attempt did not launch software; the predecessor's
GPU-off/no-active-port inline software evidence remains separate.

## First concrete blocker

The command was published with workEnd `2026-11-12T15:44:42.222Z` and a separate
ACK deadline. The runtime was draining a periodic diagnostic before consuming
it; admission began at 15:44:27.707Z. Native Enter down/up were acknowledged at
15:44:30.491Z / 15:44:30.517Z, with timer-driven release armed before down.
The subsequent full 1024 × 712 PNG and its before/after owner/module binding
completed at 15:44:38.952Z. The browser then awaited `drainDiagnostics('menu')`;
that file was never published. The work deadline fired at 15:44:42.228Z.
`await-trace.jsonl`, `protocol-timing.jsonl`, the completed capture and the
absence of the final diagnostic file locate the pending phase; they do not
attribute the entire delay to one CPU/GPU operation.

The resulting command refusal is a harness deadline, not evidence of a native
Forsaken fault. Caller outcome is known exit 1; both actual Enter edges are
trusted in the retained menu-state record. Later admission is sticky-closed and
no command was replayed. The run-local review text incorrectly calls the startup
image a splash: the immutable PNG actually shows Single Player selected, and
the next PNG shows its START menu. This labeling error is retained explicitly;
no splash behavior or combat progress is inferred from it.

Next: remove diagnostic drains from the command ACK critical path and bound
telemetry independently without weakening identity, hash, full-frame, freshness,
release or no-replay checks. Exercise that exact combined trace/input/capture
path before another original launch. Then retain the producer transition around
the first combat-white frame. Do not patch blending/clears/textures from this
menu trace or repeat unchanged enemy-frag attempts.

## Verification and shutdown

Locked `tools/build.sh`, the production bounded renderer trace tests, inline
software owner/rejection guards, three timer-release tests, thirteen API custody
tests, the run-local observer controls and actual emitted-path fixture passed.
`verify.py` checks 51 output paths retrieved twice and rehashed, two full PNGs,
before/after identity continuity, actual module SHA, the balanced native pulse,
trusted edges and terminal records. Compressed drains remain exact bytes.
No guest AI/config/health/clock/position writes, forced gameplay calls,
substituted media, workers, public deployment, full-27/parity/audio/FPS or broad
crash-free claim was made.

Chrome exited 0 with actual parent wait and separate stdout/stderr EOF. Its
browser harness parent and outer API command exited 1, with the deadline failure
retained; the browser parent has separate EOF evidence. All unique outputs were
retrieved and hash-verified before delegated normal sandbox stop.

Private box `bx_z7nsayjm` had an independently observed watchdog prearmed before
allocation, initial expiry `2026-11-12T17:40:31.443Z`. Normal stop completed
`2026-11-12T15:46:44.929Z`, receipt `stop_8e93d36395320d01`, forced=false,
error=null. Final state archived, expiry null. Lifecycle client/owner and
watchdog actual waits are 0 with EOF receipts. Do not resume/delete this box.
