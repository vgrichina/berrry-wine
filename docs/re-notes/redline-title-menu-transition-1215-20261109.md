# Redline title transition, 1215 — supported offline; prelaunch failure

The retained evidence supports an ordinary passive title-to-Start-Up transition. Fresh native verification and Training/Vehicle Training were **not reached**: this worker's outer evidence label collided with the inner fixture command label before any Boat exec, browser, fixture or original launch. The first failure was treated as terminal; no runtime retry followed. SingleTaskSTOP. Native REVOKED; allwriters UNKNOWN; edictABA UNKNOWN.

Evidence is in `scratch/runs/20261109-redline-title-menu-transition-1215/`. No production or shared-client source changed. Only fresh run inputs and this note were owned.

## Supported transition

Personally reviewed 1150 `review/play-result.png`, SHA-256 `f04713b83592f316c76f650e4aa713530640b2a757bbbba2ef96906a438c04f3`: version 0.90 single-player-demo title splash. Read the 1150 note, executable-derived arrow/Enter route and retained original state.

Personally reviewed the earlier successful 0955 `review/play-result.png` and `review/menu.png`: the former is the same title splash; the latter is Start Up with New Game highlighted. Its retained command sequence is Play held 150ms/wait5000, then **capture/wait5000 with no input**. That ordinary passive transition is established by historical actual captures, not a guessed dismissal key.

Original `Redline.exe` remains 1,828,864 bytes, SHA-256 `fd00f9a29713474862b7c9b16533893cdf96794c687d6ab76c525f4119d2ae1e`. Disassembly `528150..5283fe` shows the intro's automatic advance after threshold `0x96` (150 update iterations), independently of its logical Escape/Space/Enter checks through `439b26`. `5284e8` advances the three intro pictures; fade/advance completion is called by the render path. This is an update counter, not a promise of 150 wall-clock milliseconds. `derive-transition.py`, `title-transition.json` and small disassembly extracts preserve the checks and SHA/size references. Media and earlier screenshots were referenced, not copied.

The prepared route is ordinary Play150/wait5000, personal review of the expected title as a legitimate intermediate, **one finite passive5000 capture**, then personal review of actual Start Up. A remaining title or any unexpected state is terminal. After Start Up, use one100ms ordinary arrow per reviewed highlight and Enter only when Training Levels is pictured highlighted; personally review the resulting Vehicle Training/menu/gameplay before any further decision. No fixed arrow count, forced lock, cursor write, guessed coordinates, dismissal-key fallback or replay is authorized by this derivation.

## Offline validation

Twenty cases execute the actual generated controller definitions, real numbered transport and bound input helpers with inert CDP/renderer services. They cover the added passive5000 capture with zero keyboard/mouse calls, terminal capture refusal, Down/Up/Tab/Enter100ms pairs, keyDown/keyUp failures, independent UP, sticky first failure and rejection of later input/capture. Historical mouse controls remain. These are controller tests, not native game consumption evidence.

Actual generated fixture/original invocation tests, readiness consumer tests, successful SystemExit(0)/failed-exit controls, focused key-delivery/menu-selection suites, fixture source check and bounded caller preflight pass. `flock /tmp/wine-build.lock bash tools/build.sh` passes. The final readiness/exit guard and generated caller are byte-identical to1150; input, hold, CDP and caller bounds remain intact. An initial preflight omitted BROWSER_DEADLINE and correctly refused before browser startup; the corrected finite-deadline preflight passed. No local browser tests ran.

860 fresh provider pins and26 unchanged proof references were verified. `git-base.txt`, empty relevant `production.diff` and small `owned-inputs.patch` retain source recovery; reverse-application check passes. Git is the source archive. No source/media archive or module copy was retained. Free/home stayed above1.5GB.

## Terminal invocation error and cleanup

After the exact Q21205 UUID `179a8a60-1e58-4425-9a22-15f4fedc2187` archived/drained release, the API confirmed `bx_cq8zqp74` archived with completed normal stop `stop_fad5e3232932c556`. The new immutable25-minute UUID watchdog was observable before the single allocation. Provisioning and the remote provider barrier passed.

The worker then incorrectly invoked outer `run.py native-fixture ... control.py fixture`. The outer wrapper exclusively created `native-fixture-command.json.gz`; the inner controller attempted the same exclusive file creation and raised FileExistsError **before its subprocess.Popen/Boat exec**. This is a worker invocation error, not a Redline or native-input failure. No whole native fixture passed and no original was authorized. No later guest input/capture or runtime retry occurred. The next separately authorized task must use distinct outer/inner evidence labels, e.g. `run.py fixture ... control.py fixture`, and still pass the whole actual native fixture before original launch.

Independent no-input filesystem/process inspection confirmed absent native-fixture/original/custody/process files, profiles, writer locks and owned writers. The only unique remote setup artifact,179-byte `remote-barrier.json`, was retrieved and SHA/size verified before normal stop. Local completed gzip evidence passed CRC checks in `prestop-local-seal.json`; all command waits retain separate EOF. No guest/CDP cleanup calls were used.

Sole box `bx_67zvxgk4`, UUID `e1772d11-e325-47ce-a941-1c9fe9a12e25`, initially reported archiveAfter `2026-11-09T12:10:28.584Z`, TTL1495. Delegated unforced normal stop `stop_d8ab9b314e287896` completed `2026-11-09T11:47:13.070Z`. Final API state archived, archiveAfter null; expiresAt was not returned. `final-uuid-expiry-receipt.json` ties the exact UUID/name to the final API receipt. Watchdog and lifecycle actually exited0 with separate stdout/stderr EOF; runtime lock released. No resume, delete, agent, worker or deployment occurred.

Next: separately authorized fresh whole-fixture run using distinct evidence labels, followed by this derived passive transition and the reviewed ordinary keyboard route. This task makes no fresh title-transition, Training or gameplay claim.
