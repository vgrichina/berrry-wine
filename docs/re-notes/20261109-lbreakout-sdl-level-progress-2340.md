# LBreakout2 SDL readiness repaired; short-pulse visual stop, 2026-11-09

The task-local consumer now binds the accepted LBreakout2 SDL Canvas2D identity
chain with **no D3D render Worker endpoint**. The conditional original reached
the first-level board with score 0 and an attached ball. Its first 80 ms Right
pulse acknowledged native DOWN/UP, but the separately reviewed returned image
showed no visible paddle or ball displacement. That was treated as the first
concrete failure: native cancellation followed, with no further game protocol,
input, capture, retry, quit, or deadline extension. No emulator defect is
established. No ball launch, new brick removal, score, or level transition is
claimed; the accepted historical score 2000 remains unchanged.

Evidence: `scratch/runs/20261109-lbreakout-sdl-level-progress-2340/`.
Tested main SHA: `bfe8fc1746fa43071dc953d27bc3f51459ea8c7c`.
The task-local helpers are recoverable from `owned-helper-inputs.patch`; relevant
source patches and exact Git SHA are retained separately. There is no source
archive or copied game-media archive. `runtime-pins.json` records existing media
paths, sizes and SHA-256 values. The registered `lbreakout2_251` route, original
DLLs, empty arguments, and `C:\LBREAKOUT` working directory were preserved.
Both sessions recovered module SHA-256
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`.

## Composition and controls

`bound-input.cjs` comes directly from the accepted
`20261108-lbreakout2-sustained-first-level` helper, rather than ReVolt's D3D-only
chain. The generated consumer's `bindReady()` joins pending Worker observations,
calls that chain's actual `readLive()`, and requires absent D3D endpoint/target
and the actual page's `CanvasRenderingContext2D`. Process, page renderer, canvas,
guest endpoint, actual Worker target/instance and recovered module bytes remain
bound through the accepted identity checks. Terminal review decisions, sticky
refusals, numbered exact ACKs and independent UP scheduling remain in place.

Before allocation, `offline-sdl.cjs` executed this exact consumer binding function
and accepted identity implementation against page/guest object realms and a
controlled CDP peer. The Canvas2D/no-D3D positive passed. Wrong app, absent app,
absent guest, wrong guest endpoint, absent guest instance, absent page renderer,
absent canvas and wrong backend all refused before input or capture. These are
offline transport controls, not native browser evidence.

`offline-caller.cjs` also exercised the generated consumer's reviewed short pulse,
missing review, explicit visual stop, sticky refusal and terminal rejection of
protocol/input/capture/quit. `tools/native-key-controls.test.cjs` passed all five
tests; `tools/verify-lbreakout2-251.js` verified 220 client files, authentic CRT
and 219 exact companion mappings. The locked `tools/build.sh` passed.

One changed native fixture used a real production guest Worker/module, a
generated Canvas2D page and **no D3D render Worker**. This tests SDL-shaped
identity composition, not execution of SDL game code. Both fixture images were
separately model-reviewed: eight generated blocks and a white paddle/attached
ball, then the paddle/ball visibly 24 pixels left after Left 100 ms. Trusted
DOWN/UP and independent release ACKs passed. Fixture Chrome and consumer exited
0, with actual parent wait and separate stdout/stderr EOFs.

## Original and first concrete failure

All nine original images were separately model-reviewed before dependent action:
Loading, main menu, Local Game selected, local menu, Resume selected, Start
Original Set selected, level fade, ready board, and the post-pulse board. Menus
used ordinary Down/Enter pulses. `review/level-ready.png` shows score 0, intact
bricks, attached ball approximately page (351,619), and paddle center (351,635).
The sole paddle command was Right 80 ms, chosen from those actual visible
positions. Its independent UP was armed before DOWN; both phases acknowledged.
The page recorded trusted Right DOWN at 23:45:02.552Z and UP at 23:45:02.626Z.

`review/paddle-aligned.png`, captured at 23:45:02.787Z, still shows the same
attached ball/paddle and score 0. The model therefore stopped instead of trying
a longer pulse or another observation. The evidence does not distinguish a
too-short pulse, game polling, focus, or another input issue. No Space, continue,
death/loss, second launch or repeated score-2000 qualification occurred.
Native SIGTERM cancelled the owned Chrome and consumer; the original launcher
retained wait **-15**, actual wait and separate stdout/stderr EOFs. There was no
subsequent browser protocol or capture. Eight numbered original commands had
exact successful ACKs, including the six ordinary key pulses; the final returned
state contains all twelve trusted native key events.

## Evidence and shutdown

**157 remote artifact references / 127 unique contents** were independently
retrieved and SHA-256/size verified before the sole delegated normal stop. All
**820 runtime pins** were unchanged. Unique loaded modules, captures, binding
records, command/release receipts, logs and native cancellation are retained.
No local Chrome, nested worker, guest memory/clock edit or private game handler
was used. `/home` remained above 5.5 GiB free.

The independent immutable 25-minute watchdog was observable before allocation:
UUID `691970e8-814a-4dc7-93da-d2a9d96491fa`, deadline
**2026-11-10T00:07:15.015Z**, initial box expiry **00:07:14.435Z**. Its supervisor
retained actual wait 0 and separate stdout/stderr EOFs; the final immutable
deadline hash matched its initial receipt.

Box **`bx_r2rpytua`** is **archived**, current expiry **null**. Stop receipt
**`stop_ecf7c3a3d515db1e`** completed at **2026-11-09T23:46:00.731Z**,
`forced: false`. Independent API reads confirmed the archived state and exact
receipt. No owned live box remains.

Next, if separately assigned: diagnose the first short-pulse nonresponse using
the retained ordinary-input receipts and SDL/framebuffer observations. Preserve
this repaired readiness chain and terminal stop; do not infer a runtime input
defect or first-level progress from the current evidence.
