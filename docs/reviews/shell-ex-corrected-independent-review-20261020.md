# ShellExecuteEx corrected independent review — 2026-10-20

**Changes requested; no main integration.** Exact reviewed correction: `e295f11287fde0ce2efa0d0da9491933481fc81f`, remote `task/shell-ex-contract-corrections-oct20`. Base: `a54049d11955307d06309e146e85c1aca3196657`. The complete twelve-path delta from main was reviewed, including the implementation selected from `940e0a5faa6b7bc563e4284d27aaf22217e9eebb`, not just the last environment/error/queue edits.

The correction improves the previously unconditional-success Ex handlers substantially. Its specific error mapping, guarded allocation cleanup and option transport pass the tests below. One additional, reproducible path corruption prevents unconditional acceptance of DOENVSUBST. The helper and report are the only committed changes in this review.

## D1 — empty environment token resolves to a hidden drive entry

With guest environment `=C:=D:\Drive\0\0`, file `C:\100%%\child.exe` and `SEE_MASK_DOENVSUBST`, the actual compiled code sends `C:\100D:\Drive\child.exe` to the host. A directory `C:\100%%` likewise becomes `C:\100D:\Drive`. This reproduces in all eight combinations of A/W, tracked/untracked, and file/directory expansion. `%ROOT%`, empty *values*, unknown named variables, unmatched percent signs and explicit `%=C:%` are distinct cases and pass.

Cause: `src/10-helpers.wat` `$env_expand_var` passes an empty scratch name for `%%`. `$env_find` treats the first `=` in a hidden drive entry as the separator for that empty name. `$env_name_len` then correctly skips the leading `=` and returns the drive entry's value. The two routines disagree about the identity of the matched name.

This is an existing shared environment-helper defect newly exposed by Ex's expansion route, not a new out-of-bounds write in the correction. Hidden entries are a supported representation documented in `$env_name_len`; the host `set_process_environment_a` export also accepts such names. The test supplies a valid memory fixture, not evidence that a particular game currently creates that entry.

The eight expected literal-path assertions reject the exact correction. A diagnostic **in-memory slice only** that refuses empty names in `$env_expand_var` restores the literal result in all eight cases. No production fix was made. Correct the empty-name lookup/expansion boundary and retain file/directory A/W regressions before accepting DOENVSUBST. The precise native-Windows result was not differentially measured; the semantic oracle follows the documented rule that absent variable names remain unexpanded and the fact that this fixture contains `=C:`, not an empty-name variable. [ExpandEnvironmentStringsA contract](https://learn.microsoft.com/en-us/windows/win32/api/processenv/nf-processenv-expandenvironmentstringsa).

## Support boundary: transport is not nShow implementation

The correction's prose is candid, so **its report does not falsely claim complete nShow support**. However, returning TRUE with a `showCmd` property is not proof of that behavior. Browser `launchAppInner` does not consume `showCmd` to initialize guest STARTUPINFO or set window state. `createLaunchContext` uses `hidden` to suppress launch progress UI. CLI `process_spawn` accepts the seventh argument but discards it before `spawnVfsChild`. Minimized, maximized and hidden guest startup remain unsupported. Do not promote this branch to “ShellExecuteEx/nShow supported” in a dashboard or release claim.

The actual host→VFS→pending queue tests preserve `{hidden, showCmd}` for tracked, untracked and registered fallback launches. Tracked launch retains `bypassSingleApp`; untracked options do not accidentally bypass single-app scheduling. Calls still return before deferred boot. The fields copied into JavaScript strings remain valid after the source buffers are poisoned. These are transport/lifetime results, not actual child-window results.

Masks remain deliberately incomplete. Low-nibble namespace/class modes reject with error 120; tracked non-open verbs reject. Independent compiled calls with HOTKEY `0x20`, NOASYNC `0x100`, NO_CONSOLE `0x8000`, HMONITOR `0x200000`, and WAITFORINPUTIDLE `0x02000000` all return success and invoke the host without implementing those modes. In particular, queued execution cannot qualify NOASYNC/input-idle waiting. The report already discloses incomplete flags; these are surviving API compatibility gaps, not accepted implementations. Untracked verbs still reach a host that generally launches the EXE regardless of the requested operation. [SHELLEXECUTEINFOA member and flag contracts](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/ns-shellapi-shellexecuteinfoa).

## What passes, and what it proves

The exact correction helper was replayed with every source read pinned to `e295f112`, not to whatever files happened to exist in the sparse checkout. Its 30 original handler, 24 environment, 28 error, 52 allocation, 16 namespace rejection, 16 untracked host and 12 queue cases pass, along with its original host/CLI/browser assertions and thirteen rejecting controls.

The new helper adds **144 passing named checks**, **three rejecting compiled mutation controls**, and **eight rejecting D1 acceptance oracles**:

- Exact-size allocation red zones, poison-on-free, double-free/live-allocation tracking; expansion values of 0, 1, 259, 260, 1023, 2047 and 4080 bytes, repeated eight times in lpFile (up to 32646 output bytes), plus lpDirectory. Input buffers, struct fields, canaries and stdcall stack are preserved.
- Fault injection at every allocation index for A/W and tracked/untracked expansion; bounded allocator refusal of a larger output; successful lazy environment creation with its single persistent allocation distinguished from temporary leaks; host failure after expansion.
- Injected growth/shrink between sizing and filling returns error 8 without launching or leaking. This is an allocator-boundary injection, not evidence of actual concurrent environment mutation.
- Corrected shell status is retained in hInstApp while last-error becomes 26→32, 27/31→1155, 28/29/30→1156 and 32→1157. Original tests cover zero→8 and ordinary error/success cases. The 27/28/30 grouping remains explicit adapter policy, not native differential fidelity. The PID-only tracked failure route still maps all launch failures to 2. [ShellExecuteExA error contract](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shellexecuteexa).
- Nine integrated actual-JavaScript host/queue scenarios defer execution until after input-buffer poisoning. UI boot, VFS snapshot internals and child execution are mocked boundaries. Three additional mutations remove the output NUL allocation byte, an expanded buffer free, and expansion itself; the independent oracles reject them.

No additional allocation-length, cleanup or temporary-pointer lifetime defect was observed within these tested boundaries. The seven-argument ABI/header/default-host/generated-signature agreement and ordinary CreateProcess trailing defaults are checked by the replay. Full dispatch, all generated build gates and Worker transport were not executed. The changed `test/test-shell-execute-ex-w.js` was inspected but not run: its harness success and nShow-preservation assertions do not qualify child behavior.

Other surviving limits: W conversion narrows Unicode; shell associations/DDE/URLs are not complete; unresolved bare helpers can report success; accepted asynchronous boot can later fail; actual child process handles, wait/exit/state merge, CLI IPC, guest startup state and real-game compatibility are unqualified. Invalid-pointer/page translation and extreme integer-overflow inputs are outside the identity-addressing slice. No full build, runtime, browser, Boat, SSH command, benchmark, Claude, public deployment, held diagnostic or worker was run. Runtime 403 remains binding.

## Recovery and preservation

From a checkout of this review branch with the exact correction and candidate Git objects available:

```sh
node docs/reviews/shell-ex-corrected-independent-review-20261020.js EVIDENCE_DIRECTORY
```

The helper reads source/compiler objects with `git show`, compiles only small modules in memory and writes `tests.json`. Its output records exact hashes. Existing `.wat`/`.wasm` correction evidence is retained unchanged; this review needs no new binary artifacts. A first independent run exposed D1; the final helper records it as an expected rejection rather than changing its semantic expectation to call corruption acceptable.

Evidence is `scratch/runs/20261020-shell-ex-corrected-independent-review-oct20/`: `setup.json`, `tests.json`, `receipt.json`, `remote.txt`, and the isolated repo containing these two files. The receipt records publication and preservation verification. All 37 original correction evidence seals were verified. Exact two-file sparse patterns were installed before checkout; candidate/shared object alternates were read-only. Shared HEAD/index/config, candidate originals and unrelated WIP/laptop games were untouched. Numeric admission and subsequent gates reserve the full 8 MiB above `2210398208 + 33554432 + 25165824`; actual allocation remains under that cap. No main push or integration.
