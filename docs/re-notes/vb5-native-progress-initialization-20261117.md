# Native ProgressBar observation during VB5 CCE initialization

Run: `scratch/runs/20261117-vb5-native-progress-initialization/`.

The preceding published original attempt accepted the genuine install question
and license, then refused initialization HWND `0x1000b`, generation 11, because
its child `0x10010` / ID 2106 is native ProgressBar class 17. Its actual
DialogBox invocation identity already passed. This task qualifies that specific
control type; it does not authorize arbitrary unknown controls.

`native_progress_get(HWND, field)` observes the runtime's own native common
control state. Field zero reports availability; fields 1–4 report signed
minimum, maximum, position and step. Zero data values are valid and never serve
as availability. Missing, retired, uninitialized, wrong-class or guest-subclassed
windows cannot qualify. The export sends no messages, allocates no state and
executes no callbacks. USER supplies the accompanying generation, process,
thread, parent, owner, style, geometry, caption and control ID.

The native state fixture checks a byte-for-byte unchanged linear memory image
across repeated reads. Native updates cover SETPOS, DELTAPOS, SETSTEP, STEPIT,
SETRANGE32 and the signed 32-bit endpoint range. The current implementation
normalizes a requested `0..0` range to `0..1`; its actual resulting position is
reported, not replaced with a synthetic zero or percentage. This observation
change does not claim full Windows common-controls compatibility. Native
STEPIT currently wraps above the maximum to the minimum.

The observational projection removes exactly min/max/pos/step from input
comparison after validating them. It retains every other field, including
unknown future progress fields. An input still requires the original retained
complete frame and freshness/nonce checks. A ProgressBar cannot itself become
an input target. Captures retain both before-encoding and after-encoding
observations, so an ordinary progress repaint can change without claiming its
value was fixed throughout image encoding. Captions, control identity,
hierarchy, geometry, style, focus and modal invocation changes remain material.

The real PE fixture adds ProgressBars to both direct and indirect DialogBox
templates. Its actual guest WM_TIMER callbacks alternate the native maximum
between 100 and 164 and advance position through ordinary SendMessage calls.
Each of ten real BUTTON transitions uses a retained frame from before those
updates, checks unchanged input metadata, then proves the existing native
dispatch-return receipt and independent UP. Nested invocation restoration,
real main creation, main-owned and ownerless dialogs remain covered. The
negative suite preserves focus, caption, child-caption, disabled, foreign
process/thread, retirement, generation, callback, real stale-wait, ordinary
window impersonation and modeless refusal. Native unsupported, password and
ProgressBar-target cases additionally prove permanent UNKNOWN and zero later
HTTP requests.

`qualification-final/` holds typed progress qualification;
`regression-final/` separately checks the existing native14, native13,
MessageBox question shapes and native pointer-mapping/queued-delivery suite.
Both compile from exact local Git plus the recorded owned patch, excluding
foreign WIP. The canonical shared-tree flock build is recorded separately,
including its relevant WIP diff. Preliminary probes and their limitations are
explicitly distinguished from final qualification. No preliminary probe
launches original media.

Publication, original installer outcome and actual process waits are recorded
in `result.json`. A successful local native test does not override the task's
requirement to publish before the single authorized original pipeline.

Post-merge fixture correction: the first published-source preflight stopped
before original execution because one shared guest timer counter could alias
when outer and nested dialogs ticked together. Each dialog now has its own
counter. The range-change assertion remains required; no production getter,
review policy, timeout or refusal was relaxed. The failed preflight is retained.

The one authorized original pipeline used exact published
`2f2a7217c0aeaca2b9fae63c666f7840b0fce423` and sealed production module
`33ef36c2de1c86ca1302b5659f02bb48f1794dfc4e20945821251198f04cb03e`.
The complete post-publication preflight, including actual child inheritance,
passed with no owned source patch. Genuine installer and SetupAPI hashes were
checked before launch. The independent 2420-second watchdog was armed before
the native process, with a 2400-second native limit and 240-second Quit reserve.

Personally reviewed ordinary Yes and license acceptance completed in 292 ms
and 250 ms. The actual ownerless initialization dialog `0x1000b`, generation
11, callback `0x1003241`, then captured successfully. Its actual ProgressBar
`0x10010` / ID 2106 reported range `0..100`, step 10 and position 10 while
extracting `Mso97rt.dll`, then position 36 while extracting `Oleaut32.dll`.
No input targeted the progress widget. The changing filename is retained as
meaningful caption metadata, independently of harmless progress repaint.

Automatic initialization reached a new genuine modal: **Error loading
SETUPAPI.DLL**. The personally reviewed actual OK button was acknowledged with
native consumption, independent physical UP and completion in 270 ms. The
parent recorded actual native process exit 0 and closed regular output files;
the guest log reports exit `0x8007042b`. This is a failed installation, not an
installed IDE/sample or IDE Quit result. No original child installer was
launched, no second original was attempted, and no endpoint was rebound.
The exact SetupAPI load failure needs separate diagnosis; the visible error
alone does not establish which loader operation failed.

The pipeline was closed after the actual native wait. Its independent watchdog
recorded self-exit because of that wait. The outer supervisor shell returned
143 before publishing its final watchdog-wait/runtime-release records; those
receipts are unavailable and are not claimed as successful waits. The native
wait and all three finite-intent release waits are present. All recorded task
PIDs are absent and both original control ports are closed. No box was created.
