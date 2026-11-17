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
