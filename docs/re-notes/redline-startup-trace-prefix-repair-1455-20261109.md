# Redline startup trace byte retention

The shipped collector in `tools/redline-native-trace.cjs` requests Chrome's
ten-second startup JSON trace. It does not collect Linux syscall records.
Its old retrieval path asserts browser wait and stream EOF before inspecting
the trace file, then requires complete JSON before returning any byte identity.
Consequently, existing on-disk bytes disappear from the retrieval report when
EOF is false or JSON ends mid-record. Actual inert subprocesses reproduce this
loss through the shipped `launch()` and `retrieve()` functions.

The narrow repair retains the first 64 KiB of a regular file as base64,
its exact byte length and SHA-256, observed file size, cap status, actual wait,
and separate EOF observation. It opens with NONBLOCK/NOFOLLOW, uses a bounded
read, closes the descriptor, and records missing/unreadable/nonregular files
as errors. The byte snapshot is explicitly `snapshotOnly:true` with
`traceCompleteness:'UNKNOWN'`. It neither repairs nor parses partial events.
Keeping the bytes inside the existing retrieval JSON makes them independent
of later file changes or truncation and requires no additional artifact route.

Existing full-trace JSON, wait, EOF, size and keyboard-boundary validation stay
in force. The generated caller is byte-identical, including readiness,
first-failure recording, cleanup, and launch flags. No timer, poll, tracing-stop
request, signal, readiness extension, native retry, or event attribution is
added. Collection after cleanup cannot cause bytes buffered inside Chrome to
be written to disk.

## Historical facts

Evidence is in `scratch/runs/20261109-redline-startup-trace-prefix-repair-1455/`.
The audit independently rereads all 34 actual1395 retrieved files against the
retained remote inventory's SHA-size pairs. It preserves the exact first
failure at `2026-11-09T13:00:25.011Z`, 10,349 ms elapsed, 100 waits, 101 ENOENT
stats and zero publication reads. The retrieval report fails at the EOF
assertion before inspecting the trace file. The retained inventory contains
no `native-startup-trace.json`. Whether Chrome ever created a usable on-disk
prefix is UNKNOWN. This fix cannot recover the historical trace or establish
that the EOF gate caused loss of bytes in that particular fixture.

The 790-record historical custody journal's uncompressed 128130 bytes match
SHA-256 `7a2b3e74e7022a96ebf614d54f6a53838d64f8a27a05857c48bcc7de72f6070c`.
Sequence 522 is the CLONE peek; sequence 523 is the consumed EXIT classification.
PID 8107/start 33709 remains unresolved. Published
`f977ebf7c28977d7d95eb404f43db2209d163dde` adds consumed-status, event-message,
CONT-return and observation-only preconsume diagnostics for future runs. Those
records do not exist retroactively. All 81 recorded reaps, incomplete lineage,
browser SIGKILL, false EOF and both invalid browser gzip artifacts remain
historical facts; startup cause remains UNKNOWN.

## Offline verification

`tools/redline-trace-prefix.test.cjs` loads the exact published1395 predecessor
and compiles the candidate transform in memory. Real executable Node scripts
receive the shipped collector's actual startup argv and write small inert
trace-shaped byte sequences. They are explicit test producers, not evidence
of Chrome's flush behavior or native syscalls.

Old/new pairs cover SIGKILL, cancellation by SIGTERM, inherited pipe writers,
partial final JSON lines, complete JSON, and the actual unchanged readiness
consumer exhausting its 100 by 100 ms waits. Each execution starts after an
independent observable deadline watchdog is armed. Actual child and watchdog
waits and pipe EOF are recorded separately. An inherited writer leaves EOF
false at collection even though the root has actually exited. Cleanup kills
the test process group and joins the local pipe close. Snapshots match the
real files byte for byte; first-terminal values remain exactly unchanged.
Missing files, symlinks, FIFOs, the 64 KiB cap, absent actual wait, and the
existing full-trace size bound cannot promote validation.

Q31445 published its final RELEASE STOP at 13:30:27Z, commit
`1b106094bc6f2c421cb7a6c86c20b37510e0a082`. A fresh OWN at 13:30:35Z preceded
the collector edit. The candidate and tests were prepared in memory during
its exclusive source interval. No shared custody/client/host/WAT/Q2/Q3 source
is changed.

The final old/new suite also compares every preexisting retrieval-result field
against the published predecessor, including a complete keyboard-boundary
positive. Full JSON with false EOF remains invalid, and returned snapshot
bytes survive a later file append. A subreaper around the suite actually waits
the two inherited writer descendants after process-group cleanup; their waits
are retained separately from the root waits and EOF observations.

The existing startup-boundary regression suite and locked full build pass.
The broader native-trace test passes its socket/retention/launch/retrieval
controls, then refuses its whole-controller fixture's old selected-module
SHA `a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`
against current `3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.
That historical module assertion is preserved; no module substitution, source
pin waiver, or fixture retry was used to turn it into a pass.

## Next causal instrumentation

A separately scoped syscall observer should start at the admitted browser
exec boundary and retain bounded, durable syscall entry/return records for
DevToolsActivePort open/write/rename operations, relevant errors, exec, signals
and exit across the owned process tree. Associate each record with the actual
PID/start identity and existing custody sequence; retain raw observations
without inferring lineage. It must preserve the present readiness bound and
first failure, and keep actual waits separate from collector and browser EOF.
This would distinguish publication-related kernel observations from a Chrome
JSON buffer that never reached disk. This task authorizes no native rerun.

No Box, browser, local Chrome, guest, native game, agent or worker was created.
New Box ID/state/expiry/stop receipt are not applicable. The inherited1395
Box `bx_rfgz429k` / UUID `5adf5b34-c76e-447d-b734-996cfe43bfd0` is offline and
uncontacted: retained state ARCHIVED/PHYSICAL_DRAINED, completed normal stop
`stop_c6f706024295cebc` at `13:03:19.518Z`, initial expiry `13:24:02.050Z`,
final expiry not returned. Git is the source archive; recovery uses the exact
base SHA and small owned-file patch, without media, module or source archives.
