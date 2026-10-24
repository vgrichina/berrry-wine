# Mad Bomber WinMM full-module native qualification, 2026-10-24

PASS: MADBOMBER-WINMM-ERROR-TEXT-20261019 exact historical-source full-module public API gate. The unchanged native fixture exited 0 on the normal production module. This qualifies source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a` including accepted implementation `7fd352855`; it does not qualify the current-main full module or original Mad Bomber SDL/gameplay, which remains open.

## Exact inputs and provenance

- Normal module: `/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm`, 1879746 bytes, SHA-256 `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`. No module transformations, private exports, compilation, game recovery, packages, browser, box or deployment.
- Preserved normal-build receipt: `/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/docs/re-notes/shadow-man-span-static-canonical-20261023/`. All 53 seals verified, all 140 build-source pins checked against both historical Git blobs and actual preserved source files. The corrected helper SHA-256 is recorded in `provenance.json`; preserved static qualification binds 291 imports, 2227 function exports and layout `9a3bc9149d58209c`, including DIRECT_WINDOW.
- Explicit focused transitive dependency closure: 40 exact historical files, 2,413,909 bytes. Every materialized file was rehashed after execution. The build module remained an immutable standing input, without copies. Read-only Git alternates refer explicitly to standing donor objects; no donor/root index, tracked file or ref was changed.
- Both complete fixture oracles were inspected. `test/test-wave-error-text-native.js` and `test/test-wave-error-text.js` are byte-identical on historical source and actual remote main `9b263cea5801886d43b6e818f0b415645bb32a50`, reconciled using strict SSH. The native fixture helper is also unchanged. Full blob/SHA-256 identities and all differing host-closure files appear in `source-binding.json`.

## Actual execution and oracle

Node v24.18.1, fixed shared WebAssembly.Memory initial=maximum=8192 pages (512 MiB), heap ceiling 512 MiB. Native run freshly admitted with MemAvailable 2981269504 bytes, minimum 2,684,354,560. Native terminal exit 0 in 0.125s, no stderr, no supervisor limit, process group empty/reaped. Peak child RSS 76705792 bytes reflects lazy physical commitment, not a reduced arena. Node's installed V8 options do not expose `experimental-wasm-threads`; that switch was omitted to preserve shared-memory support. This fixture uses no worker runner or `--no-threads` option.

The unchanged fixture loads a deterministic PE, calls public LoadLibraryA(winmm.dll) and GetProcAddress, asserts nonzero distinct A/W callable addresses, and executes those addresses through the actual x86 VM. It does not print the numeric thunk addresses. No private handler invocation substitutes for public resolution.

- All 26 supported codes (0–21, 32–35) return success and nonempty terminated descriptions. A/W text agrees; capacities 1, 2, 7, 256 and unsigned 0xffffffff are bounded with preceding/following canaries.
- Every public call checks guest stdcall stack restoration and terminal EIP=0 with no unexpected yield. SetLastError(12345)/GetLastError assertions surround each full ANSI description. The existing oracle does not independently recheck LastError after each later A/W truncation call; no broader LastError assertion is claimed. The oracle is unchanged.
- Both public variants reject codes 22, 31, 36, 64 and 0xffffffff with MMSYSERR_BADERRNUM=9 and untouched output; zero capacity with a nonnull buffer succeeds without writes. Null output returns MMSYSERR_INVALPARAM=11, including zero capacity.
- Actual VirtualAlloc reserves/commits discontiguous physical backing, asserts the discontinuity, then checks every ANSI and UTF-16 byte including termination and final canary across the guest page boundary for code32. VirtualFree succeeds.
- Existing unchanged host regression separately passes message-count mode, page-watch write ranges, supported/unsupported codes, truncation, canaries, unsigned capacity and out-of-bounds UTF-16 rejection without mutation.
- Wrong module SHA-256 produces exit1 / ERR_ASSERTION at fixture line11, before WebAssembly.compile at line12 and memory construction at line13. This is the fixture's own existing hash rejection, not a mirrored test oracle. Native invalid input and host out-of-bounds cases are the existing rejection controls.

## Reproduction

Recover the 40 pinned paths from historical Git commit `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a` using `source-binding.json`; retain that relative directory structure. Recover the sealed normal binary using the preserved build recipe/receipts above, verifying its exact hash before execution. `prepare.py` documents the explicit require closure and pin verification; no build was run for this task. Execute sequentially from that historical input root:

```sh
node --max-old-space-size=256 test/test-wave-error-text.js
node --max-old-space-size=256 test/test-wave-error-text-native.js --wasm=/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm --sha256=0000000000000000000000000000000000000000000000000000000000000000
node --max-old-space-size=512 test/test-wave-error-text-native.js --wasm=/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm --sha256=8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686
```

Use the retained `run.py` supervisor for admission, CPU/wall bounds (60s lightweight, 90s native), capped raw logs, process groups, TERM then KILL and subreaper cleanup. Expected exits are 0, 1, 0. Raw stdout/stderr and exact argv/terminal receipts are adjacent. No VM setup occurs for the wrong-hash case.

## Historical scope versus main

The following historical inputs differ from reconciled main. No current-main host files were substituted:

- `lib/host-window.js`: historical `a1ef88a659581c5798ecca769f721d251d55e0e3`; main `1d071ccf086fb6b2e05258eb778c6c6678fa57ad`.
- `lib/d3d9-shader.js`: historical `38de1b75c2606f949c88b3fe6f96d8b7c5a6ba98`; main `b31e4081b43d8e2262fafe60a14f8d7157ee7d1a`.
- `lib/d3d9-host.js`: historical `bd6f3f3b1ad8c353871e2109f09013f5b72b35d9`; main `bf99debbddbea8a6d4df86b46b6eae23c86a04d6`.
- `lib/d3d-shader-ir.js`: historical `d8669218bc4964b41013cb5d602f3a59edd1884f`; main `c2aee907f11b94e7e3bf79ddb5480fc14ef5b67f`.
- `lib/d3d9-backend.js`: historical `7a0fe51b7bc8bde49165f09d9a59f64f3559a393`; main `be504f7e8419ef184b774e9cb6c33a72ff71b2de`.
- `lib/d3d9-software-backend.js`: historical `7c9d7fa6ffc407011fcce9496090b353d33bd80c`; main `b87f73bec161d7422cec342e273560a66877cf21`.

Optional external renderer/native-package requires are inventoried in the binding; they were neither installed nor reached by these audio-error-text tests. Unrelated missing module imports retain the unchanged fixture's throwing guard.

## Resources, bookkeeping and cleanup

60 MiB projected task peak within 64 MiB allocation, including 8 MiB reserve, 12 MiB transport and 20 MiB external launcher/session/SQLite/future allowance. `resource-final.json` records measured accounting and host floor. Per-file ceiling 24 MiB; internal cumulative capture budget 1 MiB. Preparation corrected a sparse-missing test path by reading its historical blob and a require resolver suffix (`.generated` → `.generated.js`); neither fixture nor production code changed. Initial command capture remains in the retained session history and is conservatively charged in the ledger. Actual historical dependency files and all build-source pins reverified after execution.

No integration into main in this assignment. No assigned box: ID/state/expiry N/A, lifecycle coordinator. All test processes reaped; messageboard watcher terminated before handoff. Historical donor module and root tracked files/index/refs remain untouched. Recovery inputs/receipts remain under `/tmp/madbomber-winmm-retained-native-oct24`; tracked evidence is sealed below.
