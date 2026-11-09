# Nox current-input driver, 2026-11-09

Run `20261109-nox-current-driver-target-1733` explicitly composes the accepted
Nox gameplay consumer against current main. `tools/nox-current-driver.cjs`
leaves the accepted historical driver and its pins immutable. `inspect` records
an exact current input plan and Git diffs; `generate` recompiles both canonical
modules, requires that exact plan again, and emits a separate strict consumer.
The only input-helper change is the existing Nox V/B/Q descriptor extension
applied to the actual current `ops/browser-native-input.cjs`. The original
registered `nox_demo` route, browser/input lifecycle, delivery bounds and
capture/owner/module guards remain active.
The generated consumer embeds its exact plan hash: editing a source file and
rewriting its JSON pin together is refused before startup. The generation
plan is published only after its write-once diff artifacts are complete.
Use a fresh plan directory and output directory:
`node tools/nox-current-driver.cjs inspect RUN/plans/NEW/plan.json`, then
`node tools/nox-current-driver.cjs generate RUN/plans/NEW/plan.json RUN/generated`.
Run the actual composition suite with
`node tools/nox-current-driver.test.cjs RUN/generated RUN/integration`.

The 766 retained inputs are present; 34 historical identities changed. All
32 changed source inputs match historical Git base
`9d2050843b40d19314a41741dd8463fc7e042c95` exactly before their recorded binary
diffs. Ten additional current dependencies extend the checked closure to 776.
All 126 original media/manifest pins match. Actual current registration and
manifest/EXE membership are checked, including refusal of extra installed
files. Fresh production WATX source compilation matches primary SHA-256
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`
and compat SHA-256
`ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.
Each changed dependency has its old/current size/hash, Git base and exact patch
hash in `plans/final/plan.json`; new untracked input patches are retained too.
Git plus small diffs is the source archive, with no source/media archive.

`tools/nox-current-driver.test.cjs` executes the actual generated consumer with
an explicitly offline CDP peer. It covers current preflight acceptance,
altered primary/compat/source/media/historical-driver and blind-repin refusal before browser
startup, actual bound-chain stale/wrong-live-module/wrong-allowlist/owner
replacement refusal, balanced drag/release, independent release on delayed
delivery, first-error shutdown without a later capture, and ordinary shutdown.
The stand-in child is actually waited with code 0 and separate stdout/stderr
EOFs. These are Node composition tests, not Chromium or original gameplay
proof. Three production native-input tests and the locked `tools/build.sh`
passed. Full raw results and preparation failures are retained in the run.

The runtime condition failed before allocation. ReturnFire1727 reported its
supervisor tool exiting 143 and both delegates disappearing without terminal
or watchdog-join records. Its actual normal stop receipt
`stop_55f2286b5ccd0f58` completed unforced at 17:40:07.350 UTC; box
`bx_pvye6uwx` is archived with expiry cleared. That proves its box stop, but
does not supply the explicitly required exact watchdog join. No Nox box,
watchdog, local/remote Chrome, original guest, input or target shot was started.
Nox box ID/state/expiry/stop receipt are **not applicable: not created**.
Target consequence, actual current rendering backend and guest shutdown remain
unverified. This worker preserves the concrete lifecycle blocker and stops.

Preparation failures are retained: the first inspector assumed a nonexistent
`shell/` directory (fixed before generation), a generation command was issued
before its plan finished (ENOENT), and a later reproduction correctly refused
a plan whose exact HEAD had changed from `b2000fe59` to `52f03da3f` while
another worker published. A second stale-HEAD refusal (`f8cc5ac74` to
`729b3f38a`) and a write-once patch-path collision during preparation are also
retained; use a fresh plan directory. The latter inspector failure preceded
the change to publish the plan last. No immutable guard was relaxed. A second
identical-output generation pass is not claimed; the exact final input plan,
successful generation, source recompilation and actual consumer tests are.
The passing final composition suite is `integration-final/results.json`.
The release suite with the embedded-plan/blind-repin control is
`integration-release/results.json`.
Next work requires a separately assigned runtime whose predecessor lifecycle
condition can actually be satisfied, then actual native Chromium preflight
before an inspected original target/objective attempt.
