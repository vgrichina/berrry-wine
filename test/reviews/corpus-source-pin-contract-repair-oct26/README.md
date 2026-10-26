# Corpus original-source pin repair

The CLI corpus contract rejected the authorized current Baldur’s Gate interactive-demo manifest before selecting THPS2: it still required BG Demo.iso / SHA-1 3796defce51a3e867aa216bc27f0be0689fdadf0. The source now pins the exact Silver Edition ZIP / SHA-1 df6c2f77e4879bd25955a63d40e9b3a5bbc4c1b7, archive type, isolated fixture, MinimumData executable, and ordered raw-CD → cabinet → preserved-executable preparation. Existing package-count, other source pins, local-only and full companion-tree assertions remain ahead of selection. Selection/skip/run code is unchanged.

Base source is immutable 6aaf65235f367beb610931be83b4b1268ef35ad7. Its manifest SHA-256 is 25d9dc55241ad3e80b42d71986c4cf147e4e09c2c1370190d14fd0402b4cf4eb. Acceptance deliberately uses the independently supplied dirty user fixture SHA-256 212be4a27b33cbd8f675fdef80d13bbea45d3d81aa8e3e643a26edbde6e924bd. The manifest is not part of this commit. Applying only this test repair to the old immutable manifest is expected to reject the stale ISO; integration must preserve the authorized supplied manifest.

## Validation

- Original selected THPS2 dry-run: exit 1, exact URL/SHA-1 mismatch, preserved in reproduce-selected-thps2.log.
- Repaired real selected THPS2 dry-run: exit 0, one local executable, zero blocked/skipped/harness failures. Existing 39,850,365-byte THPS2 tree was referenced read-only from its standing location, never fetched/copied/reinstalled; all eight input hashes verified.
- Pure regression: 22 passing checks, including 18 rejecting mutations. It runs the actual CLI source in isolated Node probes with real exit handling, injected cloned manifests, a 90-byte synthetic x86 PE, and fatal compiler/guest hooks. Changes to URL, hash, old URL+hash pair, extra package, package type, fixture, executable, data-track, cabinet, extraction group/destinations/order, local-only and companion mounts all reject even when only THPS2 is selected. Four positive/usage checks preserve selected dry-run, trimmed/deduplicated list, unknown-ID exit 2 and selected missing-fixture skips.
- Source syntax and focused diff whitespace checks pass. The final regression executable parses and completes successfully; its .test.js name follows the pure-unit convention.

Reproduce with the authorized current fixture available at its normal path:

```sh
node --max-old-space-size=192 test/cli-corpus-source-pin.test.js
node --max-old-space-size=192 test/test-cli-candidate-corpus.js --id=thps2-demo --dry-run
```

The pure regression also accepts `--manifest=/absolute/path/to/authorized/manifest.json`; it never writes that fixture. The real dry-run reads the normal manifest and needs the existing local THPS2 executable. The retained supervise.py enforces 120 s wall, 90 s CPU, 24 MiB file, 2 MiB output, task memory/disk checks, and Git-only 512 MiB DATA limits. Node startup demonstrates unlimited DATA/address space and the intended 192 MiB old-space setting; this is not a total RSS cap. Trusted Git SSH identity and known-hosts settings are retained without credentials. No mount argv exists because no guests or mounts are executed.

## Scope and handoff

Only source test, pure regression and these review artifacts are published. No manifest/app/TODOS/main/service edits, builds, guests, game acquisition, workers, box actions or deployment. Initial oversized inspection excerpts and one pre-execution accounting stop are retained in manifest.json/resource-reconciliation.json. The four reserved clients became live and are charged once by actual RSS, rather than both measured RSS and prospective allowance. All resource floors remain unchanged.

Independent acceptance and coordinator-owned integration remain. This task makes no gameplay claim and has no assigned test box; lifecycle stays with the coordinator.
