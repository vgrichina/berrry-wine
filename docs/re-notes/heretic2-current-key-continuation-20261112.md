# Heretic II: current main Tavern Key and open door, 2026-11-12

Run: `scratch/runs/20261112-heretic2-current-key-continuation-0136/`.

Original Easy Silverspring Docks started on current main `a3c04c2da365814f82a0fb9022a26460166d505b`, including the current 199cf5b4e runtime change. The locked build passed. The served and actual Worker module is pinned in the run; canonical module SHA-256 is `1165f15cb29fa4ff4b67621f3ce66f8df68fb50baea929d0b76e9b2f66118135`. This run did not use the historical 0db20330/ce57 fixture. Runtime source/media closure hashes, Git identity and relevant binary diff are recorded; no source archive was made.

The exact whole four-file living courtyard2330 checkpoint was restored first and survived normal Load and movement. Native travel reached the gate lever, raised the gate, and included original combat. Later movement remained fixed near (511,568) despite several native controls; cause is unproven. The diagnostic native cover0136 save printed Done but is not a qualified checkpoint. No production startup, renderer or save/load defect was isolated.

The previously experimental whole cover0041 native checkpoint was then loaded unchanged. After loading frames completed, Corvus was upright and moved from (694,-182) to (598,-190). Each bounded cycle used a separately reviewed full-world native Paused banner. Native travel continued west of the timber obstruction, south into the eastern recess. At (956,-639), the game displayed “You picked up the TAVERN KEY.” Corvus withdrew west and north to the barrel alcove at (665,-70).

Native `save key0136` printed Saving game / Done. All four files were exported and SHA-256 verified (`key0136-native-manifest.json`). Normal `load key0136` returned upright Corvus in the full world. Native movement then changed position to (641,-70), (565,-64), through the courtyard and back north of the gate. This is the proven living Tavern Key checkpoint.

Corvus reached the timber tavern door, used native action, and the door visibly opened. `tavern-door-enter.png` shows upright Corvus at the open threshold near (655,981,-30). Native `save door0136` printed Done and its four exact files were retrieved (`door0136-native-manifest.json`). However, normal Load of door0136 showed collapsed Corvus, no position change on a forward check, then the native Load Game menu. This single failed door reload is retained; door0136 is experimental and must not replace key0136 as the living continuation.

The evidence supports a surviving key save and a subsequent native door opening, not a surviving reload at the door. The next continuation should restore all four key0136 files, seek native healing, reopen the door and establish a living save after the doorway. Read-only save scalar comparisons are inference only; no health/key/dead-state/script bytes were patched.

All original 60 native references and cover0041’s four files were verified at entry and preserved. Historical key0002 Save Done and its three reload deaths remain experimental evidence. Earlier crossing review gap, two invalid Pause reviews, arch checkpoint deaths, and the withdrawn black-frame cover review remain limits; this run does not retroactively qualify them. The original media and BSP bytes were unchanged. Current software gameplay is not WebGL parity, FPS, audio or full-game completion evidence.

Validation: locked build; finite native Pause/reverse-release/partial-delivery/invalid-zero-dispatch regression; actual Worker module and served closure pins; original four-file restore audits; key save/normal Load/surviving movement; native door opening; failed door save reload retained. Final retrieval and box shutdown details are in the run RESULT.md and RECOVERY.md.
