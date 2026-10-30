Independent acceptance: REJECTED

Exact candidate: `ecedf27af96855328756e94ce4172ea9ae522ae0`.
Repair base: `898d2ec8d9db7d4f9236d9eb705adfd431ea19c9`.
Pinned underlying UOP source: `55f9724ef127100c3bb54aebca73e5cda5472c5f`
(candidate engine SHA256 `cda6aabb3efd8e8f123887315c71747566c166721564e6a01e090224a6cf5fb3`).

The unchanged production decoder accepts contradictory rejection diagnostics:

```js
native.status = 5;
native.event = 0;
diagnostic.rejectReason = 15;
diagnostic.rejectModes = 4; // pre-assignment UOP mode is ON
modeSwitch.rejectRequestedMode = 1;
modeSwitch.rejectLatchedMode = 0; // pre-assignment UOP mode is OFF
modeSwitch.rejectStatus = 1;
```

The reproducer supplies all other fields from the actual generated fixture.
`decodeRejection` returns a rejection object with `modeBits: 4` and
`modeSwitch.latchedMode: 0`; it should reject inconsistent diagnostics.
The candidate decoder checks each mode's range, their difference, and the
status/event relation, but does not check the UOP bit against the latched mode.

Why these values contradict: start latches the current UOP mode. During an
active latch, the first setter request differing from that mode rejects before
assignment. Equal-mode setters preserve it. Thus at this first reason15
boundary the live pre-assignment UOP bit and the latched mode must agree.
The test also moves the real instrumentation call after the setter assignment.
That executable mutant produces the same contradictory UOP bit and fails the
independent pre-assignment oracle. The exact candidate passes that oracle.
No source repair was attempted.

New executable checks:

- Raw INT_MIN request normalizes to ON, captures all six boundary fields, and
  records the pre-assignment UOP bit while preserving the setter's result.
- A hook-after-assignment mutant fails that distinguishing oracle.
- A legacy instance with all six additive exports removed still persists a
  reason15 rejection through the actual adapter.
- A single changed `rejectModes` bit produces the concrete decoder rejection
  counterexample above. The check exits 1 to signal acceptance rejection.

Command, run only through the assigned supervisor:

```sh
/usr/bin/python3 -B /tmp/maelstrom-mode-observability-independent-accept-oct30/ops.py independent-delta /usr/bin/node --max-old-space-size=192 test/maelstrom-mode-observability-independent-accept.cjs
```

Retained output: `../e/independent-delta.stdout` and `.json` relative to the
owned repository. It records the complete contradictory inputs and actual
decoded result. Node startup succeeded with unlimited DATA/AS, CPU60, wall90,
file12MiB, physical groupRSS512MiB/parentRSS128MiB and heap flag192MiB.
Compiler files were recovered only from candidate blobs and checked against
the supplied compiler byte/SHA256/blob pins before loading.

Reuse, without rerunning completed groups: the predecessor's
`/tmp/maelstrom-mode-rejection-observability-repair-oct29/acceptance-checkpoint.json`
binds six groups/14 modules, both switch directions, active states1/2/3,
first-rejection immutability, inactive/unchanged setters, six omitted/misrecorded
field controls, missing-hook control, partial diagnostics and legacy decoding.
The independent fixture builder is the exact pinned predecessor test prefix;
its test groups are not executed. Its boundary, text and Wasm hashes match the
retained checkpoint. Existing guard and completion regression receipts are
reused unchanged. Those passes do not cover the missing consistency check.

Scope: two new minimal generated-Wasm modules plus the actual JS decoder and
adapter. This does not qualify the complete production transform, full binary,
initializers, original-game runtime or gameplay. Original causal instruction:
UNKNOWN. No Boat was assigned; shutdown remains coordinator-owned.

Acceptance rejection stops publication under the supplied checkpoint. Only
the scoped reproducer and report are committed locally; no push, main edit,
merge or deploy is performed. Coordinator must append the separate
`messageboard-note.txt` once; the standing board exceeds the worker file cap.
Repair the demonstrated diagnostic consistency gap, independently accept the
changed decoder, then obtain separate authorized full-build/runtime evidence.
