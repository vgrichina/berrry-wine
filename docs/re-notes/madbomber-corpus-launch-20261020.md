# Mad Bomber private corpus launch

The `madbomber` registry and candidate IDs refer to the original release tested
in the [accepted report](madbomber-after-midi-original-20261020.md), integrated
at `aaf8599291b278b5cf1b9e53c654b5bb8cd5dfe6`. Registration is source-checked;
it is not another execution or browser qualification. The private EXE corpus
offers its launch link only when the registered files exist in the served
emulator checkout. No assets are bundled or publicly promoted.

## Recover the files

The prior remote `/home/user/madbomber-native-assets` directory is ephemeral.
Its presence is not asserted here. Restore these paths in the emulator checkout:

| Retained archive member | Repository destination |
| --- | --- |
| `original/*` (140 files, including the EXE and seven DLLs) | `test/binaries/candidates/madbomber/original/*` |
| `dependencies/msvcrt.dll` | `test/binaries/candidates/madbomber/dependencies/msvcrt.dll` |

The retained archive is
`scratch/runs/20261020-madbomber-native-qualification/original-assets.tar.gz`.
Its `original-closure-required.json`, `local-closure.json` and
`prepare-original.py` record provenance, recovery and SHA-256 identities.
Do not run that historical remote preparation script as part of registration.
Restore locally only when authorized and sufficient space is available.
If the archive is absent, the recipe is evidence of what is needed, not a
replacement download or a claim that recovery succeeded.

Compare every restored file against
`scratch/runs/20261020-madbomber-after-midi-original/closure.json`: replace
the `/home/user/madbomber-native-assets/` prefix with
`test/binaries/candidates/madbomber/`. The remaining 27 pins describe shared
boot assets under the tested source checkout; preserve their repository-relative
paths and compare them as well before reproducing that run. The accepted report
records the exact source/module identity and canonical build recovery linkage.
An available route does not establish that a different module is the tested one.

## Launch and evidence

After restoration, the registered command preserves the recorded guest EXE path,
working directory `C:\MADBOMBER`, all 140 original VFS mappings and eight DLL
seeds, including the separately recovered MSVCRT:

```sh
node test/run.js --app=madbomber --no-build --quiet-api --no-close \
  --no-threads --real-ticks --time-scale=1 --real-calendar --tz=UTC \
  --batch-size=200000 --max-batches=10000000 --max-seconds=10 --control-stdin
```

Use the accepted module only after verifying its SHA-256
`11aee57cb158ffd734534b97aef9c36e3152aec660c8371d609a771e4eee9a5f`.
Exact original vectors (including explicit module path and tracing), ordinary
input controls and images remain in
`scratch/runs/20261020-madbomber-after-midi-original/`:

- `result.json`, `launch.json`, `input/launch.json`, `closure.json`
- `final.png`: menu
- `input/sample-5s.png`, `input/sample-9s.png`: One Player and bucket movement
- `input/output.log` and controller receipts: Enter down/up at 3/3.15 seconds,
  mouse moves to (180,400)/(460,400) at 5/7 seconds

The original result has `candidateId: null`; it remains untouched historical
evidence. Registration does not relabel it as a new passed dashboard capture.
Only menu, One Player entry and bucket movement were accepted. Bomb drops,
catches/scoring, sustained gameplay, audio, FPS and browser execution remain
unqualified. The private browser route is an experimental way to use the
registered closure, not a verified browser result.

## Independent integration review

Candidate `a65c786fbcbb8bbfe8917834eacd7d7ec3d742c4` was reviewed against
remote main `aaf8599291b278b5cf1b9e53c654b5bb8cd5dfe6`. All 140 ordered
file mappings and eight DLL seeds match the accepted input launch. All 141
asset pins agree with the original recovery manifest, and every retained
archive member was read without extraction and SHA-256 checked. The archive
SHA-256 is `b5353b73674a1af6109cb9bf3af5f7d0383308b7ef0b47d52139813ba3ee98ef`.
All unrelated registry exports and candidate manifest entries are unchanged.

The three checks in `node --test ops/madbomber-corpus.test.js` pass.
Separate process controls removing a mount, changing the working directory,
and adding a public desktop entry each fail with an assertion. The actual
sparse catalog reports 141 missing files, unavailable status and a null URL;
no assets were fabricated. Recovery and accepted evidence links resolve.

Review evidence and the JavaScript replay are retained in
`scratch/runs/20261020-madbomber-corpus-review-integrate/` (`review.js`,
`validation.json`, baseline and mutation logs, candidate patch and publication
receipt). The review wrapper initially expected TAP formatting from Node's
default reporter; that output-format assertion was corrected without changing
the candidate tests. This review ran no runtime, browser, build or remote
tests and adds no gameplay qualification. Remote asset availability remains
unchecked. Registration remains private only.
