# Q3 original texture scan: finite progress captured

Evidence: `scratch/runs/20261110-q3-original-texture-scan-state-0352/`.
The single authorized original diagnostic captured finite scan progress at
two consecutive original slices. **No CPU, GL, renderer, readiness, or startup
repair is supported. Arena progress remains unverified.** This does not recover
the final state of the earlier 0328 execution or establish eventual startup.

The retained 0328 inventory was inspected first: its 53 unique artifacts
contained no memory snapshot. The prior register-free samples therefore could
not answer the count/dimension question.

## Captured original state

`original-scans.json`, `scan-diagnosis.json`, and the hash-verified original
console/transport containers retain the actual values. Both consecutive samples
stop at `0x456ad8` in the original Upload32 pixel scan:

| Field | Slice 956 | Slice 957 |
| --- | --- | --- |
| ESI / EDI | 64 / 64 | 64 / 64 |
| EBP | `0x7e64433a` | `0x7e6456c2` |
| ESP | `0x074fa3b4` | `0x074fa3b4` |
| Remaining `[ESP+0x24]` | 3404 | 2154 |
| Source `[ESP+0x203c]` | `0x7e643868` | `0x7e643868` |
| Width / height arguments | 64 / 64 | 64 / 64 |
| Mipmap / picmip arguments | 1 / 1 | 1 / 1 |
| Upload return `[ESP+0x2038]` | `0x4566d4` | `0x4566d4` |
| Limit global `[0x7cb1c0]` | 8192 | 8192 |

Remaining decreases by **1250** while EBP advances **5000 bytes**, exactly four
bytes per pixel. At each sample,
`(EBP - source - 2) / 4 + remaining == 64 * 64`.
The complete 48-word caller window is identical. These are successive slices
of one consistent, finite upload scan, with ordinary dimensions and a positive
limit. Repeated initialization and corrupt dimensions are not established by
this pair.

The raw caller window also supplies image-creation return `0x45829d` at
`ESP+0x2074` and name pointer `0x58f14c` at `ESP+0x2078`. **The native name bytes
were not captured.** The initial observer incorrectly treated `+0x2030/+0x2034`
as saved name registers; the real chkstk sequence leaves scratch values there,
including `0x45678a`. The published observer corrects these offsets using the
original disassembly and retained stack, with offline installed-Worker tests.
That correction has no native repeat. The raw native record is preserved.

Two earlier snapshots show 16×16 and 256×32 work with valid count/pointer
relationships and limit 8192. Their sequences 401 and 412 are not consecutive
and their inputs differ; they must not be interpreted as one stalled scan.
Their image-name argument pointers address the EXE literals `*default` and
`*fog`; this static association does not replace missing native string bytes.

There are 134 nonnull passive slice samples. The last page sample is at
38775.16 ms, sequence 1153, EIP `0x456a98`, ESP `0x074fa3a8`. Its carried pair
is still 956/957: those registers are not the state of slice 1153. The image
observer's unchanged 50-second bound includes browser launch time, so this
execution has less page time than 0328. No conclusion about the later scan's
dimensions, completion, repeated image identity, or eventual arena follows.

## Observation, controls, and cancellation

The opt-in `Q3_TEXTURE_SCAN=1` path reads state synchronously at existing
original Worker `sliceDone` sends and carries a bounded pair in those replies.
It uses direct-window reads, never a fault-servicing translator or guest call.
Pairs refresh at most every 500 ms with at most 240 snapshots, within the
existing 240 passive page observations; there are no added CDP requests or
console emissions. Existing producer selection, console64/text2048,
startup bound, canonical CPU, and `52b51b920` cancellation admission remain.
Shared CRT, renderer, startup providers, Nox, and LBreakout are unchanged.

Before allocation, controls passed for the actual emitted original Worker,
real host initialization, installed instance, both compiled modules, owner
refusals, read-only snapshots and cap, and the full sealed caller's delayed,
error, missing-reply, native-cancellation and ordinary-close cases. The locked
build passed before allocation and again for publication. Corrected caller
offsets pass the emitted Worker/host tests offline.

An additional inherited causal test failed because its hand-built frontend
lacked required `pixelStore` state. Its test setup now retains the real frontend
created by the production software adapter and controls only the backend query
answer. The original instruction scan/clamp controls and production query
writer then pass. This is a test-fixture correction, not a runtime repair or
native WebGL claim. Logs of the failures and successful control are retained.

The 17 complete producer replies are joined to actual requests, sessions,
renderer targets and page owners and run through the unchanged selector.
Completed batches advance 2–71, while presented/writeSeq/draws/vertices remain
zero. Console64 ends at ARB multitexture; later guest text is UNKNOWN.
The retained partial GL lane has 146 distinct records, with overwritten gaps.

The first image was unavailable at the 50-second bound. Owning cancellation
was published at `03:58:25.009713Z`, with TERM sent at `03:58:25.010673Z`.
Trace verification finds **zero subsequent CDP request allocations**, zero
game inputs, zero screenshot requests, and zero Browser.close requests.
Kernel custody reaped **167/167**, with command-log EOF and no unreaped
children. Generated parent, prelaunch child, runtime parent, local controller,
and watchdog have actual waits and separate stdout/stderr EOFs. There was no
image to review, no retry, quit, extension, or second native execution. The
unchanged accepted cancellation fixture was hash-verified and reused.

## Evidence and final lifecycle

The starting Git SHA is `cead58dea4960ec06f82d436f59e08cfd45b6e3c`;
the prepared runtime commit and relevant uncommitted binary diff are recorded
separately. Git plus patches and small preparation inputs are the recovery
recipe; no source archive or evidence media copy was made. The EXE SHA-256 is
`2c0dd4d06e3282e0abc41ebc8e84e2d9868a17182ac175b232a9bb604a8269a3`;
canonical CPU SHA-256 remains
`4f2c69a1528e01a9ab5127201d5e8a222da2a35236377a1351f444f55fa5a7d9`.
The runtime seal is
`1c0a0e8622aea9de5d2a7132067e3ad91de63caaaf2798d7378edb9bd160fc4e`.

Independent settled inventories and local rereads verified **48 unique
artifacts, 1,751,486 bytes**, by SHA and size before stop. All nonempty gzip
containers finalized. The zero-byte `execution-boundary.jsonl.gz` is retained
as invalid/UNKNOWN; the separate finalized transport container carries the
complete retained boundary observations. There are zero PNGs. Verification
does not promote the empty container to finalized evidence.

Sole task box: **`bx_hbzcvfma`**, UUID
`159cdfdd-ce36-4261-8fc0-c41cd224ee5a`. Its independent watchdog was observed
alive before creation, with immutable deadline `04:20:46.574885Z`; API expiry
was `04:20:45.958Z`. After evidence retrieval and verification, delegated
unforced stop **`stop_ef0afeed2ff77664`** completed at `03:58:52.762Z`.
Final state **archived**, expiry **null**, stop error **null**; watchdog actual
wait **0**, separate EOFs. Other boxes were untouched.

Finite progress is now established for the captured original 64×64 upload.
The later startup/image-name dependency remains unresolved; there is no basis
for a runtime repair or relaxing readiness. Any further original execution
requires separate authorization. This worker releases its paths and stops.
