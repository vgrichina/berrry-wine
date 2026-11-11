# Heretic II low passage and raised gate crossing, 2026-11-11

Corvus crossed the low timber passage and the raised inner gate using the
original game controls. Native `save gate1520` then reported “Saving game...”
and “Done.” in the boat/rope chamber beyond the gate. The checkpoint's four
original files were exported and hash-verified. **Playable movement after
loading this new checkpoint remains unproved.** One fresh native load ended
with explicit “Corvus died.” and a visible green projectile; its source is
unresolved. A second recovery load showed standing Corvus at the saved
position, but the fixed runtime cap ended the session before a movement
capture. Do not describe this slot as a proven safe resume point.

Evidence is in the ignored run
`scratch/runs/20261111-heretic2-native-crouched-passage-gate-1520/`.
`RESULT.md`, `final-recovery-local-map.json`,
`beyond-gate-checkpoint-manifest.json`, and `validation-final.json` provide
the recovery recipe, hashes, scope and limitations.

The exact gate1435 files were restored from the parent's final recovery
map, with gate1315 retained as fallback. A native game session was initialized
before loading. Backward movement after native `load gate1435` visibly
changed Corvus's position relative to the pillar and wall. Staff combat
subsequently left a fallen, dismembered pursuer and grounded weapon; earlier
blood and attack poses alone were not treated as kills.

The successful passage heading ran along the plaster/timber wall toward the
bonfire courtyard. Crouched forward and left strafe, using shipped `m`
(`+movedown`), cleared the right-wall obstruction. After crossing the courtyard,
native run/jump/Action cleared the second arch. Several early panel attempts
were too far away or misaligned. Left strafe finally centered the panel and
produced the native “Press ACTION to use buttons and levers” hint. A fresh
Space hold of 1500 ms, followed by an empty bounded live interval, changed the
panel center to orange and visibly raised the gate. Right strafe centered the
open lane; forward running crossed under its teeth. Further right alignment
and forward running cleared the far arch and reached the stone wall beside
the rope coil, where the native checkpoint was written.

All gameplay used disclosed native Pause assistance: physical NumLock maps
through the retained host's Set-1 0x45 translation to the shipped Pause bind.
The bounded helper resumed, sent ordinary controls, actually released them,
requested native pause, and passively settled before full-image inspection.
There was no guest memory, script, map, config, cheat or save edit, and no
host-clock freeze. The 57 recorded cycles had declared action holds of
500–3500 ms and host request-completion spans of 670–3682 ms. Those timestamps
do not measure guest simulation duration or exact pause transitions. Native
banners establish observed pause bounds. Every dependent action followed a
separate inspection of its actual full image.

A material controller error occurred after the first normal-load movement
attempt: an uppercase capture label failed validation after the bounded input
had completed, so there is no resulting movement image. Actual balanced key
releases were retained. Browser.close exited Chrome with code 0; that
controller exited 1. No uncertain input was replayed. Independent process,
profile and port absence was established before a fresh browser was started.
A local label check now rejects this case before request publication, and its
focused regression passed. The later attempted pause after the fixed runtime
cap found the profile absent and delivered no input.

The retained source pin was `0db20330ccd6761a705eea70c5dd9bfc7704c147` and
the actual Worker module was
`ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`.
Matching locked-build evidence was rehashed, 3396 provision pins matched,
and all 2461 runtime pins still matched after gameplay. No shared emulator
code changed. The focused native-pause-cycle tests passed.

All 1192 artifact references, representing 935 unique contents, were
recovered and raw-hash verified before shutdown. An independent remote check
reverified them. Validation passed 107 PNG CRC/IDAT checks, 107 image/module
bindings, 105 exact successful acknowledgments and 57 finite balanced pause
cycles. The final export contains 18 native files; all twelve files in the
three named slots remained exact, including gate1520 across save export and
native loads. Git identities and binary patches preserve source provenance;
media is referenced by canonical path and hash, without a source/media archive.

The final browser/controller exited normally with code 0, actual parent waits
and both EOFs. Independent checks found their PIDs, profile and server port
absent. Private box `bx_fzr967rt` was normally archived at
`2026-11-11T16:05:31.697Z`; stop `stop_7d0e95d8b032120a` completed nonforced
with no error. Independent GET confirmed archived state and null expiry.
Original expiry was `2026-11-11T16:06:14.604Z`. The prearmed independent
watchdog exited 0 unfired with an actual parent wait and both EOFs. No box was
resumed or deleted, no workers were spawned, and nothing was publicly deployed.

Next: restore gate1520 in an initialized native session and establish an
immediate protected retreat/movement proof. Preserve the explicit reload-death
evidence; the new slot may be exposed to an incoming attack. Gate1435 and
gate1315 remain exact alternatives for a safer replay of the now-proved route.
