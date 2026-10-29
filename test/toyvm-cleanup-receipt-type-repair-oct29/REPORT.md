# Cleanup receipt type repair

Task `toyvm-cleanup-receipt-type-repair-oct29`, exact parent
`635633c8bc665451fd5a981108147b1c783e2f8a`. Accepted backend closure
`3898e008861bad6c274506664b2804dbdc7d236a`, flattened supervisor and all
seven dispatch source pins verified before execution. Repaired caller SHA256:
`73c5bd33eb8af3887f5c6f21a8c6354aef591baf2d41589eb673c9d275448b60`.

`filesystem_clean()` now requires an actual list for `remainingMounts` and an
actual integer zero or explicit None for `unmountExit`. Python booleans and
floating-point zero no longer establish cleanup. The adjacent `serverExit`
already requires exact int 0 or -15; `cleanupComplete` already requires singleton
True. These checks remain intact. Missing cleanup, unknown receipts, backend
failure and child failure remain refusals. Diagnostics are retained unchanged.

The backend's actual contract is a list derived from mountinfo, unmount returncode
(int) or None when no unmount was attempted, and server returncode (0 or SIGTERM
-15 for legitimate shutdown). None server exit and other termination statuses do
not establish cleanup. A clean exception's filesystem receipt never establishes
child-tree cleanup. The list check closes acceptance of equality-compatible
non-list shapes without widening the interface.

First behavioral verification ran the unchanged independent `accept_caller.py`
from rejection commit `7da22b4f4727d63f5305ff8ffd362c658a5b41b6` against the
unmodified candidate. Its exact loader/delegation boundary ran before the fake
backend case, intercepted before server creation. The expected assertion failed
(exit 1): both API and CLI incorrectly accepted False unmountExit, CLI exit 0.
Original stdout/stderr: `repair-evidence/original-reproducer.*`.
The five original rejection artifacts are preserved verbatim under
`test/toyvm-complete-objects-caller-acceptance-oct29/`.

After the repair, `accept_caller_rebound.py` passes using identical assertions
and inputs. Its ONLY difference from the original script is the one source
SHA256 literal replaced with the repaired hash; `repair-evidence/rebind.json`
records both script hashes and source hashes. API and actual main/CLI reject the
same malformed evidence and CLI returns 1. This calls the real CLI function with
its argument parser/output/status contract, not a subprocess shell simulation.

`test_cleanup.py` passes 78 focused API/CLI cases: bool, float, NaN,
infinity, string, container, missing and valid cleanup fields; all four legitimate
unmount/server combinations; malformed remainingMounts and cleanupComplete;
exception diagnostics; browser/domain refusal; unknown/failure/resource/output
regressions. Reverting only the unmount type check produces expected exit 1 on
the original False input (`rejecting-mutation-final.*`). Each test intercepts
process creation; no real backend, child, FUSE, mount, game, browser, guest, build,
Boat, download, installer or Node ran. Browser allowance remains UNUSED:
CPU35.353183 / wall101.495550694 / captures1. No test box assigned; coordinator
retains lifecycle ownership. Original tiny child/kernel checks are inherited,
not replayed, and this repair does not establish real-kernel/browser qualification.
Independent acceptance remains required before integration; no main push.

One initial focused-test harness assertion compared an API tuple directly to its
JSON list encoding. That harness failure is retained (`focused-tests.*`); only
report comparison was corrected to compare JSON encodings. Expected cleanup
verdicts and original adversarial assertions were unchanged. The final group also
adds NaN/infinity cases. No resource or platform access denial occurred. Initial Git staging refused new
paths outside the sparse patterns; staging was corrected with explicit --sparse,
without broadening checkout or touching donor configuration. Git also emitted
inherited nested-alternate warnings; required objects resolved successfully.

Recovery: materialize pinned backend closure plus caller in an isolated receiver;
pass the exact retained cancellation receipt (SHA256
543b076948699e1607179782b472f4863125064cdfa3a4632351e8a1f6ed7870).
Run the rebound reproducer and `test_cleanup.py RECEIPT` through the owned
`supervise_repair.py` run helper with mandatory keyword-only cwd. This task's
helper intentionally hardcodes this owned directory and must not be executed
against donor evidence. No predecessor mutable supervisor was run.
The retained guard rejects omitted/root/donor/outside cwd before spawning, verifies
owned sentinel, and checks explicit git -C, toplevel and absolute git dir before
every mutation. Initialization occurred only inside the owned directory. Git DATA
256MiB is subprocess-only; Python soft DATA128MiB (hard ceiling256MiB permits
Git child setup), physical RSS128MiB/process and512MiB/group; CPU90/wall120,
file12MiB/capture2MiB; evidence below1MiB. No Node startup receipt is applicable.

`repair-evidence/baseline.json` records session path, inherited limits and initial
shared WAL; subsequent admissions count only positive growth once. Admissions
retain exact UTC/device/f_bavail/blocksize, aggregate version and full forecast.
The 24MiB allocation includes session/events, staging/Git/publication, evidence
and8MiB reserve; shared four-owner aggregate125829120, unchanged free/RAM floors.
Reservation remains assigned through coordinator closeout. Per-operation checks
passed; no retries/resizes. Trusted Git SSH is exact dispatch configuration;
process-local read-only object stores only. Intended mount argv/files are empty;
there is no mount-parser or mount execution boundary in this offline task.
Root launcher ref digest is reused, not an uncapped root ref listing.
Root/donors/index/refs/media/evidence were read-only. No board append; coordinator
must deliver task-owned publication-note.txt after exact remote verification.
