# Quake II owning native load return, 2026-11-08

The default-off Node observer now records an actual CM_LoadMap native return,
with separate fresh-acquisition and cache/no-acquisition paths. This is a bounded
machine-boundary observation. Exact identity, actual writers, allocation lifetime,
instruction coverage and exclusive ownership remain **UNKNOWN**.

Evidence: `scratch/runs/20261108-quake2-native-load-completion-2320/`.
Offline only: no game, browser, Chrome, box, remote runtime or agents.

## Boundary derived from the original image

The existing installed EXE and six original native body windows remain pinned.
At genuine entry `0x4117b0`, the observer reads the owning CPU's ESP and stack
return address. Completion additionally requires the production export facade's
actual trace configuration to include that return address. Caller-authored
coverage/completion booleans are not consulted. Missing trace authority or an
excluded target fails closed.

The native prologue reserves 0xa4 bytes and saves three registers. Acquisition
`0x4118d9` must therefore have ESP equal to entry ESP minus 0xb0. Its source hash
record is associated with this invocation only. Native cache decision block
`0x411831` is tracked separately, at the same frame depth, with no acquisition.

The observed final fresh block is **0x411a26**, not the fused interior at
0x411a0e. It copies the requested map name, restores registers/frame and executes
RET at 0x411a5b, without an intervening call or conditional transfer. Cache
blocks **0x41185b** and **0x411a83** likewise restore the frame and return at
0x411869/0x411a91. The latter is accepted only with the earlier cache decision;
an empty-map return cannot masquerade as a cache hit. Original code pins are
checked before arming an epilogue and at the return observation.

A terminal block arms a pending boundary, never completion. The next owning
block must be the captured return address, at entry ESP plus 4, with EAX equal
to the original world cmodel pointer. If the CPU's block budget returns directly
after the epilogue, the wrapped `run` checks those same actual registers. An
ordinary `run` return, source acquisition, file release or post-free block
cannot arm this check. A mismatching return address/stack, failed run, reset,
mutating export/import, reinitialization, owner replacement or missing boundary
cannot produce a native-return record. Nested/repeated entry fails closed.

`NATIVE_LOAD_RETURN` records include the observed epilogue, return PC/ESP,
entry ESP, FRESH/CACHE_NO_READ path, observation boundary and acquisition-record
index (null for cache). Metadata remains bounded by the existing 32 records,
32 invalidation events and callback/source limits. These are historical point
records; the existing sticky invalidation still applies. The new bounded
`nativeCompletion` status distinguishes pending, interrupted and observed
returns. `coverage.completedLoad` remains UNKNOWN because this is not a complete
writer/lifetime or full-load certificate. No guest, backend, config, clock,
timeout, input or instruction-step change was made.

## New executable controls

`tools/quake2-native-load-completion.test.cjs` hash-pins and reuses the retained
2205 full-loader driver at its original path, SHA256
`e6fde32e696e4b544eb188fef2380372f5884a3f68a07754a7e6fe7e0446c186`.
It evaluates that driver's existing verified EXE/DLL/PAK/BSP inputs and reuses
its complete independent cmodel-conversion assertions. It uses the shipped
`build/wine-assembly.wasm` and unmodified shipped `lib/guest-worker.js`, command
queue and local import attachment. No module/media copy was made.

The driver's explicitly authored Cvar_Get, zero flushmap query, file acquisition
and file release boundaries are small native fixture stubs here, so full native
execution does not require parent register setters between entry and return.
The source comes from actual local PAK fixture I/O: 1,991,772 original BSP bytes,
SHA256 `ee13d2e5448d990ced8ca7b0595722518c5221feab68d5a07e2a291391da6457`.
The fixture copies that source to its disjoint buffer; its load stub supplies
the pointer/length and counts acquisition. Its free stub counts release and
records the actual argument, retaining storage as in 2205. This does not qualify
OS file loading or native allocation/free lifetime. The original native loader,
MD4/checksum, endian initialization, conversions and final map-name/return path
execute. All 35 cmodels and checksum 0xbfd75753 are independently checked.

Twelve off/on scenario pairs (24 actual Workers, all terminated and awaited):

* Fresh then genuine same-name cache: exactly one acquisition/free, two native
  returns, fresh hash linked only to the first; cache client0 and client1
  exercise both original cache epilogues.
* The final fresh block runs with a one-block **budget**, exercising the actual
  post-run target/ESP check. Other positive controls use 100000-block budgets
  and observe the actual caller block. No instruction stepping is introduced.
* Interrupted file release and a separate pause in native post-free processing
  at 0x411b90: the latter has an actual free count of 1, yet zero completions.
* A changed live return slot reaches a different target: zero completions.
* Missing return-target trace coverage: native loader finishes and all models
  match, yet zero completions.
* Reset, actual Worker/module replacement, rejected run arguments, and unrelated
  run returns while native cvar execution is pending: zero completions.
* A modified fixture BSP version takes the original native version-error branch
  into the explicitly failing Com_Error boundary (UD2); actual WASM execution
  traps, no free/completion occurs, and failure invalidates before propagation.

Every pair compares final registers/yield state and the entire direct guest
memory SHA, plus file read/free counts. Final added client-cache/post-free pairs
also compare the lazy flag tuple; those conservative readExports parity reads
occur after observation retrieval. Independent per-Worker deadlines precede
initialization, external command deadlines precede tests, and every Worker
termination is awaited. No original/native OS I/O or allocator claim follows.

`focused-03.log.gz` covers the initial eight new pairs;
`native-failure-01.log.gz`, `run-boundary-01.log.gz` and
`additional-final.log.gz` cover the four added distinct controls. Successful
controls were reused instead of identically replayed. Initial diagnostic/test
setup failures are retained, superseded by these passes. Unchanged accepted
2244/2258/2205 controls are reused by PATHHASH in `references.json.gz` without
rerunning them. The final required locked build passes.

## Remaining limits and recovery

The observer still invalidates conservatively on host imports and mutating
exports. Interruptions cannot be bridged with invented continuity flags.
Standalone import attachments without the export facade lack trace authority
and cannot issue completion. Other Workers/shared writers, internal native
stores, restored code changes between point checks and allocation lifetime
remain uncovered. A returned native routine does not prove later source/use
identity, server-startup continuity, edict ABA, live pane state or gameplay.

All command logs are gzip from their first stored byte. Every regular evidence
file has original/stored SHA256 and sizes, independent GNU gzip CRC/hash checks
and an exact-set inventory; the inventory self seal is on the messageboard.
Source recovery is exact Git SHA plus small owned patches, with existing inputs
referenced by PATHHASH. No source archives, media/module copies, old/peer deletion
or RAM gate. /home free-space samples exceed 1,500,000,000 bytes; no continuous
floor claim. Observable bounded boardwatch uses an independent deadline and
same-shell EXIT with actual waits and gzip EOF. Box **NONE**, state
**NOT_CREATED**, expiry **NULL**, stop receipt **N/A**. Single task STOP.
