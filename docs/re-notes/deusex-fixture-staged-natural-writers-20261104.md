# Deus Ex staged-fixture controls: terminal driver companion omission

**All required execution controls passed, but the sole Chrome session stopped
before game launch.** This worker copied `native-paths.json` into its local run
and then uploaded only `*.cjs` helpers. The unchanged prepared driver attempted
to read that missing JSON companion and failed with ENOENT. This is a staging
error, not a demonstrated emulator or game defect. The first-failure rule was
honored: no retry, reload, second Chrome or natural collector interval followed.

Predecessors are [natural ordered writers](deusex-natural-ordered-writers-20261104.md)
at `dea7f0a79fcb1e038111df0bd1beea6cf993bf0d` and
[Worker integration](deusex-worker-observer-integration-20261104.md) at
`0d3a8cbedfd04773d46701db2d940a18daa6d180`. Evidence is retained in
`scratch/runs/20261104-deusex-fixture-staged-natural-writers/`.

## Completed controls and served-byte checks

The explicitly authorized existing Notepad fixture was staged at the assigned
runtime's `test/binaries/notepad.exe`: **53,248 bytes**, SHA-256
`e7b01ab85a35ba6f577067d13efa522dc3d605de7712340e4acaf7065f866340`.
No game media, module binary or source tree was copied. The existing archived
control capture was losslessly decompressed to a run-specific raw path for
replay; its SHA-256 is
`77096a5d507c4536acdc23127476bcc9b5591148facef700a4cce8644bf6123a`.
The compressed original was preserved.

`offline-terminal.json` records eight successful commands:

- Byte-exact composition and prepared-driver bounds regression.
- Browser cache graph checker with self-test.
- Exact published `integration.cjs` (`a7e61017…`): physical Workers, two fresh
  bases, instruction/block modes, whole-memory/state/return and trap parity,
  zero-store control, and module-generation pending-pair rejection.
- Exact queued `transport.cjs` (`b201cb17…`): actual shipped guest-worker path,
  24 instruction-mode and eight block-mode slices with parity.
- Exact original optional/pixel control (`1be33be0…`): absent/true/false optional
  predicate, actual zero/positive stores, cold/warm successor and MMX slot 0.
- Exact replay (`fdb1acd8…`): 16 archived input replays, all eight MMX registers
  and seven discriminating arithmetic controls.
- Prepared composed-actual test (`afdf1f5f…`), including the ordered attachment.
- Actual driver imports, Puppeteer 25.7.0 CJS/ESM, current page/Worker dependency
  graph and **157** pinned HTTP inputs with isolation headers and `no-store`.

All **566** refreshed pins matched immediately before launch. The five changed
baseline pins were explicitly recorded: two D3D JavaScript dependencies, two WAT
fragments and the predecessor-rebuilt module. The four source hashes match
published `0d3a8cbed`; these are explained predecessor reconstruction differences,
not silently repinned inputs. Both served WASM files were additionally checked:

- `build/wine-assembly.wasm`, 2,146,525 bytes:
  `4ddc8336097ef4b8503c6e6d2bb7fb05a2a1084800322523c8959b7128ca217a`.
- Actual `build/wine-assembly.compat.wasm`, 2,149,138 bytes:
  `d4c5171a2865a1dbc360d53e3a32fbfa2149e1bcdabaf57ee6dad4bd9338a367`.

These checks qualify their measured inputs. They do **not** establish complete
driver prerequisite coverage: the omitted JSON was absent from the new manifest.
Importing the actual driver loads its code without executing its later filesystem
read. The preflight therefore missed a required companion despite passing every
listed pin. The prepared driver and producer composition themselves remained
byte-identical to `dea7f0a79`.

## Terminal failure and remaining prerequisite

Chrome PID **15742** launched at **12:07:38.880Z**. At **12:07:43.412Z**, driver
PID **15734** failed reading the assigned run's `native-paths.json`, after reading
the original app registry and before selector selection or game launch. Cleanup
closed Chrome and HTTP at **12:07:46.518Z**; supervisor returned code 1. The full
eight-minute window plus five-minute recovery reserve had fit before launch.

The missing file exists locally and is the exact predecessor companion:
**1,171 bytes**, SHA-256
`7c37fb7cc2321763d157a237c5ea12330291421d015dc36fdee16efb3679fc8a`.
`offline-diagnosis.json` ties its omission to the `*.cjs` upload filter. A separately
authorized attempt must stage that companion and assert that every actual driver
filesystem dependency is present and pinned before Chrome, then repeat final
qualification. This task makes no runtime repair or speculative pixel fix.

There is no fresh natural descriptor, palette allocation/selection, overlapping
light/palette/shift-mask writer or owning Draw evidence. No original guest calls,
register/code/ESP/EIP/argument writes, forced Draw or repaint occurred. No fresh
raw pixel buffer or host/surface capture was produced, so no personal visual
review is claimed. Pointer transitions still would not prove allocation lifetime;
instruction/block gaps and causality remain unresolved. Fixture and archived
replay results do not supply natural evidence for this attempt.

## Recovery and custody

All **292** remote run files (**5,621,278 bytes**), including the closed Chrome
profile, were recovered or matched to exact staged inputs with size and SHA-256
verification. A second final inventory matched every file. The exact transport's
result at its helper directory was also recovered and verified. Git SHA, relevant
binary diff and small patches provide source provenance; no source archive was
made. No production code changed and no full-build claim is made.

Final process verification found no remaining own compiler/supervisor/driver/
Chrome PIDs and no listener on port 8123. Box **bx_g8gbdt7c** is left **RUNNING**
(API `idle`, healthy/hydrated), expiry **2026-11-04T12:34:58.651Z**. Custody is
returned to the coordinator, who owns shutdown. This worker stops after publishing
this note, with the concrete staging prerequisite and no natural-gameplay claim.
