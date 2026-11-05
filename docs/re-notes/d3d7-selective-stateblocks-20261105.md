# Selective D3D7 state blocks — 2026-11-05

Replaces whole-device snapshots with owned typed membership records. The locked full build, both shipped-module public COM fixture and seven focused regressions passed.

Start points are published `fa7ddefcc` [contract cause](d3d7-stateblock-contract-cause-20261105.md) and `f75de7a76` SetTexture lifetime supplement. Retained primary paths, SHA-256 values, narrow static analysis and test evidence belong under `scratch/runs/20261105-d3d7-selective-stateblocks/`; no source archives or binary/media copies.

## Contract and primary evidence

DX7 SDK `imover_5pgk` supplies exact PIXEL and VERTEX render-state/TSS lists, including their overlap. ALL includes current DX7 render-state enum members, not retired legacy render-state identifiers or arbitrary device bytes. Within existing renderer support, typed ALL captures viewport, material, initialized light parameters, defined light enables, clip planes, W/V/P and texture transforms, flags and stage-zero texture binding. VERTEX captures SDK-documented transforms, clip planes and light enables; material, viewport, light parameters and texture bindings are ALL-only. PIXEL includes only its documented render/TSS members.

The retained `d3dim700.dll.gz` decodes to file version 4.7.0.700, SHA-256 `e650b7bc9561e233a21544f9c2377d328c9d53adbb3d40c32838a13c937fe367`. Static Device7 vtable mapping identifies public CreateStateBlock at `0x566697e7` and its typed-population helper at `0x56670326`. ALL's paths directly pack viewport/depth, transforms, planes, 68-byte material, 104-byte initialized light parameters, enables and texture bindings. PIXEL's path packs RS/TSS only; VERTEX packs RS/TSS and enable records. Thus the binary resolves otherwise omitted typed material/viewport/light-parameter/binding membership without importing DX9.

There are concrete SDK/native-version discrepancies. Native VERTEX omits transforms and planes that the SDK explicitly promises. Native PIXEL additionally lists COLORKEYBLENDENABLE (144), omitted from the SDK list, and native ALL omits ZVISIBLE (30), present in the current enum. This repair follows the published SDK contract for those differences; it does **not** claim exact 4.7.0.700 binary equivalence. `native-membership.json` retains exact arrays and `inspect-native.py` reproduces narrow static disassembly from the existing compressed input entirely in memory. No original/native execution occurred.

Ordinary SetTexture owns its documented reference. Blocks keep a resource usable across caller release and release their own retention when replaced, deleted or destroyed. The exact native block AddRef/Release counts remain unknown. Tests assert resource usability and replacement, never invented exact block refcounts.

## Representation and behavior

Each entry belongs to canonical device-state identity, shared by QI aliases. Token zero denotes that device's recorder; completed tokens use a monotonic serial, preventing stale tokens from becoming valid after slot/device reuse. Different devices may record independently. Each block holds owned `{kind,index,value}` records. Repeated setters replace a key's value immediately. End changes only recorder status/token and fixes membership. Capture and Apply traverse exactly those keys.

Recordable setters intercept before live writes, so getters and drawing continue to observe live state. Struct values are copied at call time. Indirect light parameters, texture matrices and flags are values, never copied device pointers. Predefined ALL freezes initialized light-parameter membership, and ALL/VERTEX freeze defined enable membership; later Capture cannot add a newly defined index. Derived texture blend/mipmap markers follow selected setters and restore after replay, preserving effective last-write behavior. Device ownership lists, viewport links, scratch/composite matrices and unrelated state are never transferred.

Delete frees selected resource retention and block storage. Final device destruction retires finished blocks and unfinished recorders, releases its ordinary binding reference and frees owned indirect tables. Existing stage-zero binding, eight parameter slots and 32 enable bits remain unchanged. Blended WORLD1..3 transforms remain unsupported; recording rejects these instead of treating composite scratch as a transform. Unsupported TSS storage is not added. The silent-handler inventory pin changes 241 to 240 because BeginStateBlock now delegates real behavior. No held-viewport or sparse-client crash work is included.

## Validation

Run: `20261105-d3d7-selective-stateblocks`. Dependencies released in order: ReturnFire0305 `691020294`, MDK0320 `68423e88b`, Stronghold0325 `1bcfd0de4` (the latter released source-only earlier). `release-gate.json` independently verified retained normal browser cleanup for earlier dependencies, MDK's guarded ZERO-Chrome fixture processes/servers/profile, no heavy process, both free locks and sufficient disk before shared mutations.

- The old shipped canonical module failed `RECORDING LIVE ISOLATION: 1 != 2` (`old.log`, `old/failure-wine-assembly.wasm.json`). This is a regression discriminator, not native/original evidence. The initial fixture stopped before later cases; subsequent fixture corrections fixed GetViewport slot 15 and selected supported texture/diffuse colors for pixels. The unchanged first isolation assertion remains in the final fixture.
- `flock /tmp/wine-build.lock bash tools/build.sh`: PASS (`build-final.log`). Earlier build attempts exposed the required quiet-handler pin change and the struct gate's interpretation of a local named `entry`; state-block table locals now use `block_entry`, accurately distinguishing them from DxObject records. All final gates and both compiles passed.
- `D3D7_STATEBLOCK_EVIDENCE=scratch/runs/20261105-d3d7-selective-stateblocks/final flock /tmp/wine-local-runtime.lock node test/test-d3d7-stateblocks.js`: PASS, 1,071 public x86 COM calls and ten case groups per module, with exact stdcall, result guards and stack guards. `final/*.json` retains actual acquired vtables, thunks, arguments, HRESULTs and pixels.
- Public cases cover isolated getters/drawing, empty blocks, last-write keys, selected Capture/Apply, independent stage/ID/plane/light/enable masks, copied caller structs, indirect matrices/flags/lights, predefined overlaps and typed members, ordinary/recorded texture usability after caller release, invalid transitions/output/type/token, independent concurrent recorders, foreign/deleted/reused tokens and QI aliases. Capacity reached 32 blocks, the next Begin returned out-of-memory, and deletion recovered capacity. Forty devices with alternating completed blocks/unfinished recorders and retained surfaces/indirect tables were destroyed without exhausting the table.
- Public Surface7 Lock reads: derived blend last-write case `[255,0,0]`; before recording `[255,0,0]`; during recording `[255,0,0]`; after End `[255,0,0]`; after Apply `[0,255,0]`. A public Lock filled a texture solid red; vertex diffuse is green; recorded COLORARG1 changes TEXTURE to DIFFUSE. Expectations use exact independent RGB endpoints, not a production helper or unsupported texture-factor selector.
- Focused PASS: `test-d3dim-interface-spec`, `test-d3dim-transform-alias`, `test-d3dim-texture-stage-alias`, `test-d3d7-fvf-lighting`, `test-d3dim-texture-release-arena`, `test-d3dim-creation-interfaces`, `test-d3dim-multiply-transform-order`. Exact commands, process identities, durations and exit codes are in `focused-results.json` and individual logs.

Final module paths and SHA-256 values (files are referenced, never copied into the run):

| Existing path | SHA-256 |
| --- | --- |
| `build/wine-assembly.wasm` | `3859c274df0233659eb10fe4d2784fff7d1553242b4ae2b3bf653e5d2ebdd95b` |
| `build/wine-assembly.compat.wasm` | `9f042b70d7e43d3947415e1de01e7a540b3c7f7fa6c7fbefabdbea17e9633e95` |

## Limits and handoff

This implements state blocks for existing supported state; it adds no stage binding, light-index range, default-light creation, blended-world transform, held viewport or sparse-client feature. ALL light parameters freeze explicitly initialized supported parameter slots; enable membership freezes defined supported bits. Exact native state-block reference counts remain unknown. The SDK/native 4.7.0.700 membership differences above are retained, not presented as native equivalence. No original, browser, gameplay or benchmark was run by this worker.

Evidence records the base Git SHA, relevant binary diff and owned new-file patches; Git is the source archive. Boxes: ID/state/expiry NA; shutdown remains the coordinator's responsibility. Runtime and file ownership are released on the messageboard after publication. No further task or original observation is authorized by these fixture results.
