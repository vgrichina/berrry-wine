# Independent verdict: reject candidate 1bc85c5d

Exact candidate: `1bc85c5d8e7513cb30ddd796cef6d93de0a0415b`, branch `task/corpus-source-pin-contract-repair-oct26`. Production CLI SHA-256: `e8046f77b7fad166c81d48f43fe3b2ea5f2e3643e8dd905de364ac53081206b0`; original focused regression SHA-256: `32a9f2c1fd85dabfd5111b18afdcb6e2659552bdc6562468dfae89ad41018a7f`. Neither file was modified during this review.

The extraction identity assertion at `test/test-cli-candidate-corpus.js:179` compares only `interactive.postExtract.slice(0, 3)`. Later extraction steps remain able to overwrite the executable whose provenance the first three steps supposedly preserve.

Minimal counterexample, applied only to an in-memory manifest clone:

```js
interactive.postExtract.push({
  type: 'copyFile',
  from: 'cd/DATA1.CAB',
  into: 'installed-extracted/MinimumData/BGDemo.exe',
});
```

Keep the authenticated ZIP URL, SHA-1, archive type, executable array and first three extraction steps unchanged. Select only THPS2 with `--id=thps2-demo --dry-run --strict`. The unchanged CLI exits **0** and reports one local executable and no failures instead of rejecting the changed extraction identity. Redirecting the existing fourth extraction step to that same cabinet-to-executable copy also exits 0. Appending the overwrite to the **committed** manifest reproduces the same failure.

This is executable identity corruption, not merely extra harmless metadata. The exact candidate's `tools/fetch-candidate-corpus.js:254` processes the full extraction array in order; lines 361–367 implement `copyFile` using `fs.copyFileSync`, overwriting existing destinations. `cd/DATA1.CAB` is already a required input of the authenticated recipe. This review inspected that implementation but performed no acquisition, extraction, installation, build or guest execution.

`independent-results.json` records 14 probes: 11 expected behaviors pass and three counterexamples fail the independent assertions (`0 !== 1`). Each counterexample's CLI process succeeds; the review harness correctly exits 1 because rejection was expected. There are **zero process, fixture or loader errors**. New controls cover list-mode URL rejection, hash validation before unknown-ID usage, absent archive type, executable alternatives, extra raw-CD-step properties, cabinet/copy step types and missing extraction steps. Selected dry-run/list probes forbid filesystem traversal into unselected fixtures; compiler, acquisition, guest and write hooks are fatal. The selected executable is a temporary synthetic 90-byte PE, never an installed game mutation.

## Committed-manifest compatibility correction

The supplied readonly dirty manifest SHA-256 `212be4a27b33cbd8f675fdef80d13bbea45d3d81aa8e3e643a26edbde6e924bd` differs from the committed manifest SHA-256 `25d9dc55241ad3e80b42d71986c4cf147e4e09c2c1370190d14fd0402b4cf4eb`. However, **all six relevant complete candidate records are identical**: three Baldur's Gate entries, two Civilization II entries and THPS2. The committed manifest already contains the Silver Edition ZIP and all 19 interactive extraction steps. The initial stale-ISO assertion was in the old CLI source, not this committed manifest.

The candidate source therefore stands alone against its committed manifest for the focused source-pin/selection contract: committed-manifest selected dry-run and trimmed/deduplicated list both pass. This corrects the donor README's claim that its immutable manifest should reject the stale ISO. There is **no dirty-manifest integration prerequisite for this source repair**. No current-main or gameplay acceptance is claimed, and the supplied dirty manifest was never changed, staged or published.

## Minimal repair and reproduction

Pin the complete authorized ordered extraction recipe, including the legitimate companion copies and configuration step after index 2, or enforce an equally exact explicit suffix contract that rejects executable/source replacement. Preserve all existing exact URL/SHA-1/type/executable checks. Add rejecting controls for appended and redirected suffix steps on both relevant manifest inputs. Production repair belongs to a subsequent authorized owner; this evidence branch changes only this review directory.

Reproduce from this candidate-based evidence branch with the authorized readonly fixture present:

```sh
NODE_OPTIONS=--max-old-space-size=192 \
TMPDIR=/tmp/corpus-source-pin-independent-accept-oct26/tmp \
node --max-old-space-size=192 \
  test/reviews/corpus-source-pin-independent-accept-oct26/challenge.js
```

Use `guard.py` for the retained resource/timeout/capture controls. `CORPUS_READONLY_FIXTURE` and `CORPUS_REVIEW_OUTPUT` may select existing fixture/output locations; hashes remain mandatory. The command intentionally exits 1 for the three unchanged counterexamples. No need to repeat the donor's passed 22 checks (18 rejections), real selected-THPS2 dry-run or 26-payload/remote verification: their exact receipts are reused here. Node startup uses the same executable, heap flags, environment and limits as the challenges; Git's 512 MiB DATA limit applies only to Git subprocesses.

Remaining prerequisite: repair the suffix identity hole, independently accept that changed candidate, then have the coordinator assign serialized integration against its actual target tree. This worker has no main ownership, workers, deployment or assigned box; lifecycle remains with the coordinator. Initial inspection excerpt overruns are retained as procedural incidents and did not affect executed tests.
