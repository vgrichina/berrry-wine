Decoder consistency repair (2026-10-30)

Base: `ecedf27af96855328756e94ce4172ea9ae522ae0`.
The unchanged independently rejected reproducer was executed FIRST against
that candidate and exited 1, reproducing reason15/event0 with
`rejectModes=4`, `rejectLatchedMode=0` accepted by the decoder.
Original stdout and script remain under the task root in
`e/unchanged-counterexample.stdout` and `rejected-reproducer/unchanged.cjs`;
the original script is also retained untracked in the owned repo at its
original relative test path. It intentionally asserts contradictory acceptance
and is not a passing regression.

The actual `decodeRejection` implementation is in
`tools/maelstrom-original-errno-adapter.cjs`. The native latch tool supplies
instrumentation, which already records the pre-assignment mode correctly.
One added predicate now requires bit2 of `rejectModes` to equal
`rejectLatchedMode` whenever the six additive mode-switch diagnostics are
present for reason15. This rejects contradictions in either direction.
The null/default legacy path remains unchanged; no WAT was changed.

Focused regression and executable repair-removal control:

```sh
/usr/bin/node --max-old-space-size=192 test/maelstrom-mode-diagnostic-consistency.test.cjs
/usr/bin/node --max-old-space-size=192 test/maelstrom-mode-diagnostic-consistency.test.cjs --remove-repair
```

Executed only through task-owned `ops.py` and `limit_contract.py`.
Regression exits0: exact counterexamples in both directions, six valid
switches across states1/2/3, 24 contradictory mode-bit combinations,
other mode bits preserved, and four actual adapter cases covering both
directions with present or all-six-absent exports.
The removal control exits1 at the first assertion:
`Missing expected exception: reject contradictory UOP bit when latched mode is OFF`.
It loads the actual adapter with only the added condition removed.

The fixture definitions are the exact pinned existing test prefix, with its
completed groups excluded. One minimal module is compiled; its text and Wasm
hashes remain `178a25ccc12a1188ae71bc53fa4e8f8b63724f5b917990b8b1c3e63674bda52a`
and `ec3bcbf1005ca313f3e69eba61e3f60cde25a73c052a17aa2906c412a217f3cb`.
The coordinator-verified predecessor receipt
`/tmp/maelstrom-mode-observability-independent-accept-oct30/completion-receipt.json`
retains prior build/guard/completion groups and the six-field tests. Unaffected
groups are reused without replay; this repair's changed decoder cases are above.

Scope: source decoder and focused minimal generated-Wasm tests only.
This worker does not claim independent acceptance, full production transform,
full build/binary qualification, guest/runtime/gameplay, or main integration.
Original causal instruction: UNKNOWN. No Boat assigned; shutdown owner remains
the coordinator. Strict supplied GitHub SSH trust is preserved for publication.
The canonical task receipt records exact source, test, patch, commit and remote
identities. The coordinator must append the separate messageboard note once.
