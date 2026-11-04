# Darkstone: original Ardyl manual combat, 2026-11-04

Software reached **Land of Ardyl**, visibly targeted **Skeleton**, and defeated
one skeleton while the original warrior survived. Reviewed native inventory
captures show **LIFE 35/35 → 16/35** and **Victories 0-0 → 1-0**. A second skeleton
remained. Sequential WebGL reached Town and displayed **Combat Mode: Manual**;
its time limit ended the arm before the exit. WebGL Ardyl/combat parity remains
unverified.

This follows [the served-binary preflight/combat note](darkstone-served-binary-preflight-combat-20261104.md)
at `ff970b100`. Its black road-exit capture after 256 steps did not establish
arrival or combat. This run supplies new evidence rather than upgrading that
earlier result.

Evidence: `scratch/runs/20261104-darkstone-ardyl-manual-combat/` (ignored).
`final-audit.json`, both arm directories, their remote inventories/recovery
reports, and `software-success-gate.json` retain the observations and receipts.
No candidate-corpus Darkstone entry exists, so the evidence remains attached
to this investigation rather than an unrelated dashboard candidate.

## Tested runtime and prerequisites

The prepared runtime source is **2e802c7dfbb41dec726b7e69d580aba316cc48d2**,
with recorded predecessor relevant source/new-file patches and source pins.
`checkout-head.txt` and `checkout-relevant.patch` record the local checkout;
that checkout's newer changes were not silently substituted into the runtime.
`runtime-pins.json` records **1,427** files, including `comctl32` and all **15**
original media files. Necessary runtime/media files were transferred once to
the assigned fresh box; media was not copied into evidence. Git SHA, binary
diffs, and small helper/new-file patches provide source provenance; no source
tree archive was made and no source build was performed.

Both browsers actually compiled the canonical **2,143,712-byte** module:

`1a021b0f9ef7eeba12637c66e8929fdd75383e16c431ee318f812af8dbd78e58`

Page compilation/instantiation, module transfer, and guest-worker receipt and
instantiation observations are retained. Actual module bytes were recovered
with the full hash in their names. The **2,146,325-byte** companion was pinned
and recovered, but was not executed:

`74b34125e175895dc3ca843ccaa555f934611e3bd676e1e95f25aae9c2e7be66`

Before Chrome: syntax/import checks, all runtime pins, **300 actual localhost
GETs** with byte/hash checks, cross-origin isolation, missing/wrong-hash/
wrong-size served-module controls, HTTP-negative controls, canonical fallback
rejection, binary transport, manifest-file transport, atomic per-command ACK
gating, capture freshness/step bounds, and closed-inventory recovery controls
passed. The localhost GET/pin checks were repeated before the second arm.
`postflight-pins.json` confirms all 1,427 files unchanged after both arms.

Run-only defects and failures are preserved. Initial staging used the nested
working directory and failed before media upload; resolving paths against the
absolute checkout root fixed it, with a nested-directory exact-byte test.
Recovery now refuses inventory before `cleanup.json`; its rejection and
closed-directory acceptance were tested. The added native-observer unit test
initially collided with CommonJS `exports`; renaming its test variable fixed
it. That new test passed **after the first browser launch**, because the shell
had continued after its failure. Existing preflight gates had passed before
Chrome, but this added test's timing did not meet the requested ordering.

Each browser logged seven optional static-host 404 responses: local
`build-info.js`, account identity, favicon twice, unsupported `__bundle`, and
absent optional `stdole2.tlb`/`.part000`. These are retained individually with
the original host's supported absence/fallback behavior in
`optional-http-source.txt`. The final offline audit's initial blanket
console-error assertion failed on these responses; `audit-initial.log` is
retained. Its corrected check requires exactly those responses and rejects
other console errors/non-200 responses. Native runtime/transport guards were
not weakened; there was no browser retry or reload.

## Bounded Town exit diagnosis

Original warrior **CODEX** was created, selected, and placed into the party.
Town's F input visibly enabled manual combat. The inspected original road
route used the upper-left Town path; the pointer was held at page `(380,488)`.
All advancing commands were separately acknowledged and capped at 64 steps.
The transition was sampled with screenshots and read-only native state:

| Capture | Frozen steps | Observation |
| --- | ---: | --- |
| `exit-initial` | 5272 | Black; worker thread 3 at original `0x463590`; thread 2 waiting on CS `0x259ee8`, owner 3 |
| `exit-64` | 5336 | Black; thread 3 advanced to original decoder code `0x4767e3` |
| `exit-192` | 5464 | **Land of Ardyl** loading art; loader endpoint 3 completed 33,342 software draws; prior wait resolved |
| `exit-448` | 5720 | Fade/black; loader endpoint closed; main original file-path processing |
| `exit-704` | 5976 | Black; changing original path-processing EIP/stack and advancing draw counts |
| `exit-960` | 6232 | **Actual Ardyl world and HUD visible** |

Small original-EXE disassemblies retain the decoder/copy work and main
path/search loops. Native instruction pointers, waits, bounded stack words,
renderer ownership, and screenshots distinguish progress from a frozen
renderer. The black interval was loading in this run; this does not prove
every earlier black interval had the same cause. No production defect was
established or production file changed.

## Aim, defeat, and survival

After inspecting Ardyl, ground movement used the recorded route near canvas
normalized `(0.65,0.35)` then `(0.78,0.60)`. Two skeletons became visible.
Right-clicking the warrior portrait opened the original inventory; the tested
I key did not visibly open it, so no inventory state was inferred from I alone.

Reviewed `before-health.png` shows level 1, LIFE **35/35**, Victories **0-0**,
and an empty EXP bar. After closing inventory, `aimed-first.png` shows the
selected skeleton's name and red enemy health bar. Pointer holds followed the
near skeleton's torso, with each hold split into at most 64-step commands and
an inspected capture between holds. Five later holds were 256 steps each;
the first hold was 64, totaling **1,344 held steps (21.504 guest seconds)**.
This was a bounded sequence with visual corrections, not a blind long loop.

`attack-final-hold.png` shows the near skeleton gone while the other remains.
`after-health.png` shows **LIFE 16/35**, **Victories 1-0**, and increased EXP bar
fill. Numeric EXP was not collected. `victory-world.png` shows the inventory
closed, the surviving warrior, and the remaining skeleton. No potion, stat
edit, cheat, guest-memory write, or configuration change was used.

The owning renderer was `lib/d3d-render-worker.js`, endpoint **1**, actual
options `{api:"legacy", backend:"software"}`, with **935,114** completed
software draws at the final observation. Worker IDs and module identities
are recorded in the arm's `final-state.json` and `final-audit.json`.

## Sequential WebGL and handback

Software completed and closed before WebGL was launched. WebGL used the same
pinned canonical module, original warrior/party setup, and native F input.
`webgl-gameplay/town-manual.png` visibly shows Town and manual combat. Its
owning render worker endpoint **1** reported `{api:"legacy",backend:"webgl"}`,
adapter `Object`, and **zero** native software draw completions. Actual GL
vendor/version was not captured; Chrome was permitted to use SwiftShader.
This establishes the selected worker backend, not physical GPU execution.
The six-minute arm cap required closure before exit/combat testing.

Chrome **151.0.7922.108**, Puppeteer **24.31.0**, remote Node **24.22.1**;
isolated localhost, worker threads, frozen 16-ms steps, 1200×900 viewport.
Software had **305** matching ACKs and **72** trusted observed input events;
WebGL had **138** ACKs and **30** trusted events. Every issued key/button
press was released; maximum advance was **64** steps. Browser durations were
**760.898 s** and **337.389 s**, total **1,098.287 s**, sequential and within
the 15-minute per-arm/20-minute total limits.

Software Chrome PID **8801** exited 0 at **03:59:34.229Z**; WebGL PID **20977**
exited 0 at **04:05:57.696Z**. Stable recovery verified **974 + 444** arm files
by size and SHA-256. `postflight-closure.json` confirms browser/helper PIDs
absent and private ports **41237/37413** closed. All own helpers and recovery
finished before 04:32Z.

Assigned **bx_3ub9q4br** was verified before use and at handback as
**RUNNING / API `idle`, healthy, hydrated**, exact expiry
**2026-11-04T04:42:10.054Z**. Ownership returned to the coordinator for
shutdown; no allocation, resume, stop, delete, or credential change occurred.
No WebGL combat, audio, FPS, full-game, compatibility-module execution, or
physical-GPU claim follows from this run. No successor task was started.
