# Stronghold progress-aware startup: original title reached

**The original loader completes and reaches Enter Your Title / Lord Crusader / Start Game at step 10240 without guest input. Main menu, scenario and world remain unreached.** The finite stopping cause is unavailable input telemetry: the actual renderer and host have no `_activeInputEvent`, `_lastInputEvent` or `_mouseButtonsMask` properties. The unchanged native guard correctly rejects that state. No missing value was converted into null/null/zero, and no gesture was used to initialize the fields.

Evidence is `scratch/runs/20261104-stronghold-progress-aware-startup/`. This follows [2c2ff0f45](stronghold-direct-crusader-start-20261104.md), whose loading artwork at 6144 was a checkpoint divergence, not a demonstrated fault or hang. I personally inspected its actual 2048 and 6144 captures before this run. Runtime/media/modules were reused from the assigned retained **bx_c5e39n22**, without restaging media. `source-reference.json` records exact Git SHAs, retained module/media references and relevant binary diff; `owned-new-helpers.patch` reconstructs the small run helpers. Git remains the source archive.

## Controller corrections and tests

The run-only driver adds finite observation batches of 64–2048, divisible by 64. Every batch delegates to the original strict per-guest 64-step ACK path, retaining the aggregate ceiling **16384**. It checks its finite walltime before every command and preserves the existing first-fault lock, served-file pins, immutable queue and normal close. Changing loading artwork or a later splash checkpoint is not an error. Each fresh checkpoint was personally inspected, including actual window identity and native geometry, before further execution. The observation command does not automatically label arbitrary screenshots as loading or authorize gestures.

Read-only state observation now records whether `sharedRenderer === wine.renderer`, whether each raw input property exists, the actual renderer fields, and `getMouseButtons()`. This establishes that the missing fields are on the actual host renderer, rather than a mistaken renderer reference. The getter returns zero, but that alone does not qualify drainage.

Before the single browser launch, remote tests passed for exact CommonJS and dynamic Puppeteer **25.7.0** imports; all **2415** retained file pins; five actual HTTP responses with matching pins and COOP/COEP; progress batches and walltime; invalid per-guest ACK; fractional Crusader coordinates; command/aggregate ceilings; immutable queue, concurrent close, explicit review and balanced cleanup. Two initial preflight script errors (a token replacement inside RUNNING and a process search matching its own command text) were corrected before launch; their failed commands are retained.

After closure, `input-qualification.cjs` and the actual operator gained a pre-upload gate: fetch fresh read-only state, require explicit existing raw telemetry, then run unchanged native readiness and geometry checks. Actual-title negative tests reject absent fields even if a caller supplies top-level null/null/zero or observes a zero button getter. Explicit synthetic fixtures still accept genuine null/null/zero and reject active events, masks, queues, identity and geometry changes. An actual-operator test rejects all eight input/Start action paths before upload. These last operator safeguards were tested locally after closure, not exercised by a second browser. The native guard file is byte-for-byte unchanged from the predecessor.

## Personally reviewed ordinary progression

| Step | Fresh capture | Actual visible state |
| --- | --- | --- |
| 2048 | `review/startup2048.png` | Original loading artwork; streaming overlay `anim_dungeon.gm1`, 155 MB completed |
| 4096 | `review/startup4096.png` | Loading continues; `opencldrn_01.wav`, 247 MB completed |
| 6144 | `review/startup6144.png` | Loading continues; `swordbasic_02.wav`, 293 MB completed |
| 8192 | `review/startup8192.png` | Gathering of Developers splash; loading overlay gone |
| 10240 | `review/startup10240.png` | Original Enter Your Title dialog, Lord Crusader, Start Game |

The renderer's original 800×600 native window, canvas rectangle `(10,194,860,668)`, exclusive nearest presentation and DPR 1 remain unchanged. Every checkpoint has an empty input queue **and absent raw active/last/mask fields**. `input-qualification-stop.json` preserves the final fresh state. The actual strict native guard returns `input not drained`; this is an observation-contract blocker, not proof that an event is pending or that the game is hung.

The pinned source explains the boundary: input fields are lazy. Host `check_input` clears last/active only when actually invoked; renderer button mask is assigned on input. The worker RPC empty-queue fast path can answer no input locally, without calling the host's clearing path (`lib/guest-rpc.js`, `host.js`, `lib/renderer-input.js`). This run does not weaken the guard or mutate guest/host fields to hide that distinction. A future implementation needs a supported explicit read-only input-state contract or proper constructor initialization, tested on the original worker path before navigation.

No Escape, mouse move, click, Crusader selection, scenario Start, Save/Load, recruitment or combat was attempted. The tested original fractional Crusader `(304,144)` route and original Zephyr / Very Easy / Rat route remain available but unexecuted. Native `(718,569)` Start remains locked behind the unchanged scene/queue/mask/ACK/personal-review qualification.

## Recovery and handoff

`verify.py` passes full SHA/length verification of the closed immutable snapshot: **191 logical files**, **160** original per-guest ACKs, **10240** total steps, maximum **64**, **1003** matching served-file pins and five personal capture reviews. There were zero game input commands. Chrome PID **21332** launched **05:57:04.484Z** (driver exec timestamp) and closed normally at **05:58:49.463Z**, exit zero, well before the 06:10 hard close. Recovery completed before 06:00, ahead of 06:14. No second browser or reload occurred.

Actual exec **05:59:49.324780Z** confirms Chrome and driver absent and all **2415** runtime pins unchanged. **bx_c5e39n22 remains RUNNING / API idle, healthy, hydrated**, expiry **2026-11-04T06:21:54.275Z**. The coordinator retains shutdown ownership. No stop, resume, delete, new box, deployment or worker launch occurred.

Only this note is committed; helpers/evidence remain in the ignored run directory with reconstructible patches. No production edits or full build were needed. This single-task worker stops here; the next prerequisite is explicit input-state availability before any ordinary title/menu gesture.
