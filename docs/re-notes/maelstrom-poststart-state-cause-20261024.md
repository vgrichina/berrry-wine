# Maelstrom original post-P state boundary, 2026-10-24

The retained captures narrow the failure to a **background-only game presentation during startup/fade or before a successful foreground game-frame presentation**. They do not establish the original CPU's exact phase. The strongest new observation is quantitative: between batches34000 and39000, **only the30 star pixels change; every earlier RGB channel is exactly `floor(later/8)`**. All nonblack pixel coordinates, the border and the bottom strip remain unchanged. This is consistent with the original32-step fade, with no visible moving sprite, but is not proof that the CPU was inside `Fade`. The retained run has no original-state, return-stack or game-frame observations needed to distinguish that from a foreground update/render defect.

This is a concrete narrowed boundary and a locally validated next capture, **not a proven renderer defect or a gameplay acceptance**. No guest, harness runtime, native module compiler, browser, box, acquisition, repair or integration was executed. The original EXE and SDL were read in place. No guest state or shim symbols were modified.

The initial HUD and ship have different creation/drawing boundaries. `Player::NewGame` calls `NewShip` before `NextWave`; the first ship blit occurs in `RunFrame`. However, **`DrawStatus(true,false)` draws the initial HUD before the first `RunFrame`**, so “not enough game frames” alone does not account for the missing HUD if that earlier drawing/presentation succeeded. There is no source-defined multi-second ship-spawn timer to wait out after `NewWave`. The next observation must measure these boundaries instead of merely extending the batch limit.

Evidence is in [proof.json](maelstrom-poststart-state-cause-20261024/proof.json), the linked disassemblies below, [authentic reference-source excerpts](maelstrom-poststart-state-cause-20261024/reference-source-excerpts.json), and [the retained6393-byte output](maelstrom-poststart-state-cause-20261024/retained-output.log). The source is explanatory: author-hosted3.0.6 source archive SHA256 `e7983c2c7376cdcca1944db1706d92aedd529638cf13358c88a60df982ba7b46`. It is not asserted to reproduce this historical Windows build. Every proposed instruction and state operand is checked against original EXE bytes independently of source names.

## Original control flow and addresses

EXE SHA256 `0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5`,135168 bytes. Preferred and retained runtime EXE image base are `0x00400000`; the EXE has no relocation directory. For the selected original `.text`, `.rdata` and file-backed `.data` addresses, file offset is `VA - 0x400000`. `.data` has RVA0x1b000, raw size0x5000, virtual size0x5d68; `gPlayers[0]` at0x420c0c lies in zero-filled virtual storage. Neither its initial zero bytes nor any other on-disk initializer is a retained runtime-state dump.

SDL preferred base0x10000000 became0x00666000 in this run. Thus SDL runtime VA is `0x666000 + (originalVA - 0x10000000)`. SDL's `SDL_Delay` original0x10022d50 becomes0x00688d50; `SDL_GetTicks`0x10022cd0 becomes0x00688cd0. Do not apply this delta to EXE addresses. Later runs must verify DLL bases anew.

| Original EXE boundary | Meaning and decoded evidence |
| --- | --- |
| 0x40ab85 → 0x40ace4 | Menu compares SDL keysym with0x70 (`83 f8 70`); equal branch reaches `call 0x40b0c0` (`e8 d7 03 00 00`). This is the guest action boundary missing from the Win32 dispatch receipt. |
| 0x40b0c0 / 0x40b134 | `RunPlayGame`: stores lives3, level1, no-delay0; sound setup, `SDL_Delay(100)`, then `call NewGame` (`e8 f7 b0 ff ff`). |
| 0x406230 / 0x406306 | `NewGame`: multiplayer negotiation only if player count>1; font/colors, then `call Fade` (`e8 45 05 01 00`). |
| 0x406323–0x406373 | Sets game-on1, paused0, wave=startLevel-1; calls each player's vtable+0x78; initializes last-star15, last-drawn0, sprite-count0; `call NextWave`. |
| 0x411300 / 0x411410 | Player NewGame sets playing/lives/score and invokes vtable+0x80 (`ff 92 80 00 00 00`); NewShip assigns `gPlayerShip` to player+0x40 and clears death/explosion state. |
| 0x4067c5 / 0x411340 | NextWave invokes vtable+0x7c for each player. NewWave sets position/zero velocities, bonus2000, shield grace60, rotation/shooting/thrust0. |
| 0x4067d9 → 0x4057a0 | Calls `DrawStatus(true,false)` before gameplay. DrawStatus calls DrawText0x40b430 with original strings Score, Shield, Wave, Lives, Bonus at0x40589b,0x4058c6,0x4058f2,0x40591b,0x405948. |
| 0x4067e8 → 0x415e20 | Updates the initial status screen before making asteroids. |
| 0x40682a–0x40689e | Focuses background; draws30 stars; Update(1) at0x406877; restores foreground; tail-jumps to Fade (`e9 ad ff 00 00`). |
| 0x416850 | Fade loops32 times, builds256 gamma entries, calls SDL_SetGammaRamp and SDL_Delay(10); toggles screen-object+0x414. Nominal320ms per fade, not a game-frame counter. |
| 0x406378 → 0x4019a0 | NextWave including its tail-called Fade has returned; first `RunFrame` call. |
| 0x4019a3 → 0x402850 | First RunFrame action is HandleEvents(0), which drains SDL_PollEvent until empty. 0x4019ab means that drain returned; SyncNetwork then runs, success reaches0x4019c5. |
| 0x401d75–0x401d8c | Calls each player's virtual BlitSprite (+0x50), then framebuffer Update. Reaching0x401d84 is past that loop, not proof that any pixel was drawn. |
| 0x401dfa–0x401e58 | After drawing, frame timing reads SDL_GetTicks; waits until two60Hz ticks since gLastDrawn if no-delay0; then returns player count. Housekeeping0x4063c0 updates HUD/stars between frames. |

The player constructor at0x4111ee stores vtable0x419a88 (`c7 06 88 9a 41 00`); original table+0x78/0x7c/0x80 contains0x411300/0x411340/0x411410. This binds the virtual calls without guessing from stripped function names. [Player disassembly](maelstrom-poststart-state-cause-20261024/player-start.asm), [NewShip](maelstrom-poststart-state-cause-20261024/ship-create.asm), [NewGame](maelstrom-poststart-state-cause-20261024/new-game.asm), [wave publication](maelstrom-poststart-state-cause-20261024/wave-publish.asm), [HUD labels](maelstrom-poststart-state-cause-20261024/status-labels.asm), [Fade](maelstrom-poststart-state-cause-20261024/fade.asm), [input drain](maelstrom-poststart-state-cause-20261024/event-drain.asm), [frame drawing/timing](maelstrom-poststart-state-cause-20261024/frame-draw-timing.asm).

`FrameBuf::Update`0x415e20 performs queued blits. When current surface==background and auto-update is true, it copies dirty background rectangles to foreground, then SDL_UpdateRects on foreground; otherwise it updates the current surface. Object+0/+4/+8 are current/foreground/background surface pointers; +0x828/+0x830 are dirty count/list; +0x410 is locking state; +0x414 is faded. Background publication is not evidence that foreground ship/text blits succeeded. Conversely, the source does not establish that background publication necessarily erases the entire HUD. [Decoded update](maelstrom-poststart-state-cause-20261024/framebuffer-update.asm).

## What the retained run does and does not distinguish

The accepted tree run is commit `9a1c8fc7ac4d904f65bd4d5f618c84e99c245a52`, with original closure `f23fd7f51168caebb38571e303cb9630e153ef7c`. It ran42000 batches in3.685 wall seconds. All247 staged hashes and48 original-tree mappings passed; no trap, missing-file or unimplemented failure appeared. P and movement/fire keydowns reached Win32 DispatchMessageA, but SDL event consumption and guest control-bit changes were not traced. Pkeyup and leftkeyup dispatched; up/space keyup dispatch remains unproven.

The guest clock was the harness default200ms/batch: screenshots at batches30000/34000/39000 report6000000/6800000/7800000ms. This is guest clock progression, not proof of completed game logic. Original SDL_Delay directly calls KERNEL32 Sleep (`8b442404 50 ff1590a00210 c3`). Original SDL_GetTicks chooses a QueryPerformanceCounter path when SDL+0x3772c is nonzero and a WINMM timeGetTime path otherwise; its mode, baseline and return values were not captured. Therefore neither “synthetic time caused this” nor “millions of milliseconds ruled out a delay” is established. The frame's two-tick wait is after drawing, so it cannot by itself explain never presenting the first HUD/ship. [Original SDL clock code](maelstrom-poststart-state-cause-20261024/sdl-clock.asm).

The two PNGs have the same positions for all30 colored stars and exactly an eightfold channel relationship. That supports a fade/presentation transition rather than visible movement between those captures. The source twinkles/repositions a star every15 housekeeping frames; unchanged positions are not a reliable frame count without proving that drawing and presentation worked. We do not infer a blocked loop or missing data from the screenshot. The final main EIP0x075040f8 is a generated thunk, not an original instruction; without thunk contents and a stack it cannot identify which original call was active. The final audio worker wait is not evidence that the main thread was blocked by audio.

| Competing explanation | Next capture observation that distinguishes it |
| --- | --- |
| Win32 key delivered but SDL/menu action not taken | RunPlayGame/NewGame counters remain0 after P; compare stack and original input handler before assigning a game-phase cause. |
| Still preparing/fading the first wave | NewGame/NextWave/player/HUD counters advance, but after-NextWave0x406378 and RunFrame remain0; stack contains original return sites near0x406306 or0x40689e/0x4168b8. Fade count is cumulative across boot, so use snapshot differences. |
| First game frame stuck draining input | 0x4019a0 advances while0x4019ab does not; stack shows HandleEvents→SDL_PollEvent. Dispatch receipts alone do not identify this condition. |
| Sync boundary or pause | After-events advances but after-Sync does not, or paused state>0 and draw/normal return paths do not advance. Confirm player count and stack. |
| Too few completed frames | After-NextWave and frame-return counters show how many frames actually ran; gLastDrawn and last-star corroborate. A missing HUD still needs its earlier draw/update boundary checked. |
| Foreground text/sprite or renderer path | Player initialization, HUD call, frame-blit boundary and frame returns advance with sane state, yet captures remain background-only. Examine current/foreground/background SDL_Surface pointers/pixels and DrawText return/surface before deciding missing data versus blit/presentation. |
| Clock-dependent wait | Actual original return stack is in a known delay/timing call, with repeated state snapshots and clock backend/returns. The screenshot timestamp alone does not select this cause. |

## Minimal next capture, validated offline only

[Capture delta](maelstrom-poststart-state-cause-20261024/capture-delta.json) supplies exact argv additions/replacements for the prior [guest arguments](maelstrom-poststart-state-cause-20261024/retained-guest-args.json). A new coordinator assignment must provide a box, resource admission, deadline/supervisor and owned output paths. `OWN` is a required path placeholder, not a mounted guest directory. Replace the previous `--input` and `--max-batches` arguments; do not append duplicate flags because canonical getArg takes the first match. Keep the original tree mount, EXE, module, CWD, environment, input timings, batch-size and200ms clock. This is a diagnostic comparison; no clock variant or expanded game run is authorized here.

The16 passive counters correspond to the16 byte-checked anchors in proof.json. Snapshots at30000,34000,39000,41900 print hit-counts and seven read-only memory spans. The complete existing P/left/up/space and PNG schedule is retained. Each dump is at most4096 bytes, with about19KiB raw memory across all snapshots. The stack page0x074ff000–0x07500000 is selected from the retained guest stack (final ESP0x074ffb18); stack values that resemble code are candidates, not automatically valid return addresses. Correlate them with decoded call sites and frame counts.

| State | Original guest VA | Interpretation |
| --- | --- | --- |
| gGameOn / gPaused / gWave | 0x41f2a4 / 0x41f314 / 0x41f29c | Expected1/0/1 after normal first-wave initialization; those values alone do not prove a frame. |
| gNumRocks / gLastStar | 0x41f30c / 0x41f2b0 | Rocks created in NextWave; last-star starts15 and decrements with housekeeping. |
| gNumSprites / gLastDrawn | 0x41f4e0 / 0x41f724 | Last-drawn is60Hz ticks, not milliseconds. |
| screen / Geneva font | 0x41f97c / 0x41f348 | Guest pointers; initialized before the after-wave probe. |
| start lives / level / no-delay / player count | 0x41f9ac / 0x41f9bc / 0x41f990 / 0x41f9fc | Ordinary P initializes3/1/0; verify count1 before rejecting network waits. |
| gPlayers[0] / gPlayerShip / gStatusLine | 0x420c0c / 0x41f8e4 / 0x41f8c4 | The player pointer is runtime-created; never read its live value out of the PE file. |

One noninteractive `--trace-at=0x406378`, armed at30000 and limited to1 hit, dumps globals plus `*0x41f97c:64` and `*0x420c0c:176`. Those expressions use the actual canonical pointer-dereference parser. NewShip consumes one starting life in ordinary non-deathmatch play, so the first player may show2 reserve lives after the P setting of3. They read the screen object and initialized player object at the first after-wave return. Player offsets+0x40/+0xac/+0x54/+0x5c/+0x60/+0xa8 cover sprite/dead/exploding/lives/score/playing; virtual NewGame and NewWave bindings are sealed above. A zero after-wave hit is itself a result: use the scheduled state/stack snapshots rather than inventing successful game action. A nonzero hit also records registers and stack words for original phase verification.

Counters and trace-at can change interpreter optimization/scheduling; compare phase/order and state, not speed or the precise old batch at which something happened. If a diagnostic bound ends before P consumption, report that boundary instead of extrapolating. Neither missing optional exports nor an empty counter list may be treated as zero hits: proof.json independently parses the exact historical WASM export section and verifies set_count/get_count/set_bp/get_eip/get_esp without compilation or instantiation.

The helper [tools/maelstrom-poststart-proof.py](../../tools/maelstrom-poststart-proof.py) seals original EXE/SDL/harness/module hashes; checks16 instruction anchors,15 relative control transfers,15 state operands, PE file/VA arithmetic, import identities and player vtable bindings; runs the retained harness's exact input/count/dump/trace parsers in a mocked Node VM; decodes both original PNGs losslessly and checks the30-pixel relationship. Rejection fixtures cover wrong address, wrong bytes, treating zero-fill as captured memory, moved star, arbitrary brightness and17 counters. Fixture logs/bytes/hashes are committed. No full harness or emulator code is loaded by that VM.

Reproduce on retained inputs, from this task checkout:

```sh
python3 tools/maelstrom-poststart-proof.py \
  --game /tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6 \
  --harness /tmp/maelstrom-poststart-state-cause-oct24/canonical-run.js \
  --wasm /home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm \
  --runtime-evidence /tmp/maelstrom-tree-mounted-runtime-oct24/repo/docs/re-notes/maelstrom-tree-mounted-runtime-20261024 \
  --out /tmp/maelstrom-poststart-state-cause-oct24/reproduce
```

The harness working-tree file was absent; its owned copy was recovered read-only from exact Git object `d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e:test/run.js` and verified SHA256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`. Recovery is `git -C /home/user/wine-assembly-shadow-man-span-static-canonical-oct23 show d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e:test/run.js` directed to a new owned file. The retained module SHA256 `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` is historical sourceb41a7c5f only; it does not qualify current main.

Initial resource admission projected36956888/67108864 bytes, including checkout/Git, owned input recovery, generated/evidence/temp space, full session/events, positive SQLite growth allowance, future outputs and8MiB reserve. Installed tools and immutable donors are standing read-only inputs. Node parser-only tests used oldspace256MiB, fresh MemAvailable>=805306368, CPU/wall60s; no guest arena was allocated. Complete measurements and final publication/cleanup receipts remain in `/tmp/maelstrom-poststart-state-cause-oct24/`. Root tracked/index/refs and donors stayed read-only; only append-only board coordination touched the root. No box is assigned; bx_7y65jhum was coordinator-reported snapshot-stopped07:28:11UTC. No lifecycle operation was attempted, and ownership remains with the coordinator.
