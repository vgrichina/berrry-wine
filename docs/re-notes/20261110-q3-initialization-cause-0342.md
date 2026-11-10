# Q3 original initialization: offline instruction diagnosis

Evidence: `scratch/runs/20261110-q3-initialization-cause-0342/`.
Result: **unresolved original input/state dependency; no supported runtime
repair**. The retained final EIP is an image preparation scan, and its exact
instructions terminate correctly in the canonical compiled interpreter. No
browser, box, native execution, new game startup, clock/tier/deadline change,
media copy, or source archive was used. Shared runtime files are unchanged.

The starting main commit is `d3651d79085448bb73a4961c59cdc3f05d649f9a`.
The actual retained EXE is
`test/binaries/candidates/quake-3-arena-demo-installer/installed/quake3.exe`,
SHA-256 `2c0dd4d06e3282e0abc41ebc8e84e2d9868a17182ac175b232a9bb604a8269a3`.
The tested canonical CPU SHA-256 is
`4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`.
The prior native evidence is the 0328 run described in
[the retained-producer report](20261110-q3-retained-producer-native-0328.md).

## What the retained execution actually establishes

The 29 producer replies establish the correct WebGL owner/context but zero
presentation/write sequence/draws/vertices as completed batches advance 2–139.
The exhausted console64 lane ends at ARB multitexture; later text remains
unknown. Re-reading the retained console and transport containers verifies
their original SHA and size against the pre-stop retrieval inventory.
The new analysis retains all 191 nonnull slice samples and deduplicates 378
surviving GL boundary records without filling overwritten gaps.

The six sampled EIPs in `0x456a7a..0x456af1` belong to a texture pixel scan.
The final three samples have unchanged ESP `0x074fabb4`:

| Page time (ms) | Slice sequence | EIP |
| --- | --- | --- |
| 49050.295 | 3218 | `0x456ae0` |
| 49300.985 | 3625 | `0x456a7a` |
| 49550.295 | 4014 | `0x456a9a` |

Before these, samples pass through file/CRC work, a mipmap filter at
`0x4571d6`, and other routines. The final interval advances 796 slice
sequences; these observations do not show an unchanged loop counter or
repeated image identity. Every sampled register payload is null. There is no
recorded trap, but this does not establish eventual completion.

## Original instructions and caller/API dependencies

Disassembly locates the containing function at `0x456780` (texture upload
preparation, conventionally Upload32). Its static caller is the call at
`0x4566cf`, return `0x4566d4`, inside image creation beginning `0x456590`.
This is a static caller relationship; the actual retained stack return was
not captured. Image creation also has callers for built-in textures and
loaded images; the final image identity cannot be chosen from EIP alone.

After power-of-two/resampling work, the function clamps output dimensions at
`0x456a2e..0x456a40` using dword `0x7cb1c0`. Renderer initialization populates
that dword at `0x44a4d1` from `glGetIntegerv(GL_MAX_TEXTURE_SIZE=0x0d33)`:
the indirect query is `0x44a4c5`, pointer slot `0x7bdec0`. The caller supplies
an output pointer into its stack and copies that result into the global;
nonpositive results become zero. The adapter's production `_getState` reads
`backend.getParameter(0x0d33)` and writes an Int32 through the guest address
translator. The partial boundary record for opcode103 proves a query entered,
but retains neither pname, destination contents, nor its returned limit.

The observed EIP is **after** this clamp and scratch allocation. At
`0x456a53`, ECX becomes ESI×EDI (source/resampled pixel dimensions, distinct
from the clamped output dimensions). The loop at `0x456a7a` loads each RGB
byte with FILD, compares to three stack maxima with FCOM/FNSTSW/TEST AH,0x41,
updates maxima for greater values, and checks alpha against 255. The final
`0x456ae9` increments EBP by four, `0x456aec` decrements the remaining count,
and `0x456af1` branches back while nonzero. `0x456a9a` is the green-channel
load, not an API wait or error handler. Later calls at `0x456bad` and
`0x456cef` use indirect pointer `0x7bdf50` with the nine glTexImage2D
arguments. Six surviving opcode158 `_glTexImage2D` boundary entries show some
canonical texture uploads already entered; ring loss prevents a full history.

At the observed scan ESP, the exact missing inputs are:

| Location | Meaning |
| --- | --- |
| ESI / EDI | Width / height used to form scan count |
| EBP | Current pixel pointer plus two |
| `[ESP+0x24]` | Remaining pixels (after the first iteration starts) |
| `[ESP+0x2038]` | Caller return of upload function |
| `[ESP+0x203c]` | Source/resampled pixel pointer |
| `[ESP+0x2040]`, `[ESP+0x2044]` | Width / height arguments |
| `[ESP+0x2048]`, `[ESP+0x204c]` | Mipmap / picmip arguments |
| `[0x7cb1c0]` | Limit produced by original GL query |

The original scan input can change during resampling; the pointer at
`ESP+0x203c` reflects that work. None of these values or an image-name stack
chain is present in the retained register-free slice lane. The console cap
cannot recover them. Consequently, an oversized/corrupt original count,
repeated image creation, and finite legitimate preparation remain distinct
possibilities, not established causes.

## Compiled causal controls and outcome

`node tools/q3-initialization-cause.test.cjs
scratch/runs/20261110-q3-initialization-cause-0342` loads the hash-verified Q3
PE into the real compiled CPU, extracts the original scan bytes
`0x456a53..0x456af3`, and runs them with controlled pixels/stack. Internal
branch offsets remain unchanged; only a terminal return pad is appended.
These are isolated test inputs, not writes to the original native guest.

Five controls cover 1×1, 17×13, 256×256, 1024×1024, and zero count, opaque
and nonopaque alpha, RGB maxima, x87 comparison/pop behavior, advancing pixel
pointer/decreasing remaining count, and eventual return. All pass. The
1024×1024 control consumes 839 calls of `run(10000)`, with decreasing counts
at slices 1/400/800. Thus the original final 796-sequence scan interval is
compatible with a finite ordinary scan; this is **not** a recovered original
dimension or timing measurement.

Exact original clamp bytes also terminate for limits 2048/4096/zero. Zero
halves dimensions down to zero; it does not make the clamp infinite. A
deliberately injected negative limit reproduces nontermination after the
dimensions reach zero, but original initialization normalizes nonpositive
query results to zero. There is no evidence of an original negative value or
later corruption, so this fault control supports no repair.

The production GL render adapter, command stream and bridge execute context
creation/current binding and the integer query against real compiled memory
with the canvas-free software consumer. It writes 2048 and reports no GL
error. Additional production query-writer controls forward backend values
4096/8192/zero unchanged. Those backend answers are controlled; no native
WebGL value or hardware correctness is claimed. No hardcoded software limit
is substituted for the original WebGL limit.

Focused controls and `flock /tmp/wine-build.lock bash tools/build.sh` pass;
the canonical CPU hash remains unchanged. Only this test and report are
published. The `52b51b920` native cancellation admission repair and existing
producer selector are preserved without edits.

The concrete next step requires original state absent from this evidence:
under a separately authorized original execution, replace an existing passive
scan sample with a bounded read-only snapshot of the table above at two
successive scan slices, plus the image-creation return/name chain. Keep the
existing total observation bounds, console cap, selector and cancellation
policy. Decreasing count with advancing EBP distinguishes finite work;
repeated entry/name identifies repeated initialization; dimensions and the
actual query result permit an authentic full Upload32 control. First try any
already-retained memory snapshot if one becomes available. Do not infer a GL
or CPU repair from EIP repetition or relax presentation readiness.

No task box exists, so there is no new expiry or stop receipt. The inherited
0328 box `bx_2qbqdc6h` remains archived, expiry null, receipt
`stop_3bfd33cc00fe9668`; it was untouched. This single-task worker releases
its paths and stops after publishing the unresolved instruction dependency.
