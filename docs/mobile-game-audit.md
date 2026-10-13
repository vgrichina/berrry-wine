# Mobile game controls and presentation audit

2026-09-10. Audit only; no runtime changes or deployment.

## Scope and evidence

Public desktop games, every currently declared game touch overlay, and two
Win16 parity checks. The browser sweep captured **27 games in both orientations
(54 captures)** on local port 8087, branch `codex/rodent-score-caret`, commit
`8cd29260`. Chrome simulated 390x844 portrait then rotated the same running
page to 844x390 landscape, DPR1. This is not physical iPhone/Safari validation.
No notch or keyboard was simulated in this sweep. Most captures are initial
board/menu/splash states, not a completed gameplay test. Heroes II/RCT and the
additional local games were not included in the fresh visual sweep.

The registry was read from main after the Rodent merge. It contains concurrent
uncommitted changes owned by other work; nothing here modifies those settings.

Raw evidence (temporary local files):

- `/private/tmp/mobile-game-audit/measurements.json`: windows, original sizes,
  backing/presentation dimensions, widget bounds, crop/destination rectangles.
- `/private/tmp/mobile-game-audit/inventory.json`: configured overlays, aspect,
  cursor modes, and relevant executable import names.
- `/private/tmp/mobile-game-audit/<app-id>-portrait.png` / `-landscape.png`.
- `/private/tmp/mobile-game-audit.js`: read-only browser capture/import probe.

**Input evidence labels:** `P` = existing gameplay test or reverse-engineering
notes establish the route; `I` = executable imports only, NOT proof that the
game polls that API during gameplay. `MSG-I` means GetMessage/PeekMessage is
imported and no direct keyboard polling API was found in that executable.
DLLs, dynamic imports, hooks and private key tables can change that conclusion.
No new per-game polling-frequency census was taken. Bindings listed below are
the configuration we ship, not an assertion that every binding was verified.

## Shared settings and the actual distinction

| Current mechanism | What it does | Audit implication |
|---|---|---|
| Single-app backing | Minimum 400x300, uniformly enlarged to match page aspect; ordinary portrait measured 400x866, landscape 844x390 | This is a guest desktop size, NOT a per-game minimum usable client size |
| Generic maximize | SC_MAXIMIZE when WS_MAXIMIZEBOX or WS_THICKFRAME is present | A 593px-wide card game can be "maximized" down to 400px and lose columns |
| `keepAspect: true` | Preserves the original **client** aspect when maximizing; still allows shrinking | Correct for stretched artwork; insufficient for fixed-pixel cards/toolbars |
| Fixed window + Fit | Presents union of visible windows, but clamps source to desktop canvas | Content outside backing is discarded before fitting; rotation exposes this |
| Exclusive display | Presents native game surface separately, proportionally in Fit | Native 640x480 exceeding phone backing is not itself evidence of clipping |
| Generic controls | Bottom-left pad, bottom-right actions; bottom band reserved in Fit, capped by renderer | Landscape still loses vertical space; buttons may overlap the fitted picture |
| `boardLayout` + contained crop | Rodent only: portrait bottom controls, landscape side rails, preserved backing extent | This is not yet the general behavior of other board games |
| Generic mouse | `mobileTouch: auto`; direct/relative behavior follows live cursor heuristic | No explicit direct override for the ordinary board games |
| Chrome without game overlay | Keyboard affordance still exists; Fill visibility depends on presentation/layout | No `touchControls` entry does NOT mean no keyboard button |
| Cross pad | Immediate keydown+keyup pulse; repeat after 300ms, every 150ms | Suits discrete key-message games; does not hold the physical key state |
| Continuous 4/8-way pad | Holds direction key(s) until finger leaves/releases | Suits state polling; four-way chooses a single dominant direction |
| Action button | Holds by default; optional one-shot key or WM_COMMAND; mouse button supported | Must match game bindings, player slot, and held-vs-edge semantics |

## Public games: per-game matrix

`G` below = generic maximize/fixed-window policy above, not an aspect lock.
Window sizes are guest outer sizes, **portrait / landscape**, not CSS pixels.
"Visible" means that captured state only; it is not a full game certification.

| Game / id | Input consumption evidence | Current phone UI/settings | Measured window P / L | Finding / next check |
|---|---|---|---|---|
| FreeCell `freecell` | Mouse game; MSG-I | Mouse + keyboard chrome; G | 400x866 / 844x390 | Empty initial deal, crowded top cells. Deal a game before deciding minimum width; original window 640x480 |
| Solitaire `sol` | Mouse/card drag; GetKeyState-I for keys/modifiers | Mouse; G | 400x866 / 844x390 | **Portrait loses right-hand columns**, while vertically mostly empty. Original 593x431; needs usable minimum client width, not stretched artwork policy |
| Cruel `cruel` | Mouse; MSG-I | Mouse; G | 400x866 / 844x390 | Cards overlap horizontally; Deal button overlaps foundation area in portrait capture. Minimum layout width to measure |
| Golf `golf` | Mouse; MSG-I | Mouse; G | 400x866 / 844x390 | **Portrait columns clipped**; stock/waste pushed far down. Minimum layout width |
| Pegged `pegged` | Mouse; MSG-I | **keepAspect**; mouse | 400x391 / 399x390 | Client ratio preserved on resize; no gross portrait elongation. Keep aspect policy; natural art is not a promise of perfectly circular raster holes |
| Rattler `snake` | Arrow key-message steering P (registry gameplay measurement); MSG-I | Cross4 + swipes; F2 New game; G | 266x352 / 266x352 | **Fixed window off backing**: P x158+266 exceeds400; L y257+352 exceeds390. Landscape source only266x133. Needs complete backing/repositioning and side-rail layout |
| Rodent `wep16_rodent` | VB picture-child arrow messages P; F2 new, F3 pause | Cross4 + swipes + F2; boardLayout; contained board crop; portrait side-wall trim12 | 282x357 / 282x357 | Whole owner retained both ways; landscape backing844x526. Fit/keyboard over New game; no Pause action. Real Safari pinch/keyboard still separate acceptance |
| Taipei `taipei` | Mouse; MSG-I | **keepAspect** | 400x300 / 539x390 | Client aspect preserved. Check tile touch targets in a started game |
| TicTactics `tictac` | Mouse; MSG-I | Mouse; G | 222x332 / 222x332 | Fixed board fully visible in captured orientations; small diagonal-board cells need touch accuracy testing |
| Reversi `reversi` | Mouse; GetKeyState-I | Mouse; G, no aspect flag | 400x866 / 844x390 | Fixed square board remains square; huge unused portrait margins. Board-focused presentation, not aspect-locking the whole window |
| Minesweeper `winmine_wep` | Mouse left/right; MSG-I | Mouse + shared long-press; G | 154x235 / 154x235 | Beginner board visible both ways. Intermediate/expert width and right-click/chord gestures not covered |
| SkiFree `ski32` | Pointer steering P; key actions P; MSG-I | Fast F + New game F2; no pad; G | 400x866 / 844x390 | Resize gives more slope, not scaled art; keep flexible. Check drag/fast simultaneous use and landscape control band |
| Pinball `pinball` | Held key controls P; cursor APIs-I, MSG-I | Three held zones: Z, /, Space; X/. nudges; F2; table crop x.20,y.07,w.62,h.93, bottom anchored | 606x460 / 606x460 | Fit capture has clipped caption/right-side window content (x17,y-9 on400px backing). Keep intentional table crop for Fill, but fix complete-window Fit and verify zones after both modes |
| Spider `spider` | Mouse; MSG-I | Mouse; G | 400x866 / 844x390 | **Portrait tableau crowding/right-edge loss**. Minimum usable width, not keepAspect |
| Marbles `marbles` | DirectInputCreateA-I; exact device/gameplay path pending | No game actions; native exclusive Fit | 640x480 / 640x480 | Splash surface proportionally fitted; no gameplay/target-size verdict yet |
| Bricks `bricks` | WM_LBUTTONDOWN/MOVE/UP P; Shift shortcuts via GetKeyState P | Mouse; no shortcut buttons; G | 400x866 / 844x390 | **Portrait title/instructions clipped** from fixed-pixel artwork. Original648x508. Minimum client + gameplay board audit. Shift+U undo and other Shift shortcuts need accessible UI |
| EmPipe `empipe` | Mouse interactions P; GetCursorPos/GetKeyState-I | Mouse; G | 512x351 + palette64x188 / same | **Portrait owner clipped**; palette remains on top. Retain full owner+palette union; inspect actual board after Next |
| Funtris `funtris` | Key-message move/rotate/drop P; hook/GetKeyState-I | Cross4; Space Drop, F2 New game; G | 400x866 / 844x390 | Landscape reserves bottom controls and shrinks entire desktop: well only about110px wide in capture. Use board/side-rail presentation; don't stretch well |
| Peaks `peaks` | Mouse/card game; hook/GetKeyState-I | Mouse; fixed G | 716x376 / same | **Portrait clips almost half the board**; L bottom extends6px beyond backing at y20. Full backing, then proportional fit |
| Pyramid `pyramid` | Mouse/card game; hook/GetKeyState-I | Mouse; fixed G | 585x413 / same | **Portrait clipping**; L y20+413 exceeds390. Full backing/rotation policy |
| Four Stones `fourstones` | Click above column P; Start! command40005 P | Mouse; G | 400x866 / 844x390 | Board stays proportional but sits amid huge portrait margins. Board-focused view; Start! is not equivalent to Game/New |
| CWordZap `cwordzap` | Mouse/keyboard word selection; GetKeyState-I | **keepAspect**; keyboard chrome | 400x315 / 509x390 | Aspect policy already present. Need started round and keyboard-up word entry check |
| Blackjack `qblackjack` | MSG-I; exact gameplay path pending | Mouse; G | 400x866 / 844x390 + startup dialog361x189 | Only shareware startup modal captured. Original800x600; don't mark gameplay usable until modal dismissed |
| DX-Ball `dxball` | Pointer paddle and button launch P; GetCursorPos-I | Mouse, no pad; native exclusive Fit | 640x480 / same | Splash fits proportionally. Landscape preferred for wide field; check one-finger steering without unintended launch |
| Blobby Volley `blobby_volley` | Shipped P2 mouse movement + button0 jump; GetKeyboardState/GetKeyState/cursor/hook-I | **Jump = mouse button0**; no arrow pad; native exclusive Fit | 800x600 / same | Menu fitted; Jump remains visible on menu. Verify player selection/settings and simultaneous steer+jump in gameplay; no new forced keyboard scheme |
| Heroes II `heroes2_demo` | GetAsyncKeyState/GetCursorPos-I; gameplay pointer-driven | No game overlay; native scene Fit | Not swept | Dense640x480 UI; hold-to-inspect/right-click, map scrolling, landscape text targets |
| RollerCoaster Tycoon `rct` | DirectInput5 keyboard+mouse P | No game overlay; launch resolution preferences; Fit | Not swept | Needs minimum logical desktop plus toolbar readability; drag, right mouse, edge-scroll/wheel. Do not simply hand it400px-wide client |

## Additional declared overlays

These are registry/import/RE audits, **not fresh phone gameplay captures**.
Except where noted they have no keepAspect or board crop setting. Generic Fit
is retained, but display-mode behavior must be measured at the real game state.

| Game / id | How input is consumed | Current control surface | Gap / proposed check |
|---|---|---|---|
| Cave Story `cave_story` | DirectInput-I | Continuous4 arrows; Z Jump, X Fire | Held-state pad is appropriate candidate; inventory/menu/weapon actions absent; check simultaneously moving+jumping |
| GeneRally `generally` | MSG/cursor-I; exact steering storage pending | Continuous8 arrows; Esc Menu | Separate throttle/brake/steer may be more usable than 8-way disk; check actual configured driver |
| Little Fighter 2 `little_fighter_2` | GetKeyState-I | Continuous8 arrows; Enter Attack, Shift Jump, Ctrl Defend | Bindings target shipped **P3**, not automatically P1; verify selection. Three right action rows need landscape rails |
| Icy Tower `icy_tower` | DirectInput-I | **Pulsed cross4**, Space Jump | Important mismatch candidate: state-polling can miss synchronous down/up. Establish held-state requirement in gameplay; left/right-only UI likely sufficient |
| Elasto Mania `elasto_mania` | DirectInput-I | Continuous8 arrows; Space Turn | Need throttle+lean+turn combinations and landscape rails; bindings/settings must match saved config |
| Atomic Bomberman `atomic_bomberman_demo` | DirectInput/GetAsyncKeyState/hook-I | **Pulsed cross4**, Space Bomb | Same pulse-vs-state risk; live movement and held bomb semantics require evidence |
| Broken Sword `broken_sword_demo` | MSG-I; mouse adventure | Empty overlay (shared chrome only) | Inventory/exit hotspots and right-click reachability; native scene and dialogs should Fit uncropped |
| Deus Ex `deus_ex_demo` | Ordinary Win32 input P; engine DLL path not fully enumerated here | Trackpad; continuous8 WASD; Space Jump, I Inventory, X Crouch; `-windowed` | Missing dedicated held Fire/Use; inventory and aiming compete for small viewport |
| Jazz2 `jazz2_demo` | **WH_KEYBOARD hook -> private VK state table P**; also async/key-state imports | Continuous8 arrows; Space Jump, Ctrl Fire; args Share1.j2l -nonetwork | Hook delivery matters, not just DirectInput. Menu/Esc, Run and other bindings not exposed; verify actual episode starts |
| Quake II `quake2_demo` | **WM_KEYDOWN/UP scan-code lParam P**; GetCursorPos/SetCursorPos relative look P | relativeMouse=true; continuous8 WASD; Space Jump, C Crouch; persisted config.cfg | No dedicated held Fire, weapon-cycle or Menu button. Trackpad tap is not equivalent to sustained fire+look |
| GTA2 `gta2_demo` | DirectInput-I | Continuous8 arrows; Ctrl Fire, Enter vehicle, Space Brake | Same overlay for walking/driving; verify both modes and repeated action behavior |
| Half-Life `halflife_uplink` | Win32 messages -> engine Key_Event P; mouse1 +attack verified; other polling imports-I | Trackpad; continuous8 WASD; Space Jump, **Tab labelled Use**, Ctrl Crouch | Audit Tab against actual seeded/saved binding; label is not evidence. No dedicated held Fire/reload/menu. Three action rows |
| Abe `abedemo` | Normal key-message movement P; GetKeyboardState-I | Continuous8 arrows; Space Jump, Ctrl Action, Shift Run | GameSpeak/sneak/throw/chant not covered; need action-mode design, not more permanent rows |

Touch overlays feed renderer.handleKeyDown/Up and its physical-state map;
the path also synthesizes Win32 scan codes via the VK fallback. Empty DOM
`code` on an overlay event does **not** by itself prove Quake movement is broken.
For the cross-pad risk, however, `_pulse` performs down and up in the same JS
turn, leaving no held physical state between guest slices. Whether buffered
events rescue a particular game must be tested rather than assumed.

## Win16 parity and remaining local games

| Game / id | Current settings | Audit status / next check |
|---|---|---|
| Win16 Pegged `wep16_pegged` | No aspect flag; mouse | **Confirmed distortion**:400x866 P /844x390 L instead of natural324x324. Portrait holes become vertical ovals. Add parity with32-bit aspect policy after regression |
| Win16 Taipei `wep16_tp` | No aspect flag; mouse | **Different failure**: fixed575x350 window, portrait backing400wide clips title/art. Fix backing first; blindly adding keepAspect may do nothing for a nonmaximizable window |
| Win16 Tetris `wep16_tetris` | No game overlay | Need key bindings + event/state test and board capture |
| Win16 Rattler `wep16_rattler` | No game overlay | Do not assume32-bit snake profile inherited; verify and declare separately |
| Pocket Tanks `pocket_tanks` | No game overlay, auto mouse, generic display | Not swept; aim/fire/settings targets and drag semantics |
| Snood `snood` | No game overlay, auto mouse, generic display | Not swept; aiming/fire, full-field aspect |
| Jardinains `jardinains` | No game overlay, auto mouse, generic display | Not swept; paddle/launch and any keyboard-only actions |
| NetHack `nethack_win32` | No game overlay; keyboard chrome | Not swept; no complete movement/command UI; cannot certify with a generic text keyboard |
| QBob `qbob` | No game overlay | Not swept; determine actual control scheme before designing overlay |
| TetriNET `tetrinet` | No game overlay | Not swept; key bindings, chat vs gameplay focus, board minimum |
| Curse of Monkey Island `curse_monkey_island_demo` | No game overlay | Not swept; action selection/hold gestures and native scene Fit |
| Dungeon Keeper `dungeon_keeper_demo` | No game overlay | Not swept; right-click/camera/drag gestures and dense HUD |
| Darkstone `darkstone_demo` | No game overlay | Not swept; mouse actions/hotkeys and HUD size |
| SimGolf `simgolf_demo` | **keepAspect=true** | Registry policy present (main worktree); not swept; minimum usable client remains separate question |
| Heroes III `heroes3_demo` | No game overlay | Not swept; right-click information, map/toolbar reachability |
| Diablo II `diablo2_demo` | No game overlay | Not swept; held attack, secondary skill, potions, inventory |
| Icewind Dale `icewind_dale_demo` | No game overlay | Not swept; select/drag, pause, party and bottom HUD |
| Baldur's Gate noninteractive `baldurs_gate_noninteractive_demo` | No game overlay | Noninteractive demo; display audit only, not movement UI |
| Baldur's Gate interactive `baldurs_gate_interactive_demo` | No game overlay | Not swept; party/commands/selection and minimum scene size |
| Baldur's Gate chapters `baldurs_gate_chapters_1_2_demo` | No game overlay | Not swept; same questions, independent executable/config |
| Civilization II `civ2_win16` | No game overlay | Not swept; keyboard commands and multiple map/advisor windows |
| Civilization II MGE `civ2_mge` | No game overlay | Not swept; keyboard commands and multiple map/advisor windows |
| Liquid War `liquid_war` | No game overlay | Not swept; verify configured player input before deciding pointer vs pad |

Other debug-only corpus games, installers, editors and screensavers were not
individually audited in this pass. Missing rows are not mobile-compatibility passes.

## Fix order

1. **Preserve the complete renderable window before Fit.** Handle offscreen
   origins and rotation, retain enough backing for fixed windows and popup
   unions. Rattler, Peaks, Pyramid, EmPipe and Win16 Taipei are regression cases.
   Do not confuse exclusive native surfaces with clipped windowed composition.
2. **Separate three policies:** flexible client resize; aspect-preserving
   client resize; minimum usable/fixed logical client with proportional
   presentation. Solitaire/Golf/Spider/Bricks need the third, not a blanket
   keepAspect flag. Do not seed minimums blindly from `_restoreRect`: some
   games create a400x300 default despite requiring more room once dealt.
3. **Win16 Pegged aspect parity.** The smallest confirmed per-game correction.
4. **Generalize orientation-aware control areas** beyond Rodent. Fit the game
   between side controls in landscape; avoid shrinking a full desktop merely
   to make space for bottom buttons. Funtris is the clearest measured example.
5. **Decouple widget shape from input semantics.** A cross-shaped pad should
   be able to hold keys or repeat key messages as configured. Verify Icy Tower
   and Bomberman first, then player/config bindings in LF2 and FPS actions.
6. **Gameplay acceptance per row:** actual movement/click result, two held
   actions, right-click, menu/modal, rotation in both directions, Fit/Fill,
   keyboard open/close, safe insets, background/cancel release. Re-run on real
   iPhone before declaring a mobile pass.

Source references: `lib/apps.js`, `lib/touch-controls.js`,
`lib/renderer-input.js`, `lib/renderer.js` `_singleAppMaximizeRect` and
`_computeSingleAppZoom`, `lib/browser-shell.js` `maximizeForSingleApp`,
`index.html` `resizeCanvas`, `test/test-single-app-keep-aspect.js`,
`test/test-touch-controls.js`, `test/test-win16-vb-gameplay.js`,
`test/test-pinball-playable.js`, `test/test-dxball-candidate.js`, and the named
game files under `docs/re-notes/` (especially Bricks, Rodent, Quake II, Jazz2,
Half-Life, Four Stones, RCT).
