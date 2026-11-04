# MDK2 accepted entry: exact offline prerequisite staging

`tools/mdk2-entry-staging.cjs` repairs the prerequisite reported by
[`e01b82f4a`](mdk2-bound-original-construction-20261104.md): 45 absent helpers,
one old wrapper, and missing accepted integration/Git metadata. The accepted
[`6d5121b5f` entry](mdk2-bounded-trace-driver-repair-20261104.md) itself is
unchanged. Its 111 helper identities, published observer, four Git-backed
original runtime dependencies, original432 manifest and original cffc/580f
module hashes remain binding. Current main/build is never substituted.

Evidence is `scratch/runs/20261104-mdk2-entry-staging/` (RUN). This task used
only offline fixtures, focused tests and the locked build. No boat/API, Chrome,
game, HTTP server, heavy game execution, deployment or lifecycle operation was
performed. Box ID/state/expiry: **NA**. Closed `bx_dj748qxr` was never accessed
or resumed. The coordinator owns future allocation and shutdown.

## Small inputs and Git integrity

`--prepare` reads the exact accepted integration blob from commit
`6d5121b5f96ee6032a9e347e2db64db29c478518`, independently checks its fixed
SHA-256, and reads the observer from
`de6a33f257d93e8814d666bdec62361161569ac4`. The helper set comes from that
accepted entry, with exact SHA-256 verification before use. Gzip-only helper
storage is decoded in memory. The original pins and their seal stay compressed.

The transfer input contains 115 paths: 111 small run helpers, the accepted
integration and observer, and two compressed manifest inputs. Their combined
decoded/input size is468555 bytes. A minimal15-object Git proof contains three
exact commit objects, the six trees on the selected paths and six blobs: the
entry, observer, and original `host.js`, `lib/guest-worker.js`,
`lib/guest-rpc.js`, `lib/guest-thread-host.js`. Every object's Git identity is
recomputed, and each path is traversed from its fixed commit through the tree
objects to its blob. Missing, unrelated or altered objects reject. Changing a
blob and its advertised object ID still fails the historical tree link.

The complete transfer JSON is1596875 bytes, SHA-256
`0eaa37e174ca2e5d58aa480faadb0762e60e4b8869f9738ff630c29f6058d3d7`.
This is an allowlisted entry input, not a source snapshot. No checkout, `.git`
directory, history archive, scratch/docs/test archive, module or media copy is
transferred. Tree objects contain only path metadata. Git remains the source
archive; RUN records the tested Git SHA, relevant binary diff and owned new-file
patches.

`--stage` refuses a Git checkout and helper symlink writes. It verifies the
entire input before writing, verifies the inherited original modules, and
rejects disagreement in existing tracked entry/manifest inputs. It installs
missing helpers and repairs mismatching members of the exact111-helper set,
recording the previous SHA-256. Atomic replacement preserves any inherited
hardlink peers. A newly initialized partial bare object database lives at
`scratch/runs/20261104-mdk2-entry-staging-inputs/git-proof`; no existing `.git`
is copied. Its parent contains the validated transfer input for subsequent
entry validation. Git and Node must already be installed.

The historical retained module references become relative symlinks to the
existing inherited original build paths after size/hash checks. The fixture
uses symlinks to retained gzip storage and decodes in memory. An actual served
runtime still needs all432 original raw files: the accepted `--run` and HTTP
gates retain that requirement. Staging does not certify the complete served
runtime or provision missing media/modules.

Before invoking the accepted entry, the launcher revalidates every staged
input and exact live Git object bytes, forbids alternates/replacements, and
sets an explicit isolated `GIT_DIR`. Inherited Git environment/configuration
cannot select a parent checkout or another object store. The accepted entry's
original `git show COMMIT:path` calls then run against that proof; its observer
and dependency comparisons are unchanged. No Git-backed check is bypassed.

## Recovery and future invocation

From the recorded main commit plus relevant patches, recover this staging tool
through Git. Keep RUN's transfer input and the unique ignored helper inputs;
their original paths, sizes and SHA-256 are in `payload-summary.json` and
`accepted-check.json`. These commands do not allocate a runtime:

```sh
# Shared checkout: produce only the bounded run input.
node tools/mdk2-entry-staging.cjs --prepare /ABSOLUTE/entry-inputs.json

# A separately authorized inherited runtime root, without .git:
node /PATH/TO/mdk2-entry-staging.cjs --stage /ABSOLUTE/entry-inputs.json /INHERITED/ROOT
node /PATH/TO/mdk2-entry-staging.cjs --check /INHERITED/ROOT
```

The staging tool may be transferred separately as one small run input recovered
from its published Git commit. A failed or partial stage is a prerequisite
failure; a previously created proof is not silently overwritten. Inspect the
specific failed run inputs before retrying a stage, without launching a game.

Only a separately authorized fresh assignment may invoke:

```sh
node /PATH/TO/mdk2-entry-staging.cjs --run /INHERITED/ROOT /ABSOLUTE/FRESH/RUN
```

This delegates to the accepted entry's unchanged `--run`. The caller must still
supply the fresh exact-path release, original sealed runtime-pins.json and all
original runtime bytes described in the bounded driver note. No old release,
ledger, approval or review is staged or reused. The measured Escape, author →
operator → next → control chain, single fresh launch, first-failure latch and
16-slice/bounded trace limits are preserved.

## Offline proof and remaining work

`node test/test-mdk2-entry-staging.js` passes26 tests. The minimal inherited
fixture reproduces65 matching helpers,45 missing helpers and one mismatched
wrapper, with no entry, `.git`, source tree or test tree. It then executes the
actual unchanged accepted `--check` through real Git. A separate child process
compiles and loads the actual composed entry before its sole bootstrap call,
loads its real helper dependencies, and produces the six exact controller
sources. No bootstrap, Puppeteer, server or guest execution occurs in these
staging controls. Temporary fixture inputs are removed after the tests.

Missing helpers, changed wrapper/observer/entry, wrong bytes in each of the four
live Git-backed runtime blobs, missing/corrupt/unrelated proof objects, changed
pins, path injection, wrong inherited modules, helper symlinks, and absent Git
proof all fail. Both the launcher and the accepted entry reject the applicable
helper/observer/Git dependency negatives. A missing fresh release still rejects
before controller/output creation.

All51 existing construction integration tests pass using the prior sealed
in-memory gzip fixture reader:

```sh
node --require ./scratch/runs/20261104-mdk2-bound-original-construction/fixture-gzip.cjs test/test-mdk2-construction-driver-integration.js
flock /tmp/wine-build.lock bash tools/build.sh
```

The locked full build passes. Its current output modules were not used as
original execution modules. RUN retains the small logs, stage repair report,
actual accepted check, composed-dependency report, input identities, Git SHA,
patches and seal. No new browser handshake, construction/native completion,
Level creation, Lua execution or gameplay is established. Next is a separately
authorized fresh exact-runtime prerequisite check and original attempt; this
single offline assignment ends after its own main commit and publication.
