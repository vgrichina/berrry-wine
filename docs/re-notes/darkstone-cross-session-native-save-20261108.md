# Darkstone: fresh-session native load, verification blocked, 2026-11-08

The exact retained named save was provisioned in one fresh box/browser. Ordinary
**Load a Game → retained slot → OK** returned to **Land of Ardyl**. However,
the character inventory was never visibly established, and the app disappeared
before the next current-owner check. **Cross-session restoration of Gold 1532 /
Victories 1+0 is unverified; no new encounter, loot or area consequence is claimed.**
No new character was created and the predecessor's pickup was not repeated.

Evidence: ignored `scratch/runs/20261108-darkstone-cross-session-native-save/`
(R). The [predecessor](darkstone-deferred-closure-gameplay-20261107.md) retains
the earned checkpoint and its successful in-process reload.

## Exact checkpoint and local qualification

R/checkpoint-provenance.json records the original artifact names, source paths,
sizes and hashes from the predecessor's `recovered/original/native-vfs-saves.json`.
Only these two unchanged game-generated files were staged:

| Native path | Bytes | SHA-256 |
| --- | ---: | --- |
| `c:\dsave\characters\characters.lpl` | 1,342,076 | `d1e1457fdae3ab68379e5afebd3d1e348ad0ed81b7228253411ec32dc44f86cd` |
| `c:\dsave\games\game641d_6aef1a57.sav` | 3,204,264 | `e4e0a15f206c69ac33f55afcb7bb341790c6f2578c5e6b9429d0128c08492e78` |

The originals remain unchanged. No save reconstruction, byte editing, quick-save
replacement, guest memory/configuration/clock/private-handler change occurred.
The run-local HTTP handler composed the registered media manifest with two eager
file declarations; the production manifest and registry were not edited.
Before allocation, R/test-provision.cjs exercised the actual static server,
manifest URL resolution, `mergeLocalManifestFiles`, `normalizeLazyFiles`,
production `WineAssembly.loadFiles` and `VirtualFS`. Both mounted hashes matched,
and native wildcard enumeration found the named slot. R/local-staging-validation.json
retains the passing result. The test initially used the wrong test API name
`findFirst`; correcting it to the existing `findFirstFile` changed only the test.

The complete predecessor closure was reused, refreshed to current source/module
pins and supplemented with all current `lib/*.js` files and run helpers.
R/inherited-controls-verification.json verifies byte-identical input, transport,
request and observer helpers. The existing actual Chromium/release controls were
retained rather than rerun as generic qualification. The selected deferred attach
function's missing-observer negative and staged-observer positive checks passed.
All 523 uploaded pins matched again after the browser retired. All 16 staged
original media files / 33,566,415 bytes match the predecessor; R/media-refs.json
references their existing paths without copying media into evidence.

## Personally reviewed route and causal boundary

R/review/named-slot-list.png shows the single retained highlighted native slot and
its **Land of Ardyl** thumbnail. R/review/ardyl-restored.png shows the loaded world,
warrior, skeleton and tree. These are fresh-session native-load observations,
not a new character or an in-process reload.

Acknowledged I holds of 100 and 1,000 ms did not visibly open inventory. A reviewed
click on the lower-right icon was initially interpreted as inventory; its settled
tooltip and R/review/checkpoint-inventory-settled.png establish **Map on/off**.
That interpretation is corrected here. The last reviewed capture shows the native
map, not the required character totals. The capture state immediately after the
icon click still contained queued mouse messages; the later map establishes its
visible effect, without assuming immediate consumption from an ACK alone.

At **02:22:00.859 UTC**, the console recorded owning render endpoint 0 closing
and the canvas returning to desktop dimensions. At **02:22:12.066**, command 8,
`character-panel-held`, failed in the unchanged current-owner check:
`one isolated registered app required` (`bound-input.cjs`, `readLive`, line 70).
This is the check requiring an isolated page with exactly one registered app,
before input admission. No admission or pulse file exists for command 8 and no
additional native key event was recorded. The earlier 8 commands have exact ACKs;
command 8 has no successful ACK. The sticky transport closed and nothing was
replayed. R/causal-terminal-logs.json and the original first-failure/browser-failure
records preserve this sequence.

This precisely identifies the immediate blocker: **the registered owner disappeared
between the last map capture and the next pre-input owner check**. The retained
logs do not establish the underlying reason for app removal. They contain no
guest fatal exception or save lookup/format error; successful named-slot discovery
and the loaded Ardyl world argue against treating this as a demonstrated missing
save. Character death, native exit and an emulator defect are not established.
The existing closure did not retain a post-exit app snapshot or exit reason before
browser closure, so that causal detail remains unavailable. No emulator fix was
attempted and no second browser/box or source change was used to continue.

A local retrieval request ran before a pending passive capture completed and
encountered an already-downloaded filename. Its FileExistsError is preserved;
it issued no gameplay input. After the exact capture ACK completed, the new
capture was retrieved under a unique request. This did not reset admission.

## Runtime, provenance and shutdown

One UUID-idempotent box, **bx_8udq8hvy**, was allocated at **02:18:09 UTC**,
with initial expiry **2026-11-08T02:44:08.927Z**. The independent detached
supervisor and normal/watchdog children were armed before allocation; the
immutable watchdog deadline was **02:43:09.092 UTC**. Browser deadline was
**02:41:08.739 UTC**. Its early terminal failure was not extended or retried.
Chrome exited normally at **02:22:12.527**, code 0 and no signal.

The owning renderer was `lib/d3d-render-worker.js`, endpoint 1,
`{api:"legacy",backend:"webgl"}`, with an actual WebGL 2 context and ANGLE/Mesa
Intel string. Backend identification comes from that worker and its observations,
not the toolbar; a physical GPU claim is not made. The actual instantiated guest
and renderer module hash is
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
R/recovered/original/browser-version.json and system-gpu.json retain the browser
and system identities.

All **114 remote artifact references / 6,269,892 bytes** (96 unique artifacts,
6,258,211 unique bytes) were retrieved and
SHA-256 checked **before** requesting normal stop. Unique content and PNG decode
checks are recorded in R/final-audit.json. R/terminal-custody-inventory.json verifies
both owned PIDs absent, both ports closed, profile and writer absent, all 13 native
events trusted and no held inputs. There were three balanced mouse pairs and two
balanced key pairs. No original input ACK timeout or replay occurred; the final
command was closed on the recorded pre-input owner failure.

Normal stop **stop_8264dfe562035dff** completed at **02:22:52.180 UTC** with
`forced:false`. R/normal-stop-confirmed.json confirms **archived**, stopped at
**02:22:52.163**, and expiry cleared. Both lifecycle children exited 0 and the
supervisor has no remaining children. Sampled local free space stayed above 5 GB;
the browser enforced a 5 GB floor. No RAM gate, old-box resume/delete, source/media
archive or public deployment was used. The append-only board watcher was retired.

R/checkout-head.txt records source checkout
`dc4634c46d2037df478250ac2b3c655d59ebac9e`; runtime-pins.json records the exact
staged identities. R/source-recovery.json, relevant tracked/untracked patches and
the owned harness/note patches preserve recovery with Git as the source archive.
No production code changed. Owned artifact containment, file existence, helper
syntax and note whitespace checks passed. The global evidence checker retains
seven unrelated containment errors; this investigation intentionally has no
candidate ID and is not attached to another game's corpus entry.

Next: a separately authorized run must retain the native exit/removal reason and
show the inventory immediately after loading this unchanged named checkpoint,
then establish a new encounter or area consequence. Gold/victory verification,
new progress, FPS, audio, parity and full playability remain open.
