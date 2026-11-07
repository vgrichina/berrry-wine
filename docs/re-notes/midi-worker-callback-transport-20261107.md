# Owning-Worker MIDI callback transport, 2026-11-07

Implemented the transport missing at the Hexen II threaded startup reported in
[the browser investigation](hexen2-browser-gameplay-20261107.md). This is an
emulator implementation and generated regression work. No Hexen II executable,
media, guest disassembly, browser run, or gameplay was used in this assignment.
The original application's next startup/menu/gameplay checkpoint remains untested.

Evidence: `scratch/runs/20261107-midi-worker-callback-transport/`. The recorded
base commit plus `implementation.patch` reconstruct the owned changes, including
new files. Git is the source archive. Publication SHA is in the run metadata.

## Transport and ownership

`lib/host-audio.js` now admits function/window callbacks when the opening RPC
captures a real supported Worker link. It retains the exact Worker, endpoint,
backend/slot, host/process, and document identity. Unsupported modes, missing
Worker transport, and old modules without invocation authentication still reject
explicitly. Music synthesis and stream stop/reset/timing behavior remain real.
The receiving Worker's ready handshake advertises invocation-aware MIDI support;
missing capability rejects before creating a device, rather than accepting an
open against an endpoint that cannot register callbacks.

`lib/guest-worker.js` wraps the actual brokered MIDI open imports. After a
successful open it registers the handle, generation, callback mode/address,
instance, endpoint/slot, native invocation root, and opening child token on the
VM that called open. Existing native identity exports `null_diag_root` and
`null_diag_token` supply those identities; the latter validates the shared
process epoch and thread lease. Delivery compares the captured root and validates
the current lease before posting a window message or admitting the real bound
MIDI callback. A child invocation may have returned since open; matching its old
child token to the current child would incorrectly reject legitimate completion.

The existing wave offer transport carries MIDI messages with a separate MIDI
registration map. Both families share the same pending-offer fence and monotonic
token sequence. An ambiguous acknowledgement retains the exact offer/token;
replaying it cannot enter the callback twice. MIDI mode/message/root/endpoint
participate in the receiving signature. A retired or replaced owner never
redirects execution to the page VM or a replacement Worker.

Open, done, and close use one ordered queue for both function and window modes.
The Worker registration survives the close RPC until the ordered close offer is
accepted, including a lost close acknowledgement. Function delivery retains the
existing production callback stack/register/flag/wait restoration and scheduler
bookkeeping. Window delivery posts through the owning VM's real message queue
without clearing its parked wait or changing its CPU continuation.

The four changed JS producers were reviewed in the required callback census;
the broader system ownership status remains `pending`.

## Fixture drift diagnosed before implementation

`test/test-midi-stream-lifecycle.js` failed at its compilation assertion, JS line
174; that was not a generated-WAT source location. Its `handle_\S+` extraction
captured the closing parenthesis of new zero-argument dispatch calls. The emitted
trap sentinel became `(func $handle_glPassThrough_sf) (param ...) ...)`.

The fixture now extracts exact identifiers and counts arguments from each actual
generated call. Restoring parsing exposed missing production `pending_gap`
diagnostic dependencies and separate GL dispatch guard sentinels. Those are now
included. Unrelated dispatch branches still trap; real MIDI handlers, API hash
lookup, generated stop dispatch, invocation checks, callback admission, and
save/restore continue to execute. Assertions were retained.

Two existing wave fixtures also failed against baseline: the scheduler double
lacked `startPendingWorkers`, and the render harness had no loader to establish
the native invocation root. The fixtures now supply that scheduler dependency
and call the actual production process initializer, respectively. Their original
callback/wait/ABI assertions pass. The independent stop suite's exact source hash
pin was updated for the reviewed production file; its behavioral oracle and
mutation assertions remain intact.

## Verification

`test/test-midi-worker-callback.js` compiles the full production WAT closure with
small test entry exports and runs actual `guest-worker.js`/`WorkerLink` endpoints,
synchronous import RPC, browser owner admission, real MIDI handlers, generated
x86 callback code, and the production callback return continuation. It covers
slot 0/native TID 1 and slot 3/native TID 4, including:

- Ordered open/done/close, including close before any callback is delivered.
- Pause/restart shifted deadlines, stop/reset draining, and timed completion.
- Real x86 ABI arguments, volatile-register/stack restoration, and parked waits.
- Lost open and close acknowledgements, busy/suspended/in-flight owners, stale
  tokens, conflicting tokens, and invalid callback modes.
- Wrong root, generation, callback, instance, slot, or endpoint; host process,
  document, Worker replacement and retirement; no page/shadow callback execution.
- A second actual Worker replacing the native thread lease while the old VM
  retains its old local root: the shared lease check rejects delivery, neither
  VM executes the stale callback, and the old CPU snapshot stays unchanged.
- Function and real window queue delivery, plus wave registration/callback/close
  sharing the same token transport with MIDI.

Using the original host owner gate from the recorded base commit makes this
integration test fail with `MIDI worker callback transport unsupported`. This
negative isolates the original host rejection; it is not a whole-baseline run.

Additional passes: lifecycle 29 cases / 45 real callback admissions and returns,
all 21 lifecycle mutations killed; independent stop 5 cases and 4 mutants killed;
host-owned stop 3 cases and its no-drain mutant killed; wave owner, queue,
scheduler, wait/TLS, full-WAT function callback, and browser pump regressions.
`flock /tmp/wine-build.lock bash tools/build.sh` passed after the census review.

Canonical module SHA-256 remains
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`;
compatibility module is
`04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72`.
The tested Worker module with generated test exports is retained separately,
SHA-256 `3c5be87cb8acb800e9eec7ce0a13b186f3fcff9126785b25c19d19df41e56698`.
The unmodified notepad PE is only a fixture loader input; its existing path and
hash are recorded rather than copying it into evidence. There is no audible
output, native Windows comparison, FPS, browser, or gameplay qualification.

No test boxes were assigned or allocated; box ID/state/expiry are not applicable.
The initial read-only disk check found 1.81 GB free; editing/building began after
shared free space recovered above 2 GB. No peer cleanup or lifecycle actions
were performed. Next: a fresh authorized original Hexen II browser startup and
gameplay followthrough using the published transport.
