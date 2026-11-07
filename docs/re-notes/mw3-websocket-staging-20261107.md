# MW3 DevTools endpoint staging repair — 2026-11-07

The retained original browser driver now waits for a complete valid Chrome
DevTools endpoint before serializing it or constructing its WebSocket. The
original partial-file startup fails before the repair and passes afterward
through the same browser driver, CDP handling and native Chrome launch. No
original MW3 runtime, boat allocation or gameplay qualification occurred.

Evidence and retained successor preparation:
`scratch/runs/20261107-mw3-websocket-staging/`.
The published reusable parser/waiter is `tools/mw3-devtools-endpoint.cjs`.
The repaired run-only `browser.cjs` imports it; predecessor files are untouched.

## Exact failure and repair

The released predecessor note is
`docs/re-notes/mw3-repaired-worker-gameplay-20261107.md`. Its recovered
`original/endpoint.json` is exactly `{"debugPort":0}` semantically, and its
terminal stack records `Invalid URL` at `browser.cjs:76`,
2026-11-07T14:19:59.103Z. Chrome stderr advertises port 37039 and browser ID
`5798763a-414a-491d-af73-44af624caf24`. Exact terminal text, lengths and hashes
are retained in this run's `predecessor-terminal.json`.

Discovery previously polled only `existsSync(DevToolsActivePort)`, then read,
trimmed and split once. An empty read supplies an empty port and undefined
path: `Number('')` serializes as zero, JSON drops the undefined browser path,
and concatenation constructs `ws://127.0.0.1:undefined` for that empty-port
case. A partial Chrome write therefore explains both retained observations.
The deleted historical file's bytes cannot be recovered; the race remains an
inference, reproduced deterministically rather than asserted as observed bytes.

The new helper rereads until it has exactly two valid lines: decimal port
1–65535 and `/devtools/browser/<uuid>`, including the complete UUID length to
reject a path truncated during Chrome's write. It accepts CRLF and Chrome's absent final
newline, rejects malformed paths/ports/extra lines, checks Chrome exit, and
stops at the earlier of ten seconds or the immutable browser deadline. Only a
valid endpoint is published. A persistent malformed/missing endpoint reports
the reason and that no WebSocket was attempted. No CDP operation is retried.
Early cleanup skips page/save reads when no CDP page exists, preventing pending
CDP work during startup failure. Browser/server/profile cleanup still runs.

## Focused evidence

`verify.cjs` stages the retained generated-support closure using individual
read-only pinned references in an isolated root, without copying source or
media. Only explicit pinned realpaths can extend the test server boundary.
Small run-specific helpers and the generated 8,704-byte PE are retained inputs;
temporary isolated roots were removed after cleanup verification.

- `before-partial`: an injected empty first visible file read reproduces
  port-zero/no-path JSON and the exact WebSocket `Invalid URL` construction.
- `after-partial`: empty and port-only reads precede the real Chrome file;
  validation waits, then attaches once and boots the production guest Worker.
- `after-normal`: unmodified Chrome file discovery and production Worker boot.
- `after-malformed`, `after-missing`: persistent fault, clear terminal error,
  no serialized endpoint or CDP attach, Chrome exit 0, both ports closed,
  Chrome PID absent, profile removed, zero commands/input.

Passing support guests use the ordinary unmodified production index/scripts,
normal threads setting and WineAssembly init/loadExe. Ordinary generated x86
writes marker `0x26071137` in the actual production Worker. Repeated Worker
CDP reads match the page process 1000, endpoint 1, slot 0 and marker, with page
owner recheck. Recovered executing module bytes match the staged 2,182,493-byte
WASM, SHA-256
`e41511fe861363fbe1639d80f20cbcdd7240f46937c93a801eaa256ca094c467`.
No page guest execution, substitute module, guest/config/clock edit or
cooperative-fallback acceptance is involved.

`verify-launch.cjs` additionally executes the exact retained predecessor
remote `boot.py` body with only root/run path literals relocated. Python
`Popen(['node', run/'browser.cjs'], cwd=root, start_new_session=True)` constructs
the original immutable 25-minute deadline and launches the driver's unchanged
Chrome flags, including port zero. `after-launch/` proves production Worker
execution through that CDP connection and one exact numbered quit ACK through
the unchanged `transport.cjs`. Native input is empty. The remote sandbox API
itself was not called or qualified. There is no Playwright or alternate local
CDP boot helper in this proof.

Final UUID validation also passes that same retained Python launch body in
`after-final-launch/`: 61 readiness reads include empty, port-only and a UUID
missing its final character before the complete real endpoint. Only the full
endpoint is serialized and attached. All 36 truncated UUID prefixes are
separately rejected by `unit.cjs`. The explicitly recorded helper pin update is
`explicit-uuid-pin-change.json`; earlier helper bytes remain recoverable from
`endpoint-initial.patch`. No other staged input changed.

An earlier `after-transport` test also completed correctly; its harness assertion
initially omitted the ACK client's additive `number:0`. The assertion was fixed
and the already-completed browser's exact reply/cleanup validated without replay.
The subsequent exact-launch proof passed that corrected assertion directly.

All successful HTTP bodies in the three first passing cases match pins:
194 responses / 177 unique paths per case, including production Worker imports
and all four previously missing generated/vendor inputs. All 33 genuine
original registry HTTP bodies match. Optional missing deploy identity, auth,
icons/favicon and font-bundle optimization remain classified 404s; individual
fonts succeed. Genuine MSVCP50, Mech3Msg, media and normal config retain their
existing path/length/SHA pins. No media/source archive is retained.

`unit.cjs` covers malformed input, CRLF/no-final-newline, read errors, dead Chrome
and expired deadline. The focused real Chrome cases, closure/body checks,
successor preparation (304 pins and identical driver bytes), Python syntax and
`flock /tmp/wine-build.lock bash tools/build.sh` passed. Chrome is
151.0.7922.108 / V8 15.1.206.16. Runtime source SHAs are recorded in
`runtime-pins-initial.json` and `runtime-pins.json`; relevant binary patches,
including the untracked `lib/wininit-boot.js` input, preserve noncommitted source.
The locked build retained the tested WASM hash. Sampled minimum free disk was
2,773,823,488 bytes; this is sampled evidence, not a continuous guarantee.

## Successor command

After separately authorizing a fresh original attempt and owning its new run:

```sh
node scratch/runs/20261107-mw3-websocket-staging/prepare-original.cjs scratch/runs/NEW_OWNED_RUN_ID
```

This only prepares the same tested driver/helpers and a 304-file
`runtime-pins.json`, including the published endpoint helper and pinned `boot.py`.
It rejects pin drift; never silently refresh pins. Provision those files
individually through the retained original provisioner/remote transport, upload
the new manifest too, and verify every remote SHA/length. Then execute remotely:

```sh
python3 scratch/runs/NEW_OWNED_RUN_ID/boot.py
```

The launcher strips test-only environment options and preserves the normal
original route, `/index.html?debug&candidates&no-log&gl-renderer=webgl&app=mw3`,
2 GB guard, 25-minute deadline and native command transport. The generated
support proof is opt-in and exits before original navigation. The 18 strict
live owner/module/window/epoch fields, fresh immutable pixel review, exact
numbered ACK, independently scheduled UP and sticky UNKNOWN/no-replay gates
are byte-identical in their retained helpers. No capture/PBO/input matrix was
repeated. Fresh original pixels and gameplay remain the successor's work.

Box ID/state/expiry: none; no lifecycle ownership was taken or changed.
