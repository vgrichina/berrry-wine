# Penguin retained harness contract: independent offline acceptance

Accepted the unchanged retained implementation and focused tests on parent
`d9cabfa58c3c54c9e66b7315c02ec4826fcfaa15`. This publication is confined to
`task/penguin-retained-contract-accept-publication-oct27`; integration is separate.

The exact Python production CLI was the first behavioral boundary tested. Profile
and executable identity mismatch rejected before startup; the positive fixture
used the same executable, flags, explicit environment and inherited limits in both
phases. A startup mutation of the profile prevented the second phase entirely.
Both phases used tiny Python fixtures, with no game or Node execution.

Independent CLI PNG planning accepted exactly 1048576 cumulative serialized bytes
and rejected one additional byte, including prior usage and reserved tail. Bounded
transport checks recovered exact original bytes, rejected missing/truncated/extra
framing, and independently discriminated SHA-256 mismatch and cumulative receiver
overflow. Transport validates byte identity, not visual PNG decoding or gameplay.
The comma-bearing PNG filename was passed as one actual CLI argument.

The original five passing groups are reused with exact source/test/image pins and
retained evidence. Only the final added resource/owned-descendant-cleanup group
was rerun under fresh admission. Wall/RSS/text/image guards and owned-descendant
cleanup passed. The prior final six-group run passed behavior but violated its
admission gate: it remains an incident, explicitly NOT compliant PASS. Historical
two-failure reproductions and the entire prior ops evidence remain attached.

All new execution used light-pool permit1 and the pinned independent subreaping
supervisor (128 MiB physical, CPU90, wall120, file24MiB, output2MiB); results and
limits are adjacent. RSS receipts are measured lower bounds, not continuous peak
proof. Git alone uses permit2, production flock, physical256MiB and DATA512MiB.
Aggregate admission counts remaining future once, retains the physical floor and
2982150144-byte disk floor, and includes current task events/session growth plus
positive shared WAL growth. Old terminal-task prospective reservations are
released; their existing bytes are already reflected in free space.

The original two retained PNGs remain UNSUPPORTED_PLAN together under the API
1MiB cap. Individual hypothetical offline transfers do not reset a real cumulative
ledger or establish a pair transfer. Provider-specific response framing, actual
Node startup/guest same-configuration acceptance, production mounts and gameplay
remain open. A40033 count0-to1 / ammo10-to9 is not identifiable projectile proof.
No original-game replay, Boat, browser, build, service, deployment or main update
was performed. No assigned boxes; the coordinator retains lifecycle ownership.

Reproduction: run `python3 test/test_penguin_capture_independent_acceptance.py`
with PENGUIN_INDEPENDENT_RECEIPTS pointing to an owned evidence directory, under
the task-prescribed pool/supervisor. Run only
`python3 test/test_penguin_capture_contract.py LaunchTests.test_resource_guards_and_owned_descendant_cleanup`
for the remaining original group. The complete older suite requires the two
read-only images at PENGUIN_RETAINED_IMAGES (see source-pins/standing-inputs).
Publication receipts and exact commit/remote ref are retained in the task ops
directory; this evidence package predates commit creation intentionally.
