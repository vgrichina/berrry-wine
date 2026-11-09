# Redline retained startup boundary, 1355

`tools/redline-startup-boundary.cjs` is an opt-in composition of the exact
1235 generated caller, published native-trace wrapper and actual
`tools/redline-chrome-startup.cjs` consumer. It does not change those providers.
It retains the readiness boundary that was missing from 1295, without another
poll, read, exit listener, signal, CDP request or startup allowance.

The actual loop has **100 waits and up to 101 stat attempts**, rather than
100 filesystem checks. Each turn first runs the existing guard, checks already
observed child exit/wait failure and checks the immutable runtime deadline.
It stats the file, reads only on successful acceptable size, validates the
publication and applies the existing admission guard. After an absent file,
the existing counter permits 100 races between a bounded wait and child exit.
The final missing-file stat precedes the counter's terminal throw. Both this
poll limit and the earlier immutable deadline remain unchanged.

The diagnostic retains actual spawn return immediately after `cp.spawn`,
readiness start, each existing child check, stat/read start and return/error,
existing race result, readiness outcome and sticky first terminal. All added
timestamps use Node `performance.now()`; there is no Chrome/Node clock mapping.
Existing startup JSON, evidence, launch flags, ten-second trace window,
input/capture body, shutdown policy and native retry behavior are unchanged.
The helper checks the readiness provider SHA and exact replacement sites
before browser creation; the generated caller retains its original provider
checks and requires the new helper pin.

Observations stay in memory until terminal. Closing is already set when the
diagnostic is flushed to `startup-boundary.json`. The file is exclusive,
nonblocking, no-follow and regular, with at most 512 records, 4096 retained
read characters and a 128 KiB serialized limit. Diagnostic errors are retained
in recorder status and cannot replace the primary failure or skip cleanup.
Flush neither waits for inherited stream writers nor claims browser EOF.
The existing cleanup publication snapshot can still retain a late port; the
readiness consumer never admits it after terminal.

For a separately assigned future fixture, prepare only small run inputs with:

```
node tools/redline-startup-boundary.cjs --prepare NEW_RUN
node tools/redline-startup-boundary.cjs --check
```

The generated plan selects this helper's `--fixture` entry with
`REDLINE_STARTUP_BOUNDARY=1`, `REDLINE_NATIVE_TRACE=1` and the existing required
immutable `BROWSER_DEADLINE`. It preserves the single comma600 fixture and
ordinary joined quit. Preparation and `--check` authorize no native attempt.
The prepared no-launch caller preflight passed with 894 pins.

After terminal, use the published 1325 filesystem-only composition on that
assigned run's actual wrappers:

```
python3 tools/redline-terminal-cleanup.py cleanup RUN/terminal-cleanup.py fixture
python3 tools/redline-terminal-cleanup.py retrieval RUN/recover.py fixture
```

Its generic unique-file inventory includes the new diagnostic. Invalid,
truncated or missing gzip artifacts preserve their original bytes and explicit
invalid status. Successful collection never establishes browser stream EOF,
flushed trace, fixture success or a native cause. Do not execute these commands
against archived 1295.

`tools/redline-startup-boundary.test.cjs` runs the actual generated old/new
caller and actual readiness source with real inert Node children and real port
files. Fourteen executions cover ready before deadline, never ready, late file
after terminal, early child exit, invalid port, failed diagnostic writer and
inherited writer. Old missing-diagnostic FAIL/new retained PASS refer to that
specific retention assertion. Never/late/write-failure pairs preserve exactly
100 waits, 101 stats and zero reads before terminal, within the unchanged
ten-second startup bound. The late file is retained only by existing cleanup;
there is no WebSocket or later input/capture. Early exits remain early. Existing
first failure stays primary. The inherited case preserves stream EOF false
and truncation, with a real subreaper separately adopting and waiting the writer.
Each runner has a prearmed observable independent process deadline and actual
wait/separate stdout/stderr completion records. FIFO, symlink, absent-directory,
capacity and sticky-terminal controls exercise the real diagnostic sink.
Removing observation calls reconstructs the exact original readiness source;
the actual input/capture body remains byte-identical.

Also passed: existing native-trace raw-wire/launch/retrieval controls and six
whole single-comma controllers; input-wire seven old/new composed transport
pairs; 1325 actual cleanup/retrieval malformed-log and inherited-writer controls;
fixture-shutdown controls; and `flock /tmp/wine-build.lock bash tools/build.sh`.
The cleanup test uses its actual source with only the evidence destination
redirected to this task's run; its independent deadline and consumer behavior
are preserved. Initial test-shape and terminal-timestamp failures are retained
alongside corrected passing runs.
The final late-file control publishes from the harness only after the actual
terminal callback. An earlier 10.4-second timer control correctly admitted a
file that appeared before terminal under shared build load; that fixture timing
assumption was corrected rather than changing the startup consumer.

Evidence: `scratch/runs/20261109-redline-startup-boundary-diagnostic-1355/`.
Git base plus small owned patch are the source recovery recipe; provider paths
and SHA-size references, focused/build logs, actual waits and unique SHA-size /
gzip CRC results are retained there. No source archives or media/module copies.
Free `/home` remained above 1.5 GB. Only the narrow helper, test and this note
are committed; shared clients, custody, Q2/Q3, host, WAT, Heroes II and CLAUDE
are untouched.

The 1295 note and run inputs establish 166.446 ms spawn-call elapsed, then the
existing startup gate's 10033 ms expiration before any input. Its late port
43407 was cleanup-only, trace unflushed, browser EOF false, and two invalid
gzip files were retained. These new controls **do not explain historical 1295's
native cause**, which remains UNKNOWN. No tracing extension, startup flag/cap
change, native retry, local Chrome, browser guest, box, agent or worker was run.
Q3 1345 retained sole next runtime ownership.

No new box ID, expiry or stop receipt exists. Inherited 1295 remains recorded
offline as `bx_vu6j5kxj`, UUID `f67904f5-7a1b-4a7c-8cda-01c869296506`, ARCHIVED
and physically drained. Unforced stop `stop_98cac7ffc9693ef9` completed at
2026-11-09T12:23:51.927Z; initial archive deadline 12:43:26.114Z; final
`archiveAfter:null`, `expiresAt` unreturned. It was not contacted or resumed.
Next: reuse the opt-in composition only on a separately authorized run.
SingleTaskSTOP.
