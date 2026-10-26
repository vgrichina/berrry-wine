# Enigma reconciled candidate canonical build qualification

BUILD_AND_STATIC_PASS at 2026-10-26T23:49:07.487360+00:00. Exact independently accepted candidate
425755ee5ee9be0734c7aca187521100f5487674, accepted source tree
fb1ef0832eb9e0229cd272c67b8465c4fcbf4396, base main
ddaff339bd7e1b10b2579a7ab7aed71d86d8edcd. Source acceptance
facebcb2e6d04b84e80211a7814654e528566b0f is reused; no repeated acceptance,
295-mapping oracle or rejecting challenges. This is not a whole-current-main claim.

The NORMAL `node tools/gen-host-import-sigs.js --check` exited0 with295imports.
ONE `node tools/build-compile-wat.js` invocation exited0, default vendored WATX,
no shake/custom dispatch/names. It compiled and validated BOTH canonical backends:

| Module | Bytes | SHA256 |
|---|---:|---|
| wine-assembly.wasm | 1880854 | af202eea3c5c11aadb117b5c8eed1851d50ce2ce4246a4122845699b472fcc2b |
| wine-assembly.compat.wasm | 1883427 | ed7635d508f7e842afd3c6b8489ba133ac3ddea2fa305439fca60284ea5613a8 |

Both pass WebAssembly.validate/Module compilation without instantiation, exact
295 generated function import signatures (including all5changed completion
imports),296total imports,2226source-exact exports, equal export/import ABI,
set_message_completion(i32)->void and shared host.memory8192..32768pages.
No start section. Complete269-entry layout includes DIRECT_WINDOW span and
matches canonical hash9a3bc9149d58209c. Static reports enumerate full ABI.

147inputs/22210551bytes are SHA256+Git-blob verified before transfer and after
safe selective extraction and before/after every group. All14accepted source
pins remain unchanged, including13original nonrunner files and full reconciled
runner55be42cbcaedee9d7f56f578cd7d36841bba86861b38bf5d61a7a0415a880c2e.
The static-only mirror supplemental blob7f96dd1a81886946eb5fccefd5676c24e9016349
is verified against the candidate tree using source-review readobj/entries.
Standing readonly historical CivII donor files supplied source bytes only.

Boat bx_xw8d895f supported exec API only. Node24.22.1, heap1536MiB;
startup verifies inherited unlimited DATA/AS. Physical3GiB includes supervisor
and descendants, CPU90s/wall120s/file24MiB/output2MiB/excerpts8192B. Generator
peak479150080B/1.499s; both-backend build peak433176576B/9.078s, aggregateCPU14.18s;
static final peak130457600B. Exact tool hash/env/limits and fresh admissions
are retained per group. Remote allocated35835904B at execution handback within
1024MiB complete allocation, including remaining growth/reserve; free floor
2982150144B and host768MiB floor preserved. Local80MiB full accounting includes
selective Git, compressed payload, retained modules/reports, session/events,
positive WAL once, future publication/growth and8MiB reserve. Final resource
receipt records measured categories and peer unfinished reservations.

Two inspector fixture failures are retained: lowercase serialization, then
storage-only mirror missing DIRECT_WINDOW. Corrected independent static inventory
passed; source/compiler/tests were not weakened and generator/build were not
repeated. CLI detach pre-execution syntax, selective mirror donor recovery and
stale completed-peer admission bookkeeping are documented in incidents.json.
Measured transfer concurrency peak: 4; see incidents/readback ledger.
Historical physical128MiB generator failures and real access/platform denials
remain retained; no unchanged denied operations were replayed.

## Recovery and handback

Pinned binaries are retained outside Git at
`/tmp/enigma-reconciled-canonical-boat-build-oct26/modules/` locally and
`/tmp/enigma-reconciled-canonical-boat-build-oct26/source/build/` on bx_xw8d895f.
`modules.json` supplies exact hashes/paths. Git does not preserve these binaries.
The remote selective payload, manifest, sources, recipes, logs and modules remain
under the same task root. Coordinator must snapshot-stop/preserve them before
expiry2026-10-27T00:37:17.515Z; shutdown checkpoint00:20UTC, no worker shutdown.
Use supported boat exec/readback only, fetch.py4500B decoded reads and<=8192B
responses, shared maximum4transport slots, verify full SHA256 before reuse.
Do not rebuild exact modules or download bulky intermediates. `prepare.py`,
`deploy.py`, input-manifest and payload receipts reconstruct the selective source
transport; remote-run.py reconstructs exact supervised commands if separately
authorized. Never replay an uncertain mutating API request; inspect its status.

Box remains RUNNING (API idle/healthok); all owned compiler/static process groups
are absent, detached build PID20769 exited0. Coordinator owns lifecycle. No
gameplay, guest instantiation, source repair, main integration, deployment,
trust/key/permissions/services changes, SSH/resume, new worker or task refill.
Remaining gates: exact changed-module initializer/thunk/decoded CALL-JMP/
park-retry/async qualification, then step ACK for every requested batch and a
following frozen zero-credit snapshot before input. RuntimeQualified=false;
gameplay=unknown. Return ownership and stop.
