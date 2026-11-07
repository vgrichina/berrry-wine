# AVP2 required-consumer cancellation repair

Run: `scratch/runs/20261107-avp2-consumer-cancellation/` (ignored).

The response adapter now accepts an explicit body-size bound and separates
required-at-startup consumer URLs from lazy observed URLs. Every invocation of
an observed URL still registers a mandatory exact request/context/target EOF,
length and SHA-256 completion. The collector's cancellation, status and body
policy is unchanged. No executable abort is declared optional. Defaults retain
the previous 64 MiB bound and all-selected-URLs-required behavior.

## Causal evidence and focused repair

Predecessor request `6082.274` was a page Fetch of the 950,272-byte LithTech
body, continued before its `net::ERR_ABORTED`. It preceded ShellExecute and the
later child icon Image request. The predecessor did not retain its initiator
stack, so that historical stack cannot be retrospectively asserted.

The real registered launcher-child local reproduction records the corresponding
request's actual Network initiator: `_fetchAssetResponse → _fetchAssetCandidate
→ fetchAssetBytes → fetchWithRetry`. This is the startup VFS file load, distinct
from launcher `AVP2.exe` (`loadExe`) and shell icon extraction
(`fetchIconDataURL`). The child executable is subsequently loaded from that
mounted VFS, without a second LithTech HTTP executable-body request. The first
uncovered local cancellation varied to `ltmsg.dll`, demonstrating why selecting
only an executable extension would be insufficient.

The run driver now requires all nine actual eager startup consumers (launcher
plus eight file loads). Other pinned media URLs are observed if fetched. A lazy
URL need not be downloaded merely for collection, but any started invocation
must finish. No clone, tee, read-ahead, replacement response, fulfillment or
second evidence fetch is used. Existing consumer observation is reused.

`local-causal/first-fault.json` is failing-before evidence. With eager coverage,
`local-repaired/first-fault.json` exposed the next explicit limit: AVP2.REZ is
180,265,012 bytes, above 64 MiB. The driver supplies the maximum exact pinned
body size to both collector and consumer observer. Full bodies still require
matching pinned size/hash. `local-bounded/boot.json` proves the exact registered
launcher-child command passes collection, including real large archive
arrayBuffer completion. The reviewed local image is blank; it is not gameplay.

The permanent coverage regression fails with the predecessor implementation
(`before-regression2.log`) and passes after repair (`collector-tests2.log`),
including all 129 existing synthetic lifecycle cases. Their opposing EOF,
AbortController/reader cancellation, wrong length/hash/owner/context, duplicate,
replacement and uncovered-resource controls remain enforced. Existing passed
input, independent-UP, UNKNOWN and entry-identity controls were reused unchanged;
`reused-controls.json` records hashes and prior evidence. Both locked builds
passed. The compiled module remains `f9650607181301b5d2a9990420f437bd9f1ca10d40ac73067339f07499d53121`.

## One authorized original

One fresh UUID-idempotent separate box: `bx_kbx4ufmn`, allocated at
21:41:51Z; initial expiry 22:16:51.704Z. Independent normal shutdown and 25-minute
watchdog OS delegates were armed before allocation; cap 22:06:51.953Z. The local
and remote free-disk floors exceeded 5 GB. Remote assembly verified 619 runtime
pins, actual Node dependency closure, helper hashes and original media recovery.
No guest bindings, clocks, registered app settings or threading mode changed.

Actual command: `node scratch/runs/20261107-avp2-consumer-cancellation/staged-browser.cjs`,
`PINS_FILE=browser-input-pins3.json`, `OUT_LABEL=remote-webgl`, with the immutable
allocation deadline and `WINE_TEST_BOX=bx_kbx4ufmn`. Local fixture flags and
NODE_OPTIONS were absent. Chrome 151.0.7922.108 used the registered
`index.html?debug&candidates&threads&no-log&d3d-renderer=webgl&app=avp2_demo` route.

The first original screenshot passes the strict collector and shows a blank
client area. LithTech child process 1001 has two live CPU workers, with the
recorded instantiated module; no render endpoint exists at this checkpoint.
No menu, Marine world, movement or attack is claimed from that image.

The final outcome is the first-UNKNOWN stop documented below.

Git is the source archive: `source-head.txt`, relevant `source-diff.patch`,
`new-files.patch`, owned-helper patches, runtime/helper pins and existing media
path/hash references retain recovery inputs. No source archive or duplicate game
media was created. Unique tested instantiated bytecode and captures are retained.

The bounded settled capture reached the main menu and initialized legacy WebGL
endpoint 1, native Intel/Mesa, actual fences and zero reported fallback. The
blank boot checkpoint had preceded renderer creation, so its original entry
seal was unsuitable for input. Without sending an input through that stale
seal, `late-input.cjs` attached to the same live browser and sealed once at the
personally reviewed initialized `menu-entry` checkpoint. It calls the unchanged
`entry-identity.cjs` admission and `gated-controls.cjs` independent-UP controls.
Every input requires a fresh personally reviewed screenshot, complete original
collector snapshot, live matching workers, the sealed process/window/reference
identity, module hashes, native renderer, fences and zero fallback. The original
collector/driver remains attached and drains every subsequent capture. This is
one running original, with no restart or replay and no guest state modification.

Three ordinary Enter holds (150 ms each) were acknowledged DOWN/UP and reached
Single Player, Marine mission selection (Unwelcome Guests, Normal) and mission
launch. Screenshots were personally reviewed before each action. Main menu text
is legible; Marine character preview is a white silhouette. Launch initially
shows a black screen with white loading shapes. Those defects are retained,
not treated as proof of a rendered world.

## Terminal boundary: first UNKNOWN, no replay

After the bounded loading-screen observation, one ordinary Enter attempted to
continue. It received trusted browser keydown/keyup, independent UP completed,
and physical state was false, but the asynchronous key state remained true.
The strict existing acknowledgement predicate therefore reported UNKNOWN at
21:49:35Z. `late-commands/4.failed.json`, `marine-continue-input-ack.json` and
`late-input-terminal.json` retain this distinction; the held set was empty.
No second input, movement, attack, replay or predicate relaxation followed.
The asynchronous value alone is not proof that a key remained physically held;
its guest-consumption/latch semantics need a separate local investigation.

The final read-only `unknown-stop` screenshot still shows black/white loading
shapes, not a recognizable Marine world. A loading/rendering defect remains.
Marine menu selection and mission launch are proved; gameplay, movement and
attack consequences are not. Next: locally distinguish loading progress from
the white/untextured rendering defect, and test the actual async-key latch and
guest consumption contract without weakening independent release requirements.
No further original is authorized by this spent single-attempt grant.

All 83 unique remote artifacts (10,248,308 bytes) were retrieved and verified by
size/SHA-256 before normal stop was requested. Cleanup verified both original
ports closed, all owned processes gone (including the late controller), profile
removed and no held input. The browser exited normally. Normal-stop status is
recorded in the lifecycle files. The immutable 25-minute watchdog remained
armed through recovery and normal shutdown. No public deployment occurred.

Normal stop `stop_6455b73cb6370d83` completed at 21:50:41.441Z, forced=false.
Box `bx_kbx4ufmn` is archived; current `archiveAfter` is null, so retention
expiry is unknown (initial expiry 22:16:51.704Z). Both delegates exited after
confirmed stop. Box ownership returns to the coordinator in this state; no
resume/delete action was taken. All three local reproduction profiles, ports
and process sets also pass cleanup.
