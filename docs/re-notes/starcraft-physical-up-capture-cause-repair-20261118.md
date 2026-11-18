# StarCraft physical UP / capture causal limit (2026-11-18)

Evidence: `scratch/runs/20261118-starcraft-physical-up-capture-cause-repair/`.

The historical original remains permanently closed. Its Move DOWN consumed and
independent UP acknowledged, but the snapshot that failed the physical-UP and
zero-capture conjunction was never saved. Neither conjunct can be attributed
from that receipt. No historical endpoint was contacted and no replay occurred.

The controller now saves the exact received snapshot on a release refusal,
with separate physical-UP and zero-capture predicates, before the existing
sticky terminal catch. This is local diagnostic persistence: it issues no
request, releases no capture, and preserves all input/review/deadline guards.
Pre-intention live/reviewed snapshots receive the same diagnostic treatment.
This change does **not** repair a demonstrated StarCraft input defect.

Compiled native authored USER fixtures exercise the published current public
`guarded-bind`, `guarded-input`, `guarded-release`, `guarded-status`, snapshot
and PNG route. Their guest wndproc calls actual SetCapture on mouse DOWN and
ordinary ReleaseCapture on mouse UP. Ctrl-click, box with endpoint UP, separate
Attack/target and Move/target all completed with physical UP and zero capture.
Lost ACK after actual native consumption still produced independent UP ACK,
sticky terminal closure and local rejection of a later capture. All these
operations retain the five-second gameplay review, finite 400 ms test pulse,
1,750 ms prearmed fallback and two-second release bounds. Fixture review
metadata is synthetic and does not establish a human original-game workflow.

A second authored guest intentionally omits ReleaseCapture. Its actual held
snapshot shows physicalUp false and capture `0x10001`. After independent release
ACK, the received refusal snapshot shows physicalUp true and capture `0x10001`.
The capture owner is a live generation-1 window belonging to guest thread 1.
The diagnostic identifies only `captureReleased` as false; subsequent capture
and lease attempts are rejected without endpoint calls. This distinguishes
held physical input from genuine guest capture ownership. Deliberately retained
capture is **not** evidence that StarCraft retained capture, that a stale owner
existed, or that the renderer/runtime is defective.

The normal capture lifecycle did not reproduce the original failure. The
remaining unknown is whether that original had held key/button state, live
guest capture, stale capture, or a transient state before guest UP processing.
Without its lost snapshot, these possibilities cannot be resolved within this
closed scope. No causal old-fail/new-pass repair is claimed. Therefore the
conditional authorization for a fresh original was not exercised: enemy
consequence and ordinary Quit remain unproved. No new original, box, worker,
media copy, Wine run or runtime change was made. All authored native scopes
were cancelled through their own finite supervisors and actually waited;
their independent watchdogs exited for actual native waits, with no leaks.

The run records exact Git/relevant patches, module and media hashes, selected
whole PNGs, actual native/release/watchdog waits, and the initial test setup
error (duplicate append-only review file, corrected before final tests).
Final test/build/publication and cleanup receipts are in `result.json`.
