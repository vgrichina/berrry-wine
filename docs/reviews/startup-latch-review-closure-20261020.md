# Startup latch independent acceptance closure — 2026-10-20

**ACCEPT_SOURCE_SLICES** for exact candidate
`aa8f7e23362eca7db7a71beb3deab3f20bbb916e`.
This closes the interrupted independent review. Its disk stop was an incomplete
review, not a source rejection. No production edits or main integration occurred.

The accepted scope is NULL/invalid HWND latch preservation, failed
WM_NCCREATE/WM_CREATE preserving the startup choice for a successful retry,
successful creation committing after callbacks, invocation-owned saved HWND
selection, and preservation of a successful nested ShowWindow's consumption
when the outer creation subsequently fails. The original candidate
`b09ba2e350bf8789210c8bf6ad2fa3299b15045b` rejects the NULL and both
creation-failure assertions. Those defects are fixed in the reviewed candidate.

## Evidence reuse and missing work

The predecessor evidence is retained unchanged at
`scratch/runs/20261020-startup-latch-independent-final-oct20/`.
Its uncommitted independent JS remains in that directory's `repo/docs/reviews/`.
The closure does not use that checkout to execute tests.

The new closure script independently checked **420 distinct revision/path
SHA-256 seals** against Git objects. This includes candidate source, fixture and
assembler identities, original-candidate controls, and the historical baseline
`8bcd437fa4852417b13d375e54e07280621a161a`.
`closure.json` records each reused artifact hash, its inputs, module identities,
the preserved independent WIP oracle hash, and the new replay commands' script
hashes. An input inventory is not execution coverage of all those inputs.

Reused successful evidence, without repeating passed suites:

- 24 independent acceptance groups, no failures.
- 24 submitted complete-path cases.
- 59 validation checks and three rejecting transport controls.
- 18 submitted repair acceptance groups plus three inherited observations
  (21 probes total; these are separate from the 24 complete-path cases).
- Seven independent rejecting control runs: NULL, early consumption, blind
  rollback, missing commit, saved-HWND ownership, original NULL, and original
  failed creation. The latter includes both failure callbacks.
- Four submitted rejecting controls: explicit, info, continuation and renderer.
- Three exact-baseline observations establishing the inherited limitations below.

Only two submitted control replays were missing. They now both exit 1 from
behavioral assertions after successful slice compilation:

| Mutation | Rejection |
| --- | --- |
| iconic | `guest iconic state`: 0 differs from expected 1 |
| retval | `first ShowWindow returns previous hidden visibility`: 1 differs from expected 0 |

The replay uses the exact candidate's submitted fixture, replacing only its
checkout-or-baseline source reader with an exact-candidate object reader.
All assertions and mutation definitions remain unchanged. This prevents sparse
missing files from falling back to historical source. There are now six
submitted rejecting controls, seven independent rejecting control runs and
three transport controls. Missing mutation targets and compilation failures
are not counted as behavioral rejection.

The historical creation/activation mutation targets describe the old selection
boundary and are superseded by early/commit/ownership controls. The earlier
`fixture-expansion-limit.json` is a superseded harness attempt, not acceptance
evidence. No additional passed replay was needed after seal verification.

## Tested identities

| Input/module | SHA-256 |
| --- | --- |
| `src/09a5-handlers-window.wat` | `11feb8f27c040256a3e42bfea987abbb3775eab2238718a895f479a7c95d77d5` |
| `src/09b-dispatch.wat` | `df689900332c057f75bcc974382997f603af6ae117df11edb3097b447eee0643` |
| Independent final slice source | `9d0b8bfe7a53523cec00f882e505d66a4c641420dd6f81f2dabe78f277017903` |
| Independent final wasm, 61,254 bytes | `61c3548d16940149f40141680154a304f05783818e1bf6ca0e55119d0af74e0b` |
| Submitted complete-path wasm, 53,976 bytes | `150b36a3770639dce3292115970211f245cc3b94903282fe608f55c628e98765` |
| New iconic control wasm | `da261ffc1ee5b51f916cd3237aa609eb3d8d2f78021a9e15d1ca040fa38462f8` |
| New retval control wasm | `f7f57cafd79943edab77d8860055cab16db1030e27112485b98ffd67415b860b` |

The independent and submitted repair acceptance evidence have the same final
expanded module identity. Individual attempts and their function/import
inventories remain in the original JSON artifacts. Closure runs used Node
v24.18.1. These are compiled dependency slices with ret16 callback adapters,
identity guest addressing, seeded class records, and renderer/cleanup boundaries.
The assembler/compiler are reused machinery, not independently implemented.

## Inherited limitations and qualification

Exact baseline probes and candidate observations retain these defects:
dialog-marker ShowWindow returns constant true and emits incomplete iconic
activation/size arguments; nested hidden owned creation can take the outer
activation continuation; removing a window record during activation does not
stop subsequent continuation delivery. These are inherited limitations, not
newly fixed behavior or reasons to mislabel the interrupted review as rejection.

The dialog test records `dialog_default_proc`, not actual DLGPROC execution.
Record removal is not full DestroyWindow. Abort notifications, timer/post
cleanup and renderer teardown are recording boundaries. Native class failure
semantics, CBT reentrancy, real guest instructions, full VM, PE, Worker, browser,
game and concurrency behavior remain unqualified. The native successful return
path's helper call was inspected in the exact diff; no new native runtime
acceptance is claimed. This acceptance is limited to the assigned source scope.

## Recovery, isolation and local delivery

New evidence:
`scratch/runs/20261020-startup-latch-review-closure-oct20/`.
`inventory.json` records the provenance inventory before the missing replays;
`closure.json` records the completed review; `negative-{iconic,retval}.{json,log}`
contain new control evidence. `receipt.json` records the exact local review
commit, branch, protected-file checks, patch paths and final disk measurement.
`SHA256SUMS.json` seals the closure evidence and owned documents.

The fresh isolated repository configured exact sparse paths before checkout:
only the two required review JS files were initially materialized. No `src`
tree was checked out. Other inputs came from Git object readers using flattened
read-only alternates. Only this new report and its closure JS are committed.
Shared and supplied HEAD/index/config and all predecessor evidence/WIP are
checked against start-of-task hashes. The earlier worker's documented temporary
cap breach is retained as historical evidence; it is not attributed to this run.

Writes were admitted under a fixed **2,285,895,680-byte available-space guard**
with conservative reservations and a **16 MiB task allocation cap**. Final
measured allocation and capacity are in the receipt. No full build, browser,
Boat, runtime403 retry, workers/refill, deployment, Claude or laptop game work
was performed.

To reproduce the closure from its isolated repository, retaining the sibling
evidence directories and Git object stores:

```sh
node --check docs/reviews/startup-latch-review-closure-20261020.js
node docs/reviews/startup-latch-review-closure-20261020.js
node docs/reviews/startup-latch-review-closure-20261020.js --complete
```

The first execution only audits retained evidence; `--complete` reruns the two
missing controls. The local commit's `change.patch` and `commit.patch` are in the
new evidence directory. Apply the review patch to the exact candidate with
`git apply --check` before applying, or use the format-patch with `git am`.
The patch preserves review files, not external run artifacts or alternate object
stores; retain those separately for recovery.

Publication remains blocked by the established HTTPS credentials / SSH host-key
failure. No publication retry, auth/trust change or remote verification was
attempted. The local commit and patches are **not a remote backup**.
