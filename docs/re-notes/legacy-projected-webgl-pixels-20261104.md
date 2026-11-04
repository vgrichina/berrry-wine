# Supplied COUNT3 projection: rendered repairs and remaining checks

This task found and repaired two production defects in the supplied FLOAT2,
stage-zero TEXCOORDINDEX=0 COUNT3|PROJECTED path introduced by `e947be8ad`.
PROJECTED remains unadvertised. The complete requested browser matrix is **not
accepted**: canonical direct/indexed WebGL1/2 passed, while queued completion,
compat browser cells and rendered semantic fault injections remain outstanding.

Evidence is in `scratch/runs/20261104-legacy-projected-webgl-pixels/`. Read with
[the supplied-coordinate implementation](legacy-supplied-uv-projection-20261104.md)
and [the earlier eye-plane fixture](legacy-eye-atlas-render-20261104.md).

## Production defects

The first real WebGL1 public Draw rendered texture at the near-clipped pixel
(1,1), where the independent oracle expected the public Clear color
`[11,22,33]`. `D3DIMGpu._draw` clamped negative prepared Z to zero whenever both
depth testing and writing were disabled. Internal type 4 represents originally
untransformed geometry; its Z still determines geometric near/far clipping.
The adapter now preserves that Z. Public TL depth-off UI and line behavior keep
their existing rules. The focused depthless-Z regression tests both behaviors.

After that repair, the independent-w mip case at (8,12) sampled level 4
`[176,149,138]` instead of level 1 `[59,56,57]`. Its retained neighborhood also
contains erroneous black fragments. The fixed compiler encoded finite input
as a varying equal to one, then required `>=1` in the fragment shader.
Perspective interpolation can round this below one. Rejecting such valid
fragments also replaces neighboring helper UVs with zero, corrupting implicit
mip gradients. Finite input is now encoded as zero, which interpolation
preserves exactly; any nonzero invalid-input flag rejects the sample. Both
fixed and mixed fixed-vertex/programmed-pixel producers and consumers use the
same encoding. Compiler controls cover both linkages and a float32 reciprocal
rounding witness. Mixed programmed-pixel GPU rendering was not exercised here.

Both repairs were made and retested inside the same Chrome process. The full
canonical direct/indexed WebGL1/2 cells subsequently passed without changing
the rational oracle or tolerance.

## Browser outcomes

Exactly one Chrome 151.0.7922.108 ran, from **07:11:54.823Z to
07:15:05.827Z**, and closed normally. It ran on assigned **bx_9n42uwvf**.
CDP SystemInfo reports ANGLE/Vulkan SwiftShader (SwANGLE 5.0.0). The contexts'
unmasked renderer strings report ANGLE/Intel UHD 620/Mesa 23.2.1; this conflicts
with CDP and is retained explicitly, not treated as physical GPU evidence.

Each of canonical direct and indexed × WebGL1 and WebGL2 passed **20 public
Draws / 66 observations**: 60 interior RGB samples and six clipped-away Clear
samples. Across four cells, this is **80 Draws / 264 observations**, each checked
through synchronous public Surface7 Lock and an additional direct GL readPixels
at the same position. Tests cover nonconstant texture q, independent geometric
w, near clipping with/without perspective, unit-q/half-q and disabled controls,
and four UV scales selecting mip levels 1–4. The five-level 16×16 chain is
created, acquired and filled through public COM calls. No shader/compiler
recording result is counted as rendered pixels.

The canonical WebGL1 owning-Worker cell passed its initial 20 Draws / 66
observations. Two queued projected Draws then passed seven old-state samples
after the live TEXTURE0 matrix and flags were mutated before held production
batch delivery. Worker stats identify the legacy WebGL endpoint, zero errors,
zero fallbacks and zero native/fallback software Draw completions. The cell
later stopped at a post-mutation projection-disabled sample at (12,12): its
ideal V×16 was 6.978890…, close enough to a texel boundary that the established
1/16-pixel TL fill displacement crossed it. This is distinct from the two
production failures above. The fixture now retains stable interior samples for
that post-mutation control, while keeping every projected/clipped old-state
sample. New analytic checks ensure unchanged colors/mips under that existing
displacement. Oracle coordinates and tolerance 2 are unchanged.

That final fixture correction passes Node/compiler/transport preflight but
**has not been rendered**. The one-browser allowance was exhausted when the
driver closed after its two in-session repair slots. An additional bounded
repair retest was requested for clarification; none was launched without an
answer. No complete queued cell, compat browser cell or browser negative
control pass is claimed. The five implemented fault controls preserve public
COM and GPU staging and require a rendered PIXEL ORACLE rejection; their actual
browser executions were unreached.

## Checks and recovery

Before Chrome: actual Puppeteer 24.31.0 CJS and ESM imports, retained dependency
lock hash, served source/module/media pins, HTTP isolation, both actual module
public COM bootstraps, and public Draw → production adapter/texture decoder →
fixed compiler → recording submission transport passed. Modules and calc media
were referenced by path and SHA-256. The old retained modules predated supplied
projection, so the necessary current canonical/compat modules were transferred
once; old modules were moved to `.pre-projection`, not repeatedly copied. Only
changed required source files and small fixture inputs were staged.

Both actual production modules also pass
`test/test-legacy-texture-caps-native.js --projected`: 216 positive software
sample pixels, 72 clipped-away pixels and five rendered semantic negative
controls per module, including physical native Worker replay. This remains
software acceptance, separate from browser coverage. Focused GPU depthless-Z,
batching, fallback counters, command capture, fixed TL plan cache, numerical
fill-displacement diagnostic and new projection compiler/margin controls pass.
`flock /tmp/wine-build.lock bash tools/build.sh` passes. PROJECTED is asserted
clear in actual public descriptors.

`initial-closed-result.json`, `first-failure-0.json` and
`first-failure-1.json` preserve all three browser stages and synchronous RGBA
arrays. `readback-independent.png`, `readback-near.png` and `readback-mip.png`
encode selected exact public GPU-fenced RGBA arrays; they are not canvas-export
screenshots. These were inspected. `native-{canonical,compat}/` preserves the
separate software assertions. `remote-artifacts.json` and recovery logs verify
full SHA-256 and sizes of the unique closed artifacts. Git SHA, relevant binary
diffs, per-repair diffs and owned new-file patches provide source recovery;
there is no source snapshot/archive or media archive.

The focused fixture is `test/test-legacy-projected-webgl.js`. `--plan` performs
source/compiler/numerical checks only; `--preflight` adds actual module/public
COM and served transport checks without Chrome. Browser mode requires
`LEGACY_PROJECTED_EVIDENCE` with a source seal and accepts an explicit future
`LEGACY_PROJECTED_HARD_CLOSE` ISO time. Its default current-task close deadline
is 07:45Z and runtime remains capped at 14 minutes. A future authorized run
must repeat source/module/HTTP preflight against its own current pins.

Next is the corrected full queued/compat matrix and the rendered fault controls
on an explicitly authorized browser allowance. COUNT4, generated coordinates,
other selectors/dimensions, singular/nonfinite-q combinations, wrap/fog
combinations, hardware and games remain unqualified; no capability restoration
is justified.

The assigned box is left **RUNNING**, expiry
**2026-11-04T08:04:15.847Z**. Browser and test processes are closed; the
coordinator owns shutdown. No lifecycle change, source-box access, subworker,
successor, public deployment, local heavy runtime or game execution occurred.
