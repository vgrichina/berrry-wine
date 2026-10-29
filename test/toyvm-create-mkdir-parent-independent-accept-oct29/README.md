# CREATE/MKDIR parent guard independent acceptance

Candidate: `a09932adab2510eb1bb1367617708a0b459412b8`.
Production source is unchanged by this acceptance task. The five authoritative
current source pins are in `source-pins.json`, copied from the coordinator dispatch.
Historical pins in retained artifacts describe provenance only.

The predecessor `original-contract.py` and `baseline-results.json` are byte-exact
copies, verified against `identity-update.json`. `accept.py` differs from its
predecessor only in the explicit candidate identity. It ran once with `--strict`
against the pinned production backend before the independent suite:

- 4 parent rejections, 8 name collisions, 8 valid creations, 23 supplementary checks;
- 4 retained collision mutants and 4 retained parent mutants rejected.

`independent.py` uses the actual production module and independently encodes
CREATE opcode 35 and MKDIR opcode 9 request bodies. Its 26 checks cover root and
nested directory success, a regular-file parent, a genuinely collected directory
inode, an unknown inode, existing file/directory names, full-budget error ordering,
and successful creation after rejection. Fixtures retain nonempty binary payload
and open handles. It compares every backend instance field except `operations`,
whose single-dispatch increment is checked separately. Four additional removed
or misordered guard mutants are retained under `independent-mutants/`, along with
their first counterexamples in `independent-results.json`.

Both suites passed. This is direct `Backend.handle` acceptance only. ENOENT for a
stale parent is an internal source contract, not demonstrated public kernel
behavior. No mount, kernel, full CLI, browser, game, Boat or Node execution occurred;
mount argv and Node startup checkpoints therefore had no conditional execution.
The caller still pins the old backend. Combined repairs, caller pin update and
full CLI qualification remain gates owned by the coordinator.

Evidence and unchanged resource receipts are retained in `receipts/`; original
absolute operation receipts are under
`/tmp/toyvm-create-mkdir-parent-independent-accept-oct29/e/`.
The `productionUnchanged: false` field in the retained `results.json` describes
the predecessor repair's change relative to its historical baseline; this worker
made no production change.

Recovery commands (from the owned repository, under the same admitted supervisor):

```
python3 /tmp/toyvm-create-mkdir-parent-independent-accept-oct29/ops.py retained-gate python3 -B /tmp/toyvm-create-mkdir-parent-independent-accept-oct29/repo/test/toyvm-create-mkdir-parent-independent-accept-oct29/accept.py --strict
python3 /tmp/toyvm-create-mkdir-parent-independent-accept-oct29/ops.py independent-gate python3 -B /tmp/toyvm-create-mkdir-parent-independent-accept-oct29/repo/test/toyvm-create-mkdir-parent-independent-accept-oct29/independent.py
```

For a deliberate new independent run, remove only generated `independent-mutants/`
first or choose a new owned test directory. Completed groups were not rerun here.
No shared messageboard was written; `coordinator-note.txt` is for coordinator append.
