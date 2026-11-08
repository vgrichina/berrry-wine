# Quake II native cmodel load/use binding, 2026-11-08

**Partial native derivation; exact loaded-map identity remains UNKNOWN.** No
production resolver was installed. The new offline controls execute the
original map loader and collision-use code, closing the *experimental native
dataflow* gap in 7a38ceeeb. They do not establish an owning runtime's source
acquisition and load-to-use continuity. Per the task's fallback instruction,
this records that concrete remaining blocker rather than publishing a resolver
whose success condition would accept a snapshot as an exact-source witness.

Evidence: `scratch/runs/20261108-quake2-native-cmodel-binding-2205/`.
The reproducible, small input is `native-load-use.cjs`; final assertions and
byte-window pins are in `native-load-use-final.log.gz`. It imports the existing
PE reader and reads installed media into fixture memory; it does not launch a
game, renderer, Chrome, input, remote runtime, or another agent.

## New original-byte load/use execution

The installed paths are under
`test/binaries/candidates/quake-2-demo-installer/installed-extracted/Install/Data/`:

| Input | SHA-256 |
| --- | --- |
| `quake2.exe` | `2fa987c9390663e230c5b6479285e7c55511e35f80091bfed96f43062c1c810b` |
| `baseq2/gamex86.dll` | `11fd73be2887a6c567517dbbf74c2f5040c3636e4863befd1ade9f4537e52d60` |
| `baseq2/pak0.pak` | `cae257182f34d3913f3d663e1d7cf865d668feda6af393d4ecf3e9e408b48d09` |
| Embedded `maps/demo1.bsp`, 1,991,772 bytes | `ee13d2e5448d990ced8ca7b0595722518c5221feab68d5a07e2a291391da6457` |

Execution uses the existing retained module at
`scratch/runs/20261108-tr2-presenter-getter-native/modules/wine-assembly-d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc.wasm`,
SHA-256 `d8facd0658b7f158c6e60bef2de0936471f438f8bf41e9240fd75635f1d319dc`.
Every input is hashed before execution. The previous
`scratch/runs/20261108-quake2-window-state-observer-2152/native-controls.cjs`
is referenced by path/hash in `inputs.json`; its source, module and old evidence
were not copied here.

Addresses below identify the pinned EXE's preferred image at 0x400000. This is
fixture execution, not an observation or assumption about a loaded original.

1. Execute genuine endian initialization at 0x423350. Invoke the complete
   native CM_LoadMap at 0x4117b0. Only Cvar_Get, the zero-valued flushmap query,
   file acquisition and file release are authored boundaries. File acquisition
   returns the exact embedded BSP in fixture memory. File release checks the
   pointer but retains fixture storage. No operating-system file acquisition
   or allocator/free implementation is qualified.
2. At actual post-acquisition block entry 0x4118d9, independently hash all
   1,991,772 source bytes. Native 0x4118df calls 0x41a2a0 with `(buffer,length)`.
   This runs the genuine MD4 implementation; 0x41a2d6..0x41a2ed XOR its four
   little-endian digest words. The following native LittleLong call returns
   the same word on this initialized little-endian fixture. The loader stores
   it at 0x4543c0 and through the caller's output pointer.
3. Independent OpenSSL MD4 gives `7f29c328b3126f42487b6c4ad717179f`.
   XOR is **0xbfd75753**, matching both native output and stored checksum.
   This is a 32-bit protocol checksum, not an exact-file cryptographic identity.
4. Native 0x4119b2 invokes submodel conversion at 0x410e50 with header lump13.
   It requires a multiple of 48 bytes, 1..1024 models, writes the count to
   0xa23f8c, and emits 40-byte records at 0x6d7da0. For each disk dmodel it
   writes `mins-1`, `maxs+1`, origin unchanged, and headnode from disk+36 to
   cmodel+36. Disk firstface/numfaces are not represented in the cmodel.
   Independent conversion matches **all 35 complete native cmodel records**.
5. Execute the genuine startup inline-table loop 0x42b0e4..0x42b128.
   Its formatting call is an explicit `*ordinal` fixture; native inline lookup
   0x411aa0, count checks and pointer stores execute. Earlier startup's world
   registry entry and pointer are explicitly authored, not claimed executed.
   The full startup call site at 0x42b0b9 calls CM_LoadMap and stores its world
   result at 0x47b558; that surrounding call is statically inspected, while
   this experiment invokes CM_LoadMap directly.
6. Execute genuine setmodel at 0x42a6c0, registry search at 0x42ad70/0x42ac50,
   and inline lookup. A fixture edict with SOLID_BSP=3 and name `*20` receives
   registry index **21**, not 20, and the six converted bounds words. Its link
   call is an explicit no-op boundary; native linking, game DLL spawn and
   uniqueness of a live pane are not established here.
7. Execute genuine collision-model use at **0x42f0b0**. For SOLID_BSP it reads
   `edict+0x28`, fetches `*(0x47b554+4*registryIndex)`, requires non-null, and
   returns that cmodel's **headnode at +36**. The collision caller at
   0x42f1ac obtains this value and supplies it to transformed trace at
   0x42f215. That caller/trace relationship is statically inspected; the
   transformed trace is not executed by this control.

For model20 the disk bounds are (-72,136,16)/(128,144,112), origin zero,
headnode4948, firstface7536, numfaces17. Native cmodel20 is **0x6d80c0**, bounds
(-73,135,15)/(129,145,113), headnode4948. Startup places its pointer in server
table slot21 at **0x47b5a8**, and its name at **0x47c694**. These are exact
relationships for the pinned fixture, never a substitute for live table reads.

## Causal controls and remaining blocker

The final script asserts these outcomes using original x86 execution:

* Set `edict.modelindex=20` while retaining the `*20` string and copied model20
  bounds: native collision use returns model19's headnode **4942**. Registry
  index is not inline ordinal.
* Restore registry index21 but change just its server pointer to cmodel19:
  native use again returns4942. Strings and bounds cannot validate the pointer.
* Change the first byte of the BSP's `worldspawn` entity classname to uppercase
  W. The modified SHA-256 is
  `bb151e6a9b3bd2465f7f46de05b2dffb9414d11f75efb85c3d0415454a66dac2`.
  A forced fresh native load computes checksum **0x2eaef0d2**, independently
  confirmed from MD4 `dbcca23cd161bd8a551c17ef8d41a677`, while **all 35 cmodels
  remain byte-identical**. Matching every cmodel does not identify exact BSP
  source bytes or entity text.
* Before that fresh load, call CM_LoadMap with the same requested name and
  flushmap=0 after replacing fixture backing source bytes. Native cache reuse
  performs **no file acquisition**, returns the old world pointer/checksum,
  and leaves all cmodels unchanged. A load invocation or current disk hash
  cannot be treated as a newly observed source load. Changing the requested
  name to `maps/alias.bsp` forces the full native load path; the filename is
  deliberately a fixture, not proof of file content.

The exact-source witness is available at native source-buffer acquisition,
but the loader subsequently frees that buffer (call0x416ef0 at0x411a06).
Post-load memory retains the reduced collision structures, map name and
32-bit checksum. **There is no trusted owning-runtime acquisition witness
connected to later use in the available read-only snapshot interface.** The
test harness controls execution and can witness its own source; that authority
does not transfer to a future running owner via a caller-authored JSON record.

Specifically missing is an owning CPU observation path that binds the exact
buffer/length at0x4118d9 to completed load, cache-vs-fresh decision, server
startup and subsequent table/headnode use, and invalidates the witness on a
missed replacement/reset. Current map startup's counter0x473f48 is incremented
before server clear, but sampling that integer does not establish complete
CM_LoadMap/module/process coverage or exclude a missed reload. A callback
assertion of continuity would not prove it. No such adapter was installed or
qualified in this task; no success token or invented generation was emitted.

Wrong-module rejection and different-relocation behavior of a production
resolver are consequently **not tested or claimed**. This fixture hash-pins
the installed EXE and executes it at its preferred base; the EXE has stripped
relocations. DLL relocation controls in2152 do not supply a current engine-map
source witness, and were not repeated or relabeled as resolver acceptance.
For a different module/base, absent source witness, stale load, or mismatched
registry/pointer, the requested exact identity remains **UNKNOWN**.

The previous full892-byte same-frame free/init ABA control remains relevant:
this work provides no edict allocation serial or generation-complete removal
witness. No production destruction observer, live pane state, brush removal,
gameplay crossing, hit/damage/death-source inference or original retry follows.

## Validation and custody

Final focused actual-x86 load/use and causal assertions pass. Existing route
tests pass (25 tests, including2000 independent interval checks). The required
`flock /tmp/wine-build.lock bash tools/build.sh` passes. Disassembly, checks,
source recovery metadata and publication receipts are retained in the run.

An initial fixture placed scratch variables inside the 1,991,772-byte source
range. Its initial nominal pass is **superseded**, and the added cache control
exposed the overlap in a retained failure. Scratch was moved above the source
range with an explicit disjointness assertion; only the final corrected run
supports results here. `run(1)` advances basic blocks, not individual x86
instructions; observed event entries are not claimed complete instruction or
lifecycle coverage.

Every captured command stream is gzip from its first stored byte, with producer
SHA/size and independent gzip reread/CRC receipts. Final inventory visits every
regular file, without extension filtering or following symlinks. Recovery uses
Git SHA and a small owned note patch; installed binaries/media and the retained
CPU module are existing PATH/HASH references. No source/media archive, peer WIP
capture, old deletion or RAM gate. Disk samples exceed1,500,000,000 bytes;
samples are not a continuous-floor claim. The board watcher has an independent
3600-second timeout and is explicitly stopped before release.

Box **NONE**, state **NOT_CREATED**, expiry **NULL**, stop receipt **N/A**.
Single task STOP with the source-acquisition/owning-CPU continuity blocker;
`tools/quake2-collision-map-identity.cjs` and its test were **not created**.
