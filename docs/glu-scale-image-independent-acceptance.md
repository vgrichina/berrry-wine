# Independent gluScaleImage acceptance — 2026-10-29

**ACCEPT for the tested production JavaScript bridge/replay contract.** No
implementation defect was found in the bounded independent challenges. This is
not compiled WAT, guest startup, rendering, or gameplay acceptance.

Candidate: `19eee9217124f27dec5300fcdba0a0ad12a29cd0`.
Comparison base: `7bf2ad5025b6c273193ebd48084879c61fde6293`.
All 918 supplied manifest files matched their SHA-256 pins before execution.
The unchanged bridge source SHA-256 is
`6593bc0ae954d750f1800513799005c1797cdefeb3e68c70a46e06f209ec41a2`.
The actual production diff was inspected, including pixel-store/context state,
conversion, filtering, guest layout prevalidation, API generation and barriers.
No production file was edited.

## Executable evidence

Run from the candidate tree:

```sh
/usr/bin/node --max-old-space-size=192 test/test-glu-scale-image-independent.js
/usr/bin/node --max-old-space-size=192 test/test-glu-scale-image-independent.js math
```

The candidate passes **66 assertions**, exercising both actual
`OpenGLHostBridge.call` and `OpenGLHostBridge.replay` with a real
`FixedFunctionGL` frontend and production stream parser. Only the GPU backend
and guest page translator are fixture inputs. The resize oracle consists of
hand-calculated fixed arrays, not a second implementation of the resize loops.

| Challenge | Required result |
| --- | --- |
| Mixed reduction/enlargement, 3×2 → 2×4, rows `[0,60,120]`, `[120,180,240]` | `[50,130,50,130,110,190,110,190]` |
| Non-square reduction, 4×3 → 2×1, six samples per output | `[50,170]` |
| Fractional enlargement, `[0,100,200]` → width 5 | `[40,40,100,160,160]`, including wrapped edges |
| Swapped RGB565 → RGB bytes with independent PACK/UNPACK row length and skipped rows/pixels | Exact primary colors and untouched padding |
| Bitmap LSB input → MSB output, byte-boundary skips and row offsets | Exact bits and preserved neighboring bits |
| FLOAT `[0,.5,1]` → UNSIGNED_SHORT | `[0,32767,65535]` |
| Scalar bytes `[0,127,128,255]` → bitmap | Half-range threshold; outside bits preserved |
| Swapped ushort input crossing discontiguous physical pages, overlapping output | Original input snapshot, exact endian conversion |
| Missing later input/output page | `100901`; entire output range unchanged, including mapped prefix |
| Zero plus negative dimensions and invalid enums | Zero succeeds before other validation |
| Negative / invalid enum / incompatible packed format / scratch ceiling | `100901` / `100900` / `100904` / `100902`, no output writes |

Both direct and detached-stack replay paths verify output immediately on return.
Replay's returned error code is checked without substituting an execution
callback or calling `_scaleImage` directly. Stream metadata additionally requires
opcode 141 to have nine argument dwords and a synchronous barrier.

The targeted math control changes exactly one horizontal footprint expression
from `Math.max(1, wi / wo) / 2` to `Math.max(1, wi / wo) / 4`, compiling the
otherwise unchanged production module with its canonical filename and imports.
Its source hash is
`b4da58b605f977ae946d770a325c79e987984c546df14aa1b4eb90de719895ed`.
It loads normally and passes one-pixel identity, then exits 1 at the mixed
3×2 → 2×4 oracle: actual `[40,140,40,140,100,200,100,200]` versus the
expected array above. Thus the independent oracle distinguishes a live math
defect, beyond detecting a missing opcode.

The supplied baseline is exactly Git blob
`04e4a07623f3694ba0cd36823c41f7ea9316431a` at the comparison base. It loads
under the canonical production module filename; the unchanged existing
regression rejects its absent opcode 141. An initial direct load from the
inputs directory failed relative import resolution and is **not** counted as
a distinguishing control. The loader was corrected before counting this control.

The unchanged `test/test-glu-scale-image.js` passes, including established
API/opcode ordering hashes, API4594, nine stdcall dwords, source cleanup of
40 bytes including the return address, and immediate display-list behavior.
The API/hash generator, dispatcher generator, encoder ABI freshness, and GL
barrier checks all pass. These are source ABI checks, not compiled execution.

## Primary contract and limits

The [SGI GLU source maintained by ReactOS](https://github.com/reactos/reactos/blob/master/dll/opengl/glu32/src/libutil/mipmap.c)
informs the independent cases: `gluScaleImage` validates zero before negative
dimensions; `scale_internal` uses periodic box coverage with a one-pixel
footprint while enlarging; `fill_image`/`empty_image` apply pixel storage and
the unsigned 16-bit intermediate. The fetched source is retained separately as
`inputs/sgi-mipmap.c`, SHA-256
`2687429a097cad6a07ff5d3474cfea6ea7a67d455e44a09c0359f50617298d8b`.
The X.Org reference page could not be fetched; no claim depends on that fetch.

This compact set does not enumerate every scalar/packed combination or arbitrary
nonfinite FLOAT behavior. The translator models stable page mappings, not
concurrent remapping. It does not execute a real guest stack cleanup or compiled
WAT dispatch, nor prove the WAT producer parks the guest correctly. A full WAT
build, compiled dispatcher/encoder execution, and original TuxRacer PE startup,
rendering and gameplay remain unresolved gates. The known baseline-reproduced
`test/test-gl-command-stream.js` failure (`pool: undefined`) remains a failure;
that suite was not rerun or claimed passing here.

Two development fixture mistakes were corrected without changing any production
code or weakening a counterexample: the second bitmap row initially encoded a
different bit pattern than its documented oracle, and capture restoration was
initially asserted as `undefined` rather than its initialized `null`.

Execution used the task's unchanged resource supervisor, with Git DATA 256 MiB,
Python DATA 128 MiB, and original unlimited Node DATA. Node startup recorded
inherited limits and RSS before behavioral execution; the 192 MiB old-space
flag is not a total process memory cap. Admission, physical group RSS, CPU,
wall, capture, evidence and disk controls remained active. No Boat, media,
runtime mount, checkout, shared integration, or public deployment was used.
There was no mount argv to validate, including no comma-bearing mount filename.
Git publication uses only the task-provided strict SSH command and trust files.

Raw command records, stdout/stderr, startup limits, pins, hashes, publication
receipt and separate WIP recovery copies are retained under
`/tmp/tuxracer-gluscaleimage-fresh-independent-accept-oct29/`.
`completion-receipt.json` records the exact published acceptance commit and
remote verification. `coordinator-note.txt` is provided for the coordinator's
append-only messageboard update; the oversized root board was not touched.
