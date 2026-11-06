# Conan: shipped-module loading and first failed draw, 2026-11-06

The current shipped, uninstrumented emulator module crossed Kordava loading
and rendered the town/Conan cinematic. Before actual player control appeared,
the strict singular-normal guard rejected a draw. Native player movement and a
distinct second gameplay response remain unverified. No emulator mismatch was
demonstrated, so no production repair was made.

Evidence: `scratch/runs/20261106-conan-shipped-loading-boundary/` (ignored).
All times below are UTC. Coordinator granted one original session at
19:18:02.833701 through 20:03:02.833701, including cleanup, after AoW1816 and
D3D9reuse1838 FINAL and independent cleanup. No workers or test boxes were
launched. Source/module freeze remained in force through the session.

## Tested identity and command qualification

Runtime source commit: `5a5b9f7306c44876dc9aee70cc5e4bcd64476e90`.
`source-pin.json`, `relevant.binarydiff`, and the patch for the preexisting
untracked `lib/wininit-boot.js` record the relevant source closure without a
source archive. Final pinned-source/helper/module verification passed.

The ordinary `WineAssembly.getWasmModule` loader loaded
`build/wine-assembly.wasm`, 2,180,791 bytes, SHA-256
`2fa9f377dde5e477eb811baceb64032889fbe9b27a664b213477e84627e5eb94`.
Actual CPU and render Worker compiled bytecode hashes matched those bytes;
`original/executor-identity.json` retains physical CDP session/target identities.
The run did not substitute a compiler observer module or install streaming
lifetime hooks. Existing accepted renderer diagnostics and scalar world-copy
provenance remained enabled. No guest program bytes were changed. The genuine
installed media remained in place, referenced by path/hash in
`media-references.json`.

Changed launch/command plumbing was qualified first using a generated native
full-shell PE: reviewed Enter and click changed the native window title, with
balanced trusted input events. Fourteen negative command cases rejected before
input; exact driver/consumer hashes and owning Worker/module identity are in
`command-controls.json` (PASS). The first generated attempt exposed a harness
observer problem: the document listener missed mouseup although the guest
logged WM_LBUTTONUP. It failed qualification. The listener was corrected to
early window capture, preserving all guards, and the fresh generated control
passed. Both attempts and their cleanup receipts were retained. There was
exactly one Conan launch, with no loading retry.

## Personally reviewed route and useful loading progress

| Time | Observed boundary |
| --- | --- |
| 19:23:10 | New Game menu. |
| 19:24:41.775 | Warrior confirmed; Kordava Loading. Loading Worker slot 1 had completed 46 slices / 4.320 seconds guest time; no renderer failure. |
| 19:24:47.099 | Loading Worker exited normally after 68 completed slices / 6.409 seconds guest time. |
| 19:25:35 | Rendered night-town cinematic; main 5,881 slices, world-writer serial 22,177, no renderer failure. |
| 19:26:47–19:30:29 | Advancing town/Conan/temple cinematic and narration; no gameplay input or cinematic skip. |
| 19:30:55.012 | First strict singular-normal error. |
| 19:31:12–19:31:40 | Black presentation, initially with final temple subtitle; first failure retained and reviewed. |
| 19:31:51.593 | Ordinary session close, terminal status 0; browser also exited 0. |

Current-capture hashes, personal reviews, input references, passive completed
slice/last-EIP samples, per-process/thread CPU ticks (100 ticks/second), request
completion events and server response receipts are retained. The initial
100 ms difficulty Enter was drained down/up together and did not advance;
the anticipated `kordava-entry` filename still shows difficulty. A newly
reviewed 1,000 ms Enter opened loading (`warrior-confirmed`). No input was
sent after that confirmation except ordinary shell shutdown.

`progress-summary.json` preserves the predecessor loading-progress evidence
hash. That diagnostic run advanced 56 to 528 loading-thread slices, changed
last EIP, and advanced main/world writers while captures stayed loading; it
was not a completely stopped emulator. Its baseline module hash
`43a0097ab79e1e9102d6f12411485a359ebe10b03af5fcf22675b75ad701a081`
also differs from today's shipped module. These runs are not a controlled
comparison and do not establish observer overhead.

CDP request terminals and server completion are separate evidence: some CDP
media requests report ERR_ABORTED, while the owning server records all eight
served media responses HTTP 200 complete. The cinematic establishes useful
loading completion; an absent client terminal alone does not establish a
network wait or emulator defect.

## First concrete failure and remaining boundary

`original/first-render-failure.json` retains the unchanged accepted
`drawDiagnostic`, sequence-keyed world provenance, and executor stack:

- Endpoint 1, device 136454160, generation 1, first failed sequence 71332;
  successful prefix 71331, submitted 71335, inflight 0.
- Fixed-function lit normal draw: triangle list, 12 primitives, stride 32,
  position/texture/normal attributes, lighting and specular enabled.
- Error: `D3D9 fixed function: singular normal transform` from `normalMatrix`.
- World matrix first twelve values are all zero; final row is
  `[38.767112731933594, 248.01272583007812, 16.380149841308594, 1]`.
- Exact first-failed sequence provenance has errors 0. Its last live writer
  serial 114805, thread 1, guest EIP `0x41ccee`, return `0x41cd09`, source
  guest pointer `0x074ff2d0`. Source, copied destination, lowered command and
  executor world bits match exactly (`failure-validation.json`, PASS).

Those addresses describe this runtime, not new production constants. The
source matrix was already singular at the observed upload/copy boundary.
`sourceOrigin` is null: the earlier construction stores and object lifetime
were not observed. This does not prove a CPU, timer, Win32, or renderer
mismatch. The next useful investigation is the earlier matrix construction
and its native instruction semantics, retaining the strict guard and guest
bytes. Replacing the matrix or dropping the failed draw is not justified.

No production source or tests changed, and no new build was needed for this
note-only commit. Validation comprised the generated native command control,
14 rejection guards, actual module/Worker identity, source/helper identity,
the single reviewed original session, exact failure correlation, and process/
port/profile cleanup. Runtime locks remained held through browser cleanup and
were then explicitly released; final independent cleanup is retained in
`owned-runtime-cleanup.json`. No boxes were assigned (ID/state/expiry null).
