# Half-Life 2 public installer lifecycle investigation

Evidence: `scratch/runs/20261117-halflife2-public-installer-lifecycle-remedy/`.

The latest original remains permanently closed. This task made no request to
its endpoint, launched no original, and changed no runtime/controller code.
Installation and gameplay remain unproved. The conditional fresh original
allowance was not consumed because a causal remedy was not established.

The current published controller is `71d938888b6adeb8b0c31c4f2fc737786c8c133f`.
Its reviewed helper and scene bytes match the latest original's recorded source
inventory. Its restored adapter matches that commit. The retained module is
`928f8bd42c76b6435ec59d8b289b5a40a28da8b597a6e98e378b467311f11abb`.
The media remains at `scratch/media/half-life-2-demo-original.exe`, 787,701,212
bytes, SHA-256 `24205fa8cb6bfab70a82dd713f0addc7cfb0b3c4df40441ebea0320dcb3b441c`.
No media copy or payload expansion was performed.

The retained public log establishes more than the passive poll summary: the
hidden overlapped main `0x10001` was created, CreateWindowExA returned its HWND,
and the application later dispatched WM_SIZE and WM_TIMER. All 140 passive
startup observations refused readiness, with hidden main and null focus, over
a 14.484-second observed span inside the fixed 15-second startup operation.
The native process was subsequently host-cleaned with an actual wait and both
EOFs. This does not establish native UI Quit or explain the missing visible
focused scene. In particular, a blocked CreateWindow call and the earlier
missing helper join are not supported explanations for this run.

The earlier successful original startup in the age-input-latency run used the
same module and the same complete sealed source inventory except for
`tools/halflife2-reviewed-next.py`. Its readiness completed in 3.360 seconds.
The `startup` function's normalized AST is identical at `40fd97e98` and
`71d938888`. The newer pre-bind transport journal is a real helper difference;
these comparisons do not establish or exclude a scheduling effect from it.
The latest authored recovery/Cancel/Quit proof has an entirely identical sealed
source map and module to the failed original. Its native wait/EOFs and selected
whole-image hashes were checked. Both selected images were viewed in this task;
they show the authored agreement/age controls, not original installer progress.

Existing authored modeless transition, changing-main/generation, native focus,
independent release, and Cancel/Quit proofs are pinned by exact path and hash in
`inherited-proof-pins.json`. They retain their authored scope. They do not prove
the original's agreement-to-next-page lifecycle or eventual installation.

The shared `src/09b-dispatch.wat` creation-time WM_SIZE repair and
`test/test-create-window-failure.js` belong to `codex-dxsdk-rm`; neither was
edited or adopted here. An overlap inquiry was appended to the board. The
retained original also dispatched a queued WM_SIZE after CreateWindow returned.
Whether that notification affected its subsequent startup is unproved. The
public [CreateWindowEx documentation](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-createwindowexw)
describes creation messages; the [WM_SIZE documentation](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-size)
ties size/move messages to DefWindowProc handling WM_WINDOWPOSCHANGED. Those
contracts alone do not determine this original callback's consequences.

The concrete remaining blocker is failure to acquire a visible, focused ordinary
USER startup scene before the unchanged deadline, without public evidence
identifying a causal API/runtime/controller error. Loosening readiness, assigning
focus, extending the clock, or substituting the other owner's WM_SIZE change
would not be an established remedy. No such change or unchanged original retry
was made. Next work needs an authored reproduction of this hidden-main message
lifecycle that identifies a documented API violation and a tested remedy before
using the conditional affected-installer allowance. The original UNKNOWN cannot
be queried, rebound, or replayed to obtain that evidence.

Fresh launch-order/terminal-original guards, receipt-arrival clock checks, and
the seven controller supervision regressions were run under a prearmed
independent deadline watchdog. Their actual waits, watchdog waits, both pipe
EOFs, and final outcomes are recorded in the run. No new native runtime/module
was built or tested in this task; this is a documentation-only publication.
The exact source commit, relevant shared diff, proof pins, media hash, selected
whole-image pins and final result are retained without a source archive.
No workers, boxes, deployment, state/registry/media edits, private-memory
inspection, proprietary disassembly, or held Sims artifacts were used. Box ID
and expiry are null; state is NOT_CREATED and stop receipt is not applicable.
