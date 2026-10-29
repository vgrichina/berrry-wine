# Original-media Tcl syntax gap, 2026-10-29

The pinned production scanner stopped at `set tux_data_dir [pwd]` in original
`tuxracer_init.tcl:6`, missing `source courses/course_idx.tcl` at line 24.
The unchanged original file reproduced this before the repair. No Tcl execution
is needed to locate a closing bracket in a simple substitution of plain words.

The repair retains such substitutions as computed word spellings and continues
lexical scanning. It accepts one bracketed command containing a plain command
name and plain arguments; nested brackets, variables, quotes, braces, escapes and
command separators within brackets still stop scanning conservatively. The
substitution result is never computed. Source operands containing substitutions
remain UNKNOWN, and existing path confinement and missing-source checks apply.

The six original stops, with original line numbers, are:

| Script under `tuxracer-win32-0.61a/` | Original stop | Result |
| --- | --- | --- |
| `tuxracer_init.tcl` | 6: `set tux_data_dir [pwd]` | Observes literal source at 24; procedure source at 18 stays unevaluated. |
| `courses/course_idx.tcl` | 45: `set cwd [pwd]` | Continues until complex `[concat …]` at 106; no later source command. |
| `courses/common/foggy_light.tcl` | 7: `set far_clip [tux_get_param forward_clip_distance]` | No syntax stop; subsequent application commands remain UNKNOWN. |
| `courses/common/night_light.tcl` | 6–7: continued `tux_fog … [tux_get_param forward_clip_distance]` | No syntax stop; application commands remain UNKNOWN. |
| `courses/common/sunny_light.tcl` | 6–7: continued `tux_fog … [tux_get_param forward_clip_distance]` | No syntax stop; application commands remain UNKNOWN. |
| `courses/common/courseinit.tcl` | 4: `set cwd [pwd]` | Observes literal sources `tree_polyhedron.tcl` at 8 and `tux_walk.tcl` at 81; conditional bodies stay unevaluated. |

Actual-media production API and actual `literal-sources` CLI outputs agree:
checked literals increase from 1 to 4, syntax stops decrease from 6 to 1, and
UNKNOWN entries increase from 458 to 635 because subsequent commands become
visible. This is broader lexical observation, not general Tcl closure or runtime
resolution. Existing CWD uncertainty remains. The retained `[concat …]` expression
requires broader lexical support to inspect; establishing computed dependencies
or actual execution additionally requires an explicitly authorized Tcl evaluation
contract. This task does not supply that contract or infer application values.

Focused acceptance uses the exact production module and original extracted media,
checks API/CLI equality and exactly the three added literal observations, preserves
computed/complex/incomplete UNKNOWN behavior, rejects unsafe or missing source
targets, leaves control bodies unexecuted, and kills a mutation disabling the new
recognition. The original media census, archive recovery and broad suites were
reused unchanged rather than rerun. No runtime, build, download or media write ran.

Pins and evidence:

- Base: `3898e008861bad6c274506664b2804dbdc7d236a`.
- Original scanner SHA-256: `69257615178adda7568036fc49e2f20b4ca602c6d3b734f1238caf6143021b17`.
- Repaired scanner SHA-256: `17536ba93021a4d7061b542876eaecef6f1f716fa3e420ef283b2804c50b6c04`.
- Inventory SHA-256: `9ac1ac56933cbeae45b0ada2162af298dbc768a5f82a0e2131faa218b0644dc5`.
- Original archive SHA-256 (reused prior acceptance): `1497e326af9aa591243f4ff1083d4d99de7dc5f0396e37f45ca7bf4f98823c34`.
- Canonical prior review: `/home/user/wine-assembly/scratch/usage-watch/tuxracer-admitted-workdir-real-media-oct29/coordinator-review.json`.
- Task-owned evidence: `/tmp/tuxracer-real-media-tcl-syntax-gap-oct29/repo/evidence/`.
- `original-reproducer.json`, `focused-acceptance-result.json` (six exact original
  spans and per-script hashes), `changed-real-media-cli.stdout`, subprocess and
  per-operation admission receipts preserve the delta. Two pre-spawn wrapper
  setup incidents are retained separately; neither changed production outcomes.
  A test-result/supervisor-receipt filename collision is also recorded. Passing
  stdout and exit status survived; static spans were reconstructed from the
  unchanged media without repeating tests.

Recovery recipe: use the canonical dispatch's `extracted`, `inventory.path` and
`observedClosure`; run the production script's `literal-sources DIRECTORY INVENTORY`
under the task's resource supervisor, retain stdout, then run
`test-tuxracer-real-media-tcl-syntax-gap-oct29.py` with `--source`, `--media-root`,
`--inventory`, `--prior`, `--cli-output`, `--task-dir` and `--result`. This test
never spawns subprocesses. Source changes require fresh independent acceptance
before integration into main. The coordinator owns publication of the bounded
`publication-note.txt` and retains the allocation through closeout. No box assigned.
