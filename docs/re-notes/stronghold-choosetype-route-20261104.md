# Original Stronghold Crusader ChooseType route resolved offline

The pinned UK multiplayer demo **offers ordinary offline skirmish, including Zephyr**. ChooseType's **right-hand towers**, native button **2**, mean **“Customize your own Crusader game.”** The left map is button **1**, **“Crusader trail”**, and opens the unavailable Arrival trail. The left/right instruction in `stronghold-crusader-demo.md` is reversed; the later village/food/save-load notes already recorded the correct route. This conclusion uses original assets, native code, retained pictures and actual input receipts, without a new gameplay attempt.

Evidence: `scratch/runs/20261104-stronghold-choosetype-route/`. Starting main is `2d97e23c4d91fc0ff7f8a9f6fa22ac46cdb66324`; reviewed predecessor commits are `fbbcf6280bf1bd8a27978ac2018262ec38426c53` and `d0749e9fe5497d317df69ab4a62099cfac839af6`. No production change was necessary. Constructor explicit idle initialization and strict native input/start guards remain unchanged.

## Original source evidence

The executable is the existing `test/binaries/candidates/stronghold-crusader-demo/installed/App_Executables/Stronghold Crusader multiplayer demo.exe`, SHA-256 `9024c533095f2227b0105b7e8a9e4cf28ec4fb206b165629787b2c97cf99f13f`, preferred base `0x400000`. Below are original native VAs, not emulator region addresses.

- Scene table `0x5e3c18` pairs ChooseType scene `0x37` with button object `0x692c38`. Its constructor at `0x425ab0` supplies descriptor table `0x5bd098`; the callback pointer at `0x5bd0ac` is `0x430e10`.
- Button records at `0x5bd0e8` and `0x5bd138` have native origins `(140,243)` and `(416,201)`, IDs **1/2**, and artwork indices **526/527** respectively. The second record is the right-hand towers seen in the retained capture.
- Callback `0x430e10`: ID 1 branch at `0x430e2a` selects scene **`0x39`**; ID 2 branch at `0x430e46` selects **`0x14`** and initializes the custom/skirmish setup. These are inspected game instructions, never injected state or flags.
- Original `cr.tex` has 260 little-endian group offsets, measured in UTF-16 code units from byte 1040. Group **250**, items **5–8**, contains the ChooseType title, “Crusader trail”, “Fight through 50 linked Crusader games”, and “Customize your own Crusader game.” Native lookup `0x46cbe0` remaps group **242** items **0–3** to these entries at `0x46cc88` onward. Drawing code `0x430c10` displays the title, ID 1 trail wording and ID 2 custom wording according to hover identity at `0x691ab0`.
- `cr.tex` group **249**, item **1**, names **Zephyr**; item 2 describes the first mission versus **The Rat** with a large human advantage. The shipped `Stronghold Crusader Multiplayer Demo Readme.doc` explicitly includes **three Skirmish games**, an in-game tutorial and multiplayer, and recommends the first skirmish. Its retained extraction is `scratch/runs/20261103-stronghold-crusader-original/readme-text.txt`.

`source-audit.py` verifies these exact branches, records, text entries, the EXE pin, and inventory hashes for EXE/cr.tex/stronghold.mlb/readme. `source-audit.json` records their paths and SHA-256 without copying media. Bounded disassembly excerpts are retained, with recovery through the existing executable and the recorded objdump address ranges.

## Personally viewed retained evidence and exact route

I personally viewed the closed predecessor's `review/crusader-type.png` (**10752**, SHA `6f8afacc85b1d3fb900e02e568b4424846310121dfbcb19901792945ea9f99b1`) and `review/skirmish-selection.png` (**11008**, SHA `2d68382e2a2d305d683244c9216543a546d0002683e3b91b5cf4cb1165b56f12`). The former is the two-choice dialog; the latter unmistakably shows **1. Arrival**, **1100 A.D.**, **Dec 1123 A.D.**, and **Not available in the demo**. Native `(266,305)` therefore selects the trail and must not recur as a skirmish action.

I also personally viewed the retained village run's `custom-skirmish.png`, `zephyr-veryeasy.png`, `zephyr-selected.png` and `zephyr-ready.png`. They respectively show the three numbered demo buttons with an unavailable default setup; a Zephyr hover label on an otherwise incomplete Deathmatch setup; a character-picker overlay; and the actual **Zephyr Very Easy (1/10), Normal Game, Human Advantage, The Rat / Duc de Puce, 8000 versus 2000 gold** setup with green Start hand. The intermediate hover label and picker are not accepted ready scenes.

The exact intended sequence is:

1. Original title → Start Game → main menu → Crusader → ChooseType, as already established by the predecessor.
2. Activate **button 2/right-hand towers**. The existing village `recovered/browser/commands.jsonl` requests client `(595,520)` at command 201; `input-202.json` records actual native **`(543,292)`**, including WM_LBUTTONDOWN. Its subsequent `custom-skirmish.png` is scene `0x14`'s demo preset selection shell.
3. Select **numbered preset 1**, not a trail mission. Commands 213/220 and `input-220.json` record native **`(67,491)`**. Require the actual Zephyr ready picture afterwards. A picker, unchanged shell, default Deathmatch setup or unknown result stops the controller; no additional speculative click is authorized by this helper.
4. Only after fresh Zephyr ready recognition and personal review may the existing `NativeStartDriver` separately qualify its original native **`(718,569)`** Start hand and require actual world entry. This offline task does not execute Start or change that guard.

Both navigation coordinates come from retained actual input receipts and agree with native control identity/artwork; neither is a newly guessed point. The existing `projectNative` computes fractional browser coordinates for current qualified geometry, rather than reusing historical page coordinates.

## Implemented and tested run controller

`navigation.cjs` is a run-only controller under this run directory. It recognizes exact original ChooseType title+tower patches, Arrival/unavailable patches, the distinct three-button unavailable demo selection shell, and the existing strict Zephyr scenario patches. The unavailable shell is **selection-only**: its sole permitted action is preset 1. It is never classified playable or allowed to Start. Arrival/unavailable and all other scenes reject immediately. Exact patches deliberately support only retained 1200×900 captures and the predecessor's strict viewport; unfamiliar layouts fail closed.

Every advance requires unchanged real input qualification, explicit personal-review hash/scene receipt and fresh recapture before producing a source-grounded gesture. The transport hook must be supplied by the predecessor's immutable, ACK-bounded, balanced physical-input controller. It has no raw launcher/input/game-state API, Start method, world controls or fallback coordinates. An unexpected post-gesture scene permanently locks it. The helper is tested offline with retained PNGs and a mock transport; no claim is made that it was installed or executed in a live browser. Fresh authorized execution must wire that adapter and preserve all predecessor per-event/queue/mask/ACK checks.

Validation:

- **64** offline recognition/controller checks pass: two-step route, retained Arrival rejection, wrong/picker/default scenes, stale or mismatched review, terminal failure/retry rejection, corrupt/transparent patches, missing raw telemetry, nonzero mask, active/stale events, foreign queue and wrong renderer ownership.
- Source audit passes native branch/record/text/media pins, seven PNG/receipt SHA matches and both actual native coordinate receipts.
- Existing native-start focused suite passes its retained scene/transition and negative cases; real renderer/host constructor regression passes. Historical progress-aware input-qualification suite passes absent-field/getter-zero negatives.
- The predecessor explicit-idle run's copied `input-qualification.test.cjs` fails its **first historical-fixture assertion**, because its relative `startup10240.json` now points to that run's repaired explicit-idle capture while the copied test expects the earlier missing-field capture. Failure log is retained. The original progress-aware fixture/test passes; current positive and negative state cases pass in the new route suite. Neither fixture nor guard was weakened to hide this mismatch.

No full build is required for this note and ignored run helper; no production files changed. Evidence records exact Git SHA, relevant binary diff and owned new helper/note patches, never source archives or media copies.

No box was allocated, accessed, resumed, stopped or otherwise operated. `bx_c5e39n22` remains **STOPPED as supplied by the owner, verified 06:16:04Z**; this task made no live state/expiry query. No assigned test box exists. Coordinator retains lifecycle ownership. No browser/game/heavy CLI/download/deployment/subworker/successor was used. The original route is resolved and tested offline; fresh gameplay remains unexecuted. **Stop here.**
