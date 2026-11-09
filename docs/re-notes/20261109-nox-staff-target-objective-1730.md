# Nox staff target objective: local pin failure, 2026-11-09

Run `20261109-nox-staff-target-objective-1730` stopped at the first local
preflight failure. No new target hit, defeat or objective consequence was
observed. No browser, original guest or box was started.

The starting procedure was the complete retained driver and registered
`nox_demo` route described in
[the accepted equipment note](nox-native-equipment-20261108.md). The prerequisite
audit read all 766 retained pinned files: 732 matched, none were missing, and
34 differed. All 126 Nox media/manifest pins matched, including the separately
loaded EXE. Changed inputs include both built modules and subsequent source
changes; this is an identity mismatch, not missing media or an established
emulator defect.

The unchanged retained `browser-run.cjs` was invoked with `DRIVER_PREFLIGHT=1`
and a valid two-minute `BROWSER_DEADLINE`. It exited 1 at line 9 before the
preflight boundary or any browser startup. Its first assertion was
`build/wine-assembly.compat.wasm`: expected SHA-256
`290d31d0d3dea75c6a8a3a2414916b66df5970c57bc274b7f4ec03589cc8cb70`, actual
`ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.
The driver's own SHA-256 was
`72b2eead63b36ef53fb5e3e1457536eaf1b94d1d0792eb425a3419f6a39c0705`.
Pins were neither rewritten nor bypassed. Actual browser composition tests
were not rerun: the first failure ended execution, and local Chrome was
prohibited. The prior run's tests remain historical evidence only.

Evidence under `scratch/runs/20261109-nox-staff-target-objective-1730/` includes
`prerequisite-audit.json`, `media-audit-summary.json`, `driver-preflight.json`,
raw stdout/stderr and `first-failure.json`. `source-sha.txt` records inspected
HEAD `49066461ef486cb8393c3b896354f7d2006a131e`.
`relevant-source.patch` preserves relevant uncommitted source
hunks and the referenced untracked `lib/wininit-boot.js` as a small patch.
Git remains the source archive; no source/media archive or duplicate media was
created. This change is documentation only; no build or regression pass is
claimed.

The Return Fire predecessor had acquired its runtime lease during local
preparation and had not published its final release when Nox stopped. Nox did
not allocate or attach while waiting. Box ID, state, expiry, watchdog join and
stop receipt for this task are **not applicable: no box created**. No inherited
box was mutated. There was no original input, empty staff shot, configuration
or clock change, public deployment, worker spawning, or interruption/EOF to
interpret. Target consequence, presentation identity and ordinary guest
shutdown remain unverified in this run; no GL/FPS claim is made.

Next work requires a reproducible, explicitly identified input closure that
passes the retained driver's immutable checks (or a separately assigned
adaptation with actual composition validation). This worker preserves the
first failure and stops; it makes no further runtime attempt.
