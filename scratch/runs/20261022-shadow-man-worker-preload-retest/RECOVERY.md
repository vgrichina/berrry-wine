# Evidence locations; no additional run authorization

Local task checkout `/home/user/wine-assembly-shadow-man-worker-preload-retest-oct22`,
branch `task/shadow-man-worker-preload-retest-oct22`, source base
`a0236c978074ece58495c9eab7db6168e27e71b4`.
Evidence is `scratch/runs/20261022-shadow-man-worker-preload-retest/`.
Run `python3 verify.py --self-test` there for evidence-only verification.
It launches no guest and does not access the box or fetch Git objects.

Same running box bx_495585da, expiry20:13:56.453UTC, coordinator shutdown19:50:

- Existing immutable originals/module/support/codec remain unchanged under
  `/home/user/shadow-man-tools-ready-oct22`.
- Full predecessor inactive copy is
  `/home/user/shadow-man-tools-ready-oct22/inactive-evidence/shadow-man-quota-bounded-runtime-oct22`.
  `preservation.json` contains all93 hashes, including all80 original parent
  export files. This resides outside tmpfs, inside existing2GiB recovery cap.
- New attempt is
  `/home/user/shadow-man-bounded-runtime/shadow-man-worker-preload-retest-oct22`.
  Full logs/observer/PNG/partial74-file parent export remain remote. All small
  runtime artifacts are copied under local `raw/`; no guest payload was pulled.
  The new partial export is not a complete recovery source.
- Offline cases are sibling `offline-original`, `offline-guarded-authority`,
  `offline-guarded-fork`, `offline-negative-guard-removed` directories in the
  same tmpfs. Their API/JSONL/PNG receipts are retained locally in offline JSON.

New tmpfs evidence is volatile at shutdown. Important new logs, image and
all-file hash inventory are committed; predecessor generated payload bytes
are preserved in the ordinary inactive recovery copy. No repack or quota change.
All mutable new guest paths stay in the existing144MiB tmpfs. The guarded
observer is diagnostic evidence only and has not changed production source.

The focused Git store omits unrelated blobs. `commit-evidence.py` preserves
existing tree IDs and appends only this evidence subtree using `mktree --missing`
and `commit-tree`, with `GIT_NO_LAZY_FETCH=1`; publication uses a normal task
branch push, no force. It is not a broad checkout or implicit-fetch recipe.
