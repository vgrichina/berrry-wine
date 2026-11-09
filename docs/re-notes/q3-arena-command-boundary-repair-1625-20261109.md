# Q3 arena command boundary repair, 1625

Evidence: `scratch/runs/20261109-q3-arena-command-boundary-repair-1625/`.
Entire task was offline. No box contact/allocation, browser, Chrome, native
attempt, original replay, workers or agents were launched.

The SHA/size-verified retained1585 command5, first failures, await trace and
screenshot journal establish a 30-second command work failure at
14:52:44.520Z, with screenshot522 submitted at 14:52:31.156Z and no response
before terminal. They do not establish a CDP20s timeout, browser EOF, or the
cause of the stalled screenshot. Movement/firing and historical1475 cause
remain UNKNOWN/unverified. Original artifacts were only read.

The reproducible production defect is narrower: numbered `transport.consume`
rejects its timer race while its losing execute promise remains suspended on
the screenshot. The composed driver previously entered cleanup without its
terminal abort. An offline delayed response then resumes the genuine bound
capture's owner read and publishes pixels after the command has failed.

`q3-native-driver-composition.cjs` now routes numbered-consumer failures through
the existing first-terminal abort before cleanup waits. Pending CDP work and
waits reject immediately; subsequent consumption checks terminal before
entering the retained transport, preserving its original first-failure file.
The active command's existing `workEnd` is also checked before protocol sends,
capture persistence and execute completion, covering responses scheduled
before an overdue timer callback. No screenshot resend or late input is added.

The only selector digest changed in `q3-current-module.cjs` authenticates that
owned composition correction. CPU/media, other provider hashes, work20s plus
requested settle, ACK/cleanup/runtime/CDP caps, screenshot options, native
checkpoint/physical admission, startup, and untimed fixture behavior remain
unchanged. No foreign provider drift was accepted.

Validation passed with observable prearmed independent watchdogs and joined
stdout/stderr waits:

- Seven deterministic cases execute the actual composed command/capture/
  send/receive functions, retained ACK client/numbered transport, native mouse
  helper and bound capture continuation. The baseline reproduces late owner
  work and PNG publication without ACK; the fix aborts pending work and refuses
  late publication/ACK/resend/later input. Overdue screenshot and owner replies,
  timely success, first protocol error and untimed fixture calls are covered.
- The real explicit checkpoint selector authenticates the changed composition
  and refuses corruption/unknown versions. The historical-default selector's
  13 negatives and fixture/control source parity pass in its original context.
- Existing screenshot completion: nine actual composed socket cases pass,
  including the unchanged real20s CDP cap. Complete generated fixture controls
  retain old FAIL/new PASS and ordinary joined quit.
- `flock /tmp/wine-build.lock bash tools/build.sh` passes.

Foreign Redline admission and Q2 observer files changed concurrently. Test-only
read substitution uses their exact published1585 Git bytes, without changing
the files or production acceptance. The historical-default test additionally
uses its original prelaunch bytes. Current unmodified checkpoint validation
still refuses Q2 observer drift; no current native-ready claim is made.
Initial harness failures are retained; corrected fresh runs supply the results.
Git base plus the small relevant binary diff (including owned new files)
provides source recovery; no source/media/module archives were created.

Next: review the foreign-provider closure before any separately authorized
native attempt. This correction does not explain or prove resolution of the
original screenshot stall. Box ID/state: NOT_CREATED; expiry/stop receipt: N/A.
Inherited1585 remains reported ARCHIVED with stop_5169faa2b0691980, uncontacted.
