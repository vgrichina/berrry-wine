# Disciples II: ordinary battle outcome and map return, 2026-11-07

**Reviewed victory, XP reward and return to the ordinary map.**
Evidence: `scratch/runs/20261107-disciples2-battle-outcome/`.
The accepted first-combat result at `6d3d3228b` and movement at `609351224`
remain accepted. This fresh run adds the completed battle; it changes no
production code, helper semantics, game media or guest configuration.

Registered `disciples2_demo` used the complete original installation and
manifest. The retained executable, manifest and all 127 support-file hashes
matched before launch. EXE SHA-256:
`adba242a0a3563651baffa6ec7d9a6c0978b7ae844a1cccedb2a1f4e8eb7b1f8`.
The ordinary route was New Quest / The Search for Timmoria / Undead Hordes,
unchanged lord/difficulty defaults, day 1, default Huun'reh, five individually
reviewed story confirmations, Tab leader selection, plotted/confirmed eastward
movement (20/20 to 16/20), and plotted/confirmed northeast approach. The lord
chooser was not captured visibly in this run: captures retained the race scene,
and subsequent Enter reached the quest intro. Thus the intended retained
Warrior/Average defaults were left unchanged, but this run does not independently
visually certify their chooser labels.

Battle appeared during northeast movement, without a sidebar/day-control click.
A separate passive capture established the battle before the first attack.
Each deliberate attack used a newly captured, personally inspected battle UI.
Five ordinary trusted clicks targeted the upper peasant, lower peasant, then
the remaining hooded Thug three times. Passive captures separated the turns.

| Reviewed checkpoint | Huun'reh HP | Opposing roster HP | Visible consequence |
| --- | --- | --- | --- |
| battle-before | 150/150 | 40/40, 65/65, 40/40 | Active leader ring |
| turn-two-before | 130/150 | 0/40, 65/65, 40/40 | First peasant skull; leader active again |
| turn-three-before | 102/150 | 0/40, 65/65, 0/40 | Second peasant skull; leader active again |
| turn-four-before | 72/150 | 0/40, 65/65, 0/40 | Thug HP unchanged after previous action; leader active again |
| turn-five-before | 45/150 | 0/40, 12/65, 0/40 | Thug reduced to 12 HP; leader active again |
| battle-outcome / accept-reward | 12 HP remaining | 0/40, 0/65, 0/40 | Three corpses/skulls, surviving leader, XP +25 reward |

The later `return-to-map.png` is still the reward scene: its bottom HUD reads
**HP 12/163**, **XP 342/360**, alongside XP +25. This distinguishes the later
HUD from the earlier 150-HP battle checkpoints; no cause for the maximum-HP
change is established. The filename alone does not establish map return.

Health was rechecked using magnified crops of the retained originals. These
correct the immediate commentary/admission annotations that read 123 for the
first response and 130 for the second; the evidence shows **130 then 102**.
The historical accepted run's 123 HP remains its own result. No damage formula,
hit/miss mechanism, regeneration or deterministic parity is inferred here.

The bottom combat arrow and Enter did not dismiss the reward screen. The bright
round roster control toggled back to the enemy roster, confirming all three
skulls. Ordinary **Escape** then returned to the map. `battle-exit.png` and
`resulting-map.png` show the selected surviving leader displaced northeast,
Move **0/20**, a red health portrait, nearby buildings and still-visible pale
creature ahead. This is completion of the encountered human trio, not a claim
that the pale creature or quest was defeated. No additional map loot is claimed;
the observed reward is the battle's XP +25 display.

## Runtime and controls

Tested source commit: `3375c2476e4d91c809fec75ea1b2496c7c82deb6`.
`runtime-pins.json`, `relevant-source.patch`, `new-files.patch` and
`final-run-inputs.patch` preserve exact source identities and relevant dirty/new
hunks; Git is the source archive. All **764** staged pins matched before launch
and after browser completion. The actual live Worker module was recovered:
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.

Chrome 151.0.7922.108 / V8 15.1.206.16, Linux headless Chromium, Threads,
1024x768 document, 800x600 canvas. Per-capture bindings preserve document epoch,
live process/link/Worker/module, page-renderer and canvas objects. Passive final
evidence establishes **Win98Renderer / CanvasRenderingContext2D**, empty D3D
stats and no D3D render ports. The WebGL selector is not acceleration evidence.
No audio, FPS, mobile/WebKit or cross-device parity claim is added.

The existing helper passed actual Chromium synthetic controls before the
original: live binding, five zero-effect owner replacements, stale and slow
capture rejection, balanced trusted keys, physical key state and execution
progress during a hold, independent release under slow sampling, partial release,
sticky UNKNOWN and late-ACK rejection. No old input/logger repair was repeated.
No emulator divergence was established and no engine fix was made. All 39
numbered original commands, including quit, have exact successful ACKs; no
UNKNOWN outcome was replayed. Early read-only readiness checks used an obsolete
log filename or preceded startup completion; those failures and corrections are
retained, with no duplicate browser launch.

## Recovery and lifecycle

One UUID-idempotent fresh box: **bx_yhk249s8**, created 08:58:30 UTC, initial
expiry 09:33:30.073 UTC. One heavy original browser ran, approximately
08:59–09:07 UTC. Browser.close returned exit 0 with no signal; final key bitmap
was clear, 12 owned PIDs disappeared, both ports refused connections, and the
profile and writer lock were absent. **426 remote artifacts / 26,149,917 bytes**
were retrieved and SHA-256 verified before the explicitly delegated normal stop
request at 09:08:10.111 UTC. Final state: **archived**, stop **completed**, forced
**false**, expiry **null**, stopped 09:08:10.420 UTC. No box was resumed.
Local free disk was 2,525,720,576 bytes at the stop boundary. No source/media
archive or public deployment was created. Box custody returns to the coordinator.

The requested battle outcome and resulting scene are complete. Further quest
progress would require a separately assigned run; the existing audio/FPS/parity
limits remain.
