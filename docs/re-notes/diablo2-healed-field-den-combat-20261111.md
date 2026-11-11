# Diablo II: Den entry, combat, and retained XP401

Run: `scratch/runs/20261111-diablo2-healed-field-den-combat-1950/`.
Original single-player SAMEHERO advanced from XP296/life66 to XP401/life66
through native navigation, melee combat, Akara healing, two SaveExits and
three normal Loads. Den of Evil entry and its active quest were visibly
confirmed. The Den is **not cleared**.

## Exact starting fixture

Restored the complete parent `20261111-diablo2-native-saveexit-worker-wait-1910/field296-save/`
four-file set to native `c:\save\`. Starting D2S is 753 bytes, SHA256
`e51c394a482f65de379192b28bf5de45bea1798ac37537f56a42c1e0eec17fd9`.
The first native character panel confirmed XP296/life66.

The standard repaired module is SHA256
`1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`,
with matching source/host closure `7c985edcc8eb8c23e7f2b64ba8b0d6f2eb177bad`.
Start checkout HEAD was `e3f0074f494c23181f927ea2cf20a3fa6dc5adf8`.
All 616 final runtime pins passed after browser shutdown. No shared runtime
code, game media, guest memory, save bytes, map bytes, or game configuration
was edited to obtain progress. Native menu assistance used balanced input.

## Route and visible results

Exit camp through the torch lane into Blood Moor. A northward detour inside
camp reaches the enclosed waypoint instead of the exit. In Blood Moor,
follow the automap's purple cave marker northwest. Quill Rat combat raised
the native XP readout to 317; two further zombie corpses were visible en route.
Approach the cave from its south side, between the entrance torches. Clicking
above the cave can path the hero behind its northern rocks.

`review/denenter.png` shows “Entering The Den of Evil”. `review/denquest.png`
shows “Kill all the monsters in the Den.” Moving southwest off the steps,
then west, exposed Fallen and a shaman. Native targeted melee was visible;
health fell to 19/66, so SaveExit preserved the earned progress before death.
After normalLoad, `review/retainedstats.png` shows XP401/life19 and
`review/retainedquest.png` shows the active Den quest.

In camp, moving southeast around the low wall reaches Akara. Native
interaction healed the character. A second SaveExit and normalLoad yielded
`review/finalstats.png` (XP401/life66) and `review/finalquestsettle.png`
(active Den quest). NormalLoad starts in camp; no retained cave position or
persistent enemy corpses is claimed.

## Complete continuation checkpoint

Use the run's entire `final-save/` directory, verified by
`final-save-manifest.json`, as one set. Do not mix members with older saves.

| File | Bytes | SHA256 |
| --- | ---: | --- |
| samehero.d2s | 753 | `9c9d57b242ac2ccd9f4cd15fa4dc947eecca29544ca7f0a5187c7b3359426d21` |
| samehero.key | 902 | `29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6` |
| samehero.ma0 | 7874 | `87c92247287765356ee4139f9406d0056dbb4fc78235a1c2c225eb47e9c257b3` |
| samehero.map | 24 | `95e612334f4a2b74e6f5c4d300bfd29ddd5c29bc634bb113173c91215d04ae82` |

The preceding `den383-save/` directory name was provisional: its actual
native readout is XP401/life19, not XP383. Prefer the healed final set.

## Failure observation and limits

Passive synchronization and pre-thread-detach observers were armed on all
three guest workers. Both gameplay SaveExits completed; healthy snapshots
are retained as `exitsnapshot.json` and `healthyexit.json`. The original
Storm job-completion event stall did not recur. These successes do not prove
a causal repair, and the streamed DirectSoundBufferLock object's lifetime
and any relationship to the inherited wrapper repair remain unproved.

The first actual browser session was closed by Escape at the splash screen;
its exit was verified before a fresh session restored the same fixture.
Two earlier launch attempts failed pin checks before browser dispatch.
No unacknowledged mutation was replayed. Completed full images were reviewed
before dependent gameplay input. One cave capture was displayed while its
download command was finishing, then awaited and re-reviewed before input.

Next: restore the complete healed XP401 set with this exact runtime, enter
the Den again and clear remaining enemies while managing health. No causal
runtime fix is justified by this run.

## Evidence and shutdown

`FINAL-AUDIT.json` verifies 1,088 recovered references / 976 unique contents,
92 complete PNGs, 91 exact command acknowledgements, eight checkpoint files,
and trusted balanced native input (67 mouse pairs, 13 key pairs). The independent
watchdog exited unfired with actual supervising wait and EOF. Chrome and its
controller both exited code0, with their recorded PIDs absent.

Box `bx_vf93m2hx` was normally archived at 2026-11-11T20:38:03.215Z,
before its original 21:17:59.904Z expiry. Stop
`stop_b4a806dc70db3a6c` completed nonforced with error=null; an independent GET
confirmed archived state and archiveAfter=null. No live runtime is handed off.
Recovery and source reconstruction instructions are in the run's `RECOVERY.md`.
Only this note changes tracked content; no runtime build or repair is claimed.
