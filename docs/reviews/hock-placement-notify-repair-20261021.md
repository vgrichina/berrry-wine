# Placement notification repair and original Hock retest

The candidate fixes the original Hock right-edge HUD clipping on exact baseline
`1d8dbd7a44656178d01869f28869be624a59fa39`. The same original 39-file package,
same 640×480 canvas, and same 45-second held-input route now display the whole
score and timer without a diagnostic resize. This is a task-branch candidate
for independent review; main was not merged.

## Contract and lifetimes

SetWindowPlacement snapshots all fields it consumes (showCmd and the four
normal-rectangle coordinates) into invocation-local Wasm values before guest
callbacks. It uses the existing SetWindowPos transaction with NOZORDER and
NOACTIVATE: CHANGING, commit, CLIENT_RECT recalculation/host synchronization,
CHANGED, and DefWindowProc-derived MOVE/SIZE. Consuming CHANGED still suppresses
the derived messages. Unchanged ordinary geometry derives neither message.
The prior CLIENT_RECT repair is preserved through that common transaction.
After the transaction, placement revalidates the HWND before its show phase.

The first-show continuation carries its target HWND on its guest stack above
the existing saved-return/result pair. Explicit ShowWindow and implicit
creation both initialize this frame. Activation continuations validate that
target rather than reread mutable main_hwnd; destruction releases the target
cell and completes with failure. The final SIZE continuation releases the cell
and reads the current client after activation/MOVE callbacks. Pending Get/Peek
startup size selection and the explicit dialog show path also read current
client dimensions instead of the creation-time payload.

ShowWindow's implementation is shared through show_window_core. Its caller
cleans the two-argument frame only on synchronous completion; a redirected
continuation owns its frame. Placement retains a success BOOL through startup,
while ShowWindow retains its prior-visibility return. The standard cleanup
gate remains unchanged and passes. Show-state resize publication also updates
the host client mirror after recalculation; the min/max control exposed this
previously stale mirror.

No regions were added: all 267 region owners still verify. The callback census
still contains 401 boundaries. Three entries were reviewed: ShowWindow's entry
moved to show_window_core with explicit return/target ownership, the dispatcher
added one destruction-completion redirect and retained-target reads, and Peek's
size payload changed. Other entries are untouched. Ownership remains marked
pending in this prerequisite inventory; this is not a claim of complete
invocation-token or nonlocal-jump support. No gate exemptions were added.

## Tests and rejecting controls

`test/test-window-placement-notify.js` executes actual guest x86 CALL/RET through
API thunks and real window procedures against the complete WAT source. A PE is
loaded only to initialize guest/thunk memory; its application code does not run.
The remote minimal checkout used the preserved BBLOOGIE.EXE via
`PLACEMENT_FIXTURE`; the default fixture is calc.exe on ordinary test hosts.

Candidate command: `PLACEMENT_FIXTURE=/home/user/hock-accepted-canonical-runtime/intake/game/BBLOOGIE.EXE node test/test-window-placement-notify.js`.
Final receipt `cmd_5xo3jalkbjpv`, exit 0. Coverage includes hidden/visible,
unchanged size, consumed CHANGED, current client payloads, caller structure
mutation, nested placement and destruction at CHANGING/CHANGED/MOVE/SIZE,
activation-time nested placement/destruction, stack/nonvolatile-register
restoration, Get/Peek pending startup payloads, and maximize/minimize/restore
state plus client-mirror controls.

| Control | Required rejection, observed exit 1 |
|---|---|
| Exact baseline, ordinary | No position notifications instead of CHANGING/CHANGED/MOVE/SIZE |
| Exact baseline, startup | Creation-time 392×273 instead of current 252×162 |
| Exact baseline, queued | Creation-time 392×273 instead of current 292×192 |
| Candidate with late showCmd read | Callback mutation incorrectly minimizes outer placement |
| Candidate with stale startup payload | Creation-time dimensions overwrite the nested placement size |

Five existing regressions also pass without skips: placement client geometry
(15 cases), hidden-child first-show size, secondary-top-level first-show size,
ShowWindowAsync owner-queue deferral, and GetStartupInfo A/W (134 sparse splits).

## Canonical build and original runtime

Canonical command, in `/home/user/hock-placement-notify-repair/repo` on
`bx_3f3x23m3`: `bash tools/build.sh`. Receipt `cmd_360lgkbtvgt7`, exit 0,
completed 2026-10-21 05:02:22 UTC. **All gates passed before the original retest.**
An earlier build correctly rejected a wrapper with delegated ESP cleanup; the
implementation was corrected, not the gate.

* Canonical WASM SHA256: `c62213f22cadd127bdd2dfd4f624d690b2814c18d5fcec7a3442080120f8d0c4`
* Compat WASM SHA256: `e021407609163bc9fa78d4a4baeabc06a620787bf5df818c7fb9c303f9cc316d`
* Unchanged baseline WASM: `eafeaa142c98fe60c489865c89a676c20afffe51002fe36799f42aa46d19ac2c`
* Original EXE SHA256: `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`

Runtime receipt `cmd_v3rji2gommdc`, exit 0, 45.281 seconds, 19 original-route
input/capture commands. Outer frame remains (38,0), 564×480; client remains
556×434. The guest drawing cache at 0x41eca4 now contains **556×414**, rather
than baseline 632×414. The full score and timer are visible in inspected
selected/final gameplay captures; the timer changes from 120 to 86. No game
patch, canvas enlargement, host resize commit, or guest-memory write was used.

This accepts the bounded HUD/input route, not scoring, level completion, audio
quality/synchronization, FPS, or exhaustive Windows placement parity. Score
remained 0/20. Min/max tests are state/client-mirror regression controls, not a
new implementation of every WINDOWPLACEMENT flag or saved-normal-position rule.

## Identity and recovery

Fresh checks verify all 7,133 baseline source/test files and all 44 intake
entries (39 game files plus provenance). The candidate has 7,134 source/test
files, with exactly four production source changes, the reviewed census, and
the new regression. Candidate hashes match the task checkout; unchanged files
match the preserved baseline manifest and exact baseline Git objects.

Local run: `scratch/runs/20261021-hock-placement-notify-repair`.
Remote run: `/home/user/hock-placement-notify-repair` on the same running box.
Full command receipts, logs, source/package/module seals, drivers and captures
are preserved there and in the accompanying evidence archive. `RECOVERY.md`
records replay paths. No module or game binary is committed.

The box remains running with TTL **2026-10-21T05:56:19.894Z**. The coordinator
owns lifecycle and independent review. No workers, lifecycle operations,
main merge, deployment, or unrelated source/configuration changes occurred.
