# Tux Racer retained original media, integrated lexical scanner

2026-10-29: production static-closure API and actual `literal-sources` CLI
passed on main `3898e008861bad6c274506664b2804dbdc7d236a`.
Runtime, renderer, gameplay and ordinary Quit remain unqualified.

Production source: `tools/recovery/tuxracer-original-win32-recovery-oct28.py`,
25,097 bytes, SHA-256
`69257615178adda7568036fc49e2f20b4ca602c6d3b734f1238caf6143021b17`.
The recipe imports that exact checkout file and calls `closure(directory, inventory)`;
the CLI executes that same file, and its complete parsed JSON equals the API's
`literalSources` result. No historical runner or Tcl evaluation was used.

Pinned dispatch: `/home/user/wine-assembly/scratch/usage-watch/tuxracer-admitted-workdir-real-media-oct29-dispatch.json`,
SHA-256 `00f067d7bb01d67022392c7f97550ce22b7d6d2c10a70b453bcc21c9af02998a`.
The unchanged inventory is 29,710 bytes, SHA-256
`9ac1ac56933cbeae45b0ada2162af298dbc768a5f82a0e2131faa218b0644dc5`;
the original ZIP is 8,009,319 bytes, SHA-256
`1497e326af9aa591243f4ff1083d4d99de7dc5f0396e37f45ca7bf4f98823c34`.
Both were rechecked. All 158 retained extracted files / 13,225,945 bytes
still match inventory paths, sizes and SHA-256, with no symlinks or special files.
The archive census and ZIP-member validation at prior commit
`032f75ff582aa635ff78baf71febbd0e9a77bd78` are reused, without decompression,
copying, extraction, download or inventory regeneration.

The API reports four PE modules, 154 non-PE data files and no unresolved
non-system direct imports. Its recognized Tcl subset checks one literal:
`courses/common/tux_moonwalk.tcl` → `../common/tux_walk.tcl`, resolving to the
retained in-root script-directory candidate. This proves candidate presence,
not runtime working-directory resolution.

There are 458 UNKNOWN records: 452 non-source commands/bodies not evaluated,
and six unsupported/incomplete-syntax records leaving remaining commands
unknown. The earlier report's six checked literals are not carried forward as
new-scanner proofs. In particular, this scanner does not scan nested Tcl bodies
as top-level commands. Static pass is confined to the scanner's recognized
subset; it does not establish general Tcl/data closure or API implementation.

One 19-byte owned fixture, `source "$computed"` followed by newline, produces
zero checked and exactly one UNKNOWN entry through the actual CLI. It neither
rejects the computed expression as a missing literal nor marks it resolved.
Original media and production source were unchanged.

Evidence root: `/tmp/tuxracer-admitted-workdir-real-media-oct29/`.
`api-output/inputs.json` binds pins/freshness; `api-output/closure.json` retains
the complete API result. `evidence/real-media-cli.stdout` retains the actual
CLI result, and `api-cli-equivalence.json` and `unknown-control-result.json`
record assertions. `receipt.json` binds publication and cleanup.

Reproduction uses `test/test-tuxracer-real-media-lexical-oct29.py OUTPUT` under
the task-owned supervisor, followed by `accept_cli.py` in the retained recipe
directory. Output paths must be fresh and within the assigned task root.
The retained supervisor and CLI driver are also preserved in
`tools/qualification/tuxracer-real-media-oct29/`; they are task-specific and
must not be executed as mutable predecessor supervisors by later workers.

The supervisor enforces explicit contained CWD, owned Git `-C`, repository
identity before mutations, fresh aggregate disk/RAM admission, DATA128MiB for
Python and DATA256MiB only for Git children, RSS128MiB/process and512MiB/group,
CPU90s/wall120s, file12MiB and capture2MiB. An initial local wrapper incorrectly
made the parent's DATA hard limit128MiB, preventing Git256MiB preexec setup;
no Git command executed on that failed setup. The repaired parent retains its
inherited hard ceiling and Python soft128MiB, allowing prescribed child limits.
No platform/user ceiling was raised. The incident is retained separately.
No Node, mount, guest, Boat or public deployment was used; actual mount argv
and intended filenames are empty. Allocation remains reserved for coordinator
closeout. Board publication is delegated through `publication-note.txt`.
