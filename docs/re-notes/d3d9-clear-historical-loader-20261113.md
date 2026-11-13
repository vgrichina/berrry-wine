# Historical D3D9 clear-test compiler

`test/test-d3d9-clear-contract.js` pinned five historical compiler files but
loaded the current checkout's compiler by default. The loader had changed from
2,663 to 2,711 bytes, so the test stopped before exercising its clear assertions.
The pins were correct; refreshing them would change the historical fixture.

The default path now reads exactly those five objects from Git commit
`f6571101e38985b3fa34d328f2ccadd9735a7573`, checks their byte lengths, SHA-256
and Git blob identities, then executes the pinned loader with file reads limited
to the verified in-memory inputs. It does not alter global require/fs behavior.
An explicit `WINE_CLEAR_COMPILER` override still requires the exact pinned files.
Historical Git objects must be available; missing objects remain an error.

Production functions, compiler/function pins and pixel assertions are unchanged.
The five-function native excerpt is still 5,257 source bytes and compiles to the
same 755-byte module, SHA-256
`61cf1906c68d4cd76ca8a3c3ad7c76aad06bed2728e105cee5943adc085c8b4b`.

Evidence: `scratch/runs/20261113-coordinator-clear-loader-repair/`.
Default and exact-override executions pass. A same-size one-byte change in each
of the five compiler files is rejected by identity checks; the current compiler
override and historical masked-clear pixel bug are also rejected. Only the five
controlled compiler inputs were temporarily materialized in RAM for override
tests, then removed. No source tree or checkout was archived.

Three adjacent clear tests and the serialized full build pass. The build included
concurrent foreground-keyboard worker WIP and does not qualify a clean main build
or that worker's change. This test covers native clear/depth/stencil excerpts and
command-contract mocks. It does not establish actual Chrome/WebGL, GPU or
original-game behavior, or complete the GL/D3D 27-app goal.
