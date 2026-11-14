# Original TIM: manual-screen mouse callback blocker

Run: `scratch/runs/20261114-tim-puzzle1-gameplay/result.json` (local, ignored).
The original manual screen is reached, but verification was **not completed**.
There is no Puzzle 1 frame, placement, simulation consequence or solved claim.

The actual prompt requests printed page 1. That page of the original manual
was rendered and visually inspected: fishbowl, cat, lightbulb, left to right.
The manual PDF is `scratch/media/tim-original-manual.pdf`, SHA-256
`16115f62a074f1dfb5fb80a6c34e4162d717fa74c12c078d35655b11296cb196`;
its provenance is in `20261114-tim-manual-source/result.json`. The live prompt
and the manual page were re-inspected before each attempted fishbowl answer.
No guessed password, static answer injection or guest-state write was used.

In the qualified session 3, a freshly reviewed title receives ordinary Enter.
The settled manual prompt then receives a balanced click at the visually
identified fishbowl, `(543,103)`. Both release paths complete and execution
advances before the next reviewed frame. All three answer boxes remain empty,
and the pointer remains at its original position. The controller is stopped
through its bound review at 153,000,947 dispatches, with `held:false`, no CPU
fault and no runtime timeout. Its supervisor waits for exit 0, drains both
output streams, and records no remaining children.

Read-only instrumentation of the canonical `Machine.int33` entry explains the
missing input. The original registers function **0Ch**, the mouse event
callback, once. It makes **zero** function 03h absolute-position/button reads
and **zero** function 0Bh motion-counter reads. The complete counts are in
`session3/mouse-trace.json`: 00h once, 01h once, 02h once, 04h three times,
07h once, 08h once, 0Ch once, and 0Fh twice. In `tools/toyvm/dos.js`, 0Ch and
14h are explicitly accepted without installing or invoking a guest handler.
Changing the public mouse state therefore cannot reach this original game's
callback-driven cursor and button handling.

`callback-blocker.cjs` reproduces that missing behavior with a generated real
COM, independently of TIM's packed program. It registers mask 7 and a valid
far handler at `0100:0124` before the controlled event. The ordinary mouse
event is delivered, with one press and one release and no held button left.
The handler flag never changes: the guest exits through its failure path with
code 1 after 196,614 dispatches. This is an expected diagnostic failure,
not a passing callback implementation. Its watchdog is closed and absent;
`callback-blocker.json` records the fixture/module hashes and input binding.

An exploratory host-adapter repair supplied relative motion as well as
absolute position. A generated real DOS COM demonstrates a genuine polling
defect: the previous adapter fails the nonzero motion check, the repair passes,
and the stationary-pointer control passes both. Counter consumption, absolute
position and balanced button release are checked too. Both existing controlled
input suites pass, and a full build passes after regenerating both browser
bundles. This repair does **not** address TIM's callback path. Only this task's
adapter hunk was removed afterward; all incoming ToyVM source hashes are
restored. The exploratory patch and red/green results remain in the run for
review, with no code publication or adoption of foreign WIP.

Keyboard Tab does move the native cursor between parts. A bounded fallback
observes that movement but does not finish verification. Holding Tab long
enough to cover execution handbacks skips hotspots; subsequent short-key
preparation expires at its initial review without delivering an action.
Keyboard-only completion remains unproved, so the mouse defect is not a claim
that every ordinary keyboard route is impossible. Review timeouts in sessions
2, 4 and 5 are failures and are recorded as such. Session 1's outer supervisor
exits 143 before writing its completion receipt; its process is absent, but
actual child-wait/both-EOF evidence is incomplete. It is excluded from qualified
lifecycle evidence. Later sessions use detached finite supervisors with actual
child waits, both EOF receipts and independent immutable controller watchdogs.

Every original session starts the unchanged packed installed executable in
`sierra/tim`, with a fresh private writable Map overlay. All 13 installed files
match their incoming hashes afterward. TIM.EXE remains SHA-256
`34c844ba4586f27c817442ac5ed2f5b76e35d0c6521a9a9d4e7db66404e7c51c`;
the floppy remains
`d0e78876d50609b254420cdf7c0724a117a8ed714ea7c683c19e0d2094ce0657`.
The canonical ToyVM CPU module remains
`239f6584b458eb0b9c5f2916bd63b29681d2a446d1b821ea45a1cace6b823060`.
No unpacked EXE, configuration, score, saved state or puzzle import is used.
The lower-screen wrap remains visible and is not claimed repaired.

Only four selected, result-named PNGs are retained. Source recovery uses Git
SHAs, relevant binary diffs and patches for owned new controllers, without
source/media archives or module dumps. No box is created: ID/expiry null,
state `NOT_CREATED`, stop receipt N/A. The next substantive implementation is
real INT 33h/0Ch callback registration and event delivery with correct far-call,
register, stack and return behavior, followed by a fresh ordinary manual/UI
attempt. Puzzle 1 remains unproved.
