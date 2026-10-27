Candidate `24212b72fdedf2ff0274b156ed1503c76edc5b96` is rejected.

The unchanged pinned production fixture first passed rapid Space down/up at
renderer/checkInput → createWindowHost → extracted production WAT GetDeviceData.
The nine unchanged affected regression groups are reused from the coordinator's
verified canonical manifest; they were not rerun independently.

The independent challenge selects only DIK_SPACE (custom offset 7), sets buffer
size 3 (effective capacity 2), acquires, then delivers A down/up and Space down/up
without an intervening read. Expected: DI_OK and the two ordered Space records.
Actual: DI_BUFFEROVERFLOW and zero records. Space alone passes with this exact
format and capacity. The oracle also rejects lost, reversed and false-overflow
outputs. Original failing stdout/stderr and supervised exit 1 are retained here.

Reproduce, from the candidate-based checkout under the recorded supervision:

```
/usr/bin/node --max-old-space-size=512 test/test-directinput-independent-custom-capacity.js
```

The new test asserts the pinned supplied fixture hash, reuses only its exact
compiler/host setup prefix, and appends an independent challenge. It logs the
setup/challenge hashes, original WAT function hashes, focused module identity and
trap-only dependency names. Candidate sources and supplied fixture are unchanged.
Synthetic objects and custom-map memory are used, as in the original fixture.

Causal repair scope: `lib/renderer-input.js` `_recordDirectInputKey` admits every
raw VK transition into every acquired device's bounded FIFO. Capacity/overflow
is decided there. `src/09a8-handlers-directx.wat` `$di_kbd_collect` applies strict
DIK/custom-format filtering only when reading that FIFO. Omitted A records consume
both slots, selected Space records are dropped, and filtering cannot recover them.
Repair admission so omitted/unmapped objects cannot consume a device's configured
event capacity or set its overflow. Keep device/context isolation, bounded storage,
selected-object ordering, timestamps, sequences, peek/consume and lifecycle rules.
Do not merely suppress the overflow result: the requested events have been lost.

The [SetDataFormat contract](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/ee417925(v=vs.85))
defines the returned device format. As an independent implementation cross-check,
[Wine's queue_event](https://github.com/wine-mirror/wine/blob/master/dlls/dinput/device.c)
rejects objects absent from the user format before checking queue capacity. This
source reference supports the oracle; no Wine or original-game execution occurred.

The existing host closure takes three arguments `(device, op, value)` and forwards
to the renderer's per-host map. The supplied direct production fixture successfully
links and calls that import. Full generated signature/dispatch checks remain the
unchanged coordinator-verified results; no canonical engine rebuild was performed.
The previously retained full engine module cannot qualify this changed import.

First failure stopped acceptance. No actual OS Worker RPC attempt, further release/
reuse/modifier/isolation tests, browser qualification or original Airstrike run
followed. The supplied RPC result remains in-process only. There is no game-cause,
gameplay, integration or deployment claim. Only diagnostic evidence is published.
No Boat assigned or operated; coordinator retains future runtime lifecycle ownership.
