# Invisible War chain integration on current main — 2026-10-15

Source integration only; merge and combined-build validation remain held.

This task branch starts at main `88cb3c77973aee82b55255fce1a13f4339cc2298`.
It applies the selected diff from held base
`eb26d3a567d0a71ba6c1672afbebd82836d36d65` to
`4a65118df097b7a9f9244bde186862a70d56c9ae`, excluding
`tools/iw-native-validation.py`. Historical documents retain their original
commands and claims; that omitted Python controller can be recovered from its
historical commit, but is not a supported current integration runner.

The three-way application had no textual conflicts. The integrated
`lib/thread-manager.js` retains main's guarded cooperative crash diagnostics
and the held chain's send scheduling, callback ownership, loader publication,
and exact receiver retirement. Relative to the held thread manager, the only
difference is the current-main crash diagnostic block. Other unrelated main
changes remain intact. Scalar cross-process messages remain the supported
scope; pointer marshalling and original Invisible War execution are not proven.

Two historical native test filenames are explicitly assigned to the E2E tier
in `tools/test-tiers.js`: receiver-retirement-native and scoped-dll-native.
They require an admitted module and are inappropriate for default unit runs.

Local verification completed in a 6.9 MB explicit non-cone sparse checkout:
- Syntax checks for all selected JavaScript and whitespace checks.
- Main's actual cooperative crash diagnostic regression, including throwing
  exports and logging sinks.
- Full process-send-admission tiny-module actual Worker suite: deferred receiver
  exit, trap, replacement, raw process exit/error, sender retirement, nested
  sends, independent scheduling, and exact ownership.
- Process broker; thread send frame ownership; scoped loader and scoped yields;
  wait identity and reservation; scoped DLL lifecycle.
- Actual Worker admission cycle reproduction (`--admission`).

No full WAT/WASM build, native full-module test, remote command, browser,
original IW run, main merge, or deployment was performed for this integration.
The prior receiver-retirement evidence is
`scratch/runs/20261015-iw-receiver-native/attempt1-reviewed`, archived with SHA-256
`5fa94ff85bd3e54d362d2939e8c26c639ee29bf21d62a6b2429a0e6aad5588f5`.
It tested candidate 66 / old f859 / restored under canonical a948. It does not
prove the combined current-main build.

Before merge, a separately reviewed bounded JavaScript controller must stage
the complete tracked build closure and dependencies in an isolated remote
checkout, pin physical source bytes, run the full build, record the produced
module hash, and run combined native conformance. The existing historical
native controllers deliberately pin older sources and a948; they must not be
relabeled as current-build proof. Updating the native fixtures for an explicit
expected combined module hash and running admission, scoped loader, receiver
retirement and cross-process native routes remains pending. Root owns the sole
remote lane, its grant, TODO/STATUS, and any integration decision.

Selected held paths:
- `docs/iw-admission-native-20261015.md`
- `docs/iw-current-lifecycle-port-20261015.md`
- `docs/iw-independent-send-admission-20261015.md`
- `docs/iw-native-scoped-endpoints-20261015.md`
- `docs/iw-native-source-audit-20261015.json`
- `docs/iw-native-validation-20261015.md`
- `docs/iw-receiver-retirement-native-20261015.md`
- `docs/iw-retirement-native-validation-20261015.md`
- `docs/iw-retirement-slot-fix-20261015.md`
- `docs/iw-scoped-callback-yields-20261015.md`
- `docs/iw-scoped-lifecycle-20261015.md`
- `docs/iw-send-cycle-regression-20261015.md`
- `docs/iw-send-frame-ownership-20261015.md`
- `docs/iw-send-wait-ownership-20261015.md`
- `docs/iw-send-wait-reservation-20261015.md`
- `docs/iw-send-wait-retirement-20261015.md`
- `docs/re-notes/deus-ex-invisible-war-demo.md`
- `host.js`
- `index.html`
- `lib/dll-loader.js`
- `lib/guest-thread-host.js`
- `lib/guest-worker.js`
- `lib/host-window.js`
- `lib/process-boot.js`
- `lib/process-send-broker.js`
- `lib/thread-manager.js`
- `lib/thread-send-waits.js`
- `src/09a5-handlers-window.wat`
- `test/run.js`
- `test/test-admission-native-candidate.js`
- `test/test-cross-thread-send.js`
- `test/test-dll-same-module-concurrent.js`
- `test/test-dll-worker-message-lifecycle.js`
- `test/test-process-send-admission.js`
- `test/test-process-send-broker.js`
- `test/test-process-send-runtime.js`
- `test/test-receiver-retirement-native.js`
- `test/test-retirement-native-candidate.js`
- `test/test-scoped-dll-endpoints-candidate.js`
- `test/test-scoped-dll-lifecycle.js`
- `test/test-scoped-dll-native.js`
- `test/test-thread-send-frame-ownership.js`
- `test/test-thread-send-scoped-loader.js`
- `test/test-thread-send-scoped-yields.js`
- `test/test-thread-send-wait-identity.js`
- `test/test-thread-send-wait-reservation.js`
- `test/test-worker-thread-scheduler.js`
- `tools/repro-process-send-cycle.js`
- `tools/repro-thread-send-wait-ownership.js`
- `tools/repro-thread-send-wait-retirement.js`
- `tools/run-admission-native-candidate.js`
- `tools/run-receiver-retirement-native.js`
- `tools/run-retirement-native-candidate.js`
