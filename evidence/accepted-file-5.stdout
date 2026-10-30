# Published TuxRacer syntax: independent bounded acceptance, 2026-10-29

Accepted candidate `e57ec87fb3a37260abb5c7e45ad8d37f3cc4e803` for its documented
static lexical change. The exact published production source was checked out from
read-only object stores into an isolated sparse repository; its SHA-256 is
`17536ba93021a4d7061b542876eaecef6f1f716fa3e420ef283b2804c50b6c04`.
No production source was modified. No correctness defect was found in these bounded challenges.

The first behavioral group ran the real production `literal-sources` CLI on the
unchanged original extracted media and inventory, then the unchanged published
targeted test using its production API. API/CLI outputs matched: four checked
literals, 635 UNKNOWN entries, one remaining complex syntax stop. The test also
confirmed the exact three added literal observations and killed its rejecting mutation.
Earlier archive/recovery, broad closure and unrelated test groups were reused.

The new independent test supplies 41 fixtures. Each was checked using the exact
production API and a separate invocation of its actual CLI. All JSON results matched;
the missing-path case rejected through both interfaces with the same diagnostic.
The new groups cover simple namespace-qualified names, argument punctuation and tabs,
adjacent/multiple substitutions, quoted and concatenated computed operands, nested
brackets, variables/arrays, quoted/braced/escaped inner arguments, escaped closing
brackets, semicolon/newline/comment boundaries, missing/extra/empty brackets,
continuations, quoted/braced bodies, escaped semicolons, continued comments,
malformed quotes, grouped-word suffixes, literal quoted semicolons, normalized paths,
escaping/absolute/drive paths, missing paths and inert `[exec touch SENTINEL]` data.
The valid simple-bracket control exposes the following literal; replacing only
the bracket-recognition condition with unconditional rejection kills that observation.
Sentinels stayed absent. Tcl, data commands and control bodies were never executed.

Recognized bracket spellings have a command name beginning with ASCII letter or
underscore followed by ASCII letters/digits/underscore/colon; arguments use the
restricted ASCII punctuation class `[A-Za-z0-9_:.+*/?-]+`, separated by spaces/tabs.
The result is retained as computed spelling, never interpreted. Unsupported inner
grouping, substitutions, escapes and command separators conservatively stop the
remaining lexical audit as UNKNOWN. This is deliberately a lexical subset, not
general Tcl support. Literal candidates remain constrained to normalized in-root
root/script-directory inventory matches; actual CWD, symlinks and runtime resolution
are not established. General media closure and runtime/gameplay remain unqualified.

One test-oracle incident is retained: the continued-comment fixture correctly
produced no UNKNOWN because its comment was ignored; an unrelated blanket UNKNOWN
assertion was corrected. The first failure is retained in the worker session;
the same-name subprocess capture was replaced by the successful rerun. Twenty-nine
completed unchanged case receipts were reused. Production behavior was unchanged.

Evidence and recovery: the sibling `*-evidence.json` binds candidate/source/test,
original-media pins and results, every new fixture hash, resource checks and limits.
Raw subprocess stdout/stderr, admission receipts, initial session/WAL baseline,
owned-CWD negative controls, sentinel, and supervisor are retained beneath
`/tmp/tuxracer-published-syntax-independent-accept-oct29/repo/`.
`python3 setup.py` records the initial pinned API/CLI group (initialization only).
`python3 challenges.py` runs remaining case API/CLI checks using the owned supervisor;
it reuses completed fixture pins from its checkpoint. For a clean replay, materialize
the published scanner and test at these exact pins into a new authorized owned task,
adapt only the supervisor-owned directory and obtain fresh coordinator admission.
The test itself runs no subprocess: invoke it with `--source SCANNER --task-dir OWNED
--case CASE` (or `all` for API-only). Separately supervise `python3 SCANNER
literal-sources OWNED/fixtures/CASE OWNED/fixtures/CASE/inventory.json`, and compare
stdout JSON with that case's `api.json`, or the missing-path rejection diagnostic.

The allocation remains reserved through coordinator closeout. No build, browser,
guest, Boat, FUSE, download, installer, main integration or public deployment ran.
No box was assigned or altered; shutdown ownership remains with the coordinator.
The final canonical receipt and bounded publication note bind the exact pushed SHA.
