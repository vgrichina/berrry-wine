# Jedi first-damage source: original chain derived; live observer incomplete

The retained encounter cannot identify its first damage source. Original x86
establishes a damage dispatcher, health subtraction and generation-checked source
ancestry. A task-local read-only decoder and bounded capture plan are retained,
but **`readyForCampaign=false` and `usableDamageAttribution=false`**. The first
unresolved branch is the damage-script call before health subtraction: its
shield-bin write and event correlation are not yet byte-anchored. A synchronous
capture/stop adapter is also required before another encounter campaign.

This source-only task used input main
`3e24bee3762bc2ee87941a3faefee2daa20a4f3d`. The four requested encounter/route
notes were reviewed. No gameplay, build, browser, boat operation, restart,
guest write, engine call or subworker occurred. Static route extraction was not
repeated. Bossk266 remains a candidate, not an identified attacker; no civilian
is classified as hostile.

## What the retained evidence establishes

The last healthy sample is
`retrieved/session/emerge04-neutral-sample.json` in
`scratch/runs/20261103-jedi-listener-ready-encounter/`. At14:33:58.382Z it reports
health100/shield100, sector265 and simulation accumulator808352ms. The rejected
`corridor01-pair-1-sample.json`,14:34:07.081Z, reports health30.828529/shield0 and
accumulator817033ms. The gap is8699 host ms /8681 simulation ms. The final PNG
was reviewed in the predecessor task; this task does not claim another visual
attacker identification.

Neither sample contains a damage-entry stack, writer trace, source pointer,
source generation or projectile identity. The player's position/height change
does not establish a fall as the cause. Resource requests for `concuss5.wav`,
`expl_09.wav` and `kshieldhit01.wav` in the retained log are suggestive context,
but lack victim/source identity and a first-event timestamp. They cannot prove
an incoming projectile, identify its owner, exclude environmental damage or
show which cause occurred first. Failed loose-file probes followed by archive
access are not evidence of an audio defect.

The missing observation is a coherent record at the **first local damage
entry or first health/shield decrement**, including original caller, victim,
raw source, amount/type, live source slots and generations, with the matching
health/shield write. A later screenshot or nearest-in-time actor is insufficient.
`retained-review.json` in this task's ignored run records the exact sample
hashes, gap calculation and relevant resource-request lines.

## Original byte-anchored chain

All addresses below are original VAs at image base0x400000 in original
JkDemo.exe,1388032 bytes, SHA256
`0f8a1b01cfdcb196b043ebb4ebf42dc3a6d4fa394034ebfb8cad9e383e14aa46`.
The accepted Coords/health/inventory/clock proofs are reused unchanged, not
requalified by another campaign. New static disassembly and exact code spans
are retained in this task's run.

| Original location | Established behavior |
| --- | --- |
| `0x4cca60` | Entry stack is return,+4 victim,+8 source,+12 float amount,+16 damageType. Rejects nonpositive amount and victim flags, then dispatches on victim+0x0c. |
| `0x4ccabf` | Calls `0x4dfda0` with message0x0a and the damage/source arguments under the victim flag gate. Its floating return replaces the amount before dispatch continues. This is an interception boundary, not proof of an actual loss. |
| `0x4ccb11…0x4ccb19` | Victim types2/10 call `0x4ecf40(victim,source,amount,type)`. Type3 takes a separate `0x4d4b30` path. |
| `0x4ecf40` | Saves victim in ESI; source is loaded into EDI at0x4ecf93. Applies actor flags/script and other gates. |
| `0x4ecffd` | Calls `0x4cc930(source)`; EAX becomes resolved EDI. Raw source and resolved source can differ. |
| `0x4cc930…0x4cc959` | Follows source+0x80 only while source+0x84 equals the pointed slot's+0x74 generation. A failed comparison leaves the current source as the engine result. |
| `0x4ed064…0x4ed074` | Loads victim+0x134, subtracts stack+0x1c amount and stores back to victim+0x134. Exact store bytes: `d9 9e 34 01 00 00`. |
| `0x4ed0c8` / `0x4ed2a6` | Calls death path0x4ed290; that path explicitly zeroes victim+0x134. |

At the health-store boundary after four saved registers, stack+0x10 is the
actor function return, +0x14 victim, +0x18 raw source, +0x1c adjusted amount,
+0x20 type. EDI may already be the resolved source. These offsets must not be
used with an arbitrary later stack or an EBP-chain guess.

`0x4cc960` validates a thing index against world+0xbc and derives its slot
from world+0xc4 with stride0x2b0, requiring a nonzero slot+0x0c type.
`0x4ccb50` independently allocates count*0x2b0. Slot+4 is initialized as the
index. A fresh observer must read this pool and world+0x124 local player in the
current process, rather than reuse the predecessor's numeric addresses.

Distinct original callers demonstrate why health loss alone is ambiguous:

| Caller | Arguments/context visible in original bytes |
| --- | --- |
| `0x4d4ded` | Uses victim EDI, source ESI, amount ESI+0x13c and type ESI+0x134 in a collision path. The source object must be captured; static actor placement cannot replace it. |
| `0x4e9799`, `0x4e983e` | Pass victim as its own source and type0x40 after a squared excess-magnitude calculation in the movement/impact code; a fall/impact candidate path. Numeric type alone does not prove a fall. |
| `0x4ecee7` | Sector-flag/timer branch passes victim as source, amount10.0 and type0x20 after timer exceeds20000; an environmental candidate path. |
| `0x50277b` | Script damage verb also calls the dispatcher. Other direct calls to0x4ecf40 exist, so a dispatcher-only trace is not complete write coverage. |

The last two rows are reasons to retain caller/context. They are not claims
that either branch executed in the retained encounter. The manifest pins16
direct dispatcher callsites found in the original disassembly, not every
possible indirect entry or every health writer.

The new source-parent42-byte span has SHA256
`915fb7abd68831e10f8559829a0469c985287891a3e645068590d9f082fcdf48`;
dispatcher225-byte span
`485098a2eb8bad6c7c9c16f59ec58138ca39f3c52001aacfacda210b8cc8c905`;
health-store22-byte span
`2557abd72cb371acb774839e6861c11079353dcd0130b76d9051daa1a7393bb4`.
`original-anchors.json` contains full bytes, file offsets and hashes for all15
code spans and16 callers. Its SHA256 is
`f84a59cc1b949121855c7cf638965a8fe1a712a8a59d9c7b74c1acba127f0c58`.

## Executable decoder and bounded observation recipe

Everything executable remains task-local under
`scratch/runs/20261103-jedi-damage-source/`; no runtime or controller source
was changed. `anchors.cjs` refuses a different original PE. `decode.cjs`
accepts only a supplied read callback and stopped capture metadata. It checks
the sealed manifest, all original code spans, exact entry/caller, process
PID/launch token,100ms capture age, current world/player/pool, slot alignment,
index/type, bounded ancestry, generations and stable rereads. Its maximum is
128 reads /16384 bytes /8 ancestry slots; no scan, write or engine invocation.
An invalid generation is rejected for attribution even though the original
resolver would stop traversal there.

The decoder emits raw source and resolved engine source separately. A null
source remains unknown. Numeric type/index/signature/generation are retained;
no model/template name, visible weapon or hostility is inferred. Every accepted
record remains **pre-damage**, `actualDamageProven=false` and
`usableDamageAttribution=false`: a script may veto it. Process identity and
coherence labels must come from a trusted host adapter, not copied JSON. The
offline tests do not establish authentic runtime provenance or sibling-thread
coherence.

`capture-plan.cjs` prints an executable JSON recipe without launching anything.
It identifies existing entry breakpoint, trace and watch facilities and a
proposed30s/64-event arm bound. `stopCandidate` conservatively revokes controls,
attempts all key releases, persists the record and requests stop at the first
candidate or decoding error, before screenshot review. Failure controls show
that revoke/release/persistence errors still attempt the remaining release/stop
callbacks. These are callback tests; actual GetMessage keyup delivery was not
tested here.

For eventual authorized integration, the event capture must run synchronously
when the interpreter returns at the breakpoint/watch boundary, before another
guest slice or control authorization. Capture first, latch stop immediately,
release keys through existing timer/finally paths, then retain supplementary
PNG. First error/death/health **or shield** loss and the existing original-code,
identity, freshness, one-use approval,0.08-distance/4° and1s neutral-pair guards
remain mandatory. No new gameplay keydown may follow the latch. A conservative
stop before an intercepted damage attempt must be labeled an attempt, not an
actual hit or combat result.

**First concrete unresolved branch:** `0x4ccabf → 0x4dfda0` can transform the
amount before the health subtraction. The exact original shield-bin store and
its script message/source correlation remain to be derived. Thus a health-only
watch does not establish first-damage coverage. In addition, current CLI trace
output has no synchronous task callback to copy dynamic source headers and
invalidate controller approval. A debug prompt blocks normal control pumping;
nonstopping trace output and external screenshot polling do not enforce the
required stop/release behavior. Only the primary WAT watch halts per block;
additional watch addresses are JS batch samples. These concrete limitations
are reproduced from `src/13-exports.wat` and `test/run.js`, with excerpts retained
in `tracing-basis.txt`. No ready live observer or authorized campaign is claimed.

## Validation, recovery and lifecycle

34 offline checks pass. They cover exact original-byte matching, changed PE/
manifest/code, wrong process/token/player/source, stale/future/noncoherent
capture, wrong thread/module/entry, invalid references/pool/amount/inventory,
source reuse/cycles/generation changes, ambiguous callers, null-source unknown
and stop/release failure paths. Positive ancestry fixtures are synthetic;
no guest x86 was executed by these tests. They identify no live attacker,
combat result, emulator defect or fix. A first test invocation had a `.cjs`
module-resolution error; the suffix was corrected before the passing run.
No build was run because this task changes only this note and ignored evidence
and explicitly excludes builds.

`RECOVERY.md` gives exact decoder/test/disassembly commands. The own run retains
the original compressed PE, static disassembly, full byte anchors, decoder,
plan, tests, retained-sample analysis, full hashes and result/final records.
It is ignored evidence and must be retained; the note alone cannot recover
task-local code from Git.

No box was assigned or operated. Predecessor **bx_zqdxvgxr** remains recorded
**STOPPED**, original expiry **2026-11-03T16:11:37.264Z**, untouched; this task
made no fresh lifecycle query. Coordinator retains lifecycle ownership. Next
work is the shield/script correlation and synchronous capture/stop adapter
qualification, followed only then by a separately authorized campaign. This
single task ends with AUTHOR RELEASE and STOP, without reuse.
