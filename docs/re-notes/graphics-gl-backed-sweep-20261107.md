# Graphics startup sweep with the native GL bridge — 2026-11-07

Evidence: `scratch/runs/20261107-graphics-gl-backed-sweep/`. One fresh box,
`bx_rbnsr78x`, created using a persisted UUID Idempotency-Key; original expiry
2026-11-07 04:36:50.297 UTC. This is a bounded Node startup investigation,
not browser WebGL, gameplay, FPS, historical27 membership or backend parity.
The [predecessor plain-CLI findings](graphics-registry-crash-sweep-20261107.md)
remain unchanged and are not GL passes.

## Published harness change and inputs

`3d04d058a5dba64d18e2304ed9538925ff363250` adds the explicit opt-in
`--headless-gl` forwarding option to `tools/crash-sweep.js`. Its default
subprocess arguments remain unchanged. The focused subprocess regression
checks both cooperative and real-thread arguments with and without the flag;
all 20 tests passed. The mandatory locked build passed before publication.

All four complete original registered input sets were available and pinned:
Quake II 67 paths, Quake III 307, GLTron 92, Forsaken 873. No replacement
media or guest configuration edits were used. The final prelaunch runtime
manifest contains 1,782 files, including shared DLL, type-library and font
inputs. `runtime-pins.json`, the exact main SHA, `relevant-source.patch` and
the new-file patch identify the source. The patch includes the concurrent
Lords2 DDE change subsequently published as `ea81b0a3b`. Git is the source
archive; only individual runtime inputs were staged remotely.

Both freshly built WASM modules are recovered. The standard module actually
read by all eight guest processes is 2,182,220 bytes, SHA-256
`1c64b1d38256ccc5f2b774f59f144c707b0a9705359249f4d047c7447e5f6e13`.
The compatibility module was retained, not executed.

The supported `lib/headless-gl.js` factory used `@node-3d/glfw` 7.4.1 and
`@node-3d/webgl` 6.0.3, within the project's declared version ranges, on
Node v24.22.1, display `:0`. It reported Mesa, llvmpipe (LLVM 20.1.2,
256 bits), WebGL 1.0 and shading language 4.50. A real context clear/readback
returned red RGBA `[255,0,0,255]`, GL error 0, and zero live contexts after
destruction. `native-pins.json` records all 162 native-dependency files and
the Node binary hash; native-loaded reports identify loaded shared objects.
Nine native `.node`/`.so` files were recovered with verified hashes.

## Actual serial runs

```sh
node tools/crash-sweep.js --apps=quake2_demo,quake3_demo,gltron,forsaken_demo --seconds=20 --headless-gl --modes=coop,threads --jobs=1 --stuck-after=0 --no-build --jsonl=/home/user/graphics-gl-sweep-runtime/scratch/runs/20261107-graphics-gl-backed-sweep/actual3/sweep.jsonl
```

Only one guest ran at a time. The successful staging invocation ran from
04:09:57 to approximately 04:12:08 UTC. Each OpenGL title created a real native
context, but its guest WGL bridge failed later, as diagnosed below. Forsaken
used its registered software Direct3D route and did not create a native GL
context; merely providing the factory does not change that route.

| App | Cooperative | Threads | Inspected final images |
|---|---|---|---|
| quake2_demo | ok/content, 20.6 s | ok/content, 20.5 s | Both show the 320×240 GAME/MULTIPLAYER/OPTIONS/VIDEO/QUIT menu, after software fallback. **Not GL rendering passes.** |
| quake3_demo | ok/blank, 20.5 s | ok/blank, 20.5 s | Both uniformly gray, 640×480. No menu established. |
| gltron | exit:1/blank, 3.6 s | exit:1/blank, 3.3 s | Both uniformly teal, 640×480. No menu established. |
| forsaken_demo | ok/content, 20.4 s | ok/blank, 20.3 s | Cooperative shows SINGLE PLAYER and other menu entries over the 3D backdrop. Threads is uniformly near-white. |

No escaped emulator trap or unimplemented API was present in any complete raw
log. Every audio signal was `none`; audio is unqualified. Forsaken's final
frame classifications disagree, which is a retained observation, not a proven
scheduler defect. Equal wall time does not guarantee equal guest progress.
The sweep's exit zero does not make all titles pass.

The initial `actual2` invocation failed before guest execution because staging
omitted bundled fonts. Those eight setup logs remain separate. Existing fonts
were then individually pinned and transferred, and a fresh JSONL/output path
was used. Native installation also initially lacked binaries because scripts
were disabled; its normal install scripts supplied the binaries before any
guest launch. No cybersecurity/403 retry or replacement download occurred.

## First unexpected WGL failure

Selected-API and host-observer diagnostics on unchanged originals established
the same failure in Quake II, Quake III and GLTron. Native context allocation
succeeds, but the bridge's actual fixed-function fragment shader fails:

```text
extension `GL_EXT_draw_buffers' unsupported in fragment shader
compileShader -> WebGLBackend.createProgram -> FixedFunctionGL
```

`OpenGLHostBridge._createWebglContext` catches that shader exception and returns
zero. The guest traces record `wglCreateContext` returning NULL. Quake II tries
twice and then loads its software renderer; GLTron exits 1. This is a different
cause from the predecessor's absent Node canvas.

The native provider exposes `WEBGL_draw_buffers` and its real draw-buffer
functionality. The existing native headless test passed because it did not
construct the fixed-function shader with drawable buffers enabled. A focused
retained regression constructing that actual frontend fails with the original
compiler error. On the same context, a small multiple-output shader using
`GL_ARB_draw_buffers` links, whereas the EXT spelling fails. Its standalone
hypothesis log also retains an incidental post-link cleanup call to a nonexistent
`gpu.deleteProgram`; only the recorded successful link is claimed from it.

This matches Khronos's distinct shader extension names:
[WebGL WEBGL_draw_buffers](https://registry.khronos.org/webgl/extensions/WEBGL_draw_buffers/)
uses `GL_EXT_draw_buffers`, while desktop
[ARB_draw_buffers](https://registry.khronos.org/OpenGL/extensions/ARB/ARB_draw_buffers.txt)
defines `GL_ARB_draw_buffers`. The relevant correction belongs in the existing
desktop shader-port step, without changing guest APIs or browser shaders.

## Published repair and remaining limits

`aaaf6e370` translates `GL_EXT_draw_buffers` to `GL_ARB_draw_buffers` in
only the existing desktop GLSL port. Browser shader generation is unchanged.
After Aranna explicitly released shared source/build access, the mandatory
locked build passed, as did the GPU backend, WebGL drawable and crash-sweep
argument tests. On this same fresh box, the expanded native headless test and
a separate real WGL regression both passed: nonzero WGL handle, MakeCurrent,
actual fixed-function shader link, red RGBA `[255,0,0,255]` readback, and
explicit harness-owned native context cleanup. The first revised regression
retains a cleanup assertion failure; all rendering assertions had passed,
and the final harness explicitly releases the supplied native window.

There was no repaired original replay within this bounded assignment. The
original captures therefore remain pre-repair observations, and none becomes
a GL title pass. A later original sweep on the repair is the next step;
Forsaken's software-route frame difference also remains unqualified.

Unique raw logs, inspected captures, both WASM modules and native loaded
modules were recovered with hash verification before delegated normal box
shutdown. Box `bx_rbnsr78x` is confirmed **archived**, stopped at
04:29:31.464 UTC; the normal stop completed with `forced: false` and no error.
The final remote cleanup found zero owned runtime processes or listening
Unix sockets, and records process/port/profile cleanup. No browser server or profile was created; no guest file/config edit,
replacement media, silent-success stub or public deployment was used.
