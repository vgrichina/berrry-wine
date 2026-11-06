# Disciples II asynchronous mouse state, 2026-11-06

A proven emulator discrepancy is fixed; the income seal's cause remains
unresolved. Evidence is in
`scratch/runs/20261106-disciples2-income-consumer/`. Movement and a second
ordinary response are unverified.

`peekAsyncKeyState` previously selected the active dequeued mouse event's
button snapshot. A physically released button could therefore report down
while an older down message was active; a physically held button could report
up while an older released message was active. Microsoft's
[GetAsyncKeyState contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getasynckeystate)
requires current physical state. The mouse high bits now read the current
physical mask. Message snapshots in `getMouseButtons`, low-bit press
consumption, event ownership, routing, queue ordering and release holds remain
intact. The existing delayed-click test encoded the old discrepancy; its
corrected assertion failed before the fix (32769 versus 1) and passed after.
Regressions cover both stale directions for all five mouse VKs. The button-hold
regression and locked full standard/compat build pass. The census update
reviews only this synchronous producer change; broader ownership stays pending.

The retained seal native (490,405) agrees with the viewport inverse: native
800x600, output760x626, destination(0,28,760,570), clientrect(10,186,760,626),
physical(475.975,599.225). This run's terminal geometry matches those values.
A mapping defect has not been established. Host down/up receipt does not prove
original guest consumption, and the async-state fix is not proved causal for
the seal. The original button helper at 0x545fb1 calls GetAsyncKeyState and
tests its high bit at 0x545fde, establishing relevance rather than causality.
WndProc is 0x54a16a (registered at 0x549e27), GetWindowLongA returns at
0x54a179, and subscription dispatch 0x54a0a2 reaches virtual call 0x54a117.

The passive run-local observer verifies the unique actual slot0/thread1
Worker, endpoint1 and instantiated WASM bytes before attachment. It records
main-thread enqueue/dequeue state, full native coordinates/lParam, physical
mask, owning-Worker RPC call/results and logical frames. It distinguishes
recognized closed targets from live exceptions and preserves original calls,
receivers, results and exceptions. Retrospective hit-stack memory is not an
immutable message receipt; forwarded API batch times are not call times.
No guest writes, breakpoints, altered guest behavior or repeated presses.
Twelve exact observer controls, seven browser callback controls and HTTP
stream/range/HEAD/hash-negative controls pass. Initial helper syntax failure
and correction are retained separately.

After ordered predecessor FINAL releases and independent cleanup, the sole
original browser lifetime ran 12:28:07.784–12:30:27.733 UTC. Registered option,
selected value, exact EXE, enabled counters and actual owning Worker/module
passed. Observer attachment passed but remained disabled before game input.
I then mistakenly sent capture command5 with `type` instead of `action`.
The controller rejected it with `Reviewed screenshot reference required`
and closed at the first new failure. No relaunch. Personally reviewed terminal
capture shows the ordinary main menu, not the income dialog. There was only
the trusted shell Launch down/up, no game mouse/key input. This is a harness
operator failure, not evidence of a guest failure or a repaired seal.

Next boundary: validate the command envelope before writing a command (reject
missing/unknown `action`, including this exact `type` typo), then obtain a
separately authorized original session. Review each actual frame, use ordinary
menu actions, arm before the reviewed seal hover/held press, and correlate the
owning Worker's results and original WndProc HWND/thread/coordinates with
physical button state across logical frames. This distinguishes wrong point,
premature hover/press, missing guest edge, wrong owner and genuine consumer
behavior. Stop on the first new failure; only after dismissal attempt leader
movement and a second ordinary response. Do not replay longer clicks.

Tested source base is 7007710e67a1813f22668e4b575b7f31bd03c4e6 plus retained
Git binary diff/new-file patches. Standard instantiated module is
220beaba026d0aabaf25b4193a345ca6d704be64b0812a72d68adb0700ad80f2;
original EXE is adba242a0a3563651baffa6ec7d9a6c0978b7ae844a1cccedb2a1f4e8eb7b1f8.
Pre/post pins match 1282 source/module/fixture files and 127 support files
(170741632 bytes); media remains referenced in place. No source archive or
media copy. Independent final cleanup passes: 132 owned PIDs absent, port33581
refused, profile absent, four locks free, 4.55GB free, within the immutable
45-minute window. Boxes were not used (ID/state/expiry N/A). No listening,
performance, seal-dismissal, movement or second-response success claim.
