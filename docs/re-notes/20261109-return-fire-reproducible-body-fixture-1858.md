# Reproducible Return Fire body-driver composition test

`test/test-return-fire-body-driver.js` now reads a small tracked legacy-entry
contract fixture instead of deleted ignored Nov 5 drivers, ledgers, helper
modules and event transcripts. The historical sealed driver/hash and its runtime
first failure are not recreated or relabeled. The new fixture has its own fixed
SHA-256 and executes every amendment in the unchanged production
`tools/return-fire-body-driver.cjs` composition helper, including recursive paused
Worker attachment, response collection, receipt draining and close/finalization.

The support fixture derives system-data pins from the production
`SYSTEM_DATA_FILES` declaration. Real local HTTP serves tracked TLB/font/index
bytes; the actual host `_prefetchBundled` and `fetchAssetBytes` methods perform
the bundle-404/five-font fallback. A small tracked entry payload replaces ignored
game art for the three simultaneous page/Worker/nested-Worker body receipts.
Readiness and transport events are explicitly mock inputs, not gameplay or audio
evidence. No gameplay provider, transport policy or production generator changed.

All 33 existing cases and their failure-boundary assertions are retained:
hash/size and missing/wrong pins, rejected/unresolved/cancelled/detached bodies,
method/redirect/query/status rejection, missing coverage and font fallback,
nested ownership, worker Network capability fallback and optional-script
cancellation identity. First failure must exist before close and agree with
terminal/result artifacts. The suite also explicitly rejects a non-mock entry;
public and native spawn prohibitions are independently exercised with zero
browser launches. The fixed fixture hash still rejects altered source before
composition. An empty receipt set cannot report successful completion.

Validation passed: 33 composed-entry cases (`composition-final-2/summary.json`),
129 collector lifecycle cases, and the locked build. Earlier offline development
failures are retained: paused-worker metadata, fallback/empty-set completion and
an amendment anchor were corrected in the new fixture without relaxing any
existing assertion or changing the production helper.

Recovery: from the recorded Git commit, install the repository's normal Node
dependencies and run `node --test test/test-return-fire-body-driver.js` and
`node --test test/test-browser-response-body-collector.js`. No historical run,
original game corpus or build output is required by these composition tests.
`RF_BODY_TEST_RUN` may select a fresh absolute directory under `scratch/runs/`;
otherwise the suite creates one. Run `flock /tmp/wine-build.lock bash tools/build.sh`
for the required build gate.

Evidence: `scratch/runs/20261109-return-fire-reproducible-body-fixture-1858/`,
including exact base Git SHA, relevant binary patch, development failures,
final composition summary and logs, collector log and locked-build log. Source
recovery uses Git plus the small patch; no source/media archives were created.
This was offline development only: no box, watchdog, browser or nested worker
process was created. Box ID/state/expiry/stop receipt: NOT_CREATED / NOT_CREATED /
N/A / N/A. No stop is required. Next gameplay work remains separately assigned.
