# GL encoder context and packed parity repair, 2026-11-15

Evidence: `scratch/runs/20261115-gl-encoder-context-packed-parity-repair/`.
The tested base is main `bfb28f77b879ac7a814d8310a47848573a5f9cd7` plus the
recorded owned patches. Final publication, module pins, selected logs/captures
and sealed closure are recorded in that run's `result.json`.

Both requested failures reproduced with unchanged tests on shared source and
committed HEAD: context submission count 7 versus reference 8, and Worker
opcode 65545 versus expected 65536. Historical logs were separately hash-pinned;
they did not substitute for these reproductions.

The context diagnostic attributes the only publication-count divergence to
`wglDeleteContext(0xDEAD)`. Both return zero. The reference prematurely flushes
pending geometry with that invalid deletion, then publishes the valid deletion
alone. Native rejects the unknown handle locally and retains the geometry until
the valid deletion. The reference now tracks handles generically and follows
that lifecycle. Failed `wglMakeCurrent` also detaches current state while saving
the old context's attributes, matching the [documented WGL contract](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-wglmakecurrent).

The context test retains strict complete-byte parity and independently checks
all API-attributed publication deltas, the complete seven-packet opcode sequence,
all five literal point positions/colors and every one of their 19 attributes.
Every valid lifecycle/finish barrier retains prior geometry in order. The
post-failure no-current points describe internal encoder fallback bytes; public
rendering assertions use valid bound contexts.

The original Worker payload is an edge polygon: `0x10009`, mode 9, three
29-float vertices, 348 payload bytes and outgoing edge flags of one. Its raw
words, float values and SHA-256 are retained. There is no index buffer. The
fixture drew before creating/binding a context, so its compact-filled-triangle
assumption lacked initialized polygon state. It now creates and binds a WGL
context and keeps the original `0x10000` expectation. One producer function
feeds direct main-thread WAT and a real delayed Worker; every complete packet
must match byte-for-byte, and all 19 attributes of all three vertices have
literal expectations. Query/finish blocking, immutable copies, ordering and
single/triple-pool reuse checks remain strict. `RED_BITS` reaches the drawable
owner for the query barrier; `MAX_TEXTURE_UNITS` becomes local native state once
a context is bound and cannot exercise that barrier.

The new public x86 native fixture uses ordinary GL/WGL exports and stdcall
PUSH/CALL/RET dispatch, two contexts, saved/default current colors, failed-bind
context/DC detachment and invalid deletion. Both normal and compatibility
modules produce independently chosen red, white, green, restored red and
restored green pixels with literal packed attributes. It verifies native
`glReadPixels`, SwapBuffers, public GDI GetPixel and output canaries. The real
pre-GDI window readback fence resolves GPU-owned pixels through the renderer.
An independently prearmed Worker watchdog bounds each public call to three
seconds; UNKNOWN prevents later requests. Each shared/HEAD run completed all
214 guarded calls and awaited the watchdog with both output EOFs.

Shared and committed HEAD plus whole owned files pass full locked builds and
all 17 scoped checks: context/Worker, four reference-encoder consumers, lifetime,
publication, shared objects, edge flags, drawable/resize, headless/native
presentation and actual browser render Worker. Both shared modules were restored
byte-identical to those tested. The read view uses immutable Git objects in
place, preserving foreign WIP. Of 146 foreign pins, 145 remain byte-exact;
the live Sims worker independently edited its owned new test. The previous
`7a2e6e59e06044de89c8408fe72fa978405e917e` render-lease repair and attributed
packet/strict-zero-copy/pool/FIFO/partial-fault oracles remain intact.

Native GL identifies llvmpipe (LLVM 20.1.2). Browser-level SystemInfo identifies
ANGLE_SWIFTSHADER and the SwiftShader device/driver. The installed browser's page
renderer reports a conflicting Intel identity, retained as reported; this does
not establish hardware execution. Shared software and WebGL captures were
inspected alongside the literal cyan pixels, query/readback canaries, zero-copy
packet counters and physical Worker retirement. No performance claim follows.

First remaining blocker: the full encoder suite, including unchanged committed
HEAD, fails `primitive: triangles smooth`: reference 524 bytes/two records versus
WAT 796 bytes/three records. Decoded payloads are one compact mode-4 draw of
456 bytes versus two edge mode-9 draws of 348 bytes each, followed by finish.
That fixture also starts without a bound context.
The failure is retained in `encoder-all-baseline-head`, `focused-shared` and
`encoder-all-head-after`;
no assertion is waived. Byte-length diagnostics now expose wire opcode, mode
and payload size. Auditing the remaining contextless primitive fixtures is
separate remaining work; the complete encoder suite is not qualified.

Full 27-game compatibility, gameplay, parity, FPS and audio remain open. The old
Quake 3 capture cause remains UNKNOWN. No original game or NativeQuit was run;
fixture host shutdown is distinct. No boxes or Codex workers were created.
Evidence contains Git SHAs, relevant binary patches, pins and unique logs/native
captures, with no source/media/WASM bundles.
