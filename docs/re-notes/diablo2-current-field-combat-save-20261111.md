# Diablo II demo: current browser field combat and native save export, 2026-11-11

The registered original `diablo2_demo` reached the Blood Moor through ordinary town movement and defeated a visible enemy. FIELD, a level-1 Barbarian, went from **0 XP / 66 health** to **33 XP / 37 health (66 maximum)**, with the approaching upright enemy becoming a corpse beside him. This establishes town-to-field combat consequence on the current browser backend. Enemy species/name and a quest completion were not established.

Evidence root: `scratch/runs/20261111-diablo2-current-field-combat-save-1030/` (ignored, not committed). No game media or source archives were created. The save export described below belongs to a second character, NATIVE; FIELD's combat progress was not recovered as save bytes.

## Visible route and consequence

The original executable was `test/binaries/candidates/diablo-2-demo-installer/installed-extracted/diablo ii.exe`, SHA-256 `d0aa0d30b55f8313e04026cca560ef0d178ee76b2ece6c3ccdc1fca4af46b3f1`, with the registered original companion files and manifest. Single Player, Barbarian creation, character name entry, town movement, automap, bridge crossing, target attack, character panel and Save and Exit used shipped controls. Each gameplay command had a full current image review and a binding to the observed browser/worker/module ownership chain. Stale review admissions were refused before dispatch; those attempts were preserved and received a new capture rather than replay.

Key full images in `review/`:

- `baseline.png`: FIELD level 1, XP 0, life 66/66 in the Rogue Encampment.
- `fresh22.png`: native “Entering The Blood Moor”.
- `figure49.png` and `fresh50.png`: upright enemy approaching the hero.
- `attack50.png`: enemy collapsed beside the hero after an ordinary left-target attack.
- `statafter.png` and `freshsave.png`: XP 33 and life 37/66, corpse still visible.
- `gamemenu52.png` and `title54.png`: native Save and Exit route returning to the title menu.

The attack was a trusted left-button hold of 2,500 ms, with a prearmed release. There was no guest-state write, script-driven movement, save modification or stage jump. Turning off the native automap improved responsiveness; no renderer or gameplay patch was needed.

## Save bytes and the unverified load

After FIELD's native Save and Exit, an incorrectly escaped regular expression in the read-only scratch exporter caused a controller exception and clean Chrome exit before any save bytes were exported. This was an evidence harness defect, not a demonstrated emulator defect. The failed command and actual browser/controller waits and EOF were preserved. Exit and profile removal were confirmed before a safe repaired relaunch inside the same lease.

The exporter was repaired to read the native VFS at `wine._helpCtx.vfs`; the focused VM regression checks expression syntax, complete high-byte preservation, native save-path selection, exclusion of unrelated entries, and no mutation. The second ordinary character, NATIVE, used native Save and Exit. `review2/title2.png`, `export2.png`, `loadsingle2.png` and `selectnative2.png` show the return to title and the existing NATIVE Level 1 Barbarian in the character list.

`native-save/` contains the unedited game-written files, with guest paths, sizes and hashes in `native-save-manifest.json`:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| native.d2s | 809 | `3767056f295f715a362ac357475d18e46ff3fd9293b5c442f7896d2b4567d31f` |
| native.key | 902 | `29c7012dd4dca077e162119cc4358acd7369f14ff5c32fac6fc1d20847dfbdc6` |
| native.map | 24 | `5e96f51fd1bf2deae8a796ba089070ad62606d3df0522adb9bc2590bb5a57fea` |
| native.ma0 | 4914 | `86b652dff4038ee89a81b95f9ea8a748c9804c55e45c060b4a5de82f622ee330` |

The complete exported JSON was downloaded and hash-verified, then its byte arrays were decoded without edits and rechecked. These files are **not** a retained combat save. Normal load into gameplay remains unverified: the first OK attempt was stale and refused before dispatch; the following capture request omitted the required `waitMs` field, triggered the harness's fail-closed validation, and cleanly ended the second browser. Both failures and the unknown/rejected command were retained without replay. No save was imported or mounted manually.

## Matching backend and verification

The reused production source is Git `0db20330ccd6761a705eea70c5dd9bfc7704c147`; `reuse.json`, `runtime-pins.json`, `provision-pins-final.json`, the source patches, and `reused-build-proof.json` identify the exact matching source/module/media/control/build evidence. The reused passing locked build is `20261111-avp2-current-marine-encounter-0820/build-final.log`, SHA-256 `27d66f5d89a3df20dc3fe67fe0f32cafcc3c4aca928ca2563bf5efc49f2d5664`. Production code was unchanged by this run.

The actual observed module was recovered from the browser: `ce57f0ad80254b974a0d8bcd4e2c9cbf396d2357cbdc7874e6084e980e1e68e1`. The backend was isolated threaded browser execution and WebGL 2 through Chrome ANGLE/SwiftShader; this is not a hardware-GPU claim. Relevant original worker observations, trusted-input records, command acknowledgements, capture states, runtime pin checks and scratch harness patches are retained. Early missing-closure startup failures were repaired only after confirmed exits; no unknown command was replayed.

Recovery checked all **1,146 file references / 54,365,541 raw bytes**, with a second independently calculated remote inventory digest. Local audit found 894 distinct files / 49,949,567 bytes, and validated CRCs and IDAT decompression for 101 unique full PNG images. `recovery-map.json` and `post-retrieval-rehash.json` record the checks; large records and modules have byte-exact gzip restoration paths in `lossless-map.json`. Native save bytes remain directly available. Git plus exact relevant patches supplies source recovery; media is referenced by path and SHA-256.

## Lifecycle and next step

Owned private box **bx_cajqn45j** was created at 10:34:11.867 UTC with a 45-minute lease and an independently prearmed observable fixed watchdog deadline at approximately 11:19:11 UTC. After both browser/controller exits, actual parent waits and both EOFs, recovery and the second hashcheck, the delegated normal stop completed at **11:11:48.017 UTC**. Independent GET confirmed **archived**, active expiry `null`, stop **stop_53470dbfda5c3a12**, `forced: false`, `error: null`. The unfired watchdog exited 0 with actual wait and EOF; receipts are `normal-receipt.json`, `normal-archived.json` and `watchdog-wait.json`.

Next: require valid controller capture fields before queueing; on a fresh authorized lease, repeat the ordinary combat route, export that same character immediately after native Save and Exit, and confirm the native character-selection OK route loads its health/XP back into gameplay. The present run establishes real combat and authentic separate save export, with no combat-save persistence claim.
