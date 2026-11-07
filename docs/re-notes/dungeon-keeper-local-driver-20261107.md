# Dungeon Keeper local driver qualification, 7 November 2026

The staged browser driver passed local qualification with the existing small
production guest/render Worker fixture. This prepares a later original Dungeon
Keeper digging attempt; no original game was booted and no box was allocated,
resumed, stopped, or deleted. The registered original route, configuration,
installed executable, DLLs, and assets remain unchanged.

Evidence and executable staging helpers are retained in
`scratch/runs/20261107-dungeon-keeper-local-driver/`. The successful execution is
`local-production-complete/`; the initial `local-production/` execution closed
at the 1.5 GB disk floor before any native input (`native-input.json` is empty).
Writes paused until disk recovered. The successful run then completed and
closed its own local browser/server/profile, releasing the shared fixture queue.
No held original-game input or UNKNOWN command was retried.

The actual staged `browser.cjs`, `bound-input.cjs`, `qualification.cjs`, and
`qualify.cjs` ran against production `guest-worker.js` and
`d3d-render-worker.js`. Both live Worker modules were recovered through CDP and
matched SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
`runtime-pins.json` records source/media hashes and the source Git commit;
`source.json` and the adjacent binary patches preserve relevant uncommitted
sources and owned new helper files. Git remains the source archive.

Passing controls:

- Renderer attachment settles from `none` to endpoint 1 before binding. Missing
  renderer times out; replacing the process during initial sampling fails.
  Startup sampling after binding is forbidden. Endpoint, render owner, and
  process replacement after binding fail with zero input effects.
- All 18 reviewed identity fields remain exact. A wrong expected executing
  module fails; stale reviewed pixels are refused before dispatch. Identity
  failures close admission, while a zero-effect stale refusal permits only a
  new capture.
- The deferred observer's exact selected event source rejects a missing staged
  observer without resuming that Worker. The positive control installs before
  resume. The actual production render Worker also reports the observer's
  WebGL context data in `startup-state.json`.
- Fourteen actual trusted Chromium mouse/key pulse controls cover normal,
  delayed/rejected/pending DOWN, deadline, and rejected/pending UP. Each has one
  DOWN and one UP. UP is armed before DOWN and attempted independently after
  60–61 ms, or 20 ms for the deadline case; delayed DOWN acknowledgement arrives
  after UP. Injected UNKNOWN outcomes are isolated fixture controls.
- `test-transport.cjs` exercises the staged request/consumer pair, exact ACK ID,
  wrong ACK and missing ACK sticky closure, malformed command rejection, and
  the sole fresh-capture continuation after a zero-effect stale refusal.
- The registry EXE, three DLLs, manifest and all 165 manifest asset entries
  resolve to 167 unique HTTP paths. Every response is 200 and matches the local
  length and SHA-256. The retained 166-file staging omitted the manifest body
  pin; `check-http-closure.cjs` records that failing-before condition and the
  complete passing closure. Only owned staging data needed correction.
- `validate-deadline.py` constructs the actual 25-minute deadline once and
  passes it unchanged to the staged browser entry. Its existing guard accepts
  that value and rejects 35 minutes, expired and NaN values. The no-Chrome
  preload exits at the real spawn boundary. This validates the real entry and
  immutable deadline plumbing, not a 25-minute game endurance run.

The reviewed image is the fixture caption on a white canvas. Its observer
reports WebGL2/ANGLE Intel UHD 620 for the fixture only. It establishes no
original-game rendering backend, gameplay, dungeon digging, FPS, audio, parity,
runtime compatibility, or full27 result. No emulator mismatch or production
code change was required; no full build was needed for this documentation and
ignored-helper change.

Rerun the helpers from the owned run directory after verifying disk and pins:
`node test-deferred.cjs`, `node test-transport.cjs`,
`PYTHONDONTWRITEBYTECODE=1 python3 validate-deadline.py`, and
`node check-http-closure.cjs`. The successful browser command used
`LOCAL_PRODUCTION_FIXTURE=1 LOCAL_QUALIFICATION_EXIT=1`,
`CASE_TAG=local-production-complete`, and an externally constructed
`BROWSER_DEADLINE=now+1500000`, under `/tmp/wine-build.lock`.
Use a fresh case directory for a future isolated fixture run.

Next: the coordinator may assign a separate original-runtime attempt using the
preserved registered route, after checking disk and the runtime pins again.
Inspect fresh original captures before ordinary native actions. Box ID, state,
and expiry are all not applicable; this assignment owns no test box.
