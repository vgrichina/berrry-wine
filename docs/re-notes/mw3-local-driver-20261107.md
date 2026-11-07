# MW3 local driver preparation — 2026-11-07

The staged driver in `scratch/runs/20261107-mw3-local-driver/` passes the
requested local controls. No original MW3 runtime was started and no box was
allocated. The browser entry explicitly requires `LOCAL_PRODUCTION_FIXTURE=1`;
the original route remains disabled for this assignment.

The tested source SHA is `e501c0228aa5adb28b8de8d77e954774117dcf30`.
Both actual production Worker instances yielded module SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467` through
CDP bytecode recovery. The run pins the relevant installed source files and
records relevant working-tree changes as binary patches, including new inputs.
No source tree, media archive, or duplicate WASM was saved.

## Local validation

- `browser.cjs` exercised the existing small public COM fixture through actual
  production guest and render Workers. Readiness can settle before binding;
  missing renderer and prebinding process replacement are rejected. The initial
  renderer attaches during sampling, then two complete owner readings bind it.
  Startup sampling is forbidden after binding. `controls/passing-after.json`
  records all 18 exact identity fields, actual endpoint/render-owner/process
  replacements, and zero-effect freshness rejection.
- `controls/identity-controls.json` adds a wrong executing-module negative and
  rejects every changed reviewed identity token. `controls/startup.png` was
  visually reviewed: it contains only the generated fixture caption and canvas.
- Fourteen actual Chromium native input controls cover mouse and keyboard,
  normal, delayed/rejected/pending DOWN, deadline, and rejected/pending UP.
  The UP timer is armed before DOWN and runs independently of its ACK. Each
  isolated control records exactly two trusted browser events. Unknown cases
  are terminal controls and are never replayed.
- `local-checks.cjs` passes the exact numbered ACK producer/client, wrong ID,
  sticky UNKNOWN, and duplicate-consumer negatives. The live browser also
  acknowledged `local-complete` exactly and exited normally.
- `test-deferred.cjs` exercises the selected entry's actual Worker attachment
  handler: missing observer bytes prevent debugger resume; the successful path
  installs the pinned observer before resuming the Worker.
- `closure-check.cjs` verifies full HTTP bodies for 33 registered EXE/DLL/font/
  database resources, transitive real MSVCRT/MFC42 DLLs, and both registry source
  files: 37 bodies, with status, size and SHA-256. Static import classifications
  are recorded separately; this does not assert runtime API completeness.
- The actual `browser.cjs` entry accepts a constructed 25-minute deadline and
  rejects over-25-minute, 35-minute, expired and NaN values before Chrome spawn.
  The successful entry is intercepted at the spawn boundary for this test.
  The live fixture's persisted deadline stayed unchanged from startup to ready
  (1,499,954 ms remaining at entry). These are guard and immutable-deadline
  controls, not a claim that a 25-minute gameplay session elapsed.

Commands: `node .../local-checks.cjs`, `node .../test-deferred.cjs`,
`node .../closure-check.cjs`; the live entry used `LOCAL_PRODUCTION_FIXTURE=1`,
`CASE_TAG=controls` and one fixed `BROWSER_DEADLINE` computed as now + 25 minutes.
Each command uses the named run directory in place of `...`.

Free disk fluctuated below the 1.5 GB floor during preparation and finalization.
Writes paused while below the floor; read-only registry hashing and HTTP checks
continued until recovery. The completed run is small (under 1 MB before final
patches), and its disposable Chrome profile was removed after normal exit.

No production emulator mismatch was demonstrated, so no production code edit or
locked build was needed. Registered assets, app-local MSVCP50/Mech3Msg, normal
configuration, guest memory and clocks were preserved. There were no original
handler calls, game boots, installer downloads, box operations or held-input
retries. No runtime/gameplay/backend/FPS/parity/full27 claim follows from these
fixture controls. Box ID/state/expiry: none. No live owned browser, port, profile
or held input remains.

Next: a separately authorized runtime assignment can reuse the qualified
observer/admission/release components, recheck their pins and disk, and enable
the original registered route under its own fixed deadline. Ordinary MW3 menu
and gameplay input still require fresh original captures and review; historical
handler-driven routes do not supply that evidence.
