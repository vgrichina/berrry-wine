# Q2 current browser CPU policy, 2026-11-09

Run: `scratch/runs/20261109-quake2-current-browser-policy-1605/`.
Offline only: no browser endpoint, Chrome, box, native/game retry, input or
native admission was used to establish this repair.

1575 authenticated the current CPU closure but the browser observer still
required primary CPU `a320d4c8…`. The published current primary is
`3e491c0840bb7771328738a0d160b4bbaa3d7ab72074cbd38a7b41e5d7e8ec18`;
the staged compat artifact is
`ecb45716b1ee7fc5218b1670dd270b19c7664ee30d000b3360a12786a1c21eaf`.
The browser observer selects the primary path only. This change does not add
compat browser selection.

The version `quake2-current-primary-3e491c08-v1` selects a new Q2-only browser
provider. The existing opt-in owning Worker imports the observer as before.
Its observer dispatches the explicit `q2BrowserPolicy` Worker URL parameter
to this provider. No selector keeps the historical CPU pin and behavior;
unknown or duplicate selectors fail before fetching canonical bytes.
The canonical EXE, slot-zero requirement, native-write option and owning
exports/memory callbacks remain the same. WebCrypto authenticates canonical
EXE/CPU bytes, then the very same objects reach attach/compile respectively.
There is no caller-supplied CPU hash/path/module exception.

The Q2 caller adapter composes the actual retained production consumer through
`quake2-native-driver-composition.cjs`. Immediately before its existing
`shell.launchApp('quake2_demo')`, it decorates only the owning guest Worker URL
returned by `WineAssembly.versionedUrl`. It preserves other asset URLs,
cache versions, strict observation flags, DLL parking, physical admission,
sticky failure, writer lifetime and close logic. Its preload checks the
explicit module/policy version, published policy authority and every staged
provider before registering the consumer's compile hook.

Preparation uses `quake2-staged-closure-gameplay.cjs --prepare DESTINATION
MODULE_VERSION POLICY_VERSION`. `MODULE_VERSION` is exported as
`browserModuleVersion` by `quake2-current-module.cjs`. The manifest records
the exact CPU/browser pins, published authority, preload and runtime
environment. The runtime uses `--require ./tools/quake2-current-browser-policy.cjs`
with that environment and a fresh `QUAKE2_NATIVE_RUN`; the older
`QUAKE2_NATIVE_COMPOSITION=1` preload must be absent. This describes the
integration, and does not authorize a runtime attempt. Historical v2 provider
validation still refuses changed observer bytes rather than repinning them.

The exact Q3 1585 frozen pinset intersection was recorded before editing:
`lib/quake2-browser-load-observer.js` and `lib/guest-worker.js` were included;
all new Q2 providers, the Q2 preparer and staged checker were absent. New code,
tests and the proposed observer patch were exercised in memory while Q3 held
the observer. `guest-worker.js`, host, WAT/CPU, shared custody and all Q3/Redline
providers stay untouched. The observer edit followed Q3's final published
release `8b91cbbc0836843d541e66da29549eaf6b5b91ab` at 14:59:47 UTC,
after rereading the exact UUID archive and 350/350 original plus 168/168 fixture
physical drain records. Their paths and SHA/size references are retained.
The narrow implementation was then published as
`a16fc87d477d8891a741e1a214cfc89f5a924ac4`; the preparer authenticates those
exact published bytes, including origin/main ancestry, before staging.

Validation includes real canonical EXE/current CPU with WebCrypto and inert
compile/attach, identical-object handoff, wrong selector/slot, missing policy,
EXE/CPU corruption, actual production caller composition and Worker URL
selection. Preparation/preload controls cover exact published pins, both
staged CPU artifacts, missing/changed providers, wrong versions and historical
default parity. Existing 21 composed request/close/input controls ran with
only the explicit published custody selection and expected custody SHA updated
in memory; all passed. Their Node-only descendants were actually waited and
drained under finite independent watchdogs. An initial invocation missing its
required run argument and an initial inert test-module load are retained as
failed/nonexecuted controls; neither counts as a pass.

Preparation always verifies published Git provenance. With the explicit
runtime preload flag, the same validator entrypoint instead verifies staged
bytes against the manifest and fixed published CPU/browser mirrors, without
requiring Git on the runtime box. The actual preload registration is tested
with every Git invocation forbidden. Forged manifests that repin a damaged
CPU or browser policy provider are refused before the consumer compile hook.

Evidence uses exact Git bases and small binary patches, without source
archives, media copies or module copies. Completed owned control journals
were losslessly gzipped, independently decoded and SHA/size checked before
removing raw duplicates; recovery recipes are retained. Raw empty stderr files
remain raw. The existing production command-log suite also creates 21 gzip
stderr streams with empty decoded payloads; these are retained and explicitly
classified EMPTY_INVALID, never promoted to proof.
Concurrent workspace growth briefly put observed free space at 1,499,361,280
bytes; coordinated storage compression restored it above 1.5 GB. This task
compressed/deduplicated only its own completed evidence and retained recipes.

`nativeQualification=false`. All-writers, aliases, peer/raw-host parse and
ABA remain UNKNOWN. Historical separate Node-command EOF remains UNKNOWN;
the earlier combined kernel/Node command EOF TRUE is a separate observation.
This task creates no box: ID/state NOT_CREATED, expiry/stop receipt N/A.
