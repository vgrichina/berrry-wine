# Jedi shield/script correlation: original engine boundary, local script missing

**Partial source proof; `readyForCampaign=false`.** The original engine's
message delivery, script return and generic inventory stores are now pinned.
The first unresolved local branch is the actual attached script read at
`0x4dfe04` (`victim+0x29c`) and its null test at `0x4dfe0c`. The retained
artifacts searched do not contain the original `kyle.cog` body, original GOB
payloads or a coherent local compiled-script/binding capture. Therefore neither
actual shield-script arithmetic nor **all** local shield-decrement paths is
established. This is an exact unresolved branch handoff, not closure of the
runtime first-damage prerequisite.

Input was `36f205f11e6a1c0afe10db09de90356ebfabc2aa` on main. Accepted original
source-ancestry proof `88374ba3b` and original Coords/health/inventory/clock
anchors are reused unchanged. No game, build, browser, boat operation, guest
write, engine call, restart, production tracing change or subworker occurred.

## Original engine evidence

All VAs refer to original JkDemo.exe, 1388032 bytes, SHA256
`0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46`.
The ignored run `scratch/runs/20261103-jedi-shield-script/` retains original
bytes, disassemblies, sealed prior/new anchor manifests and reproducible tools.
New manifest `script-anchors.json` SHA256:
`456bc5c61024388c20eba6fbf479531c806f240276a7e2d08b6f634e9b67b62b`.

| Original boundary | Byte-supported meaning |
| --- | --- |
| `0x4ccabf → 0x4dfda0` | Entry stack: return, victim, raw source, message10, amount float, damage type float, zero, zero. The source pointer is not resolved ancestry at this boundary. |
| `0x4ccaa2…0x4ccab7` | Damage type is written as low32 with zero high32, loaded using **FILD qword**, then rounded to float. Repository disassembler incorrectly prints word for `df 6c 24 10`; GNU objdump confirms qword. |
| `0x4dfdcb` | Message10 initializes the accumulated return from param0 (incoming amount). No admitted listener is not equivalent to a zero return. |
| `0x4dfdd3…0x4dfe00` | Nonnull source supplies index+4 and type+0xc; sender/source mask is derived from type. Null source uses index−1/type0. This does not preserve a source generation by itself. |
| `0x4dfe04`, `0x4dfe97` | Invokes scripts at victim+0x29c and +0x2a0 if nonnull. The filename/local binding is not proven by these loads. |
| `0x4dff3d…0x4dff5c` | Additional linked listeners match victim pointer, victim+0x74 generation and source-type mask. Records have stride20 at0x8b7460, count0x836c38. Listener generation validation is distinct from projectile parent generation validation. |
| `0x4dfe37`, `0x4dfeca`, `0x4dff8f` | Each message10 call to0x4df070 receives script, message, senderType3, senderIndex=victim+4, sourceType3/index=raw source+4 (or0/−1), linkId0, param0=running amount, param1=type float, param2/3=zero. |
| `0x4df124…0x4df18f` | Searches script definition's message table; disabled, missing or gated handlers can return the sentinel. Entry into0x4df070 alone does not prove interpreted execution. Multiplayer branches at0x4df19a onward can defer/return zero; their actual flags are not captured here. |
| `0x4df20e…0x4df250` | Copies invocation fields into script state; param0..3 at+0x3c..+0x48, return slot+0x4c initialized to bits0xc61c3ff3 (−9999.9873046875). |
| `0x4df282 → 0x4e2600` | Selects actual handler from script definition and handles reentrant execution state, then calls interpreter0x4e2210. Bytecode fetch0x4e223b uses definition+0x24 and script+0x10. Native verb dispatch includes indirect `call eax` at0x4e23b7. No missing bytecode is invented. |
| `0x506f30…0x506f42` | Registered `returnex` verb pops float and stores script+0x4c at0x506f3b. `getparam` at0x506f50 reads+0x3c+4*i, i0..3. Registration and string bytes are pinned. |
| `0x4df287`, `0x4dfe3c…0x4dfe50` | Script returns+0x4c through x87. Message10 ignores sentinel; otherwise replaces both accumulated return and param0 passed to later listeners. The analogous later branches do the same. Other messages' accumulation branches must not be substituted. |
| `0x4e0001`, `0x4ccac4` | Message dispatcher returns accumulated float; damage dispatcher stores adjusted amount, then rejects nonpositive amounts before actor damage. A zero return may veto health damage while an earlier script inventory write already changed shield. |

These are original engine x86 facts. No authentic local COG damage-handler
semantics were executed or inferred from retail scripts or a replacement engine.
The retained level's script-name list contains `kyle.cog`; that alone establishes
neither its body nor the live player's attached pointer. Archive member review
covered56 retained Jedi run archives and found two actor scripts and two globals
reference COGs, not the required local script. Search results are retained.

## Shield stores and remaining coverage limit

The accepted inventory address remains
`playerInfo + 0x88 + 24*60`, with `playerInfo=*(player+0x1c0)`.
Two original generic inventory functions can lower an eligible bin:

- `0x4d21a0(player,bin,delta)` computes old+delta, writes at0x4d21f1,
  clamps against bin-definition bounds, then writes at0x4d2223.
- `0x4d22b0(player,bin,value)` writes supplied bits at0x4d22fc,
  clamps and writes again at0x4d2330.

Both use bin-definition table0x8bd1c0 with stride156 and bounds at+0x84/+0x88,
then may issue inventory message20 to the bin script and update bin flags.
A notification or a different inventory bin is not shield-loss evidence.
`setinv` and `changeinv` registrations bind original verbs0x5032d0/0x503330,
which validate player type10, inventory pointer and bin<200, then call these
functions at0x50331a/0x50337a. This proves possible engine store paths, not that
`kyle.cog` called them during retained damage. The raw and clamped writes are
separate observations; a coarse block/batch watch may miss intermediate values.

The setter has103 static xref candidates, retained without promoting them to
103 verified shield paths. Initialization, restore/network/bulk writes and
indirect callers are not exhaustively closed. No assertion of complete local
shield writer coverage is justified. Prior health subtract0x4ed074 and death
zero0x4ed2a6 remain separate paths; source ancestry0x4cc930 still requires each
parent generation match. Direct health writers need independent coverage.

## Executable contract and synchronous stop requirement

`correlate.cjs` executes an offline bounded correlation check around the unchanged
prior decoder. It preserves original code/pointer/process/freshness guards and
adds13 original script/VM/inventory/data spans, event id/sequence, stopped epoch,
victim/source generations, script invocation/return matching, running adjusted
amount, known vital writer addresses and before/after continuity. Limits are64
events,256 reads,32768 bytes; prior128-read/16384-byte/8-parent guards still apply
to its entry decoder. CLI replay rejects missing or overlapping segments.

The schema distinguishes sender=victim from source=raw source, invocation id
from enclosing damage id, and unrelated inventory updates from bin60 writes.
It deliberately rejects nested damage invocations and incomplete returns; a
future production adapter must support nesting with parent ids or fail closed.
It does not emulate shield absorption or certify the event labels supplied by
a caller. Every result retains actualDamageProven=false,
usableDamageAttribution=false and readyForCampaign=false.

A single stopped snapshot cannot reconstruct earlier script invocations,
before-values or source generations. A future synchronous integration would
need bounded immutable event history captured on the actual interpreter thread,
with actual call/return identity and generations at each event. At a shield loss
inside a script, return may not have occurred: latch immediately and retain the
pending invocation. **Do not resume to complete correlation.** A script-veto
outcome requires a genuinely observed return; stopping at entry proves only an
attempt. Time proximity cannot replace call identity.

`contract.json` specifies proposed capture points, exact stack fields, missing
writer coverage, failure bounds and stop semantics. Preserve first-error,
death, health-or-shield-loss latch, prior one-use and neutral-pair controls,
all key releases and no gameplay keydown after stop. Revoke controls, release,
persist stop before PNG; never delay for image review. Unknown writer, missing
event, source reuse, overflow or coherence failure must latch the same stop.
No production adapter or actual release delivery is qualified by this task.

## Tests, recovery and handoff

27 task-local synthetic contract checks pass, including veto/no-loss,
shield-only loss, exhaustion plus health loss, unrelated inventory updates,
wrong/stale source generation, mismatched script/invocation return, missing
return/store/end, wrong process/epoch/event, code/manifest drift and CLI replay.
The unchanged prior34 offline checks also pass. These fixtures use original
code bytes but invented memory/events; neither x86 nor authentic script logic
was executed. They are not runtime integration or gameplay evidence. No build
was run under the source-only instruction.

`RECOVERY.md` gives exact commands and the first unresolved branch reproduction.
The run retains full hashes, decoder/tests, source anchors, asset-search record,
contract and result/final files. Original asset receipts pin res1demo.gob SHA256
`9708ac558b00e76bc4e0dc2e663cc9e867b32bc1b283499734fad0982f8e852e` and
jk1demo.gob SHA256
`f9a8d7410577eda1e092a0529dfb959525de23fa203e1a0456c4c74f8647931f`;
these hashes are recovery targets, not recovered script bytes.

Next: obtain retained authentic local script bytes and prove actual binding,
then close remaining writers and separately qualify synchronous capture/stop.
The retained8699ms gap stays unattributed. Static Bossk266, nearby actors,
visible weapon and hostility establish no causal identity here.

No assigned test box. Predecessor bx_zqdxvgxr remains recorded STOPPED, original
expiry2026-11-03T16:11:37.264Z, untouched without fresh lifecycle query;
coordinator retains custody. AUTHOR RELEASE then STOP; no worker reuse.
