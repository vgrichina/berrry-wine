# TR2 drawn-weapon Action diagnosis — 2026-11-08

**No emulator Control defect was established.** The unchanged production path returns held Control in the exact DirectInput format this TR2 executable requests. The retained encounter proves trusted browser delivery and eventual release, but does not prove a game poll observed Action during any hold. Target acquisition, facing and sufficient simulation time remain distinct unresolved causes. No production repair is justified by these observations.

Run: `scratch/runs/20261108-tr2-weapon-input-1636/` (R). Original encounter: `scratch/runs/20261108-tr2-dog-encounter-1610/` (O), published `598e4f815`. Diagnosis starting SHA `220947e359a9b895a82a55d2db92873a6218ab73`; analysis recorded HEAD `404b1e3d6` after a peer's documentation publication. Production input sources are unchanged from the original's `9761d8b9ae1ef98b6927fbff41f696fb13f10704`; both relevant binary diffs are empty. Exact full analysis SHA, file hashes, media references and receipt analysis are in `R/analysis.json`. No closed journal was changed.

## What the retained pictures and receipts establish

I inspected `O/review/webgl/right-4.png`, `advance-9.png`, `dog-fire-1.png`, `dog-fire-2.png` and `dog-fire-fresh.png`. Right-4 shows drawn pistols and full health. Advance-9 shows the dog ahead. Dog-fire-1 shows it approaching; later captures show it adjacent to Lara's left side, with substantial health loss and then an empty bar. These pictures establish neither a successful hit nor a target lock. A still capture after release also cannot exclude a transient muzzle flash during the hold. The wall beside Lara and the dog's changing bearing are visible, but neither is proven to have prevented firing.

Existing PNG SHA-256 values, without copying the pictures:

| Capture under O/review/webgl/ | SHA-256 |
| --- | --- |
| right-4.png | `aefb8049d4e2daeb8b0fe0632ff79e5e982ab385bbd065c1f165e887eda36689` |
| advance-9.png | `1d0dcd4a6caf30b0541f2f5afdfb112bde65db16ca7d494a7356fb8f0babbe32` |
| dog-fire-1.png | `483756dbcf22a64f2118437d8aa32d1bb8eb80337f8433263d7498b23bd18365` |
| dog-fire-2.png | `1581e213fff74804e76ab84207b3a6359431e130519152ee8c19afc6901c2060` |
| dog-fire-fresh.png | `0f1355dfb1e21242a35d9dfda3f48d2708ab886568bc9cc46105ea5785ecc799` |

`O/final-native-input-state.json` contains three balanced, trusted `ControlLeft` down/up pairs targeting `screen`. Their browser-event durations are 2000, 2018 and 2001 ms. Independently released hold receipts report 2000, 2018 and 2000 ms; the one-millisecond final difference is between receipt and DOM observation timestamps, not an unbalanced release. All final 16 physical keys are up.

The important missing observation is specific: every hold's `physical` samples contain **only VK 37–40**, not Control/VK 17. The receipts explicitly disclaim proof of DirectInput polling or simulation steps. Samples wholly inside each hold show:

| Hold receipt under O/retrieved/webgl/ | Samples | Slice sequence values | Flip counters |
| --- | ---: | --- | --- |
| input-dog-fire-1-hold.json | 11 | 2337, 2345, 2347 | 774–775 |
| input-dog-fire-2-hold.json | 19 | 2399, 2400, 2405, 2407, 2409 | 789–791 |
| input-dog-fire-fresh-hold.json | 19 | 2521, 2527, 2529, 2532 | 826–828 |

Those are small observed counter spans, not FPS or counts of Action polls. A slice can resume rendering or execute many blocks without reaching the input poll. A real-time two-second hold cannot be assumed to cover two seconds of game simulation. Missing polling overlap is therefore a supported possibility, not a diagnosed failure of scheduling or input.

The [original PC manual, printed page 7](https://cdn.akamai.steamstatic.com/steam/apps/225300/manuals/manual.pdf) distinguishes drawing from aiming/targeting. Holding Action retains the selected enemy even if lock is lost; facing affects continued fire, and release permits a different target. Pistols have unlimited ammunition. This makes target/facing mechanics relevant, while the retained stills and receipts cannot select them as the actual cause.

## Production path and actual executable polling

The exact existing executable is `test/binaries/candidates/tomb-raider-2-demo/game/TOMB2.EXE`, SHA-256 `0811efa84bfab8c458b9e29976088152db4c14601a99ca4910c75a2d009233aa`. Existing `DATA/BOAT.TR2` remains SHA-256 `e710716fcaf039fb3462e26e33f0ead8eb45bd01c8bbfa036c455a1d19823d9e`. No media was copied. `R/tomb2-disassembly.txt` is static `objdump -d -Mintel` output, not game execution.

1. `tools/native-key-controls.cjs:eventForKey('Control')` supplies `key: Control`, `code: ControlLeft`, `windowsVirtualKeyCode: 17`. O's ordinary hold executor sends native CDP down/up with those fields and an independent release. A successful send alone is not evidence of a held guest input.
2. `lib/browser-input.js:wireCanvasInput` forwards the DOM `keyCode` and physical-side metadata to `handleKeyDown`/`handleKeyUp`. The renderer updates its physical map immediately. For left Control, aggregate VK 17 and left VK 162 are down; right VK 163 stays up. Physical release is separate from draining queued Win32 messages.
3. `lib/host-window.js` exposes `get_key_down_state`, `get_async_key_state` and `get_keyboard_state`. Win32 message processing can use an event's key snapshot. Outside an open event, the physical map supplies current state. `GetAsyncKeyState` additionally consumes a pressed-since-query latch; that latch is not the DirectInput held bit.
4. In the production Worker route, `host.js:_workerKeyBitmap` reads that physical map; the input pending publisher publishes it to the broker on queued input. `lib/guest-rpc.js` serves `get_key_down_state` from the published bitmap when no event is open, with its existing generation/event cache rules otherwise. The regression exercises actual bitmap generation, publication and Worker import code; it does not substitute CLI `test/run.js`'s host override.
5. `src/09a8-handlers-directx.wat:$handle_IDirectInputDevice_GetDeviceState` requires acquisition and a matching buffer size, then emits `0x80` at each down DIK. Both DIK `0x1d` and `0x9d` map to aggregate VK `0x11` in the production table. Thus this implementation reports **both Ctrl DIKs** for ordinary ControlLeft. That existing alias is sufficient for this game's Ctrl handling; no side-mapping repair was made.
6. Static disassembly of the actual game identifies its keyboard device at guest `0x4d94e0`. Setup at `0x447570` creates GUID_SysKeyboard, passes DIDATAFORMAT at `0x458640` and acquires it. The regression passes the executable's actual 24-byte format and 4096-byte object table through the production standard-format validator, which returns 256. The standard keyboard branch tested above is therefore the relevant format, rather than an assumed custom format.
7. The game's input update at `0x44d2a0` passes buffer `0x51b078` to `0x4471f0`. At `0x447203` the latter calls device vtable `+0x24`, **GetDeviceState(this, 256, buffer)**. It retries after Acquire on `DIERR_INPUTLOST`; this gameplay path does not retrieve buffered key edges. The executable also imports GetAsyncKeyState, but its static call at `0x4467ab` requests VK_SHIFT, not the weapon Action key.
8. Key-test routine `0x44d180` reads configurable bindings at `0x467f14`, tests bit `0x80` in the DIK buffer, handles opposite-side modifier fallback, and conditionally checks default bindings at `0x467ef8` using conflict flags at `0x51b040`. Default slot 8 is DIK `0x9d` (right Ctrl). Input update calls slot 8 at `0x44d3bf`; success ORs `0x40` into EBX at `0x44d3cd`. Its input mask is stored at `0x51b178`. **File defaults do not prove the saved runtime bindings or conflict flags.** Neither those values nor this branch's execution was captured during the original holds.

The new regression asserts exact instruction bytes for the polling call, DIK-buffer argument, key test, modifier fallback and Action-mask construction. This supports the static trace; it does not execute the game's aiming/firing logic or claim original-time poll coverage.

## Focused regression and authority

Added `tools/tr2-action-path.test.cjs`. It reuses existing DOM scaffolding and the existing focused WAT dependency extractor, invokes real production callbacks, and compiles the real GetDeviceState path with trap-only dependencies outside its scope. Device setup, DOM objects and memory are fixtures. There is no browser process, full emulator launch, original execution or local heavy runtime.

Commands:

```sh
node tools/tr2-action-path.test.cjs
node tools/tr2-action-path.test.cjs --rpc
node tools/tr2-action-path.test.cjs --control-ack-only       # expected exit 1
node tools/tr2-action-path.test.cjs --rpc --control-stale-bitmap # expected exit 1
flock /tmp/wine-build.lock bash tools/build.sh
python3 scratch/runs/20261108-tr2-weapon-input-1636/analyze.py
```

Both positive modes pass: actual game format recognition; ACK without delivery leaves DIK up; down holds across repeated polls; Win32 async/keyboard consumers see Control; release clears DIK before message drain; an entire pulse between polls is absent from immediate state; draining old messages does not revive it; browser blur releases it. The two deliberately disconnected paths fail as required. These controls distinguish held guest input from browser acknowledgment and stale publication.

The first harness attempt refused an outdated renderer hash embedded in the historical DOM fixture. That failure is retained in `R/action-direct.log`. The new test explicitly reuses its scaffolding while removing exactly its two historical source-pin assertions; it reads current production files and rejects source-override environment variables. This does not update or supersede the historical fixture's acceptance. Current hashes are recorded in `R/analysis.json`; final focused compilation hash and selected function hashes are in the test logs.

`R/analysis.json` independently rereads **all 614 provider files**, including all 29 physical helpers, against O's unchanged manifest. No mismatch. The new standalone test is not a runtime provider. No provider/helper, accepted manifest, backend, input policy or guest state changed, and no repin was needed or claimed. Any future observer/helper byte change must go through the normal explicit helper repin before use; the old 614-provider acceptance cannot authorize changed bytes.

## Bounded experiment for the next fresh gameplay worker

Prepare and cheaply test a bounded read-only observer **before another original**, using the existing normal helper/pin workflow. Keep the accepted owner/backend and ordinary input/release limits. Do not replay O.

For one independently released ordinary Control hold of at most 2000 ms, with pistols drawn and the dog still ahead, correlate native down/up times with:

- physical VK 17/162/163 and the owning Worker's published bitmap;
- actual game GetDeviceState return at `0x447206` (and retry return `0x447236`), HRESULT and returned `0x51b078[0x1d/0x9d]`;
- slot-8 binding/conflict values, and whether execution after `0x44d3cd` has EBX bit `0x40` set;
- a few current reviewed pictures spanning the same hold, including visible aim/arm pose and any flash/hit consequence.

Cap observation to that single hold and a short passive consequence review; release independently regardless of observer progress. Use passive observations rather than halting the guest for the duration of the hold. Remove bounded observers afterward. If an observer cannot qualify the actual poll, stop and report that result; do not silently lengthen the hold, repeat it, alter bindings, or declare an emulator defect.

The outcomes select different next work: host held but no poll means insufficient input/simulation overlap; a poll with DI_OK and zero Ctrl bytes despite the correct published bitmap identifies a concrete downstream input failure; nonzero Ctrl bytes with Action clear points to actual binding/conflict evaluation; Action set with no firing evidence directs attention to weapon/aim/target state. A fresh reviewed facing adjustment or release/reacquire can then be separately justified by the observed game state. This experiment has not been executed here.

No box was created, resumed or deleted. Box ID/state/expiry/stop receipt: **not applicable**. Closed encounter box `bx_pg79mqj7` remains archived under its existing receipt; no lifecycle action was taken. No deployment or subworker. Full27, parity, audio and FPS remain open.
