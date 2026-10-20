# FindWindow selective current-main review — 2026-10-20

Task: `CROSS-PROCESS-FINDWINDOW-IW-20261010`. Review-only branch:
`task/iw-window-lookup-review-admitted-oct20`.

**Current main does not contain the retained cross-process FindWindow lookup.**
The admitted and remotely verified main is
`a54049d11955307d06309e146e85c1aca3196657`.
Local lookup behavior passes the bounded tests below; foreign lookup fails the
acceptance oracle on that main. The retained implementation passes ordinary
local/foreign cases but has a demonstrated stale-table fallback limit.
Do not mark the task done or claim actual launcher handoff from these results.

## Exact retained changes and current-main mapping

None of these three commits is an ancestor of admitted main. Content inspection,
not ancestry alone, establishes that their cross-process changes are absent:

| Retained commit | Paths and change | Current main |
| --- | --- | --- |
| `9ef79f697f5145a11e719f11f2f304c3757e7847` | `lib/host-window.js`: desktop `find_window`; `test/test-host-window-related.js`: lookup coverage | Host query and its added assertions absent |
| `692c9c43cde04b584fcae5ec247937512d3b53c6` | `src/09a-handlers1-user.wat`: call host from `$find_window_core`, resolve class atoms; `src/01-header.wat`: five-i32 import; `lib/host-import-sigs.generated.json`: RPC signature; host: separate class/title encoding bits, built-in class atoms; both lookup tests and `docs/re-notes/deus-ex-invisible-war-demo.md` | Production connection/import/signature absent; cross-process regression additions absent |
| `c27e6776b73b68b10660416e736d8ab7ad5264d9` | `test/test-find-window.js`: independent instance publication/destruction and real worker RPC cases; IW note update | Those test additions absent; no additional production fix in this commit |

The existing main `test/test-find-window.js` blob
`85c3d09846f8d293d16f1e9f56fba26ab714bec2` equals that file at `9ef79f697`
(before the API connection). Its local tests are not cross-process qualification.
The five functions `$find_window_matches`, `$find_window_z_first`,
`$find_window_z_next`, `$handle_FindWindowA`, and `$handle_FindWindowExA`
are text-identical between main and `692c9c43c`; the core's desktop prelude
is the relevant difference. `FindWindowW` is in
`src/09a5b-handlers-window-late.wat`, delegating to the same core with wide=1.

| Path | Main blob | Connected retained blob (`692c9c43c`) |
| --- | --- | --- |
| `lib/host-window.js` | `f143b630314b81e77f934dc85cad27d1fc57fe6f` | `71a8a5fd192b087c001961007451efebb2686557` |
| `src/09a-handlers1-user.wat` | `30c98dc348ac06e3d92b06e4462ad8100b49f1be` | `b635e37370c2ef41c207290959ed8a8ef8fc1a82` |
| `src/01-header.wat` | `fc769a725bff657e28d1910cf5c339613886b37b` | `60e7101ca1b1f1d538f1853b68c0784f52bdafce` |
| `lib/host-import-sigs.generated.json` | `afc0f35b6a193d027bed4b7f065a854648f97f35` | `30e14fa313e3b563e22f8eb5c8fb7f83d236f20f` |
| `test/test-find-window.js` | `85c3d09846f8d293d16f1e9f56fba26ab714bec2` | `cf3b15b6fd2dd9d68fdf5638845a4cd3a42f08f0` |
| `test/test-host-window-related.js` | `0ab9124db0423500890336ba5761bc793ca3079b` | `6e6e2e84a76568addcf5415795cc251d1e1a5297` |

`c27e6776b` changes the FindWindow test blob again to
`85db9b3a7a7214b5b9f1173c76176c370e3d2d58`; its four production blobs above
remain identical to `692c9c43c`. Full four-revision mappings are in `tests.json`.
Historical gameplay prose is not new evidence and was not used as acceptance.

## Executed evidence

Recipe, from an object-complete repository:

```sh
node docs/re-notes/iw-window-lookup-review-20261020.js . /absolute/path/tests.json
```

The helper loads exact Git blobs and the admitted main's vendored WATX compiler
in memory. It compiles actual API handlers, core, match and Z-order functions.
The complete actual host module runs in a JS VM context. Main fixtures use the
main host module; retained fixtures use `692c9c43c`. Table/class/string-helper
imports and renderer window records are controlled fixtures, not the full guest.
Two independent WebAssembly memories share a renderer dictionary for the
foreign-atom and owner-destruction check. The helper never launches another
agent or worker thread.

**102 recorded checks pass**, including source equality/mapping assertions,
behavioral checks and six expected rejection checks. This is not a claim of
102 full-VM test cases.

- A/W local class-only, title-only, combined case-insensitive filters,
  mismatched combinations, unknown names, class atoms and top-level selection.
- Direct children, excluded descendants, after traversal, stale after,
  wrong-parent after and A/W/Ex stdcall stack adjustment.
- Foreign A/W combined filters and mismatches; foreign built-in child atom.
  Main returns zero for live matching foreign windows; retained returns the
  real fixture HWND. A separate oracle explicitly rejects main's result.
- Actual host `destroy_window` removes foreign and child records. Coherent
  local-table cleanup eliminates local lookup results and rejects stale after.
  Owner-side host destruction is visible to a caller with separate memory.
- Registered class atom with wide foreign title retains independent class/title
  decoding. Empty desktop, empty title, desktop-parent alias and no-renderer
  `-1` fallback are checked. Preparation-only host A/W lookup and destruction
  are also exercised directly.
- Removing local matching, ignoring stale after, removing host class filtering,
  or removing host title filtering each triggers the expected assertion.

Compiled unmutated closure hashes:

- Main: 841 bytes, SHA-256
  `3f612ee20fa82c74c6c40d154c006c87851a40effacd8d5687f3101c70634199`.
- Retained: 988 bytes, SHA-256
  `01b70374eb25a4ea888e979dc451d00a63faf2535723b03e8c947ea78bf96d23`.

Initial harness attempts exposed compiler API adapter mistakes (`wasm` instead
of `wasmBinary`, then a module wrapper inappropriate to this compiler).
Those attempts did not execute lookup tests. The final successful run uses
fragment compilation with `standardWat:true,runtimeBuiltins:false`; no
production source was changed to accommodate the harness.

## Concrete finding and acceptance limits

1. **Main lacks cross-process lookup.** This is a reproduced missing feature,
   not just a missing commit: a live foreign renderer record with matching class
   and title returns zero through actual compiled main FindWindowA/W. Main lacks
   the host method, import and RPC signature needed to reach that record.

2. **Retained host-miss fallback can resurrect a stale local row.** In
   `$find_window_core` at `692c9c43c`, only a host result different from both
   `0` and `-1` is returned. Both other values continue into the local scan.
   This conflicts with the host comment distinguishing “desktop searched, no
   match” from “no desktop.” Repro: local row 501 has class `Stale`; actual host
   destruction removes desktop record 501, while the fixture deliberately keeps
   the local row. Host lookup returns 0; compiled retained API returns 501.
   An absence oracle rejects this result. Removing the local row returns 0.
   This is a proven behavior under table/desktop disagreement, not proof that a
   completed full DestroyWindow call leaves that disagreement behind.

   Main `src/09c0-window-table.wat:$wnd_destroy_recursive` calls
   `$host_destroy_window` then `$wnd_table_remove`, so normal coherent teardown
   does remove both. Host destruction has callbacks before returning, but this
   review does not establish reentrant reachability, crash cleanup, or the
   complete callback/lifetime contract. Simply suppressing all local fallback
   on host 0 also needs compatibility review: existing tests deliberately
   populate local-only windows. No production correction is proposed here.

The full `test/test-find-window.js` render harness, retained worker-RPC test,
actual create/destroy guest chain, real class registration/hash behavior,
Unicode beyond controlled ASCII case pairs, CLI IPC and original launcher
handoff were **not executed**. The existing retained tests describe broader
coverage but do not substitute for a current-build run. No gameplay,
full-build, browser, Boat, SSH command, benchmark or denied-runtime retry occurred.
Process-handle identity/lifetime and ShellExecute launch remain in their
separate assigned reviews; SendMessage was not redesigned or tested.

## Preservation

Owned files are this report and `iw-window-lookup-review-20261020.js` only.
Evidence directory:
`scratch/runs/20261020-iw-window-lookup-review-admitted-oct20`.
It contains `preflight.json`, `setup.json`, `tests.json`, publication receipt,
patch, remote-ref receipt and SHA-256 seals. The report/helper and Git objects
provide the recovery recipe; ignored output is not represented as Git-backed.

The isolated repository is `repo/` inside that evidence directory. Only the two
exact document patterns were installed before its first checkout; object
alternates are read-only dependencies. Shared HEAD/index/config are checked
against preflight hashes. The task publishes only its dedicated branch, never
main. Numeric admission is 2,277,507,072 bytes:
2,210,398,208 floor + 33,554,432 reserve + 25,165,824 concurrent caps +
8,388,608 task allocation headroom. Ongoing floor plus reservations is
2,269,118,464 bytes. Allocation stays below 8 MiB; final measured values and
exact commit/remote identities are in the publication receipt and shared board.
