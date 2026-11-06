# Conan matrix-write investigation, 2026-11-06

The first changed component of matrix `0x074ff2d0` is a correct copy of an
already-zero source word. Both preceding products' first components also
match independent native x87 results using the captured inputs. No emulator
mismatch or causal repair was proved. Ordinary player-controlled gameplay
remains unachieved. The remaining evidence gap is the producer of palette
entry `0x032e7a34`, inside or before the lazy update at `0x431e30`.

Evidence is in `scratch/runs/20261106-conan-matrix-write/`. This follows the
[upstream investigation](conan-upstream-world-producer-20261105.md), whose
healthy/degenerate matrix words are reproduced exactly in this capture.

## Captured first write and its inputs

The failing interval is generation 1849, thread 1, slot 0. Serial numbers
below are observer snapshots, not D3D command sequences.

| Serial | Captured event |
| --- | --- |
| 80688 | `0x42a42e`: matrix `0x074ff2d0` healthy, determinant `0.9999999826119712` |
| 80689 | `0x41cfd0` entry |
| 80691 | Return from `0x4130a0`: healthy source `0x085790f0`, subsequently copied to local `0x074ff17c` |
| 80692–80693 | `0x431ff0` receives owner `0x0884bd80`, index 72; returns palette matrix `0x032e7a34`, already fifteen zero words followed by `0x3f800000` |
| 80694 | First `0x414f60` product: A=`0x074ff17c`, B=`0x032e7a34`, output=`0x074ff13c` |
| 80728 | Second product: A=degenerate first result at `0x074ff17c`, B=healthy original matrix, output=`0x074ff13c` |
| 80762–80763 | First original-matrix change: 64-byte copy from `0x074ff13c` to `0x074ff2d0` |
| 80765 | `0x42a5a6`: first twelve words zero, original translation unchanged |

At the first changed write, component zero changes from `0x3f4c7360`
(`0.7986354827880859`) to `0x00000000`. The observed implementation is store
site 419, `src/05b-string-ops.wat:243`, `$rep_movs_mem`:

```wat
(memory.copy (call $g2w (local.get $dst))
             (call $g2w (local.get $src)) (local.get $bytes))
```

Captured source/destination physical addresses are 118559036/118559440,
length 64, ECX 16 and DF 0. The ranges do not overlap. All sixteen destination
words after the operation equal the copied source words before it. Read-only
disassembly identifies `REP MOVSD` at `0x41d3a2` within captured block
`0x41d396`; **that instruction PC is inferred**, because the optional decoder
metadata did not reach the observer. REP MOVSD copies ECX doublewords with
forward addresses when DF is clear. No arithmetic or matrix interpretation
belongs to this copy. See Intel's [instruction reference](https://intel.github.io/SDM/sdm.html)
for MOVS/REP semantics.

The first product's A matrix is identity rotation with translation words
`b8ed56df bbc2ee74 39c151f0`; its B matrix is already degenerate. The second
product uses that degenerate result and the healthy original matrix. For
both first components, the captured x87 cached ST(0) is positive zero and
the actual stored binary32 word equals native expected `0x00000000`.
The observed `$gs32` site 7 is `src/03-registers.wat:680`. Read-only
`0x414f60` disassembly loads A through ECX and B through EAX and evaluates
component zero in this order:

```text
A[0]*B[0] + B[8]*A[2] + A[1]*B[4] + A[3]*B[12]
```

`x87-component-oracle.c` executes the corresponding native FLD/FMUL/FADD
sequence with captured control word `0x023f` and final FSTP m32. It therefore
checks the precision/rounding setting and final single-precision store rather
than substituting JavaScript arithmetic. Nine exact-integer controls include
an asymmetric result of 250 that distinguishes operand order, across three
control words. Eight healthy original components also match. The applicable
FLD/FMUL/FADD/FSTP and control-word semantics are documented in Intel's
[software developer manual](https://cdrdv2-public.intel.com/868137/325462-089-sdm-vol-1-2abcd-3abcd-4.pdf).
These checks establish agreement for the checked components, not every
arithmetic instruction in the game.

`first-matrix-write.json`, `first-matrix-write-proof.json`,
`both-products-proof.json` and `healthy-original-component-controls.json`
retain copied inputs, pre/post words, registers, FPU state and independent
expected results. `runtime-evidence-verification.json` independently checks
these joins and exact predecessor before/after words.

## Remaining causal gap

Read-only `0x431ff0` disassembly calls `0x431e30(index)` and returns
`[owner+0x24] + index*64`. Captured base `0x032e6834` plus `72*64` equals
`0x032e7a34`. That returned matrix is already degenerate when first supplied
to the product. This observer did not watch writes to that palette or capture
`0x431e30` entry. Its producer, earlier inputs and update decisions remain
unobserved; the evidence does not establish whether guest data, an earlier
emulator operation or another cause produced it.

The diagnostic emitted decoder-map packets as kind 31, but production
`lib/guest-rpc.js` forwards kinds 5, 6, 21, 22 and 30 only. Both generated
controls and original therefore received zero decoder-map records. The
controls checked state and store packets but failed to assert decoder-map
arrival. Kind 30 store/boundary packets are complete at the saved interval;
exact instruction attribution remains limited as stated above. Future work
should first validate decoder mapping/eviction through the real owningWorker,
using a supported kind-30 subprotocol with distinct framing, then trace the
actual palette producer. No transport change or second original was run.

## Controls, API behavior and runtime identity

Before the one original, both standard and compatibility baseline/diagnostic
modules passed 12 generated ordinary PE CPU/public-COM cells and 16 actual
reserved-page SEH cells. Controls exercised MOV/FSTP/REP copies, lazy-flag
branches, rejected unmapped passive reads, ordinary FNSTENV/FNSAVE images,
thread identity, API pre/post observation, COM matrix copying, state blocks,
Reset, and eager/lazy ReadFile commit/resume through production owningWorker.
Baseline and diagnostic architectural results agree. Both baseline modules
were byte-identical to shipped modules; diagnostic imports/exports agree.
Results: `producer-controls.json`, `pager-controls/results.json`,
`oracle-controls.json`, and `syntax-controls.json`.

The observer evaluates store operands once and preserves the original memory
operation and attributes. Reads remain passive: unavailable spans are rejected
without entering the guest pager. Cached x87 locals are copied without
publishing them into architectural state. Atomic operations are outside this
observer's coverage. All instrumentation stayed in run-owned generated modules;
canonical CPU/API sources were unchanged.

The published [MultiplyTransform behavior](d3d9-multiply-transform-20261105.md)
was read after its release (`983bda626a0e716e1f8e89d55216ed14992bed19`): input
times live state, copied alias-safe inputs, invalid-span rejection and recorded
setter behavior. Generated controls use the actual 2×3=6 result. The captured
causal interval has zero API-dispatch events; this investigation does not
attribute it to MultiplyTransform. The documented API operation is
[Microsoft's matrix product](https://learn.microsoft.com/en-us/windows/win32/api/d3d9/nf-d3d9-idirect3ddevice9-multiplytransform).

The original used diagnostic standard module SHA-256
`d4299cbd0ee27c7a2015c3c3da65b689b5b345ec5365ae601c6fc960296cbdd6`
(2,374,152 bytes), verified in page, owning CPU worker and render worker.
Eighteen served JS instances match local hashes; 301 relevant canonical source
files were unchanged. Runtime source commit is
`e18f73ea4df716927fd40243fc5f982b8f7da75a`; preparation began at
`fd62862252affd8d0506b936987c269996e425c3`. An auxiliary loading worker had
already closed at final identity capture, so no final module hash is claimed
for that context. Git identities, relevant binary diffs, diagnostic source
patches and new-helper patches are retained without a source-tree archive.

Existing 37-file install/registry at
`scratch/game-media/conan-installed-20261105` was hashed in place, with no
media copies. `input-hashes.json` retains exact paths and SHA-256 values.

## Visible result and release

The ordered legacy → MultiplyTransform → Aranna final releases were followed
by independent cleanup verification: 2,869 absent PIDs, 314 refused ports,
134 absent profiles and four free locks. A malformed predecessor receipt
whose count appeared as PID 30 was identified and excluded; actual process
receipts were checked separately. Gate time was 00:55:35.705599 UTC, with a
fixed 01:40:35.705599 deadline. Generated controls preceded exactly one
original, 00:58:11.838714–01:13:15.825 UTC, normal exit 0.

Ordinary menu input selected Warrior and loaded Kordava. Personally inspected
captures show an opening cinematic, then a black viewport with narrative
subtitle after the strict singular-normal-transform failure. Player movement
and a second visible player response were not reached. FPS and audio are
unknown. No guest patches, invented matrices, dropped draws, light bypasses
or silent-error changes were made.

![Opening cinematic: Conan and narrative subtitle; no player-control evidence](../../scratch/runs/20261106-conan-matrix-write/cinematic-story-wait.png)

![Final inspected view: black viewport and temple narrative subtitle; gameplay unachieved](../../scratch/runs/20261106-conan-matrix-write/last-before-close.png)

Failure identity is endpoint 1/device 136450064/generation 1, command sequence
80190 with completed prefix 80189. WORLD has twelve zero words, translation
`[38.767112731933594, 248.01272583007812, 16.380149841308594]` and final 1.
The saved interval capture contains 99,398 complete snapshots, no incomplete
packets or observer errors. That count describes the saved interval capture,
not an asserted final full-session count.

Cleanup independently verified 29 absent owned PIDs, six refused ports,
three absent profiles, four free locks, no heavy runtime and over 1.5 GB free
on `/home` (`owned-runtime-cleanup.json`). No boxes were assigned; box ID,
state and expiry are not applicable. The result is a documentation-only
publication; no causal code repair or new fullbuild is claimed. Runtime and
file ownership are released after publication. Next work is the unobserved
palette producer and validated decoder transport described above.
