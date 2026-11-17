# Installed VB5 CCE after the locale repair

Run: `scratch/runs/20261117-vb5-correct-locale-installed-ide-sample/`.

Published `1a8fdf361` repairs the measured MSO97RT locale resource name:
`GetLocaleInfoA(0x80000003)` returns `ENU`, allowing genuine `Mrt7ENU.dll`
resource loading. It does not establish usable IDE or AxButton execution.
The predecessor original endpoint remains permanently closed.

Before the newly authorized installed invocation, review found that the runtime
used regular native output files. Actual process waits could be established,
but native pipe EOF could not. The runtime now drains stdout and stderr through
independent readers, joins them after the actual native wait, and records each
observed EOF and any output error. Reader completion is required for a successful
drain. Cleanup preserves its separate disposition and cannot establish native
Quit. Input limits, freshness, original EXE/sample arguments, and watchdog
deadlines are unchanged.

The focused actual-native shutdown test covers normal exit, TERM, an outer
exception, timeout, EOF, and the independent watchdog deadline. All six cases
observed both native EOFs and joined readers. Non-normal cases also require
incremental visible MessageBox output before cancellation, exercising live
draining. Evidence: `pipe-shutdown-focused/results.json`. The full canonical
build and published-graph qualification are recorded separately in the run.

The initial preparation was cancelled before `original-go.json` and before any
original invocation to close this evidence gap. Its cancellation and actual
outer/watchdog joins are retained under `installed/`. It consumed no original
allowance. No boxes or additional workers were created.

## Genuine installed result

The one authorized invocation used published `86d7e9fdafc8844192519c73cebda6f07d0f982b`
and retained module SHA-256
`cdcbd50d245a9b3f6ff8c8ad9b61b52e24c9cf286c1f80dd045016cdbe42dd49`.
All 23 named preparation checks passed, including main/CPUWorker/OS-child
inheritance. The separate actual outer proof used identical source/module
identities and joined its two independent watchdogs with both pipe EOFs.
The native clock remained 1800 seconds, watchdog 1820, and Quit reserve 180.

The original code requested `MRT7ENU.DLL`, created the IDE windows, read the
shipped AxButton project/control/context files, and set the title to
`AXButton - Microsoft Visual Basic [design]`. Its trace did not repeat
`Unexpected error; quitting`. This establishes genuine project-loading progress;
it does not establish a personally reviewed usable IDE or running control.

The first and only endpoint request was a native reviewed capture. Before
encoding or writing an image, it refused with exactly:

```
{"context":["focus.mainTopLevel"],"controls":["control.unsupportedClass"]}
```

The controller latched permanent UNKNOWN. There was no image, binding, input,
later HTTP request, rebind, replay or retry. The native process was stopped
through the runtime's shutdown handler. Its actual wait returned zero with
cleanup disposition, both native pipe EOFs and joined readers. The outer wait
returned 143 and joined both watchdogs with both EOFs and empty remaining scope.
The native cancellation receipt is SIGTERM, not native Quit.

Read-only source inspection locates the boundary in `cli-native-scene.js`:
non-modal focus must have the main HWND as its top level, and every observed
control must have supported native metadata. The refusal discards the actual
snapshot, so neither the offending focus HWND nor unsupported control identity
was retained. Desktop participant records describe IPC phases, not those USER
identities. A specific focus/control implementation defect cannot therefore be
inferred faithfully from this invocation. OLE32 warnings were also present;
they were not measured as the cause of this refusal or an application failure.

Shared generic scene/runner helpers remained read-only under the task's handoff
rule. A WHOLE handoff was requested on the messageboard for a bounded refusal
identity diagnostic; no admission rule was relaxed and no speculative emulator
fix was made. The original allowance is spent. Next work must first retain the
actual refused native identities, preserving focus/actor/generation/context and
target guards; another genuine invocation needs separate authorization.

Post-close verification rehashed all 86 original blobs and eight provenance
records. The original 258-record index and 836-entry base registry are unchanged.
The predecessor's natural 851-entry registry remains unchanged and separate;
this invocation naturally exported 1031 entries to its own registry, without
hand edits. No unselected authored fixture images are retained and no original
capture image was returned. Exact Git identities, patches, modules, logs,
wait/EOF receipts and their hash manifest remain in the run directory.
