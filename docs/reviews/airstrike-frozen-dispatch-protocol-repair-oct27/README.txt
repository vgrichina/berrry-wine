Airstrike frozen dispatch protocol repair (source/test only)

The production runner returns a queue receipt for frozen input. The bridge now
retains that original ACK, requests exactly one serial batch, verifies its
matching step ACK (ran=steps=1 and next batch), and requests a matching frozen
snapshot with zero credits. Actual input evidence comes from the runner stdout
slice starting at dispatch. The controller separately validates this completion
envelope before releasing a key or sending another input. No ACK or input log is
fabricated. No thaw, uncertain replay, runtime, main update or deployment occurs.

The first behavioral gate was the unchanged frozen-boundary.cjs reproducer from
the preceding failed acceptance, against the complete exact pinned source file.
The repaired fixture extracts parser, control handlers, snapshot/step bookkeeping
and key dispatch branches unchanged from that source, with byte/hash receipts.
Its renderer, scheduler and image bytes are explicitly fake: these tests establish
protocol behavior, not Airstrike gameplay or actual guest input delivery.

Passing groups: production-corrected (7), controller-queue-regress (6),
bridge-regress (12), plus unchanged baseline-production. The bridge suite keeps
the external image review handoff, delayed review, stale image/focus rejection,
distinct spawn diagnostics, terminal checks and owned cleanup covered.
Historical first failures remain in this directory and result.json.

Reproduce from the task tree, with your admitted supervisor and execution pool:
AIRSTRIKE_PRODUCTION_RUNNER=<this-directory>/production-runner.js
AIRSTRIKE_PROTOCOL_EVIDENCE=<new-empty-evidence-directory>
python3 -B test/test-airstrike-frozen-dispatch.py -v
python3 -B test/test-airstrike-menu-controller.py -v
python3 -B test/test-airstrike-observation-bridge.py -v
The protocol fixture uses /usr/bin/node --max-old-space-size=32. The test records
an exact environment/limits startup receipt before Node acceptance. Task commands
were supervised at physical128MiB, CPU90, wall120, file24MiB, output2MiB; Git
alone used DATA512MiB and physical256MiB under two permits plus the flock.
The bridge shortens its child file limit to4MiB; Node DATA/AS remain unlimited.

Accepted base565cead contains the controller but not the bridge/test paths.
Those two accepted files were materialized from the explicitly supplied immutable
donor with verified hashes, then repaired/retained here. The isolated sparse repo
uses that donor object store read-only; there was no full checkout/fetch/repack.
Root refs were not touched; the launch digest is reused without claiming a later
comparison. The initial policy-display incident exceeded the8192B operation gate;
its original events remain authoritative. Later output was bounded.

A guest exiting before the requested step completes is deliberately rejected,
even if some terminal output appears. Ordinary Quit/gameplay remains unqualified.
Publication identity is recorded after push in the append-only root messageboard
and task ops/publication.json, avoiding a self-referential commit hash.
