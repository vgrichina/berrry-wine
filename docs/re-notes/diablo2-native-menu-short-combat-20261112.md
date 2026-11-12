# Diablo II: native heal, outdoor XP380 → 401, whole save and normal Load

2026-11-12. The original Diablo II demo loaded the unchanged qualified1250attempt3 whole XP380 checkpoint. Native Akara interaction healed SAMEHERO from27/55 to55/55. A short outdoor axe engagement then earned **21 XP: native XP380 → 401**. Original Save & Exit returned to the visible title menu; the complete four-file export was retrieved, hashed, loaded normally through existing-character selection, and qualified by native XP401 stats and fresh movement. **The Den remains uncleared**, with “Kill all the monsters in the Den” still displayed after Load.

Evidence: `scratch/runs/20261112-diablo2-native-menu-short-combat-1540/` (R). This follows [complete restore staging](diablo2-complete-restore-manifest-combat-20261112.md), [the original qualified XP380 set](diablo2-current-den-quest-20261112.md), and [the separate prior death outcome](diablo2-xp380-heal-den-objective-20261112.md). No production runtime code changed; publication is documentation only.

## Original startup and control integrity

Source baseline: `dfbb74101addc258bf7e5de49edfe65a2458ec7f`. `source-commit.txt`, `relevant-source.patch`, and `relevant-untracked-source.patch.gz` retain Git identity and relevant patches. Git is the source archive; no source-tree, repeated-media, docs, scratch, or binary archive was made. Original EXE SHA remains `d0aa0d30b55f8313e04026cca560ef0d178ee76b2ece6c3ccdc1fca4af46b3f1`; captured current module04 is `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`.

All523 frozen runtime/helper/media/save pins passed actual remote verification before Chrome and after closure. The actual emitted browser entry synchronously read and verified `restore-manifest.json` and every referenced save before server/Chrome/CDP/input creation. Its returned four mounts were supplied directly to the ordinary launcher. The physical data-stage complete/missing-manifest/missing-D2S controls passed with zero browser/input effects. Imports and the actual VFS Map export fixture passed. Twenty actual requester/consumer shape controls passed, including invalid `x/y` zero effects; native clicks used only finite `point:[x,y]`. No new native action shape was introduced. Hash-identical predecessor21-second ACK / API1..600 / same-operation read-timeout observation / unknown accepted POST no-replay controls were inherited explicitly, rather than rerunning unchanged expensive tests.

Fresh `menuwait1.png` showed the logo; no input was sent there. `menuwait2.png` at15:42:23.849Z showed the actual SINGLE PLAYER menu before selection. Existing SAMEHERO was selected and loaded normally. Initial stats, inventory, quest, map and fresh movement confirmed XP380, level1, life27/55, axe/shield, gold3, and the active Den objective. The maximum55, Vitality25, and next-level500 use the stylized digit5; the font must not be read as6. Inventory also showed two bottle icons, with empty belt slots; neither bottle was used.

All four starting files came together from `scratch/runs/20261112-diablo2-current-den-quest-1250-attempt3/earned-save/` and remain byte-identical:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| samehero.d2s | 757 | aeb8be30f2b41580c690eb667603dc36a7de2691df8fab3d215f3b3a2f1cdbb9 |
| samehero.key | 902 | 29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6 |
| samehero.ma0 | 7972 | 89411738bb0ce6834ab6144fd20cd82a992dd6839dd77ceba3bc49bb68204dd2 |
| samehero.map | 24 | 95e612334f4a2b74e6f5c4d300bfd29ddd5c29bc634bb113173c91215d04ae82 |

No death-outcome file, seed, guest state, health, XP, AI, aim, clock, resource, or configuration was patched. No guest console, forced call, forced pause, forced save/export, New Game fallback, or native input replay was used.

## Native consequence and pause observations

Recovered full frames retain original timestamps and hashes. Every intentional input followed an individually inspected fresh full frame with unchanged strict ownership admission and an independently scheduled balanced release.

| Frame under recovered `webgl/` | Native evidence |
| --- | --- |
| `akarastill.png`,15:53:56Z | AKARA Talk/Trade/Cancel menu and full red life globe. Several earlier approach clicks only moved the character; they are not represented as completed healing. |
| `healedstats.png`,15:54:27Z | XP380, life55/55 after native Akara interaction. |
| `outgate.png`,15:56:49Z | “Entering The Blood Moor.” No Den entry was attempted. |
| `moorwall.png`,16:00:06Z | Nearby outdoor enemy beside player and chest; full red life globe. |
| `enemypause.png`,16:00:21Z; `enemypausewait.png`,16:00:40Z | Ordinary in-game Escape menu. Enemy, player and chest positions remain unchanged across18.5seconds, while menu decoration/rain changes. This observed native menu provided review time; it is not a forced suspension or proof about every UI/state. |
| `enemyresume.png`,16:00:54Z; `zombieaxe1.png`,16:01:11Z | Native Escape resume, then one finite1500ms targeted left-button axe action. The historical action label says zombie; the clearer spiny creature appearance suggests quill rat. Exact species/kill count was not independently labeled by native UI. |
| `combatstats1.png`,16:01:29Z | Native XP401, +21 over380, level1, life55/55. The XP increase establishes earned outgoing monster consequence; no kill is inferred solely from a body or animation. |
| `earnedpause.png`,16:02:00Z; `earnedsavetitle.png`,16:02:32Z | Original pause → Save and Exit Game → actual Single Player menu. No further combat. |
| `reloadedstats.png`,16:04:43Z | Existing SAMEHERO normal Load, native XP401, level1, life53/55, attack3–7. |
| `reloadedmovement.png`,16:05:13Z | Fresh point click, running pose and shifted camp road/cart/torch/NPC scenery after Load. |
| `reloadedquestsettle.png`,16:05:41Z | Den objective persists: “Kill all the monsters in the Den.” No quest completion or remaining count claim. |

This was a short controlled outdoor engagement, followed by native SaveExit rather than further combat. Small damage occurred after the55/55 combat panel: the exported D2S decodes to life53.6484375/55, matching native53/55 after Load. XP401 persisted. Native pause was validated observationally with an enemy present; no hidden simulation controls were used.

## Qualified whole earned checkpoint

Use **all four** files together from `R/earned-save/`. `earned-save-manifest.json` and `earned-save-stats.json` pin and read-only decode the whole export made at the title, before the subsequent Load. `webgl/native-save-earnedexport/files.json` retains the original VFS rows; the audit verifies every byte matches the local files.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| samehero.d2s | 757 | 8a55786b1923052f7a1775e87c0b1f8be29d9faf6b601648eea9ee412457b504 |
| samehero.key | 902 | 29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6 |
| samehero.ma0 | 7972 | 89411738bb0ce6834ab6144fd20cd82a992dd6839dd77ceba3bc49bb68204dd2 |
| samehero.map | 24 | 95e612334f4a2b74e6f5c4d300bfd29ddd5c29bc634bb113173c91215d04ae82 |

Decoded stats: XP401, level1, Vitality25, gold3, life53.6484375/55, mana10/10, stamina91/91. This successor is qualified by normal Load and movement in the same browser/session. **A fresh-browser Load of this new XP401 set has not yet been tested.** The original XP380 set and previous death outcome remain separate and preserved.

## Recovery, disk and lifecycle

`final-audit.json` passed: **811 remote references /661 unique compressed contents**, all75 full PNGs CRC/image-decoded,18 ownership fields consistent across every capture binding, ACK0..74 successful and unique,33 trusted balanced mouse pairs and24 trusted balanced key pairs, all release receipts acknowledged. No browser exception, first-failure, or read-only-stall output was emitted. All523 final runtime pins passed. The passive pre-detach observer recorded zero `FIRST_NATIVE_PRE_DETACH` events. This successful SaveExit is not a causal repair claim for the earlier lifetime failure.

`recover-artifact.py` restores selected remote outputs from `recovery-map.json` / `recovered-unique/`. `recover-efficient.py` verified the compressed transfer package and every member, reusing exact hash-verified compacted review content to avoid duplicate local allocation. Transfer packages were held in memory and not retained locally; unique logs, captures, module and export remain. Older local action-attempt/API records are retained as exact gzip with raw size/SHA and names in `local-record-compaction.json`; reconstruct them with gzip decompression. No evidence was discarded in place of a summary.

Free `/home` was checked before allocation and each action, with minimum sampled action free1,509,875,712B. Native input ended at16:05:53Z before this run observed any floor crossing; final audit free was1,506,025,472B. Shared pressure left only a few MB during recovery, so own exact record compression recovered3,091,434B. These are sampled measurements, not continuous floor-compliance proof. No RAM gate was used.

Private box **bx_e4xas4vx** had an independently prearmed observable120-minute watchdog, initial expiry **2026-11-12T17:40:26.378Z**. Chrome exited0 at16:05:53.437Z. The remote actual parent waited0 and joined both output EOFs; kernel custody reaped **360/360**, with no remaining/unreaped/unresolved processes. Provisioning actual local parent waited0 with both EOFs.

The local start exec later returned **143** and produced neither `manager-parent-wait.json` nor `watchdog-actual-wait.json`. Their clean joins are **not claimed**; cause is UNKNOWN. The manager wrote its delegated stop-attempt record but no response; subsequent read-only API observations showed idle state with no stop receipt. A separate lifecycle-only caller then completed the delegated normal stop, without gameplay or command replay. Final state **archived**, expiry **null**, stopped **2026-11-12T16:07:14.556Z**, receipt **stop_3ce2935f624a5816**, completed, forced=false, error=null. The independent watchdog observed that confirmation and exited, but it was orphaned and has no actual-parent join receipt. No inherited box was touched, resumed or deleted.

Next: with adequate disk headroom, independently load this exact whole XP401 set in a fresh private browser, verify stats/movement, heal natively if needed, then continue short safe combat toward level2 or carefully return to the Den. The Den objective is still open. No workers or public deployment were launched. No production build was required for this documentation-only result.
