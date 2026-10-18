# CRTDLL `_iob` static data identity

2026-10-18 compiled validation complete. No new game run.

Original Circus Linux 1.0.0's `_iob` import at IAT VA 004b7340 is used as a
FILE-array address: stdout +32, stderr +64. The post-fpreset run passes
07500050 to setbuf, implying a wrongly thunk-backed `_iob` base 07500010.
SDL WinMain attempts freopen and, on failure, copies eight dwords from fopen's
FILE into those addresses. Evidence is retained in the shared repository under
`scratch/runs/20261018-circuslinux-stdio-source/` and
`scratch/runs/20261018-circuslinux-fpreset-retry/`.

Wine's upstream [CRTDLL export specification](https://github.com/wine-mirror/wine/blob/master/dlls/crtdll/crtdll.spec)
marks `_iob` as an extern data export, consistent with the original binary's
direct dereference and 32-byte structure stride. This is implementation/source
evidence, not a new native Windows execution oracle.

## Bounded fix

Both the main PE import path and a loaded caller's system-DLL import path now
recognize exact `_iob` from case-insensitive `crtdll.dll`. They use the existing
`$crt_iob_ensure` process-shared publisher, not a new array or a callable thunk.
The reserved thunk slot is retained so subsequent import indices stay stable.
No API table entry or dispatch generation changes are needed. Other modules or
symbols are left to their existing resolution paths.

The PE loader initializes the heap before processing imports. `_iob` creation
allocates 96 bytes for three 32-byte FILEs and 144 bytes for ownership records;
initial flags are read/write/write and descriptors 0/1/2. Publication is under
the existing CRT list lock with an atomic pointer, and losing creators free
their allocations. Every thread instance sees the same pointer and list.
Allocation failure traps rather than silently resolving this data symbol to a
function thunk. Reopened standard streams retain their FILE addresses and
registered ownership. No stdio buffering behavior changes.

The DLL-loader branch for real mapped dependencies remains before the system
fallback and resolves the real export. EXE imports can subsequently be patched
by the existing native dependency pass (`patchExeImportsLocked` calls
`patch_caller_iat` against matching mapped modules). The synthetic table is only
the builtin CRT route; this change does not substitute for real DLL exports.

Dynamic `GetProcAddress` is deliberately outside this static-import patch:
CRTDLL lacks a unique synthetic handle and aliases the EXE handle today. A
global `_iob` name override would misidentify unrelated modules. A future dynamic
fix needs module identity first. Full-path DLL spellings and other CRT families
are also outside this exact-basename rule. The historical callable `_iob` API
remains for existing callers/tests. **setbuf remains fail-fast.** Its true custom
buffer behavior requires a separately scoped stdio buffering implementation.

## Conformance and validation

`test/test-crtdll-iob-data-import.js` uses a minimal PE with the same direct
stderr dereference. It checks the IAT points outside the thunk range, ordinary
import slots stay stable, all three FILEs are owned and have expected flags and
descriptor offsets, EXE/DLL paths share identity, foreign module/symbol suffixes
are rejected, sibling instances share the array, and freopen/fputs accept the
imported stderr address with actual VFS output. A second guest process with
distinct linear memory proves FILE mutations and VFS contents stay isolated.
A real mapped PE CRTDLL fixture exporting `_iob` proves a subsequently loaded
caller's import resolves to that native data export rather than the builtin array.
Shared-instance checks are sequential; this does not establish concurrent
publication behavior or reset behavior when reusing a process memory.

The following commands passed (exit 0) in isolated worktree
`/tmp/wa-circus-iob-20261018`, based on origin/main
`97d5f10890d7c8ceaca8fe5f7641d3c4906c3422`, with implementation commit
`e7e443da81c76482bd3e5a95f40ca38f001b07a6` and the added test coverage:

```sh
bash tools/build.sh
node test/test-crtdll-iob-data-import.js
node test/test-crt-stdio-file.js
node test/test-msvcrt-acmdln-data-import.js
node test/test-crt-mkdir-setvbuf-getc.js
```

The normal build passed all gates; candidate module is 1,866,594 bytes,
SHA-256 `1505f311d2d6edc98c184bfcf9093485036db0ec55a590e00b655c6fffbf3afa`.
The canonical integration module remains unchanged at
`0c617764e036d0422ab19bc0d97477ff68ba5eb8fa7c247833b7519e8060e5f7`.
Logs and individual command receipts are retained under
`scratch/runs/20261018-crtdll-iob-validation/` in the shared repository.
Each command used a detached process group with a 180-second deadline,
8-MiB log cap, and strict 2-GiB plus 64-MiB disk stop margin. Minimum observed
free space was 2,396,475,392 bytes; no guard fired. All five child processes
exited normally. No game, browser, setbuf substitution, or runtime retry was run.
