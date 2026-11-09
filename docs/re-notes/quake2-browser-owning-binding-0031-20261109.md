# Quake II browser owning observation, 2026-11-09

Run: `scratch/runs/20261109-quake2-browser-owning-binding-0031/`.
This is bounded binding integration and focused native-code testing. Actual
guard/onward-door gameplay remains unverified; no full game runtime or box was
started, and SuperTux retained its heavy slot.

`lib/quake2-owning-load-core.js` contains the existing synchronous observer,
shared by the Node adapter and the browser owning Worker. Owned
Uint8Array/DataView copies replace Buffer; diagnostic elapsed time uses the
monotonic host clock. Native boundary, facade invalidation, lifetime and
conservative rejection logic remain the same. The Node adapter still reads
the canonical installed EXE and checks its existing SHA-256. No source,
media or CPU module was repackaged.

The browser Worker loads the core and binding only when
`quake2LoadObservation === true`. Native store observation requires its separate
strict `quake2NativeWriteObservation === true`. Both default off. The browser
page forwards `window.WINE_QUAKE2_LOAD_OBSERVATION` and
`window.WINE_QUAKE2_NATIVE_WRITE_OBSERVATION` through the existing production
GuestThreadHost/WorkerLink slot-zero init. Other slots cannot attach the browser
binding. No new off-mode callback, fetch, hash, range scan or counter runs.

The binding fetches the existing canonical installed `quake2.exe` and
`build/wine-assembly.wasm`, with the Worker's deploy-version URL key and
`cache: no-store`. WebCrypto checks their hard-coded SHA-256 identities before
attachment. The accepted CPU remains
`a320d4c85156644fd12b6134d66b11784f3100b9b135756206c087cdacd43295`,
2185596 bytes; a future CPU change fails closed until deliberately reviewed.
The Worker compiles precisely the verified CPU bytes rather than authenticating
a byte buffer beside an unrelated caller Module. The shared core independently
checks EXE identity, derives original body pins from raw PE sections and checks
actual guest bodies at owning boundaries. Native receipts bind the actual
owning exports and memory, UUID, generation, writing PC and exact ranges.
Snapshot `binding` records canonical CPU SHA/size and EXE size.

The production `readQuake2LoadObservation()` request returns bounded receipts
from that owner. It does not point-sample the Worker's shared memory on the
main thread. Existing trace setup is still required before native acquisition;
enabling flags alone supplies no instruction-coverage assertion. No caller
coverage booleans grant authority. No guest input, clock, ACK/deadline,
callback admission, invocation frame or callback lifetime policy changed.

`tools/quake2-browser-owning-binding.test.cjs` runs real Chromium Workers and
the shipped CPU, using the unchanged PATHHASH-checked native fixture composition.
The original conversion, collision-table startup and later headnode code run;
authored cvar/file I/O, formatter and caller boundaries remain explicit fixture
limits. These are not gameplay observations or replacement observation replies.
Supported native fixtures use the actual browser GuestThreadHost/WorkerLink.
The replacement control uses direct production Worker reinit, whose separate
ready protocol is not a generic Host `_ask(init)` operation.

Five production browser Host startup cases check default off, nonboolean
rejection, native-only, load-only and both flags. Four identity controls check
altered EXE, altered CPU, secondary-slot rejection before attachment, and an
unrelated empty caller Module: enabled mode executes the canonical CPU exports.
Ten browser off/on native pairs cover normal release, same-byte and write-restore
stores in both ranges, raw same-byte/edict ABA, reload, trace gap, reset and owner
replacement. Architecture/lazy flags, declared direct guest regions and sparse
source memory match off mode. Baseline epochs remain 350 models / 34 table;
same-byte gives 351/35 and write-restore 352/36. Raw source stays REVOKED.

The final browser receipt observes all 29 real Worker targets destroyed,
awaits Chromium exit and the prearmed independent deadline watchdog, and closes
the HTTP server. Browser terminate has no exit-code API; target destruction is
the actual observable exit signal. The earlier direct-Worker matrix is retained
as intermediate evidence. The first test invocation had a syntax typo, retained
and corrected before any browser launch. The existing Node production-host six
native pairs also pass against the extracted core. The required locked build
passes, producing the unchanged CPU SHA. Accepted width/page-crossing,
instruction-mode, facade and continuity controls are referenced unchanged in
`accepted-pathhash-01.json.gz`, with original/stored hashes, sizes and gzip CRC.

All-writer coverage, raw shared memory, host/import and bulk/locked or partial
stores, other instances/workers, missed boundaries and edict ABA remain UNKNOWN.
Epochs retain last completion PC rather than full history. Reset/reload/trace
interruption and owner replacement cannot restore validity. Raw source release
remains REVOKED independently of derived model/table storage. Every later-use
record remains rejected and uncertified.

Recovery is Git SHA plus small owned binary patches and existing canonical
media/module paths and hashes. Evidence starts compressed; final inventory
checks stored/original SHA-256 and sizes, independent GNU gzip CRC, nested gzip
CRC where present, and exact regular-file set. No source-tree/media archive,
module copy, peer/old-run deletion, RAM gate or public deployment was used.
The board watcher is stopped and awaited before release. Sampled `/home` free
space remains above 1,500,000,000 bytes. Box NONE / NOT_CREATED, expiry NULL,
stop receipt N/A.

Next: on a separately authorized original browser runtime, after the canonical
local/remote provider barrier and heavy-slot release, enable both strict flags
before slot-zero creation, pause before acquisition/conversion/startup, arm the
existing owning trace boundary, and retain later guard/door-use receipts with
actual writing PCs. Preserve first-UNKNOWN input/ACK limits. Close remaining
writer and edict-lifetime gaps before any guard/onward-door certification.
This single task stops after its own-path commit and authenticated publication.
