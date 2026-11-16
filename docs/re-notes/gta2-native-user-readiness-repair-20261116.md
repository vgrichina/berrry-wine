# GTA2 native USER readiness contract

Status: actual authored main/Worker reproduction and repair under final
qualification. Ordered GL and Sims final releases, personally checked surviving
evidence, current process closure and free locks admitted this worker at 07:08
UTC. Foreign host/GL/D3D/Sims work remains unadopted.

Evidence destination: `scratch/runs/20261116-gta2-native-user-readiness-repair/`.
Predecessor implementation: `6d8b95c2cb4403b71d8e6ed2a21222d97fd3d12c`;
report: `a0f642dd34b39095585a49ef4bb87fcdef828f2d`.

The retained original attempt fails in workerBridge's initial snapshot during
install with `unhealthy native USER context`, before capture and input. It does
not retain the actual public process/thread/window snapshot or failed predicate
list. Its exact unhealthy predicate and original cause remain **UNKNOWN**.
The endpoint remains permanently closed; no requests are sent to it.

Retained console evidence includes Worker instantiation, native mss32/comctl32
DLL loading and both DllMain returns. The stdout file is empty. Console also
records an api_table.json response parse failure and a missing tweetnacl error.
These observations establish neither a native USER failure cause nor readiness.

Static install audit: the controller's startup test observes running, Worker and
first slice, then installs the native bridge. Those host predicates do not check
native USER health. workerBridge installs its onmessage handler and immutable
global before invoking its initial healthy snapshot. A failed installation can
therefore have mutated the endpoint already; no repeated installation is safe.

Authored controls keep every existing health predicate, report individual
failures and preserve real public values including eip, quit and yieldReason.
Their separate unpublished observer models bounded, positively UNSENT startup:
delayed USER can remain unready; native exit, faults, retirement, identity change
or deadline terminate without publication. A timeout never means readiness.
This model is not proof of actual main/Worker scheduling or native behavior.
Native authored before/after tests, all guards, full builds and publication are
still required before considering the single conditional new original attempt.

The fixed 500 ms COMPLETE, 1750 ms independent UP and 3000 ms aggregate gesture
limits remain requirements. No original capture, input, walking, car entry,
driving, native Quit or WebGL success is claimed. No box or worker is created.

The new native harness is gated before runtime imports and PE generation. Its
startup observations request real public exports on the actual owning CPU
instance, recording the first host-ready state and native predicate details.
It uses an observable prearmed independent watchdog and the supervisor's actual
heavy flock. Its six fixture variants are authored but not generated or run:
delayed USER, missing USER, early native ExitProcess, fault, capture and modal.
The gate-refusal control and six standalone authored tests pass. These are host
authored controls, not native qualification.

Further retained HTTP evidence has status 500 for `/src/api_table.json?v=dev`,
`/lib/vendor/tweetnacl.js?v=dev` and `/lib/vendor/webaudio-tinysynth.js?v=dev`,
all twelve-byte responses with SHA-256
`8c7f644a14467e06ee798a89532dbff95329ac8e639e2b3b250f7d3fbaf8911e`.
The predecessor's runtime source-view selector excludes src/api_table.json and
nested lib/vendor paths, while its tracked-source guard refuses omitted tracked
source. The new authored selector includes these actual startup dependencies.
An independent sixth authored control covers them and traversal refusal.
This is a source-serving defect consistent with the retained HTTP/console
errors, not proof of the exact old native USER failure cause. No closed
endpoint is queried to investigate it.

Execution diagnostics must remain separate from the binding's scene identity.
In particular EIP changes during ordinary execution; adding it to the snapshot
compared by validate() would wrongly invalidate a stable native scene. The
existing stable native binding fields and every existing health predicate must
remain intact. A current readiness sample may report EIP/quit/yieldReason to
explain refusal, without using those moving values as a reviewed scene token.

At 06:58 UTC, the new gated scratch source-view recipe, the predecessor recipe,
and earlier control stdout/stderr files were found absent after successful reads
or writes. The cause is UNKNOWN; this worker did not remove them. Wait JSONs,
patches, the authored test log and this document remain. The separate
`unexpected-file-loss.json` records current presence checks. Earlier artifact
verification is a dated observation, not proof that those artifacts remain
present. Native readiness execution remains unrun pending the ordered release
and resolution of run evidence preservation.


## Actual contract repair

The actual authored delayed-USER executable sleeps before RegisterClass,
CreateWindow and SetFocus. At the first host-ready observation both CPU modes
have public native PID 1000, TID 1 and nonzero EIP, quit 0 and yieldReason 0,
but main HWND/generation 0 and focus 0. The exact false predicates are mainLive,
mainVisible and focusLive. The old Worker install throws before capture/input;
the old main install incorrectly returns INSTALLED with that same unhealthy
snapshot. This reproduces a generic startup contract defect. It does not prove
that the old original failed for the same reason.

The repair separates a read-only, positively UNSENT stage from endpoint
publication. A CDP RemoteObject retains exact current process, renderer, module,
CPU Worker/slot/endpoint and original handlers. Each sample reads actual public
native exports on the owning CPU, with real current PID/TID, window generation,
thread, visibility, focus, capture, modal, EIP, quit and yieldReason. It pins
observed owners and rejects retirement, replacement, wrong thread, native quit,
exit, faults and physical held input. No observer global or bridge handler is
published. An actual healthy sample can advance to an atomic same-turn preflight
and publication. Health never overrides a terminal generation-change sample.

The entire install stage has one fixed 3000 ms bound. Expiry is a refusal, not
readiness. A failure seals the transport; pre-publication failures are UNSENT,
and a failure after a publication request is UNKNOWN with no later requests.
There is no retry or deadline extension. Both main and Worker bridge factories
now complete their initial healthy snapshot before mutating handlers or globals.
The public native ABI and the stable scene identity remain unchanged. Moving
EIP/quit/yield diagnostics stay outside the scene identity. All existing native
health predicates remain mandatory.

The source view now serves and pins actual src/api_table.json and nested lib
JS/JSON dependencies. This fixes the separately proved source-serving omission.
Build and runtime evidence names exact Git SHA and a deduplicated owned binary
patch. Live shared-tree checks also record the relevant foreign patch as
unadopted; HEAD qualification excludes it. No source tree or WASM dump is saved.

Intermediate actual main/Worker cases cover delayed USER, real MessageBox modal
focus, real SetCapture, missing USER, actual ExitProcess, UD2 fault, window
retirement/replacement, forced owner stop and a real TID 2 window with current
owning TID 1. Only delayed healthy USER and valid modal install. Every startup
case has zero capture and zero input; all negatives remain UNSENT. Forced host
stop is explicitly distinct from native Quit. The final runs supersede these
intermediate qualification states.

A candidate actual Worker input fixture also completed both modal dismissals,
one ordinary ArrowUp and native ExitProcess through Escape. COMPLETE took
366/338/331/373 ms and independent UP 300/208/233/256 ms, within unchanged
500/1750 ms bounds. This is authored fixture evidence, not original gameplay.
The published full fault matrix and main/Worker fresh normal runs are required
before the single conditional fresh original attempt.


Final HEAD-plus-owned qualification: full flock build passed and all fourteen
focused checks passed, including the sealed immutable source-view guards. The
live shared checkout focused suite passed thirteen checks; the immutable-view
check requires and passed its separate sealed HEAD run. Twenty actual final
startup cases passed: four valid installs and sixteen UNSENT refusals. Every
case has zero capture/input. Every negative has zero commit requests and its
actual protocol wire sequence remains unchanged after seal. A real replacement
window (HWND 65538, generation 2, TID 1) is healthy but terminal because the
observed owner generation changed; it correctly remains unpublished. Final
case source-state references tie each run to the exact owned source patch.
