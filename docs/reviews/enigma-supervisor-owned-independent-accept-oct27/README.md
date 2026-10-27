# Enigma supervisor independent acceptance: blocked first boundary

Candidate `f7d14e7d965a9671e4ea18da461df85b90affdad`, tree
`884ce1d52de3a6fb4cb7f334c632efd01dc02fb4`, is **not independently accepted**.
The mandatory unchanged reproducer cannot establish its original live owner on
this candidate. This is a test-contract incompatibility, not evidence that the
new supervisor permits competing attachment.

The exact retained `inherited-alternate-listener.py` (SHA-256
`60b7619bb8910d4ab71df9e34e7fe543167fa0c935a0a239a48f59a1124919c2`)
was executed first. Its bytes and assertions were unchanged. Only its imported
`admin` module resolves output paths to this task's ops directory; candidate
imports and executables resolve to the read-only pinned donor.

At line 39 it fails `original actual owner must be live at review`. Its first
legacy controller exits 1 with:

```
existing-guest-attachment-retired: use enigma-supervised-gameplay.py --launch-config for a NEW guest
```

The phase file is absent, raw commands/events are empty, batch remains zero,
and the second controller was never started. Consequently this run proves
neither an original-live unchanged claim nor alternate-listener refusal while
that owner is live. The seven historical unauthorized commands were not replayed.

Inspection of the pinned production entry shows the new CLI launches its child
with `Popen`, retains its handle/start identity and endpoint, then creates a
local one-use `OwnedHandoff` before initializing the controller. The public
legacy constructor/CLI refuses attachment. These are source observations; no
new supervisor CLI behavioral result is claimed. The previous implementation's
28 tests and coordinator verification of 611 evidence payloads/eight pins are
referenced unchanged in `receipt.json`, not rerun or promoted to independent
acceptance.

The unchanged first-boundary constraint allows only import/executable/output
path adaptation. Establishing the original through the new supervisor changes
its behavioral setup and needs a coordinator-approved replacement for that
specific constraint. No production repair was attempted. New CLI positive,
competition, poison/death, distinct-guest challenges remain pending. Main
integration and separately admitted Node/real Enigma gameplay remain gated.

The whole boundary test used one light execution slot under the pinned physical
128 MiB supervisor, CPU 90 s, wall 120 s, file 24 MiB and output 2 MiB limits.
Measured peak RSS was 85,004,288 bytes, CPU 0.453473 s, wall 0.232654 s;
cleanup completed. The unrelated inherited sleeping child was terminated only
by the unchanged reproducer's own cleanup. No test boxes were assigned or
operated. No Node, browser, guest, build, service, or public deployment ran.

Raw outcome, unchanged reproducer, observer, source pins, resource receipts and
checkpoint are retained in `/tmp/enigma-supervisor-owned-independent-accept-oct27/ops`.
The compact raw outcome and reproducer are also committed with this report.
The donor and root tracked files/index/refs were read-only. The owned sparse
clone uses donor object alternates locally; its new report/evidence copies are
counted in the task allocation, and publication backs up the report remotely.
