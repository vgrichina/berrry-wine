# Conan weight writers, 2026-11-06

No emulator mismatch is proved. Earlier constructor/setup/envelope/normalization
writers are dynamically observed on other owners, but the new first-zero
owner's earlier writers remain unobserved: the diagnostic exhausted its
invocation budget before that owner reached the palette updater. The one
original is closed; there was no retry, guest modification, render-error
suppression, implementation repair, or gameplay acceptance.

Evidence: `scratch/runs/20261106-conan-weight-writers/` (ignored). The prior
[lazy-input investigation](conan-lazy-inputs-20261106.md) remains valid for its
six retained updates, 99 multiply stores, 17 channel decisions and 15
cache/parent checks. Its owner address was not used as a new-run identity.

## Actual earlier writers

A complete early example uses owner **`0x0882e7b0`**, distinct from the new zero
owner. Serial numbers below are copied CPU packet serials on owning endpoint
1, slot 0; store PCs come from the actual decoded instruction record.

| Serial | Actual boundary or store | Result |
| --- | --- | --- |
| 247 → 286 | Constructor `0x431950`, matched entry/return PC+ESP | Same dynamic owner |
| 282 | REP STOS at `0x431a13` | Clears the channel-record span, including both weight words, to zero |
| 287 → 335 | Channel setup `0x4314f0`, matched entry/return | Initial channel setup |
| 314 | `MOV [EAX+0x38], EBP` at `0x431635` | Explicit weight-zero store |
| 336 → 371 | Time update `0x4310a0`, with nested evaluator | Actual update lifetime |
| 347 → 354 | Evaluator `0x430ff0`, parent invocation retained | Time `3c23d70a`, flags 5, amplitude 1, start 0, end 1 |
| 357 | `FST [EBX-8]` at `0x4311c1` | `owner+0x38 = 3c23d70a`, native x87 agrees |
| 367 | `FSTP [ESI+0x38]` at `0x431205` | Copied factor 100 × copied weight ≈0.01 stores `3f800000`; native agrees |

The next retained update repeats the envelope store at 395 and normalization
at 406. These observations establish actual earlier writers and their inputs
for this owner; they do not establish the missing zero owner's lifetime.

Across complete retained associations, **5,640 envelope-result stores** and
**5,556 normalization stores** match independent native x87. Actual guest
EBX/ESI destinations and adjacent pre/post store packets were audited for all
11,196 comparisons. The captured control word is `0x023f`. These counts concern
other observed owners; they are not additional checks of the zero owner.
The copied normalization factor is an input to the multiply check, not an
independent proof of its entire sum/division producer.

## New first-zero owner and scheduling boundary

The new candidate is **owner `0x08848910`, index 72**, with 103 table entries.
The first uncached palette entry is serial **219970**; first retained zero
palette output is **220056** at `0x431e7b`. Both `owner+0x38` and `owner+0x68`
are `00000000`. Owner time at `+4` is also zero.

The copied first two channel records have amplitude 1 and starts
`42379988` (45.899932861328125). Channel 0 flags are `0x0d`, with identical
start/end; channel 1 flags are `0x05`, with end `4238ccbb`
(46.19993209838867). Their copied channel times are `c0bccc3c`
(−5.899930953979492). Evaluating the envelope against these copied boundary
states gives native zero for both channels. This is a conditional calculation
from a snapshot, **not an observed evaluator call or proof of the writer**.

| Palette entry serial | Owner time | Weight 0 / weight 1 | Index-72 channel/key words |
| --- | --- | --- | --- |
| 219970 | `00000000` (0) | `00000000` / `00000000` | `003f0000`, `003f0001`, `ffffffff`, `ffffffff` |
| 220642 | `00000000` (0) | `00000000` / `00000000` | Same |
| 221705 | `4238ccbb` (≈46.200) | `3f800000` / `00000000` | Same |
| 223006 | `4239ffee` (≈46.500) | `3f800000` / `00000000` | Second word becomes `003fffff` |

The low/high halves encode channel/key. The second slot's channel changes
from 1 to `ffff`, while key 63 remains. This is a **between-boundary state
change**; its actual table-store instruction was not retained.

The first zero draw is generation 1, sequence **68319**. Its immutable
WORLD writer is SetTransform at `0x41ccee`, WORLD serial 111765, with nine zero
linear components. Producer/lowering/executor bits agree. The strict renderer
reports `D3D9 fixed function: singular normal transform`; it remains enabled.
Delivery order puts the first palette entry at 222082, zero draw submission at
222748 (last copied owning CPU serial 220635), and the later weight-1 palette
entry at 223818. This relates copied updater state to actual draw scheduling;
it does not reveal the missing intervening writer or prove native scheduling
would differ.

## Observation failures and limits

The original diagnostic has **partial coverage**, despite passing the smaller
preoriginal controls:

- A load burst overflowed the bounded persistence backlog. The collector keeps
  the first 32 error notices; that is not the number of lost events.
- Detail capture saturated at 48,000. Invocation admission saturated at 12,000;
  the first retained overflow packet is serial 175383. At first-zero palette
  entry, overflow is already 5629. No constructor, setup, evaluator, weight
  store or table store for `0x08848910` survives in the retained writer chain.
- The target has 145 retained palette-boundary rows, no observed constructor
  generation, and four retained index-72 entries. They cannot establish absence
  of an earlier updater call.
- Decoder eviction is bounded and reported. Missing instruction metadata is
  uncertainty, not inferred execution or an emulator defect.
- Outside an invocation, the additional watch follows the last observed owner.
  Copied object and palette owner can differ; only matching addresses support
  an owner claim. Page-crossing owner spans are not watched. Index-72 copies
  from owners with fewer than 73 entries are outside the logical table and are
  not treated as channel-table evidence.
- The run-only auxiliary-copy predicate uses bitwise `depth & condition`, so
  even nesting depths omit that copy. The full copied owner record independently
  supplies the envelope words for accepted comparisons, with exact record
  pointer/range checks. The original helper remains unchanged and pinned.

The first analysis conservatively accepted zero envelope comparisons because
auxiliary copies were unavailable. `retained-findings.json` preserves that
result. `retained-findings-owner-inputs.json` records the recovered owner-input
analysis: 5,741 evaluator admissions, 5,640 checked stores, 235 rejected store
associations, 11 unresolved records, 1,188 retained serial gaps, zero accepted
mismatches. These categories are not disjoint loss totals. Associations require
same endpoint/parent, matched PC+ESP return, adjacent store packets, no intervening
retained-serial gap and no invocation overflow. New analysis scripts were added
after shutdown; the runtime recipes were not changed.

## Validation and identity

The ordered KKnD0245 → WebGL0247 → ArannaComplete0320 exact FINAL releases
preceded independent checks of 186 absent PIDs, 12 refused ports, seven absent
profiles, four free locks and disk above 1.5 GB. The immutable window is
**04:21:41.013680–05:06:41.013680 UTC**. The original supervisor ran
**04:25:23.950–04:49:35.812**, with normal Chrome exit 0.

Before the original, the current locked build passed:
`flock /tmp/wine-build.lock bash tools/build.sh`. Same-current-source standard
and compat baselines are byte-identical to their shipped modules. Diagnostic
imports and exports exactly match both baselines. Controls passed:

- 20 generated public-COM cases using actual production owning CPU and renderer
  Workers: GPR/lazy flags, x87 environment/register image, nested PC+ESP/parent
  pairing, child thread/module attribution, real store routes, bounded decoder
  eviction and unchanged strict render failure.
- 16 committed/reserved, eager/lazy cases with ordinary DLL initialization and
  genuine SEH commit/fill/resumed read **inside an observed lifetime**. Passive
  reads did not commit reserved pages; baseline/diagnostic outcomes agree.
- 24 independent native multiply/FCOMP cases and 12 zero/half/one/fade envelope
  expectations, plus generated PE/ABI validation and helper syntax checks.

Canonical closure SHA-256:
`1984f3ebf491504123f426679d9ff1a9230426a5610bd7e1da4e615620009545`.
Standard baseline/diagnostic hashes are
`3bc4e29b86d3a085bf14de1a242f87f22321d513f26cb2259f22804d0c32dc7e` /
`99547737e8329f10242575bc032961cedc2c7277e4a050b9cc3399c8b4b26534`.
Compat baseline/diagnostic hashes are
`473ec05b5b10c5d6fa653d042b0aec4821804d6e6c5adf1e3ec8c0d744d4f2bc` /
`0475ba3df24f4e7782b0e99f5f2b4f48923ade1013d0c6ba225712893e767a1d`.

Preoriginal and end source/helper/module guards passed. Identity-only CDP
retrieved the actual page, owning CPU and render Worker module hashes, all
matching the pinned diagnostic, plus 18 served JavaScript identities. All 37
existing media hashes passed again in place. EXE SHA-256 remains
`c343ef6a51a88c5b01a3c3e1511035359d25336fbe010123bd2e02962b77df56` at
`scratch/game-media/conan-installed-20261105/`. Recovery uses Git SHA,
relevant binary diffs and new-file patches; no source archives or media copies.
Raw observation is 3,310 unique gzip segments, never repeated cumulative
full-prefix dumps. Captures were personally inspected: menu, Warrior, loading,
town/street subtitles and final black cinematic. Gameplay, audio and FPS are
not accepted.

## Next causal boundary

The concrete blocker is diagnostic coverage before the zero owner's first
palette call, not a demonstrated emulator defect. A successor should first
prove burst-safe bounded transport and reserve lifetime capacity for owners
whose real table count admits index 72, rather than spending the budget on
repeated two-entry owners. Controls must assert auxiliary copies at even and
odd nesting depths and validate logical table bounds. Then capture the new
candidate's constructor/setup/time-update call ordering, `+4` time writer,
`+0x38/+0x68` stores and real index-72 table stores before its first draw.
The discrepancy to seek is why copied owner time is still zero while channel
starts are around 45.900, and whether that call ordering differs from native.
Zero weights and the observed later transition to 1 alone justify no repair.
