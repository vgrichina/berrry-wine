# MW3 throttle: missing compiled observation, 2026-11-11

Run: `scratch/runs/20261111-mw3-throttle-consumption-cause-0125/`.
Baseline: `20261110-mw3-batched-native16-firefly-0050`, tested main
`2c29f727af55c20159749bbef21610c5215cc2a4`, module SHA-256
`75ecda5701c15f6fe2c269455ead4e15457b90653733df15d35674b08e8849d5`.

The retained run does **not** identify an emulator throttle defect. Trusted
native key edges are present; actual MW3 keyboard completions for those edges
are missing. The files named `consumed-approach-firefly` and
`consumed-set-forward-throttle` contain `claimed before execution\n`:
command reservation markers, not keyboard records. `browser.cjs` arms its
poll/held-frame observer only for Space. Its successful Space fixture cannot
establish that MW3 sampled either movement command.

## Exact route and control meaning

The shipped demo readme specifies Up Arrow = forward and top-row 0 = 100%
throttle (1 = 0%, 2 = 15%, through 0 = 100%). Source media is referenced in
the run evidence, never copied. Executable: existing
`binaries/shareware/mw3/ex/Program_Files/mech3demo.exe`, SHA-256
`df457ee6973f6f9d557c57aa3fc14258303486ec8b8742fd37b4369c1f37dbdc`.
The following are static default bindings, not a dump of the live game's
potentially changed configuration.

| Boundary | ArrowUp | Top-row 0 |
| --- | --- | --- |
| Pinned native helper | code ArrowUp, VK 38 | code Digit0, VK 48 |
| Production renderer/DI translation | DIK `c8` | DIK `0b` |
| Demo default binding initialization, `40dc0f..40dded` | action `12` hex | action `1e` hex |
| Game interpretation | per-update incremental throttle | full-throttle preset callback |

The actual keyboard path is renderer physical state plus buffered edges ->
`di_keyboard_buffer` -> compiled `IDirectInputDevice_GetDeviceData` in
`src/09a8-handlers-directx.wat`. Its DIK/VK table distinguishes extended Up
(`c8`, VK38) from numpad 8 (`48`, VK104), and top-row 0 from numpad 0.

The demo creates SysKeyboard at `4f729f`, stores it at `5fc90c`, installs the
standard 256-key format, requests a 128-event buffer and acquires it.
`46a9cc -> 4fa160 -> 4f7690` reaches the keyboard poll only when its game
input gates permit. `4f76c5` calls vtable+`28`; the return address is
`4f76c8`, stride 16, count 128, flags 0, buffer pointer at `5fc910`.

`4f7610` ages game key states at `5fc924 + DIK*8`; `4f7700` processes
returned records. A fresh press becomes state 1, a held state ages to 2,
and release ORs bit 4. `4f793a` dispatches registered key callbacks when
bit 1 is set. Consequently, a press and release in the **same later drain**
can still dispatch a preset callback. A physical-up snapshot, a zero-count
later poll, or a released-neutral frame does not disprove an earlier press.

Binding object `600af0` stores packed primary/secondary DIKs; `4f8120` /
`4f8140` extract them. `4f84d0` registers callbacks, `4f8560` dispatches the
mapped action, and `4f9510 -> 4f8590` queries action state.
`41f8bb` queries action `12`, tests state bits 0/1, and supplies positive
`0.025` throttle increment; action `13` supplies negative `0.025`.
`41fb8f` onward applies the controller's mode, neutral and decay logic.
Thus a two-second Up pulse is not equivalent to latching a full-throttle
preset, nor does its final neutral image establish the value during the hold.

`41e9e0` registers throttle preset actions with `41e9b0`, which forwards
through controller `5cc380` virtual+`18` to `41f170`. Top-row 0's action `1e`
reaches `41f490`, submits signed 1.0 through virtual+`20`, and updates mode
flags. These callbacks also have live controller/mech gates. Their execution,
active binding values and controller state were not captured in 0050.
No claim that neutral logic actually caused the original result follows
from this static trace.

## Retained original evidence

ArrowUp trusted DOWN `1794354735781`, UP `1794354737783` (2002 ms).
Digit0 DOWN `1794354805750`, UP `1794354805850` (100 ms).
The exact commands requested holdMs 2000/waitMs 3000 and
holdMs 100/waitMs 5000 respectively. The latter full-frame capture began at
`1794354811411`, over 5.5 seconds after release. The final cockpit speed
observation therefore does not bound speed during the pulse.

Full approach, preset and later observation frames retain Firefly, terrain
and cockpit; no positive chassis speed is established. Firefly range changes
alone cannot attribute player translation. Setup is the default Commander
Bushwacker, Operation 4A Battle Progression wave 1, no lancemates, Firefly
primary. No original fire was attempted. The run's disk-floor termination
does not establish a throttle root cause.

## Bounded observer for a separately authorized game

`tools/mw3-throttle-observer.cjs` wraps only the owning Worker's host API-log
imports **before WebAssembly instantiation**. The existing read-only decoder
`tools/mw3-keyboard-completion.js` validates actual compiled stdcall returns.
It records only keyboard GetDeviceData calls from `4f76c8`, preserves the
first invalid raw return, bounds records/depth/duration, restores the known
prior API-log setting, and refuses incomplete or replaced observations.
It sends no input and writes no guest memory. API logging can add overhead;
this is a diagnostic, not a timing-performance comparison.

Install in the verified owner/import construction context (bundle the two
CommonJS helpers for browser use if needed):

```js
const observer = attach(hostImports, {
  getExports: () => owningInstance.exports, memory, readCompletion,
  objectsBase: BASE.DX_OBJECTS, objectsSize: SIZE.DX_OBJECTS,
}); // before constructing owningInstance
// Verify exact module SHA, Worker/epoch and known API-log setting first.
observer.start({durationMs: 20000, apiLogBefore: 0});
// Existing authorized pulse runs unchanged with independently prearmed UP.
// Capture passive full frames during Up, then after UP and after Digit0.
const snapshot = observer.stop(); // save even if correlate refuses
const result = correlate(snapshot, {
  code: 'ArrowUp', downAt, upAt, downSequence, upSequence,
});
observer.restore();
```

Use trusted DOM edge timestamps on the same epoch clock, not CDP ACK times.
For each trusted edge, also record the live page renderer's
`_diKeyboardSequence` immediately after its normal input handler runs, bound
to that renderer/epoch. Supply those exact DOWN/UP sequences to `correlate`;
timestamps alone cannot distinguish an older queued pulse. Do not substitute
queue counts or fabricate sequence values. These extra edge observations are
required for correlation, not evidence that a guest callback ran.
One bounded window can cover both already-authorized pulses; correlate
Digit0 separately using its own interval. Installation after instantiation
cannot replace captured imports. Do not replay an accepted/unknown command. Keep exact
owner/module identity, raw records, full-frame timestamps and independent UP
evidence. A missing return can mean a game input gate or polling delay, not
automatically emulator loss. A successful matched consuming return proves
only that the game received records. `consumedDuringHold` reports whether
the press return preceded native UP; peeks do not qualify. If consuming
returns exist but speed remains zero in held frames, the next missing
boundary is the live binding/controller callback and mech state, rather than
host delivery. Do not rewrite guest controls or extend the hold to hide it.

## Local validation

`node tools/mw3-throttle-observer.test.cjs` instantiates the full built module
and invokes the real compiled x86 COM dispatcher, acquisition and keyboard
handler against the production renderer/host. Both VK38/DIKc8 and VK48/DIK0b
yield exact in-hold consumed press/release pairs. A second Digit0 pulse
drained after UP produces both edges but is correctly classified as late;
repeated peeks cannot qualify. Missing/stale native sequences, incomplete traces, cross-device pairs and
reuse are refused, and stopped captured wrappers remain inert.

This is a synthetic guest fixture, not a game run or chassis-speed test.
Initial unexpected audio-epoch import failures are retained separately from
the corrected successful fixture. The task creates no box and runs no
original game. No emulator or guest change is warranted by the evidence.
