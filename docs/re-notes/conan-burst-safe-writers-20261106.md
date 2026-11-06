# Conan burst-safe writer observation, 2026-11-06

Bounded transport now survives the generated and original loading bursts without
losing admitted calls or returns. The newly measured blocker is earlier global
detail/admission exhaustion by repeated **count 103 constructor epochs**, rather
than count 2 owners or transport backlog. No emulator defect or player-controlled
gameplay is established. Production code and original guest bytes are unchanged.

Evidence: `scratch/runs/20261106-conan-burst-safe-writers/` (ignored). The
[preceding investigation](conan-weight-writers-20261106.md) lacked the earlier
history of its first-zero owner. Its zero time versus channel starts45.900,
later weight1, and11,196 native-matching stores on other owners did not establish
an emulator defect. Old pointers are not identities in this run.

## Coverage changes

Run-owned compiler observers leave production source and original guest bytes
unchanged. Admission requires actual logical count 73..65535. At constructor
`0x431950` entry the owner is uninitialized, so admission reads its model argument,
matching the constructor's call to `0x412c80` (`MOVZX EAX,WORD PTR[ECX]`). Later
admissions use owner+12. Repeated count 2/count 72 owners consume no lifetime slots.

The auxiliary-copy predicate normalizes nesting depth before boolean AND,
covering both even and odd nesting. Index72 copies require logical admission
and contain only its own 16-byte entry. Copied metadata includes admission count
and owner/table backing addresses for actual store-destination checks.

Each admitted entry reserves its return slot independently of detail capacity.
Pending and in-flight sink work remain charged until persistence completes.
Saturation refuses admissions/details explicitly and preserves admitted ends,
including at the inherited packet quota. Histories with missing or mismatched
endpoint/owner/parent/thread/PC/SP ends, detail loss, or persistence failure are
rejected. Scope remains bounded: decoder eviction, passive watch replacement,
unobserved writers and owner reuse can still prevent a complete causal history.

## Executed controls

The locked current build passed. Standard and compatibility baselines match
shipped bytes; diagnostic modules preserve import/export contracts.

| Validation | Measured result |
| --- | --- |
| Public COM, actual owning CPU/render Workers |20 baseline/diagnostic cells pass |
| Generated loading burst, both modules |15,340 persisted rows per diagnostic module; 2,051 entries and 2,051 matching returns; no pairing errors |
| Logical admission and nested auxiliary copies |6,000 count 2/count 72 sequences excluded; count 73/count 103 admitted; depths 2/3 copied |
| Delayed drain and bounded saturation |Reserved ends survive; new admission refused; incomplete/bad-PC-SP/sink-failure histories rejected |
| Genuine MEM_RESERVE/SEH within admitted lifetime |16 cells pass across both modules, eager/lazy and baseline/diagnostic |
| Independent native x87 | 24 multiply/FCOMP and12 envelope controls pass |

Architectural registers/lazy flags, x87 payload/environment, child-thread and
fault state remain equivalent. The strict singular-normal rendering error is
preserved. Burst detail8192 and invocation2048 limits produce explicit rejection;
the compatibility summary's truncation list is cumulative, not a lost-event count.

The first generated fixture attempt overlapped its enlarged prelude with the
old child trampoline. This was a generated-input defect, not an emulator defect.
The failed attempt and original pins remain under `initial-*`; moving the
trampoline to free `0x42ab00` and asserting prelude geometry fixed it. Corrected
controls were rerun before the original.

## Runtime and recovery

The exact AoW0410 → D3D0430 → Aranna0500 final releases were checked in order.
Independent cleanup verified247 absent PIDs,17 refused ports,8 absent profiles
and4 free locks. The first collector enumerated4 profiles; the expanded check
covered all8 before any shared edit/test/build/runtime and retained the original
immutable05:57:09–06:42:09UTC window, including cleanup.

The build/module controls used Git `36b8c13a6927bb2752a16677921bf376716bb792`.
The original source pin is `41eeb8ebfce265ab40f8e679d67ed0ee667fe7e8`, a later
documentation-only commit; canonical source/helper/module closure was rechecked
before launch. Recovery material is exact Git SHA, `relevant.binarydiff`,
new-source patches and `helper-new-file-patches/`. Media is referenced by existing
path and SHA256 in `media-references.json`; no source archives or media copies.

Actual page, owning CPU Worker and rendering Worker module identities all match
the diagnostic bytes; 301 source-file checks and 18 served-JS identities pass.
Post-run closure/helper/module checks and all 37 existing media hashes pass.
No boxes assigned or used; no lifecycle actions.

## Single original: measured boundary

One session ran06:02:50–06:19:19UTC and closed normally, including Chrome exit0.
Personally inspected ordinary input advanced New Game to the Warrior difficulty
menu and then Kordava loading. The final inspected client was black, with no
retained rendering failure. Movement plus another visible response was not
obtained. The original was stopped after the coverage boundary was measured;
it was not restarted or continued in an attempt to recover already lost history.

`epoch-audit.json` verifies3,497 consecutive durable segments,32,014 rows,
consecutive transport ordinals,2,048 exact admitted entry/return associations,
zero open admissions and zero mismatched returns. The last capture was drained,
with zero transport rejection, no sink failure and high-water638 rows; four
subsequent observation rows were persisted by the final flush. Transport capacity
is16,384 detail rows plus65,536 boundary rows, with reserved ends charged while
pending or in flight. These are diagnostic bounds, not increased guest memory.

Every admitted original call had logical count 103. All used reused owner address
`0x08830d80`;51 constructor epochs were retained. Function admissions were51
constructors,51 setups,948 time updates,948 evaluators and50 `0x430fa0` calls.
Address reuse is explicitly separated in the offline epoch audit. Nineteen
retained epochs have matching observed calls and no explicit quota loss; this
does not establish destruction, all possible writers, or any first-draw link.

| First retained packet reporting a bound | Exact observation |
| --- | --- |
| Detail loss, serial13,888 / transport ordinal16,000 | `0x4310a0`, invocation808,809 entries,808 ends,8,192 details; count 103 owner `0x08830d80` |
| Admission loss, serial22,627 / transport ordinal24,739 |2,048 entries and2,048 ends already completed; explicit overflow flag |

These are first **retained loss reports**, not an asserted instruction for a
missing event. The earliest full epoch shows actual ordering:

| Retained serial | Actual observation on that epoch |
| --- | --- |
|1→48 | Constructor `0x431950`, matching return PC+ESP |
|4 | `0x43195d` writes owner+4 to zero |
|34 | `0x4319fd` fills the table, including index 72, with `ffffffff` |
|36 | `0x431a13` clears the channel span including both+38/+68 weights |
|49→99 | Setup `0x4314f0`, matching return |
|95,97 | Two actual `0x4316da` word stores in index 72's16-byte entry |
|100→130 | Time update `0x4310a0`; nested evaluator111→118 returns at `0x4311c1` |
|165 and later | Actual `0x4310b8` stores change owner+4 |

Store claims require adjacent pre/post packets and actual copied backing-address
overlap. The raw packets retain operands and values. Native arithmetic was
validated by the generated controls; no new original arithmetic or scheduling
mismatch is claimed. None of these temporary epochs is tied to a first index 72
palette or scene draw. No index 72 palette observation or first-zero target was
captured before shutdown. The prior target's ownerTime0/channel-start45.900
question therefore remains unanswered. Later decoder eviction is reported
(103,275 at the final capture), further limiting instruction attribution.
The separate world/draw timeline had already reached its inherited bounds
(2,048 world rows and64 draw rows) during menus; it cannot establish later
scene-draw ordering either.

The next useful investigation must preserve **relevant constructor epochs through
the first draw within the existing bounds**, accounting for these repeated
count 103 temporary epochs. Increasing memory, replaying this exhausted observer,
or repairing guest animation values would not answer the missing causal link.
There is no demonstrated x86/Win32 divergence to regress or repair yet.

## Inspected media and closure

Paths below are relative to the ignored evidence directory. Every inspected PNG
and its SHA256 is listed in `inspected-captures.json`; no media was copied.

| PNG | SHA256 |
| --- | --- |
| `new-game-held.png` — Warrior difficulty | `351ccf443e882096e8b1351584b27d5034f0dc8c75f41f91362aaf88c962ec9f` |
| `difficulty-warrior.png` — Kordava loading | `6f1feb68ed236ee6b583758d9a91f17e0d8cf2c2fd4a3343d138317fb87c2fc3` |
| `loading-11.png` — black client, no gameplay | `36cc8fe8c45072720d525204ac11524d172ae595f4cb12ca9b344523af9a3667` |

The run-only analysis addition has its own `analysis/epochs.py.patch`; runtime
helper pins remain unchanged. `runtime-evidence-verification.json`,
`postoriginal-closure.json`, `owned-runtime-cleanup.json` and the final artifact
manifest provide identity and cleanup checks. `result.json` is written last,
after publication and reopening/hash-checking the retained artifacts. Only this
note is committed; the commit names this run and the executed tests.
