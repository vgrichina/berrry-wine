# Pawn fourth record: native writer map; runtime trace capacity refused

The fourth record and second reply remain unresolved. No emulator defect was
demonstrated and no production change was made. Evidence is in ignored
`scratch/runs/20261113-pawn-fourth-writer-1520/`.

Read parent `5ddfd2b93`, verified all 169 parent SHA seals, and independently
hashed its complete authentic 100-byte save to
`811659988ee98f19ca08615f1191431993f5d51646ea41efed5fdb6f0ff5cf77`.
The original file remains at
`scratch/runs/20261113-pawn-modal-guard-1445/pawn-1445-secondmove.gam`;
it was neither edited nor copied. Its first three records authenticate
e2-e4, g8-f6 and d2-d4. Record four is still exactly `0,44,7,15,0,0`.
No third move was sent.

## What the bounded native analysis establishes

Disassembly and literal cross-references use the original Pawn.exe with SHA
`21f78408e306d77103484bc90accfd511a141131ed1e14990380ecea19de5a58`.
Small gzip listings preserve bounded instruction ranges and commands are
reproducible with `node tools/disasm_fn.js EXE VA COUNT --linear` and
`node tools/xrefs.js EXE VA --code`. Cross-reference classifications are
heuristics; actual instruction listings support the statements below.

The magic-77 save loop at `0x40e6ce` serializes six parallel history arrays
through globals `0x4231b0/b8/c0/c8/d0/d8`. It increments a local index from
zero to one, writes all six DWORDs, then checks the **next** origin for -1.
It does not use the current history cursor `0x422fa8`, validate endpoints,
or test a separate complete-record flag. Thus the authentic file proves
stored array contents, not by itself successful move execution. Neither
zero origin nor the other fields is interpreted specially by this writer.
This does not exclude special semantics elsewhere in the guest.

The native AI commit path is now located:

| Address | Native operation |
| --- | --- |
| `0x40299c` | Increment history cursor `0x422fa8`. |
| `0x4029e2` | Call `0x4038fa` with selected endpoints (display/animation path). |
| `0x402a1d` | Call `0x408ef7` with the same selected endpoints. |
| `0x402a4c` | Write origin from signed byte `[DWORD(0x4230f8)+DWORD(0x4230fc)+1]` into current history origin. |
| `0x402a7a` | Write destination from signed byte `[DWORD(0x423104)+DWORD(0x423108)+1]` into current history destination. |
| `0x402a96..0x402aea` | Copy four move-state values from `0x4230c8/0x423148/0x423138/0x423140` pointees into the remaining history arrays. |
| `0x402b19` | Write next history origin -1. |
| `0x402b3c/0x402b5d` | Copy the same selected endpoints to globals `0x42302c/0x423030`, followed by display update `0x404dec`. |

These are identified writer sites, **not an observed first write to record
four**. The player path has distinct stores at `0x40df77/0x40df8f`; file
loading and other native paths also access these arrays. No claim that the
AI sites actually produced this particular record follows from static
references alone.

The selected-endpoint arrays are allocated with stride 101 at
`0x4011d2/0x40120f`. Search writes their principal variation at `0x41089b`;
`0x4108c3/0x4108e9` write endpoint bytes using stride times search ply plus
ply, and subsequent code copies continuation bytes. AI entry clears the
root origin row at `0x402447..0x402495`; that loop does not clear the
destination row. This supplies a concrete reason to inspect the selected
origin and destination separately, but does not establish that a cleared
origin caused record four.

AI selection first tries opening-book routine `0x40b467` when history
cursor is below 40, `0x423008` is zero and `0x42301c` is nonzero. A nonzero
return sets `0x423078=1` and jumps to commit. Otherwise `0x4025da` calls
search `0x40ea8c`; its score goes to `0x42307c`. Search iteration exit tests
depth `0x42306c` against `0x422f7c`, elapsed time against `0x422f78`, score
magnitude and `0x423038`. Search itself also checks abort/time at
`0x40eaa1` and `0x40eb35`. No clock or search setting was changed.

The zero-delimited original opening book is read bytewise by native code
at `0x4072ff`, and `0x40b50f..0x40b573` compares endpoint bytes to history.
Offline prefix comparison finds 1,155 entries beginning e4 and 41 beginning
e4/Nf6, but **zero** beginning e4/Nf6/d4. See
`offline-book-prefix.json`. Conditional on an intact runtime book and the
authenticated history, this points to the search fallback for the second
reply. The actual runtime book buffer, branch and selected endpoints were
not observed, so this remains a conditional deduction.

Native make-move code `0x4083d8` saves move state and has explicit en-passant,
promotion and castling-related paths. The notation routine `0x408ef7`
ultimately calls it at `0x409357`, after resetting ply to zero. At
`0x408ccf..0x408cef`, make-move saves the destination's previous piece code
through `0x4230c8`; at `0x408cf3..0x408d0e` it transfers the origin piece to
the destination and writes empty code 7 to the origin. Together with the
history copy, this identifies the third serialized DWORD as the saved
destination piece code, rather than a record-complete flag. The fourth
comes from the saved `0x422f88` state (`0x408406..0x40841c`), whose bits are
cleared for king/rook movement in the castling paths. The fifth tracks the
double-pawn destination (`0x4088fc..0x408910`); the sixth is promotion state
(`0x408e44..0x408e53`). These explain ordinary state fields but do not prove
why this record has origin zero. Its tail `0x408ed7..0x408ee6`
increments search ply and flips side `0x422f5c` as `1-side`; unmake
`0x403117..0x403126` reverses ply and side. The outer AI loop at
`0x40232b` calls the responsive input loop `0x40ca11`, with idle Sleep(10)
at `0x40ca35`. Reaching that idle loop alone cannot prove a valid second
reply or identify the earlier instruction/API that selected an endpoint.

## Prepared observer and concrete blocker

Reused the qualified 1445 owner guard, finite drags with independent UP,
strict modal guards and no-redundant-motion helper unchanged. No previously
qualified cases were rerun. The additional read-only `history-read.js`
records history, side, cursor, search depth/score, book flag and selected
endpoint bytes. Existing interpreter `--trace-at=0x402a50` was prepared to
capture up to four AI commit hits immediately after the origin store, with
indirect history/selected-array dumps and relevant globals. It would
distinguish the source byte from the stored origin without changing guest
memory, position, queues, AI configuration or clock. It was **not run**.

The freeze preserves Git `5ddfd2b938b291764767bb9b785461f485c0e747`, relevant
binary diff, helper patches and 321 actual source/module/media pins. Module
SHA remains `6888cc5e4ec7693a8a317fe29147994c7f88fe43afe3109fe6ab0e3e349eec9f`.
Concurrent WebGL changes were separately owned and recorded read-only;
all 321 frozen contents still matched after their publication. No source
archive or repeated media was created.

After LMarbles released the heavy slot, the supervisor acquired
`/tmp/wine-heavy-runtime.lock`, verified zero actual `test/run.js` children,
then refused its sole launch decision at **1,499,303,936 available bytes**,
696,064 bytes below the required 1,500,000,000 floor. Neither Pawn nor its
watchdog was created, and no input occurred. Two subsequent read-only
control requests received connection-refused because no server existed;
they did not launch or replay anything. No floor retry, foreign cleanup,
box, substitute DLL or guest patch followed.

Supervisor PID 1108660 actually waited 0 with separate stdout/stderr EOFs;
outer tool session 66475 completed exit 0. Native/watchdog waits are
N/A (not started), not successful runtime receipts. Eleven helper syntax
checks, 26 gzip decode/hash checks, the parent seals and frozen-content
checks passed. This is documentation-only and claims no new build or
runtime acceptance.

Next: sufficient sustained disk headroom, a newly frozen guarded original,
reviewed e4/Nf6 then d4, and the prepared bounded interpreter trace. Observe
the first actual record-four writer and selected-byte provenance before
attributing a failure to any emulator instruction or API. No minimal failing
regression or scoped fix is justified yet. Box ID none, state NOT_CREATED,
expiry null, stop receipt N/A.
