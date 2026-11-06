# Legacy texture operation-caps fixture recovery

Task: D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013. Restored
`test/test-legacy-texture-operation-caps.js` against current production sources.
No emulator implementation or advertised capability was changed.

Evidence: `scratch/runs/20261106-legacy-operation-caps-fixture/`. Initial
source identity: `570c67b16dfff9968d634861b7717e9546f31c2a`. Ordered predecessor
releases and fresh OS cleanup passed at 2026-11-06 02:36:58 UTC; the immutable
execution deadline was 03:21:58 UTC. No tests, builds or shared edits preceded
that gate. Git commits and binary/new-file patches provide source recovery;
there are no source archives or media copies.

The untouched test reproduced the retained `missing import signature
gl_texture_combine` failure. Sequential repair runs retained in the evidence
then demonstrated the remaining drift:

- Added authentic signature lookup sources for OpenGL texture helpers, stipple
  and the unsupported-operation diagnostic. Unhandled fixture imports still
  throw. A small fixture-local region resolves the diagnostic's real
  `region.addr`; the production forms remain verbatim.
- Included the actual mip-filter resolver now called by the GPU descriptor.
  Explicit doubles describe inactive immediate/state-block recording and absent
  GL border/secondary-target state. These doubles do not compute texture
  operations, samples, primary-target writes, capability masks or GPU lowering.
- RGB ADD now produces independent saturated sums: these operands yield
  `0x50ffffff`, retaining MODULATE alpha. Its original semantic red expectation
  of 255 remains. All six unadvertised-operation diagnostics still run; the
  other five retain their exact MODULATE fallback and semantic disagreement
  assertions. TextureOpCaps remains exactly `0xf`.
- Triangle filter caps now include the independently covered mip-filter bits
  `0x0003003c` in addition to the original `0x030003c3` base. The line mask,
  descriptor canaries, stage limits and other exact fields remain asserted.
- Updated the GPU SELECTARG mutation's textual anchor for the current op13
  branch. All 15 original rejecting controls still execute and reject.

The original independent supported RGBA vectors, reversed/white/zero inputs,
all 144 argument combinations, unsupported-selector refusals, CURRENT/unbound
behavior and both software outer routes remain exercised. The focused suite
passes with `--negative-controls`. The dependent DISABLE suite, capability
contract suite, GPU batching and GPU points suites also pass; DISABLE retains
its three rejecting reversions and the capability suite its seven controls.

`flock /tmp/wine-build.lock bash tools/build.sh` passed, producing:

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| wine-assembly.wasm | 2175789 | `881a4ffc816bb2a752febff01551ade99dfc5680dc8a3a6a4222f0bb8d2c1951` |
| wine-assembly.compat.wasm | 2178435 | `721dea351a4ac638cc275b9fa30101be050b0836eb6d44de0230e9edb38e2079` |

Both exact modules passed the existing generated x86 public COM caps fixture:
47 calls and 55 descriptors per module, including GetCaps/EnumDevices,
descriptor guards and stack checks. The run-owned software adapter reuses
`browserFixture` from `test-legacy-texture-rendered-contract.js` in the existing
Node VM harness pattern. It substitutes only a generated bootstrap PE for the
media route; its entry point is never executed. Published COM slots perform
resource creation, setters, triangle draws and Lock/Unlock readback.

Per module, the final software run passed 18 existing sampler observations,
144 operation/argument observations and six unadvertised-operation observations
(168 draws total). Both existing nearest/stale semantic controls failed at the
pixel oracle. The operation adapter uses independent texture/diffuse byte
vectors; its X8 target verifies RGB. Independent stored alpha remains covered
by the excerpt regression, not claimed for the X8 target. Native caps and
software observations are retained as JSON alongside exact module identities.

Concurrent incoming commits changed notes, a standalone Blobby helper and a
Quake II controls INI; no relevant emulator/compiler source changed during
validation. No emulator defect was demonstrated. No browser, game, box, public
deployment or screenshot was used. Box ID/state/expiry: N/A; no lifecycle
action was taken. Next: ordinary test-suite use of the restored regression;
runtime ownership returns to the ordered successor after final cleanup.
