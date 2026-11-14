# Original TIM startup: premature Sound Blaster probe IRQ

Run: `scratch/runs/20261114-tim-black-startup/result.json` (local, ignored).
Initial Git: `6741a8249fc7bb1b099e4db11e1a99b37d9aaf30`, plus recorded incoming
ToyVM WIP. The run records incoming/final patches and source hashes; no source
archive or WASM dump was retained.

The genuine packed installed executable now reaches its animated title, and
one ordinary Enter from a freshly reviewed title reaches the original manual
verification screen. This is startup progress, not a puzzle/gameplay capture.
No manual answers were supplied. The visible manual gate is the bounded
residual. Captures also show a lower-screen vertical wrap/duplicate; rendering
was not changed in this task.

## Proven first divergence

The short Sound Blaster DMA path previously forced IRQ7 as soon as its last DSP
command byte was written. The original program starts a one-sample probe and
initializes its completion flag after returning from that command routine.
Immediate delivery therefore raced that initialization:

| Observation | Pre-repair original | Repaired original |
| --- | --- | --- |
| First probe IRQ7 | dispatch 4,141,690, interrupted `419b:0853` | dispatch 4,143,254, interrupted `419b:085c` |
| Probe completion flag `CS:[45]` | 0 → 7 → 0 (last at dispatch 4,145,812) | 0 → 7; no lost completion |
| Timer vector 08 | cleanup overwrites IVT bytes 20–23 with zero at about 4,476,771 | not zeroed by failed detection cleanup |
| Next timer | dispatch 4,500,001 enters `0000:0000` | normal startup/title |

The premature interrupt lets the ISR set the flag before the interrupted code
clears it. Failed detection then restores an uninitialized timer vector. The
later wild stack/return to `DF66` is a consequence, not the initial failure.
An uncached original run reproduces the fault, excluding stale decoded unpacked
code as its cause. `causal-red-*`, `restore-*`, and `nocache-*` retain bounded
IRQ, flag, IVT, instruction-byte and stack observations. No guest code, registers,
or memory were patched to produce either path.

## Repair and validation

`tools/toyvm/dos.js` schedules a short DMA completion from its actual command or
DMA-unmask instant and sample rate. Masking and pause exclude stopped time;
reset/replacement cancels the old probe. Completion consumes the sample once
and arms one width-correct IRQ. `dos-loop.js` includes that deadline in normal
and unscheduled slice boundaries. `audio.js` prevents a coarse audio interval
from consuming a probe retroactively before its command. Explicit DSP F2/F3
interrupt commands remain immediate; long streaming DMA keeps its sample path.

The new `test/toyvm-sb-probe-latency.test.js` checks exact deadlines, 8/16-bit
masking, pause/remask/reset/replacement, coarse audio, single delivery, explicit
IRQ and long-transfer controls. A generated real COM uses the canonical CPU,
loader, ports, interrupt handler and IRET to reproduce the original far-return
and flag-clear race. It exits successfully with cached, uncached and
`irqSchedule:false` execution. Reconstructed incoming sources fail that guest
with exit 1; the explicit IRQ/long-transfer negative control still passes.
Existing audio and single-cycle assertions were updated to expect sample latency.

Final relevant tests: **83/83 pass**, covering the probe, single-cycle/high-speed
DMA and incoming DOS flags, FCB, floppy, CD, MZ-loader, palette and controlled
input behavior. The standalone audio suite passes. `flock /tmp/wine-build.lock
bash tools/build.sh` passes under the heavy-runtime lock, using regenerated
canonical browser bundles. Each heavy command has an independent finite
deadline, actual child wait and both output EOF receipts.

A broader exploratory test batch is explicitly not a pass: the default-IVT
test expects `F000:0109` but the incoming initializer returns `F000:0300`;
the identical failure reproduces with pre-repair sources. The PM-timer child
exceeded its 90-second deadline and was killed/reaped with both EOF. Neither
unrelated behavior was changed.

## Actual original runtime and input boundary

All original reruns use canonical `runDos`, current directory `sierra/tim`, the
packed original, readonly genuine file root and a fresh writable `Map` overlay.
All 13 exported files match the installer export before and after; overlays
remain empty. TIM.EXE is 111951 bytes, SHA-256
`34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c`.
RESOURCE.CFG remains genuine bytes `020200`, SHA-256
`138793139d414148c3ea406f4b273bdfb394d17fab3636115815abdf639d433d`.
The original floppy SHA-256 remains
`d0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657`.

The final no-input run completes its 100,000,002-dispatch budget at the title,
without timeout, bad selector, unimplemented instruction or stuck marker. An
earlier 500-million-dispatch run also stays in animated title behavior. CPU
module SHA-256 remains
`239f6584b458eb0b9c5f2916bd63b29681d2a446d1b821ea45a1cace6b823060`.

The one-Enter run finishes 300,000,003 dispatches in 14.709 seconds of runtime
at the manual-verification screen with no timeout or CPU fault. Retained and
visually reviewed key images are `final-original-screen.png`,
`single-key/review-01.png` (fresh input target), and
`single-key/terminal-screen.png` (manual gate). Input used the existing
controlled-action DOWN/UP lifecycle, never a black-screen key injection.

An earlier reviewed Space action left the title visible. Its subsequent review
expired while diagnostics were inspected; the controller rejected further
action and exited 1. A late stop file was not accepted. This failed review is
retained as such, with its closed supervisor receipt, not counted as successful
input evidence. The later one-Enter run has a successful controller receipt.

## Publication and cleanup

The repair and tests remain **uncommitted WIP** in the shared main checkout.
`dos.js` and `dos-loop.js` already contain other owners' DOS/FCB/CD/loader work;
the generated bundles contain those changes too. A required explicit-path
commit would also publish those foreign hunks. No partial repair commit or
foreign whole-file publication was made. This note is published separately.
Next work is coherent publication of the preserved combined ToyVM changes,
then an explicitly authorized fresh manual-input task if gameplay is required.

No box was created (ID/expiry null, state `NOT_CREATED`, stop receipt N/A).
Run receipts record actual child exits, deadline kills where applicable,
both EOF, empty owned-child lists and final PID checks. The board watcher is
absent. Only the three result-named key PNGs remain; duplicate images were
pruned with hashes. Genuine media/user state and unrelated WIP are preserved.
