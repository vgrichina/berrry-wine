# Independent empty-alias acceptance: ACCEPT

Candidate `e9f3142b68816c6512d65db132ea43ba4e8c36ca`, base `52b7bb0e9e73fc839344c33f00cffa2c638fc193`. Acceptance covers the narrow empty-alias fallback repair. No production change, integration, browser or gameplay claim.

The guard in `lib/app-files.js:86` now agrees with actual `host.js:4278-4283`: a nonempty array wins, otherwise a truthy explicit path wins, otherwise the literal URL basename becomes the guest name. Host normalization at `host.js:4268` and policy normalization at `lib/app-files.js:91` preserve case-insensitive slash matching. Persistence testing at `lib/app-files.js:170` keeps matching declarations resident. Query and fragment text remains guest identity; only extension classification strips suffixes. Nonempty aliases retain priority over both fallbacks. Explicit loading declarations remain authoritative even for persisted matches; optional does not mean eagerly required.

## Fresh evidence

- `supplied-final.txt`: unchanged final supplied fixture, 7 PASS. Its SHA-256 remains `d82afe0a3ccf1fc2c047e2b53a6ff69e94d315985e4772e66d554bd9f6497d1a`.
- `independent.txt`: new independent fixture, 8 PASS. It executes the complete pinned actual host `loadFiles` method, with one-byte transport and bounded provider seams. Independent explicit guest-name oracles also check actual host map keys, eager byte fetches, lazy provider mounts, optional 404 handling and no retry, aliases sharing one fetch/provider, explicit declarations, glob/case/slash matching, literal suffix/comma names, empty/falsy/absent fallback inputs, frozen metadata and nonmutation. No handwritten replacement for the host mount-path algorithm.
- `reject-guard.txt`, `reject-priority.txt`, `reject-suffix.txt`: each targeted in-memory mutation runs one selected test and fails at the intended matching-persisted-path assertion (exit 1). Guard mutation restores the exact old condition; priority mutation suppresses aliases; suffix mutation strips object URL query/fragment text. Candidate files remain unchanged.

The host method extraction is uniquely bounded by its loadFiles header and following loadDlls header: 16,464 bytes, SHA-256 `5fbb544b0f29130c90f2c14685e979bdfa40caaf43dfeb4d6181a26e62933659`. Human inspection used 6,000/6,000/4,464 byte pieces. Full host/source pins are in `source-pins.json` and `input-review.json`. Source pins and fixture hashes are checkpointed for every test group.

## Reused evidence and provenance

The exact final baseline is reused, not rerun: `raw-baseline-empty-final.txt` has 5 PASS / 2 FAIL with raw SHA-256 `3581cd535bb5efb1d4342983a6327bc1d8e05642f0c35371659d1d9eed68d321`; committed counterpart SHA-256 is `ea5d56c01ebe1ad91069aff4b1a9d118fc496ee3e56ca46f0ff1514a461ad351`. They are distinct byte identities. The same final fixture hash and baseline source hash are verified in `input-review.json` and `donor-checkpoint-tests.json`.

`provenance.json` verifies all 24 donor committed manifest payloads and retains raw/committed identities. Four failure logs differ solely by trailing whitespace removed before commit. The earlier session records the exact normalization operation at lines 42/43; bounded excerpts and source identity are in `normalization-provenance.json`. Both raw and committed logs are retained byte-exact here. Original checkpoint hashes refer to raw ops logs, not normalized committed copies. The postpublication ops checkpoint additionally has final commit/tree/publication/status fields absent from the committed prepublication checkpoint; this metadata change is recorded separately, not called whitespace normalization. Historical test-group candidate labels retain the then-HEAD base; repair source hashes identify the tested working tree. Final candidate blobs independently match all seven published source/fixture pins.

The original independent fixture matches immutable review `2ff9d314807c517a2338233021ac75132dc7c949`, read directly from its existing readonly repository. The wrapper verifies original SHA-256 `9109256868d2eb66ff936072b897220ca42f99577f25a885ff0dc51b554b9677` and has exactly three unique replacements: old source pin, boundary title and assertion expecting the repaired boundary. Other assertions, including suffix mutation rejection, remain. This is an adapted regression receipt, not fresh acceptance. Its original unadapted two failures remain preserved. Fresh host-backed independent checks support the changed expectation and demonstrate that alias priority and suffix behavior remain observable. No concealed repair defect was found within this bounded scope.

Supplied URL regressions (7 PASS), adapted prior independent regressions (7 PASS), existing policy PASS and INI receipt are reused without duplicating unrelated suites. All 11 original raw group-log hashes are verified. INI helper-through-exports and its pinned test/apps inputs remain byte-exact at base/candidate.

## Recovery and limits

Use a focused checkout of this task branch with `host.js`, `lib/app-files.js` and both empty-alias fixtures. Installed Node is executed in place; borrowed donor objects are readonly standing inputs. Run serially from repo:

```sh
timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 test/app-files-empty-alias-fallback-oct26.test.cjs
timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 test/app-files-empty-alias-independent-oct26.test.cjs
APP_FILES_MUTATION=guard timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 --test-name-pattern=independent.empty-list.URL test/app-files-empty-alias-independent-oct26.test.cjs
APP_FILES_MUTATION=priority timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 --test-name-pattern=nonempty.aliases test/app-files-empty-alias-independent-oct26.test.cjs
APP_FILES_MUTATION=suffix timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 --test-name-pattern=independent.empty-list.URL test/app-files-empty-alias-independent-oct26.test.cjs
```

The last three commands must exit 1. Raw logs intentionally retain diagnostic trailing spaces. Resource receipts include focused Git/checkout/evidence/temp/session/launcher bytes, conservative full current positive WAL once, future allowance once and 8 MiB reserve within 64 MiB. No mounts are executed; mount argv/parser applicability is N/A. Trusted Git SSH configuration is pinned in admission and reused for publication. Initial root-ref digest is retained without capturing the listing; no root ref/index/checkout writes or later global-ref comparison, since other agents own concurrent ref changes. Root messageboard is append-only with tail verification.

Inspection incidents: the initial combined fixture/policy read exceeded the 8,192-byte excerpt gate, and a broad provenance search returned a truncated response. These deviations are recorded in `incidents.json`; they are not claimed as passing resource checks. Subsequent provenance inspection used bounded parsed excerpts; actual host inspection used three pieces and fresh test-group logs are each at most 1,550 bytes. Technical acceptance above is based on the pinned executable checks and byte-verified evidence.

Remaining: coordinator review, current-main reconciliation and separately authorized integration by the sole main owner, then browser persistence/runtime/gameplay gates. No build, guest, service, public deployment, Boat operation, worker launch or box assignment. Box ID/state/expiry N/A; lifecycle owner is coordinator. Stop after publication; no refill/resume.
