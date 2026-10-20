# FindWindow lifecycle corrections — 2026-10-20

The D1–D3 source-level rejection oracles for candidate
`aacd0b19d2ccb9edd804573c4edcde461a059032` are corrected on
`task/iw-lookup-lifecycle-corrections-oct20`. This is a candidate for independent
review, not full-VM or game acceptance. No main integration occurred.

Remote main was verified as `a54049d11955307d06309e146e85c1aca3196657`
before work. The parent candidate is retained intact in this branch's ancestry.
The entire independent report at review commit
`89e876f11bccce852ec22af70c6c2229a0ce49c4` was read. Its unchanged helper
reproduced all 31 outcomes and five rejected acceptance oracles against the
exact old candidate and main before implementation (`reproduced.json`).

## Changes

**D1: live unpublished windows versus retired rows.** Attached-host lookup
reconciles caller-owned live WND rows with renderer publications. Native
`ctrl_create_child` windows, unpublished parents and valid unpublished `after`
handles participate. Unpublished siblings use their WAT order relative to local
published anchors; existing published desktop ordering remains intact. Foreign
publications retain their owners and host strings. Caller query pointers are
passed only to the caller's matching export, never to a foreign instance.
Renderer-only publications remain valid even without a WND row.

A shared per-slot retirement byte distinguishes host destruction from absence
of renderer publication. Host destruction retires the owner's WND lifetime
before deleting its renderer record; directly removed rendered children are
also retired in their respective owners. The real slot reset clears retirement
before a new row is published. Updating an existing row's procedure does not
revive it. Local fallback also excludes retired windows, parents and `after`
handles. Host zero remains authoritative: no zero-to-local fallback was
restored. Desktop-handle normalization now also works without a renderer.

The attached-renderer fixture in `test/test-find-window.js` is restored.
Separate source-slice checks exercise live and retired no-renderer fallback.
The full-VM fixture itself was not executed under the runtime restriction.

**D2: registration encoding.** `RegisterClassW` and `RegisterClassExW` call the
encoded class-registration helper. The shared per-slot encoding byte is set
inside the existing registration lock, before the class hash publication word,
for both insertion and replacement. A registration retains its original
WNDCLASS name pointer at offset 44. Atom lookup uses the registration's encoding
for the class and the query's independent encoding for the title. Existing A
registration callers retain their interface and set encoding to ANSI. Replacing
W registration with A, and A with W, is covered.

**D3: atom creation publication.** The actual `CreateWindowExA`
`host_set_window_class` expression resolves application atoms to their
registered names. W names use the existing wide-to-byte conversion used by W
creation. The six USER built-in atoms are explicitly decoded by the class
setter. Name pointers preserve their existing path. Unknown atoms publish no
invented name. The input argument remains unchanged for other creation logic.

The two new shared regions total 320 bytes. They are appended to the
declarations; the unchanged repository generator produces the committed
`lib/region-map.generated.js`. Existing region bases do not move. The layout
hash changes, so a future integrated build must use its matching generated map.
No host import signature or transport change is introduced.

## Evidence

Run from this checkout, or from a checkout containing the parent object:

```sh
node docs/reviews/iw-lookup-lifecycle-corrections-20261020.js . /absolute/path/tests.json
```

Add `--generate-map` to regenerate the map with the repository's actual generator.
Sparse-unmaterialized dependencies are read from the exact parent Git object;
changed paths are read from this checkout. The helper records source SHA-256
seals and compiled slice hashes. All new scripts are JavaScript.

89 checks pass, with five rejecting mutations:

* Removing reconciliation loses a real production-created native child.
* Removing retirement revives a destroyed window's retained row.
* Removing the real slot-reset store prevents a reused lifetime from becoming live.
* Forcing registration encoding to ANSI loses a W-registered class atom.
* Restoring `g2w(atom)` at the creation publication boundary loses the class.

The actual compiled source includes the lookup/matcher/Z-order functions,
`ctrl_create_child`, class hash/atom/table functions, full W and ExW registration
adapters, the exact creation publication expression and its resolver, retirement
exports, and WND allocation/reset/removal functions. The latter verifies NULL,
retirement, subclass updates, removal and handle/slot reuse. Controlled
boundaries cover unrelated parallel tables, allocation, painting, geometry and
guest callbacks; WM_CREATE delivery is observed, not executed as a guest
procedure. The main ordering fixture uses a controlled WND model; the actual
WND lifecycle is separately compiled and tested. These are not complete
CreateWindowEx/DestroyWindow executions.

Coverage includes A/W name/atom/title filters, all six built-ins, strict `after`
membership, direct children versus grandchildren, unpublished parents/after,
renderer-only publication, desktop alias, no-renderer fallback, stale rows,
foreign host strings and owner-directed retirement using two separate memories.
Five mutation controls fail the required acceptance assertions as intended.
The unchanged complete host relation regression, 290-import signature freshness,
logical-AND gate, six changed-fragment structure checks and generated-map
freshness also pass. No production success stub was added.

## Limits and handoff

The three reported source defects are fixed in the tested boundaries. Their
old integration rejection should be reconsidered only after an independent
review of this exact branch. No full-VM, Worker/RPC, CLI IPC, game or launcher
qualification is claimed. Runtime403 remains binding.

Reconciliation enumerates the caller's unpublished rows, not unpublished rows
belonging to every other process. Foreign rendered windows remain searchable
through their host metadata. This does not establish a complete cross-process
registry of non-rendered windows. Exact global ordering of unpublished
top-level windows from different processes, concurrent creation/destruction,
and all reentrant guest-callback intervals remain unqualified. Existing W
creation narrows strings; arbitrary Unicode/codepage equivalence is not solved.
Dialog class publication outside the reviewed CreateWindowEx boundary remains
an independent limitation identified by the rejection report.

No ShellExecute, process-alias or integrated SendMessage path was edited.
No runtime/Boat/SSH command, full build, browser, benchmark, deployment, Claude,
held diagnostic, worker launch or laptop Heroes II/Warcraft III operation was
performed. Shared HEAD/index/config and ignored evidence are preserved.

Evidence is retained in
`scratch/runs/20261020-iw-lookup-lifecycle-corrections-oct20/`:
`setup.json`, `reproduced.json`, `tests.json`, final publication receipt,
patch, exact remote-ref verification and SHA-256 evidence seals. The committed
helper and this report are the remote recovery recipe; ignored run artifacts
are not a Git backup. The checkout uses read-only object alternates and exact
sparse patterns established before materialization, within an 8 MiB allocation.
