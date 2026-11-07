# Motocross Madness current browser attempt — 2026-11-07

The first blocker is **selector qualification before Launch**. No original
Motocross Madness, generated browser guest, Worker or owning WebGL renderer
launched. This run adds no current race, throttle, steering, backend parity,
FPS, audio, stunt or full-corpus evidence. Historical race observations remain
separate.

Evidence: `scratch/runs/20261107-mcm-current-browser-race/`.

The run-specific harness now explicitly awaits the loaded app registry, a
matching Program option, enabled Launch control and completed document load.
It asserts the selected value immediately after selection and again before
Launch. Local mock controls pass delayed registry/options, timeout with no
selection, and refusal of a wrong selected value. Atomic numbered ACK,
balanced production renderer/DirectInput keys and invalid-duration zero-effect
controls also pass. These are scratch harness changes; no production repair.

At 02:09:50.318 UTC, the fresh boat's prerequisite `dx_boids` WebGL qualifier
timed out waiting for registry/selector/Launch readiness. The assertion stops
before selecting an app or clicking Launch. A read-only diagnostic captured
the completed page with a loaded registry, Notepad displayed in Program, an
empty teal desktop, WebGL selected and no guest target. Personally reviewed
`retrieved/webgl-qualify/readonly-diagnostic.png` shows exactly that state.
There was no original input, UNKNOWN input, partial input or replay.

The precise catalog issue is reproducible without an emulator: the **actual
`initAppSelector` function from pinned `index.html`**, run with current
`DESKTOP_APPS`, `DEBUG_ONLY_APPS` and `LOCAL_CANDIDATE_APPS`, removes both
`dx_boids` and `mcm`. Both exist in `APPS`, but neither occurs in those selector
lists. `selector-policy-reproduction.json` records this control. Waiting cannot
create either option under that policy. This explains this run's failed
prerequisite; the earlier GTA2 qualifier's exact launch outcome remains its own
evidence. No rasterizer or guest emulator defect is demonstrated.

The preallocation mock covered timing and selected-value assertions but omitted
the production catalog policy. Local qualification was therefore incomplete,
and that omission allowed an unnecessary boat allocation. The failed fresh
qualifier was not repaired or retried. A future authorized attempt needs a
locally qualified supported selection route for both the generated control and
registered original, before allocating; then actual generated guest/owner and
native COMCTL controls must pass sequentially before one original.

Staging source was main `36f34fa9e38b452b57e2c4824ec3e425a3b8c669`.
`runtime-pins.json`, relevant tracked dirty patches, the untracked
`lib/wininit-boot.js` patch and owned scratch-input patches identify the run.
All 936 staged pins matched remotely before controls and at terminal cleanup.
No source-tree or media archive was created, and no local emulator runtime or
build ran. The generated guest-x86 production Surface4/7 COM/vtable tail
control passed remotely, followed by balanced-key and duration controls.
Chrome 151.0.7922.108 also delivered five trusted balanced arrow/Enter pairs on
about:blank; invalid holds emitted zero events. Native COMCTL browser
qualification was never reached. Existing standard/compat modules were pinned,
but neither executed in a browser guest. The COM preflight module's executed
bytes/hash were not retained; its logged pass does not establish full-build
qualification or original-module provenance.

All 310 registered media objects plus the original EXE are present: **311
paths, 45,460,823 bytes**. Every media `vfsPath` remains under
`c:\program files\microsoft games\motocross madness trial\`, matching the
working directory. No scene was duplicated at C root; no registry defaults,
guest config, save or media bytes were edited. The executable remains
1,029,632 bytes, SHA-256
`f0370d1d526be46eaf6ea5f941f185a393a8432baec695e1529f8672a314a71b`.
`fixture-identity.json` specifies the recomputed sorted local-path/space/hash/
newline digest `49d177d2e8f656391cb80155e64b1fcf9d0a324a07b66e8284391b1e2474768c`;
its serialization differs from the supplied coordinator inventory digest.

Local HTTP qualification fetched actual app-local URLs and verified their
complete SHA-256 identities, including COMCTL32 and generated input. The boat
repeated those checks before launching Chrome. All 427 pinned HTTP responses
match. The three other responses are identified 404s for `/build-info.js`,
`/api/auth/user` and `/favicon.ico`; no missing required MCM input was observed.
The game's documented optional missing assets were not exercised. HTTP media
checks are availability evidence, not guest reads or race execution.

All 36 remote artifacts were retrieved or verified against identical local
bytes before stop. Controller PID 6358 and Chrome PID 6370 are absent; HTTP
42517 and debug 44597 refuse connections, and the profile and writer lock are
absent. Chrome exited normally with code 0. One fresh boat, `bx_hbebkcf5`, used
a UUID Idempotency-Key persisted before create. Delegated normal stop
`stop_ee0da316a4703d42` completed at 02:10:36.916 UTC, `forced=false`,
`error=null`; state is archived with active expiry null. Allocation through
retrieval and completed stop took about 119 seconds, within 35 minutes. Local
free disk stayed above 2 GB. No resume/fork, nested worker, deployment,
held-risk retry or automated safety flag occurred.
