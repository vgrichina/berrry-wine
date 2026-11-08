# Recoil bounded transition objective, 2026-11-08

Run: `scratch/runs/20261108-recoil-bounded-transition-objective/`.

The sole authorized fresh launch failed before Chrome because its hermetic
preloader selected an unstaged manifest. A corrected launcher now explicitly
binds that preloader to the corrected manifest and exercises the real preloader
and transitive HUD decoder before browser creation. The correction passes a
focused actual-browser generated-fixture check. No second original was launched.
Native ordinary consumption, native MENU closure and route/control access remain
unproved by this run; the result is a tested correction of the first new
integration defect.

## Retained closure and prerequisites

Read predecessor commit `3fceceb34` and its retained `compound-v3.cjs`,
`browser-run-v4.cjs` and `corrected-runtime-pins.json`. The old original and its
command 28 UNKNOWN remain closed and unchanged. The corrected driver retains
its separate 4,500-ms transition gate and command window, immutable overall
bound, <=250-ms freshness requirement, temporal image pair and independent
per-DOWN and overall releases. No identity, freshness, deadline or UNKNOWN gate
was relaxed here.

Before allocation, all **757 inputs** were read from their exact providers and
checked for size and SHA-256. Published source is
`49874a81c5ae180c20a15c6bb169d9041f028cae`; its compiled module provider remains
`scratch/runs/20261108-recoil-native-hud-gate/published.wasm`, SHA-256
`6cf120d0d3b3db1823a8105eb26ef52a9093a7f871c37a46117475e213fda1c0`.
Peer WIP was excluded. `closure-check.json` records the input checks and
path/size/hash references for the retained seven timing/native-image cases and
six full-browser controls, which were reused without repeating those suites.

`source-identity.json`, `relevant-source.patch`, `owned-inputs.patch`, the retained
Wininit patch and `media-recovery.json` provide exact Git, binary-diff, small
run-input patch and existing media path/hash recovery. No source/media archive,
media copy into evidence, production emulator edit or production build is claimed.

## First new defect: launch envelope omitted the manifest

The fresh box was identified as **`bx_hxwp9ns7`** before runtime launch. Its
launcher verified all 757 remote input bytes and started exactly one Node
process, PID **6218**, at **09:27:08.518Z**. That process exited in
`hermetic-modules.cjs` before the browser entry could create its output directory:

```
ENOENT: .../20261108-recoil-hermetic-native-objective/repaired-runtime-pins.json
```

The corrected closure stages `corrected-runtime-pins.json`. The retained
preloader chooses `process.env.PIN_FILE` or the older
`repaired-runtime-pins.json`. The six retained local browser controls supplied
`PIN_FILE`, while the adapted original launcher supplied only `BROWSER_DEADLINE`.
Thus exact input hashes did not establish that the launch envelope selected
those inputs. This was a demonstrated launcher integration defect, not a native
Recoil HUD/Resume failure or a missing pngjs dependency.

The readiness waiter ended at **09:27:34.451Z** with `not ready`; the recovered
runtime stderr supplies the earlier cause. `ready-remote-result.json`,
`first-boundary-inspection-remote-result.json` and
`recovered/runtime-first-browser.log` preserve both observations. The launcher
parent record is retained separately. No Chrome process, profile, browser output,
CDP/HTTP port, input command, native startup or gameplay DOWN was created. There
was no second original, retry, old-box resume/delete, attack, guest write, private
handler, forced scene/configuration/clock/seed or public deployment.

## Tested launcher correction

New run-specific **`launch-v2.py`**, SHA-256
`3016452798237b004f5963536635b52dc37b5aee7e5b5523ee2d4938fa787c92`,
uses one environment construction function for
preflight and execution. It resolves the explicit corrected manifest, replaces
ambient manifest/fixture selection, and passes the selected absolute `PIN_FILE`
to the real hermetic preloader. Preflight requires the actual transitive
`hud-phase.cjs` decoder in a separate Node process before creating Chrome or
browser output. The original launch path still verifies every pinned byte and
refuses an existing launch parent or original output. The retained browser,
compound driver and failed original launcher remain unchanged.

`launcher-browser-check.cjs`, run under `/tmp/wine-runtime.lock`, tests this
launch envelope through the unchanged full v4 browser entry. An intentionally
wrong ambient `PIN_FILE` is replaced by the explicit corrected manifest. The
positive preflight passes; a manifest missing pngjs rejects with
`UNSTAGED_MODULE pngjs` before browser output exists. Then the corrected launcher
runs **one generated `native-boundary` fixture**, using the retained native
images and published-source reader. This is a focused check of the new launch
integration, not another Recoil launch or a repeat of the accepted six-case suite.

`launcher-qualification.json` records:

- Temporal HUD qualification at **3,550 ms**, sample age **42 ms**.
- Trusted generated-fixture C DOWN at 3,551 ms, independent UP at 3,631 ms.
- Trusted Up DOWN at 3,637 ms, independent UP at 5,639 ms.
- Overall Escape DOWN at 5,753 ms and UP at 5,834 ms; all fixture keys released.
- Exact compound/quit ACKs, launcher exit 0, Chrome exit 0, Chrome PID absent,
  HTTP/CDP ports **42189/38647** closed, profile and writer absent.

No original-game native consumption or visible native MENU is inferred from
these generated events. The first original did not reach Software/user/Medium
startup, native pause or Resume. Therefore this run supplies no new native menu
versus active-time measurement. The previously resolved 1.1 power-control
briefing/map and 1.3 rocket briefing were not cycled again; loading, briefing,
map and inventory are not treated as pause.

## Retrieval and normal shutdown

All **20 remote file references / 377,181 bytes / 20 unique SHA-256 values** were
matched to retained local inputs or retrieved, then independently read and
rehashed before shutdown. Only the new runtime stderr and launch-parent record
needed downloading; staged small inputs are referenced at their existing paths.
`terminal-inventory.json` proves PID 6218 absent and original browser output
absent. There were no remote browser profiles, writers or runtime ports to drain.

The detached supervisor, normal-stop child and independent **25-minute watchdog**
were observably armed at **09:26:36.7Z**, before the UUID-idempotent allocation.
The immutable watchdog deadline was **09:51:36.777Z**; initial box expiry was
**09:52:37.333Z**. After verified retrieval, normal delegated shutdown archived
`bx_hxwp9ns7` at **09:28:33.571Z**, expiry **null**. Receipt
**`stop_1fa5dab2f10aeb38`** completed **09:28:33.590Z**, forced false, error null.
`final-stop-receipt.json` retains the independently inspected final state.
Normal and watchdog children exited 0; supervisor ended with no children. Local
fixture launcher, Chrome, ports, profile and writer are drained and the runtime
lock is released. Disk remained above 5 GB (approximately 12 GB free).

## Remaining work

The next original requires a new authorization and must use the corrected
manifest-bound launcher, with its preflight checked before allocation. No further
original is proposed as part of this task. The native acceptance sequence remains
fresh temporal HUD before C/ordinary consumption, independent releases and actual
visible native MENU, then separately bounded reviewed movement toward ramp/control
access. Attack requires a visibly actionable identified target. Objective
completion, full27, parity, audio and simulation FPS remain open.
