# Diablo II XP401: fresh four-file checkpoint qualified; navigation stopped at stale review

The complete XP401 checkpoint from [the 1540 native combat run](diablo2-native-menu-short-combat-20261112.md) (`0df107e3b`) passed an independent export review and a genuinely fresh browser's normal Load, native stats, Den objective, and fresh movement. Further navigation remained inside Rogue Encampment. No new monster, kill, loot, XP gain, level, or quest consequence was established. There is no successor earned save from this run; the qualified XP401 four-file checkpoint remains the continuation point.

Evidence lives in `scratch/runs/20261112-diablo2-xp401-fresh-load-den-1615-attempt2/`; the separate, failed pre-Chrome preparation is retained in `scratch/runs/20261112-diablo2-xp401-fresh-load-den-1615/`. These are private ignored evidence directories, not source archives. Actual original media and module04 were used. Frozen source was `a04a489fc677073dbb569f6aad4efbfbca558318`, with `relevant-source.patch` and `relevant-untracked-source.patch.gz`. The executed module SHA-256 was `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`; original EXE SHA-256 was `d0aa0d30b55f8313e04026cca560ef0d178ee76b2ece6c3ccdc1fca4af46b3f1`.

## Whole checkpoint and fresh qualification

`parent-export-review.json` independently recovered the original 1540 VFS export and compared all four local checkpoint files byte for byte with its four rows. The unchanged files were then mounted together, with no XP380 parent or 1340 death-outcome files mixed in:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| samehero.d2s | 757 | `8a55786b1923052f7a1775e87c0b1f8be29d9faf6b601648eea9ee412457b504` |
| samehero.key | 902 | `29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6` |
| samehero.ma0 | 7972 | `89411738bb0ce6834ab6144fd20cd82a992dd6839dd77ceba3bc49bb68204dd2` |
| samehero.map | 24 | `95e612334f4a2b74e6f5c4d300bfd29ddd5c29bc634bb113173c91215d04ae82` |

The actual startup reader passed complete/missing-manifest/missing-dependency controls before allocation; missing data caused zero browser/input effects. The corrected HTTP verification pins cover the same four manifest mounts. Local staged-data/import checks, point `[x,y]` action-shape controls, and the unchanged export-reader seam passed. Envelope controls are identified as inherited hash-identical controls rather than falsely claimed fresh executions. `final-runtime-verified.json` verifies all 523 staged runtime/helper/media/save pins unchanged at recovery.

The first box did not create Chrome: stale copied HTTP verification metadata still referenced a 1250 save URL, producing a 404 despite the correct four-file manifest. That attempt was terminal, recovered, and stopped. The second run corrected the metadata and passed the full pre-Chrome checks before allocating a new box.

Fresh full frames in the second run establish:

- `menuwait1`: logo/loading, no input. `menuwait2`, 16:21:19Z: actual native SINGLE PLAYER menu before the first input; no Escape at the logo.
- Native SINGLE PLAYER, existing SAMEHERO selection, and ordinary OK Load reached camp.
- `statssettle`, 16:23:07Z: level 1, XP401, next level 500, vitality25, life53 of55, stamina91, mana10. The font's stylized 5 must not be read as 6.
- `questsettle`, 16:23:45Z: Den of Evil says “Kill all the monsters in the Den.” It remains uncleared.
- `freshmovement`, 16:24:14Z: changed player pose and camp scenery after new ordinary movement input, followed by further camp movement.

Recovered full keyframes are also materialized under `keyframes/` for direct review. Original recovery references, raw sizes, hashes, and exact compressed content remain in `recovery-map.json` and `recovered-unique/`.

## Actual stopping cause and limits

Navigation explored timber corners near the waypoint and forge, returned through the cart junction, and reached the southern campfire area. It did not establish a Blood Moor exit or any hostile encounter. The character's life globe remained near full; healing and combat were not reached. This is unsuccessful navigation, not evidence of a game-world or runtime defect.

The last successful capture was `southernbranch` at 16:55:39.273Z. Command83, `southcampfollow`, arrived at 16:57:40.114Z: roughly 120.8 seconds later, exceeding the chain's 120-second review limit. `webgl/first-failure.json` records `Error: stale scene refused`; `first-browser-failure.json` locates it in `fresh()` during admission, before dispatch. There is no command83 admission, input pulse, or successful acknowledgment. This was an operator stale-review failure after the long inspection/context gap, not a guest crash. It was not replayed. Future continuation must obtain and inspect a new full frame after a long gap before submitting input.

The terminal path closed Chrome with exit0 and ended the browser/outer run with the expected failure status1. No later ordinary quit or native SaveExit was possible on that closed chain. The terminal close intentionally omitted the final global native-input read; accordingly this run does **not** claim a complete all-event trusted/balanced input export. Its 54 individual physical input pulses each show prearmed release and acknowledged DOWN/UP. The final refused command produced no pulse.

`final-audit.json` passed the bounded evidence checks: 874 references / 706 unique recovered contents, all raw hashes and sizes verified; 84 full PNG CRCs and 18 identity fields matched across each capture; command0–82 acknowledgments and local receipts matched; all 54 pulses released; all four XP401 parent files remained unchanged; all 338 tracked processes were reaped, no remaining/unreaped/unresolved ptrace entries, and actual outer wait/EOF with all children joined. This audit accepts the explicit terminal failure; it does not convert it into a gameplay pass. No pre-detach diagnostic events were observed. Minimum sampled pre-action free disk was 1,634,852,864 bytes, above the 1.5GB floor; no RAM gate was used.

The local starter returned143 and no `manager-parent-wait.json` was produced. Its cause is unknown and is retained as a lifecycle observation gap. The independent watchdog's actual wait did return0 with both EOFs, and the manager issued the delegated normal stop after verified retrieval. Do not describe the missing starter/manager observation as a clean all-zero lifecycle.

## Box closeout and continuation

Both created boxes are stopped and archived, with expiry cleared (`archiveAfter: null`), completed stop status, `forced: false`, and null error:

| Box | Archived at UTC | Stop receipt |
| --- | --- | --- |
| `bx_k2kjh9m9` (pre-Chrome failure) | 16:18:42.500 | `stop_7508175967992c7c` |
| `bx_s7sdv53c` (fresh qualification) | 16:58:12.749 | `stop_ce01da9986fcaeb1` |

Independent observable deadline watchdogs were armed before each allocation. Unique evidence was recovered and hash-verified before each normal stop. `stop-confirmed.json`, final GET state, and watchdog records preserve the receipts. No boxes were resumed or deleted.

Next: continue from the now fresh-browser-qualified **1540 XP401 whole four**, preserving the separate 1250 XP380 parent and 1340 death outcome. Find the actual exit using current full frames, then one short closely observed encounter with safe retreat. Only native visible XP/quest/level consequences can justify a new earned SaveExit/full export/normal Load/fresh-movement qualification. No production source change, build, public deployment, guest-state write, replay, worker, or new save claim was made in this task.
