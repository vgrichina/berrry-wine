# MCM fast live identity validation — 2026-11-07

Evidence: `scratch/runs/20261107-mcm-fast-live-driving/`. Prior evidence in
`20261107-mcm-bound-input` is immutable. This is a continuation of its measured
7.286-second admission / 13.917-second stale refusal, not a driving claim from
that run.

`tools/mcm-bound-input.cjs` now recovers and hashes each immutable CDP WASM
script once per actual Worker/session/target and complete script-inventory
signature. A changed signature forces retrieval; failed, incomplete or ambiguous
inventories refuse. Live process, page object, endpoint, Worker, module object,
instance, document and renderer identities are still read, never cached.
Independent guest and renderer reads and initial module transfers run together.
After them the page, guest instance and owning renderer instance are checked
again, along with session membership, detachment and module inventory. Read
receipts include operation durations, transferred bytes and cache hits.

The existing 12,000 ms freshness limit and screenshot-start timestamp remain.
There are no guest callback, physics, clock, configuration or input-semantic
changes. Native release remains independently timed; UNKNOWN and partial input
remain sticky closures without replay.

Generated real-Chromium controls use the actual capture/admission/hold helper,
real Workers and production renderer physical-state handlers. Trusted Up+Left
advances guest and owning renderer counters wholly inside the balanced hold.
Nine process/endpoint/Worker/module/document/guest-instance/renderer-object/
renderer-instance/renderer-endpoint replacements reject with zero events.
Stale, partial, UNKNOWN, late-ACK and stale-dependent requests close as required;
slow capture cannot re-date pixels and a slow sampler cannot prolong release.
The generated labeled fixture image was personally inspected. Commands:

```
node scratch/runs/20261107-mcm-fast-live-driving/generated-browser.cjs
flock /tmp/wine-build.lock bash tools/build.sh
```

Both pass. A separate real-browser comparison uses generated WASM modules with
2,097,194 bytes apiece. The old chain makes eight module transfers including
collector recovery, capture and admission; the new chain makes four and none
on admission. New admission's complete live validation is 6.684 ms on this quiet
local fixture. Capture-to-dispatch age is 498 ms before, 329 ms after. These are
fixture timings, not an explanation of every millisecond on the previous heavy
box. The initial large-fixture attempts failed before input because renderer
instantiation was not ready; those failures are retained and the readiness
condition was corrected. See `latency-comparison.json` and per-CDP read logs.

Original execution and terminal lifecycle results will be recorded below after
the one authorized fresh-box run. No original has been launched at this code
publication checkpoint.
