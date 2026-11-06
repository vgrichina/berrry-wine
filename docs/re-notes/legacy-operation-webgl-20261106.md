# Legacy advertised texture operations through browser WebGL

Passed. Run: `scratch/runs/20261106-legacy-operation-webgl/`.
Tested main: `22d1526cf7b249d40151ed3419484f5380ac4b22`, plus the recorded
new-file patch for this regression. No production defect was demonstrated;
no emulator implementation or advertised capability was changed.

The new focused `test/test-legacy-texture-operation-web.js` reuses the public
x86 COM fixture in `test-legacy-texture-rendered-contract.js`. It targets both
shipped modules, direct WebGL and the owning CPU/render Worker route, and
explicit WebGL 1 and 2 contexts. Native backend topology is not qualified.

The argument matrix covers all 144 operation/argument combinations
twice: RGB and an independent alpha witness. Binary channel vectors keep all
same-operand products exact; eighteen richer independent channel vectors
exercise integral nontrivial products. White RGB with SRCALPHA/ZERO blending
exposes stage alpha as RGB on the actual X8 render target. It does not infer
alpha from the unused X byte. ARGB source texture formats, setter round trips,
stdcall stack cleanup and output guards use public COM calls.

CURRENT, DISABLE, all nine unbound operation pairs, peer device isolation, and
a held owning Worker batch with changed live setters are included. Public
GetTexture verifies binding retention through DISABLE and null while unbound;
re-enabling without rebinding restores the texture. DrawPrimitive7 and
DrawIndexedPrimitive7 alternate. Operations 5–10 remain
explicit UNADVERTISED diagnostics. TextureOpCaps must remain exactly `0xf`.
Semantic controls change operation/argument lowering or captured Worker state;
they must fail real pixel arithmetic after successful draw calls.

Aranna0205, Conan0240, then KKnD0245 final releases and independent process,
port, profile, lock and disk checks preceded the immutable execution window:
03:56:06–04:41:06 UTC. All tests finished by 03:58:43. The first cheap dependency
check caught an assumed Puppeteer directory layout before Chrome; the runner
now imports the installed package's resolved entry. That failed attempt is
preserved separately. Public COM preflight then passed 5,557 calls per exact
module with no draws, covering resource formats and every case's setters.

Exactly one Chrome 151.0.7922.108 session ran from 03:57:44 to 03:58:42, exiting
normally with code 0. Actual context VERSION strings proved WebGL 1 and 2;
the reported renderer was ANGLE / Intel UHD Graphics 620 / Mesa 23.2.1.
The result does not infer the renderer from requested launch flags.
The supervisor also observed a transient timezone-probe profile; both that
profile and the test profile were absent after the session closed.

| Module | Bytes | SHA-256 |
| --- | ---: | --- |
| wine-assembly.wasm | 2176554 | `3bc4e29b86d3a085bf14de1a242f87f22321d513f26cb2259f22804d0c32dc7e` |
| wine-assembly.compat.wasm | 2179200 | `473ec05b5b10c5d6fa653d042b0aec4821804d6e6c5adf1e3ec8c0d744d4f2bc` |

All eight module × direct/owning-Worker × WebGL-version cells passed. Each
cell executes 340 operation/argument/edge/diagnostic cases, plus peer and
DISABLE/re-enable checks. Direct cells passed 343 draws and 344 public COM
readbacks each; Worker cells passed 345 draws and 347 readbacks each. Total:
2,752 positive GPU draws, 2,764 completed 8×8 readbacks, and 530,688 independent
RGB channel comparisons across their full targets. Direct cells also check
actual gl.readPixels results. All routes report zero GPU errors/fallbacks;
owning Worker statistics additionally prove zero native/fallback rasterization
and actual legacy WebGL endpoint identity. Each draw has a real fence/readback.

Ten controls (five per WebGL version) reject at their designated pixel
observation after successful public draws: swapped SELECTARG lowering, lost
TEXTURE arguments, ignored alpha operation, wrong CURRENT mapping, and changed
captured Worker operands. The final control edits only the held command's
actual 4KB state. Served mutation hashes and captured before/after operands
are retained. Expected arithmetic is unchanged by every control.

The restored operation-caps suite passed its 15 rejecting controls, supported
pairs, 144 argument cases and six unadvertised diagnostics. DISABLE (three
rejecting reversions), DISABLE capability (seven controls), GPU batching and
GPU points checks passed. The required locked build passed, including after
the dependency-loader repair. Final WAT closure, production JS and module
hashes matched the tested inputs. All eight generated positive captures were
personally inspected; they show generated regression tiles, not gameplay.

Run after building with an explicit ignored evidence directory and fixed
deadline, for example:

```sh
LEGACY_OPERATION_EVIDENCE=scratch/runs/EXAMPLE/browser \
LEGACY_OPERATION_HARD_CLOSE=YYYY-MM-DDTHH:MM:SSZ \
node test/test-legacy-texture-operation-web.js
```

`--plan` is static only; `--preflight` exits before Chrome after public COM
checks. The runner uses both existing shipped modules, pins their served
buffers, checks disk hashes before each route, and rechecks source/module
identity afterward. Unavailable runtime dependencies or contexts fail.

Limits: Device7 TL triangle lists only, including indexed public submission.
The native render backend's unsupported topology is not presented as browser
coverage. Other device generations, selector modifiers, unadvertised texture
operations, gameplay and the full27 suite are not qualified. Operations 5–10
are observed diagnostics, including ADD, with TextureOpCaps still exactly
`0xf`. No boxes, game media copies, source archives, deployment or subworkers
were used. Git SHA, relevant binary diff and new-file patches preserve source;
the evidence contains logs, JSON and generated captures.
