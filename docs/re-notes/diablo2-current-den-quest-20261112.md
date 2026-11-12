# Original Diablo II: qualified field296 → Den entry, XP380, earned save

2026-11-12. Native gameplay succeeded on the current original demo/runtime. SAMEHERO loaded the exact whole field296 set through character selection, entered the Den of Evil, displayed its monster objective, earned combat XP inside the Den, used original Save & Exit, and loaded the earned save normally with fresh movement. The Den is **not cleared** and its quest is **not completed**.

Evidence is gitignored under `scratch/runs/20261112-diablo2-current-den-quest-1250-attempt3/` (R below). The base `...1250/` and sibling `...1250-attempt2/` preserve two stopped setup attempts. No runtime code changed in this task; this is a documentation publication.

## Source, media, and continuity

- Source Git identity: `a151d82c7df83e2d6fbaac33505f086190610249`. `source-commit.txt`, `relevant-source.patch` (empty tracked runtime diff), and `relevant-untracked-source.patch.gz` plus its path/hash manifest preserve relevant source and run helpers as patches. Git remains the source archive; no source tree/media archive was made.
- Actual captured main module: `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`, 2,189,863 bytes. `runtime-pins.json` freezes 524 closure/runtime/fixture files, including all 25 original installation files and the generic mounted binaries. Remote pre-browser verification and post-browser verification both passed; the latter is `final-runtime-verified.json`.
- Original demo EXE SHA-256: `d0aa0d30b55f8313e04026cca560ef0d178ee76b2ece6c3ccdc1fca4af46b3f1`; Storm DLL: `2b6a27f223aac30d2d383f185705be55f43f37a687aa76ebe307a1035b6eea2d`. Full original EXE/DLL/media hashes are in the pins, referencing existing `test/binaries/candidates/diablo-2-demo-installer/installed-extracted/` paths.
- Whole starting set: `scratch/runs/20261111-diablo2-native-saveexit-worker-wait-1910/field296-save/`, all four files mounted together. D2S 753 bytes, SHA `e51c394a482f65de379192b28bf5de45bea1798ac37537f56a42c1e0eec17fd9`; MA0 7,830 bytes, SHA `04a751c98f3a497536db8784217729e62a2ebde7aa033ccbed911665d3da6e9c`. `fixture-verified.json` includes KEY/MAP hashes; final audit rechecked originals unchanged. No maps, indexes, or checkpoints were mixed; no New Game fallback was used.
- Normal title → Single Player → existing SAMEHERO → OK Load preceded continuity claims. Native `stats`, `gear`, `mapsettle`, `freshmovement` and `movementsettle` captures establish XP296, level1, starting axe/shield, camp map, and fresh movement. No potions or gold initially.

The old “life66”/“Vitality26” descriptions read the stylized digit 5 as 6. Read-only v71 decoding of the exact original D2S establishes life55/55 and Vitality25, matching the native panel's font. This run did not alter stats. The native threshold similarly reads 500, not historical 600. See the prior native-level2 note and R's `field296-readonly-stats.json` predecessor in the base run.

## Native route and earned consequence

All screenshots were freshly retrieved and individually inspected in full before each intentional input. Commands were atomic, acknowledged, and not replayed. Only ordinary trusted mouse/keyboard controls were used, with original supported WebGL Direct3D renderer and original UI. Visible terrain and automap frontiers guided camp east gate → Blood Moor → northwest cave marker → visible cave mouth; no seed guessing or exhausted corner loop.

| Capture (under recovered `webgl/`) | Reviewed consequence |
| --- | --- |
| `mapoff.png` | Native “Entering The Blood Moor” after fresh camp movement. |
| `zombieme1.png` through `zombieme3.png` | Two visible zombies approached and fought with the axe; standing enemies became corpses. |
| `earnedstats.png` | Native XP362, +66 from field296, level1. A gold pile was picked up and a chest opened through native clicks. |
| `denfrontview.png`, `denmouth.png` | Actual cave mouth and torch approach, guided by visible minimap cave marker. |
| `denenter.png` (13:16:14 UTC) | Native “Entering The Den of Evil.” |
| `denquestsettle.png` | Native Den of Evil quest: “Kill all the monsters in the Den.” |
| `denwestadvance.png`, `denfallenmelee.png` | Live Fallen and shaman/fireball visible inside the Den. |
| `dencloseaxe.png` | Targeted native axe attack, new blood/corpse among live enemies. No kill count inferred solely from the corpse. |
| `earnedpause.png`, `earnedsaveexit.png`, `saveexitsettle.png` | Original Escape menu → Save and Exit Game → title. No stall this cycle. |
| `earnedselectsettle.png`, `earnedhero.png`, `earnedload*.png` | Existing SAMEHERO selected and normal Load completed at camp. |
| `reloadedstats.png` | Native XP380, level1, life27/55. XP +18 since pre-Den panel establishes earned Den combat consequence; total +84 from starting checkpoint. |
| `reloadedmovement.png` | Running pose and shifted camp scenery verify fresh post-Load movement. |
| `reloadedquestsettle.png` | Den objective persists after normal Load. |

The first red body near the Den stairs did **not** establish a kill: `denstats.png` still showed XP362. Later combat did increase saved XP to380. The run stopped combat with health falling and no potions rather than risking death. No exact remaining-monster count was obtained. No town healing or equipment changes occurred.

## Qualified earned whole set

`R/earned-save/` contains the **whole four-file** original Save & Exit export, before the reload. It is recovered verbatim from `webgl/native-save-earnedexport/files.json`; `earned-save-manifest.json` pins every byte. Keep these four files together.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `samehero.d2s` | 757 | `aeb8be30f2b41580c690eb667603dc36a7de2691df8fab3d215f3b3a2f1cdbb9` |
| `samehero.key` | 902 | `29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6` |
| `samehero.ma0` | 7972 | `89411738bb0ce6834ab6144fd20cd82a992dd6839dd77ceba3bc49bb68204dd2` |
| `samehero.map` | 24 | `95e612334f4a2b74e6f5c4d300bfd29ddd5c29bc634bb113173c91215d04ae82` |

Read-only v71 decoding validates the following skill marker and yields XP380, level1, gold3, life27.14453125/55, Vitality25 (`earned-save-stats.json`). The same exported state was then qualified by normal Load, native stats/quest display, and fresh movement. This is earned progression, not a completed Den quest; original field296 and all prior sets remain preserved.

## Control, recovery, and limits

Before Chrome, the actual staged closure import gate and joined provision passed. The requester/consumer probe exercised actual retained `{number, ok, id}` ACKs and effects. Planned native key forms/actions were validated; `Escape` is valid and stale `ESC` is rejected before publication. The current 1..600 API execution range and retained command handle were used, not a giant lease as API timeout. `envelope-validation.json`, `keyforms.json`, `staged-import-verified.json`, and provision parent receipts retain these checks.

`final-audit.json` passed: 954 recovered references / 793 unique compressed contents; 80 PNGs have valid chunk CRCs and decompressed image streams; actual module hash matches; ACK0..79 all succeeded. Native evidence contains 38 mouse downs/ups and 27 key downs/ups, trusted and sequentially balanced. Some short initial clicks were acknowledged without immediate native transitions; fresh images resolved their effect before later inputs.

After the normal browser close, per-file recovery hit an API absolute-deadline timeout after 14 files. It made caller control terminal; the failed subsequent preflight command was refused locally with no remote effects. A separate recovery-only retained envelope packaged unique logs/captures/module/save export, with per-file SHA checks, and retrieved them successfully. No native gameplay resumed. `recovery-package-pin.json`, `recovery-pack-events.jsonl`, and `recovery-map.json` retain the chain. No source/media was in this output package; only compressed contents and index were retained locally. Duplicate extracted review images were removed only after verified compressed recovery.

The passive read-only pre-detach observer remained armed, reading worker objects/buffer fields/vtable words, owner-related object state and completion-handle operations without signaling or guest writes. **No `FIRST_NATIVE_PRE_DETACH` event occurred**, so this run provides no new null-buffer ownership/writer ordering evidence and no before-dispatch lifetime attribution. The previous Storm completion-wait / streamed-sound worker-loss hypothesis remains causally unresolved. Published `7c985ed` wrapper-reuse ABI repair is not claimed as a causal SaveExit fix. Passing this cycle does not establish that cause or eliminate recurrence. Generic cleanup metadata says pending “UNKNOWN; never replay”; actual native ACK79, browser exit0, and joined outer parent provide the completed close evidence without rewriting that metadata.

## Lifecycle and next action

Each private attempt prearmed an observable independent 55-minute watchdog before allocation. All three boxes are now archived with completed, unforced, error-null stop receipts and null expiry. No inherited box was touched.

| Box | Outcome | Original expiry UTC | Stop UTC | Stop receipt |
| --- | --- | --- | --- | --- |
| `bx_2w85z34r` | Old XP449 URL preflight404 before Chrome/input; corrected fixture URL in next attempt | 13:47:20.679 | 12:54:37.093 | `stop_01e252e34eb5601a` |
| `bx_g2h8vr6u` | Retired `establishReady` helper seam before first capture/input; replaced with current `readLive` | 13:49:30.023 | 12:56:35.691 | `stop_0d82ca2b7f915cc3` |
| `bx_9damy6hh` | Den/XP380/save/reload success | 13:51:27.651 | 13:27:30.176 | `stop_63b41534f3640f25` |

For the successful box, the remote native parent actually waited exit0 and joined both output EOFs; local manager and independent watchdog also actually waited exit0 with both EOFs. All run directories retain stop and parent-join JSON. Disk was monitored against the 1.5 GB floor; owner cleanup and verified removal of this task's duplicate review images preserved recovery reserve.

Next: mount **all four** XP380 files together in a fresh private run, normal Load and verify XP380/life/gear/map/fresh movement, heal at Akara through native UI, then return via explored Blood Moor/Den entrance and continue the monster objective. Preserve passive recurrence evidence and all SaveExit causal unknowns. No runtime patch is proposed by this gameplay result.
