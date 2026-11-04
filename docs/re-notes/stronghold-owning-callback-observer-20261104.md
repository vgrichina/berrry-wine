# Stronghold owning callback observer, offline integration

The missing callback/scene observations now have a bounded, read-only observer
composed into the retained original driver. The observation point starts before
the single balanced Custom Game gesture, rather than at the later preset press.
No original game attempt, browser, box access, retry, preset or Start occurred.
The cause of the historical shell remains **UNKNOWN** until a separately
authorized fresh execution supplies actual observations.

Input: `e07781e302bb560bab66f2e918a1def723eadfd1`, the
[unavailable-scene diagnosis](stronghold-unavailable-scene-20261104.md) and
[resolved-binding attempt](stronghold-resolved-binding-native-20261104.md).
Evidence: `scratch/runs/20261104-stronghold-owning-callback-observer/`.
No existing route, recognizer, production Worker or interpreter source was edited.

## Execution support and exact binding

The existing `src/13-exports.wat` run loop emits synchronous
`host.log_block(eip,esp)` before decoded blocks when the existing `set_trace_esp`
diagnostic is armed. CALL targets and saved return PCs are visible in both
shipped modules. The observer does not require an instruction hook or a new
production import. It labels these as block-entry/saved-return intervals,
not instruction-level CALL/RET certification.

`tools/stronghold-owning-callback-observer.cjs` provides `prepare(options)`,
`workerSource`, `createAttachment`, and the passive observer/preloader. `prepare`
uses the exact hash-checked retained driver and its existing closure loader,
the published resolved-URL binding guards, and the pre-first-script/context
bootstrap. It returns the composed source, route and evidence; it launches
nothing. A future authorized caller can pass those outputs to the existing
`stronghold-preset-driver-attachment.cjs` `compileClosure`. This assignment
does not supply a runtime launch command or authorize running it.

The original page compile/send SHA must match the one normal Module, Worker
URL, slot and init event. The original object passed to `WebAssembly.instantiate`
must be that exact init Module and memory, with slot0/endpoint1. The live exports
must remain the same instance and memory buffer, preferred image base0x400000,
thread1, original PE headers and checked native bytes. CDP target/session and
resolved URL remain exact at every RPC. Target/session form the annotation epoch;
duplicate/replaced Module, foreign epoch or detached owner terminates observation.
A transferred Module cannot be independently rehashed, so the original
compile/send SHA evidence remains a mandatory part of this binding.

The original installed executable is referenced in place:
`test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`,
SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`.
Tests verify its SHA and resolve every pinned VA through its PE sections before
execution. Pins include the complete callback0x430e10, descriptor immutable
origin/ID/artwork, callback pointer0x5bd0ac, manager0x46e050 prologue/request store,
and setup0x429100 prologue/first call. Mutable descriptor flags and dimensions
are deliberately not treated as immutable signatures.

## Recorded observations and stops

The observer records callback arguments, actual ID1/ID2 branch entries,
scene-manager arguments/ECX and saved return, setup entry/return, and completion
of the enclosing Custom Game callback path. It validates the ID2 manager
argument20/return0x430e76 and subsequent setup return0x430e7b; ID1 records
scene57/return0x430e44. Unexpected setup without preceding callback/request
history fails. Pending frames survive termination without a completion claim.

Every native row and host receipt includes current scene0xd13764, requested
scene0xd13770 and adjacent manager/mode state read in the owning synchronous
import context. The pure production JS `memUtils.g2w` translator performs reads;
the observer never calls `guest_to_wasm`, a guest function or a setter. The
attachment alone arms/restores the existing trace diagnostic. Original imports
are forwarded with their original return/throw behavior, including after an
observer error.

Ordered enqueue/drain receipts require the exact native543,292 gesture,
HWND65537, message order, masks, wParam/lParam, and empty active/last input after
consumption. Complete consecutive64-step ACKs pass the original driver validator
and the observer's per-guest checks; captures and input receipts must match the
latest completed step. These receipts remain host evidence, not proof that a
guest dispatched a MSG. ACK/capture annotations also sample native scene state.

Defaults cap storage at2048 records, 1MiB serialized UTF-8 row bytes and one
million delivered block boundaries. Explicit limits cannot exceed4096 records,
2MiB or two million boundaries. Individual annotations are bounded. The observer
honors the original absolute browser deadline, with a maximum360-second window;
it does not extend that deadline. The first fault is retained; overflow,
missing mandatory trace, bad binding/epoch/ACK, unmapped read, history mismatch,
deadline or import replacement terminates recording. A diagnostic failure
does not interrupt guest code inside the current slice: the driver rejects at
its completed ACK check before another slice. No absence claim follows from
incomplete history.

The composition keeps3072 arrival,4096 route,16384 navigation caps and the
original command/browser deadlines. It preserves the first exact historical
shell and allows at most three further256-step input-free samples. Acceptance
of this diagnostic shell requires equality of **all** game RGBA bytes with the
previously proved historical shell digest, not the recognizer's label alone.
The fourth shell, arrival cap, unknown scene or any fault terminates. A complete
scene20 observation also terminates this diagnostic without a readiness grant.
The mailbox explicitly denies preset/stability/handoff/native-install/gameplay
commands. Existing initial review, freshness, input and route authorization
checks remain in force. Read-only recovery and quit retain their existing path.

## Executable fixtures and limits

`node test/test-stronghold-owning-callback-observer.js` executes the actual
serialized Worker attachment before the shipped `lib/guest-worker.js`
instantiates each shipped module. Normal Worker slice messages execute x86;
tests never invoke `log_block` or native observer callbacks directly.

Fixtures execute the original complete callback with arguments7,1,2 and the
original scene manager. Synthetic caller/data and explicit dependency stubs
permit deterministic return paths. Setup executes its original prologue and
first CALL, followed by a **synthetic fixture epilogue**. Consequently the
setup-return test proves observer plumbing and nesting validation, not execution
or completion of original full game initialization. This is not a gameplay or
natural callback claim.

For both normal and compatibility modules, observed versus trace-armed control
matches every memory page, registers, flags and run results. Against an untraced
control, the only differing memory page is the existing diagnostic RPC mailbox;
guest memory/registers/returns and the original slice-command sequence agree.
Observer start and a failed missing-trace check preserve full memory hashes.
An actual endpoint2 init is rejected before any slice executes.

Negative controls cover slot/endpoint/media/URL/epoch/deadline, missing trace,
record/byte/boundary overflow, changed original bytes, foreign thread/instance/
memory, setup without callback history, foreign annotation epoch, reordered or
wrong-coordinate input, stale input/capture state, incomplete/skipped ACKs,
and preservation of the earliest fault. Attachment controls reject a foreign
session, duplicate/wrong-hash Module evidence and incomplete driver ACKs.
Synthetic IO tests execute the composed route to its fourth-shell stop,
including a shell immediately after release, unknown scene, arrival/aggregate
cap and original deadline. They verify one balanced gesture and no later input.

The predecessor bootstrap/binding regression and the unavailable-scene audit
(174 original ACKs, exact shell equality,22 negative controls) also pass. The
locked full build passes. Logs and the structured fixture report retain exact
module and Worker source SHA values; media/modules are referenced by path/SHA,
never copied. Exact starting Git SHA, relevant binary diff and patches for the
three owned new files are the source archive; no source snapshot/archive exists.

Box ID/state/expiry: **NA (offline)**. Closed `bx_7z5qca2h` remains stopped and
was never accessed. The coordinator retains all future allocation/shutdown
ownership. Next: a separately authorized fresh bounded diagnostic using this
composition, then a decision based on its actual callback/scene/presentation
history. This single implementation/testing assignment stops after publication.
