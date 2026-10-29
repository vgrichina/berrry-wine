# Independent caller acceptance: REJECTED

Exact candidate `635633c8bc665451fd5a981108147b1c783e2f8a`, caller SHA-256
`c6ea49a11917ac62777b4682013ce5bf3d086ab7a0b145c0513ed3478d0f06cb`.
Backend/main base `3898e008861bad6c274506664b2804dbdc7d236a`.

The first new adversarial input changes only the deterministic backend fixture's
`filesystemCleanup.unmountExit` from integer zero to boolean false. Both the actual
`qualify()` API and `main()` CLI return `accepted=true`, `cleanupComplete=true`;
the CLI returns zero. Expected: malformed exit-status evidence fails closed.
Python boolean equality makes `False in (None, 0)` true in `filesystem_clean()`.
The candidate explicitly type-checks server and child exits but omits that check
for the unmount exit. This establishes a malformed-receipt acceptance defect;
it does not claim a real backend emitted that malformed value.

The unchanged earliest-boundary reproducer from pinned `test_caller.py` ran first:
actual main -> exact four-pin loader -> accepted adapter -> intercepted server
creation. Expected adapter/backend argv and quotas matched. No server, mount,
child workload, browser, guest, Boat or build ran. Deterministic backend injection
then verified API and CLI select `synchronous-fuse` and forward the exact command,
work directory and all seven explicit limits. The rejecting oracle exits 1.
`first-counterexample.txt` preserves that first stdout unchanged; the assertion is retained separately in
`first-counterexample-stderr.txt`.
No candidate repair, mutation or subsequent acceptance group ran.

All seven dispatch pins, the flattened immutable supervisor pin and exact retained
cancellation receipt were verified. Reuse the unchanged 25 predecessor checks
from the pinned REPORT.md; they were not replayed. Independent broader challenges
(resource/accounting malformed values, refusal, owned-workdir confinement and
remaining cleanup/quota cases) stop here and remain unaccepted. Existing backend
8+18+13 evidence is inherited, not rerun or newly qualified.

Run after materializing the exact seven pins from `input-pins.json` into their
repository-relative paths in an isolated receiver, plus main's
`test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py`
(SHA-256 `9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85`):

```
python3 -B test/toyvm-complete-objects-caller-acceptance-oct29/accept_caller.py /home/user/wine-assembly/scratch/usage-watch/toyvm-capture-cancellation-qualification-oct28/receipt.json
```

Receipt SHA-256: `543b076948699e1607179782b472f4863125064cdfa3a4632351e8a1f6ed7870`.
Use the fresh resource/containment supervisor retained beside the owned receiver;
no predecessor wrapper is imported. The test intentionally fails on this exact
candidate; preserve the nonzero status. Source closure is retained locally,
while this commit adds only independent tests and evidence.

No main integration or production publication is accepted. Real-kernel and
browser qualification remain open. Browser allowance is unchanged and unused:
CPU 35.353183s, wall 101.495550694s, one capture. No box is assigned.
Root/donor tracked trees, index, refs, stores and evidence are read-only.
The oversized messageboard is untouched; publication-note.txt is for coordinator
delivery. Allocation stays reserved until coordinator closeout.
