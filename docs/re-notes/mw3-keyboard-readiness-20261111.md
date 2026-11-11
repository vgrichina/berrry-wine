# MW3 keyboard-only readiness at 0x4f7ae0

Evidence: `scratch/runs/20261111-mw3-keyboard-only-caller-cause-0520/`.
No original game, browser, or box was launched. The executable remains the
existing `test/binaries/shareware/mw3/ex/Program_Files/mech3demo.exe`, SHA-256
`df457ee6973f6f9d557c57aa3fc14258303486ec8b8742fd37b4369c1f37dbdc`.

## What the retained originals establish

The 0500 full main-menu image is visibly rendered, with the game's software
cursor at its center. Its five-second recorder contains 57,055 keyboard
GetDeviceData entries returning to `4f7ae0`, device type 1, flags 1802 (`70a`
hex), mouse flags 1/users 2/acquired 1. The sampler reports an open mouse gate.
It also counts 57,056 PeekMessageA, GetTickCount and timeGetTime calls each,
with complete dispatch entry/exit counts, no errors/drops/pending frames and no
mouse requests/completions. These category counts lack a full chronology.

Crucially, `reads: []` and `records: []` in that recorder describe **mouse**
observations. They do not report the keyboard HRESULT, returned count, flags,
records, or the outer caller of `4f7aa0`. Those values are unknown for 0500.
Even 57,055 matching dispatch exits cannot reconstruct their keyboard data.
The native menu-lock command failed before input at the unchanged five-second
matched-read guard. This is neither proof of emulator input loss nor proof
that the ordinary interactive menu was ready.

The successful 0345 original instead has completed mouse Poll/GetDeviceState
calls returning to `4fa55f/4fa56c`, plus normal keyboard polling at `4f76c8`.
Its actual scaled software-cursor motion and pressed/released reads are the
evidence for ordinary mouse menu readiness. Reaching the same-looking background
in another run does not establish the same internal menu state.

## Authentic drain and its callers

`4f7aa0(ECX=blocking)` first ages key states through `4f7610`. It initializes
a local in/out count to **1**, then calls the keyboard at `5fc90c` through
vtable+28, using stride 16, data buffer `[5fc910]`, flags **0**, returning to
`4f7ae0`. It copies the returned count to `5fc914`.

HRESULT zero processes returned records. `8007001e` calls Acquire and then
processes the current count without immediately reissuing GetDeviceData.
Other HRESULTs go through the error reporter `4fa810` and return zero.
Alt (`38/b8`), Ctrl (`1d/9d`) and Shift (`2a/36`) update modifier bits
`100/200/400` at `5fc920` and return no key. Non-modifier pressed records
return DIK OR modifier mask; releases return zero. It updates the corresponding
eight-byte key-state record at `5fc924` as well.

At `4f7bfa`, a nonzero key exits. Otherwise, ECX saved at function entry
determines whether to return zero or loop at `4f7ac6`. There is **no timer,
message pump, sleep or mouse poll inside this loop**. Its count is initialized
only once: a blocking empty return leaves requested count zero on subsequent
iterations. The compiled fixture reproduces this, including a subsequently
queued key remaining unread until a fresh nonblocking invocation. This is an
original-code property, not a diagnosed emulator defect. All five static
direct callers (`42149d/421510/421583/421694/563406`) explicitly clear ECX.
The 0500 record does not show which caller executed; the near-equal message
and clock counts are consistent with repeated outer nonblocking calls, not
evidence of the internal blocking loop.

The four `421xxx` calls belong to control-binding UI branches. A separate
important path is `563406 -> 4f7aa0`, inside the sequence pump at `5633f0`:

1. A null current node (`this+18`) returns inactive without reading keyboard.
2. A non-modifier key press calls node cleanup, stops the associated resource
   through `53a330/53a6c0`, clears the node, and returns inactive immediately.
3. With no key, the pump calls node virtual+4 with `suppliedTime - this.start`.
   An active node keeps the sequence active. A finished node is cleaned up,
   replaced with its next pointer, and the next node is initialized.
4. On normal node completion the pump still returns active for that iteration;
   a newly null node returns inactive on the following call.

`5634c0` supplies unsigned timeGetTime ticks converted through a zero-extended
64-bit integer and multiplier at `599cf0` (approximately .001). The repository
disassembler labels `df 6c 24 04` as word FILD; its ModRM /5 actually selects
**m64int**, matching compiled execution. Preserve raw clock words when checking
timer behavior. Sequence callers include `46acd1` (DEMO_INTRO), `46ad9c`
(SPLASH), `46af77`, `40707c`, `464f6e`, `4731ee`, and the synchronous sequence
loop at `563350`. Therefore caller `4f7ae0` alone cannot identify a menu mode.

The authentic WAIT node starts at `563c50` and tests at `563c60`:
`active = suppliedElapsed < float(start) + float(duration)`. The authentic
movie node `563b90` computes a frame from `(elapsed - nodeStart) * movieRate`
and `_ftol`, skips decoding if the frame is unchanged, and otherwise uses
decoder success to determine continuation. Fade node `563870` has its own
duration/direction boundaries. None of these paths consults the mouse gate.
An open dispatcher gate is useful only when execution reaches dispatcher
`4fa160`; it does not force any of these sequences to call it.

## Tested bounded observer

`tools/mw3-keyboard-readiness.cjs` supplies a serializable `attach` diagnostic.
Install it **before instantiation** on the verified owning Worker's imports,
passing the existing serializable `sample` from `mw3-menu-poll-decision.cjs`,
`readCompletion` from `mw3-keyboard-completion.js`, exports getter, shared memory,
and actual region layout. Verify full executable/module/Worker/epoch identity
outside the helper. It owns one known API-log setting for one window; do not
run another API-log owner concurrently. Existing mouse admission remains intact.

It matches actual compiled entry/exit, reads requests only at `4f7ae0`, and
retains actual HRESULT/count/records, device/gates, blocking argument and outer
caller. For `56340b`, it also reads sequence/node identity, vtable step, next
pointer, raw start/current double words and 12 node DWORDs. For verified
`5634c0` wrappers it includes controller return address and raw tick words;
movie nodes additionally expose their rate word. Authentic code prefixes guard
the frame layouts. Unsuccessful returns survive before decoder rejection.

Storage has at most 64 aggregate rows by default, maximum 256; each retains
count and first/last raw samples. Clock/sequence counters do not create
unbounded keys. Different keyboard transitions remain separate. Overflow,
decoder failure, replacement or incomplete frames are diagnostic failures,
never readiness approval. Duration is at most 45 seconds, default five, with
expiry checked on hooks and passive snapshots. Stop restores prior logging;
restore leaves captured wrappers inert and reports table conflicts. This is
bounded evidence, not a complete transition chronology or an input controller.

`node --test tools/mw3-keyboard-readiness.test.cjs` executes byte-identical
drain, sequence, time wrapper and WAIT-node slices in the full production WASM
with production renderer buffered edges and compiled Acquire/GetDeviceData.
Synthetic caller, objects, callback counters and unrelated cleanup stand-ins
are labelled in the test. It proves empty/nonblocking return, pressed/released
and modifier behavior, the zero-count blocking loop, active/finished/null
sequence branches, press-to-skip, raw stack/clock decoding, actual WAIT boundary
at 1499/1500 ticks, overflow, failed HRESULT retention, changed-code refusal,
expiry, single-use and inert/conflict handling. This is not original gameplay.

## Remaining prerequisite

Capture this diagnostic in a separately authorized, identity-bound original
readiness interval, with the existing deadline and no input/replay. The missing
discriminator is the actual outer caller and, if it is `56340b`, the controller
caller, current node/step, raw time progression and completed keyboard returns.
That distinguishes ordinary intro/splash/timed presentation from a frozen
clock, failed keyboard API, control-binding mode, or another branch. Only then
can one justify an ordinary menu action or a specific emulator/control repair.
Do not send an arbitrary key, change the game's gates, treat absent reads as
a defect, or lengthen the admission timeout to conceal the unknown state.

## Ordinary launch integration (0530)

The existing small-input preparation command now recognizes the retained 0500
ordinary controller and automatically regenerates its serialized Worker prefix:

```sh
python3 -B tools/mw3-retention-repair.py \
  scratch/runs/20261111-mw3-complete-helper-cockpit-0500 OWNED_RUN
```

Use an owned destination with no colliding prepared files. This emits the
browser, dispatch observer, Worker prefix and unchanged owner/collector/recovery
inputs. Stage the remaining existing small launch dependencies as usual and
regenerate runtime pins before any separately authorized original. The direct
three-file installer is `node tools/mw3-readiness-install.cjs SOURCE OWNED_RUN`.
Neither command launches anything. Historical source inputs remain untouched.

The rebuilt prefix installs keyboard hooks before compiled instantiation, using
the published sample/return decoder. `attachDispatch` forwards its three log
hooks into a private keyboard hook table. Only the mouse recorder toggles API
logging; the keyboard observer runs with `apiLogOwner:false`. It resets bounded
storage on each mouse window and stops with that window. A keyboard diagnostic
error remains in its snapshot without disabling mouse logging or changing mouse
admission. The original standalone keyboard observer retains single-use logging
ownership by default. Existing throttle observers remain separately inactive
until their original controller route arms them.

Every ordinary dispatch snapshot now carries `keyboard`. The controller also
saves identity-bound `keyboard-readiness-last.json` before identity/validation
checks, and `keyboard-readiness-final.json` on stop. Thus the initial matched-read
failure's existing finally block preserves actual keyboard results, outer caller,
node and first/last raw clocks without issuing input. Preclick refusals retain
the same data in their existing refusal snapshot. No mouse validator, native
input route, command deadline, five-second stream guard or observation duration
was changed.

`node --test tools/mw3-readiness-install.test.cjs` prepares through the existing
Python entry point and executes the actual serialized prefix, compiled original
drain/time/WAIT slices and exact ordinary controller `execute()` with real command
transport. It proves causal retention with no mouse reads, failed HRESULT
retention, one logging owner, reusable bounded windows, sticky refusal/no replay,
and unchanged mouse move/press/release after a compiled completed mouse read.
Caller objects, screenshot admission and native sends are labelled fixture
substitutes; this is not an original-game readiness observation. Evidence:
`scratch/runs/20261111-mw3-readiness-integration-0530/`.
