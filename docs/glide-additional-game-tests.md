# Additional original Glide game probes

Functional runs on fast-near-9tb-1, using a clean source snapshot of main
`952c0367bce27eefac81bbbb55091d3a79b16fab` in
`/home/vg/glide-more-tests`. The full build passed. Native WASM SHA-256:
`f4faf192b022397ab2e676087b531232662a8eabb9cce18aabe8c5dd43e856c3`.
Chrome 152 used SwiftShader for WebGL. These are compatibility observations,
not hardware-GPU performance measurements. No production renderer changes
were made for these runs.

| Game / selected backend | Observed result | Remaining gap |
| --- | --- | --- |
| Hitman demo / WAT software | Actual Glide3 software endpoint; menu artwork rendered. Final sample at 242.2 seconds: 400,833 triangles, 436 presentations, zero renderer errors and zero LFB reads/writes. | The relative-mouse route undershot Start. This is menu coverage only; software world rendering and movement remain unverified. |
| GTA2 demo / WebGL | Original `dmaglide.dll` and `3dfx.dll` loaded after selecting both registry renderer names. Guest then exited with code 1006. | Startup blocked; no gameplay or successful Glide draw established. |
| Unreal Special Edition / WebGL | Original `GlideDrv.dll` loaded with the INI render-device keys set to Glide and fullscreen enabled. Guest trapped at runtime EIP `0x29a07fa`. | Initialization blocked; no Glide gameplay established. |

Hitman's software presentations copy CPU pixels; its zero GPU readbacks do
not mean zero copies. The new software menu screenshot was opened in Preview.
The missed menu click is a harness input limitation, not evidence of a renderer
failure. Earlier WebGL world/movement acceptance remains separate.

GTA2's exit code 1006 occurs at 201 original EXE call sites and is generic.
The existing log cannot establish a missing Glide function as its cause.
The next diagnostic is a breakpoint at original VA `0x4a05e0`, reading the
return caller and stack arguments: error code, source filename, source line,
and detail. No guest binary was patched.

Unreal's loaded module base was `0x299b000`, corresponding to original image
base `0x10600000`. The trapped address maps to original `0x106057fa`, an import
jump through `0x10606248`; the original import table identifies this as
`_grSstWinOpen@28`. This localizes the initialization boundary, but does not
yet identify the rejected argument or internal failure. The INI overrides
were supplied only in the isolated probe; original fixture files were retained.

Raw logs, per-sample state and screenshots remain under remote
`build/hitman-software-more`, `build/gta2-glide-more`, and
`build/unreal-glide-more`. The probe is an investigation harness, not a new
automated gameplay acceptance test.

See also the [proposed common rendering contract](render-command-unification.md)
and the existing [Glide3 corpus evidence](glide3-corpus.md).
