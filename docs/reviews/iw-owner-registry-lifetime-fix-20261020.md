# Window registry and publication lifetime repair

Candidate parent: `ac72debe7522d4d57034627712b8ec000f8e1d92`.
Preserved task branch: `task/iw-registry-preserve-finalize-oct20`.

The independent review `a56f9b6014a939fdf08c22e9dfd877f734e6d9fb`
reproduced six defects: foreign unpublished native child, parent and continuation
windows were invisible; renderer metadata remained searchable after owner row
removal, different-HWND slot reuse, and same-HWND lifetime reuse.

This preserves the terminal worker's five-file production diff and focused
JavaScript test byte for byte. Context registration enumerates native windows
without requiring a renderer surface, reads class/title data from the owning
memory, and uses caller-independent owner ordering. Allocation assigns an atomic
64-bit generation in a new 2056-byte shared region. Removal retires the row before
notifying the host to invalidate publication metadata. Publications retain their
owner and generation, preventing stale metadata from reviving after reuse.
Existing 265 region descriptors remain unchanged; the new region is appended.

## Validation

Run `node docs/reviews/iw-owner-registry-lifetime-fix-20261020.js REPO`.
The test retrieves its pinned predecessor fixtures from Git objects. Preserve
the parent and review commits when transferring this checkout.

The exact preserved source passes 89 prior checks/five rejecting controls,
67 independent checks, and 29 focused result entries/three additional rejecting
controls, using 60 compiled slices. All six defect oracles require and obtain
the corrected values. Focused checks include an entirely unpublished foreign
tree, native class mapping, ownership collisions, unqueried publication removal,
generation changes, explicit new publication, and reentrant removal lookup.
The focused count includes grouped assertions and gate imports; it is not a
count of separately executed CLI gates.

Separate unchanged CLI entrypoints pass:

- Region declarations with `--strict --check-owners`: 266 declarations/owners.
- Generated region mirror with `--check`: current, 266 regions.
- Fragment structure: all 127 manifest fragments.
- Logical `i32.and`, 290 host import signatures, and silent-stub inventory.
- Node syntax checks for both changed JS files and the focused test.

`iw-registry-preserve-gates-20261020.js REPO ENTRY [ARGS...]` executes CLI
entrypoints with `require.main` set correctly. Its read-only filesystem adapter
reads materialized files from REPO and missing sparse paths from the exact
parent Git tree. It refuses writes. This avoids materializing the full source
tree within the 8 MiB task cap; it does not alter gate code or omit manifest
inputs. All 175 replay input hashes were compared with the exact resulting tree.
An initial hash-audit subprocess exceeded Node's default output buffer; rerunning
with a 16 MB buffer completed without changing source or checks.

## Recovery and limits

Evidence: `scratch/runs/20261020-iw-registry-preserve-finalize-oct20/`.
`setup.json` records original paths, explicit diff hash, per-file recovery hashes,
and shared HEAD/index/config seals. `change.patch` and `focused-original.js`
preserve the original uncommitted repair. `tests.json`, CLI logs with input
hashes, `validation.json`, and the final receipt record this task's results.
The original worker's evidence and checkout remain unchanged.

The original worker stopped at available **2042159104 < 2274971648** bytes.
This task uses a conservative full-allowance prewrite threshold of 2277507072
bytes (at least the required base plus reserves plus remaining allowance).
That earlier failure is retained as evidence, not substituted by a later sample.

These are source and compiled-slice tests with controlled boundaries, not
full-VM, Worker RPC, CLI IPC, browser, launcher, game, or concurrency
qualification. The context registry is module-local; isolated realms without a
published owner are not proven by these fixtures. General Unicode behavior and
arbitrary concurrent/reentrant chains remain unqualified. Runtime 403 restrictions
remain binding. No full build or main integration was performed. Independent
review is required before integration.
