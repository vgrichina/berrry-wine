# Forsaken capture composition diagnostic, 8 November 2026

The instrumented fresh original **did not reproduce the command deadline
failure**. It reached a personally reviewed initial Volcano world/HUD using the
unchanged fixed budgets. There is **no validated causal repair**. The previous
failed Start remains failed, and its exact pending CDP operation remains
unknown. The concrete blocker to claiming a repair is the missing old per-await
trace plus non-reproduction in the one authorized diagnostic original.

Evidence: `scratch/runs/20261108-forsaken-capture-composition-cause/`.
The prior `20261108-forsaken-stable-startup-gameplay/` run was read only, never
replayed or relabeled. Its handoff matches commit `24afe9620` exactly.
No production emulator, renderer, input transport budgets or guest scheduling
changed. Only this note is committed; instrumented helpers and evidence are
run-local.

## Actual await instrumentation and controls

The existing `browser-run.cjs`, numbered `transport.cjs`, bound-input chain,
production Worker fixture and native key helpers were reused. The trace records
entry/exit/error, parent phase, timestamp and elapsed time. CDP awaits include
method, session, target, script ID and expression kind/hash. State, outstanding
Worker-source promises, capture, before/screenshot/after owner checks,
admission, independent release, hold sampling and waits have phase boundaries.
The command deadline snapshots all active awaits without changing WORK=20 s,
ACK or immutable browser/cleanup deadlines. No guest exports, memory, clock or
scheduling were modified for instrumentation.

Local controls exercised the actual executed composition:
`execute -> admit -> independently released hold -> settle -> state ->
chain.capture -> before/screenshot/after` through real production guest/render
Workers and the shipped f965 module, rather than a lightweight ACK substitute.

- `local-composition/`: native Enter 750 ms + wait 1 s + complete capture
  succeeded. Controlled 3.5-second host receipt delays on actual
  `Debugger.getScriptSource` responses then exhausted the unchanged 21-second
  command work window. The deadline identified the post-screenshot renderer
  source await by exact session/target/script. There was no success ACK;
  follow-up input was rejected by sticky UNKNOWN. Both Enter releases occurred
  at about 750 ms. Already-started local work was allowed to drain and is not
  relabeled as success.
- `local-owner-before/` and `local-owner-after/`: two additional actual guest
  Workers and controlled 4.5-second delays on unrelated-thread identity reads
  reproduced a different composition problem. The old scan expired at 21 s;
  selecting the already bound target completed in **2.981 s**, with the same
  state collection, module-byte proofs, renderer checks and screenshot checks.
  The candidate additionally checks the page's exact bound references before
  reading that target. It was qualified locally, not assumed causal.
- `local-identity/`: the candidate passed the reused missing-renderer,
  prebinding process replacement, endpoint/renderer/process-owner replacement,
  every reviewed identity token, stale-scene and trusted DOWN/UP controls.
  Negative controls dispatched zero input. `release-control.json` also retains
  slow-sampler and injected-UNKNOWN release controls. The generated caption and
  white canvas were reviewed as fixture evidence only.
- `local-final-preflight/`: the final instrumented driver, including its disk
  observer, passed native key/type/combo checks without launching the original.

Two metadata-only page-target assertions are retained separately. The initial
trace labels session-less browser commands `page`, because both the requested
session and the not-yet-assigned page session were undefined. The exact page
session-to-target mapping was subsequently recorded in
`retrieved/original/page-session-target.json`. Worker target/session IDs were
exact throughout. These metadata assertions did not dispatch guest input,
change the command stream or produce an input UNKNOWN.

## Original measurements and causal limits

The optional bound-target selection marker was **never staged or enabled** in
the original. Its terminal audit proves this. The actual original measurements
reject unrelated-thread scanning as the explanation for the observed expensive
startup capture: those reads were near immediate. The dominant measured waits
were on the **owning guest Worker**, not the renderer Worker or module transfer.

`original-analysis.json` pairs actual CDP entry/exit records. Startup capture
lasted **16.472 s**:

| Actual phase | Duration | Dominant owning-guest await |
| --- | ---: | ---: |
| `state()` | 4.194 s | `Runtime.evaluate` CPU/GPU flags: 4.031 s |
| capture binding before screenshot | 8.192 s | `Runtime.evaluate` instance identity: 7.991 s |
| capture binding after screenshot | 3.762 s | `Runtime.evaluate` instance identity: 3.531 s |

The owning guest target is `453AA715701F9F69B765702AD332BC28`, session
`B242103A54A3E1272717CB4B42671A1D`. Across this diagnostic, actual
`Debugger.getScriptSource` calls took at most **142 ms**; screenshot calls at
most **1.233 s**. Unrelated guest identity reads took at most **53 ms**.
The owner identity evaluations took up to **7.991 s**, and owner state reads up
to **5.288 s**. This locates the expensive observed awaits; it does not establish
why the guest's inspector service was delayed, a renderer hang, or the exact
await outstanding in the previous uninstrumented failure.

The closest successful input composition was `select-singleplayer` at
**17.849 s** against wait 1 s + WORK 20 s. Its capture alone cost **15.464 s**.
The diagnostic `start` used Enter 750 ms and wait 1 s, completed in **10.241 s**,
and received exact ACK 7. Its independent UP began 750 ms after hold start;
the passive sampler finished later, as the release design permits. The
following wait-8-second passive capture completed in **15.702 s** against its
28-second work window. No command or CDP deadline fired. All **10** numbered
commands, including ordinary quit, have exact success ACKs and no outstanding
UNKNOWN. None of this retroactively qualifies the previous failed Start.

A possible next investigation is coalescing redundant owning-guest observations
within state/binding composition while retaining every identity and renderer
proof. No such repair was implemented, bypassed, hot-patched into the live
stream or claimed validated here. A second original was not authorized and was
not allocated.

## Personally reviewed native observations

`capture-review.json` binds each review to the image hash. Command labels are
not accepted as proof of their intended transition:

- `startup.png` and `copyright-continue.png`: ordinary native main menu with
  Single Player highlighted. Elapsed review time after startup allowed the
  attract sequence to begin before the first command's resulting capture.
- `singleplayer.png`, `dismiss-attract.png`, `menu-return.png` and
  `intro-continue.png`: automatic Acclaim/Probe-logo tunnels without player HUD.
  They prove neither player movement nor successful submenu/menu-return input.
- `escape-long.png`: original copyright/demo notice after bounded native Escape.
- `select-singleplayer.png`: Single Player Game, Start and Level Volcano panel.
- `start.png`: native Volcano briefing and partial loading bar.
- `loading-passive.png`: readable initial textured Volcano world, Lives 5,
  shield/hull 128, POWER 1, PULS 2000 and MUG 5. This follows native menus and
  loading, rather than an attract-logo frame. It is initial world/HUD evidence;
  no thrust, look, fire, ammunition consequence or enemy interaction was tested.

The diagnostic was closed after this passive observation because a causal
repair had not been validated. Full 27, backend parity, FPS and audio remain
open, as do movement/combat verification and the old deadline failure.

## Identity, preservation and shutdown

Staged source is main **`efe297deaf4a3daae1d8fbd6beb05258babc5d58`** plus
`relevant-source.patch`, `new-lib_wininit-boot.js.patch` and the owned input
patches. Git is the source archive. `runtime-pins.json` identifies all **1,487**
staged files, unchanged after execution; **743** successful served responses
match their pinned bytes. All **873** existing original media references match,
including executable SHA-256
`366ec5d0943daca839836296f9fb52724e94dc155630c6b0c30d7181106b5e24`
and manifest SHA-256
`587ce145ab73a3fed2c7136425bb6a7bcf28def312d430c8bf7d1be802b2260b`.
No source/media archive was created.

The actual route was
`index.html?candidates&no-log&threads&app=forsaken_demo&d3d-renderer=webgl`,
Chrome **151.0.7922.108**. Actual guest/render module SHA-256 is
`f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.
All ten state checkpoints retain owning legacy WebGL endpoint 1, actual module
and instance/context bindings, zero renderer error and zero GPU fallback.
The actual observed owning-Worker context is 640x480 WebGL 2.0, ANGLE / Intel
UHD Graphics 620 / Mesa 23.2.1. The wrapper adapter's direct `.gl` field is null;
context proof comes from the delegated native context creation and matching
owning-Worker/context token, not that absent wrapper property.

All **143 remote references / 132 unique contents**, **12,492,635 reference
bytes**, were retrieved and independently size/SHA-256 verified **before**
normal stop. Ten original PNGs pass chunk CRC and decoded-row checks. Eight
holds have completed independent-release receipts (750–752 ms for the seven
750-ms holds, 1,999 ms for the 2-second Escape). Chrome exited 0. Controller
and browser PIDs, HTTP/CDP ports, profile and writer lock are absent. All five
local fixture/preflight browsers are also closed. Sampled free disk stayed
above 5 GB; no RAM admission gate was used.

The observable detached 25-minute watchdog was armed before UUID-idempotent
allocation. Box **`bx_v5jx78db`** is **archived**, current expiry **null**,
original expiry **2026-11-08T03:05:23.351Z**. Normal stop receipt
**`stop_28b68056fa285937`** completed **2026-11-08T02:49:23.340Z**,
`forced:false`, error null. Both lifecycle delegates exited zero and the
supervisor has no children. All 36 run-helper syntax checks and this run's containment/schema checks pass;
the repository-wide evidence checker retains seven unrelated existing errors.
No box was resumed or deleted, no second original
or software retry ran, and there was no public deployment. This worker stops
with the causal repair unresolved.
