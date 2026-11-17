# NFS3 reviewed native button target, 2026-11-17

The local caller now supplies a reviewed native BUTTON identity to the existing
physical-input/native-receipt route. The original Direct3D warning OK and chooser
OK both returned `native-button-dispatch-return`. The accepted chooser export
contains Direct3D Device 1, `Thrash Driver=d3d`, `Group=D3D`, and hardware
acceleration enabled. The fresh game rendered the rainy Hot Pursuit race and
active cockpit HUD. Controls, transmission, native Pause/Continue, input-caused
acceleration/steering, speed/road consequence, and native Quit remain unproved.

Evidence: `scratch/runs/20261117-nfs3-reviewed-button-target-native-driving/`.
No production source changed. Runtime source remains published
`013d916c64632243ff0aa768debbbc39870f04d5`, module SHA-256
`cf674e8d1780249498a3b9797142d5d9f01e9daedcf2089c8fc880f515c753c0`.
The unchanged source/module, builtin-only policy, class/init/combo69 checks and
canonical locked build are reused from the supported-builtin run. Every launch
compared the sealed source inventory with that module inventory. Foreign WIP was
excluded and retained as binary diffs. All 135 media pins were rechecked without
copying media, modifying configuration, or seeding a chosen renderer.

Run-local `target.py`, `pointer.py`, and `review.py` derive the selected button's
HWND, generation, class, control ID, caption, parent, owner, process/thread and
geometry from the reviewed native-control snapshot. Preflight refuses missing,
changed, disabled, foreign-owner, stale-generation and out-of-bounds targets
before physical input. Final preflight also pins the host native-process
identity and checks modal ownership. The synchronous receipt still comes from
the unchanged runtime; no private SendMessage/WM_COMMAND or guest call is used.

An authored PE calls ordinary CreateWindowExA and
MessageBoxA(MB_OK|MB_ICONWARNING). Its reviewed OK used the real caller, native
BUTTON receipt and independent absolute UP; the modal disappeared. Omission,
wrong owner, stale target, stale review and stale runtime were refused by that
same caller before creating an input intent. The final exact caller was tested
again after restoring inherited timing, and its native child/watchdog both
actually waited zero with both pipe EOFs. Two preliminary authored fixtures
needed caller-shape/lifetime corrections; neither sent physical input. A first
completed positive fixture also passed. These were local fixtures, not extra
original sequences.

The one authorized original ran fresh catalogue (120 exported entries), fresh
first setup (123), chooser importing only that successful setup output, then
game importing only the newly accepted chooser output. All host processes for
those three registration phases waited zero; chooser guest exit code was 1.
Its warning button was HWND 0x1000f, class 1, generation 16, parent 0x1000d,
process 1000/thread 1. The original warning and subsequent chooser acceptance
each consumed physical DOWN and independently released. The old failed chooser
and its permanently closed UNKNOWN endpoint were never reused.

The game naturally selected Hot Pursuit with weather and the Corvette. The
first Escape was consumed during the intro camera. A second Escape, reviewed
against the active HUD, also returned `native-input-return`; later whole images
still showed the running race. Neither is called native Pause. A displayed
1 MPH before acceleration input is natural observed motion, not a driving
consequence attributed to this worker.

A later finite Pause attempt introduced a local caller mistake: its confirmation
deadline was tightened to 500 ms, instead of retaining the inherited release-bound
deadline. The handler applied only 12 ms before that deadline; no native message
returned before expiry. The receipt is CANCELLED/unconsumed, treated as terminal
UNKNOWN by the controller. Independent release observed Up and Escape zero and
an empty queue. No later game endpoint request, replay, rebind or original retry
followed. The attempted helper delta is retained; final `edge.py` restores the
inherited timing and the final authored warning check passes. This timing mistake
must not be attributed to an unsupported renderer or an emulation fault.

Own SIGTERM was requested promptly after the independent release. The outer
launch tool returned 143, but the game supervisor did not leave its native-child
or watchdog wait/EOF files. Their separate raw waits and pipe EOFs therefore
remain UNKNOWN. All known game/supervisor/watchdog PIDs are absent; this does not
fill that lifecycle evidence gap. The final local fixture has complete actual
wait/EOF records. The advisory board tail is also absent without a recovered
separate raw wait. Port refusal and final absence are recorded independently.
No native Quit is claimed.

No box was created: ID null, state NOT_CREATED, expiry null, stop receipt N/A.
No workers, source archive, repeated media, deployment, pump/clock edits or save
edits were made. Git SHA, relevant binary diffs, run-helper patches, selected
whole PNGs and hashes preserve the result. Next work requires a newly authorized
original sequence; first establish a finite Pause action with inherited timing
and actual guest effect. This original remains closed.
