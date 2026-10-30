# Independent midiStreamStop acceptance (2026-10-30)

Accepted candidate `2def2064ac4461974e665ea7c47d10cc2073509c` within compiled
focused-handler scope. No production implementation changes.

Run `node --max-old-space-size=192 test/test-midi-stream-stop-independent.js`.
The new oracle independently extracts the production Open, Out, Stop, notification,
service and Restart functions and all stream globals, compiles them through the
candidate's vendored WATX compiler, and executes the resulting Wasm. It prints
source, extracted-form and module hashes. The fixture uses eight memory pages,
a nonidentity guest mapping, and explicit host/interpreter endpoint doubles.

Passing adversarial cases:

- A wrapped ring filled to its 31-buffer capacity; every original buffer is
  detached and marked DONE before the first notification. PREPARED and private
  flags survive; INQUEUE clears. Three invalid handles leave all stream globals
  and guest queue/header/stack memory untouched, with no synth messages.
- First function callback requeues its own returned header and stops recursively.
  Only the new ownership is returned by the nested stop. A different requeued
  header survives the remaining outer callbacks. Changing callback globals in
  that callback does not change the outer invocation's captured callback metadata.
- Callback types 0 through 7, both null and nonnull callback addresses, exact
  window/thread/event/function arguments, unsupported-type failure, and failed
  notification followed by success without losing the earlier error or buffers.
- Two nonreturning callbacks take exactly 64 interpreter-run calls each. The
  stop reports failure, returns both headers, restores registers and execution
  globals, and does not retry them on a subsequent empty stop.
- Stdcall cleanup, custom tempo/division preservation, cleared running/due/pending/
  pause state, paused service, and exactly sustain-off/All-Notes-Off messages on
  all 16 channels. The compiled closure needs no destructive host-reset import.

A separately compiled, validating state mutant resets tempo to 500000 during
stop. The same oracle rejects it specifically at `tempo preserved across stop`.
Its module hash differs from the accepted module; the mutant is never written
to production source.

The unchanged candidate focused test passed once as the first behavioral group.
An exact parent-table comparison verified that all 4534 old API rows remain
unchanged and the sole new row is ID 4534, midiStreamStop, stdcall with one arg.
Both exact candidate generators passed `--check` against the production tables.
Git comparison also verified that the materialized production/compiler inputs
remain unchanged from the candidate. No full VM build was needed.

Task resource controls: Node old-space 192 MiB, supervised group RSS 512 MiB,
parent RSS 128 MiB, CPU 60 seconds, wall 90 seconds, file cap 12 MiB and capture
512 KiB. Node startup retained unlimited DATA/address-space reservation with
physical RSS enforcement; Git alone received its 256 MiB DATA cap. The task
retains an 8 MiB publication reserve inside its 24 MiB disk allocation.

Two fixture failures are retained: unsupported inline memory export syntax,
then a nonreturning-run double incorrectly advancing ESP as if it had returned.
Only the fixture was corrected; the production implementation and behavioral
oracle requirements were unchanged. The final test passed after those repairs.

Limitations: no actual x86 callback body, full guest/gameplay, OS notification
delivery, host synth implementation or full VM dispatch execution was tested.
The run endpoint supplies RET 20 or a bounded nonreturning simulation. Generator
freshness establishes API wiring structurally. No Boat/runtime was allocated,
no main integration was performed, and there was no public deployment.

Canonical operational evidence:
`/tmp/madbomber-midistreamstop-independent-accept-oct30/completion-receipt.json`.
The coordinator owns oversized-messageboard append and allocation closeout.
