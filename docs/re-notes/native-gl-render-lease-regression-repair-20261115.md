# Native GL render packet lease regression, 2026-11-15

The render-load failure was an obsolete test contract. The corrected fixture
passes without production changes. Evidence and exact source/binary pins:
`scratch/runs/20261115-native-gl-render-lease-regression-repair/`.

The unchanged `test/test-gl-native-render-load-web.js` was reproduced against
both the current shared tree and committed HEAD plus whole owned files. It failed at
`leasedBatches: 14` versus six, after literal frame, triangle, GDI GetPixel,
query and glReadPixels canary assertions passed. This is a separate transport
suite failure; it establishes neither the historical Quake 3 capture cause nor
a gameplay repair. No original game launch is authorized by this investigation.

The actual WebGL native producer makes these 21 submissions before retirement:

| Index | API triggering publication / packet contents | Leases |
|---|---|---:|
| 0 | wglCreateContext / create | 0 |
| 1 | wglMakeCurrent / make current | 0 |
| 2 | glPixelStorei / viewport, pixel-store | 1 |
| 3 | glFinish / setup finish | 0 |
| 4, 6, 8 | glClear / clear-color, clear | 3 |
| 5, 7, 9 | gpuPresent / packed triangle, present | 3 |
| 10 | glFinish / queued finish | 0 |
| 11, 13, 15 | glClear / clear-color, clear | 3 |
| 12, 14, 16 | gpuPresent / packed triangle, present | 3 |
| 17 | glFinish / final finish | 0 |
| 18 | glReadBuffer / FRONT selection | 1 |
| 19 | glGetIntegerv / backend query | 0 |
| 20 | glReadPixels / final readback | 0 |

Thus fourteen cumulative leases include six frame submissions, six separate
clears, setup and read-buffer selection. Context operations, all three finishes,
query and readback retain the producer until completion. The additional native
GetPixel ownership fence is a separate ordered RPC, not a leased GL packet.
Its two outstanding presentations complete before canonical readback returns.
The empty native flush publishes nothing and leaves pool rotation unchanged.
The software fixture has twenty submissions: its MAX_TEXTURE_UNITS query is
answered natively instead of sending the WebGL RED_BITS backend query.

Relevant production boundaries are `gl_object_leave` and
`gl_wat_stream_flush` in `src/09a8c-gl-encoder.wat`, `queuedResult`, `_admit`
and `_replay` in `lib/gl-render-host.js`, and `SubmissionQueue` plus
`SharedPacketPool` in `lib/render-worker.js`. The lease counter is cumulative;
the submission queue's two live credits and the producer's three rotating
slots describe simultaneous lifetime. An early publication acknowledgement is
not a replay completion or GPU finish. Failed replay quarantines storage.

The fixture now records the actual API call causing each publication and its
lease delta, checks the complete opcode/lease transcript, and keeps exactly six
draw/present leases. It bounds every acknowledgement to two live credits,
checks sent/replied FIFO and exactly-once delivery, hashes the delayed consumer's
actual bytes, and refuses slot reuse before the previous reader completes.
The old second-frame early-ACK assertion was also wrong: clear and draw/present
consume separate credits. Backpressure belongs to the third live publication
(the second clear), not the third frame. No queue limit or barrier was weakened.
The report freezes workload counts before separate context-retirement requests.

Independent expected values remain literal: six colored backgrounds, white
triangle, cyan native glReadPixels, GetPixel 0x00ffff00, query result and untouched
output canaries. Existing context-deletion refusal, release, retirement and
physical Worker closure checks remain. A new two-owner deterministic partial
consumer fault verifies that one sent and one unsent leased packet remain
quarantined, later work is refused, and failure cannot manufacture completion
credits. Existing fixtures cover resize/HWND reuse, copied-input immutability,
pool recycling, empty flush, ordering and stale-lease refusal.

Actual browser Worker WebGL and native WAT software rendering pass. Chromium
identifies ANGLE SwiftShader. Separately, the hash-pinned native Node provider
passes known-pixel, readback, resize and context tests, and public x86 GL/WGL plus
SwapBuffers pass against both normal and compatible WASM modules. That provider
identifies llvmpipe; this is not physical-GPU qualification. The public-call
fixture loads calc.exe only to initialize PE/thunk dispatch, then executes its
authored calls; it never runs an original application's entry point.

Additional parity checks exposed two separate existing failures, retained
without assertion changes: `test-opengl-wat-encoder.js --section=context`
expects eight submissions but receives seven; `test-opengl-wat-worker.js`
expects packed opcode 65536 but receives indexed-packed opcode 65545. The first
is the next observed parity blocker, not a failure repaired by this change.
The changed render-load and shared-render-worker fixtures, lease-pool/lifecycle,
producer publication, shared-object and native-provider checks pass. Both shared
and HEAD-plus-whole-owned full locked builds pass; their exact outcomes and
sealed waits are recorded in result.json. Shared WASM SHA-256 remains
`a361a74b976f986d8cc9c7a2d01b67fc7cf02458471f304dcf2c035a29f876fd`;
the isolated committed-source build is
`b1e49ee899833a5ca461b39b7858ea7d134b5c3e019f6ea89ebc89d930b419b7`.

Current predecessor releases were personally verified before touching shared
tests, building or starting native/browser tests. Foreign WIP is not adopted;
the committed-source view reads HEAD in place with whole owned files, without
moving shared files. Historical missing receipts remain UNKNOWN. No original
game, external box, NativeQuit or public deployment was attempted. Fixture
host/Worker teardown is distinct from application NativeQuit.

Full 27-game qualification, gameplay, parity, FPS and audio remain open.
