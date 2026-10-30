# Mad Bomber: midiStreamStop

Base: `fef550cf4706601b267ce7848d78a5681e57c843`. The base has streaming
Open/Out/Pause/Restart and a 31-header ring, but no midiStreamStop handler or
API row. Append API ID 4534 and regenerate both generated WAT outputs. Existing
4,534 rows remain byte-for-byte equivalent as JSON values, including IDs.

Microsoft's [midiStreamStop contract](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamstop)
requires pending buffers to be returned through the callback mechanism with
MHDR_DONE set, and invalid stream handles to fail. It distinguishes stopping
notes started by note-on from the broader reset operation. The
[MIDIHDR contract](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/ns-mmeapi-midihdr)
defines DONE, INQUEUE and PREPARED ownership flags. The
[reset contract](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midioutreset)
also returns pending buffers and releases sustain. The
[restart contract](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamrestart)
resumes a paused stream and rejects invalid handles.

Stop validates a nonzero current stream handle, stops service and clears due,
pending-event and pause timing without discarding tempo/division. It snapshots
and drains the original ring, marking every header DONE and clearing INQUEUE
while retaining PREPARED and other flags. It then releases sustain and sends
All Notes Off on all 16 channels through the existing ShortMsg synth path.
It deliberately avoids host_midi_out_reset, which destroys the host synth state.

Open now retains callback, instance and callback type. Stop delivers MM_MOM_DONE
to window/thread callbacks, signals event callbacks, or invokes the five-argument
function callback with the original guest header address. Function callbacks use
the existing synchronous interpreter/thunk convention and a bounded run loop;
failure to return reports MMSYSERR_ERROR. Register and execution state are saved
per invocation. The original queue is detached before notification, so nested
stops cannot return its buffers twice, and newly queued buffers survive.

Validation (Node with `--max-old-space-size=192`, task supervisor RSS 512 MiB):

- `node test/test-midi-stream-stop-focused.js`: PASS. The fixture extracts and
  compiles the actual production Open, Out, Stop, Pause, Restart, notification
  helper, service and stream globals using the vendored WATX compiler. It
  instantiates a four-page Wasm memory with a nonidentity guest-address mapping.
  Covers ring wrap, delayed events, stopped/restarted playback, flags, callback
  arguments/order, all callback types, nested stop/requeue, invalid stop handles,
  repeated/empty stop, register/ESP restoration and callback timeout.
- An independently compiled replacement stop that only validates handles and
  returns success is rejected at the FIFO completion callback assertion.
- Both generators ran successfully; both `--check` freshness gates PASS.
- Exact pinned baseline archive comparison PASS: prior API rows unchanged;
  staged compiler, generator, header and region-map closure pins match dispatch.
- `git diff --check`: PASS.

The fixture observes external notification and interpreter-run boundaries.
It simulates callback RET 20; it does not execute an x86 callback body or prove
OS queue/event delivery. The pre-existing service still completes normally
consumed headers by flags alone; this change adds callbacks for stop's returned
buffers. SysEx transport remains the existing immediate-completion behavior.
No full build, 512 MiB VM, guest executable, Boat, or gameplay was run.

Operational evidence is retained under
`/tmp/madbomber-midistreamstop-implementation-oct30/e/`, with canonical handoff
in `completion-receipt.json` and coordinator-owned messageboard delivery.
The supplemental stock check-api-table script passed, but its internal Git
subprocess did not receive the task-specific Git DATA cap. It is not used as
resource-qualified acceptance evidence; the supervised pinned-archive equality
check supplies the append-only result without spawning Git from Node.
