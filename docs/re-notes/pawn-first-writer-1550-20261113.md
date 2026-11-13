# Pawn first writer: serialized launch refused; trace coverage reviewed

The fourth record's actual first writer and a valid second native reply remain
**unproved**. No Pawn original, watchdog, input or box was created in this run.
No production change or emulator defect is claimed. Evidence is in ignored
`scratch/runs/20261113-pawn-first-writer-1550/`.

Verified all 169 seals from the 1445 modalguard parent and all 57 seals from
the 1520 writer analysis. Independently rehashed the whole original 100-byte
save in its existing location to
`811659988ee98f19ca08615f1191431993f5d51646ea41efed5fdb6f0ff5cf77`.
It was neither copied nor edited. Its e4/Nf6/d4 records and fourth
`0,44,7,15,0,0` record retain exactly their parent's acceptance limits.

## Concrete runtime blocker

LMarbles1550 announced its resource phase at 03:36:18Z and RESOURCE_DONE at
03:36:56Z. Prepared the qualified owner/modal/finite-drag helpers, unchanged
strict queue predicates, and bounded `0x402a50` trace with limit four. Frozen
Git was `ef38e35c8eb3ed590fe3393def99bc6b034d691f`; all 322 pins were computed
from actual current files, including newly enumerated source/library paths.
The actual module SHA was
`6888cc5e4ec7693a8a317fe29147994c7f88fe43afe3109fe6ab0e3e349eec9f`.
Git, relevant binary diff, run-helper patches and path/hash pins preserve
provenance without archiving source trees or copying media.

The single supervisor acquired `/tmp/wine-heavy-runtime.lock`, then its actual
process scan found Node `test/run.js` PID **1125248**. It refused serialization
before reaching the floor/launch decision, arming its independent watchdog,
or creating Pawn. The scanned child's ownership and command beyond that match
are unknown: it was already absent at the follow-up read. Do not attribute it
to another worker or infer lock misuse from that incomplete identity.

The follow-up available-space sample was **1,498,624,000 bytes**, also below
the required 1,500,000,000 floor. No retry or independent recovery followed.
Supervisor PID 1125257 actually waited **1**, with separate stdout and stderr
EOFs; its retained stderr contains the refusal assertion and PID. The outer
tool completed exit 0 because it reports the supervisor's result. This is
not native runtime success. Native/watchdog waits are N/A, not started.

## First-writer evidence conditions and existing hook limits

Reviewed the existing hooks read-only while waiting; details and source hashes
are in `trace-coverage-review.json`.

- `test/run.js`'s trace-at compares returned EIP with the target, and the WAT
  breakpoint checks EIP at block dispatch. `set_bp` does not itself enable
  instruction stepping or split an interior instruction into a block entry.
  Native `0x402a50` follows the `0x402a4c` store inside a straight-line sequence
  after return at `0x402a22`. Its prepared trace therefore has a coverage
  prerequisite: establish that this instruction is an actual block entry.
  A missing trace hit would not establish that the store never executed.
- The ordinary watchpoint checks value changes at block boundaries. It can
  establish a changed value and predecessor block, but does not by itself
  establish the precise instruction or detect a same-value write.
- Existing `set_instruction_watchpoint` can publish one instruction per
  decoded block. Existing `native_store_arm/get` records overlapping-store
  epochs, last writer PC/address/width and host/invalid/overflow indicators.
  These are available primitives, not observers exercised against Pawn here.
  A last-writer receipt establishes the first writer only with a proven
  baseline and continuous scope, epoch delta exactly one, no invalidation,
  overflow or unknown writer; otherwise a complete ordered store journal is
  needed. Selected PV byte provenance needs its own continuous observation.

Thus a trace of static candidate `0x402a4c` alone must not be promoted to the
first actual record-four writer. The known book/search branches and root-row
clearing remain hypotheses until observed on the original. This hook review
does not establish a Pawn API/interpreter fault, justify a failing gameplay
regression or warrant a production fix. No guest calls were forced and no
guest/save/position/health/AI/configuration/clock state was written.

## Checks and next step

Both parent seal sets, whole-save hash and eleven helper syntax checks passed.
No unchanged control matrix was rerun. Postcheck found concurrent changes to
`test/run.js`; they are separately owned and captured read-only as a binary
diff. They were not part of any executed Pawn runtime. The other frozen pins
still matched. This documentation-only change claims no new build/test of
production code and no gameplay acceptance.

Next requires sustained disk headroom and zero actual runtime children under
serialization, a new freeze of the then-current source/module, prearmed
observable independent watchdog, and qualified observational granularity for
the first write and selected-byte provenance. Preserve the whole native save,
review e4/Nf6 before d4, and send no third move or replay. Box ID none, state
NOT_CREATED, expiry null, stop receipt N/A.
