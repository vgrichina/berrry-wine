# D3D9 worker reset and late-result investigation (2026-11-13)

Scoped result: no new defect demonstrated in old-generation result/fault delivery
after worker endpoint retirement and device recreation. No production source or
permanent tests changed. There is no failing-before reproducer or crash fix from
this investigation. Evidence: `scratch/runs/20261113-d3d-reset-1155/`.

Read published `62b4e82664c4f9844a03e8e53ffbf6612b3fa064`: accepted legacy
Flip ownership now survives collection/writeback exceptions until successful
writeback, with PBO unbinding in finally. Its native16/32-bit regression cases
were not duplicated here.

## Paths checked

- `lib/d3d9-host.js`: healthy Reset submits an ordered RESOURCE_UPDATE; it does
  not advance the queue generation or erase a poisoned stream. Failed-device
  release retires its shared endpoint, or the entire legacy worker. Recreation
  uses a new entry/queue and increments the per-device generation. Parked result
  records check their captured generation and entry lifetime before finalizing;
  release waits for earlier parked continuations to be consumed.
- `lib/d3d-command-stream.js`: WorkerConsumer matches results by
  device/generation/sequence. Queue cancellation wakes failed fences immediately
  but retains executor-owned storage until retirement acknowledgement. Retired
  entry guards prevent a late completion from retiring it twice after reset.
  Receiver generation rollover refuses pending work; failed-stream follow-on
  commands report consumed/failed without escaping into worker shutdown.
- `lib/d3d9-render-worker.js` and `lib/d3d-render-worker.js`: live native devices
  retain their generation; shared commands and teardown run through one message
  chain, including cooperative software completion, before scratch reset.
- `lib/render-worker.js`: endpoint IDs increase within a Manager; events for a
  removed/closed endpoint cannot reach its replacement. Process-level faults
  remain process-level failures; this investigation did not suppress them.

## Validation

All existing requested checks passed:

- `node test/test-d3d9-worker-reset-recovery.js` exercises both shipped modules,
  shared and legacy production Worker topologies, healthy Reset, a real native
  refused draw, strict failed Reset, release/recreation, peer rendering, pixel
  oracles, empty transport queues and native heap handoff.
- `node test/test-d3d9-worker-survives-draw-failure.js`.
- `node test/test-d3d9-worker-alive-after-refused-draw.js`.
- `node test/test-d3d-neutral-command-stream.js` includes pending fence failure,
  reset refusal before retirement, cancellation acknowledgement, and late old
  completion after reset with no duplicate lease release.

The run-only `late-delivery-probe.js` preloads instrumentation into the unchanged
production-worker reset-recovery test. It captures real generation-1 result
messages and replays them into the replacement consumer while generation-2
commands are pending. For each shipped module's shared topology, 110 replays
were ignored, including 10 whose sequence also matched the current command.
The replay set includes the real native failure result; the same-sequence
subset consists of earlier successful command phases. It also injects 10
endpoint-error envelopes using that real failure text but the retired endpoint
ID. These envelopes model delayed delivery; they are not additional spontaneous
native faults. No replay changed pending-map size or stopped the replacement
consumer/Manager. The unchanged test then verified new native pixels, peer
pixels, queue drainage and heap reclamation. This supplements the existing
test without committing another copy of its fixture or assertions.

The locked build result and exact tested source/module hashes are retained in
the run. Git SHA plus relevant binary diff and a patch for this new note provide
source provenance; no source archives were created.

## Limits and next work

These are controlled software-worker fixtures, not browser WebGL hardware or
27-app gameplay acceptance. Free disk was below the actual 1.5 GB floor; no
original game or box was launched. Box ID/state: NONE / NOT_CREATED; expiry and
stop receipt: not applicable. No agents or Codex workers were spawned.

Retain the current guards. A concrete browser/driver fault trace or a failing
production-worker schedule is needed before changing this lifecycle. Original
game rendering remains unproven by these fixtures.
