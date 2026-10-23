# RichEdit native callback fixture independent review — 2026-10-23

Verdict: accept the **corrected fixture for pending native qualification**.
Commit `233a627d6a1ece2a95fb5600d000aa96be5c9e17` had a precise assertion
gap; this review supplies a narrow test correction. **Native execution remains
UNEXECUTED.** This is neither full-module validation nor runtime acceptance.

Inputs: published `task/rich-edit-native-callback-fixture-oct23` at `233a627`,
remote main `bb9c496ed13095cc832fdf607f0937fb9c14b7de`, and accepted source
`3c01665cdeb65ca7aebfdae7aec8dba4c3499884`. Strict authenticated `ls-remote`
verified both published inputs. The edit fragment is the identical blob
`6e07d34aedf6199a419fcbe0bd79b7b6a409dd8f` in accepted source and main.
All 63 donor artifact SHA256 seals verified; the donor remains unchanged.

## Defect and narrow correction

The original 70-sibling oracle accepted only aggregate LRESULT 210 and callback
count 140. Replacing two nominal calls by results `[0,6]` and counts `[1,3]`
preserves both totals. The independent replay demonstrates that the original
oracle accepts these observations. Every sibling now checks result 3, exactly
two callbacks, error 0, visible text `OWN`, stack canary and interrupted state
before contributing to totals. Compensating failures reject individually.

The original PE checker also accepted a sliced loop shortened to one iteration
and deleted timeout spin instructions. It now requires the emitted 1,000,100
iteration decrement/backedge sequence and unconditional self-loop tails in
both timeout callback locations. Native cases invoke this PE check before
loading the fixture. This prevents those specific scenario substitutions from
qualifying through otherwise identical result/error observations. These are
structural guards, not measured execution-duration evidence.

The emitter itself is unchanged: all seven PE images, bootstraps, callbacks
and leaf byte sequences match the donor exactly. No production source or
module changed. Only `test/test-richedit-stream-ownership-native.js`, this
note and the independent review evidence are new/changed relative to the donor.

## Reviewed paths and oracles

- Ordinary: public PE CreateWindowExA imports create STATIC and two
  RichEdit20A controls. Outer `send_message` and nested SendMessageA IAT calls
  reach the existing WAT native control path; no private wrapper or fabricated
  owner record is injected. Data/EOF counts, result, dwError, visible text and
  callback argument observations prevent the normal no-callback/empty success.
- Nested and nested-timeout: callback snapshots preserve six non-EAX/non-ESP
  registers plus ESP; EAX is checked as the public nested result. Inner text,
  count/error, canary and outer completion must agree. Full supported outer
  register/control state is collected before sibling tests overwrite counters.
- Sliced/timeout: emitted long decrement loop and infinite self-loops are
  independently decoded with objdump. Accepted source repeatedly runs one
  million blocks, checks retained child/root/depth before retirement even on
  timeout, and caps at 64 rounds. Offline inspection cannot prove these budgets
  execute correctly or measure the actual number of runtime rounds.
- Capacity: callback depth 63, trap `unreachable`, zero recursive returns,
  unchanged API-entry ESP and all five prospective callback-frame DWORDs are
  required. Callback code writes probes at pre-call ESP-40 through ESP-24;
  SendMessage pushes its four arguments and return at ESP-20 through ESP-4.
  The edit wrapper's five pushes therefore target exactly those probes if it
  writes before failed acquisition. Unrelated early/late traps fail counts or
  canaries. The trapped instance is discarded; recovery is not claimed.
- Error: the real callback writes a chunk and returns 37. Public result 0,
  dwError 37, one callback and empty document must agree; source discards the
  failed chunk before adding its byte count.

The acquisition/retained-identity/source-routing checks remain supplementary
text checks. They do not prove WAT semantics or exercise mismatched identities.
No synthetic observation is a guest result. Callback ABI pointer observations
are nonzero checks plus observable buffer/count effects, not full address
identity proofs. EFLAGS, identity/epoch fault injection, spill exhaustion,
SEH, DLL RichEdit and Windows parity remain outside scope. No claim of universal
false-pass immunity is made.

## Checks and retained evidence

`scratch/runs/20261023-richedit-fixture-independent-review/` contains the
independent reviewer `review.js`, `independent-checks.json`, command logs,
`checks.json`, measured allocation, and original/corrected offline receipts.
The original suite replay passed 59 controls; the corrected suite passed 70.
The independent review passed 224 rejecting controls across all scenarios:
each restored outer register/control field, nested snapshots and outcomes,
all five capacity slots, callback counts/results/errors/text/ABI, slice/spin
substitutions, and every sibling result/state requirement. The actual pre-fix
baseline rejects; its SHA256 remains
`420ae642fef0b7b781188875be698ca3cafeb779191f0da36ffa3baca02091e8`.
Syntax and diff checks pass. Missing module provenance exits 1 before VM setup.

The 56 regenerated binary artifacts (two replays of seven times four files)
matched accepted donor artifacts. Replayed binary/disassembly packages were
removed after inspection; reuse the exact sealed donor package at
`/home/user/wine-assembly-rich-edit-native-callback-fixture-oct23/scratch/runs/20261023-richedit-stream-native-fixture/generated/`.
This review does not duplicate its packaging or change its accepted receipts.

## Next exact native qualification requirement

Separately authorize a runtime allocation with the normal host dependency
closure and 512 MiB guest memory. Supply a preserved normal full-module build
whose complete source closure matches the selected source revision; verify
the external build receipt, source identities, region layout and module SHA256.
Do not compile or substitute historical ICM/Shadow Man modules for this review.
Run the corrected fixture with `WINE_ASSEMBLY_WASM`,
`WA_RICHEDIT_WASM_SHA256`, `WA_RICHEDIT_SOURCE_REV` and a fresh `--artifacts`
directory, as specified in the donor note. Require all eight child cases
(seven scenarios and fresh ordinary after terminal capacity), all per-call
sibling assertions, watchdog completion, inspected raw observations and an
overall native PASS. Retain and diagnose the first concrete failure.

No runtime/Boat/browser/build/recovery operation, worker, integration or main
mutation occurred. No test box was assigned or contacted. Coordinator retains
lifecycle ownership; no box state or expiry was freshly verified by this review.
