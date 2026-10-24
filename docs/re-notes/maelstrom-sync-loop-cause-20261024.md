# Maelstrom Sync: packet barrier, with no overall timeout

The original `SyncNetwork` at `0x40e000` leaves its normal wait loop when **the missing current-frame player-slot count reaches zero**. Select completion is not that predicate. A one-second timeout retransmits to each still-missing player and loops again. There is no cumulative retry limit or elapsed-time exit in this function. A failed UDP receive after positive socket readiness instead returns `-1`. No production defect or repair is established by the existing capture.

This is a byte-backed control-flow finding, not a claim that uncaptured original return values were observed. The donor `4bb4a1423c9901c040db07cedb90e3c1a48a488f` proves select-return counts `0,1,3,972`, actual Sync entry `1`, RunFrame entry `1`, and no later PollEvent return in its bounded window. It does not capture EAX at either select or CheckSockets return, current-frame pointers, received packets, or Sync's missing count. Its `lastTick` is actual host-import clock state, not WASM `tick_count`. Neither an event drain nor a mutex ownership diagnosis follows from it.

## Original control flow

The [native slices and source identities](maelstrom-sync-loop-cause-20261024/slices.json) and [byte checks/control results](maelstrom-sync-loop-cause-20261024/control.json) bind the following facts:

| Original instructions | Meaning |
| --- | --- |
| `40e00a–40e017` | Toggle current input bank at `41f9f4`. |
| `40e01c–40e0aa` | Put current frame `41f9f8` and random seed in outbound packet, then call UDP_Send. Its return is not checked here. |
| `40e0af–40e0dd` | Count NULL pointers for `gNumPlayers` at `41f9fc` in bank `41fa3c + 12*CurrIn`; store count in EBX and `[S+10]`. `S` is ESP after Sync's prologue. |
| `40e105` | Skip waiting if this count is zero. |
| `40e10b–40e12f` | CheckSockets with `1000 + 60*[41f9d8]` ms (`gOurPlayer`). `40e12a` is the real CALL return PC, before cdecl argument cleanup. |
| `40e131–40e19a` | Readiness zero: log timeout and resend to missing players; do not decrement EBX. |
| `40e19f` | Readiness negative: skip receiving and return to loop test. |
| `40e1b1–40e1bb` | Positive readiness: UDP_Recv; nonpositive receive takes error return `40e48c–40e4a6`. |
| `40e1c1–40e282` | Accept only SYNC type byte zero, positive channel, a previously empty current slot, and matching big-endian frame. NEW_GAME/type errors/unknown channel/duplicates do not discharge the slot. |
| `40e288–40e37d` | Previous frame triggers retransmission; next frame is cached in the opposite bank. Neither decreases this frame's missing count. |
| `40e382–40e442` | Seed mismatch delays/logs for player zero or reseeds for another player; it does **not** reject an otherwise matching packet. Copy payload and fill current slot, then decrement EBX at `40e43a`. |
| `40e44a: TEST EBX,EBX; JNE 40e10b` | Exact repeat predicate. |
| `40e452–40e48b` | Increment NextFrame, toggle outbound bank, reset outbound packet length to ten, return zero. |

`SyncPtrs` has three slots per bank in these bytes. The reference source names and protocol interpretation come from the previously retained author-source archive `e7983c2c7376cdcca1944db1706d92aedd529638cf13358c88a60df982ba7b46`, `netlogic/netplay.cpp`; its relevant excerpts are retained alongside this note. That source is explanatory, not asserted to reproduce the Windows build. The original instructions independently establish every loop and decrement above. Expected initialized protocol state is assumed; this is not a proof of safety under corrupted packet lengths or out-of-range channels.

Even a normal single-player game uses this barrier: reference `CheckPlayers` adds player 1 if none were specified, creates a UDP socket, assigns its own bound address (falling back to `127.0.0.1`), and binds each player to both broadcast channel zero and its individual channel `i+1`. Sync sends to channel zero and expects the self packet too. Thus one player is not a source-defined bypass. The captured game's player count, bindings, destination and successful self delivery remain unobserved; this explains a dependency, not a demonstrated loopback defect.

## What select completion does and does not mean

The EXE import trampolines `4134e6/ec/f2` use IAT entries `4191ac/b0/b4` for UDP_Recv, CheckSockets and UDP_Send. SDL_net's CheckSockets implementation starts at preferred `100012b0` (retained runtime `7a32b0`). It constructs a read fd_set and timeval, calls select at `1000135d`, and resumes at `10001362` / `7a3362`. It saves select EAX in EBP. At `10001366` it tests C errno for `4` and can internally retry select; after that, positive readiness marks ready sockets using `__WSAFDIsSet`, and `1000139c–100013a7` returns saved EBP. Consequently **972 completed selects do not by themselves prove 972 completed CheckSockets calls or Sync iterations**.

The matching module source is `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a:src/09d-winsock.wat`. Its `handle_select` pumps the wire, counts ready members without changing the sets, and, if none are ready, parks until its finite deadline. `vsock_block(24)` restores ESP, sets EIP to the current thunk, sets yield reason 8, and requests reentry. On real completion, the handler clears its waiting flag, rewrites fd_sets to ready members (empty on timeout), and stores the readiness count in guest EAX. `nfds` is not used as a socket count. Datagram read readiness depends on queued bytes or terminal flags; the parked frame's count-one fd_set describes the pending request, not a completed result.

The repeated captured returns are compatible with repeated empty timeouts, and also with other native paths which preserve the missing count. Their approximately one-second cadence does not distinguish those paths. Historical select has no ordinary `-1` assignment in this handler, but no original EAX was captured; source semantics do not substitute for observing it. A present one-second timeval does not prove a broken select timer, and fresh per-call deadlines are expected after a retransmission.

## Smallest remaining observation

The unresolved predicate is: **does CheckSockets return zero while a current-frame player slot remains empty, or does it return positive and deliver a packet that Sync rejects?** Also distinguish SDL_net's errno retry before attributing each select return to Sync.

The [bounded recipe](maelstrom-sync-loop-cause-20261024/capture-recipe.json) preserves the exact donor argv/mount/input/module/clock and substitutes only passive trace flags. It is a future coordinator decision, not a runtime assignment or an executed experiment. No longer run, timing variation, readiness modification, network option or production rewrite is proposed.

Use original block entries/real CALL return PCs, not arbitrary interior instructions. `7a3362` is immediately after the CALL to select, before `MOV EBP,EAX`; `40e12a` and `40e1b6` are CALL returns, before `ADD ESP,8`. At either Sync return PC, `S=ESP+8`, so saved missing count is `[ESP+18]`; packet fields are channel `[S+20]`, data pointer `[S+24]`, length `[S+28]`, maxlen `[S+2c]`, and local packet buffer starts `[S+3c]`. Read the first ten bytes as type/reserved, big-endian frame and seed. At the loop-test entry `40e44a`, live EBX is the missing count; `40e452` is the zero-count exit successor. The historical counter compares EIP at decoded block entry. These anchors are CALL-return successors or native branch destinations/fallthrough successors; `4019ab` remains an interior PC of block `4019a8` and must not be used as a no-Sync counter.

If CheckSockets is zero and slots remain NULL, the next repair scope is not yet known: outbound UDP_Send success, address/channel binding and self delivery would then be the specific missing link. If positive, the captured receive metadata/header selects the rejection predicate above. If only select-return traces appear, inspect the errno retry before assigning any Sync timeout cause. A receive failure selects the existing error path rather than a successful barrier exit. No permanent-hang, gameplay, socket-defect or mutex claim is made.

## Identities and offline validation

Original EXE: 135168 bytes, SHA256 `0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5`; SDL.dll: 225280 bytes, `02433232425e68009843bd3ecec20ad67453a48487f7b5828c595b76e2f9d373`; SDL_net.dll: 24576 bytes, `46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95`. The helper derives raw offsets from PE sections, not guessed filenames/VA arithmetic. Historical WASM identity remains `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`; no module was instantiated. Canonical harness `d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e:test/run.js`, SHA256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`, was inspected read-only.

Run the [offline helper](../../tools/maelstrom-sync-predicate.py) with Python 3, `--original /tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6 --manifest docs/re-notes/maelstrom-select-return-capture-20261024/manifest.json`. Under fresh MemAvailable >=805306368, CPU/wall 60s, it checks all three full identities against the donor manifest, ten byte anchors, two rejecting native-byte mutants, fourteen packet/readiness controls, 972 consecutive timeout controls that retain the missing slot, and a signed deadline wraparound control. This abstract Python control substantiates source predicates only; it executes neither original instructions nor historical API code. It is not a synthetic reproduction of the guest symptom.

The isolated git-init checkout uses explicit non-cone sparse paths and read-only alternates from the exact donor; strict SSH verified the input branch SHA. No tree mount or runtime is executed in this task. The unchanged donor parser/mount receipt is reused, with its enumerated 48 files including `Docs/Ambrosia_Software,_Inc._FAQ.txt`, rather than reconstructing a comma-separated mount. Root tracked/index/refs, original binaries and donors remained read-only. Native disassembly totals 25811 bytes; initial two >8KiB presentation slices were retained/charged and split into <=7793-byte evidence slices as a routine bookkeeping correction. No instruction content was discarded. Ten-module compilation/input-output is inapplicable: zero build/compiler/guest/browser/acquisition operations and zero new tools.

Admission, full-session/events/history, positive SQLite growth, allocated directory/file blocks, future growth, capture allowance and 8MiB reserve are retained under `/tmp/maelstrom-sync-loop-cause-oct24`, with compact resource receipts alongside this note. Git preserves the small helper/evidence/note, not the original binaries; recovery inputs and exact historical Git revisions are named above. Box `bx_ktknkc9m` was coordinator-verified STOPPED at 08:42:14.624 UTC (`stop_9e265d7763d09258`), snapshot verified 08:41:39.769 UTC; no lifecycle access was attempted. Its former expiry was 08:53:24.080 UTC. Coordinator retains lifecycle ownership and chooses any next assignment.
