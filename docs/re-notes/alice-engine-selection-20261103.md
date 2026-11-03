# Original Alice engine: local movement selection, 2026-11-03

The original engine selects the movement client by packet address and qport, then passes that engine client's record pointer to fgame API `+0x24`. For the local loopback path, this establishes an index derived from the engine client array, **not a hardcoded slot zero**. The retained decoder now checks this selection before following the [ground observer's](alice-ground-observer-20261103.md) record → Player → state chain. Its offline fixture selects index 1 while a coherent Player exists at index 0; selecting that other Player is rejected.

This proves the static selection rule for the supported loopback layout. **The actual stopped campaign's index, origin, yaw and contact remain unavailable.** No coherent authentic engine/heap sample or independent capture-phase proof exists here. Every decoder output, including positive host fixtures, keeps `usableForFooting: false`. No live footing, plank support or campaign success is claimed.

Input main was `0d92be156557e0c3282ec24562681d8a39f9b395`, including accepted source-only observer `7d3872d4a677fd35a14f2495484a2abcfa9177c4`. All executable helpers, disassembly, exact byte/signature manifests, test results, recovery instructions and full hashes are retained only in ignored `scratch/runs/20261103-alice-engine-selection/`. Predecessor evidence was read without modification. Only this note is committed.

The exact original PE32 binaries are:

| Binary | SHA256 |
| --- | --- |
| `test/binaries/candidates/alice-demo/alice.exe` | `61857b521eb7260c28b3ae6960fa8ee18d4d3679b6190f5221131e382e0f3a72` |
| `test/binaries/candidates/alice-demo/demo/fgamex86.dll` | `42838c2a96520c4b8b42e710d7d5bcf3a7a7f2a71b141a9f75bff01ee28f3d4c` |

Both were extracted into this run from the retained dependency archive, SHA256 `48e24e19444c7614dff027144d41cb1c0dbb391de237a68fa558d83fcf78c1d7`, and compared byte-for-byte with the local originals. Addresses below are original preferred VAs: engine base `00400000`, DLL base `10000000`. Relocation is unsupported by the helper.

## Loader, API and actual movement consumer

`0046be30` resolves `GetGameAPI`; `0046bf98` pushes its original name at `0051ec70`, and `0046bfbe: ff d0` calls the resolved function with the import table. `0046bfc9` is the loader's return, not an API storage instruction. Its directly located caller is `00454936: e8 f5 74 01 00`; **`00454940: a3 08 0e ac 00` stores EAX at `[00ac0e08]`**. `0045495b..60` checks API version 4.

The DLL returns `101cd200` at `10097000`, and `1009706c: c7 05 24 d2 1c 10 30 7a 09 10` installs movement callback `10097a30` at export `+24`. The original engine consumer is:

| Instruction | Meaning |
| --- | --- |
| `00452f30: 8b 44 24 04`; `00452f34: 8b 54 24 08` | Arguments are engine-client pointer and command pointer. |
| `00452f3a..47` | Copies five command DWORDs to client `+20414`. |
| `00452f49..50` | Calls movement only when engine-client status is 4. |
| `00452f52: 8b 80 30 04 02 00` | Reads that client's record pointer at `+20430`. |
| `00452f58: 8b 0d 08 0e ac 00`; `00452f5e: 52`; `00452f5f: 50`; `00452f60: ff 51 24` | Calls stored API `+24` with `(record, command)`. |

The direct call at `004532f1` supplies the engine client held in EBX. `004531c0..00453309` decodes 1–32 commands and checks status 4 before processing them. Its two located call sites, `0045304a` and `0045305d`, come from command-message dispatch `00452f90`. That dispatch receives the client selected by `004563f0`, through `00456516: push ebx; 0045651d: call 00452f90`. `engine-disassembly.txt`, `api-references.txt` and the focused extracts retain these searches and instructions. The claim concerns this traced API consumer; unrelated virtual calls using offset `+24` are not identified as fgame movement.

## Local endpoint → engine index → record

The original local client transmits through channel `00c17904` (`00428ce0` pushes it before calling `00447060`). Channel `+0` is socket direction; setup at `0042be2b..34` passes direction zero. Original `00447020` copies the address into channel `+8`. In ordinary and fragmented client packets, `004471e4..f3` and `004470b7..c6` write the low 16 bits of cvar `[00bc78b4]+20` through the two-byte writer `00445700`.

Address type **2** is established by original code/data: `00447874` tests 2 and formats string `005187b8 = "loopback"`; `00447a40..4c` returns whether the type equals 2. `00447b80..d7` routes type-2 packets into the in-process queue via `00447b10`; that routine flips socket direction with XOR 1. `00447a50..00447b01` reads the queue and emits source-address type 2. The engine pumps queue direction 1 at `0043972e..52` into `004394b0`, which calls `004563f0` at `004394dd`. This is original binary evidence for the local path, without public engine source.

The receive selector is explicit:

* `00456433` reads the packet short; `00456444: 25 ff ff 00 00` masks it to 16 bits.
* `00456438` loads the max-client cvar pointer from `[00ab8cd8]`; its integer is `+20`. `0045643e` loads the client-array root from `[00ab8d0c]`.
* `00456453` starts EBP at index zero; `00456459` skips status zero. Address at client `+28e90` is compared with the packet source by `00456480: call 004477f0`. That comparator first requires equal types and immediately accepts equal type 2 (`004477fc..00447806`).
* `00456490: 8b 83 a4 8e 02 00` reads client `+28ea4`; `00456496: 3b c2` compares it with the packet qport. Equality reaches `004564d0` with the selected client in EBX and its index in EBP.
* Otherwise `0045649f` increments EBP, and `004564a0: 81 c3 48 54 03 00` advances the client by **`35448`** bytes, bounded by max clients. Failed selection reaches `004564ab`.

The decoder supports the captured local channel only when its direction is zero and its address type is 2. It scans the bounded engine client array for nonzero-status loopback/qport matches, requires exactly one, then requires status 4. Native code uses the first match; rejecting ambiguity is an intentionally stricter observer rule. The JSON `localSlot` must equal this derived index. A matching inactive/zombie/connecting client is rejected. Remote endpoints, missing bytes and unsupported counts are rejected rather than mapped to slot zero. The helper's 32-client ceiling is a conservative supported-layout limit.

Original `00452bed..00452c12` derives index `i` from `(client - [00ab8d0c]) / 35448`, calls `00453370(i)`, writes `i` into the record, and stores that record at client `+20430`. `00453370..82` computes `[00b59b08] + i*[00b59b0c]`. The connection path also initializes `+20430` through this function at `004527a9..b5`.

These engine roots are supplied by the DLL: the import table starts at original engine stack `+8` (`004544bb`), its address is pushed at `00454801`, and original `004548de` places `00453770` in import offset `19c`. GetGameAPI copies imports to `101cd268` (`10096ffb..10097005`). Thus DLL call `[101cd404]` at `10096065` is that callback. Its arguments are `(records, clientCount, 2dc, states, 840)` from `10096048..65`. `00453770..a0` stores records/stride at `00b59b08/0c` and states/stride at `00b59b14/18`. The decoder requires these engine mirrors to agree with the DLL globals and export roots.

Consequently index `i` selects record `records + i*2dc`, with state `states + i*840` (DLL initialization `1009600b..45`). `100e5b85..a4` independently computes the state index from its pointer and writes state `+9c`. The decoder checks that field, record number/active flag, record-state pointer, Player vtable, object number, record/object/state backlinks, and the exact engine-selected record pointer. A coherent other Player fails the engine selection check.

## Retained executable checks and remaining evidence

Run offline from the repository root:

```sh
python3 -B scratch/runs/20261103-alice-engine-selection/test_decoder.py
python3 -B scratch/runs/20261103-alice-engine-selection/decoder.py \
  --engine test/binaries/candidates/alice-demo/alice.exe \
  --dll test/binaries/candidates/alice-demo/demo/fgamex86.dll
```

There are **24 passing tests**. A strict small interpreter executes the original receive-loop bytes and its actual address comparator for indices 0, 1, 2 and no match, against remote-address, wrong-qport and free-slot decoys (12 cases). It also executes original record-index arithmetic, engine-client and DLL-state division sequences for all supported indices 0–31, and movement argument preparation/status gating. Unknown instructions fail; this is bounded instruction-block testing, not game execution. The inherited original contact blocks, heading conversion and original-binary mutation checks remain covered.

Additional tests reject a coherent wrong index/player, incorrect selected record, duplicate local matches, wrong API/callback/roots/strides/counts, wrong channel/direction/qport, stale or malformed backlinks, unsupported phases, stale time/session/digest, invalid pointers, inactive support, nonfinite/incoherent copies, and changed captured DLL/engine code. Full original binary hashes and SHA-pinned code manifests are checked before candidate decoding. The retained host fixture is explicitly synthetic, never guest memory or a save; its output cannot qualify a runtime observer.

Origin, native view yaw and contact validation from the predecessor are preserved. `walking` remains accepted native walking support; `groundPlane` remains a separate collision-plane flag. A steep contact can have plane true and walking false. Object contact pointers and contents-depth handling remain distinct from those flags. No contact flag identifies plank geometry, edge margin, or sustained support.

The first remaining boundary is dynamic: no authenticated coherent bytes establish the actual local channel/qport, engine client array/count/index, API pointer/roots, Player and state in the stopped campaign, or that their copies were captured after a completed movement update. A JSON phase declaration cannot prove this. A single snapshot also cannot prove allocation-generation continuity when addresses/backlinks are reused. Static mode therefore returns null origin/heading/contact. A separately authorized read-only capture would need those coherent bytes, module identity/base, independent capture/session/time anchors and phase proof, followed by neutral-frame and known unsupported/airborne comparisons. No such capture or campaign restart is authorized here.

No production edits, build, game launch, boat access, guest write, lifecycle action or subworker occurred. Existing `bx_9vpsvd62` remains recorded **STOPPED and untouched**, original expiry `2026-11-03T15:53:37.051Z`; no box was assigned. Recovery/custody remains with the coordinator. The run's `RECOVERY.md`, `inputs.json`, `result.json`, `final.txt`, publication record and `SHA256SUMS` retain reproduction and the exact outcome.
