# Quake II window observer: native identity blocker, 2026-11-08

Stopped without implementing or installing a production observer. The exact
safe live identity/lifetime chain was **not established**. Window state remains
**UNKNOWN**. No state file was created or removed. The previous intact
noPassage certificate and conditional destroyed-pane route remain unchanged;
damage source remains UNKNOWN. There is no new original traversal, hit,
destruction, death-cause, or backend claim.

Evidence is `scratch/runs/20261108-quake2-window-state-observer-2152/`.
This is a concrete partial native derivation and negative experiment, not a
claim that a safe observer is impossible. In particular, fixture lifecycle
execution below does not establish coverage of a future original's lifecycle.

## Installed-byte derivation

Read existing files under
`test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/`:

* `baseq2/gamex86.dll`: 385024 bytes, SHA-256
  `11fd73be2887a6c567517dbbf74c2f5040c3636e4863befd1ade9f4537e52d60`.
* `quake2.exe`: 323584 bytes, SHA-256
  `2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b`.
* `baseq2/pak0.pak`: referenced in the evidence input manifest. The existing
  BSP parser/test independently verifies embedded demo1 BSP SHA-256
  `ee13d2e5448d990ced8ca7b0595722518c5221feab68d5a07e2a291391da6457`.

All addresses in this section are **preferred-image static addresses**.
They are not observations of a loaded original. EXE preferred base is
0x400000, with relocations stripped. DLL preferred base is 0x20000000,
SizeOfImage 0x6c000, with a HIGHLOW relocation directory at RVA0x64000,
size0x7218. The export table names GetGameAPI at RVA0xa840.

The following were independently inspected in the installed disassembly;
full compressed disassemblies and PE headers are retained:

| Native path | Established data flow |
| --- | --- |
| EXE 0x42fac4..0x42faee | Resolve GetGameAPI from the loaded handle at 0x472270, invoke it with engine imports, return its result. |
| EXE 0x42ac00..0x42ac43 | Store that result at 0x4a96ec; check API version3; invoke its initialization member. |
| DLL 0x2000a840..0x2000a903 | Copy 0x2c import DWORDs to 0x20062280; return export structure 0x20062200 in EAX; publish edict stride0x37c at export+0x44. |
| DLL 0x20011418..0x2001144d | Form max_edicts*0x37c, allocate via import+0x84, store the resulting pointer in 0x20062384 and export+0x40; store maximum in export+0x4c. |
| DLL 0x20016384..0x200163eb | Read live count at export+0x48, walk slots with stride0x37c, increment count when extending the array. This is not an authored BSP entity count. |
| DLL 0x20016300..0x20016340 | Initialize inuse at edict+0x58, classname, gravity, and runtime number `(pointer-edicts)/0x37c`; no allocation serial is installed by this function. |
| DLL 0x200125c5..0x200125de | Use world slot for the first parsed entity, then call the dynamic allocator for later entities before parsing fields. Authored entity328 is not a live index derivation. |
| DLL 0x2000c45c..0x2000c46d | Pass edict+0x10c model string and edict pointer to engine setmodel through import slot0x200622ac. |
| EXE 0x42a6c0..0x42a738 | Registry lookup returns a model index stored at edict+0x28. For a `*` string, call inline-model lookup, copy bounds, then link. |
| EXE 0x42ad70..0x42ad86 / 0x42ac50..0x42ad65 | Registry lookup uses configuration-string domain32, capacity256, 64-byte strings, and returns the matching/allocated registry index. An inline ordinal is not itself that registry index. |
| EXE 0x411aa0..0x411af0 | Require leading `*`, parse following integer, require 1<=ordinal<numSubmodels at0xa23f8c, return 0x6d7da0+ordinal*40. |
| EXE 0x42b0e4..0x42b126 | Populate native inline-model pointer table while building inline model name strings. This is static table-construction evidence, not a live demo1 binding. |
| EXE 0x42af41..0x42af69 | Increment 0x473f48 before clearing server map state at0x47b500. A map-name read alone would miss same-name reload. |
| EXE 0x42aa40..0x42aa5b | Shutdown through export, unload DLL, clear export pointer. Sampling the pointer does not by itself establish a module generation. |

A prospective loaded DLL base could be derived from the live export pointer
minus RVA0x62200, then checked against mapped PE metadata, relocation-aware
instruction windows, function members and imports. No live pointer was read
here, and this derivation has not been qualified as a production loaded-module
resolver. It must not be replaced by assuming 0x20000000.

## Actual x86 negative controls

`native-controls.cjs` is a small run-specific input, not a source-tree copy or
production observer. It reads exact original instruction slices and HIGHLOW
fixups from the installed DLL into fixture memory at **0x600000** and
**0xa00000**. It executes the original init/free functions and the EXE's real
unlink functions (0x42e9b0 and list splice0x42e810) through the retained CPU
module:

`scratch/runs/20261108-tr2-presenter-getter-native/modules/wine-assembly-d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc.wasm`

SHA-256 `d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
It is hash-checked before compilation; no binary is copied into this run.
Unexpected host imports trap; only beep setup notifications are inert fixtures.

At each relocated base the assertions establish:

* A fixture slot17 gets runtime number17 and inuse1 from original init.
  Original free calls the genuine engine unlink path, splices an actually
  linked fixture list, returns through DLL RVA0x1640c, clears the edict, sets
  its freed classname and current native freetime, and leaves inuse0.
* Native init/free/init in the same fixture frame, with explicitly authored
  model/class/health/solid/takedamage/death fields restored between calls,
  reproduces **all 892 edict bytes exactly**. This demonstrates a possible
  ABA sampling ambiguity. It does not assert that native spawn executed, or
  that any original pane actually reused a slot.
* A protected client slot goes through the genuine unlink but remains
  inuse1. Unlink alone is not a completed free. The static free test compares
  slot number against maxclients+8 (constant -8 at DLL0x2003c600), protecting
  client/body slots. Initial fixture slot7 therefore did not clear; that
  failed assertion is preserved before the correct unprotected slot17 test.

The two initial strict-import fixture failures (beep process/thread setup)
are also preserved. Final controls pass in `native-controls-final.log.gz`;
its original content hash matches the preceding successful run exactly.
There is no original map/spawn/game-loop/damage/death-callback execution.
Addresses, allocations, stack, cvar, linked list and restored pane fields
are fixtures. These controls do not prove a production observer's read-only
behavior, bounds, generation handling or intact/destruction classification.

## Concrete missing evidence and required next derivation

Two parts of the requested safety proof remain open:

1. **Pinned BSP to live pane identity.** Follow the EXE map loader at0x4117b0
   and map startup0x42b0b9 through loaded collision submodels, configuration
   strings, and model-pointer table into the collision path actually used by
   the live edict. Bind that particular map generation to the exact installed
   BSP, then require one live in-use edict whose model pointer/string,
   registry entry, native inline collision model and explosive callback/fields
   agree. The derivation above stops short of proving this complete native
   load/use chain. No string, expected registry index, inline ordinal, bounds
   match or authored health should fill the gap.
2. **Generation-complete removal witness.** There is no per-allocation serial
   in the inspected init/free path. Establish that the proposed passive
   observation points cover the relevant map reset/read-level, module
   shutdown/reload, edict init/reuse, explosive death, unlink and final free
   boundaries in the owning CPU, including paths between ordinary JS returns.
   Capture process/instance and module/map generations from real ownership
   sources. The existing TR2 observer explicitly scopes itself to owning-CPU
   JS boundaries and does not supply this Quake II coverage proof. Its RPC
   publication GEN is not a native edict allocation serial. Missed lifecycle
   boundaries must invalidate identity, even if the pointer and every sampled
   field compare equal afterward.

For eventual destruction, the previous static callback0x2000c0c0 and
free call0x2000c396 are leads. A completed, linked death→free→unlink→clear
witness for the same unique pane and generations is still required. An
unlinked free return, mere absence, zero health, slot reuse or map change
must return UNKNOWN. No current code performs this classification, and no
observer/read controls are claimed for wrong module, stale generation,
ambiguous model, or retirement. Fabricating those as fixture successes would
not supply the missing native data flow.

## Checks and custody

Final relocated x86 negative controls pass. Existing route regression tests
pass: 25 tests including 2000 independent brush interval checks. Required
locked build passes and is retained in `build-final.log.gz`; publication metadata in
the run records its exit status and exact main commit. No production source,
census, default unarmed path, guest calls/writes, input, tracing, arm or replay
behavior changed. Only this investigation note is published.

Logs are gzip from their first stored byte. Initial command captures computed
original hashes by rereading gzip; they did not also hash the producer stream.
The final controls, route tests and build were recaptured with separate
producer SHA/size and independent gzip reread/CRC comparison receipts. Earlier
failures retain original/decompressed hashes and CRC validation without a
producer-receipt claim. Final inventory independently
rereads every regular file without following symlinks, checks gzip CRC and
original/compressed SHA-256 and size, and records its own original hash/size
separately to avoid recursive self-hashing. Source recovery uses Git SHA plus
a small owned note patch; all binaries/media use existing paths and hashes.
No source/media archive, peer WIP capture, old-run deletion, or RAM gate.
The board watcher has an independent 3600-second deadline and is stopped
before release. Disk samples are observations, not a continuous floor claim.

Box **NONE**, state **NOT_CREATED**, expiry **NULL**, stop receipt **N/A**.
No Chrome, original game, input, remote runtime, box, subagent, public
deployment, configuration, backend, bindings, clocks or seed changes.
STOP with the concrete missing evidence above; no production implementation
commit is claimed.
