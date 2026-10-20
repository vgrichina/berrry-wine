# Census-fixed callback native acceptance — 2026-10-20

**Canonical build PASS; seven real-x86 VM scenarios executed once: four
RichEdit PASS, three WinHelp FAIL. Native acceptance is blocked.**
No source repair, gate bypass, repeat native attempt, or main integration was
performed. This task branch contains only this report.

Tested source: `1d58b6c5497d6315976ca9d506f66c84612681cc`.
Fixture: `2c902c79f362560112ca30d41e4332688046d55a`, with only
`test/test-edit-winhelp-callback-native.js`,
`test/fixtures/edit-winhelp-native/validate.js`, and
`docs/re-notes/edit-winhelp-native-fixture-20261020.md` overlaid.
No JS COM candidate overlay was applied.

The reused `/home/user/callback-native-fullvm` tree initially matched all
6,430 prior source blobs plus three fixture blobs. Only the three-file
reviewed census commit delta was applied. All 6,432 exact candidate Git blobs
and three fixture blobs matched before the build, after the build, and after
all runs. Complete staged manifests are retained. This candidate matched
remote main at the initial verification; later main changes are not qualified
by this run (see `main-final.txt` and the final receipt).

The canonical `bash tools/build.sh` passed all gates, compilation, and data
overlap checks, producing a 1,874,960-byte module:
`a50b56a2dfc26174231cde9492b8ab2fb715eaecad6fd8e9e5b8445b3c88e361`.
The build directory was empty before this build. The older `8f6` module was
not used. Environment: Linux x86-64, Node `v24.18.1`,
V8 `13.6.233.17-node.50`; full versions and uname are retained.
Existing pinned dependencies were reused; package-lock, installed lock hashes,
and the preceding successful `npm ci --ignore-scripts` log are retained.

| Actual VM scenario | Result | Observed acceptance |
| --- | --- | --- |
| edit-ordinary | PASS | Real callback entries, text/result, registers/ESP, second call, 70 successful siblings |
| edit-nested | PASS | Outer and nested restoration, text/result, second call, 70 successful siblings |
| edit-error | PASS | Error 123, zero result/empty text, restoration, 70 successful siblings |
| edit-timeout | PASS | Callback entered and timed out, error 1, restoration, 70 successful siblings |
| help-ordinary | FAIL | Public API result 0 rather than 1; no DLL entry recorded |
| help-nested | FAIL | Public API result 0 rather than 1; no DLL entry recorded |
| help-timeout | FAIL | Public API result 0 rather than 1; no DLL entry or timeout marker recorded |

All seven guest processes exited normally with code 0, no signal or parent
process error. The three WinHelp harness processes exited 1 on the assertion.
Their observations show registration accepted (1), caller completion,
70 sibling attempts but zero successful siblings, and zero DLL entry,
argument, and computed-result fields. Therefore these runs do not qualify
WinHelp callback restoration, nesting, or abandonment. The cause is unresolved;
no failure diagnosis or repair loop was undertaken. Their raw per-case receipt
leaves its case verdict `PENDING` because the assertion threw; its overall
status is `FAIL`. `replay.js` independently reproduces those failures from
saved observations without launching a VM.

The fixture's separate offline validator passed: seven generated scenarios
with 21 disassemblies, seven argument negatives, 14 ABI negatives, 14
missing-evidence negatives, seven synthetic positives, and 84 synthetic oracle
negatives. These checks are retained separately and are not native results.

Execution ran 12:45:18–12:45:48 UTC on sole runtime `bx_6czhvg6m`.
Build wall bound: 600 seconds plus 10-second kill grace. Each native runner
used 120 seconds / 4,000 batches / batch size 1,000, a 150-second fixture
parent bound, and a 170-second outer bound plus 10-second kill grace.
No wall bound fired. Each scenario ran once, including the remaining
independent scenarios after a failure; none was retried.

Self-contained evidence is in
`scratch/runs/20261020-callback-native-census-fixed/`: the actual module,
all seven generated PEs/DLLs/overlays, raw logs and receipts, offline controls,
canonical build log, exact manifests, source delta, oracle source snapshots,
and reproduction commands. The archive and all 176 recovered file hashes
were independently verified; 11 snapshot Git blobs were checked against the
manifests. `python3 verify-evidence.py` checks integrity, and `node replay.js`
rechecks all seven saved observation verdicts without runtime access.
To rebuild, recover the listed source blobs from the exact Git revision
on a build host, overlay the three fixture blobs, install the pinned lock,
then use `execute.sh` with fresh evidence directories. Full source/assets
remain staged remotely; the local bundle contains manifests and the relevant
snapshots, not another full checkout.

All 203 preserved Army/ICM evidence/module/archive hashes matched after
execution. Evidence was recovered and verified before runtime release at
12:47:26 UTC. The box was left running with TTL 15:53 UTC.
No runtime work remains queued by this worker.

Final evidence and sparse checkout occupy under 8 MB; free disk remained
above 2 GiB. A staging mistake briefly created an 81 MB local full-source
archive, violating the 20 MB task cap; it was immediately removed and only
the compact delta was transferred. The disk floor was not crossed.
SSH transfer was denied with 403; permitted Boat execution API transfer was
used instead, without altering permissions.

Existing fixture limits remain: no exhausted-capacity, wrong-token/epoch,
spill/SEH, asynchronous-resumption, slice-64-success, mixed-nesting, or native
Windows comparison. This does not qualify Circus gameplay, JS COM callbacks,
or whole-jump readiness.
