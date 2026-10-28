# GLTron publication-order independent acceptance: REJECT

Candidate: `80f02f5f2235560f0705880544f0403dfda906b4`, unchanged.
Production source SHA-256:
`2361e3a5ccbe91f6160156afe2977e97087ea3b75c72f6564f600d44b400928b`.

The original failure is repaired: the exact unchanged production-analyze section
of `test/gltron-original-recovery-independent-accept-oct28.py` now reports
ACCEPT for both closure-failure propagation and no inventory on failed closure.
The original experiment's process exit alone was not used as acceptance.
The exact pinned CLI ran with retained original archive and executable bytes,
copied into owned evidence as required by the unchanged reproducer; neither was
executed or extracted. Unrelated historical experiment sections were omitted.

The new independent test reports seven passing controls and one rejection.
Valid closure succeeds; checksum and malformed PE failures preserve existing
inventory/closure or leave both absent; unresolved imports publish no fresh
inventory. Restoring eager inventory publication is detected and rejected.

The decisive counterexample is failed re-analysis after an existing success:

1. Analyze tiny generation A successfully with `KERNEL32.dll` imports.
2. Preserve the published inventory and closure bytes.
3. Change the 128-byte PE fixture's last byte and update its valid checksum.
4. Analyze generation B with `generation-B-missing.dll` unresolved.
5. Analysis raises `ValueError`, preserves A's inventory, but overwrites A's
   closure with B's unresolved-import result.

Thus the published pair mixes generations following validation failure. The
candidate writes `closure.json` before checking `result['unresolved']`, while
preserving old `inventory.json`. This is a source/static rejection under the
assigned preexisting-closure preservation and mixed-generation acceptance
requirements. The diagnostic output is useful, but should be separate from the
previously published closure, or the success pair must otherwise retain a
consistent generation. No repair is made in this acceptance task.

The new test calls unchanged `analyze` and real listing, checksum, PE and payload
validation. Archive verification and objdump text are isolated with mocks for
tiny fixtures; these checks do not establish real objdump acceptance of those
synthetic PEs. The initial CLI boundary uses the real candidate and tools.

Evidence is retained under
`scratch/usage-watch/gltron-publication-order-independent-accept-oct28/`:
`evidence/first-boundary/decision.json`,
`evidence/first-boundary-source.json`,
`evidence/adversarial/decision.json`,
`evidence/adversarial/before-inventory.json`,
`evidence/adversarial/before-closure.json`, and the failed
`evidence/adversarial/mixed-generation/` fixture and resulting outputs.
Each operation has separate stdout/stderr and command/exit/resource receipts.
The independent adversarial program exits 1 on REJECT.

Reuse the unchanged repair receipt's 26-experiment and original five plus three
focused groups, and coordinator-verified 147 new plus 119 inherited payloads.
These were not rerun or repackaged. The new failure blocks candidate integration.
No main push, runtime, Boat, registration, gameplay or public deployment is
authorized by this result. Root and donor trees remain read-only.
