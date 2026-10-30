# Host-owned midiStreamStop reconciliation (2026-10-30)

Base: a5bc63b1f393aa1fd28b82b8408643a7b30e25e9.

The obsolete integration request is closed by regression coverage against the
current host-owned implementation. No production defect was demonstrated and
no production source, API row, generated table or ABI was changed. Historical
implementation 2def2064ac4461974e665ea7c47d10cc2073509c and acceptance
820a1eef5e1cbf0e6fac7b4b205841768ebe6d55 describe the removed module-global
architecture; their extracted harness is not current-main acceptance.

Microsoft's [midiStreamStop contract](https://learn.microsoft.com/en-us/windows/win32/api/mmeapi/nf-mmeapi-midistreamstop)
requires a stream handle, returns MMSYSERR_INVALHANDLE for an invalid handle,
returns pending buffers through the callback mechanism with MHDR_DONE, and
stops notes previously activated by note-on. Existing repository evidence
(test/test-midi-stream-lifecycle.js) further establishes per-device ownership,
idempotent drain, preservation of sibling playback, a fresh timeline after stop,
and stronger reset semantics than stop. Pause/restart/close expectations here
follow that existing implementation contract, rather than inventing Windows
behavior for unsupported transports.

Current API4593 already delegates to host_midi_stream_control(handle, 3, ticks).
lib/host-audio.js uses one stream queue per device. Stop sends note-offs, detaches
the old queue, clears its running/deadline/fraction/pause state, and completes
each submission through its captured callback registration.

## Executable evidence

Run:
```sh
node --max-old-space-size=192 test/test-midi-stream-stop-host-owned.js
node --max-old-space-size=192 test/test-midi-stream-stop-host-owned.js --mutant-no-drain
```

The first command passes three cases against the full production
createAudioHost module (SHA256
00e02890ff3010cb514bbff3e946d9cbc8c00d8cba2d2966a16950e585574bdb).
The second must exit 1 at the pending-header DONE/INQUEUE assertion:
omitting the actual stop-path drain leaves flags 18 instead of 3. It mutates an
in-memory module copy at a uniquely checked site; production files stay intact.

Coverage combines a naturally completed but undelivered notification, a partially
consumed multi-event buffer with a pending deadline, another untouched buffer,
and a sibling stream waiting on the same deadline. It checks exact callback
identity, instance, message, distinct guest header addresses, ordering and counts;
stop/pause/restart/requeue/close cannot repeat completions or replay drained
notes. It also checks a paused stop followed by same-header reuse on a fresh
timeline and invalid, ordinary, retired and replacement stream handles.

The synthesizer and receiving callback export are deterministic fixtures.
This executes host imports and host callback delivery, not WAT/x86 callback
frames, browser audio, system-exclusive transport, guest code or gameplay.
The existing lifecycle test's WAT dispatch/callback coverage was not rerun
successfully: its baseline attempt stopped at missing src/13-exports.wat.
Bounded Git materialization established that supplied object stores lack blobs
124a773076807689cb152e39cf8aa15c0daec713 (src/13-exports.wat) and
cc216154406a964ea10a242d4a3a8332be99323a (src/10-helpers.wat).
No claim is made for that broader group, a complete WAT build, or historical
independent acceptance on this architecture. Coordinator owns subsequent
independent acceptance and integration.

Task evidence, exact publication SHA, resource controls and recovery recipe live
under /tmp/madbomber-host-owned-midistreamstop-reconciliation-oct30/.
No Boat/runtime was allocated; shutdown ownership remains with the coordinator.
