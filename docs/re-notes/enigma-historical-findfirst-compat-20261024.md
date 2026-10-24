# Historical Enigma FindFirst compatibility (2026-10-24)

`tools/enigma-findfirst-compat.cjs` applies the independently accepted main
matcher to the exact retained historical filesystem during CommonJS compilation.
It reads the matcher span from the hash-verified `lib/filesystem.js` beside the
adapter. There is no second matcher implementation or source fallback. The
complete transformed filesystem must equal the accepted source hash, proving
every byte outside that replacement remains unchanged. Original files stay intact.
Ordinary import without its environment variable does not install the adapter.
Explicit preload without an absolute runner root fails closed.

Inputs are recovered by named read-only `git show` from immutable donor
`/tmp/enigma-findfirst-independent-integrate-oct24/repo`, HEAD
`f879fd0cd81d918ea54a18b1b222fae25dd6d618`. Historical revision is
`d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`:

| Source | Bytes | SHA-256 |
| --- | ---: | --- |
| Historical test/run.js | 685960 | 4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809 |
| Historical lib/filesystem.js | 157994 | 4c255570c74512262849420c74fe73704fcfe006dc09fb963272c66c9ea0b27e |
| Accepted main lib/filesystem.js | 158109 | 542ecac68e15882d9f5455e89c2c92198d3e3042b53b599b29706a6668fcb3b1 |
| Main tools/enigma-quiet-filesystem.cjs | 2283 | cc9bb22fb39058b581883f836724f7a62eaf8dfbe2d2e42f3cd765f3abd8741e |

The adjacent evidence includes complete compressed historical sources and exact
historical `mem-utils.js`, `region-map.generated.js`, and `byte-provider.js`.
These are actual transitive VFS dependencies, not substitute implementations.
`source-identities.json` binds every retained file to its Git revision and hash.
No runner execution or WASM/native instantiation is needed to test the VFS.

## Validation and composition

Run from this checkout after the task's resource admission:

```sh
timeout 60 node --max-old-space-size=256 test/test-enigma-findfirst-compat.js
```

The focused test decompresses the actual retained sources into a temporary tree,
loads the adapted historical exported VirtualFS through the real preload, and
runs the unchanged accepted `test-vfs-findfirst-literals.js`. This checks literal
punctuation, near misses, wildcard operators, case, slash/relative paths, roots,
dot records and metadata-only enumeration. An additional real-VFS check verifies
size123, archive attribute0x20 and creation-time metadata without reading bytes.
The complete adapted source equals accepted main byte for byte.

The unchanged regression rejects the historical baseline with the leading-plus
SyntaxError and rejects a real adapted-source end-anchor deletion with an
assertion failure. Wrong runner/filesystem/accepted identities, missing/duplicate
matcher anchors and reversed anchor order are rejected. Ordinary disabled import
leaves the compiler hook unchanged. The existing filename classifier places this
test in unit; no central tier edit or global census is required.

**Supported preload order: FindFirst first, quietFS second.** The real VFS
regression passes in that order. A compiler-boundary test also captures the
entire transformed historical runner and confirms it equals quietFS's own
transformation, while the filesystem equals accepted main. It does not execute
the captured runner. quietFS first then FindFirst is explicitly rejected during
preload, before a sentinel entry script executes. quietFS validates the original
historical source before forwarding it, so it must wrap the FindFirst hook.
Its source is unchanged. Third-party adapters require their own composition
qualification; this task makes no terminal captureguard composition claim.

Executable next-use **offline** command with the retained local task inputs:

```sh
TASK=/tmp/enigma-historical-findfirst-local-source-oct24
ENIGMA_FINDFIRST_RUNNER_ROOT="$TASK/historical" \
ENIGMA_RUNNER_ROOT="$TASK/historical" \
timeout 60 node --max-old-space-size=256 \
  --require="$TASK/repo/tools/enigma-findfirst-compat.cjs" \
  --require="$TASK/repo/tools/enigma-quiet-filesystem.cjs" \
  "$TASK/repo/test/test-vfs-findfirst-literals.js" \
  "$TASK/historical/lib/filesystem.js"
```

For a future coordinator-authorized guest, use these two environment variables
with the same canonical complete historical runner root and these preloads in
this order before its `test/run.js`. The local recovered tree contains only the
focused sources needed here, not the full guest closure. Validate the future
actual mount argv with the canonical parser, including comma-bearing names,
and pass fresh runtime/resource/lifecycle admission before any guest attempt.
No guest mount argv exists in this offline task.

## Evidence and limits

The actual prior startup report records PNG capture rejection at batch30000
before the filesystem SyntaxError at44896. This compatibility adapter addresses
the latter source mismatch only. Startup, frame, menu, gameplay and immediate
capture-rejection stopping remain unaccepted. The other worker owns terminal
captureguard. No capture, generic diagnostic, production filesystem or runner
source was edited. No box is assigned; lifecycle remains coordinator-owned.

Initial projected allocation was39241901/67108864 bytes, including all focused
Git/source/temp/evidence, full external session/events, positive SQLite/history
growth allowances, future growth and8MiB reserve. The transitive-source adjustment
fits the existing6MiB temp/evidence allowance and retains all failed receipts.
Installed Node/Git and immutable donor objects execute/read in place. Node heap
is256MiB, CPU/wall60 seconds; children check fresh MemAvailable>=805306368.
Host free after projected incremental growth must remain>=2982150144.

Initial test receipts retain the missing transitive dependency diagnostic, the
incorrect expected attribute0x80 (actual existing archive attribute0x20), and the
mutation-control selection error (an earlier unrelated end-anchor occurrence).
The final mutation targets the extracted matcher span and the unchanged oracle
rejects it. These are fixture/control corrections, not changes to production
semantics or the accepted oracle.

Adjacent evidence retains final test commands/results, exact identities and
admission/adjustment receipts. Task root retains final scoped diff, publication,
resource/history/capture accounting and cleanup. Publication is only to
`task/enigma-historical-findfirst-local-source-oct24`, with strict supplied SSH
and actual remote SHA verification. No main merge, full build, acquisition,
guest/browser, native/WASM instantiation, box action or worker launch occurred.
