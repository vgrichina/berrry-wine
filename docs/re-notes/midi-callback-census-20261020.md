# MIDI callback census audit: blocked by unsafe saved frame

Candidate: `a33fc31f0e8b5ed46b48bfa435bf4629e36a1bf3`.
The independent source audit found a concrete caller-state corruption in the
new MIDI callback path. Per the bounded assignment, stop without accepting
producer records or repairing production. The mandatory census remains failing;
its algorithm, predicates, JSON and checked-in tests are unchanged. This is a
report-only task branch, not a native qualification or integration approval.

## Exact blocker

`src/13-exports.wat:3408` exports `$fire_midi_out_callback_bound`, which calls
`$fire_audio_callback_bound` at line 3414. After admission, that helper calls
`$save_caller_regs` at line 3437, pushes five stdcall arguments and the
`$mm_timer_ret_thunk`, then redirects EIP. The return path is CACA000A in
`src/09b-dispatch.wat:1542`, calling `$restore_caller_regs` at line 1548.

The actual save/restore pair in `src/03-registers.wat:1025` and line 1038
preserves EIP, EAX, ECX, EDX, flag_op, flag_res, flag_a, flag_b and
flag_sign_shift in nine guest-stack words. It **does not preserve saved_cf**.
`$get_cf` at line 907 uses `$saved_cf` whenever the restored flag_op is 4 or 5
(INC/DEC). `$set_flags_inc` and `$set_flags_dec` overwrite saved_cf with the
current carry.

Concrete reachable instruction witness:

1. The interrupted caller executes `STC; INC EAX`, leaving flag_op=4 and
   saved_cf=1. A normal slice boundary can occur after that INC.
2. The host admits a MIDI callback and saves the nine-word frame.
3. The callback executes an ADD with no carry, then an INC. Its saved_cf is
   now 0. It returns normally with the required stdcall cleanup.
4. CACA000A restores flag_op=4 and the caller's other saved words, but leaves
   saved_cf=0. The caller now observes CF=0 instead of CF=1.

Neither callee-saved register discipline nor exact ESP restoration repairs
this: this callback interrupts execution asynchronously, and the callback is
free to change arithmetic flags. The defect predates the extraction in the
wave path; it is newly reachable through this MIDI producer. The helper's
comment calling the frame “invocation-owned” does not establish full saved
state or token ownership. No claim is made that MIDI introduced the underlying
save helper defect.

The source-only reproducer evaluates the actual parsed save, restore,
get_cf and set_flags_inc forms with a strict small instruction evaluator.
It observes identical ESP and EIP before/after, but carry 1 -> 0. Controls show
carry remains 1 without the callback mutation, and retaining saved_cf in the
evaluator state prevents this exact corruption. The latter is a diagnostic
control, not a proposed or applied production repair. No WAT compilation,
guest x86 execution, remote runtime, build or browser was used. Native
reproduction and any production fix require a separately assigned task.

## Lifetime and production-boundary review performed before stopping

- The wave wrapper now forwards literal WOM_DONE; the new MIDI wrapper forwards
  the explicit message. Both reach the same frame and continuation. The unchanged
  scanner detects the internal EIP-writing helper directly and the exported
  wrappers through call-graph reachability.
- Admission rejects null callback/EIP/ESP, yields other than 0/1, and overlapping
  timer or wave/audio callbacks before saving state. Seven wait/yield globals
  are saved in per-instance globals behind wave_callback_saved; the shared
  timer-active flag prevents a second async callback overwriting them.
  Six pushed words follow the nine-word save frame. The continuation restores
  the frame and then the saved wait; host wait counters are reset only after
  admission and restored when the callback-active state clears.
- No invocation child token is acquired by this helper, save pair or wrapper.
  The retained frame is a guest-stack frame, not a retained private token with
  root/epoch/child validation. Normal completion, process termination and trap
  must not be conflated: run's termination path clears audio-active flags,
  whereas a trap does not prove restoration or token retirement. The census
  `ownership: pending` semantics and nonlocal API lock must remain.
- `host.js:1413` `_offerWaveCallback` checks the captured cooperative exports
  against the current main instance or the active matching thread, suspension,
  EIP and exit yield. The new MIDI branch selects the MIDI export. Worker MIDI
  transport throws. The adapter at line 1881 forwards the captured registration
  handle, callback, instance, routing owner and queued message/header.
- `lib/host-audio.js:2178` captures registration, exports and routing owner at
  open. Unsupported worker/thread modes fail. Function notifications queue
  rather than executing guest code during open/stop/close. Window delivery
  retains the head on backpressure and rejects changed exports; event delivery
  is limited to DONE and rejects the high-bit mutex encoding at registration.
- The direct pump at line 2219 removes an item before its bound-export call,
  holds a reentrancy guard, restores the item on busy/throw, and clears the
  guard in finally. The browser path at line 4554 holds the shared audio-pump
  guard across await and removes an accepted/retired item only if it is still
  the queue head. Host routing validates the receiving VM before admission.
  `_midiDrain` detaches the queue before notification; completion marks done,
  removes pending ownership and updates header flags first. Close retires the
  handle before draining and retains the old registration in queued messages.
  These observations do not cure the downstream saved-frame defect.

This is not an exhaustive approval of other producer failure paths. The
confirmed saved-frame blocker triggers the requested stop; no blanket lifetime
acceptance, silent allowlist or hash refresh is appropriate.

## Evidence and recovery

`scratch/runs/20261020-midi-callback-census/` contains `audit.js`,
`audit-result.json`, `audit.log`, shared-state checks and file hashes.
Run `node scratch/runs/20261020-midi-callback-census/audit.js` from this repository.
It reads immutable candidate Git blobs, loads the candidate parser in memory,
records source/test SHA-256 hashes, reproduces the saved-frame witness, scans
the complete production source inventory through the unchanged gate, and runs
the existing census negative-mutation suite in a fresh parser context.
Source files are recovered from the candidate commit, not mutable worktrees.

The complete scan reproduces the native report's eight errors: two changed
host hashes, two unknown producers and four changed wave-wrapper fields.
The existing unknown/stale producer, wrapper reachability, hash, ownership
assertion and nonlocal-lock regression checks pass. No accepted baseline is
created for the unsafe new producer, so no new acceptance regression is claimed.
The initial audit harness attempts encountered a shebang-wrapper error and then
the parser's 128-file location limit when running tests in the scanner's parser
instance; the final harness strips shebangs for evaluation and uses a fresh
parser for the separate test suite. Neither change touches production tools.

The native qualification report remains
`scratch/runs/20261020-midi-native-qualification/report.md`, preserved by
`1d48863029ebcb7829ee1feb935722db7ceba345`. No native retry is authorized here.

**The future MIDI timing tip requires re-audit of every changed lifetime pin,
especially the whole-file host-audio hash, before integration.** This audit
reads only a33fc31f and does not accept the concurrent timing worker's source.
The coordinator must assign the saved-frame defect separately and review any
resulting producer/dependency changes before census reconciliation.
