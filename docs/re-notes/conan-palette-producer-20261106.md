# Conan palette producer: observation repair and remaining runtime gap

Run: `scratch/runs/20261106-conan-palette-producer/`.

This investigation does **not** identify a causal emulator defect or establish
player-controlled gameplay. It repairs the run-owned observation path, but the
single original-game launch was disqualified and stopped before any palette
producer rows arrived. No production CPU, RPC, renderer, or guest bytes changed.

## Why the original launch is disqualified

The first locked build and byte-identical baseline modules used
`a6d8048f5887c2e9b74b94021e1df98e5c54df88`. A concurrent pull advanced source to
`277b92b72175d9a60cd835baadd034f9309195d2` before diagnostic compilation. The
diagnostic module therefore gained the source-declared
`d3dim_gpu_cooperative_enable` export. Initially the worker incorrectly treated
this as diagnostic compiler retention and removed only that export entry.
That adjustment did not establish source equivalence. The coordinator's
02:09 source-drift warning on the messageboard was missed before launch.

The one original launched at 02:24:24 UTC and was closed at 02:25:06 immediately
after the error was recognized. There were no gameplay inputs, palette-update
observations, or retries. Its startup observation has 16,729 real decoder-map
arrivals, zero producer rows, and zero observer errors. Its actual page, owning
CPU Worker, and renderer Worker module identities were recovered and verified;
this establishes which diagnostic bytes ran, not equivalence to the earlier
baseline. `original-disqualification.json` records the exclusion.

The personally inspected `startup.png` shows a black viewport during startup
and loading logs. It provides no evidence of movement, combat, or any other
visible player response. The existing candidate remains unqualified for
ordinary gameplay.

The invalid comparison's modules, contracts, source patches, and control results
are preserved under `source-drift-controls/`. Earlier rejected attribution
attempts are preserved under `failed-control-1/` through `failed-control-4/`.

## Run-owned passive observer

The previous kind-31 diagnostic packets did not cross the production RPC
forwarder. The replacement uses supported kind 30 with distinct tag `0x43504d50`
and complete, ordered decoder records. It does not broaden `lib/guest-rpc.js`.
Production `owningWorker` receives the actual decoder emissions; the generated
controls do not inject maps or set CPU registers through live exports.

Decoder records initially describe staging addresses. Passive metadata follows
the cache's existing memory-copy publication to their execution addresses.
The host retains bounded whole records, records eviction ordinals and absent
keys, and resets only the corresponding thread slot on arena rewind.

Store attribution also needs the original instruction record for fused x87
execution. A rejected block-executor hypothesis produced no origin-alias
activity and was removed. The observed palette store instead uses the short
x87 pipeline: the final FSTP record survives even when the first handler record
is rewritten. The observer copies that final record before the store. It also
has scalar and island attribution and a tree-store metadata hook. The tree
family has no separate generated attribution case in this run.

Passive guest reads accept only the direct image window or already committed
sparse pages, with explicit bounds and cross-page handling. They never invoke
`g2w`, a pager, or guest fault handling. An unmapped object control must remain
unavailable without causing a guest exception. Actual reserved-page guest reads
are tested separately through the real SEH/pager path.

The intended original capture follows dynamic owner pointers and index 72 at
`0x431e30`, copies cache flags, parent indices, four table pairs, decomposition
words, channel records, and palette stores, and retains the uncached update
when a later cached call occurs. It does not assume the previous allocator's
owner/base addresses remain valid. Guest disassembly is read-only evidence.

## Validation and source recovery

After stopping the original, the worker rebuilt current main under
`flock /tmp/wine-build.lock bash tools/build.sh`. The replacement module recipe
requires identical canonical closure hashes for baseline and diagnostic and
exact imports/exports without export normalization. Baselines must equal both
shipped production modules byte for byte.

The generated public CPU/COM controls cover scalar stores, scalar FSTP, REP,
fused x87 islands, and the lazy palette updater, including a matrix crossing
committed sparse pages. They exercise all twelve public WORLD mutation routes,
canonical producer/executor state, the normal strict singular-transform error,
and a real guest child thread. Equivalence compares eight GPRs, EFLAGS, FNSTENV,
FNSAVE, guest thread identity, and numerical results. A bounded 128-record map
is churned with more than 512 ordinary guest blocks to test real eviction.

The independent native x87 oracle has 24 passing multiply/FCOMP controls across
three precision-control words, including signed zero and unordered comparison.
The generated SEH controls compare baseline/diagnostic, standard/compat, eager/
lazy, and committed/reserved reads. Reserved reads must invoke the actual guest
handler exactly once, commit/fill the page through public Win32 calls, and
resume with `0x12345678`; committed reads must not invoke the handler.

The final same-closure tests passed: 20 producer cases and 16 SEH/pager cases,
ending at 02:27:43 and 02:28:03 UTC respectively. Both modules use canonical
closure SHA-256
`dba4d3b013cc1f620d76cf7ae984c28d428c88c4e8b239894f6dddcd72b215b4`.
The earlier cross-source PASS results are not substitutes for these tests.

| Module | SHA-256 |
| --- | --- |
| Standard production/baseline | `881a4ffc816bb2a752febff01551ade99dfc5680dc8a3a6a4222f0bb8d2c1951` |
| Compat production/baseline | `721dea351a4ac638cc275b9fa30101be050b0836eb6d44de0230e9edb38e2079` |
| Standard diagnostic | `920e3c0d8266602e244235f223c56ec58bd97d5abe08067dd9e8d8423bc2255b` |
| Compat diagnostic | `a8cd4394934a90f51e63c5aba54c5d4253c4dbfba747367fad49b3b3d7e9bb0b` |

Each final diagnostic palette case receives 1,150 decoder records and 1,611
relocations while evicting 1,756 records. The first actual fused palette FSTP
is attributed to `0x430e1d`; the second sparse-page store is `0x430e24`.
Independent generated inputs produce binary32 2 and 4 respectively. The
uncached flag is 0 on the first call and 1 on the second. These are generated
fixture facts, not measurements of original Conan inputs.

To reproduce the controls, run the current locked build, then
`prepare-modules.cjs baseline standard`, `baseline compat`,
`diagnostic standard`, and `diagnostic compat`, followed sequentially by
`producer-controls.cjs` and `pager-controls.cjs`. The run's original immutable
deadline guards must be renewed only under a new authorized runtime window;
the existing one-shot original guard must not be removed for a retry.

Git is the source archive. `source-pin.py` records exact Git SHA, relevant
binary diffs, owned helper new-file patches, and hashes. The run preserves unique
tested modules and logs without source archives or media copies. Original media
remain at `scratch/game-media/conan-installed-20261105/`; `verify-inputs.py`
checked all 37 existing inputs and registry pins in place. The EXE SHA-256 is
`c343ef6a51a88c5b01a3c3e1511035359d25336fbe010123bd2e02962b77df56`.

## Remaining producer question

The prior [matrix-write investigation](conan-matrix-write-20261106.md) proved the
64-byte REP copy and preceding first product components. Those are not new
mismatch evidence. This run captured no original `0x431e30` producer inputs, so
it cannot determine whether a cache decision, channel selection, x87 operation,
or earlier input first differs from expected behavior.

The next bounded original investigation needs the validated same-source observer
and copied actual inputs at that lazy updater. For each candidate discrepancy,
compare the exact operation against documented x86/Win32 semantics and an
independent result. The run-owned `analyze-palette.py` can compare captured scale
multiplies and channel FCOMP decisions with the native oracle, but it was not
run on invented or generated data as evidence about original Conan. Zero scale
or skipped channels alone would not prove an emulator defect.

No causal repair is justified by the evidence in this run. No further original
launch is held by this worker.

## Runtime release

Ordered releases were point-a1 discriminator 0025, then Aranna recovery 0100.
Independent cleanup opened the gate at 02:03:02.647705 UTC, with fixed deadline
02:48:02.647705. All runtime work ended before that deadline. Final independent
cleanup confirmed 321 owned PIDs absent, 18 ports refusing connections, 18
profiles absent, all four runtime/build locks free, no heavy process, and
5,932,699,648 free bytes on `/home`. `owned-runtime-cleanup.json` is the receipt.
No boxes were assigned or used; box ID, state, and expiry are not applicable.
