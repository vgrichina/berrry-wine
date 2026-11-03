# MDK2 WGL layer/font family — 2026-11-03

Input: published `c96b1b241c5f9a1d600d7ace0b7731deedfdc9b7`.
Evidence: `scratch/runs/20261103-mdk2-wgl-layer-font-family/` (ignored).

The candidate adds three native WGL handlers. Plane zero goes through the
ordinary context encoder, drawable binding and lifetime machinery. Other
planes reject; the pixel format continues to report no overlays or underlays.
See Microsoft's [layer-context contract](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglcreatelayercontext).

Bitmap generation reads the supplied DC's selected font through the existing
TrueType/bitmap GDI providers. Each defined glyph becomes one captured bitmap
command with actual ink, baseline origin and cell advance. GDI's top-down,
DWORD-padded rows become the list engine's bottom-up normalized pixels.
Missing glyphs become empty lists; spaces retain their advance. Construction
does not use or modify GL unpack state. This follows the
[font-bitmap contract](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglusefontbitmapsa).

Outlines reuse the TrueType parser's composite-aware contour loader and native
quadratic serializer at design-unit scale. Adaptive subdivision bounds the
chord error; zero tolerance selects one font design unit. A new geometric
scanline tessellator divides slabs at vertices and edge intersections, then
fills nonzero-winding intervals. It preserves holes, disconnected contours and
overlapping contours without replacing them with rectangles or a raster mask.
Line mode records contour segments; polygon mode records oriented caps,
normals and extruded side quads. Extrusion extends toward negative Z. Metrics
and the final list translation use em-normalized font coordinates. See the
[outline contract](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglusefontoutlinesa)
and [metrics structure](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/ns-wingdi-glyphmetricsfloat).

Both font handlers prepare private command chains and private, unpublished
name blocks before installing any list definition. Rejected inputs preserve
existing definitions, name reservations, GL errors and outline output.
Both handlers hold the existing process-wide GL object lock, including all
early returns; focused calls assert the lock is released. Lists enter the
existing shared namespace, so replacement, deletion and context
retirement use its normal ownership rules. Font construction does not execute
the lists or consume an existing GL error. Allocation/subdivision exhaustion
fails the request rather than publishing truncated glyphs.

Focused tests use public DLL/WGL-resolved stdcall thunks with stack/register
canaries. Separate FON and TrueType readers supply bitmap pixels, advances,
outline metrics, areas and interior/exterior masks. Additional checks cover
holes, composite glyphs, deviation, negative-Z geometry, normals, unpack state,
bad DC/context/ranges/formats, list replacement and shared-context lifetime.
Native and actual queued Worker execution pass, including contiguous ranges
and a subdivision-limit failure after several earlier glyphs were staged.
WebGL1/2 replay passes independent bitmap, filled-outline, composite, line and
oblique-extrusion pixels. Glyph-suppression controls retain bitmap advances but
remove ink: direct, queued Worker and browser tests fail their pixel assertions.
A separate mutation reinstating the eager list allocator fails the assertion
that a failed request must leave a fresh namespace empty.

Alice recovery explicitly released its inherited runtime at 22:17:52Z after
local full-SHA recovery, verified snapshot and normal stop. Only then was fresh
`bx_erf7ybua` allocated, expiry 23:18:51.495Z. This task owns its delegated normal
shutdown after complete recovery of both modules and a verified snapshot. No
coordinator-host heavy build, native run or browser run was used.

The full locked build passes. Canonical module SHA-256:
`cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`;
compatibility module:
`580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
Instrumented focused module:
`e7d6093e3a51d9f3dc0160b92c53b3efd4d44a7dadc0eb298460838fcfd556ea`.
Source seals record the exact published input plus the owned delta, excluding
foreign WIP. Git and the recorded binary patch supply source recovery; run
evidence retains unique logs, captures and tested modules rather than a source
tree archive.

First failures are retained: the pinned line-oriented cleanup checker needed
single-line cleanup stores; the fresh environment lacked PNG/Puppeteer
dependencies; test setup needed an established GL-error trigger and a new
context's own projection; a browser extrusion oracle sampled a contour extremum
inside its stated boundary tolerance. Repairs and successful reruns are recorded.
The A, O and extrusion WebGL screenshots were inspected.

The focused regression batch completed 34 suites: 33 passed immediately; the
context-copy browser suite first failed while saving into a missing output
directory, then passed after that directory was created. The original failure
and repair log remain separate. Coverage includes color index, bitmap boundaries,
selection/feedback, evaluators, display lists, context copying and shared
textures, with native, queued Worker and actual WebGL checks where provided.
The final object-lock change was followed by another locked build and direct,
Worker, WebGL1/2, glyph-suppression and rollback-mutation checks, all passing.

## Ordinary original run

All three prerequisites now have semantic evidence, so the original registered
`mdk2_demo` was attempted without changing its executable, media or config.
All 29 media hashes were checked before and after, both locally and on the box.
Executable SHA-256 is
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`;
manifest is `a0c90df1480e9e81c5734dca97a8e8b308c3709e87964433fe1f4df5875c6316`;
the 88-byte config is
`87261f003683d21f366e28e3c37c89d85804e69daaa2348b17da15bfe8e902ba`.

First attempts are retained separately. The first harness invocation lacked
existing `stdole2.tlb`; its exact existing input was supplied. The default
native GL backend then lacked its WebGL provider and returned context zero.
Its background launcher also lost its driver; the same live process was
adopted to recover logs and issue ordinary quit, without claiming an observed
exit code. These are environment/driver failures, not successful startup.

The subsequent ordinary software-renderer invocation used
`node --require <run>/observe.cjs test/run.js --app=mdk2_demo
--batch-size=100000 --no-build --wasm=build/wine-assembly.wasm
--quiet-api --quiet-blocks --gl-renderer=software --max-seconds=1800
--max-batches=200000 --control=8123 --frozen --no-close
--trace-input-dispatch --trace-api=<recorded WGL names> --png=<run>/game/final.png`.
The exact argument array is retained in `game/command.json`. Actual compilation
and instantiation recorded the canonical `cffca869…` module, rather than merely
hashing a file on disk. PID 26203 created the ordinary context and made it
current at batch 8. The frozen harness used its default 200 ms clock and
bounded steps of at most 64 batches.

The inspected route was: original window, black transition, Hectic comic
LOADING, then a textured 640×480 alien-room scene with Kurt, an enemy and HUD
(`game/startup3020.png`). Escape down/up through both window messages and
DirectInput led through black/resource-loading screens and another comic.
At batch 5270 the scene explicitly displayed **Demo**. Mouse down/up and Enter
down/up were delivered afterward; batch 5674 still displayed Demo. Input
counters and dispatch records are retained. The armed native fault latch
reported no failure at that terminal batch. This verifies original startup
and rendered attract mode, **not player-controlled gameplay or a completed
New Game/menu route**. No game memory, configuration or mandatory check was
patched. No synthetic replacement was run.

The remaining original-game resume condition is an observed ordinary logo/menu
interaction before the idle attract transition, followed by difficulty selection
and a capture demonstrating controlled movement or action. This allocation did
not establish that route. `game/controls.jsonl`, captures, actual module receipts,
all first failures and the driver's acknowledged ordinary quit with observed
exit code 0 (734.600 s, reason null) are retained;
`RECOVERY.md` records reproduction and lifecycle requirements.
