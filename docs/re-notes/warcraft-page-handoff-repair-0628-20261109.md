# Warcraft page attach/custody offline investigation, 0628

No production repair established. The unchanged actual composed driver and
custodian pass the controlled page handoff and cancellation fixtures described
below. The WC0615 renderer-agent/native-task binding is absent from the retained
evidence, so its page stall and 95 missing waits remain UNKNOWN. This assignment
stops once under the explicit uncertainty condition; it authorizes no runtime
retry. Evidence: `scratch/runs/20261109-warcraft-page-handoff-repair-0628/`.

## Retained sequence

`causal-audit.json` independently verifies all 188 indexed WC0615 files, including
133 gzip files and their recorded decoded hashes/sizes. The endpoint was
accepted at 06:19:42.950 within its startup bound. Browser-level discovery and
auto-attach completed; request 5 explicitly attached the existing page again.
The two page attachments refer to the same target, and both report
`waitingForDebugger:false`. A paused page cannot be inferred from the browser's
`waitForDebuggerOnStart:true` setting.

Request 6 enters page-session `Target.setAutoAttach` at 06:19:43.375, using
`DE1D1B5E65129935EBC1FB7CC47CB6A6`. The immutable cap interrupts it at
06:20:01.907 after 18,532 ms. This is not a CDP 20-second timeout. Page enable,
qualification, navigation, pre-CPU/pre-DLL-main admission and original launch
were not reached. Independent Browser.close receives ACK at 06:20:01.908;
terminal/close/separate pipe EOF remain absent at the 18-second close result.

The retained creator witness contains actual CONT-before/return records and
per-task wait observations during the pending request. They do not identify the
page's renderer agent or its native request handler. Kernel custody contains
739 events, 110 identities, 15 actual terminal waits, one queued resume, no
unresolved lineage or ptrace rows, and command EOF=false. Cancellation starts
at sequence 729; two signals interleave clone-stop consumption before the
cleanup deadline. Physical absence in the later census supplies none of the
missing terminal receipts or request/renderer bindings.

## Actual composed offline controls

`page-handoff-control.py` executes the production composition through request 6
and the subsequent Page.enable, then closes. The substitutions are confined to
the static server, the unused pre-game bound-chain constructor and the browser
launch/transport boundary. The peer is a real Node child with separate pipes;
it starts a small C process with 24 native creator threads. It advertises the
endpoint after those threads are armed and withholds request 6's reply until
all 24 creators return from real pthread clones. The two page-session events
match the retained duplicate-attachment shape and waiting=false state.

A fixture barrier waits for all 24 real clone messages before the custodian
continues. A CONT oracle requires no pending creator clone message before
every subsequent CONT. There are no fabricated wait statuses, latency delays,
browser processes, game execution, navigation, input or capture. The independent
watchdog is observably armed before child release and is terminated and waited
after completion. The compiled tiny C input is hash-recorded then removed;
its source and compile command remain recoverable.

Both final controls pass on unchanged custody SHA `5ec810c4...`: ordinary page
handoff completes and the composed driver exits 0; supervisor cancellation at
the pending-creator barrier remains abnormal and drains. Each records **63
owned identities and 63 real terminal waits**, complete=true and actual command
pipe EOF. They do not supply any historical missing wait or prove Chrome's
internal protocol behavior.

An initial scan-progress hypothesis was tested against the old implementation.
The old implementation passed the native page handoff. The first test harness
then failed its proposed old-FAIL assertion. The proposed scan change was
withdrawn in full; `rejected-scan-proposal.patch` retains the small rejected
delta. No old-FAIL/new-PASS repair is claimed. The initial harness also had
counter/schema issues, corrected before the final two controls; their original
logs remain retained.

## Validation and disposition

All 40 `tools.native_kernel_custody_test` tests, the production qualification/CDP
composition test, renderer identity tests, and
`flock /tmp/wine-build.lock bash tools/build.sh` pass. Production diff is empty;
custody remains exactly
`5ec810c4d4704ff86afc367b38f7335edf1214e3450ebb98a62ce3df6386b5fe`,
and the build remains CPU
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
Strict lineage, flags, zero-entry barriers, private qualification channel,
immutable 90-second case, work/ACK caps and 14/16/18 close schedule are unchanged.
SNAPSHOT is never consumption. No Q2, Drakan or provider files were edited.

No box was created: ID/state/expiry/stop receipt are null/NOT_CREATED/null/null.
The already archived WC0615 box was neither resumed nor touched. Git base plus
small run-input/note patches preserve this work without source, module or media
archives. Free `/home` remains above 1.5 GB. Next requires already-retained
request-to-renderer-agent/native-task evidence if available; without it, the
actual cause is unresolved. No further task or retry is scheduled here.
