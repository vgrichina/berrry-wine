# Focused native crash sweep, 2026-11-01

All seven requested tests passed sequentially on exact main
`fcbd87f8114c517b68246c945956f37abd67ef8f` (tree
`86cb6eaad7452bdb65552cf307130808706ad188`). Evidence run:
`scratch/runs/20261101-crash-sweep/`. No emulator crash regression was
reproduced; no production or test source was changed.

| Test (`test/`) | Outcome and exercised behavior |
| --- | --- |
| `test-seh-continue-execution.js` | PASS: dispatcher resumes frame-owned EIP/ESP after RaiseException, without exit; yields immediately. |
| `test-seh-nested-raise-continue-search.js` | PASS: outer handler sees nested `0x2222` then original `0x1111`; guest returns `0x5a5a`, restores SEH chain. |
| `test-fault-null-raise.js` | PASS: mode 3 delivers access violation and abandons interrupted block; mode 0 absorbs before and after. |
| `test-fault-reserved-sync.js` | PASS: synchronous reserved-page SEH search/continue preserves architectural, decoded-stream and page state; committed/unreserved controls pass. |
| `test-d3dim-vb-creation-oom.js` | PASS: 24 injected descriptor/data/object failures with retries and balanced heap/DX slots; eight size rejections; exact >4 MiB allocation/Lock/release for v3/v7. |
| `test-d3dim-material-oom.js` | PASS: 12 failures preserve state and null sentinel; retry, reuse, readback, public Release and ABI checks pass across three interfaces. |
| `test-d3dim-execute-buffer-oom.js` | PASS: 16 failures/retries, sparse crossing descriptor/output, balanced heap/DX slots, Lock/Release and ABI checks. |

Each harness and its compilation/host helpers was inspected before execution.
These are bounded synthetic native tests with one 512 MiB shared Wasm memory
per process; none required a heavy runtime, browser, game run, benchmark,
download or remote box. Render-helper users select `fonts: 'none'`; canvas is
the repository's JavaScript raster implementation. Both the notepad fixture
and existing build required by the null-fault test were present. There were
no absent dependencies, stale-harness failures, skipped tests or production
failures. Reserved-fault trace lines and VB OOM diagnostics are expected
asserted paths, not uncaught crashes.

Execution used Linux x64 Node `24.18.1`, V8 `13.6.233.17-node.50`, default
engine tiering, with no WINE environment overrides or NODE_OPTIONS. The exact
command for each test was `node --require
/home/user/wine-assembly/scratch/runs/20261101-crash-sweep/capture-module.cjs
test/<name>.js`. The evidence-only preload saves and hashes the original bytes
then forwards the same arguments to native `WebAssembly.instantiate`; it does
not alter imports, assertions, compile options or module bytes. Each process
had a 120-second timeout; all exited 0 within 0.2–5.2 seconds.

Six harnesses compile current sources through the canonical WATX closure,
adding their existing test exports and, for OOM tests, existing allocation
failure injection. The null-fault test consumes `build/wine-assembly.wasm`.
The captured instantiated modules have these SHA-256 identities:

| Test suffix | SHA-256 |
| --- | --- |
| seh-continue-execution | `d6af03c5097486a70c4018fb654a1e419b9cf4689430d3ee71022aeb3aa2e830` |
| seh-nested-raise-continue-search | `ab9a73dcd5b92b01f2d2e0daa83207e381a6be3f8daf1de2b5c39bc9d667e117` |
| fault-null-raise | `2be3cebaa1c08a8e12075de000bfb83fb8692841c1452d9e317203f5c2fce8cf` |
| fault-reserved-sync | `0eb9fed7450817c8cb5db04e11cf9593e93c5abb3bef5121c64cb17902218579` |
| d3dim-vb-creation-oom | `a39b3697c67f8630e4cd6604dc91313322e76afb4af926cc5235307d8821cb8a` |
| d3dim-material-oom | `50f850588ede3a84470fdbec2ffb79e3a6d39cea05b922e45b5901e4bc6dffd9` |
| d3dim-execute-buffer-oom | `098e94087e4c644a7bbd523c497fddb8e6124f02bfcd8f0c15158e011d04684a` |

`inputs-before.json` and `inputs-after.json` pin source/compiler/host/helper,
harness, fixture and build bytes; their comparison found no changes. All 293
tracked inventory files matched the requested Git revision. The existing build
was checked against a fresh canonical compilation with the build's
`wine-region-layout` custom section and matched byte for byte. An initial
comparison without that 37-byte section differed, as expected; both comparison
records are retained, rather than treating that packaging difference as stale
source or a production failure.

Evidence includes `outcomes.json`, individual logs, `modules.jsonl`, the seven
captured modules, environment/input inventories, `source-vs-main.json`,
`canonical-stamped-identity.json`, and reproduction scripts `run.py`,
`capture-module.cjs`, `check-canonical.cjs`. Run `python3
scratch/runs/20261101-crash-sweep/run.py` from the shared checkout to reproduce
at the pinned revision; the runner refuses another HEAD or free disk at/below
2 GB. Evidence stays ignored and outside Git.

This publication changes documentation only; validation is `git diff --check`.
No build gate was bypassed or census refreshed, and no new full build pass is
claimed. Free disk remained above 2 GB (about 2.55 GB after the tests).
Box ID/state/expiry: N/A; none assigned, accessed or owned, so no lifecycle
action or ownership transfer is needed. All seven assigned tests are complete.
Gameplay, full27 coverage and absence of crashes in all apps remain unproven.
Any broader coverage requires a separate assignment; this worker stops here.
