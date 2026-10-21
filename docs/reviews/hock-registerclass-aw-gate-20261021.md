# RegisterClass A/W canonical census gate

Exact base: `5b078c91d5cf6da5e337cda5e7665803c03c99e5`.
Branch: `task/hock-registerclass-aw-gate-oct21`.
Run: `scratch/runs/20261021-hock-registerclass-aw-gate`.

The unchanged base fails `node tools/aw-census.js --check` with exactly
`NEW DIVERGENT RegisterClassA/W` and `NEW DIVERGENT RegisterClassExA/W`.
This is a direct-call census visibility problem, not evidence of two distinct
registration implementations. Both A handlers call `class_table_register_data`,
whose entire body calls `class_table_register_encoded(name, wndclass, 0)`.
Both W handlers call that same encoded core with flag 1. The census excludes
ordinary pointer translation and sees only `gl32` in common between the long
handler bodies; it does not traverse the ANSI forwarding helper.

## Semantic review and correction

Make only the two ANSI calls invoke the existing encoded core directly, with
the same arguments followed by constant zero. Keep the forwarding helper for
its other callers. No baseline adjustment or census algorithm change.
`semantic-proof.json` checks that removing comments/whitespace makes the entire
candidate runtime fragment equal to the base with just these two forwarder
calls expanded. It also seals all 131 materialized source files: only this
runtime fragment differs. The W fragment and class/window helper fragment
remain byte-for-byte exact base.

The encoding distinction is required. W names go through `class_wide_name_key`
for lookup hashing, but the original UTF-16 pointer remains in the copied
WNDCLASS. The encoded core stores the encoding byte under the writer lock,
before publishing the hash, on both insertion and replacement. Atom publication
and window lookup use that registration encoding; choosing encoding from a
later query would misread the retained name. A registration must reset a prior
W encoding byte, and W must restore it after an A replacement.

The correction preserves name conversion, all ten copied WNDCLASS fields,
the Ex adapter's four-byte offset, atom allocation and replacement identity,
writer-lock boundaries, primary/secondary EXE procedure selection, and ESP
cleanup. It does not change the existing low-byte/255-character wide-name
key conversion or ExA's existing direct g2w name translation. Tests cover
string registration and subsequent returned-atom lookup; they do not establish
arbitrary Unicode or every low-integer registration-name behavior. No window
allocation, retirement, generation, removal, or lookup algorithm changes.

## Evidence

`registerclass-aw-contract-20261021.js` beside this report compiles and executes
the actual four handlers and registration/name/atom/publication helpers with
the repository compiler. Its guest translation is deliberately nonidentity;
copy boundaries assert the writer lock is held and the publication hash is
hidden. Both unchanged base and candidate pass 28 acceptance groups: every
entry point, all 16 cross-spelling replacements, distinct class atoms, all ten
fields, original name pointers, both query encodings, atom publication, DLL
exclusion, primary/secondary procedures, stack cleanup, and 64-slot exhaustion
with no record mutation and balanced lock release.

Six separately compiled behavior controls exit 1 at behavioral assertions:

| Mutation | Rejecting assertion |
| --- | --- |
| Force encoding zero | registration owns encoding |
| Force encoding one | registration owns encoding |
| Bypass W key conversion | opposite encoding name lookup |
| Copy only 36 bytes | all ten WNDCLASS fields retained |
| Collapse returned atoms | all ten WNDCLASS fields retained (wrong record) |
| Remove Ex structure offset | all ten WNDCLASS fields retained |

The existing `test/test-aw-census.js` now checks these two live pairs and
rejects each disconnected W registration callee. It passes 15 checks across
251 live pairs. Two actual CLI mutation controls independently replace one W
callee at a time: each exits 1 naming its exact new divergent pair. The source
is restored in `finally`, and the census passes again: STUB 0, DIVERGENT 3,
BOTH_STUB 0, with the original baseline unchanged.

The existing lookup/lifetime source-slice suite passes 89 checks, five internal
rejecting controls, and 24 small compiled modules. It covers real class
registration, W/ExW adapters, atom publication, lookup, WND allocation/reset/
removal and retirement, with controlled renderer/parallel-table boundaries.
The preserved adapter pins sparse fallback reads to exact base and applies
the fixture ABI updates already documented in
`iw-owner-registry-lifetime-fix-20261020.js`: two-argument class publication,
generation region/helper, lookup exports, and complete lookup reset prefix.
The initial historical fixture fails on the old host signature, then on its
missing generation declaration. Its later signature freshness check initially
reports stale because the virtual reader's existsSync does not cover an
unmaterialized generated JSON file. Materializing the exact-base generated
mirror resolves that checkout limitation. These failures and the final pass
are preserved; no generated data was refreshed and no production repair was
made for them.

`tests.json` records 17 final commands: nine successful exits and eight expected
rejections. Fragment balance, handler ESP, logical-AND and whitespace checks
also pass. `run-tests.py` replays the final sequence, including restoration.
Earlier exact-base reproduction and contract results are separately retained.

## Recovery and limits

The adjacent `hock-registerclass-aw-gate-20261021-evidence.tar.gz` contains the
admission projections, scripts, exact command/exit ledger, behavior output,
mutation logs, lifetime adapters/results, source proof, patch and SHA-256
inventory. Extract into a new run with a sparse `repo` checkout of this branch;
run `python3 run-tests.py`. Keep all `src/`, `tools/watx-src/`, census tools,
the three checked gate scripts and generated host/region mirrors available.
Historical fixture source/dependencies are also recoverable from Git objects.
The local sparse repository borrows the prior repository's object store;
the pushed task branch is the durable source/evidence backup.

Object availability and a 22,384,640-byte allocated sparse projection were
verified before materialization. The run remains below its 67,108,864-byte cap
and above the 2,285,895,680-byte free-space floor; final receipts record usage.

No full local build, complete emulator module, actual concurrent lock stress,
PE/NE execution, browser, Hock startup capture, screenshot, or gameplay was
performed. These remain integration/runtime gaps. The separately pushed owner
fix `4174b3b84330fe5a83942ba1d3ddd6b2e0395a13` is neither included nor merged;
the known exact-base owner gate still requires that separate reviewed repair.
Producer-changing main integration remains frozen. No workers, Boat commands,
public deployment, laptop/Claude/shared config edits, main push or merge.
