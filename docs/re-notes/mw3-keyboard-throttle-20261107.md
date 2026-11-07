# MW3 ordinary Digit5 qualification and staging boundary — 2026-11-07

The retained driver now accepts ordinary top-row `5` as `Digit5`, virtual key
53. A read-only observer demonstrated actual successful **KEYBOARD** state
returns, including pressed and released Digit5, in the generated production
guest/render Worker fixture. **Original cockpit movement remains UNKNOWN.**
The single authorized fresh box stopped at a source-pin mismatch during
provisioning, before the original browser or any original input started.

Evidence is retained in `scratch/runs/20261107-mw3-keyboard-throttle/`.
Only this note is committed; the task-specific driver, observer, recovery
scripts, patches, module and evidence remain in the ignored run directory.
There is no production change or emulator repair and no locked build applies.

## Documented ordinary controls

The installed local MW3 media has no README. Recovery located the pre-release
demo at [Internet Archive](https://archive.org/details/Mechwarrior3Demo).
The 36,738,513-byte `MW3Demo.exe` has SHA-256
`97feaf6f835a69a73d2182ee58294579b0dcc815cc50e018c1b0e6bf5ddc9828`.
Its selected `Program Files/readme.doc`, 647,168 bytes, identifies itself as
**MechWarrior 3 Demo, 18 March 1999**. `catdoc` extraction documents top-row
`5` for 50% throttle, Left Arrow for turning left, and Spacebar for firing.
`demo-binding-proof.json` retains document/text hashes and exact bindings.
The installer and intermediate cabinet were temporary and removed. Only the
selected documentation and small range probes remain, without game archives.
The installer lists a 1,844,224-byte `mech3demo.exe`, matching the installed
file's length; executable byte equality with that installer was not tested.

An earlier small range recovery from Sarna's download labeled “demo” yielded
a README identifying itself as a Version 1.2 updater. It was explicitly
rejected as demo-binding evidence and retained as `sarna-README-not-demo.TXT`
with `readme-recovery.json`. The predecessor's binding assertion and a general
controls guide were not substituted for the demo documentation.

## Exact local driver and keyboard observer closure

The predecessor's mouse-specific buffer probe was replaced in this run only.
At the verified GetDeviceState completion, the observer reads the returned
request from the guest stack: return address at ESP−16, device at ESP−12,
size at ESP−8 and output buffer at ESP−4. It reads the wrapper's slot and the
compiler-generated DX_OBJECTS placement, then distinguishes type 7 / device
kind 1 (keyboard) from mouse kind 2. It captures the requested 256-byte buffer
and format size rather than reading the predecessor's fixed mouse address.
Its breakpoint condition returns false and writes diagnostic JavaScript
buffers only. The module/body/location proof remains exact: module
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`,
470-byte handler body, completion **887941**. Breakpoints and diagnostic
globals were removed after observation.

The generated page issues x86 public-COM calls through published vtables to
create, format, acquire and poll a keyboard using the production module and
GuestWorker, with the production render Worker attached. Trusted Chromium
Digit5 events feed the generated fixture's host key bitmap through the
production RPC publisher. Its zero-capacity buffered-keyboard adapter returns
zero; this fixture tests immediate state, not buffered keyboard transitions.
It does not establish MW3's own input path or gameplay semantics. Its first
setup failed on an absent generated window-info host response; that failed
browser was closed normally and retained in `local-setup-failure/`. The final
fixture uses the supported default background cooperative level.

The exact task driver and observer then recorded **652** HRESULT-zero keyboard
returns, no drops or diagnostic errors. The device was **149037112**, buffer
**16968580**, caller **16968896**, format/request size 256. DIK slot 6 changed
from zero to `0x80` during the 1,500 ms pulse and returned to zero after UP.
`keyboard-consumption-summary.json` retains the exact correlation. UP was
independently armed before DOWN; both actual native events were trusted.
Exact transport ACKs 0–3 covered arm, pulse, disarm and quit.

Focused controls rejected wrong Worker instance/endpoint, modified module
bytes and wrong completion location before breakpoint installation. Keyboard
validation rejected wrong object/device kind, request size, format size,
HRESULT, device pointer, buffer and caller, and refused mouse-only evidence.
All 18 ownership/module/epoch fields rejected replacement; the retained
production freshness gate rejected a 120,001 ms expired capture with zero
input effects. A stalled DOWN ACK independently attempted UP and produced
sticky UNKNOWN. Closed-child transport refused further commands. The
published native-motion focused regression passed. No accepted input matrix
was repeated; native-motion and capture guards were unchanged.

The proved blank acquisition anchor **(350,430)** and full route envelope were
retained and passed a conservative simulation with the unchanged native helper.
That simulation is physical headroom evidence, not original navigation.

## First original boundary: qualified source changed before upload

One persisted UUID Idempotency-Key request allocated **bx_sdf6q4ce**, original
expiry **17:03:27.951Z**. The qualified runtime pinned `lib/host-audio.js` at
210,449 bytes, SHA-256
`70795825d7d11ecb026e22c2875ef4eaf4fba60758e5da4fcc99ab624c4f4513`.
Before upload, that shared file changed to 210,748 bytes, SHA-256
`bb89e4e95190b7db98390e5d67f1c99fdcdf7e7e77f0388aa0126cd256869365`.
Its other owner had announced an active MIDI repair. The retained stager's
SHA/length assertion refused it. No source file belonging to that owner was
edited, no pin was relaxed, and the original was not booted.

`first-blocker.json` proves the qualified file is exactly recoverable from
Git **10bf01e429f7c0347de3dae4ad11002bf248dc7c**. The changed hunks are preserved
in `blocker-host-audio.patch`. Remote inventory confirmed **307** matching
runtime pins, the sole missing pin `lib/host-audio.js`, no mismatched uploaded
pins, no original directory, no runtime process, and no task-owned Node/Chrome
process. After the provisioning failure, the shell staged the small boot
script; it did not execute it. No cockpit, throttle, turn or fire attempt
occurred. This is a staging prerequisite, not an MW3 or audio defect claim.

An initial read-only custody assertion mistakenly matched its own Python
command text as a Node process. Its exact failed result is retained. A new
read-only query classified executable argv[0], excluded itself and established
the custody facts above; it issued no guest or input command.

## Recovery and lifecycle

Git is the source archive: source SHA, relevant binary patches, new-helper
patches, actual loaded local module and existing media path/length/SHA records
are retained. This does not claim a rebuild at the source SHA. Unique remote
custody evidence was retrieved and SHA/length verified before normal stop;
uploaded source and media were not copied back into an archive.

Two explicitly delegated OS subprocesses were armed before allocation: a
normal-stop delegate and an independent lifecycle watchdog. The watchdog's
immutable 1,500-second deadline was **16:28:28.099Z**, derived from the persisted
allocation receipt **16:03:28.099963Z**. The API later reports creation at
16:03:27.930Z; the cap is receipt-relative, not a claim of exact creation-time
alignment. Both processes recorded half-second heartbeats. The watchdog was
verified alive immediately before stop and after confirmed normal stop, then
exited normally. No lifecycle-process failure was observed.

Delegated stop **stop_62f9bd189a298057** completed at **16:05:13.221Z**,
`forced:false`; the box is **archived**, current `archiveAfter:null`, retained
data expiry unknown. No lifecycle ownership remains. Local driver and Chrome
exited normally with ports **43851/35701** closed, profile/writer lock absent
and Digit5 released. The failed setup browser also exited normally. Temporary
recovery files, lifecycle processes and messageboard watcher were closed.
Sampled free space stayed above 2 GB; a continuous disk minimum is not claimed.

The next separately scoped attempt can recover the exact qualified source
from the recorded Git SHA or requalify a stable composed runtime after the
audio owner's release, then obtain separate authorization for a fresh
original. No second allocation or original retry is part of this task.
