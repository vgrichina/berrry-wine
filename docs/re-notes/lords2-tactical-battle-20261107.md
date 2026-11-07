# Lords II: inspected tactical victory and Ambleshire conquest

The unchanged original demo reached and won a player-controlled tactical battle, then explicitly confirmed the conquest of Ambleshire. The inspected sequence includes tactical selection, movement, a bridge crossing, attack input, projectile/melee contact, declining troop totals, **“The Battle is won”**, the survivor report and **“The county has fallen to our troops.”** No emulator discrepancy was demonstrated and no emulator implementation was changed.

Evidence: `scratch/runs/20261107-lords2-tactical-battle/`. This follows [the battle-decision checkpoint](lords2-attack-route-20261107.md) and its linked normal-install recovery recipes. The predecessor's Winter 1271 decision showed 13 peasants and 50 each swordsmen, pikemen and archers versus 319 peasants. Its final take-field click remains **UNKNOWN**; this run does not retroactively resolve it or claim combat from that decision image.

## Fresh ordinary route

One fresh persisted-UUID box, `bx_p7gzx7s6`, was created at 06:17:33.576Z, with original expiry 07:47:33.446Z. No stopped box was resumed and no second original was launched. The normal Sierra installer installed to `C:\SIERRA\L2Demo`; two trusted clicks opened its real desktop shortcut. Player1 versus the Knight, introductory difficulty, was retained. Captures and matching read-only snapshots were inspected before further decisions. No guest saves, state, clock, configuration, assets or API results were patched, and no unknown input was replayed.

This independent fresh campaign had different ordinary events and army placement. Zero tax, normal rations and farming labour grew the starting 172 people/happiness 56. Adjacent fallow fields were changed to cattle through their visible menus. A wedding event accelerated growth instead of the predecessor's plague: Autumn 1269 reached 470 people/happiness 99. The draft slider first previewed 155 men, then 164, leaving 306 civilians. The preview showed happiness 59; **after actual creation happiness was 55**, with cattle **+10**. Fifty swordsmen, fifty pikemen and fifty archers were individually confirmed in their weapon panels; fourteen peasants remained. The recovered county reached **329 civilians/happiness 62/cattle +21** in Winter 1270.

The road march, gold town target and envoy warning were ordinary gameplay. A selected-army End Turn click cleared selection without changing season; a separately inspected second click advanced it. The army reached the battle decision in **Winter 1270**, with **14 peasants, 50 swordsmen, 50 pikemen and 50 archers versus 219 peasants**. These are this run's actual forces and date, not the predecessor's 163 versus 319 encounter.

## Tactical controls, contact and result

| Command / capture | Personally inspected result |
| --- | --- |
| 65 `winter-attack-order.png` | Battle decision, 164 mixed troops versus 219 peasants. |
| 66 `take-field.png` | Actual tactical river map, minimap, army totals and “Battle Paused.” Completed receipt and matching state. |
| 67–72 | Demo-unavailable question-mark control, hourglass pause/unpause, minimap navigation, box selection, health bars and troop icons. |
| 73–77 | Initial attack input and unpause; rearrangement observed, but no contact/casualty claim. |
| 78–84 | Paused control inspection, Game Help options, local movement input, balanced trusted right click and reselection. Right click cleared selection; it did not establish movement. |
| 85 `local-move-response.png` | Running-battle left-click ground order produces clear northward displacement. |
| 87 `cross-bridge-order.png` | Red troops visibly crossing the eastern bridge. |
| 88–90 `live-attack-order.png` | Enemy brought into view, hover and left-click attack input; enemy total falls from 219 to 132 while Player1 remains 164. |
| 91 `combat-contact-view.png` | Both forces in contact, arrows/projectiles, health bars; totals 155 versus 9. |
| 92 `combat-resolution.png` | “The Battle is won.” |
| 94 `victory-continue.png` | “The Battle is decided”: 11 peasants, 44 swordsmen, 50 pikemen, 50 archers survive; defender totals zero. |
| 95 `battle-report-close.png` | Ambleshire explicitly says the county has fallen to our troops; northern minimap territory is red. |
| 97 `conquered-county.png` | Ambleshire selected in the kingdom view: 219 civilians, happiness 0, tax 6%, normal rations, cattle −12. Consolidation remains untested. |

The original `FILES/L2.ENG` was read without modification to clarify the controls: box-select units and left-click a destination; select units and click an enemy when the cursor turns red to attack. Its path/hash and relevant text are retained in `tactical-help-readonly.json`. The documented successful movement and combat response came during the running battle. The earlier paused orders and right-button diagnostic are not presented as proof of successful attack. No mismatch was inferred from those exploratory control inputs.

The victory verifies this battle and this county conquest. It does not establish campaign completion, defeat of the Knight, later economic stability, audible output or whole-game correctness. In particular, the newly conquered county's happiness 0 and negative food forecast are visible inherited conditions, not evidence of successful consolidation.

## Runtime, preflight and recovery

The exact pinned runtime is predecessor Git `2472ef81ac266b5a500153998577c266473286cc`, the retained relevant source diff and new `lib/wininit-boot.js` patch, plus `runtime-pins.json` and this run's small harness files. Standard WASM SHA-256 is `e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`; compatibility is `04acbb89f66ad9814836b5e2c34de659b518f4e1994f50c4ee8069c991f02f72`. Exact modules remain recoverable from the WinExec-search run's retained tested modules. Installed `LORDS2.EXE` is `c83df505c4be850c10425f1770090ba3ca31fa6b87d8bce2cde3c66ae11dd0dc`; `SMACKW32.DLL` is `16725648b30a2bdcd2959a52ca92f9a0e14a7fc9fb26c84e90363c2631887f83`. Concurrent main's build was not substituted. Git is the source archive; no source/media archive was made.

Before original execution, all **638 runtime pins**, including **181 original media files**, matched. The production input validator passed its positive/negative controls. Both queue capacity guards remain **240**; a cheap rendered-button smoke completed 52 trusted clicks with matching count states and quit 52 normally, and a rejecting regression failed the old 48-command consumer. Only the run-local queue wall deadline changed from 1,200,000 to **2,100,000 ms (35 minutes)**; the independent guard was set to 2,160 seconds, with a 45-minute total task budget. All coordinate, key, text, step-count, screenshot freshness and wait bounds remain intact. The original reached conquest and was deliberately closed before that deadline. The later right-button diagnostic first passed a cheap balanced trusted down/up fixture and was separately logged; it did not mutate the pinned runtime.

Actual remote browser was **Chrome 151.0.7922.71**, Puppeteer **25.7.0**, Node **v24.22.1**, production browser presentation at **1000×800**, `?debug&no-threads`, cooperative execution. Local queue/right-button smoke used Chrome 151.0.7922.108. Actual HTTP response and instantiated module identities are retained. Selective observers are not a complete CPU/API trace.

The first post-run collector exceeded its 40-second bound while compressing snapshots and was terminated; gameplay had already ended normally. Remaining compression used a separate recovery operation with faster gzip and roundtrip equality checks, without gameplay replay. Retrieval is verified by size/SHA-256 before the explicitly delegated normal fresh-box shutdown. Final verification and lifecycle details are retained in `verification.json`, `retrieved-final.json`, `remote-cleanup.json` and `boat-stop-result.json`. Documentation-only publication does not require an emulator regression or locked build; no emulator repair is claimed.

Final closeout: all **332 retrieved files** match their remote size/SHA-256 inventory; **91 installed-game snapshots** retain the expected executable/DLL/module identities. Chrome exited normally at 06:48:15.866Z after 29m42s of original runtime. Owned harness/server/guard/browser processes, HTTP/debug ports and temporary profile were absent. Box `bx_p7gzx7s6` reached terminal **archived** state at 06:51:46.092Z; stop operation `stop_253ef81f93176213` completed without force. Its original expiry was 07:47:33.446Z; terminal expiry is null. Local watcher stopped, and final verification recorded 2,515,726,336 free bytes on `/home`. The repository-wide evidence checker reports existing unrelated historical missing/invalid evidence; this run’s result is checked separately for schema and contained, existing references.
