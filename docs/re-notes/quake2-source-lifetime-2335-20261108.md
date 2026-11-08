# Quake II source lifetime revocation, 2026-11-08

The default-off owning CPU observer now revokes acquired-source lifetime records
at actual native release/allocation entries and existing reset/import/export/error
boundaries. The historical acquisition SHA remains a point observation. It never
certifies current or later bytes, even when both the address and bytes recur.

Evidence: `scratch/runs/20261108-quake2-source-lifetime-2335/`.
Offline only, single worker, no browser/game/box. Box NONE / NOT_CREATED,
expiry NULL, stop receipt N/A. No Q3, SuperTux, backend, clock, timeout, game,
input or instruction-stepping changes.

## Implementation

`tools/quake2-owning-load-witness.cjs` adds bounded `sourceLifetime` metadata:
at most 32 sources (bounded by the existing record cap) and 32 revocation events.
Each source references its historical acquisition record and transitions from
ACQUIRED_POINT to sticky REVOKED. ACQUIRED_POINT itself asserts no allocation
liveness. `currentIdentity` stays UNKNOWN and `laterBytesCertified` stays false.
Snapshot arrays/objects are copied, including event membership lists.

The original installed EXE supplies separate pins for FS_FreeFile 0x416ef0,
Z_Free 0x414890, Z_TagMalloc 0x414950 and CRT free/malloc 0x432c10/0x432c80.
At actual owning block entry the observer checks CPU PC/ESP and original bytes.
Release revokes matching payload/header addresses before any native free store;
allocation conservatively revokes every outstanding source before allocator
stores. Unverified substitute bodies revoke conservatively without claiming
native release. Release entry means attempted release, never successful free.
A bad-header error must also revoke. No caller completion/generation flags are
used. Historical native load returns remain separate from source lifetime.

## Original path exercised

`tools/quake2-source-lifetime.test.cjs` reuses the hash-pinned retained2205 driver
and its verified installed EXE/PAK/BSP inputs by path. It runs the shipped CPU,
unmodified NodeWorker, actual command queue, local observation attachment and
resolved PE imports. Native/CPU/module/media copies are not staged in evidence.

Unlike2320's retaining free-counter stub, this fixture executes the original:

* Z_Malloc 0x4149e0 -> Z_TagMalloc -> CRT malloc -> large-block CRT allocation
  -> resolved HeapAlloc -> shipped heap implementation.
* FS_FreeFile -> Z_Free -> original CRT free -> small-block lookup -> resolved
  HeapFree -> shipped heap release/reuse implementation.
* Subsequent original Z_Malloc, including actual native clearing, header writes,
  linked-list updates and byte/block counters.

The PE loader resolves IATs. Fixture startup creates a real heap through
HeapCreate, initializes lock9 through InitializeCriticalSection, and supplies
empty zone/small-block-list state and threshold0. These are explicitly authored
CRT startup state, not an original process-startup qualification. Allocation
occurs before CM_LoadMap entry. Fixture file acquisition copies the original BSP
into that actual allocation and returns its pointer/length. Cvar_Get and flushmap
remain authored native fixture boundaries. OS file I/O and complete native CRT
startup are not qualified. No allocator/free routine is replaced.

Original-body assertions cover the file release, zone wrappers/allocator/free,
CRT wrappers/large-block allocator, small-block lookup and lock/unlock bodies.
The source is allocated at 0x7ee10014 in these controls, distinct from input0xc00000.
Native MD4/checksum0xbfd75753 and all35 cmodels match independent retained2205
assertions in the final reuse controls. Fixture startup and file read have no
host register edits between native loader entry and return/failure.

## New controls and parity

Seven distinct off/on pairs (14 Workers), all terminated and awaited:

* Actual native free; historical source revokes at FS_FreeFile entry0x416ef0.
* Actual native same-size reallocation returns the same source address.
* Reset after native free.
* Corrupt header magic: genuine Z_Free takes its original Com_Error branch to
  explicit fixture UD2; WASM traps, attempted release still revokes.
* Reset during original MD4 processing with a 1000-block run budget:
  before reset the source is ACQUIRED_POINT; init_thread revokes it.
* Reuse with added sparse-source-memory parity and complete independent cmodel
  conversion checks. The earlier direct-window hash omitted the high source;
  the added control compares its translated header+payload as well.
* Reallocate the same address, then native fixture copying restores every BSP
  byte. The current SHA equals the old acquisition SHA; its lifetime still
  remains REVOKED. Matching bytes/pointer cannot establish allocation continuity.

Every pair compares final architectural registers/yield state, lazy flags and
the complete direct guest window. The final three controls additionally compare
the actual translated high allocation's header+payload SHA. Required locked
build passes. Existing accepted2244/2258/2205/2320 checks are reused by PATHHASH;
none were identically rerun. The initial allocation-inside-loader diagnostic
failed closed on a real host import before acquisition. The fixture was changed
to allocate before loader entry. An initial pending-reset test used an incorrect
MD4 PC range and failed; the corrected original MD4 range passes. These failures
are retained, not acceptance evidence.

Native HeapFree produces actual host-import logging boundaries. Those retain
the existing conservative sticky invalidation; these original allocator runs
issue no native load-return continuity claim. This task closes the concrete
retaining-stub lifetime experiment gap and adds explicit lifetime revocation;
it does not establish all-writer/exclusive identity, complete instruction
coverage, native-return-to-later-use identity, or edict ABA.

## Recovery and next prerequisite

Git SHA plus small owned binary patches recover sources. All regular run files
have original/stored SHA256 and sizes, GNU gzip CRC and independent original
reread verification with an exact-set inventory. Logs are gzip from first stored
byte. The first boardwatch gzip was killed before EOF; its incomplete stored
bytes are retained inside a valid gzip, explicitly marked as incomplete rather
than claimed as a complete log. The replacement watcher has an independent
3600s timeout and is drained with actual same-shell waits and gzip EOF.
/home free samples exceed1,500,000,000 bytes; no continuous-floor claim, RAM gate,
archives/media/module copies, peer/old deletion or agents.

Before verified guard/onward-door gameplay: establish coverage of actual writers
and exclusive ownership from acquisition/conversion through server startup and
later table/headnode use, with missed reload/reset rejection, plus a
lifecycle-complete edict ABA witness. Native completion and source reuse tests
alone do not meet that prerequisite. Single task STOP.
