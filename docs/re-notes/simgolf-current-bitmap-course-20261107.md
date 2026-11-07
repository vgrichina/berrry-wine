# SimGolf current bitmap course: pre-allocation release blocker

Current-build course rendering, a newly opened hole, and a native career save
remain unverified. The first concrete blocker is the documented browser driver's
lack of independently timed button release. No box, browser, or guest was launched.

Evidence is in `scratch/runs/20261107-simgolf-current-bitmap-course/` (R).
`node R/release-preflight.cjs` exits **2** after exercising the exact click body
read from `tools/web-input-probe.js`. The immediate-acknowledgement control
requests down, a 60 ms hold, then up. With the down acknowledgement pending,
an independent 200 ms observation finds neither a hold timer nor an up request.
Rejecting that acknowledgement also skips up. This is source-body fault injection
with a mocked mouse, not an observed Chromium stall or stuck guest button.
The driver source hash, extracted body, line, and observations are retained.

That documented route cannot yet satisfy the required pre-allocation qualification.
The complete final browser/capture/review path against production guest/render
ownership, exact ACK transport, stale/replaced identity negatives, independent
key release, and immutable browser deadline remains unqualified. No box was
allocated to bypass this requirement; no UNKNOWN operation was replayed.
No emulator mismatch was demonstrated and no production source was changed.

The prior findings remain controlling: SimGolf renders OpenGL into a bitmap;
GDI composes that bitmap into the visible window. A missing window GPU layer or
an idle GL frame counter does not establish failure. This run has no fresh
course pixels, bitmap-owner/provider measurement, or executing module identity.
Local build hashes describe files on disk only. There is no FPS, audio, or parity
claim. The Ocean's Edge championship import is not an architect recovery route
and was not repeated. The empty original AS1.sve alias was not mounted and no
career checkpoint was fabricated.

The local original-file census and hashes are recorded without copying media.
Git SHA plus binary diff and new-file patches provide source recovery; there is
no source/media archive. Evidence validation and publication precede the final
`result.json`. Box ID/state/expiry and runtime custody are not applicable;
there are no guest PIDs, ports, browser profiles, writers, or held native inputs
from this run to retrieve or shut down.

Next: supply independently timed balanced input release and qualify the complete
final staged driver in local production Workers, including capture freshness and
identity negatives. Then allocate the one bounded fresh attempt, use the ordinary
fresh career route, personally review course construction and the playable-hole
indicator, and retrieve any native career save before delegated normal shutdown.
