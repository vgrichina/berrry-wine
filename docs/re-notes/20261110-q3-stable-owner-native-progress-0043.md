# Q3 stable capture owner and native progress

Evidence: `scratch/runs/20261110-q3-stable-owner-native-progress-0043/`.
Repair commit: `91c859245`, published immediately on main with strict SSH.

The passive observer now uses the retained bound-input chain's 19 immutable
identity fields when comparing successive images: processId, processObject,
endpoint, endpointObject, workerObject, workerTarget, workerInstance,
moduleObject, moduleSha256, epoch, renderEndpoint, renderEndpointObject,
renderWorkerObject, rendererContext, rendererTarget, rendererEpoch,
rendererModuleSha256, pageRendererObject and canvasObject. Every field must be
present and equal. Execution slice, D3D statistics and physical key states are
telemetry. The observer still retains the full capture identity and exact SHA
for prior-image binding and checks the requested result label. Its live owner
callback and bounded lifetime remain unchanged. Shared providers and Nox are
read-only; no guest calls, hooks or writes were added.

Actual generated-consumer controls accept changing slice telemetry through a
command result and reject changes or missing values for each of the 19 owner
fields, stale image SHA, altered prior telemetry, wrong command labels, owner
death, malformed nested review and inactive observation. Absolute,
pending-relative, locked motion and Enter50ms controls pass. The exact generated
controller reads the same Enter150ms/1000ms command and plain string review
through its actual Session.request and retained publication caller; its emitted
program passes observer binding, admission and native delivery controls offline.
These controlled services do not establish native guest execution.

The pinned demo package's authentic ui.qvm was read in memory before allocation:
SHA `6903548472c2d95898c71c979304e07fbe966e9db2d22db5d9c1ee4f8ddeb88f`.
The key dispatch calls the default menu handler, where Enter13 branches to
instruction 35444. Production renderer input maps Enter to Set-1 scan 0x1c and
builds the Win32 key lParam. These static checks support one selected-item
activation experiment; host dequeue alone cannot establish guest UI consumption.

The locked build, 27 current-closure refusal controls and input service controls
pass. Ordinary offline test-invocation errors (missing test filename and output
arguments) were corrected before allocation; original logs are retained.
Accepted fixture, physical and cancellation evidence is SHA/size verified and
reused without another native fixture or visual rerun. Exact Git and small
patches are retained; no source or media archive was created.

One original was launched. The existing 50-second image wait expired at
00:47:21.9Z and invoked owning native cancellation before returning its failure
at 00:47:24.436Z. No startup image was produced, no native input was issued,
and no game menu, arena, movement or firing is established. The pre-navigation
observer script was installed, but actual game-side arm records are unavailable.
The last native protocol send was Page.navigate at 00:47:11.940Z. Its reply was
still pending when the image wait expired; this does not establish a guest
failure or the cause of the startup delay. No deadline was extended and no
second runtime was attempted. The controller pipe was closed after the image
failure; its EOF is a later cleanup event, not the first cause.

The retained cleanup attempted Browser.close locally after cancellation; the
unchanged native revocation guard refused it before the transport pre-send
boundary. The native transport records contain no later send, input or capture.
Kernel drain is complete, exit -9, with no remaining or unreaped children.
Generated, prelaunch, runtime and local controller parents have actual waits
and separate stdout/stderr EOFs. The local launch transport also needed -9;
its receipt is separate from the remote kernel proof.

All 48 regular artifacts / 45 unique artifacts (456,696 bytes) were independently
retrieved and SHA/size verified; a second settled inventory matched before the
sole delegated normal stop. Box `bx_j3afnurx`, immutable UUID
`50ca015c-9994-464f-965e-79a4c33b6d49`, had initial API expiry
01:10:19.052Z and watchdog deadline 01:10:19.707Z. Final independent API state
is ARCHIVED with expiry null, completed unforced receipt
`stop_a32b16d0d46e1199` at 00:48:18.326Z. The stop helper saw ARCHIVED while
the receipt was briefly pending and asserted; a read-only API reread verified
the completed receipt without another stop call. Watchdog and allocation parent
actual waits are zero with separate EOFs. No owned live box remains; home free
space stayed above 5GB. No nested workers or local Chrome were launched.

Next work, if separately assigned, should investigate startup/navigation latency
from these retained logs before another original attempt. This task stops at
its first concrete live failure and makes no native gameplay success claim.
