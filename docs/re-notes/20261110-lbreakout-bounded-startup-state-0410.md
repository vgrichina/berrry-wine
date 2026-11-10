# LBreakout: retained startup state reaches finite theme grayscale

Evidence: `scratch/runs/20261110-lbreakout-bounded-startup-state-0410/`
(ignored). One fresh original startup ran from `6351efbdd` with module SHA-256
`4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`.
It failed the unchanged two-second completion deadline before any first image.
There was no game input, menu/gameplay acceptance, retry or second native run.

The retained near-deadline state identifies original pre-menu theme grayscale
work. It does not demonstrate a missed partial-update/menu return. No runtime
repair is supported by this run, and the startup gate remains unchanged.

## Native observation and its limits

Startup armed at `2026-11-10T04:13:48.079Z`; its deadline was
`04:13:50.079Z`. The last existing snapshot sampled at `04:13:50.075Z`,
four milliseconds before that deadline. The caller recorded its first failure
at `04:13:50.086Z`. The sample is **11 ms old at failure**; its PC must not be
reported as a synchronous failure-time PC.

That sample has PC `0x451ae0`, the original EXE's `_memcpy` import jump.
The stack's current return is `0x426c59`, immediately after the first
`memcpy` in `_stk_surface_gray`. EBP is `0x074ffb68`, ESP `0x074ffb2c`.
The retained EBP frame also contains return `0x418687`, immediately after
`_theme_load` calls `_stk_surface_gray` at `0x418682`.
Original hash-pinned instruction bytes and disassembly establish both calls.

The frame describes surface `0x01385eec`, region `(0,0,640,480)`, shift zero,
current column 240 and row 168. Row offset is `0x69000`; column byte offset
is 960. The current four-byte copy goes from `0x7e6093c4` into local
`0x074ffb54` (EBP−0x14). These values consistently imply pitch 2560 and
pixel base `0x7e5a0004`. Those are **inferences from original local arithmetic**;
the retained sample does not contain this grayscale surface's header or pixels.

There are 107,760 preceding pixels and 199,440 remaining pixels including
the current one in this bounded loop. This is a coordinate calculation from
one sample, not a measured native rate or proof of the eventual native return.
The target is distinct from the retained screen surface `0x00c14abc`, whose
actual header reports 640×480, pitch 2560, pixels `0x7eed0004`.
No `fillSurface`/`fillRect` is present: this sample is outside the original
SDL fill loop. There is no native remaining-fill counter to invent.

Menu pointer and dirty count are both zero. The only observer event is its
arm; neither the watched SDL full-update return `0x426026` nor subsequent
menu-manager return `0x410849` was recorded. Together with the original
theme caller, this supports unfinished pre-menu initialization at sample time.
The partial-update path's existence remains established by earlier original
controls, but this attempt supplies no evidence that accepting its other return
would repair startup. The intervening 11 ms and eventual startup remain unknown.
Earlier readiness page/identity slices are separate observations and are not
merged into this sample or relabeled as failure-time state.

## Offline change and validation

`classify_startup_failure` in `tools/lbreakout-case-inspection.py` decodes
only already-retained state. It checks the original EXE hash, PC, two caller
returns, bounded frame layout, copy arguments and coordinate consistency.
It reports sample age separately from the completion deadline and failure time,
and returns unknown for unsupported or inconsistent frames. It issues no live
protocol requests and changes no guest or observer behavior.

`tools/lbreakout-bounded-startup-state.test.cjs` checks the actual original
instruction anchors and runs original grayscale on an isolated original SDL
640×480 surface in compiled Wasm. Successive original read copies advance
from column zero to one, source advancing four bytes. Both per-pixel read and
write copies execute. The original function returns with its cdecl stack
restored; all 307,200 pixels match the original grayscale arithmetic.
This control validates finite code and frame interpretation, without claiming
native execution time or native completion. Eleven corrupted/missing-frame
controls reject unsupported classification. The native sample decodes to
column 240, row 168 with the correct 11 ms age.

Before allocation, the emitted attached-Worker handler, actual host init,
original Worker installation, actual installed instance, real Wasm, original
SDL fill timeout and complete original menu suffix caller controls passed.
The generated caller was composed exactly as
`startup_workflow_source(pause_workflow_source(...))`, with the established
first-image presentation template. Duplicate composition was refused. The
6351efbdd preload retained PC/registers/24 stack words/surface/menu/dirty state.
The accepted `4fc62b7d7` fixture evidence was hash-verified and reused, with
no native fixture repeat. Explicit level start, separate P pause/P resume and
Space controls, and the `080064edf` unobserved/combined-play refusals persist.

Focused startup observer/full-caller, menu, paddle, pause, level-start,
inspection, cached-failure/composition and installed-Worker tests passed,
along with locked builds. Preparation failures are retained: a startup test
correctly refused an already-composed input, another lacked its input helpers,
and the first grayscale test compared a read copy with its writeback. Corrected
offline controls pass; none caused a native retry. Shared CRT, CPU/JIT,
renderer/startup providers and other titles were read-only. No native guest
writes/artificial calls, clock/tier/budget/deadline changes, source archives,
evidence media copies, local Chromium or nested workers were used.

## Cancellation, evidence custody and stop

First browser failure at `04:13:50.086Z` invoked owning Chromium SIGTERM.
The independent remote monitor recorded cancellation at `04:13:50.102342Z`,
signalled Chromium 5889 and launcher 5880, and retained the actual launcher
parent's `wait()` result −15 plus separate stdout and stderr EOF records.
No subsequent game protocol, capture, input, quit or extension was issued.
The Chromium exit JSON was not finalized before launcher cancellation; no
separate Chromium-parent wait claim is made.

All 34 remote evidence references were recovered as 32 unique artifacts and
independently reread for SHA-256 and size. All 824 runtime pins were unchanged.
There were zero PNG and zero gzip artifacts; no image or gzip validation is
claimed. The verification checks CRC/decompression for any such artifacts
present. Runtime source identity is the recorded Git commit plus relevant
binary diffs, including untracked inputs; media is referenced by existing path
and SHA-256. Unique logs and the actual loaded module were retained.

Only one box was allocated: `bx_cm4px2vw`, UUID
`7109223d-46a3-4ef6-8922-2bce9c3df081`. Its immutable independent 25-minute
watchdog was observable before allocation. Initial API expiry was
`2026-11-10T04:38:08.768Z`; the original watchdog deadline was
`04:38:09.023143Z`. After artifact verification, the sole delegate requested
unforced stop. Receipt `stop_3dee994975a17bfe` completed at
`04:14:21.648Z`. Final API state is **archived**, expiry **null**. The independent
watchdog's actual parent wait returned zero with both stream EOFs, and its
deadline digest remained unchanged. No inherited or other box was touched.

Next useful work is a separately scoped cost investigation of original
pre-menu theme grayscale and its copy path. The current evidence supports
bounded initialization work near the deadline; it supplies neither a runtime
fix nor visible gameplay acceptance. This single-task worker stops after
publishing the offline decoder, regression control and report.
