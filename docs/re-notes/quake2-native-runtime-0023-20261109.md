# Quake II owning runtime observation forwarding, 2026-11-09

The production `GuestThreadHost` silently dropped both existing NodeWorker
observation options. This task reproduced and repaired that runtime integration
defect. Guard/onward-door gameplay remains unverified. Evidence is in
`scratch/runs/20261109-quake2-native-runtime-0023/`.

Before the change, an actual `GuestThreadHost.start()` with
`quake2LoadObservation: true` and `quake2NativeWriteObservation: true` started
its real owning NodeWorker, but querying that Worker returned `observation:
null`. The failing assertion and exit are retained in
`runtime-startup-before.log.gz`. Earlier direct NodeWorker tests bypassed the
host/link constructors and therefore could not detect this missing forwarding.

`lib/guest-thread-host.js` now carries each strict, separate, default-off option
through the host, slot-zero WorkerLink and existing init message. Secondary
guest threads do not inherit them. `readQuake2LoadObservation()` on the host
and link uses the existing sequenced owning-Worker request and returns its
retained observation/retired-observation response. It neither samples guest
memory on the main thread nor changes observation semantics, input, clocks,
ACK limits, callback lifetime, shutdown policy or request deadlines.

The new focused test exercises that production path with the shipped module
SHA-256 `a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`.
It checks default-off, strict boolean opt-in, load-only and native-only options.
Six off/on pairs reuse the exact hash-pinned accepted native fixture composition,
substituting the production host transport for direct NodeWorker construction.
Original conversion, collision-table startup and later headnode execution retain
their instance UUID, PCs, ranges and epochs. Baseline epochs are 350/34;
same-byte model/table stores yield 351/35 respectively, and write-restore yields
352/36. Architecture, lazy flags, all declared direct guest regions and sparse
source bytes match off mode. Trace-gap invalidation remains sticky. Every
fixture Worker exit is observed and awaited through production host stop;
the actual Node termination event code is 1, not an invented successful exit.

The first full harness included a reinit command sent through generic `_ask`.
Worker readiness uses a separate reply path, so that unsupported harness request
timed out. Its failure is retained in `runtime-focused-01.json.gz`; the final
six-pair matrix exercises supported host operations. Earlier intermediate
`runtime-focused-02.json.gz` recorded synthetic termination return zero; the
final test replaces that with the actual Worker exit event, and only
`runtime-focused-final.json.gz` is final lifecycle acceptance. Existing direct
replacement/retirement controls remain referenced by PATHHASH, not relabeled
as coverage from this host test.

The first locked build correctly rejected the changed host-file ownership pin.
After reviewing the small forwarding/query diff, the census records that review
and the exact new hash. The required locked build passes. Prior CPU-width,
native-store, continuity, facade and instruction-mode controls are reused by
stored/original size and SHA references in `accepted-pathhash-01.json.gz`.

Other writers, raw shared memory, bulk/locked stores, other CPU instances and
edict ABA remain UNKNOWN. Released raw source remains REVOKED. No identity or
all-writer certificate is issued. The observer is still Node-only: the original
browser gameplay driver cannot enable it merely by passing these flags. A
browser-compatible owning binding and actual original gameplay remain future
work, with a full canonical local/remote provider barrier before launch.

This task takes the explicitly allowed reproduced/repaired/tested/published
runtime-defect outcome; it does not call a dependency wait completion. Q3's
archived/drained release was observed, but SuperTux0016 had not released, and
no heavy original, browser or box was allocated. Box NONE, state NOT_CREATED,
expiry NULL, stop receipt N/A. No peer box was accessed. There was no native
game input, replay, death reset, unchanged runtime retry, local heavy runtime,
public deployment, agent, media/source archive or repeated module copy.
Historical supervisor143 and untraced/nonleader UNKNOWN remain unchanged.

Recovery uses the exact Git SHA plus small owned patches, existing media/module
paths and hashes, and gzip evidence written from its first stored byte. Final
inventory checks every regular file's stored/original SHA and size, independent
GNU gzip CRC and exact set. The board watcher is stopped and awaited before
release. Sampled `/home` free bytes exceed 1,500,000,000; no RAM gate or
peer/old-run deletion was used. Single task STOP after publication.
