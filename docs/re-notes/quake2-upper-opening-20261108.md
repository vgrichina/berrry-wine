# Quake II remote startup failure and readiness repair, 2026-11-08

The upper northern opening remains unqualified. The one fresh remote run
failed before connecting to Chrome, before original game launch, native input
preflight, or any gameplay. No screenshot, passage, target, or onward consequence
was observed. This task ends with a tested startup repair and a concrete custody
blocker, without retrying the browser or allocating another box. Evidence:
`scratch/runs/20261108-quake2-upper-opening-1940/`.

## Exact selection and execution

Selection Git was `27a902b0c75b27fcedaae72a447c4d239c7ba63e`, with 703
path/size/SHA pins totaling 109,875,817 bytes. All 704 uploads, including the
manifest, joined before remote validation of every selected file and launch.
Existing media/module paths were read directly; no local media/module copy or
source archive was made. Selected CPU SHA remains
`d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`;
it was not observed executing in this failed browser run. Historical cc438/f965
results remain distinct. The unchanged 187 sightline controls are referenced by
hash as preparation only, excluding hull/dynamic-entity qualification.

The owned Q2 consumer directly integrates `tools/native-browser-close.cjs`.
Concurrent close callers share one promise; profile removal and quit ACK require
an actual terminal and pipe-drain receipt. UNKNOWN retains the profile and
suppresses cleanup/ACK. The exact selected custody source is imported normally
with `journal_compression='gzip'`; no runtime source rewriting or injected sink
was used. A real `/bin/true` control verified terminal wait and gzip original
hash/size before runtime.

At 19:41:57.233 UTC, the selected driver's fixed 100 × 100 ms readiness loop
ended with ENOENT for `DevToolsActivePort`. Chrome stderr contains a DevTools
listening endpoint on port 42799, but that line has no timestamp; its exact
publication time is unproved. No CDP connection or original launch followed.
The missing endpoint is a startup failure, not the previous local disk failure.

## Tested readiness repair

`tools/native-devtools-ready.cjs` waits for a complete, valid port/browser-path
pair until an explicit immutable deadline. Missing or partial publication can
progress; malformed publication cannot become an endpoint. A terminal child or
read error fails closed. The owned Q2 candidate calls it with the earlier of
60 seconds from startup and the existing browser deadline minus 30 seconds.
Neither the browser cap nor cleanup reserve is extended.

Nine focused controls pass: the exact historical Q2 readiness block reproduces
ENOENT with a delayed real file under scaled host-test waits, while the repaired
consumer accepts the same publication; direct consumer integration; actual
terminal-before-cleanup and concurrent close; UNKNOWN retaining the profile;
delayed and partial publication; malformed/missing finite timeout; a real child
exit; propagated read errors and invalid deadlines. These are host fixtures,
not guest clock changes or fresh browser acceptance. Final focused and locked
full-build logs are gzip-written from the outset, with original stream hashes.
The candidate was not launched again.

## Custody blocker and retained limitations

Browser close returned UNKNOWN at its 30-second cap, with no terminal/drain
receipt and no quit ACK. The selected supervisor then failed at
`AssertionError('duplicate terminal receipt')`, with 133 registrations, 131
recorded terminal reaps and two unreaped identities, 7173/16882 and 7179/16927.
Its parent recorded an actual supervisor wait with return code 1.

The journal localizes the duplicate to Chrome PID/start 7185/16988: its first
before-reap records PPID 7173 at sequence 1381, followed by actual wait status 0
at 1382. Sequence 1448 observes the same identity as a zombie with PPID 7172,
then the duplicate guard fails. This is evidence of a parent/adoption transition;
it needs a focused tracer-versus-parent terminal-ownership regression. This
worker did not change the shared kernel or simply discard the duplicate.

The gzip trailer is complete and independently validates all 225,135 original
bytes, SHA-256
`c4532cf5cac202072ea129be6604f55c2085102883e117ac7c1528edff28bbc3`.
`kernel-drain.json` explicitly says `complete: false`. The original historical
supervisor 143/cause UNKNOWN and truncated-prefix proofs remain unchanged.

At cleanup census, all 133 registered PID/start identities were absent, ports
42799/42301 refused connections, and the heavy lock was free. These observations
do not replace the missing terminal waits. No input had been held. The profile
was retained on UNKNOWN; no accessible FD referenced it, but 51 processes had
unreadable FD directories, so exhaustive writer drain is unproved. No exhaustive
CLONE_UNTRACED or nonleader-exec coverage is claimed.

## Retrieval, shutdown, and recovery

All 19 selected remote evidence files, totaling 88,831 bytes, were retrieved and
independently rehashed before requesting normal stop. Runtime stdout and custody
were compressed from the outset; other small remote logs were compressed before
local retrieval, with original-byte hashes independently verified. Recovery uses
the exact Git SHA, relevant binary diff, small owned input patches and existing
media/module path/hash pins. The executed driver patch separately matches its
selected SHA `ae0c74e3ad5a364a560f45277ba2a154f3abd1754d34bdcf4c9356bc91202371`;
the repaired candidate is distinct. No tree archive or peer WIP was copied.
The reused local watchdog and upload-ledger helpers initially wrote six JSONL
logs uncompressed. After all roles exited, their 617,068 original bytes were
gzip-compacted, independently rehashed, and only those owned raw duplicates
removed. This exception to the requested gzip-from-outset rule is recorded in
`local-log-compaction.json`; runtime stdout/custody and focused/build logs used
gzip from their first bytes.

The initial retrieval filter mistakenly omitted `kernel-command.log`. A later
read-only archived-file retrieval was refused with HTTP 409; the box was not
resumed. That unique raw command log is not recovered, and complete log recovery
is not claimed. The separately retained failure JSON, supervisor traceback and
finalized custody journal remain available. This is an evidence limitation in
addition to the incomplete terminal drain.

The UUID was durably recorded before create, and ID/expiry before runtime. The
independent observable watchdog was armed before allocation with an immutable
25-minute normal-stop cap. Box **bx_rxvzubfd** is **ARCHIVED**, expiry
**NULL**, stopped at **19:44:15.274 UTC**. Receipt
**stop_e37948f9ddc48635** completed at **19:44:15.291**, `forced: false`,
`error: null`. Both local watchdog roles have actual supervised exit-zero waits;
their supervisor records no remaining children. Its own detached exit is not
promoted to an external terminal-wait receipt.

No local Chrome, second allocation, restart/replay, private guest writes,
handler calls, config/binding/backend/clock/seed changes, old-box operations,
public deployment, subworkers, or old-run deletion occurred. A peer recorded a
transient shared-disk floor breach; this run makes no continuous disk-compliance
claim. Next: reproduce and repair the newly localized custody ownership failure
before another authorized original. Full27/parity/audio/FPS remain open.
