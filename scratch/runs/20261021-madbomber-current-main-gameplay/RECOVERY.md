# Mad Bomber qualification recovery

`evidence.tar.gz` is the sealed remote evidence bundle (11,965,531 bytes,
SHA256 `22121970add638c66203d278b55ee734f668abf36a389cdec2c9c901298d673c`).
Run `python3 -B verify.py` beside it. It includes all 33 scheduled captures,
two final captures, launch/input/terminal receipts, controllers, source and
dependency manifests, prior build seals/log/exit, and the exact tested module.
The verifier validates bytes and recorded input acknowledgements; visual
catch/scoring acceptance is the documented human review, not an OCR assertion.

For recovery, extract into a fresh directory and obtain exact Git source
`72e7a30d6e36df896eb25007b6139d750e715720`. Keep full source/build/dependencies
remote under the coordinator host reserve policy. Install dependencies with
`PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=optional`; compare package lock,
environment and dependency hashes. No browser qualification is implied.

The original archive remains at the coordinator checkout's
`scratch/runs/20261020-madbomber-native-qualification/original-assets.tar.gz`:
3,069,702 bytes, SHA256
`b5353b73674a1af6109cb9bf3af5f7d0383308b7ef0b47d52139813ba3ee98ef`.
Do not delete or redownload it. Restore its 140 `original/` files and
`dependencies/msvcrt.dll` beneath `test/binaries/candidates/madbomber/`.
Restore the 27 boot files from the retained coordinator paths named by
`preflight.json`; compare all 168 hashes before launch. No substituted DLLs.

The accepted module is `provenance/wine-assembly.wasm`, SHA256
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
Its canonical build source was `30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`.
The sealed complete manifests prove all relevant production/build inputs
unchanged at tested main; only docs/evidence/status and unrelated Army Men
observer/test files differ. Do not reuse this conclusion for later revisions.
If rebuilding, use `bash tools/build.sh`; retain fresh logs/module identity.

The launch route and ordinary input plans are in each run's `launch.json`
and controllers; output paths require a new directory on replay. Two runs
were consumed by this task; this recipe does not authorize a third run.

Box `bx_jh469zy9` remains RUNNING, API state idle/health ok, expiry
2026-10-21T18:26:26.518Z. Source `/home/user/madbomber-source`, evidence
`/home/user/madbomber-evidence`, archive `/home/user/madbomber-evidence.tar.gz`.
Both guest groups are absent. Coordinator owns shutdown and subsequent work.
