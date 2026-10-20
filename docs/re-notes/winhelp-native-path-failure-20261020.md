# WinHelp native fixture failure diagnosis — 2026-10-20

The three failures are explained by a production loader integration defect,
not invalid fixture registration or a callback ownership failure. This change
corrects the source contract; native requalification remains pending.

Original evidence: `scratch/runs/20261020-callback-native-census-fixed/`.
Exact tested source `1d58b6c5497d6315976ca9d506f66c84612681cc`, fixture
`2c902c79f362560112ca30d41e4332688046d55a`, canonical fullVM SHA256
`a50b56a2dfc26174231cde9492b8ab2fb715eaecad6fd8e9e5b8445b3c88e361`.
All four RichEdit cases passed; help-ordinary, help-nested and help-timeout
accepted registration but returned zero on the subsequent public API calls.
All three had zero DLL entries and zero successful siblings out of 70 attempts.

The generated guest calls WinHelpA with HELP_COMMAND (0x102), first loading
`c:\ew-native.hlp` and registering `c:\ew-native.dll`, export `Probe`, format
`UU`. Later calls use the current document (null filename) and two integer
arguments. The actual saved DLL has a valid named Probe export at RVA 0x2000.
Regenerated DLL and both code streams match the saved three scenarios exactly.
No fixture or expected-success assertion was changed.

In the exact tested source, `$find_loaded_dll` routes a qualified name to
`$find_dll_by_path_locked`, which matches DLL_PATH_TABLE rather than falling
back to an export basename. `$load_dll` only populates that table when its
caller supplies `$next_dll_path`. `$help_routine_resolve` did not supply it,
then searched again using the same qualified name. Even a successful map
therefore could not be found; the resolver returned zero, and
`$help_macro_call_routine` returned unsupported before entering guest code.
Repeating the call does not repair the missing identity. This deterministic
source path explains the common pre-entry failure without changing the
fixture to use a basename, preloading the DLL, or weakening success.

The correction allocates a separate persistent path copy, publishes it under
the loader lock, and transfers it to the loaded generation. It must not use
the registration's pointer: that string belongs to the help document and can
be released independently. Copy failure frees temporary read allocations;
rejected mapping frees the unpublished path too. Neither case initializes a
failed row or resolves an export. Existing callback code and census rows are
unchanged, as are the JS COM sources, failfast behavior and locked jump APIs.

Validation (source-only, no VM or compilation):

- `node test/test-winhelp-native-path.js`: executes the actual resolver AST
  with modeled VFS/loader boundaries; checks the three scenario paths,
  cache and loaded-row reuse, distinct paths with the same basename,
  persistent versus document ownership, copy failure, load failure and
  missing export.
- The same regression on the exact old helper fails: zero instead of
  resolved guest entry. Removing path publication, aliasing the document
  string, and leaking the rejected copy each fail separate mutation controls.
- Existing WinHelp ownership suite: 25 cases and 17 mutation negatives pass.
- Unmodified fixture offline validation: seven generated cases, disassembly
  and ABI checks, seven argument negatives, 14 ABI negatives, 14 missing
  evidence negatives, seven synthetic positives and 84 oracle negatives pass.
- Original recovered evidence hashes verified; the three saved observations
  still fail the unchanged oracle. Synthetic/source checks are not native
  callback acceptance.

Self-contained compact evidence and offline replay:
`scratch/runs/20261020-winhelp-native-failure-retry/{report.md,receipt.json,replay.js,baseline,snapshot,fixture,original,logs,SHA256SUMS.json}`.
Run `node replay.js` there. The baseline includes the exact loader/public
dispatch/resolver source, while snapshot contains the corrected helper and
test dependencies. The original failing evidence is retained in place.

For separately assigned native requalification, stage a fresh exact candidate
including this helper correction and the original three fixture blobs, verify
all source identities, run the canonical gated build, and record its new
module hash. Run each of help-ordinary, help-nested and help-timeout once:

```sh
node test/test-edit-winhelp-callback-native.js \
  --case=help-ordinary --artifacts=/NEW/EVIDENCE/help-ordinary \
  --wasm=/EXACT/BUILD/wine-assembly.wasm --sha256=NEW_MODULE_SHA256 \
  --source=EXACT_CANDIDATE_COMMIT --help-file=test/binaries/help/freecell.hlp
```

Use the corresponding case and fresh directory for the other two. Preserve
the existing 120-second/4,000-batch runner and 150-second parent bounds.
Require the unchanged result=1, actual DLL arguments/results/entry counts,
nested restoration or timeout marker, exact ESP/register restoration, and
70 successful siblings. Stop on failure and retain receipts/logs. No native
run, full build, Boat/browser access, main merge or worker launch was performed
by this diagnosis task.
