# CREATE/MKDIR parent validation repair

Candidate: `2eddbe90d36681421949873d1b29ff65045fcf39`.

The shared `Backend.create` helper now returns ENOENT for an absent parent and
ENOTDIR for a non-directory parent before collision lookup, allocation, inode
consumption, namespace insertion, or CREATE open-handle accounting. Name
validation retains its previous precedence. Only this helper changes in production.

Acceptance executes the pinned production backend through `Backend.handle`,
without a mount, kernel requests, browser, guest, Boat, or gameplay. Absent/stale
node ENOENT is an explicit proposed internal robustness contract, not a proven
public kernel requirement. The caller or kernel may prevent these requests.

`original-contract.py` is byte-exact from the predecessor task. Its `--strict`
path fails if any original parent case fails; `accept.py` requires this mode and
runs every original behavior assertion unchanged. `identity-update.json` records
the explicit backend identity update, original five dispatch pins, and retained
artifact hashes. Historical candidate fields in the copied baseline are provenance
only. The original baseline records four parent failures and passing controls;
it was retained rather than replayed.

Verified once after repair:

- Four original parent reproductions pass with unchanged errno/state assertions.
- Eight collision rejections and eight successful creations pass.
- Four collision mutations and four parent mutations are rejected. Parent mutations
  omit missing-parent/directory validation or move validation after side effects.
- Twenty-three supplementary controls pass: invalid names, full-budget rejection
  precedence, populated namespace/payload/open-handle preservation, accepted
  UNLINK/RMDIR guards, and delayed collection of an unlinked open payload.

Run from the owned repository with the unchanged task supervisor and resource
controls:

```
python3 /tmp/toyvm-create-mkdir-parent-guard-repair-oct29/ops.py acceptance python3 -B /tmp/toyvm-create-mkdir-parent-guard-repair-oct29/repo/test/toyvm-create-mkdir-parent-guard-repair-oct29/accept.py --strict
```

`results.json` records the strict outcome and mutation hashes. Collision mutants
are recreated by the retained contract and deleted after successful acceptance;
parent mutants run in memory. Evidence includes the actual admission/limit and
startup receipts. No Node execution was needed. No resource limit was increased.

Remaining gate: combined repairs, caller backend pin update (caller still pins the
old backend), and full CLI qualification. No combined integration or caller change
is included. No main update or public deployment is included. No box was assigned;
runtime lifecycle ownership remains with the coordinator.
