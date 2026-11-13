# Pawn second-turn probe: fresh disk gate refused

The second native reply remains **UNPROVED**. This task reviewed parent
`0bfde3d97` and its report, full starting/reply/stalled captures, input helper,
native trace and idle-loop evidence before preparing another original. The
new run is `scratch/runs/20261113-pawn-second-turn-transition-0810/`.

The prior trace records both drags reaching main HWND `0x10002`: WM_LBUTTONDOWN
with wParam1, held WM_MOUSEMOVE, then WM_LBUTTONUP with wParam0. For the second
drag, the final client lParam is `0x00c6009a`; the UP was observed at batch
102224. This supports host delivery through release, but cannot prove that
Pawn committed d2–d4 or began its next native search. The reviewed final board
shows white d4/e4 and black Nf6, with a lone c3 outline. That outline is not a
reply witness. The parent's advancing batches, Sleep(10) return path and
drained render queue establish observed liveness/quiescence, without resolving
the native turn transition. No production defect or corrective patch is claimed.

Before the launch decision, the new supervisor froze the same current04 module,
six media, exact qualified owner guard and input/independent-UP helpers. Its
only command additions are existing `--trace-input-dispatch`, `--trace-input`
and `--trace-mouse-state` observers. A frozen read-only `turn-probe.js` records
actual owner/window geometry, host mouse queue/mask, guest EIP/yield/post queue,
capture/sleep/wait getters and worker/render completion state. It invokes no
guest setter, native callback, input poll, Present or scheduler operation.
The independent 600-second deadline remains a prerequisite for native launch.

The single fresh decision measured **1,498,787,840 bytes** available on /home,
below the required strictly-above-1,500,000,000 floor. The supervisor refused
before arming the watchdog or launching Pawn. There were zero new originals,
player inputs, menus, history actions or runtime effects. No floor retry,
foreign cleanup, RAM gate, resource edit or uncertain-action replay occurred.
Native/watchdog waits and EOFs are **NOT_STARTED**, not claimed as successful.

All 67 sealed parent files, 320 current source/module/media pins and unchanged
frozen helpers verified. Python AST and Node syntax checks passed. Evidence
contains the exact Git SHA, relevant binary diffs, untracked-source patches,
owned-helper patches and SHA-256 pins; no source/media archives or copied media.
The module remains
`04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.
This is a documentation-only change; no production build is claimed.

Next: after a concrete capacity change, freeze a fresh decision/probe and
observe one guarded original. Review each board separately before legal input;
if its second turn is ambiguous, ordinary native history/save UI may supply a
commit witness. Capture the transition before deciding whether it is native
computation, selection/drag state or a runtime defect. Do not replay this
refused run or count a second reply from the parent.

Box ID **none**, state **NOT_CREATED**, expiry **null**, stop receipt **N/A**.
