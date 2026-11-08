# Tachyon current browser cockpit and actions, 2026-11-08

One fresh box ran the original registered `tachyon_demo` serially through
**WebGL, then software Direct3D**. Both reached the Pegasus cockpit through
Single Player → first pilot slot → single uppercase `A` → Enter → Play →
base door `01` → Ship Bay → Launch. Personally reviewed captures show textured
space, readable cockpit/HUD, zero/full throttle, a changed heading after Right
arrow, and distinct blue light-laser bolts after Space. This is current browser
evidence; the accepted Nov 1 native CLI flight remains a separate observation.

Evidence: `scratch/runs/20261108-tachyon-current-browser-backends/`.
`capture-review.json` records the reviewed images and limits; raw numbered
commands, exact ACKs, admission identities, hold/release receipts, states,
served-file hashes, actual modules and lifecycle records are retained there.

## Originals and actual backend identity

All **15 original/manifest files, 92,143,006 bytes**, matched the accepted Nov 1
SHA-256 pins recovered from its retained worker event. The complete closure
was reused without changes. The existing registry `iniSet` remains
`USE_HARDWARE=1`, `HW_TYPE=0`, `RES=0`; shipped `Tachyon.cfg` remains
`USE_HARDWARE=0`, `HW_TYPE=0`, `RES=1`. No guest configuration, ship, mission,
clock, state or private handler was edited. No new EULA was accepted; the
existing recorded local-use authority was retained.

Chrome **151.0.7922.108**, V8 **15.1.206.16**, ran an isolated threaded browser
page with the original 640×480 guest canvas. This was a local loopback server
on the private box, with no public deployment. Backend evidence comes from the
owning guest/render Workers, actual legacy endpoint, context observations and
recovered live Wasm bytes, rather than the toolbar or a GPU flag alone:

| Backend | Observed owning route |
|---|---|
| WebGL | Legacy endpoint 1, actual WebGL 2 context on Intel UHD Graphics 620 / Mesa through ANGLE, adapter present, CPU GPU-enable true, renderer errors zero. |
| Software Direct3D | Legacy endpoint 1, software backend, no WebGL context or adapter, CPU GPU-enable false, positive owner-side `d3dimSoftwareDrawCallsCompleted`, renderer errors zero. |

Actual CPU and renderer modules in both sessions share SHA-256
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
The staged source baseline was main
`60b87651e9bbc002ee31e5e6994f8cf1c03ff8dc`, plus the recorded binary diff and
the patch for the already-present untracked `lib/wininit-boot.js`. The staged
`host.js` included the other worker's COM-boot repair, subsequently published
as `37ce9588e`; this task made no emulator repair. All 628 staged inputs still
matched locally after runtime at main `95c92a405f95d18324c291d93e16559be1c80436`.
Git commits and patches provide source recovery; no source/media archive was
created. Existing media paths and hashes are in `fixture-identity.json`.

## Reviewed consequences

Names below are PNG stems. WebGL images are under `review/`; software images
are under `software/` and have the `s-` prefix. The remote originals are also
retained under `retrieved/`.

| Control | WebGL | Software Direct3D |
|---|---|---|
| `0`, 100 ms, then neutral wait | `cockpit-center` → `zero-throttle` → `zero-settled`: thrust 100 → 0, speed 410 → 220 → 0. | `s-cockpit-center` → `s-zero-throttle` → `s-zero-settled`: the same visible HUD progression. |
| Backspace, 100 ms | `zero-settled` → `full-throttle`: thrust 0 → 100 and speed 0 → 119. | `s-turn-settled` → `s-full-throttle`: thrust 0 → 100 and speed rises above 100. |
| Right arrow, 1,500 ms | `full-throttle` → `turn-right-held` → `turn-right`: changed starfield, red nebula and radar orientation. | `s-zero-settled` → `s-turn-right-held` → `s-turn-right`: heading changes while thrust and speed stay 0. `s-turn-settled` retains the red-nebula heading after release. |
| Space, 2,000 ms | `turn-right` → `fire-space-held` → `fire-space`: distinct blue laser bolts in the released result. | `s-gate-settle` → `s-fire-cockpit-held` → `s-fire-cockpit`: distinct blue bolts; absent in the following neutral `s-fire-settled` cockpit view. |

The first software Space interval (`s-fire-space`) overlapped a gate cinematic
and did not visibly establish firing. The later, separately reviewed cockpit
interval above did. Neither ammunition nor energy changes are treated as hits.

Both sessions displayed the training instructions and then “Destination:
Venus - Training Sector / Jumps: 2 / Head to Luna”. Those timed text changes
are observations, not proof that a particular control completed an objective.
WebGL `fire-settled` is a gate animation, not a settled cockpit comparison.
Software returned from a similar animation with **Jumps: 2 / Head to Luna
unchanged**. No completed jump, Luna arrival or mission completion is claimed.
Intro captures also retain transient white/purple imagery in the cinematic
bands; no rendering-parity or causal emulator-defect claim is made from them.

## Input qualification and closeout

Before allocation, the reused actual Python request path and numbered
consumer passed waits of 0/1/2/10 seconds, exact IDs, the flight keys, uppercase
`A`, left-button hold/release, and rejection before publication of oversized
waits or commands that cannot fit the immutable deadline. A real local Chrome
preflight verified trusted `A` keydown/keypress/keyup and the exact arrow,
Space, Backspace, `0`, comma, period, Enter and Escape events. The production
guest/render Worker fixture passed stable readiness before first binding and
rejection of replaced process/endpoint/render owners and stale reviewed tokens.
A deliberately slow observer and injected delivery failure verified independent
key release. Comma/period were qualified at the input boundary, but no original
roll consequence is claimed. Host hold duration is not guest polling or FPS.

The original sessions returned **18 WebGL and 21 software exact successful
ACKs**, with no input UNKNOWN, replay or relaunch. One software request reused
a WebGL ID and was locally rejected before publication; it sent no remote
command. The first post-quit cleanup audit observed the software controller
still draining; a separate process observation then found both controllers
and browsers absent, and the post-drain audit passed. Both browser exits were
0, profiles/writer locks absent, and HTTP/CDP ports closed. All 628 remote
inputs remained unchanged; all **388 successful HTTP reads** matched pinned
whole-file or range bytes. The focused fallback-counter check and owned JS
syntax checks passed. No build or production-code change was needed here.
One software pilot-slot click shared a tool batch with retrieval of its
preceding screenshot, which was personally reviewed afterward; this is a
review-order limitation for that menu click. The dependent flight/action
captures were reviewed before subsequent control requests.

The fresh UUID allocation was `bx_9d3jkwkr`, originally expiring at
`2026-11-08T02:25:09.698Z`, with an independent 25-minute deadline at
`02:15:09.529Z`. The initial shell-only watchdog launch was absent at the
preallocation PID check, which correctly refused allocation. A replacement
detached session was observed alive before the sole allocation. After all
**453 artifact references / 405 unique hashes** were retrieved and independently
reread, its normal-stop delegate stopped the box at
`2026-11-08T02:02:55.480Z`. Receipt `stop_e1a5fcea0556fb30` completed at
`02:02:55.498Z`, `forced:false`; final state is **archived**, expiry `null`.
The supervisor and both deadline/normal delegates exited with no remaining
children. Local sampled free space stayed above 7 GB and remote samples above
57 GB, exceeding the 5 GB floor. No RAM gate, resume, deletion, additional box,
archive construction or public deployment was used.
The final run checks validated all 89 retained PNG copies and indexed 44
personally reviewed captures. Its own result schema and 21 artifact references
passed containment/existence checks; the repository-wide checker still reports
seven unrelated containment errors and historical missing evidence.

Full 27-game membership, backend parity, FPS, audio and broader playability
remain unclaimed. The next gameplay checkpoint would be an independently
observed Luna arrival or changed jump/objective state under ordinary controls.
