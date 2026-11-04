# Measured original Deus Ex readiness; bounded Draw entry remains unobserved

The original EXE reached its native main-loop flag and a visible window had
received DirectDraw source writes before the real owning collector was armed.
The collector then exhausted its **50,000-block budget**, recording no natural
Draw entry. This is an incomplete bounded observation, not game failure.
No Lock, Unlock, renderer tail, epilogue or saved-caller return was observed.
`engineRender` and `viewportPlayer` remain null; lifetime and host-surface
binding remain unknown. There was one browser, no reload and no retry.

This continues published `197c66c2d5233336ed159c5d2cb053a6ecd2bf11` and owning
observer `95d489747cec3ce841170681e5db9819019b1d78`. Preparation checkout:
`4d9264bca620973cb2cc9f460b0b69441f5654d9`. Run:
`scratch/runs/20261104-deusex-measured-readiness-draw/`.

## Read-only predicate derived from original bytes

The exact predecessor `driver.cjs`, `session.cjs`, corrected classifier,
selector, server, staging and recovery scripts were inspected first. The
predecessor's first-running/LIVE-Engine gate was replaced in a small run-only
driver; production Worker, observer and WASM were preserved byte-for-byte.

The original EXE is read in place at
`test/binaries/candidates/deus-ex-demo/installed/system/deusex.exe`, SHA-256
`2ed115d9dc93582273830d9ae38f92ab4379842459e24eaec11390f312d5af5f`.
Its actual PE import table names `?GIsRunning@@3HA` at IAT RVA `0x57c04`.
At preferred VA `0x10914702`, MainLoop reads that IAT pointer; at
`0x10914708` it writes 1 through it. The loop checks the flag at
`0x109147b9`, calls the engine argument's virtual slot `+0x54` at
`0x10914877`, and clears the flag at `0x10914cc6` on loop exit.
The launch caller passes its engine local to MainLoop at `0x109097ec`–
`0x109097f8`. These instructions establish a native launch boundary, not a
promise that the next 50,000 blocks include Draw.

`readiness.cjs` reads the actual owning exports' image base, original header
and relocated instruction signature, then the IAT pointer and its dword.
It performs no guest execution or writes. The gate requires all of:

- Actual slot 0/thread 1, LIVE original Engine and host `running`.
- The imported main-loop flag equals exactly 1.
- A visible, non-child, positive-size host window has a nonzero existing
  DirectDraw write sequence or canonical source serial.

The host fields are read directly; no repaint, capture endpoint or scheduler
pulse is used to satisfy readiness. The host source counter establishes
source activity only. It cannot identify an Unreal viewport/player, prove
Draw completion, or establish nonblack pixels. The samples are separate
Worker/page event boundaries, not an atomic guest/render observation.

The early sample before LIVE Engine had an unsettled import pointer and is
retained as raw evidence, not a valid native flag observation. The complete
gate rejected it. The subsequent 25 samples read zero from the same resolved
pointer `0x10daf434`; the final sample read 1. No arbitrary delay or elapsed
time threshold substitutes for that transition. The 250 ms polling interval
only schedules passive samples and does not drive guest execution.

## Offline validation before the single browser

All **334 inherited SHA/size pins** were verified, and actual process
inspection found no Chrome or Node driver before staging. Only three small
new helper/fixture files were staged once, yielding 337 pins; unchanged
helpers, native support-path recipe and Puppeteer-core **25.7.0** were reused.
No media, source tree or module archive was copied.

The readiness fixtures verify both original binary hashes, the actual PE
import name/IAT slot, MainLoop store and virtual-call bytes, positive/negative
flag/window/owner gates, unresolved import and changed signature rejection,
and placement of the changed driver's gate before its real WorkerLink start.
The actual retained classifier/selector and pinned HTTP/transport tests pass,
including ordinary 404 negatives and immediate launch-error positives.
The actual retained WASM tests pass for both local exports and the owning
Worker: native instruction fixtures exercise collector routes, relocation,
incomplete observation and module reuse. Fixture success is mechanism testing,
not original-game success. No production code changed; a new production
build was neither necessary nor substituted for the retained served binary.

The retained WASM remains 2,143,712 bytes, SHA-256
`1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`.
The actual original Engine response remains 1,736,704 bytes, SHA-256
`3606d3177b4473d1a56405c3e0b372e44dfde475705460be8d68846f6d16a8d0`.

## Actual natural observations and budget

Chrome/151.0.7922.71 ran **06:42:25.862Z–06:42:37.798Z** on 2026-11-04,
within its 15-minute limit and before 07:00Z. The actual candidate selector,
pre-Launch registry and measured `_exeUrl` all selected the original EXE.
The original support-path recipe was reused without save/configuration,
geometry or gameplay changes. The session used ordinary host scheduling.

At **06:42:36.776Z**, the native flag was 1. At **06:42:36.778Z**, visible
HWND `0x10003` measured 648×488 with `dxWriteSeq=82` and canonical version
12. The real WorkerLink acknowledged start at **06:42:36.783Z**, with
`maxBlocks=50000`, `maxMs=1000`, slot 0 and endpoint identity 1.

Before/after actual Worker inspection retained the same exports object
identity check, 2,262 exported names and 536,870,912-byte memory. Original
Engine stayed LIVE at module index 2, load address `0x10f82000`, generation 1,
size 2,859,008; relocated Draw entry is `0x110109e0`. Module generation is
not a UObject allocation generation. File SHA and loaded prologue/version
guards are separate observations, not a full relocated-memory hash.

The terminal reply at **06:42:37.219Z** was `expired-incomplete`, empty
`events`, `observedReturnPair:false`. The actual collector's retained fields,
read passively at **06:42:37.239Z**, were:

| Field | Observed value |
| --- | --- |
| Remaining blocks | 0 |
| Monotonic deadline | 9714.554999999935 ms |
| Later sample monotonic time | 9170.34999999986 ms |
| Time remaining at that later sample | approximately 544.205 ms |
| Elapsed since construction at later sample | approximately 455.795 ms |
| Later event-boundary EIP | `0x11499fa7` |
| Exact terminal PC | unknown; not recorded by pinned collector |

The elapsed value follows from the actual deadline minus the tested 1,000 ms
option. It is a later sample, not exact terminal timing. The pinned observer
never decrements `left` after it has a result, so zero remaining blocks plus
time remaining establishes block exhaustion. No production instrumentation
was changed to manufacture a terminal PC. The later EIP must not be assigned
to the terminal event or to a guessed native function/module.

The **first missing native boundary remains natural Draw entry within the
bounded collection interval**. Reaching MainLoop and host source activity
improves the startup gate but does not guarantee coverage of a later Draw.
The evidence cannot distinguish a longer native route, a boundary missed by
the observation mechanism, or a future render opportunity. It supplies no
negative proof that Draw never runs.

## Capture, recovery and handoff

I personally inspected `recovered/fresh-host.png` (93,626 bytes, SHA-256
`16d7d5f6612a4ab3c79848140020518fa6a45f769e9d48dddd8dc421de86f1e5`).
It shows the emulator UI, selected Deus Ex Demo and a black game area beside
launch logs. This is a fresh Chromium screenshot, not immutable engine-source
provenance or a gameplay acceptance. A later attempt to attach read-only to
the existing browser found its endpoint already closed (`ECONNREFUSED`);
normal driver cleanup had completed earlier. No second browser was opened,
no attachment retry occurred, and no runtime failure is inferred from it.

Twenty-six closed files totaling **3,219,981 bytes** were recovered and
SHA/size verified before 06:44Z, including the fresh capture, logs and two small
helper/fixture files. All 337 remote pins were reverified after closure, with
no Chrome or Node driver remaining. The offline analyzer verifies every
recovered file, inherited pins, original selection and Engine response,
readiness transition before collector start, module/export observations,
zero block budget, null claims and cleanup. Exact Git SHA, relevant tracked
binary diff and owned new-file patches provide recovery; Git is the source
archive. No source/media/module archives were created.

**bx_9ffuymfg remains RUNNING** (API `idle`, healthy/hydrated), expiry
**2026-11-04T07:19:23.841Z**. Coordinator retains shutdown ownership. No box
lifecycle, allocation, resume, subworker, successor, forced Draw/repaint,
guest writes/calls, breakpoint retargeting, gameplay pulses, historical
Worker, local heavy runtime, Heroes II or public deployment occurred.

Next work, if separately assigned, is to test original-code boundary
coverage and choose an evidence-based collection opportunity/budget; exact
terminal PC requires a tested collector change and new served pins. Lifetime,
viewport-to-host binding and actual Draw return remain unestablished. This
single-task worker stops after publishing the measured result.
