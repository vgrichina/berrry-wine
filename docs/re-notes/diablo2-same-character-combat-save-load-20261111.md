# Diablo II demo: same-character combat, retained native save and normal Load, 2026-11-11

The registered original `diablo2_demo` completed the requested chain with **SAMEHERO**, one ordinarily created level-1 Barbarian. In the Blood Moor, two upright Zombies became corpses after native targeted attacks. SAMEHERO changed from **XP 0 / life 66 of 66** to **XP 66 / life 46 of 66**. Native Save and Exit returned to the title. The same character's unedited save bytes were immediately exported and recovered locally. Ordinary Single Player → SAMEHERO → OK then loaded gameplay in the Rogue Encampment; the native character panel again showed **SAMEHERO, XP 66, life 46 of 66**.

Evidence root: `scratch/runs/20261111-diablo2-same-character-combat-save-load-1115/` (ignored). This extends the [parent combat/save run](diablo2-current-field-combat-save-20261111.md), whose FIELD combat bytes were lost and whose separate NATIVE load was unverified. No save mounting, game/state/script edits, generated media, or gameplay patch was used here.

## Visible proof and retained bytes

Full reviewed images in `review/`:

- `baseline.png`: SAMEHERO level 1, experience 0, life 66/66 in town.
- `northeast25.png`: native “Entering The Blood Moor” during ordinary movement through the town gateway.
- `approach44.png`: upright enemies and native Zombie nameplate.
- `attack46.png`, `attack47.png`, `attack48.png`, `attack49.png`: targeted combat, first corpse, second reduced health bar, then both corpses.
- `statafter.png`: SAMEHERO XP 66 and life 46/66, with both corpses beside him.
- `freshsave.png`, `title.png`, `export.png`: native Save and Exit menu, resulting title, immediate read-only export.
- `loadsingle3.png`, `select.png`, `loadok.png`, `loading.png`: existing SAMEHERO in the normal list, selected character, OK, then gameplay entering the Rogue Encampment.
- `loadedstats.png`, `afterloadexport.png`: SAMEHERO XP 66 and life 46/66 after normal Load.

The life row displays maximum 66 in its first numeric column and current 46 in the second. The initial panel showed 66 in both columns. Enemy identity is supported by the native Zombie nameplate; no quest-completion claim is made.

`native-save/` retains the actual game-written bytes. Guest paths, byte counts and SHA-256 hashes are in `native-save-manifest.json`:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| samehero.d2s | 813 | `57de3f66eed5c2b5cb6903ae81232d32d9b2a4dec5cc563a00ea9eba82371f16` |
| samehero.key | 902 | `29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6` |
| samehero.map | 24 | `95e612334f4a2b74e6f5c4d300bfd29ddd5c29bc634bb113173c91215d04ae82` |
| samehero.ma0 | 5106 | `812162e10ccd0bb237451ee5f56d12d2c7fe3aaa15cd25c2109d3421922d4563` |

The exporter reads `wine._helpCtx.vfs` without mutation. Its exported JSON was downloaded and hash-verified before normal Load, then decoded without changes. A second export after Load was byte-identical for all four files (`after-load-save-comparison.json`). Load reused the native VFS files through shipped UI; no files were imported. This proves the native Save/Load chain within the running application and retains authentic bytes for future independent-launch recovery testing.

## Controller and backend checks

Before runtime, the composed-controller regression exercised the actual browser `execute` capture/export paths, validated capture/click/key/text/export/quit call schemas, and proved missing `waitMs` is rejected before effects or queueing. The inherited exporter regression passed syntax, native save-path selection, complete high-byte preservation, unrelated-entry exclusion and no mutation. Both test logs are retained. The added scratch command validator is used before request queueing and again by the consumer.

Every dispatched gameplay input had a full current image review bound to the actual process, guest worker, module, render endpoint and canvas. The audit verified 93 exact-ID successful command acknowledgements, including 60 reviewed gameplay inputs; nine stale-scene attempts were explicitly refused before dispatch with zero effects, followed by new captures and new command IDs. There were no unknown input acknowledgements or replays. All 183 recorded native events were trusted and key/button presses and releases balanced. Long presses used prearmed releases and were followed by passive settling and full-image review.

The exact accepted production source remains Git `0db20330ccd6761a705eea70c5dd9bfc7704c147`, with the observed recovered module SHA-256 `ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`. `runtime-pins.json`, `preflight-source-resolution.json`, `reuse.json`, source patches and `build-rehash.json` preserve the matching source/module/media/control/build references. The reused passing locked-build log is `20261111-avp2-current-marine-encounter-0820/build-final.log`, rechecked SHA-256 `27d66f5d89a3df20dc3fe67fe0f32cafcc3c4aca928ca2563bf5efc49f2d5664`. No production code changed. The original executable SHA-256 is `d0aa0d30b55f8313e04026cca560ef0d178ee76b2ece6c3ccdc1fca4af46b3f1`; media is referenced by canonical path/hash, without extra local media copies.

Backend evidence records isolated threaded browser execution and WebGL 2 through Chrome ANGLE/SwiftShader; this is not a hardware-GPU result. The first startup omitted the scratch worker observer from provisioning. That controller failed before gameplay input, exited with actual waits/EOF, and Chrome PID/profile/listener absence was confirmed before the corrected relaunch inside the same lease. This was a scratch provision-list error, not a demonstrated shared emulator defect.

## Recovery and lifecycle

All **949 remote file references / 44,842,799 bytes** were retrieved and hash-checked. A separately calculated post-retrieval remote inventory digest matched the original inventory, and every local recovered reference was rehashed. Audit validated CRCs and IDAT decompression for **84 unique full PNGs**, the live module hash, authentic save bytes, reviews, acknowledgements and releases. The oversized first second-check command hit a local argument-length error before remote execution; a compact independent inventory-digest check completed the same verification. `recovery-map.json`, `post-retrieval-rehash.json`, `retrieval-verified.json` and `evidence-audit.json` retain the results.

`lossless-map.json` maps compacted large records/modules to byte-exact gzip files, including original sizes/hashes and restoration paths. Native save files and reviewed PNGs stay directly available. Git SHA plus relevant binary patches and `owned-harness.patch` supply source recovery; no source-tree archives were made.

Owned private box **bx_uytzbr5k** was created at **11:17:47.482 UTC**, with initial expiry **12:02:47.496 UTC** and an independently prearmed fixed watchdog deadline **12:02:47.200 UTC**. After successful Load, Chrome and controller exited 0 with actual parent waits and both EOFs; independent inspection confirmed absent PIDs, profile and listener. Evidence/save retrieval and the independent hashcheck completed before the delegated normal stop at **11:45:33.574 UTC**. Independent GET confirmed **archived**, active expiry `null`, stop **stop_5999e81e29d87cd1**, completed, `forced: false`, `error: null`. The unfired watchdog exited 0 with actual wait/EOF (`normal-receipt.json`, `normal-archived.json`, `watchdog-wait.json`).

The requested same-character combat → retained native save → normal Load proof is complete. A future independent-launch import/recovery test is separate from this demonstrated ordinary in-session Load and was not needed here.
