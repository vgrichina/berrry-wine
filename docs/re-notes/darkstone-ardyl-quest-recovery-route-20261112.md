# Darkstone: Ardyl quest / equipment-recovery route, 2026-11-12

Run: `scratch/runs/20261112-darkstone-ardyl-quest-recovery-route-1045/`.

## Result and limit

No quest receipt, progression, recovered equipment, funding consequence, or new save was earned. This run advanced native exploration from the supplied Town checkpoint into Ardyl, returned through the ordinary Town boundary once, and tried another branch. It ended on an operator error: requesting `Tab` through a run helper whose key allowlist excludes it. The helper assertion at `browser.cjs:64` fired at 11:11:09.920Z before dispatching that key, made the failure sticky, and closed the runtime. This is a harness blocker, not a demonstrated Darkstone or emulator defect. The following map-button request reached an already exited child and performed no gameplay.

The recovery route also had a concrete prerequisite missing from the loaded state: Ardyl **Places visited** contained only **Towards Town**, with no Level 1 or dungeon destination. The explored map showed a small road loop around the Town approach and a tree-bounded spur. Ordinary exploration had not located the earlier dropped kit, dungeon entrance, palisade settlement, Mayor, or Rozanne before the harness stop. Unexplored terrain remains; these observations do not prove that a quest or dungeon is unavailable in this world.

The complete supplied six-file checkpoint remains the qualified living fallback. There was no final live save readback after the failure, so this run does **not** claim that its final in-memory files were unchanged, nor qualify any new Save/Load/movement cycle.

## Planned route and native observations

Before leaving Town, read Town0959 `RESULT.md` / `RECOVERY.md`, retained original-manual guidance, and current Darkstone notes. The original manual's printed page 13 says native **Restart in Town** leaves dropped objects at the departure location. Printed page 18 explains Places visited routing. The first-steps/exploration guidance directs the player into Ardyl to meet people and find the first dungeon; the later survival guidance recommends food and a magic door. The route therefore prioritized returning to the previous Level 1 departure location for equipment, with the palisade Mayor/Rozanne quest as a fallback. The plan is retained in `route-plan.json` and `route-plan-refinement.json`.

Safety plan: start life 35/35 and food 82; turn back below life 20 or food 30, use the ordinary gate return, and reserve Restart in Town for an emergency because it drops the carried kit. No defensive or objective combat became necessary: no enemy was encountered. No random BAT kill, bank/skills recheck, food purchase, or sword purchase was performed.

The current native save preview was the **third** row, with 35/35 life, food 82, gold 393, victories 11, AC 6, damage 2–6 and the sword equipped near Gunther. Native normal Load and fresh Town movement confirmed it. The fifth row preview showed the older gold-1713 state and was never loaded. No character index was mixed between saves. The helmet-shaped paperdoll graphic remains unqualified as a separate item.

Town's Places visited → Town Exit walked the character to the gate; a native crossing entered Ardyl. The initial Ardyl map showed only the entrance vicinity, and Places visited offered only Towards Town. Exploration extended the map around the entrance. Camera turns and repeated tree/canopy occlusion made visual routing unreliable; the map was used to identify the loop. The `brown-forest-path` crossing and `forest-path-transition` capture show an ordinary return to Town, followed by another ordinary gate crossing to Ardyl. No Restart was used.

The last numeric panel (`second-route-health.png`) showed **life 35/35, food 67, gold 393, victories 11+0, AC 6, damage 2–6**, empty bag, sword equipped. Subsequent movement and the last successful capture (`grass-branch-south.png`) remained outdoors with a full-looking life bar and no visible enemy; final food was not measured. The last native map and route list are `recovered-route-map.png` and `recovery-return-list.png`. Descriptive review text is not authoritative over captures: an earlier route review called food 76 “78”; two camera reviews overstated no change/restoration. The captures show the actual values and changed angles.

## Runtime, preservation and checks

Original executable SHA begins `b43db5`; original media were referenced by existing path and SHA, not copied into the run. Published runtime source was `8a834a3dc7affc8c6e53245beab56e87a32b81e8`, module SHA-256 `04c534192ee3fe39e388536c2ce710c12c47a5cd2ca4d95c19f9d00b1e8f0a17`. The production publicFS / loadFiles path mounted all six complete authentic files from the0925 continuation manifest. Raw readback matched all six before native Load:

- `characters.lpl`: `ef58a000a453f5917909f794552800a487337f781c8c2e9d5ff129696b2168f4`.
- `game641d_6af58b24.sav`: `8032bfe798828bcd6b8f3a15b77b6ba1cf859c66ff7446707da541f6d7427131`.
- All four older maps were included, with full paths/sizes/hashes in `continuation-whole-file-set.json`.

Provisioning was actually joined successfully before browser launch, with all 667 frozen provision hashes checked. Bound captures tie guest endpoint 1 / slot 0 and its owning legacy WebGL renderer to the same exact module. WebGL2 context presence and raw draws do not establish physical GPU use, FPS, audio, parity, or a new corpus admission. No save editing, resource/config/clock writes, forced guest calls, production source change, or public deployment occurred.

Read-only recovery independently fetched every unique remote artifact twice and verified 996 references / 905 unique hashes, 89 bound captures, 77 balanced pulses, and 223 trusted events through the last successful state. The unsupported Tab has no input pulse. Browser parent status was 1 with actual wait and separate EOFs; Chrome actual parent wait was 0 with separate EOFs. No final native event/save snapshot was available after the sticky failure. The verifier explicitly accepts and identifies this failure; its PASS means evidence integrity, not gameplay success.

The newly created private box **bx_69j7twzp** was normally stopped at **11:14:10.294Z**, ahead of its initial **11:40:37.499Z** expiry. Final independent GET: archived, expiry null; stop `stop_5cc1ca81b17812bf`, completed, forced false, error null. The prearmed independent deadline watchdog was joined at status 0. Durable manager and watchdog have actual parent waits at 0 with separate EOFs. The outer lifecycle tool session75556 returned **143** and did not write its intended client/owner wait records; the cause is unknown and those outer joins are not claimed. Their retained PIDs were absent. This limitation is preserved in `final-box-and-local-custody.json`.

Exact evidence and recovery instructions follow in the run's `RESULT.md` / `RECOVERY.md`. The focused `ops/browser-native-input.test.cjs` tests passed (6/6). Documentation is checked with `git diff --check`; no production code changed and no build is claimed.

## Next route

Start from the verified six-file Town fallback, use the current third-row preview values to identify it, and retain the ordinary gate escape. The current state's visited list cannot directly route to the older Level 1 departure site. Use only supported native controls (the on-screen map button is x=.948, y=.919 in this canvas; Tab is excluded by this helper), and follow the still-unexplored branch from the Town approach while checking the native map at each fork. Find an actual dungeon entrance or quest NPC before treating combat as an objective. Only a demonstrated recovery/quest consequence warrants a new native save; recover character plus every map, normal Load it, and demonstrate fresh movement before adopting it.
