# LBreakout2 actual SDL consumer controls; causal blocker, 2026-11-09

The first concrete blocker is missing observation of the original SDL/game
consumer during the retained Right pulse. Trusted browser DOWN/UP and unchanged
paddle geometry establish nonresponse, but do not distinguish state sampling
after release from the game's own input-inhibit branch or another interruption
before paddle handling. No historical runtime cause is demonstrated, so there
is no justified production repair or changed live-fixture prerequisite. No box
was allocated, no pulse replayed, and no new gameplay progress is claimed.

Evidence is in `scratch/runs/20261109-lbreakout-sdl-input-cause-2350/`.
Starting main SHA: `ec04b2b9eec031348a90b56851b95f49ecb31432`.
Exact final source SHA and small relevant patches are retained there; Git remains
the source archive. No source tree or game-media archive was made.

## Actual original consumers

`node tools/lbreakout-sdl-input-controls.cjs` loads the canonical original EXE
and SDL.dll into the production interpreter, patches their actual imports, and
executes their original x86 routines. It implements no paddle movement. Both
media hashes are asserted before using native addresses. This is an offline
test with isolated paddle/surface objects and explicit test config; it does not
initialize a complete game or claim native browser evidence.

The controls execute SDL WinDIB key translation/message consumption (RVAs
`0x10c20`, `0x10a10`), DX5 buffered keyboard decoding (`0x138a0`, `0x13070`),
and `SDL_GetKeyState` (`0x19810`). They then call the original EXE paddle handler
at `0x405904`, which polls SDL keyboard state and relative mouse state. Left,
Right and Space bindings use the original key symbols 276, 275 and 32.

Both original SDL keyboard paths produce these actual-game-handler results:

| Control | Observed result |
| --- | --- |
| Right DOWN then UP before handler | x remains 320 |
| Handler while Right is DOWN | x becomes 328 |
| Handler after Right release | x remains 328 |
| Handler while Left is DOWN | x returns to 320 |
| Space DOWN / UP | right-fire request 1 / 0 |
| Paddle field +0x3c set, Right DOWN | x remains 320 |

The last branch is an observed input inhibit; its historical value was not
retained. The Space check demonstrates a native launch/fire request, not actual
ball detachment. Mouse polling is present in the native handler; these controls
use zero relative deltas and do not establish historical mouse input. WinDIB's
native repeat-bit rejection also passes. An initial diagnostic supplied four
arguments to its five-argument consumer and failed; the retained corrected
control supplies `_this, hwnd, message, wParam, lParam` and passes.

## Retained route comparison

The accepted November 8 route used ordinary keyboard control and separate
Space launch pulses (including 250 ms), then Right 176 ms, and eventually showed
score 2000. It supplies no proof that increasing the failed pulse duration
would repair its cause. The previous generated native fixture implemented its
own keyboard movement, so it did not qualify the original SDL consumer.

In the November 9 original, trusted Right DOWN was recorded at
23:45:02.552Z and UP at 23:45:02.626Z; independent release was armed before DOWN.
The 23:45:02.630Z state still contains Right UP in the renderer queue and one
buffered DirectInput event. DOWN is absent from that page queue, which does not
prove arrival at SDL or a game state read while held. Guest focus is `0x10001`
both before and after, so a missing guest focus is not established. The final
capture began at 23:45:02.787Z; no later queue snapshot was retained.

The retained ready and final images were separately inspected again: score 0,
attached ball, unchanged paddle position, intact brick field. No new capture or
dependent input followed. Neither SDL state during DOWN, a DX5 decoder receipt,
the paddle handler invocation nor its +0x3c field is recorded. These are the
specific missing observations that prevent choosing a causal patch.

Both retained execution snapshots end at `0x603783`. In the offline load SDL
starts at `0x5f0000`, making this SDL RVA `0x13783`, following its DX5 input wait.
That mapping is an inference for the historical process, not a verified
historical load address or proof of a permanent loop. The corresponding
zero-timeout message-wait yield code also exists in the accepted source; this
comparison establishes no new regression.

## Validation and preserved identity

The original-consumer controls pass after the locked build: 40 native calls,
bounded returns, both keyboard routes and the original paddle handler.
`test/test-directinput-buffered-keyboard.js --rpc` passes 14 checks, including
rapid DOWN/UP ordering through production renderer, GuestRpc and WAT consumer.
`test/test-keyboard-focus-seed.js` passes; native-key controls pass all five
tests. `tools/verify-lbreakout2-251.js` verifies 220 original files, authentic CRT
and 219 companion mappings. `flock /tmp/wine-build.lock bash tools/build.sh`
passes. Logs and independently SHA/size-verified selected historical receipts
are retained in the run directory.

The module remains SHA-256
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`
(2186068 bytes), matching the failed original's module. SDL and EXE media hashes
are recorded in the controls output. The registered `lbreakout2_251`, original
DLLs/CRT, empty arguments, `C:\LBREAKOUT`, and repaired Canvas2D/noD3D identity
chain remain untouched. No production SDL/input patch was made.

No live box, watchdog or stop receipt exists for this task: box ID/state/expiry
and receipt are not applicable. The prior archived box was not resumed,
modified, or deleted. `/home` remained above 1.5 GB free. The next prerequisite
is observation of the bound original SDL/game consumer during an input
interval, sufficient to distinguish these concrete controls before choosing a
repair or another live attempt. Historical score 2000 remains the high-water
mark; this task stops at the precise causal blocker.
