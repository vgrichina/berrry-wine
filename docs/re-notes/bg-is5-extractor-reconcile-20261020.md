# BG-FETCH-IS5-20261011 reconciliation

Completed as already fixed. Fresh remote main was
`63d22caf879ca77d891d284f7926416a210136c2`.
The exact merged repair is `47a5c9ab6f7baa698888ce979fec6306780fd5fe`
(`is5-extract: find a cab's .hdr whatever its case`, 2026-10-11).
Its extractor and dedicated regression blobs are identical on this main.
No extractor change is needed for the reported BG failure.

The original error was header selection, not evidence of a new compression
variant. On a case-sensitive filesystem, the old `DATA1.CAB` → `DATA1.hdr`
guess missed `DATA1.HDR`; reading the CAB as its header led to out-of-range
file-table offsets. The merged helper finds the sibling header without regard
to case. The CLI calls it and falls back to the CAB only when no header exists.

The existing `test/test-is5-extract-header-case.js` passes uppercase and
mixed-case sibling lookup and absent-header lookup. The accompanying review
script also runs that same test with the actual historical filename expression
recovered from the fix's parent: it fails the uppercase-header assertion.
This establishes that the regression detects the historical error, rather than
just checking that an exported function exists. It does not test compressed
payload decoding.

Reproduce from this checkout:

```sh
node test/test-is5-extract-header-case.js
node docs/re-notes/bg-is5-extractor-reconcile-20261020.js 63d22caf879ca77d891d284f7926416a210136c2
```

Historical board evidence: 2026-10-11 19:48:14 reports the failing BG fallback
at `bx_h8wtmq3h:/home/user/rp-fetch5.log`; 21:39:38 reports the header-case
repair and successful `installed-extracted/MinimumData` fetch; 22:22:11
confirms that repair; 2026-10-12 00:33:28 marks BG-FETCH-IS5 done, alongside
the separate music-serving fix `712facc4b`. These are historical claims,
not newly executed extraction or gameplay evidence.

The 21:39:38 entry explicitly distinguishes Uprising's embedded-header
compression problem from BG. That problem is outside this assignment.
Generic malformed-archive hardening is not evidence that this BG repair
regressed. No payload fixture was fabricated or downloaded, no decoding
behavior was changed, and no new full-archive/runtime qualification is claimed.

Review evidence is retained at
`scratch/runs/20261020-bg-is5-extractor-reconcile-fix-oct20`.
This task changes only this report, its review script and recorded check output.
Shared worktree state, laptop HeroesII/WarcraftIII and all holds remain outside
the task. No main integration is performed.
