# UT 348 DirectInput motion contract

The generic absolute mouse implementation counted physical motion twice when
an application read both immediate state and buffered data. `GetDeviceState`
consumes the physical state accumulator; `GetDeviceData` consumes an independent
FIFO containing the same motion. Both previously added that motion to
`di_mouse_abs_x/y`. Draining the FIFO therefore moved the next immediate state
even with no new input. Conversely, reading state changed subsequent buffered
absolute positions, including PEEK results.

Microsoft documents immediate state and buffered history as distinct feeds
that applications can use together:
[Buffered and Immediate Data](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee416236(v=vs.85)),
[Buffered Mouse Data](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee416239(v=vs.85)).
The repair uses separate buffered absolute accumulators, retaining the existing
FIFO, partial reads, PEEK sequences, relative input and keyboard handling.

Retained WinDrv analysis from `20261121-ut-ui-mouse-path` identifies the relevant
sequence in the genuine demo's `WinDrv.dll` (SHA-256
`fa58c4ae8d98095725a265f573f408bf77ab83755e601cf7e56bf8066e68e7f1`):
setup at `0x1110c5b0` selects absolute axes and a 100-record buffer;
`UpdateInput` at `0x11109320` calls `GetDeviceState(16)` at `0x11109677`,
subtracts the previous absolute position, forwards axes, then calls
`GetDeviceData` at `0x111097b2`. The acquired device selects this path;
the captured USER mouse path is separate. These are binary code locations,
not evidence that the original game currently executes this branch.

Evidence: `scratch/runs/20261121-ut-directinput-motion-cause/`.
An authored PE reuses the actual seven-object format and setup sequence and
executes real COM calls in the production CPUWorker. The old module failed
15 of 54 contract checks; the repaired module passed all 54. Checks include
three signed motions, idle stability, both read orders, state-only and
buffer-only controls, and repeated PEEK before and after state reads. The
tracked device test additionally covers distinct feed baselines, partial
drain and sequence preservation. Buffered keyboard direct/RPC and native
mouse receipt main/Worker tests pass. Historical fixture-pin refusals and a
native-owner VM setup failure are retained separately and excluded from passes.

The actual UT active input branch, software cursor position and UWindow hit
target at Practice Start remain unobserved. No original game was launched in
this repair task. This establishes and repairs a generic DirectInput defect;
it does not establish the cause or resolution of the game's Start failure.
