# SIX plus RENAME-parent candidate

Candidate construction and interaction testing PASS. This is not independent
combined acceptance, caller migration, or mounted/kernel/CLI/browser qualification.

The only production change is the three-line parent loop in RENAME op12/45,
inserted immediately after both names are validated. It is copied verbatim from
the independently accepted RENAME-parent donor, not from its surrounding backend.
The base is accepted SIX commit a6b1fb7a761bde9bba6385dbd30b2357b6f3c1dc.
Base backend SHA256: cc2dc7ab2f9b5d1b84b755c61e7a6ffc3e226d52ffe008edf7ace5310cbdc105.
Candidate backend SHA256: b8201b2c4a1d0e1fd653bb02fda7870f626d3781bed014657fb974cc24e41c40.
Donor backend SHA256: 3ff02988e444348fc12ccf9b4e6f16db1918b532a10152538afbafa96b2108bb.

`candidate.diff` and `source-gate.json` establish exactly three added lines,
byte-identical serve and all other backend bytes. Materialized caller, confine,
supervisor and pinned supervisor remain unchanged. The exact staged paths and
diff must also pass review before publication. No caller pin is imported.

The fresh production Backend constructor is used with an absolute unmounted
fixture path, followed by INIT and direct unchanged Backend.handle dispatch.
The interleaved sequence passes 84 requests, with 46 rejected requests checked
against complete deep snapshots of every Backend instance field. Only the
operations counter may increase by one on rejection; namespace, payloads,
links, opens, handles, quota configuration/accounting, failure and all other
counters must match exactly. Full before/after snapshots and wire payloads are
in interactions.json.gz.

The sequence mixes invalid CREATE/MKDIR parents, size plus unsupported SETATTR
flags, both RENAME12/45 parent errors, source/destination/name/flag precedence,
UNLINK/RMDIR type checks, directory cycles, READDIR parent identity, no-op and
valid rename after each parent rejection. After the mixed rejections a valid
overwrite retains an open overwritten file and its payload, metadata/payload
charges and handles until release; directory movement and open-unlink collection
also pass.

Seven private module mutants are detected: missing and non-directory predicates
removed separately for each RENAME source/destination; old CREATE missing/type
checks; and early SETATTR flags rejection. Mutants never modify production.
Each compressed mutant trace records its source hash and first detected omission.
The summary records the exact observed errno or unintended success.

Previously passing SIX and independent RENAME receipts and artifacts are reused,
not replayed. input-verification.json records authenticated supplied artifact
hashes and inventory hashes, preserving historical diagnostics as supplied.
No historical unavailable measurement is replaced by a current sample.

Run only through the assigned supervisor, from this owned repository:

```
/usr/bin/python3 /tmp/toyvm-six-plus-rename-parent-candidate-oct29/ops.py candidate-interactions /usr/bin/python3 test/toyvm-six-plus-rename-parent-candidate-oct29/interactions.py
```

Controls: transferred 24 MiB allocation; parent soft DATA 128 MiB with original
hard unchanged, Git child DATA 256 MiB, Python child DATA 128 MiB; monitored parent
RSS 128 MiB/group RSS 512 MiB; CPU 90 s, wall 120 s, file 12 MiB, capture 2 MiB,
evidence 1 MiB. No limit is raised or denial retried. run-controls.json retains
the exact actual admission, executable and unchanged wrapper pins. No boxes were
assigned or touched; runtime shutdown ownership remains with the coordinator.

Remaining gates: independent acceptance of this exact combined backend; separate
caller migration and pin review; real CLI confinement/descendant lifecycle and
mounted FUSE accounting; browser/runtime qualification and publication permissions
where applicable. No shared integration, main or public deployment occurs here.
