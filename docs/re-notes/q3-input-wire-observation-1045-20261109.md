# Q3 actual Input socket observations, 1045

The fresh opt-in `tools/q3-input-wire-observation.cjs` preload instruments the
actual generated Q3 controller source after the existing composition preload
and before the execution-boundary preload. Shared composition, delivery,
physical-reader/trusted-DOM observers and custody code remain unchanged.
`Q3_NATIVE_COMPOSITION=1 Q3_INPUT_WIRE=1` enables it. The fresh run's
`fresh-runtime-input.py` composes this preload order into the retained actual
runtime entry without executing it; future use requires a separately authorized
owning run with fresh pins, destination and lifecycle deadlines.

The observer records actual Input socket send entry, synchronous return/throw,
raw matching replies before pending-map lookup/discard, transport error/close,
and sticky first terminal time. Request ID, method and flattened session ID
correlate observations on Node's monotonic clock. Matching late/duplicate reply
counts remain available after pending rejection; a wrong session is not a
match. Browser service/application timestamps remain UNKNOWN. The actual
browser-style WebSocket API has no send callback: callback failure remains
explicitly UNKNOWN, and a transport error is not attributed to a particular
request or misreported as a callback failure. A send return is not a flush,
browser receipt, successful application, or held-state proof.

This bounded passive observer submits no CDP work and changes no promise
settlement. Input send adds no awaited work or sink write. A bounded buffer
flushes via setImmediate; sink failure and lost-event counts remain sticky even
if a later write succeeds. Observer failures cannot prevent the original send,
terminal rejection or cleanup. It captures no guest input/state. The existing
100ms hold origin, independent UP timer, all caps and terminal admission remain
unchanged. There is no forced pending resolution or postterminal input/capture.

Focused tests run the whole actual generated controller with inert external
socket/browser/page seams. Seven old-missing/new-present pairs cover success,
synchronous send throw, asynchronous transport error, delayed reply, unresolved
DOWN, concurrent independent UP and raw late reply after pending rejection.
The old control is the same current delivery code with observation disabled;
this is an observation correction, not a causal native delivery repair. The
older inert socket omitted flattened response session IDs; the narrow test seam
supplies real-protocol envelopes, while production never fabricates missing IDs.
The additional failing-sink scenario completes input, positive ACK and ordinary
joined cleanup, retaining the first sink failure. Unit checks cover bounded
storage, deferred writes, sticky first terminal, exact thrown-error identity
and late matching. Real Node child waits and separate stdout/stderr EOF pass.
Locked build passes. Unchanged accepted proof is referenced and hash/size/gzip
verified once, without replaying native or broader test sweeps.

Evidence: `scratch/runs/20261109-q3-input-wire-observation-1045/`. Recovery uses
`git-base.txt`, `relevant-source.patch.gz` and `owned-run-inputs.patch.gz`;
`source-recovery.json.gz` records paths and hashes. Logs are gzip. No source
archives, media or module copies were made; home stayed above 1.5GB.

OFFLINE: no box, Chrome, guest, agents, workers or deployment. Box ID/state/
expiry/stop receipt NOT_CREATED. No lifecycle action on prior boxes. Redline1035
then Q21040 retain runtime priority. Next is separately authorized fresh pins
and whole actual native fixture plus actual owning-caller Boat cancellation
proof before gameplay. Native REVOKED; allwriters/edictABA UNKNOWN; actual Boat
cancellation NOT_PROVEN. SingleTaskSTOP.
