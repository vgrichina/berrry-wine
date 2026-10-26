# Persisted companion URL policy, 2026-10-26

Input: `061461fb3e2bd088ccb6ec464ecbe958c83d46ca`, read-only donor `/tmp/file-bundle-bounded-read-accepted-integrate-oct26/repo`.

The proposed suffix-stripping correction is incompatible with the actual default browser mount identity. `host.js:4283` mounts `c:\` plus the literal URL basename; `host.js:4265-4276` folds case and separators without parsing, decoding, or dropping query/fragment text. `lib/filesystem.js:332-355` also preserves these characters. `lib/browser-shell.js:3533` applies the policy and lines 3563-3569 pass its files to `loadFiles` (with a separate verified-local-media snapshot route). See the pinned excerpts and hashes in this directory.

Thus a large app persisting `c:\save.dat` does not persist the default mount of `save.dat?v=1` or `save.dat#fragment`. That entry correctly streams. A declared `vfsPath: 'c:\\save.dat'` or matching `vfsPaths` alias makes it eager. Changing host mount naming would be separate work; it is not authorized here. `extensionOf` stripping suffixes classifies synchronous resource consumers and does not define guest identity.

Only a clarifying comment was added to `lib/app-files.js`. The new seven-group regression fixture executes the actual host `loadFiles` and filesystem `_normPath` methods using stubbed byte IO, without constructing a host or allocating wasm. It covers string/object URLs, case/slashes, query/fragment, encoded text, separators inside suffixes, literal persistence patterns, explicit aliases and precedence, loading declarations, Win16, optout, small/unknown sizes, nonpersisted controls and immutable inputs.

Evidence: the unchanged baseline and commented candidate both pass all seven groups. The retained proposed eager expectation fails twice on the unchanged baseline. A temporary suffix-stripping mutant fails two contract groups (five pass); it was restored and never committed as production code. The existing policy and INI suites pass unchanged. This is contract preservation, not a claimed baseline-fail/repair-pass behavior fix. First fixture/setup failures are retained in ops and summarized in incidents.json.

Every Node invocation used a 30-second timeout and a 16 MiB heap, one process at a time. No runtime, guest, gameplay, full build, service, deployment or integration test was attempted. No box assigned; lifecycle remains coordinator-owned.

Recovery: the branch contains the fixture, comment and compact evidence; ops also retains the baseline module and rejected mutant. Recreate only the focused paths listed in admission.json at the pinned input, apply this branch, then run `timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 test/app-files-persist-url-policy-oct26.test.cjs`, `timeout 30s node --max-old-space-size=16 test/test-app-files-policy.js`, and the analogous `test/test-app-files-ini-set.js` command. The INI suite additionally needs the pinned lib/apps.js. Main integration and any host mount naming change remain separate coordinator decisions.

Committed failure logs trim trailing whitespace only; original byte-exact logs remain in ops.
