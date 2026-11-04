# Deus Ex: feasible preparation region tested; invalid capture ends native attempt

**Z96 remains unreached.** Offline geometry accepts the predecessor's first
nonzero Left position and derives a broad supported Down interval from it.
The single live run loads original count14 once, then two balanced Left pulses
both measure zero displacement. The second post-pulse capture is blank teal.
That first visual failure ends gameplay immediately: no Down preparation,
145ms Up, Space, reload, correction, turn, save or export follows.

Evidence and run-only helpers:
`scratch/runs/20261104-deusex-feasible-region-native/`.
Inputs are the supported-native-route note published at
`5f12207f35f4aa9273d8287cdfd07284614007b8`, the supported-bearing plan and
their retained helpers. No production source or original guard changed.

## Measured-state geometry

`region.py` intersects the backward ray from actual `(x,y,yaw)` with Small0's
support circle. Original route projections remain constant along Down:

```text
m = cos(yaw*pi/32768) / -sin(yaw*pi/32768)
x + (y+1772)m >= 7047
x + (y+1808)m <= 7088
```

Let `d=(cos(theta),sin(theta))`, `a=(x,y)-Small0Center`, and let backward
displacement be `D>=0`. Support margin at least `M` requires
`|a-D*d|² <= (42.5-M)²`. Its roots are
`D=a·d ± sqrt((a·d)²+(42.5-M)²-|a|²)`.
This derives an interval from measured state, without converting milliseconds
to displacement. A preferred preparation margin12 narrows the selection; it
does not replace the original positive-support or pre-Space margin8 guards.

| Observed cumulative Left | Original bearing | Down preparation at margin12 |
| ---: | --- | --- |
| 0 | Pass | No interval; maximum inward margin is below12 |
| 6.273930 | Pass | Approximately12.0464–38.3899 units |
| 12.183294 | Fail: frontX7045.449<7047 | No Down displacement repairs the line |

The zero-Left ray does have positive-support and margin8 intervals. It is
excluded from the preferred region and from selecting a **nonzero** Left
position; it is not reported as failing the original bearing guard.

Using the predecessor's exact first nonzero native position
`(7021.10498046875,-1710.717529296875)`, yaw250640, the Down interval midpoint
is25.218155. This gives approximately`(7009.732072,-1688.209480)`, margin14.990813,
frontX7052.069899, target-nearX7070.260045. It need not reach `(7008,-1690)`.
The selection rule takes the first measured feasible nonzero Left position,
then derives Down from those actual coordinates. No further Left pulse is
needed once that position is available. Quantized5.909363-unit Down increments
can enter the interval in the offline model; this is feasibility evidence,
not a measured native Down response or a duration calibration.

Before Chrome, the original six geometry groups, including4,836 independent
grid cases and original config/save/binding checks, pass. New region tests
cover zero/nonzero/overshoot and202 interval samples. Six queue tests cover
atomic publication, missing/delayed ACK and startup/failure sequencing.
Fourteen mocked timing/readiness/support cases pass locally and remotely;
capture ordering and propagated screenshot failures pass. Actual remote mock
bytes recover with full SHA and reject wrong size/hash. Original takeoff guard
fixtures pass. Later supplemental checks explicitly distinguish zero-Left's
original margin8 interval and verify exact predecessor coordinates.

## Single live run and first failure

Assigned bx_dzkgnet6 is freshly verified and board-ACKed before use as
RUNNING/APIidle, healthy and hydrated, expiry2026-11-04T04:42:08.886Z. The staged
historical runtime is reused without rebuild or media restaging: Git base
`a504fa248caaecbbb042b65e9ae5384a340ade26` plus nine-file historical-source.patch,
SHA256`9415aea6dbced13143b9dcdceb9d2d3594219a467263f7b3cf2bb623da36c796`.
Canonical module SHA256
`8459597c8d66e098d727fb4ab53e1cf46332241dc7eef2e158f3c475a78b1676`,
1,898,260bytes; companion ABSENT. All453 pins match before and after execution.

The immutable source remains
`20261104-deusex-small0-reload-onward/recovered/native-save-export/`:
0.bin SHA256`4cfa57f28a079c1b0bcc0f4a002b24f845005122adf3d5ed39f04cd2fc2ba2a6`,
1.bin SHA256`ab8b1fa27157a6dc6f6e9a000acab0082f02be3c7478a7f982c27eab2759a730`.
Manifest, original configs and bindings are unchanged: Left=strafeleft,
Down=backward. The inspected dialog shows count14/time01:17:23; one Enter loads
it. `04-restored.png` shows the crate room and gameplay HUD. Three original
workers and owning worker0/thread1 are identified; settled native state is
exact count14, Physics1/BaseSmall0/yaw250640, velocity0, support margin0.34261655.

Each preparation pulse requires inspected valid world capture and native
settled support before input, trusted balanced events with actual hold<=50ms,
and settled positive support afterward. The driver captures each post-pulse
state and invalidates visual approval until the new PNG is inspected and its
SHA explicitly approved. The second pulse is approved only after inspecting
the first pulse's valid world capture.

| Pulse | Requested ms | Trusted hold ms | Operation ms | Native displacement | Visual result |
| --- | ---: | ---: | ---: | ---: | --- |
| Left1 | 25 | 26 | 28 | 0 | Valid crate room/HUD |
| Left2 | 25 | 26 | 28 | 0 | Blank teal: gameplay stops |

Both before/after native readings retain exact saved position, yaw250640,
Physics1/BaseSmall0, velocity0 and positive margin. No feasible nonzero live
Left position is reached. `06-left2.png` is inspected and retained as invalid
world evidence; no visual approval, capture retry or further gameplay follows.
The cause of the blank rendering and of zero native movement is unestablished.
No claim that quantization makes preparation impossible follows from this run.
Original geometry/support/145ms Up/pre-Space8/feet>96 target-side guards remain
unchanged and are not reached live.

## Recovery and handback

Six matching terminal ACKs succeed, maximum6 steps; all14 trusted input events
balance. The only ArrowDown event selects Load in the menu. The final request
contains only quit. One Chrome lease lasts114.837seconds.

Run-only prerequisite failures are retained: an initial margin16 preference
rejected the observed nonzero case and was corrected offline to12; capture-mock
path mismatch was corrected before Chrome; Puppeteer resolution was repaired
by linking the already installed predecessor dependency. Live preclose recovery
rejects a console.jsonl size/SHA mismatch because it grows after inventory.
The partial download and failure are preserved. After browser closure, all52
stable unique files and the actual canonical module recover with full size/SHA.
No source archive or media evidence copies are created; Git SHA, relevant
binary diff and owned new-file patches record source recovery.

Cleanup completes04:01:36.060Z, before04:32Z: driver17334 and Chrome17346 absent,
port8123 closed, held keys empty, own helpers closed. Final query confirms
bx_dzkgnet6 remains RUNNING/APIidle, healthy/hydrated, expiry04:42:08.886Z.
Lifecycle ownership returns to the coordinator; no allocation, resume, shutdown,
local runtime, subworker, successor task or public deployment occurs.

The focused evidence checker passes. Only this note is committed, so a
production build is not required. The unresolved dependency is valid live
world evidence during preparation; this task stops at that concrete failure.
