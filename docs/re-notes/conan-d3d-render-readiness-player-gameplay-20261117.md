# Conan complete D3D9 Worker startup and guarded original, 2026-11-17

The complete initial D3D9 startup/capture route is qualified with a disposable
Win32 PE using public imports and COM methods. Its guest calls Sleep(2500)
before Direct3DCreate9/CreateDevice and again before Clear/Present. The shell
launches the actual CPU Worker, creates its owned window, and opens the real
D3D render Worker/endpoint. No guest exports, forced pump, clock change,
fake owner, fallback owner, or fixed-sleep readiness gate is used.

The passive gate requires the running main slot/process/window/instance/memory/
module binding, a ready live D3D9-GPS endpoint on the same module and memory,
its actual render manager/Worker, an accepted window-bound presenter layer,
and a later ordinary compositor publication containing that window. CDP
independently recovers both executing Workers' module bytes and binds the
actual CPU Worker's slot/endpoint to the page owner. All live target identities
remain in the strict before/after comparison. Destroyed targets are explicitly
retired; secondary CPU slots are distinguished from the unique main slot.

The initial fully qualified control had 97 pending samples across initial startup and a
replacement. Samples explicitly show a real render endpoint with zero presents
before readiness. Public requestCurrentDisplayCapture completes actual native
whole-output readback; the selected whole browser image visibly shows the blue
D3D9 window. Native readback, PNG and unchanged owner identities share a
three-second aggregate bound. Late receipts, a distinct genuine endpoint on
the same render manager, actual closed endpoint/app, and an old receipt after
ordinary page/app replacement all reject before taking another image.

Earlier disposable iterations retained a wrong API-label predicate and stale
DevTools-target bookkeeping failure, both repaired and retested. The initial
late-control test backdated a genuine receipt; a subsequent fresh disposable
fixture also ages an unchanged genuine receipt beyond 120 seconds in real time
and rejects it. This supplemental elapsed-age test follows the original run;
the original used the already-qualified common readiness/capture route.

Correction to the first published review: the retained replacement PNG does
contain the blue D3D9 window. A new individual whole-image review and PNG byte
audit confirm the exact 440-by-300 blue rectangle. The earlier desktop-only
review was incorrect; the raw image is unchanged. No native/PNG discrepancy is
established. The genuine prior owner's receipt is rejected on replacement,
and a fresh capture of the replacement owner succeeds.

The ONE authorized fresh Conan original used the initial qualified driver after
this full initial-route proof. Exact pins are b063d11ee8b53ca6ee4239f9c56b3f7691d4e9c2
with only published da9ac26cc8c56a161b044e3705873420aecadaed host-imports,
module SHA-256 87ef39648a61ed6f54ca4ab8de1926de02c651eb2d99655015dc7e5de5407009,
and matching pinned region map. Existing configuration/media/dependency,
CPU ownership, strict input/release and custody proofs were reused and
rehash-verified. Media were referenced and hashed without copies; current
foreign generated/source WIP was excluded from the served closure.

Conan passed actual render readiness and three strict native/whole-browser
captures: initial black startup, visible TDK logo, and visible NVIDIA splash.
Thus published da9ac's visible Worker presentation is exercised on the original.
The first ordinary Escape completed with trusted input and an independently
waited, acknowledged physical key-up witness. The second Escape attempt failed
the unchanged 500 ms independent prearm bound before any keyDown. The release
child records `independent prearm exceeded 500ms`; the controller records
`independent prearm deadline`, empty input events, and terminal
UNKNOWN_OR_REFUSED_NO_REPLAY. No further runtime query, input, retry or replay
followed. No menu/player/New Game/Warrior/second gameplay response/native Quit
is proved. This is a guarded input-helper deadline refusal, not evidence of a
game defect; no guessed product repair or additional original was attempted.

Every task Chrome/driver/watchdog/supervisor/keeper has actual waits and both
EOFs. Scopes and child lists are empty. Independent observable deadlines were
armed before Chrome, and the actual /home floor remained 1,500,000,000 bytes;
no watchdog fired. Unique custody files were retrieved and hash-verified before
removing only owned tmpfs profiles. No box was created: ID/expiry null,
NOT_CREATED, stop receipt N/A. Foreign WIP and other agents' ownership remain
untouched. There is no new product-code change or production build; the exact
published regression/canonical-build proofs were reused.

Evidence and relevant patches are in
`scratch/runs/20261117-conan-d3d-render-readiness-player-gameplay/result.json`,
written last. Next work must qualify the unchanged independent input prearm
under an actual rendering load before any newly authorized original. This
original remains closed; visible menu and player control are still outstanding.
