# Explicit publication-observer launcher (offline delivery)

`tools/native_publication_launch.py` is a usable new entrypoint around the
published collector, with the observer OFF by default. Existing callers and
providers are unchanged. Example (an independently prearmed finite watchdog
must already cover this process):

```
python3 tools/native_publication_launch.py RUN --journal-gzip \
  --publication-observer=d54aa57e3 -- /absolute/inert/executable arg1 'literal ; $()'
```

`RUN/lifecycle.json` must already hold the original `browserDeadline` in
milliseconds. The launcher passes that deadline unchanged and cleanup at
exactly deadline + 30 seconds; startup, cancellation and observer saturation
never reset them. Options precede `--`; everything afterwards remains actual
argv, passed to the original execvp, without a shell. Omitting the explicit
versioned opt-in compiles byte-identical original collector source.
`--max-records=N` and `--max-bytes=N` require opt-in and retain helper hard
bounds. `--journal-gzip` retains the original custody journal option; command
output remains the original raw `kernel-command.log`, without a second logger.
The existing command-success assertion and cancellation exception still
produce CLI failure, with actual root exit recorded separately. An observer
incomplete footer is retained as incomplete, without changing command success.

Before any child starts, both helper and collector bytes must match pinned
published versions d54aa57e3 and f977ebf7c. The launcher executes those verified
bytes, installs the verified helper module only around supervision, and
compiles the exact helper candidate in memory. It never loads historical
collector source, rewrites the collector, adds a tracer/reaper, or changes
first-terminal/readiness admission. Unknown versions, stale providers,
invalid bounds, expired lifecycle, and reused run evidence are refused.
The independent watchdog is deliberately outside the collector's P_ALL child
wait domain; the launcher does not create one under custody.

`publication-launch.json` records command argv, resolved executable SHA/size,
actual caller argv/PID/parent, launcher SHA, Python executable/version, platform,
helper/collector/candidate hashes, lifecycle SHA, deadlines and compression.
`publication-validation.json` records SHA/size, decoded SHA/size and gzip
CRC/trailer validation, custody sequence/digest/reap receipts, and observer
sequence/hash chain plus custody/consumed-wait/raw-syscall cross references.
Observer footer schema and declared record/byte bounds are checked separately.
Empty gzip is INVALID evidence despite a valid gzip trailer. Empty raw command
output is also marked invalid evidence, without turning a silent successful
command into a failure. Collector failure and validation failure remain
separate from observer completeness. Readiness and publication stay UNKNOWN.
A rehashed but incorrectly linked observer entry is rejected; hash-chain
integrity alone cannot prove custody. Validation failure causes CLI failure.

The bounded observer retains its real raw syscall NDJSON file. Exit-group has
no invented return; cancellation, caps and unpaired calls stay incomplete.
This launcher does not infer publication atomicity, complete coverage, durable
application bytes, or readiness. Per-stop fsync can cost substantially; no
native-ready performance or deadline/admission waiver is claimed.

Evidence is in `scratch/runs/20261109-redline-publication-observer-launcher-1505/`.
The exact initial Git base is in `git-base.txt`; `own.patch` contains only the
small new deliverables. Git is the source archive. No source tree, media,
module or source archive was copied into runs. Compiler identity, inert C
input hash/reference, executable hash, used CLI command and caller metadata,
raw logs, watchdog arming and actual waits/EOF, custody and validation records
are retained. Final launcher runs are under `final-cli-v4/`; earlier test
iterations are retained honestly. One negative-only wrapper initially failed
to inject drift because its closure read mutated argv; fixed to bind filename.
A later damaged-record test prompted the explicit wait-mismatch diagnostic.
Neither failure required changing collector logic, timeouts or admission.

Actual inert CLI tests cover direct write, temp/rename, failed open ENOTDIR,
write EBADF, rename ENOENT, fork/exec, literal shell characters, default OFF,
enabled nonzero child exit parity, cancellation in both modes, immutable
runtime deadline, record/byte caps, custody gzip, damaged/truncated records,
wrong custody linkage, empty/broken gzip and stale helper/collector refusal.
Every executing fixture has a prearmed observable independent finite sibling
watchdog; supervisor and watchdog actual waits are distinct from pipe EOF.
Every owned root/descendant has real custody reap receipts and no remaining
/proc identity. Test writer sources/binaries are temporary and cleaned up.
No browser, local Chrome, game, Box, worker, agent, public deployment or native
retry was used. Box ID/state/expiry/stop receipt: NOT_CREATED / N/A. No inherited
box was contacted or modified. Historical startup/PID8107 lineage stays UNKNOWN.

All four launcher tests pass, the four existing observer tests pass, all 46
kernel custody tests and eight reaper tests pass, and the final locked build
passes. Free space on /home remains above 1.5 GB. Existing helper, custody,
Redline and Q3 providers remain untouched while Q31475 owns its runtime/source
closure. Production caller integration is deferred until its final published
RELEASE plus API archive/physical drain and fresh ownership; this delivery
requires no existing caller edit and authorizes no native run.
