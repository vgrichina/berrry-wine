# Dark Reign 2: genuine D3D7 WebGL mip chains (2026-11-04)

The original WebGL startup now passes its HAL/RGB mip-filter capability gate and loads original Demo Mission 1 on Normal and renders selected-unit movement after an ordinary move order. This change implements the sampling behind those bits; it does not merely relax enumeration. Run: `scratch/runs/20261104-dark-reign2-webgl-mip-chain/` (ignored evidence).

## Implementation

`src/09ab-handlers-d3dim-core.wat` extends the bounded GPU descriptor with independent MIN/MAG/MIP settings and exports validated successor metadata. Each successor must be a live, checked surface, halve both dimensions toward 1x1, have valid pitch and DIB bounds, and carry TEXTURE|MIPMAP without ZBUFFER. The existing native chain validator supplies the attachment/COM checks. JavaScript copies each descriptor before reusing the seam, follows at most 12 images (2048 maximum dimension), and uploads each real image with its own dimensions, pitch, format, palette and content generation. Missing/malformed successors clamp at the last valid image. Lower-level writes change the composition key through the existing per-image dirty tracking.

`lib/d3dim-gpu.js` transports those explicit images and three independent filters to the owning `lib/d3d9-backend.js` renderer. The backend uses its existing derivative-based mip atlas shader for these chains, including partial chains, on WebGL 1 and 2. No generated substitute mip pixels or forced fixture LOD supply the D3D7 result. One-image chains use the backend's existing exact single-level clamp. Cross-level keyed coverage remains an explicit unsupported path, as in the native sampler; anisotropy is not newly advertised.

A real startup exposed a pre-existing enum mismatch in the shared native filter helper: DirectX 7 `D3DTEXTUREMIPFILTER` is NONE=1, POINT=2, LINEAR=3. The internal sampler and D3D8/9 backend use 0/1/2. Normalize at the D3D7 boundary, retaining unset/explicit-NONE tracking and legacy combined filter behavior. Both regressions now use SDK values. The [SDK d3dtypes.h](https://raw.githubusercontent.com/apitrace/dxsdk/master/Include/d3dtypes.h) is the enum reference.

After the actual renderer regression passed, triangle filter caps changed from GPU `0x030003c3` to `0x030303ff`, matching implemented native/GPU point/linear mip filtering. Line caps remain `0x030003c3`; legacy descriptors are unchanged.

## Validation

- Serialized full build: `flock /tmp/wine-build.lock bash tools/build.sh`, PASS; `full-build-sdk-enum.log`.
- `test/test-d3dim-gpu-mip-web.js`, PASS 37 pixel observations per actual WebGL 1 and 2 context. Full production WAT resource/state/draw closure calls the real adapter and owning backend. Distinguishable levels, minification, perspective quotient derivatives, vertical gradients, point/linear mip interpolation, differing MIN/MAG, legacy states, explicit NONE, padded RGB565 metadata, truncated/missing/cyclic/bad-COM/depth attachments, lower-level mutation, caps and GL errors are covered. Zero renderer errors/fallbacks. Evidence: `sdk-enum-generic/`, `d3dim-mip-sdk-enum.log`.
- Baseline adapter negative control fails the first distinguishable coarse-level assertion (red mip0 instead of green mip1): `d3dim-mip-baseline-control.log`.
- Native mip test PASS 38 observations with SDK enums, expected named keyed-mip rejection included: `native-sdk-fixture.wasm`, `native-sdk/`, `d3dim-native-sdk.log`.
- Existing batching browser regression PASS. Its synthetic SELECTARG1 descriptor omitted TEXTURE selectors and failed identically with the baseline adapter; specifying the intended color/alpha texture arguments repairs the fixture. Fast batching unit test also PASS. No rejected queued-texture-lifetime diagnostic was inspected or continued.
- Test-tier classification check PASS. Heavy/browser tests ran only on assigned box; no local Chrome.

## Runtime and reproducibility

Requested baseline: `7e9ced57554dea0a9a18e038a0b6b88ab8d1083a`. Prepared runtime source: `1188e9bf57ef35bd3363fb88b7ca0da442ce696d`. Shared main advanced through documentation commits while testing; the pin manifest records `334eacb19076a573fcb2cc99fe4acc4217b42198`. There were no intervening runtime source changes in src/lib/tools/host.js. `final-source.patch` records relevant owned uncommitted code and new test hunks. Runtime pins record 1461 exact existing paths with full hashes, including game media; media was referenced in place, never copied into evidence. Final pin verification has zero mismatches. Unique modules/logs/captures are retained without source archives.

| Module | SHA-256 | Use |
| --- | --- | --- |
| Canonical, 2,143,712 bytes | `1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58` | Built, served, compiled in page and sent to guest/render workers; actual bytes recovered |
| Companion compatibility, 2,146,325 bytes | `74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66` | Built and preserved in `modules-final/`; unexecuted by original Chrome run |
| WebGL regression production closure | `ebf8a9ec7d24d918b2c09741a83f84d44a16d37ab0b79254b5ddd5e40c30193d` | Executed WebGL 1 and 2, `sdk-enum-generic/fixture.wasm` |

The first implementation iteration reached shell initialization but rejected SDK LINEAR=3 in the owning renderer. Its first failure, screenshot and both corresponding modules remain in `browser/` and `modules/`; the enum fix above resolves that concrete dependency. This was this mip task's startup test.

The corrected run `browser-second/` reached the reviewed mission menu at frozen step 2048 (32 sequential requests of 64). The actual owner was the render worker's OffscreenCanvas WebGL2 context on Intel Mesa/ANGLE, with 4439 observed drawArrays calls, 318428 reported triangles, zero renderer errors/fallbacks and zero completed software draws. Canonical-module identity was observed at page compilation and transmission, then worker instantiation of the received module. The reviewed original screenshot is `browser-second/startup-2048.png`; generic fixture pixels are separate evidence.

The next operator command supplied a screenshot name with `.png` although the controller expects a basename. Its guard halted before mouse delivery. One rejected follow-up move and step were recorded; no mission input was delivered. This is a harness error, not a game dependency. Chrome closed cleanly with exit 0 at 02:20:33Z; that complete attempt remains intact.

A fresh bounded browser launch reused the same prepared files and hashes. An intermediate launcher failed before Chrome creation because its renamed observer file was missing (`dr2-mip-third.log`); the subsequent `browser-fourth/` attempt includes the observer and is the actual onward run. Ordinary balanced inputs first opened and closed the difficulty list (Normal retained), moved the relative game cursor onto Load Mission, and loaded the mission. Loading screens and the original rendered mission introduction followed. Screenshot filenames are labels; the adjacent JSON contains the authoritative frozen-step count.

Media recovery references (all other exact hashes remain in `runtime-pins-final.json`): existing `test/binaries/candidates/dark-reign2-demo/extracted/Files/dr2.exe`, SHA-256 `6aa93ded56537ff9ceb6f47d0bbe2de74b5b2b83c6932d61eb98e69d797756ed`; `packs/base.zwp` under the same Files directory, SHA-256 `a3df5e6adb8a11f9a3e00a44027890cd7a2de2df98c49b8098468c9010954206`; `missions/demo/Demo Mission 1.zwp`, SHA-256 `7b1f52b45ca8681509696521489f24f82017dc9e787f2674044a91ea49f794e1`.

## Original mission movement and handback

The completed onward run is `browser-fourth/`. Reviewed captures show mission HUD and units at actual step 10096 (`onward-checkpoint.png`), drag selection at 10256 (`selected-before.png`), and Shift-M move cursor over open ground at 10320 (`move-ready.png`). After **100 frozen steps without a ground click**, selected unit positions remain stable at 10420 (`move-no-order-100.png`). A balanced left click then consumed 32 steps while held plus 100 after release; the capture at 10552 (`move-after-100.png`) shows selected units advancing toward that ground point. These are frozen scheduler steps, not claimed game frames.

For example, the upper selected vehicle center changes approximately from viewport (496,436) to (426,436); selected lower soldiers move from roughly (414,613) to (360,579), and (450,698) to (395,650). The central support tower, pipes, paving and HUD stay fixed. The preceding no-order interval shows stable unit positions, separating commanded translation from idle pose changes. This is original gameplay evidence, separate from generic fixture pixels, and is a bounded movement check rather than mission completion or a performance claim. No game patches, cheats, guest-state writes or input-state injection were used.

At the post-order capture, the owning render worker reports an OffscreenCanvas WebGL2 context with 43232 observed drawArrays calls. Natural runtime stats report 43210 draws / 1661153 triangles, zero errors/fallbacks, and zero completed software draws. Module transmission/worker instantiation and actual canonical module bytes are retained again in this run. All input presses were balanced; command/step acknowledgements are sequential and each step request is at most 64. The intermediate screenshot during an active multi-request helper was processed between requests by the single controller; its adjacent JSON, not its optimistic filename, records actual step 6992.

Browser-fourth closed at 02:28:17Z with Chrome exit 0. Browser-second and browser-fourth together used about 10m16s; the first original implementation attempt used about 3m14s. Generic browser tests were short finite runs, keeping total browser use below 25 minutes. The intermediate missing-observer launcher created no browser. Unique captures, logs, canonical and compatibility modules, and exact binary patches remain under the run directory. No source trees or repeated media were archived.

Assigned `bx_44kza28q` is left RUNNING/API idle, healthy, with unchanged expiry **2026-11-04T02:47:04.645Z**. The coordinator retains shutdown ownership; no lifecycle or TTL action was taken. No further game dependency was observed through this bounded movement check. Next work can evaluate broader mission rendering/behavior or performance separately; keyed cross-level mip coverage remains explicitly unsupported.

Final recovery verification (`fourth-verification.json`): all 214 commands acknowledged; 10552 frozen steps, maximum request 64; all 220 sealed HTTP responses match their pinned bytes; no unmatched key or mouse press. All 1461 runtime pins still match after testing. The run-specific evidence check has no containment, missing-artifact or schema errors. The global checker still reports historical problems belonging to other runs (16 containment, 6248 missing references, 321 invalid records); none were edited here.
