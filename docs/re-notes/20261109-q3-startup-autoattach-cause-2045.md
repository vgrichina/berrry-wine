# Q3 startup custody service investigation, 2045

The new discriminating evidence is a real **14,250.230 ms ptrace hold** of
Chrome child 6731 during the retained request-6 interval. Q3 now batches the
custody journal at its existing durable executable-CONT barriers. Controlled
slow-storage tests establish the resulting reduction in tracer service time.
**This does not establish that journal service caused native request 6's
deadline, or that the change repairs it.** Native validation was not reached.

Code commit on main: `02e95626d` (full identity in the run's Git records).
Evidence: `scratch/runs/20261109-q3-startup-autoattach-cause-2045/`.
Git plus small patches is the source archive; no source/media archive was made.

## Retained evidence and causal control

The independently SHA/size-checked 2035 custody journal registers child 6731
at 20:35:28.096 UTC, about 3.204 seconds after request 6. Its first returned
CONT is at 20:35:42.347 UTC, about 17.455 seconds after that request. This is
actual tracer evidence of withheld executable progress, distinct from Node's
send, scheduler and public callback observations. The log does not identify
the child's Chromium role or its dependency on request 6. Inter-record gaps
do not directly measure fsync or browser service time.

Exact shared-source review found that `Journal.write` synchronously flushes
gzip, flushes the raw stream and calls fsync. The published supervisor does
this for multiple intermediate stop/registration records, while its existing
executable-CONT path already flushes the complete ordered journal prefix.

`tools/q3-startup-custody.py` authenticates the exact published shared provider
SHA before one assertion-anchored transform: intermediate records use the
existing bounded pending journal. The executable-CONT flush, ownership/lineage,
consumed waits, PID identity checks, cancellation, irreversible retirement,
sticky service errors and finalization code remain byte identical. Saturation
still applies synchronous backpressure. A bounded service-time observer
records the tracer's own journal writes; it supplies no wire/browser timing.

Only Q3's generated native lifecycle imports this adapter. Preparation pins
the adapter and the generated wrappers. The shared custody file and protected
RF2045/Nox2020 providers were not edited. The generated Node consumer and
Python command caller are unchanged, retaining `c43c85981`'s real input-wire
composition regression and `2b945315a`'s stdin repair.

The final controlled fork/exec test inserted 12 ms service delay per fsync:

| Exact supervisor | fsync calls | Elapsed | Owned/reaped |
| --- | ---: | ---: | ---: |
| Published | 115 | 1.731 s | 13/13 |
| Q3 batching adapter | 51 | 0.777 s | 13/13 |

This proves a causal storage-service reduction in the control, not the cause
of the retained browser failure. The complete sealed generated native Node
caller also runs under the adapted real ptrace supervisor, with actual native
cause/input-wire hooks and a controlled peer. Request 6 resolves, Page.enable
and Runtime.enable follow, then a deliberate protocol refusal stops before
navigation. There are 19/19 actual reaps. The peer supplies no Chromium model.
Separate native controls verify a complete durable ordered prefix before every
executable CONT, bounded/saturated journals, sticky sync failure and failed
finalization. The CDP deadline remains 20,000 ms; no failed request is replayed.

## Sole remote attempt: preparation error, terminal refusal

The 944-provider candidate was sealed at manifest SHA
`a56667e2015d74fcd538be30520999eeed15a4fd3f5021ef1033183197e6af3d`.
All common providers match 2035 except `tools/q3-current-module.cjs`; all 327
media pins and both freshly built modules are unchanged.

I armed a bounded passive loopback packet observer too early, creating a
directory that the remote read-only preparation check expected to create.
Its FileExistsError is retained. Both checks then passed in fresh directories,
but my corrected preparation omitted copying the manifest to the phase's
`prepared/runtime-pins.json.gz`.

The single actual generated launch consequently refused in
`q3-native-prelaunch.py:136` with FileNotFoundError for that phase-local
manifest. This is my staging error. The generated parent (7650) and prelaunch
child (7651) actually joined with status 1 and separate stdout/stderr EOF.
The runtime parent, kernel supervisor, Chrome and CDP were **NOT_CREATED**.
There was no request 6, input, screenshot, GL sample or original in this run.
The refusal was terminal: no repaired relaunch, retry or conditional original.

The initial and actual-attempt passive observers both joined 0 with separate
stdout/stderr EOF. Neither saw a debug port or retained a packet. Thus this
run adds **no actual wire or browser-service evidence**. Their fixed 90-second,
512-packet/256-KiB bounds are independent of the native protocol deadline.

Routine offline test errors are also retained: a reused model assumed an
earlier synchronous append; the first local peer lacked its parent directory;
an experimental real fsync-refusal test contaminated a subsequent supervisor
with its still-retiring child. Final tests use the native durable-CONT control
and the existing isolated sticky-service controls. No local Chrome ran.

## Lifecycle and next step

All 19 unique retrieved artifacts were independently reread for SHA/size and
gzip CRC before exactly one delegated normal stop. There were no PNGs.
Box `bx_hyqpv258`, UUID `4d2a5f42-4fd3-4e76-9847-f02b0f0e5e39`, is independently
API-confirmed **ARCHIVED**, with unforced completed stop
`stop_7d720ee5ed345c95` at **20:54:52.254 UTC**. Initial expiry was
21:16:26.784 UTC; final archiveAfter is null and expiresAt is not returned.
The independent immutable watchdog was observed before creation, had fixed
deadline 21:16:27.435 UTC, and actually joined 0 with separate stdout/stderr EOF.
No second stop, resume or delete was issued. Free /home remained above 1.5 GB.

Passed: new causal/storage and whole-generated-consumer tests; actual generated
prelaunch/custody paths for both phases; capture boundary and real input-wire
hook regression; foreign closure with 27 refusal controls; local controller;
and `flock /tmp/wine-build.lock bash tools/build.sh`.

The next separately assigned native run must first place and independently
hash-check the sealed manifest at **each phase-local prepared path**, in
addition to the check-only directory. That prerequisite was missing here.
Native request-6 repair and alive arena interaction remain **UNVERIFIED**.
