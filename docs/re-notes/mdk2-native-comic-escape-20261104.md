# MDK2 native comic Escape attempt — 2026-11-04

**Stopped at the first setup failure before Chrome. No original New Game,
Medium, loading, comic Escape, resulting scene or tutorial was executed.**
The failure was in my run-only preflight: its broad `pgrep -f` Chrome-absence
pattern matched the Python/exec command containing the pattern itself. This
was a false positive, not evidence of an existing Chrome process. I preserved
the failed command and did not correct and rerun the preflight or launch a
browser under this assignment.

The inspected handoffs were `fb257e361`,
`mdk2-original-comic-controls-20261104.md`, and `5a6307e99`,
`mdk2-opening-observation-20261104.md`. Their original-supported Escape release
→ StopScript → comic Done → lounge-intro chain remains a source finding;
this attempt supplies no live confirmation. Later intro/tutorial chaining
was never attempted or authorized.

Evidence is under ignored
`scratch/runs/20261104-mdk2-native-comic-escape/` (RUN). The assigned fresh box
`bx_85fyu4ug` was independently verified executable at 04:49:12Z, with API idle,
health ok and hydrated true. The ACK and file ownership were recorded on the
shared messageboard. No allocation, resume, shutdown or other lifecycle action
was performed; the old box was not accessed.

Runtime reconstruction followed the predecessor recipe: 432 files, each
checked locally before transfer and remotely afterward. Source/assets came
from Git `1329b1ba6eb00144ff77d4cd92a8513d4fc953ad`; original media was read
from its existing paths and transferred directly to the assigned runtime.
The two modules came from the predecessor's retained recovered build paths.
`staged-path-references.json` records each source, size and full SHA-256.
No media was copied into local evidence, and no source-tree archive was made.

| Original input | SHA-256 |
| --- | --- |
| `mdk2Main.exe` | `b3e0226e411abff17ddabb723e493e95579490cb49bfe3787b1eade1144e27c1` |
| `data/scripts.zip` | `cfdae6e7d02b1823a59d0b85aa8eaca2f057dbb27e7b86d9a7199fc069f642d8` |
| `data/base.zip` | `a8f3da86e66f4271bc9d876053ef04ec46b29a74f5397bf59f72fff90843216c` |
| Canonical module | `cffca869b541e6eff12ae3a6b74c4476977e0a7e23cd43d8ec5ba8faecd4bcee` |
| Companion module | `580f49f3c78d26e6855efa0beb37046d03ea24690ff98cfcb3e94ce5e6cb1ee3` |

Before Chrome, the copied run-only helpers passed **50 comic-control tests,
42 native-menu tests and six actual-driver inspection-guard tests**. Comic
helper imports were adjusted to this run's copies; behavior was unchanged.
The actual copied driver command function is exercised by the six tests.
The driver deadline was adapted to this allocation: at most 20 minutes,
hard deadline 05:35Z, with its three-minute recovery reserve. The unchanged
selector and comic aggregate/action limits were retained. No driver ran.

Puppeteer **24.31.0**, the predecessor's tested version, was installed in an
isolated run-specific `browser-deps` prefix with scripts/downloads disabled.
The installation added 94 packages. The subsequent remote command successfully
verified all 432 runtime pins, helper syntax, the actual Puppeteer import and
version, its launch-function presence and the static-server import. Then the
Chrome-absence assertion failed. Dependency installation was not the failure.
The recovered package lock seals the resolved dependency graph.

`first-setup-failure.json`, `prepare.log` and `remote-commands.jsonl` retain
command `cmd_euxko8f7kpki`: exit 1 at **04:50:30.579Z**, stdout
`actual puppeteer import24.31.0 PASS`, stderr `AssertionError: existing Chrome`.
The failed command itself contains the matching Chrome pattern. A subsequent
read-only `/proc` executable/comm inventory found **zero Chrome, Chromium or
Node processes** and confirmed no browser output directory existed. This was
failure diagnosis and recovery, not a second preflight or launch. Registered
selector/isolation and actual served-module verification were not reached;
source pin matches cannot stand in for those live checks.

Recovery finished around **04:51Z**, before 05:38Z. Five unique files,
**4,411,955 bytes**, including both actual staged modules, dependency package
and lock, and closure/pin evidence, passed local size/full-SHA checks and a
second stable remote hash read. All 432 runtime pins remained unchanged.
No driver/browser/server was started, so no task-owned browser process or
HTTP port required closure. Existing platform listeners were recorded and
left alone. No screenshots exist from this attempt.

`checkout-head.txt`, `relevant-uncommitted.patch`,
`checkout-vs-execution.patch`, `execution-source-delta.patch`,
`driver-changes.patch` and `owned-new-files.patch` preserve provenance and
reconstruction. The executed-runtime source delta from the pinned Git baseline
is empty; checkout differences were recorded separately and never applied.
Only this note is committed. No production defect was established, production
file edited or production build run. No console, cheat, guest write, config
patch, gameplay input, retry, reload, second browser, worker, successor,
public deployment or other game was used.

Hand back **bx_85fyu4ug / RUNNING (API idle), health ok, hydrated true / expiry
2026-11-04T05:48:31.042Z**, with **shutdownOwner=coordinator**. No lifecycle action
was taken. A future separately authorized attempt needs the preflight process
check corrected to inspect executable/comm identity without matching its own
command text, then must complete actual selector/HTTP checks before Chrome.
The requested live post-Escape scene remains unobserved. This single task stops.
