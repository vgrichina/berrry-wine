# Heretic II southern platform: original health1855 continuation

Run: `20261111-heretic2-health-southern-action-platform-1935`.

The elevated Action trigger was not reached or activated. No new platform or
west-door state was saved. Two exposed courtyard attempts ended in native
`Corvus died`; the final health1855 recovery sequence displayed `Server
connection timed out.` after `Loading player` and did not establish standing
gameplay or ordinary movement. This is the concrete new Load blocker, not proof
of checkpoint corruption. Two earlier health1855 Loads and subsequent ordinary
movement worked in this run.

Read-only original map inspection corrects the destination: entity176, model
`*55`, is `trigger_playerpushbutton`, target `ash`, bounds
`[1648,272,128,1688,304,192]`. Entity166, model `*45`, is the matching button
with targetname `ash`, target `kelson`, bounds
`[1656,256,160,1672,264,176]`. The chain continues through `patty` to the west
door. The x1240–1248, y288–448, z0–112 brushes are west-door geometry, not the
Action trigger. The platform top is z128 over x1600–1696, y256–480; the health
corridor runs beneath a z112 underside. Local coils are `obj_ropechain`.

The route exited the health passage south of y384 before strafing into the
courtyard. Strafing inside the corridor around y405 encountered its wall.
Run/jump/Action combinations from the west did not establish ascent; an
isolated jump trial was under the southern arch and does not measure open-air
jump height. Full native coordinate readouts, corrected using enlarged images,
were `(1681,465,34)` facing25.00, `(1422,182,34)` facing41.38, and
`(1646,405,34)` facing105.25. Intermediate displacement estimates are not
coordinate evidence. The first facing had previously been misread as -25.00.

Native controls used arrows, comma/period strafe, Ctrl attack, Space Action,
A jump, and Shift run. Read-only defaults also show double DownArrow bound to
`+quickturn`; a specific unexpected turn was not causally attributed to it.
Native Pause assistance used balanced key releases and separate completed
image inspection; host hold durations are not guest simulation time. Flying
Fist selection was visibly confirmed before one exposed attack attempt. The
projectile source remains uncertain. Original map actors include elevated
plague elves 537/538 and spawner 284, but proximity does not establish causality.

All four final resident health1855 files match the original manifest. The
original gate1640/gate1810 input sets also remain exact. No game, map, script,
config, or save bytes were patched. All 2,461 pinned runtime files passed their
final audit. The loaded runtime was commit
`0db20330ccd6761a705eea70c5dd9bfc7704c147`, WASM SHA-256
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`.
The existing locked build proof was reused; no shared implementation changed.
`paused-cycle.test.cjs` and `helper-regression.cjs` passed with actual waits/EOF.

Evidence is in the run's `RESULT.md`, `RECOVERY.md`, `validation-current.json`,
and `final-recovery-local-map.json`: 835 raw references, 647 unique hashes,
87 validated PNGs, 85 image/module bindings, 85 exact ACKs, 14 balanced Pause
cycles. `software2/finalbounded.png` shows the Load timeout. The map and native
configuration analyses were read-only. No Save/Load retention of new platform
or west-door progress is claimed.

Private box `bx_3sfdp3uh` was normally archived at 20:09:42.369Z, before its
initial 20:17:47.703Z expiry. Stop `stop_7b90a265ba3c96b0` completed, nonforced,
error null; independent state verification agrees. Browser/controller and
watchdog have actual zero-exit wait/EOF receipts; the fixed watchdog did not
fire. Unique evidence was retrieved and hash-verified before shutdown.

Next: restore the unchanged health1855 files in a fresh bounded runtime and
verify standing/movement before another courtyard attempt. Establish a
reachable ascent to the actual elevated trigger through original controls;
then activate it and test native Save/Load plus ordinary movement. The latest
failed recovery cannot serve as a live handoff.
