# Aranna ordered read/checksum investigation, 2026-11-05

Task `NEW-GAME-ARANNA-DEMO-20261010`; evidence directory:
`scratch/runs/20261105-aranna-ordered-read-checksum/`.

**Unresolved.** New generated observer controls pass both module modes and the
locked full build passes. The one original diagnostic session failed during
DLL initialization, before acceptance, Logic.dsres I/O, or checksum capture.
No emulator repair or gameplay progress is established. No second original
session or repair retest occurred.

## Starting evidence and gate

Started with the result at `502009417c43c3cefa5a57167c9fbbf7ba22f94e`, reading
the [Worker controls](aranna-worker-resource-read-20261105.md) and
[original local run](aranna-original-local-gameplay-20261105.md). Their passing
4206880-byte delivery and seek/error/scatter controls were not rerun unchanged.
Error 23 remains guest-assigned; the previously identified checksum-mismatch
path at `0x6555a1` and separate path at `0x653498` were not dynamically
distinguished here. Nothing here demonstrates a failed ReadFile.

Preparation remained source-only until legacy1915 FINAL 17:43:35Z, genuine
AoE3 DXSETUP FINAL 17:55:42Z, then Conan1935 FINAL 18:16:14Z. Independent
`release-gate.json` verified 334 recorded PIDs absent, 137 ports refused,
35 profiles absent, four locks free, no heavy runtime, and over 5 GB free.
Validation used main `41f047cbf2b3c9a68291482b528e586094be2b9b`;
original launch used `6f3532b321ecd5cdc3d8b7d6d7b171cda2a61383` (the
intervening change is only TODOS.md). The relevant tracked runtime binary
diff is empty; `runtime-source.json` pins the files individually.

## Observer and generated validation

All new diagnostics and controls are run-owned files, not production edits:
`observer.js`, `observed-worker.js`, `install-observer.js`,
`validate-observer.cjs`, `browser-preflight.cjs`, and lifecycle/runner/readout
helpers. `launch.json` records the exact original command and observer hashes.

The singleton broker wrapper copies each targeted completed read before
returning to RPC and waking its owning Worker. It records slot/thread,
per-slot operation number, open access/flags, signed seek distance/method,
cursor before/after, error/count, guest destination, bytes and VFS comparison.
The host recorder additionally compares against the pinned canonical file at
that offset. Matching media payloads are referenced by path/offset/hash,
without copying media into evidence. Owning-Worker hooks record actual API
EAX, count and last-error at dispatch exit. Concurrent CPU writes remain
possible: these are ordered I/O completions, not globally atomic snapshots.

The supported breakpoint targets `0x655594`, intending to capture EAX, ESI,
`[ESI+0xc]`, `[ESI+0x9c]`, `[ESI+0xd8]`, exact input and raw page tables.
Snapshots use pure JS `memUtils.g2w` rather than a WAT translation that could
invoke SEH. Unmapped spans are tagged holes; their zero placeholders are not
backing bytes. The historical reserved-fault-observer API/tool is absent from
current source and was not used.

The adapter selects supported `set_fault_unmapped(1)` when the effective mode
was zero and records that selection. This reports misses and retains quiet
sentinel behavior; it does not select exception/filter/fill modes 3/4/5.
It also retires decoded blocks and disables some optimized execution paths.
Thus it perturbs execution despite leaving guest instructions and media
unchanged. Its effect on this original startup has not been excluded.

New generated controls passed at 18:18–18:19Z: full WAT, two real OS Workers,
singleton RPC, actual production dispatch entry/exit, page-spanning copied
payload, later peer cursor/destination mutation, open flags, actual
BOOL/count/last-error, checksum-boundary register/field capture, pure hole
snapshot, and first access to a NULL-placed MEM_RESERVE page. Each mode emitted
38 records. Exact production WorkerLink/custom worker URL also passed in Node.
A generated-only isolated browser validated the browser import graph and
`0x655594` capture with EAX `0x11223344`. Results are in
`observer-controls.json`, `observer-controls-compat.json`, their logs, and
`browser-preflight.json`.

Setup failures are retained: corrected artifact environment variable/path;
masked packed reservation-base protection bits; used NULL placement after a
fixed high-address reserve request was committed by the current handler;
changed browser readiness from network-idle to DOM readiness; removed a
duplicate mem-utils import in the adapter. The fixed-address behavior does
not establish Aranna's actual allocation path. All corrections preceded the
original launch; the generated reservation test explicitly verifies an
unmapped page before touching it.

`flock /tmp/wine-build.lock bash tools/build.sh` passed at 18:19:12Z.
Unique generated modules:

| Module | SHA-256 |
| --- | --- |
| observer-standard.wasm | e2f48eb998f5fd9b50d6fe7ca13fc9baffb4fb3ed7ef60354783d3ce373054b5 |
| observer-compat.wasm | 815c72d2dd106e5c80d2626127b180a83146747bfaf2f3194100e8c30d0d941f |

Production build hash:
`2e4280f8d513b99d57273cb70838871e03088c84d49d64357a66ddb318c8f8b3`.
It is already retained at
`scratch/runs/20261105-conan-installed-state-gameplay/tested-wine-assembly.wasm`
and was not copied again. The original browser's compiled-module identity
was not recovered before failure; that build hash is not substituted for it.

## One original session and remaining blocker

The runner reserved its one original session at 18:22:09Z. Chrome opened
18:22:24Z, navigation completed, and ordinary app launch began. Only two
original ordered observations were received at 18:22:27Z: slot 0's mode
selection `0 -> 1` and breakpoint arming at `0x655594`.

The production loader then reported:

```text
[guest-worker 0] loadDlls: DLL initializer did not return: module=0x9c0000
ERROR launching aranna_original_local: DLL initializer did not return: module=0x9c0000
```

The probe closed the page at +46.2 seconds and exited 1. Chrome exited 0 at
18:23:11Z; the caller closed its server normally. `output.log`, `console.log`,
`terminal.json`, `chrome-exit.json`, `cleanup.json`, and `observations.jsonl`
retain the actual failure. A later read-only CDP attachment found the
already-closed port refused; it created no browser and recovered no context.

Observed counts: zero Logic.dsres opens/seeks/reads, zero checksum snapshots,
zero reserved-page miss records, zero original SetLastError(23) records.
No acceptance click or startup/failure/menu/gameplay screenshot was reached.
No screenshots are claimed or borrowed.

In `lib/dll-loader.js`, `finishDllInitialization` throws this generic error
when its attached outcome is incomplete or exited. The callback driver can
retain a fault, unfinished frame, blocking/debug halt or exhausted resume
bound. Browser forwarding retained only the message, not `error.outcome`,
fault/cause, final EIP/ESP, halt or yield. These cannot be reconstructed from
this trace. There is no evidence distinguishing an emulator startup failure
from an observer exception or altered execution under mode 1. Generated
coverage does not establish transparency across this original initialization.

The next discriminating evidence must expose that existing loader outcome
and owning-Worker registers before the generic launch failure discards them,
and establish observer operation through DLL initialization before assigning
a later checksum cause. Deferring checksum/miss instrumentation until normal
DLL initialization completes is a possible diagnostic design, not a tested
solution. The original-session cap prevents trying it here. No first divergent
original CPU/Win32/memory operation was proved, so no speculative repair was
made. Error23 and ordinary gameplay remain unresolved.

Microsoft's [page-state documentation](https://learn.microsoft.com/en-us/windows/win32/memory/page-state)
and [ReadFile contract](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-readfile)
remain criteria for future actual records; neither establishes this original
execution's behavior. No archive format or checksum oracle was invented.

Canonical originals remain in
`scratch/game-media/aranna-demo-20261105/extracted/`: 28 files, 281799760 bytes;
Logic.dsres 4206880 bytes, SHA-256
`90b26f179364a4d25f7053e8aa41932d51fcd0e563e37820894c3dbfdcf9d0e5`.
No download, extraction, media copy, source archive, guest patch or additional
guest decoding occurred. No production file was edited.

Own browser/callers/server/workers are closed; independent final cleanup is
recorded in `final-cleanup.json`. Box ID/state/expiry N/A; coordinator lifecycle
unchanged. No subworkers, public deployment, DRM change, platform flag or
laptop Heroes II work. Stop after publishing this note.
