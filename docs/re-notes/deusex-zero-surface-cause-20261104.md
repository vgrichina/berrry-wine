# Original Deus Ex zero surface: producer executes; natural arithmetic inputs remain missing

The black surface is already zero after the original producer runs. A fresh
natural Draw passed the 640×480 scene gate and executed SoftDrv's original
pixel loop before Unlock uploaded the same zero storage. **The evidence still
does not distinguish expected guest startup/material/light state from an
emulator arithmetic or memory defect.** No production renderer patch is justified.
The smallest repaired observable is a run-owned, read-only MMX reader using the
actual owning main instance's MMX slot, with actual-WASM positive/negative tests.
Its repair was tested offline; no second browser ran.

This follows `c0666fa0919b8f99d1745b280e3e34a0cd5432b5`
[owning natural evidence](deusex-owner-filter-natural-20261104.md), the
[natural surface correlation](deusex-natural-surface-correlation-20261104.md),
and [original ESP-aware Draw](deusex-original-esp-aware-draw-20261104.md) notes.
The older blank-world note describes a different historical launch/capture and
is not evidence of the cause in this original natural launch. Accepted predecessor
artifacts are referenced by full SHA in `historical-refs.json`, without rerunning
historical packaging. All new evidence is under
`scratch/runs/20261104-deusex-zero-surface-cause/`.

## What the original instructions and fresh execution establish

Original Engine RVA `0x8ee89` tests scene fields `+0xa8` and `+0xac` and branches
past the virtual producer call at `0x8eeb6` when either signed dimension is not
positive. Actual original Engine instructions, loaded by the pinned WASM loader,
pass controlled 640×480 inputs and bypass for zero width, zero height and negative
width. The natural scene pointer was `425000968`; both observed gate boundaries
record 640×480. This excludes that dimension bypass for this invocation.
It does not by itself identify the level, texture, light or expected visible scene.

The sole Chrome PID **88503** ran **09:35:12.313Z–09:35:38.381Z** on November 4.
Native `GIsRunning=1` and visible HWND `0x10003` passed at **09:35:20.536Z**.
The read-only extension was installed on the owning Worker before the ordinary
collector started. It wraps the existing observer boundary, preserving its
return value and all Draw/ESP acceptance rules; it does not execute guest calls,
write guest memory, alter scheduling, force Draw, repaint, input or upload.

The extended 10M-block/120s ceiling completed naturally after **898,943 blocks /
16,140.805 ms**. Frozen terminal: saved caller `0x1134426e`, thread 1, yield 0,
halt 1, no diagnostic/module/trapping-run error. All nine original Draw
checkpoints, **192 Render ESP save/restore pairs and nine RAW identity records**
are retained. Identity errors are zero. Lifetime and full binding remain unknown.
MainLoop loop-check/Tick-return counts are both zero in this interval; a complete
Draw is not promoted to a new MainLoop witness.

The producer extension recorded **870,480 in-frame boundaries**, nine selected
Engine checkpoints and **745,335 SoftDrv boundaries / 252 distinct PCs**.
Every distinct SoftDrv PC has a first register/code sample: **zero sample drops,
zero recorded observer errors**. These are basic-block observations, not a
complete instruction trace or an every-pixel store ledger.

At Lock return, after successive original producer calls, at the scene-branch
join RVA `0x8eeb9`, immediately before Unlock at `0x8ef6f`, and at
Unlock return, the same canonical **614,400-byte source has zero nonzero bytes**.
Thus a missed host upload cannot explain the absence of nonblack bytes at these
producer boundaries. An intermediate nonzero write followed by clearing is not
excluded by these snapshots.

Original SoftDrv first-PC samples include RVA `0x36509` with ESI 433, followed
by `0x36577` with ESI 434 and EAX 0. The unchanged original straight-line block
between these PCs loads a texel, multiplies its palette/light vector, packs RGB,
executes `movd eax,mm0`, stores AX to `[edi+esi*2]`, then increments ESI.
The recorded EDI is **1348198400**, the natural Lock pixel pointer; that first
pixel address is source+866. This is evidence of a zero result in the original
pixel-producing route, beyond merely witnessing Render's ESP reuse. First-PC
samples are not a complete per-invocation edge history; they do not establish
that all other pixel writes computed zero or why this one did.

The page retained **13 actual import observations**, zero errors and no limit
exhaustion. Final presentation `0x200001` uploaded storage **475783168**, matching
Lock/Unlock; target HWND `0x10003`, canvas identity 12, attached and DX-owner
canvas matches, version 6, write sequence 75. Canonical bytes remain all zero.
The predecessor's storage 475574272 is retained as historical data, not substituted
for this fresh allocation. Surface rotation and distinct frame-layer canvas
identities remain recorded; they are not assigned an unproved lifetime/binding
meaning.

## Discriminating original pixel test and the observation defect

A separate offline fixture executes the **unmodified loaded original SoftDrv
RVA `0x36509` pixel block**, through its real MMX instructions and scalar store,
on the exact runtime WASM. With controlled texture/step/mask/light inputs:

| Fixture | Stored original 16-bit pixel |
| --- | --- |
| Zero palette/light vector | `0x0000` |
| Positive palette/light vector | `0xffff` |

These are fixture inputs, not reconstructed natural game inputs or a manufactured
frame. They show this original instruction block can produce and store nonblack
pixels through the same interpreter. They do not certify every MMX operation,
exclude an input-dependent emulator defect, or prove natural black is expected.
The exact outputs and module/media identities are retained in the offline logs
and `original-soft-producer-test.json`.

The new natural helper also attempted MMX reads at `MMX_FILE + guestThreadId*128`.
**All those natural MMX samples are rejected.** The guest-visible current thread
ID is 1, but the owning main instance initializes its execution slot as 0.
Source analysis of the default MMX base and `init_thread`, plus actual-WASM
local and shipped owning-Worker fixtures, demonstrates the distinction:
`movd mm0,eax` with `EAX=0x13579bdf` writes slot 0; the guessed thread-1 slot
remains zero. A successful MMX-to-EAX readback independently confirms the value.
Consequently the captured all-zero MMX arrays are an observer defect, not proof
that the guest's actual MMX register file was zero.

The browser namespace stays immutable. Separate `producer-fixed.cjs` requires
owning Worker slot 0 and reads its initialized main MMX slot using the pinned
generated region map. Its actual-WASM test observes the positive MM0 sentinel,
checks dimension positives/negatives and original SoftDrv bytes, counts repeated
PCs, rejects duplicate installation, skips absent frames, forwards the original
observer result, and compares guest memory before/after observation unchanged.
`test-mmx-worker.cjs` separately verifies the actual shipped owning Worker and
reproduces the old reader's false-zero negative. These are offline fixes/tests,
not retroactive replacements of the natural arrays. No production source changed.

The dimensions alone do not establish execution of Engine virtual call `+0x70`:
the optional viewport `+0x34` object and its virtual `+0x60` predicate can still
bypass it. The natural helper did not record that predicate or this callee entry.
SoftDrv execution elsewhere within this Draw does not fill that specific gap.

The exact remaining causal gaps are **that optional predicate/callee boundary,
and the owning main-slot MMX inputs, texture
texel/palette/light values and shift/mask globals at the first original pixel
calculation, together with its output/store boundary**. Without those values,
expected zero shading and an input-dependent interpreter/memory defect cannot
be separated. The corrected read-only MMX observer is executable and tested;
texture/palette/global input capture is still missing. No claim is made that
that complete next observation is already implemented or browser-qualified.

## Preflight, captures, evidence and custody

Before the one Chrome, all **525 exact closure/helper/module/media pins** passed;
the source, native readiness recipe and original module/media were unchanged.
Actual original EXE/Engine/Core/WinDrv/Render WASM fixtures, owning Worker,
Draw/ESP suite and complete next driver passed. The driver fixture models only
DOM/readiness and the new observer install/read messages; its WorkerLink/WASM
execution is real. The new helper's own tests use real WASM module mappings.
Actual Puppeteer 25.7.0 CJS/ESM imports, generated map, cache graph (98 page /
13 Worker scripts), 144 served SHA/isolation/no-store resources and selector /
readiness positive/negative controls passed before launch.

Two offline preflight attempts failed before Chrome: first the modeled driver
fixture lacked the new install message; then a retained first-failure artifact
made the repaired fixture fail its clean-output assertion. Both failed attempts
and their logs were preserved; the fixture and output isolation were corrected
before final preflight. A local launch-receipt script then raised a missing
`json` import **after** spawning the one driver; launch identity was recovered
read-only. The launcher was not rerun. The actual browser has no first-failure
artifact and closed normally. Raw terminal/result persistence precedes PNG export.

I personally viewed both fresh PNGs: the host application area and the 640×480
surface are black. They are not gameplay success:

- Host, 93,623 bytes: `d5e6867ebc4c3a29e6b2cc499f01e5b5cb769a13c5620bbbcf03aeb18ee5acce`.
- Surface, 7,979 bytes: `c11603367da22debf81bee361136a1d545c20fdb07e7ad6e0459659022480e65`.

The closed browser namespace recovered **138 artifacts / 7,411,702 bytes**, full
SHA/size checked, snapshot **09:36:04.990658Z**; all 525 original pins remained
unchanged and Chrome/driver were absent. Separate offline artifacts have a full
SHA manifest. `analyze.cjs` checks all recovered hashes, natural raw identities,
checkpoint/producer counts, source/upload equality, rejected MMX evidence and
original pixel positive/zero controls. Git provenance records local main
`fb9b73fedc815ae88fcbabd0d28e5c57d7490d13`, the inherited exact served manifest,
relevant binary diff and owned new small-file patches. Runtime WASM SHA-256 is
`129a71a01a5fbc8b07d6fa242a5a3ebc6a29f5aed9fb4b6a47d9318a764c1f52`.
No source archive, module copy or media copy was made. Only this note is committed;
there is no production-code commit or new full-build claim.

**Custody:** `bx_3k2ukgfj` remains RUNNING (API idle, healthy/hydrated), expiry
**2026-11-04T09:55:33.875Z**; coordinator owns shutdown, hardclose 09:45Z and
recovery 09:50Z. No browser remains. No new box, lifecycle operation, source-box,
local heavy browser, subworker, successor, Heroes II or deployment was used.
The authorized observation is consumed. The next action is the precise original
branch/pixel-input observation above under separate authorization. This task stops
after publishing this note and returning custody.
