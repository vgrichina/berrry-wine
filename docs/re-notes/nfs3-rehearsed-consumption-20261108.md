# NFS3 rehearsed attachment: local native timer abort blocks allocation

Run: `scratch/runs/20261108-nfs3-rehearsed-consumption/`.
**Task incomplete.** Canonical staging and actual production Worker attachment
now pass locally. The full local native route does not: the original displays
`getcpuspeed - INITTIMER MUST BE INITIALIZED TO MEASURE CPU PERFORMANCE`.
No box was allocated. Installed race bindings, active player/car consumption,
and input-caused race movement remain unmeasured. No emulator defect or fix
has been established.

## Staging and attachment evidence

The released helpers from
[the preceding attempt](nfs3-control-consumption-20261108.md) were reused as
run-owned inputs. Canonical relative-path validation rejects absolute paths,
traversal, duplicate paths and byte mismatches. The observer was explicitly
required from its intended run path in a separate Node process. Removing that
actual file makes the production browser driver exit with ENOENT before it
creates its runtime directory or starts Chrome or the original. This replaces
the preceding failure mode of discovering the missing file after attaching a
paused Worker. Worker attachment failures also close the runtime immediately.

The shared build had changed. The rehearsal instead served the retained pinned
modules, with published Git blobs supplying changed production JavaScript.
Both `local2/module-7ec49….wasm` and `local3/module-7ec49….wasm`, obtained through
CDP bytecode retrieval, independently hash to
`7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`.
`local2/loaded-state.json` associates that hash with each surviving original
guest Worker. The `local3` bytecode file was collected during setup; the failed
game command did not produce its later Worker/module census. Its file alone
therefore does not independently prove original-Worker module equality for the
changed case. The runtime closure's published source commit is
`0a38cf48438096482d059c5d8f27c048474c83b9`; the starting checkout commit is
`0c7a857e931d3a85c6bd4f081b78e3a2d4bd9f9b`.

Generated x86 diagnostics on/off again matched all nine registers and 128
output words: the encoded Up binding returned 0 released and 255 held, and
the original trace import ran exactly once per event. The exact eight-second
Up+Left helper produced trusted Chrome events and independent reverse-order
releases. A slow synthetic sampler preserved release timing and labelled its
samples outside the hold. These bounded controls do not establish whole-game
passivity or input causation.

The extended passive snapshot includes complete queue packets, availability
words, sequences, simulation snapshots, playback selector, player pointer and
car input-index/callback fields. Those additions remain preparations for race
measurement; startup snapshots cannot qualify a player or binding.

## Executed local native route and first new boundary

Three serial local browser cases ran; no heavy browsers overlapped.

1. `local` completed catalogue registration and native Direct3D setup. Its
   three-minute window refused game launch before dispatch because the command
   could not fit the existing cleanup reserve. Chrome was closed; the
   controller subsequently completed its immutable-cap cleanup. This was not
   transport UNKNOWN.
2. `local2` completed catalogue registration, native renderer selection,
   warning acknowledgement and setup OK, then launched the registered original.
   Seven commands received exact ACKs, including normal quit. Three live guest
   Workers reported image base `0x400000` and an installed diagnostic snapshot.
   A bounded diagnostic arm independently expired in all three Workers.
   However, `loaded.png` visibly shows the native INITTIMER abort. The console
   records it at **06:51:26.564 UTC**. Thus successful attachment and release
   did not imply successful game startup.
3. `local3` tested a changed diagnostic attachment order: Runtime enable,
   observer installation and Worker release occur before debugger enable;
   debugger collection is deferred until capture. `attachment.jsonl` and
   `attachment-release-analysis.json` record an exact release for every attached
   Worker. The original still reports the same abort at **06:54:58.251 UTC**.
   Command number 4, ID `game`, then exceeds its 20-second work deadline at
   **06:55:01.529 UTC**. The driver closes Chrome with sticky UNKNOWN. No
   command was resent and no later runtime was launched. The added internal
   eight-second observation wait was also inside that work deadline; the
   variant is a failed experiment, not a qualified remedy.

`local2/loaded.png`, both consoles, `local3/first-failure.json`,
`local3/transport-closed.json`, attachment receipts and process-drain evidence
preserve the new boundary. No missing-EXE, endpoint or focus explanation is
asserted.

Source inspection identifies the abort's zero test of guest `0x562ae8` at
`0x4f044b`. The initialization routine can clear that field on several failure
paths, including a timer-readiness timeout. This is **not** a measured execution
trace of those branches. Prior initialization/API return values, the specific
clearing path, and a matched observer/debugger-off original control were not
captured. In particular, the displayed text does not prove attachment caused
the abort or that a zero clock reading was mistaken for an initialization
sentinel. No clock, configuration, scene or guest state was forced.

The next required work is a separately bounded local timer-initialization
experiment recording the actual predicate, prior API returns and readiness
counter against a matched observer/debugger-off control with the same loaded
module. The full native local route must pass before a fresh watched original
box measures binding → packet → queue → simulation → selected car controls.

## Preservation and shutdown

Evidence remains local in the owned run. `base-commit.txt`,
`relevant-source.patch`, runtime pins and individual new-helper patches retain
recovery information; no source/media archive or media copy was made. The
final helper patches describe the final failed candidate; per-case startup
manifests were not separately retained across local helper revisions, so they
must not be presented as complete byte-level recovery of every earlier case.
The retrieved browser modules and unique screenshots/logs are retained and
hash-verified.

All three original-route Chrome processes exited **0**. Controller/Chrome PIDs,
ports, profiles and writer locks were checked absent; the generated control
browser also exited 0 and removed its profile. The messageboard watcher was
stopped. Disk remained above 5 GB. No box/watchdog was armed because allocation
never became eligible: box ID **none**, state **not allocated**, expiry **N/A**,
stop receipt **N/A**. No inherited box was resumed, stopped or deleted.

Only this note is committed. No production emulator code changed. Full27,
parity, audio and unmeasured FPS remain open.
