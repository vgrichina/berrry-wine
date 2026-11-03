# Jedi first-damage binding capture contract — 2026-11-03

**Source contract tested; authentic runtime prerequisite remains open.** Start
at original `0x4dfe04`: read `*(victim+0x29c)`; `test eax,eax` at `0x4dfe0a`,
`je 0x4dfe97` at `0x4dfe0c`. Neither earlier synthetic events nor the recovered
COG text establish the taken branch, loaded definition, executing handler or
cause of loss in the retained encounter. `readyForCampaign=false`,
`runtimeIntegration=false`, `actualDamageProven=false` and
`usableDamageAttribution=false` remain mandatory.

Exact committed input: `200832ae82ac530bdb73fa4598867ac16f52ee95`, main.
Reuse [authentic script assets](jedi-authentic-script-assets-20261103.md) and
[engine shield/script anchors](jedi-shield-script-20261103.md). Evidence and
executable tools: `scratch/runs/20261103-jedi-script-binding-capture-contract/`.
Only this note is committed. This was source-only: no game, emulator, browser,
boat, build, guest write, injected engine call, runtime steering, production
tracing edit, lifecycle operation or subworker.

## Verified originals before analysis

The retained originals were hashed before disassembly or member analysis.
All1,581 GOB members were checked against retained inventories, and every
recovered payload copy was compared with its original GOB slice. No asset
was downloaded, searched for again or recovered again.

| Original retained asset | Full SHA256 |
| --- | --- |
| `original/jkdemo.exe`, 1,388,032 bytes | `0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46` |
| `original/res1demo.gob` | `9708ac558b00e76bc4e0dc2e663cc9e867b32bc1b283499734fad0982f8e852e` |
| `original/jk1demo.gob` | `f9a8d7410577eda1e092a0529dfb959525de23fa203e1a0456c4c74f8647931f` |
| `original/jk1mpdemo.gob` | `b7bab76a6552fed1f5e7fe120625dafb037f21b4645f05914326974fa966bc92` |
| res1 entry765 `cog\kyle.cog`, offset11210090, 13776 bytes | `cf68cc4754acd78d2d84297eb6d05df80d0e8e265fa5d5a902b7101f8e523955` |
| res1 entry761 `cog\item_shields.cog`, offset11206399, 2030 bytes | `da5a155ae80058de2e1d1f3b81be4d13e465f34a097328d10d6471e1c7229a69` |

Paths in that table are relative to retained run
`../20261103-jedi-authentic-script-assets/`. `verified-inputs.json` records
sizes, hashes and member counts. `anchors.json` pins20 original PE spans by
VA, file offset, length, full SHA256 and hex. `make-anchors.py` reproduces it
from the hash-verified original PE; GNU `objdump -d -Mintel` supplies retained
`original.dis`, `load.dis` and `compiler.dis`. Addresses below are original
preferred-image VAs; a runtime adapter must establish its module mapping and
validate these bytes before using them. Do not substitute movable WASM bases.

## Attachment, loading and compiled message resolution

The recovered Fuel Station JKL lists `kyle.cog` and gives `walkplayer`
`cog=kyle.cog`. These authored references lead to concrete original loader
paths, but remain distinct from a live player attachment:

1. Template resource handling at `0x4cf43a…0x4cf46a` takes the resource name
   from the parsed value, calls `0x4dfa80` at `0x4cf442`, stores its result
   into thing+`0x29c` at `0x4cf450`, tests for failure and ORs script flags
   with`0x60`. Capture the destination object and eventual instance copy;
   do not assume a template address equals the player.
2. `0x4dfa80` allocates the next script slot in current world
   `*(0x8339d8)`: count/capacity/base at world+`0x150/154/158`, script stride
   **0x14c4**. It writes script id+8, including the world's high id bit,
   constructs `cog\name` using strings`0x54aa8c/90`, then consults name cache
   `*(0x836c44)` via`0x438010`. A cache hit reuses a definition. A miss checks
   world definition count/capacity/base+`0x144/148/14c`, stride**0x1db8**,
   and calls compiler/loader`0x4fcc80` at`0x4dfb42`. It inserts successful
   definitions into the cache and increments the definition count.
3. `0x4dfb84…0x4dfbd1` copies definition basename+4 to script+`0x49c`
   (31 bytes plus NUL), stores definition pointer at script+0 and flags at+4,
   clones its symbol table (`definition+0x2c` →`0x4fd280` →script+`0x94`),
   and increments script count only on successful setup. The analogous level
   COG-list path at`0x4df545…0x4df61f` shares the same layout and compiler.
4. `0x4fcc80(path,definition,flags)` opens the requested resource through
   `0x4311e0` at`0x4fcc89`, zeroes the0x1db8 definition, copies its basename,
   parses symbols and code, and compiles via`0x4fd020`. Opening ultimately
   calls the installed file interface (`0x43129e` indirect call). Capture
   the actual selected file bytes/archive member or loose-file origin here.
   A basename or cache key alone cannot resolve mount precedence or overrides.
5. `damaged` is originally registered as integer10 at`0x4de50d` through
   `0x4e08b0` (accepted asset note). Parsing a `message` declaration calls
   `0x4fe780` at`0x4fcebc`. The declaration resolves its name through the
   global symbol tables, obtains the message integer at`0x4fe7ef`, and writes
   message id to definition+`0x34+12*i` at`0x4fe8fa`. The record also holds a
   compiled PC at+`0x38+12*i` and label symbol id at+`0x3c+12*i`.
   After compiling code, `0x4fcfde…0x4fd000` fixes each handler PC through
   label table`0x8554d0`. Definition+`0x24` is the bytecode pointer, +`0x28`
   its word count, +`0x30` handler count (parser limit32). A source line
   number is never a bytecode PC. No authentic compiled handler words or
   compiler execution were obtained in this task.
6. `0x4df070` reads script→definition, rejects flags`0x2`, finds the first
   matching message in the12-byte records (`0x4df124…13e`), and rejects
   flags`0x10`. Missing/gated handlers return the sentinel. Multiplayer
   routing at`0x4df19a…20d` can return/defer without running the interpreter;
   capture globals`0x832630/2c`, flags`0x40`, and the actual branch.
7. `0x4df282` calls`0x4e2600(script,handlerIndex)`. It loads the signed PC
   from definition+`0x38+12*i`; a negative PC exits at`0x4e2618`. It saves
   reentrant script PC/state/context when necessary (depth+`0x90`, limit4),
   writes selected PC to script+`0x10` and message id to+`0x38`, then calls
   interpreter`0x4e2210` at`0x4e26d2`. At fetch`0x4e223b`, ESI is the script,
   ECX its definition; code comes from definition+`0x24`, PC from script+`0x10`.
   Capture the **actual guest interpreter thread**, process and invocation
   stack here. Native verb dispatch is `call eax` at`0x4e23b7`.

Other real attachment mutation paths include restore/id resolution
`0x4f4b88 →0x4dfbe0 →0x4f4b8d` (+29c) and `0x4f4b9d/ba5` (+2a0),
script verbs`0x504df2` (+29c), `0x504e62` (+2a0), and`0x503104/13a`
(+2a0). The id resolver selects current/static world with id bit`0x8000`,
checks count, and computes the script slot. These are additional reasons to
track allocation lifetime, restore epoch and pointer reassignment. An offset
xref is not automatically a thing attachment: e.g.`0x4277bb` uses+29c in a
different structure and is deliberately not treated as a player binding store.
Bulk copies and all attachment mutation paths are not exhaustively enumerated.

## Two distinct listener chains and shield semantics

**Thing chain:** `0x4dfda0` initializes message10's running amount from param0,
visits victim+29c, victim+2a0, then linked records in ascending array order.
The linked table is`0x8b7460`, count`0x836c38`, stride20: victim pointer,
victim generation, script pointer, link id, source mask. Eligibility at
`0x4dff3d/4c/5a` requires victim pointer, victim+74 generation and mask match.
Source mask is`1 << (rawSource.type & 31)`; null source uses1. For message10,
accepted returns replace the running amount and param0 for later listeners;
sentinel`0xc61c3ff3` is ignored. Kyle's recovered damaged handler
lines131–135 optionally calls `make_bubbles` for exact type32, then
`ReturnEx(GetParam(0))`. Sleep inside the bubble call makes observed execution
and return necessary; an attempted call is insufficient.

**Inventory chain, newly traced here:** after that chain, actor damage
`0x4ecf40` checks actor/player state, then for player type10 calls
`0x4d2750` at`0x4ecfb1`, with message10 and definition mask`0x10`.
This routine visits bins0…199 in ascending order. Eligibility requires a
nonnull inventory base, bin-definition flags bit1, per-player bin state bit4,
definition flags intersecting the supplied mask, and a nonnull bin script.
Definition table`0x8bd1c0` has stride156; bin script is+`0x8c`. Each admitted
call is`0x4d27d8 →0x4df070`, return at`0x4d27dd`.
**It unconditionally replaces the running amount with the returned float.**
It has no thing-chain sentinel comparison. Do not reuse a generic listener
accumulation rule. Param1 is again a zero-extended qword FILD conversion of
damage type to float, not a bitmask normalization.

`items.dat` entry961 declares `shields 60 0 200.0 0x030
cog=item_shields.cog`. The item parser calls`0x4dfa80` at`0x409546`, ORs
script flags`0x40`, then calls`0x4d13d0` at`0x409587`.
That function stores script+`0x8c` at`0x4d1407`, minimum+84, maximum+88,
and ORs definition flags with1. Thus authored shields flags become`0x31`;
**live per-player state bit4 remains a separate required observation**.
Capture the full eligible inventory sequence, including absorb/protection
scripts if active; bin60's presence alone does not prove its invocation.

The authentic shield handler uses sender=victim via GetSenderRef. It only
writes bin60 for positive shields with **exact type2,4,16**. Preserve its
threshold50 and **unclamped R** arithmetic described in the asset note:
energy/fire100,20 →stored80,return0;60,20 →40,2;10,20 →0,24.
Type16 applies the same calculation to half damage and then adds the saved
half back. Mixed type6 does not enter the energy branch. The engine may clamp
the inventory store to[0,200]; never clamp R before script scaling. The local
11-case oracle is an explicitly labeled source transcription, not executed COG.
Kyle initialization and pickups can also write shields without causing damage.

## Synchronous capture and stop integration handoff

Implement capture only under separate runtime authorization. The adapter needs
bounded immutable event history from real instruction/store boundaries, not
post-batch memory polls or caller-invented event labels. Every record carries
process/module identity, stop epoch, guest thread identity, monotonic sequence,
damage id, parent invocation id, script allocation lifetime and source/victim
pointer+index+generation. Record loader/cache/restore provenance before use;
if unavailable, fail closed instead of retroactively naming the script.

| Capture point (original VA) | Required synchronous evidence |
| --- | --- |
| `4dfda0` entry | ESP return address, victim, raw source, message10, float param0..3; victim/source generations and initial health/shield; begin damage identity. |
| `4dfe04`, `4dfe0c` | EDI=victim; +29c bytes, EAX/null branch; actual module code; object lifetime and template→instance provenance. Repeat for +2a0 at`4dfe97/9f`. |
| `4df070` entry | ESP+4 script,+8 message,+c senderType,+10 senderIndex,+14 sourceType,+18 sourceIndex,+1c linkId,+20…2c float params; actual call-site return/ESP, script→definition/name/flags/state/symbols/code/handler table and source-file provenance. |
| `4df124/13e/154/190/20e` | Actual handler search result, disabled/gated/MP routing decisions. At`4df250` return slot initialized sentinel; after instruction capture params+3c…48 and return+4c. |
| `4e260f/18`, `4e26a3/a6`, `4e2210/223b` | Selected index, signed PC, bytecode bounds/digest, reentry depth+90 and saved16-byte frames+50; actual interpreter thread, PC, state+0c and script identity. |
| `4dff3d…5c`, `4dff8f/94` | Full linked table/count at chain entry and each eligibility decision/call/return; preserve generation/mask/order and mutations while dispatching. |
| `4ecfb1/b6`, `4d2770…279f`, `4d27d8/dd` | Separate inventory chain id; all200 bin flags/state/script pointers, actual skipped/admitted order, converted type, incoming amount and each replacement return. |
| `506f3b` | Before/after store to the actual script+4c, popped float, verb call identity and enclosing interpreter frame. `4df287` subsequently loads that slot; correlate actual return and caller's x87 value, never infer completion. |
| `4d21f1/2223`, `4d22fc/2330` | Before/after raw and clamped inventory stores, effective address, bin, player/playerInfo, old/new bits and active invocation. Bin60 address=`*(victim+1c0)+88+24*60`. |
| Any write overlapping shield or health | Store-level watch independent of known routine list, including bulk/restore/network/unknown writers; immediate loss latch even without any pending damage event or known writer. |
| `4ed074`, `4ed2a6` | Health subtraction/death zero before/after at victim+134. These are separate from shield loss. |
| `4cc930/93f…94c` | Raw source generation and each parent pointer+80, saved parent generation+84 versus parent+74; stop attribution on mismatch/reuse/cycle. Capture again at actual use, not only once at entry. |

The **first genuine error, death, health loss OR shield loss** synchronously
latches stop. On a loss store, record its committed transition and prevent the
next guest instruction. On an engine error, stop at the error boundary.
Atomically revoke further gameplay input/credits, release every held key,
persist latch and pending call stack, then request any image. Release delivery
and persistence require acknowledgements; failure keeps controls revoked.
No resume, extra interpreter call, completed ReturnEx, image or neutral movement
may be obtained by advancing the stopped guest. Host release must work while
the guest stays stopped; if it needs guest execution, integration is not ready.
An unfinished script return is the expected valid stop record for shield loss.

Unknown writer, missing listener/event, wrong thread/generation, overflow,
stale definition, coherence failure or nested invocation mismatch also fail
closed and retain the earliest latch. An error discovered later must not replace
the original loss timestamp. A source-generation mismatch does not itself prove
that the original engine raised an error; it is an observer qualification error.
Shield-only loss is significant even when health stays100 or a later return
would have been0. No waiting for a screenshot or invocation completion.

## Executable decoder, limits and precise remaining prerequisite

Task-local `decode.py BUNDLE.json` is a read-only CLI (exit0 for structurally
valid replay,2 for rejected/incomplete evidence). It verifies original PE,
three GOB hashes, both exact source members and recovered copies, and all20
PE spans before reading sparse snapshot segments. It checks captured code,
synchronous stopped identity/thread, exact branch EIP/EDI, victim/source and
parent generations, script and definition names, first message10 record,
handler bounds, load receipt/source/bytecode digests and allocation identity.
It decodes linked eligibility, all200 inventory bins and shield listener state.
It also checks bounded invocation nesting, call-stack identity, listener order,
VM-entry/ReturnEx/return identity, running amounts within each chain, vital
store continuity and loss-stop/release/persist ordering. It permits a pending
handler at a loss stop and rejects any subsequent guest work.

Limits:1MiB input,256 nonoverlapping segments/256KiB capture,1024 reads/256KiB
read budget,32 handlers,16384 bytecode words,512 linked records,64 load receipts,
8 source ancestors,128 events and4 nested invocations. Unsupported listeners
and states require explicit decoder extension or rejection; the current checker
only names Kyle and shields. The adapter must supply the actual listener order
and complete provenance. A JSON load receipt's asserted hash, allocation,
thread or event label is **not attested** by accepting it. The checker does not
compile COG, execute original x86/bytecode, prove mount selection, provide a
production adapter, release real keys or establish exhaustive writer coverage.
It is a concrete integration handoff, not a runtime-ready observer.

`test-decode.py`: **58 checks PASS**, original-byte/asset-anchored but synthetic
memory, inert invented bytecode and events. Includes null/wrong/stale script or
definition, absent damaged handler, disabled/gated script, invalid handler PC,
stale load/allocation, wrong process/epoch/thread/generation, malformed sparse
reads, source-parent mismatch, missing shield listener, wrong sender/source,
nested mismatch, missing listener/writer/return, and shield-only loss with
pending handler, release failure and forbidden execution after stop.
`test-arithmetic.py`: **11 source-transcription cases PASS**; no original VM ran.
No build is appropriate for an owned documentation-only, source-only task.

The first **actual** remaining prerequisite is a coherent authentic capture of
the original victim's+29c load and taken null branch, tied to its allocation,
selected resource bytes and compiled definition in that same process/epoch.
No such capture exists in the reused evidence. If null is genuinely observed,
retain that fact and continue the static/runtime qualification toward+2a0 and
linked/bin listeners only as separately authorized; do not insert Kyle.
If nonnull, prove the loader/cache/source→definition→message10→actual VM chain.
No compiled PC value from this task's invented fixture may be reused.

Reproduce the exact branch from original bytes and the fail-closed missing
capture case without a runtime:

```sh
run=scratch/runs/20261103-jedi-script-binding-capture-contract
objdump -d -Mintel --start-address=0x4dfe00 --stop-address=0x4dfe17 scratch/runs/20261103-jedi-authentic-script-assets/original/jkdemo.exe
python3 "$run/test-decode.py"
python3 "$run/test-arithmetic.py"
python3 "$run/decode.py" "$run/missing-original-victim.json"
```

The last command intentionally exits2: `missing bytes 0x100029c+0x4`.
That address is a **synthetic** fixture victim, with exactly its+29c bytes
omitted to reproduce the decoder prerequisite. It is not a discovered live
victim address. `first-prerequisite.json` records the rejection. The original
branch bytes are`8b879c02000085c00f8485000000`; the real pointer value and
branch outcome remain unknown. All-path vital writers and actual synchronous
stop/release also still require runtime qualification. The retained8699ms gap
remains unattributed; no Bossk/weapon/hostility or campaign claim follows.

`RECOVERY.md`, `result.json`, `final.txt` and full `SHA256SUMS` stay local with
tools, fixtures, source-input verification and disassembly. Preserve both
predecessor evidence directories; do not recover assets again. No test box
assigned or queried: ID/state/expiry N/A; no lifecycle custody was taken.
AUTHOR RELEASE, then STOP; no successor.
