# Chip's Challenge (Win16 WEP4)

## Background music — 2026-10-13

A fresh profile starts with Background Music unchecked. Enabling it through
Options (command 117) previously produced “The MIDI Mapper is not available.
Continue?” and no music. Both `CHIP01.MID` and `CHIP02.MID` were already mounted.

The MMSYSTEM.701 bridge converted the outer `mciSendCommand` parameter pointer
but forwarded its nested selector:offset strings as flat addresses. The resulting
MCI device had neither the intended sequencer type nor the MIDI file. Marshal
MCI_OPEN into stack scratch, translate flagged string fields, retain numeric
TYPE_ID/ELEMENT_ID fields, and copy only the returned WORD device ID back.
Win16 has a reserved WORD after that ID, so the remaining offsets match Win32;
the reserved WORD and caller strings must remain intact. Layout reference:
[Wine's MCI_OPEN_PARMS16](https://github.com/wine-mirror/wine/blob/master/include/wine/mmsystem16.h).

The second failure was the host sequencer's MCI_SEQ_STATUS_PORT query returning
zero. It now reports MIDI_MAPPER (`0xffffffff`) for its default synth output.
The game then issues MCI_PLAY itself, without dismissing a warning or patching
guest memory.

Validation: full build, `test-win16-task-args-mmsystem.js`, `test-midi-mci.js`,
and `test-win16-wep4-gameplay.js chips` pass. The adapter regression uses real
Win16 Pascal frames, checks translated pointers and TYPE_ID, and verifies that
only the two device-ID bytes change in the caller's block. Chrome cooperative
mode loads `chip02.mid`, parses 1,466 notes, and emits nonzero PCM at the master
bus after ordinary Options > Background Music clicks. This verifies playback
startup; Safari and an entire song/end-of-song transition were not tested.

Evidence is in `scratch/runs/20261013-chips-music-before/` (failed command trace)
and `scratch/runs/20261013-chips-music-after/` (successful command trace,
reviewed browser screenshot, browser menu/on-off log and PCM measurements).
The tested WASM SHA-256 is
`d19c10b798cf71449551fa0387ce5e971c3c3c083aa47ca78f800a0fb7364d58`.
There is no Chip's Challenge candidate-corpus ID, so no unrelated dashboard
candidate is attached to this evidence.

## Gameplay regression workflow — 2026-09-19

`test/test-win16-wep4-gameplay.js` formerly clicked screen (200,310), then
held Right under `--real-ticks` with a 700 ms host sleep. That click is not
merely an overlay-dismissal button: it steers Chip down the board and routes
subsequent keyboard input to the `BoardClass` child (HWND 0x10002). The old
test failed its >10,000 changed-pixel assertion on the current runtime.

Changing only the clock to `--tick-ms-per-batch=5` misleadingly passed:
26,700 pixels changed in the old ROI with **or without** Right, and both final
images were identical. The screenshot showed the board scrolling vertically
after the mouse action. This is not proof of working keyboard movement.

The corrected workflow dismisses the lesson overlay with Enter at batches
50/51, captures at 150, holds Right from 170 to 290, and captures at 280.
Use `--batch-size=20000 --tick-ms-per-batch=5 --repaint-every=5`, stop at 310.
With no mouse click, input routes to the main window. Visual inspection shows
Chip facing/moving right and the board scrolling horizontally.

The test runs an otherwise identical no-Right control. It requires identical
starting boards, zero board change in the control, and >10,000 changed board
pixels under Right. The board ROI (56,76,288,288) excludes all counter digits.
Measured: control **0**, movement **33,642** changed pixels. No guest/runtime
code is changed. The BoardClass focus behavior after mouse input is not
thereby proven native-correct and remains a separate investigation.

Verification: the complete WEP4 suite passes **7/7**. Removing the Right
keydown from the test in memory makes the board-movement assertion fail,
confirming the test no longer passes from startup/timer changes alone.
Logs: `/private/tmp/wa-chips-corrected-suite.log` and
`/private/tmp/wa-chips-no-right-negative.log`.

Local evidence: `/private/tmp/chips-probe.log`, `chips-fixed.log`,
`chips-control.log`, `chips-key.log`, `chips-key-control.log` and their PNGs.
Run the maintained regression with:

```sh
node test/test-win16-wep4-gameplay.js chips
```

## Keyboard after a board click — 2026-11-27

The September observation that a board click transfers keyboard focus to
`BoardClass` does **not** reproduce on current main. On commit
`5733f5c9615b0845f89b917489765b0cd5c444e5`, with published module SHA-256
`11a470569b6decdc5cd9527ca1513d23c156bdd6cdf6a9faddf5271e2e162cff`,
ordinary Enter at 50/51 followed by an ordinary board click at (200,310) at
batch 100 sends mouse messages to `BoardClass` (HWND `0x10002`) while focus
stays on `MainClass` (`0x10001`). Right at batch 170 routes to that main
window. Bounded Win16 tracing records the actual `USER.114 DISPATCHMESSAGE`
argument as `WM_KEYDOWN`, wParam `0x27`, Win16 HWND `0x108`, matching the
main-window Enter route. The guest main procedure handles arrows at segment
2:0x2540 (Right branch 2:0x25ea); the board procedure at 2:0x274e handles
paint, timer and left-button-down, with other messages sent to DefWindowProc.

Matched runs use the maintained test's deterministic clock, batch size and
board ROI. Enter-only stays still (0 changed board pixels); Enter plus Right
at 170 changes 30,516 pixels at 280. With the board click, the no-arrow arm
already changes 26,164 pixels from 150 to 280. Adding Right changes only 353
pixels relative to that control at 280, and both arms have identical board
pixels at 500. That early motion remains dominated by click steering.

A second matched pair waits until batch 550 before measuring, then presses
Right at 600, captures at 680, releases at 690 and captures at 900. Both
starting boards match exactly. The no-arrow board stays unchanged through
900; the Right arm differs by 32,429 pixels at 680 and 32,078 at 900. Selected
captures show horizontal scrolling after the settled click; routing and
Win16 dispatch evidence independently confirm the key's recipient. Thus
keyboard movement after this ordinary board click works on the tested build.
No emulator input/focus fix is justified, and all existing test assertions
remain unchanged. The original `test/test-win16-wep4-gameplay.js chips` passes.
This establishes current emulator behavior, not Windows equivalence or native
correctness of click/keyboard priority; no Windows or Wine reference was used.

Evidence: `scratch/runs/20261127-chips-keyboard-after-click-root/` contains
commands, compressed bounded traces, routing extracts, selected captures,
pixel comparisons, module identity/recovery recipe and `REPORT.md`.
The initial unbounded trace attempt was stopped for excessive log growth;
its finite termination receipt is retained and it supplies no gameplay claim.
