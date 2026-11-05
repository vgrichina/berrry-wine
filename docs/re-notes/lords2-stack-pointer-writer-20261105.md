# Lords II stack-pointer writer — 2026-11-05

The earlier producer of `005f:869c` at `001f88a4` is now observed: the ordinary
far CALL at `005f:8697` pushes its own return frame there. This is stack reuse,
not a demonstrated incorrect pointer construction or selector relocation.
The later callback reads those return-frame bytes as an object pointer. Why
that callback still references the reused storage remains unproved. No
emulator semantics repair, installation success or gameplay is claimed.

Evidence is retained in `scratch/runs/20261105-lords2-stack-pointer-writer/`.
Input was main `a239eaece3f109b2322bcd32b3274bc72681ec16` and diagnostic
`6a0ce7e7198`. The unchanged relocation comparison and earlier trap evidence
remain in the prior run referenced by
`lords2-prevalidated-setup-20261105.md`; they were not copied or repeated as
the sole result of this investigation.

## Causal writer

The bounded observer captured 503 pre-write intents in the faulting cooperative
child, instance 1. Every intent's predicted watched bytes match the next
observation or the final fault read; none has a capture error. The 2048-record
budget did not expire. There were no observed changes made inside synchronous
host imports. `live-write-history.json`, `write-transitions.json`,
`causal-writer.json` and `causal-code-disassembly.txt` retain the raw records,
confirmation witnesses and caller context. Event numbers below are zero based.

At 16:16:48.151 UTC, events 497 and 498 observe:

| Writer | Address | Value | ESP at pre-write |
| --- | --- | --- | --- |
| Far CALL, selector push | `001f88a6` | `005f` | `001f88a6` |
| Far CALL, return-IP push | `001f88a4` | `869c` | `001f88a4` |

The actual captured instruction bytes are:

```text
005f:8695  50                push ax
005f:8696  51                push cx
005f:8697  9a 3a 20 47 00    call far 0047:203a
005f:869c  c9                leave
005f:869d  cb                retf
```

CS is `005f`, SS is `0087` with base `001f0000`, BP is `88ac` and the
arguments pushed immediately before the call are AX=`0037`, CX=`1406`.
The saved BP frame contains BP=`88b6`, return=`005f:876c`, and argument
`0037:1406`. Events 501 and 502 repeat the same two return-frame writes at
16:16:48.152 with CX=`13fc`; event 502 is the last watched write.
The subsequent fault read confirms `9c 86 5f 00 fc 13 37 00` at the watched
address. The decoded threaded stream independently contains return linear
address `001a869c`, offset `203a` and selector `0047`.

This matches `$win16_push_far_ret` and `$th_call_far_imm` in
`src/05c-seg16-ops.wat`: decrement SP by two and write CS, then decrement by
two and write the return offset. The return offset is exactly the instruction
after the five-byte CALL. A generated NE fixture separately executes a valid
indirect far CALL/RETF and checks selector-first/offset-second writes, restored
SP and identical observed/unobserved architectural results in both modules.
There is no evidence here that this return-frame producer is wrong.

Before stack reuse, the same first four bytes receive explicit object-style
stores: `0067:c9a0` at block `001bc93e` (event 445), then `0067:c9a0`,
`0067:db4e`, `0067:e188` and `0067:87a8` at blocks `001b54b8`, `001a930a`,
`001ab550` and `001ab582` (events 447–454). Captured code includes the nested
calls between these blocks and the final `leave; retf 4`. Event 455 begins
ordinary stack writes into the watched range at ESP=`001f88aa`; subsequent
return frames overwrite it. This supports a lifetime/unwind investigation,
but does not alone establish destructor identity, an incorrect API return,
or a callback ownership mismatch against Windows.

At 16:17:18.633 the later callback again executes the reported LES and
indirect far CALL. Its object address is `001f88a4`; LES loads `005f:869c`,
and `[ES:BX+64h]` reads `00 eb 29 8b` at `001a8700`, producing unmapped
`8b29:eb00`. The selector rejection, LES and address calculation agree with
their inputs. The concrete remaining blocker is the earlier control-flow or
callback-lifetime cause that allows the consumer to retain this stack address
after reuse. Establishing that cause needs caller/API lifetime evidence; this
single run does not supply a Windows comparison or justify a speculative fix.

## Instrumentation and validation

The only shared source edit was a temporary finite observer in
`src/03-registers.wat`; `host.js` was not edited. The retained binary diff adds
pre-write observation to `gs8`, `gs16`, `gs32` and the bulk code-invalidation
boundary. The JS collector copies old watched bytes, scalar values, registers,
selectors, segment bases, decoded-stream position, code, stack and BP frame.
It also observes byte changes across synchronous host imports. Only diagnostic
globals are armed; guest bytes, selectors, frames and architectural state are
not changed. These hooks are not a universal write barrier: direct inline Wasm
stores outside them, including wider same-page stores, remain a coverage limit.
An intent is only treated as committed when corroborated by later bytes.

Before the one original launch, the full locked build passed. Generated NE
fixtures passed in standard and compat modules: offset/CS word writes,
dword/byte overwrites, segmented REP STOSW, excluded nearby writes, cross-page
bulk-boundary observation, exact budget exhaustion, real CALL/RETF return-frame
production, and armed/unarmed byte/register equivalence. Both instantiate and
constructor paths armed the correct instance. JS tests covered framing,
marker-valued fields and host-import attribution preserving returns/exceptions.
Existing far-fault tests passed both modules, including 12 generated cases and
collector lifetime checks. Production queue validation and all 181 original
media inventory hashes passed. Logs and exact commands are in `preflight.json`.

The temporary diff was removed after analysis. A second full locked build and
the existing far-fault suite in both restored modules passed. The final change
is this note only; no new causal semantics regression is claimed because no
semantics fix was warranted. The generated diagnostic fixtures and exact
instrumentation patch remain recoverable in the run directory.

## Original run and identities

Required exact FINAL releases were Strong1500 at 15:51:00, countselector1520
at 15:59:04, then ReturnFire1530 at 16:11:50 UTC. Independent inspection passed
219 absent predecessor PIDs, 92 refusing ports, 17 absent profiles, four free
locks, no heavy runtime and over 9 GB free disk before shared work began.

The tested source was main `c3d0008e108b8123a29878719c07beaf64053461` plus
the retained `history-instrumentation.binarydiff` (identical to the relevant
runtime source diff). `source-before.json` records exact source hashes.

| Actual diagnostic module | Bytes | SHA-256 |
| --- | --- | --- |
| Standard, browser compiled | 2173596 | `8fdf958382022af9ef61f492c7126b17e68e4815e38f5182178994db63e15bad` |
| Compat, generated fixtures | 2176242 | `fd65ce872eef76b07f717c650f9ab3f35bf527a136ab8224c7ca97e8cf226734` |

Unique diagnostic modules are retained with the patch. Normal final module
identities and the clean relevant source diff are in `restored-build.json`.
The original media stayed at
`scratch/game-media/lords2-demo-20261105/original`, 181 files, 14,382,323 bytes.
SETUP.EXE SHA-256 is
`c9844241cf6594050cb4cdde5b04d4f994dfa6da83a3c5538dab16e792aa49b7`;
the browser manifest is
`a1749143a2de176c4f3fdf314337a1767f6101eed4a88b6d5b0dee4d59012f8e`.
No guest media was changed or copied. Git SHA, relevant binary diff and the
new note's patch provide source recovery; no source-tree archive was made.

The one original caller started at 16:14:48.828 UTC with a 540-second outer
bound and the production queue's 420-second bound. Chrome 151 used the
cooperative backend, viewport 900×720. The live canvas rectangle was
left=10, top=160, width=560, height=522. Personally reviewed current captures
show Main Menu, System Test, Wave question and the desktop after the child
fault. Ordinary Install, System Test Yes and Wave No clicks used those captures
and current geometry; fractions and review timestamps are in
`click-review.jsonl`. No second original or continuation after a repair occurred.

One proposed initial queue command included an unsupported `evalfile` readout.
The local production validator rejected it before submission with “only
read-only renderer evidence is allowed.” The rejected command and error are
preserved. Only supported ordinary click/wait/shot commands were then submitted;
no guard was changed. This was a local command-format validation error, not a
platform hold or cybersecurity rejection. No platform flag occurred.

The validated quit and final readout completed normally: probe/caller exit 0,
Chrome exit 0 with no signal at 16:17:38.376. All own runtime PIDs disappeared,
both ports refused connections, the owned profile disappeared, and all four
locks were free. Final cleanup also verified the owned messageboard watcher was absent;
`final-cleanup.json` records the check after all builds. No boxes were assigned:
box ID/state/expiry N/A; coordinator lifecycle ownership is unchanged. No
subagents, workers, public deployment, held-family runtime or laptop Heroes II
work was used. Runtime ownership is handed back after all builds finish.
