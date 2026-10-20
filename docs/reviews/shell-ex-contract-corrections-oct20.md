# ShellExecuteEx contract corrections — 2026-10-20

Source correction of candidate `940e0a5faa6b7bc563e4284d27aaf22217e9eebb`, based directly on remote-verified main `a54049d11955307d06309e146e85c1aca3196657`. Task branch: `task/shell-ex-contract-corrections-oct20`. No main integration.

The fresh reproduced findings in `scratch/runs/20261020-shell-ex-review-complete-oct20/{blocked.json,independent.json,tests.json}` and the original independent helper were read first. Their 75 independent cases, 30 original cases, five controls and synchronous RPC probe are prior evidence, not newly claimed executions. The unfinished prose review was not repeated. Only the candidate's eight necessary production/existing-test paths were applied to current main; its old report/helper and historical ancestry were not imported. Current main's unrelated ownership, snapshot invalidation, DLL seeds, parser and lifecycle code remain intact.

## Corrections

`SEE_MASK_DOENVSUBST` now expands **lpFile and lpDirectory only**, through the actual guest environment functions. It runs after the existing W-to-ANSI conversion, before either host route. Parameters and verb are not expanded. Absent directory, empty values, unknown or unterminated tokens, case-insensitive names, nonrecursive values and disabled expansion are covered. All converted/expanded buffers retain explicit ownership; allocation failures return FALSE/error 8 without launching. The reused expansion routine now checks its scratch/output allocations and lazy environment allocation before writing.

The documented member contract specifies expansion of those two paths. See [SHELLEXECUTEINFOA](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/ns-shellapi-shellexecuteinfoa).

`hInstApp` retains the host's legacy shell status while last-error is translated: 26→32, 29→1156, 31→1155 and 32→1157; zero remains error 8. The adapter also categorizes incomplete association (27) as 1155 and DDE timeout/busy (28/30) as 1156. These latter category choices are implementation policy, not a native differential finding. Synthetic status injection validates translation; it does not show that today's host produces every status. Microsoft distinguishes shell status from extended Win32 error in [ShellExecuteExA](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shellexecuteexa).

Browser tracked launches preserve `showCmd` alongside the existing hidden flag. Untracked absolute/relative VFS launches and registered-app fallback now carry `{hidden, showCmd}`. The browser pending queue retains those options. Untracked launches retain single-app scheduling; only an explicit tracked `bypassSingleApp` request bypasses waiting for the parent. This prevents merely adding untracked options from accidentally changing scheduling.

## Fresh validation

From the isolated checkout:

```sh
node docs/reviews/shell-ex-contract-corrections-oct20.js ..
```

The JavaScript recovery/test helper reads missing sparse sources from the exact base Git object. It reuses the original compiler/extraction adapters, compiles actual production ShellExecuteEx and environment functions with the repository's vendored compiler, and executes the resulting small Wasm modules. Guest address translation, allocator and host imports are controlled boundaries. The environment table is a supplied guest-memory fixture; the lookup and expansion implementation is actual compiled source.

Passing:

* 30 original compiled A/W cases; 24 expansion cases; 28 injected error cases.
* 52 allocation-failure cases, including lazy environment creation; 16 unsupported namespace-mask cases. Input structs/strings and boundary canaries are preserved, and temporary allocation tracking is empty at return.
* Actual extracted host, CLI and browser functions: original 12/9/11 boundary assertions; 16 untracked host cases; twelve immediate/queued registered/VFS cases.
* Thirteen rejecting controls: main stubs, removed force, wrong output offset, removed expansion, identity error mapping, reviewed candidate, removed expansion scratch/output guards, dropped untracked options, dropped queue options, dropped tracked show command, and host/CLI opt-in regressions.
* Syntax checks for the six changed JavaScript files and `git diff --check`.
* Seven-argument import/header/default consistency and ordinary CreateProcess's added ABI defaults are asserted in the helper.

`tests.json` includes tested source hashes, compiled module hashes, control failures and fresh numeric pre-write readings. `.wat`/`.wasm` slices are retained with a committed recovery script. Original RPC evidence is reused only for unchanged RPC code; it remains synchronous shared-memory transport evidence, not Worker scheduling qualification.

## Limits and next review

This fixes source-level launch contracts, not the entire Windows shell. `showCmd` now reaches browser launch options, but `hidden` suppresses launch progress UI only. Guest STARTUPINFO/window-state behavior and nonzero minimize/maximize handling are not implemented here. The headless CLI still does not apply nShow to guest startup/window state. No claim of hidden guest windows or full nShow fidelity is made.

The existing W path narrows to ANSI bytes and does not provide full Unicode filename support. Namespace/class requests and tracked non-open verbs explicitly fail with error 120. DDE, arbitrary associations, hotkeys, input-idle waiting, other unsupported flags and detailed host spawn failures remain incomplete. In particular, tracked spawn failure still maps to file-not-found because the PID-only host interface supplies no extended error. Existing untracked shell fallback can report success for unresolved bare helpers; this was not silently upgraded into a complete association implementation.

Review these changes independently before serialized integration, especially overlap in host/header/pipes with the separate alias and lookup branches. Native-Windows differential validation of the broader mapping categories, full guest startup/show handling, full dispatch/build gates, actual Worker transport, child wait/exit/state-merge and exact-build game behavior remain future qualification. Runtime 403 remains binding. No full build, browser/game runtime, Boat/SSH command, benchmark, Claude, deploy, worker launch, process-alias/FindWindow implementation, or laptop Heroes II/Warcraft III work was performed.

Evidence: `scratch/runs/20261020-shell-ex-contract-corrections-oct20/`. Its receipt records exact commit/remote verification, capacity, source preservation and hashes. Shared HEAD/index/config/WIP were not changed. The sparse checkout used explicit file patterns before initial materialization; `src/10-helpers.wat` was explicitly added before its materialization. Maximum task allocation is 8 MiB; every gate conservatively reserves the full allocation above floor 2,210,398,208 + reserve 33,554,432 + concurrent caps 25,165,824 bytes.
