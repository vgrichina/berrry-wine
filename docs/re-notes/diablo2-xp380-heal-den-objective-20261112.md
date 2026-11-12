# Diablo II: native Akara heal, Den death, no verified monster progress — 2026-11-12

The unchanged authentic XP380 four-file checkpoint loaded and moved normally. Native Akara interaction healed SAMEHERO from life27/55 to **55/55**, with XP380 unchanged. The character then entered the Den of Evil and attempted ordinary axe combat, but was killed by a Gargantuan Beast. **No XP increase, monster kill, remaining-monster count, or quest completion was verified. The Den remains uncleared.** This is a concrete failed combat attempt, not an improved Den checkpoint.

Evidence is in `scratch/runs/20261112-diablo2-xp380-heal-den-objective-1340/`, principally `RESULT.md`, `RECOVERY.md`, `final-audit.json`, and the hash-indexed compressed outputs. This follows [the XP380 handoff](diablo2-current-den-quest-20261112.md), including commits `4b5002933` / `00aea67f3`. Source baseline was `00aea67f31e9f15544b2c2e5e6ac4e4a449f99c6`. No production code changed.

## Checkpoint and native observations

All four files came together from `scratch/runs/20261112-diablo2-current-den-quest-1250-attempt3/earned-save/`. Their SHA-256 values were checked before staging and again after the run; the original files remain unchanged. No saves were mixed.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| samehero.d2s | 757 | aeb8be30f2b41580c690eb667603dc36a7de2691df8fab3d215f3b3a2f1cdbb9 |
| samehero.key | 902 | 29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6 |
| samehero.ma0 | 7972 | 89411738bb0ce6834ab6144fd20cd82a992dd6839dd77ceba3bc49bb68204dd2 |
| samehero.map | 24 | 95e612334f4a2b74e6f5c4d300bfd29ddd5c29bc634bb113173c91215d04ae82 |

Fresh full frames were individually reviewed before each native action. Initial native character, inventory, quest, and movement observations confirmed level1, XP380, next level500, Vitality25, life27/55, gold3, axe/shield, and “Kill all the monsters in the Den.” Read-only save decoding gives initial life27.14453125/55. The stylized **5** must not be read as **6**: maximum life is55, Vitality25, next level500.

Key full frames in the recovered `webgl/` namespace:

- `akaraarrive.png`: native AKARA Talk/Trade/Cancel menu, full red life globe. `healedstats.png` at13:48:38Z independently confirms life55/55, XP380. No purchases or resource writes.
- `bloodmoorroad.png`: native Blood Moor entry. A tan map symbol was initially misread as the cave; fresh automap review and historical reference corrected the route. Historical images were never represented as fresh frames.
- `frontsettle.png` at14:03:15Z: “Entering The Den of Evil.” `denbaselinestats.png`: XP380, life35/55 after outdoor pursuit.
- `denzombieattack.png`: ordinary axe-target click and a prone body. **The body is not evidence of a kill**: `denearnedstats.png` at14:05:08Z still shows XP380, life21/55, with the large beast adjacent.
- `dangerclose.png`: life7/55 while the short Escape transition was pending. `dangercloseview.png` at14:06:05Z explicitly states “samehero was slain by Gargantuan Beast,” “YOU HAVE DIED,” and “Press ESC to continue.”

Review/command delays while live combat continued contributed to an unsafe combat cadence. No guest health, XP, quest, resources, clocks, map, or forced calls were changed. No kill or quest consequence is inferred from animation or a corpse.

## Separate death-outcome save

Native Escape continued to camp empty-handed. Native Save & Exit returned to the title screen (`outcometitle.png`,14:07:16Z); the read-only HTTP/VFS exporter then retrieved the complete four-file outcome. This is retained separately as `outcome-save/`, **not promoted over the starting checkpoint**.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| samehero.d2s | 769 | e5671d873993b1c9736d93c2f7e08bd16ad433fd0e163c08372be36a13e6e215 |
| samehero.key | 902 | 29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6 |
| samehero.ma0 | 8108 | 46ab80007a5cda0c813b50351f94ed8a2097fce6c9b0d32ae5883c34834457c1 |
| samehero.map | 24 | 95e612334f4a2b74e6f5c4d300bfd29ddd5c29bc634bb113173c91215d04ae82 |

Native Single Player / existing SAMEHERO / OK loaded this outcome in the same session. `outcomeloadsettle.png` shows camp and a corpse; `outcomestats.png` confirms level1, XP380, life55/55, unarmed damage1–2. Read-only decoding agrees. `outcomequestsettle.png` still says “Kill all the monsters in the Den.” Outcome gold was not independently inspected; its absent decoder field is not a native gold observation.

**Fresh movement after this outcome normalLoad was not verified.** I supplied the final movement click using `x/y` rather than the required `point:[x,y]` format. Browser validation rejected command84 with `AssertionError: point` before input, made the command terminal, and closed Chrome. The action was not replayed. `failed-command-30063-actual.json`, `webgl/first-browser-failure.json`, `webgl/first-failure.json`, and `webgl/transport-closed.json` preserve the actual failure. This is my malformed control request, not a Diablo II crash or a SaveExit recurrence. No production patch is proposed.

## Integrity and shutdown

Current module04 remained `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`; all524 runtime/helper/media pins passed remote verification before launch and after closure. Original media was referenced by path/hash, never archived. Corrected staged imports, actual requester/consumer key forms, and retained-command envelope tests passed, including delayed ACK, API1..600 bounds, same-operation observation, and no submission replay. Successful native receipts are ACK0..83. All85 recovered PNGs passed chunk CRC and image-stream decoding. Latest pre-failure native evidence contains37 balanced trusted mouse down/up pairs and30 balanced trusted key down/up pairs. The final invalid request never reached input.

Recovery retained922 references /752 unique compressed contents, hash-verified individually. Duplicate full-frame review copies were removed only after matching recovered SHA-256. Transfer packets were excluded because their exact members, delivery encoder source, and original packet receipts remain available. `source-commit.txt`, relevant tracked diffs, and `relevant-untracked-source.patch.gz` preserve source recovery without a source-tree archive.

The passive pre-detach observer recorded no `FIRST_NATIVE_PRE_DETACH` event. SaveExit completed this time; the earlier lifetime/SaveExit cause remains unresolved. All worker/lifetime/custody evidence is retained without attributing a causal fix.

Private box **bx_ye32jjw7** had an independently prearmed55-minute watchdog, initial expiry **2026-11-12T14:32:37.938Z**. Chrome exited0 at14:11:19.970Z. The remote actual parent waited exit1 for the validation refusal and joined both EOFs; kernel custody reaped **351/351**, with no remaining/unreaped/unresolved processes. Provisioning's actual local parent waited0 with both EOFs.

The local start exec later returned143; `manager-parent-wait.json` and `watchdog-actual-wait.json` were not produced, so a clean joined local manager/watchdog completion is **not claimed**. The watchdog did write its terminal confirmation. A fresh lifecycle-only caller performed the delegated normal stop after hash-verified recovery. Final state **archived**, expiry **null**, stopped **2026-11-12T14:12:32.291Z**, receipt **stop_cc4beb5e7e58dfc9**, completed, forced=false, error=null. No inherited box was touched. Shared disk headroom fell below1.5GB by final checks; this was reported on the board and no further gameplay was attempted. This run does not claim continuous disk-floor compliance.

Next: restore shared disk headroom before allocating. A fresh run should use the unchanged original four-file XP380 set, individually reverify stats/quest/movement, heal natively at Akara, then attempt short, closely observed combat with immediate retreat before life is exhausted. The death-outcome set is evidence, not a replacement continuity checkpoint. No new Den progress is claimed.
