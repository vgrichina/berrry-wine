# Q3 cancellation separate-stream EOF repair (offline)

The existing generated cancellation parent and prelaunch now have a narrow
separate-pipe repair. `tools/q3-cancellation-stream-eof.py` composes the existing
client wrapper, changing its prelaunch Popen/pump/wait receipt only. Prelaunch
uses the same pump for the runtime. Each receipt follows an actual child wait
and an empty read on each real pipe, retaining `stdoutEOF`, `stderrEOF` and
compatibility `stdioEOF`. Concurrent draining preserves the existing combined
compressed logs; cross-stream ordering is unspecified. Child exit alone never
establishes closure, including when a descendant retains one writer.

For a future staged run, pin the helper in runtime-pins.json.gz (prelaunch now
requires it). Use its `bind_remote(task, session)` in place of the existing
client's binding, or invoke the helper CLI with the unchanged existing client
arguments and owned stdin protocol. It delegates to the existing client/session,
commands and cancellation publication. The shared client and custody are
untouched. Using the old binding still produces a combined-only outer receipt
and cannot satisfy the cancellation prerequisite. No new qualification layer.

The existing identity-bound cancellation TERM, first failure, repeated-signal
handling, .02s pump cadence and total sixteen 65536-byte reads per pump turn
remain. Physical input, independent UP, capture/ACK, quit and native cleanup
bounds are unchanged. No browser, guest, Boat, new box or original game ran.

Evidence: `scratch/runs/20261109-q3-cancellation-stream-eof-repair-1275/`.
`controls-final2` executes the actual generated parent and actual prelaunch using
real inert runtimes and inherited descendant writers. The retained 1250 parent
matches after root/run/output path substitution; the old prelaunch comes from
Git base `94e041a439783b0df355eb58744ecf521249dc1f`, matching its retained pin.
Six old/new pairs PASS: normal exit, cancellation, repeated-signal cancellation
with held runtime pipe, delayed stdout, delayed stderr and incomplete stream.
Every old receipt fails separate-EOF acceptance; every new completed receipt
passes. While a writer remains open after runtime exit, neither inner receipt
exists and acceptance fails; releasing it allows completion. Both streams carry
more than pipe capacity, final writer bytes are retained, and orphaned writers
are actually waited by the test's subreaper. An independent prearmed watchdog
exited0 without firing. First cancellation/failure bytes remain sticky.

Existing prelaunch tests (including missing-helper refusal) and
`flock /tmp/wine-build.lock bash tools/build.sh` PASS. The first prelaunch test
invocation lacked its output parent directory and failed before any test child;
the corrected fresh invocation passed. Earlier controls and that failure remain
retained. Git base plus small owned patch recover the repair; SHA/size and gzip
CRC checks cover evidence. No source archive, binary or media copies. Free
/home stayed above1.5GB.

Ready for a separately authorized bounded native cancellation check. Historical
native fixture PASS is unchanged; actual native cancellation remains NOT_PROVEN,
native lifetime REVOKED and allwriters/edictABA UNKNOWN. No box was created or
contacted; inherited bx_rf8rjemq UUID511af2d1-b021-4e70-a0f4-603f5a20ce55 remains
historically ARCHIVED/PHYSICAL_DRAINED with completed unforced
stop_1ce0662336788cbd (12:03:25.438Z), initial expiry12:26:20.128Z, final
archiveAfter null and expiresAt NOT_RETURNED. Single task STOP.
