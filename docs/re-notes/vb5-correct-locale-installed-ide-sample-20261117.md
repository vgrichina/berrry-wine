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
