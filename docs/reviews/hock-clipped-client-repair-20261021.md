# Hock right-edge clipping: causal diagnosis, no production repair

The original game's right-edge clipping is reproducible on exact main
`1d8dbd7a44656178d01869f28869be624a59fa39`. It is caused by stale resize
notification dimensions retained by the guest, not by the screenshot boundary.
The prior CLIENT_RECT repair remains necessary and unchanged. No production
patch, new module, gate refresh, or main merge was made.

## Dimensions and causal chain

The original executable creates a **320×240, 8-bit DIB**. Its startup code at
`0x406b05` requests a 640×480 play area through `0x4067d0`, which adds the
20-pixel status-bar height and non-client extents and scales the outer frame
to the available screen. On the default 640×480 screen it converges through
two placements to outer `(38,0)-(602,480)`, or **564×480**, with authoritative
client **556×434** at screen `(42,42)`. The whole outer frame fits the canvas.
This screen-fit calculation is visible in the original EXE's disassembly;
shrinking to fit is not itself evidence of an emulator error.

The only observed WM_SIZE entry in the bounded eight-second trace at
`0x406bf7` has HWND `0x10001`, message 5, wParam 0, lParam **0x01b20278**:
**632×434**, the creation-time client size. The guest handler stores its
width at `0x41eca4`, and stores height minus the status bar at `0x41eca8`.
The resulting values are **632×414**, confirmed by live read-only memory
dumps. `0x4064b7`–`0x4064d7` reads these values for StretchBlt. The API trace
confirms a 320×240 source stretched to **632×414**, while GetClientRect
correctly returns **556×434**. Thus 76 destination columns exceed the client.

The 564×480 per-window back-canvas already contains the clipped timer; the
640×480 composited screenshot does not introduce that crop. Both were
inspected. The back-canvas includes the window frame, not just client pixels.

The source explains both stale dimensions:

* `src/09b-dispatch.wat`, CACA0031, explicitly uses `$pending_wm_size` for
  restored startup. Its comment deliberately preserves creation-time sizing
  for compatibility. The first placement has already changed the client to
  561×434 when that callback delivers 632×434.
* `src/09a5b-handlers-window-late.wat:$handle_SetWindowPlacement` refreshes
  CLIENT_RECT and the host mirror after moving, as fixed by `5d5e48d0`, but
  ordinary already-visible placement with unchanged show state sends no
  resize notification. The second placement reaches 556×434 without updating
  the guest's cached drawing dimensions.

## Runtime controls on the same box and module

| Run | Observation |
|---|---|
| `geometry`, `cmd_qao4zkdmx3yr` | 250 batches; DIB, client, and StretchBlt dimensions above. |
| `wm-size`, `cmd_bvtcjqr8xuwh` | Eight seconds, one observed resize-handler entry, exact stack payload retained. |
| `baseline`, `cmd_r3ro49m8tbpe` | 45.230s; original held selection/movement route, 19 recorded inputs/captures, exit 0. Gameplay timer clipped; raw back-canvas and screen agree. |
| `screen800`, `cmd_gv5cheveqcls` | 45.224s; 800×600 at startup, held selection at adjusted screen coordinate (180,420). Client becomes 640×500 but drawing remains 632×414. Full timer visible with unused client area. Larger screen masks the symptom, not the stale notification. |
| `resize-controls`, `cmd_jqhihoxef8xu` | 30.223s; same original module and held selection. Enlarging only the canvas to 800×600 leaves drawing at 632×414 and timer clipped. Committing the existing 564×480 outer dimensions through the runner's normal `main-resize` path changes drawing width to 556 and makes the complete timer visible. No guest-memory write or patched executable. |

The final control invokes the existing `host_resize_commit` route used by
the harness to model browser resize-drag completion. It is a diagnostic
intervention, **not a repaired-build after test or a workaround accepted for
production**. Its before/after outer dimensions are identical. The unchanged
canvas-only result rejects screenshot/viewport size as the cause; the normal
resize result establishes that the original game can draw the complete HUD
when delivered consistent sizing. Windows execution/parity was not tested.

An earlier combined watchpoint/count probe changed execution granularity,
reached its million-batch cap in 33.634s, and did not match the original timed
selection route. It is retained at the evidence root as `held*`, not used as
gameplay acceptance. The separate `baseline/` run removes that instrumentation.

## Bounded stopping point

A correct repair must address **notification ordering and ownership**, not
change the game's rectangle or renderer clipping. Refreshing only the first
startup size would still leave the second placement's 561→556 change
unreported. Posting an ad hoc WM_SIZE or stretching to the client in the host
would avoid the required position-notification semantics rather than fix them.

The existing SetWindowPos transaction is a possible foundation, but adopting
it here introduces guest callbacks into placement before the handler's later
WINDOWPLACEMENT reads/show-state processing. Correctness requires an owned
placement snapshot, nested placement/destruction checks, and coordinated
startup-size delivery, including hidden/visible, unchanged-size and min/max
controls. The deliberately preserved CACA0031 behavior is inside the pinned
callback dispatcher. A safe general change to that contract was **not
established within this bounded geometry investigation**. This is the precise
prerequisite handed back; it is not a claim that all possible small repairs
are impossible, nor an automatic-approval rejection.

No speculative production candidate was built or tested. The unchanged
ownership gate verifies **267 owners**, and callback census verifies **401
boundaries**, without refreshing either. These baseline gate passes do not
qualify any proposed notification repair. The prior geometry regression and
canonical build are inherited evidence, not rerun or represented as a fresh
candidate. Scoring, audio, FPS, other games and lifecycle actions were outside
this task.

## Identity, evidence and recovery

Fresh remote seals verify all **7,133 source/test files**, original **39 game
files** (44 intake entries including provenance), and canonical/compat modules.
All source/test hashes were independently compared to exact main Git objects.
Canonical WASM is the inherited build
`eafeaa142c98fe60c489865c89a676c20afffe51002fe36799f42aa46d19ac2c`, not a fresh
main compilation. EXE SHA256:
`974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`.

Run: `scratch/runs/20261021-hock-clipped-client-repair`.
The accompanying `hock-clipped-client-repair-20261021-evidence.tgz` contains
the 53-file sealed remote evidence, command receipts, disassembly, source
mapping validation, input drivers, and recovery recipe. No game files or WASM
binaries are committed. `validate.py` verifies seals, source identity, runtime
exits, exact dimensions, input dispatch and the rejecting canvas-only control.
Visual inspection additionally confirms complete timer after resize commit.

Same `bx_3f3x23m3` remains running. Remote evidence is
`/home/user/hock-clipped-client-repair`; original source/module remains
`/home/user/hock-placement-loop-repair/repo`, and original intake remains
`/home/user/hock-accepted-canonical-runtime/intake/game`. TTL is
`2026-10-21T05:56:19.894Z`; coordinator alone owns shutdown. No workers,
lifecycle operations, shared source/config changes or main integration.
