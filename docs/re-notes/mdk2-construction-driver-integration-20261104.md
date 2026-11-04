# MDK2 original driver integration: trace prerequisite stop

The retained original guarded route has **no armed block trace**. Its passive
instantiation recorder also does not install the published Lua construction
observer. Merely adding that observer to the preload would deliver zero required
boundaries. This assignment stops at that concrete prerequisite; it does not
claim a usable driver/observer composition or a fresh original execution.

The accepted [Lua construction evidence](mdk2-lua-construction-cause-20261104.md)
and [measured Escape/New Game/Medium](mdk2-measured-escape-original-20261104.md)
remain unchanged. No whole-state/native-fragment suite was repeated: its inputs
were unchanged. No browser, game, server, remote API, runtime, box or subworker
was allocated. No input, callback injection, Lua write, deadline extension,
lifecycle action or approval request occurred. Assigned box ID/state/expiry:
NA. Coordinator retains lifecycle ownership. The closed attempt stays closed.

## Exact first blocker

`tools/mdk2-construction-driver-integration.cjs --check` reads the explicit
retained driver closure, validates its full hashes, decodes the original pin
manifest in memory against its retained seal and a fixed SHA, and verifies four
relevant runtime dependencies from Git against their original pins. It does not
substitute today's main sources or freshly built modules. Original execution
source is `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`; observer source is the
unchanged `de6a33f257d93e8814d666bdec62361161569ac4`.

The pinned runtime establishes the missing causal edge:

| Original source | Observed contract |
| --- | --- |
| `src/01-header.wat:3761` | `trace_esp_flag` is initialized to zero. |
| `src/13-exports.wat:476–483` | The only `host_log_block` call is guarded by that flag and the configured PC interval. |
| `src/13-exports.wat:2749–2752` | `set_trace_esp` is the only assignment to that flag. |
| Original `host.js`, `guest-worker.js`, `guest-rpc.js`, `guest-thread-host.js`, actual driver and preload | No `set_trace_esp` configuration exists in this route. |

The original URL is `index.html?debug&candidates&frozen&gl-renderer=webgl`.
`debug` does not arm this trace. The actual preload hashes compilations and
records instantiations **after** `await instantiate`. It records receipt of a
structured-cloned Module but does not propagate the page's byte hash into the
owning main instance or call the observer's `attach`. Thus its instantiation
record is neither a pre-instantiation import hook nor proof of delivered block
history. Editing imports after instantiation cannot repair that missing edge.

The tool returns `ORIGINAL_DRIVER_TRACE_DISABLED`, exit status2, before reading
a runtime release, creating the proposed output directory, loading Puppeteer,
starting HTTP or invoking original `main`/cleanup. It does not turn a caller's
boolean assertion of trace readiness into evidence. Changed retained bytes
fail the closure gate instead of retaining a stale blocker conclusion.

## Actual composition controls

The tool's `compose(absoluteRun)` calls the retained
`main-state.cjs → driver-wrapper.cjs → browser-driver.cjs` chain. Tests compile
that actual composed source, exporting its existing functions immediately
before the sole `main().catch` invocation. No fake driver or replacement Lua
observer is used. Bootstrap is never invoked. Small protocol fixtures are
explicitly labelled offline fixtures, not game captures or personal game reviews.

`node test/test-mdk2-construction-driver-integration.js` passed12 tests:

- Exact15-file retained closure,432-pin manifest and original module references;
  missing dependency and same-length changed actual-driver negatives.
- Positive actual composition compilation and byte identity to the retained
  wrapper output, with unchanged original preload.
- Actual inspection guard plus independent approval/ACK path admits a16-slice
  command and forwards the frozen response to its original output file.
  Missing review, wrong/failed ACK and changed capture reject before dispatch.
- Incomplete slice response rejects; original terminal latch blocks later
  stepping and input. The unchanged main catch that sets that latch is checked.
- Actual CDP attached-Worker handler evaluates the preload before resume.
  An evaluation exception latches failure and prevents resume.
- Actual CLI entry rejects before allocation or output creation.

These are driver/protocol controls. They do **not** qualify an early observer
hook against a late hook, owning module/thread/instance binding, successful
completion/finalizer/dofile/buffer correlation, or an all-Worker observer capture.
Those requested integration tests remain behind the trace prerequisite. The
accepted observer-only negatives in de6a33f25 are not relabelled as driver tests.
The serialized full build also passed; details are in RUN's build log.

## Recovery and next bounded original recipe

Evidence is `scratch/runs/20261104-mdk2-construction-driver-integration/` (RUN).
It contains preparation/tested Git SHAs, the relevant binary diff, owned new
file patches, exact closure manifest, preflight JSON, focused test/build logs
and an inventory. Git is the source archive. No source archives, media or module
copies are added. The preflight reports the retained module paths/full hashes:
canonical `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee`,
compat `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3`.
Media stays at
`test/binaries/candidates/mdk2-demo/installed/mdk2demo/mdk2Main.exe`, SHA256
`b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1`,
and adjacent `data/scripts.zip`, SHA256
`cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8`.

The concrete entry point is:

```sh
node tools/mdk2-construction-driver-integration.cjs --check
node tools/mdk2-construction-driver-integration.cjs --run /ABSOLUTE/FRESH/RUN
```

Both currently stop with status2. The second command is a tested fail-fast
entry, **not a launch-ready recipe**. Do not bypass it by running the closed
measured attempt's launch file. Its actual entry and endpoint preflight remain
referenced in the closure; no old release, approval, identity or ledger is reused.

Before a future separately allocated bounded run, the missing trace phase must
be made concrete: install the observer before the owning main instantiates;
bind the exact transferred Module to independently hashed bytes and that
instance; configure the existing authorized trace with finite interval,
boundary/record/output/deadline limits; prove its delivered boundaries without
inventing callbacks or silently extending original command/output budgets.
Then test early versus late hooks, foreign module/thread/instance, missing
history and terminal first failure through this actual driver composition.

Keep the actual author/operator/next/control chain, repaired measured Escape,
separate personal New Game/Medium reviews, matching ACKs, original command and
absolute deadlines, additive endpoint preflight and construction's input-free
16-slice quantum. Under the existing frozen all-Worker barrier, correlate file
callback cursors with request completion and192320-byte aggregate delta, then
main finalizer/dofile/buffer events and read-only Level samples. Cursor progress
does not establish completion; completion does not establish Lua execution or
gameplay. No completion time or extra slice count is inferred here.
