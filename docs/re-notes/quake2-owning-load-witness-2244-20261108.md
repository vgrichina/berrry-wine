# Quake II owning source observation, 2026-11-08

Landed the requested **narrower production primitive**. Exact source identity
at later use remains **UNKNOWN**. This is executable owning-thread attachment,
not a resolver consuming caller-authored register snapshots or continuity flags.
Evidence: `scratch/runs/20261108-quake2-owning-load-witness-2244/`.

`tools/quake2-owning-load-witness.cjs` attaches to synchronous WASM `log_block`.
At actual `0x4118d9` it reads ESI and `[ESP+12]` from the owning instance, copies
the complete bounded source range before native free, hashes the bytes, and
retains only SHA-256, length and pointer. No media/source buffer is archived.
It observes loader entry, collision-use entry `0x42f0b0`, and the native
table-selected ESI pointer at headnode-read block `0x42f0da`. Headnode fields
are explicitly candidates at block entry; the control also executes the
original routine through RET and independently checks returned EAX.

Node `createHostImports` accepts `ctx.quake2LoadObservation: true`, with the
actual instance supplied through the existing `ctx.exports`/`ctx.instance`
binding; `ctx.quake2LoadObservationSnapshot()` retrieves bounded host metadata.
NodeWorker init accepts `quake2LoadObservation: true`; queued
`{t:'quake2LoadObservation',seq}` returns its observation, or null when disabled.
The hook is local in `createWorkerImports`, before log suppression/brokering.
The observer never sets guest registers, memory, debug modes, clocks or inputs.
The controller must explicitly arm the existing `set_trace_esp` block trace.
Default is off; no browser attachment or automatic tracing was introduced.

The installed EXE must hash to
`2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b`.
All six exact native body windows from the accepted 2205 experiment are checked
in loaded memory at each recorded point. The preferred base must be 0x400000.
Missing/replaced owner or memory, wrong base, altered/missing bodies, invalid
mapping/range or exhausted bounds reject further points. Bounds are 32 records,
4 MiB per source copy and ten million callbacks. Returned metadata is copied;
editing a snapshot cannot change private pins. Hashes identify the bytes read,
not an atomic snapshot against concurrent shared-memory writers.

## Executable controls

`node tools/quake2-owning-load-witness.test.cjs` reuses the existing
`scratch/runs/20261108-quake2-native-cmodel-binding-2205/native-load-use.cjs`,
SHA-256 `e6fde32e696e4b544eb188fef2380372f5884a3f68a07754a7e6fe7e0446c186`.
It preserves that experiment's explicitly authored file/cvar/free/format/link
boundaries and original native loader/checksum/conversion/startup/setmodel/use
assertions, adding actual production host and Worker-import attachments.
The original fixture CPU remains its existing PATH/HASH reference:
`scratch/runs/20261108-tr2-presenter-getter-native/modules/wine-assembly-d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc.wasm`.
Installed EXE, DLL and PAK hashes and embedded BSP hashes are checked by that
accepted input, without copying media/modules or rerunning the separate
disassembly captures. Tests therefore require those retained local inputs.

Both actual full native loads capture 1,991,772 bytes: original SHA
`ee13d2e5448d990ced8ca7b0595722518c5221feab68d5a07e2a291391da6457`, then
altered entity-text SHA
`bb151e6a9b3bd2465f7f46de05b2dffb9414d11f75efb85c3d0415454a66dac2`.
All 35 cmodels remain identical. The intervening genuine cache decision makes
no acquisition. Actual use returns 4948, then 4942 for wrong registry index and
wrong pointer. Observation off/on final architectural state and complete direct
guest memory hashes match, with identical file-read/free counts.

An unmodified shipped `lib/guest-worker.js`, using current
`build/wine-assembly.wasm` SHA
`4b45bda53a90b665896cf3b85d9a157b7c3703563c88b6666e4ee2e4b346bcc3`,
also executes its real queued controls: native CMP/JNE into acquisition,
160-byte explicitly authored source, original table/headnode use through RET,
status retrieval, same-instance reset, and Worker reinitialization. Off/on EAX,
EIP and ESP match. Fixtures have independent parent deadlines before execution,
an external command deadline, and awaited Worker termination.

Eleven rejection controls per attachment exercise changed native code, missing
and replaced actual owner, missing/replaced memory, different native base,
unmapped/overflow/oversized/short source and exhausted record capacity. Disabled
trace, reset and reload controls retain UNKNOWN; reinitialization returns no
old observation. Tests also verify copied snapshot metadata cannot alter pins.
Focused controls, existing worker-import tests and required
`flock /tmp/wine-build.lock bash tools/build.sh` pass. Initial build review-lock
failure is retained; only the two owned producer hashes/lifetime review notes
were reconciled in the census manifest. No native custody tool changed.

## Limits and next work

`log_block` is a block-entry hook. Default fused blocks skip some interior
addresses, including the attempted post-free point in these controls. Thunks,
API/host writers, `init_thread`, `load_pe`, trace disarming and same-image reload
have no complete continuous invalidation barrier here. No completed-load or
fresh/cache certificate is inferred by this primitive, even though the controls
independently execute and verify those decisions and completed returns. Caller
claims, cmodel matches, checksum and startup counters cannot close that gap.
No instruction stepping was enabled. Both parity arms use identical block
trace setup. Measured callback time and fixture wall time are recorded in the
focused log; these noisy single samples make no performance claim.

Next: an exclusive owning execution/reset/module/writer barrier before any
later exact-source identity or gameplay attempt. Edict ABA remains unsolved;
no allocation counter or live-pane identity is asserted. No game, browser,
Chrome, remote, other agent, input or retry occurred. Box **NONE**, state
**NOT_CREATED**, expiry **NULL**, stop receipt **N/A**.

Evidence uses gzip command streams from their first stored byte, independent
decompression/CRC and original/stored hashes and sizes. Inventory covers every
regular file, with its own seal recorded externally on the messageboard. Source
recovery is Git commit plus the small owned patch; no tree/media/module archive,
old/peer deletion or RAM gate. Disk samples exceed 1,500,000,000 bytes; this is
not a continuous-floor claim. Board watcher has a prearmed independent deadline
and same-shell EXIT cleanup with actual child waits. Single task STOP.
