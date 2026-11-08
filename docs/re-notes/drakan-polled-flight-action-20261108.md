# Drakan buffered keyboard observation boundary, 2026-11-08

One fresh current WebGL original reached the living rainy level and received one documented T2000 ascend action. Held, released and later settled images show no clear terrain displacement. Flight and outgoing attack remain unqualified. The new boundary is specific: **the locally qualified immediate-key observer does not cover Drakan's buffered keyboard `GetDeviceData` path**. Absence of T in that observer is not proof that the game failed to poll or consume T, and is not an emulator defect.

Evidence is in `scratch/runs/20261108-drakan-polled-flight-action/` (ignored). Predecessors: [native warning/gameplay](drakan-native-warning-gameplay-20261108.md), [demo](drakan-demo.md). Only this note is committed; production source remains owned by the active protocol worker.

## Current coherent closure and local controls

The tracked runtime is read from immutable Git blobs at `19d2fb24aff735368847b737e87fa5ab7aae180a`. An in-memory Git WAT VFS compiled through production `compileClosure`, with the region-layout section, produces module SHA256 `7ec49cbbae4cb177909fd8fd9d3599713ee5f2a5ffb7f7e8c890848a540052bf`, 2,182,452 bytes. Actual original CPU and render Worker bytecode both match. `published-compile.json`, `runtime-pins.json`, excluded peer WIP diff and the new-file patch for the pinned untracked `lib/wininit-boot.js` identify the inputs. The active protocol WIP was excluded. This is a coherent published-source compile, not a claim that the current shared WIP passed its locked build. No tracked code was changed.

All 64 existing fixture/media files are pinned and unchanged from the prior run's exact per-file pins; the registered manifest and startupRegistry were not edited. Installed `readme.txt` documents Up/E forward, T/Right Shift ascend, mouse direction, left mouse primary. The 686 staged runtime inputs remain unchanged through shutdown; all 231 HTTP200 responses match staged byte hashes. Git plus patches is the source archive; no source or media archive was created.

The run-only observer intercepts production `WebAssembly.instantiate` before guest startup and forwards each original `get_key_down_state` and `get_mouse_buttons_live` import once, with the same receiver, arguments, return and exception. It records counters and changed return values; it makes no extra input poll or guest-memory write. Contract tests exercise return values, exceptions, direct receiver preservation, zero snapshot polls and unchanged memory. A tiny actual-WASM control/observed pair verifies the import receiver stays `undefined` and the call/result counts match. This is semantic transparency, not a performance/zero-overhead claim.

The retained native MessageBox → actual production WebGL D3DIM triangle fixture was extended with ordinary DirectInput creation, standard formats and acquisition. In `local-fixture3`, the actual production CPU Worker returns Up `0 → 32768 → 0` and mouse `0 → 1 → 0`, with independently released 1000ms native events. Native modal negatives and strict graphics owner/module/replacement/readiness/freshness/sticky-UNKNOWN controls pass with zero negative dispatch. All three local Chromes exit0 and all own local PIDs, ports, profiles and writers drain.

Two earlier fixture attempts are preserved: the first omitted SetDataFormat, so Acquire correctly refused and no input imports were called; the second was stopped before warning input to correct the observer's strict receiver forwarding. The correction and actual-WASM regression precede the game launch. There was no guest UNKNOWN or input replay.

## Sole watched original and action

Box `bx_fav8mwzr` was UUID-idempotently allocated at 07:20:28Z, after the independent detached supervisor/watchdog was observably armed. Initial expiry was 07:45:28.653Z; the immutable watchdog deadline was 25 minutes. One heavy runtime ran in the box. Actual CPU target `E7FA9AC1674DCB70CE84F96BBABA3388`, render target `8541E87C0F3A40244BE211582D322564`, process1000, endpoint1/slot0 and exact owner/module binding persist. The owning context is WebGL2, ANGLE Intel UHD Graphics620/Mesa; that string alone is not a physical-GPU qualification.

Ordinary native warning Enter, startup Enter activations, production-requested pointer lock, qualified native relative (-6,-75) New Game hover/click and (-2,+69) Normal hover/click reach loading and then the rainy level. The accepted warning/handoff is reused as infrastructure, not the deliverable. A premature read-only title-image retrieval found ENOENT before the exact command ACK; evidence was retrieved after completion without replaying input. Two over-specific review descriptions of startup/loading images are explicitly corrected in retained correction records; consumed reviews were not rewritten.

`load-settled.png` clearly shows the mounted dragon, full health, ridge ahead, trees, river and right-hand bridge, with no selected attack target. This separately reviewed living scene admits one T2000 action. Trusted KeyT down/up timestamps differ by exactly2000ms; the independent release fires without awaiting sampling. The held frame, `ascend-released.png` and `postrelease-settled.png` preserve essentially the same terrain landmarks. Rain and dragon animation are excluded. No attack was fired, no incoming damage was counted, and no ineffective hold was repeated.

The production observer's total/mouse counts advance from387/367 before the action to395/375 after release and420/395 after passive settle. Queried keyboard VKs remain only16,17,18,91,92. No VK84/T or VK38/Up return was observed. Host trusted-event delivery and exact ACK therefore do not establish the missing guest consumption.

## Precise new API boundary

Static analysis of the pinned original `drakan.exe` resolves why an immediate-state fixture is insufficient:

- `0x40654e`/`0x406578` use system-keyboard GUID at `0x46e900`; the device is retained at object offset `+0xdc` (`0x406595`). `0x4065dd` installs the data format, and `0x406614` sets property1 (`DIPROP_BUFFERSIZE`) to64.
- The input loop at `0x405770` gates on device/activity flags. `0x405865` calls vtable `+0x28`, **GetDeviceData**, with 16-byte records, capacity64, flags0. Errors `0x8007000c`/`0x8007001e` branch to Acquire at `0x405835`. The keyboard arm iterates records at `0x40591c` and calls `0x4059b0` at `0x405929`.
- Production WAT's keyboard GetDeviceData branch calls `host_di_keyboard_buffer` and `di_kbd_collect`, not `host_get_key_down_state`. The host operation ABI is2 count,3 event,4 timestamp,5 sequence,6 consume,7 overflow; events encode VK plus down bit `0x100`. T down/release would be `0x154`/`0x54`, mapped to DIK by WAT. Those original return values and consumption were not recorded here.

The other discovered `GetAsyncKeyState` imports are not evidence of T polling: `drakan.exe`'s sole static call pushes Shift16; both `dragon.rfl` calls push Control17. The retained disassemblies prevent misattributing those modifier APIs to forward/ascend consumption.

This establishes the observer coverage gap, not the runtime outcome of GetDeviceData, acquisition, mapping or overflow. **Next: locally qualify a buffered DirectInput fixture and a transparent observer of the actual original `di_keyboard_buffer` event/consume/overflow returns (and identify any acquisition/HRESULT failure before absent polls), then require guest down/release plus a terrain or target consequence.** Preserve exactly-once import forwarding, no extra polls/writes, independent releases, exact owner/freshness and sticky UNKNOWN. Do not lengthen or repeat the ineffective T/Up holds to compensate for absent consumption evidence.

## Validation and shutdown

`validation.json` verifies44 PNG CRC/decode results,231 HTTP200 payloads,14 exact command/ACK pairs, no UNKNOWN and the same live recovered module/owners. All188 remote references (13,618,988 bytes;172 unique SHA256 payloads) were retrieved after full runtime drain and independently reread/hash-verified before requesting normal stop. Chrome exits0; driver/Chrome PIDs, server/debug ports, profile and writer lock are absent. Disk stayed above5GB.

Normal shutdown completed at07:28:14.661Z, receipt `stop_abc912e0df0351a2`, forced=false, error=null. Final box state is archived; expiry/archiveAfter is null. Both supervised children exit0 and the supervisor ends with no children. No old box resume/delete, deployment, RAM gate, guest patch or forced configuration/scene/clock/seed was used. Full27, parity, audio and unmeasured FPS remain open.
