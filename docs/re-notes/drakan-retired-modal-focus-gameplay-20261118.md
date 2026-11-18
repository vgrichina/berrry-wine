# Drakan retired modal focus — 2026-11-18

Evidence: `scratch/runs/20261118-drakan-retired-modal-focus-gameplay/` (ignored).
The two predecessor originals and their UNKNOWN scopes remain closed.

An ordinary authored PE reproduces the real pre-main NULL-owner MessageBox,
native Enter consumption and independent UP, followed by RegisterClassA,
CreateWindowExA with the measured hidden `0x00ca0000` style, ShowWindow(5),
and an ordinary message loop. Guest GetFocus immediately after MessageBox
returns the retired IDOK handle on the predecessor module. The guest exposes
that API result through its main-window title, independently of the observer's
focus field. Normal activation subsequently gives this authored main valid
focus; the retirement defect is demonstrated, but is not an exclusive explanation
of every authentic post-warning failure.

`wnd_table_remove` now releases precisely the retired window's local focus
before host retirement callbacks. Native modal tree teardown previously bypassed
the clearing in `wnd_destroy_recursive`. Unrelated focus is preserved; ordinary
modal restoration and ShowWindow activation retain responsibility for selecting
the next focus. GetFocus validates liveness and the calling queue's thread and
returns NULL for a stale or foreign handle, without assigning another window.
The quiet-handler inventory decreases by one with this implementation.

This follows the official [GetFocus contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getfocus)
and [DestroyWindow contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-destroywindow).
No Windows reference run or Wine was needed.

The corrected module passes the same authored transition: guest GetFocus is
NULL after warning destruction and normal activation selects live main focus.
A real worker_threads actor and idle instance over shared WND memory demonstrate
the distinction: the owner clears its focus while the shadow may retain a raw
private handle; GetFocus cannot expose that retired handle. Native controls cover
unrelated live/hidden focus, destroyed owner, calling-thread boundaries and
hide/noactivate commands. Existing activation, owned-form ShowWindow, window
state, renderer modal routing, and nested DialogBox/MessageBox continuation checks
pass. A real-tick 500 ms transition retains every pending response and its full
failure list in append-only JSONL, under the original three-second deadline.

Diagnostic limitations: the historical browser-worker focus test stops at a
source-text assertion about process routing; the older modal-worker test expects
idle yield 15 but observes 0 before reaching teardown. These are not reported as
passes. One authored 100 ms pulse closed on a late consumed ACK despite physical
UP acknowledgement; a separate authored control found exclusive receipt-name
collision, fixed by append-only JSONL. Those scopes were cancelled and actually
waited, without later endpoints. Fresh authored controls pass with a finite
300 ms pulse and unchanged 500/1750/3000 ms bounds.

The authentic run uses the predecessor's proven source graph and genuine media
closure, with the published modal-key and focus corrections. Git, owned patches,
the sealed compiler recipe and unique module provide recovery; no source-tree
snapshot or media copy is needed. Authentic outcome and cleanup follow below.
