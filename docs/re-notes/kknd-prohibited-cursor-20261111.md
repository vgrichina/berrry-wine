# KKnD ground cursor gate — 2026-11-11

The stage52 reviewer called the visible red prohibited cursor `valid-ground`.
The retained operator trusted that label and accepted balanced commands53/54.
This is a controller gate defect; no emulator or game defect is established.
The original run remains unchanged, including its correction and raw evidence.

`tools/kknd_review_gate.py` retains the operator interface and adds a check in
`Operator.pair`, before constructing commands or invoking publication. For a
`valid-ground` review it rereads the collected full PNG and raw stage JSON,
checks their size/hash, the reviewed state, current stage, neutral mouse position
and settled hover command, and invokes `tools/kknd_cursor_pixels.cjs`. That
checker requires the native 640x480 white ground cursor's exact opaque white and
black arrow pixels at the current mouse coordinates. The three supported
animation radii (9, 10, 12) come from retained stages55/59/63. Unsupported,
clipped, damaged or ambiguous cursors fail closed. Transparent terrain pixels
are intentionally unconstrained. This is a positive cursor witness, not a
terrain classifier or proof that a route is traversable.

Personal full-frame review and a note remain required. The pixel witness does
not replace judgment about fog, cliffs, water, units or target intent. Menu,
selection and visible-target classifications retain their existing semantics;
this change only admits `valid-ground` orders through the white ground cursor.
Safety checks also remain active with Python optimization enabled.

The reusable `perform(action, args, root, publish_fn, settled_fn)` entry keeps
the nonblocking operator lock through publication, actual settle/collection and
fsynced state replacement. The transport callbacks must retain their existing
durable caller custody, separate stream EOF and actual parent waits. The
settled callback must collect raw stage PNG/JSON under
`root/retrieved/output-fixed/` (plain or `.xz`). A subsequent durable reload
recomputes the cursor witness; no persisted claim can unlock a press by itself.
Both press and independent release are still published as one gesture before
waiting. A refusal leaves the index and durable state unchanged.

For a future controller, import `Operator` and `atomic_publish` from
`tools.kknd_review_gate` in place of the old run-local `review_gate`, or use the
new `perform` entry with the existing transport callbacks. Ensure these tools
and the existing `pngjs` dependency are included in runtime pins. No historic
run helper or pin list was edited, and no new original is authorized here.

Local regression command:

```sh
python3 tools/kknd_review_gate_test.py \
  --retained scratch/runs/20261110-kknd-current-base-target-response-0120 \
  --out scratch/runs/UNIQUE-RUN/outputs
```

Evidence: `scratch/runs/20261111-kknd-prohibited-cursor-proof-0205/`.
The test loads the actual retained old `operate.perform` with inert transport
imports, proves old stage52 acceptance, then proves refusal through that same
caller with the repaired Operator. It also tests the new reusable durable
entry, all three retained white frames, freshness/frame/hover/pixel negatives,
personal review, unchanged menu/selection release, and real subprocess overlap
through the retained durable caller adapter. The outer test and build commands
use its independent prearmed deadline watchdog. No network transport, original,
box, guest construction, deployment or gameplay result is involved.
