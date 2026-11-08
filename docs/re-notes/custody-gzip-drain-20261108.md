# Offline custody gzip and supervised cancellation, 2026-11-08

The custody supervisor now supports gzip from the first journal record and
handles supervised cancellation without abandoning terminal waits. This is an
offline repair using lightweight Linux processes, not browser acceptance.
Evidence: `scratch/runs/20261108-custody-gzip-drain-1925/`.

## Original incident remains UNKNOWN

Read the northern-aperture note, its exact `run-local.py` and
`browser-run.cjs`, and retained journal/terminal receipts. The disk monitor
observed 1,496,027,136 free bytes and requested Browser.close at
19:09:12.635 UTC. Chrome's actual exit receipt is code 0, signal null at
19:09:13.259. The separately reported supervisor tool exit is 143; no retained
sender, syscall, supervisor signal-delivery or complete drain receipt proves
its source. The board watch's actual wait -15 belongs to that separate watch,
not the custody supervisor. Neither Chrome's normal exit nor current PID
absence proves supervisor drain.

The original 47,929-byte gzip remains untouched. Its 297,654-byte prefix has
SHA-256 `5c648eafca471e84766f7d5b8c4c7206a32e77b5003e27e718434642eac4b727`,
1,824 records, 172 registrations and 161 actual terminal reaps. The final
record is a real reap at 19:09:13.276; it contains no causal supervisor signal
receipt. Missing trailer and drain remain explicit failures. Original
supervisor **143 / cause UNKNOWN** is preserved.

The first concrete source defect is that the selected supervisor had no
SIGTERM handler: default termination bypasses Python finally, journal close
and drain. An exact historical Git source control with an injected gzip sink
(no source text rewrite) reproduces actual supervisor wait -15 and an
unfinished gzip after a root exits zero while three adopted children remain.
This demonstrates a mechanism consistent with truncation, not attribution of
the original 143 to that mechanism or to a particular sender.

## Repair and interface

Call `supervise(..., journal_compression='gzip')`, or run
`python3 tools/native_kernel_custody.py RUN --journal-gzip COMMAND ...` with
the existing lifecycle deadlines. Plain journal output remains the default
for existing consumers. No browser lifecycle or driver file changed.

The journal writes directly to `custody.ndjson.gz`, flushing compressed bytes
and fsyncing each record before the corresponding custody action. It streams
the original UTF-8 byte count and SHA-256, writes the gzip CRC/ISIZE trailer,
flushes and fsyncs it before publishing `kernel-drain.json`. The drain records
the journal path, original byte hash/size and finalization error, if any.
There is no uncompressed duplicate or post-run compression requirement.

SIGTERM, SIGINT and SIGHUP latch a cancellation request; handlers do no I/O
and do not throw, including repeated signals during drain. The child restores
the inherited handlers before execution. Runtime deadline expiry uses the
same cancellation path. The supervisor records the request, signals only
registered matching PID/start identities, escalates from TERM to KILL after
250 ms, and continues the existing ptrace/wait loop. Newly registered tasks
are included. The immutable cleanup deadline is never extended. Cancellation
raises after drain, so a root's exit zero cannot turn cancellation into a
successful supervisor result.

WNOWAIT-before-consume logging, terminal wait ownership, fork barriers,
irreversible unlinked-exit retirement and CONT/GETEVENTMSG ESRCH pending
ownership remain intact. ESRCH, ECHILD and /proc absence never create a
terminal receipt. `complete` describes verified custody drain plus journal
finalization; it is separate from command exit and cancellation. A failed
cleanup deadline records `complete: false` and unreaped identities even when
the gzip itself is complete. Existing exception cleanup remains fail closed;
it makes no claim of successful drain. SIGKILL cannot be handled: missing
footer/drain must still be rejected, with the original compressed prefix
preserved. CLONE_UNTRACED and nonleader exec remain unsupported/audited false.

## Validation and recovery

The focused suite passes all 24 tests: the existing 16 custody controls,
including real fork, superseded SIGTERM/clone, terminal ownership and actual
CONT_ESRCH reconciliation, plus eight compressed cancellation regressions.
The new cases execute real forks, isolated sessions/groups and actual waits;
only the explicit no-wait deadline control suppresses supervisor observation.
An independent watchdog is observably armed before the supervised command is
released, and its terminal wait is recorded. Outer subreaper waits are retained
for deliberately failing cases.

Normal gzip completion validates CRC32, ISIZE, decompression and independent
original-byte SHA/size; a corrupted CRC is refused. Supervisor TERM after
root exit, simultaneous child-group TERM, repeated TERM with KILL escalation,
and runtime deadline each drain all four actual identities. The root zero
and child signal statuses remain distinct from supervisor cancellation exit 1.
Suppressed waits stop at the finite deadline with four unreaped identities,
a verified gzip and incomplete drain. Hard SIGKILL and historical default TERM
retain a prefix and fail footer/drain validation with actual supervisor waits
-9 and -15 respectively. No absence inference is used.

A retained first full-suite failure exposed reuse of a test readiness marker
in an evidence directory; each regression now uses a unique case directory.
A later check preflight refused a transient global disk-floor breach. Both
are retained without replacing their logs; successful final checks are named
`focused-publish-final` and `build-final`. The required full build runs under
`flock /tmp/wine-build.lock bash tools/build.sh`.

Evidence records the exact Git SHA, small owned binary diff, current source
hashes and existing module path/hash. Recover code from that Git revision and
apply the recorded patch; do not recover a source-tree archive. Stream a
retained log with `gzip -dc FILE.log.gz`, checking the recorded original byte
SHA/size. For the historical incomplete journal use zlib's gzip decompressor
to recover its prefix, require `eof == false`, and retain the missing-footer
failure; `gzip -dc` also yields the same prefix with nonzero exit. No game
media or module was copied, and no old run was removed.

No Chrome/game/runtime, remote box, deployment, guest write, binding, config,
clock, seed or backend change, or subworker was used. Box ID none, state
NOT_ALLOCATED, expiry and stop receipt N/A. Full27/parity/audio/FPS remain open.
Next: consumers can opt into supported gzip; any browser lifecycle
qualification is separate. This worker stops after publishing this repair.
