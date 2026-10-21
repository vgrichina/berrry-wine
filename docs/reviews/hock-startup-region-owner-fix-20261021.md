# Startup region owner prerequisite repair

Base: exact remote main `5b078c91d5cf6da5e337cda5e7665803c03c99e5`, tree
`dbcfcd920b0cfece25cd910af43074a46651c728`. Task branch:
`task/hock-startup-region-owner-fix-oct21`. No main merge; independent review
is required before producer-changing integration resumes.

The preserved canonical build stopped at `check-region-decls.js --check-owners`.
`src/00-regions.wat:1060` named a global that is defined in `01-header.wat`,
not in the named sync fragment. Change only the owner symbol to
`09a-handlers3-sync.wat:$startup_show_set`. This function publishes command,
pending first-show latch, and explicit-value flag at offsets 4, 8, and 0.
It owns initialization of the process-shared state. No allocation, layout,
executable WAT form, census baseline, or runtime behavior changes.

Inspected the startup-era declarations together, including the adjacent window
lookup additions since `8bcd437f` and the pre-existing launch identity region:

| Region | Bytes | Owner and finding |
| --- | ---: | --- |
| PROCESS_IMAGE_STATE | 144 | `13-exports.wat:$PROCESS_IMAGE_STATE`, valid symbolic mirror |
| CLASS_NAME_WIDE | 64 | `09c0-window-table.wat:$class_name_is_wide`, direct encoding-byte reader |
| WND_LOOKUP_RETIRED | 256 | `09c0-window-table.wat:$wnd_lookup_live`, direct retirement-byte reader |
| WND_LOOKUP_GENERATIONS | 2056 | `09c0-window-table.wat:$wnd_lookup_generation`, direct generation reader |
| STARTUP_SHOW_STATE | 16 | `$startup_show_set`, direct atomic publisher; corrected |

All 267 declarations pass strict mirror and owner gates. The existing
`test/test-region-owner-ratchet.js` now also exercises this regression and
rejects both the old global reference and an indirect consumer as owners.
Two actual CLI mutation controls exit 1 with the exact missing-definition and
no-direct-reference diagnostics; source is restored afterward.

## Validation and separate blocker

The evidence archive contains `tests.json` with every exact command, exit,
expected exit, duration, and log path. The 50 commands include 44 successful
exits, two expected owner rejections, one expected exact-base A/W rejection,
and the three initial failures explained below. No full local build ran.

- PASS: manifest, fragment balance, 401-boundary callback census and mutations,
  memory map, strict declarations, all owners, owner regression (21 checks),
  duplicate-WAT ratchet, all six region census modes, generated region mirror,
  five allocation shake modes, RPC/constants, test membership/timeouts,
  API/dispatch/kernel32 generation, hash/data strings/handler count and ESP,
  logical AND, silent stubs, GL barriers, host import signatures, browser cache
  self-test, stdcall epilogues, compiler provenance, layout-offset freshness,
  and whitespace. Baselines and generated outputs were not refreshed.
- PASS: submitted startup harness (24 cases), repaired latch harness (21 probes),
  independent exact-base startup harness (24 acceptance groups), adapted
  transport/layout harness (45 checks and three internal rejecting controls).
  These execute selected WAT slices and recording transport boundaries;
  they do not instantiate the complete emulator or launch a game.
- **Independent canonical blocker:** `node tools/aw-census.js --check` exits 1:
  `NEW DIVERGENT RegisterClassA/W` and `NEW DIVERGENT RegisterClassExA/W`.
  Confirmed again with the exact original region file restored. The unchanged
  ANSI handlers are at `src/09a-handlers2-runtime.wat:681,712`, Wide handlers
  at `src/09a5c-handlers-wide.wat:124,148`. ANSI calls
  `$class_table_register_data`; Wide calls `$class_table_register_encoded`
  and `$class_wide_name_key`. The direct-call census classifies these long
  bodies as divergent; the baseline does not allow these two pairs. Full
  extracted bodies and classifications are in `adjacent-review.json`.
  No claim that this proves runtime divergence; no repair or baseline refresh
  was attempted. This is the next canonical gate after the corrected owner.
- The extra toy-VM bundle check cannot finish in this sparse checkout:
  `fonts/Terminal.fon` is absent. Its ENOENT is a checkout limitation, not
  evidence of a source defect or a passing bundle gate. Bundle assets were not
  materialized under the 64 MiB task budget.
- The historical unadapted startup transport harness fails with
  `ReferenceError: ThreadManager is not defined`. The previously preserved
  `20261021-hock-startup-census-local/validation.js` adapter supplies the real
  ThreadManager and a recording child set. It passes here with base and
  fallback revision pinned to exact `5b078c91`. Both the failed original log
  and successful adapter are retained; no production change was made for it.

All materialized tracked files were compared to exact-base Git blobs; only
the owner line and regression test differ. `source-verification.json` seals
production inputs and confirms the owner-only production delta. All scanned
test JavaScript was materialized before region census and membership checks.
The initial projection, expanded sparse selection, resource floor, and local
allocated bytes were guarded before writes. Local budget is 67,108,864 bytes;
free-space floor is 2,285,895,680 bytes.

## Evidence and recovery

Run directory: `scratch/runs/20261021-hock-startup-region-owner-fix`.
Committed archive: `hock-startup-region-owner-fix-20261021-evidence.tar.gz`
beside this report. It includes original build log, test logs and commands,
CLI controls, startup results/adapters, source seals, patch, admission receipt,
and SHA-256 inventory. Extract to a new run directory with its own `repo`
checkout of this branch. `run-checks.py` replays the gates and owner controls;
`followup-checks.py` replays the preserved adapters and exact-base A/W control.
The scripts enforce this task's cap/floor; allocate space for the checkout
before replay. The local sparse Git database borrows existing object stores;
the pushed branch and committed evidence are the durable recovery copy.

Full canonical compilation, complete PE/NE invocation, compiled-module checks,
runtime startup, screenshots, and gameplay remain unproven. No compiled
emulator module was produced. No Boat/lifecycle commands, public deployment,
workers, laptop changes, shared source/config edits, or main merge occurred.
