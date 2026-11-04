# Original Deus Ex: owning pixel inputs explain sampled zeros; upstream state remains unresolved

The original optional producer **does execute**, and sixteen actual owning-slot
pixel calculations correctly produce zero from the captured inputs. An independent
integer reference and exact-address replay of the unchanged original instructions
match every sampled stored pixel and all eight MMX registers. **No production
arithmetic defect is demonstrated in this block.** Why the upstream guest selects
these zero light/material inputs remains unresolved: expected guest state and an
upstream emulator defect are still distinct possibilities. No renderer patch,
guest write/call, forced Draw, repaint or game input was used.

This follows [the zero-surface cause investigation](deusex-zero-surface-cause-20261104.md),
commit `628db82fa0b1413faf9b7879d38431b2e6439173`. All new evidence, helpers,
raw results and tests are in `scratch/runs/20261104-deusex-owning-pixel-inputs/`.
The predecessor's rejected thread-1 MMX samples remain rejected; the new evidence
reads the initialized MMX slot 0 of the actual owning main Worker, whose guest
thread ID is 1.

## Natural predicate and original producer

The sole Chrome PID **14443** ran **09:55:15.676Z–09:55:57.194Z** on November 4.
Original native readiness passed at **09:55:28.329Z**. The ordinary scheduler
completed the bounded observation after **1,386,712 blocks / 27,602.940 ms**, below
10M blocks / 120 seconds. Chrome closed normally, without supervisor intervention
or a first-failure record. There was no second browser or reload.

The read-only helper preserves the published collector's return values and
Draw/ESP acceptance. The original Draw has nine RAW identities, **192 Render ESP
save/restore pairs**, and a verified saved-caller return candidate. One MainLoop
loop-check and one Tick-return boundary were observed during this interval; this
does not identify a level or prove gameplay. The terminal has no diagnostic,
module or trapping-run error. Lifetime and viewport-to-host binding remain unknown.

For this invocation, engine object **272560288**, viewport **422613888**, scene
**425000968**, Draw entry ESP **396359800**, saved caller **288637550**, Worker
slot **0**, guest thread **1** remain correlated in each retained pixel record.
The original positive dimensions are **640×480**. The missing optional branch is
now observed directly:

- Viewport `+0x34` is **422949888**, vtable **285919152**. Its `+0x60` predicate
  target **284705282** is original Engine RVA `0x2202`, a jump to RVA `0x79580`.
  Callee entry has ECX equal to that optional object and stack return PC equal
  to Engine RVA `0x8eea9`. The return boundary's **EAX is 1**.
- The producer object is **273083904**, vtable **293060652**. The `+0x70` call
  target **292892762** is original Render RVA `0x105a`, a jump to RVA `0x1cb30`.
  Its entry has ECX equal to this producer object and stack return PC equal to
  Engine RVA `0x8eeb9`. The original branch join is subsequently observed.

These are actual target/entry/return-stack observations, beyond dimension checks
or unrelated SoftDrv activity. `producer.json` retains seven branch checkpoints,
two callee entries and their code bytes, with zero optional-record drops.

## Actual pixel inputs and differential result

The extension observed **785,333 SoftDrv boundaries / 253 distinct PCs**, retaining
one register/code/MMX sample per distinct PC with zero sample drops or errors.
There were **2,993** entries to original SoftDrv RVA `0x36509`; the first **16**
were retained with their following store boundaries, and **2,977** were intentionally
omitted by the fixed cap. All sixteen pairs are in the same owning Draw frame.
This is bounded sampling, not every-pixel coverage or a complete instruction trace.

The first sample is at original SoftDrv base **289816576**, RVA `0x36509`:

| Input / result | Actual value |
| --- | --- |
| ESI / EDI | 389 / 1346711552 |
| MM3, MM4, MM5 | all zero |
| MM6 | `ff64c217ffc4b517` |
| MM7 | `1fabe140e301d047` |
| Texture coordinate addend, RVA `0x7d3a8` | `00020000fffc0000` |
| Texture shift / mask, RVAs `0x7d3e8` / `0x7d3e0` | 32 / 0 |
| Calculated texture index / actual texel | 0 / 1 |
| Texel guest / WASM address | 271384456 / 135073672 |
| Palette entry 1 guest / WASM address | 412029088 / 140767392 |
| Selected palette entry | eight zero bytes |
| Light bytes at EBP 290296568 | 24 zero bytes |
| Store guest / WASM address | 1346712330 / 474297098 |
| Following PC / ESI / stored pixel | RVA `0x36577` / 390 / `0x0000` |

The full 2,048-byte palette contains **1,528 nonzero bytes**; it is the selected
entry that is zero. RGB packing masks/multipliers are initialized:
`00f800f800f800f8`, `0000fc000000fc00`, `2000000420000004`; the dither qword
at RVA `0x546f0` is `0404020402020102`. The zero texture-index mask is separate
from these packing masks. All sixteen samples have zero MM3/MM4/MM5, zero light
bytes, texel 1 and zero selected palette entry; their nonzero MM6/MM7 values
exclude the old wrong-slot all-zero MMX observation mistake.

`oracle.cjs` independently evaluates the original integer lane operations,
signed multiply-high, wrapping adds, saturation, packing, masks and shifts.
`replay.cjs` loads the original EXE and SoftDrv on the exact runtime WASM,
loads SoftDrv at the captured base, verifies the unchanged relocated code bytes,
and reconstructs the sampled inputs at the **same guest pointers**. It restores
all registers and owning-slot MMX state, then executes the original block.
For all sixteen samples, stored pixel, ECX and all eight MMX registers match
both natural execution and the reference. Exact guest pointers do not recreate
the original allocator history; memory placement in the isolated fixture differs.

Seven discriminating fixture controls also match the reference:

| Changed input(s) | Pixel | Texture index |
| --- | --- | --- |
| Positive palette entry only | `0x0000` | 0 |
| Positive MM4 light only | `0x0000` | 0 |
| Positive palette entry and MM4 light | `0xffff` | 0 |
| Both positives, texture mask 255 | `0xffff` | 47 |
| Same, shift 31 | `0xffff` | 95 |
| Same, shift 64 | `0xffff` | 0 |
| Negative MM4 light, positive palette | `0x0000` | 0 |

Controls are offline fixture inputs, never substituted into the natural game.
These tests support correct computation for the sampled block and controls;
they do not certify all MMX instructions, upstream memory generation, other
pixel routes or all unsampled writes.

## Source/upload correlation and observer correction

The fresh Lock pointer is **1346711552**, WASM source **474296320**. All nine
selected Engine producer snapshots see the same **614,400-byte zero source**.
All sixteen stores lie within it. The final actual upload presentation `0x200001`
uses source **474296320**, HWND **0x10003**, attached DX-owner canvas identity
**10**, version **8**, write sequence **38**. Its canonical bytes remain zero.
Ten actual page import observations have zero errors and no limit exhaustion.
The predecessor's source 475783168 / canvas 12 is historical, not substituted for
this fresh allocation. Fresh host and 640×480 surface PNGs were personally viewed:
both application areas are black, with no gameplay claim. Their exact hashes are
in `analysis.json` and the recovery manifest.

The natural helper's `unexpectedNext` counter is **16**. Its whitelist admitted
cold block successors `0x36581` / `0x366bb`, while the warmed natural decoder
already had a target at `0x36577` and stopped there after the store. This is an
observer coverage-check defect, not a guest failure. The raw helper, counter and
records are preserved unchanged. The original bytes include the store and
increment before that landing; replay predecodes it and reproduces all sixteen
natural states. Separate `producer-next-boundaries-fixed.cjs` admits the valid
landing and passes actual-WASM cold/warm boundary tests with zero flags. It was
not installed in another browser. The corrected helper's full memory comparison
also confirms that observation itself does not write guest memory.

## Preflight, provenance, recovery and remaining gap

Before Chrome, **542** closure/helper/module/media pins passed. Tests covered the
predecessor's corrected main-slot MMX helper, actual shipped owning Worker,
original Engine optional absent/true/false branch fixtures, original SoftDrv
zero/positive pixel fixtures, original PE/Engine/Core/WinDrv/Render Draw/ESP suite,
and complete next-driver integration. Original Engine gate bytes execute in the
fixture; its predicate/producer stubs are controlled fixture callees. Full-driver
DOM/readiness modeling remains distinct from actual Worker/WASM execution.
Actual Puppeteer **25.7.0** CJS/ESM imports, cache graph **98 page / 13 Worker
scripts**, **144** pinned HTTP resources, isolation/no-store and readiness
positive/negative controls passed. Raw terminal/producer/publication JSON was
persisted before the brand-correct asynchronous PNG export.

An initial offline test wrongly expected the next block boundary before an
unbroken conditional branch; its failure is retained in `prebrowser-attempt1/`.
The fixture expectation was corrected before the final passing preflight.
The later natural warm-cache whitelist flag was repaired only offline as above.
There was no unexpected runtime failure, retry, new Chrome or forced execution.

The closed natural namespace recovered **106 artifacts / 7,040,067 bytes**, full
SHA/size checked, at **09:56:36.212564Z**. All 542 pins remained unchanged and
Chrome/driver were absent. Separate offline replay/correction artifacts were
also recovered and SHA checked. `analyze.cjs` validates hashes, exact frame/owner,
original branch return PCs, pixel/store ranges, counters, controls and upload
correlation. The runtime WASM SHA-256 is
`129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52`.

`source-provenance.json` records local session HEAD, relevant uncommitted binary
diff, and exact reconstruction of 277 tracked served source inputs: 275 match
`628db82fa0b1413faf9b7879d38431b2e6439173`; the two D3dim files match recorded
Git blobs at `5a834874fd889eceb98dc72a5c6b01946972a01d` and
`e947be8ad308f3eae93bd5b2914406ca704fbced`, with their small binary adjustment
patch retained. These files were not edited. Tested WASM identity is pinned
separately; no current-main rebuild is claimed. New owned small helpers are
retained as patches, and media is referenced by existing path/SHA. No source
archive, module copy or media copy was made. Only this note is committed;
no production code changed, so no new full-build claim is made.

**Precise remaining gap:** the producer of the zero light stream at
290296568 and following qwords, the selection/initialization of zero palette
entry 1 at 412029088, and the zero texture mask at 290329568. Their upstream
provenance must be observed before choosing a production fix. The present sampled
pixel arithmetic agrees with expected x86 integer semantics for these inputs;
that does not establish that the guest was supposed to choose these inputs or
that every pixel has the same cause.

**Custody:** `bx_mpnr7rhj` is left RUNNING (API idle, healthy/hydrated), expiry
**2026-11-04T10:27:15.142Z**, coordinator owns shutdown. Chrome is closed and all
unique evidence is recovered before the 10:17Z close / 10:22Z recovery deadlines.
No lifecycle action, source-box access, local heavy runtime, subworker, successor,
Heroes II or deployment was used. The one authorized natural observation is
consumed. Ownership returns to the coordinator; this single assignment stops.
