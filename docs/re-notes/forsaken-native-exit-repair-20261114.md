# Forsaken original native Quit, 2026-11-14

Evidence is in `scratch/runs/20261114-forsaken-native-exit-repair/`.
This investigation uses the unchanged original demo, synchronous native D3DIM,
real ticks and the ordinary SinglePlayer / Normal / VOLCANO route. It makes no
white/blend, game-state, input-owner or dependency changes.

The fixed 600-second diagnostic reproduces the stuck Quit. Its bounded API
trace shows `PostQuitMessage(0)` (API 5804323, return address 0x428b28) returning
before the original caller constructs the back-buffer error and calls
`MessageBoxA` (API 5804333, return address 0x428bc3). The earlier block watch
observes bRenderingIsOK change from 1 to 0 during shutdown; a block watch does
not identify the exact writing instruction. Static original disassembly shows
shutdown at 0x428ad7 calling renderer cleanup, then posting quit, and the
render caller falling through to ShowBackBuffer after shutdown. The modal is
parked at yield15 with explicit quit pending. `causal-exit-extract.log` retains
the actual ordering and original x86 frames.

This distinguishes an original post-shutdown rendering attempt from the
emulator's modal-loop defect. [Microsoft's MessageBox explanation](https://devblogs.microsoft.com/oldnewthing/20101008-01/?p=12573)
says MessageBox exits its modal loop for a pending WM_QUIT.
[Modal dialog guidance](https://learn.microsoft.com/en-us/windows/win32/dlgbox/about-dialog-boxes)
requires preserving quit for the outer loop. [PostQuitMessage](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-postquitmessage)
queues that request; a pending flag alone does not prove native process Quit.
The existing shared modal pump never checks this pending explicit request.

The diagnostic also shows living traversal toward the hatch and a nearby green
enemy craft. A finite aimed primary Ctrl2000 pulse had an independently armed
release. Its actual midpress capture shows death/respawn and PULS2000; the
postrelease capture shows four lives and PULS1949. Ammunition use is proved;
projectile impact, enemy damage and a kill are unproved.

A local action name `pause-up` collided with the previous action `pause`'s UP
receipt filename while saving a postrelease capture. The action had already
been consumed, independently released with ACK, and made postrelease progress.
A read-only production nonce query confirmed consumed/CANCELLED with reason
`independent release`, never UNKNOWN. Original failure and resolution records
are preserved; no action was replayed, owner rebound or guard changed. The
run-local helper now rejects output-name collisions before any intent or DOWN.

## Repair and public tests

The uncommitted repair in `src/09c3a-dialog-runtime.wat` ends the owning modal
wait only for the explicit PostQuitMessage marker 2, using the existing modal
teardown and saved-call continuation. It leaves quit pending for the outer
caller. It does not manufacture an OK button, successful render result or
process exit. The speculative window-recreation marker 1 remains unchanged.
The only new runtime branch is eight lines in the modal pump.

`test/test-modal-postquit.js` runs synthetic x86 through the real public
PostQuitMessage, MessageBoxA/W and PeekMessageA thunks. The final test is red
on the original pump (done=0, quit=2, modal=65543, yield15) and green on the
repair (done=1, quit=2, modal=0). It checks the real stdcall stack and outer
WM_QUIT retrieval. Ordinary dialogs with markers 0 and 1 still wait for Enter.
Eight adjacent suites also pass: native modal command routing, A/W MessageBox,
Worker shadow input, Worker common dialogs, EndDialog lifecycle, teardown quit,
main-window recreation and Win16 modal destruction. `repair-checks.json`
records nine successful actual waits with separate stdout/stderr EOFs.
The public documentation predicts the Windows modal behavior; no original-game
comparison on a Windows installation was performed.

## Concrete publication blocker

No repair code is committed or published. The required full locked repair
build returned 1 at the callback ownership census before compilation. It
identified the changed modal pump and the separate LMarbles worker's changed
renderer producer. The census working file already contains six unrelated
foreign review/hash entries for uncommitted thread, render and NE sources.
Committing the whole census path would adopt those unrelated entries; publishing
the modal source without its matching review would break the clean-main build
gate. The task requires explicit-path commits and preservation of foreign WIP.

Only the modal pump's own census row was updated and reviewed, then released
uncommitted. `census-own-review-preservation.json` proves the existing foreign
hunks were preserved at that update. The LMarbles owner subsequently updated
its own renderer row separately. The exact own source/test patch is
`owned-code.patch`, and the exact modal census row is
`owned-census-review.patch`. The repair, test and review row remain coherent
WIP in the shared checkout; they must be published together using a method
that preserves the unrelated census changes. No build gate was disabled.

The repair build is not claimed successful, and no 900/920 validation was
launched. The next step is to resolve the owned review row's publication scope, pass
the full heavy/build-locked build, publish the modal repair with that row,
then perform the still-unused bounded original validation. Native Quit after the repair remains unproved.

## Original outcome and retained evidence

The original diagnostic's launch build passed under the heavy and build locks
in 61.564 seconds. The loaded module SHA256 is
`dcf6e8f0ca9d361c10fa556fb30835d34cf5bfe4089f84d298cb57fd170dbd42`.
`source-pins.json`, `actual-loaded-inputs.json`, relevant Git binary patches,
894 media/input pins and 162 private offline provider pins identify the actual
inputs. Postflight immediately after the diagnostic found no source, loaded
source, media, provider or module drift. Subsequent repair/foreign edits are
separately recorded; they were not retroactively attributed to that run.

The original finished on max-seconds600, with runtime stats599.996 seconds.
Native exit0, the independent prearmed620 watchdog's unfired exit0, supervisor,
outer-child and invoking-tool waits were actually observed with their output
EOFs. Timeout and exit0 are not native Quit. The input audit contains twelve
unique consumed actions, one permanent owner, independently armed UP/ACK and
postrelease progress (the final reviewed choice instead awaits actual process
completion). Maximum scene age was12.429 seconds and review age0.534 seconds.
The primary pulse lasted2.000095 seconds; its capture completed inside the
press, before independent release.

A test-only fixture initially overlapped another worker on port8466; that
fixture evidence is invalid and retained as a failure. Final controller tests
use exclusive8486 and verify the actual fixture child PID. Eight controller,
two extension, four supervision and one outer-wait controls pass. Production
input used direct8477 throughout and had no UNKNOWN receipt or owner change.

`result.json` names the eight retained full PNGs. Their dimensions, CRCs,
inflation and SHA256 are verified in `png-retention.json`. Repetitive API output
was compacted after its EOF; the original byte count/hash and selected line
ranges are retained. No source tree, media, module binary, frame series or
capture archive is retained. The private provider is reproducible from its
small pinned offline recovery inputs and was removed after use. No box was
created: ID/expiry null, state NOT_CREATED, stop receipt not applicable.
Full27, target damage and native Quit remain unproved.
