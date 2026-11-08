# TR2 live arm: shared observation-state queue repair — 2026-11-08

One watched original reached textured Venice through native Graphics default-OK
Enter. Its first observer arm exposed `render worker queue capacity exceeded`.
The demonstrated generic integration defect is repaired and tested with actual
browser guest/render Workers and a passing locked full build. This satisfies
the task's production-repair alternative. No movement or weapon input reached
this original; no second original or replay occurred. Native consequence and
qualified original publication remain open.

Evidence: `scratch/runs/20261108-tr2-live-arm-native-progress/`.

## Exact closure and one original

The original uses published main
`236180009110c9008a2a7f370235b395029d2506`, including live admission fix
`24913adc0`. The cheap closure audit checks 558 tracked inputs byte-for-byte
against that fix; 594 total runtime pins pass before Chrome and after drain.
The driver preflight launches neither Chrome nor the original. Accepted
actualGuest/renderWorker boundary, association/handoff, concurrent-arm,
retirement and nine-process cost evidence from the preceding task is reused;
there is no standalone cost or acceptance run here.

The unchanged production route is
`index.html?debug&threads&app=tomb_raider_2_demo&gl-renderer=webgl&d3d-renderer=webgl`.
Personally reviewed `review/webgl/graphics-fresh.png` shows Hardware 3D
Acceleration, Z Buffer, Full Screen 640×480 High Color and the default OK
outline. Its SHA-256 is
`6c3a2312df34f8e4e3d5cfa638d00366eb2f2f599a947b8c0a821855c38a01f0`.
Native Enter is held for 100 ms with an independent release, unchanged 12000 ms
freshness guard and exact successful ACK. The exact dispatch age is 6762 ms; local review starts at age 6613 ms.

`review/webgl/venice-native-ok.png`, captured 09:28:05.869 UTC, visibly shows Lara
standing in the textured passage under the slope and lattice window. SHA-256:
`cf2350835b65306b8abe81fea538f50a048a86fa28814097af54053bdebcecd8`.
The actual owning render target is `674B7A6CF5E900DF329F91268BE4E1B3`, endpoint
1, legacy/WebGL. Its separately observed owning context is WebGL 2.0 on ANGLE
Intel UHD Graphics 620 / Mesa 23.2.1, 640×480. Ready/error is 1/0, failed is null,
and software draw completions are zero. The identity binding recovers the actual
guest and renderer modules, both SHA-256
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
The full build retains that module hash. These are ownership/readiness facts,
not frame rates.

The single arm request enters the installed completed-step boundary, then fails
at 09:28:15.446 UTC while posting `producerObservation('arm')`. The request uses
the supported maximum of 4096 records, whose shared journal occupies 256 MiB.
The page queue's 32 MiB payload limit counts that full shared allocation as a
command payload. The receiver has the same accounting defect. No Join is
created; its final snapshot is null, so source counts and dispositions on the
original are unobserved, not zero. Chrome exits normally, code 0, at
09:28:15.983 UTC. First-fault transport records and stacks are retained, with
sticky UNKNOWN and no replay. No Up, Space or Control follows the failure.

## Production repair and tests

`lib/render-worker.js` now accounts the two validated shared observation-state
handles by reference. This applies only to an arm with a nonempty bounded owner
scope, 1–4096 records, a 16-byte shared writer epoch and an exactly sized shared
journal. Every other field keeps its normal byte charge. The original message
and buffers are posted unchanged. `lib/d3d-render-worker.js` uses the same
normalization for receiver admission. The existing record/storage bounds,
command credits, packet byte caps and actual dispatch validation remain.
Malformed state gets no exemption. Extra payload aliases and ordinary shared
packets still count their complete payload bytes.

This does not change scheduler admission, writer/ambiguity/source/canonical/
display/lifetime gates, observation ownership, callback handling or guest state.
The callback census records the accounting review and leaves broader ownership
pending.

The strengthened `test/test-d3dim-publication-live-arm-web.js` runs the existing
actual-Worker pending-native-fence fixture with a 4096-record final arm. Against
published `24913adc0` it reproduces the queue-capacity error. That baseline also
records secondary fixture errors because it expects an arm acknowledgement and
Join after rejection; its complete partial report is retained, without inventing
a source disposition. Against repaired production it passes the existing
bounded waiting, no retroactive attachment, replacement/stop, held render ACK
and duplicate-wake controls. Exactly one ordinary continuation produces one raw
source, one qualified exact source/request/canonical/display row and no ledger
discard. The final retired snapshot preserves **raw 1 = qualified 1 + discarded
0**. All four ordinary red-17 pixels pass. Owning Workers retire, heap adoption
is 1, Chrome exits 0, no page errors occur and its PID is absent.

`test/test-render-worker-lifecycle.js` adds focused checks for the supported
maximum and unchanged message identity, command exhaustion, mismatched journal,
extra shared payload alias, ordinary shared buffer/view packets and copied
storage rejection. It passes. The production consumed-version/display
association and direct command-handoff regressions pass. The required
`flock /tmp/wine-build.lock bash tools/build.sh` passes. The browser regressions
use `wine-runtime.lock` and independent 150-second external timeouts. Previously
accepted concurrent-arm/retirement controls and nine-process fixture costs are
reused without another standalone run; no game/simulation FPS inference is made.

## Recovery and shutdown

Git is the source archive: `source-sha.txt`, original empty `relevant.diff`,
`source-audit.json`, `repair.diff` and owned new-file patches identify the source
and run inputs. Media remains at existing paths with size/SHA-256 references.
No source/media archive, old-box resume/delete, public deployment or subworker
is used. Peer WIP, including untracked `lib/wininit-boot.js`, is excluded.
All 183 successful served responses match input pins. Five optional HTTP 404s
are retained. All six retained PNG references pass chunk CRC and inflation.

Fresh UUID-idempotent box **bx_3crxu37g** is identified before runtime. Detached
normal and independent 25-minute watchdog delegates are observable before its
creation. Initial expiry is **09:52:17.068 UTC**. After the first failure, the
controller and Chrome PIDs, HTTP/CDP ports, profile and writer are absent, with
no matching owned process and all 594 input pins unchanged. All **64 remote
artifact references, 56 unique hashes, 7,220,451 referenced bytes** are retrieved
and independently reread for size/SHA-256 before requesting normal shutdown.

Final box state: **archived**, active expiry **null**, stopped
**09:29:54.082 UTC**. Receipt **stop_bfa8d4c6bd8a4ef7** completes
**09:29:54.100 UTC**, forced=false, error=null. Both delegates exit 0 and their
supervisor exits with no children. Local disk remains above 5 GB.

Next is a separately authorized watched original using this repaired full-size
live arm, then separately reviewed bounded movement and documented Space/Control
inputs to visible weapon consequence with exact qualified joins. Full27,
parity, audio, game FPS and simulation FPS remain open.
