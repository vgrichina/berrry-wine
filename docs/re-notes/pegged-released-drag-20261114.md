# Original Win32 Pegged: released bounded drag

Run: `scratch/runs/20261114-pegged-released-drag/`.

The exact original is `test/binaries/entertainment-pack/pegged.exe`, 43,792
bytes, SHA-256
`bb5a4e90b71363cb7df5f818fc9a2de9841dbdfcb8a74498756b2c11438fe4c1`.
Its registry and media are unchanged. The earlier six-peg original remains
closed; its unchanged source-click image proves neither selection nor a jump.

Static original-handler evidence establishes left-button drag semantics:
WM_LBUTTONDOWN at `0x0100403b` accepts an occupied source, sets the active
flag at `0x01004268`, and calls SetCapture. WM_MOUSEMOVE at `0x010044ad`
handles that active drag. WM_LBUTTONUP at `0x01004b28` uses its destination,
releases capture, and validates an orthogonal distance-two jump, empty
destination and occupied midpoint through `0x01006680`. The active flag is
cleared at `0x010056df`. Board WM_KEYDOWN/WM_CHAR are not handled by this
wndproc. The referenced matching `pegged.hlp` is absent; no visible Help
contents are claimed. Focused static excerpts are retained in the run.

The adopted `tools/pegged-native-controller.py` and its two tests implement
one personally chosen fixed drag through existing public guarded pointer
edges. No public input or renderer change is needed. One fresh complete scene
must identify the occupied source, occupied neighbor, empty destination,
legal reason, exact centers and actual count before DOWN. An independent
child acknowledges its immutable 1750 ms fallback before DOWN; destination
UP requires identity-matched consumed DOWN and MOVE receipts. The complete
normal gesture is bounded by 1500 ms including movement. EOF, cancellation,
late ACK or uncertainty releases at the original source and closes input.
Physical cleanup precedes durable audit. No capture or model call occurs
while held. Every completed gesture requires a separate personal visual
removal review before another gameplay gesture. UNKNOWN remains terminal,
without retry or rebinding.

The coordinator's explicit prerequisite amendment permits this successor
after the predecessor's actual native, watchdog and supervisor-child waits
with both EOFs, supervisor heavy release and exact process absence. Those
records were personally checked. StarCraft's ancillary outer-wrapper wait
remains UNKNOWN; its independently proved native Quit is preserved. The
previous report `82d9d0ea` is read-only and retains its historical gate.

Validation and the single fresh default-puzzle outcome are recorded below
when complete. The controller is published after its focused tests and full
locked build, before launching that original. The original recipe is bounded
at 900 seconds, default batch size 1000 and real ticks, with an independently
prearmed 920-second watchdog and irreversible final 180-second Quit reserve.
No board/pattern/reset, private state, seed/clock/config write, solver or
automated board reader is allowed. Native Exit requires actual guest and
process evidence. No box or additional worker is created.
