# Current public cube rejection and independent-axis mip addressing

`D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013`: both current shipped modules pass
the selected public COM contract. No emulator discrepancy was demonstrated,
so no production WAT/JS or capability mask changed. The change adds
`test/test-legacy-addressed-mip-cube.js` and registers it as an E2E regression.
Evidence is in `scratch/runs/20261106-legacy-current-cube/`.

The original cube request was already covered: accepted `1329b1ba6` executes
DD7 rejection, output/descriptor guards, null output and subsequent 2D pixels
through software, direct WebGL and owning Workers on both retained modules.
See [the existing audit](legacy-caps-cube-border-20261104.md). The source-only
Surface4/7 tests and historical patches were neither duplicated nor integrated.

The nearest uncovered advertised behavior was **independent MIRROR/CLAMP
addressing on spatial mip chains**. The accepted
[MIRROR regression](legacy-mirror-gpu-worker-20261104.md) explicitly excluded
mips, perspective and WebGL1; the current public spatial-mip fixture addresses
both axes with WRAP. This regression adds signed/outside coordinates, per-axis
transitions and mip/perspective coverage, plus DD4/DD7 cube rejection while an
ordinary texture is already bound to a live Device7.

## Contract and execution

The test adapts the existing exported public mip fixture using unique checked
seams. It boots the complete production module, initializes COM thunks after
`load_pe`, and emits actual x86 indirect calls through acquired public vtables.
The existing `calc.exe` is only the bootstrap; no original game runs. Surface
creation, binding, sampler states, draws, GetTexture and Lock/Unlock all use
public COM. No private state repair or fabricated surface records are used.

After nine successful ordinary draws, the live device uses MIRROR U / CLAMP V,
linear spatial filtering and nearest mip selection. Public GetTexture confirms
the original binding. QI acquires DD4; both DD4 and DD7 request caps2 `0x0600`
(cube plus positive-X face) and `0xfe00` (cube plus all faces), with DDSD_CAPS
selected in guarded 124-byte DDSURFACEDESC2 inputs. Each call must return
`0x80004001` / E_NOTIMPL, clear the poisoned output to NULL, preserve all four
neighboring guard words and every input descriptor byte. GetTexture afterward
must return the same bound surface. Inspection references are released, then
the ordinary draw proceeds without rebinding or repairing the device.

This is the existing unsupported-cube contract, not a Windows requirement to
return this particular HRESULT. Microsoft documents the cube/face flags in
[DDSCAPS2](https://learn.microsoft.com/en-us/windows/win32/api/ddraw/ns-ddraw-ddscaps2).
The retained DX7 SDK address definitions and earlier independent oracle are
documented in the MIRROR audit. Microsoft's
[MIRROR description](https://learn.microsoft.com/en-us/windows/win32/direct3d9/mirror-texture-address-mode)
also describes alternating reflections at integer coordinate boundaries;
this later API page is corroboration, not a new DX7 mip-selection authority.
The existing public mip coordinate/LOD contract and tolerance are unchanged.

Actual current GetCaps texture masks are `0xf3df` and address masks `0xf7`:
cube and PROJECTED are absent; WRAP/MIRROR/CLAMP/INDEPENDENTUV remain present;
BORDER remains absent. The older `0xf7df` mask in historical notes predates
the separately accepted PROJECTED correction. No mask was restored here.

The independent oracle folds each tap's continuous center separately in U/V
at each mip, then interpolates spatially and between levels. It calls no
production sampler, shader or descriptor helper. Every WRAP result is checked
against the unchanged existing mip oracle, with two additional literal
hand-calculated negative-U/CLAMP-V answers. Twenty-eight states cover point
base sampling, bilinear nearest-mip sampling, trilinear sampling, reversed
perspective gradients and restored addressing. Three integer-center samples
per state produce 84 RGB observations per ordinary route, at tolerance 2.

## Results and visual review

| Per module | Software | Direct GL1 | Direct GL2 | Owning Worker GL1 | Owning Worker GL2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| RGB observations | 84 | 84 | 84 | 90 | 90 |
| Cube rejections | 4 | 4 | 4 | 4 | 4 |
| Draws | 28 | 28 | 28 | 34 | 34 |
| Rendered controls rejected | 3 | 3 | 3 | 3 | 3 |

Both modules together pass **864 RGB observations, 40 cube rejections and
30 rendered negative controls**. All four owning-Worker routes report actual
WebGL1/2 versions, zero errors/fallbacks and zero native/fallback software draw
completions. Twelve held production batches preserve immutable snapshots
while live per-axis state changes; subsequent public Lock fences observe the
old captured state, and the next draw observes the changed state.

Controls force WRAP for MIRROR, couple V to U, or force mip level zero. Each
reaches a successful public DrawPrimitive7 and fails the actual pixel oracle;
bootstrap failures do not qualify. Planner sensitivity counts are 30, 39 and
63 respectively. Four offline rejection-result controls reject success,
non-null output, a corrupted actual guard word and a changed descriptor.
These replay controls do not mutate emulator state.

`numeric-review.json` independently recalculates every stored observation and
checks worker counters, rejection records and held-batch counts. Maximum RGB
channel error is **1.7067087227453897**, below the unchanged tolerance 2;
all WebGL routes have maximum error 0.5. Actual browser screenshots and all
280 complete per-state public-Lock images were personally inspected through
`all-browser-witnesses.png` and `all-readback-states.png`. `sheet-labels.json`
records panel and tile order. Worker final browser captures depict the extra
queued-state draw; direct/software captures depict the final perspective
state. Their different final patterns are expected. These are generated test
images, not gameplay evidence. PIL was unavailable during sheet preparation;
existing pngjs generated the retained sheets without dependency installation.

The unchanged current capability fixture also passes **47 public calls and
55 descriptors on each shipped module**. Its offline replay detects 1,263
negative controls. The new planner, public mip planner, tier validation and
tier regression pass, as does the mandatory locked full build.

## Identity, limits and recovery

Source base is `df76481b972d2b2baf8051e23fb12193adc18458`, plus the recorded
owned test/tier patches. `source-seal.json` records relevant source hashes;
binary Git diffs preserve relevant tracked changes and the owned new test.
Git is the source archive; no source/media archive was created.

| Actual shipped module | Bytes | SHA-256 |
| --- | ---: | --- |
| Canonical | 2180788 | `280014368b95a768bd31397971715f5d95089c3a22d018758b5d58f3d4a1650e` |
| Compatibility | 2183434 | `7d476f1d52fdc4538de94a436df69164eb02df26285c3a50a2b0516ec4996eca` |

Runtime used Node v24.18.1 and Chrome 151.0.7922.108 locally. CDP identifies
ANGLE Vulkan SwiftShader/Subzero driver 5.0.0. This qualifies actual owning
Worker WebGL execution, not physical GPU hardware or native Windows behavior.
Cube storage, BORDER-color support, other formats/dimensions, guest-program
gameplay and the historical 27-app audit remain open. No test box was assigned
or created; box ID/state/expiry/ownership are null.

`RECOVERY.md` in the run directory gives exact retained modules, source patch
and replay commands. Command metadata records supervised PIDs, ports and
profiles. Cleanup is checked before the root result is written last and the
runtime/source/build ownership is released.
