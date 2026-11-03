# Jedi patrol: 0.2 seconds bounded input, not the observation interval

The released patrol evidence does **not** establish a 0.2-second journey from
the last living position to the corpse. The last living observation preceded
the final Up request by **15.482–15.639 wall seconds**, with the game running.
The final input intents were **217.969 ms apart**; both down and up reached the
guest message path. No general host input scheduling bug is proven. Publish
findings only; another campaign remains separately authorized work.

This read-only investigation used
`scratch/runs/20261103-jedi-movement-duration-cause/`. It created/operated no
boat, ran no Jedi process, and changed no guest, fixture, configuration or
registry. The predecessor boat was not contacted. Active/laptop evidence was
untouched. Main contained both required commits
`7b46b5454522a666cb91b88f646c0e769dd0aff5` and
`d2ef199a9be799ca73673727c95ece7d4d13f0c3`.

## Reconstructed timeline

Paths in this section are relative to the retained
`scratch/runs/20261103-jedi-patrol-facing-encounter/`.

| Event | Retained evidence |
| --- | --- |
| Living southeast observation | `retrieved/session/southeast-refined-state.json`, batch2203216, sector280, XYZ(-0.153408274,3.536331654,0.320110977). Its enclosing `southeast-refined-checkpoint-terminal.json` ran12:24:37.990–12:24:38.147Z. Reviewed image shows100 health/100 shield/100 ammo. |
| Final Up intent | `retrieved/session/native-input-intents.jsonl`, epoch1793708693.6287885 =12:24:53.628789Z. Renderer dispatch at batch2245225. |
| Final Up release intent | Same JSONL, epoch1793708693.846758 =12:24:53.846758Z. Renderer dispatch at batch2245670. |
| First dead position | `retrieved/session/emerge-step01-state.json`, batch2245674, sector265, XYZ(-0.306553841,3.064019203,-0.129889011). Enclosing `emerge-step01-checkpoint-terminal.json` ran12:24:53.592–12:24:53.916Z. Reviewed image shows the player corpse/restart prompt and0 health/0 shield/100 ammo. |

The intent separation is217.969 ms, including request/response/Python overhead
around the requested0.2s hold. Dispatches are445 CLI batches apart. These are
host renderer dispatch receipts, not timestamped engine-input consumption.
`retrieved/session/output.log.gz` separately contains, in order:

- `[input] keydown vk=38 at batch 2245225`, then `check_input` WM_KEYDOWN0x100,
  wParam0x26/lParam0x01480001 and GetMessageA returning that message.
- `[input] keyup vk=38 at batch 2245670`, then `check_input` WM_KEYUP0x101,
  wParam0x26/lParam0xc1480001 and GetMessageA returning that message.

Thus the release was neither omitted nor merely left as an unexecuted request.
The trace does not timestamp the game's handling of it relative to the position
sample. The position is four CLI batches after renderer release. At most69.242 ms
separate release **intent** from completion of the enclosing checkpoint command;
this is a conservative bound including transport/capture, not a measured physics
interval. The complete position-observation interval is bounded by the enclosing
commands at15.445–15.926 wall seconds. More than15.48 seconds of unobserved live
time came before the final press. Death could have preceded the press.

## Request, queue, capture and clock are different boundaries

The retained `controller.py` sends separate synchronous HTTP requests via
`urllib.request` to the game control port8144. It records `time.time()` **before**
each input request and records the returned batch/logs afterward. It has no
duration field or engine-duration guarantee: the caller sends keydown, waits,
then sends keyup. Intent timestamps alone do not measure physical key hold.

`lib/control-server.js` waits for command execution. In `test/run.js`, live
commands enter `scheduledInput` at the current batch; `handleKeyDown/Up` executes
the renderer action and `settleLiveInput` resolves the request after that action,
before the following guest execution slice. In `lib/renderer-input.js`, Up's
physical key state clears at `handleKeyUp`; WM_KEYUP enters the ordered queue.
Win32 async state may remain ordered behind pending key messages. The retained
GetMessageA trace corroborates delivery beyond the renderer enqueue boundary.

`capture()` is three requests: pure read-only position/file observation, registry
export, then PNG. None pauses the session. PNG serializes the current canvas and
can represent the last completed rendered frame rather than the exact memory
sample. Review/retrieval/model time also leaves the game running. “Immediate
capture after release” describes controller order; it does not exclude the long
interval **before** the next request. This final checkpoint completed promptly;
there is no evidence of a many-second final capture stall.

The retained `supervise.py` and launch receipt select `--real-ticks` in launcher
and child, with no time-scale/startup-clock override or frozen mode. The generic
`--exe` route has no registered app startup-clock configuration. In
`lib/guest-clock.js` the selected clock is
`(Date.now() - CLOCK_ORIGIN) * 1`, integer milliseconds; `test/run.js` supplies
that same source to guest tick imports. `timeGetTime` in
`src/09a7-handlers-dispatch.wat` returns `host_get_ticks`. A CLI batch is an
execution budget, **not** a game frame or a fixed amount of guest elapsed time.
Multiplying445 batches by the default batch-clock step is invalid for this run.

The original binary further distinguishes **simulation time** from those timer
readings. Static inspection of the retained original JkDemo.exe, SHA256
`0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46`, shows:

- WINMM import index8 at IAT VA0x8f066c is `timeGetTime`; thunk0x42c540 jumps there.
- Original update0x4dd8f0 calls that thunk at0x4dd8f6, subtracts the previous
  reading at0x836c24, then clamps the delta to10–500 ms at0x4dd905–0x4dd924.
- After an optional flag-controlled0.2 scale, it accumulates delta into
 0x836c1c and writes seconds to0x836c14 using float0.001 at0x522f98.
  Original callers0x4c4e99/0x4c4f0e pass this elapsed value onward in the update.

Consequently frequent updates can accumulate a10ms minimum even when the wall
timer advances less; long gaps can be capped. This is original binary behavior,
not proof that it amplified this particular move. No per-update count, flag,
timer return or accumulated simulation-time sample was retained for the final
interval. Guest wall-clock selection does not establish equal simulation time.

## Displacement, limits and next action

The measured difference is XYZ(-0.153146,-0.472312,-0.450000), horizontal
distance0.496521 and 3D distance0.670099. The preceding crouch checkpoint's
horizontal difference was0.025477. These are differences between observations,
not isolated input-to-distance calibrations. Z includes descent/body-height
change; it cannot all be counted as forward travel. Gravity, residual velocity,
collision response and death motion need not cease on keyup. None was separately
measured here, so their contributions and even the onset of the displacement
remain unknown. The x displacement also opposes the last living look vector's
positive x component; a straight-forward distance model is insufficient.

The narrow unresolved question is **when position/health changed relative to
the final press, guest release handling and original simulation updates**.
No retained pre-press sample, velocity, health transition or intermediate frame
answers it. Death does not identify a shooter, prove a particular damage cause,
or establish an engine fault. Bossk266 remains unverified.

The next safe gameplay action, only in a separately authorized campaign, is a
fresh alive/position observation immediately before a short ordinary input,
followed in one bounded controller operation by timed release, immediate
read-only state/capture, and a short neutral follow-up. Record monotonic wall
times, actual guest tick/simulation accumulator and input consumption at those
boundaries using verified original addresses. Stop at damage/death and review
before further steering. Do not repeat a15-second live review gap as though it
were paused. Frozen mode is not a drop-in repair: CLI rejects combining it with
`--real-ticks`, and switching clocks changes the experiment.

## Verification and recovery

`analyze.py` reverified all232 retained manifest payloads including decompressed
fullSHA, and the8737543-byte evidence archive SHA256
`f962e88d1ce26e3698c2e9d5271c0b3597340d1f6433722801d62e7054676ebd`.
The five scheduling/input/clock source files inspected above match the released
runtime's sealed30932ca54be80b5fda5e6d8a9e0a13383711019c byte-for-byte.
`timing-findings.json`, `final-input-trace.txt`, original disassembly/imports,
control logs and the recovery manifest are retained in this investigation run.
The prior evidence and recovery recipe remain in place, unchanged.

Four existing no-guest controls passed: `test-guest-clock-source.js`,
`test-keyboard-message-lparam.js`, `test-control-server-step-progress.js`, and
`test-batch-clock.js`. An additional attempted control,
`test-input-consumption-clock-domain.js`, fails before assertions because its
VM fixture lacks `hasFlag` required by the production slice. That fixture failure
is retained, not represented as a pass or a scheduling regression. No runtime
code was changed; a full build was not required or claimed for findings only.
