# Independent acceptance: REJECT

Candidate `563592fbc0f07076170b8109167dfc418c6aec84`, production
`tools/recovery/tuxracer-original-win32-recovery-oct28.py`, SHA256
`5a47f748777d5b3a322e1c28b6acb78e13e6772f3cdb7d3b3d811c7e145b328e`.

The exact production `literal_sources` API falsely interprets a line inside a
braced Tcl data word as an executable command. Minimal input, stored as
`courses/common/moon.tcl` in an inventory containing only that file:

```tcl
set description {
source ../common/absent.tcl
}
```

Actual: `Rejected: missing literal Tcl source: courses/common/moon.tcl -> ../common/absent.tcl`.
Expected: no checked or missing dependency from this braced data; conservative
UNKNOWN is acceptable. No Tcl was evaluated. The line-boundary regular expression
ignores the enclosing braced word. Enabling parent normalization exposes a false
missing-dependency rejection in this context. This is a lexical correctness
failure, not evidence that original media contains this particular input.

The unchanged earliest parent-relative production API reproducer passed. A new
mutation replacing parent-stack popping with a bogus component was killed by
that same assertion. The next independent challenge failed decisively; testing
stopped there. The unchanged failing test is
`test/tuxracer-parent-relative-independent-oct28.py`. Run it under the dispatch
resource supervisor with a fresh owned output directory as its argument; it
exits 1 on this pinned rejected candidate and persists its result before exit.
It imports the exact production file; it does not repair or replace production.

The eight inherited checks and original literal delta 6 checked / 2 unknown to
7 checked / 1 unknown are reused from coordinator review
`scratch/usage-watch/tuxracer-parent-relative-static-closure-repair-oct28/coordinator-review.json`.
Their underlying evidence remains authoritative; the original final manifest
remains UNSEALED. No rehash of 158 inherited files or original extraction/media
replay occurred. No donor wrapper was executed.

Coverage is the exact API parent boundary, mutation sensitivity, and this inert
braced-data counterexample. No new CLI extraction acceptance is claimed. Missing
candidate, nested normalization, absolute/drive forms, root escape, candidate
symlink lookup and computed forms retain only inherited qualification; broader
independent challenges and CLI wiring were not run after the first defect.
Runtime CWD, computed Tcl resolution, dynamic loads, guest startup, graphics,
input, gameplay and ordinary Quit all remain UNKNOWN/unqualified.

Repair scope for the coordinator: conservatively avoid classifying `source`
inside multiline braced/quoted data as a standalone command, with this unchanged
counterexample retained. This acceptance task makes no production repair and
must not authorize integration of the rejected candidate.

Task-owned canonical evidence and resource/publication receipts:
`/tmp/tuxracer-parent-relative-independent-accept-oct28/receipt.json`.
No main push, runtime, mount, download, build, browser, guest, Boat or deployment.
No boxes assigned; coordinator retains lifecycle ownership. Allocation remains
owned through coordinator evidence preservation and messageboard delivery.
