# TuxRacer conservative Tcl lexical repair

Base: `5c8f6750b52d320130da300cbba2336dc0fdc53c`.
Production SHA-256: `69257615178adda7568036fc49e2f20b4ca602c6d3b734f1238caf6143021b17`.

The unchanged `test/tuxracer-parent-relative-independent-oct28.py` first ran
against its original pinned production source into fresh owned fixtures. Its
parent boundary passed, its parent-stack mutant was killed, then inert braced
`set` data falsely raised a missing literal source for `../common/absent.tcl`.
The original test and its rejected-source pin remain byte-identical.

The scanner now recognizes top-level commands while retaining multiline braces
and quotes as word data, comments at command boundaries, escaped characters,
and ungrouped newline/semicolon boundaries. Control bodies are not evaluated.
Bracket substitution, malformed/incomplete grouping, computed source arguments
and source continuations remain UNKNOWN. Unsupported bracket syntax ends the
remaining file audit conservatively. Non-source commands are explicitly UNKNOWN.
This is a lexical subset, not complete Tcl parsing or runtime resolution.

Literal target normalization and confined root/script-directory candidate checks
are unchanged. Missing real literals still reject; all-escaping targets remain
UNKNOWN. Runtime CWD, substitution and filesystem/runtime resolution remain
UNKNOWN. No Tcl execution, original-media extraction or runtime qualification
was performed.

`literal-sources DIRECTORY INVENTORY` exposes the same lexical API as a production
CLI for local static audits; it reads the supplied script inventory and does not
execute Tcl. Like the existing API, inputs are trusted audit inputs.

Validation on the production hash above:

- The transparent `test/tuxracer-lexical-independent-adapter-oct29.py` replaces
  only the original harness's source-hash assertion in memory. It runs the exact
  original fixtures and behavioral assertions successfully. It does not claim
  that the old pinned harness runs unchanged against a changed source hash.
- `test/tuxracer-lexical-commands-oct29.py` passes 23 cases through both the API
  and actual production CLI: inert braces/quotes, nesting, comments, escaped
  newline/semicolon/brace, real source after data/comments, missing literals,
  parent candidates, encoding option, root escape, computed/control syntax and
  malformed grouping. Restoring the old boundary matcher is killed by the exact
  inert braced-data regression.
- Reuse the unchanged eight parent/static closure checks through predecessor
  receipt `scratch/usage-watch/tuxracer-parent-relative-independent-accept-oct28/receipt.json`
  (SHA-256 `1a4a2d59f4d0c3fb7c0f08113070fca50ed082fbe5701df0692c5824b2cb4fd2`)
  and coordinator review (SHA-256
  `78753c972f8488682251674553a0a3b16bc3cd4a64f3a30bc8f183ca335d4628`).
  The inherited original manifest remains UNSEALED; no repeated payload census.

Owned evidence: `/tmp/tuxracer-cwd-contained-lexical-repair-oct29/receipt.json`.
Resource allocation remains held through coordinator publication/closeout.
Fresh independent acceptance is required before serialized main integration.
No main push or public deployment is authorized by this task.
