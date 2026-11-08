# Warcraft III producer readiness and current Prologue — 8 November 2026

The run-local initial readiness correction passed production Worker controls
and the original SoftwareGL startup. The driver waited through GL endpoint
1 → software transport 2 before binding, then retained exact owner checks.
The original native menu route reached Chapter One, **Chasing Visions**, its
visible continue prompt, and the rendered Prologue introduction. A subsequent
passive capture became UNKNOWN at the unchanged command deadline. Input
closed and WebGL was not launched. Thrall selection, controlled displacement,
tutorial/objective interaction and combat consequence remain unproved.

Evidence: `scratch/runs/20261108-warcraft3-producer-ready-gameplay/`.
This is a run-local driver correction, with no emulator, renderer, media,
configuration, mission, clock or scheduler change. Only this note is committed.
No build was required; no emulator mismatch or repair is claimed.

## Readiness correction and actual-path qualification

The predecessor [current-browser attempt](warcraft3-current-browser-objective-20261108.md)
bound endpoint 1 on a black frame with presentation writeSeq zero. Its next
passive command found software transport 2 and correctly failed exact ownership.
That failed run remains intact; its startup is not promoted to gameplay proof.

The released [Q3 GL producer helper](q3-gl-readiness-gameplay-20261108.md)
from commit `c142f0785` was reused only after release. The three copied files
match its recorded runtime pins byte for byte:

| Helper | SHA-256 |
| --- | --- |
| `bound-input.cjs` | `175033bc07bda95dd2d618511729d901908d60a9e8ec970cdbc8d7e2d61dcd70` |
| `producer-ready.cjs` | `e400a370c681974dd3b9cce294ac8853e9779d8922e15f8063b23e5ed84dc5e8` |
| `worker-observe.js` | `7bc964f15ff25c2e373a77d8a8c9b9763cb702d4ebe4778fde0f05df87751cd3` |

`released-helper-verification.json` retains this comparison. The selector
requires completed GL work and presentation for the actual owning guest,
adapter, bridge, current context and HWND, with positive layer writeSeq.
Software additionally requires owning CPU triangles, completed software-front
work and an attached, ready, completed, error-free software legacy transport.
WebGL uses completed native draws/vertices and a real owning WebGL context.
Two complete observations must retain identity and advance work/presentation.
CPU and render Worker module bytes are independently recovered and checked.
Initial pending observations do not establish an owner; a bound chain cannot
return to startup sampling or rebind.

`local-software-qualified/` and `local-webgl-qualified/` exercise production
guest/render Workers with public x86 GL calls and a personally reviewed red
triangle. Both use the original driver's establishReady/capture/review/admit,
numbered request/consume/ACK, native input and final capture paths. Ordinary
Enter, right-button input and name typing passed with three exact ACKs per arm.
Trusted events were balanced. Delayed-DOWN independent-release tests also pass.

The software fixture starts with actual endpoint 1, no draw and no legacy
transport. Readiness stays pending with zero dispatched input. Its first real
draw creates transport 2; advancing presentation then admits binding. A new
real endpoint 3 introduced after binding is rejected as
`identity changed: renderEndpoint; 3 !== 2`, closes the chain and dispatches
zero input. Missing context/producer, zero draw, wrong guest owner, nonowner
GL counters, renderer replacement, stale review, module mismatch and controlled
CDP UNKNOWN controls also dispatch zero input. Stale review retains only the
existing pre-effect refresh exception. `local-validation.json` checks both
arms, module proofs, event balance, exited Chrome processes, closed ports and
removed profiles. All controls passed before allocation. One earlier fixture
iteration expected a later identity error but received an earlier producer
rejection; that failed test expectation is retained, not counted as a pass.

Independent releases, exact immutable owner/module checks, 120-second review
age, 20-second command work, two-second ACK allowance, 50-second request ACK
window, cleanup reserve and sticky UNKNOWN behavior remain unchanged.

## Original SoftwareGL execution

Staged Git reference: `6b486344a3efeef1e6ec98ed9b4995810ea71f96`.
`source-sha.txt`, `runtime-pins.json`, `relevant-source.patch`, the new boot-file
patch and `owned-helper-patches.patch` preserve the exact source references and
relevant uncommitted/new hunks. Git remains the source archive. No source-tree
or media archive was created.

The twelve existing registered files under
`test/binaries/candidates/warcraft3-demo/` were reused. All four historical
extracted-file hashes recorded in [the Warcraft notes](warcraft3-demo.md)
match: EXE, Game.dll, Storm.dll and MPQ. The other eight files have explicit
current size/SHA pins; their independent historical hashes remain unavailable.
No twelve-file historical-equivalence claim, download or reinstall follows.
`media-preflight.json` retains registered paths and installer provenance;
media was referenced locally and transferred only to the necessary remote
runtime paths, with verified temporary chunks removed after assembly.

Chrome **151.0.7922.71**, native viewport **780×437**, production registered
`warcraft3_demo`, ordinary `-opengl -window` arguments and both URL selectors
`gl-renderer=software` / `d3d-renderer=software`. Actual owning context is
software `FixedFunctionGL`; no WebGL context was observed in this original arm.
Both executing CPU/render Worker modules independently hash to
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

`startup-observations.jsonl` records no render endpoint, then endpoint 1, then
transport 2. Readiness succeeds after 12 observations, binding transport 2
with GL endpoint 1. The two complete producer samples retain owner/context
identity, advance software completions 3,800 → 10,019, presentations 4 → 7
and writeSeq 2 → 5. Bound CPU triangles are 17,924 with zero fallbacks.
The startup image is the native main menu, rather than the predecessor's black
prepresentation frame. Twenty commands subsequently receive exact successful
ACKs without an endpoint identity failure.

Personally reviewed native route: Single Player → name → Create → Select →
Campaign → Prologue's blue chapter button → loading → **PRESS ANY KEY TO
CONTINUE** → one ordinary two-second Space press. The first name update was
not visible immediately; a later capture showed it after an intervening focus
click. A second ABC entry produced the actual created profile **ABCABC**.
The Prologue label click did not activate the chapter; the separately reviewed
blue button did. These details are retained rather than treating command
labels as proof of the resulting screen.

`loading-progress.png` shows the advancing loading bar; `loading-finish.png`
shows the explicit continue prompt. `intro-view.png` and `intro-progress.png`
show the original rendered outdoor scene, mounted Thrall, hut, rocks, path
and changing cinematic camera. They are introduction captures, not proof of
player selection or movement. No Escape or gameplay movement/combat input
was sent. The last observed input history has seven trusted DOWN/UP key pairs
and seven trusted mouse pairs, with no held keys/buttons.

## First UNKNOWN and shutdown

Final command `s-tutorial-wait` is a passive ten-second wait/capture. At
**03:54:57.830 UTC**, capture entered its page-state `Runtime.evaluate`
(request 1599). It remained pending for 20 seconds. The command-work deadline
fired at **03:55:17.768**, followed by that CDP deadline at **03:55:17.834**.
There is no final state, screenshot or ACK for this command. The trace locates
the blocked observation before the binding/screenshot stage; it does not
diagnose the cause of page latency or demonstrate an emulator defect.

The first UNKNOWN closed the driver and transport. No ID was replayed, no
further input was dispatched and the entire original WebGL arm was skipped.
Chrome exited zero at **03:55:18.835**. `terminal-checks.json` confirms absent
controller/Chrome PIDs, closed HTTP/CDP ports, removed profile/writer lock,
20 exact ACKs plus the final unacknowledged passive command, and all 627 remote
pins unchanged. Validation checks 399 completed HTTP response hashes including
ranges, all current local pins, 29 PNG CRC/IDAT decodes across original and
qualified local arms, and the independent CPU/render module proofs. Only the
three known optional build-info/favicon/font requests returned 404.

One UUID-idempotent fresh no-environment box **bx_gdkzgenr** was allocated at
03:47:50.895 with initial expiry **04:12:50.728 UTC**. Lifecycle deviation:
the initial shell nohup launch did not leave an observable supervisor armed.
This was detected and a detached supervisor/watchdog was observably armed at
**03:48:06.865**, after allocation but before browser launch at **03:48:22.857**.
It retained the original immutable 25-minute allocation deadline, not a new
deadline. Thus preallocation watchdog arming was not achieved; pre-runtime
watchdog coverage and independent normal stop were achieved.

All **231 remote evidence references / 209 unique hashes** were recovered and
independently reread for size/SHA at **03:56:17.272**, before normal-stop request.
The box was normally stopped at **03:56:17.831**, state **archived**, current
expiry **null**. Stop receipt **stop_4e1080a0e320f183** completed at
**03:56:17.850**, `forced: false`. Both lifecycle children exited zero and the
supervisor has no remaining children. Disk stayed above 5,000,000,000 free
bytes. No RAM gate, old-box resume/delete, public deployment or nested worker.

Next work is to locally bound or explain the passive page-state capture
latency while retaining budgets and first-UNKNOWN closure, before another
authorized original run for Thrall selection/displacement and native tutorial
consequence. Original WebGL, full27, parity, FPS, audio and campaign completion
remain open. `RECOVERY.md` identifies the retained scripts, patches and evidence.
