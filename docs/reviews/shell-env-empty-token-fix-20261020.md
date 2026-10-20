# Shell environment empty-token repair — 2026-10-20

D1 is repaired in the actual shared `$env_find` implementation. An empty A/W name now returns no entry, so `%%` remains literal even when the guest environment contains `=C:=D:\Drive`. The leading `=` belongs to the hidden name `=C:`; it is not an empty-name separator. Named hidden-drive queries still work case-insensitively. The four-line source change retains environment initialization and all nonempty lookup behavior.

Parent is the **full** ShellEx candidate `e295f11287fde0ce2efa0d0da9491933481fc81f`, based on remote main `a54049d11955307d06309e146e85c1aca3196657`. Independent review `96360e91d971aca8940f8199b2623dee8ceb8858` identified D1. Both review and main refs were remotely verified before work. Branch: `task/shell-env-empty-token-fix-oct20`; no main integration. This commit changes only `src/10-helpers.wat` and this dedicated report/helper pair. The full candidate parent preserves its twelve-path launch transport/error changes for later coordinator integration; do not infer that cherry-picking this repair alone supplies ShellEx support.

## Verification

The committed JS helper compiles actual WAT function bodies with the pinned candidate's vendored compiler, in memory. Only `src/10-helpers.wat` is read from the repair checkout; all other source/compiler inputs come from the exact candidate object. It reuses the independent review helper's tests without weakening expected string values:

- All **144 original independent checks** still pass, including red zones, poison-on-free, allocation failures, lazy environment ownership, size drift, error mapping and nine deferred host/queue lifetime checks.
- All **eight D1 oracles** now pass on repaired source: A/W × tracked/untracked × file/directory. Each identical literal-path expectation still rejects the exact parent, whose compiled source produces the original `D:\Drive` corruption. The review's additional diagnostic expansion guard remains only an idempotence test; production acceptance does not depend on it.
- **25 added shared-consumer checks** pass: A/W empty and missing lookup; named hidden-drive and ordinary mixed-case lookup; empty values; GetEnvironmentVariable core sizing, short buffers and terminators; named hidden-drive replace/empty/delete; empty deletion preserving the hidden entry; actual CRT `getenv` and stack cleanup; and direct expansion with adjacent tokens, missing names, unmatched percent, sizing, short destinations and source/destination aliasing.
- Total **177 named checks**, plus **13 independent expected rejections**: eight exact-parent D1 failures, the original three compiled mutations (NUL sizing, missing free, disabled expansion), an exact-parent shared empty lookup, and an overbroad guard mutation that incorrectly rejects `=C:`.
- The original correction helper replay also passes its 30 handler, 24 environment, 28 error, 52 allocation, 16 namespace rejection, 16 untracked-host and 12 queue cases, host/CLI/browser source assertions, and **13 original rejecting controls**.

JS syntax, changed WAT fragment parenthesis/label validation, and `git diff --check` pass. Compiled ShellEx slice SHA-256: `09d8a0e4b2e4a9e952cf9f77cf5dda8e72e9f393cefe5f14e471ec00bd8bf2d4`. Shared environment/CRT slice: `8ea36419462c4aa6d9f3a4690cad8e781bb8ef8632a85ed4dae99c0d2912c437`.

Shared-consumer inspection covered `$env_get`, `$env_set`, `$env_expand_var` (both expansion passes), Get/SetEnvironmentVariable A/W handlers, ExpandEnvironmentStringsA, CRT `getenv`/`_putenv`, and `set_process_environment_a`. The host export can queue named hidden entries. CRT `_putenv` already rejects an empty parsed name. Fixing lookup also prevents empty deletion from removing a hidden drive entry. General invalid-name validation in setters was not redesigned. Allocation, string conversion, cleanup, lifetime and shell error/transport production code are unchanged.

## Support limits remain

`showCmd` and `hidden` are launch option transport only. Browser progress suppression does not implement guest STARTUPINFO or minimized/maximized/hidden startup; CLI ignores nShow. HOTKEY, NOASYNC, NO_CONSOLE, HMONITOR and WAITFORINPUTIDLE requests still succeed without implementing those modes. Namespace modes reject as before. No new startup or flag implementation is claimed.

No native Windows differential, full VM/dispatch/build, Worker RPC, CLI child/IPC, browser boot, real child process/window or gameplay qualification was performed. W conversion still narrows Unicode; associations, DDE and URLs remain incomplete; asynchronous boot may fail after acceptance. Identity-addressing and heap adapters bound the compiled tests; invalid pointers and extreme overflow are unqualified. Runtime 403 remains binding. No runtime/Boat/SSH command, full build, browser, benchmark, public deploy, Claude, held diagnostic or worker launch occurred.

## Recovery and preservation

From this branch, with its parent/candidate objects available, create an evidence directory and run:

```sh
node docs/reviews/shell-env-empty-token-fix-20261020.js EVIDENCE_DIRECTORY
node --check docs/reviews/shell-env-empty-token-fix-20261020.js
node tools/check-parens.js src/10-helpers.wat --no-diff --quiet
git diff --check
```

In the exact sparse checkout, the last WAT checker was invoked from the shared repository's read-only tool path. No generated binaries are needed for recovery; `tests.json` records source and compiled hashes, individual checks, rejection messages and capacity readings.

Evidence: `scratch/runs/20261020-shell-env-empty-token-fix-oct20/`. `setup.json`, `tests.json`, `receipt.json`, `change.patch`, `remote.txt` and `SHA256SUMS.json` retain admission, validation and publication evidence. Exact three-file sparse patterns were installed before checkout; object alternates were read-only. All 44 original candidate/review evidence seals verify unchanged, as do shared HEAD/index/config. Unrelated WIP, lookup/alias work and laptop Heroes II/Warcraft III were untouched.

Admission was `2794991616 >= 2277507072` bytes. Every subsequent gate conservatively reserves the full 8 MiB, exceeding the required `2210398208 + 33554432 + 25165824 + remaining` formula as the task allocates space. Actual total allocation stays below 8 MiB; no failed capacity gate or cleanup retry occurred. Final receipt records the exact tested commit, verified remote task ref and preservation checks.
