# Production input clock fixture restored

The source-only clock-domain regression now executes all its original assertions
and rejects all five original mutations. The failure was a missing fixture
dependency, not evidence of a production timing defect. Production code is
unchanged.

On base main `7baae948766133e5ee19f5b8423af08a33584455`, running
`node test/test-input-consumption-clock-domain.js` first failed with
`ReferenceError: hasFlag is not defined` at extracted initialization line 56,
before clock assertions. This reproduces the prerequisite reported in
[the movement investigation](jedi-movement-duration-20261103.md).

The extracted production region now includes initialization of the optional
`mainSchedulerObserver`. It calls `hasFlag('trace-main-scheduler')`; when that
flag is absent, it needs neither the observer module nor `traceWindowOpen`.
The fixture now extracts the production `hasFlag` declaration, requires its
presence, and evaluates it with an empty CLI argument list before the unchanged
initialization region. The production startup wrappers, guest-clock creation,
host tick assignment and input observer installation remain intact. Nothing
from `function observe` onward changed, including every expectation and mutation.

Validation on Node v24.18.1, with full source hashes and logs retained in
`scratch/runs/20261103-input-clock-fixture-repair/`:

- PASS restored production clock-domain test: startup batch/raw domains,
  release and stale returns, automatic release, rebased/paused batch clock,
  scaled real clock, production host import, enabled/disabled equivalence,
  publication cap and absence of extra guest probes.
- PASS rejection of `raw-state-label`, `remap-history`, `trace-probes-clock`,
  `detached-host-reader` and `drop-last-tick` mutations.
- PASS `node test/test-guest-clock-source.js`.
- PASS `node test/test-startup-clock.js`.
- PASS `node test/test-batch-clock.js`.
- FAIL existing `node test/test-input-consumption-state.js`: fixture lacks
  `mainSchedulerObserver` when the extracted `h.check_input` executes.
- FAIL existing `node test/test-cli-tick-ms-input.js --source-only`: its
  `DispatchMessageA` source marker is absent, before consumption assertions.

The last two controls are unchanged from base main; their failures are retained
as limitations and require separately scoped fixture repairs. They are not
reported as successful input-consumption coverage. The restored clock-domain
test itself exercises the actual trace helper and rejects incorrect tracing.
No guest, browser, game campaign or boat was operated. A full build was not
required: only a test and this note changed, outside the owner's enumerated
`src/`, `lib/`, `host.js`, `tools/`, `ops/` build gate. No compiled-runtime
qualification is claimed.

`source-identity.json`, before/after logs, original test bytes, `RECOVERY.md`,
and `manifest.json` retain the source identity and recovery instructions. Next:
repair the two remaining input fixtures under their own ownership; gameplay
timing conclusions still require timestamped guest consumption evidence.
