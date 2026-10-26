# Independent decision: ACCEPT

Exact candidate: `52b7bb0e9e73fc839344c33f00cffa2c638fc193`, branch `task/app-files-persist-url-policy-repair-oct26`. This is the first independent acceptance. Acceptance covers the new regression assertions and the comment preserving literal default URL basename identity. It does not claim a production behavior repair or general parity for every manifest shape.

The three supplied SHA-256 pins match immutable candidate blobs recovered from the read-only donor. Removing only the three added comment lines yields the byte-exact parent `lib/app-files.js`. Host code was not changed. The independent fixture executes the actual entire `loadFiles` method extracted between its unique method header and the following `loadDlls` header. The 16,464-byte excerpt hashes to `5fbb544b0f29130c90f2c14685e979bdfa40caaf43dfeb4d6181a26e62933659`. Its transport returns one local byte; no network or host constructor is involved. Guest names come from the resulting real VFS map, not a copied URL naming algorithm.

The supplied seven groups pass. Seven new independent groups pass, covering string/object URLs, query/fragment, encoded names, case, slash/backslash including suffix separators, relative/drive explicit aliases, nonempty alias-list precedence, anchored persistence glob boundaries, eager extension classification, the exact small-app threshold, Win16 and unknown sizes. A bounded in-memory object-default suffix-stripping mutant disagrees with real mount identities for both query and fragment; the fixture asserts those disagreements. Changing the URL passed to the actual host by stripping its suffix also produces a different real mounted identity. Suffix stripping is correctly rejected as a persistence-policy correction under this host contract.

One pre-existing boundary is explicitly retained: `vfsPaths: []` falls back to `vfsPath` or the URL basename in the host, while policy `vfsPathsOf` returns an empty list. For `{url:'Data/Save.bin#part',size:1,vfsPaths:[]}`, the host mounts `c:\save.bin#part`; with that persistence pattern the policy still sets `httpRange:true`. With an additional `vfsPath:'D:/Save.bin'`, the host mounts `d:\save.bin` and policy still streams. This is unchanged parent behavior, does not falsify any new supplied assertion (all alias arrays there are nonempty), and is outside the scoped comment-only acceptance. A claim that all alias shapes agree would be false. Any repair needs its own coordinator assignment; none was made here.

The historical baseline seven-pass, proposed eager expectation two-failure, suffix mutant two-failure, existing policy-pass and recovered INI-pass receipts are reused, identified in `reused-receipts.json`. Those suites were not rerun. The first independent-fixture error is preserved in `independent-first.txt` and explained in `incidents.json`; it concerned an invented return-value assertion, not a naming mismatch.

Remaining gate: coordinator review, reconcile against current main and integrate separately. No main integration is authorized here. No runtime/gameplay, browser, service, deployment, wasm compile, guest, Boat or SSH guest attempt was made. No box assigned: ID/state/expiry are N/A and lifecycle remains coordinator-owned. No workers launched; Claude idle.

Recovery: use the exact candidate's immutable `host.js`, `lib/app-files.js`, `lib/filesystem.js`, `lib/browser-shell.js` and supplied fixture, plus the independent fixture from this review branch. Run each command sequentially in the focused checkout:

```sh
timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 test/app-files-persist-url-policy-oct26.test.cjs
timeout 30s node --max-old-space-size=16 --test --test-concurrency=1 test/app-files-url-contract-independent-oct26.test.cjs
```

`checkpoint-tests.json` binds exact tested inputs, fixture hash, group outcomes and remaining gates. `evidence-manifest.json` hashes all other review payloads. Publication SHA and exact trusted `ls-remote` verification are retained in `/tmp/app-files-url-contract-independent-accept-oct26/ops/publication.json`, final `result.json`, and the root append-only messageboard. Donor objects are standing read-only inputs; no full checkout or history fetch was performed.
