# Independent acceptance: original Tux Racer recovery, 2026-10-28

**REJECT / INTEGRATION AND REGISTRATION HOLD** for candidate
`52a8dfa1636c127df19e721cdb5d0f173c87aa5c` under the assigned fail-closed
closure and publication contract. Candidate source is unchanged. No repair,
main integration, registration, deployment or gameplay was performed.

## Findings

1. `main()` writes `inventory.json` before calling `closure()`. A malformed-PE
   rejection then exits with an exception after replacing a preexisting inventory
   with a new `complete: true` extraction inventory, while preserving an older
   `closure.json`. The destination remains populated. The inventory's complete
   flag describes extraction; nevertheless the failed overall stage leaves mixed
   generations and destroys the prior inventory. This fails the assigned
   preservation/publication-order acceptance requirement.
2. `closure()` reports `unresolved` direct DLL imports but `main()` still returns
   success and publishes both reports. Data files are enumerated, not validated:
   a missing literal `source missing.tcl` is not a failure. These are limitations
   of the recipe's enforcement, not evidence of missing files in the retained
   original. The separate predecessor lexical data audit remains valid evidence
   for the exact original; it is not dynamic Tcl execution or a production CLI
   validation stage.

## Evidence strength and boundaries

The first behavior tested was the exact pinned, unmodified Python CLI on a tiny
traversal ZIP. Both `extract` and `inspect` returned nonzero at the fixed SHA256
guard, without destination or report creation. An empty archive independently
hit the size/type guard. Read-only `inspect` on the retained original succeeded
with 180 entries / 13,225,945 expanded bytes. `extract` rejected its one-byte-too-low
aggregate allowance before writes. It also rejected a preexisting destination
and preserved its file and both preexisting reports. No full extraction, download,
original execution, Wine, browser, build or Boat occurred.

The fixed production hash prevents synthetic CRC/PE/DLL/data fixtures from
reaching deeper stages through the unmodified CLI. Deeper path, drive, absolute,
case/prefix collision, link/special, aggregate, CRC/local-member mismatch and
malformed-PE tests therefore call unchanged helpers or the exact `main()` with
an **explicit test-only pin seam**, which checks each synthetic fixture against
its own digest. No source transformation or candidate repair is used. Metadata,
extraction, ZIP streaming, PE parser and report writes remain real. These tests
establish stage behavior; they do not demonstrate that an adversarial ZIP can
pass the fixed production digest. The rejection is for the assigned stage
contract, not a demonstrated hash bypass or corruption of the original.

A healthy synthetic i386 PE importing only KERNEL32.DLL passed the same stage
route and reported zero unresolved DLLs. The missing-DLL case completed normally;
the malformed-PE case rejected after the inventory write. Minimal ZIPs, extracted
fixture bytes, old closure, new inventory, checkpoints, commands/exits and separate
stdout/stderr are retained in the canonical evidence directory.

The seven unchanged predecessor focused groups and coordinator-verified 171
source/artifact/payload hashes are reused, not repeated. Original ZIP identity:
8,009,319 bytes, SHA256
`1497e326af9aa591243f4ff1083d4d99de7dc5f0396e37f45ca7bf4f98823c34`.
The original was independently rehashed once, in place. Standing extraction:
158 files / 13,225,945 bytes; not copied or re-extracted. Candidate recipe SHA256:
`eeb1ebb2a1bb694842044cce4923bca60fee9e6d8497092dd6c753f21a35dcc4`.

Included GPL/Tcl/SDL notices and music attribution remain preserved. Standalone
LGPL / SDL_mixer documentation and redistribution/source-offer gaps remain open.
Dynamic imports, computed Tcl paths, decoding, configuration writes, target APIs
and runtime/gameplay are unknown. Even later acceptance would authorize only the
next integration/registration gate, not claim gameplay.

## Reproduction and retained evidence

From this sparse task checkout, under the assigned supervisor/limits, run:

```
/usr/bin/python3 test/test-tuxracer-independent-accept-oct28.py FRESH_OUTPUT boundary
/usr/bin/python3 test/test-tuxracer-independent-accept-oct28.py FRESH_OUTPUT deep
/usr/bin/python3 test/test-tuxracer-independent-accept-oct28.py FRESH_OUTPUT stage
/usr/bin/python3 test/test-tuxracer-independent-accept-oct28.py FRESH_OUTPUT positive
```

Each invocation needs a distinct fresh output path within the task allocation.
The stage test succeeds when it confirms the rejection findings; its test-process
exit zero is not candidate acceptance. Evidence root:
`/home/user/wine-assembly/scratch/usage-watch/tuxracer-original-recovery-independent-accept-oct28/`.
Canonical `receipt.json` binds source/fixture hashes, durable fixture copies,
operation receipts, resource admission, publication and cleanup. Its recovery
instructions retain the standing predecessor dependency rather than duplicate
original payload bytes.

Two test-development incidents are retained: an attempted >12MiB sparse fixture
was stopped by RLIMIT_FSIZE (replaced with empty-file control without raising the
limit); an initially overescaped synthetic PE was corrected, with its initial
failure preserved separately. Passing CLI groups were reused across continuation.
Initial read-only shell inspection was not externally supervised and produced
truncated tool output; later dependent operations use the bounded task supervisor.
Do not interpret this report as blanket compliance for that initial inspection.

Root tracked/index/refs and donor repositories remain read-only. Only two new
owned report/test paths are committed. The standing messageboard exceeds the
12MiB file limit: no doomed append was attempted. The coordinator must publish
the handoff note from `publication-note.txt` under its own authorized limits.
No box is assigned; coordinator retains lifecycle ownership. Stop after task
branch push and exact remote verification; no replacement task is authorized.
