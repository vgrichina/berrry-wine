# VirtualFS FindFirstFile literal pattern repair (2026-10-24)

`VirtualFS.findFirstFile('+index_user.txt')` constructed an invalid regex on main
`979042c93eec78095d0e4ee078d4efb25a55a5ff`. Other punctuation could silently
change matching: `[ab].txt` matched `a.txt`, and `a{2}.txt` matched `aa.txt`.
The production matcher now escapes regex punctuation in one replacement pass,
expanding only DOS `*` and `?`. The existing `*.*` special case, anchors,
case-insensitivity, path resolution, drive-root probes, enumeration order and
synthetic dot records remain in their existing code paths.

The real exported VirtualFS regression covers leading/internal plus, paired and
unpaired brackets/parentheses/braces, dollar, caret and dot, with exact matches,
near misses and anchored nonmatches. A separate pipe case verifies that the VFS's
permissive mounted names cannot become regex alternation; pipe is forbidden in
ordinary Win32 filenames. Backslash remains a path separator. Mixed literal and
wildcard cases cover both operators, slash/case/relative resolution, absent
directories, nested enumeration, extensionless entries, root and dot behavior.
Lazy files throw on byte access, ensuring enumeration stays metadata-only.

`test/test-vfs-findfirst-literals.js` is automatically in the **unit** tier by
`tools/test-tiers.js` filename convention; its actual classification passed.
No central tier exception is needed. The sparse checkout cannot run the global
tier membership census without materializing unrelated tests; the focused
classification check exercises the real classifier.

Validation passed with installed Node v24.18.1, heap256MiB, CPU/wall60 seconds per
process and fresh MemAvailable >=805306368 bytes before every test. The old exact
main module fails the same regression with the literal-plus SyntaxError. Ten
mutations are rejected: omit escaping plus, brackets, parentheses, dollar, caret,
braces, pipe or dot; disable star; disable question. Existing `test-vfs.js`
passes **46/46**, and `test-vfs-slash-resolution.js` and
`test-vfs-device-namespace.js` pass. These are offline host tests; no full suite,
full build, historical module substitution or guest ran. The first local test
incorrectly expected an exact `.` query to enumerate `.`; the retained initial
receipt shows actual existing resolution to `game`. The corrected regression
checks resolved dot paths and separately asserts wildcard dot records.

Evidence is in [the adjacent directory](enigma-findfirst-literal-pattern-repair-20261024-evidence/).
It retains original main source and runtime report as gzip snapshots, exact input
hashes, production diff, candidate/control identities, complete commands and
outputs, individual fresh resource gates and admission history. To reproduce
offline, run `python3 docs/re-notes/enigma-findfirst-literal-pattern-repair-20261024-evidence/verify.py`
in this task checkout after fresh resource admission. It reconstructs real
control modules with the candidate's exact current-main dependencies in a
temporary directory and removes those temporary files. It is not a guest recipe.

Initial projected task peak was **40201062/67108864 bytes**, including Git/source,
temporary/evidence space, full external session/events, positive SQLite/history
growth, future growth and an 8388608-byte reserve. Host free after projection was
3693192346 bytes, above 2982150144. Initial capture allowance is 1MiB; required
instructions 64KiB. Focused source/test excerpts were explicitly given a 32KiB
bookkeeping allowance inside the existing evidence allocation. Installed tools
execute in place and read-only donors are separate standing inputs. Flattened
read-only object views avoid the donor's nested alternate-depth warnings without
changing its files or copying pack stores. The original successful donor metadata
read emitted alternate-depth warnings; no access/resource denial occurred.
Git uses only the supplied dedicated identity/known-hosts strict SSH configuration.
Remote main was actually verified before checkout/editing. There is no mount argv
or conditional guest in this task; canonical mount validation is inapplicable.

This repair **does not establish Enigma startup, menu or gameplay acceptance**.
The original runtime report at task commit
`6f8e9294d7bd15ca33ee1a4955d4309820fb5de8` recorded PNG capture-guard rejection
at batch30000 before the later host regex crash at batch44896. The historical
runner continued after capture rejection; immediate-stop compatibility and that
PNG failure remain unresolved. No adapter, runner, capture guard, source input or
historical module changed here. There are no assigned boxes; the coordinator had
already stopped the earlier boxes. No lifecycle, acquisition, deployment,
main merge or worker launch occurred.

Publication is restricted to `task/enigma-findfirst-literal-pattern-repair-oct24`.
The final commit, verified remote SHA, cleanup and final accounting receipts are
retained at `/tmp/enigma-findfirst-literal-pattern-repair-oct24/`, and appended to
the root messageboard. The task's internal `ops/result.json` is written last.
